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

export const defaults: AppData = {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalizeProjectPart(value: unknown): ProjectPart | undefined {
  if (!isRecord(value)) return undefined;
  return {
    id: stringValue(value.id),
    name: stringValue(value.name),
    path: stringValue(value.path),
    notes: stringValue(value.notes),
  };
}

function normalizeProject(value: unknown): Project | undefined {
  if (!isRecord(value)) return undefined;
  return {
    id: stringValue(value.id),
    name: stringValue(value.name),
    path: stringValue(value.path),
    description: stringValue(value.description),
    color: stringValue(value.color),
    favorite: booleanValue(value.favorite, false),
    createdAt: stringValue(value.createdAt),
    updatedAt: stringValue(value.updatedAt),
    parts: Array.isArray(value.parts)
      ? value.parts.map(normalizeProjectPart).filter((part): part is ProjectPart => part !== undefined)
      : [],
  };
}

function normalizeQuickCommand(value: unknown): QuickCommand | undefined {
  if (!isRecord(value)) return undefined;
  const command: QuickCommand = {
    id: stringValue(value.id),
    name: stringValue(value.name),
    command: stringValue(value.command),
    args: stringArray(value.args),
  };
  if (typeof value.projectId === 'string') command.projectId = value.projectId;
  if (typeof value.cwd === 'string') command.cwd = value.cwd;
  if (typeof value.color === 'string') command.color = value.color;
  return command;
}

export function normalizeAppData(value: unknown): AppData {
  const input = isRecord(value) ? value : {};
  const settings = isRecord(input.settings) ? input.settings : {};
  return {
    projects: Array.isArray(input.projects)
      ? input.projects.map(normalizeProject).filter((project): project is Project => project !== undefined)
      : [],
    quickCommands: Array.isArray(input.quickCommands)
      ? input.quickCommands.map(normalizeQuickCommand).filter((command): command is QuickCommand => command !== undefined)
      : [],
    settings: {
      defaultEditor: stringValue(settings.defaultEditor, defaults.settings.defaultEditor),
      defaultTerminal: stringValue(settings.defaultTerminal, defaults.settings.defaultTerminal),
      confirmCommands: booleanValue(settings.confirmCommands, defaults.settings.confirmCommands),
      showHiddenProjects: booleanValue(settings.showHiddenProjects, defaults.settings.showHiddenProjects),
      compactCards: booleanValue(settings.compactCards, defaults.settings.compactCards),
    },
  };
}

let dataPath = '';

function getDataPath() {
  if (!dataPath) dataPath = path.join(app.getPath('userData'), 'project-desk.json');
  return dataPath;
}

export async function loadData(): Promise<AppData> {
  try {
    const content = await fs.readFile(getDataPath(), 'utf8');
    return normalizeAppData(JSON.parse(content) as unknown);
  } catch {
    await saveData(defaults);
    return structuredClone(defaults);
  }
}

export async function saveData(data: AppData) {
  const target = getDataPath();
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.next`;
  await fs.writeFile(temporary, JSON.stringify(normalizeAppData(data), null, 2), 'utf8');
  try {
    await fs.rename(temporary, target);
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? error.code : undefined;
    if (code !== 'EEXIST' && code !== 'EPERM' && code !== 'ENOTEMPTY') throw error;
    await fs.rm(target, { force: true });
    await fs.rename(temporary, target);
  }
}
