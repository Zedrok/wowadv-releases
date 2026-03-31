/* ── Helpers (mismo que renderer.js) ──────────────────────── */

function parseTimeToMinutes(timeStr) {
  const m = String(timeStr || '').match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!m) return 0
  let h = parseInt(m[1])
  const min = parseInt(m[2])
  const per = m[3].toUpperCase()
  if (per === 'PM' && h !== 12) h += 12
  if (per === 'AM' && h === 12) h = 0
  return h * 60 + min
}

function parseDateToOrdinal(dateStr) {
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

function parseRaidToDate(dateStr, timeStr) {
  const dm = String(dateStr || '').match(/(\d+)\/(\d+)/)
  const tm = String(timeStr || '').match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!dm || !tm) return null
  const year = new Date().getFullYear()
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

function raidSortKey(r) {
  return parseDateToOrdinal(r.date) * 10000 + parseTimeToMinutes(r.time)
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function highLoad(bk) {
  if (!bk || !bk.includes('/')) return false
  const [b, t] = bk.split('/').map(s => parseInt(s.trim(), 10))
  return !isNaN(b) && !isNaN(t) && t > 0 && b / t >= 0.8
}

/* ── Build card HTML ───────────────────────────────────────── */

function buildCard(r, diffCls, isFull) {
  const booksClass = highLoad(r.bookings) ? 'high' : ''
  const hasDiscount = r.discount.includes('ON')

  // Fecha corta: "Thu 03/26"
  const dateParts = (r.date || '').split(' ')
  const dateShort = dateParts.length >= 2
    ? `${dateParts[0].slice(0, 3)} ${dateParts[1]}`
    : r.date

  return `
    <div class="card ${diffCls}${isFull ? ' card-full' : ''}">
      <div class="card-top">
        <span class="card-datetime">${esc(dateShort)} · ${esc(r.time)}</span>
        <span class="card-books ${booksClass}">${esc(r.bookings)}</span>
      </div>
      <div class="card-meta">
        <span class="card-team">${esc(r.team)}</span>
        <span class="card-type">${esc(r.type)}</span>
      </div>
      <div class="card-raids" title="${esc(r.raids)}">${esc(r.raids)}</div>
      <div class="card-footer">
        ${hasDiscount ? '<span class="tag tag-discount">Discount ON</span>' : ''}
        <span class="tag tag-loot">${esc(r.loot)}</span>
      </div>
      ${r.notes ? `<div class="card-notes">${esc(r.notes)}</div>` : ''}
    </div>`
}

/* ── Build section HTML ────────────────────────────────────── */

function buildSection(title, badgeCls, { available, full }, diffCls) {
  const total = available.length + full.length
  let cardsHtml = ''

  if (total === 0) {
    cardsHtml = `<p class="no-runs">Sin próximos runs.</p>`
  } else {
    if (available.length > 0) {
      cardsHtml += `<div class="cards-col">${available.map(r => buildCard(r, diffCls, false)).join('')}</div>`
    }
    if (full.length > 0) {
      cardsHtml += `<div class="row-label">Full</div><div class="cards-col">${full.map(r => buildCard(r, diffCls, true)).join('')}</div>`
    }
  }

  return `
    <div class="section">
      <div class="section-title">
        <span class="badge ${badgeCls}">${title}</span>
        <span class="section-count">${available.length} disponible${available.length !== 1 ? 's' : ''}${full.length > 0 ? ` · ${full.length} full` : ''}</span>
      </div>
      ${cardsHtml}
    </div>`
}

/* ── Main render ───────────────────────────────────────────── */

async function render() {
  const payload = await window.api.getRaids()
  const allRows = payload?.data || []
  const now     = new Date()

  document.getElementById('lastUpdate').textContent =
    payload?.timestamp ? `Actualizado: ${payload.timestamp}` : '—'

  // Filtrar: solo futuros + solo unlocked
  const future = allRows.filter(r => {
    const isUnlocked = r.lock.toLowerCase().includes('unlocked')
    if (!isUnlocked) return false
    const d = parseRaidToDate(r.date, r.time)
    const isFuture = d && d > now
    if (!isFuture) {
      console.log(`[SKIP past/invalid] ${r.date} ${r.time} | lock="${r.lock}" | parsed=${d ? d.toISOString() : 'null'} | now=${now.toISOString()}`)
    }
    return isFuture
  })

  console.log(`[popup] allRows=${allRows.length} | future+unlocked=${future.length}`)
  console.log('[popup] future runs:', future.map(r => `${r.date} ${r.time} ${r.difficulty} ${r.loot} lock="${r.lock}"`))

  // Separar por dificultad, ordenar por fecha+hora, tomar los 2 próximos
  function isFull(bookings) {
    if (!bookings || !bookings.includes('/')) return false
    const [b, t] = bookings.split('/').map(s => parseInt(s.trim(), 10))
    return !isNaN(b) && !isNaN(t) && t > 0 && b >= t
  }

  const take = (diff, lootIsGroup, showFull) => {
    const matching = future
      .filter(r => {
        if (r.difficulty !== diff) return false
        const isGroup = r.loot.toLowerCase().includes('group')
        return lootIsGroup ? isGroup : !isGroup
      })
      .sort((a, b) => raidSortKey(a) - raidSortKey(b))

    const available = matching.filter(r => !isFull(r.bookings)).slice(0, 2)
    const full      = showFull ? matching.filter(r => isFull(r.bookings)).slice(0, 2) : []
    return { available, full }
  }

  const showFull    = document.getElementById('chkFull').checked
  const heroicGroup = take('Heroic', true,  showFull)
  const normalGroup = take('Normal', true,  showFull)

  const html =
    buildSection('Heroic · Group Loot', 'badge-heroic', heroicGroup, 'heroic') +
    buildSection('Normal · Group Loot', 'badge-normal', normalGroup, 'normal')

  document.getElementById('content').innerHTML = html
}

// ── Botones ────────────────────────────────────────────────
document.getElementById('btnReload').addEventListener('click', render)
document.getElementById('chkFull').addEventListener('change', render)

document.getElementById('btnCompact').addEventListener('click', () => {
  const isCompact = document.body.classList.toggle('compact')
  document.getElementById('btnCompact').classList.toggle('active', isCompact)
})

render()
