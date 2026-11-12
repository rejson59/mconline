import type { BufferGeometry } from "three";
import { World, CS, CH, type Chunk } from "./world";
import {
  currentMesh,
  snapshotMesh,
  snapshotTransfers,
  unpackGeometry,
  type MeshReply,
  type MeshStamp,
} from "./meshProtocol";

export interface MeshWorker {
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(message: unknown, transfer: ArrayBuffer[]): void;
  terminate(): void;
}
interface Job {
  id: number;
  stamp: MeshStamp;
  queuedAt: number;
  publish: (chunk: Chunk, geometries: BufferGeometry[]) => void;
  timer?: ReturnType<typeof setTimeout>;
}
/** One worker, one in-flight snapshot, no unbounded queue or hardwareConcurrency fanout. */
export class AsyncMesher {
  private worker?: MeshWorker;
  private job?: Job;
  private serial = 0;
  private staleCounts = new WeakMap<Chunk, number>();
  private disabled = false;
  private disposed = false;
  private completed = 0;
  private discarded = 0;
  private workerMs = 0;
  private snapshotMs = 0;
  private latencyMs = 0;
  constructor(
    private factory: () => MeshWorker,
    private timeoutMs = 8000,
  ) {}
  get busy() {
    return !!this.job;
  }
  get available() {
    return !this.disabled && !this.disposed;
  }
  report() {
    return {
      state: !this.available ? "sync" : this.busy ? "busy" : "worker",
      completed: this.completed,
      discarded: this.discarded,
      workerMs: this.workerMs,
      snapshotMs: this.snapshotMs,
      latencyMs: this.latencyMs,
    };
  }
  submit(
    world: World,
    cx: number,
    cz: number,
    publish: Job["publish"],
  ): boolean {
    if (!this.available || this.busy) return false;
    const center = world.chunks.get(World.key(cx, cz));
    if (center && (this.staleCounts.get(center) ?? 0) >= 3) {
      this.staleCounts.delete(center);
      return false; // Constant fluid/edit churn must not starve this mesh forever.
    }
    try {
      const worker = (this.worker ??= this.factory());
      const start = performance.now();
      const { stamp, snapshot } = snapshotMesh(world, cx, cz);
      this.snapshotMs = performance.now() - start;
      const job: Job = {
        id: ++this.serial,
        stamp,
        publish,
        queuedAt: performance.now(),
      };
      this.job = job;
      world.dirty.delete(World.key(cx, cz));
      worker.onmessage = (event) => {
        if (
          this.worker !== worker ||
          this.job !== job ||
          event.data?.id !== job.id
        )
          return;
        clearTimeout(job.timer);
        if (event.data.error) {
          this.fail();
          return;
        }
        if (!currentMesh(stamp)) {
          this.discarded++;
          const center = stamp.chunks[4].chunk;
          this.staleCounts.set(center, (this.staleCounts.get(center) ?? 0) + 1);
          this.requeue(job);
          this.job = undefined;
          return;
        }
        const reply = event.data as MeshReply;
        const geometries: BufferGeometry[] = [];
        try {
          if (
            reply.geometries.length !== 3 ||
            !Array.isArray(reply.lights) ||
            !(reply.sampledLight instanceof Uint8Array) ||
            reply.sampledLight.length !== CS * CS * CH ||
            !Number.isFinite(reply.ms)
          )
            throw new Error("Invalid mesh reply");
          for (const packet of reply.geometries)
            geometries.push(unpackGeometry(packet));
          job.publish(world.chunks.get(World.key(cx, cz))!, geometries);
          world.replaceChestLights(cx, cz, reply.lights);
          world.publishSampledLight(cx, cz, reply.sampledLight);
          this.staleCounts.delete(stamp.chunks[4].chunk);
          this.completed++;
          this.workerMs = reply.ms;
          this.latencyMs = performance.now() - job.queuedAt;
          this.job = undefined;
        } catch {
          for (const g of geometries) g.dispose();
          this.fail();
        }
      };
      worker.onerror = (event) => {
        event.preventDefault();
        if (this.worker === worker) this.fail();
      };
      worker.onmessageerror = () => {
        if (this.worker === worker) this.fail();
      };
      job.timer = setTimeout(() => {
        if (this.job === job) this.fail();
      }, this.timeoutMs);
      worker.postMessage({ id: job.id, snapshot }, snapshotTransfers(snapshot));
      return true;
    } catch {
      this.fail();
      return false;
    }
  }
  private requeue(job: Job) {
    const { world, cx, cz, chunks } = job.stamp;
    // Do not resurrect an unloaded chunk, nor overwrite its replacement.
    if (world.chunks.get(World.key(cx, cz)) === chunks[4].chunk)
      world.dirty.add(World.key(cx, cz));
  }
  private fail() {
    this.cancel();
    this.disabled = true; // CSP / crash / timeout: fall back for the rest of this game.
  }
  cancel() {
    if (this.job) {
      clearTimeout(this.job.timer);
      this.requeue(this.job);
    }
    this.job = undefined;
    if (this.worker) {
      this.worker.onmessage = null;
      this.worker.onerror = null;
      this.worker.onmessageerror = null;
      this.worker.terminate();
    }
    this.worker = undefined;
  }
  dispose() {
    this.cancel();
    this.disposed = true;
  }
}
