const { Client, Intents, MessageEmbed } = require("discord.js");
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_BANS,
  ],
});
const fs = require("fs");
const path = require("path");
const config = JSON.parse(fs.readFileSync("./Config/config.json").toString());
const log = require("../structs/log.js");
const Users = require("../model/user.js");

client.once("ready", () => {
  log.bot("Bot is up and running!");

  if (config.bEnableBackendStatus) {
    if (
      !config.bBackendStatusChannelId ||
      config.bBackendStatusChannelId.trim() === ""
    ) {
      log.error(
        "The channel ID has not been set in config.json for bEnableBackendStatus.",
      );
    } else {
      const channel = client.channels.cache.get(config.bBackendStatusChannelId);
      if (!channel) {
        log.error(
          `Cannot find the channel with ID ${config.bBackendStatusChannelId}`,
        );
      } else {
        const embed = new MessageEmbed()
          .setTitle("Services online !")
          .setDescription("Backend status: **Online**")
          .setColor("GREEN")
          .setTimestamp();

        channel.send({ embeds: [embed] }).catch((err) => {
          log.error(err);
        });
      }
    }
  }

  if (config.discord.bEnableInGamePlayerCount) {
    function updateBotStatus() {
      if (global.Clients && Array.isArray(global.Clients)) {
        client.user.setActivity(`${global.Clients.length} player(s)`, {
          type: "WATCHING",
        });
      }
    }

    updateBotStatus();
    setInterval(updateBotStatus, 10000);
  }

  let commands = client.application.commands;
  const commandMap = new Map();

  const loadCommandsFromDir = (dir, parentPath = "") => {
    try {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.lstatSync(itemPath);

        if (stat.isDirectory()) {
          loadCommandsFromDir(itemPath, path.join(parentPath, item));
        } else if (item.endsWith(".js")) {
          try {
            delete require.cache[require.resolve(itemPath)];
            const command = require(itemPath);

            if (command.commandInfo && command.execute) {
              commandMap.set(command.commandInfo.name, command);
              log.debug(`Loaded command: ${command.commandInfo.name}`);
            } else {
              log.warn(`Invalid command structure in ${itemPath}`);
            }
          } catch (err) {
            log.error(`Error loading command ${itemPath}: ${err.message}`);
          }
        }
      }
    } catch (err) {
      log.error(`Error reading directory ${dir}: ${err.message}`);
    }
  };

  const syncCommands = async () => {
    try {
      const remoteCommands = await commands.fetch();
      const remoteCommandNames = new Set(remoteCommands.map((cmd) => cmd.name));
      const localCommandNames = new Set(commandMap.keys());

      for (const cmd of remoteCommands.values()) {
        if (!localCommandNames.has(cmd.name)) {
          await cmd.delete();
          log.debug(`Deleted command: ${cmd.name}`);
        }
      }

      for (const [name, command] of commandMap) {
        try {
          await commands.create(command.commandInfo);
          log.debug(`Synced command: ${name}`);
        } catch (err) {
          log.error(`Error syncing command ${name}: ${err.message}`);
        }
      }

      log.bot(`Commands synced successfully (${localCommandNames.size} total)`);
    } catch (err) {
      log.error(`Error syncing commands: ${err.message}`);
    }
  };

  loadCommandsFromDir(path.join(__dirname, "commands"));
  syncCommands();
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isApplicationCommand()) return;

  const commandMap = new Map();

  const loadCommand = (dir, commandName) => {
    const commandPath = path.join(dir, commandName + ".js");
    if (fs.existsSync(commandPath)) {
      try {
        delete require.cache[require.resolve(commandPath)];
        const command = require(commandPath);
        return command;
      } catch (err) {
        log.error(`Error loading command ${commandName}: ${err.message}`);
        return null;
      }
    }

    const subdirectories = fs.readdirSync(dir).filter((subdir) => {
      try {
        return fs.lstatSync(path.join(dir, subdir)).isDirectory();
      } catch {
        return false;
      }
    });

    for (const subdir of subdirectories) {
      const command = loadCommand(path.join(dir, subdir), commandName);
      if (command) return command;
    }
    return null;
  };

  try {
    const command = loadCommand(
      path.join(__dirname, "commands"),
      interaction.commandName,
    );

    if (!command) {
      log.warn(`Command not found: ${interaction.commandName}`);
      return interaction
        .reply({
          content: "This command does not exist or could not be loaded.",
          ephemeral: true,
        })
        .catch((err) =>
          log.error(`Error replying to interaction: ${err.message}`),
        );
    }

    await command.execute(interaction);
  } catch (err) {
    log.error(
      `Error executing command ${interaction.commandName}: ${err.message}`,
    );

    try {
      await interaction
        .reply({
          content: "An error occurred while executing this command.",
          ephemeral: true,
        })
        .catch(() => {});
    } catch (replyErr) {
      log.error(`Failed to send error reply: ${replyErr.message}`);
    }
  }
});

client.on("guildBanAdd", async (ban) => {
  if (!config.bEnableCrossBans) return;

  const memberBan = await ban.fetch();

  if (memberBan.user.bot) return;

  const userData = await Users.findOne({ discordId: memberBan.user.id });

  if (userData && userData.banned !== true) {
    await userData.updateOne({ $set: { banned: true } });

    let refreshToken = global.refreshTokens.findIndex(
      (i) => i.accountId == userData.accountId,
    );

    if (refreshToken != -1) global.refreshTokens.splice(refreshToken, 1);
    let accessToken = global.accessTokens.findIndex(
      (i) => i.accountId == userData.accountId,
    );

    if (accessToken != -1) {
      global.accessTokens.splice(accessToken, 1);
      let xmppClient = global.Clients.find(
        (client) => client.accountId == userData.accountId,
      );
      if (xmppClient) xmppClient.client.close();
    }

    if (accessToken != -1 || refreshToken != -1) {
      await functions.UpdateTokens();
    }

    log.debug(
      `user ${memberBan.user.username} (ID: ${memberBan.user.id}) was banned on the discord and also in the game (Cross Ban active).`,
    );
  }
});

client.on("guildBanRemove", async (ban) => {
  if (!config.bEnableCrossBans) return;

  if (ban.user.bot) return;

  const userData = await Users.findOne({ discordId: ban.user.id });

  if (userData && userData.banned === true) {
    await userData.updateOne({ $set: { banned: false } });

    log.debug(
      `User ${ban.user.username} (ID: ${ban.user.id}) is now unbanned.`,
    );
  }
});

client.on("error", (err) => {
  console.log("Discord API Error:", err);
});

process.on("unhandledRejection", (reason, p) => {
  console.log("Unhandled promise rejection:", reason, p);
});

process.on("uncaughtException", (err, origin) => {
  console.log("Uncaught Exception:", err, origin);
});

process.on("uncaughtExceptionMonitor", (err, origin) => {
  console.log("Uncaught Exception Monitor:", err, origin);
});

client.login(config.discord.bot_token);
