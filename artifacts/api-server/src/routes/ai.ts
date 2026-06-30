import { Router } from "express";
import { db, aiUsageTable, botsTable } from "@workspace/db";
import { eq, count, and, gte } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, requireInvite } from "../lib/auth-middleware";
import { r2ReadFile, r2WriteFile, r2ListFiles, r2DeleteFile } from "../lib/r2";

const router = Router();

const FREE_DAILY_LIMIT = 5;
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = "llama-3.3-70b-versatile";

function getStartOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function getUsageCount(userId: string): Promise<number> {
  const startOfToday = getStartOfToday();
  const [r] = await db.select({ count: count() }).from(aiUsageTable)
    .where(and(eq(aiUsageTable.userId, userId), gte(aiUsageTable.createdAt, startOfToday)));
  return Number(r?.count || 0);
}

async function getBotContext(botId: string, userId: string, filePath?: string): Promise<{ botContext: string; fileContext: string; bot: any }> {
  let botContext = "";
  let fileContext = "";
  let bot: any = null;
  if (botId) {
    try {
      const [b] = await db.select().from(botsTable).where(and(eq(botsTable.id, botId), eq(botsTable.userId, userId)));
      if (b) {
        bot = b;
        botContext = `\nEl usuario está trabajando en el bot "${b.name}" (${b.language === "python" ? "Python/discord.py" : "JavaScript/discord.js"}).`;
        if (filePath) {
          try {
            const content = await r2ReadFile(filePath);
            if (content && content.length < 8000) {
              fileContext = `\n\nContenido actual del archivo "${filePath.split("/").pop()}":\n\`\`\`${b.language === "python" ? "python" : "javascript"}\n${content}\n\`\`\``;
            }
          } catch { /* file might not exist */ }
        }
      }
    } catch { /* ignore db errors */ }
  }
  return { botContext, fileContext, bot };
}

