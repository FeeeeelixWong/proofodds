import type { Fixture, ProofNode, ScoreEvent, ScoreStat } from "../shared/types.js";

export function normalizeFixture(input: Record<string, any>): Fixture {
  return {
    ts: Number(input.Ts ?? input.ts),
    startTime: Number(input.StartTime ?? input.startTime),
    competition: String(input.Competition ?? input.competition ?? "World Cup"),
    competitionId: Number(input.CompetitionId ?? input.competitionId),
    fixtureGroupId: Number(input.FixtureGroupId ?? input.fixtureGroupId),
    participant1Id: Number(input.Participant1Id ?? input.participant1Id),
    participant1: String(input.Participant1 ?? input.participant1 ?? "Participant 1"),
    participant2Id: Number(input.Participant2Id ?? input.participant2Id),
    participant2: String(input.Participant2 ?? input.participant2 ?? "Participant 2"),
    fixtureId: Number(input.FixtureId ?? input.fixtureId),
    participant1IsHome: Boolean(input.Participant1IsHome ?? input.participant1IsHome),
  };
}

export function normalizeProof(nodes: ProofNode[] | undefined): Array<{ hash: number[]; isRightSibling: boolean }> {
  return (nodes || []).map((node) => ({
    hash: toBytes32(node.hash),
    isRightSibling: node.isRightSibling,
  }));
}

export function toBytes32(value: number[] | string): number[] {
  const bytes = Array.isArray(value)
    ? Uint8Array.from(value)
    : value.startsWith("0x")
      ? Buffer.from(value.slice(2), "hex")
      : Buffer.from(value, "base64");
  if (bytes.length !== 32) throw new Error(`Expected 32 proof bytes, received ${bytes.length}`);
  return Array.from(bytes);
}

export function normalizeStat(input: Record<string, any>): ScoreStat {
  const stat = input.stat || input;
  return {
    key: Number(stat.key ?? stat.Key),
    value: Number(stat.value ?? stat.Value),
    period: Number(stat.period ?? stat.Period),
  };
}

function scoreFromRecord(record: Record<string, any>, key: number): number | undefined {
  const stats = record.stats ?? record.Stats ?? record.data?.stats ?? record.Data?.Stats ?? [];
  if (Array.isArray(stats)) {
    const stat = stats.find((item) => Number(item.key ?? item.Key ?? item.statKey ?? item.StatKey) === key);
    const value = stat?.value ?? stat?.Value;
    return value === undefined ? undefined : Number(value);
  }
  const value = stats[key] ?? stats[String(key)];
  return value === undefined ? undefined : Number(value);
}

export function normalizeScoreEvent(record: Record<string, any>): ScoreEvent {
  const action = String(record.action ?? record.Action ?? "score_update");
  const statusId = Number(record.statusId ?? record.StatusId ?? 0);
  const period = Number(record.period ?? record.Period ?? record.data?.period ?? 0);
  return {
    seq: Number(record.seq ?? record.Seq ?? 0),
    ts: Number(record.ts ?? record.Ts ?? Date.now()),
    action,
    statusId,
    period,
    homeScore: scoreFromRecord(record, 1),
    awayScore: scoreFromRecord(record, 2),
    final: action.toLowerCase() === "game_finalised" || (statusId === 100 && period === 100),
  };
}
