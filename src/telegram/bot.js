const TelegramBot = require('node-telegram-bot-api');
const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, DRY_RUN } = require('../config');
const { getConfig, applyLocal, applyPreset, listPresets } = require('../live/liveConfig');
const whales = require('../whales/tracker');
const watchlist = require('../migration/watchlist');
const positions = require('../trading/positions');
const { getSolBalance, loadWallet } = require('../solana/wallet');

let bot;
let statusMsgId = null;   // the single live status message we keep editing
let lastStatusKey = '';   // only update when state actually changes

function allowed(chatId) {
  if (!TELEGRAM_CHAT_ID) return true;
  return String(chatId) === String(TELEGRAM_CHAT_ID);
}

/** Build the live status. Returns { key, text }. Only send/edit when key changes. */
function liveStatusLine() {
  const c = getConfig();
  const open = positions.listOpen();
  const watching = watchlist.all().filter((w) => !w.entered).length;

  if (c.paused) {
    return {
      key: 'paused',
      text: `⏸  PAUSED\nBot is stopped. Press Start to resume.`,
    };
  }
  if (open.length > 0) {
    const p = open[0];
    const pnl = p.lastPnl != null ? ` · PnL ${p.lastPnl >= 0 ? '+' : ''}${p.lastPnl.toFixed(1)}%` : '';
    return {
      key: `trade:${open.length}`,
      text: `🟢  IN TRADE\nMonitoring ${open.length} position${open.length > 1 ? 's' : ''}${pnl}\nTP +${c.takeProfitPct}% · SL −${c.stopLossPct}%`,
    };
  }
  if (watching > 0) {
    return {
      key: `watch:${watching}:${c.dipEntryPct}`,
      text: `👀  WATCHING FOR DIP\n${watching} mint${watching > 1 ? 's' : ''} on watchlist\nWaiting for −${c.dipEntryPct}% dip`,
    };
  }
  return {
    key: `wait:${whales.listWhales().length}:${c.minWhaleAgreement}`,
    text: `⏳  WAITING FOR WHALES\nTracking ${whales.listWhales().length} wallets\nNeed ≥${c.minWhaleAgreement} whales to act`,
  };
}

function statusText() {
  const c = getConfig();
  const open = positions.listOpen();
  const riskLabel =
    c.riskProfile === 'easy'
      ? '🟢 Easy (low risk / lower profit)'
      : c.riskProfile === 'high'
        ? '🔴 High (high risk / higher profit)'
        : '🟡 Medium (balanced)';
  return [
    DRY_RUN ? '🧪 DRY RUN' : '🔴 LIVE',
    c.paused ? '⏸ PAUSED' : '🟢 RUNNING',
    `Risk: ${riskLabel}`,
    '',
    `Dip entry: −${c.dipEntryPct}% from peak`,
    `TP +${c.takeProfitPct}% · SL −${c.stopLossPct}% · hold ${c.maxHoldMin}m`,
    `Capital ${c.capitalPct}% (max ${c.maxPositionSol} SOL)`,
    `Whales need ≥${c.minWhaleAgreement} in ${c.whaleLookbackMin}m`,
    `Tracking ${whales.listWhales().length} wallets · watchlist ${watchlist.all().length}`,
    `Open: ${open.length}`,
  ].join('\n');
}

function mainKeyboard() {
  const c = getConfig();
  return {
    inline_keyboard: [
      [{ text: c.paused ? '▶️ Start' : '⏸ Pause', callback_data: 'toggle_pause' }],
      [
        { text: '🟢 Easy', callback_data: 'risk_easy' },
        { text: '🟡 Medium', callback_data: 'risk_medium' },
        { text: '🔴 High', callback_data: 'risk_high' },
      ],
      [
        { text: '🐋 Whales', callback_data: 'whales' },
        { text: '👀 Watchlist', callback_data: 'watch' },
      ],
      [
        { text: '📈 Positions', callback_data: 'pos' },
        { text: '💼 Balance', callback_data: 'bal' },
      ],
    ],
  };
}

/** Create or update the single status message — only when state changes */
async function refreshLiveStatus(force = false) {
  if (!bot || !TELEGRAM_CHAT_ID) return;
  const { key, text } = liveStatusLine();

  // Skip if nothing important changed
  if (!force && key === lastStatusKey) return;
  lastStatusKey = key;

  try {
    if (statusMsgId) {
      await bot.editMessageText(text, {
        chat_id: TELEGRAM_CHAT_ID,
        message_id: statusMsgId,
      });
    } else {
      const sent = await bot.sendMessage(TELEGRAM_CHAT_ID, text);
      statusMsgId = sent.message_id;
    }
  } catch (err) {
    if (/message to edit not found|message is not modified|MESSAGE_ID_INVALID/i.test(err.message)) {
      try {
        const sent = await bot.sendMessage(TELEGRAM_CHAT_ID, text);
        statusMsgId = sent.message_id;
      } catch (_) {}
    }
  }
}

