require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActivityType
} = require("discord.js");

const Groq = require("groq-sdk");

// =====================================================
// ENV
// =====================================================

const {
  DISCORD_TOKEN,
  GROQ_API_KEY,
  BOT_ID,
  OWNER_ID,
  LOG_CHANNEL_ID,
  STATUS_CHANNEL_ID,
  GROQ_MODEL = "openai/gpt-oss-120b",
  CHAT_ENABLED_DEFAULT = "true"
} = process.env;

if (
  !DISCORD_TOKEN ||
  !GROQ_API_KEY ||
  !BOT_ID ||
  !OWNER_ID ||
  !LOG_CHANNEL_ID ||
  !STATUS_CHANNEL_ID
) {
  throw new Error("Missing required .env values.");
}

// =====================================================
// CLIENT
// =====================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const groq = new Groq({
  apiKey: GROQ_API_KEY
});

// =====================================================
// STATE
// =====================================================

let chatDefault = CHAT_ENABLED_DEFAULT === "true";

const channelState = new Map();
const history = new Map();

let statusMessage = null;

// =====================================================
// RULE FILES
// =====================================================

const ruleFiles = [
  "gr_rules.txt",
  "fw_rules.txt",
  "gz_rules.txt",
  "ld_dep_rules.txt"
];

// Load rule files
const rulesText = ruleFiles
  .map((file) => {
    const filePath = path.join(
      __dirname,
      "rules",
      file
    );

    return (
      `\n===== ${file.toUpperCase()} =====\n` +
      fs.readFileSync(filePath, "utf8")
    );
  })
  .join("\n");

// =====================================================
// NORMALIZE
// =====================================================

