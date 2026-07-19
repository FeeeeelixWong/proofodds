import type { Fixture, ScoreEvent, SettlementReceipt } from "./types.js";

export const referenceFixtures: Fixture[] = [
  {
    ts: 1784415600000,
    startTime: 1784412000000,
    competition: "TxLINE World Cup reference flow",
    competitionId: 500001,
    fixtureGroupId: 1,
    participant1Id: 101,
    participant1: "Participant 1",
    participant2Id: 102,
    participant2: "Participant 2",
    fixtureId: 18175981,
    participant1IsHome: true,
  },
  {
    ts: 1784329200000,
    startTime: 1784325600000,
    competition: "TxLINE World Cup reference flow",
    competitionId: 500001,
    fixtureGroupId: 1,
    participant1Id: 201,
    participant1: "Participant 1",
    participant2Id: 202,
    participant2: "Participant 2",
    fixtureId: 18179550,
    participant1IsHome: true,
  },
];

export const referenceReceipt: SettlementReceipt = {
  receiptId: "po_ref_18175981_991",
  issuedAt: "2026-07-19T04:00:00.000Z",
  source: "txline-reference",
  state: "reference",
  fixture: referenceFixtures[0],
  outcome: {
    homeScore: 1,
    awayScore: 1,
    winner: "draw",
    final: true,
    sequence: 991,
  },
  resolution: {
    proposal: "draw",
    decision: "reference",
    reason: "Reference replay matches a draw; run live verification before settling a market.",
  },
  proof: {
    payloadHash: "reference-only-run-live-verification-for-cryptographic-assurance",
    eventStatRoot: "TxLINE reference payload",
    fixtureProofDepth: 8,
    mainTreeProofDepth: 4,
    statProofDepths: [3, 3],
    verifiedStatKeys: [1, 2],
  },
  chain: {
    network: "devnet",
    programId: "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J",
    simulationStatus: "reference",
    rpcUrl: "https://api.devnet.solana.com",
  },
  audit: {
    txlineApiOrigin: "https://txline-dev.txodds.com",
    verificationMethod: "reference",
    disclaimer: "Reference mode is clearly labeled and is not a live cryptographic verification.",
  },
};

export const referenceScoreEvents: Record<number, ScoreEvent[]> = {
  18175981: [
    { seq: 1, ts: 1784412000000, action: "game_started", statusId: 10, period: 1, homeScore: 0, awayScore: 0, final: false },
    { seq: 327, ts: 1784413980000, action: "score_update", statusId: 20, period: 1, homeScore: 1, awayScore: 0, final: false },
    { seq: 688, ts: 1784416680000, action: "score_update", statusId: 30, period: 2, homeScore: 1, awayScore: 1, final: false },
    { seq: 991, ts: 1784418300000, action: "game_finalised", statusId: 100, period: 100, homeScore: 1, awayScore: 1, final: true },
  ],
  18179550: [
    { seq: 1, ts: 1784325600000, action: "game_started", statusId: 10, period: 1, homeScore: 0, awayScore: 0, final: false },
    { seq: 991, ts: 1784331900000, action: "game_finalised", statusId: 100, period: 100, homeScore: 2, awayScore: 1, final: true },
  ],
};
