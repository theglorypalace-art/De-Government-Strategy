const { LAMPORTS_PER_SOL } = require('@solana/web3.js');
const {
  DRY_RUN,
  SOL_MINT,
  MAX_CONCURRENT,
  SOL_FEE_RESERVE,
  PRICE_POLL_MS,
} = require('../config');
const { getConfig } = require('../live/liveConfig');
const { getSolBalance, loadWallet } = require('../solana/wallet');
const { buySol, sellToSol, getQuote } = require('./jupiter');
const { getTokenMarket } = require('../analysis/dexscreener');
const whales = require('../whales/tracker');
const watchlist = require('../migration/watchlist');

const open = new Map();
let entering = false;

function sizeSol() {
  const cfg = getConfig();
  return getSolBalance().then((bal) => {
    const usable = Math.max(0, bal - SOL_FEE_RESERVE);
    let sol = (usable * (cfg.capitalPct || 5)) / 100;
    const cap = Number(cfg.maxPositionSol) || 0;
    if (cap > 0) sol = Math.min(sol, cap);
    return Math.floor(sol * 1e6) / 1e6;
  });
}

async function tryEnter(mint, reason) {
  const cfg = getConfig();
  if (cfg.paused) return { ok: false, why: 'paused' };
  if (open.has(mint) || entering) return { ok: false, why: 'busy' };
  if (open.size >= MAX_CONCURRENT) return { ok: false, why: 'max concurrent' };

  const agree = whales.agreementFor(mint);
  if (agree.count < (cfg.minWhaleAgreement || 2)) {
    return { ok: false, why: `whales ${agree.count}/${cfg.minWhaleAgreement}` };
  }

  const dipNeed = cfg.dipEntryPct || 18;
  let st = watchlist.get(mint);
  if (!st || !st.dipArmed || (st.dipPct || 0) < dipNeed) {
    // one refresh
    const sig = await watchlist.refreshOne(mint);
    if (!sig || sig.dipPct < dipNeed) {
      return { ok: false, why: `dip ${(st && st.dipPct) || 0}% < ${dipNeed}%` };
    }
  }

  entering = true;
  try {
    const sol = await sizeSol();
    if (sol < 0.001) return { ok: false, why: 'size too small' };

    const wallet = loadWallet();
    const lamports = Math.floor(sol * LAMPORTS_PER_SOL);
    console.log(`[pos] ENTER ${mint.slice(0, 8)}… ${sol} SOL (${reason}) whales=${agree.count}`);
    const result = await buySol(mint, lamports, wallet);
    const outAmount = result.quote?.outAmount ? String(result.quote.outAmount) : null;

    const pos = {
      mint,
      sizeSol: sol,
      tokenAmountRaw: outAmount,
      openedAt: Date.now(),
      entryNative: sol,
      agree,
      dryRun: result.dryRun,
      signature: result.signature,
    };
    open.set(mint, pos);
    watchlist.markEntered(mint);
    monitor(mint);
    return { ok: true, pos };
  } catch (err) {
    console.error('[pos] buy failed', err.message);
    return { ok: false, why: err.message };
  } finally {
    entering = false;
  }
}

function monitor(mint) {
  const t = setInterval(async () => {
    const pos = open.get(mint);
    if (!pos || pos.exiting) {
      clearInterval(t);
      return;
    }
    const cfg = getConfig();
    const tp = Number(cfg.takeProfitPct) || 50;
    const sl = -Math.abs(Number(cfg.stopLossPct) || 25);
    const maxHoldMs = (Number(cfg.maxHoldMin) || 120) * 60 * 1000;
    const age = Date.now() - pos.openedAt;

    let pnlPct = 0;
    try {
      if (pos.tokenAmountRaw) {
        const q = await getQuote(mint, SOL_MINT, pos.tokenAmountRaw);
        const out = Number(q.outAmount) / LAMPORTS_PER_SOL;
        pnlPct = ((out - pos.sizeSol) / pos.sizeSol) * 100;
        pos.lastPnl = pnlPct;
      } else {
        const mkt = await getTokenMarket(mint);
        // rough: no token amount — skip pnl until we have balance
        if (mkt) pnlPct = pos.lastPnl || 0;
      }
    } catch (_) {
      /* keep last */
      pnlPct = pos.lastPnl || 0;
    }

    let reason = null;
    if (pnlPct >= tp) reason = 'take_profit';
    else if (pnlPct <= sl) reason = 'stop_loss';
    else if (age >= maxHoldMs) reason = 'max_hold';

    if (reason) {
      await exit(mint, reason, pnlPct);
      clearInterval(t);
    }
  }, PRICE_POLL_MS);
  if (t.unref) t.unref();
}

async function exit(mint, reason, pnlPct) {
  const pos = open.get(mint);
  if (!pos || pos.exiting) return;
  pos.exiting = true;
  try {
    const wallet = loadWallet();
    if (pos.tokenAmountRaw && !pos.dryRun) {
      await sellToSol(mint, pos.tokenAmountRaw, wallet);
    }
    console.log(
      `[pos] EXIT ${mint.slice(0, 8)}… ${reason} pnl=${(pnlPct || 0).toFixed(1)}% ${pos.dryRun ? '[DRY]' : ''}`
    );
  } catch (err) {
    console.error('[pos] sell failed', err.message);
  }
  open.delete(mint);
}

function listOpen() {
  return [...open.values()];
}

module.exports = { tryEnter, listOpen, exit };
