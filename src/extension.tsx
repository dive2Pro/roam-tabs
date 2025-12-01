import React, { Component, useReducer } from "react";
import ReactDOM from "react-dom/client";
import "./style.less";
const { useEffect } = React;
import {
  Button,
  Icon,
  MenuItem,
  Menu,
  ContextMenu,
  MenuDivider,
} from "@blueprintjs/core";
import { copyToClipboard, extension_helper } from "./helper";
import {
  isAutoOpenNewTab,
  isStackMode,
  saveAndRefreshTabs,
  removeTab as removeTabFromConfig,
  removeOtherTabs as removeOtherTabsFromConfig,
  removeToTheRightTabs as removeToTheRightTabsFromConfig,
  toggleTabPin as toggleTabPinFromConfig,
  focusTab as focusTabFromConfig,
  loadTabsFromSettings,
} from "./config";
import type { Tab } from "./type";
import type { RoamExtensionAPI } from "roam-types";
import { SwitchCommand } from "./SwitchCommand";
import { useOnUidWillChange } from "./hooks/useOnUidChangeElementClicked";
import { useEvent } from "./hooks/useEvent";

const clazz = "roam-tabs";
let scrollTop$ = 0;

function debounce(fn: Function, ms = 500) {
  let timer = setTimeout(() => {}, 0);
  return (...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
    }, ms);
  };
}
let root: ReactDOM.Root | null = null;
let el: HTMLElement | null = null;
let forceUpdate = () => {};

const mount = async (tabs: Tab[], currentTab?: Tab) => {
  const roamMain = document.querySelector(".roam-main");
  el = roamMain.querySelector("." + clazz);
  const roamBodyMain = roamMain.querySelector(".roam-body-main");

  if (!el) {
    el = document.createElement("div");
    el.className = clazz;
    roamMain.insertBefore(el, roamBodyMain);
    root = ReactDOM.createRoot(el);
    root.render(<App tabs={tabs} currentTab={currentTab} />);
  } else {
    root?.render(<App tabs={tabs} currentTab={currentTab} />);
  }
  // scroll to active button
  setTimeout(() => {
    const rbm = document.querySelector(".rm-article-wrapper");
    rbm.scrollTop = currentTab?.scrollTop || 0;

    // scrollIntoActiveTab();
    makeActiveTabMoveIntoVersion();
    function makeActiveTabMoveIntoVersion() {
      const activeEl = document.querySelector(
        ".roam-tab-active"
      ) as HTMLElement;
      activeEl &&
        activeEl.scrollIntoView({
          behavior: "smooth",
        });
    }
  }, 100);
};

let routeChanging = false;

let draggingTab: Tab | undefined;

const setDraggingTab = (dragging?: Tab) => {
  draggingTab = dragging;
  forceUpdate();
};

