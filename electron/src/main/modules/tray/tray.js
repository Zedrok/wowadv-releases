const { app, Tray, Menu } = require('electron')
const path = require('path')

let tray = null

function createTray(windows) {
  // Use 32x32 PNG for tray (standard size for Windows tray)
  const appPath = app.getAppPath()
  const iconPath = path.join(appPath, 'assets', 'favicon-32x32.png')
  console.log('[Tray] appPath:', appPath)
  console.log('[Tray] iconPath:', iconPath)

  try {
    tray = new Tray(iconPath)
    console.log('[Tray] ✓ Tray created successfully')
  } catch (err) {
    console.error('[Tray] ✗ Error creating tray:', err.message)
    throw err
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
    {
      label: 'Quit',
      click: () => {
        console.log('[Tray] Quit clicked, closing app...')
        app.quit()
      }
    }
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
      {
        label: 'Quit',
        click: () => {
          console.log('[Tray] Quit clicked from show menu')
          app.quit()
        }
      }
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
      {
        label: 'Quit',
        click: () => {
          console.log('[Tray] Quit clicked from hide menu')
          app.quit()
        }
      }
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
