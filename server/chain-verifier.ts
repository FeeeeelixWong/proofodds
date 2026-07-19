import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { ComputeBudgetProgram, Connection, Keypair, PublicKey } from "@solana/web3.js";
import type { ChainEvidence, ProofNode, ScoreStat } from "../shared/types.js";
import txoracleIdl from "./idl/txoracle.json";
import { normalizeProof, toBytes32 } from "./normalize.js";
import { txlineConfig } from "./config.js";

interface FixtureProofPayload {
  snapshot: Record<string, any>;
  summary: Record<string, any>;
  subTreeProof: ProofNode[];
  mainTreeProof: ProofNode[];
}

interface ScoreProofPayload {
  summary: Record<string, any>;
  subTreeProof: ProofNode[];
  mainTreeProof: ProofNode[];
  eventStatRoot: number[] | string;
  statsToProve: ScoreStat[];
  statProofs: ProofNode[][];
}

function createProgram() {
  if (txlineConfig.network !== "devnet") {
    throw new Error("This build ships the official devnet IDL; set TXLINE_NETWORK=devnet.");
  }

  const connection = new Connection(txlineConfig.rpcUrl, "confirmed");
  const wallet = new anchor.Wallet(Keypair.generate());
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  const program = new Program(txoracleIdl as anchor.Idl, provider);

  if (program.programId.toBase58() !== txlineConfig.programId) {
    throw new Error("TxLINE IDL and configured program ID do not match");
  }
  return { connection, wallet, program };
}

async function simulateAndView(
  builder: any,
  connection: Connection,
  feePayer: PublicKey,
): Promise<{ passed: boolean; unitsConsumed?: number; logs: string[] }> {
  const passed = Boolean(await builder.view());
  const tx = await builder.transaction();
  tx.feePayer = feePayer;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  const simulation = await connection.simulateTransaction(tx);
  if (simulation.value.err) {
    throw new Error(`Solana simulation failed: ${JSON.stringify(simulation.value.err)}`);
  }
  return {
    passed,
    unitsConsumed: simulation.value.unitsConsumed ?? undefined,
    logs: (simulation.value.logs || []).slice(-10),
  };
}

function chainEvidence(
  status: ChainEvidence["simulationStatus"],
  rootAccount?: string,
  unitsConsumed?: number,
  logs?: string[],
): ChainEvidence {
  return {
    network: txlineConfig.network,
    programId: txlineConfig.programId,
    rootAccount,
    simulationStatus: status,
    unitsConsumed,
    rpcUrl: txlineConfig.rpcUrl,
    logs,
  };
}

export async function verifyFixtureOnChain(payload: FixtureProofPayload): Promise<ChainEvidence> {
  try {
    const { connection, wallet, program } = createProgram();
    const snapshot = {
      ts: new BN(payload.snapshot.Ts ?? payload.snapshot.ts),
      startTime: new BN(payload.snapshot.StartTime ?? payload.snapshot.startTime),
      competition: payload.snapshot.Competition ?? payload.snapshot.competition,
      competitionId: payload.snapshot.CompetitionId ?? payload.snapshot.competitionId,
      fixtureGroupId: payload.snapshot.FixtureGroupId ?? payload.snapshot.fixtureGroupId,
      participant1Id: payload.snapshot.Participant1Id ?? payload.snapshot.participant1Id,
      participant1: payload.snapshot.Participant1 ?? payload.snapshot.participant1,
      participant2Id: payload.snapshot.Participant2Id ?? payload.snapshot.participant2Id,
      participant2: payload.snapshot.Participant2 ?? payload.snapshot.participant2,
      fixtureId: new BN(payload.snapshot.FixtureId ?? payload.snapshot.fixtureId),
      participant1IsHome: payload.snapshot.Participant1IsHome ?? payload.snapshot.participant1IsHome,
    };
    const summary = {
      fixtureId: new BN(payload.summary.fixtureId),
      competitionId: payload.summary.competitionId,
      competition: payload.summary.competition,
      updateStats: {
        updateCount: payload.summary.updateStats.updateCount,
        minTimestamp: new BN(payload.summary.updateStats.minTimestamp),
        maxTimestamp: new BN(payload.summary.updateStats.maxTimestamp),
      },
      updateSubTreeRoot: toBytes32(payload.summary.updateSubTreeRoot),
    };

    const ts = Number(payload.snapshot.Ts ?? payload.snapshot.ts);
    const epochDay = Math.floor(ts / 86_400_000);
    const windowStart = Math.floor(epochDay / 10) * 10;
    const windowBuffer = Buffer.alloc(2);
    windowBuffer.writeUInt16LE(windowStart, 0);
    const [rootAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("ten_daily_fixtures_roots"), windowBuffer],
      program.programId,
    );
    const builder = program.methods
      .validateFixture(
        snapshot,
        summary,
        normalizeProof(payload.subTreeProof),
        normalizeProof(payload.mainTreeProof),
      )
      .accounts({ tenDailyFixturesRoots: rootAccount })
      .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 })]);
    const result = await simulateAndView(builder, connection, wallet.publicKey);
    return chainEvidence(
      result.passed ? "passed" : "failed",
      rootAccount.toBase58(),
      result.unitsConsumed,
      result.logs,
    );
  } catch (error) {
    return chainEvidence("failed", undefined, undefined, [error instanceof Error ? error.message : String(error)]);
  }
}

export async function verifyScoresOnChain(payload: ScoreProofPayload): Promise<ChainEvidence> {
  try {
    const { connection, wallet, program } = createProgram();
    const targetTs = Number(payload.summary.updateStats.minTimestamp);
    const epochDay = Math.floor(targetTs / 86_400_000);
    const epochBuffer = new BN(epochDay).toArrayLike(Buffer, "le", 2);
    const [rootAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("daily_scores_roots"), epochBuffer],
      program.programId,
    );

    const normalizedStats = payload.statsToProve.map((stat) => ({
      key: Number(stat.key),
      value: Number(stat.value),
      period: Number(stat.period),
    }));
    const validationInput = {
      ts: new BN(targetTs),
      fixtureSummary: {
        fixtureId: new BN(payload.summary.fixtureId),
        updateStats: {
          updateCount: payload.summary.updateStats.updateCount,
          minTimestamp: new BN(payload.summary.updateStats.minTimestamp),
          maxTimestamp: new BN(payload.summary.updateStats.maxTimestamp),
        },
        eventsSubTreeRoot: toBytes32(payload.summary.eventStatsSubTreeRoot),
      },
      fixtureProof: normalizeProof(payload.subTreeProof),
      mainTreeProof: normalizeProof(payload.mainTreeProof),
      eventStatRoot: toBytes32(payload.eventStatRoot),
      stats: normalizedStats.map((stat, index) => ({
        stat,
        statProof: normalizeProof(payload.statProofs[index]),
      })),
    };
    const strategy = {
      geometricTargets: [],
      distancePredicate: null,
      discretePredicates: normalizedStats.map((stat, index) => ({
        single: {
          index,
          predicate: { threshold: stat.value, comparison: { equalTo: {} } },
        },
      })),
    };
    const builder = program.methods
      .validateStatV2(validationInput, strategy)
      .accounts({ dailyScoresMerkleRoots: rootAccount })
      .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })]);
    const result = await simulateAndView(builder, connection, wallet.publicKey);
    return chainEvidence(
      result.passed ? "passed" : "failed",
      rootAccount.toBase58(),
      result.unitsConsumed,
      result.logs,
    );
  } catch (error) {
    return chainEvidence("failed", undefined, undefined, [error instanceof Error ? error.message : String(error)]);
  }
}
