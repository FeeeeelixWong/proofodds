# Demo script (under 3 minutes)

Generate the judged video from the real product with:

```bash
DEMO_APP_URL=https://proofodds.vercel.app npm run demo:record
```

Each narration segment is synthesized separately. Its measured audio duration drives the matching visual scene, and the same timeline generates the burned-in subtitles. This keeps voice, captions, and interaction timing aligned.

Default voice: `en-US-AndrewMultilingualNeural` (warm, confident, conversational).

Outputs:

- `docs/media/proofodds-demo.mp4`
- `docs/media/proofodds-demo.srt`

## 0:00-0:18 - Problem

Voiceover:

"Prediction markets can be fast, but resolution is still often opaque. A screenshot or an admin decision does not prove which score was used. ProofOdds turns a soccer market resolution into a reproducible, inspectable receipt."

Screen: Open ProofOdds. Keep the full workspace visible.

## 0:18-0:42 - Replay-safe data ingestion

Voiceover:

"The left panel ingests World Cup fixtures. I can use live TxLINE data, or a clearly labeled simulated replay so judges can reproduce this flow after the matches end. The event tape shows each score sequence and the finalization record."

Screen: Point to `Replay`, fixture list, event tape, and `game_finalised` sequence 991.

## 0:42-1:10 - Successful resolution

Voiceover:

"This market proposes a draw. ProofOdds selects score keys one and two from the final record, obtains the Merkle path, and validates it against the TxLINE Solana program. The same inputs always produce the same resolution and receipt ID."

Screen: Select Draw. Click Verify and resolve. Scroll enough to show the decision and receipt.

## 1:10-1:35 - Audit evidence

Voiceover:

"The receipt records the data source, network, proof depth, payload hash, root account, program ID, and compute units. Operators can download the JSON and attach it to a market audit or dispute."

Screen: Highlight the receipt fields and download button.

## 1:35-1:58 - Conflict detection

Voiceover:

"Now I submit a conflicting proposal: Participant One. The proven score stays one-one, so ProofOdds deterministically returns a dispute instead of silently settling the wrong outcome."

Screen: Select Participant 1 and verify again. Show DISPUTE.

## 1:58-2:22 - Real integration

Voiceover:

"In live mode, the server calls TxLINE fixture, score, and stat-validation endpoints. It runs `validateStatV2` through the official devnet Anchor IDL and root PDA. A failed proof or a non-final event can only return HOLD."

Screen: Show Live mode, then briefly show architecture diagram or README code path.

## 2:22-2:35 - Close

Voiceover:

"ProofOdds does not hold funds or run a betting service. It gives prediction markets a transparent resolution primitive: ingest, prove, resolve."

Screen: Return to the resolved workspace and logo.

## Recording checklist

- Keep the final video below three minutes.
- Use 1920x1080 or 1440x900 capture.
- Record one continuous successful flow and one conflicting proposal.
- Voiceover must explicitly say TxLINE, simulated replay, Solana verification, deterministic, and JSON receipt.
- Burn captions from the exact narration timestamps after the voice track is final.
- Never claim replay evidence is live cryptographic verification.
