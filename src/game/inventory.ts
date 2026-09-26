import { B } from './blocks';
import { I, stackLimit } from './items';

export interface Stack {
  id: number;
  count: number;
  /** Remaining uses. Absent means the tool is undamaged. */
  dur?: number;
}

export const MAX_STACK = 64;

export interface Recipe {
  out: Stack;
  inputs: Stack[];
  table: boolean;
  /**
   * Optional crafting-grid pattern (rows of characters, ' ' or '.' = empty).
   * When present the recipe can also be made by placing the items in that
   * shape – exactly like in Minecraft. `key` maps characters to item ids.
   */
  pattern?: string[];
  key?: Record<string, number>;
}

/** Trims a pattern to its bounding box so it can be matched anywhere in the grid. */
function trimPattern(rows: string[]): { rows: string[]; w: number; h: number } {
  let minX = 99, minY = 99, maxX = -1, maxY = -1;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === ' ' || c === '.') continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  });
  if (maxX < 0) return { rows: [], w: 0, h: 0 };
  const out: string[] = [];
  for (let y = minY; y <= maxY; y++) {
    let row = rows[y] ?? '';
    row = row.slice(minX, maxX + 1);
    out.push(row.padEnd(maxX - minX + 1, ' '));
  }
  return { rows: out, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export const RECIPES: Recipe[] = [
  { out: { id: B.PLANKS, count: 4 }, inputs: [{ id: B.LOG, count: 1 }], table: false },
  { out: { id: B.PLANKS, count: 4 }, inputs: [{ id: B.BIRCH_LOG, count: 1 }], table: false },
  { out: { id: B.CRAFTING, count: 1 }, inputs: [{ id: B.PLANKS, count: 4 }], table: false, pattern: ['PP', 'PP'], key: { P: B.PLANKS } },
  { out: { id: B.FURNACE, count: 1 }, inputs: [{ id: B.COBBLE, count: 8 }], table: true, pattern: ['CCC', 'C C', 'CCC'], key: { C: B.COBBLE } },
  { out: { id: B.GLASS, count: 1 }, inputs: [{ id: B.SAND, count: 1 }, { id: I.COAL, count: 1 }], table: true },
  { out: { id: B.STONE, count: 4 }, inputs: [{ id: B.COBBLE, count: 4 }, { id: I.COAL, count: 1 }], table: true },
  { out: { id: B.STONE_BRICKS, count: 4 }, inputs: [{ id: B.STONE, count: 4 }], table: true },
  { out: { id: B.BRICK, count: 2 }, inputs: [{ id: B.CLAY, count: 4 }, { id: I.COAL, count: 1 }], table: true },
  { out: { id: B.SANDSTONE, count: 1 }, inputs: [{ id: B.SAND, count: 4 }], table: false },
  { out: { id: B.BOOKSHELF, count: 1 }, inputs: [{ id: B.PLANKS, count: 6 }, { id: B.WOOL_WHITE, count: 1 }], table: true },
  { out: { id: B.TNT, count: 1 }, inputs: [{ id: B.SAND, count: 4 }, { id: I.COAL, count: 5 }], table: true },
  { out: { id: B.TNT, count: 1 }, inputs: [{ id: B.SAND, count: 4 }, { id: I.GUNPOWDER, count: 5 }], table: true },
  { out: { id: B.GLOWSTONE, count: 1 }, inputs: [{ id: B.GOLD_ORE, count: 1 }, { id: B.GLASS, count: 1 }], table: true },
  { out: { id: B.MOSSY, count: 1 }, inputs: [{ id: B.COBBLE, count: 1 }, { id: B.LEAVES, count: 1 }], table: false },
  { out: { id: B.WOOL_WHITE, count: 1 }, inputs: [{ id: B.TALLGRASS, count: 4 }], table: false },
  { out: { id: B.WOOL_RED, count: 1 }, inputs: [{ id: B.WOOL_WHITE, count: 1 }, { id: B.FLOWER_RED, count: 1 }], table: false },
  { out: { id: B.WOOL_YELLOW, count: 1 }, inputs: [{ id: B.WOOL_WHITE, count: 1 }, { id: B.FLOWER_YELLOW, count: 1 }], table: false },
  { out: { id: B.WOOL_GREEN, count: 1 }, inputs: [{ id: B.WOOL_WHITE, count: 1 }, { id: B.CACTUS, count: 1 }], table: false },
  { out: { id: B.WOOL_BLACK, count: 1 }, inputs: [{ id: B.WOOL_WHITE, count: 1 }, { id: I.COAL, count: 1 }], table: false },
  { out: { id: B.WOOL_BLUE, count: 1 }, inputs: [{ id: B.WOOL_WHITE, count: 1 }, { id: I.DIAMOND, count: 1 }], table: false },
  { out: { id: B.OBSIDIAN, count: 1 }, inputs: [{ id: B.STONE, count: 4 }, { id: I.DIAMOND, count: 1 }], table: true },
  { out: { id: I.COAL, count: 1 }, inputs: [{ id: B.COAL_ORE, count: 1 }], table: false },
  { out: { id: I.DIAMOND, count: 1 }, inputs: [{ id: B.DIAMOND_ORE, count: 1 }], table: false },
  { out: { id: I.STICK, count: 4 }, inputs: [{ id: B.PLANKS, count: 2 }], table: false, pattern: ['P', 'P'], key: { P: B.PLANKS } },
  { out: { id: B.TORCH, count: 4 }, inputs: [{ id: I.COAL, count: 1 }, { id: I.STICK, count: 1 }], table: false, pattern: ['C', 'S'], key: { C: I.COAL, S: I.STICK } },
  { out: { id: I.BREAD, count: 1 }, inputs: [{ id: I.WHEAT, count: 3 }], table: false },
  { out: { id: I.BUCKET, count: 1 }, inputs: [{ id: I.IRON, count: 3 }], table: true },
  { out: { id: B.BED, count: 1 }, inputs: [{ id: B.WOOL_WHITE, count: 3 }, { id: B.PLANKS, count: 3 }], table: true, pattern: ['WWW', 'PPP'], key: { W: B.WOOL_WHITE, P: B.PLANKS } },
  { out: { id: B.CHEST, count: 1 }, inputs: [{ id: B.PLANKS, count: 8 }], table: true, pattern: ['PPP', 'P P', 'PPP'], key: { P: B.PLANKS } },
  { out: { id: B.DOOR_N, count: 3 }, inputs: [{ id: B.PLANKS, count: 6 }], table: true, pattern: ['PP', 'PP', 'PP'], key: { P: B.PLANKS } },
  { out: { id: B.LADDER_N, count: 3 }, inputs: [{ id: I.STICK, count: 7 }], table: false, pattern: ['S S', 'SSS', 'S S'], key: { S: I.STICK } },
  { out: { id: B.FENCE, count: 3 }, inputs: [{ id: B.PLANKS, count: 4 }, { id: I.STICK, count: 2 }], table: false, pattern: ['PSP', 'PSP'], key: { P: B.PLANKS, S: I.STICK } },
  { out: { id: B.TRAP, count: 2 }, inputs: [{ id: B.PLANKS, count: 3 }], table: false },
  { out: { id: B.CAMPFIRE, count: 1 }, inputs: [{ id: I.STICK, count: 3 }, { id: I.COAL, count: 1 }], table: false },
  { out: { id: I.SHEARS, count: 1 }, inputs: [{ id: I.IRON, count: 2 }], table: true },
  { out: { id: I.FLINT_STEEL, count: 1 }, inputs: [{ id: I.FLINT, count: 1 }, { id: I.IRON, count: 1 }], table: false },
  { out: { id: I.COMPASS, count: 1 }, inputs: [{ id: I.IRON, count: 4 }, { id: I.COAL, count: 1 }], table: true },
  { out: { id: I.CLOCK, count: 1 }, inputs: [{ id: I.GOLD, count: 4 }, { id: I.COAL, count: 1 }], table: true },
  { out: { id: B.IRON_BLOCK, count: 1 }, inputs: [{ id: I.IRON, count: 9 }], table: true, pattern: ['III', 'III', 'III'], key: { I: I.IRON } },
  { out: { id: B.GOLD_BLOCK, count: 1 }, inputs: [{ id: I.GOLD, count: 9 }], table: true, pattern: ['GGG', 'GGG', 'GGG'], key: { G: I.GOLD } },
  { out: { id: B.DIAMOND_BLOCK, count: 1 }, inputs: [{ id: I.DIAMOND, count: 9 }], table: true, pattern: ['DDD', 'DDD', 'DDD'], key: { D: I.DIAMOND } },
  { out: { id: I.IRON, count: 9 }, inputs: [{ id: B.IRON_BLOCK, count: 1 }], table: false },
  { out: { id: I.GOLD, count: 9 }, inputs: [{ id: B.GOLD_BLOCK, count: 1 }], table: false },
  { out: { id: I.DIAMOND, count: 9 }, inputs: [{ id: B.DIAMOND_BLOCK, count: 1 }], table: false },
  { out: { id: I.BOW, count: 1 }, inputs: [{ id: I.STICK, count: 3 }, { id: I.STRING, count: 3 }], table: true, pattern: [' #S', '# S', ' #S'], key: { '#': I.STICK, S: I.STRING } },
  { out: { id: I.ARROW, count: 4 }, inputs: [{ id: I.FLINT, count: 1 }, { id: I.STICK, count: 1 }, { id: I.FEATHER, count: 1 }], table: false },
  { out: { id: I.SHIELD, count: 1 }, inputs: [{ id: B.PLANKS, count: 6 }, { id: I.IRON, count: 1 }], table: true, pattern: ['PIP', 'PPP', 'PPP'], key: { P: B.PLANKS, I: I.IRON } },
];

/**
 * Armor sets, Minecraft-style patterns at the crafting table:
 * helmet 5, chestplate 8, leggings 7, boots 4 pieces of the material.
 */
const HELMET_PATTERN = ['LLL', 'L L'];
const CHEST_PATTERN = ['L L', 'LLL', 'LLL'];
const LEGS_PATTERN = ['LLL', 'L L', 'L L'];
const BOOTS_PATTERN = ['L L', 'L L'];

function addArmor(mat: number, ids: [number, number, number, number]) {
  const key = { L: mat };
  const counts = [5, 8, 7, 4];
  const patterns = [HELMET_PATTERN, CHEST_PATTERN, LEGS_PATTERN, BOOTS_PATTERN];
  RECIPES.push(
    { out: { id: ids[0], count: 1 }, inputs: [{ id: mat, count: counts[0] }], table: true, pattern: patterns[0], key },
    { out: { id: ids[1], count: 1 }, inputs: [{ id: mat, count: counts[1] }], table: true, pattern: patterns[1], key },
    { out: { id: ids[2], count: 1 }, inputs: [{ id: mat, count: counts[2] }], table: true, pattern: patterns[2], key },
    { out: { id: ids[3], count: 1 }, inputs: [{ id: mat, count: counts[3] }], table: true, pattern: patterns[3], key }
  );
}
addArmor(I.LEATHER, [I.LEATHER_HELMET, I.LEATHER_CHEST, I.LEATHER_LEGS, I.LEATHER_BOOTS]);
addArmor(I.IRON, [I.IRON_HELMET, I.IRON_CHEST, I.IRON_LEGS, I.IRON_BOOTS]);
addArmor(I.GOLD, [I.GOLD_HELMET, I.GOLD_CHEST, I.GOLD_LEGS, I.GOLD_BOOTS]);
addArmor(I.DIAMOND, [I.DIAMOND_HELMET, I.DIAMOND_CHEST, I.DIAMOND_LEGS, I.DIAMOND_BOOTS]);

function addTools(mat: number, pick: number, axe: number, shovel: number, sword: number, hoe: number) {
  // 'M' is the material (planks / cobble / ingot / gem), 'S' a stick
  const key = { M: mat, S: I.STICK };
  RECIPES.push(
    { out: { id: pick, count: 1 }, inputs: [{ id: mat, count: 3 }, { id: I.STICK, count: 2 }], table: true, pattern: ['MMM', ' S ', ' S '], key },
    { out: { id: axe, count: 1 }, inputs: [{ id: mat, count: 3 }, { id: I.STICK, count: 2 }], table: true, pattern: ['MM', 'MS', ' S'], key },
    { out: { id: shovel, count: 1 }, inputs: [{ id: mat, count: 1 }, { id: I.STICK, count: 2 }], table: true, pattern: ['M', 'S', 'S'], key },
    { out: { id: sword, count: 1 }, inputs: [{ id: mat, count: 2 }, { id: I.STICK, count: 1 }], table: true, pattern: ['M', 'M', 'S'], key },
    { out: { id: hoe, count: 1 }, inputs: [{ id: mat, count: 2 }, { id: I.STICK, count: 2 }], table: true, pattern: ['MM', ' S', ' S'], key }
  );
}
addTools(B.PLANKS, I.WOOD_PICK, I.WOOD_AXE, I.WOOD_SHOVEL, I.WOOD_SWORD, I.WOOD_HOE);
addTools(B.COBBLE, I.STONE_PICK, I.STONE_AXE, I.STONE_SHOVEL, I.STONE_SWORD, I.STONE_HOE);
addTools(I.IRON, I.IRON_PICK, I.IRON_AXE, I.IRON_SHOVEL, I.IRON_SWORD, I.IRON_HOE);
addTools(I.DIAMOND, I.DIAMOND_PICK, I.DIAMOND_AXE, I.DIAMOND_SHOVEL, I.DIAMOND_SWORD, I.DIAMOND_HOE);

export class Inventory {
  slots: (Stack | null)[] = new Array(36).fill(null);
  cursor: Stack | null = null;
  /** 3x3 crafting grid; only the top-left 2x2 is used without a table. */
  grid: (Stack | null)[] = new Array(9).fill(null);

  add(id: number, count = 1, dur?: number): boolean {
    const limit = stackLimit(id);
    // Damaged or unstackable items each take their own slot.
    if (dur !== undefined || limit === 1) {
      for (let i = 0; i < 36 && count > 0; i++) {
        if (!this.slots[i]) {
          this.slots[i] = dur !== undefined ? { id, count: 1, dur } : { id, count: 1 };
          count--;
        }
      }
      return count === 0;
    }
    for (let i = 0; i < 36 && count > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.dur === undefined && s.count < limit) {
        const n = Math.min(limit - s.count, count);
        s.count += n;
        count -= n;
      }
    }
    for (let i = 0; i < 36 && count > 0; i++) {
      if (!this.slots[i]) {
        const n = Math.min(limit, count);
        this.slots[i] = { id, count: n };
        count -= n;
      }
    }
    return count === 0;
  }

  countOf(id: number): number {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }

  remove(id: number, count: number) {
    for (let i = 35; i >= 0 && count > 0; i--) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const n = Math.min(s.count, count);
        s.count -= n;
        count -= n;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
  }

  /** Number of usable grid cells (2x2 without a table, 3x3 with one). */
  private gridSize(table: boolean): number {
    return table ? 9 : 4;
  }

  /**
   * The recipe the crafting grid currently matches, or null. Shaped recipes are
   * matched by their pattern (anywhere in the grid), shapeless ones by the
   * multiset of items placed.
   */
  gridMatch(table: boolean): Recipe | null {
    const size = this.gridSize(table);
    const cols = size === 9 ? 3 : 2;
    const at = (x: number, y: number) => this.grid[y * 3 + x] ?? null;
    let minX = cols, minY = 3, maxX = -1, maxY = -1;
    const have = new Map<number, number>();
    for (let y = 0; y < 3; y++) for (let x = 0; x < cols; x++) {
      const cell = at(x, y);
      if (!cell) continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      have.set(cell.id, (have.get(cell.id) ?? 0) + 1);
    }
    if (maxX < 0) return null;
    const w = maxX - minX + 1, h = maxY - minY + 1;

    for (const r of RECIPES) {
      if (r.table && !table) continue;
      if (r.pattern) {
        const p = trimPattern(r.pattern);
        if (p.w !== w || p.h !== h || p.w > cols) continue;
        let ok = true;
        for (let y = 0; y < h && ok; y++) {
          for (let x = 0; x < w && ok; x++) {
            const ch = p.rows[y][x] ?? ' ';
            const want = ch === ' ' || ch === '.' ? 0 : (r.key?.[ch] ?? -1);
            const cell = at(minX + x, minY + y);
            if (want === 0) { if (cell) ok = false; }
            else if (!cell || cell.id !== want) ok = false;
          }
        }
        if (ok) return r;
      } else {
        // shapeless: the placed items must be exactly the recipe inputs
        if (have.size !== new Set(r.inputs.map((i) => i.id)).size) continue;
        let ok = true;
        for (const inp of r.inputs) if (have.get(inp.id) !== inp.count) { ok = false; break; }
        if (ok) return r;
      }
    }
    return null;
  }

  /** Moves items between the cursor and a crafting-grid slot. */
  clickGrid(i: number, right: boolean) {
    const cell = this.grid[i];
    if (this.cursor) {
      if (!cell) {
        // right click drops a single item – the natural way to fill a pattern
        if (right && this.cursor.count > 1) {
          this.grid[i] = { id: this.cursor.id, count: 1, dur: this.cursor.dur };
          this.cursor.count -= 1;
        } else {
          this.grid[i] = this.cursor;
          this.cursor = null;
        }
        return;
      }
      if (cell.id === this.cursor.id && cell.dur === undefined && this.cursor.dur === undefined) {
        const limit = stackLimit(cell.id);
        const n = right ? Math.min(1, this.cursor.count) : this.cursor.count;
        const move = Math.min(n, limit - cell.count, this.cursor.count);
        if (move > 0) { cell.count += move; this.cursor.count -= move; }
        if (this.cursor.count <= 0) this.cursor = null;
        return;
      }
      // swap
      this.grid[i] = this.cursor;
      this.cursor = cell;
      return;
    }
    if (!cell) return;
    if (right && cell.count > 1) {
      const half = Math.ceil(cell.count / 2);
      this.cursor = { id: cell.id, count: half, dur: cell.dur };
      cell.count -= half;
      if (cell.count <= 0) this.grid[i] = null;
    } else {
      this.cursor = cell;
      this.grid[i] = null;
    }
  }

  /** Takes the current grid result, consuming one of every ingredient. */
  craftGrid(table: boolean): Stack | null {
    const r = this.gridMatch(table);
    if (!r) return null;
    const out: Stack = { ...r.out };
    if (out.dur === undefined && r.out.dur !== undefined) out.dur = r.out.dur;
    for (let i = 0; i < 9; i++) {
      const cell = this.grid[i];
      if (!cell) continue;
      cell.count -= 1;
      if (cell.count <= 0) this.grid[i] = null;
    }
    return out;
  }

  /** Puts every grid item back into the inventory (closing the screen). */
  returnGrid(): (Stack | null)[] {
    const leftovers: (Stack | null)[] = [];
    for (let i = 0; i < 9; i++) {
      const cell = this.grid[i];
      if (!cell) continue;
      if (!this.add(cell.id, cell.count, cell.dur)) leftovers.push(cell);
      this.grid[i] = null;
    }
    return leftovers;
  }

  canCraft(r: Recipe): boolean {
    return r.inputs.every((inp) => this.countOf(inp.id) >= inp.count);
  }

  craft(r: Recipe): boolean {
    if (!this.canCraft(r)) return false;
    for (const inp of r.inputs) this.remove(inp.id, inp.count);
    this.add(r.out.id, r.out.count);
    return true;
  }

  clickSlot(i: number, right = false) {
    const s = this.slots[i];
    const c = this.cursor;
    if (!c) {
      if (!s) return;
      if (right && s.count > 1) {
        const half = Math.ceil(s.count / 2);
        this.cursor = { id: s.id, count: half };
        s.count -= half;
      } else {
        this.cursor = s;
        this.slots[i] = null;
      }
      return;
    }
    if (!s) {
      if (right) {
        this.slots[i] = { id: c.id, count: 1 };
        c.count--;
        if (c.count <= 0) this.cursor = null;
      } else {
        this.slots[i] = c;
        this.cursor = null;
      }
      return;
    }
    if (s.id === c.id && s.dur === undefined && c.dur === undefined) {
      const amount = right ? 1 : c.count;
      const n = Math.min(stackLimit(s.id) - s.count, amount);
      s.count += n;
      c.count -= n;
      if (c.count <= 0) this.cursor = null;
      return;
    }
    this.slots[i] = c;
    this.cursor = s;
  }

  returnCursor() {
    if (this.cursor) {
      this.add(this.cursor.id, this.cursor.count);
      this.cursor = null;
    }
  }
}
