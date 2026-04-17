const fs = require('fs')
const path = require('path')

let watcher = null
let pricesWatcher = null
let mainWindow = null
let nextRunsWindow = null
let windowsRef = null

function setMainWindow(win) {
  mainWindow = win
}

function setNextRunsWindow(win) {
  nextRunsWindow = win
}

function setWindowsRef(ref) {
  windowsRef = ref
}

function broadcastEvent(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
  if (nextRunsWindow && !nextRunsWindow.isDestroyed()) nextRunsWindow.webContents.send(channel, payload)
}

function watchRaids(raidsPath) {
  if (!fs.existsSync(raidsPath)) fs.writeFileSync(raidsPath, '{}')

  let lastMtime = 0
  watcher = setInterval(() => {
    try {
      const mtime = fs.statSync(raidsPath).mtimeMs
      if (mtime !== lastMtime) {
        lastMtime = mtime
        loadAndSendRaids(raidsPath)
      }
    } catch (_) {}
  }, 500)

  loadAndSendRaids(raidsPath)
}

function watchPrices(pricesPath) {
  let lastMtime = 0
  pricesWatcher = setInterval(() => {
    try {
      const mtime = fs.statSync(pricesPath).mtimeMs
      if (mtime !== lastMtime) {
        lastMtime = mtime
        loadAndSendPrices(pricesPath)
      }
    } catch (_) {}
  }, 500)

  if (fs.existsSync(pricesPath)) loadAndSendPrices(pricesPath)
}

function loadAndSendRaids(raidsPath) {
  try {
    const raw  = fs.readFileSync(raidsPath, 'utf8')
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

function loadAndSendPrices(pricesPath) {
  try {
    const json = JSON.parse(fs.readFileSync(pricesPath, 'utf8'))
    const pw = windowsRef?.prices
    if (pw && !pw.isDestroyed()) pw.webContents.send('prices-data', json)
  } catch (_) {}
}

function stopWatchers() {
  if (watcher) clearInterval(watcher)
  if (pricesWatcher) clearInterval(pricesWatcher)
}

function getRaids(raidsPath) {
  try { return JSON.parse(fs.readFileSync(raidsPath, 'utf8')) } catch (_) { return { data: [] } }
}

function getPrices(pricesPath) {
  try { return JSON.parse(fs.readFileSync(pricesPath, 'utf8')) } catch (_) { return { services: [], categories: [] } }
}

module.exports = {
  setMainWindow,
  setNextRunsWindow,
  watchRaids,
  watchPrices,
  stopWatchers,
  getRaids,
  getPrices
}
