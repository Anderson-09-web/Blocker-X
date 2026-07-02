import { Router } from "express";
import { db, botsTable, botSharesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { rmSync } from "fs";
import path from "path";
import { requireAuth, requireInvite } from "../lib/auth-middleware";
import { r2ListFiles, r2ListAllFiles, r2ReadFile, r2WriteFile, r2DeleteFile, r2RenameFile, r2DeletePrefix } from "../lib/r2";

const BOT_WORK_DIR = "/tmp/blockerx-bots";

const router = Router();

/**
 * Resolves the R2 prefix for a bot if the requesting user is the owner OR
 * an invited collaborator. Returns null if the user has no access.
 */
async function getBotR2Prefix(botId: string, userId: string): Promise<string | null> {
  // Try owner first (most common path)
  const [bot] = await db.select().from(botsTable).where(eq(botsTable.id, botId));
  if (!bot) return null;
  if (bot.userId === userId) return bot.r2Prefix;

  // Not owner — check collaborator table
  try {
    const [share] = await db.select({ id: botSharesTable.id })
      .from(botSharesTable)
      .where(and(eq(botSharesTable.botId, botId), eq(botSharesTable.collaboratorId, userId)));
    if (share) return bot.r2Prefix;
  } catch {
    // bot_shares table may not exist in older deployments
  }

  return null;
}

router.get("/files/:botId/list", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const botId = Array.isArray(req.params.botId) ? req.params.botId[0] : req.params.botId;
  const dirPath = (req.query.dirPath as string) || "/";
  const recursive = req.query.recursive === "true";
  const prefix = await getBotR2Prefix(botId, user.id);
  if (!prefix) { res.status(404).json({ error: "Bot not found" }); return; }
  try {
    const fullPrefix = dirPath === "/" ? prefix : `${prefix}/${dirPath.replace(/^\//, "")}`;
    if (recursive) {
      const files = await r2ListAllFiles(fullPrefix);
      res.json(files);
    } else {
      const files = await r2ListFiles(fullPrefix);
      res.json(files);
    }
  } catch (err) {
    req.log.error({ err }, "Failed to list files");
    res.json([]);
  }
});

router.post("/files/:botId/upload", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const botId = Array.isArray(req.params.botId) ? req.params.botId[0] : req.params.botId;
  const { path: filePath, name, content, encoding } = req.body;
  const prefix = await getBotR2Prefix(botId, user.id);
  if (!prefix) { res.status(404).json({ error: "Bot not found" }); return; }
  try {
    const key = `${prefix}/${(filePath || "").replace(/^\//, "")}${name ? `/${name}` : ""}`.replace(/\/\//g, "/");
    const fileContent = encoding === "base64" ? Buffer.from(content, "base64").toString("utf-8") : content;
    await r2WriteFile(key, fileContent);
    res.json({ name: name || filePath.split("/").pop(), path: key, type: "file" as const });
  } catch (err) {
    req.log.error({ err }, "Upload failed");
    res.status(500).json({ error: "Upload failed" });
  }
});

router.delete("/files/:botId/delete", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const botId = Array.isArray(req.params.botId) ? req.params.botId[0] : req.params.botId;
  const { path: filePath } = req.body;
  const prefix = await getBotR2Prefix(botId, user.id);
  if (!prefix) { res.status(404).json({ error: "Bot not found" }); return; }
  if (!filePath?.startsWith(prefix)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    await r2DeleteFile(filePath);

    // Also remove the file from the bot's running temp directory so the bot
    // doesn't recreate it in R2 on next restart via syncWorkdirToR2.
    try {
      const normalizedPrefix = prefix.endsWith("/") ? prefix : prefix + "/";
      // Boundary-safe: filePath must start with prefix + "/" (not just prefix)
      if (filePath.startsWith(normalizedPrefix)) {
        const relPath = filePath.slice(normalizedPrefix.length);
        // Resolve to an absolute path and verify it stays inside the bot's temp dir
        const botTempDir = path.resolve(BOT_WORK_DIR, botId);
        const candidate = path.resolve(botTempDir, relPath);
        if (candidate.startsWith(botTempDir + path.sep) || candidate === botTempDir) {
          rmSync(candidate, { force: true });
        }
      }
    } catch { /* ignore — temp dir may not exist if bot is stopped */ }

    res.json({ message: "File deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete failed");
    res.status(500).json({ error: "Delete failed" });
  }
});

router.patch("/files/:botId/rename", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const botId = Array.isArray(req.params.botId) ? req.params.botId[0] : req.params.botId;
  const { oldPath, newPath } = req.body;
  const prefix = await getBotR2Prefix(botId, user.id);
  if (!prefix) { res.status(404).json({ error: "Bot not found" }); return; }
  if (!oldPath?.startsWith(prefix) || !newPath?.startsWith(prefix)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    await r2RenameFile(oldPath, newPath);
    res.json({ message: "File renamed" });
  } catch (err) {
    req.log.error({ err }, "Rename failed");
    res.status(500).json({ error: "File renamed" });
  }
});

router.get("/files/:botId/read", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const botId = Array.isArray(req.params.botId) ? req.params.botId[0] : req.params.botId;
  const filePath = req.query.filePath as string;
  const prefix = await getBotR2Prefix(botId, user.id);
  if (!prefix) { res.status(404).json({ error: "Bot not found" }); return; }
  if (!filePath?.startsWith(prefix)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const content = await r2ReadFile(filePath);
    res.json({ path: filePath, content, encoding: "utf-8" });
  } catch (err) {
    req.log.error({ err }, "Read failed");
    res.status(500).json({ error: "File read failed" });
  }
});

router.put("/files/:botId/write", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const botId = Array.isArray(req.params.botId) ? req.params.botId[0] : req.params.botId;
  const { path: filePath, content } = req.body;
  const prefix = await getBotR2Prefix(botId, user.id);
  if (!prefix) { res.status(404).json({ error: "Bot not found" }); return; }
  if (!filePath?.startsWith(prefix)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    await r2WriteFile(filePath, content);
    res.json({ message: "File saved" });
  } catch (err) {
    req.log.error({ err }, "Write failed");
    res.status(500).json({ error: "File write failed" });
  }
});

router.delete("/files/:botId/rmdir", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const botId = Array.isArray(req.params.botId) ? req.params.botId[0] : req.params.botId;
  const { path: dirPath } = req.body;
  const prefix = await getBotR2Prefix(botId, user.id);
  if (!prefix) { res.status(404).json({ error: "Bot not found" }); return; }
  if (!dirPath?.startsWith(prefix)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    await r2DeletePrefix(dirPath);
    res.json({ message: "Folder deleted" });
  } catch (err) {
    req.log.error({ err }, "Rmdir failed");
    res.status(500).json({ error: "Folder deletion failed" });
  }
});

router.post("/files/:botId/mkdir", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const botId = Array.isArray(req.params.botId) ? req.params.botId[0] : req.params.botId;
  const { path: dirPath } = req.body;
  const prefix = await getBotR2Prefix(botId, user.id);
  if (!prefix) { res.status(404).json({ error: "Bot not found" }); return; }
  try {
    const key = `${prefix}/${dirPath.replace(/^\//, "")}/.gitkeep`;
    await r2WriteFile(key, "");
    res.json({ message: "Folder created" });
  } catch (err) {
    req.log.error({ err }, "Mkdir failed");
    res.status(500).json({ error: "Folder creation failed" });
  }
});

export default router;
