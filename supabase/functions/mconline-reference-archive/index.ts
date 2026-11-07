// Separate server-only archive API. Writes stay locked without a reviewed server budget.
import { createRemoteJWKSet, customFetch, jwtVerify } from "jose";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import {
  PIN,
  validateManifest,
} from "../../../scripts/reference-official-pin.mjs";
import {
  buildCorpus,
  stableJSON,
} from "../../../scripts/reference-corpus-core.mjs";
import {
  createTransfer,
  decodePart,
  PART_BYTES,
} from "../../../scripts/reference-transfer-core.mjs";
export const TRUST = Object.freeze({
  issuer: "https://token.actions.githubusercontent.com",
  audience: "mconline-reference-archive-v1",
  repository: "rejson59/mconline",
  repositoryID: "1387893577",
  actorID: "185239338",
  workflow: "rejson59/mconline/.github/workflows/ci.yml@refs/heads/main",
  subject: "repo:rejson59@185239338/mconline@1387893577:ref:refs/heads/main",
});
export const BUCKET = "mconline-reference-private";
const MAX_RECORD = PART_BYTES + 1032;
const MAX_RECEIPT = 512 * 1024;
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
class Rejected extends Error {
  constructor(public status: number) {
    super("archive rejected");
  }
}
const requireThat = (ok: unknown, status = 400) => {
  if (!ok) throw new Rejected(status);
};
async function bounded(value: Request | Response, limit: number) {
  const declared = value.headers.get("content-length");
  requireThat(
    declared === null ||
      (/^(0|[1-9][0-9]*)$/.test(declared) && Number(declared) <= limit),
    413,
  );
  if (!value.body) return Buffer.alloc(0);
  const reader = value.body.getReader(),
    chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value: part } = await reader.read();
      if (done) break;
      size += part.byteLength;
      requireThat(size <= limit, 413);
      chunks.push(part);
    }
    return Buffer.concat(chunks, size);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
