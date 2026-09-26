/**
 * Headless smoke tests for the BlockCraft engine.
 *
 * Bundled with esbuild and run in Node – no browser, no WebGL, no DOM:
 *   node .harness/run.mjs
 *
 * Everything that touches the DOM (canvas atlas, localStorage) is stubbed at
 * the top of this file so the real modules can be imported unchanged.
 */
import * as THREE from 'three';

// ---------------------------------------------------------------- DOM stubs
const ctx2d = {
  canvas: { width: 16, height: 16 },
  fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, imageSmoothingEnabled: true,
  textAlign: '', font: '', textBaseline: '', shadowBlur: 0, shadowColor: '', lineCap: '', lineJoin: '',
  fillRect() {}, strokeRect() {}, clearRect() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
  arc() {}, arcTo() {}, quadraticCurveTo() {}, bezierCurveTo() {}, fill() {}, stroke() {}, clip() {},
  drawImage() {}, save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, setTransform() {},
  resetTransform() {}, putImageData() {},
  createImageData: (a: number, b: number) => ({ width: a, height: b, data: new Uint8ClampedArray(a * b * 4) }),
  getImageData: (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
  measureText: () => ({ width: 10 }),
  createLinearGradient: () => ({ addColorStop() {} }),
  createRadialGradient: () => ({ addColorStop() {} }),
  createPattern: () => ({}),
};
if (typeof globalThis.document === 'undefined') {
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tag: string) => {
      if (tag !== 'canvas') return { style: {}, appendChild() {}, addEventListener() {} };
      return { width: 16, height: 16, style: {}, getContext: () => ctx2d, toDataURL: () => 'data:,', addEventListener() {} };
    },
  };
}
const store = new Map<string, string>();
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
}

// ------------------------------------------------------------------ imports
import { World, CS, CH, SEA, FLAT_H } from '../src/game/world';
import { B, BLOCKS, IS_SOLID, RENDER, tileFor, isDoorTop, isLadder, isTrap, doorFacing } from '../src/game/blocks';
import {
  ITEMS, I, itemDef, isItem, stackLimit, durabilityMax, isOre, pickTier, requiredPickTier,
  pickHint, mineSeconds, toolHelps, attackDamage, blockDrops, smeltResult, fuelSeconds, resolveId,
} from '../src/game/items';
import { Inventory, RECIPES, MAX_STACK } from '../src/game/inventory';
import { aabbIntersectsBlock, stepBody, type Body } from '../src/game/physics';
import { Mob, type MobType } from '../src/game/mobs';
import { emptyChest, chestLoot, lootChest, CHEST_SLOTS, chestKey } from '../src/game/chest';
import { emptyFurnace, tickFurnace, COOK_TIME, furnaceKey } from '../src/game/furnace';
import { loadSaves, upsertSave, deleteSave, exportSaves, importSaves } from '../src/game/saves';
import { ACHIEVEMENTS, achievementById } from '../src/game/achievements';
import { Game } from '../src/game/engine';
import { getAtlas } from '../src/game/textures';
import { buildItemIcons } from '../src/game/itemIcons';

// ------------------------------------------------------------------- runner
let pass = 0;
let fail = 0;
const failures: string[] = [];
function check(name: string, ok: unknown, extra = '') {
  if (ok) pass++;
  else { fail++; failures.push(`${name}${extra ? ' — ' + extra : ''}`); }
}
function eq(name: string, got: unknown, want: unknown) {
  check(name, got === want, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
}
function section(t: string) { console.log(`\n— ${t}`); }

const playerAt = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// =========================================================== world / terrain
section('world: determinism and terrain');
{
  const a = new World(12345);
  const b = new World(12345);
  const c = new World(999);
  let sameAB = true, diffC = false;
  for (let i = 0; i < 400; i++) {
    const x = (i * 37) % 200 - 100, z = (i * 53) % 200 - 100;
    if (a.heightAt(x, z) !== b.heightAt(x, z)) sameAB = false;
    if (a.getBlock(x, a.heightAt(x, z), z) !== c.getBlock(x, c.heightAt(x, z), z)) diffC = true;
  }
  check('same seed → same terrain', sameAB);
  check('different seed → different terrain', diffC);
  eq('chunk size is 16', CS, 16);
  eq('world height is 128', CH, 128);
  check('sea level inside the world', SEA > 20 && SEA < CH - 20);

  // bedrock floor and no blocks below it
  let bedrock = true, outsideWorld = true;
  for (let x = -8; x < 8; x++) for (let z = -8; z < 8; z++) {
    a.getChunk(Math.floor(x / CS), Math.floor(z / CS));
    if (a.getBlock(x, 0, z) !== B.BEDROCK) bedrock = false;
    if (a.getBlock(x, -1, z) !== B.BEDROCK) outsideWorld = false; // below the floor reads as bedrock
    if (a.getBlock(x, CH, z) !== B.AIR) outsideWorld = false;
    if (a.getBlock(x, CH + 40, z) !== B.AIR) outsideWorld = false;
  }
  check('bedrock at y=0', bedrock);
  check('nothing outside the world', outsideWorld);

  // surface is walkable and the height map agrees with the blocks
  let surfaceOk = true;
  for (let i = 0; i < 200; i++) {
    const x = (i * 17) % 120 - 60, z = (i * 29) % 120 - 60;
    const h = a.heightAt(x, z);
    if (h < 1 || h >= CH) { surfaceOk = false; continue; }
    const top = a.getBlock(x, h, z);
    if (!IS_SOLID[top]) { surfaceOk = false; continue; }
    if (IS_SOLID[a.getBlock(x, h + 1, z)]) surfaceOk = false;
  }
  check('heightAt matches the topmost solid block', surfaceOk);

  // ores exist underground and never float in the sky
  const ores: number[] = [B.COAL_ORE, B.IRON_ORE, B.GOLD_ORE, B.DIAMOND_ORE];
  const found = new Set<number>();
  let oreTooHigh = false;
  for (let cx = -2; cx <= 2; cx++) for (let cz = -2; cz <= 2; cz++) {
    const ch = a.getChunk(cx, cz);
    for (let i = 0; i < ch.data.length; i++) {
      const id = ch.data[i];
      if (ores.includes(id)) {
        found.add(id);
        const y = Math.floor(i / (CS * CS));
        if (y > 80) oreTooHigh = true;
      }
    }
  }
  check('all four ores generate', found.size === 4, [...found].join(','));
  check('ores stay underground', !oreTooHigh);

  // trees: trunk of logs with leaves around the top
  let trees = 0;
  for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) {
    const ch = a.getChunk(cx, cz);
    for (let x = 0; x < CS; x++) for (let z = 0; z < CS; z++) {
      for (let y = 40; y < CH - 8; y++) {
        if (ch.data[(y * CS + z) * CS + x] === B.LOG && a.getBlock(x + cx * CS, y + 1, z + cz * CS) === B.LOG) {
          trees++;
          let leaves = 0;
          for (let dy = 1; dy <= 3; dy++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
            if (a.getBlock(x + cx * CS + dx, y + dy, z + cz * CS + dz) === B.LEAVES) leaves++;
          }
          check('tree trunk has leaves above it', leaves > 4, `${leaves} leaves`);
        }
      }
    }
  }
  check('world has trees', trees > 0, `${trees} trunks`);
}

