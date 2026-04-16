const { BrowserWindow } = require('electron')
const path = require('path')

let main = null
let nextRuns = null
let prices = null

export function createMain(isDev, rendererUrl) {
  main = new BrowserWindow({
    width:     1440,
    height:    780,
    minWidth:  1100,
    minHeight: 500,
    backgroundColor: '#0d0d14',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color:       '#0d0d14',
      symbolColor: '#c8a84b',
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, '../../preload/index.js'),
      contextIsolation: true,
    },
  })

  if (isDev && rendererUrl) {
    main.loadURL(rendererUrl)
    main.webContents.openDevTools({ mode: 'detach' })
  } else {
    main.loadFile(path.join(__dirname, '../../renderer/index.html'))
  }

  main.on('closed', () => { main = null })
  return main
}

export function createNextRuns(isDev, rendererUrl) {
  if (nextRuns && !nextRuns.isDestroyed()) {
    if (nextRuns.isMinimized()) nextRuns.restore()
    nextRuns.show()
    nextRuns.focus()
    return nextRuns
  }

  nextRuns = new BrowserWindow({
    width:     380,
    height:    460,
    minWidth:  272,
    minHeight: 300,
    backgroundColor: '#0d0d14',
    title: 'Próximos Runs',
    webPreferences: {
      preload: path.join(__dirname, '../../preload/popup.js'),
      contextIsolation: true,
    },
  })
  nextRuns.setMenuBarVisibility(false)

  if (isDev && rendererUrl) {
    nextRuns.loadURL(rendererUrl + '/popup.html')
    nextRuns.webContents.openDevTools({ mode: 'detach' })
  } else {
    nextRuns.loadFile(path.join(__dirname, '../../renderer/popup.html'))
  }

  nextRuns.on('closed', () => { nextRuns = null })
  return nextRuns
}

export function createPrices(isDev, rendererUrl) {
  if (prices && !prices.isDestroyed()) {
    prices.focus()
    return prices
  }

  prices = new BrowserWindow({
    width:     680,
    height:    600,
    minWidth:  400,
    minHeight: 300,
    backgroundColor: '#0d0d14',
    title: 'Lista de Precios',
    webPreferences: {
      preload: path.join(__dirname, '../../preload/prices.js'),
      contextIsolation: true,
    },
  })
  prices.setMenuBarVisibility(false)

  if (isDev && rendererUrl) {
    prices.loadURL(rendererUrl + '/prices.html')
    prices.webContents.openDevTools({ mode: 'detach' })
  } else {
    prices.loadFile(path.join(__dirname, '../../renderer/prices.html'))
  }

  prices.on('closed', () => { prices = null })
  return prices
}

export function closeAll() {
  if (main && !main.isDestroyed()) main.close()
}

export const windows = {
  get main() { return main },
  get nextRuns() { return nextRuns },
  get prices() { return prices },
  openNextRuns: () => createNextRuns(false, ''),
  openPrices: () => createPrices(false, ''),
}