function sha1(raw: Uint8Array) {
  return createHash("sha1").update(raw).digest("hex");
}
async function missing(response: Response) {
  if (response.status === 404) {
    await response.body?.cancel();
    return true;
  }
  if (response.status !== 400) {
    await response.body?.cancel();
    return false;
  }
  const b = JSON.parse((await bounded(response, 8192)).toString("utf8"));
  return (
    Number(b.statusCode) === 404 ||
    ["not_found", "Object not found"].includes(b.error) ||
    b.message === "Object not found"
  );
}
export function referenceArchive(
  worldURL: string,
  serviceKey: string,
  options: any = {},
) {
  const request: typeof fetch = options.request ?? fetch;
  // Options are server construction dependencies, NEVER request fields.
  const pin = options.pin ?? PIN,
    partBytes = options.partBytes ?? PART_BYTES;
  const budgetBytes = options.budgetBytes ?? 0;
  requireThat(Number.isSafeInteger(budgetBytes) && budgetBytes >= 0, 503);
  requireThat(
    Number.isSafeInteger(partBytes) && partBytes > 0 && partBytes <= PART_BYTES,
    503,
  );
  const jwks = createRemoteJWKSet(new URL(TRUST.issuer + "/.well-known/jwks"), {
    timeoutDuration: 5000,
    cooldownDuration: 30000,
    cacheMaxAge: 600000,
    [customFetch]: (url, init) => request(url, { ...init, redirect: "error" }),
  });
  let pending: Promise<any> | undefined;
  async function approved() {
    if (!pending)
      pending = (async () => {
        const get = async (url: string, max: number) => {
          const r = await request(url, {
            method: "GET",
            redirect: "error",
            credentials: "omit",
            signal: AbortSignal.timeout(20000),
          });
          requireThat(r.status === 200, 503);
          return bounded(r, max);
        };
        const manifestRaw = await get(pin.manifestURL, 512 * 1024);
        requireThat(sha1(manifestRaw) === pin.manifestSHA1, 503);
        const { index } = validateManifest(
          JSON.parse(manifestRaw.toString("utf8")),
          pin,
        );
        const assets = await get(index.url, 2 * 1024 * 1024);
        const plan = buildCorpus(manifestRaw, assets, pin);
        // One deterministic namespace, not an unbounded client-selected collection of attempts.
        const id = plan.planSHA256.slice(0, 32),
          session = createTransfer(plan, { id, partBytes });
        let maximumStoredBytes = 0;
        for (const file of plan.files) {
          const spec = session.describe(file.sha1);
          maximumStoredBytes +=
            file.bytes + spec.partCount * 1032 + 1024 + spec.partCount * 67;
        }
        requireThat(Number.isSafeInteger(maximumStoredBytes), 503);
        return { plan, id, session, maximumStoredBytes };
      })().catch((e) => {
        pending = undefined;
        throw e;
      });
    return pending;
  }
  const common = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...common, "Content-Type": "application/json" },
    });
  return async (req: Request): Promise<Response> => {
    const fail = (status: number) =>
      json(
        { error: "Archive operation not authorized or confirmed.", status },
        status,
      );
    if (req.headers.has("origin")) return fail(403);
    if (req.method !== "POST") return fail(405);
    if (req.url.includes("?")) return fail(400);
    const op = req.headers.get("x-reference-op") ?? "plan";
    if (
      !["plan", "read-part", "write-part", "read-receipt", "finalize"].includes(
        op,
      )
    )
      return fail(400);
    const auth = req.headers.get("authorization") ?? "";
    if (auth.length > 12000) return fail(413);
    if (!/^Bearer [a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(auth))
      return fail(401);
    let payload;
    try {
      ({ payload } = await jwtVerify(auth.slice(7), jwks, {
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
    try {
      requireThat(worldURL && serviceKey, 503);
      if (["write-part", "finalize"].includes(op) && budgetBytes === 0)
        return fail(423);
      const raw = await bounded(req, op === "write-part" ? MAX_RECORD : 0);
      const a = await approved();
      if (op === "plan")
        return json({
          schema: 1,
          plan: a.plan,
          transferID: a.id,
          partBytes,
          maximumStoredBytes: a.maximumStoredBytes,
          writesEnabled: budgetBytes >= a.maximumStoredBytes,
          independentBackupVerified: false,
          fullCorpusReady: false,
        });
      requireThat(
        req.headers.get("x-reference-plan") === a.plan.planSHA256,
        409,
      );
      const object = req.headers.get("x-reference-object");
      requireThat(object && /^[a-f0-9]{40}$/.test(object));
      let spec;
      try {
        spec = a.session.describe(object);
      } catch {
        throw new Rejected(403);
      }
      const base = `archive-parts/v1/${a.plan.planSHA256}/${a.id}/${object}/${partBytes}`;
      const receiptKey = `${base}/complete.json`;
      let index = -1;
      if (op.endsWith("part")) {
        const text = req.headers.get("x-reference-index") ?? "";
        requireThat(/^(0|[1-9][0-9]{0,3})$/.test(text));
        index = Number(text);
        requireThat(index < spec.partCount);
      }
      if (["write-part", "finalize"].includes(op))
        requireThat(budgetBytes >= a.maximumStoredBytes, 423);
      const api = (key: string, init: RequestInit = {}) =>
        request(`${worldURL}/storage/v1/${key}`, {
          ...init,
          method: init.method ?? "GET",
          redirect: "error",
          signal: AbortSignal.timeout(20000),
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            ...init.headers,
          },
        });
      const br = await api(`bucket/${BUCKET}`);
      requireThat(br.ok, 503);
      const bucket = JSON.parse((await bounded(br, 8192)).toString("utf8"));
      requireThat(
        bucket.id === BUCKET &&
          bucket.public === false &&
          Number(bucket.file_size_limit) >= MAX_RECORD,
        503,
      );
      const keyAllowed = (key: string) =>
        key === receiptKey ||
        (key.startsWith(base + "/parts/") &&
          /^\d{6}\.bin$/.test(key.slice((base + "/parts/").length)) &&
          Number(key.slice(-10, -4)) < spec.partCount);
      const store = {
        async read(key: string, limit: number) {
          requireThat(keyAllowed(key), 403);
          const r = await api(`object/${BUCKET}/${key}`);
          if (!r.ok) {
            if (await missing(r)) return null;
            throw new Rejected(503);
          }
          return bounded(r, Math.min(limit, MAX_RECORD));
        },
        async create(key: string, data: Uint8Array) {
          requireThat(keyAllowed(key), 403);
          const r = await api(`object/${BUCKET}/${key}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/octet-stream",
              "x-upsert": "false",
            },
            body: data as BodyInit,
          });
          if (r.ok) {
            await r.body?.cancel();
            return true;
          }
          if (r.status === 409) {
            await r.body?.cancel();
            return false;
          }
          if (r.status === 400) {
            const b = JSON.parse((await bounded(r, 8192)).toString("utf8"));
            if (
              Number(b.statusCode) === 409 ||
              ["Duplicate", "KeyAlreadyExists"].includes(b.error)
            )
              return false;
          } else await r.body?.cancel();
          throw new Rejected(503);
        },
      };
      if (op === "finalize") {
        let result;
        try {
          result = await a.session.transfer(object, { store });
        } catch (e) {
          if (e instanceof Rejected) throw e;
          throw new Rejected(409);
        }
        return json({
          created: result.completionCreated,
          receipt: result.receipt,
          independentBackupVerified: false,
        });
      }
      const key =
        op === "read-receipt"
          ? receiptKey
          : `${base}/parts/${String(index).padStart(6, "0")}.bin`;
      if (op === "write-part") {
        try {
          decodePart(spec, index, raw);
        } catch {
          throw new Rejected(409);
        }
        const created = await store.create(key, raw);
        const actual = await store.read(key, MAX_RECORD);
        requireThat(actual !== null && actual.equals(raw), 409);
        return json({ created });
      }
      const record = await store.read(
        key,
        op === "read-receipt" ? MAX_RECEIPT : MAX_RECORD,
      );
      if (record === null) return fail(404);
      if (op === "read-part") {
        try {
          decodePart(spec, index, record);
        } catch {
          throw new Rejected(409);
        }
      }
      return new Response(record, {
        headers: { ...common, "Content-Type": "application/octet-stream" },
      });
    } catch (e) {
      return fail(e instanceof Rejected ? e.status : 503);
    }
  };
}
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};
if (typeof Deno !== "undefined")
  Deno.serve(
    referenceArchive(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      // Intentional production gate: only a reviewed release may allocate archive capacity.
      { budgetBytes: 0 },
    ),
  );
