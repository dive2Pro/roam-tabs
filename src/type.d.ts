export type RoamExtensionAPI = {
  settings: {
    get: (k: string) => unknown;
    getAll: () => Record<string, unknown>;
    panel: {
      create: (c: PanelConfig) => void;
    };
    set: (k: string, v: unknown) => Promise<void>;
  };
  ui: {
    commandPalette: {
      addCommand: (command: Command) => void;
    };
  };
};

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

// Roam API types
declare global {
  interface Window {
    roamAlphaAPI: {
      user: {
        isAdmin: () => boolean;
        uid: () => string;
      };
      data: {
        async: {
          fast: any;
        };
      };
      q: (query: string) => any;
      ui: {
        mainWindow: {
          openBlock: (options: { block: { uid: string } }) => void;
        };
        rightSidebar: {
          addWindow: (options: { window: { "block-uid": string } }) => void;
        };
      };
    };
  }
}
