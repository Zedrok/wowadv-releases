/**
 * Storage helpers para localStorage — persistencia de filtros, favoritos, presets
 */

const STORAGE_KEYS = {
  filters: 'raids_filters',
  favorites: 'raids_favorites',
  presets: 'raids_presets',
}

/**
 * Guardar estado de filtros en localStorage
 * @param {Object} filters - objeto { soloFuturos, difficulty, tipo, loot, lock, raids, soloDescuento }
 */
export function saveFilters(filters) {
  try {
    localStorage.setItem(STORAGE_KEYS.filters, JSON.stringify(filters))
  } catch (e) {
    console.warn('Failed to save filters:', e)
  }
}

/**
 * Cargar filtros guardados desde localStorage
 * @returns {Object|null} - filtros guardados o null si no existen
 */
export function loadFilters() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.filters)
    return stored ? JSON.parse(stored) : null
  } catch (e) {
    console.warn('Failed to load filters:', e)
    return null
  }
}

/**
 * Guardar favoritos (array de keys: "date|time|team")
 * @param {Array<string>} favorites
 */
export function saveFavorites(favorites) {
  try {
    localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(favorites))
  } catch (e) {
    console.warn('Failed to save favorites:', e)
  }
}

/**
 * Cargar favoritos
 * @returns {Array<string>} - array de raid keys
 */
export function loadFavorites() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.favorites)
    return stored ? JSON.parse(stored) : []
  } catch (e) {
    console.warn('Failed to load favorites:', e)
    return []
  }
}

/**
 * Toggle favorito para un raid
 * @param {string} key - raid key (date|time|team)
 * @returns {boolean} - true si fue agregado, false si fue removido
 */
export function toggleFavorite(key) {
  const favorites = loadFavorites()
  const idx = favorites.indexOf(key)
  if (idx >= 0) {
    favorites.splice(idx, 1)
    saveFavorites(favorites)
    return false
  } else {
    favorites.push(key)
    saveFavorites(favorites)
    return true
  }
}

/**
 * Guardar preset de filtros
 * @param {string} name - nombre del preset
 * @param {Object} filters
 */
export function savePreset(name, filters) {
  try {
    const presets = loadPresets()
    presets[name] = filters
    localStorage.setItem(STORAGE_KEYS.presets, JSON.stringify(presets))
  } catch (e) {
    console.warn('Failed to save preset:', e)
  }
}

/**
 * Cargar todos los presets
 * @returns {Object} - { "preset name": {...filters} }
 */
export function loadPresets() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.presets)
    return stored ? JSON.parse(stored) : {}
  } catch (e) {
    console.warn('Failed to load presets:', e)
    return {}
  }
}

/**
 * Eliminar un preset
 * @param {string} name
 */
export function deletePreset(name) {
  try {
    const presets = loadPresets()
    delete presets[name]
    localStorage.setItem(STORAGE_KEYS.presets, JSON.stringify(presets))
  } catch (e) {
    console.warn('Failed to delete preset:', e)
  }
}
