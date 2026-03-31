/* ── State ─────────────────────────────────────────────────── */
let allRows  = []
let prevMap  = {}
let scraperOn = false

let filterText = ''
let sortCol    = null
let sortAsc    = true

const filters = {
  soloFuturos: false,
  difficulty:  '',
  tipo:        '',
  loot:        '',
  lock:        '',
  raids:       '',
  soloDescuento: false,
}

/* ── DOM refs ──────────────────────────────────────────────── */
const tbody        = document.getElementById('raidsBody')
const infoTs       = document.getElementById('infoTimestamp')
const infoCount    = document.getElementById('infoCount')
const infoNext     = document.getElementById('infoNext')
const filterInput  = document.getElementById('filterInput')
const statusDot    = document.getElementById('statusDot')
const statusText   = document.getElementById('statusText')
const btnStart     = document.getElementById('btnStart')
const btnStop      = document.getElementById('btnStop')
const btnRefresh   = document.getElementById('btnRefresh')
const btnLog       = document.getElementById('btnLog')
const logPanel     = document.getElementById('logPanel')
const logContent   = document.getElementById('logContent')
const btnLogClear  = document.getElementById('btnLogClear')
const btnReset     = document.getElementById('btnResetFilters')

const fFuturos    = document.getElementById('fFuturos')
const fDifficulty = document.getElementById('fDifficulty')
const fTipo       = document.getElementById('fTipo')
const fLoot       = document.getElementById('fLoot')
const fLock       = document.getElementById('fLock')
const fRaids      = document.getElementById('fRaids')
const fDescuento  = document.getElementById('fDescuento')

/* ── Time / Date helpers ───────────────────────────────────── */

/** "9:00 AM" → minutos desde medianoche */
function parseTimeToMinutes(timeStr) {
  const m = String(timeStr || '').match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!m) return 0
  let h = parseInt(m[1])
  const min = parseInt(m[2])
  const period = m[3].toUpperCase()
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return h * 60 + min
}

/** "Thursday 03/26" → ordinal numérico MMDD para comparar */
function parseDateToOrdinal(dateStr) {
  const m = String(dateStr || '').match(/(\d+)\/(\d+)/)
  if (!m) return 0
  return parseInt(m[1]) * 100 + parseInt(m[2])
}

/**
 * Detecta si una fecha cae dentro del horario de verano de EE.UU.
 * DST empieza el 2do domingo de marzo, termina el 1er domingo de noviembre.
 */
function nthSunday(year, month, n) {
  const d = new Date(year, month - 1, 1)
  const firstSun = (7 - d.getDay()) % 7 + 1
  return new Date(year, month - 1, firstSun + (n - 1) * 7)
}

function isEDT(year, month, day) {
  const start = nthSunday(year, 3, 2)   // 2do domingo de marzo
  const end   = nthSunday(year, 11, 1)  // 1er domingo de noviembre
  const d = new Date(year, month - 1, day)
  return d >= start && d < end
}

/**
 * Convierte fecha+hora de raid (en EST/EDT) a un objeto Date en UTC.
 * dateStr: "Thursday 03/26"  |  timeStr: "9:00 AM"
 */
function parseRaidToDate(dateStr, timeStr) {
  const dm = String(dateStr || '').match(/(\d+)\/(\d+)/)
  const tm = String(timeStr || '').match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!dm || !tm) return null

  const year  = new Date().getFullYear()
  const month = parseInt(dm[1])
  const day   = parseInt(dm[2])
  let   h     = parseInt(tm[1])
  const min   = parseInt(tm[2])
  const per   = tm[3].toUpperCase()

  if (per === 'PM' && h !== 12) h += 12
  if (per === 'AM' && h === 12) h = 0

  // EDT = UTC-4, EST = UTC-5
  const offsetH = isEDT(year, month, day) ? 4 : 5
  return new Date(Date.UTC(year, month - 1, day, h + offsetH, min))
}

/* ── Filter helpers ────────────────────────────────────────── */

function isFull(bookings) {
  if (!bookings || !bookings.includes('/')) return false
  const [b, t] = bookings.split('/').map(s => parseInt(s.trim(), 10))
  return !isNaN(b) && !isNaN(t) && t > 0 && b >= t
}

function rowKey(r) { return `${r.date}|${r.time}|${r.team}` }

function diffClass(r) {
  const d = (r.difficulty || '').toLowerCase()
  if (d.includes('heroic')) return 'heroic'
  if (d.includes('normal')) return 'normal'
  return 'other'
}

function bookingsBadge(bk) {
  const full = isFull(bk)
  const high = !full && highLoad(bk)
  const cls  = full ? 'full' : high ? 'high' : ''
  return `<span class="bookings ${cls}">${bk || '—'}</span>`
}

