// index.js
require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const commands = require('./src/commands');

// ------------------------------------------------------------------
// Мини HTTP-сервер. Render (бесплатный план) требует, чтобы сервис
// слушал порт — иначе считает деплой неуспешным / "засыпает" его.
// ------------------------------------------------------------------
const app = express();
app.get('/', (req, res) => {
  res.send('✅ Discord admin bot работает.');
});
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`[HTTP] Healthcheck-сервер запущен на порту ${port}`);
});

// ------------------------------------------------------------------
// Discord-клиент
// ------------------------------------------------------------------
if (!process.env.DISCORD_TOKEN) {
  console.error('[Discord] ОШИБКА: переменная окружения DISCORD_TOKEN не задана. Бот не может запуститься.');
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();
for (const command of commands) {
  client.commands.set(command.data.name, command);
}

client.once('ready', () => {
  console.log(`[Discord] Успешно вошёл как ${client.user.tag}`);
  console.log(`[Discord] Загружено команд: ${client.commands.size}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`[Discord] Ошибка при выполнении команды /${interaction.commandName}:`, error);
    const errPayload = { content: '❌ Произошла ошибка при выполнении команды. Проверь логи бота на Render.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(errPayload).catch(() => {});
    } else {
      await interaction.reply(errPayload).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
