/**
 * Changelog for Baker's Raid Monitor
 * Version history and release notes
 */

const changelog = [
  {
    version: '1.2.2',
    date: '18 de abril de 2026',
    changes: [
      '📊 Agregada barra de progreso para descargas de actualización',
      '🌐 Historial de cambios traducido completamente al español',
      '⚙️ Actualizaciones solo se verifican manualmente, no automáticamente al iniciar'
    ]
  },
  {
    version: '1.2.1',
    date: '18 de abril de 2026',
    changes: [
      '🐛 Corregido modal de historial de cambios en app empaquetada',
      '🔄 Corregido repositorio de GitHub para actualizaciones automáticas',
      '📦 Asegurado que todos los módulos requeridos se copian al build'
    ]
  },
  {
    version: '1.2.0',
    date: '18 de abril de 2026',
    changes: [
      '🎨 Scrollbar oculto en popup de Próximos Runs (desplazable pero invisible)',
      '🔒 Botón Start deshabilitado hasta que autostart complete (previene ejecución doble)',
      '✨ Mejor gestión de estado para inicialización del scraper'
    ]
  },
  {
    version: '1.1.0',
    date: '18 de abril de 2026',
    changes: [
      '🔊 Corregida reproducción de audio para previsualizaciones y notificaciones',
      '🎵 Agregados 5 nuevos sonidos: Bell Chime, Alarm Bells, Notification Ding, Marimba Bubble, Marimba Swoop',
      '⏰ Implementada ventana de runs agendados con gestión completa de alarmas',
      '👁️ Movido timestamp "Actualizado:" a la derecha del indicador de scraper',
      '🔒 Consola de DevTools oculta en builds de producción',
      '🌐 Corregido modo headless de Discord OAuth para autenticación automatizada',
      '📋 Agregado modal de historial al iniciar para versiones no vistas'
    ]
  },
  {
    version: '1.0.0',
    date: '1 de abril de 2026',
    changes: [
      'Lanzamiento inicial de Baker\'s Raid Monitor',
      'Monitoreo en tiempo real de raids con actualizaciones en vivo',
      'Coincidencia y visualización de precios para runs',
      'Indicador de estado del scraper con retroalimentación de color',
      'Ventana popup de Próximos Runs con vista de carrusel',
      'Ventana de lista de precios con filtros de categorías'
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
