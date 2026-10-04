/**
 * Tracks buys by configured whale wallets.
 * Signal: same mint bought by ≥ minWhaleAgreement distinct whales inside lookback window.
 */
const { PublicKey } = require('@solana/web3.js');
const { getConnection } = require('../solana/wallet');
const { WHALE_WALLETS, WHALE_POLL_MS } = require('../config');
const { getConfig } = require('../live/liveConfig');

// mint -> [{ whale, signature, at }]
const buys = new Map();
const seenSig = new Set();

function listWhales() {
  return WHALE_WALLETS.slice();
}

function recordBuy(mint, whale, signature) {
  if (!mint || !whale) return;
  const arr = buys.get(mint) || [];
  if (arr.some((b) => b.whale === whale && b.signature === signature)) return;
  arr.push({ whale, signature, at: Date.now() });
  buys.set(mint, arr);
}

function prune() {
  const lookbackMs = (getConfig().whaleLookbackMin || 30) * 60 * 1000;
  const cutoff = Date.now() - lookbackMs;
  for (const [mint, arr] of buys) {
    const next = arr.filter((b) => b.at >= cutoff);
    if (!next.length) buys.delete(mint);
    else buys.set(mint, next);
  }
}

/** Distinct whales that bought mint in lookback */
function agreementFor(mint) {
  prune();
  const arr = buys.get(mint) || [];
  const set = new Set(arr.map((b) => b.whale));
  return { count: set.size, whales: [...set], events: arr };
}

function mintsMeetingAgreement() {
  prune();
  const need = getConfig().minWhaleAgreement || 2;
  const out = [];
  for (const mint of buys.keys()) {
    const a = agreementFor(mint);
    if (a.count >= need) out.push({ mint, ...a });
  }
  return out;
}

async function pollWhale(whale) {
  const connection = getConnection();
  let sigs;
  try {
    sigs = await connection.getSignaturesForAddress(new PublicKey(whale), { limit: 8 }, 'confirmed');
  } catch (err) {
    if (/429|rate/i.test(err.message)) throw err;
    return;
  }
  for (const s of sigs || []) {
    if (!s?.signature || s.err) continue;
    if (seenSig.has(s.signature)) continue;
    seenSig.add(s.signature);
    if (seenSig.size > 3000) {
      [...seenSig].slice(0, 800).forEach((x) => seenSig.delete(x));
    }
    if (s.blockTime && Date.now() / 1000 - s.blockTime > 3600) continue;

    try {
      const tx = await connection.getParsedTransaction(s.signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      });
      if (!tx?.meta) continue;
      const pre = new Map((tx.meta.preTokenBalances || []).map((b) => [`${b.owner}:${b.mint}`, Number(b.uiTokenAmount?.uiAmount || 0)]));
      for (const b of tx.meta.postTokenBalances || []) {
        if (b.owner !== whale) continue;
        const key = `${b.owner}:${b.mint}`;
        const postAmt = Number(b.uiTokenAmount?.uiAmount || 0);
        const preAmt = pre.get(key) || 0;
        if (postAmt > preAmt + 0.0001) {
          recordBuy(b.mint, whale, s.signature);
        }
      }
    } catch (err) {
      if (/429|rate/i.test(err.message)) throw err;
    }
  }
}

let timer = null;
let idx = 0;
let backoffUntil = 0;

function start(onConfluence) {
  if (timer) return;
  if (!WHALE_WALLETS.length) {
    console.warn('[whales] WHALE_WALLETS empty — confluence gate will never pass. Add wallets in .env');
  } else {
    console.log(`[whales] tracking ${WHALE_WALLETS.length} wallets`);
  }

  const tick = async () => {
    if (Date.now() < backoffUntil) return;
    const list = listWhales();
    if (!list.length) return;
    // Round-robin one whale per tick to limit RPC
    const whale = list[idx % list.length];
    idx += 1;
    try {
      await pollWhale(whale);
      const hits = mintsMeetingAgreement();
      for (const h of hits) {
        if (onConfluence) await onConfluence(h);
      }
    } catch (err) {
      if (/429|rate/i.test(err.message)) {
        backoffUntil = Date.now() + 120000;
        console.warn('[whales] 429 — pause 2m');
      } else {
        console.warn('[whales]', err.message);
      }
    }
  };

  setTimeout(tick, 10000);
  timer = setInterval(tick, WHALE_POLL_MS);
  if (timer.unref) timer.unref();
}

module.exports = {
  start,
  listWhales,
  agreementFor,
  mintsMeetingAgreement,
  recordBuy,
};
