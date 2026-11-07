import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { build } from "esbuild";
import { SignJWT, generateKeyPair, exportJWK } from "jose";
import {
  readProbe,
  AUDIENCE,
  ENDPOINT,
  HASH,
  notice,
} from "./read-reference-probe.mjs";
const root = new URL("../", import.meta.url);
const source = fs.readFileSync(
  new URL("supabase/functions/mconline-reference-reader/index.ts", root),
  "utf8",
);
const built = await build({
  stdin: { contents: source, loader: "ts", resolveDir: root.pathname },
  bundle: true,
  platform: "node",
  format: "esm",
  target: "es2022",
  write: false,
});
const { referenceReader, TRUST, EXPECTED_SHA256, allowedClaims } = await import(
  "data:text/javascript;base64," +
    Buffer.from(built.outputFiles[0].contents).toString("base64")
);
const keys = await generateKeyPair("RS256", { extractable: true });
const jwk = {
  ...(await exportJWK(keys.publicKey)),
  kid: "test-key",
  alg: "RS256",
  use: "sig",
};
const content =
  "mconline reference storage probe v1\nNot a Minecraft asset. Never auto-deleted.\n";
const claims = {
  repository: TRUST.repository,
  repository_id: TRUST.repositoryID,
  actor_id: TRUST.actorID,
  ref: "refs/heads/main",
  event_name: "workflow_dispatch",
  workflow_ref: TRUST.workflow,
  sub: TRUST.subject,
  runner_environment: "github-hosted",
  run_id: "123456789",
  run_attempt: "1",
};
async function token(overrides = {}, options = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    ...claims,
    iat: now,
    nbf: now - 5,
    exp: now + 300,
    ...overrides,
  })
    .setIssuer(options.issuer ?? TRUST.issuer)
    .setAudience(options.audience ?? TRUST.audience)
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .sign(options.key ?? keys.privateKey);
}
function fixture(options = {}) {
  const calls = [];
  const fetcher = async (url, init) => {
    const u = String(url);
    calls.push({ url: u, ...init });
    assert.equal(init.redirect, "error");
    if (u === TRUST.issuer + "/.well-known/jwks") {
      assert.ok(!init.headers?.Authorization);
      return Response.json({ keys: [jwk] });
    }
    assert.ok(u.startsWith("https://world.invalid/storage/v1/"));
    assert.equal(init.method, "GET");
    assert.equal(init.headers.Authorization, "Bearer service-only-key");
    if (u.includes("/bucket/"))
      return Response.json({
        id: "mconline-reference-private",
        public: options.public ?? false,
      });
    if (options.missing) return new Response(null, { status: 404 });
    return new Response(options.content ?? content);
  };
  const handler = referenceReader(
    "https://world.invalid",
    "service-only-key",
    fetcher,
  );
  const run = (jwt, opts = {}) =>
    handler(
      new Request("https://function.invalid" + (opts.query ?? ""), {
        method: opts.method ?? "POST",
        headers: {
          ...(jwt ? { authorization: "Bearer " + jwt } : {}),
          ...opts.headers,
        },
        ...(opts.body === undefined ? {} : { body: opts.body }),
      }),
    );
  return { calls, run };
}
test("valid cryptographically signed owner main workflow reads actual private bytes, no writes", async () => {
  const f = fixture();
  const r = await f.run(await token());
  assert.equal(r.status, 200);
  assert.equal(await r.text(), content);
  assert.equal(r.headers.get("x-reference-sha256"), HASH);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.ok(!r.headers.has("access-control-allow-origin"));
  assert.equal(f.calls.length, 3);
  assert.equal(EXPECTED_SHA256, HASH);
});
test("missing/opaque credentials, browser Origin and caller-controlled input rejected before storage", async () => {
  const f = fixture();
  for (const t of [undefined, "opaque-user-session", "x.y.z"])
    assert.equal((await f.run(t)).status, 401);
  assert.equal(
    (
      await f.run(undefined, {
        headers: { origin: "https://rejson59.github.io" },
      })
    ).status,
    403,
  );
  assert.equal((await f.run(undefined, { method: "GET" })).status, 405);
  assert.equal(
    (await f.run(undefined, { body: '{"path":"private"}' })).status,
    400,
  );
  assert.equal(
    (await f.run(undefined, { query: "?path=private" })).status,
    400,
  );
  assert.equal(f.calls.filter((c) => c.url.includes("/storage/")).length, 0);
});
test("wrong signature, issuer, audience, expired/not-yet-valid/old tokens fail verification", async () => {
  const other = await generateKeyPair("RS256");
  const now = Math.floor(Date.now() / 1000);
  for (const t of [
    await token({}, { key: other.privateKey }),
    await token({}, { issuer: "https://evil.test" }),
    await token({}, { audience: "other" }),
    await token({ exp: now - 60 }),
    await token({ nbf: now + 300 }),
    await token({ iat: now - 1200, exp: now + 300 }),
  ]) {
    const f = fixture();
    assert.equal((await f.run(t)).status, 401);
    assert.equal(f.calls.filter((c) => c.url.includes("/storage/")).length, 0);
  }
});
test("valid signed tokens from other repos/actors/events/branches/workflows/environments denied", async () => {
  for (const patch of [
    { repository: "attacker/repo" },
    { repository_id: "999" },
    { actor_id: "999" },
    { ref: "refs/heads/other" },
    { event_name: "pull_request" },
    {
      workflow_ref:
        "rejson59/mconline/.github/workflows/other.yml@refs/heads/main",
    },
    { sub: "repo:attacker/repo:ref:refs/heads/main" },
    { runner_environment: "self-hosted" },
    { run_id: "../../file" },
    { run_attempt: "0" },
  ]) {
    const f = fixture();
    assert.equal((await f.run(await token(patch))).status, 403);
    assert.equal(f.calls.filter((c) => c.url.includes("/storage/")).length, 0);
  }
});
test("required claims cannot be omitted and malformed IDs are never allowed", async () => {
  const p = { ...claims };
  delete p.actor_id;
  const f = fixture();
  assert.equal((await f.run(await token({ actor_id: undefined }))).status, 401);
  assert.equal(allowedClaims(p), false);
  assert.equal(allowedClaims({ ...claims, run_id: 123 }), false);
});
test("public bucket, missing/short/oversized/corrupt file fail closed", async () => {
  for (const opts of [
    { public: true },
    { missing: true },
    { content: "short" },
    { content: content + "x" },
    { content: "x".repeat(79) },
  ]) {
    const f = fixture(opts);
    const r = await f.run(await token());
    assert.ok([404, 503].includes(r.status));
    const body = await r.text();
    assert.ok(!body.includes("service-only-key"));
    assert.ok(!body.includes(content));
    assert.ok(f.calls.every((c) => (c.method ?? "GET") === "GET"));
  }
});
test("JWKS cache is used; each authorized request still performs a fresh private read", async () => {
  const f = fixture(),
    t = await token();
  assert.equal((await f.run(t)).status, 200);
  assert.equal((await f.run(t)).status, 200);
  assert.equal(f.calls.filter((c) => c.url.endsWith("/jwks")).length, 1);
  assert.equal(f.calls.filter((c) => c.url.includes("/object/")).length, 2);
});
const env = {
  GITHUB_ACTIONS: "true",
  GITHUB_REF: "refs/heads/main",
  GITHUB_EVENT_NAME: "workflow_dispatch",
  ACTIONS_ID_TOKEN_REQUEST_URL:
    "https://vstoken.actions.githubusercontent.com/id?existing=1",
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: "synthetic-job-request-secret",
};
function clientFixture(options = {}) {
  const calls = [];
  const request = async (url, init) => {
    calls.push({ url: String(url), ...init });
    assert.equal(init.redirect, "error");
    if (String(url).startsWith("https://vstoken."))
      return Response.json({ value: "fake.signed.jwt" });
    assert.equal(String(url), ENDPOINT);
    assert.equal(init.method, "POST");
    assert.equal(init.body, undefined);
    assert.equal(init.headers.Authorization, "Bearer fake.signed.jwt");
    return new Response(options.content ?? content, {
      status: options.status ?? 200,
      headers: { "x-reference-sha256": options.hash ?? HASH },
    });
  };
  return { calls, request };
}
test("runner obtains short-lived identity with exact audience and independently verifies bytes", async () => {
  const f = clientFixture(),
    r = await readProbe(f.request, env);
  assert.equal(r.verified, true);
  assert.equal(r.bytes, 79);
  assert.equal(r.sha256, HASH);
  assert.equal(r.storageWrites, false);
  assert.equal(r.originalsAccessTested, false);
  assert.equal(r.sandboxDirectAccess, false);
  assert.equal(new URL(f.calls[0].url).searchParams.get("audience"), AUDIENCE);
  assert.ok(!JSON.stringify(r).includes("fake.signed.jwt"));
  assert.ok(!JSON.stringify(r).includes(env.ACTIONS_ID_TOKEN_REQUEST_TOKEN));
});
test("runner rejects non-main/non-dispatch/local contexts and untrusted identity URLs", async () => {
  for (const patch of [
    { GITHUB_ACTIONS: "false" },
    { GITHUB_REF: "refs/heads/other" },
    { GITHUB_EVENT_NAME: "pull_request" },
    {
      ACTIONS_ID_TOKEN_REQUEST_URL:
        "http://vstoken.actions.githubusercontent.com/id",
    },
    { ACTIONS_ID_TOKEN_REQUEST_URL: "https://evil.test/id" },
    {
      ACTIONS_ID_TOKEN_REQUEST_URL:
        "https://x:secret@vstoken.actions.githubusercontent.com/id",
    },
  ]) {
    const f = clientFixture();
    await assert.rejects(readProbe(f.request, { ...env, ...patch }));
    assert.equal(f.calls.length, 0);
  }
});
test("runner refuses denied or altered response, including matching claimed header with bad bytes", async () => {
  for (const opts of [
    { status: 401 },
    { status: 503 },
    { content: "short" },
    { content: content + "x" },
    { content: "x".repeat(79) },
    { hash: "b".repeat(64) },
  ])
    await assert.rejects(readProbe(clientFixture(opts).request, env));
});
test("runner report command is escaped and contains no content/token", () => {
  const text = notice({ sha256: HASH, text: "%\r\n" });
  assert.ok(text.includes("%25"));
  assert.ok(!text.includes(content));
  assert.ok(!text.includes("synthetic-job-request-secret"));
});
test("private read job only grants OIDC on explicit owner main dispatch, no artifacts or stored secrets", () => {
  const yaml = fs.readFileSync(
    new URL(".github/workflows/ci.yml", root),
    "utf8",
  );
  const part = yaml.slice(yaml.indexOf("  reference-private-read:"));
  assert.ok(
    part.includes(
      "github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.reference_private_read",
    ),
  );
  assert.ok(part.includes("id-token: write"));
  assert.ok(part.includes("contents: read"));
  assert.ok(!part.includes("secrets."));
  assert.ok(!part.includes("upload-artifact"));
});
