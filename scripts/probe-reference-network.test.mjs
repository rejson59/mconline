import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import {
  PIN,
  allowedURL,
  readBounded,
  validateManifest,
  probe,
  annotation,
} from "./probe-reference-network.mjs";
const hash = (b) => createHash("sha1").update(b).digest("hex");
function fixture() {
  const assetRaw = Buffer.from(
    JSON.stringify({
      objects: { "example.ogg": { hash: "a".repeat(40), size: 42 } },
    }),
  );
  const sha = hash(assetRaw);
  const manifest = {
    id: PIN.version,
    type: "release",
    javaVersion: { majorVersion: 25 },
    downloads: {
      client: {
        sha1: PIN.clientSHA1,
        size: PIN.clientBytes,
        url: `https://piston-data.mojang.com/v1/objects/${PIN.clientSHA1}/client.jar`,
      },
    },
    assetIndex: {
      id: "34",
      sha1: sha,
      size: assetRaw.length,
      url: `https://piston-meta.mojang.com/v1/packages/${sha}/34.json`,
    },
  };
  const raw = Buffer.from(JSON.stringify(manifest));
  const pin = {
    ...PIN,
    manifestSHA1: hash(raw),
    manifestURL: `https://piston-meta.mojang.com/v1/packages/${hash(raw)}/26.3.json`,
  };
  const calls = [];
  const request = async (url, opts) => {
    calls.push({ url, ...opts });
    assert.equal(opts.redirect, "error");
    assert.ok(opts.signal);
    assert.ok(!opts.headers?.Authorization);
    if (url === pin.manifestURL) return new Response(raw);
    if (url === manifest.assetIndex.url) return new Response(assetRaw);
    if (url === manifest.downloads.client.url)
      return new Response(Buffer.from("504b0304" + "00".repeat(12), "hex"), {
        status: 206,
      });
    if (url === pin.storageURL) return new Response(null, { status: 401 });
    throw new Error("Unexpected URL");
  };
  return { pin, manifest, raw, assetRaw, request, calls };
}

test("only exact HTTPS destinations without credentials/query/fragment/ports are allowed", () => {
  assert.equal(allowedURL(PIN.manifestURL), PIN.manifestURL);
  for (const url of [
    "http://piston-meta.mojang.com/a",
    "https://piston-meta.mojang.com.evil.test/a",
    "https://user:secret@piston-meta.mojang.com/a",
    "https://piston-meta.mojang.com/a?token=x",
    "https://piston-meta.mojang.com/a#x",
    "https://piston-meta.mojang.com:444/a",
    "https://127.0.0.1/a",
  ])
    assert.throws(() => allowedURL(url));
});
test("complete response must fit byte cap", async () => {
  await assert.rejects(
    readBounded(new Response("too long"), 2),
    /exceeds limit/,
  );
  assert.equal((await readBounded(new Response("ok"), 2)).toString(), "ok");
});
test("prefix mode cancels body even when server ignores Range", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(c) {
      c.enqueue(new Uint8Array(32768));
    },
    cancel() {
      cancelled = true;
    },
  });
  assert.equal((await readBounded(new Response(body), 16, true)).length, 16);
  assert.equal(cancelled, true);
});
test("pinned metadata rejects different versions, altered client and arbitrary index URL", () => {
  const { manifest } = fixture();
  assert.ok(validateManifest(manifest));
  assert.throws(() => validateManifest({ ...manifest, id: "snapshot" }));
  assert.throws(() => validateManifest({ ...manifest, type: "snapshot" }));
  assert.throws(() =>
    validateManifest({
      ...manifest,
      downloads: { client: { ...manifest.downloads.client, size: 10 } },
    }),
  );
  assert.throws(() =>
    validateManifest({
      ...manifest,
      assetIndex: { ...manifest.assetIndex, url: "https://example.com/a" },
    }),
  );
});
test("successful probe does not pretend to test authenticated storage or a full JAR", async () => {
  const f = fixture(),
    r = await probe(f.request, f.pin);
  assert.equal(r.ok, true);
  assert.equal(r.checks.assetIndex.objects, 1);
  assert.equal(r.checks.assetIndex.objectsDownloaded, false);
  assert.equal(r.checks.clientPrefix.fullFileChecksumVerified, false);
  assert.equal(r.checks.clientPrefix.bytesRead, 16);
  assert.equal(r.checks.storageConnectivity.httpStatus, 401);
  assert.equal(r.checks.storageConnectivity.uploadTested, false);
  assert.equal(r.checks.storageConnectivity.privateReadTested, false);
  assert.equal(f.calls.length, 4);
  assert.deepEqual(
    f.calls.map((c) => c.method ?? "GET"),
    ["GET", "GET", "GET", "HEAD"],
  );
  assert.deepEqual(f.calls[2].headers, { Range: "bytes=0-15" });
});
test("checksum mismatch stops official probe before index/client", async () => {
  const f = fixture();
  const r = await probe(
    async (url, opts) =>
      url === f.pin.manifestURL ? new Response("{}") : f.request(url, opts),
    f.pin,
  );
  assert.equal(r.ok, false);
  assert.equal(r.checks.officialSources.ok, false);
  assert.equal(r.checks.assetIndex, undefined);
});
test("altered index does not pass its checksum", async () => {
  const f = fixture();
  const r = await probe(
    async (url, opts) =>
      url === f.manifest.assetIndex.url
        ? new Response("{}")
        : f.request(url, opts),
    f.pin,
  );
  assert.equal(r.ok, false);
  assert.equal(r.checks.manifest.ok, true);
  assert.equal(r.checks.clientPrefix, undefined);
});
test("a non-JAR prefix and short body fail closed", async () => {
  for (const body of ["not a valid jar file", "PK"]) {
    const f = fixture();
    const r = await probe(
      async (url, opts) =>
        url === f.manifest.downloads.client.url
          ? new Response(body, { status: 206 })
          : f.request(url, opts),
      f.pin,
    );
    assert.equal(r.ok, false);
  }
});
test("transport failures do not leak token-like raw errors", async () => {
  const r = await probe(async () => {
    throw new Error("secret-session-token https://user:password@example.com");
  });
  assert.equal(r.ok, false);
  assert.ok(!JSON.stringify(r).includes("secret-session-token"));
  assert.ok(!JSON.stringify(r).includes("password"));
});
test("storage HTTP failures do not count as connectivity success", async () => {
  const f = fixture();
  const r = await probe(
    async (url, opts) =>
      url === f.pin.storageURL
        ? new Response(null, { status: 503 })
        : f.request(url, opts),
    f.pin,
  );
  assert.equal(r.ok, false);
  assert.equal(r.checks.clientPrefix.ok, true);
  assert.equal(r.checks.storageConnectivity.ok, false);
});
test("notice encoding is safe for workflow command characters", () => {
  assert.ok(
    annotation({ text: "%\r\n" }).startsWith(
      "::notice title=Reference connectivity proof::",
    ),
  );
  assert.ok(annotation({ text: "%" }).includes("%25"));
});
test("manual probe remains opt-in and workflow does not grant storage/write credentials", () => {
  const yaml = fs.readFileSync(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8",
  );
  assert.ok(
    yaml.includes(
      "if: github.event_name == 'workflow_dispatch' && inputs.reference_network_probe",
    ),
  );
  assert.ok(yaml.includes("contents: read"));
  assert.ok(!yaml.includes("secrets."));
  assert.ok(!yaml.includes("upload-artifact"));
});
