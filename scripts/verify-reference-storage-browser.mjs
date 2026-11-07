/** Browser UI proof with synthetic account/backend. Never logs in to real accounts. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { brotliDecompressSync } from "node:zlib";
import { execFileSync } from "node:child_process";
const root = fileURLToPath(new URL("../", import.meta.url));
const tools = path.resolve(
  process.env.BROWSER_TOOLS ?? path.join(root, ".cache/browser-tools"),
);
const resolve = createRequire(path.join(tools, "package.json")).resolve;
const { default: puppeteer } = await import(
  pathToFileURL(resolve("puppeteer-core")).href
);
const { default: chromium } = await import(
  pathToFileURL(resolve("@sparticuz/chromium")).href
);
const libs = path.join(tools, "al2023");
if (!fs.existsSync(libs)) {
  fs.mkdirSync(libs, { recursive: true });
  const tar = path.join(tools, "al2023.tar");
  fs.writeFileSync(
    tar,
    brotliDecompressSync(
      fs.readFileSync(
        path.join(tools, "node_modules/@sparticuz/chromium/bin/al2023.tar.br"),
      ),
    ),
  );
  execFileSync("tar", ["xf", tar, "-C", libs]);
  fs.unlinkSync(tar);
}

import assert from "node:assert/strict";
const out = path.join(root, ".cache/verification-reference-storage");
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args.filter((arg) => arg !== "--single-process"),
  headless: true,
  env: {
    ...process.env,
    LD_LIBRARY_PATH: [path.join(libs, "lib"), process.env.LD_LIBRARY_PATH]
      .filter(Boolean)
      .join(":"),
  },
});
const html = fs.readFileSync(path.join(root, "dist/testy/index.html"), "utf8"),
  app = fs.readFileSync(path.join(root, "dist/testy/app.js"), "utf8");
const reports = [];
try {
  for (const mobile of [false, true]) {
    const p = await browser.newPage();
    const errors = [];
    let stored = false;
    await p.setViewport(
      mobile
        ? {
            width: 390,
            height: 844,
            isMobile: true,
            hasTouch: true,
            deviceScaleFactor: 1,
          }
        : { width: 1200, height: 900 },
    );
    p.on("pageerror", (e) => errors.push(e.message));
    await p.setRequestInterception(true);
    p.on("request", async (req) => {
      const u = new URL(req.url());
      if (u.pathname === "/mconline/testy/")
        return req.respond({
          status: 200,
          contentType: "text/html",
          body: html,
        });
      if (u.pathname === "/mconline/testy/app.js")
        return req.respond({
          status: 200,
          contentType: "text/javascript",
          body: app,
        });
      if (u.pathname === "/js/rejson-account.js")
        return req.respond({
          status: 200,
          contentType: "text/javascript",
          body: `window.__session={token:'synthetic-browser-owner-session'};window.__change=null;window.RejsonAccount={getSession:async()=>window.__session,open:async()=>{},subscribe:fn=>window.__change=fn};`,
        });
      if (u.pathname === "/functions/v1/mconline-reference-storage") {
        const cors = {
          "Access-Control-Allow-Origin": "https://rejson59.github.io",
          "Access-Control-Allow-Headers": "content-type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
        };
        if (req.method() === "OPTIONS")
          return req.respond({ status: 204, headers: cors });
        const b = JSON.parse(req.postData());
        let body,
          status = 200;
        if (b.token !== "synthetic-browser-owner-session") {
          status = 403;
          body = { error: "Odmowa dostępu." };
        } else if (b.op === "status")
          body = { owner: "rejson59", mode: "probe-only" };
        else {
          body = {
            mode: "server-roundtrip-only",
            privateReadVerified: true,
            publicReadBlocked: true,
            sha256: "a".repeat(64),
            bytes: 79,
            created: !stored,
            analysisPrivateReadVerified: false,
          };
          stored = true;
        }
        return req.respond({
          status,
          headers: cors,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      }
      return req.respond({ status: 404, body: "" });
    });
    await p.goto("https://rejson59.github.io/mconline/testy/", {
      waitUntil: "networkidle0",
    });
    await p.waitForFunction(() => !document.getElementById("probe").disabled);
    await p.click("#probe");
    await p.waitForFunction(() =>
      document
        .getElementById("result")
        .textContent.includes("TEST BACKENDU OK"),
    );
    await p.click("#read");
    await p.waitForFunction(() =>
      document.getElementById("result").textContent.includes("nie nadpisano"),
    );
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await p.screenshot({
      path: path.join(out, mobile ? "mobile.png" : "desktop.png"),
      fullPage: true,
    });
    await p.evaluate(() => {
      window.__session = null;
      window.__change();
    });
    await p.waitForFunction(
      () =>
        document.getElementById("probe").disabled &&
        document.getElementById("result").textContent === "",
    );
    assert.deepEqual(errors, []);
    reports.push({
      device: mobile ? "mobile-emulated" : "desktop",
      ownerUI: true,
      probe: true,
      repeatRead: true,
      logoutClearsProof: true,
      noHorizontalOverflow: true,
      errors,
    });
    await p.close();
  }
  const p = await browser.newPage();
  let helperRequests = 0;
  await p.setRequestInterception(true);
  p.on("request", (req) => {
    if (req.url().includes("/js/rejson-account")) helperRequests++;
    if (req.url().endsWith("/app.js"))
      return req.respond({
        status: 200,
        contentType: "text/javascript",
        body: app,
      });
    return req.respond({ status: 200, contentType: "text/html", body: html });
  });
  await p.goto("https://preview.test/mconline/testy/", {
    waitUntil: "networkidle0",
  });
  assert.equal(await p.$eval("#probe", (b) => b.disabled), true);
  assert.equal(helperRequests, 0);
  await p.close();
  reports.push({ device: "other-origin", blocked: true, helperRequests });
  fs.writeFileSync(
    path.join(out, "report.json"),
    JSON.stringify(
      {
        environment:
          "Chromium; synthetic account provider and backend; no real session or Storage writes",
        reports,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify(reports));
} finally {
  await browser.close();
}
