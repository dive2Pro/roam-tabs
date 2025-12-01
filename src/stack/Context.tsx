import React, {
  useRef,
  createContext,
  useContext,
  ReactNode,
  useEffect,
} from "react";
import { Tab } from "../type";
import { Button } from "@blueprintjs/core";
import {
  focusOnPageTab,
  focusTab,
  getStackPageWidth,
  isAutoOpenNewTab,
  removeTab,
  saveAndRefreshTabs,
} from "../config";

import { useOnUidWillChange } from "../hooks/useOnUidChangeElementClicked";
// import { removeTab } from "../extension";

/* ===========================================================================
 * 1. 类型定义
 * =========================================================================== */
type PageItem = {
  id: string;
  title: string;
  blockUid: string;
};

type StackContextType = {
  stack: PageItem[];
  focusPage: (index: number) => void;
  focusPageByUid: (uid: string) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  focusedIndex: number | null;
  hintRef: React.RefObject<HTMLDivElement>;
  //   宽度相关
  pageWidth: number;
  foldOffset: number;
  titleTriggerOffset: number;
};

/* ===========================================================================
 * 2. 布局常量
 * =========================================================================== */
const CONSTANTS = {
  SPINE_WIDTH: 50, // 脊宽度
  TITLE_SHOW_AT: 100, // 🔥 核心配置：当未被遮盖范围剩 100px 时，标题才开始出现
};

// 单个页面完全折叠需要的位移量 (650 - 50 = 600)
// const FOLD_OFFSET = () => CONSTANTS.SPINE_WIDTH;

// 标题触发的相对偏移量 (650 - 100 = 550)
// // 意味着：页面被盖住了 550px，只剩 100px 时，标题动画开始
// const TITLE_TRIGGER_OFFSET = () =>
//   CONSTANTS.PAGE_WIDTH() - CONSTANTS.TITLE_SHOW_AT;

/* ===========================================================================
 * 3. 模拟数据
 * =========================================================================== */

/* ===========================================================================
 * 4. 核心逻辑 (Context)
 * =========================================================================== */
const StackContext = createContext<StackContextType | undefined>(undefined);

type StackProviderProps = {
  children: ReactNode;
  tabs: PageItem[];
  active: string;
  pageWidth: number;
};

