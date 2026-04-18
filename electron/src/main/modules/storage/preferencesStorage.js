const fs = require('fs')
const path = require('path')
const { app } = require('electron')

const userData = app.getPath('userData')
const preferencesFile = path.join(userData, 'alarm_preferences.json')

// Default preferences
const DEFAULT_PREFERENCES = {
  soundEnabled: true,
  pushNotificationsEnabled: true,
  defaultSound: null,
  defaultMinutesBefore: 15,
  alarms: [],
  lastSeenChangelogVersion: null
}

// Helper: generate UUID
function generateId() {
  try {
    return require('crypto').randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

// Load preferences from file
function loadPreferences() {
  try {
    if (fs.existsSync(preferencesFile)) {
      const data = fs.readFileSync(preferencesFile, 'utf-8')
      return JSON.parse(data)
    }
  } catch (e) {
    console.error('[PreferencesStorage] Error loading preferences:', e.message)
  }
  return JSON.parse(JSON.stringify(DEFAULT_PREFERENCES))
}

// Save preferences to file
function savePreferences(data) {
  try {
    fs.writeFileSync(preferencesFile, JSON.stringify(data, null, 2), 'utf-8')
    return true
  } catch (e) {
    console.error('[PreferencesStorage] Error saving preferences:', e.message)
    return false
  }
}

// Get all preferences
function getPreferences() {
  return loadPreferences()
}

// Update preference settings
function updatePreferenceSettings(updates) {
  const prefs = loadPreferences()
  Object.assign(prefs, updates)
  savePreferences(prefs)
  return prefs
}

// Add alarm
function addAlarm(raidTime, alertTime, sound, minutesBefore, buyerId = null, raidInfo = {}, buyerInfo = {}) {
  const prefs = loadPreferences()
  const newAlarm = {
    id: generateId(),
    raidTime,
    alertTime,
    raidInfo,
    buyerId,
    buyerInfo,
    sound,
    minutesBefore,
    status: 'pending',
    contacted: false,
    reAlarmScheduled: false,
    createdAt: new Date().toISOString()
  }
  prefs.alarms.push(newAlarm)
  savePreferences(prefs)
  return newAlarm
}

// Get pending alarms (not triggered or dismissed)
function getPendingAlarms() {
  const prefs = loadPreferences()
  return prefs.alarms.filter(a => a.status === 'pending')
}

// Update alarm status
function updateAlarmStatus(alarmId, status) {
  const prefs = loadPreferences()
  const alarm = prefs.alarms.find(a => a.id === alarmId)
  if (alarm) {
    alarm.status = status
    savePreferences(prefs)
  }
}

// Update alarm contacted status
function updateAlarmContacted(alarmId, contacted) {
  const prefs = loadPreferences()
  const alarm = prefs.alarms.find(a => a.id === alarmId)
  if (alarm) {
    alarm.contacted = contacted
    savePreferences(prefs)
  }
}

// Update alarm re-alarm scheduled status
function updateAlarmReAlarmScheduled(alarmId, scheduled) {
  const prefs = loadPreferences()
  const alarm = prefs.alarms.find(a => a.id === alarmId)
  if (alarm) {
    alarm.reAlarmScheduled = scheduled
    savePreferences(prefs)
  }
}

// Delete alarm
function deleteAlarm(alarmId) {
  const prefs = loadPreferences()
  prefs.alarms = prefs.alarms.filter(a => a.id !== alarmId)
  savePreferences(prefs)
}

// Clean expired alarms (older than 24 hours)
function cleanExpiredAlarms() {
  const prefs = loadPreferences()
  const now = new Date()
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  prefs.alarms = prefs.alarms.filter(a => {
    const alarmTime = new Date(a.alertTime)
    return alarmTime > twentyFourHoursAgo || a.status === 'pending'
  })

  savePreferences(prefs)
}

// Migrate alarms without url field
function migrateAlarmsUrl() {
  const prefs = loadPreferences()
  let migrated = false

  prefs.alarms = prefs.alarms.map(alarm => {
    // If raidInfo exists but has no url, add default
    if (alarm.raidInfo && !alarm.raidInfo.url) {
      alarm.raidInfo.url = 'https://www.thebakers.work/bookings-na/raids'
      migrated = true
      console.log(`[PreferencesStorage] Migrated alarm ${alarm.id} - added default URL`)
    }
    return alarm
  })

  if (migrated) {
    savePreferences(prefs)
    console.log('[PreferencesStorage] Migration completed - alarms updated with URLs')
  }

  return prefs
}

// Get last seen changelog version
function getLastSeenChangelogVersion() {
  const prefs = loadPreferences()
  return prefs.lastSeenChangelogVersion || null
}

// Update last seen changelog version
function updateLastSeenChangelogVersion(version) {
  const prefs = loadPreferences()
  prefs.lastSeenChangelogVersion = version
  savePreferences(prefs)
  return prefs
}

module.exports = {
  loadPreferences,
  savePreferences,
  getPreferences,
  updatePreferenceSettings,
  addAlarm,
  getPendingAlarms,
  updateAlarmStatus,
  updateAlarmContacted,
  updateAlarmReAlarmScheduled,
  deleteAlarm,
  cleanExpiredAlarms,
  migrateAlarmsUrl,
  getLastSeenChangelogVersion,
  updateLastSeenChangelogVersion,
  DEFAULT_PREFERENCES
}
