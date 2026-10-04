const staticConfig = require('../config');

let cached = {
  paused: false,
  dipEntryPct: staticConfig.DIP_ENTRY_PCT,
  takeProfitPct: staticConfig.TAKE_PROFIT_PCT,
  stopLossPct: staticConfig.STOP_LOSS_PCT,
  maxHoldMin: staticConfig.MAX_HOLD_MIN,
  capitalPct: staticConfig.CAPITAL_PCT,
  maxPositionSol: staticConfig.MAX_POSITION_SOL,
  minWhaleAgreement: staticConfig.MIN_WHALE_AGREEMENT,
  whaleLookbackMin: staticConfig.WHALE_LOOKBACK_MIN,
};

function getConfig() {
  return { ...cached };
}

function applyLocal(patch) {
  cached = { ...cached, ...patch };
  return getConfig();
}

function start() {
  console.log('[live-config] in-memory config (Telegram can change live)');
}

module.exports = { getConfig, applyLocal, start };
