import { esc, rowKey, isFull, parseTimeToMinutes, parseDateToOrdinal } from '../../utils/helpers.js'
import { diffBadge, bookingsBadge } from '../../utils/formatters.js'

export let allRows = []
export let sortCol = null
export let sortAsc = true
export let prevMap = {}
export const flashMap = {}

export function setSortCol(col) {
  sortAsc = sortCol === col ? !sortAsc : true
  sortCol = col
}

export function applySort(rows, col = sortCol) {
  if (!col) return rows
  return [...rows].sort((a, b) => {
    let av, bv
    if (col === 'time') {
      av = parseTimeToMinutes(a.time)
      bv = parseTimeToMinutes(b.time)
      return sortAsc ? av - bv : bv - av
    }
    if (col === 'date') {
      const da = parseDateToOrdinal(a.date) * 10000 + parseTimeToMinutes(a.time)
      const db = parseDateToOrdinal(b.date) * 10000 + parseTimeToMinutes(b.time)
      return sortAsc ? da - db : db - da
    }
    av = String(a[col] || '').toLowerCase()
    bv = String(b[col] || '').toLowerCase()
    return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
  })
}

export function computeFlashes(newRows, prevMapParam = prevMap) {
  newRows.forEach(r => {
    const k = rowKey(r)
    const old = prevMapParam[k]
    if (!old) flashMap[k] = 'flash-new'
    else if (old.bookings !== r.bookings) flashMap[k] = 'flash-upd'
  })
}

export function buildRow(r, favorites) {
  const diff   = (r.difficulty || '').toLowerCase().includes('heroic') ? 'heroic'
               : (r.difficulty || '').toLowerCase().includes('normal') ? 'normal'
               : 'other'
  const full   = isFull(r.bookings)
  const rowCls = full ? 'row-full' : `row-${diff}`
  const key    = rowKey(r)
  const flash  = flashMap[key] || ''
  const isFav  = favorites.includes(key)
  const favStar = isFav ? '⭐' : '☆'

  return `
    <tr class="${rowCls} ${flash}${isFav ? ' row-favorite' : ''}" data-key="${esc(key)}"${r.url ? ` data-url="${esc(r.url)}"` : ''}>
      <td class="fav-col"><button class="btn-fav" data-key="${esc(key)}" title="Marcar/desmarcar favorito">${favStar}</button></td>
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
}

export function renderTable(tbody, rows, favorites, onFavToggle, onRowClick) {
  if (!rows.length) {
    tbody.innerHTML = `
      <tr class="placeholder">
        <td colspan="12">
          <div class="placeholder-inner">
            <p>Sin resultados para los filtros actuales.</p>
          </div>
        </td>
      </tr>`
    return
  }

  const html = rows.map(r => buildRow(r, favorites)).join('')
  tbody.innerHTML = html

  // Attach event listeners
  tbody.querySelectorAll('.btn-fav').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      onFavToggle(btn.dataset.key)
    })
  })

  tbody.querySelectorAll('tr[data-url]').forEach(tr => {
    tr.style.cursor = 'pointer'
    tr.title = 'Abrir en navegador'
    tr.addEventListener('click', () => onRowClick(tr.dataset.url))
  })

  // Clear flashes after animation
  setTimeout(() => {
    Object.keys(flashMap).forEach(k => delete flashMap[k])
  }, 1100)
}

export function updateSortUI(colName) {
  document.querySelectorAll('th').forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'))
  const th = document.querySelector(`th[data-col="${colName}"]`)
  if (th) th.classList.add(sortAsc ? 'sorted-asc' : 'sorted-desc')
}
