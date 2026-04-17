const { BrowserWindow, app } = require('electron')
const path = require('path')

let main = null
let nextRuns = null
let prices = null

function createMain(isDev, rendererUrl) {
  const appPath = app.getAppPath()
  const preloadPath = isDev ? path.join(appPath, 'out/preload/index.js') : path.join(appPath, 'preload/index.js')

  main = new BrowserWindow({
    width:     1440,
    height:    780,
    minWidth:  1100,
    minHeight: 500,
    backgroundColor: '#0d0d14',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color:       'rgba(13, 13, 20, 0)',
      symbolColor: '#c8a84b',
      height: 40,
    },
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
    },
  })

  if (isDev && rendererUrl) {
    main.loadURL(rendererUrl)
    main.webContents.openDevTools({ mode: 'detach' })
  } else {
    const htmlPath = path.join(appPath, 'renderer/index.html')
    main.loadFile(htmlPath)
  }

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

  nextRuns = new BrowserWindow({
    width:     380,
    height:    460,
    minWidth:  272,
    minHeight: 300,
    backgroundColor: '#0d0d14',
    title: 'Próximos Runs',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
    },
  })
  nextRuns.setMenuBarVisibility(false)

  if (isDev && rendererUrl) {
    nextRuns.loadURL(rendererUrl + '/popup.html')
    nextRuns.webContents.openDevTools({ mode: 'detach' })
  } else {
    nextRuns.loadFile(path.join(appPath, 'renderer/popup.html'))
  }

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

  prices = new BrowserWindow({
    width:     680,
    height:    600,
    minWidth:  400,
    minHeight: 300,
    backgroundColor: '#0d0d14',
    title: 'Lista de Precios',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
    },
  })
  prices.setMenuBarVisibility(false)

  if (isDev && rendererUrl) {
    prices.loadURL(rendererUrl + '/prices.html')
    prices.webContents.openDevTools({ mode: 'detach' })
  } else {
    prices.loadFile(path.join(appPath, 'renderer/prices.html'))
  }

  prices.on('closed', () => { prices = null })
  return prices
}

function closeAll() {
  if (main && !main.isDestroyed()) main.close()
}

const windows = {
  get main() { return main },
  get nextRuns() { return nextRuns },
  get prices() { return prices },
  openNextRuns: () => createNextRuns(false, ''),
  openPrices: () => createPrices(false, ''),
}

module.exports = {
  createMain,
  createNextRuns,
  createPrices,
  closeAll,
  windows
}
