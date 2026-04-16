# Baker's Raid Monitor - Quick Start

## ⚠️ PREREQUISITO: Python en PATH

**Si al ejecutar ves "Python no encontrado":**

👉 **Ver:** [GUIA_SETUP_PYTHON.md](GUIA_SETUP_PYTHON.md)

En resumen:
- Instalar Python 3.13+ desde https://www.python.org/downloads/
- **IMPORTANTE:** Marcar ✅ "Add Python to PATH" durante la instalación
- Reiniciar Windows
- Ejecutar en PowerShell (en la carpeta del programa):
  ```
  pip install playwright pywin32 pycryptodome browser-cookie3
  playwright install msedge
  ```

---

## ⚡ Ejecución rápida

**Ya está listo.** Doble click en:
```
electron/dist/Bakers Raid Monitor.exe
```

---

## 🔨 Si necesitas hacer rebuild

**Opción A - Automático:**
```
BUILD.bat
```

**Opción B - Manual:**
```
cd electron
npm install
npm run dist
```

El `.exe` estará en `electron\dist\Bakers Raid Monitor.exe`

---

## ⚙️ Requisitos para ejecutar

Python 3.13+ con dependencias:
```
pip install playwright pywin32 pycryptodome browser-cookie3
playwright install msedge
```

---

## 📝 Primera ejecución

1. Ejecuta el `.exe`
2. Se abre navegador para Discord OAuth
3. Autoriza → token se guarda automáticamente
4. App lista

---

## 📂 Archivos generados

- `%APPDATA%\Bakers Raid Monitor\raids.json` — tabla de raids actual
- `%APPDATA%\Bakers Raid Monitor\prices.json` — precios
- `%APPDATA%\Bakers Raid Monitor\bakers_token.txt` — token Discord

## Detalles

Ver [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md) para solución de problemas.
