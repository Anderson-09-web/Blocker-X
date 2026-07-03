export const PYTHON_MAIN = `import discord
from discord.ext import commands
import os

intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents)

@bot.event
async def on_ready():
    print(f"Bot en linea: {bot.user}")

@bot.command()
async def ping(ctx):
    await ctx.send(f"Pong! ({round(bot.latency * 1000)}ms)")

bot.run(os.getenv("DISCORD_TOKEN"))
`;

export const PYTHON_REQUIREMENTS = `discord.py>=2.3.2
requests>=2.31.0
aiohttp>=3.9.0
`;

export const JS_MAIN = `const { Client, GatewayIntentBits } = require("discord.js");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("ready", (c) => {
  console.log(\`Logged in as \${c.user.tag}\`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.content === "!ping") {
    await message.reply(\`Pong! \${Math.round(client.ws.ping)}ms\`);
  }
});

client.login(process.env.DISCORD_TOKEN);
`;

export const JS_PACKAGE_JSON = `{
  "name": "discord-bot",
  "version": "1.0.0",
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