function highLoad(bk) {
  if (!bk || !bk.includes('/')) return false
  const [b, t] = bk.split('/').map(s => parseInt(s.trim(), 10))
  return !isNaN(b) && !isNaN(t) && t > 0 && b / t >= 0.8
}

function diffBadge(diff) {
  const d = (diff || '').toLowerCase()
  const cls = d.includes('heroic') ? 'diff-heroic'
            : d.includes('normal') ? 'diff-normal'
            : 'diff-other'
  return `<span class="diff ${cls}">${diff || '—'}</span>`
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/* ── Render pipeline ───────────────────────────────────────── */

function applyFilter(rows) {
  const now = new Date()
  return rows.filter(r => {
    // Búsqueda global
    if (filterText) {
      const q = filterText.toLowerCase()
      if (!Object.values(r).some(v => String(v).toLowerCase().includes(q))) return false
    }
    // Solo futuros (horario EST/EDT → comparar con hora local)
    if (filters.soloFuturos) {
      const raidDate = parseRaidToDate(r.date, r.time)
      if (!raidDate || raidDate <= now) return false
    }
    // Dificultad
    if (filters.difficulty && r.difficulty !== filters.difficulty) return false
    // Tipo
    if (filters.tipo && r.type !== filters.tipo) return false
    // Loot
    if (filters.loot && r.loot !== filters.loot) return false
    // Lock
    if (filters.lock && r.lock !== filters.lock) return false
    // Raids (contiene)
    if (filters.raids && !r.raids.toLowerCase().includes(filters.raids.toLowerCase())) return false
    // Con descuento — discount es "Discount: ON" / "Discount: OFF"
    if (filters.soloDescuento && !r.discount.includes('ON')) return false
    return true
  })
}

function applySort(rows) {
  if (!sortCol) return rows
  return [...rows].sort((a, b) => {
    let av, bv
    if (sortCol === 'time') {
      av = parseTimeToMinutes(a.time)
      bv = parseTimeToMinutes(b.time)
      return sortAsc ? av - bv : bv - av
    }
    if (sortCol === 'date') {
      const da = parseDateToOrdinal(a.date) * 10000 + parseTimeToMinutes(a.time)
      const db = parseDateToOrdinal(b.date) * 10000 + parseTimeToMinutes(b.time)
      return sortAsc ? da - db : db - da
    }
    av = String(a[sortCol] || '').toLowerCase()
    bv = String(b[sortCol] || '').toLowerCase()
    return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
  })
}

function renderTable() {
  const rows = applySort(applyFilter(allRows))

  if (!rows.length) {
    tbody.innerHTML = `
      <tr class="placeholder">
        <td colspan="11">
          <div class="placeholder-inner">
            <p>Sin resultados para los filtros actuales.</p>
          </div>
        </td>
      </tr>`
    return
  }

  const html = rows.map(r => {
    const diff   = diffClass(r)
    const full   = isFull(r.bookings)
    const rowCls = full ? 'row-full' : `row-${diff}`
    const key    = rowKey(r)
    const flash  = flashMap[key] || ''

    return `
      <tr class="${rowCls} ${flash}" data-key="${esc(key)}">
        <td>${esc(r.date)}</td>
        <td>${esc(r.time)}</td>
        <td>${esc(r.team)}</td>
        <td class="center">${bookingsBadge(r.bookings)}</td>
        <td class="center">${diffBadge(r.difficulty)}</td>
        <td>${esc(r.type)}</td>
        <td>${esc(r.loot)}</td>
        <td>${r.discount ? `<span class="discount">${esc(r.discount)}</span>` : '—'}</td>
        <td>${esc(r.lock) || '—'}</td>
        <td class="wide">${esc(r.raids)}</td>
        <td class="wide">${esc(r.notes) || ''}</td>
      </tr>`
  }).join('')

  tbody.innerHTML = html

  setTimeout(() => {
    Object.keys(flashMap).forEach(k => delete flashMap[k])
  }, 1100)
}

/* ── Flash map ─────────────────────────────────────────────── */
const flashMap = {}

function computeFlashes(newRows) {
  newRows.forEach(r => {
    const k = rowKey(r)
    const old = prevMap[k]
    if (!old)                         flashMap[k] = 'flash-new'
    else if (old.bookings !== r.bookings) flashMap[k] = 'flash-upd'
  })
}

/* ── Dropdown population ───────────────────────────────────── */

function populateSelect(el, values, current) {
  const first = el.options[0]  // "Todas / Todos"
  el.innerHTML = ''
  el.appendChild(first)
  ;[...new Set(values)].filter(Boolean).sort().forEach(v => {
    const opt = document.createElement('option')
    opt.value = v
    opt.textContent = v
    if (v === current) opt.selected = true
    el.appendChild(opt)
  })
}

function refreshDropdowns(rows) {
  populateSelect(fDifficulty, rows.map(r => r.difficulty), filters.difficulty)
  populateSelect(fTipo,       rows.map(r => r.type),       filters.tipo)
  populateSelect(fLoot,       rows.map(r => r.loot),       filters.loot)
  populateSelect(fLock,       rows.map(r => r.lock),       filters.lock)
  // Para raids: extraer raid individuales separados por "&"
  const raidSet = []
  rows.forEach(r => {
    String(r.raids || '').split('&').forEach(s => {
      const t = s.trim().replace(/\d+\/\d+\s*$/, '').trim()
      if (t) raidSet.push(t)
    })
  })
  populateSelect(fRaids, raidSet, filters.raids)
}

/* ── IPC handlers ──────────────────────────────────────────── */

window.api.onRaidsData(payload => {
  const { data, timestamp } = payload

  computeFlashes(data)
  prevMap = {}
  data.forEach(r => { prevMap[rowKey(r)] = r })

  allRows = data
  refreshDropdowns(data)

  infoTs.textContent    = `Actualizado: ${timestamp}`
  infoCount.textContent = `${data.length} raids`
  renderTable()
})

window.api.onScraperStatus(({ running, code }) => {
  scraperOn = running
  statusDot.classList.toggle('running', running)
  statusText.textContent = running ? 'Scraper activo' : `Inactivo${code != null ? ` (exit ${code})` : ''}`
  btnStart.hidden = running
  btnStop.hidden  = !running
})

window.api.onScraperLog(line => {
  logContent.textContent += line
  logContent.scrollTop    = logContent.scrollHeight
  const m = line.match(/Próximo refresco a las (\S+)/)
  if (m) infoNext.textContent = `Próximo refresco: ${m[1]}`
})

window.api.onShowLogs(() => {
  logPanel.hidden = false
  btnLog.style.color = 'var(--gold)'
})

/* ── Buttons ───────────────────────────────────────────────── */

btnStart.addEventListener('click',    () => window.api.startScraper())
btnStop .addEventListener('click',    () => window.api.stopScraper())
document.getElementById('btnNextRuns').addEventListener('click', () => window.api.openNextRuns())
btnLogClear.addEventListener('click', () => { logContent.textContent = '' })

btnRefresh.addEventListener('click', () => {
  window.api.refreshNow()
  btnRefresh.disabled = true
  setTimeout(() => { btnRefresh.disabled = false }, 2000)
})

btnLog.addEventListener('click', () => {
  logPanel.hidden = !logPanel.hidden
  btnLog.style.color = logPanel.hidden ? '' : 'var(--gold)'
})

/* ── Filter controls ───────────────────────────────────────── */

filterInput.addEventListener('input', () => {
  filterText = filterInput.value.trim()
  renderTable()
})

fFuturos.addEventListener('change',   () => { filters.soloFuturos   = fFuturos.checked;    renderTable() })
fDifficulty.addEventListener('change',() => { filters.difficulty    = fDifficulty.value;   renderTable() })
fTipo.addEventListener('change',      () => { filters.tipo          = fTipo.value;         renderTable() })
fLoot.addEventListener('change',      () => { filters.loot          = fLoot.value;         renderTable() })
fLock.addEventListener('change',      () => { filters.lock          = fLock.value;         renderTable() })
fRaids.addEventListener('change',     () => { filters.raids         = fRaids.value;        renderTable() })
fDescuento.addEventListener('change', () => { filters.soloDescuento = fDescuento.checked;  renderTable() })

btnReset.addEventListener('click', () => {
  filterText = ''
  filterInput.value = ''
  Object.keys(filters).forEach(k => {
    filters[k] = typeof filters[k] === 'boolean' ? false : ''
  })
  fFuturos.checked   = false
  fDifficulty.value  = ''
  fTipo.value        = ''
  fLoot.value        = ''
  fLock.value        = ''
  fRaids.value       = ''
  fDescuento.checked = false
  renderTable()
})

/* ── Sort by column header ─────────────────────────────────── */

document.querySelectorAll('th[data-col]').forEach(th => {
  th.addEventListener('click', () => {
    const col = th.dataset.col
    sortAsc = sortCol === col ? !sortAsc : true
    sortCol = col
    document.querySelectorAll('th').forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'))
    th.classList.add(sortAsc ? 'sorted-asc' : 'sorted-desc')
    renderTable()
  })
})

/* ── Init ──────────────────────────────────────────────────── */

window.api.isRunning().then(running => {
  scraperOn = running
  statusDot.classList.toggle('running', running)
  statusText.textContent = running ? 'Scraper activo' : 'Inactivo'
  btnStart.hidden = running
  btnStop.hidden  = !running
})

btnLog.style.color = 'var(--gold)'   // logs abiertos por defecto (debug)
window.api.requestData()
