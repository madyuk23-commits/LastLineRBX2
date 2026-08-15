// src/commands.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { resolveUserId, getUsername, dataStoreGet, dataStoreSet, dataStoreDelete } = require('./roblox');
const {
  RANK_COLORS,
  COLOR_ERROR,
  COLOR_SUCCESS,
  COLOR_INFO,
  COLOR_NEUTRAL,
  errorEmbed,
  successEmbed,
  playerThumbnail,
} = require('./embeds');

// Названия DataStore должны СОВПАДАТЬ с теми, что использует AdminServer.lua в игре
const RANKS_DATASTORE = 'AdminPanel_DynamicRanks';
const BANS_DATASTORE = 'AdminPanel_BannedUsers';
const LINKS_DATASTORE = 'AdminPanel_DiscordLinks';

const RANK_CHOICES = [
  { name: 'Модератор', value: 'Модератор' },
  { name: 'Администратор', value: 'Администратор' },
  { name: 'Ст.Администратор', value: 'Ст.Администратор' },
  { name: 'Разработчик', value: 'Разработчик' },
  { name: 'Лидер', value: 'Лидер' },
];

// Если задана роль DISCORD_ALLOWED_ROLE_ID — только она (или Administrator) может пользоваться командами.
// Если переменная не задана — доступ открыт всем (НЕ рекомендуется для боевого сервера).
function hasBotPermission(interaction) {
  const allowedRoleId = process.env.DISCORD_ALLOWED_ROLE_ID;
  if (!allowedRoleId) return true;
  if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return interaction.member.roles.cache.has(allowedRoleId);
}

async function resolveUserOrReplyError(interaction, input) {
  const userId = await resolveUserId(input);
  if (!userId) {
    await interaction.editReply({ embeds: [errorEmbed(`Игрок Roblox \`${input}\` не найден.`)] });
    return null;
  }
  return userId;
}

