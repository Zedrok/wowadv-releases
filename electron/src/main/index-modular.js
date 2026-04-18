const { app } = require('electron')
const path = require('path')
const fs = require('fs')

// Set application name for Task Manager and system
app.name = 'Bakers Raid Monitor'

// Setup logging to file
const DATA_DIR_EARLY = app.getPath('userData')
const LOG_PATH = path.join(DATA_DIR_EARLY, 'app-debug.log')

function writeLog(message) {
  try {
    fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${message}\n`)
    console.log(message)
  } catch (e) {
    console.error('Failed to write log:', e)
  }
}

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  writeLog('UNCAUGHT EXCEPTION: ' + error.message + '\n' + error.stack)
})

writeLog('=== Electron App Started ===')

// Module imports
const WindowsManager = require('./modules/windows/manager.js')
const scraperModule = require('./modules/scraper/scraper.js')
const watcherModule = require('./modules/watcher/watcher.js')
const updaterModule = require('./modules/updater/updater.js')
const alarmScheduler = require('./modules/alarm/scheduler.js')
const { registerHandlers } = require('./modules/ipc/handlers.js')
const { createTray } = require('./modules/tray/tray.js')

const IS_DEV = process.env.NODE_ENV === 'development'
let ROOT
let PYTHON_SCRIPT

if (IS_DEV) {
  ROOT = path.join(app.getAppPath(), '..')
  PYTHON_SCRIPT = path.join(ROOT, 'bakers_raids.py')
} else {
  // In production, resources are in app/resources or app/out/resources
  const appPath = app.getAppPath()

  // ROOT is the directory containing the app (for accessing bakers_raids.py)
  ROOT = path.join(appPath, '..')

  // Try multiple possible locations
  const possiblePaths = [
    path.join(ROOT, 'bakers_raids.py'),
    path.join(appPath, 'resources', 'bakers_raids.py'),
    path.join(appPath, 'out', 'resources', 'bakers_raids.py'),
  ]

  PYTHON_SCRIPT = possiblePaths[0] // Default to first option

  // Log all paths for debugging
  writeLog('Looking for bakers_raids.py in production mode')
  writeLog('app.getAppPath(): ' + appPath)
  writeLog('ROOT: ' + ROOT)
  possiblePaths.forEach((p, i) => {
    const exists = fs.existsSync(p)
    writeLog(`Path ${i}: ${p} - exists: ${exists}`)
    if (exists) {
      PYTHON_SCRIPT = p
      writeLog('FOUND at path ' + i)
    }
  })
}

const DATA_DIR = app.getPath('userData')
const RAIDS_JSON = path.join(DATA_DIR, 'raids.json')
const PRICES_JSON = path.join(DATA_DIR, 'prices.json')
const FLAG_FILE = path.join(DATA_DIR, 'refresh.flag')
const OPEN_URL_FLAG = path.join(DATA_DIR, 'open_url.flag')
const REFRESH_PRICES_FLAG = path.join(DATA_DIR, 'refresh_prices.flag')

writeLog('Paths initialized. IS_DEV=' + IS_DEV)
writeLog('ROOT: ' + ROOT)
writeLog('PYTHON_SCRIPT: ' + PYTHON_SCRIPT)
writeLog('DATA_DIR: ' + DATA_DIR)

// ─── App Lifecycle ──────────────────────────────────────────────────────────
app.whenReady().then(() => {
  writeLog('app.whenReady() triggered')

  try {
    // Check for pending update before creating window
    if (updaterModule.applyPendingUpdate()) {
      writeLog('Pending update detected, quitting')
      app.quit()
      return
    }

    writeLog('Creating main window...')

    // Setup modules
    scraperModule.setMainWindow(null) // Will be set after window creation
    watcherModule.setMainWindow(null)
    updaterModule.setMainWindow(null)

    // Setup windows manager for IPC
    const winConfig = {
      main: null, // Will be set below
      openNextRuns: () => WindowsManager.createNextRuns(IS_DEV, process.env['ELECTRON_RENDERER_URL']),
      openPrices: () => WindowsManager.createPrices(IS_DEV, process.env['ELECTRON_RENDERER_URL']),
      openScheduledRuns: () => WindowsManager.createScheduledRuns(IS_DEV, process.env['ELECTRON_RENDERER_URL']),
    }

    // Register all IPC handlers BEFORE creating window so they're ready immediately
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

    // Create main window AFTER handlers are registered
    const mainWin = WindowsManager.createMain(
      IS_DEV,
      IS_DEV ? process.env['ELECTRON_RENDERER_URL'] : null
    )
    writeLog('Main window created')
    writeLog('ROOT (for scraper): ' + ROOT)
    writeLog('PYTHON_SCRIPT: ' + PYTHON_SCRIPT)

    // Now update module references with actual window
    scraperModule.setMainWindow(mainWin)
    watcherModule.setMainWindow(mainWin)
    updaterModule.setMainWindow(mainWin)
    alarmScheduler.setMainWindow(mainWin)
    winConfig.main = mainWin

  // Setup tray icon (after IPC handlers registered)
  try {
    createTray(winConfig)
  } catch (e) {
    console.error('[Tray] Error:', e)
  }

  // Start watchers
  watcherModule.watchRaids(RAIDS_JSON)
  watcherModule.watchPrices(PRICES_JSON)

  // Auto-start scraper (with login if needed) - in background, no window visible
  scraperModule.autoStart(ROOT, DATA_DIR)

  // Initialize alarm scheduler
  alarmScheduler.cleanup()
  alarmScheduler.start()
  console.log('[Scheduler] Alarm scheduler initialized')

  // Auto-check for updates (silent, 3s after start)
  setTimeout(() => updaterModule.checkAndShowUpdate(true), 3000)

    // Cleanup on window close (but don't stop scraper here - it will be stopped in before-quit)
    mainWin.on('closed', () => {
      watcherModule.stopWatchers()
      writeLog('Main window closed')
    })

    writeLog('App fully initialized')
  } catch (error) {
    writeLog('ERROR in app.whenReady(): ' + error.message + '\n' + error.stack)
    throw error
  }
})

app.on('before-quit', () => {
  writeLog('App before-quit event - stopping scraper with timeout...')

  // Stop scraper with 5 second timeout
  const stopPromise = new Promise((resolve) => {
    const timeout = setTimeout(() => {
      writeLog('Scraper stop timeout - forcing quit anyway')
      resolve()
    }, 5000)

    try {
      scraperModule.stop()
      clearTimeout(timeout)
      resolve()
    } catch (e) {
      writeLog('Error stopping scraper: ' + e.message)
      clearTimeout(timeout)
      resolve()
    }
  })

  stopPromise.then(() => {
    writeLog('Scraper stopped, proceeding with quit')
  })
})

app.on('window-all-closed', () => {
  writeLog('All windows closed, calling app.quit()')
  app.quit()
})

app.on('quit', () => {
  writeLog('App quitting')
})