const StackProvider = ({
  children,
  tabs,
  active,
  pageWidth,
}: StackProviderProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const stack = tabs;
  const foldOffset = pageWidth - CONSTANTS.SPINE_WIDTH;
  const activeIndex = stack.findIndex((p) => p.id === active);
  //   const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const focusedIndex = activeIndex;
  /**
   * 核心算法：智能滚动到指定索引
   * 目标：让该页面的左边缘，刚好紧贴着前面所有页面的"脊"
   * 优化：如果页面已经在视口内完美展示且未被遮挡，则跳过滚动
   */
  const scrollToPageIndex = (index: number) => {
    const container = containerRef.current;
    if (!container) return;

    // 智能判断：如果页面已经在视口内完美展示，则跳过滚动
    const pageNode = container.children[index] as HTMLElement | undefined;
    if (pageNode) {
      const conRect = container.getBoundingClientRect();
      const pageRect = pageNode.getBoundingClientRect();

      // 判断可见性 (左右都在视口内，允许 5px 的容差)
      const isVisibleInViewport =
        pageRect.left >= conRect.left - 5 &&
        pageRect.right <= conRect.right + 5;

      // 判断遮挡 (下一个页面的左边缘是否压在当前页面的右边缘内)
      let isCovered = false;
      const nextNode = container.children[index + 1] as HTMLElement | undefined;
      if (nextNode) {
        const nextRect = nextNode.getBoundingClientRect();
        // 如果重叠超过 10px 视为遮挡
        if (nextRect.left < pageRect.right - 10) {
          isCovered = true;
        }
      }

      if (isVisibleInViewport && !isCovered) {
        // 页面已经完美展示，跳过滚动
        return;
      }
    }

    // 公式： 目标滚动位置 = 索引 * (页面宽度 - 脊宽度)
    // 解释： 既然每个页面在折叠时都贡献了 (PageWidth - SpineWidth) 的位移，
    //       要看第 N 页，就需要把前面 N-1 页的这部分位移都滚过去。
    const targetScrollLeft = index * foldOffset;

    container.scrollTo({
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
    if ("onscrollend" in container) {
      container.addEventListener("scrollend", triggerFocusAnimation, {
        once: true,
      });
    } else {
      // Fallback: 估算滚动时间（smooth 滚动通常需要 300-500ms）
      const estimatedScrollTime = 20;
      setTimeout(triggerFocusAnimation, estimatedScrollTime);
    }
  };

  const focusPage = (index: number) => {
    // 点击脊部时，也使用精确对齐逻辑
    scrollToPageIndex(index);
  };

  // 🔥 核心：更新右侧滑动提示阴影 (不触发 React 渲染)
  const updateHintUI = (max: number, current: number) => {
    if (!hintRef.current) return;

    const remaining = max - current;

    // 如果剩余距离 > 10px，显示阴影提示；否则隐藏
    if (remaining > 10) {
      // 根据剩余距离计算阴影强度，距离越远阴影越明显
      const shadowIntensity = Math.min(remaining / 200, 1); // 最大强度在 200px 时达到
      hintRef.current.style.opacity = `${shadowIntensity}`;
    } else {
      hintRef.current.style.opacity = "0";
    }
  };

  // --- A. 更新最大滚动距离 ---
  const updateScrollMetrics = () => {
    if (containerRef.current) {
      const el = containerRef.current;
      const max = el.scrollWidth - el.clientWidth;
      const current = el.scrollLeft;

      // 更新 CSS 变量用于样式计算
      el.style.setProperty("--scroll-max", `${max}`);
      el.style.setProperty("--scroll-x", `${current}`);

      // 🔥 手动触发一次 UI 更新，确保初始状态正确
      updateHintUI(max, current);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      const el = e.currentTarget;
      const current = el.scrollLeft;
      const max = el.scrollWidth - el.clientWidth;

      // 1. 更新 CSS 变量 (用于页面内部阴影/标题等)
      el.style.setProperty("--scroll-x", `${current}`);

      // 2. 🔥 更新右侧滑动提示阴影
      updateHintUI(max, current);
    }
  };

  // 监听容器尺寸变化
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    updateScrollMetrics();
    const observer = new ResizeObserver(updateScrollMetrics);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Stack 变化后更新
  useEffect(() => {
    setTimeout(updateScrollMetrics, 100);
  }, [stack.length]);

  useEffect(() => {
    scrollToPageIndex(activeIndex);
  }, [activeIndex]);

  return (
    <StackContext.Provider
      value={{
        stack,
        focusPage,
        containerRef,
        handleScroll,
        focusedIndex,
        hintRef,
        pageWidth: pageWidth,
        foldOffset: pageWidth - CONSTANTS.SPINE_WIDTH,
        titleTriggerOffset: pageWidth - CONSTANTS.TITLE_SHOW_AT,
        focusPageByUid: (uid: string) => {
          const index = stack.findIndex((p) => p.id === uid);
          if (index > -1) {
            focusPage(index);
          }
        },
      }}
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
  const {
    focusPage,
    focusPageByUid,
    focusedIndex,
    pageWidth,
    foldOffset,
    titleTriggerOffset,
  } = context;
  const isObstructed = index < total - 1;
  const isFocused = focusedIndex === index;

  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setTimeout(async () => {
      await window.roamAlphaAPI.ui.components.unmountNode({
        el: contentRef.current,
      });
      if (item.blockUid !== item.id) {
        window.roamAlphaAPI.ui.components.renderBlock({
          el: contentRef.current,
          uid: item.blockUid,
          "zoom-path?": true,
        });
        await new Promise((resolve) => setTimeout(resolve, 100));

        return;
      }
      window.roamAlphaAPI.ui.components.renderPage({
        el: contentRef.current,
        uid: item.id,
      });
    }, 50);
  }, [item.id, item.blockUid]);

  // --- 1. 基础折叠点 ---
  // 页面 sticky 吸附的时刻
  const foldStart = index * foldOffset;

  // --- 2. 标题触发点 (关键修改) ---
  // foldStart 是页面刚刚 sticky 住的时刻 (此时可见宽度 = 650px)
  // 我们加上 TITLE_TRIGGER_OFFSET (550px)，表示右边页面已经盖过来 550px 了
  // 此时可见宽度 = 100px。从这一刻开始，标题才允许出现。
  const titleTriggerPoint = foldStart + titleTriggerOffset;

  // --- 3. 阴影触发点 ---
  // 当我(index)开始覆盖前一页(index-1)时
  const overlapStart = (index - 1) * foldOffset;

  return (
    <div
      onClick={(e) => {
        const target = e.target as HTMLElement;
        const zoomsClass = ["rm-zoom-item", "rm-zoom-item-content"];
        if (zoomsClass.some((cls) => target.classList.contains(cls))) {
          const zoomItem = target.closest(".rm-zoom-item");
          if (zoomItem) {
            const children = zoomItem.parentElement.children;
            const index = Array.from(children).indexOf(zoomItem);
            console.log({ index }, "  = zoom ");
            if (index === 0) {
              focusOnPageTab(item.id);
              return;
            }
          }
        }
        focusPage(index);
      }}
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
          width: `${pageWidth}px`,
          // 你的老朋友 sticky left
          left: `${index * CONSTANTS.SPINE_WIDTH}px`,
          //   zIndex: index,
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
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            const target = e.target as HTMLElement;
            if (target.classList.contains("rm-page-ref")) {
              const linkUid = target
                .closest("[data-link-uid]")
                ?.getAttribute("data-link-uid");
              if (linkUid) {
                focusPageByUid(linkUid);
              }
              return;
            }
            focusTab(item.id);
          }}
          style={{
            padding: "20px",
            paddingLeft: `40px`,
            overflow: "auto",
            width: pageWidth - CONSTANTS.SPINE_WIDTH,
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
  const { stack, containerRef, handleScroll, hintRef } = context;
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
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

      {/* 
        🔥🔥 右侧滑动提示阴影效果
        当还有内容可以向右滚动时，在右侧边缘显示渐变阴影提示
      */}
      <div
        ref={hintRef}
        className="roam-stack-scroll-indicator"
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: "60px", // 阴影渐变宽度
          zIndex: 100,
          pointerEvents: "none", // 不阻挡点击

          // 从右到左的渐变阴影效果
          background:
            "linear-gradient(to left, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.08) 50%, transparent 100%)",

          // 动画属性 (由 JS 切换 opacity)
          transition: "opacity 0.3s ease",
          opacity: 0, // 默认隐藏
        }}
      />

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
            "--scroll-max": "0",
          } as React.CSSProperties & {
            "--scroll-x": string;
            "--scroll-max": string;
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

// 全局变量跟踪 Ctrl/Cmd 键状态
let ctrlKeyPressed = false;

export const StackApp = (props: {
  tabs: Tab[];
  currentTab: Tab;
  pageWidth: number;
}) => {
  useOnUidWillChange(async (uid) => {
    if (!uid) {
      // 清空聚焦的页面
      saveAndRefreshTabs(props.tabs, undefined);
      return;
    }

    const pageOrBlockUid = uid;

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

    const [pageUid, title] = pageData;
    const existingTabIndex = props.tabs.findIndex((tab) => tab.uid === pageUid);

    // 如果标签页已存在，更新它
    if (existingTabIndex !== -1) {
      const updatedTabs = [...props.tabs];
      updatedTabs[existingTabIndex] = {
        ...updatedTabs[existingTabIndex],
        blockUid,
      };
      saveAndRefreshTabs(updatedTabs, updatedTabs[existingTabIndex]);
      return;
    }

    // 如果当前标签页是 pinned 的，自动创建新标签页（类似于 horizontal 模式）
    const shouldCreateNewTab =
      ctrlKeyPressed || isAutoOpenNewTab() || props.currentTab?.pin;

    // console.log({
    //   shouldCreateNewTab,
    //   ctrlKeyPressed,
    //   isAutoOpenNewTab: isAutoOpenNewTab(),
    //   pin: props.currentTab?.pin,
    // });
    // 标签页不存在，根据 Ctrl/Cmd 键、Auto 模式和 pinned 状态决定行为
    if (shouldCreateNewTab) {
      // 创建新标签页
      const newTab = { uid: pageUid, title, blockUid, pin: false };
      const tabs = [...props.tabs, newTab];
      saveAndRefreshTabs(tabs, newTab);
    } else {
      // 不创建新标签页，根据情况处理
      if (props.tabs.length === 0) {
        // 如果标签列表为空，创建新标签页
        const newTab = { uid: pageUid, title, blockUid, pin: false };
        saveAndRefreshTabs([newTab], newTab);
      } else if (!props.currentTab) {
        // 如果当前没有标签页，创建新标签页并设置为当前标签页
        const newTab = { uid: pageUid, title, blockUid, pin: false };
        const tabs = [...props.tabs, newTab];
        saveAndRefreshTabs(tabs, newTab);
      } else {
        // 否则，更新当前标签页（替换当前标签页的内容）
        const updatedTabs = props.tabs.map((tab) =>
          tab.uid === props.currentTab.uid
            ? { uid: pageUid, title, blockUid, pin: tab.pin }
            : tab
        );
        const updatedCurrentTab = updatedTabs.find(
          (tab) => tab.uid === pageUid
        ) || { uid: pageUid, title, blockUid, pin: false };
        saveAndRefreshTabs(updatedTabs, updatedCurrentTab);
      }
    }
  });
  // 检测 Ctrl/Cmd 键按下
  useEffect(() => {
    const onPointerdown = (e: PointerEvent) => {
      ctrlKeyPressed = e.ctrlKey || e.metaKey;
    };

    document.addEventListener("pointerdown", onPointerdown);
    return () => {
      document.removeEventListener("pointerdown", onPointerdown);
    };
  }, []);

  return (
    <StackProvider
      tabs={props.tabs.map((tab) => ({
        id: tab.uid,
        title: tab.title,
        blockUid: tab.blockUid,
      }))}
      active={props.currentTab?.uid}
      pageWidth={props.pageWidth}
    >
      <Layout />
    </StackProvider>
  );
};
