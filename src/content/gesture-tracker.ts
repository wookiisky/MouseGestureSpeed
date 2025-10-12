import { createLogger } from "../common/log.js";
import { sendRuntimeMessage } from "../common/messaging.js";
import type { Direction, GestureConfig, RightMouseStatePayload } from "../common/types.js";

const logger = createLogger("GestureTracker");

interface GestureTrackerOptions {
  onSequence: (sequence: Direction[]) => void;
}

export class GestureTracker {
  private options: GestureTrackerOptions;
  private delay = 100; // minimal total duration in ms
  private minDistance = 10;
  private pointerId: number | null = null;
  private isTracking = false;
  private sequence: Direction[] = [];
  private lastPoint: { x: number; y: number } | null = null;
  private lastDirection: Direction | null = null;
  private listenersBound = false;
  private startTimestamp: number | null = null;
  private suppressNextContextMenu = false;
  private suppressUntil: number | null = null;
  private assumedRightDown = false;

  // Creates tracker with callbacks.
  constructor(options: GestureTrackerOptions) {
    this.options = options;
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerCancel = this.handlePointerCancel.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
  }

  // Updates tracker configuration.
  updateConfig(config: GestureConfig) {
    this.delay = config.defaultDelay;
    this.minDistance = config.minMoveDistance;
    logger.info(`Tracker config updated minDuration=${this.delay} distance=${this.minDistance}`);
  }

  // Starts listening for pointer events.
  start() {
    if (this.listenersBound) {
      return;
    }

    window.addEventListener("pointerdown", this.handlePointerDown, { capture: true });
    window.addEventListener("pointermove", this.handlePointerMove, { capture: true });
    window.addEventListener("pointerup", this.handlePointerUp, { capture: true });
    window.addEventListener("pointercancel", this.handlePointerCancel, { capture: true });
    window.addEventListener("contextmenu", this.handleContextMenu, { capture: true });
    window.addEventListener("mousedown", this.handleMouseDown, { capture: true });
    this.listenersBound = true;
    logger.info("Pointer listeners registered");
  }

  // Stops listening for pointer events.
  stop() {
    if (!this.listenersBound) {
      return;
    }

    window.removeEventListener("pointerdown", this.handlePointerDown, { capture: true } as EventListenerOptions);
    window.removeEventListener("pointermove", this.handlePointerMove, { capture: true } as EventListenerOptions);
    window.removeEventListener("pointerup", this.handlePointerUp, { capture: true } as EventListenerOptions);
    window.removeEventListener("pointercancel", this.handlePointerCancel, { capture: true } as EventListenerOptions);
    window.removeEventListener("contextmenu", this.handleContextMenu, { capture: true } as EventListenerOptions);
    window.removeEventListener("mousedown", this.handleMouseDown, { capture: true } as EventListenerOptions);
    this.listenersBound = false;
    logger.info("Pointer listeners removed");
  }

  private handlePointerDown(event: PointerEvent) {
    if (event.button !== 2) {
      return;
    }

    this.resetState();
    this.pointerId = event.pointerId;
    this.beginTracking(event);
    logger.info(
      `Right button pressed pid=${this.pointerId} at x=${event.clientX} y=${event.clientY}, tracking with minDuration=${this.delay}ms`
    );
    // Notify background about right button state
    const msg: RightMouseStatePayload = { down: true, ts: Date.now() };
    void sendRuntimeMessage({ type: "rmb/state-update", payload: msg });
    // Locally mark as down for potential chain usage
    this.assumedRightDown = true;
  }

  private handlePointerMove(event: PointerEvent) {
    if (!this.isTracking || event.pointerId !== this.pointerId) {
      return;
    }

    if (!this.lastPoint) {
      this.lastPoint = { x: event.clientX, y: event.clientY };
      return;
    }

    const dx = event.clientX - this.lastPoint.x;
    const dy = event.clientY - this.lastPoint.y;
    const distance = Math.max(Math.abs(dx), Math.abs(dy));

    if (distance < this.minDistance) {
      return;
    }

    const direction = this.inferDirection(dx, dy);
    if (direction && direction !== this.lastDirection) {
      this.sequence.push(direction);
      this.lastDirection = direction;
      logger.info(`Direction recorded ${direction}`);
    }

    this.lastPoint = { x: event.clientX, y: event.clientY };
  }

