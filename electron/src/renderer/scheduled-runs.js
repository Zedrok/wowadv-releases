/**
 * Scheduled Runs Window - Manages alarm preferences and displays scheduled raids
 */

let alarms = []
let preferences = {}

const content = document.getElementById('content')
const btnSound = document.getElementById('btnSound')
const btnNotifications = document.getElementById('btnNotifications')
const btnClear = document.getElementById('btnClear')

/**
 * Load preferences and alarms from main process
 */
async function loadData() {
  try {
    preferences = await window.api.getAlarmPreferences()
    alarms = await window.api.getScheduledAlarms() || []

    // Sort alarms by raid time (día + hora)
    alarms.sort((a, b) => new Date(a.raidTime) - new Date(b.raidTime))

    // Auto-delete contacted alarms that passed their raid time by more than 15 minutes
    const now = new Date()
    const fifteenMinutesMs = 15 * 60 * 1000
    const alarmsToDelete = []

    for (const alarm of alarms) {
      if (alarm.contacted) {
        const raidTime = new Date(alarm.raidTime)
        const timePassed = now - raidTime

        if (timePassed > fifteenMinutesMs) {
          console.log(`[ScheduledRuns] Auto-deleting contacted alarm (raid passed 15+ min ago): ${alarm.id}`)
          alarmsToDelete.push(alarm.id)
        }
      }
    }

    // Delete expired alarms
    for (const alarmId of alarmsToDelete) {
      await window.api.deleteAlarm(alarmId)
    }

    // Reload if we deleted any alarms
    if (alarmsToDelete.length > 0) {
      alarms = await window.api.getScheduledAlarms() || []
      // Re-sort after reload
      alarms.sort((a, b) => new Date(a.raidTime) - new Date(b.raidTime))
    }

    renderPreferences()
    renderAlarms()
  } catch (e) {
    console.error('[ScheduledRuns] Error loading data:', e)
    content.innerHTML = '<div class="empty-state">Error cargando datos</div>'
  }
}

/**
 * Render preferences UI state
 */
function renderPreferences() {
  btnSound.classList.toggle('active', preferences.soundEnabled)
  btnNotifications.classList.toggle('active', preferences.pushNotificationsEnabled)
}

/**
 * Render alarms list with compact layout
 */
async function renderAlarms() {
  if (!alarms || alarms.length === 0) {
    content.innerHTML = '<div class="empty-state">No hay alarmas agendadas</div>'
    return
  }

  // Group by raid date
  const grouped = {}
  alarms.forEach(alarm => {
    const raidDate = new Date(alarm.raidTime).toLocaleDateString('es-CL')
    if (!grouped[raidDate]) grouped[raidDate] = []
    grouped[raidDate].push(alarm)
  })

  let html = ''
  for (const [date, alarmsList] of Object.entries(grouped)) {
    html += `<div class="alarm-group"><div class="alarm-group-title">${date}</div>`

    for (const alarm of alarmsList) {
      const raidTime = new Date(alarm.raidTime).toLocaleTimeString('es-CL', {
        hour: '2-digit',
        minute: '2-digit'
      })
      const isContacted = alarm.contacted || false

      // Use buyerInfo stored with alarm, or fallback to buyerId lookup
      let characterName = 'Sin asignar'
      let battleTagName = ''

      if (alarm.buyerInfo) {
        characterName = alarm.buyerInfo?.nickRealm || 'Sin asignar'
        battleTagName = alarm.buyerInfo?.battleTag || ''
      } else if (alarm.buyerId) {
        // Fallback for old alarms without buyerInfo
        try {
          const buyer = await window.api.getBuyerById(alarm.buyerId)
          if (buyer) {
            characterName = buyer.nickRealm || 'Sin asignar'
            battleTagName = buyer.battleTag || ''
          }
        } catch (e) {
          console.warn('[ScheduledRuns] Error loading buyer:', e)
        }
      }

      const raidName = alarm.raidInfo?.name || 'Raid'
      const raidUrl = alarm.raidInfo?.url || ''

      // Character display: Character / BattleTag, or just Character if no BattleTag
      const charDisplay = battleTagName ? `${characterName} / ${battleTagName}` : characterName

      html += `
        <div class="alarm-item" data-id="${alarm.id}">
          <div class="item-info">
            <div class="item-time">${raidTime}</div>
            <div class="item-character">${charDisplay}</div>
            <div class="item-raid">${raidName}</div>
          </div>
          <div class="item-actions">
            <button class="btn btn-open" data-url="${raidUrl}" title="Abrir" aria-label="Abrir run en navegador">
              ↗
            </button>
            <button class="btn btn-contacted" data-id="${alarm.id}" ${isContacted ? 'disabled' : ''} title="Contactado" aria-label="Marcar como contactado">
              ✓
            </button>
            <button class="btn btn-delete" data-id="${alarm.id}" title="Eliminar" aria-label="Eliminar alarma">
              ✕
            </button>
          </div>
        </div>
      `
    }

    html += '</div>'
  }

  content.innerHTML = html
  attachEventListeners()
}

