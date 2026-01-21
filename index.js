const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  Events 
} = require("discord.js");

/* ====== CONFIG (FILL THESE) ====== */
const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = "1354518292009717841";
const TEXT_CHANNEL_ID = "1462735108598399103";
const VOICE_CHANNEL_ID = "1462727284187201680";
const EMOJI = "🔔";
/* ================================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
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


client.once(Events.ClientReady, () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// client.on(Events.MessageReactionAdd, async (reaction, user) => {
//   if (user.bot) return;

//   if (reaction.partial) await reaction.fetch();

//   if (reaction.message.channel.id !== TEXT_CHANNEL_ID) return;
//   if (reaction.emoji.name !== EMOJI) return;

//   console.log(`🔔 Reaction received from ${user.tag}`);

//   setTimeout(async () => {
//     try {
//       const inviteLink = `https://discord.com/channels/${GUILD_ID}/${VOICE_CHANNEL_ID}`;
//       await user.send(
//         `🔔 **Weekly Meeting Invitation**\n\nJoin the voice channel here:\n${inviteLink}`
//       );
//       console.log(`✅ DM sent to ${user.tag}`);
//     } catch (err) {
//       console.error(`❌ Failed to DM ${user.tag}`);
//     }
//   }, 60 * 1000);
// });

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  console.log("REACTION EVENT FIRED");

  if (reaction.partial) await reaction.fetch();

  console.log("Emoji:", reaction.emoji.name);
  console.log("Channel ID:", reaction.message.channel.id);
  console.log("User:", user.tag);

  if (user.bot) return;

  if (reaction.message.channel.id !== TEXT_CHANNEL_ID) {
    console.log("❌ Wrong channel");
    return;
  }

  if (reaction.emoji.name !== EMOJI) {
    console.log("❌ Wrong emoji");
    return;
  }

  console.log("✅ Reaction accepted");

  setTimeout(async () => {
    try {
      const inviteLink = `https://discord.com/channels/${GUILD_ID}/${VOICE_CHANNEL_ID}`;
      await user.send(
        `🔔 **Weekly Meeting Invitation**\n\nJoin here:\n${inviteLink}`
      );
      console.log("✅ DM SENT");
    } catch (err) {
      console.error("❌ DM FAILED", err.message);
    }
  }, 60 * 1000);
});


client.login(TOKEN);
