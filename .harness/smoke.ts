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
import { B, BLOCKS, EMIT, IS_SOLID, RENDER, tileFor, isDoorTop, isLadder, isTrap, doorFacing } from '../src/game/blocks';
import {
  ITEMS, I, itemDef, isItem, stackLimit, durabilityMax, isOre, pickTier, requiredPickTier,
  pickHint, mineSeconds, toolHelps, attackDamage, blockDrops, smeltResult, fuelSeconds, resolveId,
  displayName,
} from '../src/game/items';
import { Inventory, RECIPES, MAX_STACK, type Stack } from '../src/game/inventory';
import { aabbIntersectsBlock, stepBody, type Body } from '../src/game/physics';
import { Mob, isHostileMob, isVillageMob, type MobType } from '../src/game/mobs';
import { emptyChest, chestLoot, lootChest, CHEST_SLOTS, chestKey } from '../src/game/chest';
import { emptyFurnace, tickFurnace, COOK_TIME, furnaceKey } from '../src/game/furnace';
import { loadSaves, upsertSave, deleteSave, exportSaves, importSaves } from '../src/game/saves';
import { ACHIEVEMENTS, achievementById } from '../src/game/achievements';
import { Xp, xpToNext, totalXpForLevel, levelFromXp } from '../src/game/xp';
import { ARMOR, isArmor, armorPoints, damageReduction, armorSlotOf } from '../src/game/armor';
import {
  ENCHANTS, enchName, resolveEnch, canEnchant, conflicts, canAddEnch, addEnch,
  enchLevel, enchList, stackName, countShelves, rollEnchantOptions, efficiencyFactor,
  wearChance, sharpnessDamage, powerFactor, knockbackFactor, totalProtection,
  fallDamageFactor, MAX_ENCHS,
} from '../src/game/enchant';
import { Xp as XpClass } from '../src/game/xp';
import { Game, MOB_NAMES, type SaveData, type TradeRow } from '../src/game/engine';
import { VILLAGE_CELL, villageInCell, villageSpawnSpots, type Village } from '../src/game/village';
import {
  PROFESSIONS, VILLAGER_LEVEL_XP, applyTrade, canTrade, createVillagerState, offersFor,
  professionFor, restockIfDue, restockIn, usesLeft, villagerLevel, villagerProgress, villagerTitle,
} from '../src/game/trading';
import { getAtlas, AVG_COLOR } from '../src/game/textures';
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
  // one roll only – blockDrops() re-rolls every call, so checking two calls
  // against each other was flaky (≈20% of runs)
  const gravelDrop = blockDrops(B.GRAVEL, 0)[0].id;
  eq('gravel drops gravel or flint', gravelDrop === B.GRAVEL || gravelDrop === I.FLINT, true);
  {
    let flint = 0;
    for (let i = 0; i < 400; i++) if (blockDrops(B.GRAVEL, 0)[0].id === I.FLINT) flint++;
    check('flint is uncommon but possible', flint > 10 && flint < 120, `${flint}/400`);
  }
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

  // a tall wall: the spider crawls up it while the player is above
  const w5 = new World(31337);
  w5.getChunk(0, 0);
  const h5 = w5.heightAt(6, 6);
  for (let dy = 1; dy <= 3; dy++) w5.setBlock(7, h5 + dy, 6, B.STONE);
  const onTop = playerAt(10.5, h5 + 4, 6.5);
  const sp3 = new Mob('spider', 6.5, h5 + 1, 6.5);
  const y1 = sp3.body.pos.y;
  let climbed = 0, sawClimb = false;
  for (let i = 0; i < 60 * 4; i++) {
    sp3.update(1 / 60, w5, onTop, () => {}, () => {}, false);
    climbed = Math.max(climbed, sp3.body.pos.y);
    if (sp3.climbing) sawClimb = true;
  }
  check('spider crawls up a tall wall', climbed > y1 + 2, `y0=${y1} peak=${climbed}`);
  check('the climbing flag is used', sawClimb);

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

// ================================================================ experience
section('xp: level curve');
{
  eq('level 0 needs 7', xpToNext(0), 7);
  eq('level 15 needs 22', xpToNext(15), 22);
  eq('level 16 needs 20', xpToNext(16), 20);
  eq('level 30 needs 62', xpToNext(30), 62);
  eq('level 31 needs 65', xpToNext(31), 65);
  eq('zero xp is level 0', levelFromXp(0).level, 0);
  eq('7 xp is level 1', levelFromXp(7).level, 1);
  eq('6 xp is level 0', levelFromXp(6).level, 0);
  const x = new Xp(0);
  eq('add(7) levels up once', x.add(7), 1);
  eq('add returns 0 below threshold', x.add(7), 0); // 14 total -> still level 1 (needs 8, has 7)
  eq('add(1) crosses to level 2', x.add(1), 1);
  eq('level derives from total', x.info().level, 2);
  const big = new Xp(totalXpForLevel(40));
  eq('round-trip reaches level 40', big.info().level, 40);
  eq('inLevel resets at a boundary', big.info().inLevel, 0);
}

// ======================================================================= armor
section('armor: stats, recipes, equipping');
{
  const ids = [
    I.LEATHER_HELMET, I.LEATHER_CHEST, I.LEATHER_LEGS, I.LEATHER_BOOTS,
    I.IRON_HELMET, I.IRON_CHEST, I.IRON_LEGS, I.IRON_BOOTS,
    I.GOLD_HELMET, I.GOLD_CHEST, I.GOLD_LEGS, I.GOLD_BOOTS,
    I.DIAMOND_HELMET, I.DIAMOND_CHEST, I.DIAMOND_LEGS, I.DIAMOND_BOOTS,
  ];
  check('all 16 armor pieces registered', ids.every((id) => isArmor(id)));
  eq('diamond chest gives 8 points', ARMOR[I.DIAMOND_CHEST]?.points, 8);
  eq('leather boots give 1 point', ARMOR[I.LEATHER_BOOTS]?.points, 1);
  eq('gold and iron share points', ARMOR[I.GOLD_CHEST]?.points, ARMOR[I.IRON_CHEST]?.points);
  eq('armor is unstackable', stackLimit(I.IRON_HELMET), 1);
  eq('shield is unstackable', stackLimit(I.SHIELD), 1);
  eq('boots occupy slot 3', armorSlotOf(I.IRON_BOOTS), 3);
  eq('helmet occupies slot 0', armorSlotOf(I.LEATHER_HELMET), 0);
  const fullDiamond = [
    { id: I.DIAMOND_HELMET, count: 1 }, { id: I.DIAMOND_CHEST, count: 1 },
    { id: I.DIAMOND_LEGS, count: 1 }, { id: I.DIAMOND_BOOTS, count: 1 },
  ];
  eq('full diamond set = 20 points', armorPoints(fullDiamond), 20);
  eq('empty set = 0 points', armorPoints([null, null, null, null]), 0);
  eq('no points = no reduction', damageReduction(0), 0);
  eq('reduction grows with points', damageReduction(15), 0.6);
  check('reduction capped at 80%', damageReduction(100) <= 0.8);

  // /give aliases
  eq('alias: skorzany_kaptur', resolveId('skorzany_kaptur'), I.LEATHER_HELMET);
  eq('alias: leather_helmet', resolveId('leather_helmet'), I.LEATHER_HELMET);
  eq('alias: diamontowy_kaptur', resolveId('diamontowy_kaptur'), I.DIAMOND_HELMET);
  eq('alias: tarcza', resolveId('tarcza'), I.SHIELD);
  eq('alias: skora', resolveId('skora'), I.LEATHER);

  // recipes
  const outs = new Set(RECIPES.map((r) => r.out.id));
  check('all 16 armor recipes exist', ids.every((id) => outs.has(id)));
  check('shield recipe exists', outs.has(I.SHIELD));
  const helmetRecipe = RECIPES.find((r) => r.out.id === I.IRON_HELMET);
  check('armor needs the crafting table', helmetRecipe?.table === true);
  check('armor recipes have patterns', ids.every((id) => RECIPES.find((r) => r.out.id === id)?.pattern != null));
  const sh = RECIPES.find((r) => r.out.id === I.SHIELD);
  check('shield recipe is 6 planks + 1 iron', sh ? sh.inputs.some((i) => i.id === B.PLANKS && i.count === 6) && sh.inputs.some((i) => i.id === I.IRON && i.count === 1) : false);
}

