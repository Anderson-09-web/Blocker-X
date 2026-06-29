import { Router } from "express";
import { db, inviteCodesTable, redeemedCodesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth } from "../lib/auth-middleware";
import { createNotification } from "../lib/notifications";

const router = Router();

router.post("/invite/redeem", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const { code } = req.body;

  if (!code) {
    res.status(400).json({ error: "Invitation code is required" });
    return;
  }

  if (user.hasInvite) {
    res.json({ message: "Already have access" });
    return;
  }

  const [invite] = await db.select().from(inviteCodesTable).where(eq(inviteCodesTable.code, code.trim()));

  if (!invite) {
    res.status(400).json({ error: "Invalid invitation code" });
    return;
  }

  if (!invite.isActive) {
    res.status(400).json({ error: "This invitation code is disabled" });
    return;
  }

  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    res.status(400).json({ error: "This invitation code has expired" });
    return;
  }

  if (invite.maxUses !== null && invite.usesCount >= invite.maxUses) {
    res.status(400).json({ error: "This invitation code has reached its usage limit" });
    return;
  }

  await db.update(inviteCodesTable).set({ usesCount: invite.usesCount + 1 }).where(eq(inviteCodesTable.id, invite.id));
  await db.insert(redeemedCodesTable).values({ id: randomUUID(), codeId: invite.id, userId: user.id });
  await db.update(usersTable).set({ hasInvite: true }).where(eq(usersTable.id, user.id));

  await createNotification({
    userId: user.id,
    title: "Access Granted",
    message: "Your invitation code was accepted. Welcome to Blocker X!",
    type: "success",
  });

  req.log.info({ userId: user.id, code }, "Invite code redeemed");
  res.json({ message: "Invitation code accepted. Welcome to Blocker X!" });
});

export default router;
