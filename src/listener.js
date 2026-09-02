'use strict';

const fs = require('fs');
const path = require('path');

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');

const config = require('./config');
const { parseTransactionMessage } = require('./parser');
const { createOperation } = require('./notion');

config.validate();

const STATE_FILE = path.join(__dirname, '..', 'data', 'state.json');

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function main() {
  const session = new StringSession(config.TELEGRAM_SESSION);
  const client = new TelegramClient(session, config.TELEGRAM_API_ID, config.TELEGRAM_API_HASH, {
    connectionRetries: 20,
    retryDelay: 2000,
  });

  await client.connect();
  console.log(`✅ Connected to Telegram. Listening on: ${config.TARGET_CHAT}`);

  const state = loadState();

  client.addEventHandler(async (event) => {
    try {
      const message = event.message;
      if (!message || !message.message) return;

      const chatKey = String(message.chatId || 'default');
      const lastId = state[chatKey] || 0;

      // Guards against reprocessing the same message after a restart.
      if (message.id <= lastId) return;

      const parsed = parseTransactionMessage(message.message);

      if (!parsed) {
        console.log(`⏭️  Skipped (doesn't look like a transaction): "${message.message.slice(0, 60).replace(/\n/g, ' ')}"`);
        // Math.max, not a plain assignment — if messages get processed out of
        // order (one went into a Notion retry, a neighbor finished faster),
        // this must not roll state back and cause already-done work to repeat.
        state[chatKey] = Math.max(state[chatKey] || 0, message.id);
        saveState(state);
        return;
      }

      const page = await createOperation(parsed);
      console.log(
        `✅ [${parsed.type}] ${parsed.title}${parsed.merchant ? ' — ' + parsed.merchant : ''}: ${parsed.sign}${parsed.amount} ${parsed.currency} -> ${page.url}`
      );

      state[chatKey] = Math.max(state[chatKey] || 0, message.id); // see comment above
      saveState(state);
    } catch (err) {
      console.error('❌ Error processing message:', err.message || err);
    }
  }, new NewMessage({ chats: [config.TARGET_CHAT] }));

  console.log('👂 Service started and listening for new messages. Ctrl+C to stop.');
}

main().catch((err) => {
  console.error('❌ Fatal startup error:', err);
  process.exit(1);
});
