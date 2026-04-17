// Prices tab module — uses prc- prefixed IDs to avoid conflicts with raids tab

function fmtGold(n) {
  if (n >= 1_000) return (n / 1_000).toLocaleString('en', { maximumFractionDigits: 1 }) + 'k'
  return String(n)
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

let favLists = []

async function loadLists() {
  favLists = await window.api.getFavLists()
}
function saveLists(lists) {
  favLists = lists
  window.api.saveFavLists(lists)
}

function getList(id)        { return favLists.find(l => l.id === id) }
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

const openCats = new Set()
let payload = null
let activePickerSvcId = null
let currentTab = 'all'

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
  return `<div class="prc-svc-row${s.hotItem ? ' hot' : ''}" data-id="${s.id}">
    <button class="btn-prc-star${inList ? ' active' : ''}" data-star="${s.id}" title="Agregar a lista"><i class="fa-solid fa-star"></i></button>
    <span class="prc-svc-name-wrap">
      <span class="prc-svc-name">${esc(name)}</span>
      ${s.description ? `<span class="prc-svc-desc">${esc(s.description)}</span>` : ''}
    </span>
    <span class="prc-svc-right">
      ${upd.text ? `<span class="prc-svc-upd ${upd.cls}" title="Última actualización">${esc(upd.text)}</span>` : ''}
      <span class="prc-svc-price">${fmtGold(s.price)}</span>
    </span>
  </div>`
}

function buildFavListAccordion(list, items) {
  const isOpen = openCats.has(list.id)
  const count  = items.length
  const idx    = favLists.indexOf(list)
  const canUp  = idx > 0
  const canDn  = idx < favLists.length - 1

  return `<div class="prc-accordion prc-fav-list${isOpen ? ' open' : ''}" data-cat="${list.id}" data-listid="${list.id}">
    <div class="prc-acc-header">
      <span class="prc-acc-reorder" data-no-toggle>
        <button class="btn-prc-reorder${canUp ? '' : ' disabled'}" data-move="-1" data-listid="${list.id}" title="Subir"><i class="fa-solid fa-chevron-up"></i></button>
        <button class="btn-prc-reorder${canDn ? '' : ' disabled'}" data-move="1"  data-listid="${list.id}" title="Bajar"><i class="fa-solid fa-chevron-down"></i></button>
      </span>
      <span class="prc-acc-title prc-fav-title" data-listid="${list.id}" title="Doble click para renombrar">${esc(list.name)}</span>
      <span class="prc-acc-count">${count} servicio${count !== 1 ? 's' : ''}</span>
      <button class="btn-prc-delete-list" data-listid="${list.id}" data-no-toggle title="Eliminar lista"><i class="fa-solid fa-xmark"></i></button>
      <i class="fa-solid fa-chevron-down prc-acc-arrow"></i>
    </div>
    <div class="prc-acc-body">
      ${items.length ? items.map(buildServiceRow).join('') : '<p class="prc-list-empty">Lista vacía</p>'}
    </div>
  </div>`
}

function buildAccordion(key, title, items) {
  const isOpen = openCats.has(key)
  return `<div class="prc-accordion${isOpen ? ' open' : ''}" data-cat="${key}">
    <div class="prc-acc-header">
      <span class="prc-acc-title">${esc(title)}</span>
      <span class="prc-acc-count">${items.length} servicio${items.length !== 1 ? 's' : ''}</span>
      <i class="fa-solid fa-chevron-down prc-acc-arrow"></i>
    </div>
    <div class="prc-acc-body">
      ${items.map(buildServiceRow).join('')}
    </div>
  </div>`
}

function buildListPicker(svcId) {
  if (!favLists.length) {
    return `<div class="prc-list-picker" data-picker="${svcId}">
      <p class="prc-picker-empty">No hay listas.<br>Creá una con el botón +</p>
    </div>`
  }
  const rows = favLists.map(l => {
    const checked = listHas(l.id, svcId)
    return `<label class="prc-picker-row">
      <input type="checkbox" data-pickerlist="${l.id}" data-pickersvc="${svcId}" ${checked ? 'checked' : ''}>
      <span>${esc(l.name)}</span>
    </label>`
  }).join('')
  return `<div class="prc-list-picker" data-picker="${svcId}">${rows}</div>`
}

function closePicker() {
  document.querySelectorAll('.prc-list-picker').forEach(p => p.remove())
  activePickerSvcId = null
}

function openPicker(svcId, anchorEl) {
  if (activePickerSvcId === svcId) { closePicker(); return }
  closePicker()
  activePickerSvcId = svcId
  const picker = document.createElement('div')
  picker.innerHTML = buildListPicker(svcId)
  const el = picker.firstElementChild
  const rect = anchorEl.getBoundingClientRect()
  el.style.position = 'fixed'
  el.style.top  = (rect.bottom + 4) + 'px'
  el.style.left = rect.left + 'px'
  document.body.appendChild(el)
  el.querySelectorAll('input[data-pickerlist]').forEach(cb => {
    cb.addEventListener('change', () => {
      toggleServiceInList(cb.dataset.pickerlist, parseInt(cb.dataset.pickersvc))
      render()
      openPicker(parseInt(cb.dataset.pickersvc), anchorEl)
    })
  })
}

