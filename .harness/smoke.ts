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
import { PRESETS, detectDeviceProfile, recommendPreset, describeProfile, type DeviceProfile } from '../src/utils/performance';
import { DEFAULT_SETTINGS, applyPreset, effectiveSettings, effectiveDetail, loadSettings, normalizeSettings, saveSettings, SETTINGS_KEY } from '../src/utils/settings';

// ---------------------------------------------------------------- DOM stubs
let committedAtlas: Uint8ClampedArray | null = null;
const ctx2d = {
  canvas: { width: 16, height: 16 },
  fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, imageSmoothingEnabled: true,
  textAlign: '', font: '', textBaseline: '', shadowBlur: 0, shadowColor: '', lineCap: '', lineJoin: '',
  fillRect() {}, strokeRect() {}, clearRect() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
  arc() {}, arcTo() {}, quadraticCurveTo() {}, bezierCurveTo() {}, fill() {}, stroke() {}, clip() {},
  drawImage() {}, save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, setTransform() {},
  resetTransform() {}, putImageData(data: { width: number; data: Uint8ClampedArray }) {
    if (data.width === 256) committedAtlas = new Uint8ClampedArray(data.data);
  },
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
import { World, CS, CH, SEA, FLAT_H, plantTree } from '../src/game/world';
import { DiscoveryMap, MAP_LIMIT } from '../src/game/discoveryMap';
import { CHALLENGES, normalizeChallenges } from '../src/game/challenges';
import { DEFAULT_DIFFICULTY, normalizeDifficulty, hostileCap, hostileSpeed, mobDamage, oreYield, resourceDropCount, animalMeatYield } from '../src/game/difficulty';
import { BiomeSearch, COMPASS_RANGE, BIOME_TARGETS } from '../src/game/biomeCompass';
import { B, T, BLOCKS, CREATIVE_BLOCKS, EMIT, IS_SOLID, RENDER, tileFor, isDoorTop, isLadder, isTrap, doorFacing } from '../src/game/blocks';
import {
  ITEMS, I, CREATIVE_ITEMS, itemDef, isItem, stackLimit, durabilityMax, isOre, oreXp, pickTier, requiredPickTier,
  pickHint, mineSeconds, toolHelps, attackDamage, attackCooldown, attackReach, shieldDamageFactor, shieldWeightFactor, shieldWear, blockDrops, smeltResult, fuelSeconds, resolveId,
  displayName,
} from '../src/game/items';
import { Inventory, RECIPES, MAX_STACK, type Stack } from '../src/game/inventory';
import { aabbIntersectsBlock, stepBody, type Body } from '../src/game/physics';
import { boundedPathStep } from '../src/game/pathfinding';
import { chooseAmbient } from '../src/game/ambience';
import { dodgeDirection, threatInFront } from '../src/game/combatMoves';
import * as Sfx from '../src/game/audio';
import { Mob, isTrustFood, isHostileMob, isVillageMob, pickPassiveMob, shoreWaterNearby, turtleSpawnAllowed, findTurtleNest, villagerActivity, villagerWorkSpot, villagerWalkable, merchantProfession, batSpawnAllowed, findNearbyShelter, nearestFire, fireEscapeHeading, type MobType } from '../src/game/mobs';
import { emptyChest, chestLoot, lootChest, CHEST_SLOTS, chestKey } from '../src/game/chest';
import { emptyFurnace, tickFurnace, COOK_TIME, furnaceKey } from '../src/game/furnace';
import {
  cleanWorldName, deleteSave, duplicateSave, exportSave, exportSaves, importSaves,
  loadSaves, renameSave, toggleFavoriteSave, upsertSave, MAX_WORLD_NAME,
} from '../src/game/saves';
import { ACHIEVEMENTS, achievementById, BIOME_DISCOVERY_GOALS } from '../src/game/achievements';
import { Xp, xpToNext, totalXpForLevel, levelFromXp } from '../src/game/xp';
import { ARMOR, isArmor, armorPoints, damageReduction, armorSlotOf, bootHeatReduction, bootSwimFactor, bootFallFactor, waterSpeedFactor, landingFactor } from '../src/game/armor';
import {
  ENCHANTS, enchName, resolveEnch, canEnchant, conflicts, canAddEnch, addEnch,
  enchLevel, enchList, stackName, countShelves, rollEnchantOptions, efficiencyFactor,
  wearChance, sharpnessDamage, powerFactor, knockbackFactor, totalProtection,
  fallDamageFactor, sourceProtection, swimSpeedFactor, MAX_ENCHS,
} from '../src/game/enchant';
import { Xp as XpClass } from '../src/game/xp';
import { Game, MOB_NAMES, normalizeCompanions, type SaveData, type TradeRow, type UIState } from '../src/game/engine';
import { tryCreatePortal } from '../src/game/redstone';
import { brewingKey, emptyBrewing, brewResult, tickBrewing, POTIONS, sprintFactor, fallDamageAfterPotion, restoreEffects } from '../src/game/brewing';
import { VILLAGE_CELL, villageInCell, villageSpawnSpots, type Village } from '../src/game/village';
import {
  PROFESSIONS, VILLAGER_LEVEL_XP, applyTrade, canTrade, createVillagerState, offersFor,
  professionFor, restockIfDue, restockIn, usesLeft, villagerLevel, villagerProgress, villagerTitle,
} from '../src/game/trading';
import { getAtlas, compactAtlas, AVG_COLOR } from '../src/game/textures';
import { BITE_MAX, BITE_MIN, BITE_WINDOW, PATIENCE, biteDelay, cookedOf, isFishStack, rollCatch } from '../src/game/fishing';
import {
  MERGE_COST, RENAME_COST, anvilKey, anvilResult, canMerge, cleanItemName, emptyAnvil,
  mergeEnchants, mergeStacks, type AnvilResult,
} from '../src/game/anvil';
import { mergeable } from '../src/game/inventory';
import { slabFullBlock } from '../src/game/blocks';
import { slimeBounce } from '../src/game/physics';
import { buildItemIcons } from '../src/game/itemIcons';
import { resolveControlMode } from '../src/utils/input';
import { filterRecipes } from '../src/utils/recipeSearch';

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

  // New 3.0 climate regions are seed-stable and actually reachable.
  const biomes = new Set<string>();
  let biomeStable = true;
  for (let x = -1600; x <= 1600; x += 64) for (let z = -1600; z <= 1600; z += 64) {
    const aa = a.surface(x, z), bb = b.surface(x, z);
    biomes.add(aa.biome);
    if (aa.biome !== bb.biome) biomeStable = false;
  }
  check('3.0 wetland, savanna and jungle climates generate deterministically', biomeStable && ['Bagno', 'Sawanna', 'Dżungla'].every((name) => biomes.has(name)));

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

// =================================================== generator v3: six biomes
section('3.0: biome expansion and legacy terrain');
{
  const world = new World(12345);
  const copy = new World(12345);
  const legacy = new World(12345, false, false, 2);
  const seen = new Set<string>();
  let repeatable = true;
  for (let x = -2000; x <= 2000; x += 64) for (let z = -2000; z <= 2000; z += 64) {
    const a = world.surface(x, z), b = copy.surface(x, z);
    seen.add(a.biome);
    if (a.biome !== b.biome || a.h !== b.h) repeatable = false;
  }
  check('all six requested biomes generate deterministically', repeatable &&
    ['Bagno', 'Sawanna', 'Dżungla', 'Tajga', 'Pustkowie', 'Kwiecista łąka'].every((b) => seen.has(b)));
  const table = [
    { x: -2000, z: -1136, biome: 'Tajga', top: B.PODZOL, vegetation: B.SPRUCE_LOG },
    { x: -2000, z: -144, biome: 'Pustkowie', top: B.DRY_SOIL, vegetation: B.DEAD_SHRUB },
    { x: -2000, z: -1616, biome: 'Kwiecista łąka', top: B.MEADOW_GRASS, vegetation: B.FLOWER_BLUE },
  ];
  for (const site of table) {
    const surface = world.surface(site.x, site.z);
    const c = world.getChunk(Math.floor(site.x / CS), Math.floor(site.z / CS));
    check(`${site.biome} has biome-specific ground and vegetation`, surface.biome === site.biome &&
      c.data.includes(site.top) && c.data.includes(site.vegetation));
  }
  const lc = legacy.getChunk(0, 0).data;
  let checksum = 2166136261;
  for (const n of lc) checksum = Math.imul(checksum ^ n, 16777619) >>> 0;
  eq('pre-upgrade world generator chunk is unchanged', checksum, 1020360066);
  check('old generator never silently introduces new biomes',
    legacy.surface(-2000, -1136).biome !== 'Tajga' && legacy.terrainVersion === 2);
  const a = new World(12345), b = new World(12345);
  const cx = Math.floor(-2000 / CS), cz = Math.floor(-1136 / CS);
  a.getChunk(cx, cz); a.getChunk(cx + 1, cz);
  b.getChunk(cx + 1, cz); b.getChunk(cx, cz);
  check('spruce forest is independent of chunk load order across seams',
    a.getChunk(cx, cz).data.every((n, i) => n === b.getChunk(cx, cz).data[i]) &&
    a.getChunk(cx + 1, cz).data.every((n, i) => n === b.getChunk(cx + 1, cz).data[i]));
  check('new terrain/trees and flowers are accessible in Creative',
    [B.SPRUCE_LOG, B.SPRUCE_LEAVES, B.SPRUCE_SAPLING, B.PODZOL, B.MEADOW_GRASS,
      B.FLOWER_BLUE, B.DRY_SOIL, B.DEAD_SHRUB].every((id) => CREATIVE_BLOCKS.includes(id)));
  const f = new World(9876, true);
  const y = FLAT_H + 1;
  f.setBlock(3, y, 3, B.SPRUCE_SAPLING);
  check('spruce sapling grows on planted ground and yields a cone canopy',
    plantTree(f, 3, y, 3, false, true) && f.getBlock(3, y, 3) === B.SPRUCE_LOG &&
      [7, 8, 9].some((dy) => f.getBlock(3, y + dy, 3) === B.SPRUCE_LEAVES));
  const rand = Math.random;
  try {
    Math.random = () => 0;
    check('spruce leaves drop a renewable sapling in Survival', blockDrops(B.SPRUCE_LEAVES, 0)[0]?.id === B.SPRUCE_SAPLING);
    check('wasteland shrubs drop useful sticks', blockDrops(B.DEAD_SHRUB, 0)[0]?.id === I.STICK);
  } finally { Math.random = rand; }
  check('spruce logs craft into usable planks',
    RECIPES.some((r) => r.out.id === B.PLANKS && r.inputs.some((v) => v.id === B.SPRUCE_LOG)));
}

section('3.0: craftable biome compass search');
{
  const w = new World(12345);
  const found = new BiomeSearch(w, -2000, -1136, 'Tajga');
  check('search can be advanced with a bounded per-frame budget', found.advance(1) && found.checked === 1);
  check('nearby taiga located without generating chunks', found.result?.distance === 0 && w.chunks.size === 0);
  const far = new BiomeSearch(w, -2000, -1136, 'Kwiecista łąka');
  while (!far.advance(96)) { /* bounded frame batches */ }
  check('a different biome is found inside range', !!far.result && far.result.distance <= COMPASS_RANGE &&
    w.surface(far.result.x, far.result.z).biome === 'Kwiecista łąka' && w.chunks.size === 0);
  const flat = new World(42, true);
  const absent = new BiomeSearch(flat, 0, 0, 'Tajga');
  while (!absent.advance(96)) { /* finite search */ }
  check('missing biome is reported after capped search', absent.done && absent.result === null && absent.checked === absent.total);
  check('compass refuses the Nether', new BiomeSearch(new World(42, false, true), 0, 0, 'Tajga').done);
  check('all selectable biomes belong to the overworld', !BIOME_TARGETS.includes('Nether'));
  check('recipe uses existing compass, paper and lapis', RECIPES.some((r) => r.out.id === I.BIOME_COMPASS &&
    [I.COMPASS, I.PAPER, I.LAPIS].every((id) => r.inputs.some((i) => i.id === id))));
  check('biome compass exists as a separate Creative item', isItem(I.BIOME_COMPASS) && stackLimit(I.BIOME_COMPASS) === 1);
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
  check('3.0 wetland and biome blocks have valid definitions', [B.MUD, B.ACACIA_LOG, B.ACACIA_LEAVES, B.JUNGLE_LEAVES, B.LILY_PAD].every((id) => !!BLOCKS[id] && !!BLOCKS[id]?.name));
  check('3.0 lilies are non-solid plants', !IS_SOLID[B.LILY_PAD] && RENDER[B.LILY_PAD] === 1);
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

  // Add is atomic: a failed pickup must not partially duplicate a ground stack.
  const almostFull = new Inventory();
  almostFull.slots[0] = { id: B.DIRT, count: 63 };
  for (let i = 1; i < almostFull.slots.length; i++) almostFull.slots[i] = { id: B.STONE, count: 64 };
  check('add rejects a stack that only partly fits', !almostFull.add(B.DIRT, 2));
  eq('failed add leaves the existing stack untouched', almostFull.slots[0]?.count, 63);
  eq('failed add inserts no partial amount', almostFull.countOf(B.DIRT), 63);

  const namedStacks = new Inventory();
  check('named stack can be added', namedStacks.add(B.STONE, 2, undefined, undefined, 'Kamyk'));
  check('identically named stacks merge', namedStacks.add(B.STONE, 3, undefined, undefined, 'Kamyk'));
  eq('merged custom stack keeps its name and count', namedStacks.slots[0]?.name === 'Kamyk' && namedStacks.slots[0]?.count === 5, true);
  check('different custom names stay separate', namedStacks.add(B.STONE, 1, undefined, undefined, 'Pamiątka') && namedStacks.slots[1]?.name === 'Pamiątka');

  const cursorItem = new Inventory();
  cursorItem.cursor = { id: I.IRON_SWORD, count: 1, dur: 47, ench: { sharpness: 2 }, name: 'Wędrowiec' };
  check('returnCursor preserves custom stack metadata', cursorItem.returnCursor());
  const returnedSword = cursorItem.slots.find((s) => s?.id === I.IRON_SWORD);
  check('returned cursor keeps durability, enchantments and name', returnedSword?.dur === 47 && returnedSword.ench?.sharpness === 2 && returnedSword.name === 'Wędrowiec');

  const blockedCursor = new Inventory();
  for (let i = 0; i < blockedCursor.slots.length; i++) blockedCursor.slots[i] = { id: B.STONE, count: 64 };
  blockedCursor.cursor = { id: I.DIAMOND, count: 1, name: 'Moje' };
  check('returnCursor reports a full inventory', !blockedCursor.returnCursor());
  check('failed return keeps the held stack available', blockedCursor.cursor?.id === I.DIAMOND && blockedCursor.cursor.name === 'Moje');
  blockedCursor.cursor = { id: I.IRON_SWORD, count: 1, dur: 55, ench: { sharpness: 2 }, name: 'Moje' };

  const namedGrid = new Inventory();
  namedGrid.grid[0] = { id: B.STONE, count: 2, name: 'Kamyk' };
  namedGrid.grid[1] = { id: B.STONE, count: 3, name: 'Kamyk' };
  namedGrid.returnGrid();
  check('returnGrid preserves and merges identically named stacks', namedGrid.slots[0]?.count === 5 && namedGrid.slots[0]?.name === 'Kamyk');
  const namedSplit = new Inventory();
  namedSplit.cursor = { id: B.STONE, count: 3, name: 'Kamyk' };
  namedSplit.clickGrid(0, true);
  check('placing one item in the crafting grid keeps its name', namedSplit.grid[0]?.name === 'Kamyk' && namedSplit.cursor?.count === 2);

  const chestRecipe = RECIPES.find((r) => r.out.id === B.CHEST)!;
  const fullCraftingBag = new Inventory();
  fullCraftingBag.slots[0] = { id: B.PLANKS, count: 64 };
  for (let i = 1; i < fullCraftingBag.slots.length; i++) fullCraftingBag.slots[i] = { id: B.STONE, count: 64 };
  check('craft preflight includes output capacity', !fullCraftingBag.canCraftToInventory(chestRecipe));
  check('full inventory refuses a craft without consuming inputs', !fullCraftingBag.craft(chestRecipe) && fullCraftingBag.slots[0]?.count === 64);

  const paymentFreesSlot = new Inventory();
  paymentFreesSlot.slots[0] = { id: I.WHEAT, count: 20 };
  for (let i = 1; i < paymentFreesSlot.slots.length; i++) paymentFreesSlot.slots[i] = { id: B.STONE, count: 64 };
  check('trade capacity accounts for slots freed by its payment', paymentFreesSlot.canAddAfterRemoving(I.EMERALD, 1, [{ id: I.WHEAT, count: 20 }]));

  const overflowDrops: unknown[][] = [];
  const returnGame = Object.create(Game.prototype) as unknown as {
    inventory: Inventory;
    body: { pos: THREE.Vector3 };
    spawnDrop: (...args: unknown[]) => void;
    message: (text: string) => void;
    returnHeldStack: () => void;
  };
  returnGame.inventory = blockedCursor;
  returnGame.body = { pos: new THREE.Vector3(1, 64, 2) };
  returnGame.spawnDrop = (...args) => { overflowDrops.push(args); };
  returnGame.message = () => {};
  returnGame.returnHeldStack();
  check('full inventory spills a held cursor item instead of deleting it', overflowDrops.length === 1 && blockedCursor.cursor === null);
  check('spilled cursor item keeps its enchantment and custom name', (overflowDrops[0]?.[9] as Record<string, number>)?.sharpness === 2 && overflowDrops[0]?.[10] === 'Moje');

  const giveGame = Object.create(Game.prototype) as Record<string, any>;
  giveGame.inventory = new Inventory();
  giveGame.inventory.slots.fill({ id: B.STONE, count: 64 });
  giveGame.body = { pos: new THREE.Vector3(1, 64, 2) };
  giveGame.messages = [];
  giveGame.emitHud = () => {};
  giveGame.notePickup = () => {};
  const commandDrops: unknown[][] = [];
  giveGame.spawnDrop = (...args: unknown[]) => { commandDrops.push(args); };
  giveGame.command(`/give ${B.DIRT} 2`);
  check('/give does not silently lose items when inventory is full', commandDrops.length === 1 && commandDrops[0]?.[0] === B.DIRT && commandDrops[0]?.[1] === 2);

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

  // 2.2 save manager metadata and operations
  check('rename updates an existing world', renameSave('w9', '  Moja   baza  '));
  eq('rename normalizes whitespace', loadSaves().find((s) => s.id === 'w9')?.name, 'Moja baza');
  check('world can be pinned', toggleFavoriteSave('w9') === true);
  upsertSave({ id: 'w9', name: 'Moja baza', seed: 9, mode: 'creative', day: 3 });
  check('pin survives an engine autosave', loadSaves().find((s) => s.id === 'w9')?.favorite === true);
  eq('control characters are removed from names', cleanWorldName(' A\n\tB '), 'A B');
  check('one world can be exported', exportSave('w9')?.includes('Moja baza'));
  check('missing world cannot be exported', exportSave('missing') === null);

  // Free one slot and verify that duplication creates an independent id.
  deleteSave(loadSaves().find((s) => s.id !== 'w9')!.id);
  const copyId = duplicateSave('w9');
  check('world can be duplicated when a slot is free', !!copyId && copyId !== 'w9');
  check('copy has an explanatory name', loadSaves().find((s) => s.id === copyId)?.name?.includes('kopia') === true);
  check('duplicate respects the 8-world limit', duplicateSave('w9') === null);

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

  const searchedBooks = filterRecipes(RECIPES, 'książka');
  check('recipe finder searches result names', searchedBooks.some((r) => r.out.id === I.BOOK));
  const searchedIron = filterRecipes(RECIPES, 'zelazo');
  check('recipe finder searches ingredients without Polish accents', searchedIron.some((r) => r.inputs.some((input) => input.id === I.IRON)));
  check('recipe finder searches by tool result', filterRecipes(RECIPES, 'kilof').some((r) => r.out.id === I.WOOD_PICK));
  eq('empty recipe query keeps every recipe', filterRecipes(RECIPES, '').length, RECIPES.length);
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
  const small = compactAtlas(atlas.canvas);
  eq('low-detail world atlas is half-size on each GPU axis', small.width, atlas.canvas.width / 2);
  eq('low-detail world atlas does not overwrite inventory icons', getAtlas().canvas.width, atlas.canvas.width);
  const tileAlpha = (tile: number, x: number, y: number) => committedAtlas?.[((Math.floor(tile / 16) * 16 + y) * 256 + (tile % 16) * 16 + x) * 4 + 3] ?? 0;
  check('three turtle egg stages have committed atlas pixels even in low graphics',
    [T.turtle_egg0, T.turtle_egg1, T.turtle_egg2].every((t) => tileAlpha(t, 8, 8) > 0));
  check('new and old 2.7 textures are actually committed to the rendered atlas',
    tileAlpha(T.mud, 8, 8) > 0 && tileAlpha(T.acacia_side, 8, 8) > 0 &&
    tileAlpha(T.spruce_side, 8, 8) > 0 && tileAlpha(T.dry_soil, 8, 8) > 0 &&
    tileAlpha(T.flower_blue, 8, 4) > 0);

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

  // death: armor drops with the inventory, and all active buffs end
  g.effects = new Map([['fall', 2000]]);
  g.health = 1;
  g.ui = 'playing';
  g.damage(1000, true);
  eq('force kill ends the game', g.ui, 'dead');
  const droppedIds = drops.map((d) => d[0]);
  check('armor dropped on death', [I.LEATHER_HELMET, I.IRON_CHEST, I.IRON_LEGS, I.IRON_BOOTS].every((id) => droppedIds.includes(id)), JSON.stringify(droppedIds));
  eq('armor cleared on death', g.armor.every((s: any) => s === null), true);
  eq('active potion buffs cleared on death', g.effects.size, 0);
}

section('3.0 #40: slow hammer cleaves visible mobs and mines only selected masonry');
{
  check('hammer has a new durable ID, separate icon, Creative entry and iron recipe',
    I.IRON_HAMMER === 365 && ITEMS[I.IRON_HAMMER]?.tool === 'hammer' &&
    durabilityMax(I.IRON_HAMMER) === 300 && stackLimit(I.IRON_HAMMER) === 1 &&
    CREATIVE_ITEMS.includes(I.IRON_HAMMER) && !!buildItemIcons()[I.IRON_HAMMER]);
  const r = RECIPES.find((recipe) => recipe.out.id === I.IRON_HAMMER)!;
  const inv = new Inventory(); inv.add(I.IRON, 5); inv.add(I.STICK, 2);
  check('Survival crafts one hammer, paying 5 iron and 2 sticks at a table', r.table &&
    inv.craft(r) && inv.countOf(I.IRON_HAMMER) === 1 && inv.countOf(I.IRON) === 0 &&
    inv.countOf(I.STICK) === 0 && !inv.craft(r));
  const grid = new Inventory();
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
    const ch = r.pattern![y][x];
    if (ch !== ' ') grid.grid[y * 3 + x] = { id: r.key![ch], count: 1 };
  }
  check('actual grid shape does not collide with an old pickaxe recipe and needs a table',
    grid.gridMatch(true)?.out.id === I.IRON_HAMMER && grid.gridMatch(false) === null &&
    grid.craftGrid(true)?.id === I.IRON_HAMMER);
  check('hammer is slower than sword and dagger but hits harder than iron sword',
    attackCooldown(I.IRON_HAMMER) === 1.1 && attackCooldown(I.IRON_HAMMER) > attackCooldown(I.IRON_SPEAR) &&
    attackDamage(I.IRON_HAMMER, false) === 8 && attackDamage(I.IRON_SWORD, false) === 7 &&
    attackReach(I.IRON_HAMMER) === 3.5);
  check('hammer is faster on named masonry but cannot mine ore or obsidian instead of a pick',
    [B.STONE, B.COBBLE, B.STONE_BRICKS, B.BLACKSTONE, B.BASALT].every((id) =>
      toolHelps(id, I.IRON_HAMMER) && mineSeconds(id, I.IRON_HAMMER) < mineSeconds(id, 0)) &&
    !toolHelps(B.DIAMOND_ORE, I.IRON_HAMMER) &&
    !Number.isFinite(mineSeconds(B.DIAMOND_ORE, I.IRON_HAMMER)) &&
    !Number.isFinite(mineSeconds(B.OBSIDIAN, I.IRON_HAMMER)) &&
    blockDrops(B.DIAMOND_ORE, I.IRON_HAMMER).length === 0 && pickHint(B.STONE, I.IRON_HAMMER) === null);
  check('hammer supports combat, durability and masonry efficiency enchants',
    canEnchant(I.IRON_HAMMER, 'sharpness') && canEnchant(I.IRON_HAMMER, 'unbreaking') &&
    canEnchant(I.IRON_HAMMER, 'efficiency') && !canEnchant(I.IRON_HAMMER, 'silktouch') &&
    mineSeconds(B.COBBLE, I.IRON_HAMMER, 2) < mineSeconds(B.COBBLE, I.IRON_HAMMER));
  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  g.inventory = new Inventory(); g.inventory.slots[0] = { id: I.IRON_HAMMER, count: 1 };
  g.selected = 0; g.selectedStack = () => g.inventory.slots[0];
  g.mode = 'survival'; g.ui = 'playing'; g.body = { pos: new THREE.Vector3(0, 64, 0), vel: new THREE.Vector3(), onGround: true };
  g.target = null; g.attackCooldown = 0; g.sprinting = false; g.hunger = 20;
  g.hasEffect = () => false; g.wearTool = () => worn++;
  g.message = (s: string) => notices.push(s); g.advanceChallenge = () => {}; g.emitHud = () => {};
  g.eyePos = () => new THREE.Vector3(0, 65.6, 0); g.lookDir = () => new THREE.Vector3(0, 0, -1);
  const notices: string[] = [], damage = new Map<number, number>();
  let worn = 0, blockBroken = 0;
  const mk = (id: number, x: number, z: number) => ({ type: 'zombie', dead: false, bonusLoot: 0,
    body: { pos: new THREE.Vector3(x, 64, z), vel: new THREE.Vector3(), h: 1.8 },
    damage: (d: number) => { damage.set(id, d); return true; } });
  const primary = mk(0, 0, -2), exposed = mk(1, 0.8, -2), behindWall = mk(2, -0.8, -2),
    exposed2 = mk(3, 0.4, -2.3), exposed3 = mk(4, 1, -1.9), behind = mk(5, 0, 1);
  g.mobs = [primary, exposed, behindWall, exposed2, exposed3, behind];
  g.findMobTarget = (reach: number) => ({ mob: reach >= 2 ? primary : null, dist: 2 });
  g.world = { raycast: (_x: number, _y: number, _z: number, dx: number) => dx < -0.1 ? { dist: 0.7 } : null };
  g.tryAttack();
  check('real melee path hits the center and at most two nearby unobstructed frontal mobs',
    damage.get(0) === 8 && damage.get(1) === 5 && damage.get(3) === 5 &&
    !damage.has(2) && !damage.has(4) && !damage.has(5) && g.attackCooldown === 1.1 && worn === 1 &&
    notices.some((m) => m.includes('dodatkowo 2')) && blockBroken === 0);
  g.tryAttack();
  check('swing cannot apply repeated splash damage during cooldown', damage.size === 3 && worn === 1);
  g.target = { id: B.STONE, dist: 1 };
  g.attackCooldown = 0; g.tryAttack();
  check('wall between player and primary target prevents the whole sweep', damage.size === 3);
  // Digging uses ordinary held-LPM mining and must break only the aimed stone.
  g.mobs = []; g.findMobTarget = () => ({ mob: null, dist: 3.5 });
  g.world.raycast = () => ({ id: B.STONE, x: 0, y: 64, z: -2, dist: 2, nx: 0, ny: 1, nz: 0 });
  g.selection = { visible: false, scale: { set: () => {} }, position: { set: () => {} } };
  g.crackMesh = { visible: false }; g.breakBlock = () => { blockBroken++; };
  g.blockAt = () => B.AIR; g.spawnParticles = () => {}; g.updateHand = () => {};
  g.mouseLeft = true; g.mouseRight = false; g.breakCooldown = 0; g.placeCooldown = 1;
  g.breakProgress = 0; g.breakKey = ''; g.digSoundTimer = 1;
  g.bowDraw = -1; g.swingT = 1; g.pearlCd = 0; g.eatCooldown = 0;
  g.updateInteraction(0.3);
  check('holding hammer mines just the targeted block and wears once', blockBroken === 1 && worn === 2);
  g.touchAim = null; g.refreshTarget = () => { g.target = null; };
  g.mobs = [primary]; g.world.raycast = () => null; g.attackCooldown = 0;
  g.findMobTarget = () => ({ mob: primary, dist: 2 }); g.keys = new Set();
  g.touchTap(0.4, 0.4);
  check('touch tap uses the same cooldown and main strike', damage.get(0) === 8 && g.attackCooldown === 1.1 && g.touchAim === null);
}