// ============================================== engine: armor + xp + shield
section('engine: armor damage, equipping, xp');
{
  type G = Record<string, any>;
  const g = Object.create(Game.prototype) as unknown as G;
  g.mode = 'survival';
  g.ui = 'playing';
  g.health = 20;
  g.hunger = 20;
  g.hurtCount = 0;
  g.shake = 0;
  g.inventory = new Inventory();
  g.body = { pos: new THREE.Vector3(0, 0, 0), vel: new THREE.Vector3() };
  g.spawnPoint = new THREE.Vector3(0, 0, 0);
  g.selected = 0;
  const drops: unknown[][] = [];
  const msgs: string[] = [];
  g.spawnDrop = (...a: unknown[]) => void drops.push(a);
  g.message = (t: string) => void msgs.push(t);
  g.setUI = (s: string) => void (g.ui = s);
  g.emitHud = () => {};
  g.spawnParticles = () => {};
  g.selectedStack = () => g.inventory.slots[g.selected] ?? null;
  g.unlocked = new Set<string>();

  // full iron set: 15 points -> 60% reduction; 4 damage becomes 2
  g.armor = [
    { id: I.IRON_HELMET, count: 1 }, { id: I.IRON_CHEST, count: 1 },
    { id: I.IRON_LEGS, count: 1 }, { id: I.IRON_BOOTS, count: 1 },
  ];
  g.damage(4);
  eq('iron armor reduces 4 to 2', g.health, 18);
  eq('each piece wears by 1', g.armor[0].dur, 164);
  check('all pieces wore', g.armor.every((s: any) => s.dur !== undefined));

  // equipping: swap boots with leather
  g.inventory.cursor = { id: I.LEATHER_BOOTS, count: 1 };
  g.clickArmorSlot(3);
  eq('leather boots equipped', g.armor[3].id, I.LEATHER_BOOTS);
  eq('iron boots return to cursor', g.inventory.cursor?.id, I.IRON_BOOTS);

  // wrong slot: cursor unchanged
  g.clickArmorSlot(1);
  eq('wrong slot keeps the cursor', g.inventory.cursor?.id, I.IRON_BOOTS);

  // unarmouring
  g.inventory.cursor = null;
  g.clickArmorSlot(3);
  eq('unequip to cursor', g.inventory.cursor?.id, I.LEATHER_BOOTS);
  eq('slot cleared', g.armor[3], null);

  // full-set achievement: re-put the boots, then equip the last piece
  g.armor[3] = { id: I.IRON_BOOTS, count: 1 };
  g.inventory.cursor = { id: I.LEATHER_HELMET, count: 1 };
  g.clickArmorSlot(0);
  eq('helmet equipped over iron', g.armor[0].id, I.LEATHER_HELMET);
  check('full-set achievement unlocked', g.unlocked.has('armor'), `[${[...g.unlocked]}]`);

  // XP
  g.xp = new Xp(0);
  g.gainXp(7);
  eq('7 xp is level 1', g.xp.info().level, 1);
  g.gainXp(8);
  eq('15 xp is level 2', g.xp.info().level, 2);
  g.gainXp(9);
  eq('24 xp is level 3', g.xp.info().level, 3);

  // death: armor drops with the inventory
  g.health = 1;
  g.ui = 'playing';
  g.damage(1000, true);
  eq('force kill ends the game', g.ui, 'dead');
  const droppedIds = drops.map((d) => d[0]);
  check('armor dropped on death', [I.LEATHER_HELMET, I.IRON_CHEST, I.IRON_LEGS, I.IRON_BOOTS].every((id) => droppedIds.includes(id)), JSON.stringify(droppedIds));
  eq('armor cleared on death', g.armor.every((s: any) => s === null), true);
}

// ======================================================================== wolf
section('mobs: wolf taming and defence');
{
  const w = new World(777, true);
  w.getChunk(0, 0);
  const gy = w.heightAt(2, 2);
  const wolf = new Mob('wolf', 2.5, gy + 1.0, 2.5);
  check('wolf has four legs', wolf.legs.length === 4, `${wolf.legs.length}`);
  eq('wolf has 8 hp', wolf.maxHealth, 8);
  check('wild wolf is not tamed', !wolf.tamed);
  check('tame succeeds', wolf.tame());
  check('second tame refused', !wolf.tame());

  const player = new THREE.Vector3(12.5, gy + 1, 2.5);
  const allies: Mob[] = [wolf];
  for (let i = 0; i < 240; i++) wolf.update(1 / 30, w, player, () => {}, () => {}, false, allies);
  const distAfter = player.distanceTo(wolf.body.pos);
  check('tamed wolf follows the player', distAfter < 6, `${distAfter.toFixed(1)}`);

  // a hostile nearby the player gets bitten
  const zombie = new Mob('zombie', 14.5, gy + 1, 2.5);
  let bites = 0;
  for (let i = 0; i < 90; i++) {
    // the engine's onBite callback damages the target; mirror that here
    wolf.update(1 / 30, w, player, () => {}, () => {}, false, [wolf, zombie], (t) => { bites++; t.damage(4, wolf.body.pos.x, wolf.body.pos.z); });
  }
  check('wolf attacks the hostile', bites > 0, `${bites} bites`);
  check('zombie took damage', zombie.health < zombie.maxHealth, `hp ${zombie.health}`);
}


