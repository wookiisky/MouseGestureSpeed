export type Direction =
  | "UP"
  | "DOWN"
  | "LEFT"
  | "RIGHT"
  | "RIGHT_BUTTON"
  | "LEFT_CLICK";

export type GestureAction =
  | "NAVIGATE_BACK"
  | "NAVIGATE_FORWARD"
  | "SCROLL_TOP"
  | "SCROLL_BOTTOM"
  | "RELOAD"
  | "CLOSE_TAB"
  | "REOPEN_CLOSED_TAB"
  | "SWITCH_TAB_LEFT"
  | "SWITCH_TAB_RIGHT"
  | "OPEN_OPTIONS_PAGE"
  | "OPEN_URL";

export interface GestureDefinition {
  id?: string;
  sequence: Direction[];
  action: GestureAction;
  // Optional URL for OPEN_URL action
  url?: string;
}

export interface GestureConfig {
  defaultDelay: number;
  minMoveDistance: number;
  gestures: GestureDefinition[];
}

export type RuntimeMessageType =
  | "config/request"
  | "config/current"
  | "config/updated"
  | "gesture/triggered"
  | "gesture/action"
  | "gesture/suppress-contextmenu"
  | "rmb/state-update"
  | "rmb/state-request"
  | "rmb/state-current";

export interface RuntimeMessage<T extends RuntimeMessageType = RuntimeMessageType, P = unknown> {
  type: T;
  payload: P;
}

export type ConfigUpdatePayload = {
  config: GestureConfig;
};

export type GestureTriggeredPayload = {
  sequence: Direction[];
  action: GestureAction | null;
};

export type GestureActionPayload = {
  action: GestureAction;
  // Optional URL when action is OPEN_URL
  url?: string;
};

export type SuppressContextMenuPayload = {
  // Optional suppression window in ms (informational only)
  windowMs?: number;
};

// Payload for right mouse button state updates
export type RightMouseStatePayload = {
  down: boolean;
  // Optional timestamp for debugging
  ts?: number;
};

// Payload for right mouse button current state
export type RightMouseStateCurrentPayload = {
  down: boolean;
};

export type Subscriber<T> = (value: T) => void;

export type GestureMatch = {
  action: GestureAction;
  definition: GestureDefinition;
};

export type ActionSplitResult = {
  domActions: GestureAction[];
  extensionActions: GestureAction[];
};

export interface StoredConfigEnvelope {
  version: number;
  config: GestureConfig;
}

export interface ConfigStateSnapshot {
  source: "default" | "sync" | "local";
  value: GestureConfig;
}
