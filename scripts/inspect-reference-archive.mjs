#!/usr/bin/env node
/** Owner-dispatched metadata inventory only. Never transfers original files or writes Storage. */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { openArchive, ARCHIVE_AUDIENCE } from "./reference-archive-client.mjs";
async function bounded(response, limit) {
  if (!response.body) throw new Error("Identity response unavailable");
  const reader = response.body.getReader(),
    parts = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error("Identity response too large");
      parts.push(value);
    }
    return Buffer.concat(parts, size);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export async function inspectArchive(request = fetch, env = process.env, pin) {
  if (
    env.GITHUB_ACTIONS !== "true" ||
    env.GITHUB_REF !== "refs/heads/main" ||
    env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
    env.GITHUB_ACTOR_ID !== "185239338"
  )
    throw new Error("Owner main dispatch required");
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
  url.searchParams.set("audience", ARCHIVE_AUDIENCE);
  const identity = await request(url.href, {
    method: "GET",
    redirect: "error",
    credentials: "omit",
    headers: { Authorization: `Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` },
    signal: AbortSignal.timeout(15000),
  });
  if (identity.status !== 200) {
    await identity.body?.cancel();
    throw new Error("Job identity denied");
  }
  const { value } = JSON.parse(
    (await bounded(identity, 16384)).toString("utf8"),
  );
  const archive = await openArchive({
    request,
    tokenProvider: async () => value,
    ...(pin ? { pin } : {}),
  });
  if (archive.writesEnabled)
    throw new Error("Read-only inventory requires locked archive");
  const p = archive.plan;
  return {
    schema: 1,
    mode: "server-approved-declared-corpus-inventory",
    target: p.target,
    planDigestVerified: true,
    provenanceMatchesPinnedManifest: true,
    planSHA256: p.planSHA256,
    manifestSHA1: p.provenance.manifestSHA1,
    ...p.summary,
    maximumStoredBytes: archive.maximumStoredBytes,
    javaMajor: p.requirements.java.major,
    pending: p.pending,
    writesEnabled: false,
    storageWrites: false,
    originalsTransferred: false,
    independentBackupVerified: false,
    fullCorpusReady: false,
    officialMetadataBytesIndependentlyVerifiedByRunner: false,
  };
}
export function inventoryNotice(report) {
  return (
    "::notice title=Reference archive inventory::" +
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
    const report = await inspectArchive();
    console.log(inventoryNotice(report));
    if (process.env.GITHUB_STEP_SUMMARY)
      fs.appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        "# Reference archive inventory\n\n```json\n" +
          JSON.stringify(report, null, 2) +
          "\n```\n",
      );
  } catch {
    console.error(
      "::error title=Reference archive inventory::Nie potwierdzono inwentarza. Nie przesyłano oryginałów ani nie zmieniano Storage. Nie publikuj tokenów ani surowych odpowiedzi.",
    );
    process.exitCode = 1;
  }
}