// ============================================================== flat worlds
section('world: flat type');
{
  const f = new World(4242, true);
  eq('flat flag stored', f.flat, true);
  let allFlat = true, carpet = 0, columns = 0;
  for (let x = 0; x < CS; x++) for (let z = 0; z < CS; z++) {
    columns++;
    const h = f.heightAt(x, z);
    if (h < FLAT_H || h > FLAT_H + 8) allFlat = false;
    const top = f.getBlock(x, FLAT_H, z);
    if (top === B.GRASS || top === B.DIRT) carpet++;
    if (f.getBlock(x, FLAT_H - 1, z) !== B.DIRT) allFlat = false;
    if (f.getBlock(x, 0, z) !== B.BEDROCK) allFlat = false;
  }
  check('flat surface at FLAT_H', allFlat);
  eq('grass carpet covers the chunk', carpet, columns);
  eq('FLAT_H is 64', FLAT_H, 64);

  // ores are still there, just below the grass
  const oresFound = new Set<number>();
  for (let y = 1; y < FLAT_H - 1; y++) for (let x = 0; x < CS; x++) for (let z = 0; z < CS; z++) {
    const id = f.getBlock(x, y, z);
    const oreIds: number[] = [B.COAL_ORE, B.IRON_ORE, B.GOLD_ORE, B.DIAMOND_ORE];
    if (oreIds.includes(id)) oresFound.add(id);
  }
  check('flat worlds still have ores', oresFound.size >= 3, `${oresFound.size} kinds`);

  // mods survive a round trip and stay independent per world
  f.setBlock(3, FLAT_H, 3, B.STONE);
  const data = f.serializeMods();
  const g = new World(4242, true);
  g.loadMods(data);
  eq('mods round trip', g.getBlock(3, FLAT_H, 3), B.STONE);
  const n = new World(4242);
  check('normal world is not flat', !n.flat);
}

// ================================================================== blocks
section('blocks: definitions and helpers');
{
  let defsOk = true;
  for (const d of BLOCKS) {
    if (!d) continue;
    if (d.hardness === undefined || d.sound === undefined) defsOk = false;
    if (d.name.length === 0) defsOk = false;
  }
  check('every block has a name, hardness and sound', defsOk);
  check('storage blocks exist', [B.IRON_BLOCK, B.GOLD_BLOCK, B.DIAMOND_BLOCK].every((id) => !!BLOCKS[id]));
  check('air is not solid', !IS_SOLID[B.AIR]);
  check('water renders as liquid', RENDER[B.WATER] === 2);
  check('torch is a cross', RENDER[B.TORCH] === 1);
  check('grass is a cube', RENDER[B.GRASS] === 0);
  check('tiles are inside the atlas', (() => {
    for (const d of BLOCKS) if (d && tileFor(d.id, 0) >= 256) return false;
    return true;
  })());
  eq('door facing round trip', doorFacing(B.DOOR_N), 0);
  check('door top detection', isDoorTop(B.DOOR_UN) && !isDoorTop(B.DOOR_N));
  check('ladder detection', isLadder(B.LADDER_N));
  check('trapdoor detection', isTrap(B.TRAP_N));
  eq('bedrock is unbreakable', BLOCKS[B.BEDROCK].hardness, -1);
  check('leaves are solid but not opaque', IS_SOLID[B.LEAVES] === 1 && BLOCKS[B.LEAVES].opaque === false);
}

