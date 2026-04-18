"""
Monitorea en vivo la tabla de raids de thebakers.work/bookings-na/raids.
Escucha pasivamente las responses de la API que la página ya hace sola.
"""

import json
import os
import time
from datetime import datetime
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

URL_HOME   = "https://www.thebakers.work/home"
URL_RAIDS  = "https://www.thebakers.work/bookings-na/raids"
CALLBACK   = "https://www.thebakers.work/login/callback"
API_BASE      = "thebakers-backend-2.onrender.com/v1/run"
API_SERVICES  = "thebakers-backend-2.onrender.com/v1/services"
_DATA_DIR = os.environ.get("BAKERS_DATA_DIR") or os.path.dirname(os.path.abspath(__file__))
TOKEN_FILE          = os.path.join(_DATA_DIR, "bakers_token.txt")
RAIDS_JSON          = os.path.join(_DATA_DIR, "raids.json")
PRICES_JSON         = os.path.join(_DATA_DIR, "prices.json")
OPEN_URL_FLAG       = os.path.join(_DATA_DIR, "open_url.flag")
REFRESH_PRICES_FLAG = os.path.join(_DATA_DIR, "refresh_prices.flag")

STEALTH_SCRIPT = """
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    window.chrome = { runtime: {} };
"""

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def fmt_date(date_str):
    """'2026-03-30' → 'Monday 03/30'"""
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d")
        return f"{DAY_NAMES[d.weekday()]} {d.month:02d}/{d.day:02d}"
    except Exception:
        return date_str


def fmt_time(time_str):
    """'23:00' → '11:00 PM'"""
    try:
        h, m = map(int, time_str.split(":"))
        period = "AM" if h < 12 else "PM"
        h12 = h % 12 or 12
        return f"{h12}:{m:02d} {period}"
    except Exception:
        return time_str


def map_run(r):
    booked = r["maxBuyers"] - r["slotAvailable"]
    return {
        "date":       fmt_date(r["date"]),
        "time":       fmt_time(r["time"]),
        "raids":      r.get("raid", ""),
        "bookings":   f"{booked}/{r['maxBuyers']}",
        "team":       r.get("team", ""),
        "type":       r.get("runType", ""),
        "difficulty": r.get("difficulty", ""),
        "loot":       r.get("loot", ""),
        "notes":      r.get("note", ""),
        "discount":   "",
        "lock":       "Locked" if r.get("runIsLocked") else "Unlocked",
        "url":        f"https://www.thebakers.work/bookings-na/run/{r['id']}",
    }


def restore_session(page):
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE) as f:
            token = f.read().strip()
        print("Usando token guardado...")
        page.goto(f"{CALLBACK}?token={token}", wait_until="domcontentloaded")
        try:
            page.wait_for_url(lambda u: u.rstrip("/").endswith("/home"), timeout=15000)
            print("Sesión restaurada.")
            return False  # No new login (session restored)
        except Exception:
            print("Token expirado. Iniciando nuevo login...")
            os.remove(TOKEN_FILE)

    print("Navega al login de Discord en la ventana que apareció...")
    page.goto(URL_HOME, wait_until="domcontentloaded")
    page.wait_for_url(lambda u: "login/callback" in u, timeout=120000)

    params = parse_qs(urlparse(page.url).query)
    token = params.get("token", [None])[0]
    if token:
        with open(TOKEN_FILE, "w") as f:
            f.write(token)
        print("Token guardado.")

    page.wait_for_url(lambda u: u.rstrip("/").endswith("/home"), timeout=30000)
    return True  # New login completed (browser should close)


def refresh_prices_with_playwright(context, on_response):
    """Navega a /home en nueva page para capturar las respuestas naturales de la carga."""
    try:
        print("[Precios] Navegando a /home para capturar precios...")
        tmp_page = context.new_page()
        tmp_page.on("response", on_response)
        tmp_page.goto(URL_HOME, wait_until="networkidle")
        tmp_page.wait_for_timeout(2000)
        tmp_page.close()
        print("[Precios] Actualización completada.")
        return True
    except Exception as e:
        print(f"  [Precios refresh] Error: {e}")
    return False

