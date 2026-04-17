const { app } = require('electron')
const path = require('path')

// Module imports
const WindowsManager = require('./modules/windows/manager.js')
const scraperModule = require('./modules/scraper/scraper.js')
const watcherModule = require('./modules/watcher/watcher.js')
const updaterModule = require('./modules/updater/updater.js')
const { registerHandlers } = require('./modules/ipc/handlers.js')
const { createTray } = require('./modules/tray/tray.js')

const IS_DEV = process.env.NODE_ENV === 'development'
const ROOT = path.join(app.getAppPath(), '..')
const DATA_DIR = app.getPath('userData')
const RAIDS_JSON = path.join(DATA_DIR, 'raids.json')
const PRICES_JSON = path.join(DATA_DIR, 'prices.json')
const FLAG_FILE = path.join(DATA_DIR, 'refresh.flag')
const OPEN_URL_FLAG = path.join(DATA_DIR, 'open_url.flag')
const REFRESH_PRICES_FLAG = path.join(DATA_DIR, 'refresh_prices.flag')
const PYTHON_SCRIPT = path.join(ROOT, 'bakers_raids.py')

// ─── App Lifecycle ──────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Check for pending update before creating window
  if (updaterModule.applyPendingUpdate()) {
    app.quit()
    return
  }

  // Create main window
  const mainWin = WindowsManager.createMain(
    IS_DEV,
    IS_DEV ? process.env['ELECTRON_RENDERER_URL'] : null
  )

  // Setup modules
  scraperModule.setMainWindow(mainWin)
  watcherModule.setMainWindow(mainWin)
  updaterModule.setMainWindow(mainWin)

  // Setup windows manager for IPC
  const winConfig = {
    main: mainWin,
    openNextRuns: () => WindowsManager.createNextRuns(IS_DEV, process.env['ELECTRON_RENDERER_URL']),
    openPrices: () => WindowsManager.createPrices(IS_DEV, process.env['ELECTRON_RENDERER_URL']),
  }
  watcherModule.setNextRunsWindow(() => winConfig.main)

  // Setup tray icon
  createTray(winConfig)

  // Register all IPC handlers
  registerHandlers({
    scraperModule,
    watcherModule,
    updaterModule,
    windows: winConfig,
    root: ROOT,
    dataDir: DATA_DIR,
    flagFile: FLAG_FILE,
    openUrlFlag: OPEN_URL_FLAG,
    raidsPath: RAIDS_JSON,
    pricesPath: PRICES_JSON,
  })

  // Start watchers
  watcherModule.watchRaids(RAIDS_JSON)
  watcherModule.watchPrices(PRICES_JSON)

  // Auto-start scraper (with login if needed) - in background, no window visible
  scraperModule.autoStart(ROOT, DATA_DIR)

  // Auto-check for updates (silent, 3s after start)
  setTimeout(() => updaterModule.checkAndShowUpdate(true), 3000)

  // Cleanup on exit
  mainWin.on('closed', () => {
    scraperModule.stop()
    watcherModule.stopWatchers()
  })
})

app.on('window-all-closed', () => {
  scraperModule.stop()
  app.quit()
})
