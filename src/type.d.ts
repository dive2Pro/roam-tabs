
export type Command = {
  label: string;
  callback: () => void;
  "disable-hotkey"?: boolean;
  "default-hotkey"?: string;
};

export type Tab = {
  uid: string;
  title: string;
  blockUid: string;
  scrollTop?: number;
  pin: boolean;
};

export type CacheTab = {
  tabs: Tab[];
  activeTab?: Tab;
};