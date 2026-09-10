import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktop', {
  getData: () => ipcRenderer.invoke('data:get'),
  saveData: (data: unknown) => ipcRenderer.invoke('data:save', data),
  chooseFolder: () => ipcRenderer.invoke('dialog:folder'),
  openPath: (target: string) => ipcRenderer.invoke('path:open', target),
  openExternal: (url: string) => ipcRenderer.invoke('url:open', url),
  openEditor: (target: string, editor: string) => ipcRenderer.invoke('editor:open', target, editor),
  openTerminal: (target: string, terminal: string) => ipcRenderer.invoke('terminal:open', target, terminal),
  inspectGit: (target: string) => ipcRenderer.invoke('git:inspect', target),
  gitAction: (action: string, target: string, value?: string) => ipcRenderer.invoke('git:action', action, target, value),
  runCommand: (command: string, args: string[], cwd?: string) => ipcRenderer.invoke('command:run', command, args, cwd),
});
