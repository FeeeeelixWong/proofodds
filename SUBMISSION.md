# ProofOdds submission

## Track

Prediction Markets and Settlement

## Project title

ProofOdds

## Brief description

ProofOdds is a verifiable soccer prediction-market resolution workbench. It ingests live or simulated TxLINE event feeds, proves final score keys against TxLINE's Solana program, and deterministically issues SETTLE, DISPUTE, or HOLD receipts that anyone can audit.

## Useful links

- Repository: https://github.com/FeeeeelixWong/proofodds
- Live MVP: https://proofodds.vercel.app
- Demo video: generated locally; YouTube upload pending

## What makes it prize-worthy

- Full TxLINE-shaped fixture and score-event ingestion, not a static mockup.
- Reproducible replay mode designed specifically for post-match judging.
- Official `validateStatV2` integration using score keys `1` and `2`.
- Solana root PDA, logs, and compute units included in the receipt.
- Pure deterministic settlement rule with stable receipt IDs.
- Explicit conflict detection demonstrates real resolution value, not only a happy path.
- Focused one-screen operator experience with downloadable evidence.
- Public live proof: fixture `18257865`, final sequence `1195`, score `4:6`, root PDA `C9vY83pzub2a4d3Qve5NuR4cuXc8Yq68fKRRad4xR4bi`, and `185,933` compute units.

## Judge test path

1. Open the MVP in Replay mode; completed fixture `18257865` is selected for reproducibility.
2. Propose Participant 2 and click `Verify and resolve`.
3. Confirm `SOLANA VERIFIED`, score `4:6`, and decision `SETTLE`.
4. Change the proposal to Participant 1 and verify again.
5. Confirm that the same valid proof now produces `DISPUTE`.
6. Download the JSON receipt.

The production deployment is connected to TxLINE devnet. If the upstream service is unavailable, the app visibly falls back to a non-authoritative simulated reference instead of claiming live verification.
