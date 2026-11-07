/** Reproduce standalone Edge code with an exact, supported Deno npm dependency. */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { build, version } from "esbuild";
const root = new URL("../", import.meta.url);
const file = "supabase/functions/mconline-reference-archive/index.ts";
const source = fs.readFileSync(new URL(file, root), "utf8");
const jose = JSON.parse(fs.readFileSync(new URL("package.json", root)))
  .devDependencies.jose;
if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(jose))
  throw new Error("Exact jose version required");
const result = await build({
  entryPoints: [new URL(file, root).pathname],
  bundle: true,
  format: "esm",
  platform: "node",
  external: ["jose", "node:buffer", "node:crypto"],
  target: "es2022",
  minify: true,
  write: false,
});
let code = result.outputFiles[0].text;
if (!code.includes('from"jose"'))
  throw new Error("Unexpected external dependency output");
code = code.replace('from"jose"', `from"npm:jose@${jose}"`);
const dir = new URL(".cache/", root);
fs.mkdirSync(dir, { recursive: true });
if (
  code.includes("node:fs") ||
  code.includes("process.argv") ||
  code.includes("directoryStore")
)
  throw new Error("Filesystem or CLI code must not enter the Edge module");
fs.writeFileSync(new URL("reference-archive.js", dir), code);
console.log(
  JSON.stringify(
    {
      source: file,
      compiler: "esbuild " + version,
      external: "npm:jose@" + jose,
      sourceSHA256: createHash("sha256").update(source).digest("hex"),
      inputs: Object.fromEntries(
        [
          file,
          "scripts/reference-official-pin.mjs",
          "scripts/reference-corpus-core.mjs",
          "scripts/reference-transfer-core.mjs",
        ].map((name) => [
          name,
          createHash("sha256")
            .update(fs.readFileSync(new URL(name, root)))
            .digest("hex"),
        ]),
      ),
      standaloneSHA256: createHash("sha256").update(code).digest("hex"),
      bytes: Buffer.byteLength(code),
    },
    null,
    2,
  ),
);
