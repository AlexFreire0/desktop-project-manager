import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GitAction, inspectGit, runGitAction } from './git.js';
import { AppData, loadData, saveData } from './store.js';

let window: BrowserWindow | null = null;
let data: AppData;
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const execFile = promisify(execFileCallback);

function createWindow() {
  window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 650,
    backgroundColor: '#10131b',
    webPreferences: {
      preload: path.join(currentDir, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) window.loadURL(devUrl);
  else window.loadFile(path.join(currentDir, '../dist/index.html'));
}

function splitCommand(command: string) {
  const tokens = command.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  return tokens.map((token) => token.replace(/^"(.*)"$/, '$1'));
}

function launch(command: string, args: string[], cwd?: string): Promise<void> {
  const [executable, ...inlineArgs] = splitCommand(command);
  if (!executable) return Promise.reject(new Error('Command is empty'));
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [...inlineArgs, ...args], {
      cwd: cwd || undefined,
      detached: true,
      stdio: 'ignore',
      shell: false,
      windowsHide: false,
    });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

async function resolveEditor(command: string) {
  const configured = command.trim() || 'code';
  if (configured !== 'code' || process.platform !== 'win32') return configured;

  const candidates = [
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'Code.exe'),
    path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Programs', 'Microsoft VS Code', 'Code.exe'),
    path.join(process.env.ProgramFiles || '', 'Microsoft VS Code', 'Code.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft VS Code', 'Code.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code Insiders', 'Code - Insiders.exe'),
    path.join(process.env.ProgramFiles || '', 'Microsoft VS Code Insiders', 'Code - Insiders.exe'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Keep looking; the command may still be available on PATH.
    }
  }
  try {
    const result = await execFile('where.exe', ['code.exe'], { windowsHide: true });
    const pathFromPath = result.stdout.split(/\r?\n/).map((item) => item.trim()).find(Boolean);
    if (pathFromPath) return pathFromPath;
  } catch {
    // The command may not be registered on PATH.
  }
  return configured;
}

function registerHandlers() {
  ipcMain.handle('data:get', () => data);
  ipcMain.handle('data:save', async (_event, next: AppData) => {
    data = next;
    await saveData(data);
    return data;
  });
  ipcMain.handle('dialog:folder', async () => {
    const result = await dialog.showOpenDialog(window!, { properties: ['openDirectory', 'createDirectory'] });
    return result.canceled ? undefined : result.filePaths[0];
  });
  ipcMain.handle('path:open', async (_event, target: string) => shell.openPath(target));
  ipcMain.handle('url:open', async (_event, url: string) => shell.openExternal(url));
  ipcMain.handle('editor:open', async (_event, target: string, editor: string) => {
    const executable = await resolveEditor(editor);
    try {
      await launch(executable, [target], target);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        if (process.platform === 'win32' && executable === 'code') {
          const vscodeUrl = `vscode://file/${target.replace(/\\/g, '/')}`;
          await shell.openExternal(vscodeUrl);
          return;
        }
        throw new Error(`No se encontró el editor "${editor || 'code'}". Instala VS Code o configura la ruta completa en Settings > Editor command.`);
      }
      throw error;
    }
  });
  ipcMain.handle('terminal:open', (_event, target: string, terminal: string) => {
    if (terminal) return launch(terminal, [], target);
    if (process.platform === 'win32') return launch('cmd.exe', ['/K', 'cd', '/d', target]);
    if (process.platform === 'darwin') return launch('open', ['-a', 'Terminal', target]);
    return launch('x-terminal-emulator', [], target);
  });
  ipcMain.handle('git:inspect', (_event, target: string) => inspectGit(target));
  ipcMain.handle('git:action', async (_event, action: GitAction, target: string, value?: string) => {
    try {
      return { ok: true, output: await runGitAction(action, target, value) };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Git command failed';
      return { ok: false, output: message };
    }
  });
  ipcMain.handle('command:run', async (_event, command: string, args: string[], cwd?: string) => {
    await launch(command, args, cwd);
    return { ok: true };
  });
}

app.whenReady().then(async () => {
  data = await loadData();
  registerHandlers();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
