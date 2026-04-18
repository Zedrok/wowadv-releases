import { parseRaidToDate } from '../../utils/helpers.js'
import { saveFilters, loadFilters } from '../../storage.js'

export const filters = {
  mostrarAnteriores: false,
  difficulty:        '',
  tipo:              '',
  loot:              '',
  lock:              'Unlocked',
  raids:             '',
  team:              '',
  day:               '',
  soloDisponibles:   true,
  soloDescuento:     false,
}

export let filterText = ''

export function loadSavedFilters() {
  const saved = loadFilters()
  if (saved) Object.assign(filters, saved)
  return saved !== null
}

export function saveCurrentFilters() {
  saveFilters(filters)
}

export function setFilterText(text) {
  filterText = text.trim()
}

export function applyFilter(rows) {
  const now = new Date()
  return rows.filter(r => {
    if (filterText) {
      const q = filterText.toLowerCase()
      if (!Object.values(r).some(v => String(v).toLowerCase().includes(q))) return false
    }
    // Si NO está marcado "Mostrar Anteriores", solo muestra raids futuras
    if (!filters.mostrarAnteriores) {
      const raidDate = parseRaidToDate(r.date, r.time)
      if (!raidDate || raidDate <= now) return false
    }
    if (filters.day && r.date !== filters.day) return false
    if (filters.difficulty && r.difficulty !== filters.difficulty) return false
    if (filters.tipo && r.type !== filters.tipo) return false
    if (filters.loot && r.loot !== filters.loot) return false
    // Si "Mostrar Anteriores" está activo, ignora el filtro de lock (muestra todo)
    if (!filters.mostrarAnteriores && filters.lock && r.lock !== filters.lock) return false
    if (filters.raids && !r.raids.toLowerCase().includes(filters.raids.toLowerCase())) return false
    if (filters.team && r.team !== filters.team) return false
    // Si "Mostrar Anteriores" está activo, ignora el filtro de disponibilidad (muestra todo)
    if (!filters.mostrarAnteriores && filters.soloDisponibles) {
      const [used, total] = (r.bookings || '').split('/').map(Number)
      if (isNaN(used) || isNaN(total) || used >= total) return false
    }
    if (filters.soloDescuento && !r.discount.includes('ON')) return false
    return true
  })
}

export function populateDropdowns(rows) {
  const fDay = document.getElementById('fDay')
  const fDifficulty = document.getElementById('fDifficulty')
  const fTipo = document.getElementById('fTipo')
  const fLoot = document.getElementById('fLoot')
  const fLock = document.getElementById('fLock')
  const fRaids = document.getElementById('fRaids')
  const fTeam = document.getElementById('fTeam')

  populateSelectByDate(fDay, rows.map(r => r.date), filters.day)
  populateSelect(fDifficulty, rows.map(r => r.difficulty), filters.difficulty)
  populateSelect(fTipo, rows.map(r => r.type), filters.tipo)
  populateSelect(fLoot, rows.map(r => r.loot), filters.loot)
  populateSelect(fTeam, rows.map(r => r.team), filters.team)

  const raidSet = []
  rows.forEach(r => {
    String(r.raids || '').split('&').forEach(s => {
      const t = s.trim().replace(/\d+\/\d+\s*$/, '').trim()
      if (t) raidSet.push(t)
    })
  })
  populateSelect(fRaids, raidSet, filters.raids)
}

function populateSelectByDate(el, values, current) {
  const first = el.options[0]
  el.innerHTML = ''
  el.appendChild(first)

  const uniqueDates = [...new Set(values)].filter(Boolean)
  const today = new Date()

  uniqueDates.sort((a, b) => {
    const dateA = parseRaidToDate(a)
    const dateB = parseRaidToDate(b)
    if (!dateA || !dateB) return 0
    return dateA.getTime() - dateB.getTime()
  })

  uniqueDates.forEach(v => {
    const opt = document.createElement('option')
    opt.value = v
    opt.textContent = v
    if (v === current) opt.selected = true
    el.appendChild(opt)
  })
}

function populateSelect(el, values, current) {
  const first = el.options[0]
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

export function updateFilterUI() {
  const fAnteriores = document.getElementById('fAnteriores')
  const fDay = document.getElementById('fDay')
  const fDifficulty = document.getElementById('fDifficulty')
  const fTipo = document.getElementById('fTipo')
  const fLoot = document.getElementById('fLoot')
  const fLock = document.getElementById('fLock')
  const fRaids = document.getElementById('fRaids')
  const fDescuento = document.getElementById('fDescuento')

  fAnteriores.checked = filters.mostrarAnteriores
  fDay.value         = filters.day
  fDifficulty.value  = filters.difficulty
  fTipo.value        = filters.tipo
  fLoot.value        = filters.loot
  fLock.checked      = filters.lock === 'Unlocked'
  fRaids.value       = filters.raids
  document.getElementById('fTeam').value            = filters.team
  document.getElementById('fDisponibles').checked   = filters.soloDisponibles
  fDescuento.checked = filters.soloDescuento
}

export function resetFilters() {
  filters.mostrarAnteriores = false
  filters.difficulty = ''
  filters.tipo = ''
  filters.loot = ''
  filters.lock = 'Unlocked'
  filters.raids = ''
  filters.team = ''
  filters.day = ''
  filters.soloDisponibles = true
  filters.soloDescuento = false
  document.getElementById('filterInput').value = ''
  filterText = ''
  updateFilterUI()
  saveCurrentFilters()
}
