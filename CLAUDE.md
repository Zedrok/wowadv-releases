# Baker's Raid Monitor — Contexto del proyecto

## Descripción
Aplicación Electron para monitorear en tiempo real la tabla de raids de `https://www.thebakers.work/bookings-na/raids`.
Incluye scraper Python + interfaz de escritorio con filtros, precios y próximos runs.

## Estructura del proyecto

```
wow-advertising/
├── bakers_raids.py       # Script activo: monitorea /bookings-na/raids en vivo
├── bakers_scraper.py     # Extrae schedule cards de /home (terminado, funciona)
├── bakers_gui.py         # GUI Python (legacy)
├── bakers_token.txt      # JWT token (NO está en el repo — generarlo al primer run)
├── raids.json            # Output del monitor (generado en runtime)
├── prices.json           # Precios scrapeados (generado en runtime)
├── schedule.json         # Output del scraper /home (generado en runtime)
└── electron/             # App Electron (interfaz principal)
    └── src/
        ├── main/         # Proceso principal Electron
        ├── preload/      # Bridges IPC
        └── renderer/     # UI: index.html, prices.html, popup.html
```

## Autenticación (bakers_raids.py)

- La web requiere **Discord OAuth**
- Flujo: `/home` → Discord OAuth → `/login/callback?token=JWT` → `/home`
- El JWT se captura de la URL y se guarda en `bakers_token.txt`
- En runs siguientes: navega a `/login/callback?token=SAVED_JWT` automáticamente
- **Si el token expira:** borrar `bakers_token.txt` y re-ejecutar → login manual una vez

## Scraper técnico (bakers_raids.py)

- Browser: Edge via Playwright (`channel="msedge"`)
- Stealth: `navigator.webdriver = undefined`
- Refresh: random entre 15 y 25 minutos
- Output: `raids.json`

### Estructura de la tabla (`tbody tr`, 13 columnas `td`)

| Index | Campo | Ejemplo |
|---|---|---|
| 0 | vacío | — |
| 1 | botón ojo (SVG) | — |
| 2 | `date` | Thursday 03/26 |
| 3 | `time` | 9:00 AM |
| 4 | `raids` | The Voidspire 6/6 & Dreamrift 1/1 |
| 5 | `bookings` | 8/20 |
| 6 | `team` | Garçom |
| 7 | dash | - |
| 8 | `type` | Full Clear |
| 9 | `difficulty` | Heroic / Normal |
| 10 | `loot` | Group loot |
| 11 | `notes` | MAX X10 OF EACH... |
| 12 | `discount` + `lock` | div con spans `.text-green-200`/`.text-zinc-200` |

## Setup en una máquina nueva

### Python
```
pip install playwright pywin32 pycryptodome browser-cookie3
playwright install msedge
```

### Electron
```
cd electron
npm install
npm run build
npx electron-builder --win portable --publish=never
# El ejecutable queda en dist/win-unpacked/
```

> **Nota:** electron-builder falla al crear el `.exe` portable en Windows sin Developer Mode (error de symlinks).
> La carpeta `dist/win-unpacked/` funciona perfectamente como alternativa.

## Notas importantes

- `bakers_token.txt` no está en el repo — se genera automáticamente al primer run del scraper
- Los archivos `.json` de datos tampoco están en el repo — se generan en runtime
- Python 3.13, Windows 11, Edge instalado en `C:\Program Files (x86)\Microsoft\Edge\Application\`
