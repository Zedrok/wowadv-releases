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
  openScheduledRuns: () => ipcRenderer.send('open-scheduled-runs'),
  openUrl:        (url) => ipcRenderer.send('open-url', url),

  saveBuyerRecord: (data) => ipcRenderer.invoke('save-buyer-record', data),
  getSavedBuyers:  () => ipcRenderer.invoke('get-saved-buyers'),
  deleteBuyer:     (id) => ipcRenderer.send('delete-buyer', id),
  scheduleAlarm:   (data) => ipcRenderer.invoke('schedule-alarm', data),
  getAlarmPreferences: () => ipcRenderer.invoke('get-alarm-preferences'),
  saveAlarmPreferences: (data) => ipcRenderer.send('save-alarm-preferences', data),
  playPreviewSound: (path) => ipcRenderer.invoke('play-preview-sound', path),

  getFavLists:    () => ipcRenderer.invoke('get-fav-lists'),
  saveFavLists:   (lists) => ipcRenderer.send('save-fav-lists', lists),

  getAppVersion:  () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates:() => ipcRenderer.invoke('check-for-updates'),
  getLastSeenChangelogVersion: () => ipcRenderer.invoke('get-last-seen-changelog-version'),
  updateLastSeenChangelogVersion: (v) => ipcRenderer.invoke('update-last-seen-changelog-version', v),
  getChangelog:   (sinceVersion) => ipcRenderer.invoke('get-changelog', sinceVersion),

  onSwitchTab:    (cb) => ipcRenderer.on('switch-tab',      (_, t) => cb(t)),
  onRaidsData:    (cb) => ipcRenderer.on('raids-data',      (_, d) => cb(d)),
  onUpdateProgress:(cb) => ipcRenderer.on('update-progress', (_, d) => cb(d)),
  onPricesData:   (cb) => ipcRenderer.on('prices-data',     (_, d) => cb(d)),
  onScraperStatus:(cb) => ipcRenderer.on('scraper-status',  (_, d) => cb(d)),
  onScraperLog:   (cb) => ipcRenderer.on('scraper-log',     (_, d) => cb(d)),
  onShowLogs:     (cb) => ipcRenderer.on('show-logs',       ()     => cb()),
  onPlayAudio:    (cb) => ipcRenderer.on('play-audio',      (_, p) => cb(p)),
})
