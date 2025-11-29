import ReactDOM from "react-dom/client";
import type { Tab } from "../type";
import { StackApp } from "./Context";
import { extension_helper } from "../helper";
const ElParent = "roam-main";
const El = "roam-stack-container";
let root: ReactDOM.Root | null = null;
let el: HTMLElement | null = null;
let diagramObserver: MutationObserver | null = null;

const onStackModeShow = () => {
  console.log("onStackModeShow");
  const el = document.querySelector(`.${El}`);
  if (el) {
    el.classList.remove("roam-stack-container-hide");
  }
};

const onStackModeHide = () => {
  console.log("onStackModeHide");
  const el = document.querySelector(`.${El}`);
  if (el) {
    el.classList.add("roam-stack-container-hide");
  }
};

async function isUnderSpecificPage() {
  const pageOrBlockUid =
    await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
  if (!pageOrBlockUid) {
    return false;
  }
  const hash = window.location.hash;
  const regex = new RegExp(
    `/${window.roamAlphaAPI.graph.name}/page/${pageOrBlockUid}$`
  );
  return regex.test(hash);
}

export const resetStackModeShowingState = async () => {
  if (!(await isUnderSpecificPage())) {
    onStackModeHide();
  } else {
    onStackModeShow();
  }
};

// 观察到 ELParent 中存在 .rm-diagram.rm-diagram-full-screen  时 hide stack
const observeFullScreenDiagram = (elParent: Element) => {
  const targetClazz = ".rm-diagram-full-screen";
  elParent.arrive(targetClazz, () => {
    console.log("arrive", targetClazz);
    onStackModeHide();
  });
  elParent.leave(targetClazz, () => {
    console.log("leave", targetClazz);
    // onStackModeShow();
  });
  extension_helper.on_uninstall(() => {
    elParent.unbindArrive(targetClazz);
    elParent.unbindLeave(targetClazz);
  });
};

// observeFullScreenDiagram(document.querySelector(`.${ElParent}`));

export const renderApp = (mode: string, tabs: Tab[], currentTab: Tab) => {
  console.log("renderApp", mode, tabs, currentTab, el, root);
  resetStackModeShowingState();
  if (mode !== "stack") {
    if (root) {
      root.unmount();
    }
    if (el) {
      el.remove();
    }
    return;
  }
  const elParent = document.querySelector(`.${ElParent}`);
  el = document.querySelector(`.${El}`);
  if (!elParent) {
    return;
  }
  if (!el) {
    el = document.createElement("div");
    el.className = El;
    elParent.appendChild(el);
  }
  if (!root) {
    root = ReactDOM.createRoot(el);
  }
  root.render(<StackApp tabs={tabs} currentTab={currentTab} />);

  // Start observing for full-screen diagrams
};
