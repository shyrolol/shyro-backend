const { MessageEmbed } = require("discord.js");
const User = require("../../../model/user.js");
const Profiles = require("../../../model/profiles.js");
const log = require("../../../structs/log.js");
const config = require("../../../Config/config.json");

module.exports = {
  commandInfo: {
    name: "players",
    description: "List all registered players.",
  },
  execute: async (interaction) => {
    if (!config.discord.moderators.includes(interaction.user.id)) {
      return interaction.reply({
        content: "You do not have moderator permissions.",
        ephemeral: true,
      });
    }
    await interaction.deferReply({ ephemeral: true });

    try {
      const players = await User.find({ email: { $not: /^host/ } }).lean();

      if (players.length === 0) {
        return interaction.editReply({
          content: "No registered players found.",
          ephemeral: true,
        });
      }

      let embed = new MessageEmbed()
        .setColor("#56ff00")
        .setTitle("Registered Players")
        .setDescription(`Total: **${players.length}** player(s)`)
        .setTimestamp();

      const displayPlayers = players.slice(0, 25);

      displayPlayers.forEach((player) => {
        const onlineStatus = global.Clients?.some(
          (c) => c.accountId === player.accountId,
        )
          ? "Online"
          : "Offline";
        const bannedStatus = player.banned ? "Banned" : "Active";

        embed.addFields({
          name: player.username,
          value: `Email: \`${player.email}\`\n${onlineStatus} | ${bannedStatus}`,
          inline: false,
        });
      });

      if (players.length > 25) {
        embed.setFooter({ text: `Showing 25 of ${players.length} players` });
      }

      return interaction.editReply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      log.error(error);
      return interaction.editReply({
        content: "An error occurred while fetching players.",
        ephemeral: true,
      });
    }
  },
};
