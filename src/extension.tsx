import React from "react";
import ReactDOM from "react-dom";
import "./style.less";
const { useEffect, useState, useCallback, useRef, useLayoutEffect } = React;
import { Button, Icon } from '@blueprintjs/core'
import { extension_helper } from "./helper";
import { isAutoOpenNewTab, loadTabsFromSettings, saveTabsToSettings } from "./config";

const clazz = "roam-tabs";
let scrollTop$ = 0;

const delay = (ms = 10) => new Promise((resolve) => setTimeout(() => { resolve(1) }, ms));

const mount = async () => {
  await delay(250)
  const roamMain = document.querySelector(".roam-main");
  let el = roamMain.querySelector("." + clazz);
  const roamBodyMain = roamMain.querySelector(".roam-body-main");
  const articleWrapper = document.querySelector(".rm-article-wrapper");
  if (!el) {
    el = document.createElement("div");
    el.className = clazz;
    roamMain.insertBefore(el, roamBodyMain);
  }
  ReactDOM.render(<App />, el);
  saveTabsToSettings(tabs, currentTab);

  // scroll to active button
  setTimeout(() => {
    console.log(currentTab, ' -----')
    if (currentTab.scrollTop) {
      const rbm = document.querySelector(".rm-article-wrapper");
      rbm.scrollTop = currentTab.scrollTop
    }
    const activeEl = el.querySelector(".roam-tab-active");
    if (!activeEl || !activeEl.parentElement) {
      return
    }
    const childRect = activeEl.getBoundingClientRect();
    const parentRect = activeEl.parentElement.getBoundingClientRect();
    const itemLeft = childRect.left - parentRect.left;
    const itemRight = itemLeft + childRect.width;
    const containerLeft = activeEl.parentElement.scrollLeft;
    const containerRight = containerLeft + childRect.width;

    if (itemLeft < containerLeft || itemRight > containerRight) {
      activeEl.parentElement.scroll({
        left: itemLeft
      })
    }

  }, 100)
};

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
      setCurrentTab(newTab)
      return [...prev];
    }
    const i = prev.findIndex((tab) => currentTab.uid === tab.uid);
    prev[i] = newTab;
    console.log(currentTab, i, prev);

    return [...prev];
  };
  tabs = change(tabs);
  mount();
};
const removeTab = (uid: string) => {
  const index = tabs.findIndex((tab) => tab.uid === uid);
  tabs = tabs.filter((tab) => tab.uid !== uid);
  if (currentTab.uid === uid) {
    setCurrentTab(tabs[Math.max(0, index - 1)]);
  }
  mount();
};

const setCurrentTab = (v?: Tab) => {
  currentTab = v;
  v && openUid(v.blockUid);
  mount();
};

function App() {
  const onChange = useEvent((uid: string, title: string, blockUid: string) => {
    if (currentTab) {
      currentTab.scrollTop = scrollTop$;
    }
    console.log(tabs, ' = tabs', currentTab, scrollTop$)
    scrollTop$ = 0;
    if (uid) setTabs({
      uid,
      title,
      blockUid
    });
    setCurrentTab({ uid, title, blockUid });
  });
  const onPointerdown = useEvent(function onPointerdown(e: PointerEvent) {

    ctrlKeyPressed = e.ctrlKey || e.metaKey;
    const rbm = document.querySelector(".rm-article-wrapper")
    scrollTop$ = rbm.scrollTop
    console.log(scrollTop$, ' ---global')
  });
  useEffect(() => {
    const rbm = document.querySelector(".rm-article-wrapper")
    if (!rbm) {
      return
    }

    function onScroll(e: Event) {
     
    }
    rbm.addEventListener("scroll", onScroll)
    return () => {
      rbm.removeEventListener("scroll", onScroll)
    }

  }, [])
  useEffect(() => {
    const old = window.onhashchange;
    window.onhashchange = async function (e) {
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      console.log("change---", e);
      const index = location.href.indexOf("/page/");
      const uid = e.newURL.split("/").pop();
      if (index === -1) {
        setCurrentTab();
        return;
      }
      const pageUid = getPageUidByUid(uid);
      const title = getPageTitleByUid(pageUid);
      console.log("change: ", pageUid, title, uid);

      onChange(pageUid, title, uid);

    };
    return () => {
      window.onhashchange = old;
    };
  }, []);
  useEffect(() => {
    document.addEventListener("pointerdown", onPointerdown);
    return () => {
      console.log("@@");
      document.removeEventListener("pointerdown", onPointerdown);
    };
  }, []);
  console.log(tabs);
  return (
    <div style={{ overflowX: "auto", whiteSpace: "nowrap", padding: 5 }}>
      {tabs.map((tab) => {
        const active = tab.uid === currentTab?.uid;
        return (
          <Button
            style={{
              outline: 'none'
            }}
            intent={active ? "primary" : "none"}
            outlined
            small
            className={`${active ? "roam-tab-active" : ''} roam-tab`}
            onClick={(e) => {
              if (e.shiftKey) {
                openInSidebar(tab.uid);
                return;
              }
              setCurrentTab(tab);
            }}
            rightIcon={
              <Button
                minimal
                small
                icon={<Icon color="#ABB3BF" icon="small-cross" />}
                onClickCapture={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeTab(tab.uid);
                }}
              />
            }
            text={
              <div
                style={{
                  display: "inline-block",

                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  minWidth: 100,
                  maxWidth: 200 /* 设置最大宽度 */
                }}
              >
                {tab.title}
              </div>
            }
          ></Button>
        );
      })}
    </div>
  );
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
      uid: uid
    }
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

export function initExtension() {
  const cacheConfig = loadTabsFromSettings();
  if (cacheConfig) {
    setCurrentTab(cacheConfig.activeTab);
    tabs = cacheConfig.tabs;
  }
  mount();
  extension_helper.on_uninstall(() => {
    document.querySelector(`.${clazz}`)?.remove()
  })
}


function openInSidebar(uid: string) {
  window.roamAlphaAPI.ui.rightSidebar.addWindow({
    window: {
      'block-uid': uid,
      type: 'outline'
    }
  })
}