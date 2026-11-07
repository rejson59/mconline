import {
  PROFILE_KEY,
  profileRow,
  sanitizeProfile,
  type PlayerProfile,
} from "./profile";

function checkpointStorage(): Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
> {
  try {
    return localStorage;
  } catch {
    return {
      getItem: () => null,
      setItem() {
        throw new Error("Storage unavailable");
      },
      removeItem() {},
    };
  }
}
interface PendingProfile {
  profile: PlayerProfile;
  base: string | null;
  sent: string[];
}
export interface ProfileRecovery {
  id: string;
  created: string;
  reason: "server-conflict" | "invalid-pending";
  /** Exact original journal, including fields unknown to this release. */
  pending: string;
  remote: Record<string, unknown> | null;
}
/** Compare server timestamps without dropping PostgreSQL microseconds. This
 * normalizes equivalent ISO spellings, not browser clocks or newer/older order.
 */
export function sameProfileVersion(
  a: string | null,
  b: string | null,
): boolean {
  if (a === b) return true;
  const micros = (value: string | null): bigint | null => {
    const match = value?.match(
      /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/,
    );
    if (!match) return null;
    const seconds = Date.parse(`${match[1]}T${match[2]}${match[4]}`);
    return Number.isFinite(seconds)
      ? BigInt(seconds) * 1000n + BigInt((match[3] ?? "").padEnd(6, "0"))
      : null;
  };
  const x = micros(a),
    y = micros(b);
  return x !== null && y !== null && x === y;
}
/** Match actual snapshots, not Date.now(): two inventory changes may happen
 * within one millisecond (or after a clock adjustment).
 */
function sameSnapshot(a: PlayerProfile, b: PlayerProfile): boolean {
  return JSON.stringify(a) === JSON.stringify(sanitizeProfile(b));
}
/** Opaque server version, never browser timestamps. One journal per world/owner.
 * Unknown branches are archived before selecting the authoritative server copy;
 * they are never merged into live inventory (which could duplicate transfers).
 */
