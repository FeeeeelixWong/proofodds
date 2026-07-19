import * as anchor from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import nacl from "tweetnacl";

const root = fileURLToPath(new URL("../", import.meta.url));
const envPath = process.env.TXLINE_ENV_PATH || join(root, ".env.local");
const walletPath = process.env.TXLINE_WALLET_PATH
  || join(root, "..", ".secrets", "proofodds-devnet-wallet.json");
const apiOrigin = "https://txline-dev.txodds.com";
const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const mint = new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG");

async function loadOrCreateWallet() {
  if (existsSync(walletPath)) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await readFile(walletPath, "utf8"))));
  }
  const keypair = Keypair.generate();
  await mkdir(dirname(walletPath), { recursive: true });
  await writeFile(walletPath, JSON.stringify(Array.from(keypair.secretKey)), { mode: 0o600 });
  await chmod(walletPath, 0o600);
  return keypair;
}

async function ensureDevnetSol(connection, wallet) {
  const balance = await connection.getBalance(wallet.publicKey, "confirmed");
  if (balance >= 50_000_000) return;
  console.log("Requesting devnet SOL for the isolated ProofOdds wallet...");
  const signature = await connection.requestAirdrop(wallet.publicKey, 1_000_000_000);
  const latest = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction({ signature, ...latest }, "confirmed");
}

async function guestJwt() {
  const response = await fetch(`${apiOrigin}/auth/guest/start`, { method: "POST" });
  if (!response.ok) throw new Error(`Guest auth failed (${response.status})`);
  return (await response.json()).token;
}

async function sendWithHttpConfirmation(connection, transaction, wallet) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const latest = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = latest.blockhash;
    transaction.feePayer = wallet.publicKey;
    transaction.sign(wallet);
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      maxRetries: 5,
      skipPreflight: false,
    });

    while (await connection.getBlockHeight("confirmed") <= latest.lastValidBlockHeight) {
      const status = (await connection.getSignatureStatuses([signature])).value[0];
      if (status?.err) throw new Error(`Transaction ${signature} failed: ${JSON.stringify(status.err)}`);
      if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
        return signature;
      }
      await new Promise((resolveWait) => setTimeout(resolveWait, 1_200));
    }

    console.warn(`Transaction attempt ${attempt} expired; signing again with a fresh blockhash.`);
  }
  throw new Error("Transaction could not be confirmed after three fresh blockhashes.");
}

async function main() {
  if (existsSync(envPath) && (await readFile(envPath, "utf8")).includes("TXLINE_API_TOKEN=")) {
    console.log("TxLINE is already activated in .env.local; no subscription transaction was sent.");
    return;
  }

  const wallet = await loadOrCreateWallet();
  const connection = new Connection(rpcUrl, "confirmed");
  await ensureDevnetSol(connection, wallet);

  const idl = JSON.parse(await readFile(join(root, "server", "idl", "txoracle.json"), "utf8"));
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  const program = new anchor.Program(idl, provider);
  const userTokenAccount = getAssociatedTokenAddressSync(
    mint,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
  );
  if (!(await connection.getAccountInfo(userTokenAccount, "confirmed"))) {
    const createAccount = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        userTokenAccount,
        wallet.publicKey,
        mint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
    await sendWithHttpConfirmation(connection, createAccount, wallet);
  }

  const [pricingMatrix] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    program.programId,
  );
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    program.programId,
  );
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    mint,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID,
  );

  const jwt = await guestJwt();
  const transaction = await program.methods
    .subscribe(1, 4)
    .accounts({
      user: wallet.publicKey,
      pricingMatrix,
      tokenMint: mint,
      userTokenAccount,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .transaction();
  const txSig = await sendWithHttpConfirmation(connection, transaction, wallet);

  const message = new TextEncoder().encode(`${txSig}::${jwt}`);
  const walletSignature = Buffer.from(nacl.sign.detached(message, wallet.secretKey)).toString("base64");
  const activation = await fetch(`${apiOrigin}/api/token/activate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ txSig, walletSignature, leagues: [] }),
  });
  if (!activation.ok) throw new Error(`TxLINE activation failed (${activation.status}): ${await activation.text()}`);
  const activationBody = await activation.text();
  let result;
  try {
    result = JSON.parse(activationBody);
  } catch {
    result = activationBody.trim();
  }
  const apiToken = typeof result === "string" ? result : result.token;
  if (!apiToken) throw new Error("TxLINE activation returned no API token");

  await writeFile(
    envPath,
    `TXLINE_NETWORK=devnet\nTXLINE_API_TOKEN=${apiToken}\nSOLANA_RPC_URL=${rpcUrl}\n`,
    { mode: 0o600 },
  );
  await chmod(envPath, 0o600);
  console.log(`Activated TxLINE free tier for ${wallet.publicKey.toBase58()}.`);
  console.log(`Subscription transaction: https://explorer.solana.com/tx/${txSig}?cluster=devnet`);
  console.log("Credentials were written to .env.local and will not be committed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
