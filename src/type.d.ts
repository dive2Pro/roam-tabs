
export type Command = {
  label: string;
  callback: () => void;
  "disable-hotkey"?: boolean;
  "default-hotkey"?: string;
};

export type TabSnapshot = {
  uid: string;
  title: string;
  blockUid: string;
};

export type Tab = {
  tabId: string;
  uid: string;
  title: string;
  blockUid: string;
  scrollTop?: number;
  pin: boolean;
  backStack?: TabSnapshot[];
  forwardStack?: TabSnapshot[];
};

export type CacheTab = {
  tabs: Tab[];
  activeTab?: Tab;
  collapsedUids?: string[];
};
