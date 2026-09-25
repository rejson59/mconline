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
}

export const RECIPES: Recipe[] = [
  { out: { id: B.PLANKS, count: 4 }, inputs: [{ id: B.LOG, count: 1 }], table: false },
  { out: { id: B.PLANKS, count: 4 }, inputs: [{ id: B.BIRCH_LOG, count: 1 }], table: false },
  { out: { id: B.CRAFTING, count: 1 }, inputs: [{ id: B.PLANKS, count: 4 }], table: false },
  { out: { id: B.FURNACE, count: 1 }, inputs: [{ id: B.COBBLE, count: 8 }], table: true },
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
  { out: { id: I.STICK, count: 4 }, inputs: [{ id: B.PLANKS, count: 2 }], table: false },
  { out: { id: B.TORCH, count: 4 }, inputs: [{ id: I.COAL, count: 1 }, { id: I.STICK, count: 1 }], table: false },
  { out: { id: I.BREAD, count: 1 }, inputs: [{ id: I.WHEAT, count: 3 }], table: false },
  { out: { id: I.BUCKET, count: 1 }, inputs: [{ id: I.IRON, count: 3 }], table: true },
  { out: { id: B.BED, count: 1 }, inputs: [{ id: B.WOOL_WHITE, count: 3 }, { id: B.PLANKS, count: 3 }], table: true },
  { out: { id: B.CHEST, count: 1 }, inputs: [{ id: B.PLANKS, count: 8 }], table: true },
  { out: { id: B.DOOR_N, count: 3 }, inputs: [{ id: B.PLANKS, count: 6 }], table: true },
  { out: { id: B.LADDER_N, count: 3 }, inputs: [{ id: I.STICK, count: 7 }], table: false },
  { out: { id: B.FENCE, count: 3 }, inputs: [{ id: B.PLANKS, count: 4 }, { id: I.STICK, count: 2 }], table: false },
  { out: { id: B.TRAP, count: 2 }, inputs: [{ id: B.PLANKS, count: 3 }], table: false },
  { out: { id: B.CAMPFIRE, count: 1 }, inputs: [{ id: I.STICK, count: 3 }, { id: I.COAL, count: 1 }], table: false },
  { out: { id: I.SHEARS, count: 1 }, inputs: [{ id: I.IRON, count: 2 }], table: true },
  { out: { id: I.FLINT_STEEL, count: 1 }, inputs: [{ id: I.FLINT, count: 1 }, { id: I.IRON, count: 1 }], table: false },
  { out: { id: I.COMPASS, count: 1 }, inputs: [{ id: I.IRON, count: 4 }, { id: I.COAL, count: 1 }], table: true },
  { out: { id: I.CLOCK, count: 1 }, inputs: [{ id: I.GOLD, count: 4 }, { id: I.COAL, count: 1 }], table: true },
];

function addTools(mat: number, pick: number, axe: number, shovel: number, sword: number, hoe: number) {
  RECIPES.push(
    { out: { id: pick, count: 1 }, inputs: [{ id: mat, count: 3 }, { id: I.STICK, count: 2 }], table: true },
    { out: { id: axe, count: 1 }, inputs: [{ id: mat, count: 3 }, { id: I.STICK, count: 2 }], table: true },
    { out: { id: shovel, count: 1 }, inputs: [{ id: mat, count: 1 }, { id: I.STICK, count: 2 }], table: true },
    { out: { id: sword, count: 1 }, inputs: [{ id: mat, count: 2 }, { id: I.STICK, count: 1 }], table: true },
    { out: { id: hoe, count: 1 }, inputs: [{ id: mat, count: 2 }, { id: I.STICK, count: 2 }], table: true }
  );
}
addTools(B.PLANKS, I.WOOD_PICK, I.WOOD_AXE, I.WOOD_SHOVEL, I.WOOD_SWORD, I.WOOD_HOE);
addTools(B.COBBLE, I.STONE_PICK, I.STONE_AXE, I.STONE_SHOVEL, I.STONE_SWORD, I.STONE_HOE);
addTools(I.IRON, I.IRON_PICK, I.IRON_AXE, I.IRON_SHOVEL, I.IRON_SWORD, I.IRON_HOE);
addTools(I.DIAMOND, I.DIAMOND_PICK, I.DIAMOND_AXE, I.DIAMOND_SHOVEL, I.DIAMOND_SWORD, I.DIAMOND_HOE);

export class Inventory {
  slots: (Stack | null)[] = new Array(36).fill(null);
  cursor: Stack | null = null;

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
