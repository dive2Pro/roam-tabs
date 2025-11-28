import ReactDOM from "react-dom/client";
import type { Tab } from "../type";
import { StackApp } from "./Context";
const ElParent = "roam-main";
const El = "roam-stack-container";
let root: ReactDOM.Root | null = null;
let el: HTMLElement | null = null;
export const renderApp = (mode: string, tabs: Tab[], currentTab: Tab) => {
  console.log("renderApp", mode, tabs, currentTab, el, root);

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
};
