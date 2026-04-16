# Baker's Raid Monitor - Build Instructions

## Requisitos previos

- **Node.js** (v16+) y npm
- **Python 3.13+** con dependencias instaladas:
  ```
  pip install playwright pywin32 pycryptodome browser-cookie3
  playwright install msedge
  ```
- **Microsoft Edge** instalado en la máquina

## Opción 1: Build automático (Recomendado)

1. Doble click en `BUILD.bat` en la raíz del proyecto
2. Esperar a que termine
3. El ejecutable estará en: `electron\dist\Bakers Raid Monitor.exe`

## Opción 2: Build manual desde línea de comandos

```bash
cd electron
npm install
npm run dist
```

El `.exe` se generará en `electron\dist\Bakers Raid Monitor.exe`

## Ejecución del .exe

- **Doble click** directo en el archivo
- **O desde cmd**: 
  ```
  electron\dist\Bakers Raid Monitor.exe
  ```

## Estructura del ejecutable portable

El `.exe` incluye:
- Toda la aplicación Electron compilada
- Script Python (`bakers_raids.py`)
- Recursos necesarios

**Primera ejecución:** Se abrirá navegador para Discord OAuth. Una vez autenticado, se guardará el token automáticamente.

## Solución de problemas

### "electron-builder falla con error de symlinks"
- Asegurar Developer Mode activado en Windows 11
- O usar la carpeta `dist\win-unpacked\` directamente

### "Python script no encuentra dependencias"
```
pip install playwright pywin32 pycryptodome browser-cookie3
playwright install msedge
```

### "No se abre el navegador Discord"
- Asegurar Edge está instalado en: `C:\Program Files (x86)\Microsoft\Edge\Application\`
- O modificar `bakers_raids.py` para usar otro navegador

## Notas

- Archivo `bakers_token.txt` se genera en `%APPDATA%\Bakers Raid Monitor\` en primera ejecución
- JSON de datos (`raids.json`, `prices.json`) también se generan en esa carpeta
- El ejecutable es standalone y puede copiarse a otra máquina con las dependencias Python instaladas
