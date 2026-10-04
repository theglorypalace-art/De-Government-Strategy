# Migration Dip Trader — How to use

## Idea
1. Track active whale wallets  
2. When **2+** buy the same coin → watch it  
3. Enter after price dips **~15–20%** from its peak  
4. Exit at **~+50%** TP or **~−25%** SL  

## Telegram
- `/menu` — status + buttons  
- `/whales` — list tracked wallets  
- `/watch <CA>` — manually watch a mint for dip  
- `/setdip 18` — dip % from peak  
- `/settp 50` — take profit %  
- `/setsl 25` — stop loss %  
- `/setwhales 2` — min whales that must agree  
- `/starttrading` / `/stoptrading` — run / pause  

## Env
Put whale addresses in `WHALE_WALLETS` (comma-separated).  
`DRY_RUN=true` until you are ready.