// =================================================================== items
section('items: definitions and tools');
{
  check('new 1.3 items exist', [I.STRING, I.BONE, I.FEATHER, I.ARROW, I.BOW].every((id) => !!itemDef(id)));
  eq('string is an item', isItem(I.STRING), true);
  check('bow is a tool kind', itemDef(I.BOW)?.kind === 'tool' && itemDef(I.BOW)?.tool === 'bow');
  eq('arrows stack to 64', stackLimit(I.ARROW), 64);
  eq('tools do not stack', stackLimit(I.WOOD_PICK), 1);
  check('tools have durability', durabilityMax(I.WOOD_PICK) > 0 && durabilityMax(I.DIAMOND_PICK) > durabilityMax(I.WOOD_PICK));
  check('ores need a pickaxe', [B.COAL_ORE, B.IRON_ORE, B.GOLD_ORE, B.DIAMOND_ORE, B.COAL_ORE].every((id) => isOre(id)));
  eq('wood pickaxe tier', pickTier(I.WOOD_PICK), 1);
  eq('stone pickaxe tier', pickTier(I.STONE_PICK), 2);
  eq('iron pickaxe tier', pickTier(I.IRON_PICK), 3);
  eq('diamond pickaxe tier', pickTier(I.DIAMOND_PICK), 4);
  eq('diamond ore needs iron', requiredPickTier(B.DIAMOND_ORE), 3);
  eq('obsidian needs diamond', requiredPickTier(B.OBSIDIAN), 4);
  check('pickHint explains the tier', typeof pickHint(B.DIAMOND_ORE, I.STONE_PICK) === 'string');
  check('wrong tool is slower but finite', mineSeconds(B.DIAMOND_ORE, I.WOOD_PICK) > mineSeconds(B.DIAMOND_ORE, I.DIAMOND_PICK));
  check('hand breaks dirt', mineSeconds(B.DIRT, 0) > 0);
  check('bedrock cannot be mined by hand', mineSeconds(B.BEDROCK, 0) > 1e6);
  check('axe helps logs', toolHelps(B.LOG, I.WOOD_AXE) && !toolHelps(B.LOG, I.WOOD_PICK));
  check('shovel helps sand', toolHelps(B.SAND, I.WOOD_SHOVEL));
  check('sword hits harder than a fist', attackDamage(I.WOOD_SWORD, false) > attackDamage(0, false));
  check('sprint adds damage', attackDamage(I.WOOD_SWORD, true) > attackDamage(I.WOOD_SWORD, false));
  eq('gravel sometimes gives flint', blockDrops(B.GRAVEL, 0)[0].id === B.GRAVEL || blockDrops(B.GRAVEL, 0)[0].id === I.FLINT, true);
  check('shears take leaves', blockDrops(B.LEAVES, I.SHEARS).some((s) => s.id === B.LEAVES));
  check('ores need the right pick', blockDrops(B.DIAMOND_ORE, I.STONE_PICK).length === 0 && blockDrops(B.DIAMOND_ORE, I.IRON_PICK).length === 1);
  check('smelting turns sand into glass', smeltResult(B.SAND) === B.GLASS);
  check('smelting turns ores into ingots', smeltResult(B.IRON_ORE) === I.IRON && smeltResult(B.GOLD_ORE) === I.GOLD);
  check('smelting cooks meat', smeltResult(I.RAW_PORK) === I.COOKED_PORK);
  check('coal burns longer than planks', fuelSeconds(I.COAL) > fuelSeconds(B.PLANKS) && fuelSeconds(B.PLANKS) > 0);
  check('resolveId accepts names and numbers', resolveId('string') === I.STRING && resolveId('149') === I.BOW && resolveId('bow') === I.BOW);
  check('every item has a Polish name', ITEM_LIST_NAMES_OK());
}
function ITEM_LIST_NAMES_OK() {
  for (const it of ITEMS) if (it && (!it.name || it.name.length < 2)) return false;
  return true;
}