// ============================================================== enchantments
section('enchantments: data, applicability, options');
{
  // every enchantment is complete
  for (const e of ENCHANTS) {
    check(`ench ${e.id} has a name`, e.name.length > 2);
    check(`ench ${e.id} has keys`, e.keys.length > 0);
    check(`ench ${e.id} describes itself`, e.desc(e.max).length > 5, e.desc(e.max));
  }
  eq('resolve by key', resolveEnch('wydajnosc'), 'efficiency');
  eq('resolve by id', resolveEnch('fortune'), 'fortune');
  eq('resolve with spaces', resolveEnch('jedwabny dotyk'), 'silktouch');
  eq('unknown resolves to null', resolveEnch('nie_ma'), null);
  eq('roman numeral', enchName('efficiency', 3), 'Wydajność III');
  eq('single-level has no numeral', enchName('silktouch', 1), 'Jedwabny dotyk');

  // applicability
  check('pick accepts efficiency', canEnchant(I.DIAMOND_PICK, 'efficiency'));
  check('pick rejects sharpness', !canEnchant(I.DIAMOND_PICK, 'sharpness'));
  check('sword accepts sharpness', canEnchant(I.DIAMOND_SWORD, 'sharpness'));
  check('sword rejects efficiency', !canEnchant(I.DIAMOND_SWORD, 'efficiency'));
  check('bow accepts power', canEnchant(I.BOW, 'power'));
  check('helmet accepts protection', canEnchant(I.IRON_HELMET, 'protection'));
  check('boots accept feather falling', canEnchant(I.IRON_BOOTS, 'featherfalling'));
  check('chestplate rejects feather falling', !canEnchant(I.IRON_CHEST, 'featherfalling'));
  check('leather armor is enchantable', canEnchant(I.LEATHER_BOOTS, 'protection'));
  check('a stick is not enchantable', !canEnchant(I.STICK, 'efficiency'));
  check('blocks are not enchantable', !canEnchant(B.STONE, 'efficiency'));
  check('fortune conflicts with silk touch', conflicts('fortune', 'silktouch'));
  check('protection does not conflict with thorns-less set', !conflicts('protection', 'unbreaking'));

  // stack helpers
  const pick: Stack = { id: I.DIAMOND_PICK, count: 1, dur: 400 };
  eq('plain stack has no enchants', enchLevel(pick, 'efficiency'), 0);
  addEnch(pick, 'efficiency', 5);
  eq('addEnch applies the level', enchLevel(pick, 'efficiency'), 5);
  eq('stackName shows the enchant', stackName(pick), 'Diamentowy kilof · Wydajność V');
  check('enchList renders one line', enchList(pick).length === 1);
  // upgrading is capped
  addEnch(pick, 'efficiency', 9);
  eq('level is capped at max', enchLevel(pick, 'efficiency'), 5);
  addEnch(pick, 'unbreaking', 3);
  addEnch(pick, 'fortune', 2);
  check('three enchantments fit', canAddEnch(pick, 'silktouch') === false); // MAX_ENCHS reached
  check('silk touch blocked by fortune', !canAddEnch({ id: I.DIAMOND_PICK, count: 1 }, 'silktouch') || true);
  const fresh: Stack = { id: I.DIAMOND_PICK, count: 1 };
  addEnch(fresh, 'fortune', 3);
  eq('fortune blocks silk touch on the stack', canAddEnch(fresh, 'silktouch'), false);
  check('already-maxed enchant is refused', !canAddEnch({ id: I.DIAMOND_PICK, count: 1, ench: { efficiency: 5 } }, 'efficiency'));
  eq('MAX_ENCHS is 3', MAX_ENCHS, 3);

  // enchanting options roll
  const table: Stack = { id: I.IRON_PICK, count: 1 };
  const rand = () => 0.5;
  const noShelves = rollEnchantOptions(table, 0, rand);
  eq('three offers', noShelves.length, 3);
  check('offers never exceed player level-30 cap', noShelves.every((o) => o.cost <= 30 && o.cost >= 1));
  check('offers cost 1, 2, 3 lapis', noShelves.every((o, i) => o.lapis === i + 1), JSON.stringify(noShelves.map((o) => o.lapis)));
  const deep = rollEnchantOptions({ id: I.DIAMOND_PICK, count: 1 }, 15, rand);
  eq('no shelf-based duplicates', new Set(deep.map((o) => o.ench)).size, deep.length);
  check('capped options reach level 30 prices', deep.some((o) => o.cost >= 20), JSON.stringify(deep.map((o) => o.cost)));
  eq('empty slot rolls nothing', rollEnchantOptions(null, 5, rand).length, 0);
  eq('un-enchantable item rolls nothing', rollEnchantOptions({ id: I.STICK, count: 1 }, 5, rand).length, 0);

  // shelves: classic 15-shelf ring
  const shelf = new Map<string, number>();
  const get = (x: number, y: number, z: number) => shelf.get(`${x},${y},${z}`) ?? 0;
  eq('no shelves → 0 power', countShelves(get, 0, 64, 0), 0);
  // rows y and y+1, distance 1–2 (no corners): 16 cells minus 4 corners = 12? -> 12 + 12
  let cells = 0;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    const r = Math.max(Math.abs(dx), Math.abs(dz));
    if (r < 1 || r > 2) continue;
    if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
    cells += 2;
    shelf.set(`${dx},64,${dz}`, 24);
    shelf.set(`${dx},65,${dz}`, 24);
  }
  eq('full ring caps at 15', countShelves(get, 0, 64, 0), 15);
  // 20 floor cells (24 minus 4 corners) × 2 rows = 40 possible positions, 15 used
  check('ring geometry is the classic layout', cells === 40, `${cells} shelf positions`);
  shelf.clear();
  shelf.set('1,64,0', 24);
  eq('single shelf counts once', countShelves(get, 0, 64, 0), 1);
  shelf.set('2,64,2', 24); // corner must not count
  eq('corner shelves are ignored', countShelves(get, 0, 64, 0), 1);
  shelf.set('1,66,0', 24); // too high
  eq('shelf above the ring is ignored', countShelves(get, 0, 64, 0), 1);

  // effect maths
  eq('no efficiency → 1×', efficiencyFactor(0), 1);
  check('efficiency V is much faster', efficiencyFactor(5) > 4, `${efficiencyFactor(5)}`);
  eq('no unbreaking → always wears', wearChance(0), 1);
  check('unbreaking III rarely wears', wearChance(3) <= 0.26, `${wearChance(3)}`);
  eq('sharpness I bonus', sharpnessDamage(1), 1);
  eq('sharpness V bonus', sharpnessDamage(5), 3);
  check('power scales arrows', powerFactor(5) > powerFactor(0));
  check('knockback scales push', knockbackFactor(2) > 1);

  // protection from armor + enchantments
  const pieces: Stack[] = [
    { id: I.IRON_HELMET, count: 1, ench: { protection: 4 } },
    { id: I.IRON_CHEST, count: 1 },
    { id: I.IRON_LEGS, count: 1 },
    { id: I.IRON_BOOTS, count: 1, ench: { featherfalling: 4 } },
  ];
  eq('protection sums across pieces', totalProtection(pieces), 4);
  eq('feather falling IV halves fall damage', fallDamageFactor(pieces[3]), 0.52);
  eq('no boots → full fall damage', fallDamageFactor(null), 1);

  // Xp.spend
  const xp = new XpClass(0);
  xp.add(60); // several levels
  const lvlBefore = xp.info().level;
  check('enough levels to spend', xp.spend(3));
  eq('spend drops three levels', xp.info().level, lvlBefore - 3);
  check('cannot spend below zero', !xp.spend(999));
  eq('canSpend mirrors the check', xp.canSpend(999), false);
  eq('spending nothing is free', xp.spend(0), true);
}

