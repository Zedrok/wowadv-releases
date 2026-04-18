const { Notification, BrowserWindow } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const preferencesStorage = require('../storage/preferencesStorage')

let schedulerInterval = null
let scheduledRunsWindow = null
let mainWindow = null

class AlarmScheduler {
  constructor() {
    this.alarms = []
    // Run migration before loading preferences
    preferencesStorage.migrateAlarmsUrl()
    this.preferences = preferencesStorage.getPreferences()
  }

  /**
   * Start the scheduler interval (checks every 30 seconds)
   */
  start() {
    if (schedulerInterval) return // Already running

    console.log('[AlarmScheduler] Starting scheduler...')
    this.checkAndTriggerAlarms() // Initial check

    schedulerInterval = setInterval(() => {
      this.checkAndTriggerAlarms()
    }, 30 * 1000) // 30 seconds
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (schedulerInterval) {
      clearInterval(schedulerInterval)
      schedulerInterval = null
      console.log('[AlarmScheduler] Scheduler stopped')
    }
  }

  /**
   * Load alarms from storage
   */
  loadAlarms() {
    this.alarms = preferencesStorage.getPendingAlarms()
    console.log(`[AlarmScheduler] Loaded ${this.alarms.length} pending alarms`)
  }

  /**
   * Reload preferences from storage
   */
  updatePreferences() {
    this.preferences = preferencesStorage.getPreferences()
    console.log('[AlarmScheduler] Preferences updated')
  }

  /**
   * Check and trigger alarms that have reached their alert time or re-alarm time
   */
  checkAndTriggerAlarms() {
    this.loadAlarms() // Refresh from storage
    const now = new Date()

    this.alarms.forEach(alarm => {
      const alertTime = new Date(alarm.alertTime)
      const raidTime = new Date(alarm.raidTime)
      const reAlarmTime = new Date(raidTime.getTime() - 5 * 60 * 1000) // 5 minutes before raid

      // Skip if already contacted
      if (alarm.contacted) {
        return
      }

      // Check original alarm: trigger if alert time has passed
      if (now >= alertTime && alarm.status === 'pending') {
        this.triggerAlarm(alarm, 'original')
      }

      // Check re-alarm: trigger 5 minutes before raid time if not already scheduled
      if (now >= reAlarmTime && alarm.status === 'pending' && !alarm.reAlarmScheduled) {
        this.triggerAlarm(alarm, 're-alarm')
        preferencesStorage.updateAlarmReAlarmScheduled(alarm.id, true)
      }
    })
  }

  /**
   * Trigger an alarm (play sound + show notification)
   * @param {Object} alarm - The alarm object
   * @param {string} type - 'original' or 're-alarm' (default: 'original')
   */
  triggerAlarm(alarm, type = 'original') {
    const alarmTypeLabel = type === 're-alarm' ? 'Re-Alarm (5 min before)' : 'Alarm'
    console.log(`[AlarmScheduler] Triggering ${alarmTypeLabel} for raid at ${alarm.raidTime}`)

    // Update alarm status in storage only for original alarm
    if (type === 'original') {
      preferencesStorage.updateAlarmStatus(alarm.id, 'triggered')
    }

    // Play sound if enabled
    if (this.preferences.soundEnabled && alarm.sound) {
      this.playSound(alarm.sound)
    }

    // Show notification if enabled
    if (this.preferences.pushNotificationsEnabled) {
      this.showNotification(alarm, type)
    }

    // Update scheduled runs window if open
    if (scheduledRunsWindow && !scheduledRunsWindow.isDestroyed()) {
      scheduledRunsWindow.webContents.send('alarm-triggered', alarm.id)
    }
  }

  /**
   * Play audio file
   */
  playSound(filePath) {
    try {
      if (!filePath) {
        console.warn('[AlarmScheduler] No file path provided')
        return
      }

      // Resolve relative paths (e.g. '../assets/sounds/Ring.ogg')
      let resolvedPath = filePath
      if (filePath.startsWith('../')) {
        const cleanPath = filePath.replace(/^\.\.\//, '')
        resolvedPath = path.join(__dirname, '../../../', cleanPath)

        // Fallback for portable builds where assets are in out/renderer/assets/
        if (!fs.existsSync(resolvedPath)) {
          const portablePath = path.join(__dirname, '../../../../out/renderer/assets', cleanPath)
          if (fs.existsSync(portablePath)) {
            resolvedPath = portablePath
          }
        }
      }

      console.log(`[AlarmScheduler] Playing sound via renderer: ${resolvedPath}`)

      // Send to renderer to play via Web Audio API (Chromium supports OGG natively)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('play-audio', resolvedPath)
      } else if (scheduledRunsWindow && !scheduledRunsWindow.isDestroyed()) {
        scheduledRunsWindow.webContents.send('play-audio', resolvedPath)
      } else {
        console.warn('[AlarmScheduler] No window available to play audio')
      }
    } catch (e) {
      console.error('[AlarmScheduler] Exception playing sound:', e.message)
    }
  }

  /**
   * Show system notification
   * @param {Object} alarm - The alarm object
   * @param {string} type - 'original' or 're-alarm' (default: 'original')
   */
  showNotification(alarm, type = 'original') {
    try {
      const { name, team, difficulty } = alarm.raidInfo
      const { nickRealm } = alarm.buyerInfo || {}
      const raidDate = new Date(alarm.raidTime)
      const raidHour = raidDate.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })
      const isReAlarm = type === 're-alarm'

      const notification = new Notification({
        title: isReAlarm ? `⏰ ${nickRealm || 'Run'}` : `${nickRealm || 'Raid Alert'}`,
        body: `${raidHour} - ${name}`,
        icon: null // Can set app icon if needed
      })

      notification.show()
      console.log(`[AlarmScheduler] ${isReAlarm ? 'Re-' : ''}Notification shown for alarm`)
    } catch (e) {
      console.error('[AlarmScheduler] Error showing notification:', e.message)
    }
  }

  /**
   * Add a new alarm (called from IPC handler)
   */
  addAlarm(raidTime, alertTime, sound, minutesBefore, buyerId, raidInfo, buyerInfo) {
    const alarm = preferencesStorage.addAlarm(
      raidTime,
      alertTime,
      sound,
      minutesBefore,
      buyerId,
      raidInfo,
      buyerInfo
    )
    console.log(`[AlarmScheduler] Alarm added: ${alarm.id}`)
    return alarm
  }

  /**
   * Delete an alarm
   */
  deleteAlarm(alarmId) {
    preferencesStorage.deleteAlarm(alarmId)
    this.loadAlarms() // Refresh
    console.log(`[AlarmScheduler] Alarm deleted: ${alarmId}`)
  }

  /**
   * Get all pending alarms
   */
  getAlarms() {
    this.loadAlarms()
    return this.alarms
  }

  /**
   * Set the scheduled runs window reference (for broadcasting updates)
   */
  setScheduledRunsWindow(window) {
    scheduledRunsWindow = window
  }

  /**
   * Set the main window reference (for playing audio in renderer)
   */
  setMainWindow(win) {
    mainWindow = win
  }

  /**
   * Clean up expired alarms on app startup
   */
  cleanup() {
    preferencesStorage.cleanExpiredAlarms()
    console.log('[AlarmScheduler] Expired alarms cleaned')
  }
}

// Export singleton
module.exports = new AlarmScheduler()
