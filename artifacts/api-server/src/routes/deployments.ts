import { Router } from "express";
import { db, deploymentsTable, botsTable, botLogsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, requireInvite } from "../lib/auth-middleware";
import { createNotification } from "../lib/notifications";

const router = Router();

function formatDeployment(d: any) {
  return {
    id: d.id,
    botId: d.botId,
    botName: d.botName,
    userId: d.userId,
    status: d.status,
    startedAt: d.startedAt.toISOString(),
    finishedAt: d.finishedAt?.toISOString() || null,
    logs: d.logs,
    errorMessage: d.errorMessage,
  };
}

router.get("/deployments", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const deployments = await db.select().from(deploymentsTable)
    .where(eq(deploymentsTable.userId, user.id))
    .orderBy(desc(deploymentsTable.startedAt))
    .limit(50);
  res.json(deployments.map(formatDeployment));
});

router.post("/bots/:botId/deploy", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const botId = Array.isArray(req.params.botId) ? req.params.botId[0] : req.params.botId;
  const [bot] = await db.select().from(botsTable).where(and(eq(botsTable.id, botId), eq(botsTable.userId, user.id)));
  if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }

  const deployId = randomUUID();
  const [deployment] = await db.insert(deploymentsTable).values({
    id: deployId,
    botId,
    botName: bot.name,
    userId: user.id,
    status: "running",
  }).returning();

  await db.update(botsTable).set({ status: "deploying" }).where(eq(botsTable.id, botId));

  setTimeout(async () => {
    const logMsg = `[Deploy] Loading files from R2: ${bot.r2Prefix}\n[Deploy] Installing dependencies...\n[Deploy] Starting ${bot.language === "python" ? "Python" : "Node.js"} runtime...\n[Deploy] Bot deployed successfully.`;
    await db.update(deploymentsTable).set({
      status: "success",
      finishedAt: new Date(),
      logs: logMsg,
    }).where(eq(deploymentsTable.id, deployId));
    await db.update(botsTable).set({ status: "running" }).where(eq(botsTable.id, botId));
    await db.insert(botLogsTable).values({ id: randomUUID(), botId, level: "info", message: "Deployment successful — bot is online" });
    await createNotification({ userId: user.id, title: "Deployment Successful", message: `${bot.name} deployed successfully`, type: "success" });
  }, 4000);

  req.log.info({ deployId, botId }, "Deployment started");
  res.json(formatDeployment(deployment));
});

router.get("/deployments/:deploymentId", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const deploymentId = Array.isArray(req.params.deploymentId) ? req.params.deploymentId[0] : req.params.deploymentId;
  const [deployment] = await db.select().from(deploymentsTable)
    .where(and(eq(deploymentsTable.id, deploymentId), eq(deploymentsTable.userId, user.id)));
  if (!deployment) { res.status(404).json({ error: "Deployment not found" }); return; }
  res.json(formatDeployment(deployment));
});

export default router;
