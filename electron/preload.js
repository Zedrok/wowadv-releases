const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  startScraper:   () => ipcRenderer.send('start-scraper'),
  stopScraper:    () => ipcRenderer.send('stop-scraper'),
  refreshNow:     () => ipcRenderer.send('refresh-now'),
  requestData:    () => ipcRenderer.send('request-data'),
  isRunning:      () => ipcRenderer.invoke('scraper-running'),

  openNextRuns:   () => ipcRenderer.send('open-next-runs'),

  onRaidsData:    (cb) => ipcRenderer.on('raids-data',      (_, d) => cb(d)),
  onScraperStatus:(cb) => ipcRenderer.on('scraper-status',  (_, d) => cb(d)),
  onScraperLog:   (cb) => ipcRenderer.on('scraper-log',     (_, d) => cb(d)),
  onShowLogs:     (cb) => ipcRenderer.on('show-logs',       ()     => cb()),
})