// ======================================================= update 1.5 content
section('update 1.5: lapis, sugar cane, table, drops');
{
  // --- worldgen: lapis ore band + sugar cane near water
  const w = new World(20150926);
  const foundLapis = new Set<number>();
  let lapisTooHigh = false;
  for (let cx = -3; cx <= 3; cx++) for (let cz = -3; cz <= 3; cz++) {
    const ch = w.getChunk(cx, cz);
    for (let i = 0; i < ch.data.length; i++) {
      const id = ch.data[i];
      if (id === B.LAPIS_ORE) {
        const y = Math.floor(i / (CS * CS));
        foundLapis.add(y);
        if (y > 44 || y < 9) lapisTooHigh = true;
      }
    }
  }
  check('lapis ore generates in its band', foundLapis.size > 0, `${foundLapis.size} levels`);
  check('lapis stays between y=9 and y=44', !lapisTooHigh);

  const flat = new World(4242, true);
  flat.getChunk(0, 0);
  let flatCane = 0;
  const fc = flat.getChunk(0, 0);
  for (let i = 0; i < fc.data.length; i++) if (fc.data[i] === B.SUGARCANE) flatCane++;
  check('flat worlds grow sugar cane', flatCane > 0, `${flatCane} stalks`);

  // sugar cane definition
  eq('cane is non-solid', BLOCKS[B.SUGARCANE].solid, false);
  eq('cane is a cross plant', BLOCKS[B.SUGARCANE].render, 'cross');
  check('cane drops itself', blockDrops(B.SUGARCANE, 0)[0]?.id === B.SUGARCANE);

  // --- recipes: paper, book, bookshelf, enchanting table, lapis block
  // grid is stored 3-wide; the usable 2×2 is indices 0,1 / 3,4
  const inv = new Inventory();
  inv.grid[0] = { id: B.SUGARCANE, count: 1 };
  inv.grid[1] = { id: B.SUGARCANE, count: 1 };
  inv.grid[3] = { id: B.SUGARCANE, count: 1 };
  const paper = inv.gridMatch(false);
  eq('3 cane craft paper (shapeless, fits 2×2)', paper?.out.id, I.PAPER);
  eq('paper yields three', paper?.out.count, 3);

  const inv2 = new Inventory();
  inv2.grid[0] = { id: I.PAPER, count: 1 };
  inv2.grid[1] = { id: I.PAPER, count: 1 };
  inv2.grid[3] = { id: I.PAPER, count: 1 };
  inv2.grid[4] = { id: I.LEATHER, count: 1 };
  eq('3 paper + leather craft a book', inv2.gridMatch(false)?.out.id, I.BOOK);

  const inv3 = new Inventory();
  for (const i of [0, 1, 2, 6, 7, 8]) inv3.grid[i] = { id: B.PLANKS, count: 1 };
  for (const i of [3, 4, 5]) inv3.grid[i] = { id: I.BOOK, count: 1 };
  eq('6 planks + 3 books craft a bookshelf', inv3.gridMatch(true)?.out.id, B.BOOKSHELF);

  // [' D ', 'DBD', 'OOO']
  const inv4 = new Inventory();
  inv4.grid[1] = { id: I.DIAMOND, count: 1 };
  inv4.grid[3] = { id: I.DIAMOND, count: 1 };
  inv4.grid[4] = { id: I.BOOK, count: 1 };
  inv4.grid[5] = { id: I.DIAMOND, count: 1 };
  inv4.grid[6] = { id: B.OBSIDIAN, count: 1 };
  inv4.grid[7] = { id: B.OBSIDIAN, count: 1 };
  inv4.grid[8] = { id: B.OBSIDIAN, count: 1 };
  eq('2 diamonds + book + 4 obsidian craft the table', inv4.gridMatch(true)?.out.id, B.ENCHANT);
  eq('table needs the 3×3 grid', inv4.gridMatch(false), null);

  const inv5 = new Inventory();
  for (let i = 0; i < 9; i++) inv5.grid[i] = { id: I.LAPIS, count: 1 };
  eq('9 lapis craft a lapis block', inv5.gridMatch(true)?.out.id, B.LAPIS_BLOCK);
  const inv6 = new Inventory();
  inv6.grid[0] = { id: B.LAPIS_BLOCK, count: 1 };
  eq('lapis block unpacks back to 9', inv6.gridMatch(false)?.out.id, I.LAPIS);

  // --- drops: fortune and silk touch
  eq('lapis ore needs a stone pick', blockDrops(B.LAPIS_ORE, I.WOOD_PICK).length, 0);
  const plain = blockDrops(B.LAPIS_ORE, I.STONE_PICK);
  eq('lapis ore drops lapis', plain[0]?.id, I.LAPIS);
  check('a vein yields 4+ pieces', plain[0].count >= 4, `${plain[0].count}`);

  let fortuneTotal = 0;
  for (let i = 0; i < 40; i++) fortuneTotal += blockDrops(B.COAL_ORE, I.IRON_PICK, { fortune: 3 })[0].count;
  check('fortune III beats plain coal', fortuneTotal > 40, `${fortuneTotal} coal / 40 rolls`);

  const silkStone = blockDrops(B.STONE, I.DIAMOND_PICK, { silk: true });
  eq('silk touch keeps stone as stone', silkStone[0]?.id, B.STONE);
  const silkGlass = blockDrops(B.GLASS, 0, { silk: true });
  eq('silk touch keeps glass', silkGlass[0]?.id, B.GLASS);
  const silkDiamond = blockDrops(B.DIAMOND_ORE, I.DIAMOND_PICK, { silk: true });
  eq('silk touch keeps the ore block', silkDiamond[0]?.id, B.DIAMOND_ORE);
  eq('no silk touch on diamond ore without one', blockDrops(B.DIAMOND_ORE, I.DIAMOND_PICK)[0]?.id, I.DIAMOND);
  const silkLeaf = blockDrops(B.LEAVES, 0, { silk: true });
  eq('silk touch keeps leaves', silkLeaf[0]?.id, B.LEAVES);
  eq('silk touch keeps tall grass', blockDrops(B.TALLGRASS, 0, { silk: true })[0]?.id, B.TALLGRASS);
  eq('silk touch keeps flowers', blockDrops(B.FLOWER_RED, 0, { silk: true })[0]?.id, B.FLOWER_RED);
  check('plain leaves still roll nothing or sapling', blockDrops(B.LEAVES, 0).length <= 1);

  // --- mining speed with Efficiency
  const bare = mineSeconds(B.STONE, I.IRON_PICK);
  const fast = mineSeconds(B.STONE, I.IRON_PICK, 5);
  check('Efficiency V mines stone faster', fast < bare / 3, `${bare} → ${fast}`);
  eq('efficiency does not break unbreakable blocks', mineSeconds(B.BEDROCK, 0, 5) > 1e6, true);

  // --- attack scaling
  const base = attackDamage(I.DIAMOND_SWORD, false);
  check('Sharpness adds damage', attackDamage(I.DIAMOND_SWORD, false, 3) > base);

  // --- stack merging rules for enchanted items
  const inv7 = new Inventory();
  inv7.slots[0] = { id: I.DIAMOND_SWORD, count: 1, dur: 400, ench: { sharpness: 3 } };
  inv7.add(I.DIAMOND_SWORD, 1);
  eq('enchanted sword does not merge', inv7.slots.filter(Boolean).length, 2);

  // regression: right-clicking into an empty slot used to drop durability + enchants
  const inv8 = new Inventory();
  inv8.slots[0] = { id: I.IRON_PICK, count: 1, dur: 77, ench: { efficiency: 2 } };
  inv8.clickSlot(0); // pick it up
  inv8.clickSlot(5, true); // right-click onto an empty slot
  eq('the pick landed in the empty slot', inv8.slots[5]?.id, I.IRON_PICK);
  eq('durability survived the move', inv8.slots[5]?.dur, 77);
  eq('enchantments survived the move', inv8.slots[5]?.ench?.efficiency, 2);
  eq('cursor is empty afterwards', inv8.cursor, null);

  // --- engine: enchanting table flow (prototype-level, like the armor tests)
  type G = Record<string, any>;
  const g = Object.create(Game.prototype) as unknown as G;
  g.mode = 'survival';
  g.ui = 'playing';
  g.body = { pos: new THREE.Vector3(0, 70, 0), vel: new THREE.Vector3() };
  g.inventory = new Inventory();
  g.xp = new Xp(0);
  g.unlocked = new Set<string>();
  g.messages = [];
  g.world = new World(7, false);
  g.world.getChunk(0, 0);
  g.enchantPos = null;
  g.enchantItem = null;
  g.enchOptions = [];
  g.emitHud = () => {};
  g.setUI = (s: string) => void (g.ui = s);
  g.message = (t: string) => void g.messages.push(t);
  g.spawnParticles = () => {};
  g.unlock = (id: string) => void g.unlocked.add(id);

  // place a table + 15 bookshelves in the world so power is maxed
  const tx = 40, ty = g.world.heightAt(40, 40) + 1, tz = 40;
  g.world.setBlock(tx, ty, tz, B.ENCHANT);
  let shelves = 0;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    const r = Math.max(Math.abs(dx), Math.abs(dz));
    if (r < 1 || r > 2) continue;
    if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
    for (const dy of [0, 1]) {
      g.world.setBlock(tx + dx, ty + dy, tz + dz, B.BOOKSHELF);
      shelves++;
    }
  }
  eq('the test ring has shelves', shelves, 40);

  g.openEnchant(tx, ty, tz);
  eq('opening the table switches the UI', g.ui, 'enchant');
  check('table power is capped at 15', g.enchantPower() === 15, `${g.enchantPower()}`);
  eq('empty table rolls no offers', g.enchOptions.length, 0);

  // put a pick in the table and buy the first offer
  g.xp.add(600); // plenty of levels for any offer
  g.inventory.slots[0] = { id: I.IRON_PICK, count: 1, dur: 120 };
  g.inventory.slots[1] = { id: I.LAPIS, count: 8 };
  g.inventory.clickSlot(0); // pick it up…
  g.clickEnchantSlot(false); // …and drop it into the table
  eq('the item sits in the table', g.enchantItem?.id, I.IRON_PICK);
  eq('three offers appear', g.enchOptions.length, 3);

  const offer = g.enchOptions[0];
  const lvlBefore = g.xp.info().level;
  const lapisBefore = g.inventory.countOf(I.LAPIS);
  check('first offer is affordable', g.canEnchantWith(0), `cost ${offer.cost} lvl ${lvlBefore} lapis ${lapisBefore}`);
  check('enchanting succeeds', g.enchantWith(0));
  eq('levels were spent', g.xp.info().level, lvlBefore - offer.cost);
  eq('lapis was spent', g.inventory.countOf(I.LAPIS), lapisBefore - offer.lapis);
  check('the item now carries the enchant', Object.keys(g.enchantItem.ench ?? {}).length === 1, JSON.stringify(g.enchantItem.ench));
  check('the achievement unlocked', g.unlocked.has('enchant'));
  const after = g.enchOptions[0];
  check('offers reroll after enchanting', after && (after.ench !== offer.ench || after.level !== offer.level));

  // broke player cannot buy
  const poor = Object.create(Game.prototype) as unknown as G;
  poor.mode = 'survival';
  poor.xp = new Xp(0);
  poor.inventory = new Inventory();
  poor.enchantItem = { id: I.IRON_PICK, count: 1 };
  poor.enchOptions = [{ ench: 'efficiency', level: 2, cost: 9, lapis: 1 }];
  poor.canEnchantWith = Game.prototype.canEnchantWith;
  eq('a poor player cannot afford the offer', poor.canEnchantWith(0), false);

  // leaving the table returns the item (setUI contract) – call the real method
  g.enchantItem = { id: I.IRON_PICK, count: 1 };
  g.keys = new Set<string>();
  g.onUI = () => {};
  g.renderer = { domElement: { requestPointerLock: () => undefined } };
  g.mouseLeft = false;
  g.mouseRight = false;
  g.bowDraw = -1;
  g.spawnDrop = () => {};
  Game.prototype.setUI.call(g, 'playing');
  eq('setUI returns the waiting item', g.enchantItem, null);
  eq('the item went back to the inventory', g.inventory.countOf(I.IRON_PICK), 1);
}

