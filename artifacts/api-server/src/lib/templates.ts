export const PYTHON_MAIN = `import discord
from discord.ext import commands
import os
import glob

# ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────
intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents)

# Estado de Discord (se configura en la pestaña Settings del panel)
STATUS_MAP = {
    "online": discord.Status.online,
    "idle": discord.Status.idle,
    "dnd": discord.Status.dnd,
    "invisible": discord.Status.invisible,
}

# ─── EVENTO READY ─────────────────────────────────────────────────────────────
@bot.event
async def on_ready():
    print(f"Bot en línea: {bot.user}")

    # Aplicar estado configurado en el panel
    status_key = os.getenv("BOT_STATUS", "online")
    status = STATUS_MAP.get(status_key, discord.Status.online)
    await bot.change_presence(status=status)
    print(f"Estado: {status_key}")

    # Cargar automáticamente todos los archivos Python de la carpeta cogs/
    # (cada archivo debe tener una función async def setup(bot):)
    for filepath in glob.glob("cogs/*.py"):
        ext_name = filepath.replace("/", ".").replace("\\\\", ".")[:-3]
        try:
            await bot.load_extension(ext_name)
            print(f"✅ Cargado: {ext_name}")
        except Exception as e:
            print(f"❌ Error en {ext_name}: {e}")

    # También cargar archivos en la carpeta sistemas/ si existe
    for filepath in glob.glob("sistemas/*.py"):
        ext_name = filepath.replace("/", ".").replace("\\\\", ".")[:-3]
        try:
            await bot.load_extension(ext_name)
            print(f"✅ Cargado: {ext_name}")
        except Exception as e:
            print(f"❌ Error en {ext_name}: {e}")

# ─── COMANDOS BASE ─────────────────────────────────────────────────────────────
@bot.command()
async def ping(ctx):
    await ctx.send(f"🏓 Pong! ({round(bot.latency * 1000)}ms)")

@bot.command()
async def info(ctx):
    embed = discord.Embed(title="Bot Info", color=0x3b82f6)
    embed.add_field(name="Bot", value=bot.user.name, inline=True)
    embed.add_field(name="Servidores", value=str(len(bot.guilds)), inline=True)
    await ctx.send(embed=embed)

@bot.event
async def on_command_error(ctx, error):
    if isinstance(error, commands.CommandNotFound):
        return
    print(f"Error: {error}")

bot.run(os.getenv("DISCORD_TOKEN"))
`;

export const PYTHON_REQUIREMENTS = `discord.py>=2.3.2
requests>=2.31.0
python-dotenv>=1.0.0
aiohttp>=3.9.0
`;

export const JS_MAIN = `const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require("discord.js");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.once("ready", (c) => {
  console.log(\`Logged in as \${c.user.tag}\`);
  console.log(\`Connected to \${c.guilds.cache.size} guild(s)\`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content === "!ping") {
    await message.reply(\`Pong! Latency: \${Math.round(client.ws.ping)}ms\`);
  }

  if (message.content === "!hello") {
    await message.reply(\`Hello, \${message.author}!\`);
  }

  if (message.content === "!info") {
    const embed = new EmbedBuilder()
      .setTitle("Bot Info")
      .setColor(0x3b82f6)
      .addFields(
        { name: "Bot", value: client.user?.tag ?? "Unknown", inline: true },
        { name: "Guilds", value: \`\${client.guilds.cache.size}\`, inline: true },
        { name: "Ping", value: \`\${Math.round(client.ws.ping)}ms\`, inline: true }
      );
    await message.reply({ embeds: [embed] });
  }
});

client.on("error", (error) => {
  console.error("Client error:", error);
});

client.login(process.env.DISCORD_TOKEN);
`;

export const JS_PACKAGE_JSON = `{
  "name": "discord-bot",
  "version": "1.0.0",
  "description": "Discord bot powered by Blocker X",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "discord.js": "^14.14.1",
    "dotenv": "^16.3.1"
  }
}
`;