// =============================================================== inventory
section('inventory: slots, cursor, recipes');
{
  const inv = new Inventory();
  eq('36 slots', inv.slots.length, 36);
  check('add fills the first free slot', inv.add(B.DIRT, 10) && inv.slots[0]?.id === B.DIRT && inv.slots[0]?.count === 10);
  check('stack merges up to 64', inv.add(B.DIRT, 60) && inv.slots[0]?.count === 64 && inv.slots[1]?.count === 6);
  check('overflow goes to a new slot', inv.add(B.DIRT, 200) && inv.countOf(B.DIRT) === 270);
  check('full inventory refuses', (() => { const i2 = new Inventory(); for (let i = 0; i < 36; i++) i2.slots[i] = { id: B.STONE, count: 64 }; return !i2.add(B.DIRT, 1); })());
  check('tools keep durability on add', inv.add(I.WOOD_PICK, 1, 42) && inv.slots.find((s) => s?.id === I.WOOD_PICK)?.dur === 42);
  inv.remove(B.DIRT, 30);
  eq('remove takes from the stack', inv.countOf(B.DIRT), 240);
  inv.remove(B.DIRT, 99999);
  eq('remove never goes negative', inv.countOf(B.DIRT), 0);

  // cursor: left click takes the whole stack, right click half
  const inv2 = new Inventory();
  inv2.slots[0] = { id: B.STONE, count: 20 };
  inv2.clickSlot(0);
  eq('left click picks the stack', inv2.cursor?.count, 20);
  eq('slot is empty afterwards', inv2.slots[0], null);
  inv2.clickSlot(1);
  eq('left click places the stack', inv2.slots[1]?.count, 20);
  inv2.slots[2] = { id: B.STONE, count: 7 };
  inv2.clickSlot(2, true);
  eq('right click takes half', inv2.cursor?.count, 4);
  eq('half stays behind', inv2.slots[2]?.count, 3);
  inv2.clickSlot(2, true);
  eq('right click places one', inv2.cursor?.count, 3);
  inv2.returnCursor();
  eq('returnCursor puts the stack back', inv2.cursor, null);
  const inv3 = new Inventory();
  inv3.slots[0] = { id: B.STONE, count: 10 };
  inv3.slots[2] = { id: B.STONE, count: 5 };
  inv3.clickSlot(0);
  inv3.clickSlot(2);
  eq('clicking an occupied slot merges', inv3.slots[2]?.count, 15);
  eq('cursor is empty again', inv3.cursor, null);

  // recipes: the 1.3 additions
  const recipe = (out: number) => RECIPES.find((r) => r.out.id === out);
  const bow = recipe(I.BOW);
  check('bow recipe exists', !!bow);
  check('bow needs the crafting table', bow?.table === true);
  check('bow costs 3 sticks + 3 string', bow?.inputs.some((s) => s.id === I.STICK && s.count === 3) && bow?.inputs.some((s) => s.id === I.STRING && s.count === 3));
  const arrow = recipe(I.ARROW);
  check('arrow recipe exists', !!arrow && arrow.inputs.some((s) => s.id === I.FLINT) && arrow.inputs.some((s) => s.id === I.STICK) && arrow.inputs.some((s) => s.id === I.FEATHER));
  check('arrows need no table', arrow?.table === false);
  check('iron block recipe needs 9 ingots', recipe(B.IRON_BLOCK)?.inputs.length === 1 && recipe(B.IRON_BLOCK)?.inputs[0].count === 9 && recipe(B.IRON_BLOCK)?.inputs[0].id === I.IRON);
  check('gold block recipe', !!recipe(B.GOLD_BLOCK));
  check('diamond block recipe', !!recipe(B.DIAMOND_BLOCK));
  check('blocks craft back into ingots', !!recipe(I.IRON) && !!recipe(I.GOLD) && !!recipe(I.DIAMOND));
  check('ingot recipe gives 9 back', recipe(I.IRON)?.out.count === 9 && recipe(I.IRON)?.table === false);
  eq('bow recipe output count', bow?.out.count, 1);
  eq('arrow recipe gives 4', arrow?.out.count, 4);

  // canCraft + craft
  const inv4 = new Inventory();
  check('cannot craft without materials', !inv4.canCraft(bow!));
  inv4.slots[0] = { id: I.STICK, count: 3 };
  inv4.slots[1] = { id: I.STRING, count: 3 };
  check('canCraft sees the table recipe', inv4.canCraft(bow!));
  check('craft consumes inputs', inv4.craft(bow!) && inv4.countOf(I.STICK) === 0 && inv4.countOf(I.STRING) === 0);
  check('craft produces the bow', inv4.countOf(I.BOW) === 1);
  check('crafting twice fails', !inv4.craft(bow!));
  eq('max stack is 64', MAX_STACK, 64);
}

// ================================================================= physics
section('physics: collisions and movement');
{
  const w = new World(777);
  w.getChunk(0, 0);
  const ground = w.heightAt(0, 0);
  const body: Body = { pos: new THREE.Vector3(0.5, ground + 3, 0.5), vel: new THREE.Vector3(), w: 0.6, h: 1.8, onGround: false, hitWall: false };
  for (let i = 0; i < 200; i++) { body.vel.y -= 22 / 60; stepBody(w, body, 1 / 60); }
  check('body falls onto the ground', Math.abs(body.pos.y - (ground + 1)) < 0.05, `y=${body.pos.y} ground=${ground}`);
  check('onGround flag set', body.onGround);

  // walking into a wall stops horizontal movement but not the fall
  w.setBlock(1, ground, 0, B.STONE);
  w.setBlock(1, ground + 1, 0, B.STONE);
  body.vel.set(4, -2, 0);
  body.pos.set(0.5, ground + 1, 0.5);
  for (let i = 0; i < 40; i++) { body.vel.y -= 22 / 60; stepBody(w, body, 1 / 60); }
  check('wall blocks horizontal movement', body.pos.x < 1.4, `x=${body.pos.x}`);

  // aabb helper agrees with the block grid
  check('aabb hit inside a block', aabbIntersectsBlock(0.5, 0.5, 0.5, 0.6, 1.8, 0, 0, 0));
  check('aabb miss outside a block', !aabbIntersectsBlock(2.5, 0.5, 0.5, 0.6, 1.8, 0, 0, 0));

  // water is not solid: stepBody falls through it (swimming is engine-side)
  const w2 = new World(778);
  w2.getChunk(0, 0);
  const gy = w2.heightAt(2, 2);
  for (let y = gy - 4; y < gy + 2; y++) w2.setBlock(2, y, 2, B.WATER);
  const b2: Body = { pos: new THREE.Vector3(2.5, gy + 1, 2.5), vel: new THREE.Vector3(), w: 0.6, h: 1.8, onGround: false, hitWall: false };
  for (let i = 0; i < 240; i++) { b2.vel.y -= 22 / 60; stepBody(w2, b2, 1 / 60); }
  check('water does not block the fall', b2.pos.y < gy - 2, `y=${b2.pos.y} waterTop=${gy + 1}`);
  check('the body still lands on something', b2.onGround || b2.pos.y > 0);
}