  private handlePointerUp(event: PointerEvent) {
    const isRightRelease = event.button === 2;
    const pointerMatches = event.pointerId === this.pointerId;

    if (!pointerMatches) {
      if (isRightRelease) {
        logger.info("Pointer up received after state reset; syncing RMB release");
        this.syncRightButtonRelease("pointer-up-untracked");
      }
      return;
    }

    if (!this.isTracking) {
      logger.info("Gesture cancelled before activation");
      this.resetState();
      if (isRightRelease) {
        this.syncRightButtonRelease("pointer-up-cancelled");
      }
      return;
    }

    logger.info("Pointer released, completing gesture");
    this.completeGesture("pointer-up");
    if (isRightRelease) {
      this.syncRightButtonRelease("pointer-up");
    }
  }

  private handlePointerCancel(event: PointerEvent) {
    if (event.pointerId !== this.pointerId) {
      if (this.assumedRightDown) {
        logger.info("Pointer cancel received after state reset; syncing RMB release");
        this.syncRightButtonRelease("pointer-cancel-untracked");
      }
      return;
    }

    logger.info("Pointer cancelled, aborting gesture");
    this.resetState();
    this.syncRightButtonRelease("pointer-cancel");
  }

  private handleContextMenu(event: MouseEvent) {
    if (!this.suppressNextContextMenu) {
      return;
    }

    // If suppression expired, do not block.
    if (this.suppressUntil && Date.now() > this.suppressUntil) {
      this.suppressNextContextMenu = false;
      this.suppressUntil = null;
      logger.info("Context menu suppression expired");
      return;
    }

    event.preventDefault();
    // Attempt to block other handlers on the page.
    if (typeof (event as any).stopImmediatePropagation === "function") {
      (event as any).stopImmediatePropagation();
    }
    event.stopPropagation();
    this.suppressNextContextMenu = false;
    this.suppressUntil = null;
    logger.info("Context menu suppressed after gesture");
  }

  private handleMouseDown(event: MouseEvent) {
    // Handle left click while right-drag gesture is active
    if (this.isTracking && event.button === 0) {
      this.sequence.push("LEFT_CLICK");
      logger.info("Left click captured during gesture");
      const triggered = this.completeGesture("left-click");
      if (triggered) {
        event.preventDefault();
      }
      return;
    }
  }

  private beginTracking(event: PointerEvent) {
    this.isTracking = true;
    this.sequence = [];
    this.lastPoint = { x: event.clientX, y: event.clientY };
    this.lastDirection = null;
    this.startTimestamp = Date.now();
    logger.info(
      `Gesture tracking activated pid=${this.pointerId} start=(${this.lastPoint.x},${this.lastPoint.y})`
    );
  }

  // Completes gesture and dispatches sequence
  private completeGesture(reason: string, opts?: { bypassDuration?: boolean }): boolean {
    const duration = this.startTimestamp ? Date.now() - this.startTimestamp : 0;

    if (this.sequence.length === 0) {
      logger.info("Gesture discarded due to insufficient input");
      this.resetState();
      return false;
    }

    if (!opts?.bypassDuration && duration < this.delay) {
      logger.info(`Gesture discarded due to short duration=${duration}ms < min=${this.delay}ms`);
      this.resetState();
      return false;
    }

    logger.info(`Gesture completed reason=${reason} duration=${duration}ms`, this.sequence);
    this.armContextMenuSuppression();
    this.options.onSequence([...this.sequence]);
    this.resetState();
    return true;
  }

  private inferDirection(dx: number, dy: number): Direction | null {
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? "RIGHT" : "LEFT";
    }

    if (Math.abs(dy) > 0) {
      return dy > 0 ? "DOWN" : "UP";
    }

    return null;
  }

  private resetState() {
    this.pointerId = null;
    this.isTracking = false;
    this.sequence = [];
    this.lastPoint = null;
    this.lastDirection = null;
    this.startTimestamp = null;
    logger.info("Tracker state reset");
  }

  // Arms one-shot suppression for next contextmenu.
  armContextMenuSuppression(windowMs: number = 0) {
    this.suppressNextContextMenu = true;
    this.suppressUntil = windowMs > 0 ? Date.now() + windowMs : null;
    logger.info(
      `Armed context menu suppression${windowMs > 0 ? ` with window=${windowMs}ms` : ""}`
    );
  }

  // Updates assumed right button state (for cross-tab chaining)
  setAssumedRightDown(state: boolean) {
    this.assumedRightDown = state;
    logger.info(`Assumed RMB state updated to ${state}`);
  }

  // Syncs right button release with background channel.
  private syncRightButtonRelease(reason: string) {
    if (!this.assumedRightDown) {
      return;
    }
    logger.info(`Syncing RMB release due to ${reason}`);
    const msg: RightMouseStatePayload = { down: false, ts: Date.now() };
    void sendRuntimeMessage({ type: "rmb/state-update", payload: msg });
    this.assumedRightDown = false;
  }
}

export const createGestureTracker = (options: GestureTrackerOptions) => new GestureTracker(options);
