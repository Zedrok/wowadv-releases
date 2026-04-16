/**
 * Main entry point - orchestrates all features
 * Import structure keeps this file under 200 lines
 */

import * as table from './features/table/table.js'
import * as filters from './features/filters/filters.js'
import * as favorites from './features/favorites/favorites.js'
import * as scraper from './features/scraper/scraper.js'

// DOM refs
const tbody = document.getElementById('raidsBody')
const filterInput = document.getElementById('filterInput')
const infoTs = document.getElementById('infoTimestamp')
const infoCount = document.getElementById('infoCount')
const infoNext = document.getElementById('infoNext')
const logPanel = document.getElementById('logPanel')
const logContent = document.getElementById('logContent')

// ── Render pipeline ────────────────────────────────────────────
function renderPage() {
  const rows = table.applySort(filters.applyFilter(table.allRows))
  filters.populateDropdowns(table.allRows)
  table.renderTable(tbody, rows, favorites.favorites, onFavToggle, openUrl)
  table.updateSortUI(table.sortCol)
}

// ── Event handlers ─────────────────────────────────────────────
function onFavToggle(key) {
  favorites.toggleFavorite(key)
  renderPage()
}

function openUrl(url) {
  window.api.openUrl(url)
}

// ── IPC Listeners ──────────────────────────────────────────────
window.api.onRaidsData(payload => {
  const { data, timestamp } = payload
  table.computeFlashes(data)
  table.prevMap = {}
  data.forEach(r => { table.prevMap[table.rowKey(r)] = r })
  table.allRows = data

  infoTs.textContent    = `Actualizado: ${timestamp}`
  infoCount.textContent = `${data.length} raids`
  renderPage()
})

window.api.onScraperStatus(({ running, code }) => {
  scraper.setScraperState(running)
})

window.api.onScraperLog(line => {
  logContent.textContent += line
  logContent.scrollTop    = logContent.scrollHeight
  const m = line.match(/Próximo refresco a las (\S+)/)
  if (m) infoNext.textContent = `Próximo refresco: ${m[1]}`
})

window.api.onShowLogs(() => {
  logPanel.hidden = false
  document.getElementById('btnLog').style.color = 'var(--gold)'
})

// ── Filter controls ────────────────────────────────────────────
filterInput.addEventListener('input', () => {
  filters.setFilterText(filterInput.value)
  renderPage()
})

document.getElementById('fFuturos').addEventListener('change', () => {
  filters.filters.soloFuturos = document.getElementById('fFuturos').checked
  filters.saveCurrentFilters()
  renderPage()
})

document.getElementById('fDifficulty').addEventListener('change', () => {
  filters.filters.difficulty = document.getElementById('fDifficulty').value
  filters.saveCurrentFilters()
  renderPage()
})

document.getElementById('fTipo').addEventListener('change', () => {
  filters.filters.tipo = document.getElementById('fTipo').value
  filters.saveCurrentFilters()
  renderPage()
})

document.getElementById('fLoot').addEventListener('change', () => {
  filters.filters.loot = document.getElementById('fLoot').value
  filters.saveCurrentFilters()
  renderPage()
})

document.getElementById('fLock').addEventListener('change', () => {
  filters.filters.lock = document.getElementById('fLock').value
  filters.saveCurrentFilters()
  renderPage()
})

document.getElementById('fRaids').addEventListener('change', () => {
  filters.filters.raids = document.getElementById('fRaids').value
  filters.saveCurrentFilters()
  renderPage()
})

document.getElementById('fDescuento').addEventListener('change', () => {
  filters.filters.soloDescuento = document.getElementById('fDescuento').checked
  filters.saveCurrentFilters()
  renderPage()
})

document.getElementById('btnResetFilters').addEventListener('click', () => {
  filters.resetFilters()
  renderPage()
})

// ── Button controls ───────────────────────────────────────────
document.getElementById('btnStart').addEventListener('click', () => scraper.startScraper())
document.getElementById('btnStop').addEventListener('click', () => scraper.stopScraper())
document.getElementById('btnRefresh').addEventListener('click', () => scraper.refreshNow())
document.getElementById('btnNextRuns').addEventListener('click', () => window.api.openNextRuns())
document.getElementById('btnPrices').addEventListener('click', () => window.api.openPrices())

document.getElementById('btnLog').addEventListener('click', () => {
  logPanel.hidden = !logPanel.hidden
  document.getElementById('btnLog').style.color = logPanel.hidden ? '' : 'var(--gold)'
})

document.getElementById('btnLogClear').addEventListener('click', () => {
  logContent.textContent = ''
})

// ── Sort by column ─────────────────────────────────────────────
document.querySelectorAll('th[data-col]').forEach(th => {
  th.addEventListener('click', () => {
    table.setSortCol(th.dataset.col)
    table.updateSortUI(th.dataset.col)
    renderPage()
  })
})

// ── Init ───────────────────────────────────────────────────────
window.api.isRunning().then(running => scraper.setScraperState(running))

filters.loadSavedFilters()
favorites.loadFavoritesList()
filters.updateFilterUI()

document.getElementById('btnLog').style.color = 'var(--gold)'
window.api.requestData()
