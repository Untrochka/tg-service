'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseTransactionMessage, parseAmount } = require('./parser');

test('parses a full expense message: sign, amount, currency, merchant, card, date, balance', () => {
  const result = parseTransactionMessage(`💸 Оплата
➖ 300.875,00 UZS
📍 Coffee Point
💳 HUMOCARD *0000
🕓 17:34 03.08.2026
💰 3.402.895,83 UZS`);

  assert.equal(result.title, 'Оплата');
  assert.equal(result.sign, '-');
  assert.equal(result.amount, 300875);
  assert.equal(result.currency, 'UZS');
  assert.equal(result.merchant, 'Coffee Point');
  assert.equal(result.cardLast4, '0000');
  assert.deepEqual(result.dateTime, { hour: 17, minute: 34, day: 3, month: 8, year: 2026 });
  assert.equal(result.balance, 3402895.83);
  assert.equal(result.type, 'Расход');
});

test('an incoming transfer is typed as income', () => {
  const result = parseTransactionMessage(`💰 Пополнение
➕ 500.000,00 UZS
💳 UZCARD *1111`);
  assert.equal(result.sign, '+');
  assert.equal(result.type, 'Доход');
});

test('a message whose title mentions "перевод" is typed as a transfer regardless of sign', () => {
  const incoming = parseTransactionMessage(`Перевод от клиента\n➕ 100.000,00 UZS`);
  const outgoing = parseTransactionMessage(`Перевод клиенту\n➖ 100.000,00 UZS`);
  assert.equal(incoming.type, 'Перевод');
  assert.equal(outgoing.type, 'Перевод');
});

test('returns null for messages with no amount line — not every message is a transaction', () => {
  assert.equal(parseTransactionMessage('Добро пожаловать в приложение банка!'), null);
  assert.equal(parseTransactionMessage(''), null);
  assert.equal(parseTransactionMessage(null), null);
  assert.equal(parseTransactionMessage('Одна строка'), null); // < 2 lines
});

test('parseAmount handles "." as a thousands separator and "," as the decimal point', () => {
  assert.equal(parseAmount('300.875,00'), 300875);
  assert.equal(parseAmount('3.402.895,83'), 3402895.83);
  assert.equal(parseAmount('not a number'), null);
});