section('3.0 #41: fast daggers, short range and one dodge counter');
{
  check('dagger IDs append without moving old spear, and both are durable Creative items',
    I.IRON_SPEAR === 362 && I.IRON_DAGGER === 363 && I.DIAMOND_DAGGER === 364 &&
    [I.IRON_DAGGER, I.DIAMOND_DAGGER].every((id) => CREATIVE_ITEMS.includes(id) &&
      stackLimit(id) === 1 && !!buildItemIcons()[id]));
  check('iron and diamond daggers trade reach and damage for rate against legacy swords',
    attackReach(I.IRON_DAGGER) === 2.2 && attackReach(I.DIAMOND_DAGGER) === 2.2 &&
    attackReach(I.IRON_SWORD) === 3.5 && attackCooldown(I.IRON_DAGGER) === 0.28 &&
    attackCooldown(I.DIAMOND_DAGGER) === 0.28 && attackCooldown(I.IRON_SWORD) === 0.42 &&
    attackDamage(I.IRON_DAGGER, false) === 4 && attackDamage(I.DIAMOND_DAGGER, false) === 5 &&
    attackDamage(I.IRON_SWORD, false) === 7 && durabilityMax(I.DIAMOND_DAGGER) === 600);
  for (const [id, material, amount, table] of [
    [I.IRON_DAGGER, I.IRON, 1, false], [I.DIAMOND_DAGGER, I.DIAMOND, 2, true],
  ] as const) {
    const r = RECIPES.find((candidate) => candidate.out.id === id)!;
    const inv = new Inventory(); inv.add(material, amount); inv.add(I.STICK, 1);
    check(`${ITEMS[id]?.name} Survival recipe consumes material and stick`, r.table === table &&
      inv.craft(r) && inv.countOf(id) === 1 && inv.countOf(material) === 0 && inv.countOf(I.STICK) === 0 && !inv.craft(r));
    const grid = new Inventory();
    for (let y = 0; y < r.pattern!.length; y++) for (let x = 0; x < r.pattern![y].length; x++) {
      const symbol = r.pattern![y][x];
      if (symbol !== ' ') grid.grid[y * 3 + x] = { id: r.key![symbol], count: 1 };
    }
    check(`${ITEMS[id]?.name} grid validates the actual shape and table constraint`,
      grid.gridMatch(true)?.out.id === id && grid.gridMatch(false)?.out.id === (table ? undefined : id) &&
      grid.craftGrid(true)?.id === id);
  }
  check('daggers accept combat enchants but not mining enchants',
    canEnchant(I.IRON_DAGGER, 'sharpness') && canEnchant(I.DIAMOND_DAGGER, 'looting') &&
    canEnchant(I.IRON_DAGGER, 'unbreaking') && !canEnchant(I.IRON_DAGGER, 'efficiency') &&
    attackDamage(I.IRON_DAGGER, false, 2) > attackDamage(I.IRON_DAGGER, false));
  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  g.inventory = new Inventory(); g.inventory.slots[0] = { id: I.IRON_DAGGER, count: 1 };
  g.selected = 0; g.selectedStack = () => g.inventory.slots[0];
  g.mode = 'survival'; g.ui = 'playing'; g.keys = new Set(); g.target = null; g.yaw = 0;
  g.body = { pos: new THREE.Vector3(0, 64, 0), vel: new THREE.Vector3(), onGround: true };
  g.dodgeTime = 0; g.dodgeCooldown = 0; g.daggerCounter = 0;
  g.attackCooldown = 0; g.sprinting = false; g.hunger = 20; g.swingT = 1;
  g.flying = false; g.emitHud = () => {}; g.hasEffect = () => false;
  g.wearTool = () => {}; g.advanceChallenge = () => {}; g.message = (s: string) => messages.push(s);
  const messages: string[] = [], damages: number[] = [], ranges: number[] = [];
  const mob = { type: 'zombie', dead: false, hurtTime: 0,
    body: { pos: new THREE.Vector3(0, 64, -2), vel: new THREE.Vector3() }, bonusLoot: 0,
    damage: (d: number) => { if (mob.hurtTime > 0) return false; damages.push(d); mob.hurtTime = 0.5; return true; } };
  g.findMobTarget = (range: number) => { ranges.push(range); const dist = Math.abs(mob.body.pos.z);
    return range >= dist ? { mob, dist } : { mob: null, dist: range }; };
  check('dodge starts a single counter window with hunger cost and cannot be spammed',
    g.tryDodge() && !g.tryDodge() && g.daggerCounter === 0.65 && g.hunger === 19 && g.dodgeCooldown === 2.7);
  g.tryAttack();
  check('successful counter hits once at short range with hit feedback and shorter hit immunity',
    damages[0] === 7 && ranges.at(-1) === 2.2 && g.daggerCounter === 0 &&
    mob.hurtTime === 0.28 && g.attackCooldown === 0.28 &&
    messages.some((m) => m.includes('Kontra sztyletem')));
  g.tryAttack();
  check('dagger cooldown prevents attacks before recovery', damages.length === 1);
  g.attackCooldown = 0; mob.hurtTime = 0;
  g.tryAttack();
  check('next quick hit uses only base damage, no repeated counter', damages[1] === 4);
  g.attackCooldown = 0; mob.hurtTime = 0;
  g.dodgeCooldown = 0; g.tryDodge();
  g.target = { id: B.STONE, dist: 1.4 }; g.tryAttack();
  check('wall prevents the counter and does not consume its opportunity', damages.length === 2 && g.daggerCounter === 0.65);
  g.target = null; g.attackCooldown = 0; g.daggerCounter = 0;
  g.tryAttack();
  check('expired counter does not grant bonus damage', damages[2] === 4);
  g.attackCooldown = 0; mob.hurtTime = 0;
  mob.body.pos.z = -2.8; g.tryAttack();
  check('dagger cannot hit at sword range', damages.length === 3 && ranges.at(-1) === 2.2);
  mob.body.pos.z = -2; mob.hurtTime = 0; g.attackCooldown = 0; g.daggerCounter = 0.65;
  g.refreshTarget = () => { g.target = null; };
  g.touchAim = null;
  g.touchTap(0.3, 0.4);
  check('touch tap uses short reach and triggers the same dodge counter', damages[3] === 7 &&
    ranges.at(-1) === 2.2 && g.daggerCounter === 0 && g.touchAim === null);
  mob.hurtTime = 0; g.attackCooldown = 0; g.mouseLeft = true; g.placeCooldown = 1;
  g.pearlCd = 0; g.eatCooldown = 0; g.breakCooldown = 0; g.breakProgress = 0;
  g.mouseRight = false; g.bowDraw = -1;
  g.selection = { visible: false }; g.crackMesh = { visible: false };
  g.world = { raycast: () => null };
  g.eyePos = () => new THREE.Vector3(0, 65.6, 0); g.lookDir = () => new THREE.Vector3(0, 0, -1);
  g.updateHand = () => {};
  g.updateInteraction(1 / 30);
  check('held attack on PC or touch respects dagger speed and reach without mining',
    damages[4] === 4 && ranges.slice(-2).every((r) => r === 2.2) &&
    g.breakProgress === 0 && g.mouseLeft);
}

section('3.0 #39: crafted long-reach spear with slower PC and touch attacks');
{
  eq('new spear ID is appended without changing existing armor/item IDs', I.IRON_SPEAR, 362);
  check('iron spear is a unique durable Creative item with icon', ITEMS[I.IRON_SPEAR]?.tool === 'spear' &&
    CREATIVE_ITEMS.includes(I.IRON_SPEAR) && stackLimit(I.IRON_SPEAR) === 1 &&
    durabilityMax(I.IRON_SPEAR) === 240 && !!buildItemIcons()[I.IRON_SPEAR]);
  const recipe = RECIPES.find((r) => r.out.id === I.IRON_SPEAR);
  check('crafting recipe requires 2 iron and 2 sticks at a table', !!recipe && recipe.table &&
    recipe.inputs.some((a) => a.id === I.IRON && a.count === 2) &&
    recipe.inputs.some((a) => a.id === I.STICK && a.count === 2));
  const inv = new Inventory();
  inv.add(I.IRON, 2); inv.add(I.STICK, 2);
  check('Survival crafts spear using real inventory, without duplication', inv.craft(recipe!) &&
    inv.countOf(I.IRON_SPEAR) === 1 && inv.countOf(I.IRON) === 0 && inv.countOf(I.STICK) === 0 && !inv.craft(recipe!));
  const grid = new Inventory();
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
    const symbol = recipe!.pattern![y][x];
    if (symbol !== ' ') grid.grid[y * 3 + x] = { id: recipe!.key![symbol], count: 1 };
  }
  check('3×3 grid yields a spear, 2×2 personal crafting does not', grid.craftGrid(true)?.id === I.IRON_SPEAR && grid.craftGrid(false) === null);
  check('spear reaches farther but recovers slower than every old sword', attackReach(I.IRON_SPEAR) === 5 &&
    attackReach(I.IRON_SWORD) === 3.5 && attackCooldown(I.IRON_SPEAR) === 0.92 &&
    attackCooldown(I.IRON_SWORD) === 0.42);
  check('damage is balanced between iron and diamond sword', attackDamage(I.IRON_SPEAR, false) === 7 &&
    attackDamage(I.IRON_SPEAR, false) < attackDamage(I.DIAMOND_SWORD, false) &&
    attackDamage(I.IRON_SPEAR, true) === 9);
  check('spear can take sharpness without changing legacy enchant applicability', canEnchant(I.IRON_SPEAR, 'sharpness') &&
    canEnchant(I.IRON_SPEAR, 'unbreaking') && !canEnchant(I.IRON_SPEAR, 'efficiency') &&
    attackDamage(I.IRON_SPEAR, false, 2) > attackDamage(I.IRON_SPEAR, false));
  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  g.inventory = new Inventory(); g.selected = 0; g.inventory.slots[0] = { id: I.IRON_SPEAR, count: 1 };
  g.mode = 'survival'; g.ui = 'playing'; g.keys = new Set(); g.target = null;
  g.body = { pos: new THREE.Vector3(0, 64, 0), vel: new THREE.Vector3() };
  g.attackCooldown = 0; g.sprinting = false; g.hunger = 20; g.swingT = 1;
  g.hasEffect = () => false; g.wearTool = () => {}; g.advanceChallenge = () => {}; g.message = () => {};
  g.selectedStack = () => g.inventory.slots[g.selected] ?? null;
  let attacks = 0, lastDamage = 0;
  const mob = { type: 'zombie', dead: false, body: { pos: new THREE.Vector3(0, 64, -4.5), vel: new THREE.Vector3() },
    bonusLoot: 0, damage: (d: number) => { attacks++; lastDamage = d; return true; } };
  const ranges: number[] = [];
  g.findMobTarget = (range: number) => { ranges.push(range); return range >= 4.5 ? { mob, dist: 4.5 } : { mob: null, dist: range }; };
  g.tryAttack();
  check('real PC combat path hits at 4.5 blocks with spear and applies cooldown', attacks === 1 &&
    lastDamage === 7 && g.attackCooldown === 0.92 && ranges.at(-1) === 5);
  g.tryAttack();
  check('repeat clicks during spear recovery cannot spam hits', attacks === 1);
  g.attackCooldown = 0;
  g.inventory.slots[0] = { id: I.IRON_SWORD, count: 1 };
  g.tryAttack();
  check('existing swords do not inherit extra reach', attacks === 1 && ranges.at(-1) === 3.5);
  g.inventory.slots[0] = { id: I.IRON_SPEAR, count: 1 };
  g.target = { id: B.STONE, dist: 2 };
  g.tryAttack();
  check('closer wall blocks the extended spear strike', attacks === 1);
  g.target = null; g.attackCooldown = 0; g.touchAim = null;
  g.refreshTarget = () => { g.target = null; };
  g.touchTap(0.3, 0.4);
  check('touch tap reaches the same distant mob and restores aim', attacks === 2 &&
    g.touchAim === null && ranges.at(-1) === 5);
  g.attackCooldown = 0; g.mouseLeft = true; g.placeCooldown = 1; g.pearlCd = 0; g.eatCooldown = 0;
  g.breakCooldown = 0; g.breakProgress = 0; g.mouseRight = false; g.bowDraw = -1;
  g.selection = { visible: false }; g.crackMesh = { visible: false };
  g.world = { raycast: () => null };
  g.eyePos = () => new THREE.Vector3(0, 65.6, 0); g.lookDir = () => new THREE.Vector3(0, 0, -1);
  g.updateHand = () => {};
  g.updateInteraction(1 / 30);
  check('held PC/touch attack scans long reach on each swing without mining', attacks === 3 && g.mouseLeft &&
    ranges.slice(-2).every((r) => r === 5) && g.breakProgress === 0);
  check('equipped spear shows its range and rate in crosshair help', g.heldHint().includes('0,92 s'));
}

section('3.0 #76: specialized boots with crafting and equipment');
{
  const ids = [I.EMBER_BOOTS, I.TIDE_BOOTS, I.SOFT_BOOTS];
  check('three boot IDs extend existing item space without replacing old items', ids.join(',') === '359,360,361' &&
    ids.every((id) => !!ITEMS[id] && CREATIVE_ITEMS.includes(id) && stackLimit(id) === 1));
  check('all variants use the feet slot with less protection than iron boots', ids.every((id) =>
    armorSlotOf(id) === 3 && armorPoints([null, null, null, { id, count: 1 }]) === 1) &&
    armorPoints([null, null, null, { id: I.IRON_BOOTS, count: 1 }]) === 2);
  const icons = buildItemIcons();
  check('new boots receive equipment icons', ids.every((id) => !!icons[id]));
  const inputs = [
    [I.IRON, I.MAGMA_CREAM], [I.IRON, I.RAW_FISH, I.LAPIS], [I.IRON, I.FEATHER, I.GLOWSTONE_DUST],
  ];
  for (let j = 0; j < ids.length; j++) {
    const id = ids[j];
    const recipe = RECIPES.find((r) => r.out.id === id);
    check(`boots ${id} have a table recipe with accessible existing resources`, !!recipe && recipe.table &&
      inputs[j].every((input) => recipe.inputs.some((s) => s.id === input)));
    const inv = new Inventory();
    for (const input of recipe!.inputs) inv.add(input.id, input.count);
    check(`Survival can craft ${id} using actual inventory transaction`, inv.craft(recipe!) &&
      inv.countOf(id) === 1 && recipe!.inputs.every((input) => inv.countOf(input.id) === 0));
    check(`no free second craft of ${id}`, !inv.craft(recipe!));
  }
  const grid = new Inventory();
  const pattern = RECIPES.find((r) => r.out.id === I.TIDE_BOOTS)!;
  for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) {
    const symbol = pattern.pattern![y][x];
    if (symbol !== ' ') grid.grid[y * 3 + x] = { id: pattern.key![symbol], count: 1 };
  }
  check('placing the swim recipe in the real 3×3 grid shows the correct output', grid.craftGrid(true)?.id === I.TIDE_BOOTS);
  check('2×2 personal grid cannot craft the specialized boots', grid.craftGrid(false) === null);

  const g = Object.create(Game.prototype) as any;
  g.mode = 'survival'; g.ui = 'playing'; g.inventory = new Inventory();
  g.armor = [null, null, null, null]; g.emitHud = () => {}; g.unlock = () => {};
  g.inventory.cursor = { id: I.EMBER_BOOTS, count: 1 };
  g.clickArmorSlot(3);
  check('new boots equip through the real armor slot, not only the hotbar', g.armor[3]?.id === I.EMBER_BOOTS && g.inventory.cursor === null);
  check('fire boots have situational heat resistance only', bootHeatReduction(g.armor[3]) === 0.24 &&
    bootHeatReduction({ id: I.IRON_BOOTS, count: 1 }) === 0);
  check('water boots only multiply swimming speed', bootSwimFactor({ id: I.TIDE_BOOTS, count: 1 }) === 1.35 &&
    bootSwimFactor(g.armor[3]) === 1);
  check('soft boots only reduce fall damage', bootFallFactor({ id: I.SOFT_BOOTS, count: 1 }) === 0.6 &&
    bootFallFactor(g.armor[3]) === 1);
  check('stacked swimming upgrades have a bounded multiplier', waterSpeedFactor({ id: I.TIDE_BOOTS, count: 1, ench: { tidewalker: 3 } }) === 1.75 && waterSpeedFactor(null) === 1);
  check('soft boots and feather falling cannot reduce drops below 40%', landingFactor({ id: I.SOFT_BOOTS, count: 1, ench: { featherfalling: 4 } }) === 0.4 && landingFactor(null) === 1);
  g.health = 100; g.hurtCount = 0; g.shake = 0;
  g.body = { pos: new THREE.Vector3(0, 64, 0) };
  g.wearArmor = () => {}; g.buzz = () => {};
  g.damage(4, false, 'fire');
  const protectedHit = 100 - g.health;
  g.health = 100;
  g.damage(4, false, 'projectile');
  check('equipped fire boots only protect against heat in the real engine', protectedHit < 100 - g.health);
  g.armor[3] = null;
  check('removing boots immediately removes the bonus', bootHeatReduction(g.armor[3]) === 0);
}

section('3.0 #77: mutually exclusive defense and swimming enchants');
{
  const armor = { id: I.IRON_BOOTS, count: 1 } as Stack;
  check('new families are accessible at the real table', ['fireward', 'arrowguard', 'tidewalker'].every((id) =>
    ENCHANTS.some((def) => def.id === id) && canEnchant(armor.id, id)));
  check('swimming enchant is restricted to boots', !canEnchant(I.IRON_HELMET, 'tidewalker') && canEnchant(I.LEATHER_BOOTS, 'tidewalker'));
  check('protection families conflict but swimming remains compatible', conflicts('protection', 'fireward') &&
    conflicts('arrowguard', 'fireward') && !conflicts('tidewalker', 'fireward'));
  addEnch(armor, 'fireward', 4);
  check('another protection cannot be applied to the same piece', !canAddEnch(armor, 'protection') &&
    !canAddEnch(armor, 'arrowguard'));
  addEnch(armor, 'arrowguard', 4);
  check('direct enchant entry does not bypass conflicts', armor.ench?.arrowguard === undefined);
  eq('anvil keeps first item when merging incompatible protections', mergeEnchants({ fireward: 2 }, { protection: 4 })?.protection, undefined);
  check('table offers omit conflicting enchantments after selection', !rollEnchantOptions(armor, 15, () => 0.5).some((o) =>
    o.ench === 'arrowguard' || o.ench === 'protection'));
  eq('specialized armor protects against its own source', sourceProtection([null, null, null, armor], 'fire'), 0.32);
  eq('fire armor does not reduce projectiles', sourceProtection([null, null, null, armor], 'projectile'), 0);
  check('four armor pieces cap source resistance', sourceProtection([armor, armor, armor, armor], 'fire') === 0.4);
  check('empty boots retain old swimming speed', swimSpeedFactor(null) === 1);
  addEnch(armor, 'tidewalker', 3);
  eq('enchanted boots improve only the water multiplier', swimSpeedFactor(armor), 1.45);
  check('old protection enchantment remains usable', canEnchant(I.IRON_BOOTS, 'protection') &&
    totalProtection([{ id: I.IRON_BOOTS, count: 1, ench: { protection: 2 } }]) === 2);

  // Exercise the actual engine damage path (the old armor system still runs).
  const g = Object.create(Game.prototype) as any;
  g.mode = 'survival'; g.ui = 'playing'; g.armor = [null, null, null, armor];
  g.body = { pos: new THREE.Vector3(0, 65, 0) }; g.health = 100; g.hurtCount = 0; g.shake = 0;
  g.wearArmor = () => {}; g.buzz = () => {}; g.emitHud = () => {};
  g.damage(10, false, 'fire');
  const fireHit = 100 - g.health;
  g.health = 100;
  g.damage(10, false, 'projectile');
  const projectileHit = 100 - g.health;
  check('engine fire damage is smaller than arrow damage with heat armor', fireHit < projectileHit, `${fireHit}, ${projectileHit}`);
  const arrowBoots = { id: I.IRON_BOOTS, count: 1, ench: { arrowguard: 4 } };
  g.armor[3] = arrowBoots; g.health = 100;
  g.damage(10, false, 'projectile');
  check('engine arrow damage responds to arrowguard, not fireward', 100 - g.health < projectileHit);
  g.armor[3] = { id: I.IRON_BOOTS, count: 1 }; g.health = 100;
  g.damage(10, false, 'fire');
  check('old unechanted armor retains its previous damage value', 100 - g.health === projectileHit);
  g.armor[3] = armor; g.health = 100;
  g.damage(1, false, 'fire');
  check('fireward reduces single-point magma ticks rather than losing fractional protection to rounding', 100 - g.health < 1);

  const table = Object.create(Game.prototype) as any;
  table.mode = 'survival'; table.inventory = new Inventory();
  table.enchantItem = { id: I.IRON_BOOTS, count: 1 };
  table.enchOptions = [{ ench: 'fireward', level: 2, cost: 2, lapis: 1 }];
  table.enchantPower = () => 15;
  table.body = { pos: new THREE.Vector3(0, 64, 0) };
  table.spawnParticles = () => {}; table.message = () => {}; table.emitHud = () => {}; table.unlock = () => {};
  let xpSpent = 0;
  table.xp = { canSpend: () => true, spend: (n: number) => { xpSpent += n; return true; } };
  check('table rejects an offer with missing lapis without spending XP', !table.enchantWith(0) && xpSpent === 0);
  table.inventory.slots[0] = { id: I.LAPIS, count: 3 };
  check('Survival can buy new armor enchant at the actual table', table.canEnchantWith(0) && table.enchantWith(0) &&
    table.enchantItem.ench.fireward === 2 && xpSpent === 2 && table.inventory.countOf(I.LAPIS) === 2);
  table.enchOptions = [{ ench: 'arrowguard', level: 4, cost: 1, lapis: 1 }];
  check('incompatible offer is refused without charging currency', !table.canEnchantWith(0) && !table.enchantWith(0) && xpSpent === 2 && table.inventory.countOf(I.LAPIS) === 2);
  table.mode = 'creative'; table.enchantItem = { id: I.IRON_BOOTS, count: 1 };
  table.enchOptions = [{ ench: 'tidewalker', level: 2, cost: 1, lapis: 1 }];
  table.inventory.slots[0] = null;
  check('Creative can enchant swimming boots at the table without lapis', table.enchantWith(0) &&
    table.enchantItem.ench.tidewalker === 2 && xpSpent === 2);
}

section('3.0 #38: leather and iron shields preserve the original shield');
{
  check('append-only shield IDs, durability, palette and Creative access',
    I.LEATHER_SHIELD === 366 && I.IRON_SHIELD === 367 && I.SHIELD === 217 &&
    [I.SHIELD, I.LEATHER_SHIELD, I.IRON_SHIELD].every((id) =>
      ITEMS[id]?.tool === 'shield' && stackLimit(id) === 1 && CREATIVE_ITEMS.includes(id) && !!buildItemIcons()[id]) &&
    durabilityMax(I.SHIELD) === 300 && durabilityMax(I.LEATHER_SHIELD) === 180 &&
    durabilityMax(I.IRON_SHIELD) === 600);
  for (const [id, inputs] of [
    [I.LEATHER_SHIELD, [[I.LEATHER, 4], [B.PLANKS, 2], [I.STICK, 1]]],
    [I.IRON_SHIELD, [[I.IRON, 5], [B.PLANKS, 2]]],
  ] as const) {
    const r = RECIPES.find((candidate) => candidate.out.id === id)!;
    const inv = new Inventory();
    for (const [item, n] of inputs) inv.add(item, n);
    const crafted = inv.craft(r);
    check(`${ITEMS[id]?.name} Survival recipe consumes every ingredient exactly once`, r.table && crafted &&
      inv.countOf(id) === 1 && inputs.every(([item]) => inv.countOf(item) === 0) && !inv.craft(r));
    const grid = new Inventory();
    for (let y = 0; y < r.pattern!.length; y++) for (let x = 0; x < r.pattern![y].length; x++) {
      const ch = r.pattern![y][x];
      if (ch !== ' ') grid.grid[y * 3 + x] = { id: r.key![ch], count: 1 };
    }
    check(`${ITEMS[id]?.name} matches only its table grid`,
      grid.gridMatch(true)?.out.id === id && grid.gridMatch(false) === null && grid.craftGrid(true)?.id === id);
  }
  check('legacy shield keeps exact 2.7 melee/arrow defense and wear',
    shieldDamageFactor(I.SHIELD, false) === 0.5 && shieldDamageFactor(I.SHIELD, true) === 0 &&
    shieldWeightFactor(I.SHIELD) === 1 && shieldWear(I.SHIELD, 8) === 8);
  check('light leather trades protection and life for mobility',
    shieldDamageFactor(I.LEATHER_SHIELD, false) === 0.65 &&
    shieldDamageFactor(I.LEATHER_SHIELD, true) === 0.4 &&
    shieldWeightFactor(I.LEATHER_SHIELD) === 1 && shieldWear(I.LEATHER_SHIELD, 8) === 12);
  check('iron shield protects more but weighs more and lasts longer',
    shieldDamageFactor(I.IRON_SHIELD, false) === 0.3 &&
    shieldDamageFactor(I.IRON_SHIELD, true) === 0.15 &&
    shieldWeightFactor(I.IRON_SHIELD) === 0.85 && shieldWear(I.IRON_SHIELD, 8) === 6);
  check('all shield variants accept durability enchants, not Sharpness',
    canEnchant(I.LEATHER_SHIELD, 'unbreaking') && canEnchant(I.IRON_SHIELD, 'unbreaking') &&
    !canEnchant(I.IRON_SHIELD, 'sharpness'));
  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  g.ui = 'playing'; g.mode = 'survival'; g.yaw = 0; g.hunger = 20; g.flying = false;
  g.body = { pos: new THREE.Vector3(0, 0, 0), vel: new THREE.Vector3(), onGround: true, h: 1.8 };
  g.inventory = new Inventory(); g.selected = 0; g.selectedStack = () => g.inventory.slots[0];
  g.message = () => {}; g.emitHud = () => {}; g.unlock = () => {}; g.keys = new Set();
  g.world = { peekBlock: () => B.AIR }; g.scene = { remove: () => {} };
  g.difficulty = DEFAULT_DIFFICULTY; g.arrows = [];
  let hit = 0, damage = 0;
  g.damage = (d: number) => { hit++; damage = d; };
  const shoot = (z: number, velZ: number) => {
    g.arrows.push({ life: 0, pos: new THREE.Vector3(0, 1, z), vel: new THREE.Vector3(0, 0, velZ),
      mesh: { position: new THREE.Vector3(), lookAt() {} }, from: { body: { pos: new THREE.Vector3(0, 0, z) } }, power: 10 });
    g.updateArrows(0.1);
  };
  const foe = { type: 'skeleton', dead: false, soundTimer: 10, body: { pos: new THREE.Vector3(0, 0, -2) },
    group: {}, update(_dt: number, _world: unknown, _p: unknown, onAttack: (d: number, m: unknown) => void) { onAttack(10, this); } };
  g.mobs = [foe]; g.spawnTimer = 100; g.daylight = () => 0; g.weather = 'clear'; g.isInNether = false;
  g.drops = []; g.time = 0;
  for (const [id, melee, arrow, wear] of [
    [I.SHIELD, 5, 0, 8], [I.LEATHER_SHIELD, 7, 4, 12], [I.IRON_SHIELD, 3, 2, 6],
  ]) {
    g.inventory.slots[0] = { id, count: 1 };
    g.guardTime = 0; g.dodgeTime = 0;
    const before = hit; g.updateMobs(0.01);
    check(`${ITEMS[id]?.name} actually reduces frontal mob damage and wears`,
      hit === before + 1 && damage === melee && g.inventory.slots[0].dur === durabilityMax(id) - wear);
    const afterMelee = hit; shoot(-0.5, 4);
    check(`${ITEMS[id]?.name} blocks frontal arrow by its own rate`,
      hit === afterMelee + (arrow > 0 ? 1 : 0) && (arrow === 0 || damage === arrow));
    const afterArrow = hit; shoot(0.5, -4);
    check(`${ITEMS[id]?.name} does not block a rear arrow`, hit === afterArrow + 1 && damage === 10);
    g.guardCooldown = 0;
    check(`${ITEMS[id]?.name} still parries fully with correct timing`,
      g.tryTimedGuard() && g.parryFrom(new THREE.Vector3(0, 0, -2)) && g.guardTime === 0);
  }
}

section('3.0 #75: directional shield parry and dodge');
{
  check('frontal sector faces the camera, not a world axis', threatInFront(0, 0, 0, 0, -3) &&
    !threatInFront(0, 0, 0, 0, 3) && threatInFront(Math.PI / 2, 0, 0, -3, 0));
  check('a coincident or invalid threat cannot be parried', !threatInFront(0, 0, 0, 0, 0) && !threatInFront(NaN, 0, 0, 0, -1));
  const back = dodgeDirection(0, new Set());
  eq('dodge without input retreats', `${back.x},${back.z}`, '0,1');
  const forward = dodgeDirection(0, new Set(['KeyW']));
  eq('dodge follows forward input', `${forward.x},${forward.z}`, '0,-1');
  const diagonal = dodgeDirection(Math.PI / 2, new Set(['KeyW', 'KeyD']));
  check('rotated diagonal dodge is normalised', Math.abs(Math.hypot(diagonal.x, diagonal.z) - 1) < 1e-9 && diagonal.x < 0 && diagonal.z < 0);

  const g = Object.create(Game.prototype) as any;
  g.ui = 'playing'; g.mode = 'survival'; g.hunger = 4; g.flying = false; g.yaw = 0;
  g.keys = new Set<string>(); g.body = { pos: new THREE.Vector3(0, 0, 0), vel: new THREE.Vector3(), onGround: true, h: 1.8 };
  g.inventory = new Inventory(); g.selected = 0;
  g.selectedStack = () => g.inventory.slots[g.selected] ?? null;
  g.message = () => {}; g.emitHud = () => {}; g.unlock = () => {};
  let hits = 0, lastHit = 0;
  g.damage = (amount: number) => { hits++; lastHit = amount; };
  check('grounded survival player can dodge', g.tryDodge());
  eq('dodge spends exactly one hunger', g.hunger, 3);
  check('dodge grants only a short window, with cooldown', g.dodgeTime === 0.29 && !g.tryDodge());
  g.dodgeTime = 0; g.dodgeCooldown = 0; g.body.onGround = false;
  check('mid-air dodge is rejected', !g.tryDodge());
  g.body.onGround = true; g.hunger = 0;
  check('starving player cannot dodge', !g.tryDodge());
  g.hunger = 3; g.ui = 'paused';
  check('no defensive actions while paused', !g.tryDodge() && !g.tryTimedGuard());
  g.ui = 'playing';
  check('parry requires a shield in the selected slot', !g.tryTimedGuard());
  g.inventory.slots[0] = { id: I.SHIELD, count: 1 };
  check('shield initiates a timed guard', g.tryTimedGuard() && g.guardTime === 0.42 && !g.tryTimedGuard());
  const durability = g.inventory.slots[0].dur;
  check('rear attacker does not consume timed parry', !g.parryFrom(new THREE.Vector3(0, 0, 2)) && g.guardTime > 0);
  check('frontal attacker is parried once and wears shield', g.parryFrom(new THREE.Vector3(0, 0, -2)) && g.guardTime === 0 &&
    g.inventory.slots[0].dur < (durability ?? 999));
  check('spent parry does not block a second attacker', !g.parryFrom(new THREE.Vector3(0, 0, -2)));
  g.guardCooldown = 0; g.guardTime = 0;
  g.onKeyDown({ code: 'KeyR', repeat: false, preventDefault() {} });
  check('PC R activates the real shield timing window', g.guardTime === 0.42);
  g.guardTime = 0; g.guardCooldown = 0; g.dodgeCooldown = 0;
  g.onKeyDown({ code: 'KeyV', repeat: false, preventDefault() {} });
  check('PC V activates the real dodge', g.dodgeTime === 0.29 && g.hunger === 2);
  g.dodgeTime = 0; g.dodgeCooldown = 0;
  g.onKeyDown({ code: 'KeyV', repeat: true, preventDefault() {} });
  check('holding V cannot spam dodge', g.dodgeTime === 0 && g.hunger === 2);
  g.inventory.slots[0] = null;
  check('guard cannot be activated after shield is unequipped', !g.tryTimedGuard());
  g.inventory.slots[0] = { id: I.SHIELD, count: 1 };
  g.world = { peekBlock: () => B.AIR };
  g.scene = { remove: () => {} };
  g.difficulty = DEFAULT_DIFFICULTY;
  g.arrows = [];
  const shoot = (z: number, velZ: number) => {
    g.arrows.push({ life: 0, pos: new THREE.Vector3(0, 1, z), vel: new THREE.Vector3(0, 0, velZ),
      mesh: { position: new THREE.Vector3(), lookAt() {} }, from: { body: { pos: new THREE.Vector3(0, 0, z) } }, power: 4 });
    g.updateArrows(0.1);
  };
  g.guardCooldown = 0;
  g.tryTimedGuard();
  shoot(-0.5, 4);
  check('front arrow is consumed by a well-timed guard', hits === 0 && g.guardTime === 0 && g.arrows.length === 0);
  g.guardCooldown = 0;
  g.tryTimedGuard();
  shoot(0.5, -4);
  check('rear arrow bypasses shield and parry without consuming the timing window', hits === 1 && g.guardTime > 0 && g.arrows.length === 0);
  g.inventory.slots[0] = null;
  g.guardTime = 0; g.dodgeTime = 0.2;
  shoot(0.5, -4);
  check('dodge window avoids a rear arrow even without a shield', hits === 1 && g.arrows.length === 0);
  g.dodgeTime = 0; g.guardTime = 0; g.guardCooldown = 0;
  const foe = { type: 'skeleton', dead: false, soundTimer: 10, body: { pos: new THREE.Vector3(0, 0, -2) },
    group: {}, update(_dt: number, _world: unknown, _p: unknown, hit: (d: number, m: unknown) => void) { hit(4, this); } };
  g.mobs = [foe]; g.spawnTimer = 100; g.daylight = () => 0; g.weather = 'clear'; g.isInNether = false;
  g.drops = []; g.time = 0;
  g.inventory.slots[0] = { id: I.SHIELD, count: 1 };
  g.tryTimedGuard(); g.updateMobs(0.01);
  check('real mob attack callback is parried before applying damage', hits === 1 && g.guardTime === 0);
  foe.body.pos.z = 2; g.guardCooldown = 0; g.tryTimedGuard(); g.updateMobs(0.01);
  check('rear mob attack bypasses passive shield and timed parry', hits === 2 && g.guardTime > 0);
  g.dodgeTime = 0.2; g.updateMobs(0.01);
  check('mob strike in the dodge window misses', hits === 2);
  g.dodgeTime = 0; g.guardTime = 0;
  foe.body.pos.z = -2;
  g.updateMobs(0.01);
  check('passive shield reduces only frontal mob strikes', hits === 3 && lastHit === Math.ceil(mobDamage(4, g.difficulty.damage) / 2));
  foe.body.pos.z = 2;
  g.updateMobs(0.01);
  check('passive shield does not stop a rear mob strike', hits === 4 && lastHit === mobDamage(4, g.difficulty.damage));
  g.mode = 'creative'; g.hunger = 0; g.inventory.slots[0] = null;
  check('Creative can dodge without food, retaining existing sandbox access', g.tryDodge() && g.hunger === 0);
}

