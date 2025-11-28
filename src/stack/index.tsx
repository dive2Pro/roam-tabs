import ReactDOM from "react-dom/client";
import type { Tab } from "../type";
import { StackApp } from "./Context";
const ElParent = "roam-body-main";
const El = "roam-stack-container";
let root: ReactDOM.Root | null = null;
export const renderApp = (tabs: Tab[], currentTab: Tab) => {
  const elParent = document.querySelector(`.${ElParent}`);
  let el = document.querySelector(`.${El}`);
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
    root.render(<StackApp tabs={tabs} currentTab={currentTab} />);
  } else {
    root.render(<StackApp tabs={tabs} currentTab={currentTab} />);
  }
};
