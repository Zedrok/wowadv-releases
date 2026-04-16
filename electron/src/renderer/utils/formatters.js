import { isFull, highLoad, esc } from './helpers.js'

export function diffClass(r) {
  const d = (r.difficulty || '').toLowerCase()
  if (d.includes('heroic')) return 'heroic'
  if (d.includes('normal')) return 'normal'
  return 'other'
}

export function bookingsBadge(bk) {
  const full = isFull(bk)
  const high = !full && highLoad(bk)
  const cls  = full ? 'full' : high ? 'high' : ''
  return `<span class="bookings ${cls}">${bk || '—'}</span>`
}

export function diffBadge(diff) {
  const d = (diff || '').toLowerCase()
  const cls = d.includes('heroic') ? 'diff-heroic'
            : d.includes('normal') ? 'diff-normal'
            : 'diff-other'
  return `<span class="diff ${cls}">${diff || '—'}</span>`
}
