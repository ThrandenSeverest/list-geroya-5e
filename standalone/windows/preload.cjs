const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('HeroListDesktop', {
  saveFile: (name, mime, base64) => ipcRenderer.invoke('herolist:save', { name, mime, base64 }),
  printPdf: (name) => ipcRenderer.invoke('herolist:pdf', { name }),
});
