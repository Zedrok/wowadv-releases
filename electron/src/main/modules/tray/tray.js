const { app, Tray, Menu } = require('electron')
const path = require('path')
const fs = require('fs')

let tray = null

function createTray(windows) {
  // Use 32x32 PNG for tray (standard size for Windows tray)
  const appPath = app.getAppPath()

  // Try multiple possible icon paths
  const possibleIconPaths = [
    path.join(appPath, 'out/renderer/assets/favicon-32x32-DdMieN0J.png'),
    path.join(appPath, 'assets', 'favicon-32x32.png'),
    path.join(appPath, 'out/renderer/assets/favicon-32x32.png'),
  ]

  let iconPath = null
  for (const p of possibleIconPaths) {
    if (fs.existsSync(p)) {
      iconPath = p
      console.log('[Tray] Found icon at:', p)
      break
    }
  }

  if (!iconPath) {
    console.warn('[Tray] Warning: Icon file not found')
    console.log('[Tray] Checked paths:')
    possibleIconPaths.forEach(p => console.log('[Tray]  - ' + p))
  }

  console.log('[Tray] appPath:', appPath)
  console.log('[Tray] iconPath:', iconPath)

  try {
    tray = new Tray(iconPath || '')
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
    { label: 'Runs Agendados', click: () => windows.openScheduledRuns() },
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
      { label: 'Runs Agendados', click: () => windows.openScheduledRuns() },
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
      { label: 'Runs Agendados', click: () => windows.openScheduledRuns() },
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