function App(props: { tabs: Tab[]; currentTab?: Tab }) {
  const { tabs, currentTab } = props;
  console.log({ currentTab });

  forceUpdate = useReducer((i) => i + 1, 0)[1];
  const onChange = useEvent((uid: string, title: string, blockUid: string) => {
    if (uid) {
      const cacheTab = loadTabsFromSettings();
      const currentTabs = cacheTab?.tabs || [];
      const oldTab = currentTabs.find((tab) => tab.uid === uid);
      let oldCtrlKeyPressed = ctrlKeyPressed;

      if (currentTab?.pin) {
        ctrlKeyPressed = true;
      }
      const newTab = {
        ...oldTab,
        uid,
        title,
        blockUid,
      };

      // 如果发现 newTab.blockUid 已经不在该页面下, 修改 tab 的 blockUid = pageUid
      const targetUid = getUidExitsInPage(newTab);
      newTab.blockUid = targetUid;

      const index = currentTabs.findIndex((tab) => tab.uid === newTab.uid);
      let updatedTabs: Tab[];
      let updatedCurrentTab: Tab | undefined;

      if (ctrlKeyPressed || isAutoOpenNewTab()) {
        if (index === -1) {
          updatedTabs = [...currentTabs, newTab];
        } else {
          updatedTabs = currentTabs.map((t) =>
            t.uid === newTab.uid ? newTab : t
          );
        }
        updatedCurrentTab = newTab;
      } else {
        if (currentTabs.length === 0) {
          updatedTabs = [newTab];
          updatedCurrentTab = newTab;
        } else if (index !== -1) {
          updatedTabs = currentTabs.map((t) =>
            t.uid === newTab.uid ? newTab : t
          );
          updatedCurrentTab = newTab;
        } else if (!currentTab) {
          updatedTabs = [...currentTabs, newTab];
          updatedCurrentTab = newTab;
        } else {
          const i = currentTabs.findIndex((tab) => currentTab.uid === tab.uid);
          if (i !== -1) {
            updatedTabs = currentTabs.map((t, idx) => (idx === i ? newTab : t));
            updatedCurrentTab = newTab;
          } else {
            updatedTabs = currentTabs;
            updatedCurrentTab = currentTab;
          }
        }
      }

      saveAndRefreshTabs(updatedTabs, updatedCurrentTab);
      ctrlKeyPressed = oldCtrlKeyPressed;
    } else {
      saveAndRefreshTabs(tabs, undefined);
    }
  });
  const onPointerdown = useEvent(function onPointerdown(e: PointerEvent) {
    ctrlKeyPressed = e.ctrlKey || e.metaKey;
    // console.log(scrollTop$, ' ---global')
  });

  useEffect(() => {
    const onScroll = () => {
      const rbm = document.querySelector(".rm-article-wrapper");

      scrollTop$ = rbm.scrollTop;
      if (!routeChanging) recordPosition(tabs, currentTab);
    };
    const rbm = document.querySelector(".rm-article-wrapper");
    if (!rbm) {
      return;
    }

    rbm.addEventListener("scroll", onScroll);
    return () => {
      rbm.removeEventListener("scroll", onScroll);
    };
  }, [tabs, currentTab]);
  useOnUidWillChange((uid) => {
    console.log("useOnUidWillChange: ", uid);
    if (!uid) {
      saveAndRefreshTabs(tabs, undefined);
      return;
    }
    const pageUid = getPageUidByUid(uid);
    const title = getPageTitleByUid(pageUid);
    onChange(pageUid, title, uid);
  });

  useEffect(() => {
    document.addEventListener("pointerdown", onPointerdown);
    return () => {
      document.removeEventListener("pointerdown", onPointerdown);
    };
  }, []);

  React.useEffect(() => {
    const dragEndListener = () => {
      setDraggingTab(undefined);
    };
    document.addEventListener("dragend", dragEndListener);
    return () => {
      document.removeEventListener("dragend", dragEndListener);
    };
  }, []);

  return (
    <>
      <div className="roam-tabs-container">
        {tabs.map((tab, index) => {
          const active = tab.uid === currentTab?.uid;
          return (
            <AppTab
              key={tab.uid}
              active={active}
              index={index}
              tab={tab}
              tabs={tabs}
              currentTab={currentTab}
            />
          );
        })}
      </div>
      <SwitchCommand
        tabs={tabs}
        onTabSorted={(newTabs) => {
          saveAndRefreshTabs(newTabs, currentTab);
        }}
        onTabSelect={(tab) => {
          focusTabFromConfig(tab.uid);
        }}
      />
    </>
  );
}

class AppTab extends Component<{
  active: boolean;
  tab: Tab;
  index: number;
  tabs: Tab[];
  currentTab?: Tab;
}> {
  state = {
    className: "",
  };

  render() {
    const { active, tab, index, tabs, currentTab } = this.props;

    return (
      <Button
        style={{
          outline: "none",
        }}
        intent={active ? "primary" : "none"}
        outlined
        small
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          // console.log("onDragStart");
          setDraggingTab(tab);
          e.stopPropagation();
        }}
        onDragOver={(e) => {
          // console.log(' drag over: ', tab, draggingTab);
          e.preventDefault();
          e.dataTransfer.effectAllowed = "move";
          if (draggingTab) {
            const updatedDraggingTab = {
              ...draggingTab,
              pin: tab.pin,
            };
            swapTab(tab, updatedDraggingTab, tabs, currentTab);
          }
        }}
        data-dragging={draggingTab === tab}
        className={`${this.state.className} ${
          active ? "roam-tab-active" : ""
        } ${draggingTab === tab ? "ring-1 " : ""} roam-tab`}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          ContextMenu.show(
            <Menu>
              <MenuItem
                text="Close"
                tagName="span"
                onClick={() => {
                  removeTabFromConfig(tab.uid);
                }}
              />
              <MenuItem
                text="Close Others"
                onClick={() => {
                  removeOtherTabsFromConfig(tab.uid);
                }}
                disabled={tabs.length === 1}
              />
              <MenuItem
                onClick={() => {
                  removeToTheRightTabsFromConfig(index);
                }}
                text="Close to the Right"
                disabled={index + 1 >= tabs.length}
              />
              <MenuDivider />
              <MenuItem
                onClick={() => {
                  copyToClipboard(`[[${tab.title}]]`);
                }}
                text="Copy Page Reference"
              />
              <MenuDivider />
              <MenuItem
                onClick={() => {
                  openInSidebar(tab.uid);
                }}
                text="Open in Sidebar"
              />
              <MenuDivider />
              <MenuItem
                onClick={() => {
                  toggleTabPinFromConfig(tab.uid);
                }}
                text={tab.pin ? "Unpin" : "Pin"}
              />
            </Menu>,
            { left: e.clientX, top: e.clientY },
            () => {}
          );
        }}
        onClick={(e) => {
          if (e.shiftKey) {
            openInSidebar(tab.uid);
            return;
          }
          console.log("onClick: ", tab);
          openUid(tab.blockUid);
        }}
        rightIcon={
          tab.pin ? (
            <Button
              minimal
              small
              intent="danger"
              icon={<Icon icon="pin" />}
              onClickCapture={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleTabPinFromConfig(tab.uid);
              }}
            />
          ) : (
            <Button
              minimal
              small
              icon={<Icon color="#ABB3BF" icon="small-cross" />}
              onClickCapture={(e) => {
                e.preventDefault();
                e.stopPropagation();
                removeTabFromConfig(tab.uid);
              }}
            />
          )
        }
        text={
          <div
            style={{
              display: "inline-block",

              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 100,
              maxWidth: 200 /* 设置最大宽度 */,
            }}
          >
            {tab.title}
          </div>
        }
      ></Button>
    );
  }
}
// Moved to src/hooks/useEvent.ts

