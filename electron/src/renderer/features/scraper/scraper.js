export let scraperOn = false

export function setScraperState(running) {
  scraperOn = running
  const statusDot = document.getElementById('statusDot')
  const statusText = document.getElementById('statusText')
  const btnStart = document.getElementById('btnStart')
  const btnStop = document.getElementById('btnStop')

  statusDot.classList.toggle('running', running)
  statusText.textContent = running ? 'Scraper activo' : 'Inactivo'
  btnStart.hidden = running
  btnStop.hidden = !running
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
