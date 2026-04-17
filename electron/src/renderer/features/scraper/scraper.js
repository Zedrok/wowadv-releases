export let scraperOn = false

export function setScraperState(running) {
  scraperOn = running
  const statusDot = document.getElementById('statusDot')
  const statusText = document.getElementById('statusText')
  const btnToggle = document.getElementById('btnToggleScraper')
  const btnIcon = btnToggle?.querySelector('i')
  const btnTextEl = document.getElementById('btnScraperText')

  statusDot.classList.toggle('active', running)
  statusText.textContent = running ? 'Scraper activo' : 'Inactivo'

  if (btnToggle) {
    btnToggle.classList.toggle('btn-gold', !running)
    btnToggle.classList.toggle('btn-danger', running)
    btnToggle.title = running ? 'Detener scraper' : 'Iniciar scraper'
    if (btnIcon) {
      btnIcon.className = running ? 'fa-solid fa-stop' : 'fa-solid fa-play'
    }
    if (btnTextEl) {
      btnTextEl.textContent = running ? 'Stop' : 'Start'
    }
  }
}

export function toggleScraper() {
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