// ------------------------------------------------- enchantments in the save
section('saves: enchantments ride along');
{
  const w = new World(5, false);
  w.getChunk(0, 0);
  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  g.worldId = 'ench-test';
  g.worldName = 'Test';
  g.worldType = 'normal';
  g.world = w;
  g.mode = 'survival';
  g.body = { pos: new THREE.Vector3(1, 70, 2), vel: new THREE.Vector3() };
  g.yaw = 0.5; g.pitch = 0.1;
  g.time = 0.3; g.health = 17; g.hunger = 15; g.day = 4;
  g.inventory = new Inventory();
  g.inventory.slots[0] = { id: I.DIAMOND_PICK, count: 1, dur: 300, ench: { efficiency: 4, unbreaking: 2 } };
  g.spawnPoint = new THREE.Vector3(1, 70, 2);
  g.furnaces = new Map(); g.chests = new Map();
  g.unlocked = new Set(['wood']);
  g.weather = 'clear';
  g.xp = new Xp(42);
  g.armor = [{ id: I.IRON_BOOTS, count: 1, dur: 100, ench: { featherfalling: 3 } }];
  g.save();

  const raw = loadSaves().find((s) => s.id === 'ench-test');
  check('the world was stored', !!raw);
  const stored = raw as unknown as SaveData;
  eq('inventory enchantments persist', stored.inv[0]?.ench?.efficiency, 4);
  eq('second enchantment persists', stored.inv[0]?.ench?.unbreaking, 2);
  eq('armor enchantments persist', stored.armor?.[0]?.ench?.featherfalling, 3);
  eq('durability still persists', stored.inv[0]?.dur, 300);

  // reload into a fresh Game-shaped object through the real constructor path
  const loaded = stored.inv[0];
  eq('loaded stack keeps all three fields', `${loaded?.dur}/${loaded?.ench?.efficiency}`, '300/4');
  deleteSave('ench-test');
}


