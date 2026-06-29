import { db, notificationsTable } from "@workspace/db";
import { randomUUID } from "crypto";
import { logger } from "./logger";

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

export async function sendDiscordDm(discordId: string, message: string): Promise<void> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) return;

  try {
    const dmRes = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: discordId }),
    });

    if (!dmRes.ok) {
      logger.warn({ status: dmRes.status }, "Failed to open DM channel");
      return;
    }

    const dmChannel = (await dmRes.json()) as { id: string };

    const msgRes = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: message }),
    });

    if (!msgRes.ok) {
      logger.warn({ status: msgRes.status }, "Failed to send Discord DM");
    }
  } catch (err) {
    logger.error({ err }, "Discord DM error");
  }
}

export async function notifyUser(params: {
  userId: string;
  discordId: string;
  title: string;
  message: string;
  type?: "info" | "success" | "warning" | "error" | "announcement";
  discord?: boolean;
}) {
  await createNotification({ userId: params.userId, title: params.title, message: params.message, type: params.type });
  if (params.discord !== false) {
    const prefix = params.type === "error" ? "🔴" : params.type === "warning" ? "🟡" : params.type === "success" ? "🟢" : "🔵";
    await sendDiscordDm(params.discordId, `${prefix} **Blocker X — ${params.title}**\n${params.message}`);
  }
}
