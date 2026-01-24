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
const DATA_FILE = "./subscribers.json";
const ROLE_ID = "1463660395674992705";
const OWNER_ID = "340464341193326593";
/* ========================== */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User
  ]
});

/* ===== DATA HANDLING ===== */
function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const init = {
        subscribers: [],
        meetingCron: "0 13 * * 5", // Friday 9PM GMT+8
        meetingLabel: "Friday 9 PM (GMT+8)"
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(init, null, 2));
      return init;
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    console.error("⚠️ Data corrupted, resetting");
    return { subscribers: [], meetingCron: "0 13 * * 5", meetingLabel: "" };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/* Backward compatible wrappers */
function loadSubscribers() {
  return loadData().subscribers;
}
function saveSubscribers(list) {
  const data = loadData();
  data.subscribers = list;
  saveData(data);
}
/* ========================== */

client.once(Events.ClientReady, () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  scheduleMeeting();
});

/* ===== REACTION SUBSCRIBE ===== */
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => {});
  if (reaction.message.channel.id !== TEXT_CHANNEL_ID) return;
  if (reaction.emoji.name !== EMOJI) return;

  const subscribers = loadSubscribers();
  if (subscribers.includes(user.id)) return;

  subscribers.push(user.id);
  saveSubscribers(subscribers);

  try {
    await user.send("✅ You’re subscribed to weekly meeting reminders.");
  } catch {}

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(user.id);
    await member.roles.add(ROLE_ID);
  } catch {}
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => {});
  if (reaction.message.channel.id !== TEXT_CHANNEL_ID) return;
  if (reaction.emoji.name !== EMOJI) return;

  const subs = loadSubscribers().filter(id => id !== user.id);
  saveSubscribers(subs);

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(user.id);
    await member.roles.remove(ROLE_ID);
  } catch {}
});

/* ===== OWNER DM COMMANDS ===== */
client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;
  if (message.guild) return; // DM only
  if (message.author.id !== OWNER_ID) return;

  const data = loadData();
  const args = message.content.split(" ");

  /* !subscribers */
  if (message.content === "!subscribers") {
    return message.author.send(
      `📄 Subscribers (${data.subscribers.length})\n\n` +
      (data.subscribers.length ? data.subscribers.join("\n") : "Empty")
    );
  }

  /* !addsubsonce */
  if (args[0] === "!addsubsonce" && args[1]) {
    if (!data.subscribers.includes(args[1])) {
      data.subscribers.push(args[1]);
      saveData(data);
    }
    return message.author.send(`✅ Added ${args[1]}`);
  }

  /* !addsubsbulk */
  if (args[0] === "!addsubsbulk" && args[1]) {
    const ids = args[1].split(",").map(x => x.trim());
    ids.forEach(id => {
      if (!data.subscribers.includes(id)) data.subscribers.push(id);
    });
    saveData(data);
    return message.author.send(`✅ Added ${ids.length} IDs`);
  }

  /* !timechange */
  if (args[0] === "!timechange") {
    data.meetingLabel = args.slice(1).join(" ");
    saveData(data);
    scheduleMeeting();
    return message.author.send(`⏰ Meeting time updated to ${data.meetingLabel}`);
  }

  /* !clear-subscribers */
  if (message.content === "!clear-subscribers") {
    data.subscribers = [];
    saveData(data);
    return message.author.send("🧹 Subscriber list cleared");
  }
});

/* ===== CRON SCHEDULER ===== */
let meetingTask;
function scheduleMeeting() {
  if (meetingTask) meetingTask.stop();

  const data = loadData();
  meetingTask = cron.schedule(data.meetingCron, async () => {
    const invite = `https://discord.com/channels/${GUILD_ID}/${VOICE_CHANNEL_ID}`;
    for (const id of data.subscribers) {
      try {
        const user = await client.users.fetch(id);
        await user.send(`🔔 Weekly Meeting\n${invite}`);
      } catch {}
    }
  });

  console.log("⏰ Meeting scheduler active");
}

client.login(TOKEN);
