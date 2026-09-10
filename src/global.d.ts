import type { AppData, GitInfo } from './types';

declare global {
  interface Window {
    desktop: {
      getData: () => Promise<AppData>;
      saveData: (data: AppData) => Promise<AppData>;
      chooseFolder: () => Promise<string | undefined>;
      openPath: (target: string) => Promise<string>;
      openExternal: (url: string) => Promise<void>;
      openEditor: (target: string, editor: string) => Promise<void>;
      openTerminal: (target: string, terminal: string) => Promise<void>;
      inspectGit: (target: string) => Promise<GitInfo>;
      gitAction: (action: string, target: string, value?: string) => Promise<{ ok: boolean; output: string }>;
      runCommand: (command: string, args: string[], cwd?: string) => Promise<{ ok: boolean }>;
    };
  }
}

export {};
