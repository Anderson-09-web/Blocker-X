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
# Parcha discord.Client.__init__ para aplicar BOT_STATUS al conectar.
import os as _os
import sys as _sys

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

    _bx_orig_init = _d.Client.__init__

    def _bx_patched_init(self, *args, **kwargs):
        _bx_orig_init(self, *args, **kwargs)
        _bx_client = self

        async def _bx_on_ready():
            try:
                await _bx_client.change_presence(status=_bx_target)
                print(
                    f"[BlockerX] Status aplicado: {_bx_target.value}",
                    file=_sys.stderr, flush=True,
                )
            except Exception as _e:
                print(f"[BlockerX] Status error: {_e}", file=_sys.stderr, flush=True)

        # add_listener es el mecanismo oficial de discord.py.
        # Se ejecuta junto al on_ready del usuario, sin reemplazarlo.
        self.add_listener(_bx_on_ready, "on_ready")

    _d.Client.__init__ = _bx_patched_init
    print("[BlockerX] Patch de status cargado.", file=_sys.stderr, flush=True)

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
