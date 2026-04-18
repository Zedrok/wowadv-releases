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

  const raidDataAttr = r.url ? ` data-raid='${JSON.stringify({date: r.date, time: r.time, raids: r.raids, team: r.team, difficulty: r.difficulty}).replace(/'/g, "&apos;")}'` : ''

  return `
    <div class="card ${diffCls}${isFull ? ' card-full' : ''}${r.isPastExpired ? ' past-expired' : ''}"${r.url ? ` data-url="${esc(r.url)}" style="cursor:pointer"` : ''}${r.isFuture ? ' data-future="true"' : ''}${r.isFutureStrict ? ' data-future-strict="true"' : ''}${raidDataAttr}>
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

function buildSection(title, raidType, takeBySavedState, showFull, isFull) {
  const unsavedData = takeBySavedState(raidType, false)
  const savedData = takeBySavedState(raidType, true)

  // Ocultar sección completa si no hay nada que mostrar
  const totalRaids = unsavedData.allRaids.length + savedData.allRaids.length
  if (totalRaids === 0) return ''

  // Count available vs full
  const totalAvail = [...unsavedData.allRaids, ...savedData.allRaids].filter(r => !isFull(r.bookings)).length
  const totalFull = [...unsavedData.allRaids, ...savedData.allRaids].filter(r => isFull(r.bookings)).length

  let cardsHtml = ''

  const savedColor = raidType === 'Mythic' ? 'mythic' : 'heroic'

  // Helper para generar precio tooltip
  const buildPriceTip = (matched) => {
    if (!matched.length) return ''
    const priceRows = matched.map(s => {
      const name = s.name.replace(/^🔸\s*/, '')
      return `<div class="ptip-row"><span class="ptip-name">${esc(name)}</span><span class="ptip-price">${fmtGold(s.price)}</span></div>`
    }).join('')
    return `<div class="price-tip" hidden>${priceRows}</div>`
  }

  // Mostrar Unsaved (color normal = azul) - con precios separados
  if (unsavedData.allRaids.length > 0) {
    const allUnsaved = unsavedData.allRaids
    const unsavedSample = allUnsaved[0]
    const unsavedMatched = unsavedSample ? matchPrices(unsavedSample) : []
    const unsavedPriceTip = buildPriceTip(unsavedMatched)
    cardsHtml += `<span class="badge badge-normal">Unsaved</span><div class="carousel-wrap">${unsavedPriceTip}<button class="carousel-arrow arr-left">&#8249;</button><div class="cards-row">${allUnsaved.map(r => buildCard(r, 'normal', isFull(r.bookings))).join('')}</div><button class="carousel-arrow arr-right">&#8250;</button></div>`
  }

  // Mostrar Saved (color específico por raidType) - con precios separados
  const allSaved = savedData.allRaids
  if (allSaved.length > 0) {
    const badgeLabel = raidType === 'Mythic' ? 'Mythic' : 'Saved'
    const savedSample = allSaved[0]
    const savedMatched = savedSample ? matchPrices(savedSample) : []
    const savedPriceTip = buildPriceTip(savedMatched)
    cardsHtml += `<span class="badge badge-${savedColor}">${badgeLabel}</span><div class="carousel-wrap">${savedPriceTip}<button class="carousel-arrow arr-left">&#8249;</button><div class="cards-row">${allSaved.map(r => buildCard(r, savedColor, isFull(r.bookings))).join('')}</div><button class="carousel-arrow arr-right">&#8250;</button></div>`
  }

  // No hay priceTip global — cada carousel tiene su propio tooltip
  const priceTip = ''

  return `
    <div class="section">
      <div class="section-title">
        <span class="badge">${title}</span>
        <span class="section-count">${totalAvail} disponible${totalAvail !== 1 ? 's' : ''}${totalFull > 0 ? ` · ${totalFull} full` : ''}</span>
        ${priceTip}
      </div>
      ${cardsHtml}
    </div>`
}

/* ── Filter panel ──────────────────────────────────────────── */

