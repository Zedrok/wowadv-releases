const https = require('https')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const { app, dialog } = require('electron')

const GITHUB_OWNER = 'Zedrok'
const GITHUB_REPO  = 'bakers-raid-releases'

let mainWindow = null

function setMainWindow(win) {
  mainWindow = win
}

function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      method: 'GET',
      headers: { 'User-Agent': 'bakers-raid-monitor' }
    }
    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', chunk => { body += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(body)) } catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')) })
    req.end()
  })
}

function parseVersion(v) {
  return (v || '').replace(/^[^\d]*/, '').split('.').map(Number)
}

function isNewer(latest, current) {
  const a = parseVersion(latest)
  const b = parseVersion(current)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0
    if (x > y) return true
    if (x < y) return false
  }
  return false
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    let settled = false
    function done(err) {
      if (settled) return; settled = true
      if (err) { file.destroy(); try { fs.unlinkSync(dest) } catch {} reject(err) }
      else resolve()
    }
    function request(currentUrl) {
      const mod = currentUrl.startsWith('https') ? https : require('http')
      mod.get(currentUrl, { headers: { 'User-Agent': 'bakers-raid-monitor' } }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          res.resume()
          request(res.headers.location)
          return
        }
        if (res.statusCode !== 200) { res.resume(); return done(new Error(`HTTP ${res.statusCode}`)) }
        const total = parseInt(res.headers['content-length'] || '0', 10)
        let received = 0
        res.on('data', chunk => {
          received += chunk.length
          if (total > 0 && mainWindow && !mainWindow.isDestroyed())
            mainWindow.webContents.send('update-progress', { status: 'downloading', percent: Math.round(received / total * 100) })
        })
        res.pipe(file)
        file.on('finish', () => file.close(done))
        file.on('error', done)
      }).on('error', done)
    }
    request(url)
  })
}

function launchUpdater(tempPath, exePath) {
  const vbsPath = path.join(path.dirname(exePath), '_br_update.vbs')
  const vbs = [
    'WScript.Sleep 2500',
    'Set fso = CreateObject("Scripting.FileSystemObject")',
    `fso.CopyFile "${tempPath}", "${exePath}", True`,
    `fso.DeleteFile "${tempPath}"`,
    `Set shell = CreateObject("WScript.Shell")`,
    `shell.Run Chr(34) & "${exePath}" & Chr(34), 1, False`,
    'WScript.Sleep 1000',
    `fso.DeleteFile "${vbsPath}"`
  ].join('\r\n')
  fs.writeFileSync(vbsPath, vbs, 'utf8')
  spawn('wscript.exe', ['//B', '//NoLogo', vbsPath], { detached: true, stdio: 'ignore' }).unref()
}

function applyPendingUpdate() {
  if (process.env.NODE_ENV === 'development') return false
  const exePath  = process.env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe')
  const tempPath = exePath + '.new'
  if (!fs.existsSync(tempPath)) return false
  launchUpdater(tempPath, exePath)
  return true
}

async function downloadAndReplace(url) {
  const exePath  = process.env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe')
  const tempPath = exePath + '.new'

  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-progress', { status: 'downloading', percent: 0 })

  try {
    await downloadFile(url, tempPath)
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-progress', { status: 'ready' })

    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Actualización lista',
      message: 'La actualización se ha descargado.',
      detail: 'La aplicación se reiniciará para aplicar la actualización.',
      buttons: ['Reiniciar ahora', 'Más tarde'],
      defaultId: 0
    })

    if (response === 0) {
      launchUpdater(tempPath, exePath)
      app.quit()
    }
  } catch (err) {
    dialog.showErrorBox('Error descargando actualización', err.message || 'Error desconocido')
  }
}

async function checkAndShowUpdate(silent = false) {
  try {
    const release   = await fetchLatestRelease()
    const latestTag = release.tag_name || ''
    const current   = app.getVersion()
    if (isNewer(latestTag, current)) {
      const asset = (release.assets || []).find(a => a.name.endsWith('.exe'))
      if (!silent) {
        const { response } = await dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Nueva versión disponible',
          message: `Versión ${latestTag} disponible`,
          detail: `Tienes la versión ${current}. ¿Quieres descargar e instalar ahora?`,
          buttons: ['Descargar e instalar', 'Ahora no'],
          defaultId: 0
        })
        if (response === 0) {
          if (asset) await downloadAndReplace(asset.browser_download_url)
        }
      }
      return { hasUpdate: true, latest: latestTag, current }
    }
    return { hasUpdate: false, latest: latestTag, current }
  } catch (e) {
    return { hasUpdate: false, error: e.message }
  }
}

module.exports = {
  setMainWindow,
  applyPendingUpdate,
  checkAndShowUpdate,
}
