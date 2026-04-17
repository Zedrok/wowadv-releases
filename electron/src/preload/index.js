const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  startScraper:   () => ipcRenderer.send('start-scraper'),
  stopScraper:    () => ipcRenderer.send('stop-scraper'),
  refreshNow:     () => ipcRenderer.send('refresh-now'),
  requestData:    () => ipcRenderer.send('request-data'),
  isRunning:      () => ipcRenderer.invoke('scraper-running'),

  getRaids:       () => ipcRenderer.invoke('get-raids'),
  getPrices:      () => ipcRenderer.invoke('get-prices'),
  triggerScrape:  () => ipcRenderer.send('refresh-now'),
  refreshPrices:  () => ipcRenderer.send('refresh-prices'),

  openNextRuns:   () => ipcRenderer.send('open-next-runs'),
  openPrices:     () => ipcRenderer.send('open-prices'),
  openUrl:        (url) => ipcRenderer.send('open-url', url),

  getFavLists:    () => ipcRenderer.invoke('get-fav-lists'),
  saveFavLists:   (lists) => ipcRenderer.send('save-fav-lists', lists),

  getAppVersion:  () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates:() => ipcRenderer.invoke('check-for-updates'),

  onSwitchTab:    (cb) => ipcRenderer.on('switch-tab',      (_, t) => cb(t)),
  onRaidsData:    (cb) => ipcRenderer.on('raids-data',      (_, d) => cb(d)),
  onUpdateProgress:(cb) => ipcRenderer.on('update-progress', (_, d) => cb(d)),
  onPricesData:   (cb) => ipcRenderer.on('prices-data',     (_, d) => cb(d)),
  onScraperStatus:(cb) => ipcRenderer.on('scraper-status',  (_, d) => cb(d)),
  onScraperLog:   (cb) => ipcRenderer.on('scraper-log',     (_, d) => cb(d)),
  onShowLogs:     (cb) => ipcRenderer.on('show-logs',       ()     => cb()),
})
