const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, PresenceUpdateStatus } = require('discord.js');
const { GameDig } = require('gamedig');
const config = require('./config.json');

const bot = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

let lastMessageId = null;
let lastServerState = null;

bot.once('ready', async () => {
    console.log(`${bot.user.tag} is online!`);

    const guild = bot.guilds.cache.get(config.discord);
    const channel = guild?.channels.cache.get(config.channel);

    if (channel) {
        console.log("Clearing channel messages...");
        await clearChannel(channel);
    }

    bot.user.setStatus(PresenceUpdateStatus.Idle);

    const updateServerStatus = async () => {
        console.log("Querying server status...");

        try {
            const state = await GameDig.query({
                type: 'csgo',
                host: config.ipabs,
                port: parseInt(config.port),
            });

            console.log("Server query successful:", state);

            const currentState = {
                name: state.name,
                map: state.map,
                players: state.players.length,
                maxPlayers: state.maxplayers,
                playerDetails: state.players
                    .map(player => `${player.name || "Anonymous"}`)
                    .join('\n') || "No players connected.",
            };

            bot.user.setActivity(`${config.activity} - ${currentState.players}/${currentState.maxPlayers}`);

            if (!lastServerState || lastServerState.players !== currentState.players || lastServerState.map !== currentState.map) {
                console.log("Updating server status on Discord...");

                const embed = new EmbedBuilder()
                    .setTitle(currentState.name)
                    .addFields(
                        { name: 'Map', value: currentState.map, inline: true },
                        { name: 'Players', value: `${currentState.players}/${currentState.maxPlayers}`, inline: false },
                        { name: 'Details', value: `\`\`\`\n${currentState.playerDetails}\n\`\`\``, inline: false },
                    )
                    .setColor('Gold')
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel("Connect to Server")
                        .setStyle("Link")
                        .setURL(config.connectUrl)
                );

                if (lastMessageId) {
                    try {
                        const lastMessage = await channel.messages.fetch(lastMessageId);
                        await lastMessage.edit({ embeds: [embed], components: [row] });
                    } catch (err) {
                        console.error("Failed to edit message:", err);
                        const newMessage = await channel.send({ embeds: [embed], components: [row] });
                        lastMessageId = newMessage.id;
                    }
                } else {
                    const newMessage = await channel.send({ embeds: [embed], components: [row] });
                    lastMessageId = newMessage.id;
                }

                lastServerState = currentState;
            }
        } catch (error) {
            console.error("Server query failed:", error);

            const offlineEmbed = new EmbedBuilder()
                .setTitle("Server Offline")
                .setDescription("The server is currently offline or unreachable.")
                .setColor('Red')
                .setTimestamp();

            if (lastMessageId) {
                try {
                    const lastMessage = await channel.messages.fetch(lastMessageId);
                    await lastMessage.edit({ embeds: [offlineEmbed], components: [] });
                } catch (err) {
                    console.error("Failed to edit offline message:", err);
                    const newMessage = await channel.send({ embeds: [offlineEmbed] });
                    lastMessageId = newMessage.id;
                }
            } else {
                const newMessage = await channel.send({ embeds: [offlineEmbed] });
                lastMessageId = newMessage.id;
            }
        }
    };

    updateServerStatus();
    setInterval(updateServerStatus, 15000);
});

function formatTime(seconds) {
    if (!seconds) return "N/A";
    const minutes = Math.floor(seconds / 60);
    seconds = seconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

async function clearChannel(channel) {
    try {
        const messages = await channel.messages.fetch({ limit: 100 });
        for (const message of messages.values()) {
            await message.delete();
        }
    } catch (error) {
        console.error("Error clearing messages:", error);
    }
}

bot.login(config.token);
