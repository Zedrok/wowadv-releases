function fmtGold(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toLocaleString('en', { maximumFractionDigits: 2 }) + 'M g'
  if (n >= 1_000)     return (n / 1_000).toLocaleString('en', { maximumFractionDigits: 1 }) + 'k g'
  return n + ' g'
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Favorites stored by service id
const FAV_KEY = 'prices_favorites'
function loadFavs() {
  try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')) } catch { return new Set() }
}
function saveFavs(set) {
  localStorage.setItem(FAV_KEY, JSON.stringify([...set]))
}
const favs = loadFavs()

// Track which accordions are open (by key string)
const openCats = new Set(['__favs__'])  // favorites open by default

let payload = null

function fmtUpdatedAt(iso) {
  if (!iso) return { text: '', cls: '' }
  try {
    const d    = new Date(iso)
    const text = d.toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
                 ' ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
    const hrs  = (Date.now() - d.getTime()) / 3_600_000
    const cls  = hrs <= 24 ? 'upd-fresh' : hrs <= 48 ? 'upd-warn' : 'upd-stale'
    return { text, cls }
  } catch { return { text: '', cls: '' } }
}

function buildServiceRow(s) {
  const name    = s.name.replace(/^🔸\s*/, '')
  const isFav   = favs.has(s.id)
  const upd     = fmtUpdatedAt(s.updatedAt)
  return `<div class="svc-row${s.hotItem ? ' hot' : ''}" data-id="${s.id}">
    <button class="btn-star${isFav ? ' active' : ''}" data-star="${s.id}" title="${isFav ? 'Quitar favorito' : 'Marcar favorito'}">★</button>
    <span class="svc-name" title="${esc(s.name)}">${esc(name)}</span>
    <span class="svc-desc" title="${esc(s.description)}">${esc(s.description)}</span>
    ${upd.text ? `<span class="svc-upd ${upd.cls}" title="Última actualización del precio">${esc(upd.text)}</span>` : ''}
    <span class="svc-price">${fmtGold(s.price)}</span>
  </div>`
}

function buildAccordion(key, title, items, extraClass = '') {
  const isOpen = openCats.has(key)
  return `<div class="accordion${isOpen ? ' open' : ''}${extraClass ? ' ' + extraClass : ''}" data-cat="${key}">
    <div class="acc-header">
      <span class="acc-title">${esc(title)}</span>
      <span class="acc-count">${items.length} servicio${items.length !== 1 ? 's' : ''}</span>
      <span class="acc-arrow">▼</span>
    </div>
    <div class="acc-body">
      ${items.map(buildServiceRow).join('')}
    </div>
  </div>`
}

function render() {
  if (!payload?.services?.length) {
    document.getElementById('content').innerHTML =
      '<p class="placeholder">Sin datos. Iniciá el scraper.</p>'
    return
  }

  const ts   = payload.timestamp || ''
  const date = payload.date || ''
  document.getElementById('lastUpdate').textContent =
    date ? `Actualizado: ${date} ${ts}` : ts ? `Actualizado: ${ts}` : '—'

  const search = document.getElementById('searchInput').value.trim().toLowerCase()
  const cats   = payload.categories || []
  const svcs   = payload.services   || []

  const filtered = svcs.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search) ||
    s.description.toLowerCase().includes(search)
  )

  if (search) {
    // auto-open categories with results
    const hitCats = new Set(filtered.map(s => String(s.serviceCategoryId)))
    cats.forEach(c => { if (hitCats.has(String(c.id))) openCats.add(String(c.id)) })
  }

  // Group by category
  const catMap = new Map(cats.map(c => [c.id, { cat: c, items: [] }]))
  filtered.forEach(s => {
    if (catMap.has(s.serviceCategoryId)) catMap.get(s.serviceCategoryId).items.push(s)
  })

  let html = ''

  // ── Favorites section (pinned top) ──
  const favItems = filtered.filter(s => favs.has(s.id))
  if (favItems.length > 0) {
    html += buildAccordion('__favs__', '⭐ Favoritos', favItems, 'acc-fav')
  }

  // ── Regular categories ──
  for (const { cat, items } of catMap.values()) {
    if (!items.length) continue
    const label = cat.name.replace(/^🔸\s*/, '')
    html += buildAccordion(String(cat.id), label, items)
  }

  if (!html) html = '<p class="placeholder">Sin resultados.</p>'
  document.getElementById('content').innerHTML = html

  // ── Accordion toggle ──
  document.querySelectorAll('.acc-header').forEach(header => {
    header.addEventListener('click', () => {
      const acc = header.closest('.accordion')
      const key = acc.dataset.cat
      if (openCats.has(key)) { openCats.delete(key); acc.classList.remove('open') }
      else                   { openCats.add(key);    acc.classList.add('open')    }
    })
  })

  // ── Star toggle ──
  document.querySelectorAll('.btn-star').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      const id = parseInt(btn.dataset.star)
      if (favs.has(id)) { favs.delete(id) } else { favs.add(id) }
      saveFavs(favs)
      render()
    })
  })
}

// ── Refresh button ─────────────────────────────────────────
document.getElementById('btnRefresh').addEventListener('click', async () => {
  const btn = document.getElementById('btnRefresh')
  btn.textContent = 'Scraping…'
  btn.disabled = true

  const before = payload?.timestamp ?? null
  window.api.refreshPrices()

  const deadline = Date.now() + 60000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1000))
    const fresh = await window.api.getPrices()
    if (fresh?.timestamp && fresh.timestamp !== before) { payload = fresh; break }
  }

  render()
  btn.textContent = '⟳ Actualizar'
  btn.disabled = false
})

document.getElementById('searchInput').addEventListener('input', render)

window.api.onPricesData(data => { payload = data; render() })

window.api.getPrices().then(data => { payload = data; render() })