/**
 * Attach event listeners to cards
 */
function attachEventListeners() {
  // Open run URL
  content.querySelectorAll('.btn-open').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const url = btn.dataset.url
      if (url) {
        openRunUrl(url)
      }
    })
  })

  // Mark as contacted
  content.querySelectorAll('.btn-contacted').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const alarmId = btn.dataset.id
      markAlarmContacted(alarmId)
    })
  })

  // Delete alarm
  content.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const alarmId = btn.dataset.id
      deleteAlarm(alarmId)
    })
  })
}

/**
 * Calculate countdown to raid time
 */
function getCountdown(raidTime) {
  const now = new Date()
  const raid = new Date(raidTime)
  const diff = raid - now

  if (diff < 0) {
    return 'Ya pasado'
  }

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days}d ${hours % 24}h`
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else {
    return `${minutes}m`
  }
}

/**
 * Open run URL in default browser
 */
function openRunUrl(url) {
  if (url && url.startsWith('http')) {
    window.api.openUrl(url)
  }
}

/**
 * Mark alarm as contacted
 */
async function markAlarmContacted(alarmId) {
  if (!alarmId) return
  console.log('[ScheduledRuns] Marking alarm as contacted:', alarmId)
  window.api.markAlarmContacted(alarmId)
  await loadData()
}

/**
 * Toggle sound preference
 */
async function toggleSound() {
  preferences.soundEnabled = !preferences.soundEnabled
  await window.api.saveAlarmPreferences(preferences)
  renderPreferences()
}

/**
 * Toggle notifications preference
 */
async function toggleNotifications() {
  preferences.pushNotificationsEnabled = !preferences.pushNotificationsEnabled
  await window.api.saveAlarmPreferences(preferences)
  renderPreferences()
}

/**
 * Delete an alarm
 */
async function deleteAlarm(alarmId) {
  if (!confirm('¿Estás seguro que deseas eliminar esta alarma?')) return

  await window.api.deleteAlarm(alarmId)
  await loadData()
}

/**
 * Clear old alarms
 */
async function clearOldAlarms() {
  if (!confirm('¿Eliminar alarmas antiguas (>24 horas)?')) return

  // Filter and delete old alarms
  const now = new Date()
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  alarms.forEach(alarm => {
    const raidTime = new Date(alarm.raidTime)
    if (raidTime < dayAgo) {
      window.api.deleteAlarm(alarm.id)
    }
  })

  await loadData()
}

/**
 * Listen for real-time updates from scheduler
 */
window.api.onAlarmTriggered?.((alarmId) => {
  console.log('[ScheduledRuns] Alarm triggered:', alarmId)
  loadData()
})

window.api.onAlarmScheduled?.((alarm) => {
  console.log('[ScheduledRuns] Alarm scheduled:', alarm.id)
  loadData()
})

window.api.onAlarmDeleted?.((alarmId) => {
  console.log('[ScheduledRuns] Alarm deleted:', alarmId)
  loadData()
})

window.api.onAlarmContacted?.((alarmId) => {
  console.log('[ScheduledRuns] Alarm contacted:', alarmId)
  loadData()
})

window.api.onPreferencesUpdated?.((prefs) => {
  console.log('[ScheduledRuns] Preferences updated')
  preferences = prefs
  renderPreferences()
})

// Listen for reload signal from main process (exposed in preload)
window.api.onReloadAlarms?.(() => {
  console.log('[ScheduledRuns] Reloading alarms...')
  loadData()
})

// Event listeners
btnSound.addEventListener('click', toggleSound)
btnNotifications.addEventListener('click', toggleNotifications)
btnClear.addEventListener('click', clearOldAlarms)

// Auto-refresh countdown every minute
setInterval(() => {
  renderAlarms()
}, 60 * 1000)

// Refresh data every 5 seconds to catch updates
setInterval(() => {
  loadData()
}, 5 * 1000)

// Initial load
loadData()
