import { CS } from './constants';
import type { Biome } from './world';

/** Compact, append-only survey data. One tile = one visited 16×16 chunk.
 * Never inspect unloaded terrain to fill the map: unreached areas stay unknown.
 * The two dimensions have separate coordinates and separate tiles. */
export type MapDimension = 'overworld' | 'nether';
export type MapTile = [cx: number, cz: number, biome: number, height: number];
export interface DiscoverySave { overworld: MapTile[]; nether: MapTile[] }
export const MAP_LIMIT = 16384;
export const MAP_BIOMES: Biome[] = [
  'Równiny', 'Las', 'Pustynia', 'Tundra', 'Góry', 'Plaża', 'Ocean',
  'Brzozowy las', 'Bagno', 'Sawanna', 'Dżungla', 'Nether', 'Tajga', 'Pustkowie', 'Kwiecista łąka', 'Ośnieżone szczyty', 'Płaskowyż', 'Wąwóz', 'Głęboka dolina', 'Rzeka', 'Jezioro',
];
export const MAP_COLORS = [
  '#79a655', '#426e41', '#d4bf79', '#dce3df', '#89959b', '#dfd299', '#316d9b',
  '#89ac75', '#617c66', '#afa861', '#317259', '#914c38', '#395b50', '#a8967a', '#91bf68',
  '#eef5f8', '#a08f67', '#575661', '#5a874f', '#338fb1', '#3684ae',
] as const;

function validTile(t: unknown): t is MapTile {
  return Array.isArray(t) && t.length === 4 && t.every((n) => typeof n === 'number' && Number.isInteger(n)) &&
    Math.abs(t[0]) <= 1_000_000 && Math.abs(t[1]) <= 1_000_000 &&
    t[2] >= 0 && t[2] < MAP_BIOMES.length && t[3] >= 0 && t[3] < 128;
}

export class DiscoveryMap {
  private tiles: Record<MapDimension, Map<string, MapTile>> = {
    overworld: new Map(), nether: new Map(),
  };

  static key(cx: number, cz: number) { return `${cx},${cz}`; }

  static fromSave(data: unknown): DiscoveryMap {
    const map = new DiscoveryMap();
    if (!data || typeof data !== 'object') return map;
    const record = data as Record<string, unknown>;
    for (const dim of ['overworld', 'nether'] as const) {
      if (!Array.isArray(record[dim])) continue;
      for (const tile of record[dim].slice(0, MAP_LIMIT)) {
        if (validTile(tile)) map.tiles[dim].set(DiscoveryMap.key(tile[0], tile[1]), [...tile]);
      }
    }
    return map;
  }

  get(dim: MapDimension, cx: number, cz: number): MapTile | undefined {
    return this.tiles[dim].get(DiscoveryMap.key(cx, cz));
  }

  count(dim: MapDimension): number { return this.tiles[dim].size; }

  /** Revisit updates height/biome (e.g. after player changes the surface), but
   * does not change map order. Once full, old discoveries are never evicted. */
  survey(dim: MapDimension, x: number, z: number, biome: Biome, height: number): boolean {
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const id = MAP_BIOMES.indexOf(biome);
    if (id < 0 || !Number.isFinite(cx) || !Number.isFinite(cz) ||
        Math.abs(cx) > 1_000_000 || Math.abs(cz) > 1_000_000 || !Number.isFinite(height)) return false;
    const key = DiscoveryMap.key(cx, cz);
    if (this.tiles[dim].has(key)) return false;
    if (this.tiles[dim].size >= MAP_LIMIT) return false;
    this.tiles[dim].set(key, [cx, cz, id, Math.max(0, Math.min(127, Math.floor(height)))]);
    return true;
  }

  serialize(): DiscoverySave {
    return {
      overworld: [...this.tiles.overworld.values()].map((t) => [...t]),
      nether: [...this.tiles.nether.values()].map((t) => [...t]),
    };
  }
}
