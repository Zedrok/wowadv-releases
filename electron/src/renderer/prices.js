function fmtGold(n) {
  if (n >= 1_000) return (n / 1_000).toLocaleString('en', { maximumFractionDigits: 1 }) + 'k'
  return String(n)
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ---------------------------------------------------------------------------
// Favorite Lists — stored in localStorage
// Structure: [{ id: string, name: string, serviceIds: number[] }]
// ---------------------------------------------------------------------------
const LISTS_KEY = 'prices_fav_lists'

function loadLists() {
  try { return JSON.parse(localStorage.getItem(LISTS_KEY) || '[]') } catch { return [] }
}
function saveLists(lists) {
  localStorage.setItem(LISTS_KEY, JSON.stringify(lists))
}

let favLists = loadLists()

function getList(id)       { return favLists.find(l => l.id === id) }
function listHas(id, svcId) { return !!getList(id)?.serviceIds.includes(svcId) }

function createList(name) {
  const list = { id: crypto.randomUUID(), name, serviceIds: [] }
  favLists.push(list)
  saveLists(favLists)
  return list
}

function deleteList(id) {
  favLists = favLists.filter(l => l.id !== id)
  saveLists(favLists)
}

function renameList(id, name) {
  const list = getList(id)
  if (list) { list.name = name; saveLists(favLists) }
}

function toggleServiceInList(listId, svcId) {
  const list = getList(listId)
  if (!list) return
  const idx = list.serviceIds.indexOf(svcId)
  if (idx === -1) list.serviceIds.push(svcId)
  else            list.serviceIds.splice(idx, 1)
  saveLists(favLists)
}

function moveList(id, dir) {
  const idx = favLists.findIndex(l => l.id === id)
  const to  = idx + dir
  if (to < 0 || to >= favLists.length) return
  ;[favLists[idx], favLists[to]] = [favLists[to], favLists[idx]]
  saveLists(favLists)
}

// Track open accordions
const openCats = new Set()

let payload = null

// Active list-picker popup state
let activePickerSvcId = null

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

function svcInAnyList(svcId) {
  return favLists.some(l => l.serviceIds.includes(svcId))
}

function buildServiceRow(s) {
  const name   = s.name.replace(/^🔸\s*/, '')
  const inList = svcInAnyList(s.id)
  const upd    = fmtUpdatedAt(s.updatedAt)
  return `<div class="svc-row${s.hotItem ? ' hot' : ''}" data-id="${s.id}">
    <button class="btn-star${inList ? ' active' : ''}" data-star="${s.id}" title="Agregar a lista">★</button>
    <span class="svc-name-wrap">
      <span class="svc-name">${esc(name)}</span>
      ${s.description ? `<span class="svc-desc">${esc(s.description)}</span>` : ''}
    </span>
    <span class="svc-right">
      ${upd.text ? `<span class="svc-upd ${upd.cls}" title="Última actualización">${esc(upd.text)}</span>` : ''}
      <span class="svc-price">${fmtGold(s.price)}</span>
    </span>
  </div>`
}

function buildFavListAccordion(list, items) {
  const isOpen = openCats.has(list.id)
  const count  = items.length
  const idx    = favLists.indexOf(list)
  const canUp  = idx > 0
  const canDn  = idx < favLists.length - 1

  return `<div class="accordion fav-list${isOpen ? ' open' : ''}" data-cat="${list.id}" data-listid="${list.id}">
    <div class="acc-header">
      <span class="acc-reorder" data-no-toggle>
        <button class="btn-reorder${canUp ? '' : ' disabled'}" data-move="-1" data-listid="${list.id}" title="Subir">▲</button>
        <button class="btn-reorder${canDn ? '' : ' disabled'}" data-move="1"  data-listid="${list.id}" title="Bajar">▼</button>
      </span>
      <span class="acc-title fav-title" data-listid="${list.id}" title="Doble click para renombrar">${esc(list.name)}</span>
      <span class="acc-count">${count} servicio${count !== 1 ? 's' : ''}</span>
      <button class="btn-delete-list" data-listid="${list.id}" data-no-toggle title="Eliminar lista">✕</button>
      <span class="acc-arrow">▼</span>
    </div>
    <div class="acc-body">
      ${items.length ? items.map(buildServiceRow).join('') : '<p class="list-empty">Lista vacía</p>'}
    </div>
  </div>`
}

function buildAccordion(key, title, items) {
  const isOpen = openCats.has(key)
  return `<div class="accordion${isOpen ? ' open' : ''}" data-cat="${key}">
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

function buildListPicker(svcId) {
  if (!favLists.length) {
    return `<div class="list-picker" data-picker="${svcId}">
      <p class="picker-empty">No hay listas.<br>Creá una con el botón +</p>
    </div>`
  }
  const rows = favLists.map(l => {
    const checked = listHas(l.id, svcId)
    return `<label class="picker-row">
      <input type="checkbox" data-pickerlist="${l.id}" data-pickersvc="${svcId}" ${checked ? 'checked' : ''}>
      <span>${esc(l.name)}</span>
    </label>`
  }).join('')
  return `<div class="list-picker" data-picker="${svcId}">${rows}</div>`
}

function closePicker() {
  document.querySelectorAll('.list-picker').forEach(p => p.remove())
  activePickerSvcId = null
}

function openPicker(svcId, anchorEl) {
  if (activePickerSvcId === svcId) { closePicker(); return }
  closePicker()
  activePickerSvcId = svcId
  const picker = document.createElement('div')
  picker.innerHTML = buildListPicker(svcId)
  const el = picker.firstElementChild

  // position near anchor
  const rect = anchorEl.getBoundingClientRect()
  el.style.position = 'fixed'
  el.style.top  = (rect.bottom + 4) + 'px'
  el.style.left = rect.left + 'px'
  document.body.appendChild(el)

  el.querySelectorAll('input[data-pickerlist]').forEach(cb => {
    cb.addEventListener('change', () => {
      toggleServiceInList(cb.dataset.pickerlist, parseInt(cb.dataset.pickersvc))
      render()
      // re-open picker so user can pick multiple lists
      openPicker(parseInt(cb.dataset.pickersvc), anchorEl)
    })
  })
}

function render() {
  closePicker()

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
    const hitCats = new Set(filtered.map(s => String(s.serviceCategoryId)))
    cats.forEach(c => { if (hitCats.has(String(c.id))) openCats.add(String(c.id)) })
  }

  const catMap = new Map(cats.map(c => [c.id, { cat: c, items: [] }]))
  filtered.forEach(s => {
    if (catMap.has(s.serviceCategoryId)) catMap.get(s.serviceCategoryId).items.push(s)
  })

  let html = ''

  // ── Favorite lists (pinned, in user order) ──
  for (const list of favLists) {
    const items = filtered.filter(s => list.serviceIds.includes(s.id))
    html += buildFavListAccordion(list, items)
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
    header.addEventListener('click', e => {
      if (e.target.closest('[data-no-toggle]')) return
      const acc = header.closest('.accordion')
      const key = acc.dataset.cat
      if (openCats.has(key)) { openCats.delete(key); acc.classList.remove('open') }
      else                   { openCats.add(key);    acc.classList.add('open')    }
    })
  })

  // ── Star → open picker ──
  document.querySelectorAll('.btn-star').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      openPicker(parseInt(btn.dataset.star), btn)
    })
  })

  // ── Reorder buttons ──
  document.querySelectorAll('.btn-reorder').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      if (btn.classList.contains('disabled')) return
      moveList(btn.dataset.listid, parseInt(btn.dataset.move))
      render()
    })
  })

  // ── Delete list ──
  document.querySelectorAll('.btn-delete-list').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      deleteList(btn.dataset.listid)
      render()
    })
  })

  // ── Rename list (double click title) ──
  document.querySelectorAll('.fav-title').forEach(el => {
    el.addEventListener('dblclick', e => {
      e.stopPropagation()
      const id   = el.dataset.listid
      const list = getList(id)
      if (!list) return
      el.contentEditable = 'true'
      el.focus()
      // select all
      const range = document.createRange()
      range.selectNodeContents(el)
      window.getSelection().removeAllRanges()
      window.getSelection().addRange(range)

      function commit() {
        el.contentEditable = 'false'
        const newName = el.textContent.trim()
        if (newName) renameList(id, newName)
        render()
      }
      el.addEventListener('blur',    commit, { once: true })
      el.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); el.blur() } }, { once: true })
    })
  })
}

// Close picker when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('.list-picker') && !e.target.closest('.btn-star')) {
    closePicker()
  }
})

// ── New List inline bar ──────────────────────────────────────
const newListBar   = document.getElementById('newListBar')
const newListInput = document.getElementById('newListInput')

function showNewListBar() {
  newListBar.style.display = 'flex'
  newListInput.value = ''
  newListInput.focus()
}
function hideNewListBar() {
  newListBar.style.display = 'none'
}
function commitNewList() {
  const name = newListInput.value.trim()
  if (name) { createList(name); render() }
  hideNewListBar()
}

document.getElementById('btnNewList').addEventListener('click', showNewListBar)
document.getElementById('btnNewListConfirm').addEventListener('click', commitNewList)
document.getElementById('btnNewListCancel').addEventListener('click', hideNewListBar)
newListInput.addEventListener('keydown', e => {
  if (e.key === 'Enter')  commitNewList()
  if (e.key === 'Escape') hideNewListBar()
})

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

// Tooltip positioning — flip upward when near bottom of viewport
document.querySelector('.content').addEventListener('mouseover', e => {
  const wrap = e.target.closest('.svc-name-wrap')
  if (!wrap) return
  const tip = wrap.querySelector('.svc-desc')
  if (!tip) return
  const rect = wrap.getBoundingClientRect()
  tip.classList.add('visible')
  const tipH = tip.offsetHeight
  const spaceBelow = window.innerHeight - rect.bottom
  if (spaceBelow < tipH + 8) {
    tip.style.top  = (rect.top - tipH - 4) + 'px'
  } else {
    tip.style.top  = (rect.bottom + 2) + 'px'
  }
  tip.style.left = rect.left + 'px'
})
document.querySelector('.content').addEventListener('mouseout', e => {
  const wrap = e.target.closest('.svc-name-wrap')
  if (!wrap) return
  const tip = wrap.querySelector('.svc-desc')
  if (tip) tip.classList.remove('visible')
})

window.api.onPricesData(data => { payload = data; render() })

window.api.getPrices().then(data => { payload = data; render() })
