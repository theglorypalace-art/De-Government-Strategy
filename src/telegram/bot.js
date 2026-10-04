const TelegramBot = require('node-telegram-bot-api');
const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, DRY_RUN } = require('../config');
const { getConfig, applyLocal } = require('../live/liveConfig');
const whales = require('../whales/tracker');
const watchlist = require('../migration/watchlist');
const positions = require('../trading/positions');
const { getSolBalance, loadWallet } = require('../solana/wallet');

let bot;

function allowed(chatId) {
  if (!TELEGRAM_CHAT_ID) return true;
  return String(chatId) === String(TELEGRAM_CHAT_ID);
}

function statusText() {
  const c = getConfig();
  const open = positions.listOpen();
  return [
    DRY_RUN ? '🧪 DRY RUN' : '🔴 LIVE',
    c.paused ? '⏸ PAUSED' : '🟢 RUNNING',
    '',
    `Dip entry: −${c.dipEntryPct}% from peak`,
    `TP +${c.takeProfitPct}% · SL −${c.stopLossPct}% · hold ${c.maxHoldMin}m`,
    `Capital ${c.capitalPct}% (max ${c.maxPositionSol} SOL)`,
    `Whales need ≥${c.minWhaleAgreement} in ${c.whaleLookbackMin}m`,
    `Tracking ${whales.listWhales().length} wallets · watchlist ${watchlist.all().length}`,
    `Open: ${open.length}`,
  ].join('\n');
}

function start() {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('[telegram] disabled (no token)');
    return;
  }
  bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
  console.log('[telegram] polling');

  bot.onText(/\/(start|menu|status)/i, (msg) => {
    if (!allowed(msg.chat.id)) return;
    bot.sendMessage(msg.chat.id, statusText(), {
      reply_markup: {
        inline_keyboard: [
          [{ text: getConfig().paused ? '▶️ Start' : '⏸ Pause', callback_data: 'toggle_pause' }],
          [
            { text: '🐋 Whales', callback_data: 'whales' },
            { text: '👀 Watchlist', callback_data: 'watch' },
          ],
          [
            { text: '📈 Positions', callback_data: 'pos' },
            { text: '💼 Balance', callback_data: 'bal' },
          ],
        ],
      },
    });
  });

  bot.onText(/\/whales/i, (msg) => {
    if (!allowed(msg.chat.id)) return;
    const list = whales.listWhales();
    bot.sendMessage(
      msg.chat.id,
      list.length
        ? `Whales (${list.length}):\n` + list.map((w, i) => `${i + 1}. \`${w}\``).join('\n')
        : 'No WHALE_WALLETS in env.',
      { parse_mode: 'Markdown' }
    );
  });

  bot.onText(/\/setdip\s+(\d+)/i, (msg, m) => {
    if (!allowed(msg.chat.id)) return;
    applyLocal({ dipEntryPct: Number(m[1]) });
    bot.sendMessage(msg.chat.id, `Dip entry set to −${m[1]}%`);
  });
  bot.onText(/\/settp\s+(\d+)/i, (msg, m) => {
    if (!allowed(msg.chat.id)) return;
    applyLocal({ takeProfitPct: Number(m[1]) });
    bot.sendMessage(msg.chat.id, `TP +${m[1]}%`);
  });
  bot.onText(/\/setsl\s+(\d+)/i, (msg, m) => {
    if (!allowed(msg.chat.id)) return;
    applyLocal({ stopLossPct: Number(m[1]) });
    bot.sendMessage(msg.chat.id, `SL −${m[1]}%`);
  });
  bot.onText(/\/setwhales\s+(\d+)/i, (msg, m) => {
    if (!allowed(msg.chat.id)) return;
    applyLocal({ minWhaleAgreement: Number(m[1]) });
    bot.sendMessage(msg.chat.id, `Need ≥${m[1]} whales`);
  });
  bot.onText(/\/watch\s+(\S+)/i, (msg, m) => {
    if (!allowed(msg.chat.id)) return;
    watchlist.watch(m[1].trim(), { source: 'telegram' });
    bot.sendMessage(msg.chat.id, `Watching ${m[1].trim().slice(0, 12)}… for dip`);
  });
  bot.onText(/\/(pause|stoptrading)/i, (msg) => {
    if (!allowed(msg.chat.id)) return;
    applyLocal({ paused: true });
    bot.sendMessage(msg.chat.id, 'Paused');
  });
  bot.onText(/\/(resume|starttrading)/i, (msg) => {
    if (!allowed(msg.chat.id)) return;
    applyLocal({ paused: false });
    bot.sendMessage(msg.chat.id, 'Running');
  });

  bot.on('callback_query', async (q) => {
    if (!allowed(q.message.chat.id)) return;
    const id = q.data;
    if (id === 'toggle_pause') {
      const p = !getConfig().paused;
      applyLocal({ paused: p });
      bot.answerCallbackQuery(q.id, { text: p ? 'Paused' : 'Running' });
      bot.sendMessage(q.message.chat.id, statusText());
    } else if (id === 'whales') {
      bot.answerCallbackQuery(q.id);
      const list = whales.listWhales();
      bot.sendMessage(q.message.chat.id, `Whales: ${list.length}\nNeed ≥${getConfig().minWhaleAgreement}`);
    } else if (id === 'watch') {
      bot.answerCallbackQuery(q.id);
      const all = watchlist.all().slice(0, 15);
      bot.sendMessage(
        q.message.chat.id,
        all.length
          ? all.map((w) => `${w.mint.slice(0, 8)}… dip ${((w.dipPct || 0).toFixed?.(1)) || 0}% peak→now`).join('\n')
          : 'Watchlist empty — whales will add mints when they buy'
      );
    } else if (id === 'pos') {
      bot.answerCallbackQuery(q.id);
      const open = positions.listOpen();
      bot.sendMessage(
        q.message.chat.id,
        open.length
          ? open.map((p) => `${p.mint.slice(0, 8)} ${p.sizeSol} SOL pnl ${p.lastPnl?.toFixed?.(1) || '?'}%`).join('\n')
          : 'No open positions'
      );
    } else if (id === 'bal') {
      bot.answerCallbackQuery(q.id);
      try {
        const b = await getSolBalance();
        const w = loadWallet();
        bot.sendMessage(q.message.chat.id, `${b.toFixed(4)} SOL\n\`${w.publicKey.toBase58()}\``, {
          parse_mode: 'Markdown',
        });
      } catch (e) {
        bot.sendMessage(q.message.chat.id, e.message);
      }
    }
  });
}

function notify(text) {
  if (!bot || !TELEGRAM_CHAT_ID) return;
  bot.sendMessage(TELEGRAM_CHAT_ID, text).catch(() => {});
}

module.exports = { start, notify };
