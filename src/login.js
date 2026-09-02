'use strict';

require('dotenv').config();
const input = require('input');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

const apiId = parseInt(process.env.TELEGRAM_API_ID, 10);
const apiHash = process.env.TELEGRAM_API_HASH;

if (!apiId || !apiHash) {
  console.error('❌ Set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env before running this (get them at https://my.telegram.org)');
  process.exit(1);
}

(async () => {
  console.log('🔐 Logging in to Telegram (only needs to be done once)...\n');

  const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text('Phone number (with country code, e.g. +998...): '),
    password: async () => await input.text('Two-factor password (if enabled, otherwise just press Enter): '),
    phoneCode: async () => await input.text('Code from Telegram (sent to the app itself): '),
    onError: (err) => console.error(err),
  });

  console.log('\n✅ Logged in successfully!\n');
  const session = client.session.save();

  console.log('Copy this string into .env as TELEGRAM_SESSION:\n');
  console.log(session);
  console.log('\n⚠️  This is equivalent to your account password — never show it to anyone or commit it to git.');

  await client.disconnect();
  process.exit(0);
})();
