const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  getRaids:    () => ipcRenderer.invoke('get-raids'),
  triggerScrape: () => ipcRenderer.send('refresh-now'),
  openUrl:     (url) => ipcRenderer.send('open-url', url),
  onRaidsData: (cb) => ipcRenderer.on('raids-data', (_e, data) => cb(data)),
})
