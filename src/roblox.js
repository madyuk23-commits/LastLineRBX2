// src/roblox.js
// Обёртка над Roblox Open Cloud Datastore API + поиск игроков по нику/ID.
// Требует переменные окружения: ROBLOX_API_KEY, ROBLOX_UNIVERSE_ID

const crypto = require('crypto');

const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;
const UNIVERSE_ID = process.env.ROBLOX_UNIVERSE_ID;

const BASE_URL = `https://apis.roblox.com/datastores/v1/universes/${UNIVERSE_ID}/standard-datastores/datastore/entries/entry`;

if (!ROBLOX_API_KEY || !UNIVERSE_ID) {
  console.warn('[roblox.js] ВНИМАНИЕ: ROBLOX_API_KEY или ROBLOX_UNIVERSE_ID не заданы в переменных окружения. Команды бота не смогут обращаться к DataStore.');
}

/**
 * Определяет UserId по нику или по уже числовому ID.
 */
async function resolveUserId(input) {
  const trimmed = String(input).trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  const res = await fetch('https://users.roblox.com/v1/usernames/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [trimmed], excludeBannedUsers: false }),
  });
  if (!res.ok) {
    throw new Error(`Roblox Users API вернул ошибку: ${res.status}`);
  }
  const data = await res.json();
  if (!data.data || data.data.length === 0) {
    return null;
  }
  return data.data[0].id;
}

/**
 * Возвращает текущий ник игрока по UserId.
 */
async function getUsername(userId) {
  const res = await fetch(`https://users.roblox.com/v1/users/${userId}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.name;
}

/**
 * Читает значение ключа из DataStore. Возвращает null, если ключ не найден.
 */
async function dataStoreGet(datastoreName, key) {
  const url = `${BASE_URL}?datastoreName=${encodeURIComponent(datastoreName)}&entryKey=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    headers: { 'x-api-key': ROBLOX_API_KEY },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`DataStore GET (${datastoreName}/${key}) failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Записывает значение по ключу в DataStore (создаёт или перезаписывает).
 */
async function dataStoreSet(datastoreName, key, value) {
  const body = JSON.stringify(value);
  const md5 = crypto.createHash('md5').update(body).digest('base64');
  const url = `${BASE_URL}?datastoreName=${encodeURIComponent(datastoreName)}&entryKey=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': ROBLOX_API_KEY,
      'content-type': 'application/json',
      'content-md5': md5,
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`DataStore SET (${datastoreName}/${key}) failed: ${res.status} ${text}`);
  }
  return true;
}

/**
 * Удаляет ключ из DataStore.
 */
async function dataStoreDelete(datastoreName, key) {
  const url = `${BASE_URL}?datastoreName=${encodeURIComponent(datastoreName)}&entryKey=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'x-api-key': ROBLOX_API_KEY },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '');
    throw new Error(`DataStore DELETE (${datastoreName}/${key}) failed: ${res.status} ${text}`);
  }
  return true;
}

module.exports = {
  resolveUserId,
  getUsername,
  dataStoreGet,
  dataStoreSet,
  dataStoreDelete,
};
