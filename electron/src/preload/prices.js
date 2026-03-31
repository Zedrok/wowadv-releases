const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  getPrices:     () => ipcRenderer.invoke('get-prices'),
  refreshPrices: () => ipcRenderer.send('refresh-prices'),
  onPricesData:  (cb) => ipcRenderer.on('prices-data', (_e, data) => cb(data)),
})
