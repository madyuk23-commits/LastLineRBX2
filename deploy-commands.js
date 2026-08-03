// deploy-commands.js
// Запускается ОДИН РАЗ локально (или при каждом изменении списка команд):
//   node deploy-commands.js
// Регистрирует слэш-команды в Discord. Требует .env с DISCORD_TOKEN,
// DISCORD_CLIENT_ID и (опционально) DISCORD_GUILD_ID.

require('dotenv').config();
const { REST, Routes } = require('discord.js');
const commands = require('./src/commands');

const body = commands.map((c) => c.data.toJSON());

if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CLIENT_ID) {
  console.error('ОШИБКА: DISCORD_TOKEN и/или DISCORD_CLIENT_ID не заданы в .env');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Регистрирую ${body.length} слэш-команд: ${body.map((c) => c.name).join(', ')}`);

    if (process.env.DISCORD_GUILD_ID) {
      // Регистрация только на одном сервере — команды появляются МГНОВЕННО.
      // Рекомендуется на время тестирования.
      await rest.put(Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID), {
        body,
      });
      console.log('Готово! Команды зарегистрированы для указанной гильдии (DISCORD_GUILD_ID).');
    } else {
      // Глобальная регистрация — команды появятся на ВСЕХ серверах бота,
      // но обновление может занять до 1 часа.
      await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body });
      console.log('Готово! Команды зарегистрированы глобально (может занять до 1 часа).');
    }
  } catch (error) {
    console.error('Не удалось зарегистрировать команды:', error);
    process.exit(1);
  }
})();
