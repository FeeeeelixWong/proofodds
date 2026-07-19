import type { VercelRequest, VercelResponse } from "@vercel/node";
import { hasLiveCredentials, txlineConfig } from "../server/config.js";

export default function handler(_request: VercelRequest, response: VercelResponse) {
  response.status(200).json({
    ok: true,
    service: "proofodds",
    network: txlineConfig.network,
    source: hasLiveCredentials ? "txline-live" : "txline-reference",
    programId: txlineConfig.programId,
  });
}
