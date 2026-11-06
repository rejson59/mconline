#!/usr/bin/env node
/** Connectivity proof only. No uploads, credentials, JAR execution or persistent storage. */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PIN = Object.freeze({
  version: "26.3",
  manifestSHA1: "80608ff6753705b6a82e2cb86a5937d4d233abd4",
  manifestURL:
    "https://piston-meta.mojang.com/v1/packages/80608ff6753705b6a82e2cb86a5937d4d233abd4/26.3.json",
  clientSHA1: "e877b6a07acd633fb3bb475002175cec036e7b87",
  clientBytes: 41483720,
  storageURL: "https://bewwejewgqzctnjrbclu.supabase.co/storage/v1/status",
});
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const ALLOWED = new Set([
  "piston-meta.mojang.com",
  "piston-data.mojang.com",
  "bewwejewgqzctnjrbclu.supabase.co",
]);

export function allowedURL(raw) {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    !ALLOWED.has(url.hostname) ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash
  ) {
    throw new Error("Reference URL is not allowed");
  }
  return url.href;
}

/** Reader cancellation prevents an ignored Range header from downloading the entire game. */
export async function readBounded(response, limit, prefixOnly = false) {
  if (!response.body) throw new Error("Missing response body");
  const reader = response.body.getReader();
  let bytes = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (bytes + value.byteLength > limit) {
        if (!prefixOnly) throw new Error("Reference response exceeds limit");
        chunks.push(value.subarray(0, limit - bytes));
        bytes = limit;
        break;
      }
      chunks.push(value);
      bytes += value.byteLength;
      if (prefixOnly && bytes === limit) break;
    }
    return Buffer.concat(
      chunks.map((c) => Buffer.from(c)),
      bytes,
    );
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

async function get(url, request, options = {}) {
  return request(allowedURL(url), {
    redirect: "error",
    signal: AbortSignal.timeout(20000),
    ...options,
  });
}
function verify(data, sha1) {
  if (
    !/^[a-f0-9]{40}$/.test(sha1) ||
    createHash("sha1").update(data).digest("hex") !== sha1
  )
    throw new Error("Reference checksum mismatch");
}
export function validateManifest(manifest, pin = PIN) {
  if (manifest.id !== pin.version || manifest.type !== "release")
    throw new Error("Unexpected reference version");
  const client = manifest.downloads?.client;
  if (
    client?.sha1 !== pin.clientSHA1 ||
    client?.size !== pin.clientBytes ||
    client?.url !==
      `https://piston-data.mojang.com/v1/objects/${pin.clientSHA1}/client.jar`
  )
    throw new Error("Unexpected client download");
  const index = manifest.assetIndex;
  if (
    !index ||
    !/^[a-f0-9]{40}$/.test(index.sha1) ||
    !Number.isSafeInteger(index.size) ||
    index.size < 1 ||
    index.size > 2 * 1024 * 1024 ||
    index.url !==
      `https://piston-meta.mojang.com/v1/packages/${index.sha1}/${index.id}.json`
  )
    throw new Error("Unexpected asset index");
  return { client, index };
}

export async function probe(request = fetch, pin = PIN) {
  const report = {
    schema: 1,
    target: pin.version,
    mode: "connectivity-only",
    checks: {},
    boundaries: [
      "No bucket created; no upload or authenticated private download tested.",
      "At most a 16-byte client prefix may be read; full JAR download/integrity is not tested.",
      "No original game assets committed, published as artifacts, or executed.",
      "No game saves, accounts, backend settings or migrations changed.",
    ],
  };
  try {
    const r = await get(pin.manifestURL, request);
    if (r.status !== 200) throw new Error("Manifest HTTP status is not 200");
    const raw = await readBounded(r, 512 * 1024);
    verify(raw, pin.manifestSHA1);
    const manifest = JSON.parse(raw);
    const { client, index } = validateManifest(manifest, pin);
    report.checks.manifest = {
      ok: true,
      sha1Verified: true,
      version: manifest.id,
      javaMajor: manifest.javaVersion?.majorVersion,
    };
    const ar = await get(index.url, request);
    if (ar.status !== 200)
      throw new Error("Asset index HTTP status is not 200");
    const assetRaw = await readBounded(ar, 2 * 1024 * 1024);
    verify(assetRaw, index.sha1);
    if (assetRaw.length !== index.size)
      throw new Error("Asset index size mismatch");
    const assets = JSON.parse(assetRaw);
    if (
      !assets.objects ||
      typeof assets.objects !== "object" ||
      Array.isArray(assets.objects)
    )
      throw new Error("Invalid asset object map");
    for (const obj of Object.values(assets.objects)) {
      if (
        !/^[a-f0-9]{40}$/.test(obj.hash) ||
        !Number.isSafeInteger(obj.size) ||
        obj.size < 0
      )
        throw new Error("Invalid asset record");
    }
    report.checks.assetIndex = {
      ok: true,
      sha1Verified: true,
      objects: Object.keys(assets.objects).length,
      indexedBytes: Object.values(assets.objects).reduce(
        (total, item) => total + item.size,
        0,
      ),
      objectsDownloaded: false,
    };
    const cr = await get(client.url, request, {
      headers: { Range: "bytes=0-15" },
    });
    if (![200, 206].includes(cr.status))
      throw new Error("Client prefix HTTP status is not 200/206");
    const prefix = await readBounded(cr, 16, true);
    if (
      prefix.length !== 16 ||
      prefix.subarray(0, 4).toString("hex") !== "504b0304"
    )
      throw new Error("Client prefix is not a ZIP/JAR signature");
    report.checks.clientPrefix = {
      ok: true,
      bytesRead: prefix.length,
      completeDownload: false,
      fullFileChecksumVerified: false,
    };
  } catch {
    // No raw transport errors, URLs with credentials or tokens are published.
    report.checks.officialSources = {
      ok: false,
      error:
        "Official reference probe failed. See which prior checks completed; no fallback source accepted.",
    };
  }
  try {
    const sr = await get(pin.storageURL, request, { method: "HEAD" });
    report.checks.storageConnectivity = {
      ok: sr.status >= 200 && sr.status < 500 && sr.status !== 429,
      httpStatus: sr.status,
      authenticated: false,
      uploadTested: false,
      privateReadTested: false,
    };
  } catch {
    report.checks.storageConnectivity = {
      ok: false,
      error: "Storage HTTP connection failed.",
      authenticated: false,
      uploadTested: false,
      privateReadTested: false,
    };
  }
  report.ok =
    Object.values(report.checks).every((check) => check.ok) &&
    Boolean(report.checks.clientPrefix);
  return report;
}

export function annotation(report) {
  // GitHub workflow command escaping; fetched error strings are deliberately excluded.
  const json = JSON.stringify(report)
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
  return `::notice title=Reference connectivity proof::${json}`;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const report = await probe();
  const dir = path.join(ROOT, ".cache/reference-network-proof");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(annotation(report));
  console.log(
    `Connectivity ${report.ok ? "PASS" : "FAIL"}; this is NOT an upload/storage durability proof.`,
  );
  if (process.env.GITHUB_STEP_SUMMARY)
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      "# Reference connectivity proof\n\n```json\n" +
        JSON.stringify(report, null, 2) +
        "\n```\n",
    );
  if (!report.ok) process.exitCode = 1;
}