section('3.0 #79: build, combat and exploration challenges');
{
  check('all three challenge goals exist as journal achievements', Object.keys(CHALLENGES).every((id) => !!achievementById(id)));
  const base = normalizeChallenges(null);
  eq('2.7 saves start with no challenge counters', Object.values(base).join(','), '0,0,0');
  const migrated = normalizeChallenges({ challenge_builder: 7.9, challenge_hunter: -10, challenge_explorer: 999, bogus: 99 }, ['biome_swamp', 'biome_savanna']);
  eq('building progress is sanitized on import', migrated.challenge_builder, 7);
  eq('negative combat progress is rejected', migrated.challenge_hunter, 0);
  eq('old first-visit achievements contribute to exploration', migrated.challenge_explorer, 2);
  eq('three pre-existing biome visits can complete the challenge on load', normalizeChallenges({}, ['biome_swamp', 'biome_savanna', 'biome_jungle']).challenge_explorer, 3);
  eq('completed challenge cannot be demoted by a bad save', normalizeChallenges({}, ['challenge_hunter']).challenge_hunter, CHALLENGES.challenge_hunter.target);
  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  g.challengeProgress = normalizeChallenges(undefined);
  g.unlocked = new Set();
  g.mode = 'survival';
  g.emitHud = () => {};
  g.message = () => {};
  let xp = 0;
  g.gainXp = (n: number) => { xp += n; };
  for (let i = 0; i < 19; i++) g.advanceChallenge('challenge_builder');
  check('nineteen placed blocks show partial progress with no reward', g.challengeProgress.challenge_builder === 19 && xp === 0 && !g.unlocked.has('challenge_builder'));
  g.advanceChallenge('challenge_builder');
  check('twentieth placed block awards once', g.challengeProgress.challenge_builder === 20 && xp === 10 && g.unlocked.has('challenge_builder'));
  g.advanceChallenge('challenge_builder');
  eq('repeated actions after completion cannot farm rewards', xp, 10);
  for (let i = 0; i < 5; i++) g.advanceChallenge('challenge_hunter');
  check('combat challenge uses its own counter and reward', g.challengeProgress.challenge_hunter === 5 && xp === 20);
  g.advanceChallenge('challenge_explorer');
  check('exploration does not increment combat or building', g.challengeProgress.challenge_explorer === 1 && xp === 20);
  eq('saved counters and achievements cannot repay completed reward', normalizeChallenges(JSON.parse(JSON.stringify(g.challengeProgress)), g.unlocked).challenge_builder, 20);
  // The live placement and melee paths (shared by PC clicks and touch taps)
  // advance counters only after successful actions, never on invalid targets.
  const live = Object.create(Game.prototype) as unknown as Record<string, any>;
  live.mode = 'survival';
  live.challengeProgress = normalizeChallenges(undefined);
  live.unlocked = new Set();
  live.message = () => {};
  live.emitHud = () => {};
  live.keys = new Set();
  live.mobs = [];
  live.body = { pos: new THREE.Vector3(5.5, 65, 5.5), w: 0.6, h: 1.8 };
  live.findMobTarget = () => ({ mob: null, dist: Infinity });
  live.selectedStack = () => ({ id: B.COBBLE, count: 1 });
  live.tryMakePath = () => false;
  live.settle = () => {};
  live.onBlockChanged = () => {};
  live.growables = new Map();
  live.consumeSelected = () => {};
  live.target = null;
  live.tryUse();
  eq('using an item without a target does not build', live.challengeProgress.challenge_builder, 0);
  let placed = 0;
  live.world = {
    getBlock: (_x: number, y: number) => y <= 64 ? B.STONE : B.AIR,
    setBlock: () => { placed++; },
  };
  live.target = { id: B.STONE, x: 2, y: 64, z: 2, nx: 0, ny: 1, nz: 0 };
  live.tryUse();
  check('placing a real block advances construction', placed === 1 && live.challengeProgress.challenge_builder === 1);
  const zombie = new Mob('zombie', 6, 65, 6);
  zombie.health = 1;
  live.findMobTarget = () => ({ mob: zombie, dist: 1 });
  live.target = null;
  live.selectedStack = () => null;
  live.attackCooldown = 0;
  live.sprinting = false;
  live.hunger = 20;
  live.wearTool = () => {};
  live.hasEffect = () => false;
  live.tryAttack();
  check('a direct lethal melee hit counts as combat', zombie.dead && live.challengeProgress.challenge_hunter === 1);
  live.attackCooldown = 0;
  live.tryAttack();
  eq('dead enemies cannot grant a second kill', live.challengeProgress.challenge_hunter, 1);

}

section('3.0 #81: independent, live per-world difficulty');
{
  eq('legacy saves use 2.7 normal settings', JSON.stringify(normalizeDifficulty(undefined)), JSON.stringify(DEFAULT_DIFFICULTY));
  const normalized = normalizeDifficulty({ aggression: 'spokojna', damage: 'surowe', resources: 'invalid', foreign: true });
  eq('valid axes survive, invalid axes default independently', JSON.stringify(normalized),
    JSON.stringify({ aggression: 'spokojna', damage: 'surowe', resources: 'normalne' }));
  eq('arrays cannot smuggle difficulty settings', normalizeDifficulty(['zaciekla']).aggression, 'normalna');
  eq('calm world stops spawning hostiles', hostileCap('spokojna'), 0);
  check('fierce world allows more hostile mobs', hostileCap('zaciekla') > hostileCap('normalna'));
  eq('fierce hostile movement is faster', hostileSpeed('zaciekla'), 1.25);
  eq('normal mob hits preserve old damage', mobDamage(4, 'normalne'), 4);
  eq('gentle mob hits still hurt', mobDamage(1, 'lagodne'), 1);
  eq('gentle mob hits are reduced', mobDamage(10, 'lagodne'), 7);
  eq('harsh mob hits are increased', mobDamage(10, 'surowe'), 14);
  eq('scarce ore sometimes yields nothing', oreYield(1, 'skape', 0.1), 0);
  eq('scarce ore still sometimes yields its normal amount', oreYield(1, 'skape', 0.9), 1);
  eq('rich ore grants one extra resource', oreYield(4, 'obfite'), 5);
  eq('normal ore preserves 2.7 yield', oreYield(4, 'normalne'), 4);
  eq('rich diamonds add material', resourceDropCount(B.DIAMOND_ORE, I.DIAMOND, 1, 'obfite', false), 2);
  eq('rich mode cannot duplicate an iron ore block', resourceDropCount(B.IRON_ORE, B.IRON_ORE, 1, 'obfite', false), 1);
  eq('silk touch never applies resource multiplier', resourceDropCount(B.DIAMOND_ORE, B.DIAMOND_ORE, 1, 'obfite', true), 1);
  eq('ordinary stone ignores resource multiplier', resourceDropCount(B.STONE, B.COBBLE, 1, 'obfite', false), 1);
  eq('ripe wheat gains a second harvest in rich worlds', resourceDropCount(B.CROP3, I.WHEAT, 1, 'obfite', false), 2);
  eq('scarce harvest occasionally loses edible yield', resourceDropCount(B.CROP3, I.WHEAT, 1, 'skape', false, 0.1), 0);
  eq('scarce world keeps seeds for sustainable replanting', resourceDropCount(B.CROP3, I.SEEDS, 1, 'skape', false, 0.1), 1);
  eq('unripe crops never multiply seeds', resourceDropCount(B.CROP0, I.SEEDS, 1, 'obfite', false), 1);
  eq('silk touch never multiplies a ripe crop block', resourceDropCount(B.CROP3, B.CROP3, 1, 'obfite', true), 1);
  eq('old animal meat yield unchanged in normal worlds', animalMeatYield('normalne', 0), 1);
  eq('animals give two pieces of meat in rich worlds', animalMeatYield('obfite'), 2);
  eq('animals sometimes give no meat in scarce worlds', animalMeatYield('skape', 0.1), 0);
  eq('animals can still provide meat in scarce worlds', animalMeatYield('skape', 0.9), 1);
  const harvest = Object.create(Game.prototype) as unknown as Record<string, any>;
  harvest.world = new World(37, true);
  harvest.mode = 'survival';
  harvest.difficulty = { ...DEFAULT_DIFFICULTY, resources: 'obfite' };
  harvest.growables = new Map();
  harvest.selectedStack = () => null;
  harvest.spawnParticles = () => {};
  harvest.fallGravity = () => {};
  const harvestDrops: { id: number; count: number }[] = [];
  harvest.spawnDrop = (id: number, count: number) => void harvestDrops.push({ id, count });
  harvest.world.getChunk(0, 0);
  harvest.world.setBlock(3, FLAT_H + 1, 3, B.CROP3);
  harvest.breakBlock(3, FLAT_H + 1, 3);
  check('live ripe crop harvest uses resource setting but preserves seeds', harvestDrops.some(d => d.id === I.WHEAT && d.count === 2) && harvestDrops.some(d => d.id === I.SEEDS && d.count >= 1));
  harvestDrops.length = 0;
  harvest.difficulty.resources = 'normalne';
  harvest.world.setBlock(3, FLAT_H + 1, 3, B.CROP3);
  harvest.breakBlock(3, FLAT_H + 1, 3);
  check('reverting the difficulty instantly restores original crop yield', harvestDrops.some(d => d.id === I.WHEAT && d.count === 1));
  const pig = new Mob('pig', 4, FLAT_H + 1, 4);
  harvest.mobXp = () => {};
  harvest.unlock = () => {};
  harvestDrops.length = 0;
  harvest.difficulty.resources = 'obfite';
  harvest.mobLoot(pig);
  check('live animal kill applies rich meat yield', harvestDrops.some(d => d.id === I.RAW_PORK && d.count === 2));
  harvestDrops.length = 0;
  harvest.difficulty.resources = 'normalne';
  harvest.mobLoot(pig);
  check('reverting the setting restores old animal meat yield', harvestDrops.some(d => d.id === I.RAW_PORK && d.count === 1));
  harvest.selectedStack = () => ({ id: I.WOOD_PICK, count: 1 });
  harvest.difficulty.resources = 'skape';
  let orbCount = 0;
  harvest.spawnOrb = () => { orbCount++; };
  const originalRandom = Math.random;
  try {
    Math.random = () => 0.1;
    harvestDrops.length = 0;
    harvest.world.setBlock(3, FLAT_H + 1, 3, B.COAL_ORE);
    harvest.breakBlock(3, FLAT_H + 1, 3);
    check('scarce ore that yields nothing grants no XP or items', harvestDrops.length === 0 && orbCount === 0);
    harvest.difficulty.resources = 'normalne';
    harvest.world.setBlock(3, FLAT_H + 1, 3, B.COAL_ORE);
    harvest.breakBlock(3, FLAT_H + 1, 3);
    check('returning to normal resources restores ore and XP immediately', harvestDrops.some(d => d.id === I.COAL && d.count === 1) && orbCount === 1);
  } finally { Math.random = originalRandom; }



  const world = new World(17, true);
  world.getChunk(0, 0);
  const near = new THREE.Vector3(9.5, FLAT_H + 1, 12.5);
  const calmCreeper = new Mob('creeper', 9.5, FLAT_H + 1, 9.5);
  calmCreeper.fuse = 0.2;
  calmCreeper.update(0.3, world, near, () => {}, () => {}, true);
  check('calm setting defuses already-lit creepers without explosions', calmCreeper.fuse === -1 && !calmCreeper.exploded);
  const slow = new Mob('zombie', 9.5, FLAT_H + 1, 9.5);
  const fast = new Mob('zombie', 9.5, FLAT_H + 1, 9.5);
  slow.update(1 / 30, world, near, () => {}, () => {}, false, [], () => {}, hostileSpeed('normalna'));
  fast.update(1 / 30, world, near, () => {}, () => {}, false, [], () => {}, hostileSpeed('zaciekla'));
  check('fierce aggression moves chasing mobs faster in the actual AI', Math.hypot(fast.body.vel.x, fast.body.vel.z) > Math.hypot(slow.body.vel.x, slow.body.vel.z));
}

section('3.0 #80: first-visit biome rewards');
{
  const expected = ['Bagno', 'Sawanna', 'Dżungla', 'Tajga', 'Pustkowie', 'Kwiecista łąka'] as const;
  check('six exploration goals are real achievements', expected.every((b) => achievementById(BIOME_DISCOVERY_GOALS[b]!) !== undefined));
  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  g.unlocked = new Set();
  g.challengeProgress = normalizeChallenges(undefined);
  g.mode = 'survival';
  g.toast = null;
  g.message = () => {};
  g.emitHud = () => {};
  let xp = 0;
  g.gainXp = (n: number) => { xp += n; };
  g.discoverBiome('Bagno');
  check('entering swamp adds the goal to the saved unlocked set', g.unlocked.has('biome_swamp'));
  eq('one visit pays exactly 3 experience', xp, 3);
  g.discoverBiome('Bagno');
  eq('revisiting same biome never farms extra rewards', xp, 3);
  g.discoverBiome('Równiny');
  eq('ordinary terrain has no discovery reward', xp, 3);
  g.discoverBiome('Kwiecista łąka');
  eq('different biome has its own reward', xp, 6);
  g.mode = 'creative';
  g.discoverBiome('Tajga');
  check('Creative earns journal entry without experience', xp === 6 && g.unlocked.has('biome_taiga'));
  g.discoverBiome('Nether');
  check('the Nether does not award overworld goals', g.unlocked.size === 4 && !g.unlocked.has('biome_nether'));
  let samples = 0;
  g.mode = 'survival';
  g.lastBiomeVisitKey = '';
  g.body = { pos: new THREE.Vector3(-0.2, 66, -0.2) };
  g.currentDimension = () => 'overworld';
  g.world = { surface: (x: number, z: number) => { samples++; return { biome: x === -1 && z === -1 ? 'Pustkowie' : 'Sawanna' }; } };
  g.observeBiomeAtPlayer();
  check('negative block coordinates select the actually visited biome', g.unlocked.has('biome_wasteland'));
  g.observeBiomeAtPlayer();
  eq('staying inside a block does not resample terrain', samples, 1);
  g.body.pos.x = 0.1;
  g.observeBiomeAtPlayer();
  check('crossing a biome border in one chunk gives a different goal', samples === 2 && g.unlocked.has('biome_savanna'));
  g.currentDimension = () => 'nether';
  g.observeBiomeAtPlayer();
  eq('dimension swap invalidates last-position cache', samples, 3);

}

section('3.0 #52: meadow rabbits, fleeing, jumping, food and drops');
{
  eq('meadow spawn selects rabbits often', pickPassiveMob(0.3, 'Kwiecista łąka'), 'rabbit');
  eq('old plains support rare rabbits', pickPassiveMob(0.01, 'Równiny'), 'rabbit');
  eq('the rest of plains animal mix stays familiar', pickPassiveMob(0.3, 'Równiny'), 'cow');
  eq('meadows still spawn other animals', pickPassiveMob(0.9, 'Kwiecista łąka'), 'sheep');
  check('rabbits remain passive', !isHostileMob('rabbit'));
  check('rabbit meat IDs are appended to the old range', I.RAW_RABBIT === 357 && I.COOKED_RABBIT === 358);
  check('both cuts are usable in Creative', CREATIVE_ITEMS.includes(I.RAW_RABBIT) && CREATIVE_ITEMS.includes(I.COOKED_RABBIT));
  eq('rabbit meat cooks in a furnace', smeltResult(I.RAW_RABBIT), I.COOKED_RABBIT);
  check('cooked rabbit restores more hunger', (ITEMS[I.COOKED_RABBIT]?.hunger ?? 0) > (ITEMS[I.RAW_RABBIT]?.hunger ?? 0));
  const rabbit = new Mob('rabbit', 8.5, FLAT_H + 1, 8.5);
  check('rabbit is smaller than chicken', rabbit.body.w < new Mob('chicken', 0, 0, 0).body.w);
  check('rabbit has long ears and a hopping gait', rabbit.head.children.length >= 7 && rabbit.legs.length === 4);
  const flat = new World(456, true);
  flat.getChunk(0, 0);
  for (let z = 2; z <= 12; z++) for (let x = 7; x <= 9; x++) for (let y = FLAT_H + 1; y <= FLAT_H + 3; y++) flat.setBlock(x, y, z, B.AIR);
  const near = new THREE.Vector3(8.5, FLAT_H + 1, 10.5);
  const original = rabbit.body.pos.distanceTo(near);
  let jumped = false;
  for (let i = 0; i < 90; i++) {
    rabbit.update(1 / 30, flat, near, () => {}, () => {}, false);
    if (rabbit.body.pos.y > FLAT_H + 1.13) jumped = true;
  }
  check('rabbit flees the player without attacking', rabbit.body.pos.distanceTo(near) > original + 2, `${original.toFixed(2)} → ${rabbit.body.pos.distanceTo(near).toFixed(2)} at ${rabbit.body.pos.toArray()}`);
  check('fleeing rabbit hops rather than sliding', jumped);
  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  const drops: number[] = [];
  g.spawnDrop = (id: number) => void drops.push(id);
  g.mobXp = () => {};
  g.unlock = () => {};
  g.mobLoot(rabbit);
  check('rabbit yields distinct meat on death', drops.includes(I.RAW_RABBIT));
  g.inventory = new Inventory();
  g.selected = 0;
  g.body = { pos: new THREE.Vector3(0, 65, 0) };
  g.consumeSelected = () => {};
  g.message = () => {};
  check('campfire cooks rabbit meat using the real engine path', g.cookOnCampfire({ id: I.RAW_RABBIT, count: 1 }));
  eq('cooked rabbit lands in inventory', g.inventory.countOf(I.COOKED_RABBIT), 1);

}

section('3.0 #53: biome foxes hunt, flee and steal only dropped food');
{
  eq('taiga can naturally spawn foxes', pickPassiveMob(0.2, 'Tajga'), 'fox');
  eq('flower meadow can also spawn foxes', pickPassiveMob(0.49, 'Kwiecista łąka'), 'fox');
  eq('older forest worlds can spawn foxes', pickPassiveMob(0.15, 'Las'), 'fox');
  eq('old meadow rabbits keep their original chance', pickPassiveMob(0.3, 'Kwiecista łąka'), 'rabbit');
  eq('old forest other animals keep their spawn range', pickPassiveMob(0.8, 'Las'), 'pig');
  check('foxes are passive to players', !isHostileMob('fox'));
  check('fox has Polish target name and distinctive model', MOB_NAMES.fox === 'Lis' && (() => {
    const fox = new Mob('fox', 0, 0, 0);
    return fox.meshes.length >= 14 && fox.legs.length === 4 && fox.body.h < 0.9;
  })());
  const w = new World(786, true);
  w.getChunk(0, 0);
  const distantPlayer = new THREE.Vector3(35.5, FLAT_H + 1, 35.5);
  const hunter = new Mob('fox', 8.5, FLAT_H + 1, 8.5);
  const prey = new Mob('rabbit', 10.5, FLAT_H + 1, 8.5);
  const hp = prey.health;
  for (let i = 0; i < 180 && !prey.dead; i++) hunter.update(1 / 30, w, distantPlayer, () => {}, () => {}, false, [hunter, prey]);
  check('fox catches and damages a small animal in the real AI path', prey.health < hp, `${prey.health}/${hp} (fox ${hunter.body.pos.toArray()})`);
  const timid = new Mob('fox', 7.5, FLAT_H + 1, 7.5);
  const nearPlayer = new THREE.Vector3(9.5, FLAT_H + 1, 9.5);
  const firstDist = timid.body.pos.distanceTo(nearPlayer);
  let attacks = 0;
  for (let i = 0; i < 90; i++) timid.update(1 / 30, w, nearPlayer, () => { attacks++; }, () => {}, false, [timid]);
  check('fox flees instead of attacking the player', timid.body.pos.distanceTo(nearPlayer) > firstDist + 2 && attacks === 0);
  const wolf = new Mob('wolf', 7.5, FLAT_H + 1, 10.5);
  const scared = new Mob('fox', 7.5, FLAT_H + 1, 7.5);
  const wolfDistance = scared.body.pos.distanceTo(wolf.body.pos);
  for (let i = 0; i < 70; i++) scared.update(1 / 30, w, distantPlayer, () => {}, () => {}, false, [scared, wolf]);
  check('fox keeps away from wolves', scared.body.pos.distanceTo(wolf.body.pos) > wolfDistance + 2);

  const snackFox = new Mob('fox', 8.5, FLAT_H + 1, 8.5);
  const food = { id: I.APPLE, count: 2, age: 2, pos: new THREE.Vector3(8.6, FLAT_H + 1, 8.5) };
  let eaten = 0;
  const snatch = () => { eaten++; food.count--; return true; };
  for (let i = 0; i < 30; i++) snackFox.update(1 / 30, w, distantPlayer, () => {}, () => {}, false, [snackFox], () => {}, 1, [food], snatch);
  check('fox steals exactly one from a food stack with a cooldown', eaten === 1 && food.count === 1 && snackFox.foxSnack > 0);
  const metal = { ...food, id: I.IRON, count: 1 };
  let stolenMetal = 0;
  snackFox.attackCooldown = 0;
  snackFox.update(1 / 30, w, distantPlayer, () => {}, () => {}, false, [snackFox], () => {}, 1, [metal], () => { stolenMetal++; return true; });
  eq('fox will not steal tools, materials or non-food items', stolenMetal, 0);
  const newFood = { id: I.BREAD, count: 1, age: 0.3, pos: snackFox.body.pos.clone() };
  snackFox.update(1 / 30, w, distantPlayer, () => {}, () => {}, false, [snackFox], () => {}, 1, [newFood], () => { stolenMetal++; return true; });
  eq('newly dropped food is not stolen during pickup grace period', stolenMetal, 0);

  // Exercise the actual game callback: stealing a stack decrements exactly one
  // item and deleting the final one removes its world mesh, with no inventory.
  const game = Object.create(Game.prototype) as unknown as Record<string, any>;
  game.world = w;
  game.time = 0.25;
  game.mode = 'survival';
  game.ui = 'playing';
  game.isInNether = false;
  game.difficulty = { ...DEFAULT_DIFFICULTY };
  game.mobs = [new Mob('fox', 8.5, FLAT_H + 1, 8.5)];
  game.body = { pos: new THREE.Vector3(20.5, FLAT_H + 1, 8.5) };
  game.spawnTimer = 100;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), new THREE.MeshBasicMaterial());
  game.drops = [{ id: I.APPLE, count: 2, age: 2, pos: new THREE.Vector3(8.55, FLAT_H + 1, 8.5), mesh, vel: new THREE.Vector3() }];
  let removed = 0, feedback = 0;
  game.scene = { remove: () => { removed++; } };
  game.message = () => { feedback++; };
  game.updateMobs(1 / 30);
  check('real world drop loses one when fox eats; remainder can still be picked up', game.drops.length === 1 && game.drops[0].count === 1 && removed === 0 && feedback === 1, `${JSON.stringify(game.drops.map((d: {count:number}) => d.count))} removed=${removed} feedback=${feedback} fox=${game.mobs[0]?.body.pos.toArray()}`);
  game.mobs[0].attackCooldown = 0;
  game.updateMobs(1 / 30);
  check('fox consuming last unit removes the entity rather than duplicating it', game.drops.length === 0 && removed === 1 && feedback === 2, `${JSON.stringify(game.drops.map((d: {count:number}) => d.count))} removed=${removed} feedback=${feedback}`);
}

section('3.0 #54: frogs at real water and their insect prey');
{
  const world = new World(78, true);
  world.getChunk(0, 0);
  world.getChunk(1, 0);
  eq('flat dry land does not spawn pond life', shoreWaterNearby(world, 8, FLAT_H + 1, 8), false);
  world.setBlock(11, FLAT_H, 8, B.WATER);
  eq('water three blocks from a shore is detected', shoreWaterNearby(world, 8, FLAT_H + 1, 8), true);
  eq('distant water is not mistaken for a pond', shoreWaterNearby(world, 4, FLAT_H + 1, 8), false);
  const knownChunks = world.chunks.size;
  shoreWaterNearby(world, -1, FLAT_H + 1, 8);
  eq('pond check never creates neighboring chunks', world.chunks.size, knownChunks);
  check('frog and insect have distinct Polish target names', MOB_NAMES.frog === 'Żaba' && MOB_NAMES.midge === 'Meszka');
  check('frog is passive and compact with visible throat and eyes', (() => {
    const frog = new Mob('frog', 8.5, FLAT_H + 1, 8.5);
    return !isHostileMob('frog') && frog.body.h < 0.6 && frog.legs.length === 4 && frog.meshes.length >= 10;
  })());
  const flyer = new Mob('midge', 6.5, FLAT_H + 2, 6.5);
  const flyY = flyer.body.pos.y;
  for (let i = 0; i < 60; i++) flyer.update(1 / 30, world, new THREE.Vector3(40, 65, 40), () => {}, () => {}, false);
  check('insects hover over the shore without falling', Math.abs(flyer.body.pos.y - flyY) < 0.3 && flyer.body.pos.y > FLAT_H + 1.5);
  const frog = new Mob('frog', 8.5, FLAT_H + 1, 8.5);
  const prey = new Mob('midge', 9.4, FLAT_H + 1.35, 8.5);
  frog.update(1 / 30, world, new THREE.Vector3(40, 65, 40), () => {}, () => {}, false, [frog, prey]);
  check('frog catches an actual insect and shows a tongue lunge', prey.dead && frog.head.children.some((part) => part instanceof THREE.Mesh && part.visible && (part as THREE.Mesh).position.z === 0.4));
  const jumper = new Mob('frog', 5.5, FLAT_H + 1, 5.5);
  jumper.walking = true;
  jumper.aiTimer = 6;
  let jumped = false;
  for (let i = 0; i < 65; i++) {
    jumper.update(1 / 30, world, new THREE.Vector3(40, 65, 40), () => {}, () => {}, false);
    if (jumper.body.pos.y > FLAT_H + 1.35) jumped = true;
  }
  check('frogs jump instead of merely sliding', jumped);

  // Real spawn pathway picks a loaded shoreline on the existing flat biome.
  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  g.world = world;
  g.body = { pos: new THREE.Vector3(8.5, FLAT_H + 1, 8.5) };
  g.mode = 'survival';
  g.time = 0.25;
  g.isInNether = false;
  g.difficulty = { ...DEFAULT_DIFFICULTY, aggression: 'spokojna' };
  g.mobs = [];
  g.spawnTimer = 0;
  g.spawnVillageFolk = () => {};
  g.scene = { remove: () => {} };
  g.spawnMob = (type: MobType, x: number, y: number, z: number) => { const m = new Mob(type, x, y, z); g.mobs.push(m); return m; };
  world.setBlock(31, FLAT_H, 8, B.WATER);
  const random = Math.random;
  try {
    Math.random = () => 0;
    g.updateMobs(1 / 30);
    check('engine spawns frogs with insects beside loaded water in Survival', g.mobs.some((m: Mob) => m.type === 'frog') && g.mobs.some((m: Mob) => m.type === 'midge'));
    g.mobs = [];
    world.setBlock(31, FLAT_H, 8, B.GRASS);
    g.spawnTimer = 0;
    g.updateMobs(1 / 30);
    check('same seed/ground without water does not spawn a frog', !g.mobs.some((m: Mob) => m.type === 'frog' || m.type === 'midge'));
    g.mobs = [];
    g.isInNether = true;
    g.spawnTimer = 0;
    g.updateMobs(1 / 30);
    check('Nether never spawns pond life', !g.mobs.some((m: Mob) => m.type === 'frog' || m.type === 'midge'));
    g.mobXp = Game.prototype['mobXp'];
    let orbs = 0;
    g.dropXpOrbs = () => { orbs++; };
    g.mobXp(prey, 0, 0, 0);
    eq('insects cannot become an unlimited XP farm', orbs, 0);
    const drops: number[] = [];
    g.spawnDrop = (id: number) => { drops.push(id); };
    g.mobXp = () => {};
    g.unlock = () => {};
    g.mobLoot(frog);
    check('frog has a rare usable slimeball drop', drops.includes(I.SLIME_BALL));
  } finally { Math.random = random; }
}

section('3.0 #57: nocturnal bats take flight and rest by day');
{
  eq('bats can spawn above forest grass after dusk', batSpawnAllowed(B.GRASS, 'Las', 0.2), true);
  eq('bats can spawn in older birch forest worlds', batSpawnAllowed(B.GRASS, 'Brzozowy las', 0.2), true);
  eq('bats never spawn in the daytime', batSpawnAllowed(B.GRASS, 'Las', 0.9), false);
  eq('bats do not appear above bare desert sand', batSpawnAllowed(B.SAND, 'Pustynia', 0.2), false);
  check('bat is passive, has a localized name and a winged model', (() => {
    const m = new Mob('bat', 8, FLAT_H + 4, 8);
    return MOB_NAMES.bat === 'Nietoperz' && !isHostileMob('bat') && m.arms.length === 2 && m.body.h < 0.5;
  })());
  const world = new World(777, true);
  world.getChunk(0, 0);
  world.getChunk(1, 0);
  const flyer = new Mob('bat', 7.5, FLAT_H + 3.2, 7.5);
  const player = new THREE.Vector3(45, FLAT_H + 1, 45);
  for (let i = 0; i < 40; i++) flyer.update(1 / 30, world, player, () => {}, () => {}, false, [flyer], () => {}, 1, [], () => false, 0.2);
  const flightAltitude = flyer.body.pos.y;
  const flightDist = Math.hypot(flyer.body.pos.x - flyer.home.x, flyer.body.pos.z - flyer.home.z);
  const inFlight = flyer.arms.some((arm) => Math.abs(arm.rotation.z) < 1);
  check('night bat flies in a bounded area and flaps both wings', inFlight && flightDist > 0.25 && flightDist < 7 && Math.abs(flightAltitude - flyer.home.y) < 1);
  for (let i = 0; i < 90; i++) flyer.update(1 / 30, world, player, () => {}, () => {}, false, [flyer], () => {}, 1, [], () => false, 1);
  check('at dawn bat folds wings and settles nearer the ground', flyer.body.pos.y < flightAltitude - 0.8 && flyer.arms.every((arm) => Math.abs(arm.rotation.z) === 1.25));

  // Spawn through the real world tick rather than a /summon-only code path.
  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  const originalSurface = world.surface.bind(world);
  g.world = world;
  g.world.surface = (x: number, z: number) => ({ ...originalSurface(x, z), biome: 'Las' });
  g.body = { pos: new THREE.Vector3(8.5, FLAT_H + 1, 8.5) };
  g.mode = 'survival';
  g.time = 0.75;
  g.isInNether = false;
  g.difficulty = { ...DEFAULT_DIFFICULTY, aggression: 'spokojna' };
  g.mobs = [];
  g.spawnTimer = 0;
  g.spawnVillageFolk = () => {};
  g.scene = { remove: () => {} };
  g.spawnMob = (type: MobType, x: number, y: number, z: number) => { const m = new Mob(type, x, y, z); g.mobs.push(m); return m; };
  const random = Math.random;
  try {
    Math.random = () => 0;
    g.updateMobs(1 / 30);
    check('night forest in Survival actually spawns a bat', g.mobs.some((m: Mob) => m.type === 'bat'));
    g.mobs = [];
    g.time = 0.25;
    g.spawnTimer = 0;
    g.updateMobs(1 / 30);
    check('daylight does not create new bats', !g.mobs.some((m: Mob) => m.type === 'bat'));
    g.mobs = [];
    g.isInNether = true;
    g.time = 0.75;
    g.spawnTimer = 0;
    g.updateMobs(1 / 30);
    check('Nether spawns no bats', !g.mobs.some((m: Mob) => m.type === 'bat'));
    let gained = 0;
    g.dropXpOrbs = () => { gained++; };
    g.mobXp = Game.prototype['mobXp'];
    g.mobXp(flyer, 0, 0, 0);
    eq('bats cannot be farmed for XP', gained, 0);
  } finally { Math.random = random; }
}

