/** One shared cooperative budget for edits and streaming, not a budget per phase.
 * A mesh is atomic: a single job may exceed maxMs; it cannot be interrupted safely. */
export class ChunkWorkBudget {
  readonly start: number;
  attempts = 0;
  constructor(
    readonly maxMs: number,
    readonly limit: number,
    private clock = () => performance.now(),
  ) {
    this.start = clock();
  }
  take(): boolean {
    if (
      this.attempts >= this.limit ||
      (this.attempts > 0 && this.elapsedMs >= this.maxMs)
    )
      return false;
    this.attempts++;
    return true;
  }
  get elapsedMs() {
    return Math.max(0, this.clock() - this.start);
  }
}
/** Smaller frame budgets on faster displays; preserve the explicitly chosen FPS cap. */
export function chunkWorkLimits(
  configMs: number,
  perFrame: number,
  fpsCap: number,
  adaptive: number,
  loading: boolean,
) {
  const frameMs = 1000 / (fpsCap > 0 ? fpsCap : 60);
  return {
    maxMs: Math.max(
      1,
      Math.min(configMs, frameMs * 0.25) * adaptive * (loading ? 1.8 : 1),
    ),
    limit: Math.max(1, Math.floor(perFrame * (loading ? 2 : 1))),
  };
}
