import { app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';

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

const defaults: AppData = {
  projects: [],
  quickCommands: [],
  settings: {
    defaultEditor: 'code',
    defaultTerminal: '',
    confirmCommands: true,
    showHiddenProjects: false,
    compactCards: false,
  },
};

let dataPath = '';

function getDataPath() {
  if (!dataPath) dataPath = path.join(app.getPath('userData'), 'project-desk.json');
  return dataPath;
}

export async function loadData(): Promise<AppData> {
  try {
    const content = await fs.readFile(getDataPath(), 'utf8');
    const parsed = JSON.parse(content) as Partial<AppData>;
    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      quickCommands: Array.isArray(parsed.quickCommands) ? parsed.quickCommands : [],
      settings: { ...defaults.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    await saveData(defaults);
    return structuredClone(defaults);
  }
}

export async function saveData(data: AppData) {
  const target = getDataPath();
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.next`;
  await fs.writeFile(temporary, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(temporary, target);
}

export { defaults };
