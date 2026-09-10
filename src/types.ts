export type ProjectPart = {
  id: string;
  name: string;
  path: string;
  notes: string;
};

export type Project = {
  id: string;
  name: string;
  path: string;
  description: string;
  color: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  parts: ProjectPart[];
};

export type QuickCommand = {
  id: string;
  name: string;
  command: string;
  args: string[];
  projectId?: string;
  cwd?: string;
  color?: string;
};

export type Settings = {
  defaultEditor: string;
  defaultTerminal: string;
  confirmCommands: boolean;
  showHiddenProjects: boolean;
  compactCards: boolean;
};

export type AppData = {
  projects: Project[];
  quickCommands: QuickCommand[];
  settings: Settings;
};

export type GitInfo = {
  isRepo: boolean;
  root?: string;
  branch?: string;
  changes: number;
  ahead: number;
  behind: number;
  lastCommit?: string;
};