def main():
    # Buffer acumulado por fecha: { "2026-03-30": [...runs] }
    buffer = {}
    prices_buf = {"services": [], "categories": []}

    def on_response(response):
        # ── Raids ──
        if API_BASE in response.url and "services" not in response.url:
            try:
                body = response.json()
                runs = body.get("info") or []
                if not runs:
                    return
                date_key = runs[0].get("date", "unknown")
                buffer[date_key] = runs
                print(f"  [API] {len(runs)} runs para {date_key} — total fechas: {len(buffer)}")

                all_runs = [r for date_runs in buffer.values() for r in date_runs]
                data = [map_run(r) for r in all_runs]
                timestamp = datetime.now().strftime("%H:%M:%S")

                with open(RAIDS_JSON, "w", encoding="utf-8") as f:
                    json.dump({"timestamp": timestamp, "data": data}, f,
                              indent=2, ensure_ascii=False)
                print(f"  [{timestamp}] raids.json actualizado — {len(data)} raids totales")
            except Exception as e:
                print(f"  [API raids] Error: {e}")
            return

        # ── Services ──
        if API_SERVICES in response.url:
            try:
                body = response.json()
                info = body.get("info") or []
                if not info:
                    return
                timestamp = datetime.now().strftime("%H:%M:%S")
                if "categories" in response.url:
                    prices_buf["categories"] = info
                    print(f"  [API] {len(info)} categorías de servicios")
                else:
                    prices_buf["services"] = info
                    print(f"  [API] {len(info)} servicios/precios")

                if prices_buf["services"]:
                    now = datetime.now()
                    with open(PRICES_JSON, "w", encoding="utf-8") as f:
                        json.dump({
                            "timestamp": now.strftime("%H:%M:%S"),
                            "date":      now.strftime("%Y-%m-%d"),
                            "services":   prices_buf["services"],
                            "categories": prices_buf["categories"],
                        }, f, indent=2, ensure_ascii=False)
                    print(f"  [{now.strftime('%H:%M:%S')}] prices.json actualizado")
            except Exception as e:
                print(f"  [API prices] Error: {e}")

    with sync_playwright() as p:
        # Check if token exists: launch headed if missing (for Discord auth), headless if valid
        token_exists = os.path.exists(TOKEN_FILE)
        headless_mode = token_exists
        browser = p.chromium.launch(channel="msedge", headless=headless_mode)
        context = browser.new_context()
        context.add_init_script(STEALTH_SCRIPT)
        page = context.new_page()

        login_completed = restore_session(page)

        # If login just completed in headed mode, close browser and reopen in headless for scraping
        if login_completed and not headless_mode:
            print("Login completado. Cerrando navegador de autenticación...")
            browser.close()
            print("Reabriendo navegador en modo headless para scraping...")
            browser = p.chromium.launch(channel="msedge", headless=True)
            context = browser.new_context()
            context.add_init_script(STEALTH_SCRIPT)
            page = context.new_page()

        page.on("response", on_response)

        # Cargar home para capturar precios
        print(f"\nNavegando a {URL_HOME} para capturar precios...")
        page.goto(URL_HOME, wait_until="domcontentloaded")
        page.wait_for_timeout(3000)

        # Navegar a raids
        print(f"Navegando a {URL_RAIDS} ...")
        try:
            page.goto(URL_RAIDS, wait_until="networkidle", timeout=60000)
        except Exception as e:
            print(f"\n⚠️  Error navegando a raids: {e}")
            print(f"Intentando continuar...")

        # Esperar a que la tabla se renderice (puede tomar tiempo con los datos de la API)
        try:
            page.wait_for_selector("tbody tr", timeout=30000)
        except Exception as e:
            print(f"\n⚠️  Error esperando tabla: {e}")
            print(f"URL actual: {page.url}")
            print(f"Token existe: {os.path.exists(TOKEN_FILE)}")
            print(f"Contenido de la página (primeros 500 chars):\n{page.content()[:500]}\n")
            # Si no hay tabla, probablemente el token expiró - salir para reintentar
            if not os.path.exists(TOKEN_FILE):
                print("Token no encontrado. Necesita re-autenticación. Saliendo...")
                raise KeyboardInterrupt()
            raise

        print("Listo. Escuchando actualizaciones en tiempo real. Ctrl+C para salir.\n")

        try:
            import time
            last_refresh = time.time()
            while True:
                if os.path.exists(OPEN_URL_FLAG):
                    url = open(OPEN_URL_FLAG).read().strip()
                    os.remove(OPEN_URL_FLAG)
                    if url.startswith("http"):
                        print(f"  [URL] Abriendo en browser: {url}")
                        try:
                            new_page = context.new_page()
                            new_page.goto(url, wait_until="domcontentloaded")
                        except Exception as e:
                            print(f"  [URL] Error: {e}")

                if os.path.exists(REFRESH_PRICES_FLAG):
                    os.remove(REFRESH_PRICES_FLAG)
                    try:
                        refresh_prices_with_playwright(context, on_response)
                    except Exception as e:
                        print(f"  [Prices] Error: {e}")

                page.wait_for_timeout(500)

                # Log every 60 seconds to show script is alive
                now = time.time()
                if now - last_refresh > 60:
                    print(f"[{now}] Script ejecutándose. Token exists: {os.path.exists(TOKEN_FILE)}")
                    last_refresh = now
        except KeyboardInterrupt:
            print("\n\nSaliendo...")

        context.close()
        browser.close()


if __name__ == "__main__":
    main()
