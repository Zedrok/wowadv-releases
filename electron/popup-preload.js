const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  getRaids: () => ipcRenderer.invoke('get-raids'),
})