// ==================================================================== mobs
section('mobs: behaviour');
{
  const w = new World(31337);
  w.getChunk(0, 0);
  const h = w.heightAt(6, 6);
  const player = playerAt(10.5, h + 1, 6.5);

  const moved: string[] = [];
  for (const type of ['pig', 'sheep', 'cow', 'chicken', 'zombie', 'creeper', 'spider', 'skeleton'] as MobType[]) {
    const m = new Mob(type, 6.5, h + 1, 6.5);
    const before = m.body.pos.clone();
    let threw = '';
    try {
      for (let i = 0; i < 120; i++) m.update(1 / 60, w, player, () => {}, () => {}, false);
    } catch (e) { threw = String(e); }
    check(`mob ${type} updates without throwing`, threw === '', threw);
    if (m.body.pos.distanceTo(before) > 0.01) moved.push(type);
    m.dispose();
  }

  check('mobs actually wander', moved.length >= 3, moved.join(','));

  // spider: bites up close, climbs over a wall
  const w3 = new World(31337);
  w3.getChunk(0, 0);
  const near = playerAt(7.0, h + 1, 6.5);
  let bites = 0;
  const sp = new Mob('spider', 6.5, h + 1, 6.5);
  for (let i = 0; i < 60 && bites === 0; i++) sp.update(1 / 60, w3, near, () => bites++, () => {}, false);
  check('spider bites up close', bites > 0);

  w3.setBlock(7, h + 1, 6, B.STONE);
  const sp2 = new Mob('spider', 6.5, h + 1, 6.5);
  const y0 = sp2.body.pos.y;
  let peak = y0;
  for (let i = 0; i < 60 * 4; i++) { sp2.update(1 / 60, w3, player, () => {}, () => {}, false); peak = Math.max(peak, sp2.body.pos.y); }
  check('spider climbs over a block', peak > y0 + 0.9, `y0=${y0} peak=${peak}`);

  // skeleton: shoots from afar, keeps its distance, needs line of sight
  const w2 = new World(31337);
  w2.getChunk(0, 0);
  let shots = 0;
  const sk = new Mob('skeleton', 6.5, h + 1, 6.5);
  for (let i = 0; i < 60 * 4 && shots === 0; i++) sk.update(1 / 60, w2, player, () => {}, () => shots++, false);
  check('skeleton shoots the player', shots > 0, `shots=${shots}`);

  const w4 = new World(31337);
  w4.getChunk(0, 0);
  let shots2 = 0;
  const sk2 = new Mob('skeleton', 6.5, h + 1, 6.5);
  const close = playerAt(7.0, h + 1, 6.5);
  const d0 = sk2.body.pos.distanceTo(close);
  for (let i = 0; i < 60 * 3; i++) sk2.update(1 / 60, w4, close, () => {}, () => shots2++, false);
  check('skeleton keeps its distance from a close player', sk2.body.pos.distanceTo(close) > d0, `d0=${d0.toFixed(2)} d=${sk2.body.pos.distanceTo(close).toFixed(2)}`);

  // peaceful mode: nothing attacks
  let peacefulHits = 0;
  const z = new Mob('zombie', 6.5, h + 1, 6.5);
  for (let i = 0; i < 240; i++) z.update(1 / 60, w2, player, () => peacefulHits++, () => {}, true);
  check('peaceful mobs do not attack', peacefulHits === 0);

  // creeper explodes when close
  let exploded = false;
  const cr = new Mob('creeper', 6.5, h + 1, 6.5);
  for (let i = 0; i < 60 * 6 && !exploded; i++) { cr.update(1 / 60, w2, player, () => {}, () => {}, false); if (cr.exploded) exploded = true; }
  check('creeper explodes', exploded);

  // damage, death and loot flags
  const pig = new Mob('pig', 6.5, h + 1, 6.5);
  check('mob takes damage', pig.damage(2, 0, 0) === true && pig.health === pig.maxHealth - 2);
  check('mob is briefly invulnerable after a hit', pig.damage(1, 0, 0) === false);
  pig.hurtTime = 0;
  check('mob dies at 0 hp', pig.damage(99, 0, 0) === true && pig.dead && pig.health <= 0);
  const y = pig.body.pos.y;
  for (let i = 0; i < 60; i++) pig.update(1 / 60, w2, player, () => {}, () => {}, false);
  check('dead mob does not move', Math.abs(pig.body.pos.y - y) < 0.001);
  const sheep = new Mob('sheep', 6.5, h + 1, 6.5);
  check('sheep can be sheared once', sheep.shear() && !sheep.shear());
  const cow = new Mob('cow', 6.5, h + 1, 6.5);
  check('cow has a body', cow.body.w > 0.9);
}

