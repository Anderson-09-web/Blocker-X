import { Router } from "express";
import { db, botsTable, deploymentsTable, botLogsTable, envVarsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, requireInvite } from "../lib/auth-middleware";
import { createNotification, notifyUser } from "../lib/notifications";
import { startBot, stopBot, restartBot, getProcessStatus } from "../lib/process-manager";
import { r2WriteFile, r2DeletePrefix } from "../lib/r2";
import { PYTHON_MAIN, PYTHON_REQUIREMENTS, JS_MAIN, JS_PACKAGE_JSON } from "../lib/templates";

const router = Router();

function formatBot(bot: any) {
  return {
    id: bot.id,
    name: bot.name,
    description: bot.description,
    language: bot.language,
    status: bot.status,
    userId: bot.userId,
    mainFile: bot.mainFile,
    r2Prefix: bot.r2Prefix,
    createdAt: bot.createdAt.toISOString(),
    updatedAt: bot.updatedAt.toISOString(),
  };
}

function getBotId(req: any): string {
  return Array.isArray(req.params.botId) ? req.params.botId[0] : req.params.botId;
}

router.post("/bots/verify-token", requireAuth, async (req, res): Promise<void> => {
  const { token } = req.body;
  if (!token) { res.status(400).json({ error: "Token is required" }); return; }
  try {
    const response = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${token.trim()}` },
    });
    if (!response.ok) {
      res.status(400).json({ error: "Token inválido" });
      return;
    }
    const data = await response.json() as { id: string; username: string; avatar: string | null };
    res.json({
      id: data.id,
      username: data.username,
      avatar: data.avatar ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png` : null,
    });
  } catch (err) {
    req.log.warn({ err }, "Failed to verify Discord token");
    res.status(500).json({ error: "No se pudo verificar el token" });
  }
});

router.get("/bots", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const bots = await db.select().from(botsTable)
    .where(eq(botsTable.userId, user.id))
    .orderBy(desc(botsTable.createdAt));
  const result = bots.map((bot) => ({
    ...formatBot(bot),
    status: getProcessStatus(bot.id) === "running" ? "running" : bot.status,
  }));
  res.json(result);
});

router.post("/bots", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const { name, description, language, token, clientId, clientSecret } = req.body;

  if (!name || !language) {
    res.status(400).json({ error: "Name and language are required" });
    return;
  }
  if (!["python", "javascript"].includes(language)) {
    res.status(400).json({ error: "Language must be python or javascript" });
    return;
  }
  if (!token) {
    res.status(400).json({ error: "Bot token is required" });
    return;
  }
  if (!clientId) {
    res.status(400).json({ error: "Client ID is required" });
    return;
  }
  if (!clientSecret) {
    res.status(400).json({ error: "Client Secret is required" });
    return;
  }

  const botId = randomUUID();
  const r2Prefix = `users/${user.discordId}/bots/${botId}`;
  const mainFile = language === "python" ? "main.py" : "index.js";

  const [bot] = await db.insert(botsTable).values({
    id: botId,
    name,
    description: description || null,
    language,
    status: "stopped",
    userId: user.id,
    mainFile,
    r2Prefix,
  }).returning();

  try {
    if (language === "python") {
      await r2WriteFile(`${r2Prefix}/main.py`, PYTHON_MAIN, "text/x-python");
      await r2WriteFile(`${r2Prefix}/requirements.txt`, PYTHON_REQUIREMENTS, "text/plain");
    } else {
      await r2WriteFile(`${r2Prefix}/index.js`, JS_MAIN, "application/javascript");
      await r2WriteFile(`${r2Prefix}/package.json`, JS_PACKAGE_JSON, "application/json");
    }
  } catch (err) {
    req.log.warn({ err, botId }, "Failed to upload default templates to R2");
  }

  const envEntries = [
    { key: "DISCORD_TOKEN", value: token },
    { key: "DISCORD_CLIENT_ID", value: clientId },
    { key: "DISCORD_CLIENT_SECRET", value: clientSecret },
  ];

  for (const entry of envEntries) {
    try {
      await db.insert(envVarsTable).values({ id: randomUUID(), botId, key: entry.key, value: entry.value });
    } catch (err) {
      req.log.warn({ err }, `Failed to save env var ${entry.key}`);
    }
  }

  await createNotification({
    userId: user.id,
    title: "Bot Created",
    message: `Your bot "${name}" has been created successfully.`,
    type: "success",
  });

  req.log.info({ botId, userId: user.id, language }, "Bot created");
  res.status(201).json(formatBot(bot));
});

