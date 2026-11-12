import * as THREE from "three";
import { Chunk, World, CS } from "./world";

type ArrayData = THREE.BufferAttribute["array"];
export interface MeshSnapshot {
  cx: number;
  cz: number;
  chunks: {
    cx: number;
    cz: number;
    data: Uint16Array;
    heightMap: Uint16Array;
    maxY: number;
    nether: boolean;
    emitters: number[];
  }[];
  hidden: string[];
}
export interface GeometryPacket {
  attributes: Record<
    string,
    { array: ArrayData; itemSize: number; normalized: boolean }
  >;
  index: ArrayData | null;
  sphere: { center: [number, number, number]; radius: number } | null;
}
export interface MeshReply {
  id: number;
  geometries: GeometryPacket[];
  lights: [string, { sky: number; blk: number }][];
  sampledLight: Uint8Array;
  ms: number;
}
export interface MeshStamp {
  world: World;
  chunks: { chunk: Chunk; revision: number }[];
  cx: number;
  cz: number;
  hidden: string;
}
function hiddenLids(world: World, cx: number, cz: number) {
  return [...world.hiddenChestLids]
    .filter((key) => {
      const [x, , z] = key.split(",").map(Number);
      return Math.floor(x / CS) === cx && Math.floor(z / CS) === cz;
    })
    .sort();
}
/** Copy only. Never transfer/detach the live collision, save or multiplayer arrays. */
export function snapshotMesh(world: World, cx: number, cz: number) {
  const chunks: Chunk[] = [];
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++)
      chunks.push(world.getChunk(cx + dx, cz + dz));
  const hidden = hiddenLids(world, cx, cz);
  const stamp: MeshStamp = {
    world,
    cx,
    cz,
    hidden: JSON.stringify(hidden),
    chunks: chunks.map((chunk) => ({ chunk, revision: chunk.revision })),
  };
  const snapshot: MeshSnapshot = {
    cx,
    cz,
    hidden,
    chunks: chunks.map((c) => ({
      cx: c.cx,
      cz: c.cz,
      data: c.data.slice(),
      heightMap: c.heightMap.slice(),
      maxY: c.maxY,
      nether: c.nether,
      emitters: c.emitters.slice(),
    })),
  };
  return { stamp, snapshot };
}
export function currentMesh(stamp: MeshStamp): boolean {
  return (
    stamp.chunks.every(
      ({ chunk, revision }) =>
        stamp.world.chunks.get(World.key(chunk.cx, chunk.cz)) === chunk &&
        chunk.revision === revision,
    ) &&
    JSON.stringify(hiddenLids(stamp.world, stamp.cx, stamp.cz)) === stamp.hidden
  );
}
export function snapshotTransfers(snapshot: MeshSnapshot): ArrayBuffer[] {
  return snapshot.chunks.flatMap((c) => [
    c.data.buffer as ArrayBuffer,
    c.heightMap.buffer as ArrayBuffer,
  ]);
}
export function packGeometry(g: THREE.BufferGeometry): GeometryPacket {
  const attributes: GeometryPacket["attributes"] = {};
  for (const [name, a] of Object.entries(g.attributes))
    attributes[name] = {
      array: a.array,
      itemSize: a.itemSize,
      normalized: a.normalized,
    };
  if (g.getAttribute("position")) g.computeBoundingSphere();
  return {
    attributes,
    index: g.index?.array ?? null,
    sphere: g.boundingSphere
      ? {
          center: g.boundingSphere.center.toArray(),
          radius: g.boundingSphere.radius,
        }
      : null,
  };
}
export function unpackGeometry(packet: GeometryPacket): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(packet.attributes))
    g.setAttribute(
      name,
      new THREE.BufferAttribute(a.array, a.itemSize, a.normalized),
    );
  if (packet.index) g.setIndex(new THREE.BufferAttribute(packet.index, 1));
  if (packet.sphere)
    g.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(...packet.sphere.center),
      packet.sphere.radius,
    );
  return g;
}
export function replyTransfers(reply: MeshReply): ArrayBuffer[] {
  const buffers = new Set<ArrayBuffer>([
    reply.sampledLight.buffer as ArrayBuffer,
  ]);
  for (const g of reply.geometries) {
    for (const a of Object.values(g.attributes))
      buffers.add(a.array.buffer as ArrayBuffer);
    if (g.index) buffers.add(g.index.buffer as ArrayBuffer);
  }
  return [...buffers];
}
/** Exact same mesher, but a bounded isolated world with no generation or DOM. */
export function meshSnapshot(snapshot: MeshSnapshot, id: number): MeshReply {
  const start = performance.now();
  const world = new World(0);
  for (const data of snapshot.chunks) {
    const c = new Chunk(data.cx, data.cz, data.data, data.heightMap);
    Object.assign(c, data);
    world.chunks.set(World.key(c.cx, c.cz), c);
  }
  // Missing halo data is a protocol error, never silently generated terrain.
  world.getChunk = (x, z) => {
    const c = world.chunks.get(World.key(x, z));
    if (!c) throw new Error("Incomplete mesh snapshot");
    return c;
  };
  for (const key of snapshot.hidden) world.hiddenChestLids.add(key);
  const geometries = world.buildMesh(world.getChunk(snapshot.cx, snapshot.cz));
  try {
    return {
      id,
      geometries: geometries.map(packGeometry),
      lights: world.chunkChestLights(snapshot.cx, snapshot.cz),
      sampledLight: world.getChunk(snapshot.cx, snapshot.cz).sampledLight!.data,
      ms: performance.now() - start,
    };
  } finally {
    for (const g of geometries) g.dispose();
  }
}
