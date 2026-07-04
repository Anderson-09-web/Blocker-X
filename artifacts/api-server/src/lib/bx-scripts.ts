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
# Parcha discord.Client.dispatch para aplicar presencia (status + actividad)
# cuando el bot conecta. Compatible con Client, commands.Bot y cualquier subclase.
#
# Variables de entorno que controla el panel:
#   BOT_STATUS         : online | idle | dnd | invisible  (default: online)
#   BOT_ACTIVITY_TYPE  : playing | watching | listening | streaming | competing | none
#   BOT_ACTIVITY_TEXT  : texto visible de la actividad
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
    _BX_ACTIVITY_MAP = {
        "playing":   _d.ActivityType.playing,
        "watching":  _d.ActivityType.watching,
        "listening": _d.ActivityType.listening,
        "streaming": _d.ActivityType.streaming,
        "competing": _d.ActivityType.competing,
    }

    _bx_status   = _BX_STATUS_MAP.get(_os.getenv("BOT_STATUS", "online"), _d.Status.online)
    _bx_act_type = _os.getenv("BOT_ACTIVITY_TYPE", "none").lower()
    _bx_act_text = _os.getenv("BOT_ACTIVITY_TEXT", "").strip()

    def _bx_build_activity():
        if _bx_act_type == "none" or not _bx_act_text:
            return None
        act_enum = _BX_ACTIVITY_MAP.get(_bx_act_type)
        if act_enum is None:
            return None
        if _bx_act_type == "streaming":
            return _d.Streaming(name=_bx_act_text, url="https://twitch.tv/placeholder")
        return _d.Activity(type=act_enum, name=_bx_act_text)

    _bx_orig_dispatch = _d.Client.dispatch

    def _bx_patched_dispatch(self, event, *args, **kwargs):
        _bx_orig_dispatch(self, event, *args, **kwargs)
        if event == "ready":
            async def _apply_presence():
                try:
                    await _asyncio.sleep(1)
                    activity = _bx_build_activity()
                    await self.change_presence(status=_bx_status, activity=activity)
                    act_info = f"{_bx_act_type}:{_bx_act_text}" if activity else "sin actividad"
                    print(
                        f"[BlockerX] Presencia aplicada — status={_bx_status.value}, actividad={act_info}",
                        file=_sys.stderr, flush=True,
                    )
                except Exception as _e:
                    print(f"[BlockerX] Presencia error: {_e}", file=_sys.stderr, flush=True)

            try:
                loop = _asyncio.get_event_loop()
                loop.create_task(_apply_presence())
            except Exception as _e:
                print(f"[BlockerX] No se pudo programar presencia: {_e}", file=_sys.stderr, flush=True)

    _d.Client.dispatch = _bx_patched_dispatch
    print("[BlockerX] Parche de presencia cargado.", file=_sys.stderr, flush=True)

except Exception as _bx_err:
    print(f"[BlockerX] Patch omitido: {_bx_err}", file=_sys.stderr, flush=True)
`;
}


export function getBxRunPy(mainFile: string): string {
  const quotedMain = JSON.stringify(mainFile);
  return `\
# _bx_run.py — generado por BlockerX, no editar
# Importa el patch de presencia y luego ejecuta el bot del usuario.
import _bx_inject  # noqa: F401  — debe importarse antes que discord
import runpy as _runpy

_runpy.run_path(${quotedMain}, run_name="__main__")
`;
}

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


export function getBxDataPy(): string {
  return `\
# bx_data.py — generado por BlockerX, no editar
# Almacenamiento clave-valor persistente para datos de guilds, usuarios, etc.
# Los datos sobreviven reinicios porque se guardan en R2.
#
# Uso:
#   from bx_data import db
#   db.set("guild", guild_id, "prefix", "!")
#   prefix = db.get("guild", guild_id, "prefix", "!")
#   db.delete("guild", guild_id, "prefix")
#   all_data = db.get_all("guild", guild_id)
#   db.set_many("user", user_id, {"xp": 100, "lvl": 2})
#   db.increment("user", user_id, "xp", 10)
#   db.delete_entity("guild", guild_id)
import os as _os
import json as _json
import threading as _threading
import urllib.request as _req

_BX_API_URL = _os.getenv("BX_API_URL", "http://127.0.0.1:3001")
_BX_BOT_ID  = _os.getenv("BX_BOT_ID", "")
_BX_TOKEN   = _os.getenv("BX_INTERNAL_TOKEN", "")


def _headers():
    return {
        "Content-Type": "application/json",
        "X-Bot-Id": _BX_BOT_ID,
        "X-Bot-Token": _BX_TOKEN,
    }


def _safe_key(s):
    clean = str(s)[:64]
    if not clean:
        raise ValueError("scope/entity_id no puede estar vacio")
    return clean


class _BxDatabase:
    def __init__(self):
        self._cache = {}
        self._loaded = set()
        self._lock = _threading.Lock()

    def _load(self, scope, eid):
        key = (scope, eid)
        if key in self._loaded:
            return self._cache.get(key, {})
        url = f"{_BX_API_URL}/api/bot-internal/data/{_safe_key(scope)}/{_safe_key(eid)}"
        try:
            rq = _req.Request(url, headers=_headers(), method="GET")
            with _req.urlopen(rq, timeout=5) as resp:
                result = _json.loads(resp.read().decode())
                data = result.get("data", {})
        except Exception as e:
            print(f"[bx_data] load({scope},{eid}) error: {e}")
            data = {}
        with self._lock:
            self._cache[key] = data
            self._loaded.add(key)
        return data

    def _flush(self, scope, eid):
        key = (scope, eid)
        data = self._cache.get(key, {})
        url = f"{_BX_API_URL}/api/bot-internal/data/{_safe_key(scope)}/{_safe_key(eid)}"
        payload = _json.dumps(data, ensure_ascii=False).encode()
        try:
            rq = _req.Request(url, data=payload, headers=_headers(), method="PUT")
            with _req.urlopen(rq, timeout=5):
                pass
        except Exception as e:
            print(f"[bx_data] flush({scope},{eid}) error: {e}")

    def get(self, scope, entity_id, key, default=None):
        return self._load(scope, str(entity_id)).get(key, default)

    def set(self, scope, entity_id, key, value):
        eid = str(entity_id)
        data = self._load(scope, eid)
        with self._lock:
            data[key] = value
            self._cache[(scope, eid)] = data
        self._flush(scope, eid)

    def set_many(self, scope, entity_id, fields):
        eid = str(entity_id)
        data = self._load(scope, eid)
        with self._lock:
            data.update(fields)
            self._cache[(scope, eid)] = data
        self._flush(scope, eid)

    def delete(self, scope, entity_id, key):
        eid = str(entity_id)
        data = self._load(scope, eid)
        if key in data:
            with self._lock:
                data.pop(key, None)
                self._cache[(scope, eid)] = data
            self._flush(scope, eid)

    def get_all(self, scope, entity_id):
        return dict(self._load(scope, str(entity_id)))

    def increment(self, scope, entity_id, key, amount=1):
        eid = str(entity_id)
        data = self._load(scope, eid)
        new_val = int(data.get(key, 0)) + amount
        with self._lock:
            data[key] = new_val
            self._cache[(scope, eid)] = data
        self._flush(scope, eid)
        return new_val

    def delete_entity(self, scope, entity_id):
        eid = str(entity_id)
        with self._lock:
            self._cache[(scope, eid)] = {}
            self._loaded.discard((scope, eid))
        self._flush(scope, eid)


db = _BxDatabase()
`;
}
