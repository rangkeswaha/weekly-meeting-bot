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

/* ===== Scheduling Function ===== */
function parseTimeChange(input) {
  const regex =
    /^(\d{1,2}):(\d{2})\s+(GMT|UTC)([+-]\d{1,2})\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i;

  const match = input.match(regex);
  if (!match) return null;

  let [, hour, minute, , offset, day] = match;

  hour = parseInt(hour, 10);
  minute = parseInt(minute, 10);
  const tzOffset = parseInt(offset, 10);

  if (hour > 23 || minute > 59) return null;

  // Convert to UTC
  let utcHour = hour - tzOffset;
  if (utcHour < 0) utcHour += 24;
  if (utcHour > 23) utcHour -= 24;

  const dayMap = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6
  };

  return {
    cron: `${minute} ${utcHour} * * ${dayMap[day]}`,
    label: `${day} ${hour.toString().padStart(2, "0")}:${minute
      .toString()
      .padStart(2, "0")} (GMT${offset})`
  };
}

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

/* ===== CLEANUP WHEN MEMBER LEAVES / KICKED ===== */
client.on(Events.GuildMemberRemove, member => {
  const subscribers = loadSubscribers();
  const index = subscribers.indexOf(member.id);

  if (index === -1) return;

  subscribers.splice(index, 1);
  saveSubscribers(subscribers);

  console.log(
    `🧹 Removed ${member.user?.tag || member.id} from subscribers (left/kicked)`
  );
});
/* ============================================= */

/* ===== CLEANUP WHEN MEMBER IS BANNED ===== */
client.on(Events.GuildBanAdd, async ban => {
  const userId = ban.user.id;
  const subscribers = loadSubscribers();
  const index = subscribers.indexOf(userId);

  if (index === -1) return;

  subscribers.splice(index, 1);
  saveSubscribers(subscribers);

  console.log(`🚫 Removed ${ban.user.tag} from subscribers (banned)`);
});
/* ======================================== */


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
    const input = args.slice(1).join(" ");
    const parsed = parseTimeChange(input);
  
    if (!parsed) {
      return message.author.send(
        "❌ Invalid format.\n\n" +
        "Use:\n" +
        "`!timechange HH:MM GMT±X DAY`\n\n" +
        "Example:\n" +
        "`!timechange 21:45 GMT+8 Friday`"
      );
    }
  
    data.meetingCron = parsed.cron;
    data.meetingLabel = parsed.label;
    saveData(data);
    scheduleMeeting();
  
    return message.author.send(
      "⏰ **Meeting time updated**\n\n" +
      `🕒 ${parsed.label}\n` +
      `⚙️ Cron: \`${parsed.cron}\``
    );
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
