import { createLogger } from "../common/log.js";
import type { Direction } from "../common/types.js";

const logger = createLogger("SequenceMultiSelect");

interface MultiSelectProps {
  value: Direction[];
  allOptions: Direction[];
  onChange: (next: Direction[]) => void;
}

// Creates a multi-select with removable chips.
export const createSequenceMultiSelect = ({ value, allOptions, onChange }: MultiSelectProps): HTMLElement => {
  const container = document.createElement("div");
  container.className = "multi-select";

  const control = document.createElement("div");
  control.className = "multi-select-control";
  control.tabIndex = 0;

  const chips = document.createElement("div");
  chips.className = "multi-select-chips";
  control.appendChild(chips);

  const dropdown = document.createElement("div");
  dropdown.className = "multi-select-dropdown";

  const list = document.createElement("div");
  list.className = "multi-select-options";
  dropdown.appendChild(list);

  const state = {
    open: false,
    current: [...value]
  };

  const updateChips = () => {
    chips.innerHTML = "";
    state.current.forEach((dir, idx) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = dir;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "chip-remove";
      remove.setAttribute("aria-label", `Remove ${dir}`);
      remove.textContent = "×";
      remove.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const next = state.current.filter((_, i) => i !== idx);
        logger.info("Removed direction from sequence", dir, idx);
        state.current = next;
        onChange([...state.current]);
        updateChips();
      });
      chip.appendChild(remove);
      chips.appendChild(chip);
    });
  };

  const updateOptions = () => {
    list.innerHTML = "";
    allOptions.forEach((dir) => {
      const opt = document.createElement("button");
      opt.type = "button";
      opt.className = "option-item";
      opt.textContent = dir;
      opt.addEventListener("click", (ev) => {
        ev.stopPropagation();
        state.current = [...state.current, dir];
        logger.info("Added direction to sequence", dir);
        onChange([...state.current]);
        updateChips();
      });
      list.appendChild(opt);
    });
  };

  const setOpen = (open: boolean) => {
    state.open = open;
    dropdown.classList.toggle("open", open);
  };

  const bindOutsideClose = () => {
    const onDocClick = (ev: MouseEvent) => {
      if (!container.contains(ev.target as Node)) {
        if (state.open) {
          setOpen(false);
          logger.info("Closed dropdown by outside click");
        }
        document.removeEventListener("click", onDocClick);
      }
    };
    document.addEventListener("click", onDocClick);
  };

  control.addEventListener("click", () => {
    if (state.open) {
      setOpen(false);
    } else {
      setOpen(true);
      bindOutsideClose();
    }
    logger.info("Toggled dropdown", String(state.open));
  });

  control.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.open) {
      setOpen(false);
    }
  });

  // Outside click is handled per-open via bindOutsideClose.

  updateChips();
  updateOptions();

  container.append(control, dropdown);
  logger.info("Initialized sequence multi-select");
  return container;
};