function updateFilterPanel(combos) {
  const panel = document.getElementById('filterPanel')
  const currentKeys = new Set(combos.map(c => c.raidType))

  // Quitar chips de combos que ya no existen
  panel.querySelectorAll('.filter-chip').forEach(chip => {
    if (!currentKeys.has(chip.dataset.key)) chip.remove()
  })

  // Agregar chips nuevos
  combos.forEach(({ raidType }) => {
    if (panel.querySelector(`[data-key="${CSS.escape(raidType)}"]`)) return
    const diffCls = raidType === 'Mythic' ? 'mythic' : 'normal'
    const chip = document.createElement('span')
    chip.className = `filter-chip chip-${diffCls}`
    chip.dataset.key = raidType
    chip.textContent = raidType
    chip.addEventListener('click', () => {
      if (hiddenCombos.has(raidType)) hiddenCombos.delete(raidType)
      else hiddenCombos.add(raidType)
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

  // Filtrar: filtros
  const GRACE_MS = 5 * 60 * 1000
  const todayStr = `${now.getMonth() + 1}`.padStart(2, '0') + '/' + `${now.getDate()}`.padStart(2, '0')
  const mostrarAnteriores = document.getElementById('chkPast').checked
  const soloUnlocked = document.getElementById('chkUnlocked').checked
  const soloDisponibles = document.getElementById('chkFull') ? !document.getElementById('chkFull').checked : true

  const allFiltered = allRows.filter(r => {
    // SIEMPRE filtrar por fecha: solo runs de hoy
    const datePart = (r.date || '').split(' ')[1] || ''
    if (datePart !== todayStr) return false

    // Aplicar filtro de Unlocked si está marcado (y no se muestran anteriores)
    if (soloUnlocked && !mostrarAnteriores) {
      const isUnlocked = r.lock.toLowerCase().includes('unlocked')
      if (!isUnlocked) return false
    }

    // Si "Mostrar Anteriores" NO está activo, aplica filtro de disponibilidad
    if (!mostrarAnteriores) {
      // Filtra por disponibilidad si el checkbox de "Full" está activado
      if (soloDisponibles) {
        const [used, total] = (r.bookings || '').split('/').map(Number)
        if (isNaN(used) || isNaN(total) || used >= total) return false
      }
    }
    // Si "Mostrar Anteriores" está activo: muestra todo (sin filtros de lock/full)

    return true
  })

  // Marcar cuáles son futuros y ordenar (futuros primero)
  const PAST_EXPIRY_MS = 15 * 60 * 1000  // 15 minutos
  const future = allFiltered.map(r => {
    const d = parseRaidToDate(r.date, r.time)
    const isFuture = d && (d.getTime() + GRACE_MS) > now
    // isFutureStrict: sin ventana de gracia, para posicionar carrusel cuando mostrarAnteriores está activo
    const isFutureStrict = d && d.getTime() > now
    // isPastExpired: raid pasó hace más de 15 minutos
    const isPastExpired = d && (now.getTime() - d.getTime()) > PAST_EXPIRY_MS
    return { ...r, isFuture, isFutureStrict, isPastExpired, parsedDate: d }
  })
    .filter(r => r.isFuture || mostrarAnteriores)
    .sort((a, b) => {
      // Primero futuros, luego pasados
      if (a.isFuture !== b.isFuture) return a.isFuture ? -1 : 1
      // Dentro de cada grupo, ordenar por fecha/hora
      return raidSortKey(a) - raidSortKey(b)
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

  // Helper para parsear tipo de raid (March, Void, Mythic)
  function getRaidType(raids, difficulty) {
    const text = (raids || '').toLowerCase()
    // Si la dificultad es Mythic, categorizar como Mythic
    if (difficulty?.includes('Mythic')) return { name: 'Mythic', order: 2 }
    // Si contiene Mythic en el texto pero no es la dificultad, aún así es Mythic
    if (text.includes('mythic')) return { name: 'Mythic', order: 2 }
    if (text.includes('void') || text.includes('dream')) return { name: 'Void', order: 0 }
    if (text.includes('march')) return { name: 'March', order: 1 }
    return { name: 'Other', order: 3 }
  }

  // Agrupar solo por Raid Type
  const combos = []
  const seen   = new Set()
  future
    .slice()
    .sort((a, b) => raidSortKey(a) - raidSortKey(b))
    .forEach(r => {
      const raidType = getRaidType(r.raids, r.difficulty)
      const key = raidType.name
      if (!seen.has(key)) {
        seen.add(key)
        combos.push({ raidType: raidType.name, raidOrder: raidType.order })
      }
    })

  // Ordenar combos: por raid type
  combos.sort((a, b) => a.raidOrder - b.raidOrder)

  const takeByType = (raidType) => {
    const matching = future
      .filter(r => getRaidType(r.raids, r.difficulty).name === raidType)
      .sort((a, b) => raidSortKey(a) - raidSortKey(b))
    return matching
  }

  const takeBySavedState = (raidType, isSaved) => {
    const all = takeByType(raidType)
    const filtered = all.filter(r => {
      const s = r.raids.includes('UNSAVED') ? 'Unsaved' : 'Saved'
      return isSaved ? s === 'Saved' : s === 'Unsaved'
    })
    // Return single array (already ordered by hour from takeByType)
    // Full raids will appear in correct time order, not at the end
    return { allRaids: filtered }
  }

  updateFilterPanel(combos)

  const visibleCombos = combos.filter(({ raidType }) =>
    !hiddenCombos.has(raidType)
  )
  const html = visibleCombos.map(({ raidType }) => {
    const allRaids = takeByType(raidType)
    if (allRaids.length === 0) return ''

    // Usar nombre real del raid del primer item, o nombre genérico
    let title = raidType
    const sample = allRaids[0]
    if (sample) {
      const raids = (sample.raids || '').toUpperCase()
      if (raids.includes('MARCH')) title = 'March on Quel\'danas'
      else if (raids.includes('VOID') || raids.includes('DREAM')) title = 'Voidspire / Dream'
      else if (raids.includes('MYTHIC')) title = 'Mythic'
    }

    return buildSection(title, raidType, takeBySavedState, showFull, isFull)
  }).join('')

  // Preservar scroll position antes de actualizar
  const content = document.getElementById('content')
  const scrollTop = content.scrollTop

  content.innerHTML = html

  // Restaurar scroll position
  content.scrollTop = scrollTop

  // Inicializar fades y listener scroll en cada carrusel
  document.querySelectorAll('.cards-row').forEach(row => {
    updateCarouselFades(row)

    // Detectar arrastre para evitar abrir links
    let isDragging = false
    let lastScrollLeft = row.scrollLeft

    row.addEventListener('mousedown', () => {
      lastScrollLeft = row.scrollLeft
      isDragging = false
    }, { passive: true })

    row.addEventListener('scroll', () => {
      updateCarouselFades(row)
      // Si el scroll cambió desde mousedown, es un arrastre
      if (Math.abs(row.scrollLeft - lastScrollLeft) > 5) {
        isDragging = true
      }
    }, { passive: true })

    row.addEventListener('mouseup', () => {
      // Marcar el carrusel como "dragged" por un corto tiempo
      // Timeout debe ser lo suficientemente largo para bloquear el click que se dispara después de mouseup
      if (isDragging) {
        row.classList.add('dragging')
        setTimeout(() => row.classList.remove('dragging'), 150)
      }
    }, { passive: true })

    // Scrollear al primer card futuro en cada carrusel
    // Si mostrarAnteriores está activo, usar isFutureStrict (sin GRACE_MS) para encontrar el próximo real
    const selector = mostrarAnteriores ? '[data-future-strict="true"]' : '[data-future="true"]'
    const firstFuture = row.querySelector(selector)
    if (firstFuture) {
      const cardWidth = firstFuture.offsetWidth
      const gap = 5
      const cardOffsetLeft = firstFuture.offsetLeft
      const rowWidth = row.offsetWidth

      // Posicionar el siguiente run visible, con margen para mostrar que hay space atrás
      // Si hay card anterior, mostrarlo un poco; si no, posicionar con margen mínimo
      const prevCard = firstFuture.previousElementSibling
      const margin = prevCard ? Math.max(cardWidth + gap, 80) : 0
      const targetScroll = Math.max(0, cardOffsetLeft - margin)
      row.scrollLeft = targetScroll
    }
  })
}

// ── Botones ────────────────────────────────────────────────
document.getElementById('chkFull').addEventListener('change', render)
document.getElementById('chkPast').addEventListener('change', render)

document.getElementById('content').addEventListener('dblclick', e => {
  // No propagar clicks del botón de precios
  if (e.target.closest('.btn-price-info')) { e.stopPropagation(); return }
  const card = e.target.closest('[data-url]')
  // Doble click abre URL (sin modal)
  if (card) {
    const url = card.dataset.url
    if (url) {
      window.api.openUrl(url)
    }
  }
})

document.getElementById('content').addEventListener('contextmenu', e => {
  // No propagar clicks del botón de precios
  if (e.target.closest('.btn-price-info')) { e.stopPropagation(); return }
  const card = e.target.closest('[data-url]')
  // Click derecho abre modal (sin URL)
  if (card) {
    e.preventDefault()  // Bloquear menú de contexto del navegador
    const raidData = card.dataset.raid ? JSON.parse(card.dataset.raid) : null
    if (raidData) {
      showRaidModal(raidData)
    }
  }
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

document.getElementById('btnScheduledRuns').addEventListener('click', () => {
  window.api.openScheduledRuns()
})

// Guardar timestamp de la última actualización
let lastUpdateTime = null

// Actualizar luz del scraper basado en timestamp (verde si actualizado hace <2min, rojo si no)
function updateScraperIndicator() {
  const indicator = document.getElementById('scraperIndicator')
  if (!indicator || !lastUpdateTime) return

  const now = new Date()
  const minutesAgo = (now.getTime() - lastUpdateTime.getTime()) / 60000
  const isActive = minutesAgo < 2

  indicator.classList.toggle('active', isActive)
}

// Auto-actualizar cuando llegan datos nuevos
window.api.onRaidsData(() => {
  lastUpdateTime = new Date()
  render()
  updateScraperIndicator()
})

// Chequear estado cada segundo
setInterval(updateScraperIndicator, 1000)

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

  // Si es doble-click (e.detail === 2), ignorar drag y dejar que el dblclick ocurra
  if (e.detail === 2) return

  const startX = e.pageX - row.offsetLeft
  const scrollLeft = row.scrollLeft
  let moved = false

  const onMove = ev => {
    moved = true
    ev.preventDefault()
    const x = ev.pageX - row.offsetLeft
    row.scrollLeft = scrollLeft - (x - startX)
    updateCarouselFades(row)
  }
  const onUp = () => {
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
  const tip = card.closest('.carousel-wrap')?.querySelector('.price-tip')
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
  const tip = card.closest('.carousel-wrap')?.querySelector('.price-tip')
  if (tip) {
    tip.hidden = true
    activeTip = null
  }
})

// ── Modal System ───────────────────────────────────────────────
function showRaidModal(raid, url = null) {
  const backdrop = document.getElementById('raidModalBackdrop')
  const form = document.getElementById('raidModalForm')

  if (!backdrop) return // Modal not initialized yet

  // Show modal
  backdrop.hidden = false

  // Check "Establecer alarma" by default
  const enableAlarm = document.getElementById('fEnableAlarm')
  if (enableAlarm) {
    enableAlarm.checked = true
    document.getElementById('fAlarmOptions').hidden = false
  }

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

// Modal event listeners
document.getElementById('fEnableAlarm')?.addEventListener('change', (e) => {
  document.getElementById('fAlarmOptions').hidden = !e.target.checked
})

document.querySelector('.raid-modal-box .btn-preview')?.addEventListener('click', async (e) => {
  e.preventDefault()
  const soundPath = document.getElementById('fAlarmSound').value
  if (soundPath) {
    try {
      await window.api.playPreviewSound(soundPath)
    } catch (err) {
      console.error('Error playing sound:', err)
    }
  }
})

document.querySelector('.raid-modal-box .btn-cancel')?.addEventListener('click', closeRaidModal)

document.getElementById('raidModalBackdrop')?.addEventListener('click', (e) => {
  if (e.target.id === 'raidModalBackdrop') {
    closeRaidModal()
  }
})

render()
