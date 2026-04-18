/**
 * Changelog for Baker's Raid Monitor
 * Version history and release notes
 */

const changelog = [
  {
    version: '1.1.0',
    date: 'April 18, 2026',
    changes: [
      '🔊 Fixed audio playback for alarm previews and notifications',
      '🎵 Added 5 new alarm sounds: Bell Chime, Alarm Bells, Notification Ding, Marimba Bubble, Marimba Swoop',
      '⏰ Implemented scheduled runs window with full alarm management',
      '👁️ Moved "Actualizado:" timestamp to right of scraper status indicator',
      '🔒 Hidden DevTools console for production builds',
      '🌐 Fixed Discord OAuth headless mode for automated authentication',
      '📋 Added changelog modal on startup for unseen versions'
    ]
  },
  {
    version: '1.0.0',
    date: 'April 1, 2026',
    changes: [
      'Initial release of Baker\'s Raid Monitor',
      'Real-time raid booking monitoring with live updates',
      'Price matching and display for raid runs',
      'Scraper status indicator with color feedback',
      'Next Runs popup window with carousel view',
      'Price list window with category filters'
    ]
  }
]

/**
 * Get all changes since a specified version
 * @param {string} sinceVersion - Version to get changes from (exclusive)
 * @returns {Array} Array of changelog entries newer than sinceVersion
 */
function getChangesSince(sinceVersion) {
  if (!sinceVersion) return changelog

  const parts = (sinceVersion || '0.0.0').split('.').map(Number)
  const sinceKey = parts[0] * 10000 + (parts[1] || 0) * 100 + (parts[2] || 0)

  return changelog.filter(entry => {
    const entryParts = entry.version.split('.').map(Number)
    const entryKey = entryParts[0] * 10000 + (entryParts[1] || 0) * 100 + (entryParts[2] || 0)
    return entryKey > sinceKey
  })
}

module.exports = {
  changelog,
  getChangesSince
}
