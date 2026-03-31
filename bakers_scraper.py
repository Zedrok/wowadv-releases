"""
Extrae los cards del schedule de thebakers.work.
- Primera vez: inicia sesión con Discord, guarda el token JWT.
- Siguientes veces: reutiliza el token guardado.
"""

import json
import os
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

URL        = "https://www.thebakers.work/home"
CALLBACK   = "https://www.thebakers.work/login/callback"
TOKEN_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bakers_token.txt")


def extract_cards(page):
    page.wait_for_selector("#schedule-section", timeout=30000)
    return page.evaluate("""
        () => {
            const section = document.querySelector('#schedule-section');
            if (!section) return [];
            const results = [];
            for (const card of section.querySelectorAll('.group')) {
                const name       = card.querySelector('h4')?.innerText?.trim() ?? '';
                const difficulty = card.querySelector('span.text-purple-300')?.innerText?.trim() ?? '';
                const raids      = card.querySelector('span.text-xs.text-gray-500')?.innerText?.trim() ?? '';
                const loot       = card.querySelector('span.font-medium')?.innerText?.trim() ?? '';
                const slots      = card.querySelector('span.text-green-400, span.text-green-500')?.innerText?.trim() ?? '';
                let time = '';
                for (const s of card.querySelectorAll('span')) {
                    const t = s.innerText?.trim();
                    if (t && (t.includes('AM') || t.includes('PM'))) { time = t; break; }
                }
                results.push({ name, difficulty, raids, time, loot, slots_available: parseInt(slots) || 0 });
            }
            return results;
        }
    """)


def do_login(page):
    """Flujo completo de login OAuth. Captura y guarda el JWT."""
    print("Navegando a la web...")
    page.goto(URL, wait_until="domcontentloaded")

    print("Esperando que completes el login con Discord en la ventana que apareció...")

    # Esperar específicamente hasta que la URL sea el callback con el token
    page.wait_for_url(lambda u: "login/callback" in u, timeout=120000)
    print(f"Callback detectado.")

    # Capturar token de la URL
    params = parse_qs(urlparse(page.url).query)
    token = params.get("token", [None])[0]

    if token:
        with open(TOKEN_FILE, "w") as f:
            f.write(token)
        print(f"Token guardado en {TOKEN_FILE}")
    else:
        print("ADVERTENCIA: no se encontró token en la URL de callback.")

    # Esperar a que el frontend procese el token y navegue a /home
    print("Esperando redirección a /home...")
    page.wait_for_url(lambda u: u.rstrip("/").endswith("/home"), timeout=30000)
    print("Login completado.")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=False)
        context = browser.new_context()
        page = context.new_page()

        if os.path.exists(TOKEN_FILE):
            with open(TOKEN_FILE) as f:
                token = f.read().strip()
            print("Usando token guardado...")
            page.goto(f"{CALLBACK}?token={token}", wait_until="domcontentloaded")
            try:
                page.wait_for_url(
                    lambda u: u.rstrip("/").endswith("/home"),
                    timeout=15000
                )
                print("Sesión restaurada correctamente.")
            except Exception:
                print("Token expirado. Iniciando nuevo login...")
                os.remove(TOKEN_FILE)
                do_login(page)
        else:
            print("Primera ejecución: necesitas iniciar sesión una vez.")
            do_login(page)

        page.wait_for_load_state("networkidle", timeout=15000)

        print("Extrayendo cards del schedule...")
        cards = extract_cards(page)

        print(f"\nEncontradas {len(cards)} cards:\n")
        for i, card in enumerate(cards, 1):
            print(f"  {i:2}. [{card['difficulty']:7}] {card['name']:<20} | {card['time']:<14} | {card['raids']}")
            print(f"       Loot: {card['loot']:<25} | Slots: {card['slots_available']}")
            print()

        with open("schedule.json", "w", encoding="utf-8") as f:
            json.dump(cards, f, indent=2, ensure_ascii=False)
        print("Datos guardados en schedule.json")

        input("\nPresiona ENTER para cerrar el navegador...")
        context.close()
        browser.close()


if __name__ == "__main__":
    main()
