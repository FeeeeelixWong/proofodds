import type { Fixture, MarketProposal, SettlementReceipt } from "../shared/types.js";
import { sha256 } from "./hash.js";
import { txlineConfig } from "./config.js";
import { resolveMarket } from "./resolution.js";

interface ReceiptInput {
  fixture: Fixture;
  sequence?: number;
  stats?: Array<{ key: number; value: number; period: number }>;
  proofPayload: Record<string, any>;
  chain: SettlementReceipt["chain"];
  method: SettlementReceipt["audit"]["verificationMethod"];
  final: boolean;
  proposal: MarketProposal;
}

export function createReceipt(input: ReceiptInput): SettlementReceipt {
  const homeScore = input.stats?.find((stat) => stat.key === 1)?.value;
  const awayScore = input.stats?.find((stat) => stat.key === 2)?.value;
  const payloadHash = sha256(input.proofPayload);
  const issuedAt = new Date().toISOString();
  const resolution = resolveMarket({
    proofPassed: input.chain.simulationStatus === "passed",
    final: input.final,
    homeScore,
    awayScore,
    proposal: input.proposal,
  });
  const receiptKey = {
    fixtureId: input.fixture.fixtureId,
    sequence: input.sequence,
    payloadHash,
    proposal: input.proposal,
    decision: resolution.decision,
    programId: input.chain.programId,
  };

  return {
    receiptId: `po_${sha256(receiptKey).slice(0, 20)}`,
    issuedAt,
    source: "txline-live",
    state: resolution.state,
    fixture: input.fixture,
    outcome: {
      homeScore,
      awayScore,
      winner: resolution.winner,
      final: input.final,
      sequence: input.sequence,
    },
    resolution: {
      proposal: input.proposal,
      decision: resolution.decision,
      reason: resolution.reason,
    },
    proof: {
      payloadHash,
      eventStatRoot: input.proofPayload.eventStatRoot
        ? sha256(input.proofPayload.eventStatRoot)
        : undefined,
      fixtureProofDepth: input.proofPayload.subTreeProof?.length || 0,
      mainTreeProofDepth: input.proofPayload.mainTreeProof?.length || 0,
      statProofDepths: (input.proofPayload.statProofs || []).map((proof: unknown[]) => proof.length),
      verifiedStatKeys: input.stats?.map((stat) => stat.key) || [],
    },
    chain: input.chain,
    audit: {
      txlineApiOrigin: txlineConfig.apiOrigin,
      verificationMethod: input.method,
      disclaimer: "ProofOdds verifies data provenance and settlement inputs; it does not operate a wagering service.",
    },
  };
}
