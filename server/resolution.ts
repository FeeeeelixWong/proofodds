import type {
  MarketProposal,
  ResolutionDecision,
  SettlementState,
} from "../shared/types";

export type ProvenWinner = MarketProposal | "undetermined";

interface ResolutionInput {
  proofPassed: boolean;
  final: boolean;
  homeScore?: number;
  awayScore?: number;
  proposal: MarketProposal;
}

export interface ResolutionResult {
  winner: ProvenWinner;
  state: SettlementState;
  decision: ResolutionDecision;
  reason: string;
}

export function winnerFromScores(homeScore?: number, awayScore?: number): ProvenWinner {
  if (homeScore === undefined || awayScore === undefined) return "undetermined";
  if (homeScore === awayScore) return "draw";
  return homeScore > awayScore ? "participant-1" : "participant-2";
}

export function resolveMarket(input: ResolutionInput): ResolutionResult {
  const winner = winnerFromScores(input.homeScore, input.awayScore);
  const state: SettlementState = input.proofPassed
    ? input.final ? "verified" : "pending"
    : "rejected";
  const decision: ResolutionDecision = !input.proofPassed || !input.final
    ? "hold"
    : winner === input.proposal
      ? "settle"
      : "dispute";
  const reason = decision === "settle"
    ? "The proposed outcome matches the final TxLINE score proven against Solana."
    : decision === "dispute"
      ? "The proposed outcome conflicts with the final TxLINE score proven against Solana."
      : "The market remains on hold until a final score has a valid Solana proof.";

  return { winner, state, decision, reason };
}