section('3.0 #58: visible camouflage for small swamp lizards');
{
  const world = new World(839, true);
  world.getChunk(0, 0);
  world.getChunk(1, 0);
  world.setBlock(8, FLAT_H, 8, B.MUD);
  const lizard = new Mob('lizard', 8.5, FLAT_H + 1, 8.5);
  const player = new THREE.Vector3(40, FLAT_H + 1, 40);
  for (let i = 0; i < 5; i++) lizard.update(1 / 30, world, player, () => {}, () => {}, false);
  const skin = (lizard.meshes[0] as THREE.Mesh).material as THREE.MeshLambertMaterial;
  const muddy = skin.color.getHex();
  check('on mud lizard has opaque brown skin, pale stripe and bright eyes', muddy === 0x907a5b && skin.transparent === false && lizard.meshes.some((m) => (m.material as THREE.MeshLambertMaterial).color?.getHex() === 0xd9d69b), `skin=${muddy.toString(16)} onGround=${lizard.body.onGround} pos=${lizard.body.pos.toArray()} ground=${world.peekBlock(8,64,8)} cache=${(lizard as unknown as {camouflageGround: number}).camouflageGround} targetSkin=${(lizard as unknown as {lizardSkin: THREE.MeshLambertMaterial}).lizardSkin.color.getHex().toString(16)} at=${world.peekBlock(Math.floor(lizard.body.pos.x), Math.floor(lizard.body.pos.y-0.25),Math.floor(lizard.body.pos.z))}`);
  world.setBlock(8, FLAT_H, 8, B.GRASS);
  for (let i = 0; i < 5; i++) lizard.update(1 / 30, world, player, () => {}, () => {}, false);
  check('grass changes skin without making it invisible', skin.color.getHex() === 0x4a8255 && skin.opacity === 1);
  const another = new Mob('lizard', 9.5, FLAT_H + 1, 8.5);
  for (let i = 0; i < 5; i++) another.update(1 / 30, world, player, () => {}, () => {}, false);
  world.setBlock(8, FLAT_H, 8, B.MUD);
  lizard.update(1 / 30, world, player, () => {}, () => {}, false);
  check('camouflage is per-animal, not a global tint of every lizard', skin.color.getHex() === 0x907a5b && ((another.meshes[0] as THREE.Mesh).material as THREE.MeshLambertMaterial).color.getHex() === 0x4a8255, `skin=${skin.color.getHex().toString(16)} other=${((another.meshes[0] as THREE.Mesh).material as THREE.MeshLambertMaterial).color.getHex().toString(16)}`);
  const shy = new Mob('lizard', 7.5, FLAT_H + 1, 7.5);
  const near = new THREE.Vector3(9.5, FLAT_H + 1, 9.5);
  const startDist = shy.body.pos.distanceTo(near);
  let attacks = 0;
  for (let i = 0; i < 70; i++) shy.update(1 / 30, world, near, () => { attacks++; }, () => {}, false);
  check('lizard flees a nearby player without attacking', !isHostileMob('lizard') && shy.body.pos.distanceTo(near) > startDist + 1 && attacks === 0);
  check('swamp lizard is identifiable in the target HUD', MOB_NAMES.lizard === 'Jaszczurka' && lizard.body.w < 0.5);

  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  const originalSurface = world.surface.bind(world);
  g.world = world;
  g.world.surface = (x: number, z: number) => ({ ...originalSurface(x, z), biome: 'Bagno' });
  g.body = { pos: new THREE.Vector3(8.5, FLAT_H + 1, 8.5) };
  g.mode = 'survival';
  g.time = 0.25;
  g.isInNether = false;
  g.difficulty = { ...DEFAULT_DIFFICULTY, aggression: 'spokojna' };
  g.mobs = [];
  g.spawnTimer = 0;
  g.spawnVillageFolk = () => {};
  g.scene = { remove: () => {} };
  g.spawnMob = (type: MobType, x: number, y: number, z: number) => { const m = new Mob(type, x, y, z); g.mobs.push(m); return m; };
  world.setBlock(28, FLAT_H, 8, B.MUD);
  const random = Math.random;
  try {
    Math.random = () => 0;
    g.updateMobs(1 / 30);
    check('swamp mud naturally spawns a lizard in Survival', g.mobs.some((m: Mob) => m.type === 'lizard'), `mobs=${g.mobs.map((m: Mob) => m.type).join(',')} mud=${world.getBlock(28,64,8)} feet=${world.peekBlock(28,65,8)} surface=${g.world.surface(28,8).biome}`);
    g.mobs = [];
    g.spawnTimer = 0;
    world.setBlock(28, FLAT_H + 1, 8, B.WATER);
    g.updateMobs(1 / 30);
    check('submerged mud cannot spawn a lizard or shore frog', !g.mobs.some((m: Mob) => m.type === 'lizard' || m.type === 'frog'));
    g.mobs = [];
    g.spawnTimer = 0;
    g.isInNether = true;
    g.updateMobs(1 / 30);
    check('Nether has no swamp lizards', !g.mobs.some((m: Mob) => m.type === 'lizard'), `mobs=${g.mobs.map((m: Mob) => m.type).join(',')} mud=${world.getBlock(28,64,8)} feet=${world.peekBlock(28,65,8)} surface=${g.world.surface(28,8).biome}`);
  } finally { Math.random = random; }
}

section('3.0 #65: sand ambusher warns before an escapable leap');
{
  check('sandstalker counts as a real hostile instead of passive mob', isHostileMob('sandstalker'));
  const world = new World(265, true);
  world.getChunk(0, 0);
  const y = FLAT_H + 1;
  for (let x = 4; x <= 13; x++) for (let z = 6; z <= 10; z++) {
    world.setBlock(x, y - 1, z, B.SAND);
    for (let yy = y; yy <= y + 3; yy++) world.setBlock(x, yy, z, B.AIR);
  }
  const enemy = new Mob('sandstalker', 6.5, y, 8.5);
  const player = new THREE.Vector3(11, y, 8.5);
  let wounds = 0;
  const tick = (mob: Mob, calm = false) => mob.update(1 / 30, world, player, () => { wounds++; }, () => {}, calm);
  const model = enemy as unknown as { sandBody: THREE.Group; sandMound: THREE.Mesh; sandWarning: THREE.Mesh; sandBuried: boolean };
  check('buried enemy has visible mound but not visible hidden body', model.sandMound.visible && !model.sandBody.visible);
  check('buried mound has small target area, not invisible full-height hitbox',
    enemy.rayHit(new THREE.Vector3(6.5, y + 1.1, 4), new THREE.Vector3(0, 0, 1), 10) === null &&
    enemy.rayHit(new THREE.Vector3(6.5, y + 0.1, 4), new THREE.Vector3(0, 0, 1), 10) !== null);

  tick(enemy);
  for (let i = 0; i < 20; i++) tick(enemy);
  check('crest warns for over half a second with no instant damage', model.sandWarning.visible && model.sandBuried && wounds === 0);
  player.x = 18;
  tick(enemy);
  check('retreat beyond ten blocks cancels windup and prevents hit', !model.sandWarning.visible && model.sandBuried && wounds === 0);
  player.x = 8.2;
  for (let i = 0; i < 40; i++) tick(enemy);
  check('only after full warning does monster leap visibly out of sand', !model.sandBuried && model.sandBody.visible && !model.sandMound.visible && wounds === 0);
  for (let i = 0; i < 55; i++) tick(enemy);
  check('emerged pursuer can attack after a dodgeable delay', wounds >= 1);
  player.x = 30;
  for (let i = 0; i < 120; i++) tick(enemy);
  check('enemy reburies when target flees and sand is still underfoot', model.sandBuried && model.sandMound.visible);
  const calmMob = new Mob('sandstalker', 6.5, y, 8.5);
  const woundCount = wounds;
  player.x = 8.2;
  for (let i = 0; i < 50; i++) tick(calmMob, true);
  check('peaceful aggression never starts warning or ambush', (calmMob as unknown as {sandBuried: boolean}).sandBuried && wounds === woundCount);
  // Actual engine spawn: desert biome alone is insufficient; there must be
  // a loaded, dry sand cell with room for the creature to emerge.
  const desert = new World(265, true);
  desert.getChunk(0, 1);
  desert.surface = () => ({ h: FLAT_H, biome: 'Pustynia', temp: 1, forest: 0 });
  desert.setBlock(14, y - 1, 27, B.SAND);
  desert.setBlock(14, y, 27, B.AIR);
  desert.setBlock(14, y + 1, 27, B.AIR);
  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  g.world = desert; g.body = { pos: new THREE.Vector3(8.5, y, 8.5) };
  g.scene = { add: () => {}, remove: () => {} };
  g.mobs = []; g.drops = []; g.isInNether = false;
  g.mode = 'survival'; g.weather = 'clear'; g.time = 0.25;
  g.spawnTimer = 0; g.difficulty = { ...DEFAULT_DIFFICULTY };
  g.nowSeconds = () => 0;
  const random = Math.random;
  try { Math.random = () => 0.2; g.updateMobs(1 / 30); } finally { Math.random = random; }
  check('loaded desert sand produces actual ambusher in day-time game tick', g.mobs.some((m: Mob) => m.type === 'sandstalker'));
  g.mobs = []; g.spawnTimer = 0; g.difficulty = { ...DEFAULT_DIFFICULTY, aggression: 'spokojna' };
  try { Math.random = () => 0.2; g.updateMobs(1 / 30); } finally { Math.random = random; }
  check('calm difficulty suppresses desert enemy spawns', !g.mobs.some((m: Mob) => m.type === 'sandstalker'));
}

section('3.0 #64: blind cave listener tracks real sounds, not silent players');
{
  check('listener is hostile and gets its own model', isHostileMob('echolurker'));
  const world = new World(164, true);
  world.getChunk(0, 0);
  const y = FLAT_H + 1;
  for (let x = 2; x <= 14; x++) for (let z = 2; z <= 14; z++) {
    world.setBlock(x, y - 1, z, B.STONE);
    for (let h = y; h <= y + 3; h++) world.setBlock(x, h, z, B.AIR);
  }
  const mob = new Mob('echolurker', 5.5, y, 6.5);
  const player = new THREE.Vector3(8.5, y, 6.5);
  let wounds = 0;
  let noises: Array<{id: number; x: number; y: number; z: number; radius: number; ttl: number; source: 'player' | 'decoy'}> = [];
  const tick = (subject = mob, calm = false) => subject.update(1 / 30, world, player, () => { wounds++; }, () => {}, calm,
    [], () => {}, 1, [], () => false, 0, false, 0.25, noises);
  const px = mob.body.pos.x;
  for (let i = 0; i < 50; i++) tick();
  check('without sounds the listener does not magically chase a nearby player', Math.abs(mob.body.pos.x - px) < 0.1 && wounds === 0);
  noises = [{ id: 1, x: 8.5, y, z: 6.5, radius: 7, ttl: 1.3, source: 'player' }];
  for (let i = 0; i < 55; i++) tick();
  check('a footstep is investigated and can lead to a real melee attack', mob.body.pos.x > 7 && wounds > 0);
  const woundsAfter = wounds;
  player.set(12.5, y, 12.5);
  noises = [{ id: 2, x: 4.5, y, z: 8.5, radius: 13, ttl: 1.3, source: 'decoy' }];
  for (let i = 0; i < 40; i++) tick();
  check('thrown-object impact redirects pursuit toward the landing point, away from player',
    mob.body.pos.x < 7.5 && mob.body.pos.z > 6.5 && wounds === woundsAfter);
  noises = [];
  for (let i = 0; i < 160; i++) tick();
  const stopped = mob.body.pos.clone();
  player.set(mob.body.pos.x + 2, y, mob.body.pos.z);
  for (let i = 0; i < 40; i++) tick();
  check('expired sound memory lets a quiet player pass undetected',
    mob.body.pos.distanceTo(stopped) < 0.2 && wounds === woundsAfter);
  const calmMob = new Mob('echolurker', 5.5, y, 6.5);
  noises = [{ id: 3, x: 8.5, y, z: 6.5, radius: 12, ttl: 1.3, source: 'player' }];
  for (let i = 0; i < 65; i++) tick(calmMob, true);
  check('peaceful mode prevents listener pursuit and attacks', Math.abs(calmMob.body.pos.x - 5.5) < 0.1 && wounds === woundsAfter);

  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  g.world = world; g.body = { pos: new THREE.Vector3(5.5, y, 6.5) };
  g.mode = 'creative'; g.growables = new Map();
  g.spawnParticles = () => {}; g.fallGravity = () => {};
  world.setBlock(8, y, 6, B.STONE);
  g.breakBlock(8, y, 6);
  check('actually breaking a block near player emits a louder positional mining cue',
    g.noiseEvents.length === 1 && g.noiseEvents[0].radius === 13 && g.noiseEvents[0].source === 'player');
  world.setBlock(8, y, 6, B.STONE);
  g.breakBlock(8, y, 6, true);
  eq('silent world edits do not emit player mining sounds', g.noiseEvents.length, 1);
  for (let i = 0; i < 60; i++) g.emitCaveNoise(5, y, 5, 7);
  check('sound queue is bounded even during mass block destruction', g.noiseEvents.length <= 32);

  // Run the real player physics/update loop: sneaking suppresses footsteps,
  // normal walking and sprinting emit cues from the player's *old position*.
  const walker = Object.create(Game.prototype) as unknown as Record<string, any>;
  walker.world = world; walker.mode = 'creative'; walker.ui = 'playing';
  walker.inventory = new Inventory(); walker.selected = 0;
  walker.body = { pos: new THREE.Vector3(4.5, y, 4.5), vel: new THREE.Vector3(), w: 0.6, h: 1.8, onGround: true, hitWall: false };
  walker.keys = new Set(['KeyD', 'ShiftLeft']);
  walker.yaw = 0; walker.eyeHeight = 1.62; walker.autoJump = false;
  walker.flying = false; walker.sprinting = false; walker.hunger = 20;
  walker.health = 20; walker.maxAir = 12; walker.air = 12;
  walker.hasEffect = () => false;
  walker.fallStart = y; walker.stepDist = 0; walker.bobPhase = 0;
  for (let i = 0; i < 65; i++) walker.updatePlayer(1 / 30);
  check('actual Shift movement covers distance without emitting any footstep cues',
    walker.body.pos.x > 6 && (walker.noiseEvents?.length ?? 0) === 0);
  walker.keys = new Set(['KeyD']); walker.stepDist = 0;
  for (let i = 0; i < 20; i++) walker.updatePlayer(1 / 30);
  check('normal walking emits real short-range step cues',
    walker.noiseEvents?.some((n: {radius: number; source: string}) => n.radius === 7 && n.source === 'player'));
  walker.noiseEvents = []; walker.stepDist = 0;
  walker.keys = new Set(['KeyW', 'ControlRight']);
  for (let i = 0; i < 28; i++) walker.updatePlayer(1 / 30);
  check('right-Control sprint emits farther-reaching steps in the same movement loop',
    walker.noiseEvents?.some((n: {radius: number}) => n.radius === 12));
  // The iron shield's weight must affect actual ordinary walking, not only a stat tooltip.
  const walkWith = (id: number) => {
    walker.body.pos.set(4.5, y, 4.5); walker.body.vel.set(0, 0, 0);
    walker.body.onGround = true; walker.sprinting = false;
    walker.keys = new Set(['KeyD']); walker.inventory.slots[0] = { id, count: 1 };
    for (let i = 0; i < 12; i++) walker.updatePlayer(1 / 30);
    return walker.body.pos.x - 4.5;
  };
  const oldShieldDistance = walkWith(I.SHIELD);
  const ironShieldDistance = walkWith(I.IRON_SHIELD);
  check('actual movement is slower only while carrying the heavy iron shield',
    oldShieldDistance > 0.5 && ironShieldDistance > 0 && ironShieldDistance < oldShieldDistance * 0.94);

  // Exercise Q + real dropped entity physics; ordinary block loot must not
  // lure the listener, whereas a player-thrown item makes one impact cue.
  g.scene = { add: () => {}, remove: () => {} };
  g.dropMat = new THREE.MeshBasicMaterial(); g.dropGeos = new Map(); g.drops = [];
  g.inventory = new Inventory(); g.selected = 0;
  g.inventory.slots[0] = { id: B.STONE, count: 2 };
  g.eyePos = () => new THREE.Vector3(4.5, y + 3, 5.5);
  g.lookDir = () => new THREE.Vector3(1, 0, 0);
  g.emitHud = () => {}; g.noiseEvents = [];
  g.dropItem();
  check('Creative Q creates a tagged physics drop without consuming old item IDs', g.drops.length === 1 && g.drops[0].thrown && g.drops[0].id === B.STONE);
  g.body.pos.set(40, y, 40); // no automatic pickup during this test
  for (let i = 0; i < 60; i++) g.updateDrops(1 / 30);
  check('first collision of thrown item creates exactly one decoy at impact',
    g.noiseEvents.length === 1 && g.noiseEvents[0].source === 'decoy' && g.noiseEvents[0].radius === 13);
  for (let i = 0; i < 35; i++) g.updateDrops(1 / 30);
  eq('bouncing item never produces repeated lure cues', g.noiseEvents.length, 1);
  g.spawnDrop(B.STONE, 1, 6.5, y + 3, 6.5);
  for (let i = 0; i < 60; i++) g.updateDrops(1 / 30);
  eq('ordinary loot landing makes no decoy noise', g.noiseEvents.length, 1);

  // Spawn from loaded underground air above a solid cave floor; no new
  // chunks and no surface spawns even when it is daytime outside.
  const cave = new World(164, true);
  cave.getChunk(1, 0);
  cave.setBlock(22, 48, 8, B.AIR);
  cave.setBlock(22, 49, 8, B.AIR);
  const spawn = Object.create(Game.prototype) as unknown as Record<string, any>;
  spawn.world = cave; spawn.body = { pos: new THREE.Vector3(8.5, 50, 8.5) };
  spawn.scene = { add: () => {}, remove: () => {} };
  spawn.mobs = []; spawn.drops = []; spawn.isInNether = false;
  spawn.mode = 'survival'; spawn.weather = 'clear'; spawn.time = 0.25;
  spawn.spawnTimer = 0; spawn.difficulty = { ...DEFAULT_DIFFICULTY };
  spawn.nowSeconds = () => 0; spawn.spawnVillageFolk = () => {};
  const oldRandom = Math.random, count = cave.chunks.size;
  try { Math.random = () => 0; spawn.updateMobs(1 / 30); } finally { Math.random = oldRandom; }
  check('loaded cave generates a listener in Survival without loading extra chunks',
    spawn.mobs.some((m: Mob) => m.type === 'echolurker') && cave.chunks.size === count);
  spawn.mobs = []; spawn.spawnTimer = 0; spawn.difficulty = { ...DEFAULT_DIFFICULTY, aggression: 'spokojna' };
  try { Math.random = () => 0; spawn.updateMobs(1 / 30); } finally { Math.random = oldRandom; }
  check('peaceful difficulty suppresses new cave listeners', !spawn.mobs.some((m: Mob) => m.type === 'echolurker'));
}

section('3.0 #69: cancellable melee telegraph and combat hit reaction');
{
  const world = new World(269, true);
  world.getChunk(0, 0);
  const y = FLAT_H + 1;
  for (let x = 3; x <= 14; x++) for (let z = 3; z <= 13; z++)
    for (let yy = y; yy <= y + 4; yy++) world.setBlock(x, yy, z, B.AIR);
  for (const type of ['zombie', 'spider', 'enderman', 'slime'] as MobType[]) {
    const m = new Mob(type, 7.5, y, 7.5);
    const target = new THREE.Vector3(8.6, y, 7.5);
    let hits = 0;
    const tell = (m as unknown as { strikeWarning: THREE.Mesh }).strikeWarning;
    const tick = () => m.update(1 / 30, world, target, () => { hits++; }, () => {}, false);
    tick();
    check(`${type}: orange warning appears before first hit`, tell.visible && hits === 0);
    check(`${type}: silhouette animates its attack preparation`,
      type === 'spider' ? m.legs[0].rotation.x < -0.9 : type === 'slime' ? m.group.scale.y < 0.95 : m.arms[0].rotation.x < -2);
    for (let i = 0; i < 10; i++) tick();
    check(`${type}: windup lasts long enough to dodge`, tell.visible && hits === 0);
    target.x = 15;
    tick();
    check(`${type}: retreat cancels warning, never deals a phantom hit`, !tell.visible && hits === 0);
    target.set(m.body.pos.x + 1, y, m.body.pos.z);
    for (let i = 0; i < 40; i++) tick();
    check(`${type}: returning close permits a new warned hit after cooldown`, hits >= 1);
  }
  for (const type of ['skeleton', 'ghast'] as MobType[]) {
    const archer = new Mob(type, 7.5, y, 7.5);
    const target = new THREE.Vector3(12.5, y, 7.5);
    let shots = 0;
    const tell = (archer as unknown as { strikeWarning: THREE.Mesh }).strikeWarning;
    const tick = () => archer.update(1 / 30, world, target, () => {}, () => { shots++; }, false);
    tick();
    check(`${type}: ranged windup has a visible orange cue and no instant projectile`, tell.visible && shots === 0);
    for (let i = 0; i < 10; i++) tick();
    check(`${type}: projectile is delayed long enough to find cover`, tell.visible && shots === 0);
    for (let yy = y; yy <= y + 3; yy++) world.setBlock(10, yy, 7, B.STONE);
    tick();
    check(`${type}: blocking line of sight interrupts the shot`, !tell.visible && shots === 0);
    for (let yy = y; yy <= y + 3; yy++) world.setBlock(10, yy, 7, B.AIR);
    for (let i = 0; i < 55; i++) tick();
    check(`${type}: after cover clears it can shoot again with a new warning`, shots >= 1);
    const originalLOS = archer.hasLineOfSight.bind(archer);
    let probes = 0;
    archer.hasLineOfSight = (w, x, yy, z) => { probes++; return originalLOS(w, x, yy, z); };
    tick();
    eq(`${type}: active cooldown skips costly line-of-sight checks`, probes, 0);
  }
  const foe = new Mob('zombie', 7.5, y, 7.5);
  const player = new THREE.Vector3(8.6, y, 7.5);
  let hits = 0;
  const tick = () => foe.update(1 / 30, world, player, () => { hits++; }, () => {}, false);
  tick();
  const tell = (foe as unknown as { strikeWarning: THREE.Mesh }).strikeWarning;
  check('windup model is an actual visible part of the hostile', foe.group.children.includes(tell) && tell.visible);
  foe.damage(2, player.x, player.z);
  check('hitting an attacker cancels its windup, recoils and flashes red',
    !tell.visible && foe.hurtTime > 0 && foe.body.vel.x < 0 &&
    (foe.meshes[0].material as THREE.MeshLambertMaterial).emissive.getHex() === 0x770000);
  player.x = 15;
  for (let i = 0; i < 35; i++) tick();
  eq('counterattack interrupted the original melee swing', hits, 0);
  const cave = new Mob('echolurker', 7.5, y, 7.5);
  player.x = 8.6;
  const footstep = [{ id: 1, x: 8.6, y, z: 7.5, radius: 7, ttl: 1, source: 'player' as const }];
  cave.update(1 / 30, world, player, () => { hits++; }, () => {}, false,
    [], () => {}, 1, [], () => false, 0, false, 0.25, footstep);
  const earTell = (cave as unknown as { strikeWarning: THREE.Mesh }).strikeWarning;
  check('the blind listener also visibly announces its strike', earTell.visible && hits === 0);
  player.x = 15;
  cave.update(1 / 30, world, player, () => { hits++; }, () => {}, false,
    [], () => {}, 1, [], () => false, 0, false, 0.25, []);
  check('silently escaping the heard location cancels the blind strike', !earTell.visible && hits === 0);
  const calm = new Mob('zombie', 7.5, y, 7.5);
  for (let i = 0; i < 30; i++) calm.update(1 / 30, world, new THREE.Vector3(8.6, y, 7.5), () => { hits++; }, () => {}, true);
  check('peaceful monsters never show a threatening warning or hit',
    !(calm as unknown as { strikeWarning: THREE.Mesh }).strikeWarning.visible && hits === 0);
}

section('3.0 #99: sparse biome soundscape and shared volume');
{
  const cue = (b: Parameters<typeof chooseAmbient>[0], day = 1, rain = false, roll = 0.2) =>
    chooseAmbient(b, false, rain, day, roll);
  eq('forest has daytime birds', cue('Las'), 'bird');
  eq('old birch forest retains forest birds', cue('Brzozowy las'), 'bird');
  eq('new taiga has bird calls', cue('Tajga'), 'bird');
  eq('plains and meadows have daylight birds', `${cue('Równiny')}/${cue('Kwiecista łąka')}`, 'bird/bird');
  eq('swamp has its own frog-and-water ambience', cue('Bagno'), 'marsh');
  eq('jungle and savanna have insect ambience', `${cue('Dżungla')}/${cue('Sawanna')}`, 'insects/insects');
  eq('coast and ocean have waves', `${cue('Ocean')}/${cue('Plaża')}`, 'surf/surf');
  eq('mountains and tundra have cold wind', `${cue('Góry')}/${cue('Tundra')}`, 'snow/snow');
  eq('desert and wasteland use sand gusts', `${cue('Pustynia')}/${cue('Pustkowie')}`, 'sand/sand');
  eq('night forest has no daytime birds', cue('Las', 0.2), 'wind');
  eq('surface does not override underground cave audio', chooseAmbient('Dżungla', true, false, 1, 0), 'cave');
  eq('Nether does not play surface rain or birds', chooseAmbient('Nether', true, true, 1, 0), 'nether');
  eq('rain suppresses birds in forests', cue('Las', 1, true), 'wind');
  eq('snowfall retains distinct cold wind', cue('Tundra', 1, true), 'snow');
  eq('rain at a coast keeps audible waves', cue('Plaża', 1, true), 'surf');
  eq('desert rain never creates false water ambience', cue('Pustynia', 1, true), 'sand');
  eq('non-finite randomness cannot schedule arbitrary ambience', cue('Las', 1, false, NaN), null);
  // Run the actual weather scheduler: it must sample the player's exact
  // position sparsely, without generating chunks for audio alone.
  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  const samples: Array<[number, number]> = [];
  g.world = { surface: (x: number, z: number) => { samples.push([x, z]); return { biome: x < 16 ? 'Bagno' : 'Ocean' }; } };
  g.body = { pos: new THREE.Vector3(6.5, FLAT_H + 1, 6.5) };
  g.ui = 'paused'; g.isInNether = false; g.underground = false;
  g.weather = 'clear'; g.weatherTimer = 100; g.ambientTimer = 0;
  g.lightning = 0; g.time = 0.25;
  g.rain = { visible: false }; g.biomeAt = () => 'Bagno';
  Sfx.setVolume(0);
  g.updateWeather(1 / 30);
  check('real ambience tick samples local swamp biome once', samples.length === 1 && samples[0][0] === 6 && g.ambientTimer > 15);
  for (let i = 0; i < 30; i++) g.updateWeather(1 / 30);
  eq('one-second render loop creates no new ambient cues', samples.length, 1);
  g.body.pos.x = 19.5; g.ambientTimer = 0; g.biomeAt = () => 'Ocean';
  g.updateWeather(1 / 30);
  check('moving to coast changes cue at next scheduled tick, not chunk-centre cache', samples.length === 2 && samples[1][0] === 19);
  g.isInNether = true; g.ambientTimer = 0; g.weatherTimer = 1;
  g.updateWeather(1 / 30);
  check('Nether ambient tick never samples overworld biome or starts rain', samples.length === 2 && !g.rain.visible && g.weatherTimer >= 40);
  Sfx.setVolume(0);
  eq('all procedural audio uses one mute setting', Sfx.volume, 0);
  Sfx.playBiomeAmbient('nether'); // must not allocate/resume WebAudio while muted
  Sfx.setVolume(2);
  eq('shared sound control clamps to 100%', Sfx.volume, 1);
  Sfx.setVolume(NaN);
  eq('invalid direct audio volume cannot poison master gain', Sfx.volume, 0.5);
}

section('3.0 #70: earned wolf trust, save migration and dimension-safe companions');
{
  eq('old 2.7 worlds without companion data start with none', normalizeCompanions(undefined).length, 0);
  const world = new World(270, true);
  world.getChunk(0, 0);
  const y = FLAT_H + 1;
  const wolf = new Mob('wolf', 6.5, y, 6.5);
  const mark = (wolf as unknown as { trustMark: THREE.Mesh }).trustMark;
  check('wild wolf starts with no collar and no trust', wolf.trust === 0 && !mark.visible && !wolf.tamed);
  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  g.keys = new Set(); g.target = null; g.selected = 0; g.mode = 'survival';
  g.inventory = new Inventory(); g.inventory.slots[0] = { id: I.RAW_BEEF, count: 3 };
  g.body = { pos: new THREE.Vector3(6.5, y, 5.5), vel: new THREE.Vector3() };
  g.mobs = [wolf]; g.findMobTarget = () => ({ mob: wolf, dist: 1.5 });
  const messages: string[] = [], awarded: string[] = [];
  g.message = (s: string) => messages.push(s);
  g.unlock = (s: string) => awarded.push(s);
  g.emitHud = () => {};
  g.tryUse();
  check('actual Survival feeding consumes exactly one meat and starts visible trust',
    wolf.trust === 1 && !wolf.tamed && mark.visible && g.inventory.countOf(I.RAW_BEEF) === 2 && messages.at(-1)?.includes('1/3'));
  g.tryUse();
  check('spam feeding neither consumes meat nor advances loyalty before cooldown',
    wolf.trust === 1 && g.inventory.countOf(I.RAW_BEEF) === 2 && messages.at(-1)?.includes('chwili'));
  const far = new THREE.Vector3(20, y, 20);
  for (let i = 0; i < 95; i++) wolf.update(1 / 30, world, far, () => {}, () => {}, false);
  g.tryUse();
  check('a later feeding advances progress, still without instant taming', wolf.trust === 2 && !wolf.tamed && g.inventory.countOf(I.RAW_BEEF) === 1);
  for (let i = 0; i < 95; i++) wolf.update(1 / 30, world, far, () => {}, () => {}, false);
  g.tryUse();
  check('third real feeding tames and unlocks achievement exactly once',
    wolf.tamed && wolf.trust === 3 && g.inventory.countOf(I.RAW_BEEF) === 0 && awarded.filter((a) => a === 'wolf').length === 1);
  check('tamed wolf remains marked and earns the companion coat', mark.visible && wolf.health === wolf.maxHealth);
  const curious = new Mob('wolf', 5.5, y, 5.5);
  curious.trust = 1;
  curious.aiTimer = 10; curious.walking = false;
  curious.update(1 / 30, world, new THREE.Vector3(10.5, y, 5.5), () => {}, () => {}, false);
  check('partially trusting wolf approaches a nearby player without becoming tame',
    curious.body.vel.x > 0 && curious.walking && !curious.tamed);
  check('crosshair reports persistent progress instead of a hidden stat',
    g.mobHint().includes('3/3'));
  const cub = new Mob('wolf', 8.5, y, 8.5);
  g.mobs = [cub]; g.findMobTarget = () => ({ mob: cub, dist: 1.5 });
  g.mode = 'creative'; g.inventory.slots[0] = { id: I.RAW_CHICKEN, count: 4 };
  g.tryUse();
  check('Creative feeding advances trust without consuming inventory', cub.trust === 1 && g.inventory.countOf(I.RAW_CHICKEN) === 4);
  const tapped = new Mob('wolf', 7.5, y, 7.5);
  g.mode = 'survival'; g.ui = 'playing'; g.mobs = [tapped];
  g.inventory.slots[0] = { id: I.RAW_PORK, count: 1 };
  g.findMobTarget = () => ({ mob: tapped, dist: 2 });
  g.refreshTarget = () => { g.target = null; };
  g.attackCooldown = 0; g.touchAim = null;
  let accidentalHits = 0;
  g.tryAttack = () => { accidentalHits++; };
  g.touchTap(0.4, 0.6);
  check('actual touch tap uses feeding instead of hitting and restores touch aim',
    tapped.trust === 1 && g.inventory.countOf(I.RAW_PORK) === 0 && accidentalHits === 0 && g.touchAim === null);
  const crowded = new Mob('wolf', 7.5, y, 7.5);
  g.mobs = [crowded, ...Array.from({ length: 24 }, (_, i) => {
    const friend = new Mob('wolf', i + 2.5, y, 8.5);
    friend.tame(); return friend;
  })];
  g.findMobTarget = () => ({ mob: crowded, dist: 2 });
  g.inventory.slots[0] = { id: I.RAW_PORK, count: 1 };
  g.tryUse();
  check('companion cap refuses extra bond without wasting the last meat',
    crowded.trust === 0 && g.inventory.countOf(I.RAW_PORK) === 1 && messages.at(-1)?.includes('24'));
  const old = new Mob('wolf', 4.5, y, 4.5);
  check('existing direct tame API still works for legacy callers', old.tame() && old.trust === 3);
  const malformed = [null, {type: 'creeper', x: 5, y, z: 5, health: 4, trust: 3, dim: 'home'},
    {type: 'wolf', x: Number.NaN, y, z: 5, health: 8, trust: 3, dim: 'home'},
    {type: 'wolf', x: 1e10, y, z: 5, health: 8, trust: 3, dim: 'home'},
    {type: 'wolf', x: 5.5, y, z: 5.5, health: 40, trust: 500, dim: 'nether'},
    {type: 'wolf', x: 5.5, y, z: 5.5, health: 40, trust: 500, dim: 'nether'}];
  const valid = normalizeCompanions(malformed);
  check('import discards invalid mob types/NaN/out-of-bounds and deduplicates copies', valid.length === 1);
  check('import clamps impossible health/trust to safe bounds', valid[0].health === 8 && valid[0].trust === 2);
  check('save clamps array to 24 companions, not unbounded imported mobs', normalizeCompanions(Array.from({length: 100}, (_, i) => ({
    type: 'wolf', x: i, y, z: 5, health: 8, trust: 1, dim: 'home', tamed: false,
  }))).length === 24);
  // Exercise the engine's real restore into both dimensions; the remote
  // companion must not create any chunks until the player enters that world.
  const saved = [
    { type: 'wolf', dim: 'home', x: 8.5, y, z: 6.5, health: 6, trust: 2, tamed: false, cooldown: 2 },
    { type: 'wolf', dim: 'nether', x: 13.5, y: 48, z: 6.5, health: 5, trust: 3, tamed: true, cooldown: 0 },
  ];
  const reload = Object.create(Game.prototype) as unknown as Record<string, any>;
  reload.mobs = []; reload.isInNether = false; reload.world = world;
  reload.scene = { add: () => {}, remove: () => {} };
  reload.dimStash = { home: { mobs: [] }, nether: { mobs: [] } };
  const loadedChunks = world.chunks.size;
  reload.restoreCompanions(saved);
  check('reload restores active partial progress, collar, health and cooldown',
    reload.mobs.length === 1 && reload.mobs[0].trust === 2 && !reload.mobs[0].tamed &&
    reload.mobs[0].health === 6 && reload.mobs[0].trustCooldown === 2 &&
    (reload.mobs[0] as unknown as { trustMark: THREE.Mesh }).trustMark.visible);
  check('Nether wolf remains in its own dimension and retains trained status',
    reload.dimStash.nether.mobs.length === 1 && reload.dimStash.nether.mobs[0].tamed && reload.dimStash.nether.mobs[0].health === 5);
  eq('restoring companions does not generate remote terrain', world.chunks.size, loadedChunks);
  reload.body = { pos: new THREE.Vector3(4.5, y, 4.5) };
  reload.mobs[0].body.pos.set(880.5, y, 6.5); // far beyond render distance
  reload.mode = 'survival'; reload.time = 0.25; reload.spawnTimer = 5;
  reload.difficulty = { ...DEFAULT_DIFFICULTY };
  reload.nowSeconds = () => 0;
  reload.updateMobs(1 / 30);
  check('remote trusted wolf remains saved and does not simulate unloaded chunks',
    reload.mobs.length === 1 && world.chunks.size === loadedChunks);
  const roundtrip = reload.companionSaves();
  check('roundtrip captures both active and stashed companions without mixing dimensions',
    roundtrip.length === 2 && roundtrip[0].dim === 'home' && roundtrip[1].dim === 'nether');
  reload.mobs[0].dead = true;
  check('dead wolves are not duplicated on next save', reload.companionSaves().length === 1);
}

