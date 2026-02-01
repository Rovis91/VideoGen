const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('adgen', {
  getConfig: () => ipcRenderer.invoke('getConfig'),
  saveConfig: (data) => ipcRenderer.invoke('saveConfig', data),
  openImageFile: () => ipcRenderer.invoke('openImageFile'),
  openOutputFolder: () => ipcRenderer.invoke('openOutputFolder'),
  validateImage: (path) => ipcRenderer.invoke('validateImage', path),
  generateIdeas: (opts) => ipcRenderer.invoke('generateIdeas', opts),
  cancelGenerateIdeas: () => ipcRenderer.invoke('cancelGenerateIdeas'),
  openFolder: (path) => ipcRenderer.invoke('openFolder', path),
  generateVideo: (opts) => ipcRenderer.invoke('generateVideo', opts),
  testApiKey: (apiKey) => ipcRenderer.invoke('testApiKey', apiKey),
});
