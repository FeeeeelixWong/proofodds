import type {
  FixtureFeed,
  MarketProposal,
  ScoreEvent,
  ScoreStat,
  SettlementReceipt,
} from "../shared/types.js";
import { referenceFixtures, referenceReceipt, referenceScoreEvents } from "../shared/reference.js";
import { hasLiveCredentials, txlineConfig } from "./config.js";
import { verifyFixtureOnChain, verifyScoresOnChain } from "./chain-verifier.js";
import { normalizeFixture, normalizeScoreEvent, normalizeStat } from "./normalize.js";
import { createReceipt } from "./receipt.js";
import { txlineGet } from "./txline-client.js";

function applyReferenceProposal(proposal: MarketProposal): SettlementReceipt {
  const matches = proposal === referenceReceipt.outcome.winner;
  return {
    ...referenceReceipt,
    issuedAt: new Date().toISOString(),
    resolution: {
      proposal,
      decision: "reference",
      reason: matches
        ? "Reference replay agrees with the proposal. Configure TxLINE credentials for settlement authority."
        : "Reference replay conflicts with the proposal. Configure TxLINE credentials for a live dispute receipt.",
    },
  };
}

export async function listFixtures(startEpochDay?: number): Promise<FixtureFeed> {
  if (!hasLiveCredentials) {
    return {
      source: "txline-reference",
      network: txlineConfig.network,
      fetchedAt: new Date().toISOString(),
      fixtures: referenceFixtures,
      note: "Set TXLINE_API_TOKEN to switch this deployment to live TxLINE data.",
    };
  }

  const query = startEpochDay ? `?startEpochDay=${startEpochDay}` : "";
  const response = await txlineGet<Array<Record<string, any>>>(`/fixtures/snapshot${query}`);
  return {
    source: "txline-live",
    network: txlineConfig.network,
    fetchedAt: new Date().toISOString(),
    fixtures: response.map(normalizeFixture),
  };
}

export async function listScoreEvents(fixtureId: number): Promise<ScoreEvent[]> {
  if (!hasLiveCredentials) return referenceScoreEvents[fixtureId] || [];
  const events = await txlineGet<Array<Record<string, any>>>(`/scores/snapshot/${fixtureId}`);
  return events.map(normalizeScoreEvent).sort((left, right) => left.seq - right.seq);
}

function scoreEventFinal(event: Record<string, any>): boolean {
  const action = String(event.action ?? event.Action ?? "").toLowerCase();
  const status = Number(event.statusId ?? event.StatusId);
  const period = Number(event.period ?? event.Period ?? event.data?.period);
  return action === "game_finalised" || (status === 100 && period === 100);
}

export async function verifySettlement(
  fixtureId: number,
  proposal: MarketProposal,
  timestamp?: number,
): Promise<SettlementReceipt> {
  if (!hasLiveCredentials) return applyReferenceProposal(proposal);

  const fixtureProof = await txlineGet<Record<string, any>>(
    `/fixtures/validation?fixtureId=${fixtureId}${timestamp ? `&timestamp=${timestamp}` : ""}`,
  );
  const fixture = normalizeFixture(fixtureProof.snapshot);
  const scoreEvents = await txlineGet<Array<Record<string, any>>>(`/scores/snapshot/${fixtureId}`);
  const selectedEvent = [...scoreEvents].reverse().find(scoreEventFinal) || scoreEvents.at(-1);

  if (!selectedEvent) {
    const chain = await verifyFixtureOnChain(fixtureProof as any);
    return createReceipt({
      fixture,
      proofPayload: fixtureProof,
      chain,
      method: "validateFixture",
      final: false,
      proposal,
    });
  }

  const sequence = Number(selectedEvent.seq ?? selectedEvent.Seq);
  const final = scoreEventFinal(selectedEvent);
  const scoreProof = await txlineGet<Record<string, any>>(
    `/scores/stat-validation?fixtureId=${fixtureId}&seq=${sequence}&statKeys=1,2`,
  );
  const stats: ScoreStat[] = (scoreProof.statsToProve || []).map(normalizeStat);
  const chain = await verifyScoresOnChain({ ...scoreProof, statsToProve: stats } as any);
  return createReceipt({
    fixture,
    sequence,
    stats,
    proofPayload: scoreProof,
    chain,
    method: "validateStatV2",
    final,
    proposal,
  });
}
