import {
  Activity,
  AlertTriangle,
  Braces,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  Copy,
  Download,
  FileCheck2,
  Goal,
  Radio,
  RefreshCw,
  Scale,
  ServerCog,
  ShieldCheck,
  SquareArrowOutUpRight,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { referenceFixtures, referenceReceipt, referenceScoreEvents } from "../shared/reference";
import type {
  Fixture,
  FixtureFeed,
  MarketProposal,
  ScoreEvent,
  SettlementReceipt,
} from "../shared/types";

type FeedMode = "live" | "replay";
const judgingFixtureId = 18257865;

const referenceFeed: FixtureFeed = {
  source: "txline-reference",
  network: "devnet",
  fetchedAt: new Date().toISOString(),
  fixtures: referenceFixtures,
  note: "API unavailable. Showing the clearly labeled replay reference.",
};

function short(value: string | undefined, lead = 8, tail = 6) {
  if (!value) return "Not available";
  return value.length > lead + tail + 3
    ? `${value.slice(0, lead)}...${value.slice(-tail)}`
    : value;
}

function fixtureTime(timestamp: number) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(timestamp));
}

function proposalName(proposal: MarketProposal, fixture: Fixture) {
  if (proposal === "draw") return "Draw";
  return proposal === "participant-1" ? fixture.participant1 : fixture.participant2;
}

function outcomeName(receipt: SettlementReceipt) {
  if (receipt.outcome.winner === "draw") return "Draw";
  if (receipt.outcome.winner === "participant-1") return receipt.fixture.participant1;
  if (receipt.outcome.winner === "participant-2") return receipt.fixture.participant2;
  return "Pending";
}

function eventName(action: string) {
  return action.replaceAll("_", " ");
}

function verificationLabel(receipt: SettlementReceipt) {
  if (receipt.chain.simulationStatus === "passed") return "SOLANA VERIFIED";
  if (receipt.chain.simulationStatus === "reference") return "REPLAY REFERENCE";
  return "PROOF REJECTED";
}

