require('dotenv').config();

function num(name, fallback) {
  const v = process.env[name];
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const DRY_RUN = process.env.DRY_RUN !== 'false';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';

module.exports = {
  DRY_RUN,
  HELIUS_API_KEY,
  HELIUS_RPC_URL: `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
  HELIUS_WSS_URL: `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
  WALLET_PRIVATE_KEY: process.env.WALLET_PRIVATE_KEY || null,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || null,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || null,

  SOL_MINT: 'So11111111111111111111111111111111111111112',
  JUPITER_QUOTE_URL: process.env.JUPITER_QUOTE_URL || 'https://quote-api.jup.ag/v6/quote',
  JUPITER_SWAP_URL: process.env.JUPITER_SWAP_URL || 'https://quote-api.jup.ag/v6/swap',
  PUMPPORTAL_TRADE_URL: process.env.PUMPPORTAL_TRADE_URL || 'https://pumpportal.fun/api/trade-local',

  DIP_ENTRY_PCT: num('DIP_ENTRY_PCT', 18),
  TAKE_PROFIT_PCT: num('TAKE_PROFIT_PCT', 50),
  STOP_LOSS_PCT: num('STOP_LOSS_PCT', 25),
  MAX_HOLD_MIN: num('MAX_HOLD_MIN', 120),
  CAPITAL_PCT: num('CAPITAL_PCT', 5),
  MAX_POSITION_SOL: num('MAX_POSITION_SOL', 0.15),
  SOL_FEE_RESERVE: num('SOL_FEE_RESERVE', 0.02),
  MAX_CONCURRENT: num('MAX_CONCURRENT', 1),
  MIN_WHALE_AGREEMENT: num('MIN_WHALE_AGREEMENT', 2),
  WHALE_LOOKBACK_MIN: num('WHALE_LOOKBACK_MIN', 30),
  SLIPPAGE_BPS: num('SLIPPAGE_BPS', 1500),
  PRIORITY_FEE_LAMPORTS: num('PRIORITY_FEE_LAMPORTS', 100000),
  PRICE_POLL_MS: num('PRICE_POLL_MS', 8000),
  WHALE_POLL_MS: num('WHALE_POLL_MS', 45000),
  MIGRATE_POLL_MS: num('MIGRATE_POLL_MS', 30000),

  WHALE_WALLETS: String(process.env.WHALE_WALLETS || '')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean),
};
