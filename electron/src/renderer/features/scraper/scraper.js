export let scraperOn = false
export let scraperLoading = false
export let autoStartCompleted = false

export function setAutoStartCompleted() {
  autoStartCompleted = true
  const btnToggle = document.getElementById('btnToggleScraper')
  if (btnToggle) {
    btnToggle.disabled = false
  }
}

export function setScraperState(running, loading = false) {
  scraperOn = running
  scraperLoading = loading
  const statusDot = document.getElementById('statusDot')
  const statusText = document.getElementById('statusText')
  const btnToggle = document.getElementById('btnToggleScraper')
  const btnIcon = btnToggle?.querySelector('i')
  const btnTextEl = document.getElementById('btnScraperText')
  const btnSpinner = btnToggle?.querySelector('.spinner')

  // Update status indicator
  statusDot.classList.toggle('active', running)
  statusDot.classList.toggle('loading', loading)
  statusText.textContent = loading ? 'Iniciando...' : (running ? 'Scraper activo' : 'Inactivo')

  if (btnToggle) {
    // Three states: Loading, Running, Stopped
    // Disable if loading OR if autostart hasn't completed yet
    btnToggle.disabled = loading || !autoStartCompleted
    btnToggle.classList.toggle('btn-loading', loading)
    btnToggle.classList.toggle('btn-gold', !running && !loading && autoStartCompleted)
    btnToggle.classList.toggle('btn-danger', running && !loading)

    if (!autoStartCompleted) {
      btnToggle.title = 'Esperando inicialización del sistema...'
    } else {
      btnToggle.title = loading ? 'Iniciando scraper...' : (running ? 'Detener scraper' : 'Iniciar scraper')
    }

    if (btnIcon) {
      btnIcon.className = loading ? 'fa-solid fa-spinner' : (running ? 'fa-solid fa-stop' : 'fa-solid fa-play')
      if (loading) btnIcon.classList.add('spin')
    }
    if (btnTextEl) {
      btnTextEl.textContent = loading ? 'Iniciando...' : (running ? 'Stop' : 'Start')
    }
  }
}

export function toggleScraper() {
  if (scraperLoading) return // Ignore clicks while loading
  if (scraperOn) {
    stopScraper()
  } else {
    startScraper()
  }
}

export function startScraper() {
  window.api.startScraper()
}

export function stopScraper() {
  window.api.stopScraper()
}

export function refreshNow() {
  const btnRefresh = document.getElementById('btnRefresh')
  window.api.refreshNow()
  btnRefresh.disabled = true
  setTimeout(() => { btnRefresh.disabled = false }, 2000)
}
