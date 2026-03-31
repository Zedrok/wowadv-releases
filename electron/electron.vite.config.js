import { defineConfig } from 'electron-vite'
import { resolve } from 'path'

export default defineConfig({
  main: {},
  preload: {
    build: {
      rollupOptions: {
        input: {
          index:  resolve(__dirname, 'src/preload/index.js'),
          popup:  resolve(__dirname, 'src/preload/popup.js'),
          prices: resolve(__dirname, 'src/preload/prices.js'),
        }
      }
    }
  },
  renderer: {
    build: {
      rollupOptions: {
        input: {
          index:  resolve(__dirname, 'src/renderer/index.html'),
          popup:  resolve(__dirname, 'src/renderer/popup.html'),
          prices: resolve(__dirname, 'src/renderer/prices.html'),
        }
      }
    }
  }
})