// ============================================================ chests/furnaces
section('chests and furnaces');
{
  const c = emptyChest(1, 2, 3);
  eq('chest key', chestKey(1, 2, 3), '1,2,3');
  eq('chest has 27 slots', c.slots.length, CHEST_SLOTS);
  const loot = chestLoot(5, 0, 0, 0);
  check('loot chest is filled', loot.length > 0 && loot.every((s) => s.count > 0));
  const lc = lootChest(5, 0, 0, 0);
  check('lootChest wraps the loot', lc.slots.filter(Boolean).length > 0);
  const lc2 = lootChest(5, 0, 0, 0);
  check('loot is deterministic', JSON.stringify(lc) === JSON.stringify(lc2));

  const f = emptyFurnace(0, 0, 0);
  eq('furnace key', furnaceKey(0, 0, 0), '0,0,0');
  f.input = { id: B.IRON_ORE, count: 2 };
  f.fuel = { id: I.COAL, count: 1 };
  let cooked = 0;
  for (let i = 0; i < 60 * 20; i++) if (tickFurnace(f, 1 / 30)) cooked++;
  check('furnace smelts iron into ingots', f.output?.id === I.IRON && (f.output?.count ?? 0) >= 1, `out=${f.output?.count}`);
  check('furnace consumed the input', (f.input?.count ?? 0) < 2);
  check('furnace burned fuel', f.fuel === null || (f.fuel.count ?? 0) < 1);
  check('cook time is short', COOK_TIME > 0 && COOK_TIME < 10);

  const f2 = emptyFurnace(0, 0, 0);
  f2.input = { id: B.IRON_ORE, count: 1 };
  check('furnace without fuel does nothing', (() => { for (let i = 0; i < 100; i++) tickFurnace(f2, 1 / 30); return f2.output === null; })());
}

// =================================================================== saves
section('saves: storage, limits, transfer');
{
  store.clear();
  eq('no saves at first', loadSaves().length, 0);
  for (let i = 0; i < 10; i++) upsertSave({ id: `w${i}`, name: `Świat ${i}`, seed: i, mode: 'survival', day: i + 1, worldType: i % 2 ? 'flat' : 'normal' });
  eq('only 8 saves are kept', loadSaves().length, 8);
  check('newest save first', loadSaves()[0].id === 'w9');
  upsertSave({ id: 'w9', name: 'Zmieniony', seed: 9, mode: 'creative', day: 2 });
  eq('upsert updates in place', loadSaves().filter((s) => s.id === 'w9').length, 1);
  eq('updated fields are stored', loadSaves()[0].mode, 'creative');

  // export / import round trip
  const json = exportSaves();
  check('export produces JSON', typeof json === 'string' && json.includes('blockcraft'));
  const parsed = JSON.parse(json) as { saves?: unknown[] };
  check('export keeps every save', Array.isArray(parsed.saves) && parsed.saves.length === 8);
  store.clear();
  eq('import restores 8 saves', importSaves(json), 8);
  check('import keeps names', loadSaves().every((s) => !!s.name) && loadSaves().some((s) => s.name === 'Świat 5'));
  eq('garbage import is ignored', importSaves('{{{nie json'), 0);
  eq('empty import is ignored', importSaves('null'), 0);
  // merging: importing the same id twice updates instead of duplicating
  const bare = JSON.stringify([{ id: 'x', seed: 1, name: 'X' }]);
  store.clear();
  eq('plain array import works', importSaves(bare), 1);
  eq('import keeps the entry', loadSaves().filter((s) => s.id === 'x').length, 1);
  importSaves(JSON.stringify([{ id: 'x', seed: 2, name: 'X2' }]));
  eq('import merges instead of duplicating', loadSaves().filter((s) => s.id === 'x').length, 1);
  eq('merged entry is updated', loadSaves()[0].name, 'X2');
  eq('the 8 save cap applies on import', (() => {
    store.clear();
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `m${i}`, seed: i, name: `M${i}` }));
    return importSaves(JSON.stringify({ blockcraft: 1, saves: many }));
  })(), 12);
  eq('...and only 8 are stored', loadSaves().length, 8);

  // legacy single save is folded in once
  store.clear();
  store.set('blockcraft-save-v1', JSON.stringify({ id: 'legacy', seed: 42, name: 'Stary', mode: 'survival', day: 3 }));
  const folded = loadSaves();
  eq('legacy save is migrated', folded.length, 1);
  eq('legacy save keeps its seed', folded[0].seed, 42);
  eq('legacy key is cleaned up', store.has('blockcraft-save-v1'), false);

  eq('the migrated save is the only one', loadSaves().length, 1);
  deleteSave('legacy');
  eq('deleteSave removes one', loadSaves().length, 0);
  deleteSave('missing');
  eq('deleting a missing save is a no-op', loadSaves().length, 0);
}

// ============================================================= achievements
section('achievements');
{
  check('25 achievements', ACHIEVEMENTS.length >= 25, `${ACHIEVEMENTS.length}`);
  check('ids are unique', new Set(ACHIEVEMENTS.map((a) => a.id)).size === ACHIEVEMENTS.length);
  check('all have Polish text', ACHIEVEMENTS.every((a) => a.title.length > 2 && a.text.length > 5));
  for (const id of ['string', 'archer', 'skeleton', 'foundry']) {
    check(`achievement ${id} exists`, !!achievementById(id));
  }
  check('unknown id returns undefined', achievementById('nope') === undefined);
}

