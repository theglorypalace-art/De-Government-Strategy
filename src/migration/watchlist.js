/**
 * Candidates: mints that whales bought and/or manually watched.
 * Tracks peak priceNative since first seen; signals entry when dip from peak ≥ dipEntryPct.
 */
const { getTokenMarket } = require('../analysis/dexscreener');
const { getConfig } = require('../live/liveConfig');
const { MIGRATE_POLL_MS } = require('../config');

/** mint -> { firstSeen, peakNative, peakUsd, lastNative, migratedGuess, lastVol1h } */
const state = new Map();

function watch(mint, meta = {}) {
  if (!mint) return;
  if (!state.has(mint)) {
    state.set(mint, {
      firstSeen: Date.now(),
      peakNative: 0,
      peakUsd: 0,
      lastNative: 0,
      lastUsd: 0,
      lastVol1h: 0,
      source: meta.source || 'unknown',
      dipArmed: false,
      entered: false,
    });
  }
}

function get(mint) {
  return state.get(mint) || null;
}

function all() {
  return [...state.entries()].map(([mint, s]) => ({ mint, ...s }));
}

async function refreshOne(mint) {
  const s = state.get(mint);
  if (!s || s.entered) return null;
  const mkt = await getTokenMarket(mint);
  if (!mkt || !(mkt.priceNative > 0 || mkt.priceUsd > 0)) return null;

  const native = mkt.priceNative || 0;
  const usd = mkt.priceUsd || 0;
  if (native > s.peakNative) s.peakNative = native;
  if (usd > s.peakUsd) s.peakUsd = usd;
  s.lastNative = native;
  s.lastUsd = usd;
  s.lastVol1h = mkt.volume1h || 0;

  const cfg = getConfig();
  const dipNeed = Number(cfg.dipEntryPct) || 18;
  // Prefer native (SOL) dip; fall back to USD
  let dipPct = 0;
  if (s.peakNative > 0 && native > 0) {
    dipPct = ((s.peakNative - native) / s.peakNative) * 100;
  } else if (s.peakUsd > 0 && usd > 0) {
    dipPct = ((s.peakUsd - usd) / s.peakUsd) * 100;
  }

  s.dipPct = dipPct;
  if (dipPct >= dipNeed) {
    s.dipArmed = true;
    return { mint, dipPct, peakNative: s.peakNative, lastNative: native, mkt, state: s };
  }
  return null;
}

let timer = null;

function start(onDipReady) {
  if (timer) return;
  const tick = async () => {
    for (const mint of state.keys()) {
      try {
        const signal = await refreshOne(mint);
        if (signal && onDipReady) await onDipReady(signal);
      } catch (err) {
        console.warn('[migration-watch]', mint.slice(0, 8), err.message);
      }
      await new Promise((r) => setTimeout(r, 400)); // gentle on DexScreener
    }
  };
  setTimeout(tick, 5000);
  timer = setInterval(tick, MIGRATE_POLL_MS);
  if (timer.unref) timer.unref();
  console.log('[migration-watch] dip tracker started');
}

function markEntered(mint) {
  const s = state.get(mint);
  if (s) s.entered = true;
}

module.exports = { watch, get, all, refreshOne, start, markEntered };
