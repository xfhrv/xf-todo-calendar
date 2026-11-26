const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('todoApi', {
  read: () => ipcRenderer.invoke('todo:read'),
  op: (operation) => ipcRenderer.invoke('todo:op', operation),
  quick: (text) => ipcRenderer.invoke('todo:quick', text),
  hideQuick: () => ipcRenderer.invoke('todo:hide-quick'),
  resizeQuick: (height) => ipcRenderer.invoke('todo:resize-quick', height),
  hideMain: () => ipcRenderer.invoke('todo:hide-main'),
  quit: () => ipcRenderer.invoke('todo:quit'),
  pinState: () => ipcRenderer.invoke('todo:pin-state'),
  setPin: (pinned) => ipcRenderer.invoke('todo:set-pin', pinned),
  copy: (text) => ipcRenderer.invoke('todo:copy', text),
  toggleMain: () => ipcRenderer.invoke('todo:toggle-main'),
  configPath: () => ipcRenderer.invoke('todo:config-path'),
  onState: (handler) => ipcRenderer.on('todo:state', (_event, state) => handler(state)),
  onOffline: (handler) => ipcRenderer.on('todo:offline', (_event, message) => handler(message)),
  onQuickFocus: (handler) => ipcRenderer.on('todo:quick-focus', () => handler())
});