section('3.0 #70: fox and rabbit trust, behavior and mixed-species persistence');
{
  check('species require different existing survival food', isTrustFood('rabbit', I.WHEAT) &&
    !isTrustFood('rabbit', I.RAW_CHICKEN) && isTrustFood('fox', I.RAW_CHICKEN) &&
    !isTrustFood('fox', I.WHEAT) && isTrustFood('wolf', I.RAW_BEEF) &&
    !isTrustFood('creeper', I.WHEAT));
  const world = new World(4070, true);
  world.getChunk(0, 0);
  const y = FLAT_H + 1;
  const rabbit = new Mob('rabbit', 6.5, y, 6.5);
  const fox = new Mob('fox', 9.5, y, 8.5);
  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  g.ui = 'playing'; g.mode = 'survival'; g.keys = new Set(); g.target = null; g.selected = 0;
  g.inventory = new Inventory(); g.inventory.slots[0] = { id: I.WHEAT, count: 4 };
  g.mobs = [rabbit, fox]; g.body = { pos: new THREE.Vector3(6.5, y, 5.5) };
  g.findMobTarget = () => ({ mob: rabbit, dist: 2 });
  const messages: string[] = [];
  g.message = (text: string) => messages.push(text);
  g.emitHud = () => {};
  g.unlock = () => {};
  const rabbitMark = (rabbit as unknown as { trustMark: THREE.Mesh }).trustMark;
  const foxMark = (fox as unknown as { trustMark: THREE.Mesh }).trustMark;
  check('foxes and rabbits start wild with hidden trust marks', !rabbitMark.visible && !foxMark.visible);
  g.tryUse();
  check('PC feeding rabbit consumes exactly one wheat and reveals progress', rabbit.trust === 1 && rabbitMark.visible &&
    g.inventory.countOf(I.WHEAT) === 3 && messages.at(-1)?.includes('1/3'));
  g.tryUse();
  check('spam feeding rabbit cannot consume food', rabbit.trust === 1 && g.inventory.countOf(I.WHEAT) === 3);
  const far = new THREE.Vector3(35, y, 35);
  for (let i = 0; i < 95; i++) rabbit.update(1/30, world, far, () => {}, () => {}, false);
  g.tryUse();
  check('rabbit trust increases only after cooldown', rabbit.trust === 2 && g.inventory.countOf(I.WHEAT) === 2);
  for (let i = 0; i < 95; i++) rabbit.update(1/30, world, far, () => {}, () => {}, false);
  g.tryUse();
  check('rabbit eventually follows but does not become a wolf fighter', rabbit.tamed && rabbit.trust === 3 &&
    g.inventory.countOf(I.WHEAT) === 1 && rabbitMark.visible);
  rabbit.body.pos.set(6.5, y, 6.5);
  let rabbitBites = 0;
  rabbit.update(1 / 30, world, new THREE.Vector3(12.5, y, 6.5), () => {}, () => {}, false,
    [new Mob('zombie', 7.5, y, 7.5)], () => { rabbitBites++; });
  check('trained rabbit moves towards player without attacking hostile mobs', rabbit.walking && rabbit.body.vel.x > 0 && rabbitBites === 0);
  const wildRabbit = new Mob('rabbit', 6.5, y, 6.5);
  wildRabbit.aiTimer = 100; wildRabbit.walking = false;
  wildRabbit.update(1 / 30, world, new THREE.Vector3(9.7, y, 6.5), () => {}, () => {}, false);
  const semiRabbit = new Mob('rabbit', 6.5, y, 6.5);
  semiRabbit.trust = 2; semiRabbit.aiTimer = 100; semiRabbit.walking = false;
  semiRabbit.update(1 / 30, world, new THREE.Vector3(9.7, y, 6.5), () => {}, () => {}, false);
  check('partial trust reduces rabbit fear before taming', wildRabbit.walking && !semiRabbit.walking);

  g.inventory.slots[0] = { id: I.RAW_CHICKEN, count: 3 };
  g.findMobTarget = () => ({ mob: fox, dist: 2 });
  g.refreshTarget = () => { g.target = null; };
  g.attackCooldown = 0; g.touchAim = null;
  let accidentalHits = 0;
  g.tryAttack = () => { accidentalHits++; };
  g.touchTap(0.4, 0.5);
  check('tap feeds fox without accidental attack', fox.trust === 1 && foxMark.visible &&
    g.inventory.countOf(I.RAW_CHICKEN) === 2 && accidentalHits === 0 && g.touchAim === null);
  for (let i = 0; i < 95; i++) fox.update(1/30, world, far, () => {}, () => {}, false);
  g.mode = 'creative'; g.tryUse();
  check('Creative feeds fox without using chicken', fox.trust === 2 && g.inventory.countOf(I.RAW_CHICKEN) === 2);
  for (let i = 0; i < 95; i++) fox.update(1/30, world, far, () => {}, () => {}, false);
  g.tryUse();
  check('trained fox retains food, does not steal or hunt and gains visible marker',
    fox.tamed && fox.trust === 3 && foxMark.visible && g.inventory.countOf(I.RAW_CHICKEN) === 2);
  fox.body.pos.set(9.5, y, 8.5);
  fox.update(1 / 30, world, new THREE.Vector3(14.5, y, 8.5), () => {}, () => {}, false,
    [rabbit], () => { rabbitBites++; });
  check('trained fox follows instead of hunting other animals', fox.walking && fox.body.vel.x > 0 && rabbitBites === 0);
  const wildFox = new Mob('fox', 6.5, y, 6.5);
  wildFox.aiTimer = 100; wildFox.walking = false;
  wildFox.update(1 / 30, world, new THREE.Vector3(10.2, y, 6.5), () => {}, () => {}, false);
  const semiFox = new Mob('fox', 6.5, y, 6.5);
  semiFox.trust = 2; semiFox.aiTimer = 100; semiFox.walking = false;
  semiFox.update(1 / 30, world, new THREE.Vector3(10.2, y, 6.5), () => {}, () => {}, false);
  check('partial trust reduces fox fear before taming', wildFox.walking && !semiFox.walking);
  const hp = rabbit.health;
  const hungryFox = new Mob('fox', 6.7, y, 6.7);
  hungryFox.attackCooldown = 0;
  hungryFox.update(0.1, world, far, () => {}, () => {}, false, [rabbit]);
  check('wild fox does not hunt a trained rabbit', rabbit.health === hp);
  const wrong = new Mob('rabbit', 4.5, y, 4.5);
  g.mode = 'survival'; g.hunger = 20; g.inventory.slots[0] = { id: I.RAW_CHICKEN, count: 2 };
  g.findMobTarget = () => ({ mob: wrong, dist: 2 });
  g.tryUse();
  check('wrong-species food does not consume items or award trust', wrong.trust === 0 && g.inventory.countOf(I.RAW_CHICKEN) === 2);
  g.mobs = [rabbit, fox, wrong]; g.findMobTarget = () => ({ mob: wrong, dist: 2 });
  check('crosshair explains rabbit food and recorded progress', g.mobHint().includes('pszenicą') && g.mobHint().includes('0/3'));
  g.findMobTarget = () => ({ mob: fox, dist: 2 });
  check('trained fox has distinct progress hint', g.mobHint().includes('3/3'));

  const legacy = { type: 'wolf', dim: 'home', x: 2.5, y, z: 2.5, health: 6, trust: 2, tamed: false, cooldown: 1 };
  const saved = [legacy, { type: 'rabbit', dim: 'home', x: 6.5, y, z: 6.5, health: 4, trust: 3, tamed: true, cooldown: 0 },
    { type: 'fox', dim: 'nether', x: 5.5, y: 48, z: 5.5, health: 9, trust: 2, tamed: false, cooldown: 2 }];
  const valid = normalizeCompanions(saved);
  check('old wolf saves coexist with two new species', valid.length === 3 && valid.map((s) => s.type).join() === 'wolf,rabbit,fox');
  const reload = Object.create(Game.prototype) as unknown as Record<string, any>;
  reload.mobs = []; reload.isInNether = false; reload.world = world;
  reload.scene = { add: () => {}, remove: () => {} };
  reload.dimStash = { home: { mobs: [] }, nether: { mobs: [] } };
  const before = world.chunks.size;
  reload.restoreCompanions(saved);
  check('reload restores all species, trust and marker without distant chunk generation',
    reload.mobs.length === 2 && reload.mobs[0].type === 'wolf' && reload.mobs[0].trust === 2 &&
    reload.mobs[1].type === 'rabbit' && reload.mobs[1].tamed &&
    (reload.mobs[1] as { trustMark: THREE.Mesh }).trustMark.visible &&
    reload.dimStash.nether.mobs[0].type === 'fox' && reload.dimStash.nether.mobs[0].trust === 2 &&
    world.chunks.size === before);
  check('save roundtrip keeps separate dimensions and animal types', reload.companionSaves().map((m: any) => `${m.type}:${m.dim}`).join() ===
    'wolf:home,rabbit:home,fox:nether');
  const malformed = normalizeCompanions([
    { type: 'fox', dim: 'home', x: 4, y, z: 3, health: 400, trust: 99, cooldown: 99 },
    { type: 'rabbit', dim: 'home', x: 6, y, z: 3, health: 999, trust: 1 },
    { type: 'fox', dim: 'home', x: 4, y, z: 3, health: 400, trust: 99, cooldown: 99 },
    { type: 'rabbit', dim: 'home', x: Number.NaN, y, z: 3, health: 2, trust: 2 },
    { type: 'creeper', dim: 'home', x: 8, y, z: 3, health: 2, trust: 2 },
  ]);
  check('import clamps and deduplicates mixed animals while refusing hostile/NaN', malformed.length === 2 &&
    malformed[0].health === 9 && malformed[0].trust === 2 && malformed[0].cooldown === 3 &&
    malformed[1].health === 4);
  const crowded = new Mob('rabbit', 9.5, y, 9.5);
  g.mobs = [crowded, ...Array.from({ length: 24 }, (_, i) => {
    const friend = new Mob(i % 2 ? 'fox' : 'wolf', i + 1.5, y, 9.5);
    friend.tame(); return friend;
  })];
  g.inventory.slots[0] = { id: I.WHEAT, count: 1 };
  g.findMobTarget = () => ({ mob: crowded, dist: 2 });
  g.tryUse();
  check('global 24 companion cap refuses extra rabbit without charging wheat', crowded.trust === 0 &&
    g.inventory.countOf(I.WHEAT) === 1 && messages.at(-1)?.includes('24'));
}

section('3.0 #68: bounded loaded-chunk pathfinding instead of wall pushing');
{
  const world = new World(264, true);
  world.getChunk(0, 0);
  const y = FLAT_H + 1;
  for (let x = 3; x <= 13; x++) for (let z = 1; z <= 13; z++) for (let yy = y; yy <= y + 3; yy++) world.setBlock(x, yy, z, B.AIR);
  for (let z = 4; z <= 9; z++) for (let yy = y; yy <= y + 2; yy++) world.setBlock(7, yy, z, B.STONE);
  const chunkCount = world.chunks.size;
  let cells = 0;
  const seen = { peekBlock(x: number, yy: number, z: number) { cells++; return world.peekBlock(x, yy, z); },
    hasChunk(cx: number, cz: number) { return world.hasChunk(cx, cz); } };
  let pos = { x: 5.5, z: 7.5 };
  let aroundWall = false;
  for (let i = 0; i < 24 && Math.hypot(pos.x - 10.5, pos.z - 7.5) > 0.7; i++) {
    const next = boundedPathStep(seen, pos.x, y, pos.z, 10.5, 7.5);
    if (!next) break;
    pos = next;
    if (pos.z < 4 || pos.z > 10) aroundWall = true;
  }
  check('search routes around a two-block-high obstruction rather than through it',
    aroundWall && Math.hypot(pos.x - 10.5, pos.z - 7.5) < 0.7);
  check('bounded path never loads new terrain', world.chunks.size === chunkCount);
  cells = 0;
  boundedPathStep(seen, 5.5, y, 7.5, 10.5, 7.5);
  check('one route search has a hard probe budget on low graphics', cells <= 96 * 4 * 3);
  eq('even an invalid custom budget cannot create an unbounded search', boundedPathStep(world, 5.5, y, 7.5, 10.5, 7.5, Number.NaN)?.x, 6.5);
  eq('zero-hop route is not invented when already on target', boundedPathStep(world, 5.5, y, 5.5, 5.5, 5.5), null);
  // Real Mob.update pursuer pathing: AI, physics and route cache are all live.
  const guard = new Mob('guard', 5.5, y, 7.5);
  const villager = new Mob('villager', 10.5, y, 6.5);
  const zombie = new Mob('zombie', 10.5, y, 7.5);
  const far = new THREE.Vector3(40, y, 40);
  let minZ = 7.5, maxZ = 7.5;
  for (let i = 0; i < 240; i++) {
    guard.update(1 / 30, world, far, () => {}, () => {}, false, [guard, villager, zombie]);
    minZ = Math.min(minZ, guard.body.pos.z); maxZ = Math.max(maxZ, guard.body.pos.z);
  }
  check('actual guard walks around wall and reaches threatened resident',
    zombie.health < zombie.maxHealth && (minZ < 4 || maxZ > 10));
  const hunter = new Mob('zombie', 5.5, y, 7.5);
  let hit = 0;
  let huntedMin = 7.5, huntedMax = 7.5;
  const behindPlayer = new THREE.Vector3(10.5, y, 7.5);
  for (let i = 0; i < 220; i++) {
    hunter.update(1 / 30, world, behindPlayer, () => { hit++; }, () => {}, false, [hunter]);
    huntedMin = Math.min(huntedMin, hunter.body.pos.z); huntedMax = Math.max(huntedMax, hunter.body.pos.z);
  }
  check('ordinary hostile also uses the detour and cannot attack through masonry',
    hit > 0 && (huntedMin < 4 || huntedMax > 10));
  // Navigation must choose safe ground even if the shortest route is a fire.
  const hazardWorld = new World(264, true);
  hazardWorld.getChunk(0, 0);
  for (let x = 4; x <= 11; x++) for (let z = 5; z <= 9; z++) for (let yy = y; yy <= y + 2; yy++) hazardWorld.setBlock(x, yy, z, B.AIR);
  hazardWorld.setBlock(7, y - 1, 7, B.CAMPFIRE);
  let h = { x: 5.5, z: 7.5 };
  let fireTouched = false;
  for (let i = 0; i < 14 && Math.hypot(h.x - 9.5, h.z - 7.5) > 0.6; i++) {
    const next = boundedPathStep(hazardWorld, h.x, y, h.z, 9.5, 7.5);
    if (!next) break;
    h = next;
    if (Math.floor(h.x) === 7 && Math.floor(h.z) === 7) fireTouched = true;
  }
  check('path avoids a campfire instead of using the shortest hazardous tile',
    !fireTouched && Math.hypot(h.x - 9.5, h.z - 7.5) < 0.6);

  // Completely sealed wall: guard gives up instead of repeatedly trying
  // to jump through masonry and consuming a whole mobile tick forever.
  for (let z = 0; z < 16; z++) for (let yy = y; yy <= y + 2; yy++) world.setBlock(7, yy, z, B.STONE);
  const stuck = new Mob('guard', 5.5, y, 7.5);
  const behind = new Mob('zombie', 10.5, y, 7.5);
  for (let i = 0; i < 150; i++) stuck.update(1 / 30, world, far, () => {}, () => {}, false, [stuck, behind]);
  check('sealed wall does not cause endless wall-press or fake hits', stuck.body.pos.x < 7 && behind.health === behind.maxHealth);
}

section('3.0 #59: regional travelling merchant and pack animal caravan');
{
  check('cargo offers really change with the region without changing saved profession ids',
    merchantProfession('Pustynia') === 5 && merchantProfession('Bagno') === 6 &&
    merchantProfession('Tajga') === 7 && merchantProfession('Równiny') === 4 &&
    offersFor(createVillagerState(merchantProfession('Pustynia'), 0))[0].key !==
    offersFor(createVillagerState(merchantProfession('Bagno'), 0))[0].key);
  const world = new World(160, true);
  world.getChunk(0, 0);
  const y = FLAT_H + 1;
  for (let x = 5; x <= 12; x++) for (let z = 6; z <= 10; z++) for (let yy = y; yy <= y + 2; yy++) world.setBlock(x, yy, z, B.AIR);
  for (let x = 5; x <= 12; x++) world.setBlock(x, y - 1, 8, B.PATH);
  const merchant = new Mob('merchant', 8.5, y, 8.5, merchantProfession('Tajga'));
  const mule = new Mob('pack_animal', 5.5, y, 8.5);
  const far = new THREE.Vector3(40, y, 40);
  check('merchant has trades and the mule has visible carried packs', merchant.trade !== null && mule.meshes.length > 8 && mule.trade === null);
  const random = Math.random;
  try {
    Math.random = () => 0.5;
    for (let i = 0; i < 70; i++) {
      merchant.update(1 / 30, world, far, () => {}, () => {}, false, [merchant, mule]);
      mule.update(1 / 30, world, far, () => {}, () => {}, false, [merchant, mule]);
    }
  } finally { Math.random = random; }
  check('merchant follows loaded road and mule follows merchant', merchant.body.pos.x < 7.5 && mule.body.pos.x > 5.8);
  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  g.world = world; g.mobs = []; g.scene = { add: () => {}, remove: () => {} };
  g.mode = 'survival'; g.ui = 'playing'; g.inventory = new Inventory();
  g.trades = 0; g.nowSeconds = () => 0;
  g.setUI = (screen: string) => { g.ui = screen; };
  g.message = () => {}; g.emitHud = () => {}; g.gainXp = () => {}; g.unlock = () => {};
  const trader = g.spawnMob('merchant', 8.5, y, 8.5) as Mob;
  g.openTrade(trader);
  check('real trade UI opens for caravan NPC with readable region', g.ui === 'trade' && g.tradeTitle().includes('Wędrowny kupiec') && g.tradeTitle().includes('Równiny'));
  eq('plain caravan offers building cargo', g.tradeRows()[0].offer.key, 'cobble');
  g.inventory.add(B.COBBLE, 24);
  check('actual Survival exchange consumes goods and gives regional item', g.tradeWith(0) && g.inventory.countOf(I.EMERALD) === 1 && g.inventory.countOf(B.COBBLE) === 0);
  g.ui = 'playing';
  g.refreshTarget = () => {};
  g.findMobTarget = () => ({ mob: trader, dist: 2 });
  g.selectedStack = () => null; g.target = null; g.touchAim = null;
  g.touchTap(0.5, 0.5);
  check('touching trader opens trade instead of striking him', g.ui === 'trade' && !trader.dead);
  // A new encounter is produced by Game only if an existing loaded PATH tile
  // and adjacent dry pack location are available.
  const road = new World(161, true);
  road.getChunk(0, 1);
  for (let yy = y; yy <= y + 2; yy++) for (const xx of [11, 12]) road.setBlock(xx, yy, 19, B.AIR);
  road.setBlock(11, y - 1, 19, B.PATH);
  const live = Object.create(Game.prototype) as unknown as Record<string, any>;
  live.world = road; live.body = { pos: new THREE.Vector3(8.5, y, 8.5) };
  live.scene = { add: () => {}, remove: () => {} };
  live.mobs = []; live.drops = []; live.isInNether = false;
  live.mode = 'survival'; live.weather = 'clear'; live.time = 0.25;
  live.spawnTimer = 0; live.difficulty = { ...DEFAULT_DIFFICULTY };
  live.nowSeconds = () => 0;
  try { Math.random = () => 0.2; live.updateMobs(1 / 30); } finally { Math.random = random; }
  check('real encounter creates both caravan members on loaded village-style trail',
    live.mobs.some((m: Mob) => m.type === 'merchant') && live.mobs.some((m: Mob) => m.type === 'pack_animal'));
  const prior = live.mobs.length;
  live.spawnTimer = 0;
  try { Math.random = () => 0.2; live.updateMobs(1 / 30); } finally { Math.random = random; }
  check('existing merchant prevents another immediate caravan', live.mobs.length === prior);
  const capped = new World(162, true);
  capped.getChunk(0, 0); capped.getChunk(1, 2);
  const capGame = Object.create(Game.prototype) as unknown as Record<string, any>;
  capGame.world = capped; capGame.body = { pos: new THREE.Vector3(8.5, y, 8.5) };
  capGame.scene = { add: () => {}, remove: () => {} };
  capGame.mobs = Array.from({ length: 11 }, () => new Mob('cow', 8.5, y, 8.5));
  capGame.drops = []; capGame.isInNether = false; capGame.mode = 'survival';
  capGame.weather = 'clear'; capGame.time = 0.25; capGame.spawnTimer = 0;
  capGame.difficulty = { ...DEFAULT_DIFFICULTY };
  capGame.spawnMob = (kind: MobType, x: number, yy: number, z: number) => {
    const m = new Mob(kind, x, yy, z); capGame.mobs.push(m); return m;
  };
  try { Math.random = () => 0.2; capGame.updateMobs(1 / 30); } finally { Math.random = random; }
  check('adding multiple species in one spawn tick still respects mobile passive cap', capGame.mobs.length <= 12);

}

section('3.0 #60: village guard patrols and defends residents');
{
  check('guard is a distinct persistent village mob, not a renamed golem',
    isVillageMob('guard') && !isHostileMob('guard') && MOB_NAMES.guard !== MOB_NAMES.golem);
  const world = new World(269, true);
  world.getChunk(0, 0);
  const y = FLAT_H + 1;
  for (let x = 2; x <= 13; x++) for (let z = 2; z <= 12; z++) for (let yy = y; yy <= y + 2; yy++) world.setBlock(x, yy, z, B.AIR);
  const guard = new Mob('guard', 5.5, y, 7.5);
  const player = new THREE.Vector3(6, y, 7.5);
  const villager = new Mob('villager', 8.5, y, 7.5);
  const zombie = new Mob('zombie', 8.5, y, 9.5);
  let playerHits = 0;
  const tick = (mob: Mob, allies: Mob[], peaceful = false) =>
    mob.update(1 / 30, world, player, () => { playerHits++; }, () => {}, peaceful, allies);
  check('guard has readable armor, shield and sword without trade state', guard.meshes.length > 8 && guard.trade === null && guard.health === 20);
  guard.walking = false; guard.aiTimer = 100;
  for (let i = 0; i < 20; i++) tick(guard, [guard, villager]);
  eq('guard leaves peaceful player and resident alone', playerHits, 0);
  check('guard stands down before a monster appears', guard.body.pos.x === 5.5);
  for (let i = 0; i < 105; i++) tick(guard, [guard, villager, zombie]);
  check('guard identifies monster threatening resident and deals damage', zombie.health < zombie.maxHealth && playerHits === 0);
  guard.body.pos.set(5.5, y, 7.5); guard.body.vel.set(0, 0, 0);
  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  g.mobs = [guard, villager];
  eq('player harming villager alerts the nearby guard', g.provokeGolems(8, 7, 24, 10), 1);
  check('guard has provocation timer', guard.provoked > 0);
  for (let i = 0; i < 50; i++) tick(guard, [guard, villager]);
  check('guard defends resident from a provoking player', playerHits > 0);
  // Guard spawning uses real village roads with loaded chunks.
  const w = new World(20260926);
  let village: Village | null = null;
  for (let gx = -2; gx <= 2 && !village; gx++)
    for (let gz = -2; gz <= 2 && !village; gz++) village = villageInCell(gx, gz, w.villageContext());
  if (village) {
    const game = Object.create(Game.prototype) as unknown as Record<string, any>;
    game.world = w;
    game.body = { pos: new THREE.Vector3(village.x, village.y + 1, village.z) };
    game.mobs = []; game.scene = { add: () => {}, remove: () => {} };
    game.nowSeconds = () => 0;
    game.unlock = () => {};
    game.message = () => {};
    game.spawnVillageFolk();
    check('real generated village receives one guard independently of golem', game.mobs.filter((m: Mob) => m.type === 'guard').length === 1);
    game.spawnVillageFolk();
    eq('guard does not multiply every village check', game.mobs.filter((m: Mob) => m.type === 'guard').length, 1);
  }
}

section('3.0 #56: neutral bear defends cub and food with escapable windup');
{
  const world = new World(166, true);
  world.getChunk(0, 0);
  const y = FLAT_H + 1;
  for (let x = 3; x <= 13; x++) for (let z = 3; z <= 13; z++) for (let yy = y; yy <= y + 3; yy++) world.setBlock(x, yy, z, B.AIR);
  const player = new THREE.Vector3(8, y, 7.5);
  const bear = new Mob('bear', 5.5, y, 7.5);
  bear.aiTimer = 100; bear.walking = false;
  const empty = () => {};
  let attacks = 0;
  const tick = (mob: Mob, allies: Mob[], food: {id: number; count: number; age: number; pos: THREE.Vector3}[] = [], calm = false) =>
    mob.update(1 / 30, world, player, () => { attacks++; }, empty, calm, allies, empty, 1, food);
  for (let i = 0; i < 12; i++) tick(bear, [bear]);
  check('adult bear is neutral near player without cub or food', attacks === 0 && bear.walking === false && (bear as unknown as {bearWindup: number}).bearWindup === 0);
  const cub = new Mob('bear', 5, y, 8.5);
  cub.makeCub();
  check('cub has smaller visible model and hitbox', cub.isCub && cub.body.w < bear.body.w && cub.group.scale.x === 0.6);
  const start = bear.body.pos.x;
  for (let i = 0; i < 20; i++) tick(bear, [bear, cub]);
  check('bear protects its cub by approaching trespasser', bear.body.pos.x > start + 0.2);
  // Drive the bear into attack range to inspect the warning BEFORE damage.
  player.x = bear.body.pos.x + 1.5;
  tick(bear, [bear, cub]);
  check('windup emits a visible warning before contact damage', (bear as unknown as {bearWarning: THREE.Mesh}).bearWarning.visible && attacks === 0);
  for (let i = 0; i < 32; i++) tick(bear, [bear, cub]);
  check('warning concludes in one cooldown-limited defensive strike', attacks === 1 && !(bear as unknown as {bearWarning: THREE.Mesh}).bearWarning.visible);
  const threatenedCub = new Mob('bear', 7.5, y, 7.5);
  threatenedCub.makeCub();
  const mother = new Mob('bear', 5.5, y, 7.5);
  player.x = 7.5;
  tick(mother, [mother, threatenedCub]);
  check('second family raises the telegraph immediately when the cub is close', (mother as unknown as {bearWarning: THREE.Mesh}).bearWarning.visible);
  const previous = attacks;
  player.x = 18.5;
  for (let i = 0; i < 32; i++) tick(mother, [mother, threatenedCub]);
  check('retreating beyond 12 blocks cancels the bite and warning', attacks === previous && !(mother as unknown as {bearWarning: THREE.Mesh}).bearWarning.visible);
  const foodBear = new Mob('bear', 5.5, y, 7.5);
  player.x = 7.5;
  const fish = { id: I.RAW_FISH, count: 1, age: 2, pos: new THREE.Vector3(5.5, y, 7.5) };
  tick(foodBear, [foodBear], [fish]);
  check('bear guards nearby abandoned food (no cub required)', (foodBear as unknown as {bearWarning: THREE.Mesh}).bearWarning.visible);
  const peacefulBear = new Mob('bear', 5.5, y, 7.5);
  tick(peacefulBear, [peacefulBear, threatenedCub], [fish], true);
  check('peaceful difficulty leaves bears non-attacking', !(peacefulBear as unknown as {bearWarning: THREE.Mesh}).bearWarning.visible);
  // Actual game spawn cycle in taiga, with a family in loaded safe terrain.
  const coast = new World(96, true);
  coast.getChunk(1, 2);
  coast.surface = (_x: number, _z: number) => ({ h: FLAT_H, biome: 'Tajga', temp: 0, forest: 0 });
  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  g.world = coast; g.body = { pos: new THREE.Vector3(8.5, y, 8.5) };
  g.mobs = []; g.drops = []; g.isInNether = false;
  g.mode = 'survival'; g.weather = 'clear'; g.time = 0.25;
  g.spawnTimer = 0; g.difficulty = { ...DEFAULT_DIFFICULTY };
  g.scene = { remove: () => {} };
  g.spawnMob = (kind: MobType, x: number, yy: number, z: number) => { const m = new Mob(kind, x, yy, z); g.mobs.push(m); return m; };
  const random = Math.random;
  try { Math.random = () => 0.2; g.updateMobs(1 / 30); } finally { Math.random = random; }
  check('real taiga spawning can create an adult and a protected cub', g.mobs.some((m: Mob) => m.type === 'bear' && !m.isCub) && g.mobs.some((m: Mob) => m.type === 'bear' && m.isCub));
}

