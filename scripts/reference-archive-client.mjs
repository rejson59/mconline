/** Fixed-endpoint adapter for the chunk protocol; no secrets, workflow trigger or CLI. */
import { Buffer } from "node:buffer";
import { PIN } from "./reference-official-pin.mjs";
import { validatePlan, stableJSON } from "./reference-corpus-core.mjs";
import {
  createTransfer,
  decodePart,
  PART_BYTES,
} from "./reference-transfer-core.mjs";
export const ARCHIVE_ENDPOINT =
  "https://bewwejewgqzctnjrbclu.supabase.co/functions/v1/mconline-reference-archive";
export const ARCHIVE_AUDIENCE = "mconline-reference-archive-v1";
export class ArchiveClientError extends Error {
  constructor(status) {
    super(`Private archive operation not confirmed: HTTP ${status}`);
    this.status = status;
  }
}
function requireThat(ok, status = 409) {
  if (!ok) throw new ArchiveClientError(status);
}
async function bounded(response, limit) {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader(),
    chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      requireThat(size <= limit, 413);
      chunks.push(value);
    }
    return Buffer.concat(chunks, size);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export async function openArchive({
  tokenProvider,
  request = fetch,
  pin = PIN,
} = {}) {
  requireThat(typeof tokenProvider === "function", 401);
  async function call(op, fields = {}, body) {
    let token;
    try {
      token = await tokenProvider(ARCHIVE_AUDIENCE);
    } catch {
      throw new ArchiveClientError(401);
    }
    requireThat(
      typeof token === "string" &&
        token.length <= 12000 &&
        /^[\w-]+\.[\w-]+\.[\w-]+$/.test(token),
      401,
    );
    let r;
    try {
      r = await request(ARCHIVE_ENDPOINT, {
        method: "POST",
        redirect: "error",
        credentials: "omit",
        signal: AbortSignal.timeout(120000),
        headers: {
          Authorization: `Bearer ${token}`,
          "x-reference-op": op,
          ...fields,
          ...(body === undefined
            ? {}
            : { "Content-Type": "application/octet-stream" }),
        },
        ...(body === undefined ? {} : { body }),
      });
    } catch {
      throw new ArchiveClientError(503);
    }
    if (![200, 201, 404].includes(r.status)) {
      await r.body?.cancel();
      throw new ArchiveClientError(r.status);
    }
    return r;
  }
  const response = await call("plan");
  requireThat(response.status === 200, response.status);
  let info;
  try {
    info = JSON.parse(
      (await bounded(response, 32 * 1024 * 1024)).toString("utf8"),
    );
  } catch (e) {
    if (e instanceof ArchiveClientError) throw e;
    throw new ArchiveClientError(409);
  }
  const plan = info.plan;
  try {
    validatePlan(plan);
  } catch {
    throw new ArchiveClientError(409);
  }
  requireThat(
    info.schema === 1 &&
      plan.target === pin.version &&
      plan.provenance.manifestURL === pin.manifestURL &&
      plan.provenance.manifestSHA1 === pin.manifestSHA1 &&
      info.transferID === plan.planSHA256.slice(0, 32) &&
      typeof info.writesEnabled === "boolean" &&
      info.independentBackupVerified === false &&
      info.fullCorpusReady === false &&
      Number.isSafeInteger(info.partBytes) &&
      info.partBytes > 0 &&
      info.partBytes <= PART_BYTES,
  );
  requireThat(
    plan.files.some(
      (f) =>
        f.sha1 === pin.clientSHA1 &&
        f.bytes === pin.clientBytes &&
        f.references.some(
          (r) => r.role === "version-download" && r.name === "client",
        ),
    ),
  );
  const session = createTransfer(plan, {
    id: info.transferID,
    partBytes: info.partBytes,
  });
  // Private immutable lookup: do not use caller-mutable returned plan to authorize later keys.
  const allowed = new Set(plan.files.map((f) => f.sha1)),
    digest = plan.planSHA256;
  const enabled = info.writesEnabled;
  function fields(key) {
    requireThat(typeof key === "string", 403);
    const match =
      /^archive-parts\/v1\/([a-f0-9]{64})\/([a-f0-9]{32})\/([a-f0-9]{40})\/([1-9][0-9]{0,6})\/(parts\/([0-9]{6})\.bin|complete\.json)$/.exec(
        key,
      );
    requireThat(
      match &&
        match[1] === digest &&
        match[2] === session.id &&
        allowed.has(match[3]) &&
        Number(match[4]) === session.partBytes,
      403,
    );
    const index = match[6] === undefined ? null : Number(match[6]),
      spec = session.describe(match[3]);
    requireThat(index === null || index < spec.partCount, 403);
    return {
      object: match[3],
      index,
      spec,
      headers: {
        "x-reference-plan": digest,
        "x-reference-object": match[3],
        ...(index === null ? {} : { "x-reference-index": String(index) }),
      },
    };
  }
  const store = Object.freeze({
    async read(key, limit) {
      requireThat(
        Number.isSafeInteger(limit) && limit >= 0 && limit <= PART_BYTES + 1032,
        413,
      );
      const f = fields(key),
        r = await call(
          f.index === null ? "read-receipt" : "read-part",
          f.headers,
        );
      if (r.status === 404) {
        await r.body?.cancel();
        return null;
      }
      return bounded(r, limit);
    },
    async create(key, data) {
      const f = fields(key);
      requireThat(enabled, 423);
      requireThat(
        data instanceof Uint8Array && data.byteLength <= PART_BYTES + 1032,
        413,
      );
      if (f.index !== null) {
        try {
          decodePart(f.spec, f.index, Buffer.from(data));
        } catch {
          throw new ArchiveClientError(409);
        }
      }
      const r = await call(
        f.index === null ? "finalize" : "write-part",
        f.headers,
        f.index === null ? undefined : data,
      );
      let result;
      try {
        result = JSON.parse((await bounded(r, 512 * 1024)).toString("utf8"));
      } catch {
        throw new ArchiveClientError(409);
      }
      requireThat(typeof result.created === "boolean");
      // No caller receipt is uploaded: the server independently reads/hashes all stored parts.
      if (f.index === null)
        requireThat(
          Buffer.from(stableJSON(result.receipt)).equals(Buffer.from(data)),
        );
      return result.created;
    },
  });
  return Object.freeze({
    plan,
    session,
    store,
    writesEnabled: enabled,
    maximumStoredBytes: info.maximumStoredBytes,
    independentBackupVerified: false,
  });
}
