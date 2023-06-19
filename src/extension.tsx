import React from "react";
import ReactDOM from "react-dom";
import "./style.less";
const { useEffect, useState, useCallback, useRef, useLayoutEffect } = React;
import { Button, Icon } from '@blueprintjs/core'
import { extension_helper } from "./helper";
import { isAutoOpenNewTab } from "./config";

const clazz = "roam-tabs";

const mount = () => {
  const roamMain = document.querySelector(".roam-main");
  let el = roamMain.querySelector("." + clazz);
  const roamBodyMain = roamMain.querySelector(".roam-body-main");
  const articleWrapper = document.querySelector(".rm-article-wrapper");
  console.log(el, " --@@-- ");
  if (!el) {
    el = document.createElement("div");
    el.className = clazz;
    roamBodyMain.insertBefore(el, roamBodyMain.firstChild);
  }

  ReactDOM.render(<App />, el);

  // scroll to active button
  setTimeout(() => {
    const activeEl = el.querySelector(".roam-tab-active");
    if (!activeEl) {
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

type Tab = { uid: string, title: string, blockUid: string };
let currentTab: string;

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
      setCurrentTab(newTab.uid)
      return [...prev];
    }
    const i = prev.findIndex((tab) => currentTab === tab.uid);
    prev[i] = newTab;
    console.log(currentTab, i, prev);

    return [...prev];
  };
  tabs = change(tabs);
  mount();
};
const removeTab = (uid: string) => {
  tabs = tabs.filter((tab) => tab.uid !== uid);
  if (currentTab === uid) {
    setCurrentTab(tabs[0]?.uid)
    tabs[0]?.uid && openUid(tabs[0].uid);
  }
  mount();
};

const setCurrentTab = (v?: string) => {
  currentTab = v;
  mount();
};

function App() {
  const onChange = useEvent((uid: string, title: string, blockUid: string) => {
    if (uid) setTabs({
      uid, title, blockUid
    });
    setCurrentTab(uid);
  });
  const onPointerdown = useEvent(function onPointerdown(e: PointerEvent) {

    ctrlKeyPressed = e.ctrlKey || e.metaKey;
  });

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
        const active = tab.uid === currentTab;
        return (
          <Button
            style={{}}
            intent={active ? "primary" : "none"}
            outlined
            small
            className={`${active ? "roam-tab-active" : '' } roam-tab`}
            onClick={() => {
              openUid(tab.blockUid);
              setCurrentTab(tab.uid);
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
  console.log("init extension");
  mount();
  extension_helper.on_uninstall(() => {
    document.querySelector(`.${clazz}`)?.remove()
  })
}
