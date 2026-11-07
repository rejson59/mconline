#!/usr/bin/env node
/** Runs only in an owner-triggered GitHub job. No account tokens/service keys. */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
export const AUDIENCE = "mconline-reference-probe-read-v1";
export const ENDPOINT =
  "https://bewwejewgqzctnjrbclu.supabase.co/functions/v1/mconline-reference-reader";
export const HASH =
  "a46cc1a5248a3967c1b3ec5adccfcd83d86fdcc7fdeed200646d495b45c756b6";
async function bounded(response, limit) {
  if (!response.body) throw new Error("Empty response");
  const reader = response.body.getReader(),
    parts = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error("Response too large");
      parts.push(value);
    }
    return Buffer.concat(
      parts.map((p) => Buffer.from(p)),
      size,
    );
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export async function readProbe(request = fetch, env = process.env) {
  if (
    env.GITHUB_ACTIONS !== "true" ||
    env.GITHUB_REF !== "refs/heads/main" ||
    env.GITHUB_EVENT_NAME !== "workflow_dispatch"
  )
    throw new Error("Owner-dispatched main job required");
  if (!env.ACTIONS_ID_TOKEN_REQUEST_URL || !env.ACTIONS_ID_TOKEN_REQUEST_TOKEN)
    throw new Error("Job identity unavailable");
  const url = new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".actions.githubusercontent.com") ||
    url.username ||
    url.password ||
    url.port ||
    url.hash
  )
    throw new Error("Invalid job identity URL");
  url.searchParams.set("audience", AUDIENCE);
  const id = await request(url.href, {
    method: "GET",
    redirect: "error",
    headers: { Authorization: `Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` },
    signal: AbortSignal.timeout(15000),
  });
  if (id.status !== 200) throw new Error("Job identity denied");
  const { value } = JSON.parse((await bounded(id, 16384)).toString("utf8"));
  if (
    typeof value !== "string" ||
    value.length > 12000 ||
    !/^[-\w]+\.[-\w]+\.[-\w]+$/.test(value)
  )
    throw new Error("Invalid job identity response");
  const response = await request(ENDPOINT, {
    method: "POST",
    redirect: "error",
    cache: "no-store",
    headers: { Authorization: `Bearer ${value}` },
    signal: AbortSignal.timeout(30000),
  });
  if (response.status !== 200)
    throw new Error(`Private probe read denied: HTTP ${response.status}`);
  const bytes = await bounded(response, 79),
    sha256 = createHash("sha256").update(bytes).digest("hex");
  if (
    bytes.length !== 79 ||
    sha256 !== HASH ||
    response.headers.get("x-reference-sha256") !== HASH
  )
    throw new Error("Private probe integrity mismatch");
  return {
    schema: 1,
    mode: "private-probe-read-only",
    analysisEnvironment: "github-hosted-runner",
    bytes: bytes.length,
    sha256,
    verified: true,
    storageWrites: false,
    originalsAccessTested: false,
    sandboxDirectAccess: false,
  };
}
export function notice(report) {
  return (
    "::notice title=Private reference read proof::" +
    JSON.stringify(report)
      .replaceAll("%", "%25")
      .replaceAll("\r", "%0D")
      .replaceAll("\n", "%0A")
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const report = await readProbe();
    console.log(notice(report));
    if (process.env.GITHUB_STEP_SUMMARY)
      fs.appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        "# Private probe read\n\n```json\n" +
          JSON.stringify(report, null, 2) +
          "\n```\n",
      );
  } catch (error) {
    // Never print raw fetch errors, OIDC responses, request headers, or environment.
    const safeStatus =
      error instanceof Error
        ? /^Private probe read denied: HTTP ([0-9]{3})$/.exec(error.message)
        : null;
    console.error(
      "::error title=Private reference read proof::Nie potwierdzono odczytu prywatnego pliku testowego." +
        (safeStatus ? " HTTP " + safeStatus[1] + "." : "") +
        " Nie zmieniono ani nie usunięto danych.",
    );
    process.exitCode = 1;
  }
}
