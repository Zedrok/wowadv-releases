/**
 * Main entry point - orchestrates all features
 * Import structure keeps this file under 200 lines
 */

import * as table from './features/table/table.js'
import * as filters from './features/filters/filters.js'
import * as scraper from './features/scraper/scraper.js'
import { rowKey } from './utils/helpers.js'

// DOM refs
const raidsList = document.getElementById('raidsList')
const filterInput = document.getElementById('filterInput')
const infoTs = document.getElementById('infoTimestamp')
const logPanel = document.getElementById('logPanel')
const logContent = document.getElementById('logContent')

// ── State ──────────────────────────────────────────────────────
let allRows = []
let prevMap = {}
let sortCol = 'date'

// ── Render pipeline ────────────────────────────────────────────
function renderCards(container, rows) {
  if (rows.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-inbox empty-state-icon"></i>
        <p>No hay raids que mostrar</p>
      </div>`
    return
  }

  try {
    container.innerHTML = rows.map((r, idx) => {
      if (!r || !r.raids || !r.difficulty) {
        console.warn('Skipping invalid row', idx, ':', r)
        return ''
      }
    const key = rowKey(r)
    const bookingParts = (r.bookings || '').split('/')
    const [used, total] = [Number(bookingParts[0]) || 0, Number(bookingParts[1]) || 0]
    const isFull = total > 0 && used >= total
    const status = r.raids.includes('UNSAVED') ? 'unsaved' : r.difficulty === 'Mythic' ? 'mythic' : 'saved'
    const fillPercent = total > 0 ? (used / total) * 100 : 0

    return `
      <div class="raid-card" data-key="${key}" data-url="${r.url || ''}">
        <div class="raid-header">
          <div class="raid-info">
            <div class="raid-name">${r.raids}</div>
            <div class="raid-time-day">${r.date.split(' ')[0].substring(0, 3)}</div>
            <div class="raid-time-line">${r.time}</div>
            <div class="raid-subtitle">
              <span>${r.team}</span>
              <span>•</span>
              <span>${r.type}</span>
            </div>
          </div>
          <div class="raid-slots">
            <div class="raid-slots-text">${r.bookings}</div>
            <div class="raid-slots-bar">
              <div class="raid-slots-bar-fill" style="width: ${fillPercent}%"></div>
            </div>
          </div>
          <div class="raid-status ${status}${isFull ? ' full' : ''}">
            ${status === 'unsaved' ? 'Unsaved' : status === 'mythic' ? 'Mythic' : 'Saved'}
          </div>
          <button class="raid-link-btn" data-url="${r.url || ''}" title="Abrir en navegador">
            <i class="fa-solid fa-external-link-alt"></i>
          </button>
          <button class="raid-expand" data-key="${key}">▼</button>
        </div>
        <div class="raid-details" hidden>
          <div class="raid-detail">
            <div class="raid-detail-label">Dificultad</div>
            <div class="raid-detail-value">${r.difficulty}</div>
          </div>
          <div class="raid-detail">
            <div class="raid-detail-label">Loot</div>
            <div class="raid-detail-value">${r.loot}</div>
          </div>
          <div class="raid-detail">
            <div class="raid-detail-label">Lock</div>
            <div class="raid-detail-value">${r.lock}</div>
          </div>
          ${r.discount.includes('ON') ? `<div class="raid-detail"><div class="raid-detail-badge"><i class="fa-solid fa-tag"></i> Descuento</div></div>` : ''}
          ${r.notes ? `<div class="raid-detail"><div class="raid-detail-label">Notas</div><div class="raid-detail-value">${r.notes}</div></div>` : ''}
        </div>
      </div>`
  }).join('')

  // Event listeners
  container.querySelectorAll('.raid-expand').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      const card = btn.closest('.raid-card')
      const details = card.querySelector('.raid-details')
      const isExpanded = card.classList.contains('expanded')
      card.classList.toggle('expanded')
      details.hidden = isExpanded
    })
  })

    container.querySelectorAll('.raid-link-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const url = btn.dataset.url
        if (url) openUrl(url)
      })
    })
  } catch (e) {
    console.error('Error in renderCards:', e)
    container.innerHTML = `<div class="empty-state"><p>Error rendering cards: ${e.message}</p></div>`
  }
}

function renderPage() {
  const filtered = filters.applyFilter(allRows)
  const sorted = table.applySort(filtered, sortCol)
  filters.populateDropdowns(allRows)
  renderCards(raidsList, sorted)
}

// ── Event handlers ─────────────────────────────────────────────
function openUrl(url) {
  window.api.openUrl(url)
}

// ── IPC Listeners ──────────────────────────────────────────────
window.api.onRaidsData(payload => {
  try {
    console.log('onRaidsData received:', payload)
    const { data, timestamp } = payload
    console.log('Starting computeFlashes with', data.length, 'rows')
    table.computeFlashes(data, prevMap)
    console.log('computeFlashes done')

    prevMap = {}
    console.log('Building prevMap...')
    data.forEach((r, idx) => {
      try {
        const key = rowKey(r)
        prevMap[key] = r
      } catch (e) {
        console.error('Error processing row', idx, ':', e, 'row:', r)
      }
    })
    console.log('prevMap built')
    allRows = data

    infoTs.textContent = `Actualizado: ${timestamp}`
    renderPage()
  } catch (e) {
    console.error('Error in onRaidsData:', e)
  }
})

window.api.onScraperStatus(({ running, code }) => {
  scraper.setScraperState(running)
})

window.api.onScraperLog(line => {
  logContent.textContent += line
  logContent.scrollTop    = logContent.scrollHeight
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
  filters.filters.lock = document.getElementById('fLock').checked ? 'Unlocked' : ''
  filters.saveCurrentFilters()
  renderPage()
})

document.getElementById('fRaids').addEventListener('change', () => {
  filters.filters.raids = document.getElementById('fRaids').value
  filters.saveCurrentFilters()
  renderPage()
})

document.getElementById('fTeam').addEventListener('change', () => {
  filters.filters.team = document.getElementById('fTeam').value
  filters.saveCurrentFilters()
  renderPage()
})

document.getElementById('fDisponibles').addEventListener('change', () => {
  filters.filters.soloDisponibles = document.getElementById('fDisponibles').checked
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

document.getElementById('btnToggleAdvanced').addEventListener('click', () => {
  const advanced = document.getElementById('filterAdvanced')
  const btn = document.getElementById('btnToggleAdvanced')
  advanced.hidden = !advanced.hidden
  btn.querySelector('i').classList.toggle('fa-chevron-down')
  btn.querySelector('i').classList.toggle('fa-chevron-up')
})

// ── Button controls ───────────────────────────────────────────
document.getElementById('btnStart').addEventListener('click', () => scraper.startScraper())
document.getElementById('btnStop').addEventListener('click', () => scraper.stopScraper())
document.getElementById('btnNextRuns').addEventListener('click', () => window.api.openNextRuns())
document.getElementById('btnPrices').addEventListener('click', () => window.api.openPrices())
document.getElementById('btnMinimize').addEventListener('click', () => window.api.minimizeWindow())
document.getElementById('btnMaximize').addEventListener('click', () => window.api.maximizeWindow())
document.getElementById('btnClose').addEventListener('click', () => window.api.closeWindow())

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
    sortCol = th.dataset.col
    table.updateSortUI(sortCol)
    renderPage()
  })
})

// ── Init ───────────────────────────────────────────────────────
console.log('Renderer init: requesting initial data...')
window.api.isRunning().then(running => {
  console.log('Scraper running:', running)
  scraper.setScraperState(running)
})

filters.loadSavedFilters()
filters.updateFilterUI()

document.getElementById('btnLog').style.color = 'var(--gold)'
window.api.requestData()
console.log('requestData called')
