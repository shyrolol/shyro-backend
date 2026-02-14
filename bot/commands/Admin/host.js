const { MessageEmbed } = require("discord.js");
const functions = require("../../../structs/functions.js");
const User = require("../../../model/user.js");
const log = require("../../../structs/log.js");
const crypto = require("crypto");
const config = require("../../../Config/config.json");

function generateRandomPassword(length) {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+<>?";
  let password = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  return password;
}

function generateUniqueId() {
  return crypto.randomBytes(5).toString("hex");
}

module.exports = {
  commandInfo: {
    name: "host",
    description: "Manage host accounts.",
    options: [
      {
        name: "action",
        description: "The action to perform",
        type: 3,
        required: true,
        choices: [
          { name: "create", value: "create" },
          { name: "list", value: "list" },
          { name: "delete", value: "delete" },
        ],
      },
      {
        name: "username",
        description:
          "Username of the account to delete (only for delete action)",
        type: 3,
        required: false,
      },
    ],
  },

  execute: async (interaction) => {
    if (!config.discord.moderators.includes(interaction.user.id)) {
      return interaction.reply({
        content: "You do not have moderator permissions.",
        ephemeral: true,
      });
    }
    await interaction.deferReply({ ephemeral: true });

    const action = interaction.options.getString("action");

    if (action === "create") {
      return handleCreateHostAccount(interaction);
    } else if (action === "list") {
      return handleListHostAccounts(interaction);
    } else if (action === "delete") {
      return handleDeleteHostAccount(interaction);
    }
  },
};

async function handleCreateHostAccount(interaction) {
  try {
    let username, email;
    let attempts = 0;
    const maxAttempts = 5;
    while (attempts < maxAttempts) {
      const uniqueId = generateUniqueId();
      username = `hostaccount${uniqueId}`;
      email = `host${uniqueId}@shyro.com`;
      const existingUser = await User.findOne({
        $or: [{ username }, { email }],
      });
      if (!existingUser) {
        break;
      }
      attempts++;
    }

    if (attempts === maxAttempts) {
      return interaction.editReply({
        content:
          "Failed to generate unique account credentials after multiple attempts. Please try again.",
        ephemeral: true,
      });
    }

    const password = generateRandomPassword(12);
    const discordId = `host_${generateUniqueId()}`;
    const resp = await functions.registerUser(
      discordId,
      username,
      email,
      password,
    );

    let embed = new MessageEmbed()
      .setColor(resp.status >= 400 ? "#ff0000" : "#56ff00")
      .addFields(
        { name: "Message", value: resp.message },
        { name: "Username", value: `\`\`\`${username}\`\`\`` },
        { name: "Email", value: `\`\`\`${email}\`\`\`` },
        { name: "Password", value: `\`\`\`${password}\`\`\`` },
      )
      .setTimestamp();

    if (resp.status >= 400) {
      return interaction.editReply({ embeds: [embed], ephemeral: true });
    }

    await User.updateOne({ username }, { plainPassword: password });

    return interaction.editReply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    log.error(error);
    return interaction.editReply({
      content: "An error occurred while creating the host account.",
      ephemeral: true,
    });
  }
}

async function handleListHostAccounts(interaction) {
  try {
    const accounts = await User.find({ email: { $regex: "^host" } }).lean();

    if (accounts.length === 0) {
      return interaction.editReply({
        content: "No host accounts have been created yet.",
        ephemeral: true,
      });
    }

    let embed = new MessageEmbed()
      .setColor("#56ff00")
      .setTitle("Host Accounts")
      .setDescription(`Total: **${accounts.length}** account(s)`)
      .setTimestamp();

    accounts.forEach((account) => {
      const pwd = account.plainPassword || "N/A";
      embed.addFields({
        name: account.username,
        value: `Email: \`${account.email}\`\nPassword: \`${pwd}\``,
        inline: false,
      });
    });

    return interaction.editReply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    log.error(error);
    return interaction.editReply({
      content: "An error occurred while listing host accounts.",
      ephemeral: true,
    });
  }
}

async function handleDeleteHostAccount(interaction) {
  try {
    const username = interaction.options.getString("username");

    if (!username) {
      return interaction.editReply({
        content: "You must provide a username to delete.",
        ephemeral: true,
      });
    }

    const account = await User.findOne({ username });

    if (!account) {
      return interaction.editReply({
        content: `Account with username \`${username}\` not found.`,
        ephemeral: true,
      });
    }

    const email = account.email;
    await User.deleteOne({ username });

    let embed = new MessageEmbed()
      .setColor("#56ff00")
      .addFields({ name: "Message", value: "Account deleted successfully." })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    log.error(error);
    return interaction.editReply({
      content: "An error occurred while deleting the account.",
      ephemeral: true,
    });
  }
}
