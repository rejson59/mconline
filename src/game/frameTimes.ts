export interface FrameReport {
  samples: number;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  low1Fps: number;
}
/** Fixed-memory recorder; no per-frame arrays, sorting or allocation. */
export class FrameTimes {
  private readonly values: Float64Array;
  private cursor = 0;
  private count = 0;
  private skipNext = false;
  constructor(capacity = 600) {
    this.values = new Float64Array(
      Math.max(
        1,
        Math.min(3600, Math.floor(Number.isFinite(capacity) ? capacity : 600)),
      ),
    );
  }
  record(ms: number) {
    if (!Number.isFinite(ms) || ms <= 0) return;
    if (this.skipNext) {
      this.skipNext = false;
      return;
    }
    this.values[this.cursor] = ms;
    this.cursor = (this.cursor + 1) % this.values.length;
    this.count = Math.min(this.count + 1, this.values.length);
  }
  reset(skipNext = false) {
    this.cursor = this.count = 0;
    this.skipNext = skipNext;
  }
  /** Called at HUD cadence only when F3 is open, or explicitly from diagnostics. */
  report(): FrameReport {
    if (!this.count)
      return {
        samples: 0,
        medianMs: 0,
        p95Ms: 0,
        p99Ms: 0,
        maxMs: 0,
        low1Fps: 0,
      };
    const sorted = this.values.slice(0, this.count).sort();
    const at = (p: number) =>
      sorted[Math.max(0, Math.ceil(this.count * p) - 1)];
    const tail = Math.max(1, Math.ceil(this.count * 0.01));
    let sum = 0;
    for (let i = this.count - tail; i < this.count; i++) sum += sorted[i];
    return {
      samples: this.count,
      medianMs: at(0.5),
      p95Ms: at(0.95),
      p99Ms: at(0.99),
      maxMs: at(1),
      low1Fps: (1000 * tail) / sum,
    };
  }
}