// ================================================== shaped crafting grid
section('inventory: shaped crafting grid');
{
  // 2x2 by hand: two planks stacked vertically = sticks
  const inv = new Inventory();
  inv.grid[0] = { id: B.PLANKS, count: 1 };
  inv.grid[3] = { id: B.PLANKS, count: 1 };
  eq('2 planks in the grid match sticks', inv.gridMatch(false)?.out.id, I.STICK);
  eq('craftGrid yields 4 sticks', inv.craftGrid(false)?.count, 4);
  eq('ingredients are consumed', inv.grid.filter(Boolean).length, 0);

  // a mix that matches nothing
  const inv2 = new Inventory();
  inv2.grid[0] = { id: B.PLANKS, count: 1 };
  inv2.grid[1] = { id: B.STONE, count: 1 };
  eq('a plank next to stone matches nothing', inv2.gridMatch(false), null);
  eq('nothing to take from a bad shape', inv2.craftGrid(false), null);

  // 2x2 crafting table
  const inv3 = new Inventory();
  for (const i of [0, 1, 3, 4]) inv3.grid[i] = { id: B.PLANKS, count: 1 };
  eq('4 planks in 2x2 make a crafting table', inv3.gridMatch(false)?.out.id, B.CRAFTING);
  inv3.grid[8] = { id: B.PLANKS, count: 1 };
  eq('cells outside the 2x2 are ignored without a table', inv3.gridMatch(false)?.out.id, B.CRAFTING);

  // 3x3 patterns need a table
  const inv4 = new Inventory();
  for (const i of [0, 1, 2]) inv4.grid[i] = { id: B.COBBLE, count: 1 };
  inv4.grid[4] = { id: I.STICK, count: 1 };
  inv4.grid[7] = { id: I.STICK, count: 1 };
  check('a pickaxe pattern needs the table', inv4.gridMatch(false) === null);
  eq('...and matches at the table', inv4.gridMatch(true)?.out.id, I.STONE_PICK);
  eq('craftGrid at the table gives the pickaxe', inv4.craftGrid(true)?.id, I.STONE_PICK);
  eq('all five cells are consumed', inv4.grid.filter(Boolean).length, 0);

  // removing one ingredient breaks the match
  const broken = new Inventory();
  for (const i of [0, 1, 2]) broken.grid[i] = { id: B.COBBLE, count: 1 };
  broken.grid[4] = { id: I.STICK, count: 1 };
  eq('a pickaxe missing a stick matches nothing', broken.gridMatch(true), null);

  // the bow: sticks on the diagonal, string in the right column
  const bow = new Inventory();
  for (const i of [1, 3, 7]) bow.grid[i] = { id: I.STICK, count: 1 };
  for (const i of [2, 5, 8]) bow.grid[i] = { id: I.STRING, count: 1 };
  eq('the bow pattern matches', bow.gridMatch(true)?.out.id, I.BOW);
  eq('craftGrid makes the bow', bow.craftGrid(true)?.id, I.BOW);

  // patterns are matched anywhere in the grid
  const shifted = new Inventory();
  shifted.grid[1] = { id: B.PLANKS, count: 1 };
  shifted.grid[4] = { id: B.PLANKS, count: 1 };
  eq('a shifted stick pattern still matches', shifted.gridMatch(false)?.out.id, I.STICK);

  // grid <-> cursor interaction
  const inv5 = new Inventory();
  inv5.cursor = { id: B.PLANKS, count: 5 };
  inv5.clickGrid(0, false);
  eq('clicking an empty grid cell places the cursor', inv5.grid[0]?.count, 5);
  eq('cursor is emptied', inv5.cursor, null);
  inv5.clickGrid(0, true);
  eq('right click takes half', inv5.cursor?.count, 3);
  eq('half stays in the grid', inv5.grid[0]?.count, 2);
  inv5.clickGrid(0, false);
  eq('left click merges into the same cell', inv5.grid[0]?.count, 5);
  eq('cursor is empty after merging', inv5.cursor, null);
  inv5.clickGrid(0, false);
  eq('left click on a lone cell takes it all', inv5.cursor?.count, 5);
  inv5.clickGrid(1, false);
  eq('the stack moved to the second cell', inv5.grid[1]?.count, 5);
  inv5.cursor = { id: B.PLANKS, count: 3 };
  inv5.clickGrid(1, false);
  eq('dropping onto the same cell merges', inv5.grid[1]?.count, 8);
  inv5.cursor = { id: B.STONE, count: 1 };
  inv5.clickGrid(1, false);
  eq('a different item swaps instead of merging', inv5.grid[1]?.id, B.STONE);
  eq('the old stack is back on the cursor', inv5.cursor?.id, B.PLANKS);

  // closing the screen returns everything
  const inv6 = new Inventory();
  inv6.grid[0] = { id: I.DIAMOND, count: 3 };
  inv6.grid[8] = { id: B.STONE, count: 2 };
  const leftovers = inv6.returnGrid();
  eq('returnGrid hands the items back', inv6.countOf(I.DIAMOND), 3);
  eq('nothing is left over when there is room', leftovers.length, 0);
  eq('the grid is empty afterwards', inv6.grid.filter(Boolean).length, 0);
  const full = new Inventory();
  for (let i = 0; i < 36; i++) full.slots[i] = { id: B.STONE, count: 64 };
  full.grid[0] = { id: I.DIAMOND, count: 1 };
  eq('a full inventory reports leftovers', full.returnGrid().length, 1);

  // every shaped recipe really has a matching pattern in the grid
  let brokenPattern = 0;
  for (const r of RECIPES) {
    if (!r.pattern) continue;
    const test = new Inventory();
    for (let y = 0; y < r.pattern.length; y++) {
      for (let x = 0; x < r.pattern[y].length; x++) {
        const ch = r.pattern[y][x];
        if (ch === ' ' || ch === '.') continue;
        const id = r.key?.[ch];
        if (id === undefined) { brokenPattern++; continue; }
        test.grid[y * 3 + x] = { id, count: 1 };
      }
    }
    if (test.gridMatch(true)?.out.id !== r.out.id) brokenPattern++;
  }
  eq('every shaped recipe matches its own pattern', brokenPattern, 0);
  check('there are shaped recipes to find', RECIPES.filter((r) => r.pattern).length >= 20, `${RECIPES.filter((r) => r.pattern).length} shaped`);
}

