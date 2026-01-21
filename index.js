const fs = require("fs");
const cron = require("node-cron");
const {
  Client,
  GatewayIntentBits,
  Partials,
  Events
} = require("discord.js");

/* ========= CONFIG ========= */
const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = "1354518292009717841";
const TEXT_CHANNEL_ID = "1462735108598399103";
const VOICE_CHANNEL_ID = "1462727284187201680";
const EMOJI = "🔔";
const SUBSCRIBERS_FILE = "./subscribers.json";
/* ========================== */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User
  ]
});

/* ===== SAFE FILE HANDLING ===== */
function loadSubscribers() {
  try {
    if (!fs.existsSync(SUBSCRIBERS_FILE)) {
      fs.writeFileSync(SUBSCRIBERS_FILE, "[]");
      return [];
    }

    const data = fs.readFileSync(SUBSCRIBERS_FILE, "utf8").trim();

    if (!data) {
      fs.writeFileSync(SUBSCRIBERS_FILE, "[]");
      return [];
    }

    return JSON.parse(data);
  } catch (err) {
    console.error("⚠️ subscribers.json corrupted — resetting");
    fs.writeFileSync(SUBSCRIBERS_FILE, "[]");
    return [];
  }
}

function saveSubscribers(list) {
  fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(list, null, 2));
}
/* =============================== */

client.once(Events.ClientReady, () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

/* ===== REACTION HANDLER ===== */
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;

  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch {
      return;
    }
  }

  if (reaction.message.channel.id !== TEXT_CHANNEL_ID) return;
  if (reaction.emoji.name !== EMOJI) return;

  console.log(`🔔 Reaction accepted from ${user.tag}`);

  const subscribers = loadSubscribers();

  if (subscribers.includes(user.id)) {
    console.log(`ℹ️ ${user.tag} already subscribed`);
    return;
  }

  subscribers.push(user.id);
  saveSubscribers(subscribers);

  try {
    await user.send(
      "✅ You’re subscribed!\n\nYou’ll receive a DM every **Friday at 9 PM (GMT+8)** with the voice chat link."
    );
    console.log(`📩 Confirmation DM sent to ${user.tag}`);
  } catch {
    console.log(`❌ Cannot DM ${user.tag}`);
  }
});
/* ============================ */

/* ===== CRON JOB ===== */
/*
  Friday 9 PM GMT+8
  = Friday 13:00 UTC
*/
cron.schedule("0 13 * * 5", async () => {
// cron.schedule("* * * * *", async () => {
  console.log("⏰ Weekly Meeting Reminder Triggered");

  const subscribers = loadSubscribers();
  if (subscribers.length === 0) {
    console.log("ℹ️ No subscribers to notify");
    return;
  }

  const inviteLink = `https://discord.com/channels/${GUILD_ID}/${VOICE_CHANNEL_ID}`;

  for (const userId of subscribers) {
    try {
      const user = await client.users.fetch(userId);
      await user.send(
        `🔔 **Weekly Meeting Reminder**\n\nJoin the voice channel here:\n${inviteLink}`
      );
      console.log(`📩 DM sent to ${user.tag}`);
    } catch {
      console.log(`❌ Failed to DM ${userId}`);
    }
  }
});
/* ===================== */

process.on("SIGTERM", () => {
  console.log("⚠️ Process terminated (SIGTERM)");
  process.exit(0);
});

client.login(TOKEN);
