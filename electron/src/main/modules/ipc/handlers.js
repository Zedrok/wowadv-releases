const { ipcMain, shell } = require('electron')
const fs   = require('fs')
const path = require('path')

function registerHandlers(config) {
  const { scraperModule, watcherModule, updaterModule, windows } = config
  const buyersStorage = require('../storage/buyersStorage')
  const preferencesStorage = require('../storage/preferencesStorage')
  const alarmScheduler = require('../alarm/scheduler')

  scraperModule.setWindowsRef(windows)
  alarmScheduler.setMainWindow(windows.main)

  // Scraper control
  ipcMain.on('start-scraper', () => scraperModule.start(config.root, config.dataDir))
  ipcMain.on('stop-scraper', () => scraperModule.stop())
  ipcMain.on('refresh-now', () => {
    try { fs.writeFileSync(config.flagFile, '1') } catch (_) {}
  })
  ipcMain.on('request-data', () => {
    const data = watcherModule.getRaids(config.raidsPath)
    if (windows.main && !windows.main.isDestroyed()) {
      // Ensure data.data is always an array
      const raidData = Array.isArray(data?.data) ? data.data : []
      windows.main.webContents.send('raids-data', {
        ...data,
        data: raidData,
        timestamp: new Date().toLocaleString('es-ES')
      })
    }
  })
  ipcMain.handle('scraper-running', () => scraperModule.isRunning())

  // Data access
  ipcMain.handle('get-raids', () => watcherModule.getRaids(config.raidsPath))
  ipcMain.handle('get-prices', () => watcherModule.getPrices(config.pricesPath))

  // Window management
  ipcMain.on('open-next-runs', () => {
    const nextRunsWin = windows.openNextRuns()
    if (nextRunsWin) {
      watcherModule.setNextRunsWindow(nextRunsWin)
      console.log('[IPC] Updated watcher reference to nextRuns window')
    }
  })
  ipcMain.on('open-prices', () => {
    windows.openPrices()
    scraperModule.setWindowsRef(windows)
  })
  ipcMain.on('refresh-prices', () => {
    try { fs.writeFileSync(path.join(config.dataDir, 'refresh_prices.flag'), '1') } catch (_) {}
  })
  ipcMain.on('open-url', (_, url) => {
    if (!url || !url.startsWith('http')) return
    console.log('[IPC] Opening URL in default browser:', url)
    shell.openExternal(url)
  })

  // Favorites
  const FAV_LISTS_FILE = require('path').join(config.dataDir, 'fav_lists.json')
  ipcMain.handle('get-fav-lists', () => {
    try { return JSON.parse(fs.readFileSync(FAV_LISTS_FILE, 'utf8')) } catch (_) { return [] }
  })
  ipcMain.on('save-fav-lists', (_, lists) => {
    try { fs.writeFileSync(FAV_LISTS_FILE, JSON.stringify(lists)) } catch (_) {}
  })

  // Updates & Changelog
  ipcMain.handle('get-app-version', () => require('electron').app.getVersion())
  ipcMain.handle('check-for-updates', () => updaterModule.checkAndShowUpdate(false))
  ipcMain.handle('get-last-seen-changelog-version', () => preferencesStorage.getLastSeenChangelogVersion())
  ipcMain.handle('update-last-seen-changelog-version', (_, version) => preferencesStorage.updateLastSeenChangelogVersion(version))
  ipcMain.handle('get-changelog', () => require('../updater/changelog'))

  // Buyer & Alarm System
  ipcMain.handle('save-buyer-record', (_, data) => {
    const { nickRealm, battleTag, monto } = data
    if (!nickRealm || !monto) return null
    const buyer = buyersStorage.addBuyer(nickRealm, battleTag, monto)
    buyersStorage.updateLastUsed(buyer.id)
    return buyer
  })

  ipcMain.handle('get-saved-buyers', () => {
    return buyersStorage.getBuyers()
  })

  ipcMain.handle('get-buyer-by-id', (_, buyerId) => {
    return buyersStorage.getBuyerById(buyerId)
  })

  ipcMain.on('delete-buyer', (_, buyerId) => {
    buyersStorage.deleteBuyer(buyerId)
  })

  ipcMain.handle('schedule-alarm', (_, data) => {
    const { raidTime, alertTime, sound, minutesBefore, buyerId, raidInfo, buyerInfo } = data
    const alarm = alarmScheduler.addAlarm(raidTime, alertTime, sound, minutesBefore, buyerId, raidInfo, buyerInfo)
    // Notify scheduled runs window if open
    if (windows.scheduledRuns && !windows.scheduledRuns.isDestroyed()) {
      windows.scheduledRuns.webContents.send('alarm-scheduled', alarm)
    }
    return alarm
  })

  ipcMain.on('delete-alarm', (_, alarmId) => {
    alarmScheduler.deleteAlarm(alarmId)
    // Notify scheduled runs window if open
    if (windows.scheduledRuns && !windows.scheduledRuns.isDestroyed()) {
      windows.scheduledRuns.webContents.send('alarm-deleted', alarmId)
    }
  })

  ipcMain.on('mark-alarm-contacted', (_, alarmId) => {
    preferencesStorage.updateAlarmContacted(alarmId, true)
    // Notify scheduled runs window if open
    if (windows.scheduledRuns && !windows.scheduledRuns.isDestroyed()) {
      windows.scheduledRuns.webContents.send('alarm-contacted', alarmId)
    }
  })

  ipcMain.on('open-run-url', (_, url) => {
    if (url && url.startsWith('http')) {
      shell.openExternal(url)
    }
  })

  ipcMain.handle('get-alarm-preferences', () => {
    return preferencesStorage.getPreferences()
  })

  ipcMain.handle('get-scheduled-alarms', () => {
    const prefs = preferencesStorage.getPreferences()
    return prefs.alarms || []
  })

  ipcMain.on('save-alarm-preferences', (_, prefs) => {
    preferencesStorage.updatePreferenceSettings(prefs)
    alarmScheduler.updatePreferences()
    // Notify scheduled runs window if open
    if (windows.scheduledRuns && !windows.scheduledRuns.isDestroyed()) {
      windows.scheduledRuns.webContents.send('preferences-updated', prefs)
    }
  })

  ipcMain.handle('play-preview-sound', (_, filePath) => {
    // Resolve relative paths from electron directory
    let resolvedPath = filePath
    if (filePath.startsWith('../')) {
      const cleanPath = filePath.replace(/^\.\.\//, '')
      resolvedPath = path.join(__dirname, '../../../', cleanPath)
    }
    console.log(`[IPC] Playing preview sound: ${filePath} → ${resolvedPath}`)
    // Send to renderer to play via Web Audio API
    if (windows.main && !windows.main.isDestroyed()) {
      windows.main.webContents.send('play-audio', resolvedPath)
    }
    return true
  })

  ipcMain.on('open-scheduled-runs', () => {
    windows.openScheduledRuns()
    if (windows.scheduledRuns && !windows.scheduledRuns.isDestroyed()) {
      alarmScheduler.setScheduledRunsWindow(windows.scheduledRuns)
    }
  })
}

module.exports = {
  registerHandlers
}
