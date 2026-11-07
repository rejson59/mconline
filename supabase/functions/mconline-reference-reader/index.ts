// Narrow server-to-server bridge: only the existing 79-byte probe, no writes/listing.
import { createRemoteJWKSet, customFetch, jwtVerify } from "jose";
export const TRUST = Object.freeze({
  issuer: "https://token.actions.githubusercontent.com",
  audience: "mconline-reference-probe-read-v1",
  repository: "rejson59/mconline",
  repositoryID: "1387893577",
  actorID: "185239338",
  workflow: "rejson59/mconline/.github/workflows/ci.yml@refs/heads/main",
  subject: "repo:rejson59/mconline:ref:refs/heads/main",
});
export const BUCKET = "mconline-reference-private";
export const OBJECT = "probes/roundtrip-v1.txt";
export const EXPECTED_BYTES = 79;
export const EXPECTED_SHA256 =
  "a46cc1a5248a3967c1b3ec5adccfcd83d86fdcc7fdeed200646d495b45c756b6";
export function allowedClaims(p: Record<string, unknown>) {
  return (
    p.repository === TRUST.repository &&
    p.repository_id === TRUST.repositoryID &&
    p.actor_id === TRUST.actorID &&
    p.ref === "refs/heads/main" &&
    p.event_name === "workflow_dispatch" &&
    p.workflow_ref === TRUST.workflow &&
    p.sub === TRUST.subject &&
    p.runner_environment === "github-hosted" &&
    typeof p.run_id === "string" &&
    /^[1-9][0-9]{0,19}$/.test(p.run_id) &&
    typeof p.run_attempt === "string" &&
    /^[1-9][0-9]{0,5}$/.test(p.run_attempt)
  );
}
async function bounded(response: Response | Request, limit: number) {
  if (!response.body) return new Uint8Array(0);
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) throw new Error("limit");
      parts.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.length;
    }
    return bytes;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export function referenceReader(
  worldURL: string,
  serviceKey: string,
  request: typeof fetch = fetch,
) {
  // Fixed trusted issuer; no jku/x5u or URL from a request/token is ever followed.
  const keys = createRemoteJWKSet(new URL(TRUST.issuer + "/.well-known/jwks"), {
    timeoutDuration: 5000,
    cooldownDuration: 30000,
    cacheMaxAge: 600000,
    [customFetch]: (input, init) =>
      request(input, { ...init, redirect: "error" }),
  });
  return async (req: Request): Promise<Response> => {
    const headers = {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    };
    const fail = (status: number) =>
      new Response(
        JSON.stringify({
          error:
            "Odczyt pliku testowego nie został autoryzowany lub potwierdzony.",
        }),
        { status, headers: { ...headers, "Content-Type": "application/json" } },
      );
    if (req.headers.has("origin")) return fail(403); // no browser access or CORS fallback
    if (req.method !== "POST") return fail(405);
    if (req.url.includes("?")) return fail(400); // no caller-controlled path/options
    try {
      await bounded(req, 0);
    } catch {
      return fail(400);
    }
    const auth = req.headers.get("authorization") ?? "";
    if (auth.length > 12000) return fail(413);
    if (!/^Bearer [a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(auth))
      return fail(401);
    let payload;
    try {
      ({ payload } = await jwtVerify(auth.slice(7), keys, {
        issuer: TRUST.issuer,
        audience: TRUST.audience,
        algorithms: ["RS256"],
        maxTokenAge: "10m",
        clockTolerance: 30,
        requiredClaims: [
          "iat",
          "exp",
          "nbf",
          "sub",
          "repository",
          "repository_id",
          "actor_id",
          "ref",
          "event_name",
          "workflow_ref",
          "runner_environment",
          "run_id",
          "run_attempt",
        ],
      }));
    } catch {
      return fail(401);
    }
    if (!allowedClaims(payload)) return fail(403);
    if (!worldURL || !serviceKey) return fail(503);
    try {
      const api = (path: string) =>
        request(`${worldURL}/storage/v1/${path}`, {
          method: "GET",
          redirect: "error",
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
          signal: AbortSignal.timeout(15000),
        });
      const bucketResponse = await api("bucket/" + BUCKET);
      if (!bucketResponse.ok) return fail(503);
      const bucket = JSON.parse(
        new TextDecoder().decode(await bounded(bucketResponse, 8192)),
      );
      if (bucket.id !== BUCKET || bucket.public !== false) return fail(503);
      const file = await api(`object/${BUCKET}/${OBJECT}`);
      if (!file.ok) return fail(file.status === 404 ? 404 : 503);
      const bytes = await bounded(file, EXPECTED_BYTES);
      if (bytes.length !== EXPECTED_BYTES) return fail(503);
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const sha256 = Array.from(new Uint8Array(digest), (v) =>
        v.toString(16).padStart(2, "0"),
      ).join("");
      if (sha256 !== EXPECTED_SHA256) return fail(503);
      return new Response(bytes, {
        headers: {
          ...headers,
          "Content-Type": "application/octet-stream",
          "X-Reference-SHA256": sha256,
        },
      });
    } catch {
      return fail(503);
    }
  };
}
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};
if (typeof Deno !== "undefined")
  Deno.serve(
    referenceReader(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    ),
  );