const openUid = (uid: string) => {
  console.log("openUid: ", uid);
  window.roamAlphaAPI.ui.mainWindow.openBlock({
    block: {
      uid: uid,
    },
  });
};

let ctrlKeyPressed = false;

function getPageUidByUid(uid: string) {
  const pageUid = window.roamAlphaAPI.q(`
[
    :find ?e .
    :where
     [?b :block/uid "${uid}"]
     [?b :block/page ?p]
     [?p :block/uid ?e]
]
`) as unknown as string;
  return pageUid || uid;
}

function getPageTitleByUid(uid: string) {
  return window.roamAlphaAPI.q(`
[
    :find ?e .
    :where
     [?b :block/uid "${uid}"]
     [?b :node/title ?e]
]
`);
}

let API: RoamExtensionAPI;

export function renderHorizontalApp(tabs: Tab[], currentTab?: Tab) {
  // 检查是否是 stack mode
  if (isStackMode()) {
    if (root) {
      root.unmount();
      root = null;
    }

    if (el) {
      el.remove();
      el = null;
    }
    return;
  }
  console.log("renderHorizontalApp: ", tabs, currentTab);
  mount(tabs, currentTab);
}

export function initExtension(extensionAPI: RoamExtensionAPI) {
  API = extensionAPI;
  extension_helper.on_uninstall(() => {
    document.querySelector(`.${clazz}`)?.remove();
  });
}

function openInSidebar(uid: string) {
  window.roamAlphaAPI.ui.rightSidebar.addWindow({
    window: {
      "block-uid": uid,
      type: "outline",
    },
  });
}
function recordPosition(tabs: Tab[], currentTab?: Tab) {
  if (currentTab && currentTab.scrollTop !== scrollTop$) {
    const updatedCurrentTab = { ...currentTab, scrollTop: scrollTop$ };
    const tab = tabs.find((tab) => tab.uid === currentTab.uid);
    if (tab) {
      const updatedTabs = tabs.map((t) =>
        t.uid === currentTab.uid ? { ...t, scrollTop: scrollTop$ } : t
      );
      saveAndRefreshTabs(updatedTabs, updatedCurrentTab);
    }
  }
}

const swapTab = debounce(
  (tab: Tab, draggingTab: Tab, tabs: Tab[], currentTab?: Tab) => {
    const index1 = tabs.findIndex((t) => t.uid === tab.uid);
    const index2 = tabs.findIndex((t) => t.uid === draggingTab.uid);
    const newTabs = [...tabs];
    newTabs.splice(index2, 1);
    const swappedTabs = [
      ...newTabs.slice(0, index1),
      draggingTab,
      ...newTabs.slice(index1),
    ];
    saveAndRefreshTabs(swappedTabs, currentTab);
  },
  10
);
function getUidExitsInPage(v: Tab) {
  return !!window.roamAlphaAPI.q(`
  [
    :find ?e .
    :where
     [?e :block/uid "${v.blockUid}"]
     [?p :block/uid "${v.uid}"]
     [?e :block/page ?p]
  ]`)
    ? v.blockUid
    : v.uid;
}
