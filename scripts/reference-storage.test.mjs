import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { transform } from "esbuild";
import { JSDOM } from "jsdom";
const source = fs.readFileSync(
  new URL(
    "../supabase/functions/mconline-reference-storage/index.ts",
    import.meta.url,
  ),
  "utf8",
);
const { code } = await transform(source, {
  loader: "ts",
  format: "esm",
  target: "es2022",
});
const { referenceStorage, OWNER, CONTENT, BUCKET } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
const token = "synthetic-session-not-a-real-user-token";
const ORIGIN = "https://rejson59.github.io";
const url = "https://world.invalid";
function request(body = { op: "probe", token }, headers = {}) {
  return new Request(url, {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
function fixture(options = {}) {
  const calls = [],
    objects = new Map();
  let bucket = options.existing ?? false;
  if (options.content !== undefined) objects.set("file", options.content);
  const transport = async (input, init = {}) => {
    calls.push({ url: String(input), ...init });
    const method = init.method ?? "GET";
    if (String(input).includes("/rpc/mconline_identity"))
      return Response.json(
        options.identity ?? { id: OWNER, username: "rejson59" },
        { status: options.authStatus ?? 200 },
      );
    assert.ok(
      String(input).startsWith(url + "/storage/v1/"),
      "only separate Storage API, never game/admin RPCs",
    );
    if (String(input).includes("/object/public/"))
      return new Response(options.publicRead ? "leak" : "denied", {
        status: options.publicRead ? 200 : 400,
      });
    assert.equal(init.headers.Authorization, "Bearer server-only-key");
    if (String(input).endsWith("/bucket/" + BUCKET))
      return bucket
        ? Response.json({ id: BUCKET, public: options.publicBucket ?? false })
        : Response.json(
            { error: "Bucket not found", statusCode: "404" },
            { status: 400 },
          );
    if (String(input).endsWith("/bucket")) {
      assert.equal(method, "POST");
      assert.equal(JSON.parse(init.body).public, false);
      bucket = true;
      return Response.json({ id: BUCKET });
    }
    if (method === "POST") {
      assert.equal(init.headers["x-upsert"], "false");
      if (options.writeFails)
        return Response.json(
          { message: "server-only-key raw failure" },
          { status: 500 },
        );
      assert.ok(!objects.has("file"), "never overwrite");
      objects.set("file", init.body);
      return Response.json({});
    }
    return objects.has("file")
      ? new Response(objects.get("file"))
      : new Response("missing", { status: 404 });
  };
  return {
    calls,
    objects,
    handler: referenceStorage(url, "server-only-key", transport),
  };
}
test("origin/method/preflight checked before any storage/account calls", async () => {
  const f = fixture();
  assert.equal(
    (await f.handler(request(undefined, { origin: "https://evil.test" })))
      .status,
    403,
  );
  assert.equal((await f.handler(new Request(url))).status, 405);
  assert.equal(
    (
      await f.handler(
        new Request(url, { method: "OPTIONS", headers: { origin: ORIGIN } }),
      )
    ).status,
    204,
  );
  assert.equal(f.calls.length, 0);
});
test("only status/probe/read accepted; no delete, upload or role assignment", async () => {
  for (const op of ["delete", "upload", "admin", undefined]) {
    const f = fixture();
    assert.equal((await f.handler(request({ op, token }))).status, 400);
    assert.equal(f.calls.length, 0);
  }
});
test("request size/malformed JSON/absent session rejected before upstream", async () => {
  const f = fixture();
  assert.equal(
    (
      await f.handler(
        request({ op: "probe", token }, { "content-length": "9000" }),
      )
    ).status,
    413,
  );
  assert.equal(
    (await f.handler(request({ op: "probe", token: "x".repeat(9000) }))).status,
    400,
  );
  assert.equal((await f.handler(request({ op: "probe" }))).status, 401);
  assert.equal(
    (await f.handler(new Request(url, { method: "POST", body: "null" })))
      .status,
    400,
  );
  assert.equal(f.calls.length, 0);
});
test("expired sessions rejected and fake owner name does not authorize another UUID", async () => {
  const expired = fixture({ authStatus: 401 });
  assert.equal((await expired.handler(request())).status, 401);
  const other = fixture({
    identity: {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      username: "rejson59",
    },
  });
  assert.equal((await other.handler(request())).status, 403);
  assert.equal(other.calls.length, 1);
});
test("owner binding uses immutable ID, not a mutable username; status has no storage side effects", async () => {
  const f = fixture({ identity: { id: OWNER, username: "changed" } });
  const r = await f.handler(request({ op: "status", token }));
  assert.equal(r.status, 200);
  assert.equal(f.calls.length, 1);
  assert.equal((await r.json()).mode, "probe-only");
});
test("creates private bucket and immutable tiny probe, verifies bytes and SHA-256", async () => {
  const f = fixture();
  const r = await f.handler(request());
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.privateReadVerified, true);
  assert.equal(b.publicReadBlocked, true);
  assert.equal(b.analysisPrivateReadVerified, false);
  assert.equal(b.originalsUploaded, false);
  assert.equal(b.sha256, createHash("sha256").update(CONTENT).digest("hex"));
  assert.equal(b.bytes, Buffer.byteLength(CONTENT));
  assert.equal(b.created, true);
  assert.ok(!JSON.stringify(b).includes("server-only-key"));
  assert.ok(!JSON.stringify(b).includes(token));
  assert.ok(f.calls.every((c) => (c.method ?? "GET") !== "DELETE"));
});
test("repeat test/read leaves existing probe unchanged and creates no new objects", async () => {
  const f = fixture({ existing: true, content: CONTENT });
  for (const op of ["probe", "read"])
    assert.equal((await f.handler(request({ op, token }))).status, 200);
  assert.equal(
    f.calls.filter((c) => c.method === "POST" && !c.url.includes("identity"))
      .length,
    0,
  );
  assert.equal(f.objects.size, 1);
});
test("read-only operation never creates a missing bucket", async () => {
  const f = fixture();
  assert.equal((await f.handler(request({ op: "read", token }))).status, 503);
  assert.equal(
    f.calls.filter((c) => c.method === "POST" && !c.url.includes("identity"))
      .length,
    0,
  );
});
test("public bucket, changed content and public disclosure fail without overwrite", async () => {
  for (const opts of [
    { existing: true, publicBucket: true },
    { existing: true, content: "different" },
    { existing: true, content: CONTENT, publicRead: true },
  ]) {
    const f = fixture(opts);
    assert.equal((await f.handler(request())).status, 503);
    assert.equal(
      f.calls.filter((c) => c.method === "POST" && !c.url.includes("identity"))
        .length,
      0,
    );
  }
});
test("upstream errors do not leak session/service key/raw failure details", async () => {
  const f = fixture({ writeFails: true });
  const r = await f.handler(request());
  assert.equal(r.status, 503);
  const text = await r.text();
  assert.ok(!text.includes(token));
  assert.ok(!text.includes("server-only-key"));
  assert.ok(!text.includes("raw failure"));
});

const html = fs.readFileSync(
  new URL("../public/testy/index.html", import.meta.url),
  "utf8",
);
const app = fs.readFileSync(
  new URL("../public/testy/app.js", import.meta.url),
  "utf8",
);
function ui({ origin = ORIGIN, session = { token }, reply, delayStatus } = {}) {
  const dom = new JSDOM(html, {
      url: origin + "/mconline/testy/",
      runScripts: "outside-only",
    }),
    w = dom.window,
    calls = [];
  let current = session,
    subscriber;
  w.RejsonAccount = {
    getSession: async () => current,
    open: async () => {},
    subscribe: (fn) => {
      subscriber = fn;
    },
  };
  w.AbortSignal = AbortSignal;
  w.fetch = async (input, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url: input, ...init, body });
    if (body.op === "status" && delayStatus) return delayStatus;
    if (reply) return reply(body);
    return Response.json(
      body.op === "status"
        ? { owner: "rejson59", mode: "probe-only" }
        : {
            mode: "server-roundtrip-only",
            privateReadVerified: true,
            publicReadBlocked: true,
            sha256: "a".repeat(64),
            bytes: 74,
            created: true,
          },
    );
  };
  w.eval(app);
  return {
    dom,
    w,
    calls,
    el: (id) => w.document.getElementById(id),
    change: (s) => {
      current = s;
      subscriber?.();
    },
    close: () => dom.window.close(),
  };
}
const tick = () => new Promise((r) => setTimeout(r, 15));
test("panel has no file upload or credential form; CSP and same-origin scripts only", () => {
  assert.ok(html.includes("Content-Security-Policy"));
  assert.ok(!html.includes('type="file"'));
  assert.ok(!html.includes('type="password"'));
  assert.ok(!app.includes("localStorage"));
  assert.ok(!app.includes("innerHTML"));
  assert.ok(!app.includes("console.log"));
});
test("preview/file/other origins never access provider or endpoint", async () => {
  for (const origin of [
    "https://preview.test",
    "http://rejson59.github.io",
    "https://rejson59.github.io.evil.test",
  ]) {
    const f = ui({ origin });
    await tick();
    assert.equal(f.calls.length, 0);
    assert.equal(f.el("probe").disabled, true);
    f.close();
  }
});
test("owner status enables tiny test and fresh token only goes in POST body, never URL/DOM", async () => {
  const f = ui();
  await tick();
  assert.equal(f.el("probe").disabled, false);
  f.el("probe").click();
  await tick();
  assert.ok(f.el("result").textContent.includes("TEST BACKENDU OK"));
  assert.equal(f.calls.length, 2);
  assert.deepEqual(
    f.calls.map((c) => c.body.op),
    ["status", "probe"],
  );
  assert.ok(f.calls.every((c) => !c.url.includes(token)));
  assert.ok(!f.w.document.body.textContent.includes(token));
  f.close();
});
test("missing/denied session cannot run probe", async () => {
  const guest = ui({ session: null });
  await tick();
  assert.equal(guest.calls.length, 0);
  assert.equal(guest.el("probe").disabled, true);
  guest.close();
  const denied = ui({
    reply: () => Response.json({ error: "Odmowa." }, { status: 403 }),
  });
  await tick();
  assert.equal(denied.el("probe").disabled, true);
  assert.equal(denied.el("status").textContent, "Odmowa.");
  denied.close();
});
test("logout/account change clears proof and disables actions", async () => {
  const f = ui();
  await tick();
  f.el("probe").click();
  await tick();
  f.change(null);
  await tick();
  assert.equal(f.el("probe").disabled, true);
  assert.equal(f.el("result").textContent, "");
  f.close();
});
test("late old-session response cannot restore access after logout", async () => {
  let resolve;
  const wait = new Promise((r) => {
    resolve = r;
  });
  const f = ui({ delayStatus: wait });
  await tick();
  f.change(null);
  await tick();
  resolve(Response.json({ owner: "rejson59", mode: "probe-only" }));
  await tick();
  assert.equal(f.el("probe").disabled, true);
  f.close();
});
