import { configStateService } from "../common/config-state-service.js";
import {
  VALID_ACTIONS,
  VALID_DIRECTIONS,
  mergeGestureConfigs,
  normalizeSequence,
  validateGestureConfig
} from "../common/config-validation.js";
import { createLogger } from "../common/log.js";
import { createSequenceMultiSelect } from "./sequence-multiselect.js";
import type { Direction, GestureAction, GestureConfig, GestureDefinition } from "../common/types.js";

const logger = createLogger("OptionsPage");

interface OptionsState {
  currentConfig: GestureConfig | null;
  defaultConfig: GestureConfig | null;
  selectedIndex: number | null;
}

const state: OptionsState = {
  currentConfig: null,
  defaultConfig: null,
  selectedIndex: null
};

const elements = {
  gestureList: null as HTMLDivElement | null,
  editor: null as HTMLElement | null,
  delayInput: null as HTMLInputElement | null,
  minDistanceInput: null as HTMLInputElement | null,
  saveButton: null as HTMLButtonElement | null,
  restoreButton: null as HTMLButtonElement | null,
  exportButton: null as HTMLButtonElement | null,
  importButton: null as HTMLButtonElement | null,
  importInput: null as HTMLInputElement | null,
  addGestureButton: null as HTMLButtonElement | null,
  deleteGestureButton: null as HTMLButtonElement | null
};

let toastTimer: number | null = null;

// Shows toast message to the user.
const showToast = (message: string, isError = false) => {
  const toast = document.getElementById("toast");
  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.classList.toggle("visible", true);
  toast.classList.toggle("error", isError);

  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }

  toastTimer = window.setTimeout(() => {
    toast.classList.toggle("visible", false);
  }, 2500);
};

// Clones gesture configuration deeply.
const cloneConfig = (config: GestureConfig): GestureConfig => JSON.parse(JSON.stringify(config));

