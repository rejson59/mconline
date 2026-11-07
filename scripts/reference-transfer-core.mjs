/** Immutable chunk protocol and official HTTPS ranges; no filesystem or CLI. */
import { createHash, randomBytes } from "node:crypto";
import { Buffer } from "node:buffer";
import {
  stableJSON,
  validatePlan,
  sourceURL,
} from "./reference-corpus-core.mjs";
export const PART_BYTES = 4 * 1024 * 1024;
const HEADER_BYTES = 1024;
const MAX_PARTS = 4096;
const MAX_RECEIPT = 512 * 1024;
const SHA256 = /^[a-f0-9]{64}$/;
const ID = /^[a-f0-9]{32}$/;
const MAGIC = Buffer.from("MCRP");
const digest = (data) => createHash("sha256").update(data).digest("hex");
function check(ok, reason) {
  if (!ok) throw new TransferError(reason);
}
export class TransferError extends Error {
  constructor(reason) {
    super(`Reference transfer: ${reason}`);
    this.name = "TransferError";
    this.reason = reason;
  }
}
function cancelled(signal) {
  signal?.throwIfAborted();
}
function binary(value) {
  check(value instanceof Uint8Array, "non-binary-data");
  return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
}
async function read(store, key, limit, signal) {
  cancelled(signal);
  const value = await store.read(key, limit);
  cancelled(signal);
  if (value === null) return null;
  const bytes = binary(value);
  check(bytes.length <= limit, "stored-record-exceeds-limit");
  return Buffer.from(bytes);
}
async function immutable(store, key, bytes, signal) {
  cancelled(signal);
  const created = await store.create(key, bytes);
  check(typeof created === "boolean", "invalid-store-acknowledgement");
  // An ACK (including a conflict) is not proof that the intended bytes were stored.
  const actual = await read(store, key, bytes.length, signal);
  check(actual !== null && actual.equals(bytes), "immutable-write-conflict");
  return created;
}
function encode(spec, index, payload) {
  const header = {
    schema: 1,
    planSHA256: spec.planSHA256,
    transferID: spec.transferID,
    objectSHA1: spec.objectSHA1,
    objectBytes: spec.objectBytes,
    partBytes: spec.partBytes,
    index,
    bytes: payload.length,
    sha256: digest(payload),
  };
  const raw = Buffer.from(stableJSON(header));
  check(raw.length <= HEADER_BYTES, "part-header-exceeds-limit");
  const prefix = Buffer.alloc(8);
  MAGIC.copy(prefix);
  prefix.writeUInt32BE(raw.length, 4);
  return Buffer.concat([prefix, raw, payload]);
}
export function decodePart(spec, index, raw) {
  check(
    raw.length >= 8 && raw.subarray(0, 4).equals(MAGIC),
    "invalid-part-record",
  );
  const length = raw.readUInt32BE(4);
  check(
    length > 0 && length <= HEADER_BYTES && raw.length >= 8 + length,
    "invalid-part-header",
  );
  let header;
  try {
    header = JSON.parse(raw.subarray(8, 8 + length).toString("utf8"));
  } catch {
    throw new TransferError("invalid-part-header");
  }
  const payload = raw.subarray(8 + length);
  const bytes = Math.min(
    spec.partBytes,
    spec.objectBytes - index * spec.partBytes,
  );
  check(payload.length === bytes, "part-length-mismatch");
  // Canonical byte comparison binds every field, rejects unknown fields and checks the payload hash.
  const expected = encode(spec, index, payload);
  check(expected.equals(raw), "part-integrity-or-binding-mismatch");
  check(header !== null, "invalid-part-header");
  return { payload, sha256: digest(payload) };
}
async function exactSource(source, range, signal) {
  cancelled(signal);
  const stream = await source({ ...range, signal });
  check(
    stream && typeof stream[Symbol.asyncIterator] === "function",
    "invalid-source-stream",
  );
  const result = Buffer.alloc(range.length);
  let size = 0;
  // Leaving the loop calls iterator.return(), cancelling a ReadableStream/generator on failure.
  for await (const value of stream) {
    cancelled(signal);
    const chunk = binary(value);
    check(size + chunk.length <= range.length, "source-exceeds-range");
    chunk.copy(result, size);
    size += chunk.length;
  }
  cancelled(signal);
  check(size === range.length, "source-range-truncated");
  return result;
}