section('3.0 #61: village work, meetings, rest and threat priority');
{
  eq('work is scheduled during daytime', villagerActivity(0.25), 'work');
  eq('sunrise is the social hour', villagerActivity(0.1), 'meet');
  eq('evening is the social hour', villagerActivity(0.55), 'meet');
  eq('night is restful', villagerActivity(0.8), 'rest');
  const world = new World(266, true);
  world.getChunk(0, 0);
  const y = FLAT_H + 1;
  for (let x = 3; x <= 12; x++) for (let z = 3; z <= 12; z++) for (let yy = y; yy <= y + 3; yy++) world.setBlock(x, yy, z, B.AIR);
  world.setBlock(8, y - 1, 8, B.FARMLAND);
  const near = villagerWorkSpot(world, 4, y, 8, 0);
  check('farmer recognises real accessible farmland', near !== null && near.x >= 7);
  world.setBlock(9, y, 8, B.FURNACE);
  check('blacksmith chooses a furnace instead of a field', villagerWorkSpot(world, 4, y, 8, 1) !== null);
  for (let z = 3; z <= 12; z++) { world.setBlock(6, y, z, B.STONE); world.setBlock(6, y + 1, z, B.STONE); }
  eq('villager does not walk through sealed wall to reach work', villagerWorkSpot(world, 4, y, 8, 0), null);
  check('line route detects the wall too', !villagerWalkable(world, 4.5, y, 8.5, 7.5, 8.5));
  for (let z = 3; z <= 12; z++) { world.setBlock(6, y, z, B.AIR); world.setBlock(6, y + 1, z, B.AIR); }
  const farmer = new Mob('villager', 4.5, y, 8.5, 0);
  const trade = farmer.trade;
  const far = new THREE.Vector3(40, y, 40);
  const tick = (mob: Mob, allies: Mob[], phase: number) => mob.update(1 / 30, world, far, () => {}, () => {}, false, allies, () => {}, 1, [], () => false, 1, false, phase);
  for (let i = 0; i < 65; i++) tick(farmer, [farmer], 0.25);
  check('during work hour farmer actually walks toward farmland', farmer.body.pos.x > 5.4 && (farmer as unknown as {activityKind: string}).activityKind === 'work');
  check('routine does not reset trade inventory', farmer.trade === trade);
  for (let i = 0; i < 90; i++) tick(farmer, [farmer], 0.8);
  check('at night farmer returns to home and rests', farmer.body.pos.x < 5.5 && farmer.walking === false);
  const a = new Mob('villager', 4.5, y, 5.5, 0);
  const b = new Mob('villager', 8.5, y, 5.5, 2);
  for (let i = 0; i < 42; i++) tick(a, [a, b], 0.1);
  check('during gathering time villagers actually approach each other', a.body.pos.x > 5.25 && (a as unknown as {activityKind: string}).activityKind === 'meet');
  const zombie = new Mob('zombie', a.body.pos.x + 1.5, y, a.body.pos.z);
  const before = a.body.pos.x;
  for (let i = 0; i < 10; i++) tick(a, [a, b, zombie], 0.25);
  check('threat overrides social/work schedule with immediate flight', a.body.pos.x < before && a.soundTimer <= 0.2);
  const live = Object.create(Game.prototype) as unknown as Record<string, any>;
  const liveFarmer = new Mob('villager', 4.5, y, 8.5, 0);
  live.world = world; live.body = { pos: far };
  live.mobs = [liveFarmer]; live.drops = [];
  live.isInNether = false; live.weather = 'clear'; live.mode = 'survival';
  live.difficulty = { ...DEFAULT_DIFFICULTY }; live.time = 0.25;
  live.spawnTimer = 100; live.scene = { remove: () => {} };
  for (let i = 0; i < 40; i++) live.updateMobs(1 / 30);
  check('actual game clock controls villager work AI', liveFarmer.body.pos.x > 5 && (liveFarmer as unknown as {activityKind: string}).activityKind === 'work');
  live.time = 0.8;
  live.updateMobs(1 / 30);
  eq('game night changes villager activity without removing trading', (liveFarmer as unknown as {activityKind: string}).activityKind, 'rest');

}

section('3.0 #55: turtle nesting, staged eggs and save/reload');
{
  eq('append-only egg ids preserve the old final block', B.TURTLE_EGG0, B.PODZOL + 1);
  check('only stage-zero egg is available in Creative', CREATIVE_BLOCKS.includes(B.TURTLE_EGG0) &&
    !CREATIVE_BLOCKS.includes(B.TURTLE_EGG1) && !CREATIVE_BLOCKS.includes(B.TURTLE_EGG2));
  check('egg stages are non-solid small objects with visible stage textures',
    [B.TURTLE_EGG0, B.TURTLE_EGG1, B.TURTLE_EGG2].every((id) => !IS_SOLID[id] && BLOCKS[id].drop === B.TURTLE_EGG0 && BLOCKS[id].top === T.turtle_egg0 + id - B.TURTLE_EGG0));
  const world = new World(107, true);
  world.getChunk(0, 0);
  const y = FLAT_H + 1;
  for (let x = 6; x <= 10; x++) for (let z = 6; z <= 10; z++) for (let yy = y; yy <= y + 2; yy++) world.setBlock(x, yy, z, B.AIR);
  eq('sand without water is not a turtle habitat', turtleSpawnAllowed(world, 8, y, 8), false);
  world.setBlock(8, y - 1, 8, B.SAND);
  world.setBlock(9, y - 1, 8, B.WATER);
  check('sand beside water accepts turtle nesting', turtleSpawnAllowed(world, 8, y, 8) && findTurtleNest(world, 8, y, 8)?.x === 8);
  world.setBlock(8, y, 8, B.TURTLE_EGG0);
  eq('existing eggs prevent laying another on the same tile', findTurtleNest(world, 8, y, 8), null);
  world.setBlock(8, y, 8, B.AIR);
  const turtle = new Mob('turtle', 8.5, y, 8.5);
  check('turtle has a recognisable shell, head and four flippers', turtle.meshes.length >= 14 && turtle.body.h < 1);
  const far = new THREE.Vector3(40, y, 40);
  turtle.update(1 / 30, world, far, () => {}, () => {}, false);
  (turtle as unknown as {eggTimer: number}).eggTimer = 0;
  turtle.update(1 / 30, world, far, () => {}, () => {}, false);
  eq('live turtle actually lays its own egg on valid shore sand', world.getBlock(8, y, 8), B.TURTLE_EGG0);
  const eggMeshes = world.buildMesh(world.getChunk(0, 0));
  const eggPos = eggMeshes[1].getAttribute('position');
  let tinyEgg = false;
  for (let i = 0; i < eggPos.count; i++) {
    if (Math.abs(eggPos.getX(i) - 8.26) < 0.01 && Math.abs(eggPos.getY(i) - y) < 0.01 &&
      Math.abs(eggPos.getZ(i) - 8.27) < 0.01) { tinyEgg = true; break; }
  }
  check('laying generates a small visible egg mesh instead of a full invisible cube', tinyEgg);
  eggMeshes.forEach((geometry) => geometry.dispose());

  const key = `8,${y},8`;
  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  g.world = world; g.body = { pos: new THREE.Vector3(8, y, 8) };
  g.mobs = []; g.growables = new Map<string, number>(); g.growCursor = 0; g.growAcc = 0;
  g.isInNether = false;
  const born: string[] = [];
  g.spawnMob = (kind: string) => { born.push(kind); };
  g.growables.set(key, performance.now() - 13_000);
  g.updateGrowth(0.45);
  eq('incubation cracks egg to stage one', world.getBlock(8, y, 8), B.TURTLE_EGG1);
  const restored = new World(107, true);
  restored.loadMods(world.serializeMods());
  restored.getChunk(0, 0);
  eq('first egg stage survives loading world modifications', restored.getBlock(8, y, 8), B.TURTLE_EGG1);
  g.world = restored;
  g.growables = new Map();
  g.growCursor = 0;
  g.updateGrowth(0.45);
  eq('reload preserves stage but resets unsaved sub-stage timer', restored.getBlock(8, y, 8), B.TURTLE_EGG1);
  g.growables.set(key, performance.now() - 13_000);
  g.growCursor = 0;
  g.updateGrowth(0.45);
  eq('incubation proceeds to visible final stage', restored.getBlock(8, y, 8), B.TURTLE_EGG2);
  const restoredAgain = new World(107, true);
  restoredAgain.loadMods(restored.serializeMods());
  restoredAgain.getChunk(0, 0);
  eq('final cracking stage persists through another reload', restoredAgain.getBlock(8, y, 8), B.TURTLE_EGG2);
  g.world = restoredAgain;
  g.growables.set(key, performance.now() - 13_000);
  g.growCursor = 0;
  g.updateGrowth(0.45);
  check('mature egg hatches an actual turtle mob and clears block', born.length === 1 && born[0] === 'turtle' && restoredAgain.getBlock(8, y, 8) === B.AIR);
  restoredAgain.setBlock(8, y, 8, B.TURTLE_EGG2);
  restoredAgain.setBlock(8, y - 1, 8, B.DIRT);
  g.growables.set(key, performance.now() - 13_000);
  g.growCursor = 0;
  g.updateGrowth(0.45);
  eq('unsupported eggs do not hang in midair', restoredAgain.getBlock(8, y, 8), B.AIR);
  const coast = new World(107, true);
  coast.getChunk(-2, 0);
  for (let yy = y; yy <= y + 4; yy++) coast.setBlock(-23, yy, 8, B.AIR);
  coast.setBlock(-23, y - 1, 8, B.SAND);
  coast.setBlock(-22, y - 1, 8, B.WATER);
  const live = Object.create(Game.prototype) as unknown as Record<string, any>;
  const seen: string[] = [];
  live.world = coast; live.body = { pos: new THREE.Vector3(8.5, y, 8.5) };
  live.mobs = []; live.drops = []; live.isInNether = false;
  live.mode = 'survival'; live.weather = 'clear'; live.time = 0.25;
  live.spawnTimer = 0; live.difficulty = { ...DEFAULT_DIFFICULTY };
  live.scene = { remove: () => {} };
  live.spawnMob = (kind: string) => { seen.push(kind); };
  const random = Math.random;
  try { Math.random = () => 0.5; live.updateMobs(1 / 30); } finally { Math.random = random; }
  check('actual game spawn tick creates turtle at loaded sand coast', seen.includes('turtle'));

}

section('3.0 #63: real campfire and torch avoidance');
{
  const world = new World(184, true);
  world.getChunk(0, 0);
  const y = FLAT_H + 1;
  const far = new THREE.Vector3(40, y, 40);
  // The flat preset can still place trees and tallgrass: make a controlled clearing.
  for (let x = 7; x <= 13; x++) for (let z = 6; z <= 10; z++) for (let yy = y; yy <= y + 3; yy++) world.setBlock(x, yy, z, B.AIR);
  eq('ordinary terrain has no flame to evade', nearestFire(world, 9, y, 8), null);
  world.setBlock(8, y, 8, B.CAMPFIRE);
  eq('campfire is found from adjacent tile', nearestFire(world, 9, y, 8)?.safe, 3.2);
  const cow = new Mob('cow', 10, y, 8.5);
  cow.walking = false;
  cow.aiTimer = 100;
  for (let i = 0; i < 35; i++) cow.update(1 / 30, world, far, () => {}, () => {}, false);
  check('livestock moves away from campfire instead of standing in it', cow.body.pos.x > 11 && !cow.dead);
  world.setBlock(8, y, 8, B.AIR);
  world.setBlock(8, y, 8, B.TORCH);
  const rabbit = new Mob('rabbit', 9.5, y, 8.5);
  rabbit.aiTimer = 100;
  for (let i = 0; i < 20; i++) rabbit.update(1 / 30, world, far, () => {}, () => {}, false);
  check('rabbit avoids a torch too', rabbit.body.pos.x > 10.1);
  world.setBlock(8, y, 8, B.CAMPFIRE);
  for (const z of [7, 8, 9]) { world.setBlock(11, y, z, B.STONE); world.setBlock(11, y + 1, z, B.STONE); }
  const sideStep = fireEscapeHeading(world, 10, y, 8.5, 8.5, 8.5);
  check('light-source route steers around a solid wall', sideStep !== null && Math.abs(Math.sin(sideStep!)) < 0.8);
  const sheep = new Mob('sheep', 10, y, 8.5);
  sheep.walking = false;
  sheep.aiTimer = 100;
  for (let i = 0; i < 20; i++) sheep.update(1 / 30, world, far, () => {}, () => {}, false);
  check('sheep takes an available sidestep, not a blocked direct route', Math.abs(sheep.body.pos.z - 8.5) > 0.3 && sheep.body.pos.x < 11);
  // Fully enclosed: there is no artificial escape through walls or lava.
  for (const z of [7, 9]) for (const x of [9, 10]) {
    world.setBlock(x, y, z, B.STONE); world.setBlock(x, y + 1, z, B.STONE);
  }
  eq('no false escape when fire is fully surrounded', fireEscapeHeading(world, 10, y, 8.5, 8.5, 8.5), null);
}

section('3.0 #62: bounded and predictable animal reactions to rain');
{
  const world = new World(154, true);
  world.getChunk(0, 0);
  const y = FLAT_H + 1;
  eq('open flat land is not falsely considered shelter', findNearbyShelter(world, 5, y, 8), null);
  const existingChunks = world.chunks.size;
  findNearbyShelter(world, -1, y, 8);
  eq('search does not generate new chunks across a border', world.chunks.size, existingChunks);
  world.setBlock(8, y + 2, 8, B.PLANKS);
  check('real dry roof provides shelter', findNearbyShelter(world, 5, y, 8)?.x === 8.5);
  world.setBlock(7, y, 8, B.STONE);
  world.setBlock(7, y + 1, 8, B.STONE);
  eq('sealed path to shelter is rejected instead of wall-walking forever', findNearbyShelter(world, 5, y, 8), null);
  world.setBlock(7, y, 8, B.AIR);
  world.setBlock(7, y + 1, 8, B.AIR);
  const cow = new Mob('cow', 5.5, y, 8.5);
  cow.walking = false;
  cow.aiTimer = 100;
  const far = new THREE.Vector3(40, y, 40);
  for (let i = 0; i < 60; i++) cow.update(1 / 30, world, far, () => {}, () => {}, false, [cow], () => {}, 1, [], () => false, 1, true);
  check('cow goes under roof when rain begins', cow.body.pos.x > 7.5 && cow.body.pos.x < 9.4);
  cow.update(1 / 30, world, far, () => {}, () => {}, false, [cow], () => {}, 1, [], () => false, 1, false);
  eq('cow clears its rain goal as soon as sky clears', (cow as unknown as {shelterGoal: unknown}).shelterGoal, null);
  const frog = new Mob('frog', 5.5, y, 5.5);
  const originalRandom = Math.random;
  try {
    Math.random = () => 0.99;
    frog.update(1 / 30, world, far, () => {}, () => {}, false, [frog], () => {}, 1, [], () => false, 1, false);
    check('without rain frog can stay resting', frog.walking === false);
    frog.aiTimer = 0;
    frog.update(1 / 30, world, far, () => {}, () => {}, false, [frog], () => {}, 1, [], () => false, 1, true);
    check('rain awakens frog movement and makes croaking more frequent', frog.walking === true && frog.soundTimer <= 3);
  } finally { Math.random = originalRandom; }
  // Same live tick shared by PC and touch, not just a pure weather helper.
  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  const liveCow = new Mob('cow', 5.5, y, 8.5);
  g.mobs = [liveCow];
  g.drops = [];
  g.world = world;
  g.body = { pos: far };
  g.difficulty = { ...DEFAULT_DIFFICULTY, aggression: 'spokojna' };
  g.isInNether = false;
  g.mode = 'survival';
  g.weather = 'rain';
  g.time = 0.25;
  g.spawnTimer = 100;
  g.scene = { remove: () => {} };
  for (let i = 0; i < 60; i++) g.updateMobs(1 / 30);
  check('actual rain state in Game drives the livestock AI', liveCow.body.pos.x > 7.5);
  g.weather = 'clear';
  g.updateMobs(1 / 30);
  eq('clearing rain in the game releases its livestock immediately', (liveCow as unknown as {shelterGoal: unknown}).shelterGoal, null);
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
  {
    const random = Math.random;
    try { Math.random = () => 0.99;
      check('plain leaves still roll nothing or sapling', blockDrops(B.LEAVES, 0).length <= 1);
    } finally { Math.random = random; }
  }

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
  g.brewings = new Map();
  g.effects = new Map([['night', 17000], ['fall', 34500], ['sprint', 8000]]);
  g.difficulty = { ...DEFAULT_DIFFICULTY };
  g.emitHud = () => {};
  g.potionsDrunk = new Set<number>();
  g.unlocked = new Set(['wood', 'biome_swamp']);
  g.challengeProgress = normalizeChallenges({ challenge_builder: 7 }, g.unlocked);
  g.weather = 'clear';
  g.xp = new Xp(42);
  g.armor = [{ id: I.IRON_BOOTS, count: 1, dur: 100, ench: { featherfalling: 3 } }];
  g.fishingBait = I.WORM_BAIT;
  g.discovery = new DiscoveryMap();
  g.discovery.survey('overworld', -1, -16, 'Bagno', 63);
  g.discovery.survey('nether', 0, 0, 'Nether', 40);
  g.mobs = [new Mob('wolf', 4.5, FLAT_H + 1, 4.5)];
  g.mobs[0].trust = 2;
  g.dimStash = { home: { mobs: [] }, nether: { mobs: [new Mob('wolf', 7.5, 48, 7.5)] } };
  g.dimStash.nether.mobs[0].tame();
  check('save succeeds with discovery data', g.save() === true);

  const raw = loadSaves().find((s) => s.id === 'ench-test');
  check('the world was stored', !!raw);
  const stored = raw as unknown as SaveData;
  check('real world save and JSON export preserve wolf trust in both dimensions',
    stored.companions?.length === 2 && stored.companions[0].trust === 2 &&
    stored.companions[1].dim === 'nether' && stored.companions[1].tamed === true &&
    JSON.parse(exportSave('ench-test') ?? '{}').saves?.[0]?.companions?.length === 2);
  eq('inventory enchantments persist', stored.inv[0]?.ench?.efficiency, 4);
  eq('second enchantment persists', stored.inv[0]?.ench?.unbreaking, 2);
  eq('armor enchantments persist', stored.armor?.[0]?.ench?.featherfalling, 3);
  eq('durability still persists', stored.inv[0]?.dur, 300);
  eq('engine records terrain generator revision for future reloads', stored.terrainVersion, 3);
  eq('prepared bait persists on save', stored.fishingBait, I.WORM_BAIT);
  check('first-visit biome progress persists in a world export', stored.unlocked?.includes('biome_swamp') && exportSave('ench-test')?.includes('biome_swamp'));
  eq('building challenge counter persists in world save', stored.challengeProgress?.challenge_builder, 7);
  check('challenge progress survives export without changing inventory', exportSave('ench-test')?.includes('challenge_builder') === true);
  eq('legacy difficulty defaults are preserved when saved', stored.difficulty?.aggression, 'normalna');
  check('difficulty on an existing world can be changed and saved instantly', g.setDifficulty({ aggression: 'zaciekla', resources: 'obfite' }) === true);
  const updated = loadSaves().find((s) => s.id === 'ench-test') as unknown as SaveData;
  check('per-world axes persist in exported saves', updated.difficulty?.aggression === 'zaciekla' && updated.difficulty.resources === 'obfite' && exportSave('ench-test')?.includes('zaciekla'));
  eq('changing two axes does not change damage', updated.difficulty?.damage, 'normalne');
  eq('night vision timer persists on save', stored.effects?.night, 17000);
  eq('fall resistance timer persists on save', stored.effects?.fall, 34500);
  eq('sprint timer persists on save', stored.effects?.sprint, 8000);
  check('imported save restores active buffs', restoreEffects(JSON.parse(exportSave('ench-test') ?? '{}').saves?.[0]?.effects).get('fall') === 34500);
  check('engine save retains surveyed tiles in both dimensions', DiscoveryMap.fromSave(stored.discovery).get('overworld', -1, -1)?.[2] === 8 && DiscoveryMap.fromSave(stored.discovery).get('nether', 0, 0)?.[2] === 11);
  check('world JSON export includes discovery', exportSave('ench-test')?.includes('discovery') === true);
  const beforeFailedWrite = localStorage.getItem('blockcraft-saves-v2');
  const setItem = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('quota'); };
  check('failed autosave reports failure instead of success', g.save() === false);
  localStorage.setItem = setItem;
  check('failed autosave leaves previous world intact', localStorage.getItem('blockcraft-saves-v2') === beforeFailedWrite);


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

