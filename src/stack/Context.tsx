import React, {
  useRef,
  createContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Tab } from "../type";
import {
  isAutoOpenNewTab,
  saveAndRefreshTabs,
  setCollapsedUids,
} from "../config";
import { useOnUidWillChange } from "../hooks/useOnUidChangeElementClicked";
import { StackContextType, PageItem } from "./types";
import { CONSTANTS } from "./constants";
import { Layout } from "./components/Layout";

/* ===========================================================================
 * 4. 核心逻辑 (Context)
 * =========================================================================== */
export const StackContext = createContext<StackContextType | undefined>(
  undefined
);

type StackProviderProps = {
  children: ReactNode;
  tabs: PageItem[];
  active: string;
  pageWidth: number;
  onTogglePin: (uid: string) => void;
  onRemoveOtherTabs: (uid: string) => void;
  onRemoveToTheRightTabs: (index: number) => void;
  onOpenInSidebar: (uid: string) => void;
  initialCollapsedUids?: string[];
};

const StackProvider = ({
  children,
  tabs,
  active,
  pageWidth,
  onTogglePin,
  onRemoveOtherTabs,
  onRemoveToTheRightTabs,
  onOpenInSidebar,
  initialCollapsedUids,
}: StackProviderProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const stack = tabs;
  const activeIndex = stack.findIndex((p) => p.id === active);
  //   const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const focusedIndex = activeIndex;
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(
    new Set(initialCollapsedUids || [])
  );
  const [collapsedNonce, setCollapsedNonce] = useState(0);

  const isCollapsed = (uid: string) => collapsedSet.has(uid);

  const foldAll = () => {
    const all = new Set(stack.map((p) => p.id));
    setCollapsedSet(all);
    setCollapsedUids(Array.from(all));
    setCollapsedNonce((n) => n + 1);
  };

  const unfoldAll = () => {
    setCollapsedSet(new Set());
    setCollapsedUids([]);
    setCollapsedNonce((n) => n + 1);
  };
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

    // 动态计算：考虑主动折叠后的可视宽度
    // 目标滚动位置 = 前面各页的 (实际宽度 - 脊宽度) 之和
    const targetScrollLeft = stack.slice(0, index).reduce((sum, p) => {
      const w = isCollapsed(p.id) ? CONSTANTS.SPINE_WIDTH : pageWidth;
      return sum + (w - CONSTANTS.SPINE_WIDTH);
    }, 0);

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

  const toggleCollapsed = (uid: string) => {
    const willExpand = collapsedSet.has(uid);

    setCollapsedSet((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      setCollapsedUids(Array.from(next));
      return next;
    });
    setCollapsedNonce((n) => n + 1);

    if (willExpand) {
      const index = stack.findIndex((p) => p.id === uid);
      if (index > -1) {
        // 因为有width的动画，要等待300ms来确保 tab 展现完全
        scrollToPageIndex(index);
        setTimeout(() => {
          scrollToPageIndex(index);
        }, 300);
      }
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

  const onResizeRef = useRef<() => void>(() => {});

  onResizeRef.current = () => {
    updateScrollMetrics();
    if (activeIndex > -1) {
      scrollToPageIndex(activeIndex);
    }
  };

  // 监听容器尺寸变化
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    updateScrollMetrics();
    const observer = new ResizeObserver(() => {
      onResizeRef.current();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Stack 变化后更新
  useEffect(() => {
    setTimeout(updateScrollMetrics, 100);
  }, [stack.length]);

  // 主动折叠状态变化后更新滚动/尺寸指标
  useEffect(() => {
    setTimeout(updateScrollMetrics, 0);
  }, [collapsedSet]);

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
        togglePin: (uid: string) => {
          onTogglePin(uid);
        },
        removeOtherTabs: (uid: string) => {
          onRemoveOtherTabs(uid);
        },
        removeToTheRightTabs: (index: number) => {
          onRemoveToTheRightTabs(index);
        },
        openInSidebar: (uid: string) => {
          onOpenInSidebar(uid);
        },
        isCollapsed,
        toggleCollapsed,
        collapsedNonce,
        foldAll,
        unfoldAll,
      }}
    >
      {children}
    </StackContext.Provider>
  );
};

// 全局变量跟踪 Ctrl/Cmd 键状态
let ctrlKeyPressed = false;

export const StackApp = (props: {
  tabs: Tab[];
  currentTab: Tab;
  pageWidth: number;
  collapsedUids?: string[];
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

  const togglePin = (uid: string) => {
    const updatedTabs = props.tabs.map((tab) =>
      tab.uid === uid ? { ...tab, pin: !tab.pin } : tab
    );
    const updatedCurrentTab = updatedTabs.find((tab) => tab.uid === uid);
    saveAndRefreshTabs(updatedTabs, updatedCurrentTab || props.currentTab);
  };

  const removeOtherTabs = (uid: string) => {
    const updatedTabs = props.tabs.filter((tab) => tab.pin || tab.uid === uid);
    const updatedCurrentTab = updatedTabs.find((tab) => tab.uid === uid);
    saveAndRefreshTabs(updatedTabs, updatedCurrentTab || props.currentTab);
  };

  const removeToTheRightTabs = (index: number) => {
    const updatedTabs = [
      ...props.tabs.slice(0, index + 1),
      ...props.tabs.slice(index + 1).filter((t) => t.pin),
    ];
    const currentIndex = updatedTabs.findIndex(
      (t) => t.uid === props.currentTab?.uid
    );
    const updatedCurrentTab =
      currentIndex === -1 || currentIndex > index
        ? updatedTabs[index]
        : props.currentTab;
    saveAndRefreshTabs(updatedTabs, updatedCurrentTab);
  };

  const openInSidebar = (uid: string) => {
    window.roamAlphaAPI.ui.rightSidebar.addWindow({
      window: {
        "block-uid": uid,
        type: "outline",
      },
    });
  };

  return (
    <StackProvider
      tabs={props.tabs.map((tab) => ({
        id: tab.uid,
        title: tab.title,
        blockUid: tab.blockUid,
        pin: tab.pin,
      }))}
      active={props.currentTab?.uid}
      pageWidth={props.pageWidth}
      onTogglePin={togglePin}
      onRemoveOtherTabs={removeOtherTabs}
      onRemoveToTheRightTabs={removeToTheRightTabs}
      onOpenInSidebar={openInSidebar}
      initialCollapsedUids={props.collapsedUids}
    >
      <Layout />
    </StackProvider>
  );
};
