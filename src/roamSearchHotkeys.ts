import { extension_helper } from "./helper";

let queuedSearchSelection = false;
let queuedOpenInNewTab = false;
let queuedResetTimer: ReturnType<typeof setTimeout> | undefined;

function clearQueuedSearchNavigation() {
  queuedSearchSelection = false;
  queuedOpenInNewTab = false;
  if (queuedResetTimer) {
    clearTimeout(queuedResetTimer);
    queuedResetTimer = undefined;
  }
}

function queueSearchNavigation(forceOpenInNewTab = false) {
  queuedSearchSelection = true;
  queuedOpenInNewTab = forceOpenInNewTab;
  if (queuedResetTimer) {
    clearTimeout(queuedResetTimer);
  }
  queuedResetTimer = setTimeout(() => {
    clearQueuedSearchNavigation();
  }, 1000);
}

export function takeQueuedSearchNavigation(): {
  fromSearchSelection: boolean;
  forceOpenInNewTab: boolean;
} {
  const queued = {
    fromSearchSelection: queuedSearchSelection,
    forceOpenInNewTab: queuedOpenInNewTab,
  };
  clearQueuedSearchNavigation();
  return queued;
}

function isNativeRoamSearchInput(
  element: Element | null
): element is HTMLInputElement {
  return !!(
    element instanceof HTMLInputElement &&
    (element.id === "find-or-create-input" ||
      element.getAttribute("placeholder") === "Find or Create Page") &&
    !element.closest(".roam-tabs-switch-omnibar")
  );
}

type ReactPropsWithMouseDown = {
  onMouseDown?: (event: {
    button: number;
    buttons: number;
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    preventDefault: () => void;
    stopPropagation: () => void;
    currentTarget: Element;
    target: Element;
    nativeEvent: {
      button: number;
      buttons: number;
    };
  }) => void;
};

function getActiveSearchResult(): Element | null {
  const menu = document.querySelector(".rm-find-or-create__menu");
  if (!menu) {
    return null;
  }
  return (
    menu.querySelector('.rm-menu-item[style*="background-color"]') ||
    menu.querySelector(".rm-menu-item")
  );
}

function getReactProps(element: Element): ReactPropsWithMouseDown | undefined {
  const propsKey = Object.keys(element).find((key) =>
    key.startsWith("__reactProps$")
  );
  if (!propsKey) {
    return undefined;
  }
  return (element as Element & Record<string, ReactPropsWithMouseDown>)[propsKey];
}

function triggerNativeSearchSelection() {
  const activeItem = getActiveSearchResult();
  if (!activeItem) {
    return false;
  }

  const reactProps = getReactProps(activeItem);
  if (typeof reactProps?.onMouseDown !== "function") {
    return false;
  }

  reactProps.onMouseDown({
    button: 0,
    buttons: 1,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    preventDefault() {},
    stopPropagation() {},
    currentTarget: activeItem,
    target: activeItem,
    nativeEvent: {
      button: 0,
      buttons: 1,
    },
  });
  return true;
}

function observeRoamSearchHotkeys() {
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Enter") {
      return;
    }
    const input = document.activeElement;
    if (!isNativeRoamSearchInput(input)) {
      return;
    }

    const forceOpenInNewTab = event.metaKey || event.ctrlKey;
    queueSearchNavigation(forceOpenInNewTab);
    if (!forceOpenInNewTab) {
      return;
    }

    const handled = triggerNativeSearchSelection();
    if (!handled) {
      clearQueuedSearchNavigation();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  };

  document.addEventListener("keydown", onKeydown, true);
  extension_helper.on_uninstall(() => {
    document.removeEventListener("keydown", onKeydown, true);
  });
}

observeRoamSearchHotkeys();
