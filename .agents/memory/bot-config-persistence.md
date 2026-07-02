---
name: Bot config persistence
description: Why bot config written to local files is lost on restart, and how to persist it via R2
---

**Rule:** Bot configuration must never be stored in local files on the bot's working directory. It must go through the bot-internal API to be stored in R2.

**Why:** When a bot restarts or redeploys, `spawnBotProcess` calls `downloadBotFiles` which does `rmSync(workDir, { recursive: true, force: true })` — wiping the entire working directory before re-downloading bot files from R2. Any config the bot wrote locally (e.g. `data/bienvenida_config.json`) is permanently lost.

**Solution implemented:**
- `artifacts/api-server/src/routes/bot-internal.ts` — `GET/PUT /api/bot-internal/config/:key` routes authenticated via HMAC token
- `artifacts/api-server/src/lib/bx-scripts.ts` — `getBxConfigPy()` exports the `bx_config.py` helper source
- `artifacts/api-server/src/lib/process-manager.ts` — injects `bx_config.py`, `BX_BOT_ID`, `BX_INTERNAL_TOKEN`, `BX_API_URL` into bot env
- Config is stored at `{r2Prefix}/_config/{key}.json` in R2, so it's downloaded on next start

**Auth:** HMAC-SHA256 of `botId` with `SESSION_SECRET`. Token computed by `computeBotToken(botId)` in `bot-internal.ts` and injected as `BX_INTERNAL_TOKEN`. Bot sends headers `X-Bot-Id` + `X-Bot-Token`.

**How to apply in bot code:**
```python
from bx_config import load_config, save_config
config = load_config("bienvenida")   # replaces _load(CONFIG_PATH)
save_config("bienvenida", config)    # replaces _save(CONFIG_PATH, config)
```
