import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { MarketProposal } from "../shared/types";
import { listFixtures, listScoreEvents, verifySettlement } from "../server/settlement-service";

const proposals = new Set<MarketProposal>(["participant-1", "draw", "participant-2"]);

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader("Cache-Control", "no-store");
  try {
    const action = String(request.query.action || "fixtures");
    if (action === "fixtures") {
      const startEpochDay = request.query.startEpochDay
        ? Number(request.query.startEpochDay)
        : undefined;
      return response.status(200).json(await listFixtures(startEpochDay));
    }

    if (action === "events") {
      const fixtureId = Number(request.query.fixtureId);
      if (!Number.isInteger(fixtureId)) {
        return response.status(400).json({ error: "fixtureId must be an integer" });
      }
      return response.status(200).json(await listScoreEvents(fixtureId));
    }

    if (action === "verify") {
      const fixtureId = Number(request.query.fixtureId);
      const proposal = String(request.query.proposal || "draw") as MarketProposal;
      const timestamp = request.query.timestamp ? Number(request.query.timestamp) : undefined;
      if (!Number.isFinite(fixtureId)) {
        return response.status(400).json({ error: "fixtureId must be a number" });
      }
      if (!proposals.has(proposal)) {
        return response.status(400).json({ error: "proposal is invalid" });
      }
      return response.status(200).json(await verifySettlement(fixtureId, proposal, timestamp));
    }

    return response.status(404).json({ error: "Unknown action" });
  } catch (error) {
    return response.status(500).json({
      error: error instanceof Error ? error.message : "Unexpected verification error",
    });
  }
}
