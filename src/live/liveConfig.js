const staticConfig = require('../config');

/** Risk presets — Easy (conservative), Medium (balanced), High (aggressive) */
const PRESETS = {
  easy: {
    name: 'Easy',
    dipEntryPct: 22,       // wait for deeper dip
    takeProfitPct: 30,     // lower TP
    stopLossPct: 15,       // tighter SL
    maxHoldMin: 90,
    capitalPct: 3,         // smaller size
    maxPositionSol: 0.08,
    minWhaleAgreement: 3,  // need more whales
    whaleLookbackMin: 45,
  },
  medium: {
    name: 'Medium',
    dipEntryPct: 18,
    takeProfitPct: 50,
    stopLossPct: 25,
    maxHoldMin: 120,
    capitalPct: 5,
    maxPositionSol: 0.15,
    minWhaleAgreement: 2,
    whaleLookbackMin: 30,
  },
  high: {
    name: 'High',
    dipEntryPct: 12,       // enter on shallower dip
    takeProfitPct: 80,     // higher TP
    stopLossPct: 35,       // wider SL
    maxHoldMin: 180,
    capitalPct: 10,        // larger size
    maxPositionSol: 0.30,
    minWhaleAgreement: 2,
    whaleLookbackMin: 25,
  },
};

let cached = {
  paused: false,
  riskProfile: 'medium',
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

/**
 * Apply a named risk preset (easy | medium | high).
 * Returns the new config or null if invalid name.
 */
function applyPreset(name) {
  const key = String(name || '').toLowerCase().trim();
  const preset = PRESETS[key];
  if (!preset) return null;
  const { name: _n, ...params } = preset;
  cached = {
    ...cached,
    riskProfile: key,
    ...params,
  };
  return getConfig();
}

function listPresets() {
  return Object.entries(PRESETS).map(([key, p]) => ({
    key,
    name: p.name,
    summary: `dip −${p.dipEntryPct}% · TP +${p.takeProfitPct}% · SL −${p.stopLossPct}% · size ${p.capitalPct}% / ${p.maxPositionSol} SOL · ≥${p.minWhaleAgreement} whales`,
  }));
}

function start() {
  console.log('[live-config] in-memory config (Telegram can change live)');
  // Apply medium as starting point if values match defaults
  if (cached.riskProfile === 'medium') {
    applyPreset('medium');
  }
}

module.exports = { getConfig, applyLocal, applyPreset, listPresets, PRESETS, start };
