require('dotenv').config();

function parseCardMap(raw) {
  const map = {};
  if (!raw) return map;
  raw.split(',').forEach((pair) => {
    const [card, id] = pair.split(':').map((s) => s && s.trim());
    if (card && id) map[card] = id;
  });
  return map;
}

const config = {
  TELEGRAM_API_ID: parseInt(process.env.TELEGRAM_API_ID, 10),
  TELEGRAM_API_HASH: process.env.TELEGRAM_API_HASH,
  TELEGRAM_SESSION: process.env.TELEGRAM_SESSION || '',
  TARGET_CHAT: process.env.TARGET_CHAT,

  NOTION_TOKEN: process.env.NOTION_TOKEN,
  NOTION_OPERATIONS_DATABASE_ID: (process.env.NOTION_OPERATIONS_DATABASE_ID || '').replace(/-/g, ''),

  CARD_TO_ACCOUNT: parseCardMap(process.env.CARD_TO_ACCOUNT),
  DEFAULT_ACCOUNT_ID: process.env.DEFAULT_ACCOUNT_ID || null,
};

function validate() {
  const missing = [];
  if (!config.TELEGRAM_API_ID) missing.push('TELEGRAM_API_ID');
  if (!config.TELEGRAM_API_HASH) missing.push('TELEGRAM_API_HASH');
  if (!config.NOTION_TOKEN) missing.push('NOTION_TOKEN');
  if (!config.NOTION_OPERATIONS_DATABASE_ID) missing.push('NOTION_OPERATIONS_DATABASE_ID');
  if (!config.TARGET_CHAT) missing.push('TARGET_CHAT');
  if (missing.length) {
    console.error('❌ Missing variables in .env:', missing.join(', '));
    process.exit(1);
  }
}

module.exports = { ...config, validate };