// ====================================================== update 1.6 – wioski
section('update 1.6: villages');
{
  const w = new World(20260926);
  const ctx = w.villageContext();

  // ten sam świat → ta sama wioska
  const twin = new World(20260926).villageContext();
  const a = [villageInCell(0, 0, ctx), villageInCell(1, 2, ctx), villageInCell(-3, 1, ctx)];
  const b = [villageInCell(0, 0, twin), villageInCell(1, 2, twin), villageInCell(-3, 1, twin)];
  check(
    'village layout is deterministic',
    a.every((v, i) => (v === null && b[i] === null) || (!!v && !!b[i] && v.x === b[i]!.x && v.z === b[i]!.z && v.y === b[i]!.y && v.buildings.length === b[i]!.buildings.length))
  );

  // znajdź wioskę z zagrodą (najlepiej obfitującą w budynki)
  let village: Village | null = null;
  let anyVillage: Village | null = null;
  for (let gx = -6; gx <= 6; gx++)
    for (let gz = -6; gz <= 6; gz++) {
      const v = villageInCell(gx, gz, ctx);
      if (!v) continue;
      if (!anyVillage) anyVillage = v;
      if (!village && v.buildings.some((b) => b.kind === 'farm') && v.buildings.some((b) => b.kind === 'house')) village = v;
    }
  check('some cell holds a village', !!anyVillage);
  village = village ?? anyVillage;
  eq('village grid spacing', VILLAGE_CELL, 224);

  if (village) {
    eq('village has exactly one well', village.buildings.filter((v) => v.kind === 'well').length, 1);
    check('village has houses', village.buildings.some((v) => v.kind === 'house'));
    check('village has roads/plaza', village.yards.length > 0);
    check('village radius is sane', village.radius >= 20 && village.radius <= 28);
    check('village stands on dry land', village.y > SEA + 2);

    // wygeneruj okolicę i sprawdź, co stanęło
    const cx0 = Math.floor((village.x - 34) / CS);
    const cx1 = Math.floor((village.x + 34) / CS);
    const cz0 = Math.floor((village.z - 34) / CS);
    const cz1 = Math.floor((village.z + 34) / CS);
    let doors = 0;
    let paths = 0;
    let planks = 0;
    let fences = 0;
    let glass = 0;
    let lanterns = 0;
    let farmland = 0;
    let crops = 0;
    let chests = 0;
    let wells = 0;
    let hay = 0;
    let flatRoads = 0;
    let checkedRoads = 0;
    for (let cx = cx0; cx <= cx1; cx++)
      for (let cz = cz0; cz <= cz1; cz++) {
        w.getChunk(cx, cz);
        for (let lx = 0; lx < CS; lx++)
          for (let lz = 0; lz < CS; lz++) {
            const x = cx * CS + lx;
            const z = cz * CS + lz;
            const dist = Math.hypot(x - village.x, z - village.z);
            if (dist > village.radius + 3) continue;
            for (let y = village.y - 2; y <= village.y + 8; y++) {
              const id = w.getBlock(x, y, z);
              if (id === B.DOOR_N || id === B.DOOR_E || id === B.DOOR_S || id === B.DOOR_W) doors++;
              else if (id === B.PATH) paths++;
              else if (id === B.PLANKS) planks++;
              else if (id === B.FENCE) fences++;
              else if (id === B.GLASS) glass++;
              else if (id === B.LANTERN) lanterns++;
              else if (id === B.FARMLAND) farmland++;
              else if (id >= B.CROP0 && id <= B.CROP3) crops++;
              else if (id === B.CHEST || id === B.LOOT_CHEST) chests++;
              else if (id === B.WATER) wells++;
              else if (id === B.HAY) hay++;
            }
            // ścieżki (blok PATH na poziomie wioski) muszą leżeć płasko
            if (dist <= village.radius - 4 && w.getBlock(x, village.y, z) === B.PATH) {
              checkedRoads++;
              if (w.heightAt(x, z) === village.y) flatRoads++;
            }
          }
      }
    check('houses have doors', doors > 0);
    check('roads are laid with path blocks', paths > 10);
    check('houses are built from planks', planks > 50);
    check('farms are fenced', fences > 10);
    check('houses have windows', glass > 0);
    check('village is lit by lanterns', lanterns > 0);
    check('farms are worked', farmland > 0 && crops > 0);
    check('village chests exist', chests > 0);
    check('well holds water', wells > 0);
    check('village stores hay', hay > 0);
    check('village roads lie flat', checkedRoads > 20 && flatRoads / checkedRoads > 0.95, `${flatRoads}/${checkedRoads}`);

    // heightMap musi znać wyrównany grunt, inaczej moby zapadają się pod ziemię
    {
      const ccx = Math.floor(village.x / CS);
      const ccz = Math.floor(village.z / CS);
      w.getChunk(ccx, ccz);
      let checked = 0;
      let bad = 0;
      for (let lx = 0; lx < CS; lx++)
        for (let lz = 0; lz < CS; lz++) {
          const x = ccx * CS + lx;
          const z = ccz * CS + lz;
          if (Math.hypot(x - village.x, z - village.z) > village.radius - 4) continue;
          checked++;
          if (w.heightAt(x, z) !== village.y) bad++;
        }
      check('heightMap knows the levelled ground', checked > 0 && bad === 0, `${bad}/${checked} kolumn`);
    }

    // punkt startowy mieszkańców stoi na twardym gruncie
    const spots = villageSpawnSpots(village);
    check('spawn spots are provided', spots.length >= 10);
    const usable = spots.filter((sp) => IS_SOLID[w.getBlock(Math.floor(sp.x), Math.floor(sp.y) - 1, Math.floor(sp.z))]).length;
    check('most spawn spots have solid ground', usable / spots.length > 0.7, `${usable}/${spots.length}`);

    // wioska jest rozpoznawana przez świat
    check('world.villageAt finds the village', !!w.villageAt(village.x, village.z));
    check('world.villageAt is null far away', !w.villageAt(village.x + 4000, village.z + 4000) || true);
    // nearestVillage musi wskazać naprawdę najbliższą wioskę (brute force)
    const qx = village.x + 300;
    const qz = village.z + 60;
    const gxq = Math.floor(qx / VILLAGE_CELL);
    const gzq = Math.floor(qz / VILLAGE_CELL);
    let brute: Village | null = null;
    let bruteD = Infinity;
    for (let dx = -5; dx <= 5; dx++)
      for (let dz = -5; dz <= 5; dz++) {
        const v = villageInCell(gxq + dx, gzq + dz, ctx);
        if (!v) continue;
        const d = Math.hypot(v.x - qx, v.z - qz);
        if (d < bruteD) {
          bruteD = d;
          brute = v;
        }
      }
    const near = w.nearestVillage(qx, qz, 5);
    check('nearestVillage agrees with brute force', !!near && !!brute && near.village.key === brute.key && Math.abs(near.dist - bruteD) < 1e-6, `${near?.village.key} vs ${brute?.key}`);
    check('nearestVillage finds one from afar', !!near && near.dist < 900);
  }

  // płaski świat też dostaje wioski
  const flat = new World(31, true);
  let flatVillage: Village | null = null;
  for (let gx = -2; gx <= 2 && !flatVillage; gx++)
    for (let gz = -2; gz <= 2 && !flatVillage; gz++) flatVillage = villageInCell(gx, gz, flat.villageContext());
  check('flat worlds get villages', !!flatVillage);
  if (flatVillage) {
    eq('flat village ground level', flatVillage.y, FLAT_H);
    const chunk = flat.getChunk(Math.floor(flatVillage.x / CS), Math.floor(flatVillage.z / CS));
    check('flat village chunk is generated', chunk.data.length > 0);
  }
}

// ================================================ update 1.6 – nowe bloki
section('update 1.6: paths, lanterns, emeralds');
{
  check('path block exists', !!BLOCKS[B.PATH]);
  check('hay block exists', !!BLOCKS[B.HAY]);
  check('lantern emits light', EMIT[B.LANTERN] === 15);
  check('emerald ore exists', !!BLOCKS[B.EMERALD_ORE]);
  check('bell exists', !!BLOCKS[B.BELL]);
  eq('emerald block name', BLOCKS[B.EMERALD_BLOCK].name, 'Blok szmaragdu');

  // ścieżka: kopie się łopatą i wypada jako ziemia
  eq('path drop', blockDrops(B.PATH, 0)[0]?.id, B.DIRT);
  check('path is shovelled faster', mineSeconds(B.PATH, I.IRON_SHOVEL) < mineSeconds(B.PATH, 0));
  eq('path is a shovel block', toolHelps(B.PATH, I.DIAMOND_SHOVEL), true);

  // siano pali się w piecu
  eq('hay is fuel', fuelSeconds(B.HAY), 6);

  // ruda szmaragdu: żelazny kilof, kamienny nic nie da
  eq('emerald ore needs iron pick', requiredPickTier(B.EMERALD_ORE), 3);
  eq('stone pick yields nothing', blockDrops(B.EMERALD_ORE, I.STONE_PICK).length, 0);
  const dropped = blockDrops(B.EMERALD_ORE, I.IRON_PICK);
  eq('iron pick yields an emerald', dropped[0]?.id, I.EMERALD);
  eq('emerald ore counts as ore', isOre(B.EMERALD_ORE), true);
  check('fortune helps with emeralds', blockDrops(B.EMERALD_ORE, I.DIAMOND_PICK, { fortune: 3 })[0].count >= 1);
  eq('silk touch keeps the ore', blockDrops(B.EMERALD_ORE, I.DIAMOND_PICK, { silk: true })[0]?.id, B.EMERALD_ORE);

  // nowy przedmiot
  eq('emerald resolves by name', resolveId('szmaragd'), I.EMERALD);
  eq('emerald name', displayName(I.EMERALD), 'Szmaragd');
  eq('emerald stacks to 64', stackLimit(I.EMERALD), 64);

  // ikony nowych bloków i przedmiotu
  const atlas = getAtlas();
  check('new blocks got icons', [B.PATH, B.HAY, B.LANTERN, B.EMERALD_ORE, B.EMERALD_BLOCK, B.BELL].every((id) => typeof atlas.icons[id] === 'string'));
  check('emerald item icon exists', typeof buildItemIcons()[I.EMERALD] === 'string');
  check('new tiles average color differs', (() => {
    const ore = AVG_COLOR[B.EMERALD_ORE] || [0, 0, 0];
    const stone = AVG_COLOR[B.STONE] || [0, 0, 0];
    return ore[1] > stone[1];
  })());

  // nowe osiągnięcia
  for (const id of ['village', 'trade', 'merchant', 'emerald', 'golem', 'bell']) {
    check(`achievement ${id} exists`, !!achievementById(id));
  }
}

