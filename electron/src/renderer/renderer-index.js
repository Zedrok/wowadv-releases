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
    const now = new Date()
    const PAST_EXPIRY_MS = 15 * 60 * 1000  // 15 minutos

    container.innerHTML = rows.map((r, idx) => {
      if (!r || !r.raids || !r.difficulty) {
        console.warn('Skipping invalid row', idx, ':', r)
        return ''
      }
    const key = rowKey(r)
    const bookingParts = (r.bookings || '').split('/')
    const [used, total] = [Number(bookingParts[0]) || 0, Number(bookingParts[1]) || 0]
    const isFull = total > 0 && used >= total
    const fillPercent = total > 0 ? (used / total) * 100 : 0
    const status = r.raids.includes('UNSAVED') ? 'unsaved' : r.difficulty === 'Mythic' ? 'mythic' : 'saved'
    const slotClass = isFull ? 'raid-slots--full' : fillPercent >= 70 ? 'raid-slots--warning' : ''

    // Calculate if raid is past expired (15+ minutes)
    let isPastExpired = false
    try {
      const [month, day] = (r.date || '').match(/\d+\/\d+/)?.[0].split('/').map(Number) || [0, 0]
      const timeMatch = (r.time || '').match(/(\d+):(\d+)\s(AM|PM)/)
      if (month && day && timeMatch) {
        const [_, hours, minutes, period] = timeMatch
        let h = Number(hours)
        if (period === 'PM' && h !== 12) h += 12
        if (period === 'AM' && h === 12) h = 0
        const year = now.getFullYear()
        const raidDate = new Date(year, month - 1, day, h, Number(minutes), 0)
        if (raidDate < now) {
          isPastExpired = (now.getTime() - raidDate.getTime()) > PAST_EXPIRY_MS
        }
      }
    } catch (_) { /* ignore */ }

    return `
      <div class="raid-card${isPastExpired ? ' past-expired' : ''}" data-key="${key}" data-url="${r.url || ''}">
        <div class="raid-header">
          <div class="raid-info">
            <div class="raid-name">${r.raids}</div>
            <div class="raid-subtitle">
              <span>${r.team}</span>
              <span>•</span>
              <span>${r.type}</span>
            </div>
          </div>
          <div class="raid-lock">
            ${r.lock === 'Locked' ? '<i class="fa-solid fa-lock"></i>' : ''}
          </div>
          <div class="raid-time">
            <div class="raid-time-day">${r.date.split(' ')[0].substring(0, 3)}</div>
            <div class="raid-time-line">${r.time}</div>
          </div>
          <div class="raid-status ${status}${isFull ? ' full' : ''}">
            ${status === 'unsaved' ? 'Unsaved' : status === 'mythic' ? 'Mythic' : 'Saved'}
          </div>
          <div class="raid-slots ${slotClass}">
            <div class="raid-slots-text">${r.bookings}</div>
            <div class="raid-slots-bar">
              <div class="raid-slots-bar-fill" style="width: ${fillPercent}%"></div>
            </div>
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
            <div class="raid-detail-value">${r.lock === 'Locked' ? '<i class="fa-solid fa-lock"></i>' : '<i class="fa-solid fa-lock-open"></i>'}</div>
          </div>
          ${r.discount.includes('ON') ? `<div class="raid-detail"><div class="raid-detail-badge"><i class="fa-solid fa-tag"></i> Descuento</div></div>` : ''}
          ${r.notes ? `<div class="raid-detail"><div class="raid-detail-label">Notas</div><div class="raid-detail-value">${r.notes}</div></div>` : ''}
        </div>
      </div>`
  }).join('')

  // Event listeners
  container.querySelectorAll('.raid-header').forEach(header => {
    header.addEventListener('click', e => {
      const isButton = e.target.closest('.raid-expand, .raid-link-btn')
      if (isButton) return

      const card = header.closest('.raid-card')
      const details = card.querySelector('.raid-details')
      const isExpanded = card.classList.contains('expanded')
      card.classList.toggle('expanded')
      details.hidden = isExpanded
    })
  })

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
      const card = btn.closest('.raid-card')
      const key = card.dataset.key
      const url = btn.dataset.url
      const raid = allRows.find(r => rowKey(r) === key)
      if (raid && url) {
        showRaidModal(raid, url)
        openUrl(url)
      }
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

// ── Modal System ───────────────────────────────────────────────
function showRaidModal(raid, url) {
  const backdrop = document.getElementById('raidModalBackdrop')
  const form = document.getElementById('raidModalForm')

  if (!backdrop) return // Modal not initialized yet

  // Show modal
  backdrop.hidden = false

  // Setup form submission
  form.onsubmit = async (e) => {
    e.preventDefault()

    const nickRealm = document.getElementById('fNickRealm').value
    const battleTag = document.getElementById('fBattleTag').value
    const monto = document.getElementById('fMonto').value
    const enableAlarm = document.getElementById('fEnableAlarm').checked

    if (!nickRealm || !monto) {
      alert('Nick-Realm y Monto son requeridos')
      return
    }

    try {
      // Save buyer record
      const buyer = await window.api.saveBuyerRecord({
        nickRealm,
        battleTag: battleTag,
        monto: Number(monto)
      })

      // Schedule alarm if enabled
      if (enableAlarm) {
        const sound = document.getElementById('fAlarmSound').value
        const minutesBefore = Number(document.getElementById('fMinutesBefore').value) || 15

        // Parse raid date and time correctly
        // raid.date format: "Sunday 04/19", raid.time format: "4:00 PM"
        const [month, day] = raid.date.match(/\d+\/\d+/)[0].split('/').map(Number)
        const timeMatch = raid.time.match(/(\d+):(\d+)\s(AM|PM)/)
        let hours = parseInt(timeMatch[1])
        const minutes = parseInt(timeMatch[2])
        const period = timeMatch[3]

        // Convert to 24-hour format
        if (period === 'PM' && hours !== 12) hours += 12
        if (period === 'AM' && hours === 12) hours = 0

        // Create date (assuming current year)
        const now = new Date()
        const year = now.getFullYear()
        const raidDate = new Date(year, month - 1, day, hours, minutes, 0)

        // If date is in the past, assume it's next year
        if (raidDate < now) {
          raidDate.setFullYear(year + 1)
        }

        const raidTime = raidDate.toISOString()
        const alertTime = new Date(new Date(raidTime).getTime() - minutesBefore * 60000).toISOString()

        await window.api.scheduleAlarm({
          raidTime,
          alertTime,
          sound,
          minutesBefore,
          buyerId: buyer.id,
          buyerInfo: {
            nickRealm: buyer.nickRealm,
            battleTag: buyer.battleTag
          },
          raidInfo: {
            name: raid.raids,
            team: raid.team,
            difficulty: raid.difficulty,
            loot: raid.loot,
            url: raid.url
          }
        })
      }

      closeRaidModal()
    } catch (e) {
      console.error('Error saving buyer/alarm:', e)
      alert('Error al guardar los datos')
    }
  }
}