export class ProfileCheckpoint {
  private pending: PendingProfile | null = null;
  private original: string | null = null;
  private invalid = false;
  private base: string | null = null;
  private key: string;
  readonly recoveryKey: string;
  recoveryNotice: string | null = null;
  constructor(
    private world: string,
    private pid: string,
    private storage: Pick<
      Storage,
      "getItem" | "setItem" | "removeItem"
    > = checkpointStorage(),
  ) {
    this.key = `${PROFILE_KEY}:${world}:${pid}:pending`;
    this.recoveryKey = `${this.key}:recovery`;
    try {
      this.original = storage.getItem(this.key);
    } catch {
      /* Cloud/CAS still works. */
    }
    if (this.original) {
      try {
        const p = JSON.parse(this.original);
        const profile = sanitizeProfile(p.profile);
        if (
          !profile ||
          p.profile.inv === undefined ||
          p.profile.armor === undefined ||
          profile.pid !== pid ||
          (p.base !== null && typeof p.base !== "string") ||
          !Array.isArray(p.sent)
        )
          throw Error("Invalid journal");
        this.pending = {
          profile,
          base: p.base,
          sent: p.sent.filter((v: unknown) => typeof v === "string").slice(-64),
        };
        this.base = p.base;
      } catch {
        this.invalid = true;
      }
    }
  }
  load(raw: Record<string, unknown> | null): PlayerProfile | null {
    const remote = raw ? sanitizeProfile(raw) : null;
    if (
      raw &&
      (!remote ||
        raw.inv === undefined ||
        raw.armor === undefined ||
        remote.pid !== this.pid ||
        typeof raw.updated_at !== "string")
    )
      throw new Error("Nieprawidłowy zapis ekwipunku na serwerze.");
    const version = raw ? (raw.updated_at as string) : null;
    if (
      this.invalid ||
      (this.pending &&
        !sameProfileVersion(this.pending.base, version) &&
        !(
          typeof raw?.save_id === "string" &&
          this.pending.sent.includes(raw.save_id)
        ))
    ) {
      this.archive(raw);
      this.pending = null;
      this.invalid = false;
      this.original = null;
      // The old bytes are now durably archived. A failed remove is harmless:
      // future stage writes cannot destroy the only surviving recovery copy.
      try {
        this.storage.removeItem(this.key);
      } catch {
        /* Archive remains. */
      }
      this.base = version;
      this.recoveryNotice =
        "Wczytano aktualny zapis serwera. Osobną kopię niepotwierdzonego postępu zachowano bez zmian. /kopie pobiera obie wersje.";
      return remote;
    }
    this.base = version;
    if (this.pending) {
      this.pending.base = version;
      this.pending.sent = [];
      this.persist();
    }
    return this.pending?.profile ?? remote;
  }
  stage(profile: PlayerProfile): boolean {
    const snapshot = sanitizeProfile(profile);
    if (this.invalid || !snapshot || snapshot.pid !== this.pid) return false;
    this.pending = {
      profile: snapshot,
      base: this.base,
      sent: this.pending?.sent ?? [],
    };
    return this.persist();
  }
  /** Ordinary/exit writes need a durable intent even after the previous ACK
   * cleared pending. Shared transactions already have a separate fenced WAL;
   * staging their speculative result here would resurrect cancelled transfers.
   */
  row(profile: PlayerProfile, journal = true): Record<string, unknown> {
    if (this.invalid)
      throw Error("Najpierw wczytaj i zabezpiecz kopię postępu.");
    if (journal && !this.pending) this.stage(profile);
    const id = crypto.randomUUID();
    if (this.pending) {
      this.pending.sent = [...this.pending.sent, id].slice(-64);
      this.persist();
    }
    return {
      ...profileRow(profile, this.world),
      mconline_guard: true,
      mconline_base: this.base,
      mconline_save: id,
    };
  }
  acknowledge(raw: Record<string, unknown>, uploaded: PlayerProfile): void {
    if (typeof raw.updated_at !== "string")
      throw new Error("Brak potwierdzenia wersji zapisu ekwipunku.");
    this.base = raw.updated_at;
    if (this.pending && sameSnapshot(this.pending.profile, uploaded)) {
      this.pending = null;
      this.original = null;
      try {
        this.storage.removeItem(this.key);
      } catch {
        /* save_id identifies the commit. */
      }
    } else if (this.pending) {
      this.pending.base = this.base;
      this.pending.sent = [];
      this.persist();
    }
  }
  recoveries(): ProfileRecovery[] {
    const raw = this.storage.getItem(this.recoveryKey);
    if (!raw) return [];
    const rows: unknown = JSON.parse(raw);
    if (
      !Array.isArray(rows) ||
      rows.some(
        (r) =>
          !r ||
          typeof r.id !== "string" ||
          typeof r.pending !== "string" ||
          typeof r.created !== "string",
      )
    )
      throw Error(
        "Nieprawidłowy zbiór kopii odzyskiwania. Nie został nadpisany.",
      );
    return rows;
  }
  exportRecoveries(): { count: number; json: string } {
    const copies = this.recoveries();
    return {
      count: copies.length,
      json: JSON.stringify(
        { schema: 1, world: this.world, pid: this.pid, copies },
        null,
        2,
      ),
    };
  }
  private archive(remote: Record<string, unknown> | null): void {
    const pending = this.original ?? JSON.stringify(this.pending);
    const copies = this.recoveries();
    if (
      copies.some(
        (r) =>
          r.pending === pending &&
          JSON.stringify(r.remote) === JSON.stringify(remote),
      )
    )
      return;
    const next: ProfileRecovery = {
      id: crypto.randomUUID(),
      created: new Date().toISOString(),
      reason: this.invalid ? "invalid-pending" : "server-conflict",
      pending,
      remote,
    };
    try {
      this.storage.setItem(this.recoveryKey, JSON.stringify([...copies, next]));
      if (
        this.storage.getItem(this.recoveryKey) !==
        JSON.stringify([...copies, next])
      )
        throw Error("Archive not persisted");
    } catch {
      throw Error(
        "Brak miejsca na bezpieczną kopię postępu. Oryginalna kopia pozostała nietknięta; zapis serwera nie został zmieniony.",
      );
    }
  }
  private persist(): boolean {
    try {
      const raw = JSON.stringify(this.pending);
      this.storage.setItem(this.key, raw);
      this.original = raw;
      return true;
    } catch {
      return false;
    }
  }
}
