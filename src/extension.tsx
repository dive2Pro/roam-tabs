import React, { Component, PureComponent, useReducer } from "react";
import ReactDOM from "react-dom";
import "./style.less";
const { useEffect, useState, useCallback, useRef, useLayoutEffect } = React;
import {
  Button,
  Icon,
  MenuItem,
  Menu,
  ContextMenuTarget,
  ContextMenu,
  MenuDivider,
} from "@blueprintjs/core";
import { extension_helper } from "./helper";
import {
  isAutoOpenNewTab,
  loadTabsFromSettings,
  saveTabsToSettings,
} from "./config";
import { Omnibar } from "@blueprintjs/select";
import { NodeGroup } from "react-move";

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

const _mount = async () => {
  // console.log(" mounting :::");
  const roamMain = document.querySelector(".roam-main");
  let el = roamMain.querySelector("." + clazz);
  const roamBodyMain = roamMain.querySelector(".roam-body-main");
  const articleWrapper = document.querySelector(".rm-article-wrapper");
  if (!el) {
    el = document.createElement("div");
    el.className = clazz;
    roamMain.insertBefore(el, roamBodyMain);
    ReactDOM.render(<App />, el);
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
    scrollIntoActiveTab();
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
      prev[0] = newTab;
      setCurrentTab(newTab);
      return [...prev];
    }
    const i = prev.findIndex((tab) => currentTab.uid === tab.uid);
    prev[i] = newTab;
    // console.log(currentTab, i, prev);

    return [...prev];
  };
  // console.log("---change: ", JSON.stringify(tabs))
  tabs = change(tabs);
};
const removeTab = (uid: string) => {
  const index = tabs.findIndex((tab) => tab.uid === uid);
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
  tabs = [lastTab];
  setCurrentTab(lastTab);
  mount();
};

const removeToTheRightTabs = (index: number) => {
  tabs = tabs.slice(0, index + 1);
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
  console.log(tabs, currentTab, " setCurrentTab");
  v && openUid(v.blockUid);
};

let routeChanging = false;
let forceUpdate = () => {};

