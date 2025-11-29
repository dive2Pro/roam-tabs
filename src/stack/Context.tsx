import React, {
  useState,
  useRef,
  createContext,
  useContext,
  ReactNode,
  useEffect,
} from "react";
import { Tab } from "../type";
import { Button } from "@blueprintjs/core";
import {
  isAutoOpenNewTab,
  removeTab,
  saveAndRefreshTabs,
  saveTabsToSettings,
} from "../config";
import { resetStackModeShowingState } from ".";
// import { removeTab } from "../extension";

/* ===========================================================================
 * 1. 类型定义
 * =========================================================================== */
type PageItem = {
  id: string;
  title: string;
};

type StackContextType = {
  stack: PageItem[];
  focusPage: (index: number) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  focusedIndex: number | null;
};

/* ===========================================================================
 * 2. 布局常量
 * =========================================================================== */
const CONSTANTS = {
  PAGE_WIDTH: 650, // 页面刚性宽度
  SPINE_WIDTH: 50, // 脊宽度
  TITLE_SHOW_AT: 100, // 🔥 核心配置：当未被遮盖范围剩 100px 时，标题才开始出现
};

// 单个页面完全折叠需要的位移量 (650 - 50 = 600)
const FOLD_OFFSET = CONSTANTS.PAGE_WIDTH - CONSTANTS.SPINE_WIDTH;

// 标题触发的相对偏移量 (650 - 100 = 550)
// 意味着：页面被盖住了 550px，只剩 100px 时，标题动画开始
const TITLE_TRIGGER_OFFSET = CONSTANTS.PAGE_WIDTH - CONSTANTS.TITLE_SHOW_AT;

/* ===========================================================================
 * 3. 模拟数据
 * =========================================================================== */
const DATA: PageItem[] = [
  { id: "1", title: "Page 1" },
  { id: "2", title: "Page 2" },
  { id: "3", title: "Page 3" },
  { id: "4", title: "Page 4" },
  { id: "5", title: "Page 5" },
  { id: "6", title: "Page 6" },
];

/* ===========================================================================
 * 4. 核心逻辑 (Context)
 * =========================================================================== */
const StackContext = createContext<StackContextType | undefined>(undefined);

type StackProviderProps = {
  children: ReactNode;
  tabs: PageItem[];
  active: string;
};

const StackProvider = ({ children, tabs, active }: StackProviderProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stack = tabs;
  const activeIndex = stack.findIndex((p) => p.id === active);
  //   const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const focusedIndex = activeIndex;
  /**
   * 核心算法：精确滚动到指定索引
   * 目标：让该页面的左边缘，刚好紧贴着前面所有页面的"脊"
   */
  const scrollToPageIndex = (index: number) => {
    if (containerRef.current) {
      const el = containerRef.current;

      // 公式： 目标滚动位置 = 索引 * (页面宽度 - 脊宽度)
      // 解释： 既然每个页面在折叠时都贡献了 (PageWidth - SpineWidth) 的位移，
      //       要看第 N 页，就需要把前面 N-1 页的这部分位移都滚过去。
      const targetScrollLeft = index * FOLD_OFFSET;

      el.scrollTo({
        left: targetScrollLeft,
        behavior: "smooth",
      });

      // 等待滚动完成后触发聚焦动画
      const triggerFocusAnimation = () => {
        // setFocusedIndex(index);
        // 聚焦状态保持 2.5 秒，让用户看到常驻的 box-shadow 和闪动效果
        setTimeout(() => {
          //   setFocusedIndex(null);
        }, 500);
      };

      // 使用 scrollend 事件（如果支持）或 fallback 到 setTimeout
      if ("onscrollend" in el) {
        el.addEventListener("scrollend", triggerFocusAnimation, { once: true });
      } else {
        // Fallback: 估算滚动时间（smooth 滚动通常需要 300-500ms）
        const estimatedScrollTime = 20;
        setTimeout(triggerFocusAnimation, estimatedScrollTime);
      }
    }
  };

  const focusPage = (index: number) => {
    // 点击脊部时，也使用精确对齐逻辑
    scrollToPageIndex(index);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      containerRef.current.style.setProperty(
        "--scroll-x",
        `${e.currentTarget.scrollLeft}`
      );
    }
  };

  useEffect(() => {
    scrollToPageIndex(activeIndex);
  }, [activeIndex]);

  return (
    <StackContext.Provider
      value={{ stack, focusPage, containerRef, handleScroll, focusedIndex }}
    >
      {children}
    </StackContext.Provider>
  );
};

