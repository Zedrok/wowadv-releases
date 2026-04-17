const { app, Tray, Menu } = require('electron')
const path = require('path')

let tray = null

function createTray(windows) {
  // Try to use custom icon, fallback to app icon if not found
  const iconPath = path.join(app.getAppPath(), 'assets', 'tray-icon.png')
  try {
    tray = new Tray(iconPath)
  } catch (_) {
    // Fallback: let Electron use default
    tray = new Tray(path.join(app.getAppPath(), 'assets', 'icon.png'))
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: windows.main.isVisible() ? 'Hide App' : 'Show App',
      click: () => {
        if (windows.main.isVisible()) {
          windows.main.hide()
        } else {
          windows.main.show()
          windows.main.focus()
        }
      }
    },
    { type: 'separator' },
    { label: 'Open Prices', click: () => windows.openPrices() },
    { label: 'Open Next Runs', click: () => windows.openNextRuns() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ])

  tray.setContextMenu(contextMenu)

  // Left click = toggle visibility
  tray.on('click', () => {
    if (windows.main.isVisible()) {
      windows.main.hide()
    } else {
      windows.main.show()
      windows.main.focus()
    }
  })

  // Update context menu when visibility changes
  windows.main.on('show', () => {
    const newMenu = Menu.buildFromTemplate([
      {
        label: 'Hide App',
        click: () => windows.main.hide()
      },
      { type: 'separator' },
      { label: 'Open Prices', click: () => windows.openPrices() },
      { label: 'Open Next Runs', click: () => windows.openNextRuns() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
    tray.setContextMenu(newMenu)
  })

  windows.main.on('hide', () => {
    const newMenu = Menu.buildFromTemplate([
      {
        label: 'Show App',
        click: () => {
          windows.main.show()
          windows.main.focus()
        }
      },
      { type: 'separator' },
      { label: 'Open Prices', click: () => windows.openPrices() },
      { label: 'Open Next Runs', click: () => windows.openNextRuns() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
    tray.setContextMenu(newMenu)
  })
}

function getTray() {
  return tray
}

module.exports = {
  createTray,
  getTray
}
