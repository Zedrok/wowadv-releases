import { parseRaidToDate } from '../../utils/helpers.js'
import { saveFilters, loadFilters } from '../../storage.js'

export const filters = {
  soloFuturos: false,
  difficulty:  '',
  tipo:        '',
  loot:        '',
  lock:        '',
  raids:       '',
  soloDescuento: false,
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
    if (filters.soloFuturos) {
      const raidDate = parseRaidToDate(r.date, r.time)
      if (!raidDate || raidDate <= now) return false
    }
    if (filters.difficulty && r.difficulty !== filters.difficulty) return false
    if (filters.tipo && r.type !== filters.tipo) return false
    if (filters.loot && r.loot !== filters.loot) return false
    if (filters.lock && r.lock !== filters.lock) return false
    if (filters.raids && !r.raids.toLowerCase().includes(filters.raids.toLowerCase())) return false
    if (filters.soloDescuento && !r.discount.includes('ON')) return false
    return true
  })
}

export function populateDropdowns(rows) {
  const fDifficulty = document.getElementById('fDifficulty')
  const fTipo = document.getElementById('fTipo')
  const fLoot = document.getElementById('fLoot')
  const fLock = document.getElementById('fLock')
  const fRaids = document.getElementById('fRaids')

  populateSelect(fDifficulty, rows.map(r => r.difficulty), filters.difficulty)
  populateSelect(fTipo, rows.map(r => r.type), filters.tipo)
  populateSelect(fLoot, rows.map(r => r.loot), filters.loot)
  populateSelect(fLock, rows.map(r => r.lock), filters.lock)

  const raidSet = []
  rows.forEach(r => {
    String(r.raids || '').split('&').forEach(s => {
      const t = s.trim().replace(/\d+\/\d+\s*$/, '').trim()
      if (t) raidSet.push(t)
    })
  })
  populateSelect(fRaids, raidSet, filters.raids)
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
  const fFuturos = document.getElementById('fFuturos')
  const fDifficulty = document.getElementById('fDifficulty')
  const fTipo = document.getElementById('fTipo')
  const fLoot = document.getElementById('fLoot')
  const fLock = document.getElementById('fLock')
  const fRaids = document.getElementById('fRaids')
  const fDescuento = document.getElementById('fDescuento')

  fFuturos.checked   = filters.soloFuturos
  fDifficulty.value  = filters.difficulty
  fTipo.value        = filters.tipo
  fLoot.value        = filters.loot
  fLock.value        = filters.lock
  fRaids.value       = filters.raids
  fDescuento.checked = filters.soloDescuento
}

export function resetFilters() {
  Object.keys(filters).forEach(k => {
    filters[k] = typeof filters[k] === 'boolean' ? false : ''
  })
  document.getElementById('filterInput').value = ''
  filterText = ''
  updateFilterUI()
  saveCurrentFilters()
}