/* ===========================================================================
 * 5. 页面组件
 * =========================================================================== */
type PageCardProps = {
  item: PageItem;
  index: number;
  total: number;
};

const PageCard = ({ item, index, total }: PageCardProps) => {
  const context = useContext(StackContext);
  if (!context) {
    throw new Error("PageCard must be used within StackProvider");
  }
  const { focusPage, focusedIndex } = context;
  const isObstructed = index < total - 1;
  const isFocused = focusedIndex === index;
  console.log("isFocused", { index, focusedIndex, isFocused });

  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setTimeout(() => {
      window.roamAlphaAPI.ui.components.renderPage({
        el: contentRef.current,
        uid: item.id,
      });
    }, 50);
  }, [item.id]);

  // --- 1. 基础折叠点 ---
  // 页面 sticky 吸附的时刻
  const foldStart = index * FOLD_OFFSET;

  // --- 2. 标题触发点 (关键修改) ---
  // foldStart 是页面刚刚 sticky 住的时刻 (此时可见宽度 = 650px)
  // 我们加上 TITLE_TRIGGER_OFFSET (550px)，表示右边页面已经盖过来 550px 了
  // 此时可见宽度 = 100px。从这一刻开始，标题才允许出现。
  const titleTriggerPoint = foldStart + TITLE_TRIGGER_OFFSET;

  // --- 3. 阴影触发点 ---
  // 当我(index)开始覆盖前一页(index-1)时
  const overlapStart = (index - 1) * FOLD_OFFSET;

  return (
    <div
      onClick={() => isObstructed && focusPage(index)}
      className={`roam-stack-card `}
      style={
        {
          // 传递给 CSS
          "--title-trigger": `${titleTriggerPoint}`,
          "--overlap-start": `${overlapStart}`,
          // --- 核心 A: 标题透明度 ---
          // 范围：从 (可见宽度100px) 到 (可见宽度50px/完全折叠)
          // 距离差是 50px (SPINE_WIDTH ~ 100px)
          // 计算：(当前滚动 - 触发点) / 50
          //   "--title-opacity": `clamp(0, (var(--scroll-x) - var(--title-trigger)) / 50, 1)`,
          // --- 核心 B: 阴影透明度 ---
          // 一旦开始重叠，30px 内阴影显现
          "--shadow-opacity":
            index === 0
              ? "0"
              : `clamp(0, (var(--scroll-x) - var(--overlap-start)) / 30, 1)`,
          width: `${CONSTANTS.PAGE_WIDTH}px`,
          // 你的老朋友 sticky left
          left: `${index * CONSTANTS.SPINE_WIDTH}px`,
          zIndex: index,
          cursor: isObstructed ? "pointer" : "default",
          // 左侧外阴影 (覆盖在前一页上的阴影)
          boxShadow: `
          -10px 0 20px -5px rgba(0,0,0, calc(0.3 * var(--shadow-opacity))),
          -30px 0 50px -10px rgba(0,0,0, calc(0.1 * var(--shadow-opacity)))
        `,
        } as React.CSSProperties & {
          "--title-trigger": string;
          "--overlap-start": string;
          "--title-opacity": string;
          "--shadow-opacity": string;
        }
      }
    >
      <div
        className={`roam-stack-card-content ${
          isFocused ? "roam-stack-card-focused" : ""
        }`}
      >
        {/* 垂直脊 */}
        <div
          className="roam-stack-card-spine"
          style={{
            //   position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${CONSTANTS.SPINE_WIDTH}px`,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            //   justifyContent: "center",
            writingMode: "vertical-rl",
            color: "#666",
            fontWeight: "bold",
            letterSpacing: "2px",
            borderRight: "1px solid rgba(0,0,0,0.05)",
            background: "rgba(255,255,255,0.5)",
            pointerEvents: "none",
          }}
        >
          {/* 关闭按钮 - 始终可见 */}
          <div
            style={{
              pointerEvents: "auto",
              opacity: 1,
              marginBottom: "10px",
            }}
          >
            <Button
              icon="cross"
              minimal
              onClick={(e) => {
                e.stopPropagation();
                removeTab(item.id);
              }}
            ></Button>
          </div>
          {/* 标题文本 - 动态透明度 */}
          <div
            style={
              {
                opacity: "var(--title-opacity)",
              } as React.CSSProperties & {
                "--title-opacity": string;
              }
            }
          >
            {item.title}
          </div>
        </div>

        {/* 内容 */}
        <div
          style={{
            padding: "20px",
            paddingLeft: `40px`,
            overflow: "auto",
            width: CONSTANTS.PAGE_WIDTH - CONSTANTS.SPINE_WIDTH,
          }}
          ref={contentRef}
        ></div>
      </div>
    </div>
  );
};

