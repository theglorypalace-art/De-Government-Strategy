require('dotenv').config();
const config = require('./src/config');
const liveConfig = require('./src/live/liveConfig');
const whales = require('./src/whales/tracker');
const watchlist = require('./src/migration/watchlist');
const positions = require('./src/trading/positions');
const telegram = require('./src/telegram/bot');

console.log('=== Migration Dip Trader ===');
console.log(config.DRY_RUN ? 'Mode: DRY RUN' : 'Mode: LIVE');
console.log(
  `Strategy: dip −${config.DIP_ENTRY_PCT}% · TP +${config.TAKE_PROFIT_PCT}% · SL −${config.STOP_LOSS_PCT}% · ≥${config.MIN_WHALE_AGREEMENT} whales`
);

if (!config.HELIUS_API_KEY) {
  console.error('HELIUS_API_KEY required');
  process.exit(1);
}

liveConfig.start();
telegram.start();

// Quiet mode: only notify on actual ENTRY or EXIT.
// Whale confluence just adds to watchlist + tries entry silently.
whales.start(async (hit) => {
  console.log(`[signal] whale confluence ${hit.count} on ${hit.mint.slice(0, 8)}…`);
  watchlist.watch(hit.mint, { source: 'whales' });
  const res = await positions.tryEnter(hit.mint, `whales:${hit.count}`);
  if (res.ok) {
    const cfg = liveConfig.getConfig();
    telegram.notify(
      `🟢 ENTERED ${hit.mint.slice(0, 12)}…\n` +
        `${config.DRY_RUN ? 'DRY' : 'LIVE'} · ${hit.count} whales\n` +
        `TP +${cfg.takeProfitPct}% · SL −${cfg.stopLossPct}%`
    );
  } else if (res.why && !/dip|whales \d|busy|paused|max concurrent/.test(res.why)) {
    console.log('[signal] skip', res.why);
  }
});

watchlist.start(async (signal) => {
  console.log(`[dip] ${signal.mint.slice(0, 8)}… −${signal.dipPct.toFixed(1)}% from peak`);
  const res = await positions.tryEnter(signal.mint, `dip:${signal.dipPct.toFixed(0)}`);
  if (res.ok) {
    const cfg = liveConfig.getConfig();
    telegram.notify(
      `🟢 DIP ENTRY ${signal.mint.slice(0, 12)}… −${signal.dipPct.toFixed(1)}%\n` +
        `TP +${cfg.takeProfitPct}% · SL −${cfg.stopLossPct}%`
    );
  }
});

console.log('[boot] waiting for whale buys + dips… (notifications only on ENTRY / EXIT)');
