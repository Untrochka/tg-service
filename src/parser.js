'use strict';

// A line like "➖ 300.875,00 UZS" or "➕ 1.200.000,00 UZS"
const AMOUNT_LINE_RE = /^([➕➖+\-])\s*([\d\s.,]+)\s*([A-Za-zА-Яа-я']{2,6})\s*$/u;

// The balance line, no sign, e.g. "💰 3.402.895,83 UZS" (the leading emoji is stripped separately)
const BALANCE_LINE_RE = /^([\d\s.,]+)\s*([A-Za-zА-Яа-я']{2,6})\s*$/u;

// A line like "17:34 03.08.2026" (the clock emoji is ignored — there are too many variants of it)
const TIME_LINE_RE = /(\d{1,2}):(\d{2})\D+(\d{2})\.(\d{2})\.(\d{4})/;

// A line like "HUMOCARD *0000" / "💳 UZCARD *1234"
const CARD_LINE_RE = /\*\s?(\d{4})/;

function stripLeadingSymbols(line) {
  // Strips leading emoji/punctuation, keeps letters and digits.
  return line.replace(/^[^\p{L}\p{N}]+/u, '').trim();
}

function parseAmount(str) {
  // "300.875,00" -> 300875.00 ; "3 402 895,83" -> 3402895.83
  const cleaned = str.replace(/\s/g, '');
  const normalized = cleaned.replace(/\./g, '').replace(',', '.');
  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * Parses a bank bot's message text into a structured object.
 * Returns null if the message doesn't look like a transaction (e.g. an ad or a service message).
 */
function parseTransactionMessage(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return null;

  const result = {
    title: null,
    sign: null, // '+' | '-'
    amount: null,
    currency: null,
    merchant: null,
    cardLast4: null,
    cardRaw: null,
    dateTime: null, // { year, month, day, hour, minute }
    balance: null,
    balanceCurrency: null,
    raw: rawText,
  };

  let amountLineIdx = -1;
  let balanceLineIdx = -1;

  // 1) First look for the signed amount line (➖/➕)
  lines.forEach((line, idx) => {
    if (amountLineIdx !== -1) return;
    const m = line.match(AMOUNT_LINE_RE);
    if (!m) return;
    amountLineIdx = idx;
    result.sign = m[1] === '➕' || m[1] === '+' ? '+' : '-';
    result.amount = parseAmount(m[2]);
    result.currency = m[3].toUpperCase();
  });

  // No amount at all means it's not a transaction (an ad, a service message, etc.)
  if (result.amount == null) return null;

  // 2) Then look for the balance line — an unsigned number, usually the last line
  lines.forEach((line, idx) => {
    if (idx === amountLineIdx || balanceLineIdx !== -1) return;
    const bm = stripLeadingSymbols(line).match(BALANCE_LINE_RE) || line.match(BALANCE_LINE_RE);
    if (bm) {
      balanceLineIdx = idx;
      result.balance = parseAmount(bm[1]);
      result.balanceCurrency = bm[2].toUpperCase();
    }
  });

  // Title — the first line with the emoji stripped ("Оплата", "Пополнение", ...)
  result.title = stripLeadingSymbols(lines[0]) || lines[0];

  // Time/date
  for (const line of lines) {
    const tm = line.match(TIME_LINE_RE);
    if (tm) {
      const [, hh, mm, dd, mo, yyyy] = tm;
      result.dateTime = {
        hour: Number(hh),
        minute: Number(mm),
        day: Number(dd),
        month: Number(mo),
        year: Number(yyyy),
      };
      break;
    }
  }

  // Card
  for (const line of lines) {
    const cm = line.match(CARD_LINE_RE);
    if (cm) {
      result.cardLast4 = cm[1];
      result.cardRaw = stripLeadingSymbols(line);
      break;
    }
  }

  // Merchant — the first "leftover" line (not the title, amount, card, or time)
  for (let idx = 0; idx < lines.length; idx++) {
    if (idx === 0 || idx === amountLineIdx || idx === balanceLineIdx) continue;
    const line = lines[idx];
    if (CARD_LINE_RE.test(line)) continue;
    if (TIME_LINE_RE.test(line)) continue;
    result.merchant = stripLeadingSymbols(line);
    break;
  }

  // Operation type from sign + keywords (in case a message doesn't follow the usual shape)
  const lowerTitle = result.title.toLowerCase();
  if (result.sign === '-') {
    result.type = /перевод/.test(lowerTitle) ? 'Перевод' : 'Расход';
  } else {
    result.type = /перевод/.test(lowerTitle) ? 'Перевод' : 'Доход';
  }

  return result;
}

module.exports = { parseTransactionMessage, parseAmount };
