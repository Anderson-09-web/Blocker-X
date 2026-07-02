/**
 * Bot-internal config API
 *
 * Bot processes can call these endpoints to persist configuration in R2 instead
 * of local JSON files (which are wiped on every restart/deploy).
 *
 * Authentication: bots send their BOT_ID + BX_INTERNAL_TOKEN (HMAC of botId
 * with SESSION_SECRET) in headers. This is injected automatically by the
 * process manager as environment variables.
 *
 * Usage from bx_config.py (injected into bot working dir):
 *   from bx_config import load_config, save_config
 *   config = load_config("bienvenida")      # reads from R2
 *   save_config("bienvenida", config)       # writes to R2
 */

import { Router } from "express";
import { createHmac } from "crypto";
import { db, botsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { r2ReadFile, r2WriteFile } from "../lib/r2";

const router = Router();
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret";

/** Compute the expected token for a given botId */
function computeBotToken(botId: string): string {
  return createHmac("sha256", SESSION_SECRET).update(botId).digest("hex");
}

/** Middleware: validate X-Bot-Id + X-Bot-Token headers */
async function requireBotAuth(req: any, res: any, next: any): Promise<void> {
  const botId = req.headers["x-bot-id"] as string;
  const token = req.headers["x-bot-token"] as string;

  if (!botId || !token) {
    res.status(401).json({ error: "Missing bot authentication headers" });
    return;
  }

  const expected = computeBotToken(botId);
  if (token !== expected) {
    res.status(401).json({ error: "Invalid bot token" });
    return;
  }

  // Verify bot exists in DB
  try {
    const [bot] = await db.select().from(botsTable).where(eq(botsTable.id, botId));
    if (!bot) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }
    req.bot = bot;
  } catch (err: any) {
    res.status(500).json({ error: "DB error" });
    return;
  }

  next();
}

/** Validate config key — only alphanumeric, underscores, hyphens */
function isValidConfigKey(key: string): boolean {
  return /^[a-zA-Z0-9_\-]{1,64}$/.test(key);
}

// GET /api/bot-internal/config/:key
// Returns the JSON config stored in R2 for this bot + key.
router.get("/bot-internal/config/:key", requireBotAuth, async (req: any, res: any): Promise<void> => {
  const { key } = req.params;
  if (!isValidConfigKey(key)) {
    res.status(400).json({ error: "Invalid config key" });
    return;
  }

  const r2Path = `${req.bot.r2Prefix}/_config/${key}.json`;
  try {
    const content = await r2ReadFile(r2Path);
    const data = JSON.parse(content);
    res.json({ ok: true, data });
  } catch {
    // Not found — return empty object (first boot)
    res.json({ ok: true, data: {} });
  }
});

// PUT /api/bot-internal/config/:key
// Saves JSON config to R2 for this bot + key.
router.put("/bot-internal/config/:key", requireBotAuth, async (req: any, res: any): Promise<void> => {
  const { key } = req.params;
  if (!isValidConfigKey(key)) {
    res.status(400).json({ error: "Invalid config key" });
    return;
  }

  const body = req.body;
  if (typeof body !== "object" || body === null) {
    res.status(400).json({ error: "Body must be a JSON object" });
    return;
  }

  const r2Path = `${req.bot.r2Prefix}/_config/${key}.json`;
  try {
    await r2WriteFile(r2Path, JSON.stringify(body, null, 2));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save config" });
  }
});

export { computeBotToken };
export default router;