function render() {
  closePicker()
  const content = document.getElementById('prc-content')
  if (!content) return

  if (!payload?.services?.length) {
    content.innerHTML = '<p class="prc-placeholder">Sin datos. Iniciá el scraper.</p>'
    return
  }

  const search = (document.getElementById('prc-search')?.value || '').trim().toLowerCase()
  const cats   = payload.categories || []
  const svcs   = payload.services   || []

  const filtered = svcs.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search) ||
    (s.description || '').toLowerCase().includes(search)
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

  if (currentTab === 'recent') {
    const recent = filtered
      .filter(s => fmtUpdatedAt(s.updatedAt).cls === 'upd-fresh')
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    html = recent.length
      ? `<div class="recent-list">${recent.map(s => buildServiceRow(s).replace('class="prc-svc-row', 'class="prc-svc-row recent-highlight')).join('')}</div>`
      : '<p class="prc-placeholder">Sin servicios actualizados en las últimas 24 horas.</p>'
    content.innerHTML = html
    attachContentListeners()
    return
  }

  for (const list of favLists) {
    const items = filtered.filter(s => list.serviceIds.includes(s.id))
    html += buildFavListAccordion(list, items)
  }
  for (const { cat, items } of catMap.values()) {
    if (!items.length) continue
    const label = cat.name.replace(/^🔸\s*/, '')
    html += buildAccordion(String(cat.id), label, items)
  }

  if (!html) html = '<p class="prc-placeholder">Sin resultados.</p>'
  content.innerHTML = html
  attachContentListeners()
}

function attachContentListeners() {
  document.querySelectorAll('.prc-acc-header').forEach(header => {
    header.addEventListener('click', e => {
      if (e.target.closest('[data-no-toggle]')) return
      const acc = header.closest('.prc-accordion')
      const key = acc.dataset.cat
      if (openCats.has(key)) { openCats.delete(key); acc.classList.remove('open') }
      else                   { openCats.add(key);    acc.classList.add('open')    }
    })
  })

  document.querySelectorAll('.btn-prc-star').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      openPicker(parseInt(btn.dataset.star), btn)
    })
  })

  document.querySelectorAll('.btn-prc-reorder').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      if (btn.classList.contains('disabled')) return
      moveList(btn.dataset.listid, parseInt(btn.dataset.move))
      render()
    })
  })

  document.querySelectorAll('.btn-prc-delete-list').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      deleteList(btn.dataset.listid)
      render()
    })
  })

  document.querySelectorAll('.prc-fav-title').forEach(el => {
    el.addEventListener('dblclick', e => {
      e.stopPropagation()
      const id   = el.dataset.listid
      const list = getList(id)
      if (!list) return
      el.contentEditable = 'true'
      el.focus()
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

  document.getElementById('prc-content')?.addEventListener('mouseover', e => {
    const wrap = e.target.closest('.prc-svc-name-wrap')
    if (!wrap) return
    const tip = wrap.querySelector('.prc-svc-desc')
    if (!tip) return
    const rect = wrap.getBoundingClientRect()
    tip.classList.add('visible')
    const tipH = tip.offsetHeight
    const spaceBelow = window.innerHeight - rect.bottom
    tip.style.top  = (spaceBelow < tipH + 8 ? rect.top - tipH - 4 : rect.bottom + 2) + 'px'
    tip.style.left = rect.left + 'px'
  }, { once: false })
}

export function initPrices(onNavigateToRaids) {
  document.addEventListener('click', e => {
    if (!e.target.closest('.prc-list-picker') && !e.target.closest('.btn-prc-star')) closePicker()
  })

  const newListBar   = document.getElementById('prc-new-list-bar')
  const newListInput = document.getElementById('prc-new-list-input')

  function showNewListBar() { newListBar.style.display = 'flex'; newListInput.value = ''; newListInput.focus() }
  function hideNewListBar() { newListBar.style.display = 'none' }
  function commitNewList()  { const n = newListInput.value.trim(); if (n) { createList(n); render() } hideNewListBar() }

  document.getElementById('prc-btn-new-list')?.addEventListener('click', showNewListBar)
  document.getElementById('prc-btn-confirm')?.addEventListener('click', commitNewList)
  document.getElementById('prc-btn-cancel')?.addEventListener('click', hideNewListBar)
  newListInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter')  commitNewList()
    if (e.key === 'Escape') hideNewListBar()
  })

  document.getElementById('prc-btn-refresh')?.addEventListener('click', async () => {
    const btn = document.getElementById('prc-btn-refresh')
    btn.innerHTML = '<i class="fa-solid fa-rotate-right fa-spin"></i> Scraping...'
    btn.disabled = true

    if (window.api.refreshPrices) window.api.refreshPrices()

    const before = payload?.timestamp ?? null
    const deadline = Date.now() + 5000
    let updated = false
    while (Date.now() < deadline && !updated) {
      await new Promise(r => setTimeout(r, 500))
      const fresh = await window.api.getPrices()
      if (fresh?.timestamp && fresh.timestamp !== before) { payload = fresh; updated = true }
    }

    render()
    btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Actualizar'
    btn.disabled = false
  })

  document.getElementById('prc-tabs')?.addEventListener('click', e => {
    const tab = e.target.closest('[data-ptab]')
    if (!tab) return
    currentTab = tab.dataset.ptab
    document.querySelectorAll('[data-ptab]').forEach(t => t.classList.toggle('active', t.dataset.ptab === currentTab))
    render()
  })

  document.getElementById('prc-search')?.addEventListener('input', render)

  window.api.onPricesData(data => { payload = data; render() })

  Promise.all([loadLists(), window.api.getPrices()]).then(([, data]) => {
    payload = data
    render()
  })
}
