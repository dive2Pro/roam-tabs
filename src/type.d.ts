type RoamExtensionAPI = {
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
    }
  }
};

type Command = {
  label: string;
  callback: () => void;
  'disable-hotkey'?: boolean
  'default-hotkey'?: string
}


type Tab = { uid: string, title: string, blockUid: string, scrollTop?: number, pin: boolean };
