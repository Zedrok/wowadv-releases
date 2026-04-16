# Baker's Raid Monitor - Modular Architecture

## Overview

The codebase is organized with a **feature-based, modular architecture** to keep files small (<500 lines) and maintainable.

```
electron/
├── src/
│   ├── main/
│   │   ├── index-modular.js          (~70 lines) — entry point, orchestrates modules
│   │   └── modules/
│   │       ├── updater/
│   │       │   └── updater.js        (145 lines) — auto-updates via GitHub
│   │       ├── scraper/
│   │       │   └── scraper.js        (135 lines) — Python spawn/kill, deps
│   │       ├── watcher/
│   │       │   └── watcher.js        (85 lines) — file watchers, data sync
│   │       ├── ipc/
│   │       │   └── handlers.js       (60 lines) — all IPC handlers
│   │       └── windows/
│   │           └── manager.js        (95 lines) — window creation & management
│   ├── preload/
│   │   └── index.js                  — contextBridge for main window
│   ├── renderer/
│   │   ├── renderer-index.js         (~200 lines) — entry point, event orchestration
│   │   ├── storage.js                — localStorage helpers
│   │   ├── features/
│   │   │   ├── table/
│   │   │   │   └── table.js          (135 lines) — table render, sorting
│   │   │   ├── filters/
│   │   │   │   └── filters.js        (140 lines) — filter logic, dropdowns
│   │   │   ├── favorites/
│   │   │   │   └── favorites.js      (15 lines) — favorites toggles
│   │   │   └── scraper/
│   │   │       └── scraper.js        (30 lines) — scraper UI control
│   │   └── utils/
│   │       ├── helpers.js            (70 lines) — date/time, esc, etc.
│   │       └── formatters.js         (30 lines) — badge HTML, diffs
│   └── index.html, popup.html, prices.html
└── .github/workflows/release.yml     — CI/CD for GitHub releases
```

## Module Structure

### Main Process (`src/main/`)

**`index-modular.js`** — Thin orchestrator:
- Initializes app lifecycle
- Creates windows via `WindowsManager`
- Wires up modules with shared config
- Registers IPC handlers

**`modules/updater/`** — Auto-update system:
- `fetchLatestRelease()` — GitHub API call
- `parseVersion()`, `isNewer()` — semantic versioning
- `downloadFile()` — progress tracking
- `launchUpdater()` — VBScript installer
- `checkAndShowUpdate()` — user dialog flow

**`modules/scraper/`** — Python subprocess:
- `start()` — spawn with dep check
- `stop()` — kill process
- `ensurePythonDeps()` — auto-install missing packages
- Events via IPC: logs, status

**`modules/watcher/`** — File polling:
- `watchRaids()`, `watchPrices()` — 500ms poll intervals
- `broadcastEvent()` — sync to all windows
- `getRaids()`, `getPrices()` — on-demand data fetch

**`modules/ipc/`** — All IPC handlers:
- Scraper control: start, stop, refresh
- Data access: get-raids, get-prices
- Window mgmt: open-next-runs, open-prices
- Favorites: get-fav-lists, save-fav-lists
- Updates: get-app-version, check-for-updates

**`modules/windows/`** — Window lifecycle:
- `createMain()` — main window (1440×780)
- `createNextRuns()` — popup (380×460)
- `createPrices()` — prices tab (680×600)
- Preload assignment, dev tools setup

### Renderer Process (`src/renderer/`)

**`renderer-index.js`** — Thin orchestrator:
- Imports all features
- Wires event listeners
- Calls feature functions on user actions
- Updates DOM via feature modules

**`features/table/`** — Table rendering:
- `renderTable()` — build+render rows
- `applySort()` — client-side sorting
- `computeFlashes()` — new/updated row animation
- `buildRow()` — HTML row with badges

**`features/filters/`** — Filter logic:
- `applyFilter()` — cascade all filters
- `populateDropdowns()` — extract unique values
- `loadSavedFilters()`, `saveCurrentFilters()` — localStorage persist
- `resetFilters()` — clear all

**`features/favorites/`** — Favorite toggles:
- `toggleFavorite()` — add/remove from list
- `loadFavoritesList()` — init from storage
- Thin wrapper around `storage.js`

**`features/scraper/`** — UI control:
- `startScraper()`, `stopScraper()` — IPC calls
- `setScraperState()` — update UI status
- `refreshNow()` — throttled refresh button

**`utils/helpers.js`** — Shared utilities:
- Date parsing: `parseRaidToDate()`, EDT/EST timezone
- Helpers: `esc()`, `rowKey()`, `isFull()`, `highLoad()`

**`utils/formatters.js`** — HTML builders:
- `diffBadge()`, `bookingsBadge()` — colored badges
- `diffClass()` — CSS class for difficulty

## Data Flow

### Updates (Phase 1)

```
App Start
  ↓
applyPendingUpdate()  [check for exe.new]
  ↓
createWindow()
  ↓
(3s later) checkAndShowUpdate(silent=true)  [GitHub API]
  ↓
User clicks "Check Updates"
  ↓
checkAndShowUpdate(silent=false)  [show dialog]
  ↓
downloadFile()  [emit update-progress]
  ↓
Dialog: "Restart now" → launchUpdater() → VBScript → app.quit()
```

### Data Sync (Phase 2)

```
Scraper writes raids.json
  ↓
watcher.watchRaids()  [500ms poll]
  ↓
broadcastEvent('raids-data')  [send to main + popup]
  ↓
renderer.onRaidsData()
  ↓
computeFlashes() → renderTable()
```

### Filter Persistence (Phase 2)

```
User changes filter
  ↓
Feature: filters.filters.field = value
  ↓
Feature: saveCurrentFilters()  [localStorage]
  ↓
Index: renderPage()  [re-render with new filters]
```

## Adding a New Feature

1. **Create module dir**: `electron/src/renderer/features/myfeature/`
2. **Export functions**: Only export pure functions (no DOM mutation in the module)
3. **Index orchestrates**: `renderer-index.js` calls feature functions, handles DOM
4. **Import in index**: `import * as myfeature from './features/myfeature/myfeature.js'`

Example:

```javascript
// features/myfeature/myfeature.js
export function doSomething(data) {
  return processedData
}

// renderer-index.js
import * as myfeature from './features/myfeature/myfeature.js'

button.addEventListener('click', () => {
  const result = myfeature.doSomething(data)
  document.getElementById('result').innerHTML = result
})
```

## Maintenance

- **Max file size**: 500 lines (very few exceptions)
- **Module exports**: Only pure functions (testable)
- **DOM access**: Only in `renderer-index.js` or feature orchestrators
- **IPC calls**: Only in feature modules (centralized in `modules/ipc/`)
- **Tests**: Can mock any module (no circular deps)

## Migration from Old Structure

Old files still exist for reference:
- `src/main/index.js` — old monolithic (keep during transition)
- `src/renderer/renderer.js` — old monolithic (keep during transition)

**To migrate fully:**
1. Delete old files once new ones tested
2. Update `package.json` main entry (already done)
3. Update `index.html` script src (already done)
