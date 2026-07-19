import { hasLiveCredentials, txlineConfig } from "./config";

let cachedJwt: { token: string; expiresAt: number } | undefined;

async function responseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`TxLINE ${response.status}: ${text.slice(0, 280)}`);
  }
  return JSON.parse(text) as T;
}

export async function getGuestJwt(): Promise<string> {
  if (cachedJwt && cachedJwt.expiresAt > Date.now() + 60_000) return cachedJwt.token;

  const response = await fetch(`${txlineConfig.apiOrigin}/auth/guest/start`, {
    method: "POST",
  });
  const body = await responseJson<{ token: string }>(response);
  cachedJwt = { token: body.token, expiresAt: Date.now() + 24 * 60 * 60 * 1000 };
  return body.token;
}

export async function txlineGet<T>(path: string): Promise<T> {
  if (!hasLiveCredentials || !txlineConfig.apiToken) {
    throw new Error("TXLINE_API_TOKEN is not configured");
  }

  const jwt = await getGuestJwt();
  const response = await fetch(`${txlineConfig.apiOrigin}/api${path}`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      "X-Api-Token": txlineConfig.apiToken,
      Accept: "application/json",
    },
  });
  return responseJson<T>(response);
}
