import { Router } from "express";
import { db, aiUsageTable, botsTable, envVarsTable } from "@workspace/db";
import { eq, count, and, gte } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, requireInvite } from "../lib/auth-middleware";
import { r2ReadFile } from "../lib/r2";

const router = Router();

const FREE_DAILY_LIMIT = 5;
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = "llama-3.3-70b-versatile";

function getStartOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

router.post("/ai/chat", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const { message, botId, filePath, language = "python", context } = req.body;

  if (!message) { res.status(400).json({ error: "Message is required" }); return; }
  if (!GROQ_API_KEY) { res.status(503).json({ error: "AI service is not configured. Ask the admin to set the GROQ_API_KEY." }); return; }

  const startOfToday = getStartOfToday();
  const [usageResult] = await db.select({ count: count() }).from(aiUsageTable)
    .where(and(eq(aiUsageTable.userId, user.id), gte(aiUsageTable.createdAt, startOfToday)));
  const usageCount = Number(usageResult?.count || 0);

  if (user.plan !== "premium" && usageCount >= FREE_DAILY_LIMIT) {
    res.status(403).json({ error: `Límite diario alcanzado (${FREE_DAILY_LIMIT} requests/día). Actualiza a Premium para IA ilimitada.` });
    return;
  }

  let fileContext = "";
  let botContext = "";

  if (botId) {
    try {
      const [bot] = await db.select().from(botsTable).where(and(eq(botsTable.id, botId), eq(botsTable.userId, user.id)));
      if (bot) {
        botContext = `\nEl usuario está trabajando en el bot "${bot.name}" (${bot.language === "python" ? "Python/discord.py" : "JavaScript/discord.js"}).`;

        if (filePath) {
          try {
            const content = await r2ReadFile(filePath);
            if (content && content.length < 8000) {
              fileContext = `\n\nContenido actual del archivo "${filePath.split("/").pop()}":\n\`\`\`${bot.language === "python" ? "python" : "javascript"}\n${content}\n\`\`\``;
            }
          } catch { /* file might not exist */ }
        }
      }
    } catch { /* ignore db errors */ }
  }

  const langLabel = language === "python" ? "Discord.py (Python)" : "Discord.js (JavaScript)";

  const systemPrompt = `Eres un experto desarrollador de bots de Discord especializado en ${langLabel}.
Tu trabajo es ayudar a los usuarios a construir, depurar y mejorar sus bots de Discord.
Sé conciso y práctico. Siempre proporciona ejemplos de código funcionales cuando sea relevante.
Para bots Python: usa sintaxis de discord.py (o py-cord).
Para bots JavaScript: usa sintaxis de discord.js v14.
Responde SIEMPRE en español a menos que el usuario escriba en otro idioma.
Cuando des código, pon el bloque de código completo para que pueda copiarse directamente al archivo.
${botContext}${fileContext}
${context ? `Contexto adicional: ${context}` : ""}`;

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
        max_tokens: 3000,
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
    const usageLimit = user.plan === "premium" ? null : FREE_DAILY_LIMIT;

    res.json({ response: aiResponse, tokensUsed, usageCount: newCount, usageLimit });
  } catch (err) {
    req.log.error({ err }, "AI chat error");
    res.status(500).json({ error: "Failed to get AI response" });
  }
});

router.get("/ai/usage", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const startOfToday = getStartOfToday();
  const [result] = await db.select({ count: count() }).from(aiUsageTable)
    .where(and(eq(aiUsageTable.userId, user.id), gte(aiUsageTable.createdAt, startOfToday)));
  res.json({
    count: Number(result?.count || 0),
    limit: user.plan === "premium" ? null : FREE_DAILY_LIMIT,
    plan: user.plan,
  });
});

export default router;
