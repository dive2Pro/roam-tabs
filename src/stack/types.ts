import React from "react";

export type PageItem = {
  id: string;
  title: string;
  blockUid: string;
  pin: boolean;
};

export type StackContextType = {
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
  togglePin: (uid: string) => void;
  removeOtherTabs: (uid: string) => void;
  removeToTheRightTabs: (index: number) => void;
  openInSidebar: (uid: string) => void;
  isCollapsed: (uid: string) => boolean;
  toggleCollapsed: (uid: string) => void;
  collapsedNonce: number;
  foldAll: () => void;
  unfoldAll: () => void;
};
