const { MessageEmbed } = require("discord.js");
const User = require("../../../model/user.js")
const functions = require("../../../structs/functions.js");

module.exports = {
    commandInfo: {
        name: "create",
        description: "Creates an account",
        options: [
            {
                name: "email",
                description: "Your email.",
                required: true,
                type: 3
            },
            {
                name: "password",
                description: "Your password.",
                required: true,
                type: 3
            }
        ],
    },
    execute: async (interaction) => {
        await interaction.deferReply({ ephemeral: true });

        const { options } = interaction;

        const discordId = interaction.user.id;
        const email = options.get("email").value;
        const username = interaction.user.username;
        const password = options.get("password").value;

        const plainEmail = options.get('email').value;
        const plainUsername = interaction.user.username;

        const existingEmail = await User.findOne({ email: plainEmail });
        const existingUser = await User.findOne({ username: plainUsername });

        if (existingUser) {
            return interaction.editReply({ content: "Username already exists. Please choose a different one.", ephemeral: true });
        }
        if (password.length >= 128) {
            return interaction.editReply({ content: "Your password must be less than 128 characters long.", ephemeral: true });
        }
        if (password.length < 4) {
            return interaction.editReply({ content: "Your password must be at least 4 characters long.", ephemeral: true });
        }

        await functions.registerUser(discordId, username, email, password).then(resp => {
            let embed = new MessageEmbed()
            .setColor(resp.status >= 400 ? "#ff0000" : "#56ff00")
            .setThumbnail(interaction.user.avatarURL({ format: 'png', dynamic: true, size: 256 }))
            .addFields({
                name: "Message",
                value: "Successfully created an account.",
            }, {
                name: "Username",
                value: username,
            }, {
                name: "Email",
                value: email,
            })
            .setTimestamp()


            if (resp.status >= 400) return interaction.editReply({ embeds: [embed], ephemeral: true });

            interaction.editReply({ embeds: [embed], ephemeral: true });
        });
    }
}
