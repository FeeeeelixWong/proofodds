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

const feed = await json("/api/txline?action=fixtures");
assert.ok(feed.fixtures.length > 0, "fixture feed is empty");
const fixtureId = feed.fixtures[0].fixtureId;

const events = await json(`/api/txline?action=events&fixtureId=${fixtureId}`);
assert.ok(events.length > 0, "score event tape is empty");
assert.ok(events.some((event) => event.final), "no final score event was observed");

const receipt = await json(`/api/txline?action=verify&fixtureId=${fixtureId}&proposal=draw`);
assert.equal(receipt.fixture.fixtureId, fixtureId);
assert.ok(receipt.receiptId.startsWith("po_"), "receipt ID is malformed");
assert.ok(["settle", "dispute", "hold", "reference"].includes(receipt.resolution.decision));

console.log(JSON.stringify({
  origin,
  source: health.source,
  fixtureId,
  finalSequence: events.find((event) => event.final)?.seq,
  receiptId: receipt.receiptId,
  decision: receipt.resolution.decision,
}, null, 2));
