// src/embeds.js
const { EmbedBuilder } = require('discord.js');

const RANK_COLORS = {
  'Модератор': 0x00c8ff,        // голубой
  'Администратор': 0x1eff5a,    // ярко-зелёный
  'Ст.Администратор': 0x6e14a0, // тёмно-фиолетовый
  'Разработчик': 0xff1e1e,      // красный
  'Лидер': 0xffc800,            // жёлто-чёрный (Discord embed не поддерживает градиент — берём жёлтый как основной)
};

const COLOR_SUCCESS = 0x2ecc71;
const COLOR_ERROR = 0xff3355;
const COLOR_INFO = 0x5865f2;
const COLOR_NEUTRAL = 0x555555;

function errorEmbed(text) {
  return new EmbedBuilder().setColor(COLOR_ERROR).setDescription(`❌ ${text}`);
}

function successEmbed(title, description, color) {
  return new EmbedBuilder()
    .setColor(color || COLOR_SUCCESS)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

function playerThumbnail(userId) {
  return `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`;
}

module.exports = {
  RANK_COLORS,
  COLOR_SUCCESS,
  COLOR_ERROR,
  COLOR_INFO,
  COLOR_NEUTRAL,
  errorEmbed,
  successEmbed,
  playerThumbnail,
};
