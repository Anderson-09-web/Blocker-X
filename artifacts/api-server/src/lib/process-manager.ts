import { spawn, ChildProcess, execSync } from "child_process";
import { rmSync, mkdirSync } from "fs";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { db, botsTable, botLogsTable, envVarsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { logger } from "./logger";

const BOT_WORK_DIR = "/tmp/blockerx-bots";

interface BotProcess {
  child: ChildProcess;
  botId: string;
  isStopping: boolean;
  restartCount: number;
  startedAt: Date;
  planTimers: NodeJS.Timeout[];
}

const processes = new Map<string, BotProcess>();

export function getProcessStatus(botId: string): "running" | "stopped" {
  const bp = processes.get(botId);
  if (!bp || bp.child.exitCode !== null || bp.child.killed) return "stopped";
  return "running";
}

export function getRunningBotIds(): string[] {
  return Array.from(processes.keys()).filter(
    (id) => getProcessStatus(id) === "running"
  );
}

async function addLog(botId: string, level: string, message: string): Promise<void> {
  try {
    await db.insert(botLogsTable).values({ id: randomUUID(), botId, level, message });
  } catch (e) {
    logger.error({ e }, "Failed to write bot log");
  }
}

async function downloadBotFiles(botId: string, r2Prefix: string): Promise<string> {
  const { r2Client, bucketName } = await import("./r2");
  const { ListObjectsV2Command, GetObjectCommand } = await import("@aws-sdk/client-s3");

  const workDir = path.join(BOT_WORK_DIR, botId);
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });

  const prefix = r2Prefix.endsWith("/") ? r2Prefix : r2Prefix + "/";

  let continuationToken: string | undefined;
  const keys: string[] = [];

  do {
    const cmd = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    const resp = await r2Client.send(cmd);
    for (const obj of resp.Contents || []) {
      if (obj.Key) keys.push(obj.Key);
    }
    continuationToken = resp.NextContinuationToken;
  } while (continuationToken);

  for (const key of keys) {
    const cmd = new GetObjectCommand({ Bucket: bucketName, Key: key });
    const resp = await r2Client.send(cmd);
    if (!resp.Body) continue;

    const chunks: Uint8Array[] = [];
    for await (const chunk of resp.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const content = Buffer.concat(chunks);

    const relativePath = key.slice(prefix.length);
    if (!relativePath) continue;
    const filePath = path.join(workDir, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }

  return workDir;
}

async function getEnvVars(botId: string): Promise<Record<string, string>> {
  const vars = await db.select().from(envVarsTable).where(eq(envVarsTable.botId, botId));
  const env: Record<string, string> = {};
  for (const v of vars) env[v.key] = v.value;
  return env;
}

function runInstallSync(cmd: string, args: string[], cwd: string): { success: boolean; output: string } {
  try {
    const output = execSync([cmd, ...args].join(" "), { cwd, timeout: 120000, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
    return { success: true, output };
  } catch (e: any) {
    return { success: false, output: e.message || "Install failed" };
  }
}

function clearBotTimers(botId: string) {
  const bp = processes.get(botId);
  if (bp) {
    for (const t of bp.planTimers) clearTimeout(t);
    bp.planTimers = [];
  }
}

function scheduleFreeRestarts(botId: string, bot: { id: string; language: string; mainFile: string | null; r2Prefix: string }, userId: string) {
  const bp = processes.get(botId);
  if (!bp) return;

  const randomHours = () => Math.floor(Math.random() * 8 + 4);
  const delay1 = randomHours() * 60 * 60 * 1000;
  const delay2 = delay1 + randomHours() * 60 * 60 * 1000;

  const t1 = setTimeout(async () => {
    const current = processes.get(botId);
    if (!current || current.isStopping) return;
    await addLog(botId, "warn", "[System] Free plan scheduled restart #1");
    await restartBot(bot, userId);
  }, delay1);

  const t2 = setTimeout(async () => {
    const current = processes.get(botId);
    if (!current || current.isStopping) return;
    await addLog(botId, "warn", "[System] Free plan scheduled restart #2");
    await restartBot(bot, userId);
  }, delay2);

  bp.planTimers = [t1, t2];
}

async function spawnBotProcess(
  bot: { id: string; language: string; mainFile: string | null; r2Prefix: string },
  userId: string,
  userPlan: string,
  restartCount = 0
): Promise<void> {
  const botId = bot.id;

  try {
    await addLog(botId, "info", "[System] Downloading files from R2...");
    const workDir = await downloadBotFiles(botId, bot.r2Prefix);
    await addLog(botId, "info", `[System] Files ready in ${workDir}`);

    const envVars = await getEnvVars(botId);
    const mainFile = bot.mainFile || (bot.language === "python" ? "main.py" : "index.js");
    let cmd: string;
    let args: string[];

    if (bot.language === "python") {
      await addLog(botId, "info", "[System] Installing Python dependencies...");

      const reqPath = path.join(workDir, "requirements.txt");
      const { existsSync, readFileSync } = await import("fs");

      if (!existsSync(reqPath)) {
        // Auto-detect imports from main.py and map to pip packages
        const IMPORT_TO_PKG: Record<string, string> = {
          discord: "discord.py",
          nextcord: "nextcord",
          disnake: "disnake",
          interactions: "discord-py-interactions",
          hikari: "hikari",
          lightbulb: "hikari-lightbulb",
          aiohttp: "aiohttp",
          requests: "requests",
          flask: "flask",
          fastapi: "fastapi",
          dotenv: "python-dotenv",
          pymongo: "pymongo",
          motor: "motor",
          sqlalchemy: "SQLAlchemy",
          psycopg2: "psycopg2-binary",
          redis: "redis",
          PIL: "Pillow",
          cv2: "opencv-python",
          numpy: "numpy",
          pandas: "pandas",
        };

        let mainContent = "";
        const mainPath = path.join(workDir, mainFile);
        if (existsSync(mainPath)) {
          mainContent = readFileSync(mainPath, "utf-8");
        }

        const detected = new Set<string>();
        for (const [imp, pkg] of Object.entries(IMPORT_TO_PKG)) {
          if (new RegExp(`(^|\\n)\\s*(import ${imp}|from ${imp})`, "m").test(mainContent)) {
            detected.add(pkg);
          }
        }

        // Always include discord.py for Python bots as fallback
        if (detected.size === 0) detected.add("discord.py");

        const reqContent = Array.from(detected).join("\n") + "\n";
        await writeFile(reqPath, reqContent);
        await addLog(botId, "info", `[System] Auto-created requirements.txt with: ${Array.from(detected).join(", ")}`);
      }

      const result = runInstallSync("pip3", ["install", "-r", "requirements.txt", "-q", "--exists-action", "i"], workDir);
      if (!result.success) {
        await addLog(botId, "warn", `[System] Dependency install warning: ${result.output.slice(0, 300)}`);
      } else {
        await addLog(botId, "info", "[System] Python dependencies installed.");
      }
      cmd = "python3";
      args = ["-u", mainFile];
    } else {
      await addLog(botId, "info", "[System] Installing Node.js dependencies...");
      const result = runInstallSync("npm", ["install", "--no-fund", "--no-audit", "--prefer-offline"], workDir);
      if (!result.success) {
        await addLog(botId, "warn", `[System] Dependency note: ${result.output.slice(0, 200)}`);
      } else {
        await addLog(botId, "info", "[System] Node.js dependencies installed.");
      }
      cmd = "node";
      args = [mainFile];
    }

    await addLog(botId, "info", `[System] Spawning: ${cmd} ${args.join(" ")}`);

    const child = spawn(cmd, args, {
      cwd: workDir,
      env: { ...process.env, ...envVars, BOT_ID: botId },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const bp: BotProcess = {
      child,
      botId,
      isStopping: false,
      restartCount,
      startedAt: new Date(),
      planTimers: [],
    };
    processes.set(botId, bp);

    if (userPlan === "free") {
      scheduleFreeRestarts(botId, bot, userId);
    }

    await db.update(botsTable).set({ status: "running" }).where(eq(botsTable.id, botId));

    child.stdout?.on("data", async (data: Buffer) => {
      const lines = data.toString().split("\n").filter((l) => l.trim());
      for (const line of lines) await addLog(botId, "info", line);
    });

    child.stderr?.on("data", async (data: Buffer) => {
      const lines = data.toString().split("\n").filter((l) => l.trim());
      for (const line of lines) await addLog(botId, "error", line);
    });

    child.on("exit", async (code, signal) => {
      clearBotTimers(botId);
      const current = processes.get(botId);
      if (current?.child !== child) return;

      if (current.isStopping) {
        await db.update(botsTable).set({ status: "stopped" }).where(eq(botsTable.id, botId));
        await addLog(botId, "info", "[System] Bot stopped gracefully.");
        processes.delete(botId);
        return;
      }

      const exitInfo = signal ? `signal ${signal}` : `code ${code}`;
      await addLog(botId, "error", `[System] Bot exited (${exitInfo}). Restarting in 5s...`);
      await db.update(botsTable).set({ status: "starting" }).where(eq(botsTable.id, botId));
      processes.delete(botId);

      setTimeout(async () => {
        const [freshBot] = await db.select().from(botsTable).where(eq(botsTable.id, botId));
        if (!freshBot || freshBot.status === "stopped") return;
        const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
        await spawnBotProcess(freshBot as any, userId, user?.plan || "free", (current?.restartCount || 0) + 1);
      }, 5000);
    });
  } catch (err: any) {
    await addLog(botId, "error", `[System] Failed to start bot: ${err.message}`);
    await db.update(botsTable).set({ status: "errored" }).where(eq(botsTable.id, botId));
    logger.error({ err, botId }, "Failed to spawn bot");
  }
}

export async function startBot(
  bot: { id: string; language: string; mainFile: string | null; r2Prefix: string; userId: string }
): Promise<void> {
  const botId = bot.id;

  const existing = processes.get(botId);
  if (existing && !existing.isStopping && existing.child.exitCode === null) {
    throw new Error("Bot is already running");
  }

  await db.update(botsTable).set({ status: "starting" }).where(eq(botsTable.id, botId));
  await addLog(botId, "info", "[System] Bot start requested.");

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, bot.userId));
  const plan = user?.plan || "free";

  spawnBotProcess(bot, bot.userId, plan, 0).catch((err) => {
    logger.error({ err, botId }, "spawnBotProcess error");
  });
}

export async function stopBot(botId: string): Promise<void> {
  const bp = processes.get(botId);
  if (!bp) {
    await db.update(botsTable).set({ status: "stopped" }).where(eq(botsTable.id, botId));
    await addLog(botId, "info", "[System] Bot stopped.");
    return;
  }

  bp.isStopping = true;
  clearBotTimers(botId);
  await addLog(botId, "info", "[System] Stopping bot...");

  bp.child.kill("SIGTERM");

  setTimeout(() => {
    if (bp.child.exitCode === null && !bp.child.killed) {
      bp.child.kill("SIGKILL");
    }
  }, 5000);
}

export async function restartBot(
  bot: { id: string; language: string; mainFile: string | null; r2Prefix: string },
  userId: string
): Promise<void> {
  const bp = processes.get(bot.id);
  if (bp) {
    bp.isStopping = true;
    clearBotTimers(bot.id);
    bp.child.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 5000);
      bp.child.once("exit", () => { clearTimeout(timeout); resolve(); });
    });
    processes.delete(bot.id);
  }

  await db.update(botsTable).set({ status: "starting" }).where(eq(botsTable.id, bot.id));
  await addLog(bot.id, "info", "[System] Restarting bot...");

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  const plan = user?.plan || "free";

  spawnBotProcess(bot as any, userId, plan, 0).catch((err) => {
    logger.error({ err, botId: bot.id }, "spawnBotProcess error on restart");
  });
}

export async function resetStaleProcesses(): Promise<void> {
  await db.update(botsTable)
    .set({ status: "stopped" })
    .where(eq(botsTable.status, "running" as any));
  await db.update(botsTable)
    .set({ status: "stopped" })
    .where(eq(botsTable.status, "starting" as any));
  logger.info("Reset stale bot statuses to stopped");
}