router.get("/bots/:botId", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const botId = getBotId(req);
  const [bot] = await db.select().from(botsTable)
    .where(and(eq(botsTable.id, botId), eq(botsTable.userId, user.id)));
  if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
  res.json({ ...formatBot(bot), status: getProcessStatus(botId) === "running" ? "running" : bot.status });
});

router.patch("/bots/:botId", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const botId = getBotId(req);
  const { name, description, mainFile } = req.body;
  const [bot] = await db.update(botsTable).set({
    ...(name && { name }),
    ...(description !== undefined && { description }),
    ...(mainFile && { mainFile }),
  }).where(and(eq(botsTable.id, botId), eq(botsTable.userId, user.id))).returning();
  if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
  res.json(formatBot(bot));
});

router.delete("/bots/:botId", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const botId = getBotId(req);
  const [bot] = await db.select().from(botsTable)
    .where(and(eq(botsTable.id, botId), eq(botsTable.userId, user.id)));
  if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }

  try { await stopBot(botId); } catch (_) {}

  try { await r2DeletePrefix(bot.r2Prefix); } catch (err) {
    req.log.warn({ err }, "Failed to delete R2 files");
  }

  await db.delete(botsTable).where(eq(botsTable.id, botId));
  req.log.info({ botId }, "Bot deleted");
  res.json({ message: "Bot deleted successfully" });
});

router.post("/bots/:botId/start", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const botId = getBotId(req);
  const [bot] = await db.select().from(botsTable)
    .where(and(eq(botsTable.id, botId), eq(botsTable.userId, user.id)));
  if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }

  try {
    await startBot({ ...bot, userId: user.id });
    await createNotification({
      userId: user.id,
      title: "Bot Starting",
      message: `"${bot.name}" is starting up. You'll get a DM when it's fully online.`,
      type: "info",
    });
    req.log.info({ botId }, "Bot start requested");
    res.json({ message: "Bot is starting" });
  } catch (err: any) {
    res.status(409).json({ error: err.message || "Failed to start bot" });
  }
});

router.post("/bots/:botId/stop", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const botId = getBotId(req);
  const [bot] = await db.select().from(botsTable)
    .where(and(eq(botsTable.id, botId), eq(botsTable.userId, user.id)));
  if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }

  await stopBot(botId);
  await notifyUser({
    userId: user.id,
    discordId: user.discordId,
    title: "Bot Stopped",
    message: `"${bot.name}" has been stopped.`,
    type: "info",
  });
  res.json({ message: "Bot stopped" });
});

router.post("/bots/:botId/restart", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const botId = getBotId(req);
  const [bot] = await db.select().from(botsTable)
    .where(and(eq(botsTable.id, botId), eq(botsTable.userId, user.id)));
  if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }

  await restartBot({ ...bot, userId: user.id } as any, user.id);
  await notifyUser({
    userId: user.id,
    discordId: user.discordId,
    title: "Bot Restarted",
    message: `"${bot.name}" is restarting.`,
    type: "info",
  });
  res.json({ message: "Bot restarting" });
});

router.get("/bots/:botId/status", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const botId = getBotId(req);
  const [bot] = await db.select().from(botsTable)
    .where(and(eq(botsTable.id, botId), eq(botsTable.userId, user.id)));
  if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
  const liveStatus = getProcessStatus(botId);
  res.json({
    botId,
    status: liveStatus === "running" ? "running" : bot.status,
    uptime: null,
    memoryMB: null,
    lastStarted: null,
    lastStopped: null,
  });
});

export default router;
