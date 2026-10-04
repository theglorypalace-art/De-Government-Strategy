async function getTokenMarket(mint) {
  const url = `https://api.dexscreener.com/latest/dex/tokens/${mint}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const pairs = data.pairs || [];
  if (!pairs.length) return null;
  const best = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
  return {
    marketCapUsd: Number(best.marketCap || best.fdv || 0) || 0,
    liquidityUsd: Number(best.liquidity?.usd || 0) || 0,
    priceUsd: Number(best.priceUsd || 0) || 0,
    priceNative: Number(best.priceNative || 0) || 0,
    volume24h: Number(best.volume?.h24 || 0) || 0,
    volume1h: Number(best.volume?.h1 || 0) || 0,
    priceChange5m: Number(best.priceChange?.m5 || 0) || 0,
    priceChange1h: Number(best.priceChange?.h1 || 0) || 0,
    pairUrl: best.url || null,
    dexId: best.dexId || null,
  };
}

module.exports = { getTokenMarket };
