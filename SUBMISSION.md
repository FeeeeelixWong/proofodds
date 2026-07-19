# ProofOdds submission

## Track

Prediction Markets and Settlement

## Project title

ProofOdds

## Brief description

ProofOdds is a verifiable soccer prediction-market resolution workbench. It ingests live or simulated TxLINE event feeds, proves final score keys against TxLINE's Solana program, and deterministically issues SETTLE, DISPUTE, or HOLD receipts that anyone can audit.

## Useful links

- Repository: https://github.com/FeeeeelixWong/proofodds
- Live MVP: deployment pending
- Demo video: upload pending

## What makes it prize-worthy

- Full TxLINE-shaped fixture and score-event ingestion, not a static mockup.
- Reproducible replay mode designed specifically for post-match judging.
- Official `validateStatV2` integration using score keys `1` and `2`.
- Solana root PDA, logs, and compute units included in the receipt.
- Pure deterministic settlement rule with stable receipt IDs.
- Explicit conflict detection demonstrates real resolution value, not only a happy path.
- Focused one-screen operator experience with downloadable evidence.

## Judge test path

1. Open the MVP in Replay mode.
2. Keep the first fixture selected and propose Draw.
3. Click `Verify and resolve` and inspect the reference receipt.
4. Change the proposal to Participant 1 and verify again.
5. Confirm that the same final score now produces a conflict result.
6. Download the JSON receipt.

Replay is intentionally labeled simulated. Configure `TXLINE_API_TOKEN` to run the same flow against the live TxLINE API and official Solana program.