function start() {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('[telegram] disabled (no token)');
    return;
  }
  bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
  console.log('[telegram] polling');

  // Check for state changes every 20 seconds (only updates message when state changes)
  setTimeout(() => refreshLiveStatus(true), 2000);
  setInterval(() => refreshLiveStatus(), 20000);

  bot.onText(/\/(start|menu|status)/i, (msg) => {
    if (!allowed(msg.chat.id)) return;
    bot.sendMessage(msg.chat.id, statusText(), { reply_markup: mainKeyboard() });
  });

  bot.onText(/\/risk(?:\s+(easy|medium|high))?/i, (msg, m) => {
    if (!allowed(msg.chat.id)) return;
    const name = (m[1] || '').toLowerCase();
    if (!name) {
      const lines = listPresets().map((p) => `• *${p.name}* (\`/risk ${p.key}\`)\n  ${p.summary}`);
      bot.sendMessage(
        msg.chat.id,
        `Current risk: *${getConfig().riskProfile}*\n\nChoose a preset:\n\n${lines.join('\n\n')}`,
        { parse_mode: 'Markdown', reply_markup: mainKeyboard() }
      );
      return;
    }
    const cfg = applyPreset(name);
    if (!cfg) {
      bot.sendMessage(msg.chat.id, 'Unknown preset. Use: /risk easy | medium | high');
      return;
    }
    bot.sendMessage(msg.chat.id, `✅ Risk set to *${cfg.riskProfile}*\n\n${statusText()}`, {
      parse_mode: 'Markdown',
      reply_markup: mainKeyboard(),
    });
    refreshLiveStatus(true);
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
    applyLocal({ dipEntryPct: Number(m[1]), riskProfile: 'custom' });
    bot.sendMessage(msg.chat.id, `Dip entry set to −${m[1]}% (now custom)`);
    refreshLiveStatus(true);
  });
  bot.onText(/\/settp\s+(\d+)/i, (msg, m) => {
    if (!allowed(msg.chat.id)) return;
    applyLocal({ takeProfitPct: Number(m[1]), riskProfile: 'custom' });
    bot.sendMessage(msg.chat.id, `TP +${m[1]}% (now custom)`);
  });
  bot.onText(/\/setsl\s+(\d+)/i, (msg, m) => {
    if (!allowed(msg.chat.id)) return;
    applyLocal({ stopLossPct: Number(m[1]), riskProfile: 'custom' });
    bot.sendMessage(msg.chat.id, `SL −${m[1]}% (now custom)`);
  });
  bot.onText(/\/setwhales\s+(\d+)/i, (msg, m) => {
    if (!allowed(msg.chat.id)) return;
    applyLocal({ minWhaleAgreement: Number(m[1]), riskProfile: 'custom' });
    bot.sendMessage(msg.chat.id, `Need ≥${m[1]} whales (now custom)`);
    refreshLiveStatus(true);
  });
  bot.onText(/\/watch\s+(\S+)/i, (msg, m) => {
    if (!allowed(msg.chat.id)) return;
    watchlist.watch(m[1].trim(), { source: 'telegram' });
    bot.sendMessage(msg.chat.id, `Watching ${m[1].trim().slice(0, 12)}… for dip`);
    refreshLiveStatus(true);
  });
  bot.onText(/\/(pause|stoptrading)/i, (msg) => {
    if (!allowed(msg.chat.id)) return;
    applyLocal({ paused: true });
    bot.sendMessage(msg.chat.id, 'Paused');
    refreshLiveStatus(true);
  });
  bot.onText(/\/(resume|starttrading)/i, (msg) => {
    if (!allowed(msg.chat.id)) return;
    applyLocal({ paused: false });
    bot.sendMessage(msg.chat.id, 'Running');
    refreshLiveStatus(true);
  });

  bot.on('callback_query', async (q) => {
    if (!allowed(q.message.chat.id)) return;
    const id = q.data;

    if (id === 'toggle_pause') {
      const p = !getConfig().paused;
      applyLocal({ paused: p });
      bot.answerCallbackQuery(q.id, { text: p ? 'Paused' : 'Running' });
      bot.sendMessage(q.message.chat.id, statusText(), { reply_markup: mainKeyboard() });
      refreshLiveStatus(true);
      return;
    }

    if (id.startsWith('risk_')) {
      const name = id.replace('risk_', '');
      const cfg = applyPreset(name);
      if (cfg) {
        bot.answerCallbackQuery(q.id, { text: `Risk → ${cfg.riskProfile}` });
        bot.sendMessage(q.message.chat.id, `✅ Risk set to *${cfg.riskProfile}*\n\n${statusText()}`, {
          parse_mode: 'Markdown',
          reply_markup: mainKeyboard(),
        });
        refreshLiveStatus(true);
      } else {
        bot.answerCallbackQuery(q.id, { text: 'Unknown preset' });
      }
      return;
    }

    if (id === 'whales') {
      bot.answerCallbackQuery(q.id);
      const list = whales.listWhales();
      bot.sendMessage(
        q.message.chat.id,
        `Whales: ${list.length}\nNeed ≥${getConfig().minWhaleAgreement}`
      );
    } else if (id === 'watch') {
      bot.answerCallbackQuery(q.id);
      const all = watchlist.all().slice(0, 15);
      bot.sendMessage(
        q.message.chat.id,
        all.length
          ? all
              .map(
                (w) =>
                  `${w.mint.slice(0, 8)}… dip ${((w.dipPct || 0).toFixed?.(1)) || 0}% peak→now`
              )
              .join('\n')
          : 'Watchlist empty — whales will add mints when they buy'
      );
    } else if (id === 'pos') {
      bot.answerCallbackQuery(q.id);
      const open = positions.listOpen();
      bot.sendMessage(
        q.message.chat.id,
        open.length
          ? open
              .map(
                (p) =>
                  `${p.mint.slice(0, 8)} ${p.sizeSol} SOL pnl ${p.lastPnl?.toFixed?.(1) || '?'}%`
              )
              .join('\n')
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
  setTimeout(() => refreshLiveStatus(true), 1500);
}

module.exports = { start, notify };
