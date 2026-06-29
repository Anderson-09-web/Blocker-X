export const PYTHON_MAIN = `import discord
from discord.ext import commands
import os
from dotenv import load_dotenv

load_dotenv()

intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True

bot = commands.Bot(command_prefix="!", intents=intents)

@bot.event
async def on_ready():
    print(f"Logged in as {bot.user} (ID: {bot.user.id})")
    print(f"Connected to {len(bot.guilds)} guild(s)")

@bot.command()
async def ping(ctx):
    """Check bot latency"""
    await ctx.send(f"Pong! Latency: {round(bot.latency * 1000)}ms")

@bot.command()
async def hello(ctx):
    """Say hello"""
    await ctx.send(f"Hello, {ctx.author.mention}!")

@bot.command()
async def info(ctx):
    """Show bot info"""
    embed = discord.Embed(title="Bot Info", color=0x3b82f6)
    embed.add_field(name="Bot", value=bot.user.name, inline=True)
    embed.add_field(name="Guilds", value=str(len(bot.guilds)), inline=True)
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
