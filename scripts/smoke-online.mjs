import assert from "node:assert/strict";

const origin = process.env.PROOFODDS_ORIGIN || "https://proofodds.vercel.app";

async function json(path) {
  const response = await fetch(`${origin}${path}`);
  const body = await response.text();
  assert.equal(response.ok, true, `${path} returned ${response.status}: ${body.slice(0, 240)}`);
  return JSON.parse(body);
}

const health = await json("/api/health");
assert.equal(health.ok, true);
assert.equal(health.service, "proofodds");

const startEpochDay = Math.floor((Date.now() - 21 * 86_400_000) / 86_400_000);
const feed = await json(`/api/txline?action=fixtures&startEpochDay=${startEpochDay}`);
assert.ok(feed.fixtures.length > 0, "fixture feed is empty");
let selected;
for (const fixture of feed.fixtures) {
  const events = await json(`/api/txline?action=events&fixtureId=${fixture.fixtureId}`);
  const finalEvent = events.find((event) => event.final);
  if (finalEvent) {
    selected = { fixture, events, finalEvent };
    break;
  }
}
assert.ok(selected, "no fixture with a final score event was observed");

const fixtureId = selected.fixture.fixtureId;
const proposal = selected.finalEvent.homeScore === selected.finalEvent.awayScore
  ? "draw"
  : selected.finalEvent.homeScore > selected.finalEvent.awayScore
    ? "participant-1"
    : "participant-2";
const receipt = await json(`/api/txline?action=verify&fixtureId=${fixtureId}&proposal=${proposal}`);
assert.equal(receipt.fixture.fixtureId, fixtureId);
assert.ok(receipt.receiptId.startsWith("po_"), "receipt ID is malformed");
assert.ok(["settle", "dispute", "hold", "reference"].includes(receipt.resolution.decision));
if (health.source === "txline-live") {
  assert.equal(receipt.source, "txline-live");
  assert.equal(receipt.chain.simulationStatus, "passed");
  assert.equal(receipt.resolution.decision, "settle");
  assert.equal(receipt.audit.verificationMethod, "validateStatV2");
}

console.log(JSON.stringify({
  origin,
  source: health.source,
  fixtureId,
  finalSequence: selected.finalEvent.seq,
  score: `${selected.finalEvent.homeScore}:${selected.finalEvent.awayScore}`,
  proposal,
  receiptId: receipt.receiptId,
  decision: receipt.resolution.decision,
  simulation: receipt.chain.simulationStatus,
  unitsConsumed: receipt.chain.unitsConsumed,
}, null, 2));
