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
  | "SWITCH_TAB_RIGHT";

export interface GestureDefinition {
  id?: string;
  sequence: Direction[];
  action: GestureAction;
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
  | "gesture/suppress-contextmenu";

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
};

export type SuppressContextMenuPayload = {
  // Optional suppression window in ms (informational only)
  windowMs?: number;
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
