const { ipcMain, shell } = require('electron')
const fs   = require('fs')
const path = require('path')

function registerHandlers(config) {
  const { scraperModule, watcherModule, updaterModule, windows } = config

  scraperModule.setWindowsRef(windows)

  // Scraper control
  ipcMain.on('start-scraper', () => scraperModule.start(config.root, config.dataDir))
  ipcMain.on('stop-scraper', () => scraperModule.stop())
  ipcMain.on('refresh-now', () => {
    try { fs.writeFileSync(config.flagFile, '1') } catch (_) {}
  })
  ipcMain.on('request-data', () => {
    const data = watcherModule.getRaids(config.raidsPath)
    if (windows.main && !windows.main.isDestroyed()) {
      windows.main.webContents.send('raids-data', {
        ...data,
        timestamp: new Date().toLocaleString('es-ES')
      })
    }
  })
  ipcMain.handle('scraper-running', () => scraperModule.isRunning())

  // Data access
  ipcMain.handle('get-raids', () => watcherModule.getRaids(config.raidsPath))
  ipcMain.handle('get-prices', () => watcherModule.getPrices(config.pricesPath))

  // Window management
  ipcMain.on('open-next-runs', () => windows.openNextRuns())
  ipcMain.on('open-prices', () => {
    windows.openPrices()
    scraperModule.setWindowsRef(windows)
  })
  ipcMain.on('refresh-prices', () => {
    try { fs.writeFileSync(path.join(config.dataDir, 'refresh_prices.flag'), '1') } catch (_) {}
  })
  ipcMain.on('open-url', (_, url) => {
    if (!url || !url.startsWith('http')) return
    if (scraperModule.isRunning()) {
      try { fs.writeFileSync(config.openUrlFlag, url) } catch (_) {}
    } else {
      shell.openExternal(url)
    }
  })

  // Favorites
  const FAV_LISTS_FILE = require('path').join(config.dataDir, 'fav_lists.json')
  ipcMain.handle('get-fav-lists', () => {
    try { return JSON.parse(fs.readFileSync(FAV_LISTS_FILE, 'utf8')) } catch (_) { return [] }
  })
  ipcMain.on('save-fav-lists', (_, lists) => {
    try { fs.writeFileSync(FAV_LISTS_FILE, JSON.stringify(lists)) } catch (_) {}
  })

  // Updates
  ipcMain.handle('get-app-version', () => require('electron').app.getVersion())
  ipcMain.handle('check-for-updates', () => updaterModule.checkAndShowUpdate(false))
}

module.exports = {
  registerHandlers
}
