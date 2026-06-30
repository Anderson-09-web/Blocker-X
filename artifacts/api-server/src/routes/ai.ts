import { Router } from "express";
import { db, aiUsageTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, requireInvite } from "../lib/auth-middleware";

const router = Router();

const FREE_LIMIT = 10;
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = "llama-3.1-70b-versatile";

router.post("/ai/chat", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const { message, botId, language = "python", context } = req.body;

  if (!message) { res.status(400).json({ error: "Message is required" }); return; }
  if (!GROQ_API_KEY) { res.status(503).json({ error: "AI service is not configured. Ask the admin to set the GROQ_API_KEY." }); return; }

  const [usageResult] = await db.select({ count: count() }).from(aiUsageTable).where(eq(aiUsageTable.userId, user.id));
  const usageCount = Number(usageResult?.count || 0);

  if (user.plan !== "premium" && usageCount >= FREE_LIMIT) {
    res.status(403).json({ error: `Free plan limit reached (${FREE_LIMIT} requests). Upgrade to Premium for unlimited AI.` });
    return;
  }

  const systemPrompt = `You are an expert Discord bot developer specializing in ${language === "python" ? "Discord.py (Python)" : "Discord.js (JavaScript)"}.
Your job is to help users build, debug, and improve their Discord bots.
Be concise and practical. Always provide working code examples when relevant.
For Python bots: use discord.py (or py-cord) syntax.
For JavaScript bots: use discord.js v14 syntax.
${context ? `Context about the user's bot: ${context}` : ""}`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 2048,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      req.log.error({ status: response.status, err }, "Groq API error");
      res.status(500).json({ error: "AI service error" });
      return;
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      usage: { total_tokens: number };
    };

    const aiResponse = data.choices[0]?.message?.content || "";
    const tokensUsed = data.usage?.total_tokens || 0;

    await db.insert(aiUsageTable).values({
      id: randomUUID(),
      userId: user.id,
      prompt: message,
      response: aiResponse,
      tokensUsed,
      language,
    });

    const newCount = usageCount + 1;
    const usageLimit = user.plan === "premium" ? null : FREE_LIMIT;

    res.json({ response: aiResponse, tokensUsed, usageCount: newCount, usageLimit });
  } catch (err) {
    req.log.error({ err }, "AI chat error");
    res.status(500).json({ error: "Failed to get AI response" });
  }
});

router.get("/ai/usage", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const [result] = await db.select({ count: count() }).from(aiUsageTable).where(eq(aiUsageTable.userId, user.id));
  res.json({
    count: Number(result?.count || 0),
    limit: user.plan === "premium" ? null : FREE_LIMIT,
    plan: user.plan,
  });
});

export default router;