function closeRaidModal() {
  const backdrop = document.getElementById('raidModalBackdrop')
  if (backdrop) backdrop.hidden = true

  // Reset form
  const form = document.getElementById('raidModalForm')
  if (form) form.reset()
  document.getElementById('fAlarmOptions').hidden = true
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

// ── Filter controls ────────────────────────────────────────────
filterInput.addEventListener('input', () => {
  filters.setFilterText(filterInput.value)
  renderPage()
})

document.getElementById('fAnteriores').addEventListener('change', (e) => {
  console.log('[Filter] Mostrar Anteriores changed:', e.target.checked)
  filters.filters.mostrarAnteriores = e.target.checked

  // Disable "Con espacio" and "Unlocked" when showing anteriores
  const fDisponibles = document.getElementById('fDisponibles')
  const fLock = document.getElementById('fLock')
  fDisponibles.disabled = e.target.checked
  fLock.disabled = e.target.checked

  filters.saveCurrentFilters()
  renderPage()
})

document.getElementById('fDay').addEventListener('change', () => {
  filters.filters.day = document.getElementById('fDay').value
  console.log('[Filter] Day changed to:', filters.filters.day)
  filters.saveCurrentFilters()
  renderPage()
})

document.getElementById('fDifficulty').addEventListener('change', () => {
  filters.filters.difficulty = document.getElementById('fDifficulty').value
  console.log('[Filter] Difficulty changed to:', filters.filters.difficulty)
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

document.getElementById('fLock').addEventListener('change', (e) => {
  const isUnlocked = e.target.checked
  filters.filters.lock = isUnlocked ? 'Unlocked' : ''
  console.log('[Filter] Lock changed to:', filters.filters.lock)
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

document.getElementById('fDisponibles').addEventListener('change', (e) => {
  console.log('[Filter] Con Espacio changed:', e.target.checked)
  filters.filters.soloDisponibles = e.target.checked
  filters.saveCurrentFilters()
  renderPage()
})

document.getElementById('fDescuento').addEventListener('change', () => {
  filters.filters.soloDescuento = document.getElementById('fDescuento').checked
  filters.saveCurrentFilters()
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
document.getElementById('btnToggleScraper').addEventListener('click', () => scraper.toggleScraper())
document.getElementById('btnNextRuns').addEventListener('click', () => window.api.openNextRuns())
document.getElementById('btnPrices').addEventListener('click', () => window.api.openPrices())

document.getElementById('btnLog').addEventListener('click', () => {
  logPanel.hidden = !logPanel.hidden
  document.getElementById('btnLog').style.color = logPanel.hidden ? '' : 'var(--gold)'
})

document.getElementById('btnLogClear').addEventListener('click', () => {
  logContent.textContent = ''
})

// ── Raid Modal ─────────────────────────────────────────────
const enableAlarmCheckbox = document.getElementById('fEnableAlarm')
if (enableAlarmCheckbox) {
  enableAlarmCheckbox.addEventListener('change', (e) => {
    const alarmOptions = document.getElementById('fAlarmOptions')
    if (alarmOptions) alarmOptions.hidden = !e.target.checked
  })
}

const previewBtn = document.querySelector('.raid-modal-box .btn-preview')
if (previewBtn) {
  previewBtn.addEventListener('click', async (e) => {
    e.preventDefault()
    const soundSelect = document.getElementById('fAlarmSound')
    if (soundSelect) {
      const sound = soundSelect.value
      try {
        await window.api.playPreviewSound(sound)
      } catch (err) {
        console.error('Error playing preview sound:', err)
      }
    }
  })
}

const cancelBtn = document.querySelector('.raid-modal-box .btn-cancel')
if (cancelBtn) {
  cancelBtn.addEventListener('click', (e) => {
    e.preventDefault()
    closeRaidModal()
  })
}

const backdrop = document.getElementById('raidModalBackdrop')
if (backdrop) {
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeRaidModal()
  })
}

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

// Show loading state initially
scraper.setScraperState(false, true)

// Fetch actual status after short delay
window.api.isRunning().then(running => {
  console.log('Scraper running:', running)
  scraper.setScraperState(running, false)
})

filters.loadSavedFilters()
filters.updateFilterUI()

// Disable "Con espacio" and "Unlocked" if "Mostrar Anteriores" is already enabled
if (filters.filters.mostrarAnteriores) {
  document.getElementById('fDisponibles').disabled = true
  document.getElementById('fLock').disabled = true
}

window.api.requestData()
console.log('requestData called')
