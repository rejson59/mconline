/** Run the current reference tests against historical inventory/items code without checkout or editing the worktree.
 * node scripts/audit-native-baseline.mjs <full-commit-sha>
 * Failure is expected for buggy historical versions. AUDIT_REPORT can capture the detailed result.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
const root = fileURLToPath(new URL("../", import.meta.url)),
  ref = process.argv[2];
if (!ref || !/^[a-f0-9]{40}$/i.test(ref))
  throw Error("Provide a full local commit SHA");
const cache = path.join(root, "node_modules/.cache/native-audit");
mkdirSync(cache, { recursive: true });
const outfile = path.join(cache, "baseline.mjs");
await build({
  absWorkingDir: root,
  entryPoints: [".harness/nativeAudit.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile,
  plugins: [
    {
      name: "historical-game-code",
      setup(build) {
        build.onLoad(
          { filter: /[\\/]src[\\/]game[\\/](inventory|items)\.ts$/ },
          (args) => {
            const relative = path
              .relative(root, args.path)
              .split(path.sep)
              .join("/");
            return {
              contents: execFileSync("git", ["show", `${ref}:${relative}`], {
                cwd: root,
                encoding: "utf8",
              }),
              loader: "ts",
              resolveDir: path.dirname(args.path),
            };
          },
        );
      },
    },
  ],
});
console.log(
  "Historical inventory/items:",
  ref,
  "; worktree and branch unchanged",
);
const result = spawnSync(process.execPath, [outfile], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
process.exitCode = result.status ?? 1;
