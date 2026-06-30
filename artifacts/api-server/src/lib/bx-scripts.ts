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
