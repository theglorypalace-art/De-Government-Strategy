const { VersionedTransaction } = require('@solana/web3.js');
const {
  JUPITER_QUOTE_URL,
  JUPITER_SWAP_URL,
  SOL_MINT,
  SLIPPAGE_BPS,
  PRIORITY_FEE_LAMPORTS,
  DRY_RUN,
} = require('../config');
const { getConnection } = require('../solana/wallet');

async function getQuote(inputMint, outputMint, amount) {
  const url =
    `${JUPITER_QUOTE_URL}?inputMint=${inputMint}&outputMint=${outputMint}` +
    `&amount=${amount}&slippageBps=${SLIPPAGE_BPS}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Jupiter quote ${res.status}`);
  return res.json();
}

async function buySol(mint, lamports, wallet) {
  const quote = await getQuote(SOL_MINT, mint, lamports);
  if (DRY_RUN) return { dryRun: true, quote, signature: null };
  const res = await fetch(JUPITER_SWAP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: wallet.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      prioritizationFeeLamports: PRIORITY_FEE_LAMPORTS,
    }),
  });
  if (!res.ok) throw new Error(`Jupiter swap build ${res.status}`);
  const { swapTransaction } = await res.json();
  const tx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, 'base64'));
  tx.sign([wallet]);
  const conn = getConnection();
  const signature = await conn.sendTransaction(tx, { skipPreflight: false, maxRetries: 3 });
  await conn.confirmTransaction(signature, 'confirmed');
  return { dryRun: false, quote, signature };
}

async function sellToSol(mint, tokenAmountRaw, wallet) {
  const quote = await getQuote(mint, SOL_MINT, tokenAmountRaw);
  if (DRY_RUN) return { dryRun: true, quote, signature: null };
  const res = await fetch(JUPITER_SWAP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: wallet.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      prioritizationFeeLamports: PRIORITY_FEE_LAMPORTS,
    }),
  });
  if (!res.ok) throw new Error(`Jupiter sell build ${res.status}`);
  const { swapTransaction } = await res.json();
  const tx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, 'base64'));
  tx.sign([wallet]);
  const conn = getConnection();
  const signature = await conn.sendTransaction(tx, { skipPreflight: false, maxRetries: 3 });
  await conn.confirmTransaction(signature, 'confirmed');
  return { dryRun: false, quote, signature };
}

module.exports = { getQuote, buySol, sellToSol };