// Loads default configuration from bundled JSON.
const loadDefaultConfig = async (): Promise<GestureConfig> => {
  const url = chrome.runtime.getURL("config/gestures.json");
  logger.info("Loading default config for options", url);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load default config: ${response.status}`);
  }
  const json = (await response.json()) as GestureConfig;
  const normalized: GestureConfig = {
    defaultDelay: json.defaultDelay,
    minMoveDistance: json.minMoveDistance,
    gestures: json.gestures.map((gesture) => ({
      ...gesture,
      sequence: normalizeSequence(gesture.sequence)
    }))
  };
  validateGestureConfig(normalized);
  return normalized;
};

// Synchronizes global inputs from current state.
const syncGlobalInputs = () => { // single-line comment
  if (!state.currentConfig) {
    return;
  }
  if (elements.delayInput) {
    elements.delayInput.value = String(state.currentConfig.defaultDelay);
  }
  if (elements.minDistanceInput) {
    elements.minDistanceInput.value = String(state.currentConfig.minMoveDistance);
  }
};

// Builds static layout structure.
const buildLayout = () => {
  const app = document.getElementById("app");
  if (!app) {
    throw new Error("Options root element not found");
  }

  app.innerHTML = "";

  const header = document.createElement("header");
  const title = document.createElement("h1");
  title.textContent = "Simple Mouse Gesture";
  header.appendChild(title);

  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";

  elements.saveButton = document.createElement("button");
  elements.saveButton.className = "btn-primary";
  elements.saveButton.textContent = "Save";

  elements.restoreButton = document.createElement("button");
  elements.restoreButton.textContent = "Restore Default";

  elements.exportButton = document.createElement("button");
  elements.exportButton.textContent = "Export";

  elements.importButton = document.createElement("button");
  elements.importButton.textContent = "Import";

  elements.importInput = document.createElement("input");
  elements.importInput.type = "file";
  elements.importInput.accept = "application/json";
  elements.importInput.style.display = "none";

  toolbar.append(
    elements.saveButton,
    elements.restoreButton,
    elements.exportButton,
    elements.importButton,
    elements.importInput
  );

  header.appendChild(toolbar);
  app.appendChild(header);

  // Global settings card
  const settingsSection = document.createElement("section");
  settingsSection.className = "settings-card";

  const settingsHeader = document.createElement("div");
  settingsHeader.className = "toolbar";
  const settingsTitle = document.createElement("h2");
  settingsTitle.textContent = "Global Settings";
  settingsHeader.appendChild(settingsTitle);
  settingsSection.appendChild(settingsHeader);

  const settingsGrid = document.createElement("div");
  settingsGrid.className = "settings-grid";

  const delayField = document.createElement("div");
  delayField.className = "field";
  const delayLabel = document.createElement("label");
  delayLabel.textContent = "Min gesture duration (ms)";
  elements.delayInput = document.createElement("input");
  elements.delayInput.type = "number";
  elements.delayInput.min = "0";
  elements.delayInput.addEventListener("change", () => {
    if (!state.currentConfig) {
      return;
    }
    const fallback = state.currentConfig.defaultDelay;
    const value = Number(elements.delayInput?.value ?? fallback);
    state.currentConfig = {
      ...state.currentConfig,
      defaultDelay: Number.isFinite(value) ? value : fallback
    };
  });
  delayField.append(delayLabel, elements.delayInput);

  const distanceField = document.createElement("div");
  distanceField.className = "field";
  const minDistanceLabel = document.createElement("label");
  minDistanceLabel.textContent = "Min move distance (px)";
  elements.minDistanceInput = document.createElement("input");
  elements.minDistanceInput.type = "number";
  elements.minDistanceInput.min = "1";
  elements.minDistanceInput.addEventListener("change", () => {
    if (!state.currentConfig) {
      return;
    }
    const fallback = state.currentConfig.minMoveDistance;
    const value = Number(elements.minDistanceInput?.value ?? fallback);
    state.currentConfig = {
      ...state.currentConfig,
      minMoveDistance: Number.isFinite(value) ? value : fallback
    };
  });
  distanceField.append(minDistanceLabel, elements.minDistanceInput);

  settingsGrid.append(delayField, distanceField);
  settingsSection.appendChild(settingsGrid);
  app.appendChild(settingsSection);

  const main = document.createElement("main");

  const listSection = document.createElement("section");
  listSection.className = "gesture-list";
  const listHeader = document.createElement("div");
  listHeader.className = "toolbar";
  const listTitle = document.createElement("h2");
  listTitle.textContent = "Gestures";

  elements.addGestureButton = document.createElement("button");
  elements.addGestureButton.className = "btn-primary";
  elements.addGestureButton.textContent = "Add";

  listHeader.append(listTitle, elements.addGestureButton);
  listSection.appendChild(listHeader);

  elements.gestureList = document.createElement("div");
  elements.gestureList.className = "gesture-list-items";
  listSection.appendChild(elements.gestureList);

  elements.editor = document.createElement("section");
  elements.editor.className = "gesture-editor";

  main.append(listSection, elements.editor);
  app.appendChild(main);

  syncGlobalInputs();
};

// Renders gesture list items.
const renderGestureList = () => {
  if (!elements.gestureList || !state.currentConfig) {
    return;
  }

  elements.gestureList.innerHTML = "";

  if (state.currentConfig.gestures.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No gestures configured.";
    elements.gestureList.appendChild(empty);
    state.selectedIndex = null;
    renderGestureEditor();
    return;
  }

  state.currentConfig.gestures.forEach((gesture, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "gesture-item";
    if (state.selectedIndex === index) {
      item.classList.add("active");
    }

    const label = document.createElement("span");
    label.textContent = gesture.sequence.join(" > ");
    const action = document.createElement("span");
    action.textContent = gesture.action;
    item.append(label, action);

    item.addEventListener("click", () => {
      state.selectedIndex = index;
      renderGestureList();
    });

    elements.gestureList?.appendChild(item);
  });

  if (state.selectedIndex === null) {
    state.selectedIndex = 0;
  }

  renderGestureEditor();
};

// Parses gesture sequence input.
const parseSequence = (value: string): Direction[] => {
  const parts = value
    .split(/[,>\n]/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return [];
  }

  const normalized = normalizeSequence(parts);
  for (const direction of normalized) {
    if (!VALID_DIRECTIONS.includes(direction)) {
      throw new Error(`Invalid direction ${direction}`);
    }
  }

  return normalized;
};

// Updates selected gesture in state.
const updateSelectedGesture = (updater: (gesture: GestureDefinition) => GestureDefinition) => {
  if (!state.currentConfig || state.selectedIndex === null) {
    return;
  }

  const gestures = [...state.currentConfig.gestures];
  gestures[state.selectedIndex] = updater(gestures[state.selectedIndex]);
  state.currentConfig = {
    ...state.currentConfig,
    gestures
  };
  renderGestureList();
};

// Renders gesture editor panel.
const renderGestureEditor = () => {
  const editor = elements.editor;
  if (!editor) {
    return;
  }

  editor.innerHTML = "";

  if (!state.currentConfig) {
    const loading = document.createElement("p");
    loading.textContent = "Loading configuration...";
    editor.appendChild(loading);
    return;
  }

  const config = state.currentConfig;

  if (state.selectedIndex === null) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Select a gesture to edit.";
    editor.appendChild(empty);
    return;
  }

  const gesture = config.gestures[state.selectedIndex];

  const sequenceField = document.createElement("div");
  sequenceField.className = "field";
  const sequenceLabel = document.createElement("label");
  sequenceLabel.textContent = "Gesture sequence";
  const sequenceSelect = createSequenceMultiSelect({
    value: gesture.sequence,
    allOptions: VALID_DIRECTIONS.filter((d) => d !== "RIGHT_BUTTON"),
    onChange: (next) => {
      updateSelectedGesture((current) => ({ ...current, sequence: next }));
    }
  });
  sequenceField.append(sequenceLabel, sequenceSelect);
  editor.appendChild(sequenceField);

  const actionField = document.createElement("div");
  actionField.className = "field";
  const actionLabel = document.createElement("label");
  actionLabel.textContent = "Action";
  const actionSelect = document.createElement("select");
  VALID_ACTIONS.forEach((action) => {
    const option = document.createElement("option");
    option.value = action;
    option.textContent = action;
    if (gesture.action === action) {
      option.selected = true;
    }
    actionSelect.appendChild(option);
  });
  actionSelect.addEventListener("change", () => {
    const value = actionSelect.value as GestureAction;
    updateSelectedGesture((current) => ({ ...current, action: value }));
  });
  actionField.append(actionLabel, actionSelect);
  editor.appendChild(actionField);

  elements.deleteGestureButton = document.createElement("button");
  elements.deleteGestureButton.className = "btn-danger";
  elements.deleteGestureButton.type = "button";
  elements.deleteGestureButton.textContent = "Delete Gesture";
  elements.deleteGestureButton.addEventListener("click", () => {
    if (!state.currentConfig) {
      return;
    }
    const gestures = state.currentConfig.gestures.filter((_, index) => index !== state.selectedIndex);
    state.currentConfig = { ...state.currentConfig, gestures };
    state.selectedIndex = gestures.length > 0 ? Math.min(state.selectedIndex!, gestures.length - 1) : null;
    renderGestureList();
  });
  editor.appendChild(elements.deleteGestureButton);
};

// Handles gesture creation.
const handleAddGesture = () => {
  if (!state.currentConfig) {
    return;
  }

  const newGesture: GestureDefinition = {
    sequence: ["UP"],
    action: "SCROLL_TOP"
  };
  state.currentConfig = {
    ...state.currentConfig,
    gestures: [...state.currentConfig.gestures, newGesture]
  };
  state.selectedIndex = state.currentConfig.gestures.length - 1;
  renderGestureList();
};

// Handles configuration save.
const handleSave = async () => {
  if (!state.currentConfig) {
    return;
  }

  try {
    validateGestureConfig(state.currentConfig);
    await configStateService.save(state.currentConfig);
    showToast("Configuration saved");
    logger.info("Configuration saved from options page");
  } catch (error) {
    logger.error("Save failed", error);
    const message = error instanceof Error ? error.message : "Failed to save configuration";
    showToast(message, true);
  }
};

// Handles restoring defaults.
const handleRestoreDefault = () => {
  if (!state.defaultConfig) {
    return;
  }

  state.currentConfig = cloneConfig(state.defaultConfig);
  state.selectedIndex = state.currentConfig.gestures.length > 0 ? 0 : null;
  renderGestureList();
  syncGlobalInputs();
  showToast("Default configuration restored");
  logger.info("Restored default configuration");
};

// Handles exporting configuration.
const handleExport = () => {
  if (!state.currentConfig) {
    return;
  }

  const blob = new Blob([JSON.stringify(state.currentConfig, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "mouse-gestures.json";
  link.click();
  URL.revokeObjectURL(url);
  showToast("Configuration exported");
  logger.info("Exported configuration as JSON");
};

// Handles importing JSON configuration.
const handleImport = (file: File) => {
  file
    .text()
    .then((content) => {
      const parsed = JSON.parse(content) as GestureConfig;
      const normalized: GestureConfig = {
        defaultDelay: parsed.defaultDelay,
        minMoveDistance: parsed.minMoveDistance,
        gestures: parsed.gestures.map((gesture) => ({
          ...gesture,
          sequence: normalizeSequence(gesture.sequence)
        }))
      };
      validateGestureConfig(normalized);
      state.currentConfig = state.defaultConfig
        ? mergeGestureConfigs(state.defaultConfig, normalized)
        : normalized;
      state.selectedIndex = state.currentConfig.gestures.length > 0 ? 0 : null;
      renderGestureList();
      syncGlobalInputs();
      showToast("Configuration imported");
      logger.info("Imported configuration from file");
    })
    .catch((error) => {
      logger.error("Import failed", error);
      const message = error instanceof Error ? error.message : "Failed to import configuration";
      showToast(message, true);
    });
};

// Binds event listeners to controls.
const bindEvents = () => {
  elements.addGestureButton?.addEventListener("click", handleAddGesture);
  elements.saveButton?.addEventListener("click", handleSave);
  elements.restoreButton?.addEventListener("click", handleRestoreDefault);
  elements.exportButton?.addEventListener("click", handleExport);
  elements.importButton?.addEventListener("click", () => {
    elements.importInput?.click();
  });
  elements.importInput?.addEventListener("change", () => {
    const input = elements.importInput;
    if (!input) {
      return;
    }
    const file = input.files?.[0];
    if (file) {
      handleImport(file);
      input.value = "";
    }
  });
};

// Initializes options page.
const initialize = async () => {
  try {
    state.defaultConfig = await loadDefaultConfig();
    const stored = await configStateService.read();
    if (stored) {
      state.currentConfig = mergeGestureConfigs(state.defaultConfig, stored.value);
      logger.info(`Loaded stored config from ${stored.source}`);
    } else {
      state.currentConfig = cloneConfig(state.defaultConfig);
      logger.info("Using default config in options page");
    }

    state.selectedIndex = state.currentConfig.gestures.length > 0 ? 0 : null;
    buildLayout();
    bindEvents();
    renderGestureList();
  } catch (error) {
    logger.error("Initialization failed", error);
    showToast("Failed to initialize options page", true);
  }
};

void initialize();