/* ===========================================================================
 * 6. 布局容器
 * =========================================================================== */
const Layout = () => {
  const context = useContext(StackContext);
  if (!context) {
    throw new Error("Layout must be used within StackProvider");
  }
  const { stack, containerRef, handleScroll } = context;
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* <header
        style={{
          padding: "15px 20px",
          color: "#fff",
          background: "#222",
          fontSize: "14px",
        }}
      >
        <strong>Precision Scroll:</strong>{" "}
        点击任意按钮，目标页面会完美贴合在左侧堆叠区的右边。
      </header> */}

      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={
          {
            flex: 1,
            display: "flex",
            overflowX: "auto",
            overflowY: "hidden",
            scrollBehavior: "smooth",
            // 移除 paddingRight 以保证精确控制边界
            paddingRight: 0,
            "--scroll-x": "0",
          } as React.CSSProperties & {
            "--scroll-x": string;
          }
        }
      >
        {stack.length === 0 && (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontSize: "20px",
                color: "#666",
              }}
            >
              No tabs
            </div>
          </div>
        )}
        {stack.map((item: PageItem, index: number) => (
          <PageCard
            key={item.id}
            item={item}
            index={index}
            total={stack.length}
          />
        ))}
      </div>
    </div>
  );
};

export const StackApp = (props: { tabs: Tab[]; currentTab: Tab }) => {
  useEffect(() => {
    const onRouteChange = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const pageOrBlockUid =
        await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
      resetStackModeShowingState();
      if (!pageOrBlockUid) {
        return;
      }
      let pageData = (await window.roamAlphaAPI.data.async.q(
        `[:find [?e ?t]  :where [?b :block/uid "${pageOrBlockUid}"] [?b :block/page ?p]
         [?p :block/uid ?e]
         [?p :node/title ?t]
        ]`
      )) as unknown as null | [string, string];
      let blockUid = pageOrBlockUid;
      if (!pageData) {
        const title = (await window.roamAlphaAPI.data.async.q(
          `[:find ?t . :where [?b :block/uid "${pageOrBlockUid}"] [?b :node/title ?t]
          ]`
        )) as unknown as string;
        pageData = [pageOrBlockUid, title];
      }
      console.log("pageOrBlockUid", pageOrBlockUid, pageData);

      const [pageUid, title] = pageData;
      if (props.tabs.find((tab) => tab.uid === pageUid)) {
        const index = props.tabs.findIndex((tab) => tab.uid === pageUid);
        props.tabs[index].blockUid = blockUid;
        saveAndRefreshTabs(props.tabs, props.tabs[index]);
        return;
      }
      //   if (isAutoOpenNewTab()) {
      const newTab = { uid: pageUid, title, blockUid, pin: false };
      const tabs = [...props.tabs, newTab];
      console.log("newTab@@@", newTab);
      saveAndRefreshTabs(tabs, newTab);
      //   } else {
      //     const currentIndex = props.tabs.findIndex(
      //       (tab) => tab.uid === props.currentTab?.uid
      //     );
      //     const exitsIndex = props.tabs.findIndex((tab) => tab.uid === pageUid);
      //     let newTab =
      //       exitsIndex > -1
      //         ? {
      //             ...props.tabs[exitsIndex],
      //             blockUid,
      //           }
      //         : {
      //             blockUid,
      //             title,
      //             uid: pageUid,
      //             pin: false,
      //           };
      //     const tabs = [...props.tabs];
      //     if (currentIndex !== -1) {
      //       tabs[currentIndex] = newTab;
      //     } else {
      //       tabs.push(newTab);
      //     }
      //     console.log("tabs!!!", tabs);
      //     saveAndRefreshTabs(tabs, newTab);
      //   }
    };

    window.addEventListener("hashchange", onRouteChange);

    return () => {
      window.removeEventListener("hashchange", onRouteChange);
    };
  }, [props.tabs, props.currentTab]);
  return (
    <StackProvider
      tabs={props.tabs.map((tab) => ({ id: tab.uid, title: tab.title }))}
      active={props.currentTab?.uid}
    >
      <Layout />
    </StackProvider>
  );
};
