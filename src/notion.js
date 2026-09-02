'use strict';

const { Client } = require('@notionhq/client');
const config = require('./config');

const notion = new Client({ auth: config.NOTION_TOKEN });

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatNumber(n) {
  return new Intl.NumberFormat('ru-RU').format(n);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 429/5xx on Notion usually clear up within seconds. Without a retry, a
// transaction that already left Telegram would just be lost forever — the
// listener only reacts to new events, it never replays old messages.
function isTransient(err) {
  const status = err?.status;
  if (status === 429) return true;
  if (typeof status === 'number' && status >= 500) return true;
  return err?.code === 'ECONNRESET' || err?.code === 'ETIMEDOUT' || err?.code === 'service_unavailable';
}

async function createPage(params, attempt = 0) {
  try {
    return await notion.pages.create(params);
  } catch (err) {
    if (isTransient(err) && attempt < 1) {
      await sleep(1000 * 2 ** attempt);
      return createPage(params, attempt + 1);
    }
    throw err;
  }
}

/**
 * Creates an operation page in the "🧾 Операции" database from a parsed message.
 */
async function createOperation(parsed) {
  const isoDate = parsed.dateTime
    ? `${parsed.dateTime.year}-${pad(parsed.dateTime.month)}-${pad(parsed.dateTime.day)}`
    : new Date().toISOString().slice(0, 10);

  const accountId = (parsed.cardLast4 && config.CARD_TO_ACCOUNT[parsed.cardLast4]) || config.DEFAULT_ACCOUNT_ID;

  const title = parsed.merchant ? `${parsed.title} — ${parsed.merchant}` : parsed.title;

  const commentParts = [];
  if (parsed.merchant) commentParts.push(`Место: ${parsed.merchant}`);
  if (parsed.cardRaw) commentParts.push(`Карта: ${parsed.cardRaw}`);
  if (parsed.dateTime) {
    commentParts.push(
      `Время: ${pad(parsed.dateTime.hour)}:${pad(parsed.dateTime.minute)} ${pad(parsed.dateTime.day)}.${pad(parsed.dateTime.month)}.${parsed.dateTime.year}`
    );
  }
  if (parsed.balance != null) {
    commentParts.push(`Баланс после операции: ${formatNumber(parsed.balance)} ${parsed.balanceCurrency || parsed.currency}`);
  }

  const properties = {
    'Название': {
      title: [{ text: { content: title.slice(0, 200) } }],
    },
    'Дата': {
      date: { start: isoDate },
    },
    'Тип': {
      select: { name: parsed.type },
    },
    'Сумма': {
      number: parsed.amount,
    },
    'Валюта': {
      select: { name: parsed.currency },
    },
    'Комментарий': {
      rich_text: [{ text: { content: commentParts.join(' | ').slice(0, 2000) } }],
    },
  };

  if (accountId) {
    properties['Счёт'] = { relation: [{ id: accountId }] };
  }

  return createPage({
    parent: { database_id: config.NOTION_OPERATIONS_DATABASE_ID },
    properties,
  });
}

module.exports = { createOperation };