let draggingTab: Tab;
const setDraggingTab = (dragging?: Tab) => {
  draggingTab = dragging;
  forceUpdate();
};
function App() {
  forceUpdate = useReducer((i) => i + 1, 0)[1];
  const onChange = useEvent((uid: string, title: string, blockUid: string) => {
    if (uid) {
      const oldTab = tabs.find((tab) => tab.uid === uid);

      const newTab = {
        ...oldTab,
        uid,
        title,
        blockUid,
      };
      setTabs(newTab);
      setCurrentTab(newTab);
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
      console.log("onScroll ---, ", routeChanging);
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
  useEffect(() => {
    const onRouteChange = async (e: HashChangeEvent) => {
      routeChanging = true;
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      const index = location.href.indexOf("/page/");
      const uid = e.newURL.split("/").pop();
      console.log("change---Route", scrollTop$, `index = ${index}`, uid);

      if (index === -1) {
        setCurrentTab();
        mount();
        routeChanging = false;
        return;
      }
      const pageUid = getPageUidByUid(uid);
      const title = getPageTitleByUid(pageUid);
      console.log("change: true ", pageUid, title, uid, tabs);
      onChange(pageUid, title, uid);
      routeChanging = false;
    };
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
    <div className="roam-tabs-container">
      {tabs.map((tab, index) => {
        const active = tab.uid === currentTab?.uid;
        return <AppTab key={tab.uid} active={active} index={index} tab={tab} />;
      })}
      <SwitchCommand tabs={tabs} />
    </div>
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
  renderContextMenu() {
    return (
      <Menu>
        <MenuItem onClick={() => {}} text="Save" />
        <MenuItem onClick={() => {}} text="Delete" />
      </Menu>
    );
  }

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
          setDraggingTab(tab);
          e.stopPropagation();
        }}
        onDrop={(e) => {
          console.log("drag end = ", tab, draggingTab);
          if (draggingTab) {
            e.dataTransfer.effectAllowed = "move";
            e.preventDefault();
            if(tab.pin) {
              draggingTab.pin = true
            } else {
              draggingTab.pin = false
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
                  toggleTabPin(tab);
                }}
                text="Pin"
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

function SwitchCommand(props: { tabs: Tab[] }) {
  const [state, setState] = useState({
    open: false,
  });
  const [activeItem, setActiveItem] = useState<Tab>();
  useEffect(() => {
    API.ui.commandPalette.addCommand({
      label: "Switch Tab...",
      callback() {
        setState({
          open: !state.open,
        });
      },
    });
  }, []);

  return (
    <Omnibar
      isOpen={state.open}
      onClose={() => setState({ open: false })}
      items={props.tabs}
      itemPredicate={(query, item) => {
        return item.title.toLowerCase().includes(query.toLowerCase());
      }}
      itemRenderer={(item, itemProps) => {
        return (
          <MenuItem
            onClick={itemProps.handleClick}
            {...itemProps.modifiers}
            text={highlightText(item.title, itemProps.query)}
          />
        );
      }}
      onItemSelect={(item) => {
        console.log(item, " select ");
        setCurrentTab(item);
        setState({ open: false });
        mount();
      }}
      itemListRenderer={(itemListProps) => {
        return (
          <Menu>
            <NodeGroup
              data={itemListProps.filteredItems}
              start={(data, index) => {
                return {
                  y: 35,
                  opacity: 0,
                };
              }}
              enter={(data, index) => {
                return {
                  opacity: [1],
                  timing: {
                    duration: 250,
                  },
                };
              }}
              leave={(data, index) => {
                return [
                  {
                    y: [-35],
                    timing: {
                      duration: 250,
                    },
                  },
                  {
                    opacity: [0],
                    timing: {
                      duration: 150,
                    },
                  },
                ];
              }}
              keyAccessor={(data) => data.uid}
            >
              {(nodes) => {
                return (
                  <>
                    {nodes.map((node, index) => {
                      return (
                        <div
                          key={node.key}
                          style={{
                            opacity: node.state.opacity,
                            height: node.state.y,
                          }}
                        >
                          {itemListProps.renderItem(node.data, index)}
                        </div>
                      );
                    })}
                  </>
                );
              }}
            </NodeGroup>
          </Menu>
        );
      }}
    />
  );
}

function escapeRegExpChars(text: string) {
  return text.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

function highlightText(text: string, query: string) {
  let lastIndex = 0;
  const words = query
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map(escapeRegExpChars);
  if (words.length === 0) {
    return [text];
  }
  const regexp = new RegExp(words.join("|"), "gi");
  const tokens: React.ReactNode[] = [];
  while (true) {
    const match = regexp.exec(text);
    if (!match) {
      break;
    }
    const length = match[0].length;
    const before = text.slice(lastIndex, regexp.lastIndex - length);
    if (before.length > 0) {
      tokens.push(before);
    }
    lastIndex = regexp.lastIndex;
    tokens.push(<strong key={lastIndex}>{match[0]}</strong>);
  }
  const rest = text.slice(lastIndex);
  if (rest.length > 0) {
    tokens.push(rest);
  }
  return tokens;
}

function useEvent(handler: Function) {
  const handlerRef = useRef(null);

  // In a real implementation, this would run before layout effects
  useLayoutEffect(() => {
    handlerRef.current = handler;
  });

  return useCallback((...args) => {
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
    console.log(currentTab, "----before record----", tabs);
    currentTab.scrollTop = scrollTop$;
    const tab = tabs.find((tab) => tab.uid === currentTab.uid);
    if (tab) tab.scrollTop = scrollTop$;
  }

  console.log(currentTab, "----after record----", tabs);
}

const swapTab = debounce((tab: Tab, draggingTab: Tab) => {
  const index1 = tabs.findIndex((t) => t.uid === tab.uid);
  const index2 = tabs.findIndex((t) => t.uid === draggingTab.uid);
  tabs[index1] = draggingTab;
  tabs[index2] = tab;
  mount();
}, 10);

function toggleTabPin(currentTab: Tab) {
  currentTab.pin = !currentTab.pin;
  tabs = tabs.sort((a, b) => {
    if (a.pin) {
      return -1;
    }
    return 0;
  });
  mount();
}
