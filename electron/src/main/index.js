const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path  = require('path')
const fs    = require('fs')
const { spawn, execFileSync } = require('child_process')

const IS_DEV = process.env.NODE_ENV === 'development'

// ROOT apunta a wow-advertising/ (parent del directorio electron/)
const ROOT          = path.join(app.getAppPath(), '..')
const DATA_DIR      = app.getPath('userData')
const RAIDS_JSON          = path.join(DATA_DIR, 'raids.json')
const PRICES_JSON         = path.join(DATA_DIR, 'prices.json')
const FLAG_FILE           = path.join(DATA_DIR, 'refresh.flag')
const OPEN_URL_FLAG       = path.join(DATA_DIR, 'open_url.flag')
const REFRESH_PRICES_FLAG = path.join(DATA_DIR, 'refresh_prices.flag')
const PYTHON_SCRIPT = path.join(ROOT, 'bakers_raids.py')

let win         = null
let scraper     = null
let watcher     = null
let pricesWatcher = null
let nextRunsWin = null
let pricesWin   = null

// ---------------------------------------------------------------------------
// Next Runs window
// ---------------------------------------------------------------------------
function openNextRunsWindow() {
  if (nextRunsWin && !nextRunsWin.isDestroyed()) {
    if (nextRunsWin.isMinimized()) nextRunsWin.restore()
    nextRunsWin.show()
    nextRunsWin.focus()
    return
  }
  nextRunsWin = new BrowserWindow({
    width:     380,
    height:    460,
    minWidth:  272,
    minHeight: 300,
    backgroundColor: '#0d0d14',
    title: 'Próximos Runs',
    webPreferences: {
      preload: path.join(__dirname, '../preload/popup.js'),
      contextIsolation: true,
    },
  })
  nextRunsWin.setMenuBarVisibility(false)

  if (IS_DEV && process.env['ELECTRON_RENDERER_URL']) {
    nextRunsWin.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/popup.html')
    nextRunsWin.webContents.openDevTools({ mode: 'detach' })
  } else {
    nextRunsWin.loadFile(path.join(__dirname, '../renderer/popup.html'))
  }

  nextRunsWin.on('closed', () => { nextRunsWin = null })
}

// ---------------------------------------------------------------------------
// Prices window
// ---------------------------------------------------------------------------
function openPricesWindow() {
  if (pricesWin && !pricesWin.isDestroyed()) {
    pricesWin.focus()
    return
  }
  pricesWin = new BrowserWindow({
    width:     680,
    height:    600,
    minWidth:  400,
    minHeight: 300,
    backgroundColor: '#0d0d14',
    title: 'Lista de Precios',
    webPreferences: {
      preload: path.join(__dirname, '../preload/prices.js'),
      contextIsolation: true,
    },
  })
  pricesWin.setMenuBarVisibility(false)

  if (IS_DEV && process.env['ELECTRON_RENDERER_URL']) {
    pricesWin.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/prices.html')
    pricesWin.webContents.openDevTools({ mode: 'detach' })
  } else {
    pricesWin.loadFile(path.join(__dirname, '../renderer/prices.html'))
  }

  pricesWin.on('closed', () => { pricesWin = null })
}

// ---------------------------------------------------------------------------
// Detectar Python
// ---------------------------------------------------------------------------
function findPython() {
  for (const cmd of ['py', 'python', 'python3']) {
    try {
      execFileSync(cmd, ['--version'], { timeout: 3000, stdio: 'pipe' })
      return cmd
    } catch (_) {}
  }
  return null
}

// ---------------------------------------------------------------------------
// Ventana principal
// ---------------------------------------------------------------------------
function createWindow() {
  win = new BrowserWindow({
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
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
    },
  })

  if (IS_DEV && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  win.on('closed', () => {
    stopScraper()
    if (watcher) clearInterval(watcher)
    if (pricesWatcher) clearInterval(pricesWatcher)
    win = null
  })
}

