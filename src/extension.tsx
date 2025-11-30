import React, { Component, useReducer } from "react";
import ReactDOM from "react-dom/client";
import "./style.less";
const { useEffect, useState, useCallback, useRef, useLayoutEffect } = React;
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
  loadTabsFromSettings,
  saveTabsToSettings,
  isStackMode,
} from "./config";
import type { Tab } from "./type";
import type { RoamExtensionAPI } from "roam-types";
import { SwitchCommand } from "./SwitchCommand";

const clazz = "roam-tabs";
let scrollTop$ = 0;

const delay = (ms = 10) =>
  new Promise((resolve) =>
    setTimeout(() => {
      resolve(1);
    }, ms)
  );

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
const _mount = async () => {
  const roamMain = document.querySelector(".roam-main");
  el = roamMain.querySelector("." + clazz);
  const roamBodyMain = roamMain.querySelector(".roam-body-main");

  if (!el) {
    el = document.createElement("div");
    el.className = clazz;
    roamMain.insertBefore(el, roamBodyMain);
    root = ReactDOM.createRoot(el);
    root.render(<App />);
  } else {
    forceUpdate();
  }
  saveTabsToSettings(tabs, currentTab);
  // scroll to active button
  setTimeout(() => {
    const rbm = document.querySelector(".rm-article-wrapper");
    rbm.scrollTop = currentTab?.scrollTop || 0;

    function scrollIntoActiveTab() {
      const activeEl = document.querySelector(
        ".roam-tab-active"
      ) as HTMLElement;
      const parentEl = activeEl?.parentElement;
      if (!activeEl || !parentEl) {
        return;
      }

      const childRect = activeEl.getBoundingClientRect();
      const parentRect = parentEl.getBoundingClientRect();
      const itemLeft = activeEl.offsetLeft - parentRect.left;
      const itemRight = itemLeft + childRect.width;
      const scrollLeft = parentEl.scrollLeft;
      // const containerRight = containerLeft + childRect.width;

      // 假如滑动的距离不足以展示完全的: activeEl
      // 条件:
      //  containerLeft < itemLeft + childRect.width  -> containerLeft = itemLeft + childRect.width

      // console.log(scrollLeft, itemLeft, childRect, parentRect, activeEl);

      if (scrollLeft < itemLeft) {
        parentEl.scroll({
          left: itemLeft,
        });
      } else if (scrollLeft + parentRect.width < itemLeft) {
        parentEl.scroll({
          left: itemLeft,
        });
      } else if (scrollLeft + parentRect.width > itemRight) {
        parentEl.scroll({
          left: itemRight,
        });
      }
    }
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

const mount = debounce(_mount, 150);

let currentTab: Tab | undefined;

let tabs: Tab[] = [];
const setTabs = (newTab: Tab) => {
  const change = (prev: Tab[]) => {
    const index = prev.findIndex((tab) => tab.uid === newTab.uid);
    if (ctrlKeyPressed || isAutoOpenNewTab()) {
      if (index === -1) {
        return [...prev, newTab];
      } else {
        prev[index] = newTab;
        return [...prev];
      }
    }
    if (prev.length === 0) {
      return [newTab];
    }

    if (index !== -1) {
      prev[index] = newTab;
      return prev;
    }

    if (!currentTab) {
      setCurrentTab(newTab);
      return [...prev, newTab];
    }
    const i = prev.findIndex((tab) => currentTab.uid === tab.uid);
    prev[i] = newTab;
    // console.log(currentTab, i, prev);

    return [...prev];
  };
  // console.log("---change: ", JSON.stringify(tabs))
  tabs = change(tabs);
};
export const removeTab = (uid: string) => {
  const tab = tabs.find((tab) => tab.uid === uid);
  if (!tab) {
    return;
  }
  const index = tabs.findIndex((tab) => tab.uid === uid);

  if (tab.pin) {
    // find first unpin tab
    const unpinTabIndex = tabs.findIndex((tab) => !tab.pin);
    if (unpinTabIndex > -1) {
      setCurrentTab(tabs[unpinTabIndex]);
    }
    return;
  }

  tabs = tabs.filter((tab) => tab.uid !== uid);
  if (currentTab?.uid === uid) {
    setCurrentTab(tabs[Math.min(index, tabs.length - 1)]);
  }
  mount();
};

const removeCurrentTab = () => {
  currentTab && removeTab(currentTab.uid);
};

const removeOtherTbas = (lastTab: Tab) => {
  tabs = [...tabs.filter((v) => v.pin || v.uid === lastTab.uid)];
  setCurrentTab(lastTab);
  mount();
};

const removeToTheRightTabs = (index: number) => {
  tabs = [
    ...tabs.slice(0, index + 1),
    ...tabs.slice(index + 1).filter((t) => t.pin),
  ];
  const currentIndex = tabs.findIndex((t) => t.uid === currentTab?.uid);
  if (currentIndex === -1 || currentIndex > index) {
    setCurrentTab(tabs[index]);
  }
  mount();
};

const setCurrentTab = (v?: Tab) => {
  if (v) {
    const oldTab = tabs.find((tab) => tab.uid === v.uid);
    currentTab = {
      ...oldTab,
      ...v,
    };
  } else {
    currentTab = v;
  }
  // 如果发现 v.blockUid 已经不在该页面下, 改为打开 page uid
  if (!v) return;
  const targetUid = getUidExitsInPage(v);
  openUid(targetUid);
};

let routeChanging = false;
let forceUpdate = () => {};

let draggingTab: Tab;
let draggingTargetTab: Tab;
const setDraggingTargetTab = (dragging?: Tab) => {
  draggingTargetTab = dragging;
  forceUpdate();
};
const setDraggingTab = (dragging?: Tab) => {
  draggingTab = dragging;
  forceUpdate();
};
function App() {
  forceUpdate = useReducer((i) => i + 1, 0)[1];
  const onChange = useEvent((uid: string, title: string, blockUid: string) => {
    if (uid) {
      const oldTab = tabs.find((tab) => tab.uid === uid);
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
      setTabs(newTab);
      setCurrentTab(newTab);
      ctrlKeyPressed = oldCtrlKeyPressed;
    } else {
      setCurrentTab();
    }
    mount();
  });
  const onPointerdown = useEvent(function onPointerdown(e: PointerEvent) {
    ctrlKeyPressed = e.ctrlKey || e.metaKey;
    const rbm = document.querySelector(".rm-article-wrapper");
    // console.log(scrollTop$, ' ---global')
  });

  useEffect(() => {
    const onScroll = (e: Event) => {
      const rbm = document.querySelector(".rm-article-wrapper");

      scrollTop$ = rbm.scrollTop;
      if (!routeChanging) recordPosition();
    };
    const rbm = document.querySelector(".rm-article-wrapper");
    if (!rbm) {
      return;
    }

    rbm.addEventListener("scroll", onScroll);
    return () => {
      rbm.removeEventListener("scroll", onScroll);
    };
  }, []);
  const onRouteChange = useEvent(async (e: HashChangeEvent) => {
    routeChanging = true;
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
    const index = location.href.indexOf("/page/");
    const uid = e.newURL.split("/").pop();

    if (index === -1) {
      setCurrentTab();
      mount();
      routeChanging = false;
      return;
    }
    const pageUid = getPageUidByUid(uid);
    const title = getPageTitleByUid(pageUid);
    onChange(pageUid, title, uid);
    routeChanging = false;
  });
  useEffect(() => {
    window.addEventListener("hashchange", onRouteChange);

    return () => {
      window.removeEventListener("hashchange", onRouteChange);
    };
  }, []);

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

  useEffect(() => {
    API.ui.commandPalette.addCommand({
      label: "Close Current Tab",
      callback: () => {
        removeCurrentTab();
      },
    });

    API.ui.commandPalette.addCommand({
      label: "Close Other Tabs",
      callback: () => {
        removeOtherTbas(currentTab);
      },
    });

    API.ui.commandPalette.addCommand({
      label: "Close to the right",
      callback: () => {
        if (!currentTab) {
          return;
        }
        const index = tabs.findIndex((v) => v.uid === currentTab.uid);
        if (index === -1) {
          return;
        }
        removeToTheRightTabs(index);
      },
    });
    API.ui.commandPalette.addCommand({
      label: "Pin",
      callback: () => {
        if (!currentTab) {
          return;
        }
        toggleTabPin(currentTab);
      },
    });
  }, [currentTab]);

  return (
    <>
      <div className="roam-tabs-container">
        {tabs.map((tab, index) => {
          const active = tab.uid === currentTab?.uid;
          return (
            <AppTab key={tab.uid} active={active} index={index} tab={tab} />
          );
        })}
      </div>
      <SwitchCommand
        tabs={tabs}
        API={API}
        onTabSorted={(newTabs) => {
          tabs = newTabs;
          mount();
        }}
        onTabSelect={(tab) => {
          setCurrentTab(tab);
          mount();
        }}
      />
    </>
  );
}

class AppTab extends Component<{
  active: boolean;
  tab: Tab;
  index: number;
}> {
  state = {
    className: "",
  };

  render() {
    const { active, tab, index } = this.props;

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
            if (tab.pin) {
              draggingTab.pin = true;
            } else {
              draggingTab.pin = false;
            }
            swapTab(tab, draggingTab);
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
                  removeTab(tab.uid);
                }}
              />
              <MenuItem
                text="Close Others"
                onClick={() => {
                  removeOtherTbas(tab);
                }}
                disabled={tabs.length === 1}
              />
              <MenuItem
                onClick={() => {
                  removeToTheRightTabs(index);
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
                  toggleTabPin(tab);
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
          setCurrentTab(tab);
          mount();
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
                toggleTabPin(tab);
                mount();
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
                removeTab(tab.uid);
                mount();
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

function useEvent(handler: Function) {
  const handlerRef = useRef(null);

  // In a real implementation, this would run before layout effects
  useLayoutEffect(() => {
    handlerRef.current = handler;
  });

  return useCallback((...args: any[]) => {
    // In a real implementation, this would throw if called during render
    const fn = handlerRef.current;
    return fn(...args);
  }, []);
}

const openUid = (uid: string) => {
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

export function initExtension(extensionAPI: RoamExtensionAPI) {
  API = extensionAPI;

  // 检查是否是 stack mode
  if (isStackMode()) {
    if (root) {
      root.unmount();
    }

    if (el) {
      el.remove();
    }
    return;
  }

  // 如果是 stack mode，正常初始化
  const cacheConfig = loadTabsFromSettings();
  if (cacheConfig) {
    setCurrentTab(cacheConfig.activeTab);
    tabs = cacheConfig.tabs;
  }
  mount();
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
function recordPosition() {
  if (currentTab && currentTab.scrollTop !== scrollTop$) {
    currentTab.scrollTop = scrollTop$;
    const tab = tabs.find((tab) => tab.uid === currentTab.uid);
    if (tab) tab.scrollTop = scrollTop$;
  }
}

const swapTab = debounce((tab: Tab, draggingTab: Tab) => {
  const index1 = tabs.findIndex((t) => t.uid === tab.uid);
  const index2 = tabs.findIndex((t) => t.uid === draggingTab.uid);
  tabs.splice(index2, 1);
  tabs = [...tabs.slice(0, index1), draggingTab, ...tabs.slice(index1)];
  // tabs[index1] = draggingTab;
  // tabs[index2] = tab;
  // sortTabByPin();
  // console.log(tabs, ' swapped')
  // mount();
  forceUpdate();
  saveTabsToSettings(tabs, currentTab);
}, 10);

function sortTabByPin() {
  tabs = [...tabs.filter((t) => t.pin), ...tabs.filter((t) => !t.pin)];
}

function toggleTabPin(tab: Tab) {
  tab.pin = !tab.pin;
  if (currentTab?.uid === tab.uid) {
    currentTab.pin = tab.pin;
  }
  sortTabByPin();
  mount();
}
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
