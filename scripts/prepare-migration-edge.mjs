/** Immutable deployment input for the connector's single-file Edge API.
 * The Supabase bundler resolves a commit-pinned static import at deployment;
 * no mutable branch, credentials, user data or original game files are bundled.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const receipt = JSON.parse(execFileSync(process.execPath, ['scripts/compile-reference-archive.mjs'], { encoding: 'utf8' }));
const artifact = 'supabase/deploy/mconline-reference-archive.mjs';
fs.mkdirSync('supabase/deploy', { recursive: true });
const code = fs.readFileSync('.cache/reference-archive.js');
fs.writeFileSync(artifact, code);
fs.writeFileSync('docs/benchmarks/widgets-edge-build.json', JSON.stringify({ ...receipt, artifact, artifactSHA256: createHash('sha256').update(code).digest('hex'), purpose: 'Immutable single-file deployment input, generated own backend code only' }, null, 2) + '\n');
console.log('Prepared immutable archive Edge deployment input (' + code.byteLength + ' bytes)');
