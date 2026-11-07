/** Reproduce the standalone Edge source; no remote runtime code imports/secrets. */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { transform, version } from 'esbuild';
const source=fs.readFileSync(new URL('../supabase/functions/mconline-reference-storage/index.ts',import.meta.url),'utf8');
const {code}=await transform(source,{loader:'ts',format:'esm',target:'es2022',minify:true});
const dir=new URL('../.cache/',import.meta.url);fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(new URL('reference-function.js',dir),code);
const result={source:'supabase/functions/mconline-reference-storage/index.ts',compiler:'esbuild '+version,sourceSHA256:createHash('sha256').update(source).digest('hex'),standaloneSHA256:createHash('sha256').update(code).digest('hex'),bytes:Buffer.byteLength(code)};
console.log(JSON.stringify(result,null,2));
