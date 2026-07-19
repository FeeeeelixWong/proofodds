import { describe, expect, it } from "vitest";
import { canonicalJson, sha256 } from "../server/hash";

describe("canonical receipts", () => {
  it("hashes objects independently of key order", () => {
    expect(sha256({ b: 2, a: 1 })).toBe(sha256({ a: 1, b: 2 }));
  });

  it("keeps array order because proof paths are positional", () => {
    expect(canonicalJson({ proof: ["a", "b"] })).not.toBe(
      canonicalJson({ proof: ["b", "a"] }),
    );
  });
});
