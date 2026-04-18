import { defineConfig } from 'electron-vite'
import { resolve } from 'path'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          'index-modular': resolve(__dirname, 'src/main/index-modular.js'),
          'modules/windows/manager': resolve(__dirname, 'src/main/modules/windows/manager.js'),
          'modules/scraper/scraper': resolve(__dirname, 'src/main/modules/scraper/scraper.js'),
          'modules/watcher/watcher': resolve(__dirname, 'src/main/modules/watcher/watcher.js'),
          'modules/updater/updater': resolve(__dirname, 'src/main/modules/updater/updater.js'),
          'modules/ipc/handlers': resolve(__dirname, 'src/main/modules/ipc/handlers.js'),
          'modules/tray/tray': resolve(__dirname, 'src/main/modules/tray/tray.js'),
          'modules/alarm/scheduler': resolve(__dirname, 'src/main/modules/alarm/scheduler.js'),
          'modules/storage/buyersStorage': resolve(__dirname, 'src/main/modules/storage/buyersStorage.js'),
          'modules/storage/preferencesStorage': resolve(__dirname, 'src/main/modules/storage/preferencesStorage.js')
        },
        preserveModules: true,
        preserveModulesRoot: resolve(__dirname, 'src/main')
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index:  resolve(__dirname, 'src/preload/index.js'),
          popup:  resolve(__dirname, 'src/preload/popup.js'),
          prices: resolve(__dirname, 'src/preload/prices.js'),
          'scheduled-runs': resolve(__dirname, 'src/preload/scheduled-runs.js'),
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: {
        input: {
          index:            resolve(__dirname, 'src/renderer/index.html'),
          popup:            resolve(__dirname, 'src/renderer/popup.html'),
          prices:           resolve(__dirname, 'src/renderer/prices.html'),
          'scheduled-runs': resolve(__dirname, 'src/renderer/scheduled-runs.html'),
        }
      }
    }
  }
})
