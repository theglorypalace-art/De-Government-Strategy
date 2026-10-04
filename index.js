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

// When whales agree on a mint → add to dip watchlist → try enter if dip already armed
whales.start(async (hit) => {
  console.log(`[signal] whale confluence ${hit.count} on ${hit.mint.slice(0, 8)}…`);
  watchlist.watch(hit.mint, { source: 'whales' });
  telegram.notify(`🐋 ${hit.count} whales bought ${hit.mint.slice(0, 12)}…\nWatching for −${liveConfig.getConfig().dipEntryPct}% dip`);
  const res = await positions.tryEnter(hit.mint, `whales:${hit.count}`);
  if (res.ok) {
    telegram.notify(`🟢 ENTERED ${hit.mint.slice(0, 12)}… (${config.DRY_RUN ? 'DRY' : 'LIVE'})`);
  } else if (res.why && !/dip|whales \d/.test(res.why)) {
    console.log('[signal] skip', res.why);
  }
});

watchlist.start(async (signal) => {
  console.log(`[dip] ${signal.mint.slice(0, 8)}… −${signal.dipPct.toFixed(1)}% from peak`);
  const res = await positions.tryEnter(signal.mint, `dip:${signal.dipPct.toFixed(0)}`);
  if (res.ok) {
    telegram.notify(
      `🟢 DIP ENTRY ${signal.mint.slice(0, 12)}… −${signal.dipPct.toFixed(1)}%\nTP +${liveConfig.getConfig().takeProfitPct}% SL −${liveConfig.getConfig().stopLossPct}%`
    );
  }
});

console.log('[boot] waiting for whale buys + dips…');
