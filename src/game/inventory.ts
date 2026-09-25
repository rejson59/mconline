import { B } from './blocks';

export interface Stack {
  id: number;
  count: number;
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
  { out: { id: B.GLASS, count: 1 }, inputs: [{ id: B.SAND, count: 1 }, { id: B.COAL_ORE, count: 1 }], table: true },
  { out: { id: B.STONE, count: 4 }, inputs: [{ id: B.COBBLE, count: 4 }, { id: B.COAL_ORE, count: 1 }], table: true },
  { out: { id: B.STONE_BRICKS, count: 4 }, inputs: [{ id: B.STONE, count: 4 }], table: true },
  { out: { id: B.BRICK, count: 2 }, inputs: [{ id: B.CLAY, count: 4 }, { id: B.COAL_ORE, count: 1 }], table: true },
  { out: { id: B.SANDSTONE, count: 1 }, inputs: [{ id: B.SAND, count: 4 }], table: false },
  { out: { id: B.BOOKSHELF, count: 1 }, inputs: [{ id: B.PLANKS, count: 6 }, { id: B.WOOL_WHITE, count: 1 }], table: true },
  { out: { id: B.TNT, count: 1 }, inputs: [{ id: B.SAND, count: 4 }, { id: B.COAL_ORE, count: 5 }], table: true },
  { out: { id: B.GLOWSTONE, count: 1 }, inputs: [{ id: B.GOLD_ORE, count: 1 }, { id: B.GLASS, count: 1 }], table: true },
  { out: { id: B.MOSSY, count: 1 }, inputs: [{ id: B.COBBLE, count: 1 }, { id: B.LEAVES, count: 1 }], table: false },
  { out: { id: B.WOOL_WHITE, count: 1 }, inputs: [{ id: B.TALLGRASS, count: 4 }], table: false },
  { out: { id: B.WOOL_RED, count: 1 }, inputs: [{ id: B.WOOL_WHITE, count: 1 }, { id: B.FLOWER_RED, count: 1 }], table: false },
  { out: { id: B.WOOL_YELLOW, count: 1 }, inputs: [{ id: B.WOOL_WHITE, count: 1 }, { id: B.FLOWER_YELLOW, count: 1 }], table: false },
  { out: { id: B.WOOL_GREEN, count: 1 }, inputs: [{ id: B.WOOL_WHITE, count: 1 }, { id: B.CACTUS, count: 1 }], table: false },
  { out: { id: B.WOOL_BLACK, count: 1 }, inputs: [{ id: B.WOOL_WHITE, count: 1 }, { id: B.COAL_ORE, count: 1 }], table: false },
  { out: { id: B.WOOL_BLUE, count: 1 }, inputs: [{ id: B.WOOL_WHITE, count: 1 }, { id: B.DIAMOND_ORE, count: 1 }], table: false },
  { out: { id: B.OBSIDIAN, count: 1 }, inputs: [{ id: B.STONE, count: 4 }, { id: B.DIAMOND_ORE, count: 1 }], table: true },
];

export class Inventory {
  slots: (Stack | null)[] = new Array(36).fill(null);
  cursor: Stack | null = null;

  add(id: number, count = 1): boolean {
    // stack into existing (hotbar first)
    for (let i = 0; i < 36 && count > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.count < MAX_STACK) {
        const n = Math.min(MAX_STACK - s.count, count);
        s.count += n;
        count -= n;
      }
    }
    for (let i = 0; i < 36 && count > 0; i++) {
      if (!this.slots[i]) {
        const n = Math.min(MAX_STACK, count);
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
    if (s.id === c.id) {
      const amount = right ? 1 : c.count;
      const n = Math.min(MAX_STACK - s.count, amount);
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
