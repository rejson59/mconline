import { cityBuildable, cityCell } from './city';
export interface Plot { cx: number; cz: number; owner: string; name: string }
export const PLOT_SIZE = 16;
export const PLOT_LIMIT = 4;
const KEY = 'blockcraft-plot-key-v1';
/** This capability is private. Never put it in presence, chat, exports or URLs. */
export function plotKey(): string {
  const saved = localStorage.getItem(KEY);
  if (saved && /^[a-f0-9]{64}$/.test(saved)) return saved;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const key = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  localStorage.setItem(KEY, key); // Fail closed if persistent ownership is unavailable.
  return key;
}
export class PlotAccess {
  constructor(readonly city = false) {}
  owner = '';
  revision = 0;
  private signature = '';
  ready = false;
  private plots = new Map<string, Plot>();
  update(owner: string, rows: Plot[]) {
    if (!/^[a-f0-9]{64}$/.test(owner) || !Array.isArray(rows)) throw new Error('Nieprawidłowa lista działek.');
    const next = new Map<string, Plot>();
    for (const p of rows) {
      if (!Number.isInteger(p.cx) || !Number.isInteger(p.cz) || !/^[a-f0-9]{64}$/.test(p.owner) || typeof p.name !== 'string') throw new Error('Nieprawidłowa działka.');
      next.set(`${p.cx},${p.cz}`, p);
    }
    const signature = JSON.stringify([...next.entries()].sort());
    if (signature !== this.signature) { this.revision++; this.signature = signature; }
    this.owner = owner; this.plots = next; this.ready = true;
  }
  at(x: number, z: number): Plot | undefined { if (this.city && !cityBuildable(x, z)) return undefined; return this.plots.get(`${(this.city ? cityCell(x) : Math.floor(x / PLOT_SIZE))},${(this.city ? cityCell(z) : Math.floor(z / PLOT_SIZE))}`); }
  canEdit(x: number, z: number, dimension: 'o' | 'n'): boolean {
    if (this.city) return this.ready && dimension === 'o' && cityBuildable(x, z) && this.at(x, z)?.owner === this.owner;
    return this.ready && (dimension === 'n' || !this.at(x, z) || this.at(x, z)?.owner === this.owner);
  }
  canFlow(x: number, z: number, nx: number, nz: number): boolean {
    if (this.city) return this.canEdit(x, z, 'o') && this.canEdit(nx, nz, 'o');
    return this.ready && this.at(x, z)?.owner === this.at(nx, nz)?.owner;
  }
  own(): Plot[] { return [...this.plots.values()].filter(p => p.owner === this.owner); }
}