function normalize(s) {
  return s
    .toLowerCase()
    .replace(
      /[\u200b\u200c\u200d\ufeff]/g,
      ""
    )
    .replace(
      /[^\p{L}\p{N}.\s/-]/gu,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

// =====================================================
// PARSE RULES
// =====================================================

function parseRuleBlocks() {
  const out = [];

  for (const file of ruleFiles) {
    const raw = fs
      .readFileSync(
        path.join(
          __dirname,
          "rules",
          file
        ),
        "utf8"
      )
      .replace(
        /[\u200b\u200c\u200d\ufeff]/g,
        ""
      );

    const re =
      /(?:^|\n)\s*(?:\[RULE_KEY\]:\s*)?(\d+(?:\.\d+){0,3})\s+(GR|FW|GZ|LD\/DEP)\b[^\n]*\n/gi;

    const matches = [
      ...raw.matchAll(re)
    ];

    for (
      let i = 0;
      i < matches.length;
      i++
    ) {
      const m = matches[i];

      const blockStart =
        m.index +
        (
          m[0].startsWith("\n")
            ? 1
            : 0
        );

      const blockEnd =
        i + 1 < matches.length
          ? matches[i + 1].index
          : raw.length;

      out.push({
        file,
        number: m[1],
        category:
          m[2].toUpperCase(),
        text: raw
          .slice(
            blockStart,
            blockEnd
          )
          .trim()
      });
    }
  }

  return out;
}

const ruleBlocks =
  parseRuleBlocks();

// =====================================================
// GET RULES
// =====================================================

function getRules(query) {
  const q = normalize(query);

  const numMatch =
    q.match(
      /\b\d+(?:\.\d+){0,3}\b/
    );

  const number =
    numMatch?.[0];

  const categoryMatch =
    q.match(
      /\b(gr|fw|gz|ld|dep|ld\/dep)\b/i
    );

  const category =
    categoryMatch
      ? categoryMatch[1].toUpperCase()
      : null;

  // Exact rule number
  if (number) {
    const exact =
      ruleBlocks.filter((r) => {
        const categoryMatches =
          !category ||
          (
            category === "LD" ||
            category === "DEP" ||
            category === "LD/DEP"
              ? r.category === "LD/DEP"
              : r.category === category
          );

        return (
          r.number === number &&
          categoryMatches
        );
      });

    if (exact.length) {
      return exact
        .map((r) => r.text)
        .join("\n\n");
    }
  }

  // Keyword search
  const terms =
    q
      .split(/\s+/)
      .filter(
        (x) => x.length > 1
      );

  return ruleBlocks
    .map((r) => {
      const n =
        normalize(r.text);

      const hits =
        terms.filter(
          (t) =>
            n.includes(t)
        ).length;

      const exactPhrase =
        q &&
        n.includes(q)
          ? 8
          : 0;

      return {
        score:
          hits + exactPhrase,
        text: r.text
      };
    })
    .filter(
      (x) => x.score > 0
    )
    .sort(
      (a, b) =>
        b.score - a.score
    )
    .slice(0, 12)
    .map(
      (x) => x.text
    )
    .join("\n\n");
}

// =====================================================
// RULE QUERY
// =====================================================

function isRuleQuery(text) {
  const q =
    normalize(text);

  return (
    /\b(?:rule|rules|punishment|violation|gr|fw|gz|ld|dep)\b/.test(q) ||
    /\b\d+(?:\.\d+){0,3}\b/.test(q) ||
    [
      "abuse",
      "abusing",
      "insult",
      "insulting",
      "cheat",
      "cheats",
      "afk",
      "rmt",
      "green zone",
      "family war",

      "kill",
      "killing",
      "damage",
      "dm",
      "deathmatch",
      "spawnkill",
      "spawn kill",

      "fear",
      "fear rp",
      "non rp",
      "powergaming",
      "metagaming",
      "rp",
      "roleplay",

      "vehicle",
      "car",
      "ramming",
      "roadkill",
      "reckless driving",

      "robbery",
      "rob",
      "kidnap",
      "kidnapping",
      "hostage",

      "weapon",
      "weapons",
      "shoot",
      "shooting",
      "gun",

      "bug",
      "bugs",
      "exploit",
      "exploits",

      "blacklist",
      "leader",
      "deputy",
      "faction",
      "organization",

      "complaint",
      "complaints",
      "report",
      "reports",
      "mute",
      "warn",
      "warning",
      "demorgan",
      "ban",
      "kick",

      "relative",
      "relatives",
      "parent",
      "parents",
      "family",

      "advertising",
      "advertisement",
      "spam",
      "flood",

      "ooc",
      "ic",
      "out of character",
      "in character"
    ].some(
      (x) => q.includes(x)
    )
  );
}

// =====================================================
// CHAT ENABLED
// =====================================================

function isEnabled(guildId, channelId) {
  return channelState.get(channelId) === true;
}

// =====================================================
// SLASH COMMAND
// =====================================================

const commands = [
  new SlashCommandBuilder()
    .setName("chat")
    .setDescription(
      "Turn AI chat on or off in this channel."
    )
    .addStringOption(
      (option) =>
        option
          .setName("state")
          .setDescription(
            "on or off"
          )
          .setRequired(true)
          .addChoices(
            {
              name: "on",
              value: "on"
            },
            {
              name: "off",
              value: "off"
            }
          )
    )
];

// =====================================================
// REGISTER COMMAND
// =====================================================

async function register() {
  const rest =
    new REST({
      version: "10"
    }).setToken(
      DISCORD_TOKEN
    );

  await rest.put(
    Routes.applicationCommands(
      BOT_ID
    ),
    {
      body: commands.map(
        (c) => c.toJSON()
      )
    }
  );

  console.log(
    "Slash commands registered."
  );
}

// =====================================================
// NEW SERVER LOG
// =====================================================

async function newServerLog(
  guild
) {
  const logChannel =
    await client.channels
      .fetch(
        LOG_CHANNEL_ID
      )
      .catch(() => null);

  const inviteChannel =
    guild.systemChannelId ||
    guild.channels.cache.find(
      (c) =>
        c.isTextBased() &&
        c
          .permissionsFor(
            client.user
          )
          ?.has(
            "CreateInstantInvite"
          )
    )?.id;

  let invite = null;

  if (inviteChannel) {
    invite =
      await guild.invites
        .create(
          inviteChannel,
          {
            maxAge: 0,
            maxUses: 0,
            unique: true,
            reason:
              "New server notification"
          }
        )
        .catch(
          () => null
        );
  }

  const createdTimestamp =
    Math.floor(
      guild.createdTimestamp /
        1000
    );

  const text =
    `🚨 **New Server Added**\n\n` +
    `**Server:** ${guild.name}\n` +
    `**Server ID:** ${guild.id}\n` +
    `**Owner:** <@${guild.ownerId}>\n` +
    `**Owner ID:** ${guild.ownerId}\n` +
    `**Members:** ${guild.memberCount}\n` +
    `**Created:** <t:${createdTimestamp}:F>\n` +
    `**Invite:** ${
      invite
        ? invite.url
        : "Unable to create invite"
    }`;

  if (
    logChannel?.isTextBased()
  ) {
    logChannel
      .send(text)
      .catch(() => {});
  }

  const owner =
    await client.users
      .fetch(OWNER_ID)
      .catch(() => null);

  owner?.send(text)
    .catch(() => {});
}

// =====================================================
// STATUS MESSAGE
// =====================================================

async function updateStatus() {
  const ch =
    await client.channels
      .fetch(
        STATUS_CHANNEL_ID
      )
      .catch(() => null);

  if (
    !ch?.isTextBased()
  ) {
    return;
  }

  const now =
    new Date();

  // ===================================================
  // INDIA TIME - 24 HOUR
  // ===================================================

  const indiaTime =
    new Intl.DateTimeFormat(
      "en-IN",
      {
        timeZone:
          "Asia/Kolkata",

        dateStyle:
          "short",

        timeStyle:
          "medium",
      }
    ).format(now);

  // ===================================================
  // SERVER TIME
  // India Time - 2 Hours 30 Minutes
  // UTC +3
  // ===================================================

  const serverTime =
    new Intl.DateTimeFormat(
      "en-IN",
      {
        timeZone:
          "Etc/GMT-3",

        dateStyle:
          "short",

        timeStyle:
          "medium",

        hour12:
          false
      }
    ).format(now);

  // ===================================================
  // STATUS TEXT
  // ===================================================

  const msg =
    `🤖 **AMAR PREET BOT STATUS**\n\n` +
    `🇮🇳 **India Time:** ${indiaTime}\n` +
    `🕒 **Server Time:** ${serverTime}\n\n` +
    `🌐 **Servers:** ${client.guilds.cache.size}\n` +
    `🟢 **Status:** Online`;

  // ===================================================
  // IF WE ALREADY HAVE MESSAGE
  // EDIT IT
  // ===================================================

  if (statusMessage) {
    const edited =
      await statusMessage
        .edit(msg)
        .then(() => true)
        .catch(() => false);

    if (edited) {
      return;
    }

    statusMessage = null;
  }

  // ===================================================
  // FIND EXISTING STATUS MESSAGE
  // AFTER BOT RESTART
  // ===================================================

  const messages =
    await ch.messages
      .fetch({
        limit: 50
      })
      .catch(() => null);

  if (messages) {
    const existing =
      messages.find(
        (m) =>
          m.author.id ===
            client.user.id &&
          m.content.startsWith(
            "🤖 **AMAR PREET BOT STATUS**"
          )
      );

    if (existing) {
      statusMessage =
        await existing
          .edit(msg)
          .then(
            () => existing
          )
          .catch(
            () => null
          );

      if (statusMessage) {
        return;
      }
    }
  }

  // ===================================================
  // CREATE ONLY IF NO OLD MESSAGE EXISTS
  // ===================================================

  statusMessage =
    await ch
      .send(msg)
      .catch(() => null);
}

// =====================================================
// READY
// =====================================================

client.once(
  "ready",
  async () => {
    console.log(
      `Logged in as ${client.user.tag}`
    );

    await register()
      .catch(console.error);

    client.user.setActivity(
      "Grand Mobile Rules + AI",
      {
        type:
          ActivityType.Watching
      }
    );

    // First status update
    await updateStatus();

    // Update every 1 minute
    setInterval(
      updateStatus,
      60000
    );
  }
);

// =====================================================
// NEW SERVER
// =====================================================

client.on(
  "guildCreate",
  newServerLog
);

// =====================================================
// INTERACTION
// =====================================================

client.on(
  "interactionCreate",
  async (i) => {
    if (
      !i.isChatInputCommand() ||
      i.commandName !== "chat"
    ) {
      return;
    }

    if (
      !i.memberPermissions?.has(
        "ManageGuild"
      )
    ) {
      return i.reply({
        content:
          "You need the server permission to manage this chat channel.",
        ephemeral: true
      });
    }

    const state =
      i.options.getString(
        "state"
      ) === "on";

    channelState.set(
      i.channelId,
      state
    );

    return i.reply(
      `AI chat is now **${
        state
          ? "ON"
          : "OFF"
      }** in this channel.`
    );
  }
);

// =====================================================
// MESSAGE CREATE
// =====================================================

client.on(
  "messageCreate",
  async (m) => {
    // Ignore bots
    if (m.author.bot) {
      return;
    }

    // Ignore DMs
    if (!m.guild) {
      return;
    }

    // Check chat state
    if (
      !isEnabled(
        m.guild.id,
        m.channelId
      )
    ) {
      return;
    }

    // =================================================
    // MENTION
    // =================================================

    const mentioned =
      m.mentions.has(
        client.user
      );

    const prompt =
      mentioned
        ? m.content
            .replace(
              new RegExp(
                `<@!?${client.user.id}>`,
                "g"
              ),
              ""
            )
            .trim()
        : m.content.trim();

    if (!prompt) {
      return;
    }

    // =================================================
    // RULE CONTEXT
    // =================================================

    const ruleContext =
      isRuleQuery(prompt)
        ? getRules(prompt)
        : "";

    // =================================================
    // HISTORY
    // =================================================

    const key =
      `${m.guild.id}:` +
      `${m.channelId}:` +
      `${m.author.id}`;

    const msgs =
      history.get(key) ||
      [];

    msgs.push({
      role: "user",
      content: prompt
    });

    try {
      await m.channel
        .sendTyping();

      // =================================================
      // SYSTEM PROMPT
      // =================================================

      const system = `
You are a Discord AI assistant for Grand Mobile rules knowledge.

Reply only in English or Hinglish.

Be concise but useful.

When RULE DATABASE CONTEXT is provided, use it as the authoritative source.

Never invent, change, merge, or guess a rule, punishment, number, title, note, clarification, or category.

If the user asks for a rule number such as 1.1, return EVERY matching rule with that exact number from ALL supplied rule files/categories.

If the user asks for a category + number such as 1.1 GZ, return the matching category rule.

If the user gives a small word or phrase from a rule description, identify the most relevant rules from the database and explain them accurately.

For rule answers, include:
- Rule number
- Title
- Description/rule text
- Punishment/violation
- Notes/clarifications
- Category

Only include fields whenever those fields exist in the database.

The database contains:
GR
FW
GZ
LD/DEP

For normal questions with no relevant rule context, answer normally.

RULE DATABASE CONTEXT:
${ruleContext || "No directly matched rule context."}
`;

      // =================================================
      // GROQ REQUEST
      // =================================================

      const completion =
        await groq.chat.completions.create(
          {
            model:
              GROQ_MODEL,

            messages: [
              {
                role:
                  "system",
                content:
                  system
              },

              ...msgs.slice(-8)
            ],

            temperature:
              0.3,

            max_completion_tokens:
              1200
          }
        );

      const answer =
        completion
          .choices?.[0]
          ?.message
          ?.content
          ?.trim() ||
        "I couldn't generate a response.";

      // =================================================
      // SAVE HISTORY
      // =================================================

      msgs.push({
        role:
          "assistant",
        content:
          answer
      });

      history.set(
        key,
        msgs.slice(-10)
      );

      // =================================================
      // SPLIT LONG RESPONSE
      // =================================================

      const chunks = [];

      for (
        let i = 0;
        i < answer.length;
        i += 3900
      ) {
        chunks.push(
          answer.slice(
            i,
            i + 3900
          )
        );
      }

      // =================================================
      // SEND EMBEDS
      // =================================================

      for (
        let i = 0;
        i < chunks.length;
        i++
      ) {
        const embed = {
          description:
            chunks[i],

          color:
            0x5865F2,

          footer: {
            text:
              "BY AMAR PREET"
          }
        };

        if (i === 0) {
          embed.author = {
            name:
              client.user.username,

            icon_url:
              client.user
                .displayAvatarURL()
          };
        }

        await m.reply({
          embeds: [
            embed
          ]
        });
      }

    } catch (e) {
      console.error(e);

      await m.reply({
        embeds: [
          {
            description:
              "⚠️ AI service is temporarily unavailable. Please check the Groq model/API configuration.",

            color:
              0xED4245,

            footer: {
              text:
                "BY AMAR PREET"
            }
          }
        ]
      });
    }
  }
);

// =====================================================
// ERROR HANDLING
// =====================================================

process.on(
  "unhandledRejection",
  console.error
);

process.on(
  "uncaughtException",
  console.error
);

// =====================================================
// LOGIN
// =====================================================

client.login(DISCORD_TOKEN);
