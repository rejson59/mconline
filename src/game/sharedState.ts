import type { PlayerProfile } from "./profile";
import type { Stack } from "./inventory";
export interface ChestRef {
  d: "o" | "n";
  x: number;
  y: number;
  z: number;
}
export interface SharedChest extends ChestRef {
  slots: (Stack | null)[];
  revision: number;
  destroyed: boolean;
  legacyPending?: boolean;
}
export interface StateTransaction {
  id: string;
  ref: ChestRef;
  revision: number;
  slots: (Stack | null)[];
  profile: Record<string, unknown>;
  drops: unknown[];
  destroy?: boolean;
  dropBlock?: boolean;
}
export interface StateResult {
  committed: boolean;
  chest: SharedChest;
  profile: Record<string, unknown>;
}
/** A separate write-ahead record: an unconfirmed container transfer MUST NOT
 * become an ordinary profile upload. Replay the SAME operation before loading
 * a profile on another visit. The backend stores commit/abort tombstones. */
export class StateJournal {
  readonly key: string;
  constructor(
    world: string,
    pid: string,
    private storage: Pick<
      Storage,
      "getItem" | "setItem" | "removeItem"
    > = localStorage,
  ) {
    this.key = `mconline-container-v1:${world}:${pid}`;
  }
  read(): StateTransaction | import("./sharedMobs").MobTransaction | null {
    const text = this.storage.getItem(this.key);
    if (!text) return null;
    const tx = JSON.parse(text) as
      | StateTransaction
      | import("./sharedMobs").MobTransaction;
    if (
      !tx ||
      typeof tx.id !== "string" ||
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(tx.id) ||
      ("kind" in tx && tx.kind !== "mobs") ||
      !Number.isSafeInteger(tx.revision) ||
      tx.revision < 0 ||
      !tx.ref ||
      !["o", "n"].includes(tx.ref.d) ||
      ![tx.ref.x, tx.ref.y, tx.ref.z].every(Number.isSafeInteger) ||
      !("kind" in tx && tx.kind === "mobs"
        ? Array.isArray(tx.mobs)
        : Array.isArray(tx.slots)) ||
      !tx.profile ||
      typeof tx.profile !== "object" ||
      Array.isArray(tx.profile) ||
      !Array.isArray(tx.drops)
    )
      throw Error(
        "Nieprawidłowy dziennik transferu. Kopia nie została nadpisana.",
      );
    return tx;
  }
  write(tx: StateTransaction | import("./sharedMobs").MobTransaction) {
    if (this.read()) throw Error("Poprzedni transfer wymaga potwierdzenia.");
    this.storage.setItem(this.key, JSON.stringify(tx)); // failure cancels BEFORE sending
  }
  clear() {
    this.storage.removeItem(this.key);
  }
}
export interface SharedContainers {
  openSharedChest(
    ref: ChestRef,
    seed: (Stack | null)[],
    legacy?: (Stack | null)[],
  ): Promise<SharedChest>;
  prepareSharedAction(profile: PlayerProfile): Promise<void>;
  commitSharedChest(
    profile: PlayerProfile,
    chest: SharedChest,
    drops: unknown[],
    destroy?: boolean,
    dropBlock?: boolean,
  ): Promise<StateResult>;
}
