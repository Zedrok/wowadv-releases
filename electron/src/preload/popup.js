const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  getRaids:       () => ipcRenderer.invoke('get-raids'),
  getPrices:      () => ipcRenderer.invoke('get-prices'),
  triggerScrape:  () => ipcRenderer.send('refresh-now'),
  openUrl:        (url) => ipcRenderer.send('open-url', url),

  // Raid reminder system
  openScheduledRuns:     () => ipcRenderer.send('open-scheduled-runs'),
  saveBuyerRecord:       (data) => ipcRenderer.invoke('save-buyer-record', data),
  getSavedBuyers:        () => ipcRenderer.invoke('get-saved-buyers'),
  deleteBuyer:           (id) => ipcRenderer.send('delete-buyer', id),
  scheduleAlarm:         (data) => ipcRenderer.invoke('schedule-alarm', data),
  getAlarmPreferences:   () => ipcRenderer.invoke('get-alarm-preferences'),
  saveAlarmPreferences:  (data) => ipcRenderer.send('save-alarm-preferences', data),
  playPreviewSound:      (path) => ipcRenderer.invoke('play-preview-sound', path),

  onRaidsData:      (cb) => ipcRenderer.on('raids-data',      (_e, data) => cb(data)),
  onScraperStatus:  (cb) => ipcRenderer.on('scraper-status',  (_e, data) => cb(data)),
})