// ---------------------------------------------------------------------------
// Instalar dependencias Python si faltan
// ---------------------------------------------------------------------------
const REQUIRED_PYTHON_PACKAGES = ['playwright', 'pywin32', 'pycryptodome', 'browser-cookie3']

function ensurePythonDeps(pythonCmd, callback) {
  // Verificar qué paquetes faltan
  const checkScript = `
import importlib, sys
missing = []
checks = {'playwright': 'playwright', 'pywin32': 'win32api', 'pycryptodome': 'Crypto', 'browser-cookie3': 'browsercookie'}
for pkg, mod in checks.items():
    try: importlib.import_module(mod)
    except ImportError: missing.append(pkg)
print(','.join(missing))
`
  let missing = ''
  const check = spawn(pythonCmd, ['-c', checkScript], { stdio: ['ignore', 'pipe', 'pipe'] })
  check.stdout.on('data', d => { missing += d.toString().trim() })
  check.on('exit', () => {
    const pkgs = missing.split(',').filter(Boolean)
    if (pkgs.length === 0) { callback(); return }

    sendToRenderer('scraper-log', `[INFO] Instalando dependencias: ${pkgs.join(', ')}\n`)
    const install = spawn(pythonCmd, ['-m', 'pip', 'install', ...pkgs], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    install.stdout.on('data', d => sendToRenderer('scraper-log', d.toString()))
    install.stderr.on('data', d => sendToRenderer('scraper-log', d.toString()))
    install.on('exit', code => {
      if (code !== 0) {
        sendToRenderer('scraper-log', '[ERROR] Falló la instalación de dependencias.\n')
        sendToRenderer('scraper-status', { running: false, code })
        sendToRenderer('show-logs', null)
        return
      }
      // Instalar browsers de playwright
      sendToRenderer('scraper-log', '[INFO] Instalando playwright msedge...\n')
      const playwrightInstall = spawn(pythonCmd, ['-m', 'playwright', 'install', 'msedge'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      playwrightInstall.stdout.on('data', d => sendToRenderer('scraper-log', d.toString()))
      playwrightInstall.stderr.on('data', d => sendToRenderer('scraper-log', d.toString()))
      playwrightInstall.on('exit', () => callback())
    })
  })
}

// ---------------------------------------------------------------------------
// Scraper Python
// ---------------------------------------------------------------------------
function startScraper() {
  if (scraper) return

  const pythonCmd = findPython()
  if (!pythonCmd) {
    sendToRenderer('scraper-log', '[ERROR] Python no encontrado.\n')
    sendToRenderer('scraper-status', { running: false, code: -1 })
    sendToRenderer('show-logs', null)
    return
  }

  sendToRenderer('scraper-log', `[INFO] Usando: ${pythonCmd}\n`)
  sendToRenderer('scraper-log', `[INFO] Script: ${PYTHON_SCRIPT}\n`)
  sendToRenderer('scraper-log', `[INFO] CWD: ${ROOT}\n\n`)

  ensurePythonDeps(pythonCmd, () => launchScraper(pythonCmd))
}

function launchScraper(pythonCmd) {
  scraper = spawn(pythonCmd, [PYTHON_SCRIPT], {
    cwd:   ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env:   { ...process.env, BAKERS_DATA_DIR: app.getPath('userData') },
  })

  scraper.stdout.on('data', d => sendToRenderer('scraper-log', d.toString()))
  scraper.stderr.on('data', d => sendToRenderer('scraper-log', '[stderr] ' + d.toString()))

  scraper.on('error', err => {
    sendToRenderer('scraper-log', `[ERROR spawn] ${err.message}\n`)
    sendToRenderer('scraper-status', { running: false, code: -1 })
    sendToRenderer('show-logs', null)
    scraper = null
  })

  scraper.on('exit', (code, signal) => {
    sendToRenderer('scraper-log', `\n[INFO] Proceso terminado — code=${code} signal=${signal}\n`)
    scraper = null
    sendToRenderer('scraper-status', { running: false, code })
    if (code !== 0 && code !== null) sendToRenderer('show-logs', null)
  })

  sendToRenderer('scraper-status', { running: true })
}

function stopScraper() {
  if (!scraper) return
  scraper.kill()
  scraper = null
  sendToRenderer('scraper-status', { running: false })
}

// ---------------------------------------------------------------------------
// Watcher de raids.json
// ---------------------------------------------------------------------------
function watchRaids() {
  if (!fs.existsSync(RAIDS_JSON)) fs.writeFileSync(RAIDS_JSON, '{}')

  let lastMtime = 0
  watcher = setInterval(() => {
    try {
      const mtime = fs.statSync(RAIDS_JSON).mtimeMs
      if (mtime !== lastMtime) { lastMtime = mtime; loadAndSend() }
    } catch (_) {}
  }, 500)

  loadAndSend()
}

function watchPrices() {
  let lastMtime = 0
  pricesWatcher = setInterval(() => {
    try {
      const mtime = fs.statSync(PRICES_JSON).mtimeMs
      if (mtime !== lastMtime) { lastMtime = mtime; loadAndSendPrices() }
    } catch (_) {}
  }, 500)
}

function loadAndSendPrices() {
  try {
    const json = JSON.parse(fs.readFileSync(PRICES_JSON, 'utf8'))
    broadcastEvent('prices-data', json)
  } catch (_) {}
}

function loadAndSend() {
  try {
    const raw  = fs.readFileSync(RAIDS_JSON, 'utf8')
    const json = JSON.parse(raw)
    if (json.data && Array.isArray(json.data)) {
      const payload = {
        ...json,
        timestamp: new Date().toLocaleString('es-ES')
      }
      broadcastEvent('raids-data', payload)
    }
  } catch (_) {}
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
ipcMain.on('start-scraper',  () => startScraper())
ipcMain.on('stop-scraper',   () => stopScraper())
ipcMain.on('refresh-now',    () => fs.writeFileSync(FLAG_FILE, '1'))
ipcMain.on('request-data',   () => loadAndSend())
ipcMain.on('open-next-runs', () => openNextRunsWindow())
ipcMain.on('open-prices',     () => openPricesWindow())
ipcMain.on('refresh-prices', () => fs.writeFileSync(REFRESH_PRICES_FLAG, '1'))
ipcMain.on('open-url', (_e, url) => {
  if (!url || !url.startsWith('http')) return
  if (scraper) {
    fs.writeFileSync(OPEN_URL_FLAG, url)
  } else {
    shell.openExternal(url)
  }
})
ipcMain.handle('scraper-running', () => scraper !== null)
ipcMain.handle('get-raids', () => {
  try { return JSON.parse(fs.readFileSync(RAIDS_JSON, 'utf8')) } catch (_) { return { data: [] } }
})
ipcMain.handle('get-prices', () => {
  try { return JSON.parse(fs.readFileSync(PRICES_JSON, 'utf8')) } catch (_) { return { services: [], categories: [] } }
})

const FAV_LISTS_FILE = path.join(DATA_DIR, 'fav_lists.json')
ipcMain.handle('get-fav-lists', () => {
  try { return JSON.parse(fs.readFileSync(FAV_LISTS_FILE, 'utf8')) } catch (_) { return [] }
})
ipcMain.on('save-fav-lists', (_e, lists) => {
  try { fs.writeFileSync(FAV_LISTS_FILE, JSON.stringify(lists)) } catch (_) {}
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sendToRenderer(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
  if (channel === 'raids-data' && nextRunsWin && !nextRunsWin.isDestroyed())
    nextRunsWin.webContents.send(channel, payload)
}

/**
 * Broadcast event a TODAS las ventanas relevantes (main + popup + prices)
 */
function broadcastEvent(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
  if (nextRunsWin && !nextRunsWin.isDestroyed()) nextRunsWin.webContents.send(channel, payload)
  if (channel === 'prices-data' && pricesWin && !pricesWin.isDestroyed())
    pricesWin.webContents.send(channel, payload)
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  createWindow()
  watchRaids()
  watchPrices()
})

app.on('window-all-closed', () => {
  stopScraper()
  app.quit()
})