/**
 * Local coordinator, NOT an authorization boundary. Supply only an approved plan built
 * from pinned metadata, never a caller-supplied HTTP plan. The digest is not a signature.
 * Persist/reuse id + partBytes + plan to resume. Store.create must be atomic/no-upsert;
 * Store.read must bound its I/O by limit. Source must honor its signal and exact range.
 */
export function createTransfer(
  plan,
  { id = randomBytes(16).toString("hex"), partBytes = PART_BYTES } = {},
) {
  validatePlan(plan);
  check(typeof id === "string" && ID.test(id), "invalid-transfer-id");
  check(
    Number.isSafeInteger(partBytes) &&
      partBytes >= 1 &&
      partBytes <= PART_BYTES,
    "invalid-part-size",
  );
  const planSHA256 = plan.planSHA256;
  check(
    typeof planSHA256 === "string" && SHA256.test(planSHA256),
    "invalid-plan-digest",
  );
  const files = new Map(
    plan.files.map((f) => [
      f.sha1,
      Object.freeze({ sha1: f.sha1, bytes: f.bytes }),
    ]),
  );
  function describe(sha1) {
    const file = files.get(sha1);
    check(file, "object-not-in-approved-plan");
    const partCount = Math.ceil(file.bytes / partBytes);
    check(partCount <= MAX_PARTS, "too-many-parts");
    return Object.freeze({
      schema: 1,
      planSHA256,
      transferID: id,
      objectSHA1: file.sha1,
      objectBytes: file.bytes,
      partBytes,
      partCount,
    });
  }
  function keys(spec) {
    const base = `archive-parts/v1/${planSHA256}/${id}/${spec.objectSHA1}/${partBytes}`;
    return {
      part: (i) => `${base}/parts/${String(i).padStart(6, "0")}.bin`,
      receipt: `${base}/complete.json`,
    };
  }
  async function run(sha1, store, source, signal, verifyOnly) {
    const spec = describe(sha1),
      key = keys(spec);
    check(
      store &&
        typeof store.read === "function" &&
        typeof store.create === "function",
      "invalid-store",
    );
    const previous = await read(store, key.receipt, MAX_RECEIPT, signal);
    if (verifyOnly) check(previous !== null, "completion-receipt-missing");
    // Never trust an old completion marker: re-read all referenced parts and hashes.
    const wholeSHA1 = createHash("sha1"),
      wholeSHA256 = createHash("sha256");
    const parts = [];
    let fetchedParts = 0,
      resumedParts = 0;
    for (let index = 0; index < spec.partCount; index++) {
      let raw = await read(
        store,
        key.part(index),
        partBytes + HEADER_BYTES + 8,
        signal,
      );
      if (raw === null) {
        check(!verifyOnly && previous === null, "published-part-missing");
        check(typeof source === "function", "source-required");
        const payload = await exactSource(
          source,
          {
            objectSHA1: sha1,
            offset: index * partBytes,
            length: Math.min(partBytes, spec.objectBytes - index * partBytes),
            totalBytes: spec.objectBytes,
          },
          signal,
        );
        raw = encode(spec, index, payload);
        await immutable(store, key.part(index), raw, signal);
        fetchedParts++;
      } else resumedParts++;
      const part = decodePart(spec, index, raw);
      wholeSHA1.update(part.payload);
      wholeSHA256.update(part.payload);
      parts.push(part.sha256);
    }
    check(wholeSHA1.digest("hex") === sha1, "whole-object-sha1-mismatch");
    const receipt = {
      ...spec,
      mode: "verified-chunked-object",
      sha256: wholeSHA256.digest("hex"),
      parts,
    };
    const rawReceipt = Buffer.from(stableJSON(receipt));
    check(rawReceipt.length <= MAX_RECEIPT, "receipt-exceeds-limit");
    let completionCreated = false;
    if (previous !== null)
      check(previous.equals(rawReceipt), "completion-receipt-mismatch");
    else
      completionCreated = await immutable(
        store,
        key.receipt,
        rawReceipt,
        signal,
      );
    return {
      completionCreated,
      receipt,
      fetchedParts,
      resumedParts,
      originalObjectExecuted: false,
      independentBackupVerified: false,
      fullCorpusReady: false,
    };
  }
  return Object.freeze({
    id,
    planSHA256,
    partBytes,
    describe,
    transfer: (sha1, { store, source, signal }) =>
      run(sha1, store, source, signal, false),
    verify: (sha1, { store, signal }) => run(sha1, store, null, signal, true),
  });
}

