import { Router } from "express";
import { db, botsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireInvite } from "../lib/auth-middleware";
import { r2ListFiles, r2ReadFile, r2WriteFile, r2DeleteFile, r2RenameFile, r2DeletePrefix } from "../lib/r2";

const router = Router();

async function getBotR2Prefix(botId: string, userId: string): Promise<string | null> {
  const [bot] = await db.select().from(botsTable).where(and(eq(botsTable.id, botId), eq(botsTable.userId, userId)));
  return bot ? bot.r2Prefix : null;
}

router.get("/files/:botId/list", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const botId = Array.isArray(req.params.botId) ? req.params.botId[0] : req.params.botId;
  const dirPath = (req.query.dirPath as string) || "/";
  const prefix = await getBotR2Prefix(botId, user.id);
  if (!prefix) { res.status(404).json({ error: "Bot not found" }); return; }
  try {
    const fullPrefix = dirPath === "/" ? prefix : `${prefix}/${dirPath.replace(/^\//, "")}`;
    const files = await r2ListFiles(fullPrefix);
    res.json(files);
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
    res.status(500).json({ error: "Rename failed" });
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
