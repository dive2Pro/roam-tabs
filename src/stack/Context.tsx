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
  openPage: (id: string) => void;
  focusPage: (index: number) => void;
  containerRef: React.RefObject<HTMLDivElement>;
};

/* ===========================================================================
 * 2. 布局常量
 * =========================================================================== */
const CONSTANTS = {
  PAGE_WIDTH: 650, // 页面刚性宽度
  SPINE_WIDTH: 50, // 脊宽度
};

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
      const targetScrollLeft =
        index * (CONSTANTS.PAGE_WIDTH - CONSTANTS.SPINE_WIDTH);

      el.scrollTo({
        left: targetScrollLeft,
        behavior: "smooth",
      });
    }
  };

  const openPage = (id: string) => {
    const existingIndex = stack.findIndex((p) => p.id === id);

    if (existingIndex !== -1) {
      // ✅ 1. 页面已存在：直接精确滑动到该位置
      scrollToPageIndex(existingIndex);
    } else {
      // ✅ 2. 页面不存在：先添加，等待渲染后滑动到最后
      const newPage = DATA.find((d) => d.id === id) || {
        id,
        title: `New Page ${id}`,
        bg: "#e6f7ff",
      };

      //   setStack((prev) => {
      //     const newStack = [...prev, newPage];
      //     // 这是一个微小的 hack：利用 setTimeout 确保 state 更新导致 DOM 渲染后，再执行滚动
      //     // 在 React 18+ 也可以用 useLayoutEffect 或 flushSync，但在事件处理中这样最简单
      //     setTimeout(() => {
      //       scrollToPageIndex(newStack.length - 1);
      //     }, 50);
      //     return newStack;
      //   });
    }
  };

  const focusPage = (index: number) => {
    // 点击脊部时，也使用精确对齐逻辑
    scrollToPageIndex(index);
  };
  useEffect(() => {
    scrollToPageIndex(activeIndex);
  }, [activeIndex]);

  return (
    <StackContext.Provider value={{ stack, openPage, focusPage, containerRef }}>
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
  const { openPage, focusPage } = context;
  const isObstructed = index < total - 1;
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    window.roamAlphaAPI.ui.components.renderPage({
      el: contentRef.current,
      uid: item.id,
    });
  }, [item.id]);

  return (
    <div
      onClick={() => isObstructed && focusPage(index)}
      className="roam-stack-card"
      style={{
        width: `${CONSTANTS.PAGE_WIDTH}px`,
        // 你的老朋友 sticky left
        left: `${index * CONSTANTS.SPINE_WIDTH}px`,
        zIndex: index,
        cursor: isObstructed ? "pointer" : "default",
      }}
    >
      {/* 垂直脊 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: `${CONSTANTS.SPINE_WIDTH}px`,
          display: "flex",
          writingMode: "vertical-rl",
          color: "#888",
          borderRight: "1px solid rgba(0,0,0,0.05)",
          background: "rgba(255,255,255,0.5)",
          paddingTop: 20,
          alignItems: "center",
          gap: 10,
        }}
      >
        <Button
          icon="cross"
          minimal
          //   onClick={() => removeTab(item.id)}
        ></Button>
        {item.title}
      </div>

      {/* 内容 */}
      <div
        style={{
          padding: "20px",
          paddingLeft: `${CONSTANTS.SPINE_WIDTH + 30}px`,
        }}
        ref={contentRef}
      ></div>
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
  const { stack, containerRef } = context;
  console.log("stack", stack);
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#333",
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
        style={{
          flex: 1,
          display: "flex",
          overflowX: "auto",
          overflowY: "hidden",
          scrollBehavior: "smooth",
          // 移除 paddingRight 以保证精确控制边界
          paddingRight: 0,
        }}
      >
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
  return (
    <StackProvider
      tabs={props.tabs.map((tab) => ({ id: tab.uid, title: tab.title }))}
      active={props.currentTab?.uid}
    >
      <Layout />
    </StackProvider>
  );
};
