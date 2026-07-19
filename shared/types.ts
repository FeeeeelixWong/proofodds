export type DataSource = "txline-live" | "txline-reference";
export type SettlementState = "verified" | "pending" | "rejected" | "reference";
export type MarketProposal = "participant-1" | "draw" | "participant-2";
export type ResolutionDecision = "settle" | "dispute" | "hold" | "reference";

export interface Fixture {
  ts: number;
  startTime: number;
  competition: string;
  competitionId: number;
  fixtureGroupId: number;
  participant1Id: number;
  participant1: string;
  participant2Id: number;
  participant2: string;
  fixtureId: number;
  participant1IsHome: boolean;
}

export interface ScoreStat {
  key: number;
  value: number;
  period: number;
}

export interface ScoreEvent {
  seq: number;
  ts: number;
  action: string;
  statusId: number;
  period: number;
  homeScore?: number;
  awayScore?: number;
  final: boolean;
}

export interface ProofNode {
  hash: number[] | string;
  isRightSibling: boolean;
}

export interface ChainEvidence {
  network: "devnet" | "mainnet";
  programId: string;
  rootAccount?: string;
  simulationStatus: "passed" | "failed" | "not-run" | "reference";
  unitsConsumed?: number;
  rpcUrl: string;
  logs?: string[];
}

export interface SettlementReceipt {
  receiptId: string;
  issuedAt: string;
  source: DataSource;
  state: SettlementState;
  fixture: Fixture;
  outcome: {
    homeScore?: number;
    awayScore?: number;
    winner: "participant-1" | "participant-2" | "draw" | "undetermined";
    final: boolean;
    sequence?: number;
  };
  resolution: {
    proposal: MarketProposal;
    decision: ResolutionDecision;
    reason: string;
  };
  proof: {
    payloadHash: string;
    eventStatRoot?: string;
    fixtureProofDepth: number;
    mainTreeProofDepth: number;
    statProofDepths: number[];
    verifiedStatKeys: number[];
  };
  chain: ChainEvidence;
  audit: {
    txlineApiOrigin: string;
    verificationMethod: "validateStatV2" | "validateFixture" | "reference";
    disclaimer: string;
  };
}

export interface FixtureFeed {
  source: DataSource;
  network: "devnet" | "mainnet";
  fetchedAt: string;
  fixtures: Fixture[];
  note?: string;
}

export interface ApiError {
  error: string;
  code?: string;
}
