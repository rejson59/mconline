import { PROFILE_KEY, profileRow, sanitizeProfile, type PlayerProfile } from './profile';

function checkpointStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  try { return localStorage; } catch { return { getItem: () => null, setItem() { throw new Error('Storage unavailable'); }, removeItem() {} }; }
}
interface PendingProfile { profile: PlayerProfile; base: string | null; sent: string[] }
/** Opaque server version, never browser timestamps. One journal per world/owner.
 * A lost response is identifiable by a server-committed save_id, including when
 * a newer local snapshot was made while the previous upload was in flight. */
export class ProfileCheckpoint {
  private pending: PendingProfile | null = null;
  private base: string | null = null;
  private key: string;
  constructor(private world: string, private pid: string, private storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = checkpointStorage()) {
    this.key = `${PROFILE_KEY}:${world}:${pid}:pending`;
    let raw: string | null = null;
    try { raw = storage.getItem(this.key); } catch { /* Storage unavailable: cloud/CAS still works. */ }
    if (raw) {
      const p = JSON.parse(raw);
      const profile = sanitizeProfile(p.profile);
      if (!profile || profile.pid !== pid || p.base !== null && typeof p.base !== 'string' || !Array.isArray(p.sent)) throw new Error('Nieprawidłowa kopia awaryjna ekwipunku. Nie została nadpisana.');
      this.pending = { profile, base: p.base, sent: p.sent.filter((v: unknown) => typeof v === 'string').slice(-64) };
      this.base = p.base;
    }
  }
  load(raw: Record<string, unknown> | null): PlayerProfile | null {
    const remote = raw ? sanitizeProfile(raw) : null;
    if (raw && (!remote || remote.pid !== this.pid || typeof raw.updated_at !== 'string')) throw new Error('Nieprawidłowy zapis ekwipunku na serwerze.');
    const version = raw ? raw.updated_at as string : null;
    if (this.pending && this.pending.base !== version && !(typeof raw?.save_id === 'string' && this.pending.sent.includes(raw.save_id))) {
      throw new Error('Serwer ma inny zapis ekwipunku niż niepotwierdzona kopia tej przeglądarki. Obie wersje zachowane; wejście przerwano, aby nie nadpisać przedmiotów.');
    }
    this.base = version;
    if (this.pending) { this.pending.base = version; this.pending.sent = []; this.persist(); }
    return this.pending?.profile ?? remote;
  }
  stage(profile: PlayerProfile): boolean {
    const snapshot = sanitizeProfile(profile);
    if (!snapshot || snapshot.pid !== this.pid) return false;
    this.pending = { profile: snapshot, base: this.base, sent: this.pending?.sent ?? [] };
    return this.persist();
  }
  row(profile: PlayerProfile): Record<string, unknown> {
    const id = crypto.randomUUID();
    if (this.pending) { this.pending.sent = [...this.pending.sent, id].slice(-64); this.persist(); }
    return { ...profileRow(profile, this.world), mconline_guard: true, mconline_base: this.base, mconline_save: id };
  }
  acknowledge(raw: Record<string, unknown>, uploaded: PlayerProfile): void {
    if (typeof raw.updated_at !== 'string') throw new Error('Brak potwierdzenia wersji zapisu ekwipunku.');
    this.base = raw.updated_at;
    if (this.pending?.profile.updated === uploaded.updated) {
      this.pending = null;
      try { this.storage.removeItem(this.key); } catch { /* An old journal is safe: save_id identifies this commit. */ }
    } else if (this.pending) { this.pending.base = this.base; this.pending.sent = []; this.persist(); }
  }
  private persist(): boolean {
    try { this.storage.setItem(this.key, JSON.stringify(this.pending)); return true; } catch { return false; }
  }
}