async function callGroq(messages: { role: string; content: string }[], maxTokens = 3000): Promise<{ content: string; tokens: number }> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({ model: GROQ_MODEL, messages, max_tokens: maxTokens, temperature: 0.7 }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq error ${response.status}: ${err.slice(0, 200)}`);
  }
  const data = await response.json() as { choices: Array<{ message: { content: string } }>; usage: { total_tokens: number } };
  return { content: data.choices[0]?.message?.content || "", tokens: data.usage?.total_tokens || 0 };
}

// ─── Simple chat ─────────────────────────────────────────────────────────────
router.post("/ai/chat", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const { message, botId, filePath, language = "python", context } = req.body;

  if (!message) { res.status(400).json({ error: "Message is required" }); return; }
  if (!GROQ_API_KEY) { res.status(503).json({ error: "AI service is not configured. Ask the admin to set the GROQ_API_KEY." }); return; }

  const usageCount = await getUsageCount(user.id);
  if (user.plan !== "premium" && usageCount >= FREE_DAILY_LIMIT) {
    res.status(403).json({ error: `Límite diario alcanzado (${FREE_DAILY_LIMIT} requests/día). Actualiza a Premium para IA ilimitada.` });
    return;
  }

  const { botContext, fileContext } = await getBotContext(botId, user.id, filePath);
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
    const { content: aiResponse, tokens } = await callGroq([
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ]);

    await db.insert(aiUsageTable).values({ id: randomUUID(), userId: user.id, prompt: message, response: aiResponse, tokensUsed: tokens, language });

    res.json({ response: aiResponse, tokensUsed: tokens, usageCount: usageCount + 1, usageLimit: user.plan === "premium" ? null : FREE_DAILY_LIMIT });
  } catch (err: any) {
    req.log.error({ err }, "AI chat error");
    res.status(500).json({ error: "No se pudo obtener respuesta de la IA. Intenta de nuevo." });
  }
});

// ─── Agent mode: auto-creates/edits bot files ─────────────────────────────────
router.post("/ai/agent", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const { message, botId, language = "python" } = req.body;

  if (!message) { res.status(400).json({ error: "Message is required" }); return; }
  if (!botId) { res.status(400).json({ error: "botId is required for agent mode" }); return; }
  if (!GROQ_API_KEY) { res.status(503).json({ error: "AI service is not configured." }); return; }

  const usageCount = await getUsageCount(user.id);
  if (user.plan !== "premium" && usageCount >= FREE_DAILY_LIMIT) {
    res.status(403).json({ error: `Límite diario alcanzado (${FREE_DAILY_LIMIT} requests/día). Actualiza a Premium para IA ilimitada.` });
    return;
  }

  const { botContext, bot } = await getBotContext(botId, user.id);
  if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }

  const lang = language === "python" ? "Python/discord.py" : "JavaScript/discord.js";
  const ext = language === "python" ? "py" : "js";

  // Read ALL existing files from R2 to give AI full context
  let existingFilesContext = "";
  try {
    const files = await r2ListFiles(bot.r2Prefix);
    const fileContents: string[] = [];
    for (const f of files.filter((f: any) => f.type === "file").slice(0, 10)) {
      try {
        const content = await r2ReadFile(f.path);
        if (content.length < 3000) {
          fileContents.push(`### ${f.name}\n\`\`\`${ext}\n${content}\n\`\`\``);
        }
      } catch { /* skip */ }
    }
    if (fileContents.length > 0) {
      existingFilesContext = `\n\nArchivos actuales del bot:\n${fileContents.join("\n\n")}`;
    }
  } catch { /* ignore */ }

  const mainFile = language === "python" ? "main.py" : "index.js";
  const systemPrompt = `Eres un agente autónomo desarrollador de bots de Discord especializado en ${lang}.
Tu trabajo es EJECUTAR la tarea del usuario creando, editando o eliminando archivos del bot automáticamente.
${botContext}${existingFilesContext}

INSTRUCCIONES CRÍTICAS:
1. Analiza la tarea del usuario y determina qué archivos necesitas crear o editar.
2. Responde con una explicación breve (1-3 párrafos) de lo que estás haciendo.
3. Al final, incluye un bloque JSON con todas las acciones de archivos, con este formato EXACTO:

[AGENT_ACTIONS]
{
  "actions": [
    {"type": "write", "filename": "nombre_archivo.${ext}", "content": "CÓDIGO COMPLETO AQUÍ"},
    {"type": "write", "filename": "otro_archivo.${ext}", "content": "CÓDIGO COMPLETO AQUÍ"}
  ]
}
[/AGENT_ACTIONS]

REGLAS FUNDAMENTALES:
- Siempre incluye el código COMPLETO y funcional, no fragmentos.
- Si necesitas modificar un archivo existente, incluye el archivo COMPLETO con los cambios.
- Para Python usa discord.py / py-cord. Para JS usa discord.js v14.
- El token del bot viene de la env var DISCORD_TOKEN.
- Responde SIEMPRE en español.
- SIEMPRE incluye el bloque [AGENT_ACTIONS] con al menos un archivo.

REGLA DE INTEGRACIÓN — MUY IMPORTANTE:
Cuando crees nuevos archivos de módulos/cogs/sistemas, SIEMPRE debes también incluir "${mainFile}" actualizado en las acciones para que todo quede conectado:

${language === "python" ? `- Si creas cogs (archivos con "class MiCog(commands.Cog)"), en main.py usa "await bot.load_extension('nombre_archivo')" dentro de async def setup_hook o un bucle de setup. El main.py debe importar y cargar TODOS los cogs que existan.
- Si creas archivos con funciones auxiliares, impórtalos en main.py con "from nombre_archivo import función".
- Si el sistema es autocontenido en main.py (comandos simples), ponlo todo ahí directamente.
- El main.py siempre debe ser el punto de entrada completo y funcional que conecta todo.` : `- Si creas comandos en archivos separados, en index.js requiérelos/impórtalos y regístralos en el cliente.
- Usa "client.commands = new Collection()" y carga los archivos de comandos desde un directorio.
- El index.js siempre debe ser el punto de entrada completo que conecta todos los módulos.`}

Ejemplo de main.py correcto cuando hay cogs:
\`\`\`python
import discord
from discord.ext import commands
import os

intents = discord.Intents.all()
bot = commands.Bot(command_prefix="!", intents=intents)

async def setup_hook():
    await bot.load_extension("economia")   # carga economia.py
    await bot.load_extension("moderacion") # carga moderacion.py

bot.setup_hook = setup_hook

@bot.event
async def on_ready():
    print(f"Bot listo como {bot.user}")

bot.run(os.getenv("DISCORD_TOKEN"))
\`\`\``;

  try {
    const { content: aiResponse, tokens } = await callGroq([
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ], 4000);

    // Parse agent actions
    const actionsMatch = aiResponse.match(/\[AGENT_ACTIONS\]([\s\S]*?)\[\/AGENT_ACTIONS\]/);
    const appliedActions: { filename: string; type: string; success: boolean; error?: string }[] = [];
    let explanation = aiResponse.replace(/\[AGENT_ACTIONS\][\s\S]*?\[\/AGENT_ACTIONS\]/g, "").trim();

    if (actionsMatch) {
      try {
        const parsed = JSON.parse(actionsMatch[1].trim()) as { actions: Array<{ type: string; filename: string; content?: string }> };
        for (const action of parsed.actions || []) {
          if (!action.filename) continue;
          // Security: reject any path with traversal, absolute paths, or disallowed chars
          const rawName = action.filename.replace(/\\/g, "/").trim();
          if (
            rawName.startsWith("/") ||
            rawName.includes("..") ||
            rawName.includes("//") ||
            !/^[a-zA-Z0-9][a-zA-Z0-9._\-/]*$/.test(rawName) ||
            rawName.split("/").some(seg => seg === "" || seg === "." || seg === "..")
          ) {
            appliedActions.push({ filename: rawName, type: action.type, success: false, error: "Nombre de archivo no permitido" });
            continue;
          }
          const safeName = rawName;
          const key = `${bot.r2Prefix}/${safeName}`;
          try {
            if (action.type === "write" && action.content !== undefined) {
              await r2WriteFile(key, action.content);
              appliedActions.push({ filename: safeName, type: "write", success: true });
            } else if (action.type === "delete") {
              await r2DeleteFile(key);
              appliedActions.push({ filename: safeName, type: "delete", success: true });
            }
          } catch (e: any) {
            appliedActions.push({ filename: safeName, type: action.type, success: false, error: e.message });
          }
        }
      } catch (parseErr) {
        req.log.warn({ parseErr }, "Failed to parse agent actions JSON");
      }
    }

    await db.insert(aiUsageTable).values({ id: randomUUID(), userId: user.id, prompt: message, response: aiResponse, tokensUsed: tokens, language });

    res.json({
      explanation,
      actions: appliedActions,
      usageCount: usageCount + 1,
      usageLimit: user.plan === "premium" ? null : FREE_DAILY_LIMIT,
    });
  } catch (err: any) {
    req.log.error({ err }, "AI agent error");
    res.status(500).json({ error: "No se pudo completar la tarea. Intenta de nuevo." });
  }
});

// ─── Usage ─────────────────────────────────────────────────────────────────────
router.get("/ai/usage", requireAuth, requireInvite, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const count_ = await getUsageCount(user.id);
  res.json({ count: count_, limit: user.plan === "premium" ? null : FREE_DAILY_LIMIT, plan: user.plan });
});

export default router;
