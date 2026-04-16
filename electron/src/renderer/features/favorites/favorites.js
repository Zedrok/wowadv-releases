import { loadFavorites, saveFavorites, toggleFavorite as storageToggle } from '../../storage.js'

export let favorites = []

export function loadFavoritesList() {
  favorites = loadFavorites()
  return favorites
}

export function toggleFavorite(key) {
  const isFav = storageToggle(key)
  favorites = loadFavorites()
  return isFav
}

export function isFavorite(key) {
  return favorites.includes(key)
}
