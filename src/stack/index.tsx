import ReactDOM from "react-dom/client";
import type { Tab } from "../type";
import { StackApp } from "./Context";
import { ReactNode } from "react";
import { SwitchCommand } from "../SwitchCommand";
import { focusTab, saveAndRefreshTabs } from "../config";
const ElParent = "roam-main";
const El = "roam-stack-container";
let root: ReactDOM.Root | null = null;
let el: HTMLElement | null = null;

const onStackModeShow = () => {
  // console.log("onStackModeShow");
  const el = document.querySelector(`.${El}`);
  if (el) {
    el.classList.remove("roam-stack-container-hide");
  }
};

const onStackModeHide = () => {
  // console.log("onStackModeHide");
  const el = document.querySelector(`.${El}`);
  if (el) {
    el.classList.add("roam-stack-container-hide");
  }
};

export const resetStackModeShowingState = async (currentTab?: Tab) => {
  if (!currentTab) {
    onStackModeHide();
  } else {
    onStackModeShow();
  }
};

export const renderApp = (
  mode: string,
  tabs: Tab[],
  currentTab: Tab,
  pageWidth: number
) => {
  // console.log("renderApp", mode, tabs, currentTab, el, root, {
  //   pageWidth,
  // });
  resetStackModeShowingState(currentTab);
  if (mode !== "stack") {
    if (root) {
      root.unmount();
      root = null;
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
      <StackApp pageWidth={pageWidth} tabs={tabs} currentTab={currentTab} />
      <SwitchCommand
        tabs={tabs}
        onTabSelect={(tab) => {
          focusTab(tab.uid);
        }}
        onTabSorted={(tabs) => {
          saveAndRefreshTabs(tabs, currentTab);
        }}
      />
    </App>
  );

  // Start observing for full-screen diagrams
};

function App(props: { children: ReactNode }) {
  return <>{props.children}</>;
}