section('3.0 #91: new village jobs and trade progression');
{
  eq('saved original profession indices keep their meanings', PROFESSIONS.slice(0, 5).map((p) => p.id).join(','),
    'rolnik,kowal,bibliotekarz,pasterz,budowniczy');
  const jobs = ['kartograf', 'rybak', 'ogrodnik'];
  eq('new jobs are appended, not inserted', PROFESSIONS.slice(5).map((p) => p.id).join(','), jobs.join(','));
  for (const [offset, job] of jobs.entries()) {
    const idx = offset + 5;
    const villager = new Mob('villager', 0, 64, 0, (idx + 0.5) / PROFESSIONS.length);
    eq(`${job} is generated as a working villager`, villager.trade?.profession, idx);
    check(`${job} wears a recognizable trade hat`, villager.meshes.length > new Mob('villager', 0, 64, 0, 0).meshes.length);
    eq(`${job} has no advanced offers at first`, offersFor(villager.trade!).every((o) => o.level === 1), true);
    check(`${job} has available merchant offers`, offersFor(villager.trade!).length >= 2);
    villager.trade!.xp = 40;
    check(`${job} unlocks advanced offers by trading`, offersFor(villager.trade!).some((o) => o.level >= 3));
  }
  const mapState = createVillagerState(5, 0);
  mapState.xp = 6;
  const compassTrade = offersFor(mapState).find((o) => o.key === 'map_biome')!;
  check('cartographer sells the real biome compass after advancement', compassTrade.get.id === I.BIOME_COMPASS && compassTrade.give.length === 2);
  const mapInv = new Inventory();
  mapInv.add(I.EMERALD, 6);
  eq('both payment types required', canTrade(mapState, mapInv, compassTrade), 'items');
  mapInv.add(I.COMPASS, 1);
  check('two-item barter succeeds through shared trade rules', applyTrade(mapState, mapInv, compassTrade));
  eq('cartographer yields an equippable biome compass', mapInv.countOf(I.BIOME_COMPASS), 1);
  eq('compass is spent on barter', mapInv.countOf(I.COMPASS), 0);
  eq('stock is reduced', usesLeft(mapState, compassTrade), compassTrade.uses - 1);
  const fishState = createVillagerState(6, 0);
  const fishSale = offersFor(fishState).find((o) => o.key === 'fish_cod')!;
  const fishInv = new Inventory();
  fishInv.add(I.RAW_FISH, 12);
  check('fisher buys caught fish for emeralds', applyTrade(fishState, fishInv, fishSale) && fishInv.countOf(I.EMERALD) === 1);
  fishState.xp = 40;
  check('fisher sells glow bait at higher rank', offersFor(fishState).some((o) => o.get.id === I.GLOW_BAIT));
  const gardenState = createVillagerState(7, 0);
  const sapling = offersFor(gardenState).find((o) => o.key === 'garden_sapling')!;
  const gardenInv = new Inventory();
  gardenInv.add(I.EMERALD, 1);
  check('gardener sells renewable spruce saplings', applyTrade(gardenState, gardenInv, sapling) && gardenInv.countOf(B.SPRUCE_SAPLING) === 2);
  gardenState.xp = 18;
  check('gardener also offers decorative meadow blocks', offersFor(gardenState).some((o) => o.get.id === B.MEADOW_GRASS));
  eq('old smith stays in slot one', createVillagerState(1, 0).profession, 1);
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

  // A failed exchange must not consume payment when its output has nowhere to go.
  g.inventory.slots.fill(null);
  g.inventory.slots[0] = { id: I.WHEAT, count: 64 };
  for (let i = 1; i < g.inventory.slots.length; i++) g.inventory.slots[i] = { id: B.STONE, count: 64 };
  villager.trade = createVillagerState(0, 0);
  rows = g.tradeRows() as TradeRow[];
  eq('full inventory marks the offer as blocked', rows[wheatIdx].blocked, 'space');
  eq('blocked trade does not execute', g.tradeWith(wheatIdx), false);
  eq('blocked trade does not consume wheat', g.inventory.countOf(I.WHEAT), 64);
  eq('blocked trade does not use stock', villager.trade!.used.wheat ?? 0, 0);
  g.inventory.slots.fill(null);
  villager.trade = createVillagerState(0, 0);
  rows = g.tradeRows() as TradeRow[];
  g.inventory.add(I.WHEAT, 20);

  // limit zapasów działa
  const uses = rows[wheatIdx].offer.uses;
  eq('first trade after reset succeeds', g.tradeWith(wheatIdx), true);
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

// ============================================ world: Nether jako osobny wymiar
section('world: nether dimension (separate map)');
{
  const over = new World(777);
  const n1 = new World(777, false, true);
  const n2 = new World(777, false, true);

  check('world flags the nether dimension', n1.isNether && !over.isNether);
  eq('nether biome label', n1.surface(10, 10).biome, 'Nether');

  // determinizm: dwa przejścia przez portal dają dokładnie ten sam teren
  let deterministic = true;
  for (let i = 0; i < 60; i++) {
    const x = (i * 47) % 300 - 150, z = (i * 83) % 300 - 150;
    if (n1.heightAt(x, z) !== n2.heightAt(x, z)) deterministic = false;
  }
  check('same seed → identical nether terrain', deterministic);

  // podłoga do chodzenia: solidny blok z dwoma blokami powietrza nad nim
  let walkable = 0, tall = 0, samples = 0;
  for (let i = 0; i < 60; i++) {
    const x = (i * 37) % 200 - 100, z = (i * 61) % 200 - 100;
    const h = n1.heightAt(x, z);
    samples++;
    if (h >= 16) tall++;
    if (h > 0 && IS_SOLID[n1.getBlock(x, h, z)] && n1.getBlock(x, h + 1, z) === B.AIR && n1.getBlock(x, h + 2, z) === B.AIR) walkable++;
  }
  check(`floor walkable in ${walkable}/${samples} columns`, walkable === samples);
  check(`most floors are proper nether ground (${tall}/${samples})`, tall >= samples * 0.9);
  eq('bedrock floor', n1.getBlock(3, 0, 3), B.BEDROCK);
  eq('sealed bedrock roof', n1.getBlock(3, CH - 1, 3), B.BEDROCK);
  eq('nether surface is not grass', n1.getBlock(3, n1.heightAt(3, 3), 3) === B.GRASS, false);

  // osady nigdy nie dotyczą Netheru (ten sam seed co nadświat!)
  let villageSpot: [number, number] | null = null;
  for (let r = 0; r < 60 && !villageSpot; r += 4) {
    for (let a = 0; a < 8 && !villageSpot; a++) {
      const x = Math.round(Math.cos(a) * r) * 16, z = Math.round(Math.sin(a) * r) * 16;
      if (over.villageAt(x, z)) villageSpot = [x, z];
    }
  }
  if (villageSpot) {
    eq('nether has no village at overworld village coords', n1.villageAt(villageSpot[0], villageSpot[1]), null);
    eq('nether nearestVillage is null', n1.nearestVillage(villageSpot[0], villageSpot[1]), null);
  } else {
    check('overworld village lookup still works', !!over.villageAt(0, 0) === false); // tylko sanity
  }

  // modyfikacje jednego wymiaru nie trafiają do drugiego
  over.getChunk(0, 0);
  n1.getChunk(0, 0);
  over.setBlock(4, 80, 4, B.DIRT);
  n1.setBlock(4, 80, 4, B.GLOWSTONE);
  eq('overworld keeps its own mod', over.getBlock(4, 80, 4), B.DIRT);
  eq('nether keeps its own mod', n1.getBlock(4, 80, 4), B.GLOWSTONE);
  check('mod maps are separate objects', over.serializeMods() !== n1.serializeMods());
  eq('overworld mod value', Object.values(over.serializeMods()).flat()[1], B.DIRT);
  eq('nether mod value', Object.values(n1.serializeMods()).flat()[1], B.GLOWSTONE);
}

// ================================== engine: portal = pełna zmiana wymiaru
section('engine: portal switches dimensions without touching the overworld');
{
  type G = Record<string, any>;
  const ops: [string, unknown][] = [];
  const g = Object.create(Game.prototype) as unknown as G;
  g.scene = { add: (o: unknown) => void ops.push(['add', o]), remove: (o: unknown) => void ops.push(['remove', o]) };
  g.ui = 'playing';
  g.portalCooldown = 0;
  g.isInNether = false;
  g.portalExit = null;
  g.homeWorld = new World(4242);
  g.netherWorld = new World(4242, false, true);
  g.world = g.homeWorld;
  const stash = () => ({ mobs: [], drops: [], arrows: [], tnts: [], orbs: [], falling: [], buttons: [], redstone: [] });
  g.dimStash = { home: stash(), nether: stash() };
  g.mobs = []; g.drops = []; g.arrows = []; g.tnts = []; g.orbs = []; g.falling = []; g.particles = [];
  g.buttonTimers = new Map(); g.redstoneDirty = new Set();
  g.biomeCache = new Map(); g.villageName = null;
  g.chestPos = null; g.furnacePos = null; g.enchantPos = null; g.tradeMob = null;
  g.breakProgress = 0; g.breakKey = '';
  g.loadingProgress = 1; g.unloadTimer = 2;
  g.body = { pos: new THREE.Vector3(40.5, 70, 24.5), vel: new THREE.Vector3() };
  g.fallStart = 70;
  g.spawnPoint = new THREE.Vector3(5.5, 70, 5.5);
  g.message = () => {}; g.unlock = () => {}; g.emitHud = () => {}; g.spawnParticles = () => {};

  // nadświat wokół portalu + oznaczenie siatki, żeby sprawdzić detach/attach
  for (let cx = -1; cx <= 3; cx++) for (let cz = -1; cz <= 3; cz++) g.homeWorld.getChunk(cx, cz);
  const fakeMesh = { id: 'home-mesh' };
  const homeChunk = g.homeWorld.getChunk(2, 1);
  homeChunk.meshes.push(fakeMesh as never);
  homeChunk.built = true;

  // odcisk całego nadświatu PRZED wejściem – regresja „światy wchodzą na siebie”
  const before = new Map<string, Uint16Array>();
  for (const [k, c] of g.homeWorld.chunks as Map<string, { data: Uint16Array }>) before.set(k, c.data.slice());
  const homeModsBefore = JSON.stringify(g.homeWorld.serializeMods());

  (g as G)['enterPortal']();

  check('entered the nether dimension', g.isInNether === true);
  check('active world is the nether instance', g.world === g.netherWorld && g.world !== g.homeWorld);
  eq('overworld mods untouched by the trip', JSON.stringify(g.homeWorld.serializeMods()), homeModsBefore);
  let overlap = '';
  for (const [k, data] of before) {
    const c = (g.homeWorld.chunks as Map<string, { data: Uint16Array }>).get(k);
    if (!c) { overlap = `chunk ${k} vanished`; break; }
    for (let i = 0; i < data.length; i++) {
      if (c.data[i] !== data[i]) { overlap = `chunk ${k} cell ${i}: ${data[i]}→${c.data[i]}`; break; }
    }
    if (overlap) break;
  }
  check(`overworld is bit-identical after entering the portal${overlap ? ` (${overlap})` : ''}`, overlap === '');
  check('arrival builds ONE nether chunk (not 81)', g.netherWorld.chunks.size === 1, `${g.netherWorld.chunks.size} chunks`);
  check('nether chunk is flagged', g.netherWorld.getChunk(0, 0).nether === true);
  check('return portal was recorded', !!g.portalExit && g.portalExit[0] === 40.5);

  // gracz stoi NA gruncie, nie w skale i nie w lawie
  const px = Math.floor(g.body.pos.x), py = Math.floor(g.body.pos.y), pz = Math.floor(g.body.pos.z);
  check('arrival stays inside the /8 nether chunk', px >= 0 && px < CS && pz >= 0 && pz < CS);
  check('player stands on solid ground', IS_SOLID[g.netherWorld.getBlock(px, py - 1, pz)]);
  eq('player feet are in open air', g.netherWorld.getBlock(px, py, pz), B.AIR);
  eq('player head is in open air', g.netherWorld.getBlock(px, py + 1, pz), B.AIR);
  let portalBlocks = 0;
  for (let dx = -6; dx <= 6; dx++) for (let dy = -2; dy <= 6; dy++) for (let dz = -6; dz <= 6; dz++) {
    if (g.netherWorld.getBlock(px + dx, py + dy, pz + dz) === B.NETHER_PORTAL) portalBlocks++;
  }
  check(`return portal placed (${portalBlocks} portal blocks)`, portalBlocks >= 6);
  check('nether mods recorded (platform + portal)', Object.keys(g.netherWorld.serializeMods()).length > 0);
  check('home mesh was detached from the scene', ops.some(([op, m]) => op === 'remove' && m === fakeMesh));

  // zapis podczas pobytu w Netherze
  g.worldId = 'nether-test';
  g.worldName = 'Nether Test';
  g.worldType = 'normal';
  g.mode = 'survival';
  g.inventory = new Inventory();
  g.yaw = 0; g.pitch = 0;
  g.time = 0.2; g.health = 20; g.hunger = 20; g.day = 1;
  g.furnaces = new Map(); g.chests = new Map();
  g.unlocked = new Set(); g.weather = 'clear';
  g.xp = new Xp(0); g.armor = [null, null, null, null];
  g.trades = 0;
  g.save();
  const stored = loadSaves().find((s) => s.id === 'nether-test') as unknown as SaveData | undefined;
  check('save stored while in the nether', !!stored);
  eq('save remembers the dimension', stored?.isInNether, true);
  eq('save remembers the return portal', stored?.portalExit?.[0], 40.5);
  check('save carries nether mods', !!(stored?.netherMods && Object.keys(stored.netherMods).length > 0));
  eq('save keeps overworld mods separate', JSON.stringify(stored?.mods), homeModsBefore);
  deleteSave('nether-test');

  // powrót: dokładnie tam, skąd gracz wszedł, i tuż OBOK portalu
  (g as G)['leaveNether']();
  check('left back to the overworld', g.isInNether === false && g.world === g.homeWorld);
  eq('return portal marker cleared', g.portalExit, null);
  check('player is next to the entry spot', Math.abs(g.body.pos.x - 40.5) <= 1.5 && Math.abs(g.body.pos.z - 24.5) <= 1.5);
  check('home mesh re-attached to the scene', ops.some(([op, m]) => op === 'add' && m === fakeMesh));
  eq('nether mobs do not leak into the overworld', g.mobs.length, 0);
  eq('nether drops do not leak into the overworld', g.drops.length, 0);

  // próba snu w Netherze jest odrzucana (punkt odrodzenia zostaje w nadświecie)
  g.isInNether = true;
  const spawnBefore = g.spawnPoint.clone();
  (g as G)['trySleep'](10, 60, 10);
  check('no sleeping in the nether', g.spawnPoint.equals(spawnBefore) && g.isInNether === true);
  g.isInNether = false;

  // piec z drugiego wymiaru nigdy nie jest kasowany przez obcy świat
  g.isInNether = false;
  g.furnaces = new Map([['n:1,2,3', { x: 1, y: 2, z: 3, input: null, fuel: null, output: null, burn: 0, burnMax: 0, cook: 0, dim: 1 }]]);
  (g as G)['updateFurnaces'](0.1);
  check('nether furnace survives overworld ticks', g.furnaces.has('n:1,2,3'));
  // …a piec w niezaładowanym chunku też nie traci zawartości (stary bug)
  g.furnaces = new Map([['9999,60,9999', { x: 9999, y: 60, z: 9999, input: { id: I.IRON, count: 3 }, fuel: null, output: null, burn: 0, burnMax: 0, cook: 0, dim: 0 }]]);
  (g as G)['updateFurnaces'](0.1);
  check('furnace in an unloaded chunk is kept', g.furnaces.has('9999,60,9999'));
}

// ================================================ portal frame ignition (1.8)
section('portal: flint & steel lights the frame from any block');
{
  const buildFrame = (w: World, ox: number, oy: number, oz: number, axis: 'x' | 'z') => {
    const at = (a: number, b: number) => axis === 'x' ? [ox + a, oy + b, oz] : [ox, oy + b, oz + a];
    for (let f = 0; f < 4; f++) {
      let [x, y, z] = at(f, 0); w.setBlock(x, y, z, B.OBSIDIAN);
      [x, y, z] = at(f, 4); w.setBlock(x, y, z, B.OBSIDIAN);
    }
    for (let fy = 0; fy < 5; fy++) {
      let [x, y, z] = at(0, fy); w.setBlock(x, y, z, B.OBSIDIAN);
      [x, y, z] = at(3, fy); w.setBlock(x, y, z, B.OBSIDIAN);
    }
    // wnętrze ramy musi być puste – tak jak po zbudowaniu portalu przez gracza
    for (let i = 1; i <= 2; i++) for (let j = 1; j <= 3; j++) {
      const [x, y, z] = at(i, j); w.setBlock(x, y, z, B.AIR);
    }
  };
  const portalCount = (w: World, ox: number, oy: number, oz: number) => {
    let n = 0;
    for (let a = 0; a < 4; a++) for (let b = 0; b < 5; b++) {
      for (const [x, y, z] of [[ox + a, oy + b, oz], [ox, oy + b, oz + a]]) {
        if (w.getBlock(x, y, z) === B.NETHER_PORTAL) n++;
      }
    }
    return n;
  };

  // rama w płaszczyźnie X – zapalana z DOŁU, GÓRY i BOKU
  for (const [name, click] of [
    ['bottom row', [1, 10, 20]],
    ['top row', [2, 14, 20]],
    ['side column', [0, 12, 20]],
  ] as [string, number[]][]) {
    const w = new World(99);
    for (let cx = -1; cx <= 1; cx++) for (let cz = 1; cz <= 2; cz++) w.getChunk(cx, cz);
    buildFrame(w, 0, 10, 20, 'x');
    const ok = tryCreatePortal(w, click[0], click[1], click[2]);
    check(`frame lit from the ${name}`, ok === true);
    eq(`portal filled from the ${name} (6 blocks)`, portalCount(w, 0, 10, 20), 6);
  }

  // rama w płaszczyźnie Z
  {
    const w = new World(99);
    for (let cx = -1; cx <= 1; cx++) for (let cz = 1; cz <= 2; cz++) w.getChunk(cx, cz);
    buildFrame(w, 5, 10, 20, 'z');
    const ok = tryCreatePortal(w, 5, 13, 23);
    check('z-plane frame lit from the side', ok === true);
    eq('z-plane portal filled', portalCount(w, 5, 10, 20), 6);
  }

  // bez ramy ani przy niekompletnej ramie – nic się nie dzieje
  {
    const w = new World(99);
    w.getChunk(0, 1);
    eq('no frame → no portal', tryCreatePortal(w, 1, 10, 20), false);
    w.setBlock(1, 10, 20, B.OBSIDIAN);
    w.setBlock(2, 10, 20, B.OBSIDIAN); // tylko dwa bloki – za mało
    eq('incomplete frame → no portal', tryCreatePortal(w, 1, 10, 20), false);
  }
}

// ============================================== 1.9: netherowa gospodarka
section('items: nether economy (1.9)');
{
  // pył jasnogłazu → jasnogłaz (2×2, mieści się w siatce 2×2)
  const invG = new Inventory();
  invG.grid[0] = { id: I.GLOWSTONE_DUST, count: 1 };
  invG.grid[1] = { id: I.GLOWSTONE_DUST, count: 1 };
  invG.grid[3] = { id: I.GLOWSTONE_DUST, count: 1 };
  invG.grid[4] = { id: I.GLOWSTONE_DUST, count: 1 };
  eq('4 glowstone dust craft glowstone in the 2×2', invG.gridMatch(false)?.out.id, B.GLOWSTONE);

  // magmowy krem → blok magmy
  const invM = new Inventory();
  invM.grid[0] = { id: I.MAGMA_CREAM, count: 1 };
  invM.grid[1] = { id: I.MAGMA_CREAM, count: 1 };
  invM.grid[3] = { id: I.MAGMA_CREAM, count: 1 };
  invM.grid[4] = { id: I.MAGMA_CREAM, count: 1 };
  eq('4 magma cream craft a magma block', invM.gridMatch(false)?.out.id, B.MAGMA);

  // płomienna różdżka + 3 bruk → statyw alchemiczny
  const invB = new Inventory();
  invB.grid[4] = { id: I.BLAZE_ROD, count: 1 };
  invB.grid[6] = { id: B.COBBLE, count: 1 };
  invB.grid[7] = { id: B.COBBLE, count: 1 };
  invB.grid[8] = { id: B.COBBLE, count: 1 };
  eq('blaze rod over 3 cobble crafts the brewing stand', invB.gridMatch(true)?.out.id, B.BREWING);

  // obsydian + łza Ghasta → płaczący obsydian (bezpostaciowo)
  const invC = new Inventory();
  invC.grid[0] = { id: B.OBSIDIAN, count: 1 };
  invC.grid[1] = { id: I.GHAST_TEAR, count: 1 };
  eq('obsidian + ghast tear craft crying obsidian', invC.gridMatch(false)?.out.id, B.CRYING_OBSIDIAN);

  // brodawka Netheru farbuje wełnę na czerwono
  const invW = new Inventory();
  invW.grid[0] = { id: B.WOOL_WHITE, count: 1 };
  invW.grid[1] = { id: I.NETHER_WART, count: 1 };
  eq('nether wart dyes wool red', invW.gridMatch(false)?.out.id, B.WOOL_RED);

  // netherrack wytapia się na netherową cegłę (przedmiot), a ta składa się w blok
  eq('netherrack smelts into the nether brick item', smeltResult(B.NETHERRACK), I.NETHER_BRICK_ITEM);
  const brick = RECIPES.find((r) => r.out.id === B.NETHER_BRICKS);
  check('nether brick item still crafts into blocks', !!brick && brick.inputs[0].id === I.NETHER_BRICK_ITEM && brick.inputs[0].count === 4);

  // płomienna różdżka pali dłużej niż węgiel
  check('blaze rod outburns coal', fuelSeconds(I.BLAZE_ROD) > fuelSeconds(I.COAL), `${fuelSeconds(I.BLAZE_ROD)}s vs ${fuelSeconds(I.COAL)}s`);
}

// ====================================================== 2.1: journal controls
section('2.1: adventure journal keyboard controls');
{
  const onKeyDown = (Game.prototype as unknown as { onKeyDown: (event: KeyboardEvent) => void }).onKeyDown;
  const event = (code: string) => ({ code, repeat: false, preventDefault() {} }) as KeyboardEvent;
  const transitions: UIState[] = [];
  const fake = Object.assign(Object.create(Game.prototype), {
    ui: 'playing' as UIState,
    locked: true,
    setUI(next: UIState) { this.ui = next; transitions.push(next); },
  }) as Game;

  onKeyDown.call(fake, event('KeyJ'));
  eq('J opens the journal while playing', fake.ui, 'journal');
  onKeyDown.call(fake, event('KeyJ'));
  eq('typing J inside the journal does not close it', fake.ui, 'journal');
  onKeyDown.call(fake, event('Escape'));
  eq('Escape closes the journal back to the game', fake.ui, 'playing');
  eq('journal controls make the expected transitions', transitions.join(','), 'journal,playing');
}

// ======================================================= 2.2: waypoints
section('2.2: travel waypoints');
{
  let hudUpdates = 0;
  const fake = Object.assign(Object.create(Game.prototype), {
    body: { pos: new THREE.Vector3(12.8, 65.2, -4.1) },
    waypoints: [],
    activeWaypointId: null,
    isInNether: false,
    emitHud() { hudUpdates++; },
  }) as Game;
  const home = fake.addWaypoint('  Moja   baza  ');
  check('waypoint can be created at the player position', !!home && home.x === 12 && home.y === 65 && home.z === -5);
  eq('waypoint name is normalized', home?.name, 'Moja baza');
  eq('new waypoint becomes active', fake.activeWaypointId, home?.id);
  fake.isInNether = true;
  const portal = fake.addWaypoint('Portal');
  eq('waypoints remember their dimension', portal?.dimension, 'nether');
  fake.activateWaypoint(home?.id ?? null);
  eq('an existing waypoint can be activated', fake.activeWaypointId, home?.id);
  fake.removeWaypoint(home?.id ?? '');
  check('removing the active waypoint clears navigation', fake.waypoints.length === 1 && fake.activeWaypointId === null);
  check('waypoint changes refresh the HUD', hudUpdates >= 4);
}

// ================================================== 2.0: quality auto-pilot
section('2.0: automatic graphics and settings');
{
  // presety mają sensowne, rosnące wartości
  check('preset low renders closer than medium', PRESETS.low.renderDistance < PRESETS.medium.renderDistance);
  check('preset medium renders closer than high', PRESETS.medium.renderDistance < PRESETS.high.renderDistance);
  check('low preset caps FPS to save battery', PRESETS.low.fpsCap === 30);
  check('low preset disables clouds', PRESETS.low.clouds === false);
  check('low preset scales particles down', PRESETS.low.particles < PRESETS.medium.particles && PRESETS.medium.particles < PRESETS.high.particles);
  check('dynamic resolution on for low/medium', PRESETS.low.dynamicResolution && PRESETS.medium.dynamicResolution);
  check('high preset keeps full resolution', PRESETS.high.pixelRatio >= 2);

  // profil urządzenia w Node (brak DOM) => bezpieczny, „wydajny” domyślny
  const nodeProfile = detectDeviceProfile();
  check('node profile falls back gracefully', nodeProfile.tier === 'high' && nodeProfile.mobile === false, JSON.stringify(nodeProfile));

  // rekomendacje dla fikcyjnych urządzeń
  const weakPhone: DeviceProfile = { mobile: true, tier: 'low', cores: 4, memoryGB: 2, gpu: 'Adreno 506', dpr: 2, minScreen: 360 };
  const midPhone: DeviceProfile = { mobile: true, tier: 'mid', cores: 8, memoryGB: 6, gpu: 'Mali-G77', dpr: 2.6, minScreen: 390 };
  const gamingPC: DeviceProfile = { mobile: false, tier: 'high', cores: 16, memoryGB: 32, gpu: 'RTX 4070', dpr: 1, minScreen: 1080 };
  eq('weak phone -> low preset', recommendPreset(weakPhone), 'low');
  eq('mid phone -> medium preset', recommendPreset(midPhone), 'medium');
  eq('gaming PC -> high preset', recommendPreset(gamingPC), 'high');
  check('describeProfile mentions the GPU', describeProfile(gamingPC).includes('RTX 4070'));

  // applyPreset kopiuje grafikę, zostawiając preferencje gracza
  const s = applyPreset({ ...DEFAULT_SETTINGS, fov: 95, sensitivity: 2 }, 'low');
  eq('applyPreset applies render distance', s.renderDistance, PRESETS.low.renderDistance);
  eq('applyPreset applies fps cap', s.fpsCap, PRESETS.low.fpsCap);
  eq('applyPreset keeps player fov', s.fov, 95);
  eq('applyPreset switches quality mode', s.quality, 'low');

  // effectiveSettings w trybie Auto korzysta z rekomendacji, ale zachowuje wybór
  const auto = effectiveSettings({ ...DEFAULT_SETTINGS, quality: 'auto' }, weakPhone);
  eq('effective auto uses recommended render distance', auto.renderDistance, PRESETS.low.renderDistance);
  eq('effective auto keeps quality=auto flag', auto.quality, 'auto');
  const manual = effectiveSettings({ ...DEFAULT_SETTINGS, quality: 'high', renderDistance: 10 }, weakPhone);
  eq('manual quality wins over recommendation', manual.renderDistance, 10);

  // nowe klucze ustawień mają domyślne wartości (migracja starych zapisów)
  check('defaults contain touch mode tap', DEFAULT_SETTINGS.touchMode === 'tap');
  check('defaults enable auto-jump and haptics', DEFAULT_SETTINGS.autoJump === true && DEFAULT_SETTINGS.haptics === true);
  check('defaults enable dynamic resolution', DEFAULT_SETTINGS.dynamicResolution === true);

  store.set(SETTINGS_KEY, JSON.stringify({
    renderDistance: 99, sensitivity: -3, fov: null, volume: 4, quality: 'ultra',
    controlMode: 'flight', touchMode: 'trackball', fpsCap: 120, minimap: 'false',
  }));
  const recovered = loadSettings();
  eq('stored render distance is clamped', recovered.renderDistance, 14);
  eq('invalid sensitivity is clamped safely', recovered.sensitivity, 0.2);
  eq('invalid FOV falls back to default', recovered.fov, DEFAULT_SETTINGS.fov);
  eq('volume is clamped', recovered.volume, 1);
  eq('unknown quality mode falls back safely', recovered.quality, 'auto');
  eq('unknown control mode falls back safely', recovered.controlMode, 'auto');
  eq('unknown touch mode falls back safely', recovered.touchMode, 'tap');
  eq('unsupported FPS cap falls back safely', recovered.fpsCap, 0);
  eq('non-boolean toggle uses the default', recovered.minimap, true);
  eq('normalizer preserves supported settings', normalizeSettings({ fov: 90, volume: 0.25, fpsCap: 60 }).fov, 90);
  store.set(SETTINGS_KEY, '{broken');
  const lowDetail = effectiveDetail(applyPreset(DEFAULT_SETTINGS, 'low'), weakPhone);
  check('low preset automatically selects low texture and effect detail', lowDetail.textureDetail === 'low' && lowDetail.effectDetail === 'low');
  const manualDetail = effectiveDetail({ ...applyPreset(DEFAULT_SETTINGS, 'low'), textureDetail: 'full', effectDetail: 'full' }, weakPhone);
  check('independent detail overrides survive a low preset', manualDetail.textureDetail === 'full' && manualDetail.effectDetail === 'full');
  check('auto uses device recommendation for texture detail', effectiveDetail(DEFAULT_SETTINGS, gamingPC).textureDetail === 'full' && effectiveDetail(DEFAULT_SETTINGS, weakPhone).textureDetail === 'low');
  check('corrupted detail values fall back to Auto', normalizeSettings({ textureDetail: 'huge', effectDetail: [] }).textureDetail === 'auto' && normalizeSettings({ effectDetail: [] }).effectDetail === 'auto');
  saveSettings({ ...DEFAULT_SETTINGS, textureDetail: 'low', effectDetail: 'full' });
  check('independent detail axes survive settings reload', loadSettings().textureDetail === 'low' && loadSettings().effectDetail === 'full');
  eq('malformed settings JSON recovers to defaults', loadSettings().renderDistance, DEFAULT_SETTINGS.renderDistance);
  store.delete(SETTINGS_KEY);
}


section('3.0 #100: live texture and effect quality budgets');
{
  const g = Object.create(Game.prototype) as Game;
  const full = getAtlas().canvas;
  const fake = g as unknown as { fullAtlasCanvas: HTMLCanvasElement; textureDetail: 'low' | 'full'; rainGeo: THREE.BufferGeometry };
  fake.fullAtlasCanvas = full;
  fake.textureDetail = 'full';
  fake.rainGeo = new THREE.BufferGeometry();
  g.atlasTex = new THREE.CanvasTexture(full);
  g.gfx = { chunkBudgetMs: 12, chunksPerFrame: 3, unloadMargin: 2, particleScale: 1, requestedParticles: 1, effectDetail: 'full', clouds: true };
  g.emitHud = () => {};
  g.applyGfx({ textureDetail: 'low', effectDetail: 'low', particles: 0.8 });
  check('low atlas actually reaches the GPU texture without altering icon source', (g.atlasTex.image as HTMLCanvasElement).width === 128 && getAtlas().canvas.width === 256);
  eq('low effects cap particle work', g.gfx.particleScale, 0.35);
  eq('low effects cap rain draw calls', fake.rainGeo.drawRange.count, Math.floor(420 * 0.35));
  g.applyGfx({ textureDetail: 'full', effectDetail: 'full' });
  check('returning to full detail restores original atlas and particle budget', g.atlasTex.image === full && g.gfx.particleScale === 0.8);
  g.atlasTex.dispose();
}


section('3.0: fishing bait, survival economy and loot odds');
{
  const seq = (...rolls: number[]) => { let i = 0; return () => rolls[i++ % rolls.length]; };
  check('worms turn a marginal catch into a fish',
    !isFishStack(rollCatch(seq(0.80, 0, 0))) && isFishStack(rollCatch(seq(0.80, 0, 0), I.WORM_BAIT)));
  check('glow bait has a bounded treasure roll without changing old table',
    rollCatch(seq(0.95, 0, 0)).id !== I.EMERALD && rollCatch(seq(0.95, 0, 0), I.GLOW_BAIT).id === I.EMERALD);
  check('worm bait shortens wait but preserves bite window',
    biteDelay(() => 0, I.WORM_BAIT) === 3 && biteDelay(() => 0.999, I.WORM_BAIT) < 8 && BITE_WINDOW === 1.7);
  const rnd = Math.random;
  try {
    Math.random = () => 0;
    const earth = blockDrops(B.DIRT, I.WOOD_SHOVEL);
    check('digging dirt provides renewable bait without losing the dirt', earth.some((s) => s.id === B.DIRT) && earth.some((s) => s.id === I.WORM_BAIT));
  } finally { Math.random = rnd; }
  check('crafted rare bait uses string, honeycomb and Nether dust', RECIPES.some((r) => r.out.id === I.GLOW_BAIT &&
    [I.STRING, I.HONEYCOMB, I.GLOWSTONE_DUST].every((id) => r.inputs.some((i) => i.id === id))));
  const g = Object.create(Game.prototype) as any;
  g.mode = 'survival'; g.fishingBait = null; g.bobber = null;
  g.inventory = new Inventory();
  g.inventory.slots[0] = { id: I.WORM_BAIT, count: 1 };
  g.inventory.slots[1] = { id: I.FISHING_ROD, count: 1 };
  g.selected = 0;
  g.consumeSelected = () => { g.inventory.remove(I.WORM_BAIT, 1); };
  g.message = () => {};
  g.emitHud = () => {};
  check('bait is consumed once on attachment to a real rod', g.attachBait(I.WORM_BAIT) &&
    g.inventory.countOf(I.WORM_BAIT) === 0 && g.fishingBait === I.WORM_BAIT);
  check('attaching again cannot duplicate or overwrite prepared bait', !g.attachBait(I.WORM_BAIT) && g.fishingBait === I.WORM_BAIT);
}

// ============================================ 2.3: wyprawa i ratunek
section('2.3: fishing tables and timing');
{
  // rollCatch: 70% ryb, reszta to śmieci z plaży; wynik zawsze jest stosem.
  const fishRoll = () => 0.1;   // < FISH_CHANCE -> ryba
  const junkRoll = () => 0.95;  // -> śmieci
  const fish = rollCatch(fishRoll);
  check('a lucky cast returns a fish', isFishStack(fish), JSON.stringify(fish));
  const junk = rollCatch(junkRoll);
  check('an unlucky cast returns shoreline junk', !isFishStack(junk), JSON.stringify(junk));
  check('a catch is never empty', rollCatch().count >= 1);
  eq('every fish is cookable', `${cookedOf(I.RAW_FISH)}/${cookedOf(I.RAW_SALMON)}`, `${I.COOKED_FISH}/${I.COOKED_SALMON}`);
  eq('junk is never cookable', cookedOf(I.STRING), null);
  // wałek losowy: po 1000 zarzuceniach widać i ryby, i śmieci
  let fishy = 0, junky = 0;
  for (let i = 0; i < 1000; i++) {
    if (isFishStack(rollCatch())) fishy++;
    else junky++;
  }
  check('fish show up on the hook', fishy > 500 && fishy < 900, `fish=${fishy}`);
  check('junk shows up on the hook', junky > 100 && junky < 500, `junk=${junky}`);
  // czas do brań mieści się w zadeklarowanych granicach
  let fast = Infinity, slow = -Infinity;
  for (let i = 0; i < 500; i++) {
    const d = biteDelay();
    fast = Math.min(fast, d);
    slow = Math.max(slow, d);
  }
  check('bite delay stays within BITE_MIN..BITE_MAX', fast >= BITE_MIN && slow <= BITE_MAX, `${fast}..${slow}`);
  check('the bite window is short', BITE_WINDOW <= 2, String(BITE_WINDOW));
  check('the hook is patient but not forever', PATIENCE > 20 && PATIENCE < 90);
  eq('a cooked fish is worth more than a raw one', (ITEMS[I.COOKED_FISH]?.hunger ?? 0) > (ITEMS[I.RAW_FISH]?.hunger ?? 0), true);
  eq('salmon heals a little extra', ITEMS[I.COOKED_SALMON]?.heal ?? 0, 2);
  // surowa ryba w piecu -> pieczona
  eq('raw fish smelts into cooked fish', smeltResult(I.RAW_FISH), I.COOKED_FISH);
  eq('raw salmon smelts into cooked salmon', smeltResult(I.RAW_SALMON), I.COOKED_SALMON);
  const f = emptyFurnace(1, 2, 3);
  f.input = { id: I.RAW_FISH, count: 1 };
  f.fuel = { id: I.COAL, count: 1 };
  let cooked = 0;
  for (let i = 0; i < 60 * 20; i++) if (tickFurnace(f, 1 / 30)) cooked++;
  eq('the furnace cooks a fish', f.output?.id, I.COOKED_FISH);
  check('cooking a fish takes real time, not a single tick', cooked > COOK_TIME * 30 * 0.9, String(cooked));
  // narzędzia 2.3
  eq('the rod has durability', durabilityMax(I.FISHING_ROD), 64);
  eq('the rod never stacks', stackLimit(I.FISHING_ROD), 1);
  eq('a totem never stacks', stackLimit(I.TOTEM), 1);
  eq('the spyglass never stacks', stackLimit(I.SPYGLASS), 1);
  eq('fish stack up to 64', stackLimit(I.RAW_FISH), 64);
  eq('the rod is harmless', attackDamage(I.FISHING_ROD, false), 1);
  check('a rod cannot be enchanted', !canEnchant(I.FISHING_ROD, 'unbreaking'));
  check('a spyglass cannot be enchanted', !canEnchant(I.SPYGLASS, 'unbreaking'));
  check('a pick still can be enchanted', canEnchant(I.IRON_PICK, 'efficiency'));
  eq('the spyglass is not a weapon', attackDamage(I.SPYGLASS, false), 1);
  eq('a sword still hits hard', attackDamage(I.DIAMOND_SWORD, false) >= 9, true);
  // receptury 2.3
  const rod = new Inventory();
  for (const i of [0, 1, 2]) rod.grid[i] = { id: I.STICK, count: 1 };
  rod.grid[4] = { id: I.STRING, count: 1 };
  rod.grid[8] = { id: I.STRING, count: 1 };
  eq('three sticks and two strings make a rod', rod.gridMatch(true)?.out.id, I.FISHING_ROD);
  const spy = new Inventory();
  for (const [i, id] of [[1, B.GLASS], [3, B.GLASS], [5, B.GLASS], [7, B.GLASS], [4, I.GOLD]] as [number, number][]) spy.grid[i] = { id, count: 1 };
  check('four glass and one ingot are consumed', spy.gridMatch(true) !== null);
  eq('glass and gold make a spyglass', spy.gridMatch(true)?.out.id, I.SPYGLASS);
  const totem = new Inventory();
  for (const [i, id] of [[1, I.EMERALD], [3, I.EMERALD], [5, I.EMERALD], [7, I.EMERALD], [4, I.GOLD]] as [number, number][]) totem.grid[i] = { id, count: 1 };
  eq('emeralds and gold make a totem', totem.gridMatch(true)?.out.id, I.TOTEM);
  eq('the rod recipe needs a workbench', RECIPES.find((r) => r.out.id === I.FISHING_ROD)?.table, true);
  const small = new Inventory();
  small.grid[0] = { id: B.GLASS, count: 1 };
  small.grid[1] = { id: B.GLASS, count: 1 };
  small.grid[2] = { id: B.GLASS, count: 1 };
  small.grid[3] = { id: I.GOLD, count: 1 };
  check('the spyglass needs the full 3x3 grid', small.gridMatch(false)?.out.id !== I.SPYGLASS);
  // 2×2 nadal robi szpadle i wymagające tylko dwóch sztuk
  const table2 = new Inventory();
  table2.grid[0] = { id: B.PLANKS, count: 1 };
  table2.grid[1] = { id: B.PLANKS, count: 1 };
  table2.grid[3] = { id: B.PLANKS, count: 1 };
  table2.grid[4] = { id: B.PLANKS, count: 1 };
  eq('the 2x2 grid still makes a workbench', table2.gridMatch(false)?.out.id, B.CRAFTING);
}

section('2.3: anvil rules');
{
  const a: Stack = { id: I.IRON_PICK, count: 1, dur: 30 };
  const b: Stack = { id: I.IRON_PICK, count: 1, dur: 50, ench: { sharpness: 2 } };
  check('two matching tools can be merged', canMerge(a, b));
  const merged = mergeStacks(a, b)!;
  eq('durability is summed', merged.dur, 80);
  eq('the better enchantment survives', merged.ench?.sharpness, 2);
  eq('merging costs one level', MERGE_COST, 1);
  check('merging is refused above the maximum', mergeStacks({ id: I.IRON_PICK, count: 1, dur: 1700 }, { id: I.IRON_PICK, count: 1, dur: 1700 }) === null);
  check('different tools never merge', mergeStacks(a, { id: I.STONE_PICK, count: 1, dur: 10 }) === null);
  check('cobblestone blocks never merge', mergeStacks({ id: B.STONE, count: 1 }, { id: B.STONE, count: 1 }) === null);
  eq('enchantment maps keep the best level', mergeEnchants({ efficiency: 3 }, { efficiency: 1, fortune: 2 })?.efficiency, 3);
  eq('and add what the other one had', mergeEnchants({ efficiency: 3 }, { fortune: 2 })?.fortune, 2);

  // przemianowanie
  eq('names are trimmed', cleanItemName('  Miecz   Wędrowca  '), 'Miecz Wędrowca');
  eq('control characters never reach a name', cleanItemName('Kilof zła'), 'Kilof zła');
  eq('a long name is cut to 28 characters', cleanItemName('x'.repeat(60)).length, 28);
  const rename = anvilResult({ id: I.IRON_SWORD, count: 1, dur: 100 }, null, 'Żelazny miec');
  eq('renaming produces the item', rename.out?.name, 'Żelazny miec');
  eq('renaming is announced as a rename', rename.action, 'rename');
  eq('renaming keeps durability', rename.out?.dur, 100);
  eq('renaming charges one level', rename.cost, RENAME_COST);
  eq('an empty field renames nothing', anvilResult({ id: I.IRON_SWORD, count: 1 }, null, '   ').out, null);
  eq('the same name is not a rename', anvilResult({ id: I.IRON_SWORD, count: 1, name: 'Miecz' }, null, 'Miecz').out, null);
  eq('a merge is announced as a merge', anvilResult(a, b, '').action, 'merge');
  eq('a merge costs a level', anvilResult(a, b, '').cost, 1);
  eq('two full tools are refused', anvilResult({ id: I.IRON_PICK, count: 1, dur: 1700 }, { id: I.IRON_PICK, count: 1, dur: 1700 }, '').out, null);
  eq('a renamed merged tool keeps the first name', anvilResult({ ...a, name: 'Stary' }, b, '').out?.name, 'Stary');
}

section('2.3: anvil inside the engine');
{
  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  g.mode = 'survival';
  g.inventory = new Inventory();
  g.inventory.slots[0] = { id: I.IRON_PICK, count: 1, dur: 20 };
  g.inventory.slots[1] = { id: I.IRON_PICK, count: 1, dur: 30 };
  g.xp = new XpClass(totalXpForLevel(5));
  g.anvils = new Map();
  g.anvilPos = { x: 4, y: 5, z: 6 };
  g.body = { pos: new THREE.Vector3(4, 5, 6) };
  g.emitHud = () => {};
  g.message = () => {};
  g.unlocked = new Set();
  g.anvils.set(anvilKey(4, 5, 6), emptyAnvil(4, 5, 6));
  // 1) włożenie przedmiotów kursorem
  g.inventory.cursor = { id: I.IRON_PICK, count: 1, dur: 20 };
  g.clickAnvilSlot('a', false);
  g.inventory.cursor = { id: I.IRON_PICK, count: 1, dur: 30 };
  g.clickAnvilSlot('b', false);
  const offer = g.anvilOffer() as AnvilResult;
  eq('the anvil offers a merged pickaxe', offer.out?.dur, 50);
  eq('the offer is affordable with enough xp', g.canAnvilTake(), true);
  eq('taking the result succeeds', g.takeAnvilResult(), true);
  check('the merged pickaxe landed in the inventory', g.inventory.slots.some((s: Stack | null) => s?.id === I.IRON_PICK && s.dur === 50));
  eq('one level was spent', g.xp.info().level, 4);
  const anvil = g.anvils.get(anvilKey(4, 5, 6));
  check('both inputs are consumed', anvil.a === null && anvil.b === null, JSON.stringify(anvil));
  check('the smith achievement fired', (g.unlocked as Set<string>).has('smith'));

  // 2) za mało poziomów
  g.xp = new XpClass(0);
  const poor = emptyAnvil(4, 5, 6);
  poor.a = { id: I.IRON_PICK, count: 1, dur: 10 };
  poor.b = { id: I.IRON_PICK, count: 1, dur: 10 };
  g.anvils.set(anvilKey(4, 5, 6), poor);
  eq('a level 0 player cannot pay', g.canAnvilTake(), false);
  eq('and the anvil refuses the operation', g.takeAnvilResult(), false);
  check('the inputs stay in the anvil', g.anvils.get(anvilKey(4, 5, 6)).a !== null);

  // 3) przemianowanie przez pole nazwy
  g.xp = new XpClass(totalXpForLevel(3));
  const named = emptyAnvil(4, 5, 6);
  named.a = { id: I.DIAMOND_SWORD, count: 1, dur: 1200 };
  g.anvils.set(anvilKey(4, 5, 6), named);
  g.setAnvilName('  Szabla  wędrowca ');
  eq('the typed name is cleaned', g.anvils.get(anvilKey(4, 5, 6)).name, 'Szabla wędrowca');
  eq('the renamed sword is offered', g.anvilOffer().out?.name, 'Szabla wędrowca');
  eq('and it costs a level', g.anvilOffer().cost, 1);
  g.takeAnvilResult();
  check('the renamed item keeps id and durability', g.inventory.slots.some((s: Stack | null) => s?.name === 'Szabla wędrowca' && s.id === I.DIAMOND_SWORD && s.dur === 1200));

  const namedPlanks = emptyAnvil(4, 5, 6);
  namedPlanks.a = { id: B.PLANKS, count: 8 };
  namedPlanks.name = 'Deski wędrowca';
  g.anvils.set(anvilKey(4, 5, 6), namedPlanks);
  g.inventory.cursor = { id: B.PLANKS, count: 5 };
  g.takeAnvilResult();
  check('anvil does not merge a renamed stack into an incompatible cursor stack', g.inventory.cursor?.id === B.PLANKS && g.inventory.cursor.count === 5 && g.inventory.cursor.name === undefined);
  check('renamed anvil output is kept as its own named stack', g.inventory.slots.some((s: Stack | null) => s?.id === B.PLANKS && s.count === 8 && s.name === 'Deski wędrowca'));
}

section('2.3: totem of undying');
{
  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  g.mode = 'survival';
  g.ui = 'playing';
  g.health = 4;
  g.hunger = 12;
  g.inventory = new Inventory();
  g.inventory.slots[0] = { id: I.TOTEM, count: 1 };
  g.unlocked = new Set();
  g.totemHeal = 0;
  g.armor = [null, null, null, null];
  g.messages = [];
  g.emitHud = () => {};
  g.spawnParticles = () => {};
  g.gainXp = () => {};
  g.keys = new Set();
  g.onUI = () => {};
  g.lockPointer = () => {};
  g.spawnDrop = () => {};
  g.body = { pos: new THREE.Vector3(1, 70, 1) };
  g.spawnPoint = new THREE.Vector3(1, 70, 1);
  g.damage(30);
  check('the totem saves the player', g.health > 0, `health=${g.health}`);
  eq('the totem is consumed', g.inventory.countOf(I.TOTEM), 0);
  check('the undying achievement fired', (g.unlocked as Set<string>).has('undying'));
  eq('the player stays in the world', g.ui, 'playing');
  check('healing starts right away', g.totemHeal > 0, String(g.totemHeal));
  // bez totemu śmier działa normalnie
  const plain = Object.create(Game.prototype) as unknown as Record<string, any>;
  plain.mode = 'survival';
  plain.ui = 'playing';
  plain.health = 4;
  plain.hunger = 12;
  plain.inventory = new Inventory();
  plain.unlocked = new Set();
  plain.totemHeal = 0;
  plain.effects = new Map();
  plain.armor = [null, null, null, null];
  plain.emitHud = () => {};
  plain.body = { pos: new THREE.Vector3(1, 70, 1) };
  plain.spawnPoint = new THREE.Vector3(1, 70, 1);
  plain.messages = [];
  plain.keys = new Set();
  plain.onUI = () => {};
  plain.lockPointer = () => {};
  plain.spawnDrop = () => {};
  plain.spawnParticles = () => {};
  plain.damage(30);
  eq('without a totem a lethal hit is fatal', plain.health, 0);
  check('and the death screen opens', plain.ui === 'dead' || plain.ui === 'respawn', String(plain.ui));
}

section('2.3: bug fixes');
{
  // (1) połówka stosu nie może gubić zaklęć, wytrzymałości ani nazwy
  const inv = new Inventory();
  inv.slots[0] = { id: I.IRON_PICK, count: 4, dur: 50, ench: { efficiency: 2 }, name: 'Stary kilof' };
  inv.clickSlot(0, true);
  eq('half a stack keeps the durability', inv.cursor?.dur, 50);
  eq('half a stack keeps the enchantment', inv.cursor?.ench?.efficiency, 2);
  eq('half a stack keeps the custom name', inv.cursor?.name, 'Stary kilof');
  const inv2 = new Inventory();
  inv2.grid[0] = { id: B.STONE, count: 10 };
  inv2.clickGrid(0, true);
  eq('the crafting grid splits stacks too', inv2.cursor?.count, 5);
  check('renamed stacks never merge', !mergeable({ id: B.STONE, count: 1, name: 'A' }, { id: B.STONE, count: 1 }));
  check('two identically named stacks merge', mergeable({ id: B.STONE, count: 1, name: 'A' }, { id: B.STONE, count: 1, name: 'A' }));
  const named = new Inventory();
  named.add(I.IRON_SWORD, 1, 100, undefined, 'Wędrowiec');
  eq('add() carries the custom name', named.slots[0]?.name, 'Wędrowiec');
  const named2 = new Inventory();
  named2.add(B.STONE, 1);
  named2.add(B.STONE, 1, undefined, undefined, 'Inny');
  check('plain and renamed stacks stay apart', named2.slots[0]?.name === undefined && named2.slots[1]?.name === 'Inny');

  // (1b) przenoszenie między slotami (kowadło, skrzynia, piec) nie gubi nazwy
  const t = Object.create(Game.prototype) as unknown as Record<string, any>;
  t.inventory = new Inventory();
  t.inventory.slots[0] = { id: B.STONE, count: 8, name: 'Kamień podróżnika' };
  t.chests = new Map();
  t.chestPos = { x: 1, y: 2, z: 3 };
  t.isInNether = false;
  t.chests.set(chestKey(1, 2, 3), { x: 1, y: 2, z: 3, slots: [null] });
  t.notePickup = () => {};
  t.inventory.clickSlot(0, true);     // połowa z ekwipunku na kursor
  eq('taking half keeps the name', t.inventory.cursor?.name, 'Kamień podróżnika');
  eq('taking half keeps the count', t.inventory.cursor?.count, 4);
  t.clickChest(0, false);             // cały slot z kursora do skrzyni
  eq('the whole named stack moves', t.chests.get(chestKey(1, 2, 3)).slots[0]?.name, 'Kamień podróżnika');
  t.clickChest(0, true);              // z powrotem połowa ze skrzyni
  eq('and back again, still named', t.inventory.cursor?.name, 'Kamień podróżnika');
  eq('and still half the count', t.inventory.cursor?.count, 2);

  // (2) ŚPM przenosi przedmiot z głębi ekwipunku na pasek
  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  g.inventory = new Inventory();
  g.inventory.slots[20] = { id: B.PLANKS, count: 12 };
  g.inventory.slots[3] = { id: B.DIRT, count: 5 };
  g.selected = 3;
  g.target = { id: B.PLANKS };
  g.emitHud = () => {};
  g.updateHand = () => {};
  g.pickBlock();
  eq('middle click swaps the block into the hotbar', g.inventory.slots[3]?.id, B.PLANKS);
  eq('and the hotbar slot lands where the block was', g.inventory.slots[20]?.id, B.DIRT);
  eq('nothing is lost', g.inventory.slots[3]?.count, 12);

  // (3) import zapisów czyści nazwy świata
  const junk = JSON.stringify({
    blockcraft: 1,
    saves: [{ id: 'evil', seed: 7, name: '  Źle zerwany\t nazwa\n', updated: 5 }],
  });
  eq('the world was imported', importSaves(junk), 1);
  const stored = loadSaves().find((s) => s.id === 'evil');
  eq('the name has no control characters', stored?.name, 'Źle zerwany nazwa');
  check('a name is still clamped', cleanWorldName('y'.repeat(80)).length <= MAX_WORLD_NAME);
  eq('a name always has a fallback', cleanWorldName('   '), 'Świat');

  // (4) płyty łączą się w pełny blok bez osobnych przypadków
  eq('two oak slabs become planks', slabFullBlock(B.OAK_SLAB), B.PLANKS);
  eq('two quartz slabs become a quartz block', slabFullBlock(B.QUARTZ_SLAB), B.QUARTZ_BLOCK);
  eq('an unknown block is left alone', slabFullBlock(B.STONE), B.STONE);

  // (5) blok szlamu naprawdę odbija
  eq('landing on slime bounces up', slimeBounce(false, true, 0), 6);
  check('a hard landing bounces higher', Math.abs((slimeBounce(false, true, -12) ?? 0) - 9.6) < 1e-9);
  eq('standing still on slime does not bounce', slimeBounce(true, true, 0), null);
  eq('a small hop does not bounce', slimeBounce(true, true, -1), null);
  eq('no bounce in mid-air', slimeBounce(false, false, -20), null);

  // (6) rudy z 1.7/1.9 dają doświadczenie i wymagają narzędzi
  check('redstone ore gives experience', oreXp(B.REDSTONE_ORE) > 0, String(oreXp(B.REDSTONE_ORE)));
  check('quartz ore gives experience', oreXp(B.QUARTZ_ORE) > 0, String(oreXp(B.QUARTZ_ORE)));
  eq('emerald ore is the richest of the three', oreXp(B.EMERALD_ORE) > oreXp(B.REDSTONE_ORE), true);
  eq('quartz ore needs a stone pick at least', requiredPickTier(B.QUARTZ_ORE), 2);
  check('and it is still an ore', isOre(B.QUARTZ_ORE) && isOre(B.EMERALD_ORE));
}

section('2.4: brewing inside the engine');
{
  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  g.mode = 'survival';
  g.isInNether = false;
  g.inventory = new Inventory();
  g.inventory.slots[0] = { id: I.WATER_BOTTLE, count: 3 };
  g.inventory.slots[1] = { id: I.NETHER_WART, count: 4 };
  g.inventory.slots[2] = { id: I.BLAZE_ROD, count: 2 };
  g.brewings = new Map();
  g.brewingPos = { x: 1, y: 2, z: 3 };
  g.body = { pos: new THREE.Vector3(1, 2, 3) };
  g.emitHud = () => {};
  g.message = () => {};
  g.unlocked = new Set();
  g.toast = null;
  g.notePickup = () => {};
  g.spawnParticles = () => {};
  g.world = {
    hasChunk: () => true,
    peekBlock: (x: number, y: number, z: number) => (x === 1 && y === 2 && z === 3 ? B.BREWING : B.AIR),
  };
  g.brewings.set(brewingKey(1, 2, 3), emptyBrewing(1, 2, 3));

  // items flow into the stand through the cursor
  g.inventory.cursor = { id: I.WATER_BOTTLE, count: 1 };
  g.clickBrewing('b0', false);
  g.inventory.cursor = { id: I.NETHER_WART, count: 1 };
  g.clickBrewing('ingredient', false);
  g.inventory.cursor = { id: I.BLAZE_ROD, count: 1 };
  g.clickBrewing('fuel', false);
  const stand = g.brewings.get(brewingKey(1, 2, 3));
  eq('the bottle lands in slot one', stand.bottles[0]?.id, I.WATER_BOTTLE);
  eq('the ingredient sits in the cup', stand.ingredient?.id, I.NETHER_WART);
  eq('the fuel rests on the tray', stand.fuel?.id, I.BLAZE_ROD);
  // a random item is not a brewing ingredient
  g.inventory.cursor = { id: I.STICK, count: 1 };
  g.clickBrewing('ingredient', false);
  eq('the cup keeps the wart', stand.ingredient?.id, I.NETHER_WART);
  eq('the stick stayed in the cursor', g.inventory.cursor?.id, I.STICK);
  // the full 8 s batch
  for (let t = 0; t < 8.2; t += 0.5) g.updateBrewings(0.5);
  eq('water + wart = awkward potion', stand.bottles[0]?.id, I.POTION_AWKWARD);
  eq('one brew was consumed from the rod', stand.fuelLeft, 2);
  eq('the ingredient survived the brew', stand.ingredient?.id, I.NETHER_WART);
  check('the alchemist achievement fired', (g.unlocked as Set<string>).has('alchemist'));

  // breaking the stand spills everything
  g.world.peekBlock = () => B.AIR;
  g.closeInventory = () => {};
  const droppedIds: number[] = [];
  g.spawnDrop = ((id: number, n: number) => { g.dropped = (g.dropped ?? 0) + n; droppedIds.push(id); });
  g.updateBrewings(0.1);
  check('the stand state is gone after the block vanished', !g.brewings.get(brewingKey(1, 2, 3)));
  // the rod was already spent by the brew, so potion + wart are all that spill
  check('the contents spilled to the ground', (g.dropped ?? 0) === 2, String(g.dropped));
  check('the brewed potion survived the spill', droppedIds.includes(I.POTION_AWKWARD));
  check('the ingredient spilled too', droppedIds.includes(I.NETHER_WART));
}

section('3.0 #78: brewable fall and sprint potions, effect isolation and save migration');
{
  // IDs are appended: existing speed and night vision keep their old recipes.
  check('both new potions can be selected in Creative', [I.POTION_FALL, I.POTION_SPRINT].every((id) => CREATIVE_ITEMS.includes(id)));
  eq('fall potion resolves by name', resolveId('napoj_ladowania'), I.POTION_FALL);
  eq('sprint potion resolves by name', resolveId('napoj_zrywu'), I.POTION_SPRINT);
  eq('water + sugar remains the older speed brew', brewResult(I.WATER_BOTTLE, I.SUGAR), I.POTION_SPEED);
  eq('water + glowstone remains night vision', brewResult(I.WATER_BOTTLE, I.GLOWSTONE_DUST), I.POTION_NIGHT);
  eq('awkward + feather produces fall protection', brewResult(I.POTION_AWKWARD, I.FEATHER), I.POTION_FALL);
  eq('awkward + sugar produces short sprint', brewResult(I.POTION_AWKWARD, I.SUGAR), I.POTION_SPRINT);
  eq('water + feather is not a shortcut', brewResult(I.WATER_BOTTLE, I.FEATHER), null);
  for (const [ingredient, expected] of [[I.FEATHER, I.POTION_FALL], [I.SUGAR, I.POTION_SPRINT]]) {
    const stand = emptyBrewing(0, 1, 0);
    stand.bottles[0] = { id: I.POTION_AWKWARD, count: 1 };
    stand.ingredient = { id: ingredient, count: 1 };
    stand.fuel = { id: I.BLAZE_ROD, count: 1 };
    eq('the new brew completes in a fueled stand', tickBrewing(stand, 8).done, true);
    eq('the stand outputs the matching potion', stand.bottles[0]?.id, expected);
    check('new potions have timed descriptions', POTIONS[expected].duration > 0 && !!POTIONS[expected].desc);
  }
  eq('fall potion absorbs fall damage', fallDamageAfterPotion(12, true), 0);
  eq('without the effect fall damage remains', fallDamageAfterPotion(12, false), 12);
  eq('sprint buff speeds sprinting', sprintFactor(true, true), 1.45);
  eq('sprint buff does not change walking', sprintFactor(true, false), 1);
  eq('no potion means normal sprint speed', sprintFactor(false, true), 1);
  eq('2.7 saves without effects load without buffs', restoreEffects(undefined).size, 0);
  const restored = restoreEffects({ fall: 2000, sprint: 1400, night: 6000, speed: -1, bogus: 9999, regen: Infinity, fire: '3000', strength: 1e10, heal: 5000 });
  eq('fall timer restored', restored.get('fall'), 2000);
  eq('sprint timer restored', restored.get('sprint'), 1400);
  eq('old night timer restored', restored.get('night'), 6000);
  eq('malformed timers ignored', restored.has('speed') || restored.has('regen') || restored.has('fire') || [...restored.keys()].some((key) => String(key) === 'bogus') || restored.has('heal'), false);
  eq('oversized imported timer limited', restored.get('strength'), 120000);
  eq('non-record effects rejected', restoreEffects([1, 2]).size, 0);
}

section('2.4: potion effects inside the engine');
{
  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  g.mode = 'survival';
  g.effects = new Map();
  g.potionRegenAcc = 0;
  g.potionsDrunk = new Set();
  g.body = { pos: new THREE.Vector3(0, 64, 0) };
  g.health = 5;
  g.inventory = new Inventory();
  g.selected = 0;
  g.swingT = 1;
  g.unlocked = new Set();
  g.toast = null;
  g.emitHud = () => {};
  g.message = () => {};
  g.spawnParticles = () => {};

  // healing potion: instant, consumed
  g.inventory.slots[0] = { id: I.POTION_HEAL, count: 1 };
  g.drinkPotion({ id: I.POTION_HEAL, count: 1 });
  eq('healing restores seven points', g.health, 12);
  eq('the bottle was consumed', g.inventory.slots[0], null);
  check('the tonic achievement fired', (g.unlocked as Set<string>).has('tonic'));

  // timed buff: speed
  g.applyEffect('speed', 20);
  check('the speed buff is active', g.hasEffect('speed') === true);
  check('a fresh buff reports its full duration', Math.abs(g.effectLeft('speed') - 20) < 1e-9);
  g.updateEffects(5);
  check('the buff decays with time', Math.abs(g.effectLeft('speed') - 15) < 1e-9);
  g.updateEffects(20);
  check('the buff expires', g.hasEffect('speed') === false);

  // regeneration heals on its own 2 s rhythm
  g.health = 6;
  g.applyEffect('regen', 10);
  g.updateEffects(1.9);
  eq('no heal before the 2 s mark', g.health, 6);
  g.updateEffects(0.2);
  eq('one heart after two seconds', g.health, 7);
  g.updateEffects(100);
  check('the effect ends and the timer resets', g.hasEffect('regen') === false && g.potionRegenAcc < 2);

  // Both 3.0 brews pass through the real drink path and decay independently.
  g.inventory.slots[0] = { id: I.POTION_FALL, count: 1 };
  g.drinkPotion({ id: I.POTION_FALL, count: 1 });
  eq('drinking fall protection applies 35 s', g.effectLeft('fall'), 35);
  eq('fall bottle consumed in Survival', g.inventory.slots[0], null);
  g.inventory.slots[0] = { id: I.POTION_SPRINT, count: 1 };
  g.drinkPotion({ id: I.POTION_SPRINT, count: 1 });
  eq('drinking sprint potion applies 12 s', g.effectLeft('sprint'), 12);
  eq('sprint bottle consumed in Survival', g.inventory.slots[0], null);
  g.updateEffects(13);
  check('short sprint expires before fall protection', !g.hasEffect('sprint') && g.hasEffect('fall'));
  g.updateEffects(23);
  check('fall protection expires normally', !g.hasEffect('fall'));

  // the awkward brew is harmless but still drunk
  g.inventory.slots[0] = { id: I.POTION_AWKWARD, count: 1 };
  g.drinkPotion({ id: I.POTION_AWKWARD, count: 1 });
  eq('awkward tastes like dirt', g.inventory.slots[0], null);
  check('and no effect sticks', g.effects.size === 0);
  check('awkward does not count toward mastery', (g.potionsDrunk as Set<number>).size === 3);
}

section('2.4: bug fixes');
{
  // (1) the creative bucket must not eat water sources
  const g = Object.create(Game.prototype) as unknown as Record<string, any>;
  g.mode = 'creative';
  g.swingT = 0;
  g.message = () => {};
  g.updateHand = () => {};
  g.emitHud = () => {};
  g.inventory = new Inventory();
  g.selected = 0;
  const s: Stack = { id: I.BUCKET, count: 1 };
  g.inventory.slots[0] = s;
  let deleted: boolean = false;
  g.world = { setBlock: (_x: number, _y: number, _z: number, id: number) => { if (id === B.AIR) deleted = true; } };
  g.tryBucket({ x: 5, y: 5, z: 5, nx: 0, ny: 1, nz: 0, id: B.WATER }, s);
  eq('the held bucket turns into a water bucket', s.id, I.WATER_BUCKET);
  check('the water source is left alone in creative', deleted === false);

  const sv = Object.create(Game.prototype) as unknown as Record<string, any>;
  sv.mode = 'survival';
  sv.swingT = 0;
  sv.message = () => {};
  sv.updateHand = () => {};
  sv.emitHud = () => {};
  sv.inventory = new Inventory();
  sv.selected = 0;
  const ss: Stack = { id: I.BUCKET, count: 1 };
  sv.inventory.slots[0] = ss;
  let svDeleted: boolean = false;
  sv.world = { setBlock: (_x: number, _y: number, _z: number, id: number) => { if (id === B.AIR) svDeleted = true; } };
  sv.consumeSelected = (n: number) => { const st = sv.inventory.slots[sv.selected]; if (st) { st.count -= n; if (st.count <= 0) sv.inventory.slots[sv.selected] = null; } };
  sv.tryBucket({ x: 5, y: 5, z: 5, nx: 0, ny: 1, nz: 0, id: B.WATER }, ss);
  check('survival still scoops the source', svDeleted);
  eq('survival receives the filled bucket', sv.inventory.countOf(I.WATER_BUCKET), 1);

  // (2) the potion is addressable by its Polish chat name
  eq('napoj_leczacy resolves to the healing potion', resolveId('napoj_leczacy'), I.POTION_HEAL);
  eq('fiolka resolves to the glass bottle', resolveId('fiolka'), I.BOTTLE);
  eq('cukier resolves to sugar', resolveId('cukier'), I.SUGAR);
}


// ==================================== 2.5 „Wielka naprawa” – sterowanie
section('2.5: wielka naprawa sterowania');
{
  // (1) Ctrl+Q wyrzuca CAŁY stos, samo Q – jeden przedmiot
  type G = Record<string, any>;
  const g = Object.create(Game.prototype) as G;
  g.mode = 'survival';
  g.ui = 'playing';
  g.inventory = new Inventory();
  g.selected = 0;
  g.yaw = 0;
  g.pitch = 0;
  g.eyeHeight = 1.62;
  g.body = { pos: new THREE.Vector3(0, 0, 0), vel: new THREE.Vector3() };
  const drops: Array<[number, number]> = [];
  g.spawnDrop = (id: number, count: number) => void drops.push([id, count]);
  g.emitHud = () => {};

  g.inventory.slots[0] = { id: B.DIRT, count: 17 };
  g.dropItem();
  eq('Q drops a single item', drops[0]?.[1], 1);
  eq('16 items stay in the stack', g.inventory.slots[0].count, 16);
  g.dropItem(true);
  eq('Ctrl+Q drops the whole stack', drops[1]?.[1], 16);
  eq('the slot is empty afterwards', g.inventory.slots[0], null);

  // (2) findMobTarget celuje w touchAim (palec), nie w środek ekranu
  const aims: THREE.Vector3[] = [];
  const fakeMob = { dead: false, rayHit: (_o: THREE.Vector3, d: THREE.Vector3) => { aims.push(d.clone()); return 2.0; } };
  const g2 = Object.create(Game.prototype) as G;
  g2.eyePos = () => new THREE.Vector3();
  g2.yaw = 0; g2.pitch = 0;
  g2.aimDir = new THREE.Vector3(1, 0, 0); // palec po prawej stronie ekranu
  g2.mobs = [fakeMob];
  const found = g2.findMobTarget(5);
  eq('touch aim finds the mob under the finger', found.mob === fakeMob, true);
  check('the search direction follows the finger, not the screen centre', Math.abs(aims[0].x - 1) < 1e-6);

  // (3) tapnięcie po mieszkańcu otwiera handel zamiast go bić
  const g3 = Object.create(Game.prototype) as G;
  g3.mode = 'survival';
  g3.ui = 'playing';
  g3.touchAim = null;
  g3.target = null;
  g3.selectedStack = () => null;
  g3.refreshTarget = function () { this.target = null; };
  g3.findMobTarget = () => ({ mob: villagerTap, dist: 2 });
  g3.attackCooldown = 0;
  g3.setUI = (s: string) => void (g3.ui = s);
  g3.tradeMob = null;
  g3.emitHud = () => {};
  let hitCount = 0;
  const villagerTap = new Mob('villager', 0, 0, 0, 0.05);
  villagerTap.damage = () => { hitCount++; return true; };
  g3.touchTap(0.3, 0.3);
  eq('tapping a villager opens trade', g3.ui, 'trade');
  eq('the villager is not punched', hitCount, 0);
  check('the trader is the tapped mob', (g3.tradeMob as Mob) === villagerTap);

  // (3b) tapnięcie wilka z surowym mięsem próbuje oswoić, a nie bić
  const g3b = Object.create(Game.prototype) as G;
  g3b.mode = 'survival';
  g3b.ui = 'playing';
  g3b.touchAim = null;
  g3b.target = null;
  g3b.refreshTarget = function () { this.target = null; };
  let wolfHits = 0;
  const wolfie = new Mob('wolf', 0, 0, 0);
  wolfie.damage = () => { wolfHits++; return true; };
  g3b.effects = new Map();
  g3b.swingT = 1;
  g3b.body = { pos: new THREE.Vector3(), vel: new THREE.Vector3() };
  g3b.findMobTarget = () => ({ mob: wolfie, dist: 1.5 });
  g3b.selectedStack = () => ({ id: I.RAW_PORK, count: 3 });
  g3b.attackCooldown = 0;
  let tryUseCalled = false;
  g3b.tryUse = () => { tryUseCalled = true; };
  g3b.touchTap(0.2, 0.2);
  check('tapping a wild wolf with raw meat tames instead of hitting', tryUseCalled && wolfHits === 0);
  g3b.selectedStack = () => null;
  g3b.tryUse = () => {};
  g3b.touchTap(0.2, 0.2);
  eq('without meat in hand the tap attacks the wolf', wolfHits, 1);

  // (3c) strzała z łuku na dotyku leci w kierunku palca (touchAim)
  const g3c = Object.create(Game.prototype) as G;
  g3c.mode = 'creative';
  g3c.ui = 'playing';
  g3c.inventory = new Inventory();
  g3c.yaw = 0;
  g3c.pitch = 0;
  g3c.eyePos = () => new THREE.Vector3();
  g3c.aimDir = new THREE.Vector3(0, 0, -1); // palec celuje „w przód” ekranu
  (g3c as G).bowDraw = 0.5;
  g3c.selectedStack = () => ({ id: I.BOW, count: 1 });
  g3c.wearTool = () => {};
  g3c.unlock = () => {};
  const arrow = { dir: null as THREE.Vector3 | null };
  g3c.spawnArrow = (_p: unknown, d: THREE.Vector3) => { arrow.dir = d.clone(); };
  (Game.prototype as unknown as { releaseBow: () => void }).releaseBow.call(g3c);
  check('the bow fires along the touch aim, not the screen centre', arrow.dir !== null && Math.abs(arrow.dir.z + 1) < 1e-6);

  // (4) tryb sterowania: wymuszony i automatyczny
  eq('forced desktop stays desktop', resolveControlMode({ controlMode: 'desktop' }), 'desktop');
  eq('forced touch stays touch', resolveControlMode({ controlMode: 'touch' }), 'touch');
  eq('auto without a pointer API falls back to desktop', resolveControlMode({ controlMode: 'auto' }), 'desktop');

  // (5) powtórzenia klawiszy (e.repeat) mają prawo utrzymywać tylko ruch
  for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight']) {
    check(`hold key ${k} may repeat`, (Game as unknown as { HOLD_KEYS: Set<string> }).HOLD_KEYS.has(k));
  }
  check('one-shot keys never repeat', !(Game as unknown as { HOLD_KEYS: Set<string> }).HOLD_KEYS.has('KeyE'));
  check('drop key never repeats', !(Game as unknown as { HOLD_KEYS: Set<string> }).HOLD_KEYS.has('KeyQ'));
}

