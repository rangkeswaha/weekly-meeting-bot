const fs = require("fs");
const cron = require("node-cron");
const {
  Client,
  GatewayIntentBits,
  Partials,
  Events
} = require("discord.js");

/* ========= CONFIG ========= */
const TOKEN = process.env.DISCORD_TOKEN; // set this in Railway / hosting
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

/* ====== HELPERS ====== */
function loadSubscribers() {
  if (!fs.existsSync(SUBSCRIBERS_FILE)) {
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify([]));
  }
  return JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE));
}

function saveSubscribers(list) {
  fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(list, null, 2));
}
/* ===================== */

client.once(Events.ClientReady, () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

/* ====== REACTION HANDLER ====== */
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

  const subscribers = loadSubscribers();

  if (subscribers.includes(user.id)) {
    console.log(`ℹ️ ${user.tag} already subscribed`);
    return;
  }

  subscribers.push(user.id);
  saveSubscribers(subscribers);

  console.log(`✅ ${user.tag} subscribed`);

  try {
    await user.send(
      "✅ You’re subscribed!\n\nYou’ll receive a **DM every Friday at 9 PM (GMT+8)** with the voice chat link."
    );
  } catch {
    console.log(`❌ Cannot DM ${user.tag}`);
  }
});
/* ============================ */

/* ====== CRON JOB ====== */
/*
  Friday 9:00 PM GMT+8
  = Friday 13:00 UTC
*/
cron.schedule("* * * * *", async () => {
  console.log("⏰ Weekly Meeting Reminder Triggered");

  const subscribers = loadSubscribers();
  if (subscribers.length === 0) {
    console.log("ℹ️ No subscribers");
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
      console.log(`❌ Failed to DM user ${userId}`);
    }
  }
});
/* ===================== */

client.login(TOKEN);