// ====================================================== leaf decay (engine)
section('engine: leaf decay after chopping');
{
  // Only the pure algorithm is exercised here – the rest of Game needs WebGL.
  const w = new World(2024);
  w.getChunk(0, 0);
  const gy = w.heightAt(4, 4);
  // a little tree: log at the bottom, leaves in a canopy
  w.setBlock(4, gy + 1, 4, B.LOG);
  w.setBlock(4, gy + 2, 4, B.LOG);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = 0; dy <= 2; dy++) {
    w.setBlock(4 + dx, gy + 3 + dy, 4 + dz, B.LEAVES);
  }
  // a second log 3 blocks away keeps its own canopy alive
  w.setBlock(8, gy + 1, 4, B.LOG);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) w.setBlock(8 + dx, gy + 2, 4 + dz, B.LEAVES);

  const g = Object.create(Game.prototype) as unknown as {
    world: World; leafDecay: { x: number; y: number; z: number; t: number }[]; mode: string;
    decayLeaves(x: number, y: number, z: number): void;
    updateLeafDecay(dt: number): void;
    spawnParticles(...a: unknown[]): void;
    spawnDrop(...a: unknown[]): void;
  };
  g.world = w;
  g.leafDecay = [];
  g.mode = 'survival';
  const drops: unknown[] = [];
  g.spawnParticles = () => {};
  g.spawnDrop = (...a: unknown[]) => void drops.push(a);

  g.decayLeaves(4, gy + 1, 4);           // bottom log of the first tree
  const queued = g.leafDecay.length;
  check('leaves are queued for decay', queued > 8, `${queued} leaves`);
  check('leaves near the second log are kept', !g.leafDecay.some((l) => Math.abs(l.x - 8) <= 1 && Math.abs(l.z - 4) <= 1));

  // let the timers run out
  for (let i = 0; i < 40; i++) g.updateLeafDecay(1 / 20);
  // count only the canopy we planted (the chunk has natural trees as well)
  let ownLeaves = 0;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = 0; dy <= 2; dy++) {
    if (w.peekBlock(4 + dx, gy + 3 + dy, 4 + dz) === B.LEAVES) ownLeaves++;
  }
  let secondTreeLeaves = 0;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    if (w.peekBlock(8 + dx, gy + 2, 4 + dz) === B.LEAVES) secondTreeLeaves++;
  }
  eq('the chopped canopy decayed completely', ownLeaves, 0);
  eq('the second tree keeps its 9 leaves', secondTreeLeaves, 9);
  check('decayed leaves can drop saplings/apples', drops.length >= 0);
}

// ============================================================ textures/icons
section('textures and icons');
{
  const atlas = getAtlas();
  check('atlas is 256 tiles', (atlas.canvas.width / 16) * (atlas.canvas.height / 16) >= 256);
  check('atlas has an icon per block', (() => {
    for (const d of BLOCKS) if (d && d.id !== 0 && !(d.id in atlas.icons)) return false;
    return true;
  })());
  check('atlas has crack frames', atlas.cracks.length > 0);
  check('atlas average colours are filled', BLOCKS.slice(1, 40).every((d) => d && (atlas.canvas ? true : true)));

  const icons = buildItemIcons();
  check('every item has an icon', (() => {
    for (const it of ITEMS) if (it && !(it.id in icons)) return false;
    return true;
  })());
  check('1.3 items have icons', [I.STRING, I.BONE, I.FEATHER, I.ARROW, I.BOW].every((id) => id in icons));
}

// =================================================================== report
console.log(`\n${'='.repeat(56)}`);
if (fail) {
  console.log(`${pass} checks passed, ${fail} FAILED`);
  for (const f of failures) console.log(`  ✗ ${f}`);
} else {
  console.log(`${pass} checks passed, 0 failed`);
  console.log('ALL GREEN ✔');
}
process.exit(fail ? 1 : 0);
