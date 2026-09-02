'use strict';

require('dotenv').config();
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

const apiId = parseInt(process.env.TELEGRAM_API_ID, 10);
const apiHash = process.env.TELEGRAM_API_HASH;
const sessionStr = process.env.TELEGRAM_SESSION;

if (!sessionStr) {
  console.error('❌ Run this first: npm run login');
  process.exit(1);
}

(async () => {
  const client = new TelegramClient(new StringSession(sessionStr), apiId, apiHash, {
    connectionRetries: 5,
  });
  await client.connect();

  console.log('📋 Your chats/channels (find the right one and copy its ID or @username into TARGET_CHAT):\n');

  const dialogs = await client.getDialogs({ limit: 100 });
  for (const d of dialogs) {
    const entity = d.entity;
    const username = entity?.username ? `@${entity.username}` : '(no username)';
    const id = entity?.id ? entity.id.toString() : '?';
    const type = d.isChannel ? 'channel' : d.isGroup ? 'group' : d.isUser ? 'user/bot' : '?';
    console.log(`[${type}] ${d.title || d.name || '(untitled)'} | id: ${id} | ${username}`);
  }

  await client.disconnect();
  process.exit(0);
})();
