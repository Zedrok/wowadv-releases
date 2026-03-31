"""
Monitor de raids en vivo — thebakers.work/bookings-na/raids
GUI con Tkinter + Playwright en background thread.
"""

import json
import os
import queue
import random
import threading
import time
from datetime import datetime
from urllib.parse import urlparse, parse_qs

import tkinter as tk
from tkinter import ttk

from playwright.sync_api import sync_playwright

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------
URL_HOME    = "https://www.thebakers.work/home"
URL_RAIDS   = "https://www.thebakers.work/bookings-na/raids"
CALLBACK    = "https://www.thebakers.work/login/callback"
TOKEN_FILE  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bakers_token.txt")
RAIDS_JSON  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raids.json")
REFRESH_MIN = 15 * 60
REFRESH_MAX = 25 * 60

POLL_MS        = 3000
BTN_LOCKOUT_MS = 2000

STEALTH_SCRIPT = """
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    window.chrome = { runtime: {} };
"""

# Colores (tema oscuro)
BG_ROOT    = "#111118"
BG_HEADER  = "#1a1a2e"
BG_STATUS  = "#0f0f1a"
FG_TITLE   = "#e0a830"
FG_STATUS  = "#8888aa"
FG_BTN     = "#ffffff"
BG_BTN     = "#c0392b"
BG_BTN_HOV = "#e74c3c"

# Tags de fila
ROW_HEROIC   = {"background": "#2d0a0a", "foreground": "#ffbbbb"}
ROW_NORMAL   = {"background": "#0a0d2d", "foreground": "#aabbff"}
ROW_FULL     = {"background": "#1a1a1a", "foreground": "#555566"}
ROW_DEFAULT  = {"background": "#14141e", "foreground": "#bbbbcc"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def is_full(bookings: str) -> bool:
    """True si la raid está completa (booked >= total y total > 0)."""
    if "/" not in bookings:
        return False
    parts = bookings.split("/", 1)
    try:
        b, t = int(parts[0].strip()), int(parts[1].strip())
        return t > 0 and b >= t
    except ValueError:
        return False


def restore_session(page, status_cb):
    """Restaura la sesión con el token guardado o hace login manual."""
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE) as f:
            token = f.read().strip()
        status_cb("Usando token guardado...")
        page.goto(f"{CALLBACK}?token={token}", wait_until="domcontentloaded")
        try:
            page.wait_for_url(lambda u: u.rstrip("/").endswith("/home"), timeout=15000)
            status_cb("Sesión restaurada.")
            return
        except Exception:
            status_cb("Token expirado. Iniciando nuevo login...")
            os.remove(TOKEN_FILE)

    status_cb("Esperando login de Discord en la ventana del navegador...")
    page.goto(URL_HOME, wait_until="domcontentloaded")
    page.wait_for_url(lambda u: "login/callback" in u, timeout=120000)

    params = parse_qs(urlparse(page.url).query)
    token = params.get("token", [None])[0]
    if token:
        with open(TOKEN_FILE, "w") as f:
            f.write(token)
        status_cb("Token guardado.")

    page.wait_for_url(lambda u: u.rstrip("/").endswith("/home"), timeout=30000)


def extract_table(page):
    """Extrae filas de la tabla de raids."""
    return page.evaluate("""
        () => {
            const rows = [...document.querySelectorAll('tbody tr')];
            return rows.map(tr => {
                const tds = tr.querySelectorAll('td');
                const discount_span = tds[12]?.querySelector('span[title="Discount"]');
                const lock_div      = tds[12]?.querySelector('.mt-1');
                return {
                    date:       tds[2]?.innerText.trim()  ?? '',
                    time:       tds[3]?.innerText.trim()  ?? '',
                    raids:      tds[4]?.innerText.trim()  ?? '',
                    bookings:   tds[5]?.innerText.trim()  ?? '',
                    team:       tds[6]?.innerText.trim()  ?? '',
                    type:       tds[8]?.innerText.trim()  ?? '',
                    difficulty: tds[9]?.innerText.trim()  ?? '',
                    loot:       tds[10]?.innerText.trim() ?? '',
                    notes:      tds[11]?.innerText.trim() ?? '',
                    discount:   discount_span?.innerText.trim() ?? '',
                    lock:       lock_div?.innerText.trim() ?? '',
                };
            });
        }
    """)


