/**
 * Updater Feature Module
 * Handles check for updates, changelog display, and update installation
 */

let currentVersion = null
let latestVersion = null
let pendingChanges = null

export async function initUpdater() {
  // Get current version on startup
  const versionData = await window.api.getAppVersion()
  currentVersion = versionData

  // Listen for update progress
  window.api.onUpdateProgress((data) => {
    if (data.type === 'available') {
      latestVersion = data.version
      showUpdateModal()
    } else if (data.type === 'progress' || data.status === 'downloading') {
      updateProgressBar(data.percent)
    } else if (data.type === 'downloaded' || data.status === 'ready') {
      onUpdateDownloaded()
    }
  })

  // Wire up button click
  const btnCheckUpdates = document.getElementById('btnCheckUpdates')
  if (btnCheckUpdates) {
    btnCheckUpdates.addEventListener('click', checkForUpdates)
  }

  // Wire up modal buttons
  wireModalButtons()

  // Show changelog if user hasn't seen current version (on startup only)
  showChangelogIfNew()
}

async function checkForUpdates() {
  const btnCheckUpdates = document.getElementById('btnCheckUpdates')
  const originalText = btnCheckUpdates.innerHTML

  // Show loading state
  btnCheckUpdates.disabled = true
  btnCheckUpdates.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'

  try {
    const result = await window.api.checkForUpdates()

    if (result.updateAvailable) {
      latestVersion = result.version
      showUpdateModal()
    } else {
      // Show "already up to date" feedback
      showAlreadyUpToDate()
    }
  } catch (error) {
    console.error('Error checking for updates:', error)
  } finally {
    // Restore button
    btnCheckUpdates.disabled = false
    btnCheckUpdates.innerHTML = originalText
  }
}

function showUpdateModal() {
  const backdrop = document.getElementById('updateModalBackdrop')
  const versionCurrentEl = document.getElementById('versionCurrent')
  const versionNewEl = document.getElementById('versionNew')

  versionCurrentEl.textContent = currentVersion || '—'
  versionNewEl.textContent = latestVersion || '—'

  backdrop.hidden = false
}

function hideUpdateModal() {
  const backdrop = document.getElementById('updateModalBackdrop')
  backdrop.hidden = true

  // Reset progress bar
  const progressContainer = document.getElementById('progressContainer')
  progressContainer.hidden = true
  document.getElementById('progressFill').style.width = '0%'
  document.getElementById('progressPercent').textContent = '0%'
}

function showChangelogModal(changes) {
  const backdrop = document.getElementById('changelogModalBackdrop')
  const body = document.getElementById('changelogBody')

  // Build changelog HTML
  let html = ''
  changes.forEach(entry => {
    html += `
      <div class="changelog-entry">
        <div class="changelog-version">
          <span class="changelog-version-number">v${entry.version}</span>
          <span class="changelog-date">${entry.date}</span>
        </div>
        <ul class="changelog-changes">
          ${entry.changes.map(change => `<li>${escapeHtml(change)}</li>`).join('')}
        </ul>
      </div>
    `
  })

  body.innerHTML = html
  backdrop.hidden = false
}

function hideChangelogModal() {
  const backdrop = document.getElementById('changelogModalBackdrop')
  backdrop.hidden = true
}

function wireModalButtons() {
  // Update modal
  const updateModalClose = document.getElementById('updateModalClose')
  const updateModalCancel = document.getElementById('updateModalCancel')
  const updateModalDownload = document.getElementById('updateModalDownload')

  if (updateModalClose) updateModalClose.addEventListener('click', hideUpdateModal)
  if (updateModalCancel) updateModalCancel.addEventListener('click', hideUpdateModal)
  if (updateModalDownload) {
    updateModalDownload.addEventListener('click', async () => {
      const progressContainer = document.getElementById('progressContainer')
      progressContainer.hidden = false
      updateModalDownload.disabled = true

      try {
        await window.api.checkForUpdates() // This triggers the actual download
      } catch (error) {
        console.error('Error downloading update:', error)
        progressContainer.hidden = true
        updateModalDownload.disabled = false
      }
    })
  }

  // Changelog modal
  const changelogClose = document.getElementById('changelogModalClose')
  const changelogClose2 = document.getElementById('changelogModalClose2')

  if (changelogClose) changelogClose.addEventListener('click', hideChangelogModal)
  if (changelogClose2) changelogClose2.addEventListener('click', hideChangelogModal)
}

function updateProgressBar(percent) {
  const progressFill = document.getElementById('progressFill')
  const progressPercent = document.getElementById('progressPercent')

  progressFill.style.width = percent + '%'
  progressPercent.textContent = Math.round(percent) + '%'
}

function onUpdateDownloaded() {
  const updateModalDownload = document.getElementById('updateModalDownload')
  const progressContainer = document.getElementById('progressContainer')

  // Hide progress bar and show success message
  progressContainer.hidden = true
  updateModalDownload.textContent = '✓ Listo para instalar'
  updateModalDownload.disabled = true

  // Auto-close after 3 seconds and trigger install
  setTimeout(() => {
    hideUpdateModal()
    // Trigger installation (handled by main process)
  }, 3000)
}

function showAlreadyUpToDate() {
  // Show a brief toast notification
  const message = document.createElement('div')
  message.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #2ecc71;
    color: white;
    padding: 12px 16px;
    border-radius: 4px;
    font-size: 13px;
    z-index: 2000;
    animation: slideIn 200ms ease-out;
  `
  message.textContent = '✓ Versión actualizada'
  document.body.appendChild(message)

  setTimeout(() => {
    message.style.animation = 'slideOut 200ms ease-out'
    setTimeout(() => message.remove(), 200)
  }, 3000)
}

async function checkForUpdatesAtStartup() {
  // Wait 3 seconds before checking
  await new Promise(resolve => setTimeout(resolve, 3000))

  try {
    const result = await window.api.checkForUpdates()
    if (result.updateAvailable && result.changes) {
      // Store changes for later display
      pendingChanges = result.changes
      // Don't show modal on startup, just make the button "aware" of update
      latestVersion = result.version
    }
  } catch (error) {
    console.error('Error checking for updates on startup:', error)
  }
}

async function showChangelogIfNew() {
  try {
    const lastSeenVersion = await window.api.getLastSeenChangelogVersion()
    // Get changelog with changes since last seen version
    const { changelog, changesSince } = await window.api.getChangelog(lastSeenVersion)

    if (changesSince && changesSince.length > 0) {
      showChangelogModal(changesSince)
      // Mark current version as seen
      const latestChangelogEntry = changelog[0]
      if (latestChangelogEntry) {
        await window.api.updateLastSeenChangelogVersion(latestChangelogEntry.version)
      }
    }
  } catch (error) {
    console.error('Error showing changelog:', error)
  }
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// Add animation keyframes to page
const style = document.createElement('style')
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`
document.head.appendChild(style)