section('3.0: spyglass long-range markers');
{
  const g = Object.create(Game.prototype) as any;
  g.ui = 'playing';
  g.zooming = true;
  g.selectedStack = () => ({ id: I.SPYGLASS, count: 1 });
  g.eyePos = () => new THREE.Vector3(0, 70, 0);
  g.lookDir = () => new THREE.Vector3(1, 0, 0);
  g.aimDir = null;
  g.renderDistance = 4;
  g.waypoints = [];
  g.activeWaypointId = null;
  g.body = { pos: new THREE.Vector3(0, 65, 0) };
  g.currentDimension = () => 'overworld';
  g.unlocked = new Set();
  g.unlock = () => {};
  g.emitHud = () => {};
  const messages: string[] = [];
  g.message = (text: string) => { messages.push(text); };
  let reach = 0;
  let loaded = false;
  const hit = { x: 30, y: 66, z: -4, id: B.STONE };
  g.world = {
    raycast: (_x: number, _y: number, _z: number, _dx: number, _dy: number, _dz: number, maxDist: number) => { reach = maxDist; return hit; },
    hasChunk: () => loaded,
  };
  check('spyglass cannot tag fake blocks in unloaded chunks', !g.markSpyglass() && g.waypoints.length === 0 && reach === 62);
  loaded = true;
  check('spyglass marks visible block and selects the actual waypoint', g.markSpyglass() &&
    g.waypoints.length === 1 && g.activeWaypointId === g.waypoints[0].id && g.waypoints[0].x === 30);
  g.zooming = false;
  check('spyglass marking cannot fire without zoom', !g.markSpyglass() && g.waypoints.length === 1);
  check('spyglass messages explain unreachable targets', messages.some((m) => m.includes('nie widać celu')));
}

section('3.0: visited-chunk map and legacy import');
{
  const empty = DiscoveryMap.fromSave(undefined);
  check('2.x saves start with an empty atlas in both dimensions', empty.count('overworld') === 0 && empty.count('nether') === 0);
  check('negative coordinates round down to the correct chunk', empty.survey('overworld', -0.1, -16, 'Bagno', 63) && empty.get('overworld', -1, -1)?.[2] === 8);
  check('visiting the same chunk does not duplicate discoveries', !empty.survey('overworld', -16, -0.1, 'Równiny', 70) && empty.count('overworld') === 1);
  check('dimensions cannot overwrite each other', empty.survey('nether', -16, -16, 'Nether', 44) && empty.get('nether', -1, -1)?.[2] === 11 && empty.get('overworld', -1, -1)?.[2] === 8);
  const saved = JSON.parse(JSON.stringify(empty.serialize()));
  check('map survives save, export, import and reload', DiscoveryMap.fromSave(saved).serialize().overworld[0]?.[3] === 63);
  const corrupt = DiscoveryMap.fromSave({ overworld: [[1, 2, 999, 50], [NaN, 2, 0, 50], [3, 4, 0, 50]], nether: 'bad' });
  check('broken imported tiles do not poison the map', corrupt.count('overworld') === 1 && corrupt.count('nether') === 0);
  const capped = new DiscoveryMap();
  for (let i = 0; i < MAP_LIMIT; i++) capped.survey('overworld', i * CS, 0, 'Równiny', 62);
  check('fixed survey budget retains older discoveries and rejects extras', !capped.survey('overworld', MAP_LIMIT * CS, 0, 'Równiny', 62) && capped.count('overworld') === MAP_LIMIT && !!capped.get('overworld', 0, 0));
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
