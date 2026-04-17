const { spawn, execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const { shell } = require('electron')

let scraper = null
let mainWindow = null
let windowsRef = null
let autoRetryCount = 0
let maxAutoRetries = 3
let autoStartPending = false

function setMainWindow(win) {
  mainWindow = win
}

function setWindowsRef(ref) {
  windowsRef = ref
}

function findPython() {
  for (const cmd of ['py', 'python', 'python3']) {
    try {
      execFileSync(cmd, ['--version'], { timeout: 3000, stdio: 'pipe' })
      return cmd
    } catch (_) {}
  }
  return null
}

const REQUIRED_PYTHON_PACKAGES = ['playwright', 'pywin32', 'pycryptodome', 'browser-cookie3']

function ensurePythonDeps(pythonCmd, callback) {
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

    sendLog(`[INFO] Instalando dependencias: ${pkgs.join(', ')}\n`)
    const install = spawn(pythonCmd, ['-m', 'pip', 'install', ...pkgs], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    install.stdout.on('data', d => sendLog(d.toString()))
    install.stderr.on('data', d => sendLog(d.toString()))
    install.on('exit', code => {
      if (code !== 0) {
        sendLog('[ERROR] Falló la instalación de dependencias.\n')
        sendStatus({ running: false, code })
        sendShowLogs()
        return
      }
      sendLog('[INFO] Instalando playwright msedge...\n')
      const playwrightInstall = spawn(pythonCmd, ['-m', 'playwright', 'install', 'msedge'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      playwrightInstall.stdout.on('data', d => sendLog(d.toString()))
      playwrightInstall.stderr.on('data', d => sendLog(d.toString()))
      playwrightInstall.on('exit', () => callback())
    })
  })
}

function start(root, dataDir) {
  if (scraper) return

  const pythonCmd = findPython()
  if (!pythonCmd) {
    sendLog('[ERROR] Python no encontrado.\n')
    sendStatus({ running: false, code: -1 })
    sendShowLogs()
    return
  }

  const scriptPath = require('path').join(root, 'bakers_raids.py')
  sendLog(`[INFO] Usando: ${pythonCmd}\n`)
  sendLog(`[INFO] Script: ${scriptPath}\n`)
  sendLog(`[INFO] CWD: ${root}\n\n`)

  ensurePythonDeps(pythonCmd, () => launch(pythonCmd, scriptPath, root, dataDir))
}

function launch(pythonCmd, scriptPath, root, dataDir) {
  scraper = spawn(pythonCmd, [scriptPath], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BAKERS_DATA_DIR: dataDir },
  })

  scraper.stdout.on('data', d => sendLog(d.toString()))
  scraper.stderr.on('data', d => sendLog('[stderr] ' + d.toString()))
  scraper.on('error', err => {
    sendLog(`[ERROR spawn] ${err.message}\n`)
    sendStatus({ running: false, code: -1 })
    sendShowLogs()
    scraper = null
    handleAutoRetry(root, dataDir)
  })
  scraper.on('exit', (code, signal) => {
    sendLog(`\n[INFO] Proceso terminado — code=${code} signal=${signal}\n`)
    scraper = null
    sendStatus({ running: false, code })
    if (code !== 0 && code !== null) {
      sendShowLogs()
      if (autoStartPending) handleAutoRetry(root, dataDir)
    }
  })

  sendStatus({ running: true })
  autoRetryCount = 0
}

function handleAutoRetry(root, dataDir) {
  if (!autoStartPending) return

  autoRetryCount++
  if (autoRetryCount > maxAutoRetries) {
    sendLog(`\n[ERROR] Máximo de reintentos alcanzado (${maxAutoRetries}). Contacta al soporte.\n`)
    autoStartPending = false
    return
  }

  const delayMs = 5000 + (autoRetryCount * 1000)
  sendLog(`\n[INFO] Reintentando en ${delayMs / 1000}s... (intento ${autoRetryCount}/${maxAutoRetries})\n`)
  setTimeout(() => {
    if (autoStartPending && !scraper) {
      start(root, dataDir)
    }
  }, delayMs)
}

function stop() {
  if (!scraper) return
  scraper.kill()
  scraper = null
  sendStatus({ running: false })
}

function isRunning() {
  return scraper !== null
}

function autoStart(root, dataDir) {
  autoStartPending = true
  autoRetryCount = 0

  const tokenPath = path.join(dataDir, 'bakers_token.txt')

  if (fs.existsSync(tokenPath)) {
    sendLog('[INFO] Token encontrado. Iniciando scraper...\n')
    start(root, dataDir)
  } else {
    sendLog('[INFO] Token no encontrado.\n')
    sendLog('[INFO] Haz click en "Start" y se abrirá el navegador para iniciar sesión.\n')
    autoStartPending = false
  }
}

function monitorToken(tokenPath, root, dataDir) {
  const interval = setInterval(() => {
    if (fs.existsSync(tokenPath)) {
      clearInterval(interval)
      sendLog('[INFO] Sesión iniciada. Iniciando scraper...\n')
      autoStartPending = true
      start(root, dataDir)
    }
  }, 1000)

  setTimeout(() => {
    if (!fs.existsSync(tokenPath)) {
      clearInterval(interval)
      sendLog('[WARNING] Timeout esperando token. Canceling auto-start.\n')
      autoStartPending = false
    }
  }, 300000) // 5 minutos timeout
}

function sendLog(msg) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('scraper-log', msg)
}

function sendStatus(status) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('scraper-status', status)
  const pw = windowsRef?.prices
  if (pw && !pw.isDestroyed()) pw.webContents.send('scraper-status', status)
}

function sendShowLogs() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('show-logs', null)
}

module.exports = {
  setMainWindow,
  setWindowsRef,
  start,
  stop,
  isRunning,
  autoStart
}
