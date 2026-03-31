const { app, BrowserWindow, ipcMain } = require('electron')
const path  = require('path')
const fs    = require('fs')
const { spawn, execFileSync } = require('child_process')

const ROOT          = path.join(__dirname, '..')
const RAIDS_JSON    = path.join(ROOT, 'raids.json')
const FLAG_FILE     = path.join(ROOT, 'refresh.flag')
const PYTHON_SCRIPT = path.join(ROOT, 'bakers_raids.py')

let win         = null
let scraper     = null
let watcher     = null
let nextRunsWin = null

function openNextRunsWindow() {
  if (nextRunsWin && !nextRunsWin.isDestroyed()) {
    nextRunsWin.focus()
    return
  }
  nextRunsWin = new BrowserWindow({
    width:  272,
    height: 620,
    minWidth:  272,
    maxWidth:  272,
    minHeight: 400,
    backgroundColor: '#0d0d14',
    alwaysOnTop: true,
    title: "Próximos Runs",
    // sin parent → ventana independiente, no se minimiza con la principal
    webPreferences: {
      preload: path.join(__dirname, 'popup-preload.js'),
      contextIsolation: true,
    },
  })
  nextRunsWin.setMenuBarVisibility(false)
  nextRunsWin.loadFile(path.join(__dirname, 'popup.html'))
  nextRunsWin.webContents.openDevTools({ mode: 'detach' })
  nextRunsWin.on('closed', () => { nextRunsWin = null })
}

// ---------------------------------------------------------------------------
// Detectar ejecutable de Python disponible en Windows
// ---------------------------------------------------------------------------
function findPython() {
  for (const cmd of ['py', 'python', 'python3']) {
    try {
      execFileSync(cmd, ['--version'], { timeout: 3000, stdio: 'pipe' })
      return cmd
    } catch (_) { /* no disponible, probar siguiente */ }
  }
  return null
}

// ---------------------------------------------------------------------------
// Ventana principal
// ---------------------------------------------------------------------------
function createWindow() {
  win = new BrowserWindow({
    width:  1440,
    height: 780,
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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  })

  win.loadFile(path.join(__dirname, 'index.html'))

  // DevTools para debug — quitar en producción
  win.webContents.openDevTools({ mode: 'detach' })

  win.on('closed', () => {
    stopScraper()
    if (watcher) watcher.close()
    win = null
  })
}

// ---------------------------------------------------------------------------
// Scraper Python
// ---------------------------------------------------------------------------
function startScraper() {
  if (scraper) return

  const pythonCmd = findPython()
  if (!pythonCmd) {
    sendToRenderer('scraper-log', '[ERROR] Python no encontrado. Instala Python y asegúrate de que esté en el PATH.\n')
    sendToRenderer('scraper-status', { running: false, code: -1 })
    sendToRenderer('show-logs', null)
    return
  }

  sendToRenderer('scraper-log', `[INFO] Usando: ${pythonCmd}\n`)
  sendToRenderer('scraper-log', `[INFO] Script: ${PYTHON_SCRIPT}\n`)
  sendToRenderer('scraper-log', `[INFO] CWD: ${ROOT}\n\n`)

  scraper = spawn(pythonCmd, [PYTHON_SCRIPT], {
    cwd:   ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
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
  if (!fs.existsSync(RAIDS_JSON)) {
    fs.writeFileSync(RAIDS_JSON, '{}')
  }

  let debounce = null
  watcher = fs.watch(RAIDS_JSON, () => {
    clearTimeout(debounce)
    debounce = setTimeout(loadAndSend, 200)
  })

  loadAndSend()   // carga inicial si ya existe
}

function loadAndSend() {
  try {
    const raw  = fs.readFileSync(RAIDS_JSON, 'utf8')
    const json = JSON.parse(raw)
    if (json.data && Array.isArray(json.data)) {
      sendToRenderer('raids-data', json)
    }
  } catch (_) { /* archivo incompleto, ignorar */ }
}

// ---------------------------------------------------------------------------
// IPC desde renderer
// ---------------------------------------------------------------------------
ipcMain.on('start-scraper',   () => startScraper())
ipcMain.on('stop-scraper',    () => stopScraper())
ipcMain.on('refresh-now',     () => fs.writeFileSync(FLAG_FILE, '1'))
ipcMain.on('request-data',    () => loadAndSend())
ipcMain.handle('scraper-running', () => scraper !== null)
ipcMain.on('open-next-runs',  () => openNextRunsWindow())
ipcMain.handle('get-raids', () => {
  try {
    const raw = fs.readFileSync(RAIDS_JSON, 'utf8')
    return JSON.parse(raw)
  } catch (_) { return { data: [] } }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sendToRenderer(channel, payload) {
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload)
  }
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  createWindow()
  watchRaids()
})

app.on('window-all-closed', () => {
  stopScraper()
  app.quit()
})
