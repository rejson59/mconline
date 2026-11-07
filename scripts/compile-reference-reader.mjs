/** Reproduce standalone Edge code with an exact, supported Deno npm dependency. */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { build, version } from "esbuild";
const root = new URL("../", import.meta.url);
const file = "supabase/functions/mconline-reference-reader/index.ts";
const source = fs.readFileSync(new URL(file, root), "utf8");
const jose = JSON.parse(fs.readFileSync(new URL("package.json", root)))
  .devDependencies.jose;
if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(jose))
  throw new Error("Exact jose version required");
const result = await build({
  stdin: { contents: source, loader: "ts", resolveDir: root.pathname },
  bundle: true,
  format: "esm",
  platform: "neutral",
  external: ["jose"],
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
fs.writeFileSync(new URL("reference-reader.js", dir), code);
console.log(
  JSON.stringify(
    {
      source: file,
      compiler: "esbuild " + version,
      external: "npm:jose@" + jose,
      sourceSHA256: createHash("sha256").update(source).digest("hex"),
      standaloneSHA256: createHash("sha256").update(code).digest("hex"),
      bytes: Buffer.byteLength(code),
    },
    null,
    2,
  ),
);
