/** Date/time parsing helpers */

export function parseTimeToMinutes(timeStr) {
  const m = String(timeStr || '').match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!m) return 0
  let h = parseInt(m[1])
  const min = parseInt(m[2])
  const period = m[3].toUpperCase()
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return h * 60 + min
}

export function parseDateToOrdinal(dateStr) {
  const m = String(dateStr || '').match(/(\d+)\/(\d+)/)
  if (!m) return 0
  return parseInt(m[1]) * 100 + parseInt(m[2])
}

function nthSunday(year, month, n) {
  const d = new Date(year, month - 1, 1)
  const firstSun = (7 - d.getDay()) % 7 + 1
  return new Date(year, month - 1, firstSun + (n - 1) * 7)
}

function isEDT(year, month, day) {
  const start = nthSunday(year, 3, 2)
  const end   = nthSunday(year, 11, 1)
  const d = new Date(year, month - 1, day)
  return d >= start && d < end
}

export function parseRaidToDate(dateStr, timeStr) {
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

  const offsetH = isEDT(year, month, day) ? 4 : 5
  return new Date(Date.UTC(year, month - 1, day, h + offsetH, min))
}

/** Utility helpers */

export function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function rowKey(r) {
  return `${r.date}|${r.time}|${r.team}`
}

export function isFull(bookings) {
  if (!bookings || !bookings.includes('/')) return false
  const [b, t] = bookings.split('/').map(s => parseInt(s.trim(), 10))
  return !isNaN(b) && !isNaN(t) && t > 0 && b >= t
}

export function highLoad(bk) {
  if (!bk || !bk.includes('/')) return false
  const [b, t] = bk.split('/').map(s => parseInt(s.trim(), 10))
  return !isNaN(b) && !isNaN(t) && t > 0 && b / t >= 0.8
}
