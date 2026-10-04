const { Connection, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const bs58mod = require('bs58');
const bs58 = bs58mod.default || bs58mod;
const { HELIUS_RPC_URL, WALLET_PRIVATE_KEY, DRY_RUN } = require('../config');

let connection;
let wallet;

function getConnection() {
  if (!connection) {
    connection = new Connection(HELIUS_RPC_URL, { commitment: 'confirmed' });
  }
  return connection;
}

function loadWallet() {
  if (wallet) return wallet;
  if (!WALLET_PRIVATE_KEY) {
    if (DRY_RUN) {
      wallet = Keypair.generate();
      console.warn('[wallet] DRY_RUN with ephemeral keypair (no real funds)');
      return wallet;
    }
    throw new Error('WALLET_PRIVATE_KEY required when DRY_RUN=false');
  }
  let raw = WALLET_PRIVATE_KEY.trim();
  let secret;
  if (raw.startsWith('[')) secret = Uint8Array.from(JSON.parse(raw));
  else secret = bs58.decode(raw);
  wallet = Keypair.fromSecretKey(secret);
  return wallet;
}

async function getSolBalance() {
  const conn = getConnection();
  const w = loadWallet();
  const lamports = await conn.getBalance(w.publicKey);
  return lamports / LAMPORTS_PER_SOL;
}

module.exports = { getConnection, loadWallet, getSolBalance, LAMPORTS_PER_SOL };
