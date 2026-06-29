import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  if (user.isBanned) {
    res.status(403).json({ error: "Account suspended" });
    return;
  }
  (req as any).user = user;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = (req as any).user;
  if (!user?.isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

export async function requireInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = (req as any).user;
  if (!user?.hasInvite && !user?.isAdmin) {
    res.status(403).json({ error: "Invitation required" });
    return;
  }
  next();
}
