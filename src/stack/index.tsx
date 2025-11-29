import ReactDOM from "react-dom/client";
import type { Tab } from "../type";
import { StackApp } from "./Context";
import { extension_helper } from "../helper";
import { ReactNode } from "react";
import { SwitchCommand } from "../SwitchCommand";
import { RoamExtensionAPI } from "roam-types";
import { focusTab } from "../config";
const ElParent = "roam-main";
const El = "roam-stack-container";
let root: ReactDOM.Root | null = null;
let el: HTMLElement | null = null;
let diagramObserver: MutationObserver | null = null;

const onStackModeShow = () => {
  const el = document.querySelector(`.${El}`);
  if (el) {
    el.classList.remove("roam-stack-container-hide");
  }
};

const onStackModeHide = () => {
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

export const renderApp = (
  mode: string,
  extensionAPI: RoamExtensionAPI,
  tabs: Tab[],
  currentTab: Tab
) => {
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
  root.render(
    <App>
      <StackApp tabs={tabs} currentTab={currentTab} />
      <SwitchCommand
        tabs={tabs}
        API={extensionAPI}
        onTabSelect={(tab) => {
          focusTab(tab.uid);
        }}
      />
    </App>
  );

  // Start observing for full-screen diagrams
};

function App(props: { children: ReactNode }) {
  return <>{props.children}</>;
}
