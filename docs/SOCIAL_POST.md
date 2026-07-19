# ProofOdds X launch post

## Main post

Prediction markets shouldn’t settle on one API response. Results should be reproducible.

Meet ProofOdds, built for the @TXODDSOfficial World Cup Hackathon.

TxLINE → @solana verification → deterministic SETTLE / DISPUTE / HOLD receipts.

Prediction Markets & Settlement.

## First reply

Try it: https://proofodds.vercel.app

Watch: [PASTE YOUTUBE DEMO URL]

Code: https://github.com/FeeeeelixWong/proofodds

Built with TxLINE data and Solana devnet, submitted through @SuperteamEarn.

## Optional technical reply

Same verified evidence. Two proposals.

England → SETTLE

France → DISPUTE

The Solana proof stays verified; only the deterministic market decision changes. Every run exports a portable JSON receipt with source, payload hash, proof depth, root account, program ID, and compute units.

## Image order

1. `01-proofodds-cover.png`
2. `02-proofodds-settle.png`
3. `03-proofodds-dispute.png`
4. `04-proofodds-logic.png`

## Suggested alt text

1. ProofOdds cover: Markets should settle on proof, showing the TxLINE-to-Solana-to-receipt pipeline.
2. ProofOdds settlement workbench showing a TxLINE-connected final France 4–6 England result, Solana-verified evidence, and a SETTLE decision.
3. The same verified match evidence with a conflicting France proposal, producing a deterministic DISPUTE decision.
4. ProofOdds decision logic: SETTLE for a verified match, DISPUTE for a verified conflict, and HOLD for missing finality or failed verification.
