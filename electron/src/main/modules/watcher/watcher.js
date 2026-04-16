const fs = require('fs')
const path = require('path')

let watcher = null
let pricesWatcher = null
let mainWindow = null
let nextRunsWindow = null

export function setMainWindow(win) {
  mainWindow = win
}

export function setNextRunsWindow(win) {
  nextRunsWindow = win
}

function broadcastEvent(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
  if (nextRunsWindow && !nextRunsWindow.isDestroyed()) nextRunsWindow.webContents.send(channel, payload)
}

export function watchRaids(raidsPath) {
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

export function watchPrices(pricesPath) {
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
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('prices-data', json)
  } catch (_) {}
}

export function stopWatchers() {
  if (watcher) clearInterval(watcher)
  if (pricesWatcher) clearInterval(pricesWatcher)
}

export function getRaids(raidsPath) {
  try { return JSON.parse(fs.readFileSync(raidsPath, 'utf8')) } catch (_) { return { data: [] } }
}

export function getPrices(pricesPath) {
  try { return JSON.parse(fs.readFileSync(pricesPath, 'utf8')) } catch (_) { return { services: [], categories: [] } }
}
