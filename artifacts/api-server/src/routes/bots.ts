import { Router } from "express";
import { db, botsTable, deploymentsTable, botLogsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, requireInvite } from "../lib/auth-middleware";
import { createNotification } from "../lib/notifications";

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

router.get("/bots", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const bots = await db.select().from(botsTable).where(eq(botsTable.userId, user.id)).orderBy(desc(botsTable.createdAt));
  res.json(bots.map(formatBot));
});

router.post("/bots", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const { name, description, language, mainFile } = req.body;

  if (!name || !language) {
    res.status(400).json({ error: "Name and language are required" });
    return;
  }

  const botId = randomUUID();
  const r2Prefix = `users/${user.discordId}/bots/${botId}`;

  const [bot] = await db.insert(botsTable).values({
    id: botId,
    name,
    description: description || null,
    language,
    status: "stopped",
    userId: user.id,
    mainFile: mainFile || (language === "python" ? "bot.py" : "index.js"),
    r2Prefix,
  }).returning();

  req.log.info({ botId, userId: user.id }, "Bot created");
  res.status(201).json(formatBot(bot));
});

router.get("/bots/:botId", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const botId = Array.isArray(req.params.botId) ? req.params.botId[0] : req.params.botId;
  const [bot] = await db.select().from(botsTable).where(and(eq(botsTable.id, botId), eq(botsTable.userId, user.id)));
  if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
  res.json(formatBot(bot));
});

router.patch("/bots/:botId", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const botId = Array.isArray(req.params.botId) ? req.params.botId[0] : req.params.botId;
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
  const botId = Array.isArray(req.params.botId) ? req.params.botId[0] : req.params.botId;
  const [bot] = await db.delete(botsTable).where(and(eq(botsTable.id, botId), eq(botsTable.userId, user.id))).returning();
  if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
  req.log.info({ botId }, "Bot deleted");
  res.json({ message: "Bot deleted successfully" });
});

router.post("/bots/:botId/start", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const botId = Array.isArray(req.params.botId) ? req.params.botId[0] : req.params.botId;
  const [bot] = await db.select().from(botsTable).where(and(eq(botsTable.id, botId), eq(botsTable.userId, user.id)));
  if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
  await db.update(botsTable).set({ status: "starting" }).where(eq(botsTable.id, botId));
  await db.insert(botLogsTable).values({ id: randomUUID(), botId, level: "info", message: "Bot starting..." });
  setTimeout(async () => {
    await db.update(botsTable).set({ status: "running" }).where(eq(botsTable.id, botId));
    await db.insert(botLogsTable).values({ id: randomUUID(), botId, level: "info", message: "Bot is online" });
  }, 2000);
  req.log.info({ botId }, "Bot start requested");
  res.json({ message: "Bot is starting" });
});

router.post("/bots/:botId/stop", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const botId = Array.isArray(req.params.botId) ? req.params.botId[0] : req.params.botId;
  const [bot] = await db.select().from(botsTable).where(and(eq(botsTable.id, botId), eq(botsTable.userId, user.id)));
  if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
  await db.update(botsTable).set({ status: "stopped" }).where(eq(botsTable.id, botId));
  await db.insert(botLogsTable).values({ id: randomUUID(), botId, level: "info", message: "Bot stopped" });
  res.json({ message: "Bot stopped" });
});

router.post("/bots/:botId/restart", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const botId = Array.isArray(req.params.botId) ? req.params.botId[0] : req.params.botId;
  const [bot] = await db.select().from(botsTable).where(and(eq(botsTable.id, botId), eq(botsTable.userId, user.id)));
  if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
  await db.update(botsTable).set({ status: "starting" }).where(eq(botsTable.id, botId));
  await db.insert(botLogsTable).values({ id: randomUUID(), botId, level: "info", message: "Restarting bot..." });
  setTimeout(async () => {
    await db.update(botsTable).set({ status: "running" }).where(eq(botsTable.id, botId));
    await db.insert(botLogsTable).values({ id: randomUUID(), botId, level: "info", message: "Bot restarted and running" });
  }, 2000);
  res.json({ message: "Bot restarting" });
});

router.get("/bots/:botId/status", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const botId = Array.isArray(req.params.botId) ? req.params.botId[0] : req.params.botId;
  const [bot] = await db.select().from(botsTable).where(and(eq(botsTable.id, botId), eq(botsTable.userId, user.id)));
  if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
  res.json({ botId, status: bot.status, uptime: null, memoryMB: null, lastStarted: null, lastStopped: null });
});

export default router;
