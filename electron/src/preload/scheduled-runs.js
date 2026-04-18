const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  getScheduledAlarms: () => ipcRenderer.invoke('get-scheduled-alarms'),
  getAlarmPreferences: () => ipcRenderer.invoke('get-alarm-preferences'),
  getBuyerById: (id) => ipcRenderer.invoke('get-buyer-by-id', id),
  saveAlarmPreferences: (data) => ipcRenderer.send('save-alarm-preferences', data),
  deleteAlarm: (id) => ipcRenderer.send('delete-alarm', id),
  markAlarmContacted: (id) => ipcRenderer.send('mark-alarm-contacted', id),
  openUrl: (url) => ipcRenderer.send('open-url', url),

  // Event listeners
  onAlarmTriggered: (callback) => ipcRenderer.on('alarm-triggered', (_, id) => callback(id)),
  onAlarmScheduled: (callback) => ipcRenderer.on('alarm-scheduled', (_, alarm) => callback(alarm)),
  onAlarmDeleted: (callback) => ipcRenderer.on('alarm-deleted', (_, id) => callback(id)),
  onAlarmContacted: (callback) => ipcRenderer.on('alarm-contacted', (_, id) => callback(id)),
  onPreferencesUpdated: (callback) => ipcRenderer.on('preferences-updated', (_, prefs) => callback(prefs)),
  onReloadAlarms: (callback) => ipcRenderer.on('reload-alarms', () => callback()),
})
