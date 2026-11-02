import { createHash } from 'node:crypto';
import type { BufferGeometry, BufferAttribute } from 'three';
export function meshFingerprint(geos: BufferGeometry[]) {
  const hash = createHash('sha256');
  let bytes = 0,
    vertices = 0,
    indices = 0;
  for (const g of geos) {
    for (const name of Object.keys(g.attributes).sort()) {
      const a = g.getAttribute(name) as BufferAttribute;
      hash.update(name);
      hash.update(String(a.itemSize));
      // Compare semantic float values, not the packed storage representation.
      hash.update(Buffer.from(Float32Array.from(a.array).buffer));
      bytes += a.array.byteLength;
      if (name === 'position') vertices += a.count;
    }
    const index = g.getIndex();
    if (index) {
      hash.update(Buffer.from(Uint32Array.from(index.array).buffer));
      bytes += index.array.byteLength;
      indices += index.count;
    }
  }
  return { hash: hash.digest('hex'), bytes, vertices, indices };
}