# ---------------------------------------------------------------------------
# Scraper thread
# ---------------------------------------------------------------------------
class ScraperThread(threading.Thread):
    def __init__(self, data_queue: queue.Queue, status_queue: queue.Queue):
        super().__init__(daemon=True)
        self._data_q   = data_queue
        self._status_q = status_queue
        self._stop     = threading.Event()
        self._refresh  = threading.Event()

    def trigger_refresh(self):
        self._refresh.set()

    def stop(self):
        self._stop.set()
        self._refresh.set()  # desbloquea el wait()

    def _status(self, msg: str):
        self._status_q.put(msg)

    def run(self):
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(channel="msedge", headless=False)
                context = browser.new_context()
                context.add_init_script(STEALTH_SCRIPT)
                page = context.new_page()

                try:
                    restore_session(page, self._status)

                    self._status(f"Navegando a raids...")
                    page.goto(URL_RAIDS, wait_until="domcontentloaded")
                    page.wait_for_load_state("networkidle", timeout=15000)

                    while not self._stop.is_set():
                        try:
                            rows = extract_table(page)
                            ts   = datetime.now().strftime("%H:%M:%S")

                            with open(RAIDS_JSON, "w", encoding="utf-8") as f:
                                json.dump({"timestamp": ts, "data": rows}, f,
                                          indent=2, ensure_ascii=False)

                            wait     = random.randint(REFRESH_MIN, REFRESH_MAX)
                            next_ts  = datetime.fromtimestamp(time.time() + wait).strftime("%H:%M:%S")

                            self._data_q.put({
                                "rows":         rows,
                                "timestamp":    ts,
                                "next_refresh": next_ts,
                            })

                            self._status(f"Próximo refresco: {next_ts} ({wait // 60}m {wait % 60}s)")

                            # Esperar, interrumpible por trigger_refresh() o stop()
                            self._refresh.clear()
                            self._refresh.wait(timeout=wait)
                            self._refresh.clear()

                            if self._stop.is_set():
                                break

                            self._status("Recargando página...")
                            page.reload(wait_until="domcontentloaded")
                            page.wait_for_load_state("networkidle", timeout=15000)

                        except Exception as e:
                            self._status(f"Error: {e}. Reintentando en 60s...")
                            self._refresh.wait(timeout=60)
                            self._refresh.clear()
                            if not self._stop.is_set():
                                try:
                                    page.reload(wait_until="domcontentloaded")
                                    page.wait_for_load_state("networkidle", timeout=15000)
                                except Exception:
                                    pass
                finally:
                    context.close()
                    browser.close()
        except Exception as e:
            self._status(f"Error fatal del scraper: {e}")


