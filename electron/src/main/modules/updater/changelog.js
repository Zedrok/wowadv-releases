/**
 * Changelog for Baker's Raid Monitor
 * Version history and release notes
 */

const changelog = [
  {
    version: '1.1.0',
    date: 'April 17, 2026',
    changes: [
      'Added glow effect to scraper status indicator light',
      'Fixed price matching for Unsaved vs Saved raids in Next Runs popup',
      'Corrected hover tooltip display to show correct prices per raid type',
      'Improved scraper indicator visibility with multi-layer shadow glow'
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
