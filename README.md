# De-Government Strategy

Post-migration **dip entry** + **whale confluence** trader for Solana memes.

Repo: https://github.com/theglorypalace-art/De-Government-Strategy

## Strategy

1. Track active whale wallets (`WHALE_WALLETS`)
2. When **≥2** buy the same mint → add to watchlist
3. Enter after price dips **~15–20%** from peak (default 18%)
4. Exit **TP +50%** / **SL −25%** / max hold

## Quick start

```bash
cp .env.example .env
# HELIUS_API_KEY, TELEGRAM_*, WHALE_WALLETS=addr1,addr2,...
npm install
npm start
```

`DRY_RUN=true` until ready. Then `DRY_RUN=false` + `WALLET_PRIVATE_KEY`.

## Telegram

`/menu` · `/whales` · `/watch <CA>` · `/setdip 18` · `/settp 50` · `/setsl 25` · `/setwhales 2` · `/starttrading` · `/stoptrading`

See `docs/USER_GUIDE.md`.

## Deploy (Railway)

Connect this repo, set env vars from `.env.example`, start command: `node index.js`.
