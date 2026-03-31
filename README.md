# Baker's Raid Monitor

Monitor en tiempo real de raids de [thebakers.work](https://www.thebakers.work/bookings-na/raids).

---

## Requisitos previos

- **Node.js** (v18+)
- **Python 3.x** (`py`, `python` o `python3` en PATH)
- **Microsoft Edge** instalado
- **Git**

> Las dependencias Python (`playwright`, `pywin32`, etc.) se instalan automáticamente al primer arranque.

---

## Setup inicial (primera vez)

```bash
cd electron
npm install
```

Eso es todo. Las dependencias Python las maneja la app.

---

## Desarrollo

```bash
cd electron
npm run dev
```

Abre la app Electron en modo desarrollo con DevTools.

---

## Producción (ejecutable portable)

```bash
cd electron
npm run build
npx electron-builder --win portable --publish=never
```

El ejecutable queda en `electron/dist/win-unpacked/`.

> Si falla por error de symlinks (Windows sin Developer Mode), usá directamente la carpeta `win-unpacked/`.

---

## Primer arranque

1. Al presionar **Iniciar Scraper**, la app detecta si faltan dependencias y las instala automáticamente (visible en el panel de logs).
2. Se abrirá una ventana Edge para el login con **Discord OAuth**.
3. Completá el login una sola vez — el token JWT se guarda en `bakers_token.txt`.
4. En arranques siguientes el login es automático.

> Si el scraper falla con error de autenticación, borrá `bakers_token.txt` y reiniciá.

---

## Archivos generados en runtime (no están en el repo)

| Archivo | Descripción |
|---|---|
| `bakers_token.txt` | JWT de sesión Discord |
| `raids.json` | Datos de raids en vivo |
| `prices.json` | Precios scrapeados |
| `schedule.json` | Schedule de /home |
