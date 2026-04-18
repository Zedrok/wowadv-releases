const { BrowserWindow, app } = require('electron')
const path = require('path')
const fs = require('fs')

let main = null
let nextRuns = null
let prices = null
let scheduledRuns = null
let isQuitting = false

const userData = app.getPath('userData')

app.on('before-quit', () => {
  isQuitting = true
})

function getSavedSize(name) {
  try {
    const file = path.join(userData, `${name}-bounds.json`)
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    return { width: data.width, height: data.height }
  } catch {
    return null
  }
}

function saveBounds(win, name) {
  try {
    const bounds = win.getBounds()
    const file = path.join(userData, `${name}-bounds.json`)
    fs.writeFileSync(file, JSON.stringify({ width: bounds.width, height: bounds.height }))
  } catch (e) {
    console.error(`[Windows] Error saving ${name} bounds:`, e.message)
  }
}

function createMain(isDev, rendererUrl) {
  const appPath = app.getAppPath()
  const preloadPath = isDev ? path.join(appPath, 'out/preload/index.js') : path.join(appPath, 'preload/index.js')
  const iconPath = path.join(appPath, 'assets', 'favicon.ico')

  const savedSize = getSavedSize('main')
  const config = {
    width:     savedSize?.width || 1440,
    height:    savedSize?.height || 780,
    minWidth:  1100,
    minHeight: 500,
    backgroundColor: '#0d0d14',
    titleBarStyle: 'hidden',
    icon:      iconPath,
    titleBarOverlay: {
      color:       'rgba(13, 13, 20, 0)',
      symbolColor: '#c8a84b',
      height: 40,
    },
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
    },
  }

  main = new BrowserWindow(config)

  if (isDev && rendererUrl) {
    main.loadURL(rendererUrl)
    main.webContents.openDevTools({ mode: 'detach' })
  } else {
    const htmlPath = path.join(appPath, 'renderer/index.html')
    main.loadFile(htmlPath)
  }

  // Minimize to tray instead of closing (unless app is quitting)
  main.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      main.hide()
    } else {
      // Save size before closing
      saveBounds(main, 'main')
    }
  })

  main.on('closed', () => { main = null })
  return main
}

function createNextRuns(isDev, rendererUrl) {
  if (nextRuns && !nextRuns.isDestroyed()) {
    if (nextRuns.isMinimized()) nextRuns.restore()
    nextRuns.show()
    nextRuns.focus()
    return nextRuns
  }

  const appPath = app.getAppPath()
  const preloadPath = isDev ? path.join(appPath, 'out/preload/popup.js') : path.join(appPath, 'preload/popup.js')
  const iconPath = path.join(appPath, 'assets', 'favicon.ico')

  const savedSize = getSavedSize('nextRuns')
  const config = {
    width:     savedSize?.width || 380,
    height:    savedSize?.height || 460,
    minWidth:  272,
    minHeight: 300,
    backgroundColor: '#0d0d14',
    icon:      iconPath,
    title: 'Próximos Runs',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
    },
  }

  nextRuns = new BrowserWindow(config)
  nextRuns.setMenuBarVisibility(false)

  if (isDev && rendererUrl) {
    nextRuns.loadURL(rendererUrl + '/popup.html')
    nextRuns.webContents.openDevTools({ mode: 'detach' })
  } else {
    nextRuns.loadFile(path.join(appPath, 'renderer/popup.html'))
  }

  // Save size on close
  nextRuns.on('close', () => saveBounds(nextRuns, 'nextRuns'))
  nextRuns.on('closed', () => { nextRuns = null })
  return nextRuns
}

function createPrices(isDev, rendererUrl) {
  if (prices && !prices.isDestroyed()) {
    prices.focus()
    return prices
  }

  const appPath = app.getAppPath()
  const preloadPath = isDev ? path.join(appPath, 'out/preload/prices.js') : path.join(appPath, 'preload/prices.js')
  const iconPath = path.join(appPath, 'assets', 'favicon.ico')

  const savedSize = getSavedSize('prices')
  const config = {
    width:     savedSize?.width || 680,
    height:    savedSize?.height || 600,
    minWidth:  400,
    minHeight: 300,
    backgroundColor: '#0d0d14',
    icon:      iconPath,
    title: 'Lista de Precios',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
    },
  }

  prices = new BrowserWindow(config)
  prices.setMenuBarVisibility(false)

  if (isDev && rendererUrl) {
    prices.loadURL(rendererUrl + '/prices.html')
    prices.webContents.openDevTools({ mode: 'detach' })
  } else {
    prices.loadFile(path.join(appPath, 'renderer/prices.html'))
  }

  // Save size on close
  prices.on('close', () => saveBounds(prices, 'prices'))
  prices.on('closed', () => { prices = null })
  return prices
}

function createScheduledRuns(isDev, rendererUrl) {
  if (scheduledRuns && !scheduledRuns.isDestroyed()) {
    if (scheduledRuns.isMinimized()) scheduledRuns.restore()
    scheduledRuns.show()
    scheduledRuns.focus()
    return scheduledRuns
  }

  const appPath = app.getAppPath()
  const preloadPath = isDev ? path.join(appPath, 'out/preload/scheduled-runs.js') : path.join(appPath, 'preload/scheduled-runs.js')
  const iconPath = path.join(appPath, 'assets', 'favicon.ico')

  const savedSize = getSavedSize('scheduledRuns')
  const config = {
    width:     savedSize?.width || 500,
    height:    savedSize?.height || 600,
    minWidth:  400,
    minHeight: 400,
    backgroundColor: '#0d0d14',
    icon:      iconPath,
    title: 'Runs Agendados',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
    },
  }

  scheduledRuns = new BrowserWindow(config)
  scheduledRuns.setMenuBarVisibility(false)

  if (isDev && rendererUrl) {
    scheduledRuns.loadURL(rendererUrl + '/scheduled-runs.html')
    scheduledRuns.webContents.openDevTools({ mode: 'detach' })
  } else {
    scheduledRuns.loadFile(path.join(appPath, 'renderer/scheduled-runs.html'))
  }

  // Reload data when window is shown/focused
  scheduledRuns.on('show', () => {
    scheduledRuns.webContents.send('reload-alarms')
  })

  // Save size on close
  scheduledRuns.on('close', () => saveBounds(scheduledRuns, 'scheduledRuns'))
  scheduledRuns.on('closed', () => { scheduledRuns = null })
  return scheduledRuns
}

function closeAll() {
  if (main && !main.isDestroyed()) main.close()
}

const windows = {
  get main() { return main },
  get nextRuns() { return nextRuns },
  get prices() { return prices },
  get scheduledRuns() { return scheduledRuns },
  openNextRuns: () => createNextRuns(false, ''),
  openPrices: () => createPrices(false, ''),
  openScheduledRuns: () => createScheduledRuns(false, ''),
}

module.exports = {
  createMain,
  createNextRuns,
  createPrices,
  createScheduledRuns,
  closeAll,
  windows
}
