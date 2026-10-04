# Migration Dip Trader

Solana meme strategy bot based on:

1. **After migration** — wait for a **15–20% dip** from the post-migration high, then enter  
2. **Take profit ~50%** — full exit  
3. **Stop loss ~25%** (configurable; wider optional)  
4. **Whale confluence** — only enter when **≥2** tracked whale wallets bought the same mint recently  

Built with lessons from a prior launch sniper: DRY_RUN default, Telegram controls, Helius RPC, rate-limit-aware polling, PumpPortal/Jupiter-style exits.

## Quick start

```bash
cp .env.example .env
# fill HELIUS_API_KEY, TELEGRAM_*, WHALE_WALLETS
npm install
npm start
```

Set `DRY_RUN=false` and `WALLET_PRIVATE_KEY` only when ready for real size.

## Strategy flow

```
Token migrates / appears on DEX
  → track peak price since migration
  → price dips DIP_ENTRY_PCT from peak
  → ≥ MIN_WHALE_AGREEMENT whales bought same mint in lookback window
  → buy CAPITAL_PCT of wallet (capped)
  → sell on TP / SL / max hold
```

## Telegram

`/menu` · `/status` · `/whales` · `/positions` · `/setdip` · `/settp` · `/setsl` · `/start` · `/stop`

See `docs/USER_GUIDE.md`.
