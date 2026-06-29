import { db, notificationsTable } from "@workspace/db";
import { randomUUID } from "crypto";

export async function createNotification(params: {
  userId: string;
  title: string;
  message: string;
  type?: "info" | "success" | "warning" | "error" | "announcement";
}) {
  await db.insert(notificationsTable).values({
    id: randomUUID(),
    userId: params.userId,
    title: params.title,
    message: params.message,
    type: params.type || "info",
    isRead: false,
  });
}

export async function notifyDiscord(message: string): Promise<void> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) return;
}