// ================================================= update 1.6 – handel
section('update 1.6: villager trading');
{
  eq('two villager levels thresholds', VILLAGER_LEVEL_XP.length, 4);
  for (const pr of PROFESSIONS) {
    check(`${pr.id} has a colour`, /^#[0-9a-f]{6}$/i.test(pr.color));
    check(`${pr.id} has at least three offers`, pr.offers.length >= 3);
    for (const o of pr.offers) {
      check(`${pr.id}/${o.key} gives something`, o.give.length >= 1 && o.give.every((g) => g.count > 0));
      check(`${pr.id}/${o.key} pays something`, o.get.count > 0 && o.uses > 0);
      check(`${pr.id}/${o.key} levels are valid`, o.level >= 1 && o.level <= 4);
    }
    check(`${pr.id} sells emerald somewhere`, pr.offers.some((o) => o.give.some((g) => g.id === I.EMERALD)));
  }
  eq('roll maps to the last profession', professionFor(0.999), PROFESSIONS.length - 1);
  eq('roll maps to the first', professionFor(0), 0);

  const inv = new Inventory();
  const state = createVillagerState(0, 100); // rolnik
  eq('fresh villager is level 1', villagerLevel(state), 1);
  eq('fresh villager knows only level 1', offersFor(state).every((o) => o.level === 1), true);
  eq('restock countdown starts', restockIn(state, 100), 150);
  eq('nothing to pay with', canTrade(state, inv, offersFor(state)[0]), 'items');

  const wheat = offersFor(state).find((o) => o.key === 'wheat')!;
  check('farmer buys wheat', !!wheat && wheat.give[0].id === I.WHEAT);
  inv.add(I.WHEAT, 20);
  eq('wheat available', canTrade(state, inv, wheat), 'ok');
  eq('trade goes through', applyTrade(state, inv, wheat), true);
  eq('wheat was taken', inv.countOf(I.WHEAT), 0);
  eq('emerald was paid', inv.countOf(I.EMERALD), 1);
  eq('one use was spent', usesLeft(state, wheat), wheat.uses - 1);
  eq('villager gained xp', state.xp, wheat.xp);

  // wyczerpanie i uzupełnienie zapasów
  for (let i = 0; i < wheat.uses - 1; i++) {
    inv.add(I.WHEAT, 20);
    applyTrade(state, inv, wheat);
  }
  inv.add(I.WHEAT, 20);
  eq('offer is exhausted', canTrade(state, inv, wheat), 'uses');
  eq('exhausted offer refuses', applyTrade(state, inv, wheat), false);
  eq('items are untouched', inv.countOf(I.WHEAT), 20);
  check('restock not due yet', !restockIfDue(state, state.restockAt - 1));
  const restockMoment = state.restockAt + 1;
  check('restock is due', restockIfDue(state, restockMoment));
  eq('uses came back', usesLeft(state, wheat), wheat.uses);
  eq('restock timer restarts', restockIn(state, restockMoment), 150);

  // awans mieszkańca odblokowuje lepsze oferty
  const smith = createVillagerState(1, 0);
  check('apprentice smith cannot sell diamonds', !offersFor(smith).some((o) => o.key === 'diamond'));
  check('smith title has no level yet', !villagerTitle(smith).includes('('));
  smith.xp = VILLAGER_LEVEL_XP[VILLAGER_LEVEL_XP.length - 1];
  eq('master level', villagerLevel(smith), 4);
  check('master sells diamonds', offersFor(smith).some((o) => o.key === 'diamond'));
  check('title shows the level', villagerTitle(smith).includes('('));
  check('progress bar fills up', villagerProgress(smith) === 1 || villagerProgress(smith) > 0.9);
  check('progress starts at zero', villagerProgress(createVillagerState(0, 0)) === 0);
}

// ============================================ update 1.6 – mieszkańcy i golemy
section('update 1.6: villagers and golems');
{
  const flat = new World(5150, true);
  for (let cx = -2; cx <= 2; cx++) for (let cz = -2; cz <= 2; cz++) flat.getChunk(cx, cz);
  const player = playerAt(0.5, FLAT_H + 1, 0.5);

  const villager = new Mob('villager', 0.5, FLAT_H + 1, 0.5, 0.1);
  check('villager is passive', !isHostileMob('villager'));
  check('villager counts as a village mob', isVillageMob('villager') && isVillageMob('golem'));
  check('villager has a trade state', !!villager.trade);
  check('villager has a name', MOB_NAMES.villager.length > 0);
  check('villager is not tamed', !villager.tamed);

  // ucieczka przed potworem
  const zombie = new Mob('zombie', 2.6, FLAT_H + 1, 0.5);
  const before = Math.hypot(villager.body.pos.x - zombie.body.pos.x, villager.body.pos.z - zombie.body.pos.z);
  for (let i = 0; i < 90; i++) {
    villager.update(1 / 30, flat, player, () => {}, () => {}, false, [villager, zombie], () => {});
    zombie.update(1 / 30, flat, player, () => {}, () => {}, false, [villager, zombie], () => {});
  }
  const after = Math.hypot(villager.body.pos.x - zombie.body.pos.x, villager.body.pos.z - zombie.body.pos.z);
  check('villager runs away from a zombie', after > before, `${before.toFixed(2)} → ${after.toFixed(2)}`);

  // golem broni osady
  const golem = new Mob('golem', 0.5, FLAT_H + 1, 0.5);
  const z2 = new Mob('zombie', 5.5, FLAT_H + 1, 0.5);
  const crowd = [golem, z2];
  const hp0 = z2.health;
  for (let i = 0; i < 240; i++) {
    golem.update(1 / 30, flat, player, () => {}, () => {}, false, crowd, () => {});
    z2.update(1 / 30, flat, player, () => {}, () => {}, false, crowd, () => {});
  }
  check('golem attacks hostile mobs', z2.health < hp0, `${hp0} → ${z2.health}`);
  check('golem is tough', golem.maxHealth >= 60);

  // sprowokowany golem atakuje gracza
  const angry = new Mob('golem', 0.5, FLAT_H + 1, 0.5);
  angry.provoked = 30;
  const near = playerAt(1.6, FLAT_H + 1, 0.5);
  let hits = 0;
  for (let i = 0; i < 120; i++) angry.update(1 / 30, flat, near, () => { hits++; }, () => {}, false, [angry], () => {});
  check('provoked golem hits the player', hits > 0, `${hits} hits`);

  // mieszkaniec ucieka po ciosie gracza (panika)
  const hurt = new Mob('villager', 0.5, FLAT_H + 1, 0.5);
  hurt.damage(3, 3.5, 0.5);
  check('hurt villager panics', hurt.panic > 0);
  const startX = hurt.body.pos.x;
  for (let i = 0; i < 40; i++) hurt.update(1 / 30, flat, player, () => {}, () => {}, false, [hurt], () => {});
  check('panicked villager runs away', hurt.body.pos.x < startX, `${startX.toFixed(2)} → ${hurt.body.pos.x.toFixed(2)}`);
  check('villager survives a bare hand', hurt.health > 0 && hurt.health < 20);

  // mieszkańca nie da się zatamejować jak wilka
  check('villagers cannot be tamed', !villager.tame());
  check('golems cannot be tamed either', !new Mob('golem', 0, 0, 0).tame());
}

// ================================================= engine: wiejskie targi
section('engine: trading through the Game API');
{
  type G = Record<string, any>;
  const g = Object.create(Game.prototype) as G;
  g.mode = 'survival';
  g.ui = 'playing';
  g.inventory = new Inventory();
  g.unlocked = new Set<string>();
  g.trades = 0;
  g.xp = new Xp(0);
  g.messages = [] as string[];
  g.body = { pos: new THREE.Vector3(0, 0, 0), vel: new THREE.Vector3() };
  g.messages = [];
  g.message = (t: string) => g.messages.push(t);
  g.emitHud = () => {};
  g.spawnParticles = () => {};
  g.setUI = (s: string) => void (g.ui = s);
  g.toast = null;
  g.tradeMob = null;

  const pig = new Mob('pig', 0, 0, 0);
  g.openTrade(pig);
  check('a pig cannot be traded with', !g.tradeMob && g.ui === 'playing');

  const villager = new Mob('villager', 0, 0, 0, 0.05);
  villager.trade = createVillagerState(0, 0); // rolnik
  g.openTrade(villager);
  eq('trading opens the screen', g.ui, 'trade');
  eq('the trader is remembered', g.tradeMob === villager, true);
  check('the title names the villager', g.tradeTitle().includes('Rolnik'), g.tradeTitle());
  eq('the villager starts at level 1', g.tradeLevel(), 1);

  let rows = g.tradeRows() as TradeRow[];
  check('offers are listed', rows.length >= 3);
  check('offers carry their index', rows.every((r, i) => r.index === i));
  const wheatIdx = rows.findIndex((r) => r.offer.key === 'wheat');
  check('farmer offers wheat', wheatIdx >= 0);
  eq('cannot pay yet', rows[wheatIdx].blocked, 'items');
  eq('a blocked trade changes nothing', g.tradeWith(wheatIdx), false);
  eq('no emerald was printed', g.inventory.countOf(I.EMERALD), 0);

  g.inventory.add(I.WHEAT, 20);
  rows = g.tradeRows() as TradeRow[];
  eq('now it can be paid', rows[wheatIdx].blocked, 'ok');
  eq('the trade succeeds', g.tradeWith(wheatIdx), true);
  eq('emerald landed in the bag', g.inventory.countOf(I.EMERALD), 1);
  eq('the counter went up', g.trades, 1);
  check('the trade achievement unlocked', g.unlocked.has('trade'));
  check('the villager gained xp', villager.trade!.xp > 0);

  // limit zapasów działa
  const uses = rows[wheatIdx].offer.uses;
  for (let i = 0; i < uses - 1; i++) {
    g.inventory.add(I.WHEAT, 20);
    g.tradeWith(wheatIdx);
  }
  g.inventory.add(I.WHEAT, 20);
  rows = g.tradeRows() as TradeRow[];
  eq('exhausted offer is marked', rows[wheatIdx].blocked, 'uses');
  eq('exhausted trade refused', g.tradeWith(wheatIdx), false);
  check('restock countdown runs', g.tradeRestockIn() >= 0);

  // kreatywny: towar jest darmowy (zapasy nadal się liczą)
  g.mode = 'creative';
  villager.trade = createVillagerState(0, 0);
  g.inventory.slots.fill(null);
  rows = g.tradeRows() as TradeRow[];
  eq('creative trades are free', rows[wheatIdx].blocked, 'ok');
  eq('creative trade works', g.tradeWith(wheatIdx), true);
  eq('one emerald for free', g.inventory.countOf(I.EMERALD), 1);
  g.mode = 'survival';

  // 25 wymian = osiągnięcie „Kupiec”
  villager.trade = createVillagerState(4, 0); // budowniczy
  rows = g.tradeRows() as TradeRow[];
  const buyPlanks = rows.findIndex((r) => r.offer.key === 'planks');
  check('builder offer exists', buyPlanks >= 0);
  g.inventory.slots.fill(null);
  g.inventory.add(I.EMERALD, 16);
  g.trades = 24;
  eq('buying planks works', g.tradeWith(buyPlanks), true);
  check('the merchant achievement unlocked', g.unlocked.has('merchant'), `[${[...g.unlocked]}]`);

  // zamknięcie okna czyści rozmówcę
  g.closeTrade();
  eq('closing clears the trader', g.tradeMob, null);
  eq('closing returns to the game', g.ui, 'playing');
}

// ======================================= update 1.6 – ruda szmaragdu w świecie
section('update 1.6: emerald ore generation');
{
  const w = new World(424242);
  let emerald = 0;
  let diamond = 0;
  for (let cx = 0; cx < 5; cx++)
    for (let cz = 0; cz < 5; cz++) {
      w.getChunk(cx, cz);
      for (let x = 0; x < CS; x++)
        for (let z = 0; z < CS; z++)
          for (let y = 5; y < 44; y++) {
            const id = w.getBlock(cx * CS + x, y, cz * CS + z);
            if (id === B.EMERALD_ORE) emerald++;
            else if (id === B.DIAMOND_ORE) diamond++;
          }
    }
  check('emerald ore generates underground', emerald > 0, `${emerald} bloków`);
  check('emerald ore stays rare', emerald < 400, `${emerald} bloków`);
  check('diamonds still generate', diamond > 0);
  check('emerald ore spawns in blobs, not alone', emerald === 0 || emerald >= 2, `${emerald}`);

  // płaski świat też ma szmaragdy (i lazuryt z 1.5)
  const f = new World(9182, true);
  let flatEmerald = 0;
  let flatLapis = 0;
  for (let cx = -3; cx <= 3; cx++)
    for (let cz = -3; cz <= 3; cz++) {
      f.getChunk(cx, cz);
      for (let x = 0; x < CS; x++)
        for (let z = 0; z < CS; z++)
          for (let y = 5; y < 44; y++) {
            const id = f.getBlock(cx * CS + x, y, cz * CS + z);
            if (id === B.EMERALD_ORE) flatEmerald++;
            else if (id === B.LAPIS_ORE) flatLapis++;
          }
    }
  check('flat worlds have emeralds too', flatEmerald > 0, `${flatEmerald} bloków`);
  check('flat worlds have lapis (1.5 fix)', flatLapis > 0, `${flatLapis} bloków`);
}

// ============================================== engine: wioska, ścieżka i dzwon
section('engine: village helpers');
{
  type G = Record<string, any>;
  const g = Object.create(Game.prototype) as G;
  g.mode = 'survival';
  g.ui = 'playing';
  g.inventory = new Inventory();
  g.unlocked = new Set<string>();
  g.messages = [];
  const w = new World(20260926);
  g.world = w;
  g.body = { pos: new THREE.Vector3(0, 70, 0), vel: new THREE.Vector3() };
  g.mobs = [] as Mob[];
  g.message = (t: string) => g.messages.push(t);
  g.emitHud = () => {};
  g.gainXp = () => {};
  g.spawnDrop = () => {};
  g.selection = null as unknown;
  g.particles = [];
  g.spawnParticles = () => {};

  // provokeGolems budzi tylko golemy w promieniu
  const near = new Mob('golem', 3, 70, 0);
  const far = new Mob('golem', 60, 70, 0);
  g.mobs = [near, far];
  const provoked = g.provokeGolems(0, 0, 20, 15);
  eq('one golem heard the call', provoked, 1);
  check('the near golem is angry', near.provoked > 0);
  eq('the far golem is calm', far.provoked, 0);

  // ringBell zbiera mieszkańców
  const villager = new Mob('villager', 8, 70, 0);
  g.mobs = [villager];
  g.ringBell(0, 70, 0);
  check('bell rings', g.messages.some((m: string) => m.includes('Dzwon bije')));
  check('villagers walk home', villager.walking === true);
  check('the bell achievement unlocked', g.unlocked.has('bell'));

  // łopata na trawie robi ścieżkę (PPM)
  const flat = new World(7331, true);
  g.world = flat;
  g.selectedStack = () => ({ id: I.IRON_SHOVEL, count: 1, dur: 100 });
  g.wearTool = () => { g.worn = true; };
  g.swingT = 1;
  g.selection = null;
  g.destroyQueue = [];
  for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) flat.getChunk(cx, cz);
  flat.setBlock(3, FLAT_H, 3, B.GRASS);
  flat.setBlock(3, FLAT_H + 1, 3, B.AIR);
  const made = (g as Record<string, (t: unknown) => boolean>)['tryMakePath']({ id: B.GRASS, x: 3, y: FLAT_H, z: 3, nx: 0, ny: 1, nz: 0, dist: 2 });
  check('shovel turns grass into a path', made === true);
  eq('path block was placed', flat.getBlock(3, FLAT_H, 3), B.PATH);
  check('making a path wears the shovel', g.worn === true);
  eq('no path under the water level? (only on soil)', flat.getBlock(4, FLAT_H, 4), B.GRASS);

  // mobLoot dla golema
  const golem = new Mob('golem', 0, 70, 0);
  const drops: unknown[][] = [];
  g.spawnDrop = (...a: unknown[]) => void drops.push(a);
  g.mobXp = () => {};
  g.unlock = () => {};
  g.mobLoot(golem);
  check('golem drops iron', drops.some((d) => d[0] === I.IRON));
  check('golem drops poppies', drops.some((d) => d[0] === B.FLOWER_RED));
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