function App() {
  const [feed, setFeed] = useState<FixtureFeed>(referenceFeed);
  const [selectedId, setSelectedId] = useState<number>(referenceFixtures[0].fixtureId);
  const [proposal, setProposal] = useState<MarketProposal>("draw");
  const [mode, setMode] = useState<FeedMode>("replay");
  const [receipt, setReceipt] = useState<SettlementReceipt>();
  const [events, setEvents] = useState<ScoreEvent[]>(referenceScoreEvents[referenceFixtures[0].fixtureId]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);

  const loadFixtures = useCallback(async () => {
    setLoadingFeed(true);
    setError(undefined);
    try {
      const replayStart = Math.floor((Date.now() - 21 * 86_400_000) / 86_400_000);
      const query = mode === "replay" ? `&startEpochDay=${replayStart}` : "";
      const response = await fetch(`/api/txline?action=fixtures${query}`);
      if (!response.ok) throw new Error(await response.text());
      const nextFeed = await response.json() as FixtureFeed;
      if (!nextFeed.fixtures.length) throw new Error("TxLINE returned no fixtures for this window");
      setFeed(nextFeed);
      setSelectedId((current) => {
        const preferred = mode === "replay"
          ? nextFeed.fixtures.find((item) => item.fixtureId === judgingFixtureId)
          : undefined;
        if (preferred) return preferred.fixtureId;
        return nextFeed.fixtures.some((item) => item.fixtureId === current)
          ? current
          : nextFeed.fixtures[0].fixtureId;
      });
    } catch {
      setFeed(referenceFeed);
      setSelectedId(referenceFixtures[0].fixtureId);
    } finally {
      setLoadingFeed(false);
    }
  }, [mode]);

  useEffect(() => {
    void loadFixtures();
  }, [loadFixtures]);

  useEffect(() => {
    let active = true;
    async function loadEvents() {
      try {
        const response = await fetch(`/api/txline?action=events&fixtureId=${selectedId}`);
        if (!response.ok) throw new Error("Event feed unavailable");
        const nextEvents = await response.json() as ScoreEvent[];
        if (active) setEvents(nextEvents);
      } catch {
        if (active) setEvents(referenceScoreEvents[selectedId] || []);
      }
    }
    void loadEvents();
    return () => { active = false; };
  }, [selectedId, feed.source]);

  const fixture = useMemo(
    () => feed.fixtures.find((item) => item.fixtureId === selectedId) || feed.fixtures[0],
    [feed.fixtures, selectedId],
  );

  async function verify() {
    if (!fixture) return;
    setVerifying(true);
    setError(undefined);
    setReceipt(undefined);
    try {
      const params = new URLSearchParams({
        action: "verify",
        fixtureId: String(fixture.fixtureId),
        proposal,
      });
      if (mode === "replay") params.set("timestamp", String(fixture.ts));
      const response = await fetch(`/api/txline?${params.toString()}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Verification failed");
      setReceipt(body as SettlementReceipt);
    } catch (requestError) {
      if (feed.source === "txline-reference") {
        setReceipt({
          ...referenceReceipt,
          receiptId: `${referenceReceipt.receiptId}_${proposal}`,
          issuedAt: new Date().toISOString(),
          resolution: {
            proposal,
            decision: "reference",
            reason: proposal === referenceReceipt.outcome.winner
              ? "Reference replay agrees with this proposal."
              : "Reference replay conflicts with this proposal.",
          },
        });
      } else {
        setError(requestError instanceof Error ? requestError.message : "Verification failed");
      }
    } finally {
      setVerifying(false);
    }
  }

  function downloadReceipt() {
    if (!receipt) return;
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${receipt.receiptId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copyReceiptId() {
    if (!receipt) return;
    await navigator.clipboard.writeText(receipt.receiptId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  const decision = receipt?.resolution.decision;
  const referenceConflict = decision === "reference"
    && receipt?.resolution.proposal !== receipt?.outcome.winner;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><ShieldCheck size={19} strokeWidth={2.4} /></span>
          <span>ProofOdds</span>
        </div>
        <div className="topbar-center">
          <div className="mode-switch" aria-label="Feed mode">
            <button className={mode === "live" ? "active" : ""} onClick={() => setMode("live")}>
              <Radio size={14} /> Live
            </button>
            <button className={mode === "replay" ? "active" : ""} onClick={() => setMode("replay")}>
              <Clock3 size={14} /> Replay
            </button>
          </div>
        </div>
        <div className={`source-status ${feed.source === "txline-live" ? "live" : "reference"}`}>
          <span className="status-dot" />
          {feed.source === "txline-live" ? "TxLINE connected" : "Reference mode"}
          <span className="network-tag">{feed.network}</span>
        </div>
      </header>

      <main className="workspace">
        <aside className="fixture-panel">
          <div className="panel-title-row">
            <div>
              <span className="panel-kicker">WORLD CUP</span>
              <h1>Fixtures</h1>
            </div>
            <button className="icon-button" onClick={() => void loadFixtures()} title="Refresh fixtures">
              <RefreshCw size={17} className={loadingFeed ? "spin" : ""} />
            </button>
          </div>
          <div className="feed-meta">
            <Activity size={14} /> {feed.fixtures.length} records
            <span>{new Date(feed.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <div className="fixture-list">
            {feed.fixtures.map((item) => (
              <button
                key={item.fixtureId}
                className={`fixture-row ${item.fixtureId === fixture?.fixtureId ? "selected" : ""}`}
                onClick={() => {
                  setSelectedId(item.fixtureId);
                  setReceipt(undefined);
                }}
              >
                <span className="fixture-date">{fixtureTime(item.startTime)}</span>
                <span className="fixture-team"><b>{item.participant1}</b><span>HOME</span></span>
                <span className="fixture-team"><b>{item.participant2}</b><span>AWAY</span></span>
                <span className="fixture-id">#{item.fixtureId}<ChevronRight size={14} /></span>
              </button>
            ))}
          </div>
          <a className="docs-link" href="https://txline.txodds.com/documentation/worldcup" target="_blank" rel="noreferrer">
            TxLINE data specification <SquareArrowOutUpRight size={14} />
          </a>
        </aside>

        <section className="resolution-panel">
          {fixture && (
            <>
              <div className="match-visual">
                <div className="match-visual-overlay">
                  <div className="match-meta">
                    <span>{fixture.competition}</span>
                    <span>Fixture #{fixture.fixtureId}</span>
                  </div>
                  <div className="scoreboard">
                    <div className="team-block">
                      <span className="team-seed">P1</span>
                      <strong>{fixture.participant1}</strong>
                      <small>HOME</small>
                    </div>
                    <div className="versus">
                      {receipt?.outcome.homeScore !== undefined ? (
                        <b>{receipt.outcome.homeScore} : {receipt.outcome.awayScore}</b>
                      ) : (
                        <b>VS</b>
                      )}
                      <span>{fixtureTime(fixture.startTime)}</span>
                    </div>
                    <div className="team-block away">
                      <span className="team-seed">P2</span>
                      <strong>{fixture.participant2}</strong>
                      <small>AWAY</small>
                    </div>
                  </div>
                </div>
              </div>

              <div className="event-tape">
                <div className="event-tape-label">
                  <span>TxLINE EVENT TAPE</span>
                  <b>{feed.source === "txline-live" ? "LIVE API" : "SIMULATED REPLAY"}</b>
                </div>
                <div className="event-list">
                  {events.slice(-4).map((event) => (
                    <div className={`event-cell ${event.final ? "final" : ""}`} key={event.seq}>
                      <span>SEQ {event.seq}</span>
                      <b>{event.homeScore ?? "-"} : {event.awayScore ?? "-"}</b>
                      <small>{eventName(event.action)}</small>
                    </div>
                  ))}
                  {!events.length && <span className="no-events">No score records observed yet</span>}
                </div>
              </div>

              <div className="proposal-section">
                <div className="section-heading">
                  <div>
                    <span className="panel-kicker">RESOLUTION PROPOSAL</span>
                    <h2>What should this market settle to?</h2>
                  </div>
                  <Scale size={21} />
                </div>
                <div className="proposal-control">
                  {(["participant-1", "draw", "participant-2"] as MarketProposal[]).map((option) => (
                    <button
                      key={option}
                      className={proposal === option ? "active" : ""}
                      onClick={() => {
                        setProposal(option);
                        setReceipt(undefined);
                      }}
                    >
                      {option === "draw" ? <CircleDot size={17} /> : <Goal size={17} />}
                      {proposalName(option, fixture)}
                    </button>
                  ))}
                </div>

                <button className="verify-button" onClick={() => void verify()} disabled={verifying}>
                  {verifying ? <RefreshCw size={19} className="spin" /> : <ShieldCheck size={19} />}
                  {verifying ? "Verifying TxLINE proof..." : "Verify and resolve"}
                </button>
              </div>

              <div className="verification-flow">
                <div className="flow-step completed">
                  <span><ServerCog size={17} /></span>
                  <div><b>1. Ingest</b><small>Fixture + final score</small></div>
                  <Check size={16} />
                </div>
                <div className={`flow-step ${receipt ? "completed" : ""}`}>
                  <span><Braces size={17} /></span>
                  <div><b>2. Prove</b><small>Merkle path + root PDA</small></div>
                  {receipt && <Check size={16} />}
                </div>
                <div className={`flow-step ${receipt ? "completed" : ""}`}>
                  <span><FileCheck2 size={17} /></span>
                  <div><b>3. Resolve</b><small>Deterministic outcome</small></div>
                  {receipt && <Check size={16} />}
                </div>
              </div>

              {error && (
                <div className="error-banner"><AlertTriangle size={18} /><span>{error}</span></div>
              )}

              {receipt && (
                <div className={`decision-banner ${decision} ${referenceConflict ? "reference-conflict" : ""}`}>
                  <span className="decision-icon">
                    {decision === "dispute" || referenceConflict ? <X size={24} /> : <Check size={24} />}
                  </span>
                  <div>
                    <span className="panel-kicker">RESOLUTION DECISION</span>
                    <h2>
                      {decision === "reference"
                        ? referenceConflict ? "REFERENCE CONFLICT" : "REFERENCE MATCH"
                        : decision?.toUpperCase()}
                    </h2>
                    <p>{receipt.resolution.reason}</p>
                  </div>
                  <div className="resolved-outcome">
                    <span>PROVEN OUTCOME</span>
                    <b>{outcomeName(receipt)}</b>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <aside className="receipt-panel">
          <div className="panel-title-row">
            <div>
              <span className="panel-kicker">AUDIT ARTIFACT</span>
              <h2>Settlement receipt</h2>
            </div>
            <button className="icon-button" onClick={downloadReceipt} disabled={!receipt} title="Download receipt">
              <Download size={17} />
            </button>
          </div>

          {!receipt ? (
            <div className="empty-receipt">
              <ShieldCheck size={38} strokeWidth={1.4} />
              <b>No receipt yet</b>
              <span>Choose a proposal and run verification.</span>
            </div>
          ) : (
            <div className="receipt-content">
              <div className={`receipt-seal ${receipt.chain.simulationStatus}`}>
                <ShieldCheck size={22} />
                <div>
                  <b>{verificationLabel(receipt)}</b>
                  <span>{receipt.audit.verificationMethod}</span>
                </div>
              </div>

              <dl className="receipt-fields">
                <div><dt>Receipt ID</dt><dd>{short(receipt.receiptId, 13, 5)}<button onClick={() => void copyReceiptId()} title="Copy receipt ID">{copied ? <Check size={13} /> : <Copy size={13} />}</button></dd></div>
                <div><dt>Issued</dt><dd>{new Date(receipt.issuedAt).toLocaleString()}</dd></div>
                <div><dt>Data source</dt><dd>{receipt.source}</dd></div>
                <div><dt>Network</dt><dd>{receipt.chain.network}</dd></div>
              </dl>

              <div className="proof-section">
                <span className="panel-kicker">PROOF EVIDENCE</span>
                <div className="proof-metric"><span>Verified stats</span><b>{receipt.proof.verifiedStatKeys.join(", ") || "Fixture"}</b></div>
                <div className="proof-metric"><span>Merkle depth</span><b>{receipt.proof.fixtureProofDepth + receipt.proof.mainTreeProofDepth}</b></div>
                <div className="proof-metric"><span>Compute units</span><b>{receipt.chain.unitsConsumed?.toLocaleString() || "N/A"}</b></div>
              </div>

              <dl className="receipt-fields technical">
                <div><dt>Payload hash</dt><dd title={receipt.proof.payloadHash}>{short(receipt.proof.payloadHash, 12, 8)}</dd></div>
                <div><dt>Root account</dt><dd title={receipt.chain.rootAccount}>{short(receipt.chain.rootAccount, 12, 8)}</dd></div>
                <div><dt>Program</dt><dd title={receipt.chain.programId}>{short(receipt.chain.programId, 12, 8)}</dd></div>
              </dl>

              <button className="download-button" onClick={downloadReceipt}>
                <Download size={16} /> Download JSON receipt
              </button>
              <p className="receipt-disclaimer">{receipt.audit.disclaimer}</p>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

export default App;
