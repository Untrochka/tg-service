const { parseTransactionMessage } = require('./parser');

// Synthetic example, not a real transaction. Paste in an actual message from
// your bank here (just copy the text from Telegram) to check that the parser
// understands its specific format — banks lay out their notifications differently.
const sample = `💸 Оплата
➖ 45.000,00 UZS
📍 Coffee Point
💳 HUMOCARD *0000
🕓 12:00 01.01.2026
💰 1.000.000,00 UZS`;

console.log(JSON.stringify(parseTransactionMessage(sample), null, 2));