# ---------------------------------------------------------------------------
# Aplicación GUI
# ---------------------------------------------------------------------------
class RaidMonitorApp(tk.Tk):
    COLUMNS = [
        ("date",       "Fecha",     120, False),
        ("time",       "Hora",       75, False),
        ("team",       "Equipo",    110, False),
        ("bookings",   "Books",      60, False),
        ("difficulty", "Dif.",       70, False),
        ("type",       "Tipo",       95, False),
        ("loot",       "Loot",      105, False),
        ("discount",   "Descuento",  95, False),
        ("lock",       "Lock",       90, False),
        ("raids",      "Raids",     250,  True),
        ("notes",      "Notas",     250,  True),
    ]

    def __init__(self):
        super().__init__()
        self.title("Baker's Raid Monitor")
        self.configure(bg=BG_ROOT)
        self.minsize(1100, 500)
        self.geometry("1400x680")

        self._data_q   = queue.Queue()
        self._status_q = queue.Queue()
        self._scraper  = ScraperThread(self._data_q, self._status_q)

        self._status_var = tk.StringVar(value="Iniciando scraper...")
        self._last_rows  = []

        self._build_ui()
        self.protocol("WM_DELETE_WINDOW", self._on_close)

        self._scraper.start()
        self._poll()

    # ------------------------------------------------------------------
    # Construcción de la UI
    # ------------------------------------------------------------------
    def _build_ui(self):
        self._apply_styles()

        # --- Barra superior ---
        top = tk.Frame(self, bg=BG_HEADER, pady=8)
        top.pack(fill="x")

        tk.Label(
            top, text="Baker's Raid Monitor",
            bg=BG_HEADER, fg=FG_TITLE,
            font=("Segoe UI", 14, "bold"),
        ).pack(side="left", padx=14)

        self._btn = tk.Button(
            top, text="⟳  Refresh Now",
            bg=BG_BTN, fg=FG_BTN,
            font=("Segoe UI", 10, "bold"),
            relief="flat", padx=14, pady=5,
            cursor="hand2",
            command=self._on_refresh,
        )
        self._btn.pack(side="right", padx=14)
        self._btn.bind("<Enter>", lambda _: self._btn.config(bg=BG_BTN_HOV))
        self._btn.bind("<Leave>", lambda _: self._btn.config(bg=BG_BTN))

        # --- Tabla ---
        frame = tk.Frame(self, bg=BG_ROOT)
        frame.pack(fill="both", expand=True, padx=6, pady=(4, 0))

        col_ids = [c[0] for c in self.COLUMNS]
        self._tree = ttk.Treeview(
            frame, columns=col_ids, show="headings",
            style="Raids.Treeview",
        )

        for col_id, heading, width, stretch in self.COLUMNS:
            self._tree.heading(col_id, text=heading,
                               command=lambda c=col_id: self._sort_by(c))
            self._tree.column(col_id, width=width, minwidth=40,
                              stretch=stretch, anchor="w")

        vsb = ttk.Scrollbar(frame, orient="vertical",   command=self._tree.yview)
        hsb = ttk.Scrollbar(frame, orient="horizontal", command=self._tree.xview)
        self._tree.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)

        vsb.pack(side="right",  fill="y")
        hsb.pack(side="bottom", fill="x")
        self._tree.pack(fill="both", expand=True)

        self._tree.tag_configure("heroic",  **ROW_HEROIC)
        self._tree.tag_configure("normal",  **ROW_NORMAL)
        self._tree.tag_configure("full",    **ROW_FULL)
        self._tree.tag_configure("default", **ROW_DEFAULT)

        # --- Status bar ---
        status = tk.Frame(self, bg=BG_STATUS, pady=5)
        status.pack(fill="x", side="bottom")

        tk.Label(
            status, textvariable=self._status_var,
            bg=BG_STATUS, fg=FG_STATUS,
            font=("Segoe UI", 9),
        ).pack(side="left", padx=12)

        self._count_var = tk.StringVar(value="")
        tk.Label(
            status, textvariable=self._count_var,
            bg=BG_STATUS, fg=FG_STATUS,
            font=("Segoe UI", 9),
        ).pack(side="right", padx=12)

    def _apply_styles(self):
        s = ttk.Style(self)
        s.theme_use("clam")

        s.configure("Raids.Treeview",
                     background=ROW_DEFAULT["background"],
                     fieldbackground=ROW_DEFAULT["background"],
                     foreground=ROW_DEFAULT["foreground"],
                     font=("Consolas", 10),
                     rowheight=22,
                     borderwidth=0)
        s.configure("Raids.Treeview.Heading",
                     background="#22223a",
                     foreground="#ccccdd",
                     font=("Segoe UI", 10, "bold"),
                     relief="flat")
        s.map("Raids.Treeview",
              background=[("selected", "#3a3a5a")],
              foreground=[("selected", "#ffffff")])
        s.map("Raids.Treeview.Heading",
              background=[("active", "#2a2a4a")])

    # ------------------------------------------------------------------
    # Lógica de polling
    # ------------------------------------------------------------------
    def _poll(self):
        # Mensajes de estado
        while not self._status_q.empty():
            try:
                self._status_var.set(self._status_q.get_nowait())
            except queue.Empty:
                break

        # Datos nuevos (quedarse con el más reciente)
        latest = None
        while not self._data_q.empty():
            try:
                latest = self._data_q.get_nowait()
            except queue.Empty:
                break

        if latest:
            self._populate_tree(latest["rows"])
            ts   = latest["timestamp"]
            nxt  = latest["next_refresh"]
            self._status_var.set(f"Actualizado: {ts}  |  Próximo: {nxt}")
            self._count_var.set(f"{len(latest['rows'])} raids")

        self.after(POLL_MS, self._poll)

    # ------------------------------------------------------------------
    # Tabla
    # ------------------------------------------------------------------
    def _populate_tree(self, rows):
        self._last_rows = rows
        self._tree.delete(*self._tree.get_children())

        for r in rows:
            diff = r.get("difficulty", "").lower()
            if is_full(r.get("bookings", "")):
                tag = "full"
            elif "heroic" in diff:
                tag = "heroic"
            elif "normal" in diff:
                tag = "normal"
            else:
                tag = "default"

            self._tree.insert("", "end", values=(
                r.get("date",       ""),
                r.get("time",       ""),
                r.get("team",       ""),
                r.get("bookings",   ""),
                r.get("difficulty", ""),
                r.get("type",       ""),
                r.get("loot",       ""),
                r.get("discount",   ""),
                r.get("lock",       ""),
                r.get("raids",      ""),
                r.get("notes",      ""),
            ), tags=(tag,))

    def _sort_by(self, col):
        """Ordena la tabla por la columna clicada."""
        rows = [
            (self._tree.set(iid, col), iid)
            for iid in self._tree.get_children()
        ]
        rows.sort(key=lambda x: x[0].lower())
        for idx, (_, iid) in enumerate(rows):
            self._tree.move(iid, "", idx)

    # ------------------------------------------------------------------
    # Eventos
    # ------------------------------------------------------------------
    def _on_refresh(self):
        self._btn.config(state="disabled")
        self._status_var.set("Forzando refresco...")
        self._scraper.trigger_refresh()
        self.after(BTN_LOCKOUT_MS, lambda: self._btn.config(state="normal"))

    def _on_close(self):
        self._scraper.stop()
        self._scraper.join(timeout=5)
        self.destroy()


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
def main():
    app = RaidMonitorApp()
    app.mainloop()


if __name__ == "__main__":
    main()
