import { BLOCKS } from './blocks';
import { ITEMS, stackLimit } from './items';
import type { Stack } from './inventory';

export interface SharedDrop {
  uid: string;
  owner: string;
  d: 'o' | 'n';
  stack: Stack;
  pos: [number, number, number];
  vel: [number, number, number];
  created: number;
  expires: number;
  claimedBy?: string;
}
export const DROP_LIFETIME = 300_000;
export function validVector(v: unknown, bound = 1000000): v is [number, number, number] {
  return Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= bound);
}
export function cleanDrop(raw: unknown): SharedDrop | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as SharedDrop, s = d.stack;
  if (typeof d.uid !== 'string' || !/^[\w:-]{1,160}$/.test(d.uid) || typeof d.owner !== 'string' || !d.owner || d.owner.length > 80 ||
      (d.d !== 'o' && d.d !== 'n') || !validVector(d.pos) || !validVector(d.vel, 100) ||
      !Number.isFinite(d.created) || !Number.isFinite(d.expires) || d.expires <= d.created || d.expires - d.created > DROP_LIFETIME ||
      !s || !Number.isInteger(s.id) || !(BLOCKS[s.id] || ITEMS[s.id]) || !Number.isInteger(s.count) || s.count < 1 || s.count > stackLimit(s.id) ||
      (s.dur !== undefined && (!Number.isFinite(s.dur) || s.dur < 0 || s.dur > 100000)) ||
      (s.ench !== undefined && (typeof s.ench !== 'object' || s.ench === null || Array.isArray(s.ench) || Object.keys(s.ench).length > 16 || Object.values(s.ench).some(n => !Number.isInteger(n) || n < 0 || n > 10)))) return null;
  return { uid: d.uid, owner: d.owner, d: d.d, pos: [...d.pos], vel: [...d.vel], created: d.created, expires: d.expires,
    stack: { id: s.id, count: s.count, ...(s.dur !== undefined ? { dur: s.dur } : {}), ...(s.ench ? { ench: { ...s.ench } } : {}), ...(typeof s.name === 'string' ? { name: s.name.slice(0, 40) } : {}) },
    ...(typeof d.claimedBy === 'string' ? { claimedBy: d.claimedBy } : {}) };
}
/** Room host is the sole pickup arbiter. Keep tombstones: a retried spawn
 * must never resurrect an already collected item. Public rooms use SQL CAS. */
export class DropLedger {
  private rows = new Map<string, { drop: SharedDrop; ack: boolean }>();
  put(raw: unknown, from: string, now = Date.now()): SharedDrop | null {
    for (const [uid, row] of this.rows) if (row.drop.expires <= now && (row.ack || !row.drop.claimedBy)) this.rows.delete(uid);
    const d = cleanDrop(raw);
    if (!d || d.owner !== from || d.claimedBy || d.created > now + 10000 || d.expires <= now) return null;
    const old = this.rows.get(d.uid);
    if (old) return old.ack ? null : structuredClone(old.drop);
    if (this.rows.size >= 10000) return null;
    this.rows.set(d.uid, { drop: d, ack: false });
    return structuredClone(d);
  }
  claim(uid: string, who: string, dimension: 'o' | 'n', now = Date.now()): SharedDrop | null {
    const r = this.rows.get(uid);
    if (!r || r.ack || r.drop.d !== dimension || (!r.drop.claimedBy && r.drop.expires <= now) || (r.drop.claimedBy && r.drop.claimedBy !== who)) return null;
    r.drop.claimedBy = who;
    return structuredClone(r.drop);
  }
  ack(uid: string, who: string) {
    const r = this.rows.get(uid);
    if (r?.drop.claimedBy === who) r.ack = true;
  }
  list(who: string, now = Date.now()): SharedDrop[] {
    return [...this.rows.values()].filter(r => !r.ack && (r.drop.claimedBy === who || (!r.drop.claimedBy && r.drop.expires > now))).map(r => structuredClone(r.drop));
  }
}
