import { describe, expect, it } from "vitest";
import { createReceipt } from "../server/receipt";
import { referenceFixtures } from "../shared/reference";

const chain = {
  network: "devnet" as const,
  programId: "program",
  simulationStatus: "passed" as const,
  rpcUrl: "https://api.devnet.solana.com",
};

describe("deterministic market resolution", () => {
  it("settles a proposal that matches proven scores", () => {
    const receipt = createReceipt({
      fixture: referenceFixtures[0],
      stats: [{ key: 1, value: 2, period: 100 }, { key: 2, value: 1, period: 100 }],
      proofPayload: { proof: "valid" },
      chain,
      method: "validateStatV2",
      final: true,
      proposal: "participant-1",
    });
    expect(receipt.resolution.decision).toBe("settle");
  });

  it("disputes a proposal that conflicts with proven scores", () => {
    const receipt = createReceipt({
      fixture: referenceFixtures[0],
      stats: [{ key: 1, value: 2, period: 100 }, { key: 2, value: 1, period: 100 }],
      proofPayload: { proof: "valid" },
      chain,
      method: "validateStatV2",
      final: true,
      proposal: "draw",
    });
    expect(receipt.resolution.decision).toBe("dispute");
  });

  it("holds any proposal before the final event", () => {
    const receipt = createReceipt({
      fixture: referenceFixtures[0],
      proofPayload: { proof: "valid" },
      chain,
      method: "validateFixture",
      final: false,
      proposal: "participant-2",
    });
    expect(receipt.resolution.decision).toBe("hold");
  });

  it("issues the same receipt ID for the same proof and proposal", () => {
    const input = {
      fixture: referenceFixtures[0],
      sequence: 991,
      stats: [{ key: 1, value: 1, period: 100 }, { key: 2, value: 1, period: 100 }],
      proofPayload: { root: [1, 2, 3], proof: ["left", "right"] },
      chain,
      method: "validateStatV2" as const,
      final: true,
      proposal: "draw" as const,
    };
    expect(createReceipt(input).receiptId).toBe(createReceipt(input).receiptId);
  });
});
