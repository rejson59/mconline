// Private, owner-only storage PROBE. No game RPCs, uploads, deletes or admin grants.
export const OWNER = "14734416-eab5-4209-a8df-78104ec6fd52";
export const BUCKET = "mconline-reference-private";
export const OBJECT = "probes/roundtrip-v1.txt";
export const CONTENT =
  "mconline reference storage probe v1\nNot a Minecraft asset. Never auto-deleted.\n";
const ORIGIN = "https://rejson59.github.io";
const ACCOUNT = "https://hzbqzfimtroixnldzjeq.supabase.co";
const ACCOUNT_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6YnF6ZmltdHJvaXhubGR6amVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1OTYzOTEsImV4cCI6MjEwODE3MjM5MX0.oeZWOaNd6p3wZBZQQu3QWjRHlrkxV_BFQRNSN-6YntE";
async function bounded(response: Response | Request, max = 8192) {
  if (!response.body) return "";
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let text = "",
    bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > max) throw new Error("limit");
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
async function missing(r: Response) {
  if (r.status === 404) return true;
  if (r.status !== 400) return false;
  try {
    const b = JSON.parse(await bounded(r));
    return (
      Number(b.statusCode) === 404 ||
      ["not_found", "Bucket not found", "Object not found"].includes(b.error) ||
      ["Bucket not found", "Object not found"].includes(b.message)
    );
  } catch {
    return false;
  }
}
export function referenceStorage(
  worldURL: string,
  serviceKey: string,
  request: typeof fetch = fetch,
) {
  return async (req: Request): Promise<Response> => {
    const headers = {
      "Access-Control-Allow-Origin": ORIGIN,
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      Vary: "Origin",
    };
    const reply = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });
    if (req.headers.get("origin") && req.headers.get("origin") !== ORIGIN)
      return reply({ error: "Niedozwolony origin." }, 403);
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (req.method !== "POST") return reply({ error: "Wymagane POST." }, 405);
    let stage = "autoryzacja";
    try {
      if (!worldURL || !serviceKey)
        return reply({ error: "Brak konfiguracji serwera." }, 503);
      if (Number(req.headers.get("content-length")) > 8192)
        return reply({ error: "Zbyt duże żądanie." }, 413);
      let b;
      try {
        b = JSON.parse(await bounded(req));
      } catch {
        return reply({ error: "Nieprawidłowe lub zbyt duże żądanie." }, 400);
      }
      if (!["status", "probe", "read"].includes(b?.op))
        return reply({ error: "Nieznana operacja." }, 400);
      if (
        typeof b.token !== "string" ||
        b.token.length < 16 ||
        b.token.length > 512
      )
        return reply({ error: "Zaloguj się przez konto strony." }, 401);
      const ir = await request(`${ACCOUNT}/rest/v1/rpc/mconline_identity`, {
        method: "POST",
        headers: {
          apikey: ACCOUNT_KEY,
          Authorization: `Bearer ${ACCOUNT_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_token: b.token }),
        signal: AbortSignal.timeout(12000),
      });
      if (!ir.ok)
        return reply(
          { error: "Nie udało się potwierdzić sesji." },
          ir.status >= 500 ? 503 : 401,
        );
      const identity = JSON.parse(await bounded(ir));
      if (identity.id !== OWNER)
        return reply(
          { error: "Panel jest dostępny tylko dla wskazanego właściciela." },
          403,
        );
      if (b.op === "status")
        return reply({ owner: "rejson59", mode: "probe-only" });
      const api = async (path: string, options: RequestInit = {}) =>
        request(`${worldURL}/storage/v1/${path}`, {
          ...options,
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            ...options.headers,
          },
          signal: AbortSignal.timeout(15000),
        });
      stage = "bucket";
      const checkBucket = async () => {
        const r = await api(`bucket/${BUCKET}`);
        if (!r.ok) return { exists: !(await missing(r)), valid: false };
        const x = JSON.parse(await bounded(r));
        return { exists: true, valid: x.id === BUCKET && x.public === false };
      };
      let bucket = await checkBucket();
      if (!bucket.exists && b.op === "probe") {
        const r = await api("bucket", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: BUCKET,
            name: BUCKET,
            public: false,
            file_size_limit: 10485760,
            allowed_mime_types: [
              "text/plain",
              "application/octet-stream",
              "application/json",
            ],
          }),
        });
        if (!r.ok && ![400, 409].includes(r.status)) throw new Error("bucket");
        bucket = await checkBucket();
      }
      if (!bucket.valid) throw new Error("private bucket");
      stage = "odczyt";
      let r = await api(`object/${BUCKET}/${OBJECT}`),
        created = false;
      if (!r.ok && b.op === "probe" && (await missing(r))) {
        stage = "zapis";
        const written = await api(`object/${BUCKET}/${OBJECT}`, {
          method: "POST",
          headers: { "Content-Type": "text/plain", "x-upsert": "false" },
          body: CONTENT,
        });
        // A concurrent request can create the same immutable probe. Always verify by reading.
        if (!written.ok && ![400, 409].includes(written.status))
          throw new Error("write");
        created = written.ok;
        stage = "odczyt";
        r = await api(`object/${BUCKET}/${OBJECT}`);
      }
      if (!r.ok) throw new Error("read");
      const actual = await bounded(r);
      if (actual !== CONTENT)
        throw new Error("content differs; never overwrite");
      stage = "ochrona publicznego odczytu";
      const anon = await request(
        `${worldURL}/storage/v1/object/public/${BUCKET}/${OBJECT}`,
        { method: "GET", signal: AbortSignal.timeout(15000) },
      );
      const denied = [400, 401, 403, 404].includes(anon.status);
      await anon.body?.cancel();
      if (!denied) throw new Error("public access not denied");
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(actual),
      );
      const sha256 = Array.from(new Uint8Array(digest), (v) =>
        v.toString(16).padStart(2, "0"),
      ).join("");
      return reply({
        owner: "rejson59",
        mode: "server-roundtrip-only",
        bucket: BUCKET,
        object: OBJECT,
        created,
        bytes: new TextEncoder().encode(actual).length,
        sha256,
        privateReadVerified: true,
        publicReadBlocked: true,
        originalsUploaded: false,
        analysisPrivateReadVerified: false,
      });
    } catch {
      return reply(
        {
          error: `Test niepotwierdzony: ${stage}. Nie usuwano ani nie nadpisywano danych.`,
        },
        503,
      );
    }
  };
}
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};
if (typeof Deno !== "undefined")
  Deno.serve(
    referenceStorage(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    ),
  );
