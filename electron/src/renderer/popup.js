/* ── Helpers (mismo que renderer.js) ──────────────────────── */

let pricesServices = []
let hiddenCombos   = new Set()
function fmtGold(n) {
  if (n >= 1_000) return (n / 1_000).toLocaleString('en', { maximumFractionDigits: 1 }) + 'k'
  return String(n)
}

/* ── Price matching — generic token overlap ────────────────────── */

// Raid categories by difficulty (IDs defined by The Bakers price structure)
// Cat 29 = VIP (tiene entradas Heroic y Normal mezcladas — filtrar por nombre)
// Cat 30 = Heroic (Saved/Unsaved/AOTC)
// Cat 27 = Normal runs
// Cat 34 = ATP Normal
// Cat 38 = Mythic — excluido del matching automático de runs normales/heroic
const STRICT_HEROIC_CATS = new Set([30])
const STRICT_NORMAL_CATS = new Set([27, 34])
const VIP_CAT = 29

const TOKEN_STOP = new Set([
  'the','and','of','on','in','a','an','at','by','for',
  'heroic','normal','unsaved','saved','vip','aotc',
  'full','clear','half','boss','bosses','last','loot',
  'group','run','raid','mythic','with','per'
])

function extractTokens(str) {
  return (str || '').toLowerCase()
    .replace(/[\u2018\u2019']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !TOKEN_STOP.has(t) && !/^\d+$/.test(t))
}

function matchPrices(r) {
  if (!pricesServices.length) return []
  const diff     = (r.difficulty || '').toLowerCase()
  const isHeroic = diff.includes('heroic')
  const isNormal = diff.includes('normal')
  if (!isHeroic && !isNormal) return []

  const raidText  = (r.raids || '') + ' ' + (r.loot || '')
  const rTokens   = new Set(extractTokens(raidText))
  const isUnsaved = raidText.toLowerCase().includes('unsaved')
  const isVip     = (r.raids || '').toLowerCase().includes('vip')

  return pricesServices.filter(s => {
    const sNameLower = s.name.toLowerCase()

    // Cat 29 (VIP): solo para runs VIP, y solo si la dificultad coincide
    if (s.serviceCategoryId === VIP_CAT) {
      if (!isVip) return false
      if (isHeroic && !sNameLower.includes('heroic')) return false
      if (isNormal && !sNameLower.includes('normal')) return false
    } else {
      // Para runs VIP, no mostrar servicios de cats regulares (Solo cat 29)
      if (isVip) return false
      // Para las demás cats, verificar que pertenezcan a la dificultad correcta
      const catOk = isHeroic ? STRICT_HEROIC_CATS.has(s.serviceCategoryId)
                             : STRICT_NORMAL_CATS.has(s.serviceCategoryId)
      if (!catOk) return false
    }

    const sIsUnsaved = sNameLower.includes('unsaved')
    if (isUnsaved !== sIsUnsaved) return false

    const sTokens = extractTokens(sNameLower)
    return sTokens.some(t => rTokens.has(t))
  })
}

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
    <div class="card ${diffCls}${isFull ? ' card-full' : ''}"${r.url ? ` data-url="${esc(r.url)}" style="cursor:pointer"` : ''}>
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

function buildSection(title, badgeCls, raidName, { available, full }, diffCls) {
  // Ocultar sección completa si no hay nada que mostrar
  if (available.length === 0 && full.length === 0) return ''

  let cardsHtml = ''
  if (available.length > 0) {
    cardsHtml += `<div class="carousel-wrap"><button class="carousel-arrow arr-left">&#8249;</button><div class="cards-row">${available.map(r => buildCard(r, diffCls, false)).join('')}</div><button class="carousel-arrow arr-right">&#8250;</button></div>`
  }
  if (full.length > 0) {
    cardsHtml += `<div class="row-label">Full</div><div class="carousel-wrap"><button class="carousel-arrow arr-left">&#8249;</button><div class="cards-row">${full.map(r => buildCard(r, diffCls, true)).join('')}</div><button class="carousel-arrow arr-right">&#8250;</button></div>`
  }

  // Precios asociados a esta categoría
  const sampleRow = available[0] || full[0]
  const matched = sampleRow ? matchPrices(sampleRow) : []
  const priceRows = matched.map(s => {
    const name = s.name.replace(/^🔸\s*/, '')
    return `<div class="ptip-row"><span class="ptip-name">${esc(name)}</span><span class="ptip-price">${fmtGold(s.price)}</span></div>`
  }).join('')
  const priceTip = matched.length ? `<div class="price-tip" hidden>${priceRows}</div>` : ''

  return `
    <div class="section">
      <div class="section-title">
        <span class="badge ${badgeCls}">${title}</span>
        <span class="section-count">${available.length} disponible${available.length !== 1 ? 's' : ''}${full.length > 0 ? ` · ${full.length} full` : ''}</span>
        ${priceTip}
      </div>
      <div class="section-raids-name">${esc(raidName)}</div>
      ${cardsHtml}
    </div>`
}

/* ── Filter panel ──────────────────────────────────────────── */

function updateFilterPanel(combos) {
  const panel = document.getElementById('filterPanel')
  const currentKeys = new Set(combos.map(c => `${c.raids}||${c.diff}||${c.loot}`))

  // Quitar chips de combos que ya no existen
  panel.querySelectorAll('.filter-chip').forEach(chip => {
    if (!currentKeys.has(chip.dataset.key)) chip.remove()
  })

  // Agregar chips nuevos
  combos.forEach(({ raids, diff, loot }) => {
    const key = `${raids}||${diff}||${loot}`
    if (panel.querySelector(`[data-key="${CSS.escape(key)}"]`)) return
    const diffCls = diff.toLowerCase().includes('heroic') ? 'heroic' : 'normal'
    const chip = document.createElement('span')
    chip.className = `filter-chip chip-${diffCls}`
    chip.dataset.key = key
    chip.textContent = `${raids} · ${diff} · ${loot}`
    chip.addEventListener('click', () => {
      if (hiddenCombos.has(key)) hiddenCombos.delete(key)
      else hiddenCombos.add(key)
      render()
    })
    panel.appendChild(chip)
  })

  // Actualizar estado visual de todos los chips
  panel.querySelectorAll('.filter-chip').forEach(chip => {
    chip.classList.toggle('hidden-chip', hiddenCombos.has(chip.dataset.key))
  })
}

/* ── Main render ───────────────────────────────────────────── */

async function render() {
  // Asegurar precios cargados
  if (!pricesServices.length) {
    const pd = await window.api.getPrices()
    pricesServices = pd?.services || []
  }
  const payload = await window.api.getRaids()
  const allRows = (payload?.data || []).map(r => ({
    ...r,
    raids:      (r.raids      || '').trim().replace(/\s+/g, ' '),
    difficulty: (r.difficulty || '').trim().replace(/\s+/g, ' '),
    loot:       (r.loot       || '').trim().replace(/\s+/g, ' '),
  }))
  const now     = new Date()

  document.getElementById('lastUpdate').textContent =
    payload?.timestamp ? `Actualizado: ${payload.timestamp}` : '—'

  // Filtrar: solo futuros (con 5 min de gracia) + solo unlocked + solo hoy
  const GRACE_MS = 5 * 60 * 1000
  const todayStr = `${now.getMonth() + 1}`.padStart(2, '0') + '/' + `${now.getDate()}`.padStart(2, '0')
  const future = allRows.filter(r => {
    const isUnlocked = r.lock.toLowerCase().includes('unlocked')
    if (!isUnlocked) return false
    // r.date es "Thursday 03/26" — extraer MM/DD
    const datePart = (r.date || '').split(' ')[1] || ''
    if (datePart !== todayStr) return false
    const d = parseRaidToDate(r.date, r.time)
    const isFuture = d && (d.getTime() + GRACE_MS) > now
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

  const showFull = document.getElementById('chkFull').checked

  // Recopilar todas las combinaciones raids+dificultad+loot presentes
  const combos = []
  const seen   = new Set()
  future
    .slice()
    .sort((a, b) => raidSortKey(a) - raidSortKey(b))
    .forEach(r => {
      const key = `${r.raids}||${r.difficulty}||${r.loot}`
      if (!seen.has(key)) { seen.add(key); combos.push({ raids: r.raids, diff: r.difficulty, loot: r.loot }) }
    })

  const take = (raids, diff, loot) => {
    const matching = future
      .filter(r => r.raids === raids && r.difficulty === diff && r.loot === loot)
      .sort((a, b) => raidSortKey(a) - raidSortKey(b))
    const available = matching.filter(r => !isFull(r.bookings))
    const full      = showFull ? matching.filter(r => isFull(r.bookings)) : []
    return { available, full }
  }

  updateFilterPanel(combos)

  const visibleCombos = combos.filter(({ raids, diff, loot }) => !hiddenCombos.has(`${raids}||${diff}||${loot}`))
  const html = visibleCombos.map(({ raids, diff, loot }) => {
    const diffCls  = diff.toLowerCase().includes('heroic') ? 'heroic' : 'normal'
    const badgeCls = `badge-${diffCls}`
    const title    = `${diff} · ${loot}`
    return buildSection(title, badgeCls, raids, take(raids, diff, loot), diffCls)
  }).join('')

  document.getElementById('content').innerHTML = html

  // Inicializar fades y listener scroll en cada carrusel
  document.querySelectorAll('.cards-row').forEach(row => {
    updateCarouselFades(row)
    row.addEventListener('scroll', () => updateCarouselFades(row), { passive: true })
  })
}

// ── Botones ────────────────────────────────────────────────
document.getElementById('btnReload').addEventListener('click', async () => {
  const btn = document.getElementById('btnReload')
  btn.textContent = 'Scraping…'
  btn.disabled = true

  // Capturar timestamp actual antes de disparar el scrape
  const before = (await window.api.getRaids())?.timestamp ?? null
  window.api.triggerScrape()

  // Polling hasta que el timestamp cambie (máx 60s)
  const deadline = Date.now() + 60000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1000))
    const current = (await window.api.getRaids())?.timestamp ?? null
    if (current !== before) break
  }

  await render()
  btn.textContent = 'Actualizar'
  btn.disabled = false
})

document.getElementById('chkFull').addEventListener('change', render)

document.getElementById('content').addEventListener('click', e => {
  // No propagar clicks del botón de precios
  if (e.target.closest('.btn-price-info')) { e.stopPropagation(); return }
  const card = e.target.closest('[data-url]')
  if (card) window.api.openUrl(card.dataset.url)
})

document.getElementById('btnCompact').addEventListener('click', () => {
  const isCompact = document.body.classList.toggle('compact')
  document.getElementById('btnCompact').classList.toggle('active', isCompact)
})

document.getElementById('btnFilter').addEventListener('click', () => {
  const panel = document.getElementById('filterPanel')
  panel.hidden = !panel.hidden
  document.getElementById('btnFilter').classList.toggle('active', !panel.hidden)
})

// Auto-actualizar cuando llegan datos nuevos
window.api.onRaidsData(() => render())

// ── Flechas de carrusel ────────────────────────────────────
document.getElementById('content').addEventListener('click', e => {
  const arrow = e.target.closest('.carousel-arrow')
  if (!arrow) return
  const row = arrow.closest('.carousel-wrap')?.querySelector('.cards-row')
  if (!row) return
  const cardW = row.querySelector('.card')?.offsetWidth || 0
  const gap   = 5
  const delta = (cardW + gap) * (arrow.classList.contains('arr-left') ? -1 : 1)
  row.scrollBy({ left: delta, behavior: 'smooth' })
})

// ── Drag-to-scroll en carruseles ────────────────────────────
function updateCarouselFades(row) {
  const wrap = row.closest('.carousel-wrap')
  if (!wrap) return
  wrap.classList.toggle('has-left',  row.scrollLeft > 2)
  wrap.classList.toggle('has-right', row.scrollLeft + row.clientWidth < row.scrollWidth - 2)
}

document.getElementById('content').addEventListener('mousedown', e => {
  const row = e.target.closest('.cards-row')
  if (!row) return
  row.classList.add('dragging')
  const startX = e.pageX - row.offsetLeft
  const scrollLeft = row.scrollLeft

  const onMove = ev => {
    if (!row.classList.contains('dragging')) return
    ev.preventDefault()
    const x = ev.pageX - row.offsetLeft
    row.scrollLeft = scrollLeft - (x - startX)
    updateCarouselFades(row)
  }
  const onUp = () => {
    row.classList.remove('dragging')
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
})

// Tooltip de precios — sigue el cursor, flip arriba/abajo según espacio
const content = document.getElementById('content')
let activeTip = null

function positionTip(tip, e) {
  const margin = 14
  // Posicionar fuera de pantalla para medir tamaño real
  tip.style.left = '-9999px'
  tip.style.top  = '-9999px'
  tip.hidden = false

  const tipW = tip.offsetWidth  || 220
  const tipH = tip.offsetHeight || 80
  const vw   = window.innerWidth
  const vh   = window.innerHeight

  // Por defecto: abajo-derecha del cursor
  let x = e.clientX + margin
  let y = e.clientY + margin

  // Flip horizontal si desborda por la derecha
  if (x + tipW > vw - 4) x = e.clientX - tipW - margin

  // Flip vertical si desborda por abajo
  if (y + tipH > vh - 4) y = e.clientY - tipH - margin

  // Clamp dentro del viewport
  x = Math.max(4, Math.min(x, vw - tipW - 4))
  y = Math.max(4, Math.min(y, vh - tipH - 4))

  tip.style.left = x + 'px'
  tip.style.top  = y + 'px'
}

content.addEventListener('mouseover', e => {
  const card = e.target.closest('.card')
  if (!card) return
  const tip = card.closest('.section')?.querySelector('.price-tip')
  if (!tip) return
  activeTip = tip
  positionTip(tip, e)
})

content.addEventListener('mousemove', e => {
  if (!activeTip || activeTip.hidden) return
  positionTip(activeTip, e)
})

content.addEventListener('mouseout', e => {
  const card = e.target.closest('.card')
  if (!card) return
  // Solo ocultar si el mouse sale de la card completamente
  if (card.contains(e.relatedTarget)) return
  const tip = card.closest('.section')?.querySelector('.price-tip')
  if (tip) {
    tip.hidden = true
    activeTip = null
  }
})

render()
