# Guía: Arreglar "Python no encontrado"

## Paso 1: Descargar Python

1. Ir a **https://www.python.org/downloads/**
2. Descargar **Python 3.13** (o la versión más reciente)
3. Ejecutar el instalador

## Paso 2: IMPORTANTE - Marcar en la instalación

**EN LA PRIMERA PANTALLA DEL INSTALADOR:**
✅ Marcar: **"Add Python to PATH"**

![python-install](https://imgur.com/qZvH5Zq.png)

Luego hacer click en **"Install Now"** o personalizar si es necesario.

## Paso 3: Verificar que Python funciona

1. Abrir **PowerShell** (click derecho en carpeta, "Abrir PowerShell aquí")
2. Escribir:
   ```
   python --version
   ```
3. Si sale algo como `Python 3.13.0`, está funcionando. ✅

Si sigue diciendo "comando no encontrado":
- **Reiniciar Windows** (importante para aplicar PATH)
- Repetir Paso 3

## Paso 4: Instalar dependencias Python del programa

1. Abrir **PowerShell** en la carpeta del programa (donde está `bakers_raids.py`)
2. Ejecutar:
   ```
   pip install playwright pywin32 pycryptodome browser-cookie3 python-dotenv
   ```
3. Esperar a que termine
4. Luego ejecutar:
   ```
   playwright install msedge
   ```

## Paso 5: Ejecuta el programa

Ahora al hacer click en "Start" debería funcionar.

---

## Si sigue sin funcionar:

**Opción A: Reiniciar todo**
- Cerrar todas las ventanas del programa
- Cerrar PowerShell
- Reiniciar Windows
- Volver a intentar

**Opción B: Instalar Python manualmente en PATH (avanzado)**
- Abrir Sistema → Variables de entorno
- Editar variable `PATH`
- Agregar la carpeta donde instalaste Python (típicamente `C:\Users\TuUsuario\AppData\Local\Programs\Python\Python313\`)
- Reiniciar Windows

---

**Si nada funciona, escribe exactamente qué error ves en PowerShell cuando ejecutas:**
```
python --version
pip --version
```