/** Exact, bounded HTTPS ranges from approved official sources; no redirects or credentials. */
export function officialSource(
  plan,
  { request = fetch, timeoutMs = 60000 } = {},
) {
  validatePlan(plan);
  check(
    Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 120000,
    "invalid-source-timeout",
  );
  const files = new Map(
    plan.files.map((f) => [
      f.sha1,
      { bytes: f.bytes, sources: [...f.sources] },
    ]),
  );
  return async function* ({ objectSHA1, offset, length, totalBytes, signal }) {
    const file = files.get(objectSHA1);
    check(file && file.bytes === totalBytes, "object-not-in-approved-plan");
    check(
      Number.isSafeInteger(offset) &&
        offset >= 0 &&
        Number.isSafeInteger(length) &&
        length > 0 &&
        length <= PART_BYTES &&
        offset + length <= file.bytes,
      "invalid-source-range",
    );
    check(file.sources.length > 0, "official-source-missing");
    const candidate = file.sources[0];
    let url;
    try {
      const kind = {
        "piston-meta.mojang.com": "metadata",
        "piston-data.mojang.com": "download",
        "libraries.minecraft.net": "library",
        "resources.download.minecraft.net": "asset",
      }[new URL(candidate).hostname];
      url = sourceURL(candidate, kind, objectSHA1);
    } catch {
      throw new TransferError("untrusted-official-source");
    }
    const abort = AbortSignal.any([
      AbortSignal.timeout(timeoutMs),
      ...(signal ? [signal] : []),
    ]);
    let response, reader;
    try {
      cancelled(abort);
      response = await request(url, {
        method: "GET",
        redirect: "error",
        credentials: "omit",
        cache: "no-store",
        signal: abort,
        headers: {
          Range: `bytes=${offset}-${offset + length - 1}`,
          "Accept-Encoding": "identity",
        },
      });
      cancelled(abort);
      check(
        response.status === 206 ||
          (response.status === 200 && offset === 0 && length === file.bytes),
        "source-range-not-honored",
      );
      if (response.status === 206)
        check(
          response.headers.get("content-range") ===
            `bytes ${offset}-${offset + length - 1}/${file.bytes}`,
          "source-content-range-mismatch",
        );
      const size = response.headers.get("content-length"),
        encoding = response.headers.get("content-encoding");
      check(
        size === null || size === String(length),
        "source-content-length-mismatch",
      );
      check(
        encoding === null || encoding === "identity",
        "source-content-encoding-not-identity",
      );
      check(response.body, "source-body-missing");
      reader = response.body.getReader();
      let bytes = 0;
      while (true) {
        cancelled(abort);
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        check(bytes <= length, "source-exceeds-range");
        yield value;
      }
      cancelled(abort);
      check(bytes === length, "source-range-truncated");
    } catch (e) {
      if (abort.aborted) throw abort.reason;
      if (e instanceof TransferError) throw e;
      throw new TransferError("official-source-http-failed");
    } finally {
      if (reader) {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      } else await response?.body?.cancel().catch(() => {});
    }
  };
}
