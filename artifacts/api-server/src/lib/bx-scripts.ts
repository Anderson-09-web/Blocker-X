/**
 * bx-scripts.ts — Scripts Python que BlockerX inyecta en cada bot al iniciarlo.
 *
 * _bx_inject.py : Parcha discord.Client.__init__ para agregar un listener on_ready
 *                 que aplica BOT_STATUS. Funciona con Client, commands.Bot y cualquier subclase,
 *                 incluso si el usuario sobreescribe setup_hook.
 *
 * _bx_run.py    : Lanzador que importa el parche y luego corre el archivo principal del
 *                 usuario con runpy para que __name__ == "__main__" funcione normalmente.
 */

export function getBxInjectPy(): string {
  return `\
# _bx_inject.py — generado por BlockerX, no editar
# Parcha discord.Client.dispatch para aplicar BOT_STATUS cuando el bot está listo.
# Este enfoque no toca __init__ ni add_listener, por lo que es compatible con
# discord.Client, commands.Bot, py-cord y cualquier subclase.
import os as _os
import sys as _sys
import asyncio as _asyncio

try:
    import discord as _d

    _BX_STATUS_MAP = {
        "online":    _d.Status.online,
        "idle":      _d.Status.idle,
        "dnd":       _d.Status.dnd,
        "invisible": _d.Status.invisible,
    }
    _bx_target = _BX_STATUS_MAP.get(
        _os.getenv("BOT_STATUS", "online"), _d.Status.online
    )

    _bx_orig_dispatch = _d.Client.dispatch

    def _bx_patched_dispatch(self, event, *args, **kwargs):
        _bx_orig_dispatch(self, event, *args, **kwargs)
        if event == "ready":
            async def _apply_status():
                try:
                    await _asyncio.sleep(1)
                    await self.change_presence(status=_bx_target)
                    print(
                        f"[BlockerX] Status aplicado: {_bx_target.value}",
                        file=_sys.stderr, flush=True,
                    )
                except Exception as _e:
                    print(f"[BlockerX] Status error: {_e}", file=_sys.stderr, flush=True)

            try:
                loop = _asyncio.get_event_loop()
                loop.create_task(_apply_status())
            except Exception as _e:
                print(f"[BlockerX] No se pudo programar el status: {_e}", file=_sys.stderr, flush=True)

    _d.Client.dispatch = _bx_patched_dispatch
    print("[BlockerX] Parche de estado cargado.", file=_sys.stderr, flush=True)

except Exception as _bx_err:
    print(f"[BlockerX] Patch omitido: {_bx_err}", file=_sys.stderr, flush=True)
`;
}

export function getBxRunPy(mainFile: string): string {
  const quotedMain = JSON.stringify(mainFile); // produce cadena Python-segura
  return `\
# _bx_run.py — generado por BlockerX, no editar
# Importa el patch de status y luego ejecuta el bot del usuario.
import _bx_inject  # noqa: F401  — debe importarse antes que discord
import runpy as _runpy

_runpy.run_path(${quotedMain}, run_name="__main__")
`;
}

/**
 * bx_config.py — helper de configuración persistente para bots.
 *
 * Reemplaza la lectura/escritura de JSON local con llamadas al API interno de
 * BlockerX, de modo que la configuración se guarda en R2 y sobrevive reinicios
 * y re-deploys sin necesidad de cambiar la lógica del bot.
 *
 * Uso en el bot:
 *   from bx_config import load_config, save_config
 *
 *   config = load_config("bienvenida")   # equivale a _load("data/bienvenida_config.json")
 *   save_config("bienvenida", config)    # equivale a _save(...)
 */
export function getBxConfigPy(): string {
  return `\
# bx_config.py — generado por BlockerX, no editar
# Helper para persistir configuración en R2 (sobrevive reinicios y re-deploys).
import os as _os
import json as _json
import urllib.request as _req
import urllib.error as _uerr

_BX_API_URL      = _os.getenv("BX_API_URL", "http://127.0.0.1:3001")
_BX_BOT_ID       = _os.getenv("BX_BOT_ID", "")
_BX_INTERNAL_TOKEN = _os.getenv("BX_INTERNAL_TOKEN", "")


def _headers() -> dict:
    return {
        "Content-Type": "application/json",
        "X-Bot-Id": _BX_BOT_ID,
        "X-Bot-Token": _BX_INTERNAL_TOKEN,
    }


def load_config(key: str) -> dict:
    """Carga la configuración guardada en R2 para la clave dada.
    Retorna un dict vacío si no existe todavía."""
    url = f"{_BX_API_URL}/api/bot-internal/config/{key}"
    try:
        request = _req.Request(url, headers=_headers(), method="GET")
        with _req.urlopen(request, timeout=5) as resp:
            data = _json.loads(resp.read().decode())
            return data.get("data", {})
    except Exception as e:
        print(f"[bx_config] load_config('{key}') error: {e}")
        return {}


def save_config(key: str, data: dict) -> bool:
    """Guarda el dict en R2 bajo la clave dada.
    Retorna True si tuvo éxito, False en caso de error."""
    url = f"{_BX_API_URL}/api/bot-internal/config/{key}"
    payload = _json.dumps(data, ensure_ascii=False).encode()
    try:
        request = _req.Request(url, data=payload, headers=_headers(), method="PUT")
        with _req.urlopen(request, timeout=5) as resp:
            result = _json.loads(resp.read().decode())
            return result.get("ok", False)
    except Exception as e:
        print(f"[bx_config] save_config('{key}') error: {e}")
        return False
`;
}
