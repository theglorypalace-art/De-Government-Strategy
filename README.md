# De-Government Strategy

Post-migration **dip entry** + **whale confluence** trader for Solana memes.

Repo: https://github.com/theglorypalace-art/De-Government-Strategy

## Strategy

1. Track active whale wallets (`WHALE_WALLETS`)
2. When **≥2** buy the same mint → add to watchlist
3. Enter after price dips from peak (depends on risk preset)
4. Exit on take-profit / stop-loss / max hold

## Risk presets (Easy / Medium / High)

Use Telegram buttons or `/risk easy|medium|high`:

| Preset  | Dip entry | TP    | SL    | Size          | Min whales | Style                     |
|---------|-----------|-------|-------|---------------|------------|---------------------------|
| **Easy**   | −22%     | +30% | −15% | 3% / 0.08 SOL | 3          | Lower risk, lower profit  |
| **Medium** | −18%     | +50% | −25% | 5% / 0.15 SOL | 2          | Balanced (default)        |
| **High**   | −12%     | +80% | −35% | 10% / 0.30 SOL| 2          | Higher risk, higher profit|

Individual knobs (`/setdip`, `/settp`, `/setsl`, …) still work and switch the profile to “custom”.

## Quick start

```bash
cp .env.example .env
# HELIUS_API_KEY, TELEGRAM_*, WHALE_WALLETS=addr1,addr2,...
# WALLET_PRIVATE_KEY=your_base58_or_json_array_key   (operator wallet only)
npm install
npm start