const commands = [
  // ------------------------------------------------------------------
  // /rank-give
  // ------------------------------------------------------------------
  {
    data: new SlashCommandBuilder()
      .setName('rank-give')
      .setDescription('Выдать ранг администрации игроку Roblox')
      .addStringOption((opt) => opt.setName('user').setDescription('Roblox ID или ник').setRequired(true))
      .addStringOption((opt) =>
        opt.setName('rank').setDescription('Ранг').setRequired(true).addChoices(...RANK_CHOICES)
      ),
    async execute(interaction) {
      if (!hasBotPermission(interaction)) {
        return interaction.reply({ embeds: [errorEmbed('У вас нет прав на использование этой команды.')], ephemeral: true });
      }
      await interaction.deferReply();
      const input = interaction.options.getString('user');
      const rank = interaction.options.getString('rank');

      const userId = await resolveUserOrReplyError(interaction, input);
      if (!userId) return;

      const username = (await getUsername(userId)) || input;
      await dataStoreSet(RANKS_DATASTORE, String(userId), rank);

      const embed = successEmbed(
        '✅ Ранг выдан',
        `**Игрок:** ${username} (\`${userId}\`)\n**Новый ранг:** ${rank}\n\nРанг вступит в силу при следующем входе игрока в игру (или сразу, если он уже онлайн и панель переоткрыта).`,
        RANK_COLORS[rank]
      );
      embed.setThumbnail(playerThumbnail(userId));
      return interaction.editReply({ embeds: [embed] });
    },
  },

  // ------------------------------------------------------------------
  // /rank-remove
  // ------------------------------------------------------------------
  {
    data: new SlashCommandBuilder()
      .setName('rank-remove')
      .setDescription('Снять ранг администрации с игрока Roblox')
      .addStringOption((opt) => opt.setName('user').setDescription('Roblox ID или ник').setRequired(true)),
    async execute(interaction) {
      if (!hasBotPermission(interaction)) {
        return interaction.reply({ embeds: [errorEmbed('У вас нет прав на использование этой команды.')], ephemeral: true });
      }
      await interaction.deferReply();
      const input = interaction.options.getString('user');

      const userId = await resolveUserOrReplyError(interaction, input);
      if (!userId) return;

      const username = (await getUsername(userId)) || input;
      await dataStoreSet(RANKS_DATASTORE, String(userId), '');

      const embed = successEmbed(
        '✅ Ранг снят',
        `**Игрок:** ${username} (\`${userId}\`)\n\nРанг будет снят при следующем входе игрока в игру.\n\n_Если у игрока ранг вписан вручную в таблицу RANKS в AdminServer.lua — его нужно убрать отдельно в Studio, эта команда влияет только на ранги, выданные через бота._`,
        COLOR_NEUTRAL
      );
      embed.setThumbnail(playerThumbnail(userId));
      return interaction.editReply({ embeds: [embed] });
    },
  },

  // ------------------------------------------------------------------
  // /rank-check
  // ------------------------------------------------------------------
  {
    data: new SlashCommandBuilder()
      .setName('rank-check')
      .setDescription('Проверить ранг игрока Roblox')
      .addStringOption((opt) => opt.setName('user').setDescription('Roblox ID или ник').setRequired(true)),
    async execute(interaction) {
      await interaction.deferReply();
      const input = interaction.options.getString('user');

      const userId = await resolveUserOrReplyError(interaction, input);
      if (!userId) return;

      const username = (await getUsername(userId)) || input;
      const rank = await dataStoreGet(RANKS_DATASTORE, String(userId));
      const cleanRank = rank && rank !== '' ? rank : null;

      const embed = new EmbedBuilder()
        .setColor(cleanRank ? RANK_COLORS[cleanRank] : COLOR_NEUTRAL)
        .setTitle('🔎 Проверка ранга')
        .setThumbnail(playerThumbnail(userId))
        .setDescription(
          `**Игрок:** ${username} (\`${userId}\`)\n**Ранг:** ${cleanRank || 'нет ранга, выданного через бота (возможно, вписан вручную в скрипт)'}`
        )
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    },
  },

  // ------------------------------------------------------------------
  // /blacklist-add
  // ------------------------------------------------------------------
  {
    data: new SlashCommandBuilder()
      .setName('blacklist-add')
      .setDescription('Добавить игрока в чёрный список (игра + Discord-сервер при наличии привязки)')
      .addStringOption((opt) => opt.setName('user').setDescription('Roblox ID или ник').setRequired(true))
      .addStringOption((opt) => opt.setName('reason').setDescription('Причина').setRequired(true))
      .addIntegerOption((opt) =>
        opt.setName('duration_minutes').setDescription('Срок в минутах (не указывать = навсегда)').setRequired(false)
      ),
    async execute(interaction) {
      if (!hasBotPermission(interaction)) {
        return interaction.reply({ embeds: [errorEmbed('У вас нет прав на использование этой команды.')], ephemeral: true });
      }
      await interaction.deferReply();
      const input = interaction.options.getString('user');
      const reason = interaction.options.getString('reason');
      const durationMinutes = interaction.options.getInteger('duration_minutes') || 0;

      const userId = await resolveUserOrReplyError(interaction, input);
      if (!userId) return;

      const username = (await getUsername(userId)) || input;
      const untilTime = durationMinutes > 0 ? Math.floor(Date.now() / 1000) + durationMinutes * 60 : null;

      // Формат ДОЛЖЕН совпадать с тем, что читает AdminServer.lua (Reason / Until)
      await dataStoreSet(BANS_DATASTORE, String(userId), { Reason: reason, Until: untilTime });

      let discordStatus = '_Discord-аккаунт не привязан (`/link`) — забанен только в игре._';
      try {
        const link = await dataStoreGet(LINKS_DATASTORE, String(userId));
        if (link && link.discordId && interaction.guild) {
          await interaction.guild.members.ban(link.discordId, { reason: `[Roblox ЧС] ${reason}` });
          discordStatus = `✅ Также забанен на этом Discord-сервере (<@${link.discordId}>).`;
        }
      } catch (e) {
        discordStatus = `⚠️ Не удалось забанить в Discord: ${e.message}`;
      }

      const embed = successEmbed(
        '⛔ Игрок добавлен в чёрный список',
        `**Игрок:** ${username} (\`${userId}\`)\n**Причина:** ${reason}\n**Срок:** ${
          durationMinutes > 0 ? durationMinutes + ' мин.' : 'навсегда'
        }\n\n${discordStatus}`,
        COLOR_ERROR
      );
      embed.setThumbnail(playerThumbnail(userId));
      return interaction.editReply({ embeds: [embed] });
    },
  },

  // ------------------------------------------------------------------
  // /blacklist-remove
  // ------------------------------------------------------------------
  {
    data: new SlashCommandBuilder()
      .setName('blacklist-remove')
      .setDescription('Убрать игрока из чёрного списка')
      .addStringOption((opt) => opt.setName('user').setDescription('Roblox ID или ник').setRequired(true)),
    async execute(interaction) {
      if (!hasBotPermission(interaction)) {
        return interaction.reply({ embeds: [errorEmbed('У вас нет прав на использование этой команды.')], ephemeral: true });
      }
      await interaction.deferReply();
      const input = interaction.options.getString('user');

      const userId = await resolveUserOrReplyError(interaction, input);
      if (!userId) return;

      const username = (await getUsername(userId)) || input;
      await dataStoreDelete(BANS_DATASTORE, String(userId));

      let discordStatus = '';
      try {
        const link = await dataStoreGet(LINKS_DATASTORE, String(userId));
        if (link && link.discordId && interaction.guild) {
          await interaction.guild.members.unban(link.discordId, 'Снятие ЧС через бота');
          discordStatus = '\n✅ Также разбанен на этом Discord-сервере.';
        }
      } catch (e) {
        // не был забанен в Discord — это нормально, ничего не делаем
      }

      const embed = successEmbed('✅ Игрок убран из чёрного списка', `**Игрок:** ${username} (\`${userId}\`)${discordStatus}`, COLOR_SUCCESS);
      embed.setThumbnail(playerThumbnail(userId));
      return interaction.editReply({ embeds: [embed] });
    },
  },

  // ------------------------------------------------------------------
  // /blacklist-check
  // ------------------------------------------------------------------
  {
    data: new SlashCommandBuilder()
      .setName('blacklist-check')
      .setDescription('Проверить, находится ли игрок в чёрном списке')
      .addStringOption((opt) => opt.setName('user').setDescription('Roblox ID или ник').setRequired(true)),
    async execute(interaction) {
      await interaction.deferReply();
      const input = interaction.options.getString('user');

      const userId = await resolveUserOrReplyError(interaction, input);
      if (!userId) return;

      const username = (await getUsername(userId)) || input;
      const ban = await dataStoreGet(BANS_DATASTORE, String(userId));

      let embed;
      const expired = ban && ban.Until && ban.Until < Math.floor(Date.now() / 1000);
      if (!ban || expired) {
        embed = successEmbed('✅ Чисто', `**Игрок:** ${username} (\`${userId}\`)\nВ чёрном списке не найден${expired ? ' (срок предыдущего бана истёк)' : ''}.`, COLOR_SUCCESS);
      } else {
        const untilText = ban.Until ? `до <t:${ban.Until}:F>` : 'навсегда';
        embed = new EmbedBuilder()
          .setColor(COLOR_ERROR)
          .setTitle('⛔ В чёрном списке')
          .setDescription(`**Игрок:** ${username} (\`${userId}\`)\n**Причина:** ${ban.Reason || 'не указана'}\n**Срок:** ${untilText}`)
          .setTimestamp();
      }
      embed.setThumbnail(playerThumbnail(userId));
      return interaction.editReply({ embeds: [embed] });
    },
  },

  // ------------------------------------------------------------------
  // /link — привязка Roblox-аккаунта к Discord (для кросс-бана)
  // ------------------------------------------------------------------
  {
    data: new SlashCommandBuilder()
      .setName('link')
      .setDescription('Привязать свой Roblox-аккаунт к Discord (для синхронизации банов)')
      .addStringOption((opt) => opt.setName('user').setDescription('Ваш Roblox ID или ник').setRequired(true)),
    async execute(interaction) {
      await interaction.deferReply({ ephemeral: true });
      const input = interaction.options.getString('user');

      const userId = await resolveUserOrReplyError(interaction, input);
      if (!userId) return;

      const username = (await getUsername(userId)) || input;
      await dataStoreSet(LINKS_DATASTORE, String(userId), { discordId: interaction.user.id });

      const embed = successEmbed(
        '🔗 Аккаунт привязан',
        `Discord <@${interaction.user.id}> привязан к Roblox-аккаунту **${username}** (\`${userId}\`).\n\nТеперь при бане этого Roblox-аккаунта через \`/blacklist-add\` вы автоматически будете забанены и на этом Discord-сервере.`,
        COLOR_INFO
      );
      embed.setThumbnail(playerThumbnail(userId));
      return interaction.editReply({ embeds: [embed] });
    },
  },
];

module.exports = commands;
