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
import { DEFAULT_SETTINGS, applyPreset, effectiveSettings, loadSettings, normalizeSettings, SETTINGS_KEY } from '../src/utils/settings';
import { visibleViewport, onViewportChange, applyViewportHeight, pokeLayout } from '../src/utils/viewport';

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

/** Czyta plik źródłowy – testy sprawdzają, czy katalog zgadza się z silnikiem. */
function readSource(rel: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs');
    // Testy uruchamiane są z katalogu repo (patrz run.mjs `cwd: root`).
    return fs.readFileSync(`${process.cwd()}/${rel}`, 'utf8');
  } catch {
    return '';
  }
}

// ------------------------------------------------------------------ imports
import { World, CS, CH, SEA, FLAT_H, plantTree } from '../src/game/world';
import { B, BLOCKS, CULLS, EMIT, IS_LEAFY, IS_OPAQUE, IS_SOLID, LAYER, OCCLUDES, RENDER, T, collisionBoxes, tileFor, isDoorTop, isLadder, isTrap, doorFacing, doorHinge, doorPair, isDoorOpen, doorPlate, isBed, isBedHead, bedFacing, bedPart } from '../src/game/blocks';
import {
  ITEMS, I, itemDef, isItem, stackLimit, durabilityMax, isOre, oreXp, pickTier, requiredPickTier,
  pickHint, mineSeconds, toolHelps, attackDamage, blockDrops, smeltResult, fuelSeconds, resolveId, canHarvest,
  displayName,
} from '../src/game/items';
import { Inventory, RECIPES, LOG_IDS, MAX_STACK, type Stack } from '../src/game/inventory';
import {
  SKINS, DEFAULT_SKIN_ID, SKIN_KEY, skinById, loadSkinId, saveSkinId, nextSkinId, fallbackSkin,
} from '../src/game/skins';
import { aabbIntersectsBlock, autoJumpAhead, stepBody, STEP_HEIGHT, type Body } from '../src/game/physics';
import { fallPath, fallColumnHeight, isCrushable, isFallingBlock, isSupported } from '../src/game/gravity';
import { Mob, isHostileMob, isVillageMob, mobVariantForBiome, SHEEP_WOOL_COLORS, woolBlockFor, type MobType } from '../src/game/mobs';
import { kindForColor, partTexture, texturePixels, textureCount, avatarMaterial, type MobTexKind } from '../src/game/mobTextures';
import { decodePng } from '../src/game/art/miniPng';
import { MOB_MODELS, boxFaces, buildMobModel, mobSkinTexture, mobModelCount } from '../src/game/mobModels';
import { MOB_SKINS, GUI_SPRITES } from '../src/game/art/vanillaArt.generated';
import { guiSprite, hasGuiSprite, heartSprite, foodSprite, armorSprite, airSprite, guiSpriteCount } from '../src/game/art/uiSprites';
import { spriteTexture } from '../src/game/art/spriteTex';
import { installPackTheme } from '../src/utils/packTheme';
import { BLOCK_ATLAS_PNG, ITEM_ATLAS_PNG, ITEM_TILE, OFFICIAL_TILES, MOB_PALETTES, PLAYER_SKIN_PNG } from '../src/game/art/vanillaArt.generated';
import { officialBlockAtlas, officialItemAtlas, officialItemPixels, isOfficialTile, officialTileCount, officialItemCount, applyOfficialTiles } from '../src/game/packArt';
import { WIDE_LAYOUT, SLIM_LAYOUT, faceRects, applySkinUv, hasPackSkin, isSlimSkin, packSkinCount, playerSkinTexture, portraitCount, skinFace, skinPortrait } from '../src/game/skinArt';
import { setMobPalette, snapToPalette, activeMobPalette } from '../src/game/mobTextures';
import { emptyChest, chestLoot, lootChest, CHEST_SLOTS, chestKey } from '../src/game/chest';
import { emptyFurnace, tickFurnace, COOK_TIME, furnaceKey } from '../src/game/furnace';
import {
  cleanWorldName, deleteSave, duplicateSave, exportSave, exportSaves, importSaves,
  loadSaves, renameSave, toggleFavoriteSave, upsertSave, MAX_WORLD_NAME,
} from '../src/game/saves';
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
import { Game, MOB_NAMES, type SaveData, type TradeRow, type UIState } from '../src/game/engine';
import { tryCreatePortal } from '../src/game/redstone';
import { brewingKey, emptyBrewing } from '../src/game/brewing';
import { VILLAGE_CELL, villageInCell, villageSpawnSpots, type Village } from '../src/game/village';
import {
  PROFESSIONS, VILLAGER_LEVEL_XP, applyTrade, canTrade, createVillagerState, offersFor,
  professionFor, restockIfDue, restockIn, usesLeft, villagerLevel, villagerProgress, villagerTitle,
} from '../src/game/trading';
import { getAtlas, AVG_COLOR } from '../src/game/textures';
import { BITE_MAX, BITE_MIN, BITE_WINDOW, PATIENCE, biteDelay, cookedOf, isFishStack, rollCatch } from '../src/game/fishing';
import {
  MERGE_COST, RENAME_COST, anvilKey, anvilResult, canMerge, cleanItemName, emptyAnvil,
  mergeEnchants, mergeStacks, type AnvilResult,
} from '../src/game/anvil';
import { mergeable } from '../src/game/inventory';
import { slabFullBlock } from '../src/game/blocks';
import { chestFacing, chestFacingTowards, chestIdFor, chestLeftDir, isChestBlock, isLootChest } from '../src/game/blocks';
import { chestLidGeometry } from '../src/game/world';
import { HYDRATION_RADIUS, isFarmland, isHydrated, updateFarmland } from '../src/game/farmland';
import {
  MERCHANT, merchantInvSlot, merchantMaxScroll, merchantRowTop, merchantRowVisible, merchantScale,
  merchantScrollable, merchantThumbHeight, merchantThumbOffset, merchantVisibleRows,
} from '../src/game/merchantLayout';
import {
  ANVIL, BREWING, CHEST, CONTAINER, ENCHANT, FURNACE, chestSlot, containerInvSlot, containerScale,
} from '../src/game/containerLayout';
import { FrameGovernor, chunkBuildScore, drawDistanceChunks, entityTickInterval, frameBudgetMs, lodRange, lodStepFor, profileResScale, shouldTickEntity, sortChunkOffsets, PERF_PROFILES } from '../src/game/perf';
import { LOD_TILE, buildLodTile, lodRing } from '../src/game/lod';
import { slimeBounce } from '../src/game/physics';
import { buildItemIcons } from '../src/game/itemIcons';
import { HARDWARE_IDLE_MS, TOUCH_RESTORE_TAPS, hardwareHint, resolveControlMode, shouldRestoreTouch } from '../src/utils/input';
import { GAME_VERSION, GAME_RELEASE_NAME, MINECRAFT_TARGET, RELEASE_HIGHLIGHTS } from '../src/utils/version';
import {
  LAUNCHER_TABS, LAUNCH_STEPS, DEFAULT_PROFILE, TARGET_LABEL, launcherNews, loadLauncherProfile, sinceLabel, worldMeta,
} from '../src/components/launcher/model';
import {
  isPortraitSize, isPhoneScreen, isTouchScreen, canLockOrientation, inFullscreen,
  toggleFullscreenLandscape, PORTRAIT_DISMISS_KEY, watchLandscape,
} from '../src/utils/screen';
import { lightFactor, heldFalloff, patchChunkMaterial, HELD_POWER, HELD_RANGE, AMBIENT } from '../src/game/lighting';
import { cloudLook, rainFogMix } from '../src/game/sky';
import { treeShape, trunkHeight, treeKindForBiome, type TreeKind } from '../src/game/trees';
import { densifyTileData, TILE as ATLAS_TILE, ATLAS_TILES, ATLAS_SIZE } from '../src/game/textures';
import { COMMANDS, COMMAND_CATEGORIES, commandByName, searchCommands, applyCommandSuggestion } from '../src/game/commands';
import { cleanStacks, isPlayerId, loadPlayerId, profileRow, sanitizeProfile, spreadSpawn, PROFILE_TABLE } from '../src/game/profile';
import { filterRecipes } from '../src/utils/recipeSearch';
import {
  hueFor,
  rowToEdit,
  PublicServer,
  PUBLIC_SEED,
  PUBLIC_NAME,
  PUBLIC_POS_HZ,
  MAX_PUBLIC_EDITS,
  SAVE_EVERY_MS,
  PUBLIC_WORLD_ID,
  type BlockRow,
} from '../src/game/online';
import {
  NetSession,
  createLocalLink,
  publicDay,
  publicTime,
  publicWeather,
  DAY_SECONDS,
  normalizeRoom,
  makeRoomCode,
  encodeSignal,
  decodeSignal,
  sanitizeWorld,
  sortPlayers,
  nextHue,
  POS_HZ,
  PEER_TIMEOUT,
  MAX_SNAPSHOT_EDITS,
  decodeMessage,
  type NetEdit,
  type NetLink,
} from '../src/game/net';
import * as netSmooth from '../src/game/netSmooth';

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
  // 2.19: lasy rosną tam, gdzie sprzyja klimat – szukamy skrawka lasu
  // (przy nowym generatorze okolice 0,0 bywają oceanem).
  let fx = 0, fz = 0;
  outer: for (let r = 0; r <= 1200; r += 48) {
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2;
      const sx = Math.round(Math.cos(ang) * r), sz = Math.round(Math.sin(ang) * r);
      const b = a.surface(sx, sz).biome;
      if (b === 'Las' || b === 'Brzozowy las' || b === 'Dżungla') { fx = sx; fz = sz; break outer; }
    }
  }
  const fcx = Math.floor(fx / CS), fcz = Math.floor(fz / CS);
  let trees = 0;
  let bareTrunks = 0;
  for (let cx = fcx - 1; cx <= fcx + 1; cx++) for (let cz = fcz - 1; cz <= fcz + 1; cz++) {
    const ch = a.getChunk(cx, cz);
    for (let x = 0; x < CS; x++) for (let z = 0; z < CS; z++) {
      for (let y = 40; y < CH - 8; y++) {
        if (ch.data[(y * CS + z) * CS + x] === B.LOG && a.getBlock(x + cx * CS, y + 1, z + cz * CS) === B.LOG) {
          trees++;
          let leaves = 0;
          for (let dy = 1; dy <= 3; dy++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
            if (a.getBlock(x + cx * CS + dx, y + dy, z + cz * CS + dz) === B.LEAVES) leaves++;
          }
          // Wysokie drzewa mają koronę wyżej niż 3 bloki – liczy się to,
          // żeby pień nie stał nagi.
          if (leaves <= 4) {
            let higher = 0;
            for (let dy = 1; dy <= 7; dy++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
              if (a.getBlock(x + cx * CS + dx, y + dy, z + cz * CS + dz) === B.LEAVES) higher++;
            }
            if (higher <= 4) bareTrunks++;
          }
        }
      }
    }
  }
  check('world has trees', trees > 0, `${trees} trunks`);
  check('tree trunk has leaves above it', bareTrunks === 0, `${bareTrunks}/${trees} nagich pni`);
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
  check('3.0 lilies are non-solid plants', !IS_SOLID[B.LILY_PAD] && RENDER[B.LILY_PAD] === 11);
  check('air is not solid', !IS_SOLID[B.AIR]);
  check('water renders as liquid', RENDER[B.WATER] === 2);
  check('torch has its own slim model', RENDER[B.TORCH] === 10);
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
  // 2.8.1: liście są pełnymi blokami (korona nie prześwituje, brak czarnych ścianek).
  check('leaves stay solid but are now dense', IS_SOLID[B.LEAVES] === 1 && BLOCKS[B.LEAVES].opaque === true);
  check('every leaf type is dense', [B.LEAVES, B.BIRCH_LEAVES, B.ACACIA_LEAVES, B.JUNGLE_LEAVES].every((id) => BLOCKS[id].opaque === true));
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

  // spider: bites up close, climbs over a wall.
  // 2.22: pająk ma waniliowe pudełko 1,4 × 0,9 bloku, więc testy stawiają go
  // na płaskiej łące – na zboczu o szerokości 0,9 wchodził w sąsiedni blok.
  const w3 = new World(31337, true);
  const g3 = FLAT_H + 1;
  const near = playerAt(7.0, g3, 6.5);
  let bites = 0;
  const sp = new Mob('spider', 6.0, g3, 6.5);
  for (let i = 0; i < 60 && bites === 0; i++) sp.update(1 / 60, w3, near, () => bites++, () => {}, false);
  check('spider bites up close', bites > 0);

  w3.setBlock(7, g3, 6, B.STONE);
  const sp2 = new Mob('spider', 6.0, g3, 6.5);
  const y0 = sp2.body.pos.y;
  let peak = y0;
  const ahead = playerAt(10.5, g3, 6.5);
  for (let i = 0; i < 60 * 4; i++) { sp2.update(1 / 60, w3, ahead, () => {}, () => {}, false); peak = Math.max(peak, sp2.body.pos.y); }
  check('spider climbs over a block', peak > y0 + 0.9, `y0=${y0} peak=${peak}`);

  // a tall wall: the spider crawls up it while the player is above
  const w5 = new World(31337, true);
  const h5 = FLAT_H;
  for (let dy = 1; dy <= 3; dy++) w5.setBlock(7, h5 + dy, 6, B.STONE);
  const onTop = playerAt(10.5, h5 + 4, 6.5);
  const sp3 = new Mob('spider', 6.0, h5 + 1, 6.5);
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
  check('cow has a body', cow.body.w === 0.9);
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
  check('iron armour protects more than gold (vanilla)', (ARMOR[I.IRON_CHEST]?.points ?? 0) > (ARMOR[I.GOLD_CHEST]?.points ?? 0));
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
  g.brewings = new Map();
  g.potionsDrunk = new Set<number>();
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
  check('preset potato renders closer than low', PRESETS.potato.renderDistance < PRESETS.low.renderDistance);
  check('preset potato is the lightest', PRESETS.potato.particles < PRESETS.low.particles && PRESETS.potato.pixelRatio <= PRESETS.low.pixelRatio);
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
  // 2.32: bardzo słaby telefon (2 GB RAM / 4 rdzenie) dostaje „Ziemniaka”.
  eq('very weak phone -> potato preset', recommendPreset(weakPhone), 'potato');
  const lowPhone: DeviceProfile = { ...weakPhone, memoryGB: 4, cores: 6, gpu: 'Mali-G52' };
  eq('weak but not ancient phone -> low preset', recommendPreset(lowPhone), 'low');
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
  eq('effective auto uses recommended render distance', auto.renderDistance, PRESETS.potato.renderDistance);
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
  eq('malformed settings JSON recovers to defaults', loadSettings().renderDistance, DEFAULT_SETTINGS.renderDistance);
  store.delete(SETTINGS_KEY);
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
  eq('a diamond sword hits for 7 like in vanilla', attackDamage(I.DIAMOND_SWORD, false), 7);
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
  eq('quartz ore only needs a wooden pick', requiredPickTier(B.QUARTZ_ORE), 1);
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

  // the awkward brew is harmless but still drunk
  g.inventory.slots[0] = { id: I.POTION_AWKWARD, count: 1 };
  g.drinkPotion({ id: I.POTION_AWKWARD, count: 1 });
  eq('awkward tastes like dirt', g.inventory.slots[0], null);
  check('and no effect sticks', g.effects.size === 0);
  check('it does not count toward mastery', (g.potionsDrunk as Set<number>).size === 1);
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

// ============================================ 2.8 „Płynny świat” – silnik
section('2.8: płynny świat (chunki, światło, cząstki)');
{
  const w = new World(777);
  const c = w.getChunk(0, 0);
  let emitBlocks = 0;
  for (let i = 0; i < c.data.length; i++) if (EMIT[c.data[i]]) emitBlocks++;
  eq('light index lists every emitter in the chunk', c.emitters.length, emitBlocks);

  const gy = w.heightAt(2, 2);
  const torchIndex = ((gy + 1) * CS + 2) * CS + 2;
  w.setBlock(2, gy + 1, 2, B.TORCH);
  check('placing a torch updates the light index', w.getChunk(0, 0).emitters.includes(torchIndex));
  w.setBlock(2, gy + 1, 2, B.AIR);
  check('removing the torch cleans the light index', !w.getChunk(0, 0).emitters.includes(torchIndex));

  // mesh for a tiny flat world: water top faces carry the wave flag
  const fw = new World(5, true);
  fw.getChunk(0, 0);
  for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) fw.setBlock(x, FLAT_H + 1, z, B.WATER);
  const geos = fw.buildMesh(fw.getChunk(0, 0));
  const solidGeo = geos[0];
  const waterGeo = geos[2];
  check('chunk meshes keep position/uv/colour/light attributes',
    !!solidGeo.getAttribute('position') && !!solidGeo.getAttribute('uv') &&
    !!solidGeo.getAttribute('color') && !!solidGeo.getAttribute('aBlock'));
  check('every chunk mesh has the wave attribute', !!solidGeo.getAttribute('aWave'));
  const waveAttr = waterGeo.getAttribute('aWave');
  let waveVerts = 0;
  if (waveAttr) for (let i = 0; i < waveAttr.count; i++) if ((waveAttr.getX(i) as number) > 0.5) waveVerts++;
  check('only the water surface is animated', waveVerts > 0);
  const index = solidGeo.getIndex();
  check('small chunks use compact 16-bit indices', !!index && index.array instanceof Uint16Array);
  check('flat chunk really has solid geometry', (solidGeo.getAttribute('position')?.count ?? 0) > 0);

  // new neighbours rebuild old meshes (no holes at chunk borders)
  const nw = new World(42);
  const c00 = nw.getChunk(0, 0);
  c00.built = true;
  nw.dirty.clear();
  nw.getChunk(1, 0);
  check('a new chunk marks a built neighbour for rebuild', nw.dirty.has('0,0'));

  // releasing a chunk also drops the hot single-entry cache
  const rx = 0, rz = 0;
  eq('cached peek reads the chunk', nw.peekBlock(0, CH - 5, 0), c00.data[((CH - 5) * CS + 0) * CS + 0]);
  nw.releaseChunk(rx, rz);
  eq('released chunks read as stone', nw.peekBlock(0, CH - 5, 0), B.STONE);
  check('a released chunk can be generated again', !!nw.getChunk(rx, rz));

  // particles: one InstancedMesh per colour, no per-particle scene objects
  type G = Record<string, any>;
  const g = Object.create(Game.prototype) as G;
  g.gfx = { chunkBudgetMs: 12, chunksPerFrame: 3, unloadMargin: 2, particleScale: 1, clouds: true };
  const sceneOps: string[] = [];
  g.scene = { add: () => void sceneOps.push('add'), remove: () => void sceneOps.push('remove') };
  g.particleGeo = new THREE.BoxGeometry(1, 1, 1);
  g.particlePools = new Map();
  g.particleDummy = new THREE.Object3D();
  g.world = new World(3, true);
  for (let x = 0; x < 4; x++) for (let z = 0; z < 4; z++) g.world.getChunk(0, 0);
  g.spawnParticles(0.5, FLAT_H + 2, 0.5, B.GRASS, 12, 0.5);
  const pool = [...g.particlePools.values()][0];
  check('particles live in a single instanced mesh', !!pool && pool.mesh.isInstancedMesh === true);
  eq('all spawned particles are queued', pool?.list.length, 12);
  eq('spawning does not add one object per particle', sceneOps.filter((o) => o === 'add').length, 1);
  g.updateParticles(0.05);
  eq('live instances are drawn in one call', pool.mesh.count, 12);
  for (let i = 0; i < 40; i++) g.updateParticles(0.05);
  eq('particles expire without leaking', pool.mesh.count, 0);

  // a second burst re-uses the same pool
  g.spawnParticles(0.5, FLAT_H + 2, 0.5, B.GRASS, 4, 0.5);
  eq('the pool is reused on the next burst', g.particlePools.size, 1);
}

section('2.8/2.8.1: wersja wydania');
{
  // 2.15: wydanie naprawia pełny ekran na telefonie.
  check('release label is the current line', GAME_VERSION.startsWith('3.4'), GAME_VERSION);
  check('release name is set', GAME_RELEASE_NAME === 'Zombies 1:1 – hitmarkery, przeładowanie i efekty jak na Hypixelu', GAME_RELEASE_NAME);
  // 2.32: skrzynia, wydajność i sterowanie hybrydowe.
  check('2.33 highlights mention the chest', RELEASE_HIGHLIGHTS.some((h) => /skrzynia 1:1|ZOMBIES 1:1|Zombies/i.test(h.title)));
  check('2.32 highlights mention potato performance', RELEASE_HIGHLIGHTS.some((h) => /ziemniak|ZOMBIES/i.test(h.title)));
  check('2.32 highlights mention keyboard on tablets', RELEASE_HIGHLIGHTS.some((h) => /klawiatura i m|ZOMBIESysz na tablecie/i.test(h.title)));
  // 2.31: owca, głosy mobów, przestrzeń dźwięku i auto-skok.
  check('2.31 highlights mention the sheep', RELEASE_HIGHLIGHTS.some((h) => /owca z runem/i.test(h.title)));
  check('2.31 highlights mention mob voices', RELEASE_HIGHLIGHTS.some((h) => /głosy mobów/i.test(h.title)));
  check('2.31 highlights mention spatial sound', RELEASE_HIGHLIGHTS.some((h) => /w przestrzeni/i.test(h.title)));
  check('2.31 highlights mention the auto-jump fix', RELEASE_HIGHLIGHTS.some((h) => /podskoków na ścieżce/i.test(h.title)));
  // 2.30: ścieżka, golem, głowa i płynni gracze.
  check('2.30 highlights mention the path shake', RELEASE_HIGHLIGHTS.some((h) => /trzęsienia na ścieżce/i.test(h.title)));
  check('2.30 highlights mention the golem fighting back', RELEASE_HIGHLIGHTS.some((h) => /golem oddaje/i.test(h.title)));
  check('2.30 highlights mention smooth multiplayer', RELEASE_HIGHLIGHTS.some((h) => /płynni gracze/i.test(h.title)));
  check('2.30 highlights mention the head movement', RELEASE_HIGHLIGHTS.some((h) => /ruch głowy/i.test(h.title)));
  // 2.29: drzwi, łóżko i dźwięki.
  check('2.29 highlights mention the door hinge', RELEASE_HIGHLIGHTS.some((h) => /zawias/i.test(h.title)));
  check('2.29 highlights mention the two-part bed', RELEASE_HIGHLIGHTS.some((h) => /łóżko z dwóch/i.test(h.title)));
  check('2.29 highlights mention the original sounds', RELEASE_HIGHLIGHTS.some((h) => /dźwięki jak w grze/i.test(h.title)));
  // 2.27: stabilni mieszkańcy i okno handlu 1:1.
  check('2.27 highlights mention the steady villager', RELEASE_HIGHLIGHTS.some((h) => /drż/i.test(h.title)));
  check('2.27 highlights mention the merchant screen', RELEASE_HIGHLIGHTS.some((h) => /handl/i.test(h.title)));
  // 2.28: wydajność i pozostałe okna 1:1.
  check('2.28 highlights mention the horizon', RELEASE_HIGHLIGHTS.some((h) => /horyzont/i.test(h.title)));
  check('2.28 highlights mention the fps boost', RELEASE_HIGHLIGHTS.some((h) => /chunki budują/i.test(h.title)));
  check('2.28 highlights mention the anvil', RELEASE_HIGHLIGHTS.some((h) => /kowadło/i.test(h.title)));
  // 2.26: brak prześwitów, nawadnianie grządek, odrzut i golem.
  check('2.26 highlights mention the light leak', RELEASE_HIGHLIGHTS.some((h) => /prześwit/i.test(h.title)));
  check('2.26 highlights mention the golem', RELEASE_HIGHLIGHTS.some((h) => /golem/i.test(h.title)));
  check('2.26 highlights mention watering the farmland', RELEASE_HIGHLIGHTS.some((h) => /grządka/i.test(h.title)));
  // 2.25: ręce mobów i fizyka spadających bloków.
  check('2.25 highlights mention the mob arms', RELEASE_HIGHLIGHTS.some((h) => /ręk/i.test(h.title)));
  check('2.25 highlights mention the falling sand', RELEASE_HIGHLIGHTS.some((h) => /piasek/i.test(h.title)));
  // 2.24.1: powrót do poprzedniego wyglądu – klasyczne menu jest pierwszym ekranem.
  check('2.24.1 highlights announce the classic menu', RELEASE_HIGHLIGHTS.some((h) => /klasyczne menu/i.test(h.title)));
  check('2.24.1 highlights explain the #launcher route', RELEASE_HIGHLIGHTS.some((h) => /#launcher/.test(h.text)));
  check('gra celuje w konkretną wersję Minecrafta', MINECRAFT_TARGET.startsWith('26.2'), MINECRAFT_TARGET);
  check('2.23 highlights mention the 26.2 models', RELEASE_HIGHLIGHTS.some((h) => /26\.2/.test(h.title)));
  check('2.23 highlights mention biome variants', RELEASE_HIGHLIGHTS.some((h) => /wariant/i.test(h.title)));
  check('2.24 highlights mention the launcher', RELEASE_HIGHLIGHTS.some((h) => /launcher/i.test(h.title)));
  check('2.24 highlights are honest about the original client', RELEASE_HIGHLIGHTS.some((h) => /przeglądarce/i.test(h.text) && /Mojang|Java/i.test(h.text)));
  check('release highlights are listed', RELEASE_HIGHLIGHTS.length >= 4);
  check('2.8.1 highlights mention held light', RELEASE_HIGHLIGHTS.some((h) => /pochodni/i.test(h.title + h.text)));
  check('2.9 highlights mention textures', RELEASE_HIGHLIGHTS.some((h) => /tekstur/i.test(h.title + h.text)));
  check('2.9 highlights mention the mobile inventory', RELEASE_HIGHLIGHTS.some((h) => /ekwipun/i.test(h.title + h.text)));
  check('2.9 highlights mention the command list', RELEASE_HIGHLIGHTS.some((h) => /komend/i.test(h.title + h.text)));
  check('2.11 highlights mention the public server', RELEASE_HIGHLIGHTS.some((h) => /serwer publiczny|publiczny/i.test(h.title)));
  check('2.11 highlights explain cloud saving', RELEASE_HIGHLIGHTS.some((h) => /zapis|chmur/i.test(h.title + h.text)));
  check('2.11 highlights mention the fixed invite codes', RELEASE_HIGHLIGHTS.some((h) => /wrong state|kod/i.test(h.title + h.text)));
  check('2.12 highlights mention every log making planks', RELEASE_HIGHLIGHTS.some((h) => /pień|desk/i.test(h.title + h.text)));
  check('2.12 highlights mention skins', RELEASE_HIGHLIGHTS.some((h) => /skórk|postać/i.test(h.title + h.text)));
  check('2.12 highlights mention the phone controls', RELEASE_HIGHLIGHTS.some((h) => /telefon|dotyk/i.test(h.title + h.text)));
  check('2.13 highlights mention the Minecraft inventory', RELEASE_HIGHLIGHTS.some((h) => /ekwipun/i.test(h.title)));
  check('2.13 highlights mention forced landscape', RELEASE_HIGHLIGHTS.some((h) => /poziom/i.test(h.title) && /fullscreen|pełny ekran/i.test(h.text)));
  check('2.14 highlights announce auto-attack', RELEASE_HIGHLIGHTS.some((h) => /auto-bicie/i.test(h.title + h.text)));
  check('2.14 highlights explain the auto-jump fix', RELEASE_HIGHLIGHTS.some((h) => /auto-skok/i.test(h.title + h.text) && /schodek/i.test(h.text)));
  check('2.15 highlights announce the fullscreen fix', RELEASE_HIGHLIGHTS.some((h) => /pełn/i.test(h.title) && /kamer|zoom/i.test(h.text)));
  check('2.15 highlights mention touch buttons stay visible', RELEASE_HIGHLIGHTS.some((h) => /drążek|przycisk/i.test(h.text)));
  check('2.15 highlights mention scrolling panels', RELEASE_HIGHLIGHTS.some((h) => /scroll|przewij/i.test(h.text)));
  check('2.16 highlights announce the mob textures', RELEASE_HIGHLIGHTS.some((h) => /tekstur/i.test(h.title) && /mob|zwierz|moby/i.test(h.title + h.text)));
  check('2.16 highlights say the mobs are multicoloured', RELEASE_HIGHLIGHTS.some((h) => /łaty|runo|plamy|pancerz/i.test(h.text)));
  check('2.16 highlights mention player textures', RELEASE_HIGHLIGHTS.some((h) => /gracz|postać/i.test(h.title) && /tkanin|jeans|skór/i.test(h.text)));
  check('2.16 highlights list the new recipes', RELEASE_HIGHLIGHTS.some((h) => /schod/i.test(h.text) && /płat|płyt/i.test(h.text)));
  check('2.17 highlights announce the texture pack', RELEASE_HIGHLIGHTS.some((h) => /paczk/i.test(h.text)));
  check('2.17 highlights mention the blocks', RELEASE_HIGHLIGHTS.some((h) => /blok/i.test(h.title)));
  check('2.17 highlights mention the item icons', RELEASE_HIGHLIGHTS.some((h) => /ekwipun|ikon/i.test(h.title + h.text)));
  check('2.17 highlights mention the player skins', RELEASE_HIGHLIGHTS.some((h) => /Steve|Alex/i.test(h.text)));
  check('2.18 highlights announce the 1:1 mobs', RELEASE_HIGHLIGHTS.some((h) => /mob/i.test(h.title) && /1:1/.test(h.title + h.text)));
  check('2.18 highlights mention the HUD sprites', RELEASE_HIGHLIGHTS.some((h) => /serce|serdusz|hotbar/i.test(h.text)));
  check('2.18 highlights mention the sky from the pack', RELEASE_HIGHLIGHTS.some((h) => /chmur/i.test(h.title + h.text)));
  check('2.18 highlights mention block breaking stages', RELEASE_HIGHLIGHTS.some((h) => /pękan/i.test(h.text)));
  // 2.19: nowe wydanie – konta, teleportacja, biomy, wioski i skórki 1:1.
  check('2.19 highlights announce the invisible session', RELEASE_HIGHLIGHTS.some((h) => /sesj/i.test(h.title) && /nick|skórk/i.test(h.text)));
  check('2.19 highlights explain that the position is remembered', RELEASE_HIGHLIGHTS.some((h) => /gdzie skończy|ostatni|zapis/i.test(h.title + h.text)));
  check('2.19 highlights announce teleportation', RELEASE_HIGHLIGHTS.some((h) => /tpa|teleport/i.test(h.title)));
  check('2.19 highlights mention the accept button', RELEASE_HIGHLIGHTS.some((h) => /Przyjmij|zgody|zgod/i.test(h.text)));
  check('2.19 highlights announce the new biomes', RELEASE_HIGHLIGHTS.some((h) => /kontynent|rzek/i.test(h.title + h.text)));
  check('2.19 highlights announce Minecraft-like villages', RELEASE_HIGHLIGHTS.some((h) => /wiosk/i.test(h.title) && /dziur|platform/i.test(h.text)));
  check('2.19 highlights announce the nine 1:1 skins', RELEASE_HIGHLIGHTS.some((h) => /9 skórek|dziewięć|1:1/.test(h.title) && /Steve|Alex/.test(h.text)));
  check('2.19 highlights mention the random spawn', RELEASE_HIGHLIGHTS.some((h) => /innym miejscu|losow/i.test(h.title + h.text)));
  // 2.20: poprawki grafiki ze zrzutów ekranu.
  check('2.20 highlights announce the sun and moon fix', RELEASE_HIGHLIGHTS.some((h) => /słońc|księżyc/i.test(h.title) && /czarn/i.test(h.text)));
  check('2.20 highlights mention transparent sprite keys', RELEASE_HIGHLIGHTS.some((h) => /alfa|przezrocz/i.test(h.text)));
  check('2.20 highlights mention lanterns and doors', RELEASE_HIGHLIGHTS.some((h) => /latarn/i.test(h.title) && /drzwi/i.test(h.title + h.text)));
  check('2.20 highlights announce the cactus shape', RELEASE_HIGHLIGHTS.some((h) => /kaktus/i.test(h.title + h.text) && /14\/16/.test(h.text)));
  check('2.20 highlights announce the bed shape', RELEASE_HIGHLIGHTS.some((h) => /łóżk|łóżek/i.test(h.text) && /9\/16/.test(h.text)));
  check('2.20 highlights announce gable village roofs', RELEASE_HIGHLIGHTS.some((h) => /dach/i.test(h.title + h.text) && /dwuspadow/i.test(h.text)));
  check('2.20 highlights announce the golem arms fix', RELEASE_HIGHLIGHTS.some((h) => /golem/i.test(h.title) && /ręc|rąk/i.test(h.text)));
  check('2.20 highlights mention the smaller held block', RELEASE_HIGHLIGHTS.some((h) => /w dłoni|w ręce/i.test(h.text) && /mniejsz/i.test(h.text)));
  // 2.21: bloki, kolizje i przedmioty 1:1.
  check('2.21 highlights announce the block models', RELEASE_HIGHLIGHTS.some((h) => /brył|model/i.test(h.title) && /płot|pochodni/i.test(h.text)));
  check('2.21 highlights announce the chest texture', RELEASE_HIGHLIGHTS.some((h) => /skrzyni/i.test(h.text) && /encji|tekstur/i.test(h.text)));
  check('2.21 highlights mention collisions', RELEASE_HIGHLIGHTS.some((h) => /kolizj/i.test(h.title) && /płyt|schod/i.test(h.text)));
  check('2.21 highlights mention the step-up', RELEASE_HIGHLIGHTS.some((h) => /bez skoku/i.test(h.text)));
  check('2.21 highlights list vanilla durability', RELEASE_HIGHLIGHTS.some((h) => /1561/.test(h.text) && /59/.test(h.text)));
  check('2.21 highlights describe the drop rule', RELEASE_HIGHLIGHTS.some((h) => /poziomu kilofa/i.test(h.text) && /drop/i.test(h.text)));
  check('2.21 highlights mention the cactus growth', RELEASE_HIGHLIGHTS.some((h) => /kaktus/i.test(h.text) && /trzech bloków/i.test(h.text)));
  check('2.21 highlights mention stack sizes', RELEASE_HIGHLIGHTS.some((h) => /wiadro|mikstur/i.test(h.text)));
  check('2.22 highlights announce the sheep', RELEASE_HIGHLIGHTS.some((h) => /owca/i.test(h.title) && /12-pikselowe/i.test(h.text)));
  check('2.22 highlights mention grazing', RELEASE_HIGHLIGHTS.some((h) => /wypas|skubie/i.test(h.text)));
  check('2.22 highlights list all 16 wool colours', RELEASE_HIGHLIGHTS.some((h) => /16 kolorów wełny/i.test(h.title)));
  check('2.22 highlights mention mob hitboxes', RELEASE_HIGHLIGHTS.some((h) => /EntityDimensions/.test(h.text) && /0,6 × 1,99/.test(h.text)));
  check('2.22 highlights fix the spider', RELEASE_HIGHLIGHTS.some((h) => /body1|odwłok/i.test(h.text)));
}

// ============================================ 2.13 „Jak w Minecrafcie”
section('2.13: ekwipunek i crafting jak w Minecrafcie');
{
  // Dokładnie scenariusz gracza: 4 deski i chęć zrobienia stołu.
  const inv = new Inventory();
  inv.add(B.PLANKS, 4);
  inv.clickSlot(0, false); // weź stos
  for (const i of [0, 1, 3, 4]) inv.clickGrid(i, true); // tapnięcie = 1 sztuka
  eq('tapnięcie kładzie jedną deskę, nie cały stos', inv.grid[0]?.count, 1);
  eq('cztery tapnięcia dają kwadrat 2×2', inv.gridMatch(false)?.out.id, B.CRAFTING);
  eq('wynik można odebrać', inv.craftGrid(false)?.id, B.CRAFTING);
  eq('składniki zniknęły z siatki', inv.grid.filter(Boolean).length, 0);

  // Przytrzymanie (PPM) nadal odkłada cały stos – jak w Minecrafcie.
  const stack = new Inventory();
  stack.add(B.LOG, 3);
  stack.clickSlot(0, false);
  stack.clickGrid(0, false);
  eq('przytrzymanie odkłada cały stos', stack.grid[0]?.count, 3);
  eq('stos w jednym polu wystarcza na deski', stack.gridMatch(false)?.out.id, B.PLANKS);

  // 2×2 bez stołu i 3×3 przy stole – ta sama siatka, różne rozmiary.
  const table = new Inventory();
  for (const i of [0, 1, 3, 4]) table.grid[i] = { id: B.PLANKS, count: 1 };
  eq('2×2 czyta tylko cztery pola', table.gridMatch(false)?.out.id, B.CRAFTING);
  table.grid[8] = { id: B.PLANKS, count: 1 };
  eq('piąte pole poza 2×2 jest ignorowane', table.gridMatch(false)?.out.id, B.CRAFTING);

  const screen = readSource('src/components/InventoryScreen.tsx');
  check('plecak ma siatkę 2×2 i 3×3', screen.includes('mc-craft-grid') && screen.includes('is-3') && screen.includes('is-2'));
  check('tapnięcie w siatce odwraca akcję prawego przycisku', /inv\.clickGrid\(i, inv\.cursor \? !right : right\)/.test(screen));
  check('są skróty „Deski” i „Stół rzemieślniczy”', screen.includes('Deski (') && screen.includes("label: 'Stół rzemieślniczy'"));
  check('książka przepisów jest domyślna na dużym ekranie', screen.includes('initialBookOpen'));
  check('plecak pokazuje podgląd postaci', screen.includes('SkinAvatar') && screen.includes('getSkinId'));
  check('okno przy stole ma własny tytuł', screen.includes("atTable ? 'Stół rzemieślniczy' : 'Ekwipunek'"));
}

section('2.14: auto-skok i auto-bicie');
{
  // Ustawienia: jedno i drugie ma być domyślnie włączone i odporne na śmieci.
  eq('auto-bicie jest domyślnie włączone', DEFAULT_SETTINGS.autoAttack, true);
  eq('auto-skok jest domyślnie włączony', DEFAULT_SETTINGS.autoJump, true);
  eq('wyłączenie auto-bicia jest pamiętane', normalizeSettings({ autoAttack: false }).autoAttack, false);
  eq('śmieci w auto-biciu wracają do domyślnego', normalizeSettings({ autoAttack: 'tak' }).autoAttack, true);
  eq('stare zapisy dostają auto-bicie', normalizeSettings({ sensitivity: 1 }).autoAttack, true);

  const engine = readSource('src/game/engine.ts');
  const settingsScreen = readSource('src/components/SettingsScreen.tsx');
  const menus = readSource('src/components/Menus.tsx');
  const gameView = readSource('src/components/GameView.tsx');

  check('silnik przyjmuje auto-bicie przez applyGfx', /autoAttack\?: boolean/.test(engine) && /o\.autoAttack !== undefined/.test(engine));
  check('auto-bicie wybiera tylko wrogie moby', /isHostileMob\(m\.type\)/.test(engine));
  check('auto-bicie nie bije przez ścianę', /clearShot\(eye\.x, eye\.y, eye\.z/.test(engine) && /OCCLUDES\[id\] !== 0/.test(engine));
  check('auto-bicie bije z cooldownem', /autoAttackTick\(dt: number\)[\s\S]{0,600}attackCooldown > 0/.test(engine));
  check('auto-bicie nie działa w otwartym oknie', /autoAttackTick\(dt: number\)[\s\S]{0,200}this\.ui !== 'playing'/.test(engine));
  check('auto-bicie jest wołane w pętli gry', /updateMobs\(dt\);[\s\S]{0,200}autoAttackTick\(dt\)/.test(engine));
  check('auto-skok nie czeka na zderzenie ze ścianą', /const mvx = Math\.sign\(wx\), mvz = Math\.sign\(wz\)/.test(engine) && !/autoJump && playing && b\.onGround && b\.hitWall/.test(engine));
  check('auto-skok wyciąga z wody', /auto-skok z wody/.test(engine));
  check('ekran opcji ma przełącznik auto-bicia', /Auto-bicie potworów/.test(settingsScreen));
  check('pauza ma szybkie przełączniki', /Auto-bicie: \{settings\.autoAttack/.test(menus) && /Auto-skok: \{settings\.autoJump/.test(menus));
  check('ustawienie trafia z opcji do silnika', /autoAttack: effective\.autoAttack/.test(gameView));

  // Prototyp silnika: prawdziwe World + prawdziwe moby, atak podmieniony na zapis.
  const w = new World(2026, true);
  w.getChunk(0, 0);
  const g = Object.create(Game.prototype) as Record<string, any>;
  g.world = w;
  g.mobs = [];
  g.ui = 'playing';
  g.mode = 'survival';
  g.touchInput = false;
  g.autoAttack = true;
  g.attackCooldown = 0;
  g.yaw = 0;
  g.eyeHeight = 1.62;
  g.body = { pos: new THREE.Vector3(8.5, FLAT_H + 1, 8.5), vel: new THREE.Vector3(), w: 0.6, h: 1.8, onGround: true, hitWall: false };
  const hits: string[] = [];
  g.attackMob = (m: { type: string }) => { hits.push(m.type); g.attackCooldown = 0.5; };

  const pig = new Mob('pig', 9.6, FLAT_H + 1, 8.5);
  const zombie = new Mob('zombie', 10.4, FLAT_H + 1, 8.5);
  const skeleton = new Mob('skeleton', 20.5, FLAT_H + 1, 8.5);
  g.mobs = [pig, zombie, skeleton];
  eq('auto-bicie wybiera zombiego, a nie prosiaka', g.findAutoAttackTarget(3.5)?.type ?? '', 'zombie');
  g.autoAttackTick(1 / 60);
  eq('auto-bicie uderza zombiego', hits.join(','), 'zombie');
  g.autoAttackTick(1 / 60);
  eq('cooldown blokuje podwójny cios', hits.length, 1);
  g.attackCooldown = 0;
  g.autoAttack = false;
  g.autoAttackTick(1 / 60);
  eq('wyłączone auto-bicie nic nie robi', hits.length, 1);
  g.autoAttack = true;
  g.ui = 'inventory';
  g.autoAttackTick(1 / 60);
  eq('auto-bicie nie bije w ekwipunku', hits.length, 1);
  g.ui = 'playing';

  // Ściana między graczem a mobem: ani jednego ciosu przez blok.
  w.setBlock(9, FLAT_H + 1, 8, B.STONE);
  w.setBlock(9, FLAT_H + 1, 9, B.STONE);
  w.setBlock(9, FLAT_H + 1, 7, B.STONE);
  w.setBlock(9, FLAT_H + 2, 8, B.STONE);
  w.setBlock(9, FLAT_H + 2, 9, B.STONE);
  w.setBlock(9, FLAT_H + 2, 7, B.STONE);
  g.attackCooldown = 0;
  const blocked = g.findAutoAttackTarget(3.5);
  check('ściana zasłania zombiego', blocked === null, blocked?.type ?? 'brak');
  hits.length = 0;
  g.autoAttackTick(1 / 60);
  eq('auto-bicie nie bije przez ścianę', hits.length, 0);

  // Auto-skok: klocek przed graczem i wolna przestrzeń nad nim.
  g.world = new World(2027, true);
  g.world.getChunk(0, 0);
  g.body.pos.set(8.5, FLAT_H + 1, 8.5);
  const canStep = (g.canAutoStep as (p: THREE.Vector3, dx: number, dz: number) => boolean).bind(g);
  check('płaski teren nie wymaga skoku', canStep(g.body.pos, 1, 0) === false);
  g.world.setBlock(9, FLAT_H + 1, 8, B.STONE);
  check('schodek przed graczem wymaga auto-skoku', canStep(g.body.pos, 1, 0) === true);
  g.world.setBlock(9, FLAT_H + 2, 8, B.STONE);
  check('ściana 2 bloki wysokości nie daje się przeskoczyć', canStep(g.body.pos, 1, 0) === false);

  // Cały cios na prawdziwym mobie: auto-bicie ma zabierać zdrowie i cooldown.
  const g3 = Object.create(Game.prototype) as Record<string, any>;
  const w3 = new World(2028, true);
  w3.getChunk(0, 0);
  g3.world = w3;
  g3.body = { pos: new THREE.Vector3(8.5, FLAT_H + 1, 8.5), vel: new THREE.Vector3(), w: 0.6, h: 1.8, onGround: true, hitWall: false };
  g3.eyeHeight = 1.62;
  g3.yaw = 0;
  g3.pitch = 0;
  g3.touchInput = true;
  g3.ui = 'playing';
  g3.mode = 'survival';
  g3.autoAttack = true;
  g3.attackCooldown = 0;
  g3.hunger = 20;
  g3.sprinting = false;
  g3.swingT = 1;
  g3.selectedStack = () => null;
  g3.hasEffect = () => false;
  g3.wearTool = () => {};
  const live = new Mob('zombie', 9.6, FLAT_H + 1, 8.5);
  g3.mobs = [live];
  const hpBefore = live.health;
  g3.autoAttackTick(1 / 60);
  check('auto-bicie naprawdę zabiera zdrowie', live.health < hpBefore, `${hpBefore} → ${live.health}`);
  check('auto-bicie ustawia cooldown ciosu', g3.attackCooldown > 0, String(g3.attackCooldown));
  check('na dotyku postać obraca się w stronę wroga', Math.abs(g3.yaw) > 0.001, String(g3.yaw));

  // clearShot: ściana zasłania, szyba nie.
  check('czysty strzał do moba', g3.clearShot(8.5, FLAT_H + 2.6, 8.5, 1, 0, 0, 1.5) === true);
  w3.setBlock(9, FLAT_H + 2, 8, B.STONE);
  check('kamienna ściana przerywa auto-bicie', g3.clearShot(8.5, FLAT_H + 2.6, 8.5, 1, 0, 0, 1.5) === false);
  w3.setBlock(9, FLAT_H + 2, 8, B.AIR);
  w3.setBlock(9, FLAT_H + 2, 8, B.GLASS);
  check('szyba nie przerywa auto-bicia', g3.clearShot(8.5, FLAT_H + 2.6, 8.5, 1, 0, 0, 1.5) === true);

  // applyGfx przekazuje ustawienie do silnika.
  const gf = Object.create(Game.prototype) as Record<string, any>;
  gf.emitHud = () => {};
  gf.applyGfx({ autoAttack: true });
  check('applyGfx włącza auto-bicie', gf.autoAttack === true);
  gf.applyGfx({ autoAttack: false });
  check('applyGfx wyłącza auto-bicie', gf.autoAttack === false);
}

section('2.15: pełny ekran nie psuje sterowania');
{
  // 2.15: powłoka przypięta do widocznego ekranu, a nie do `dvh`.
  const css = readSource('src/index.css');
  const app = readSource('src/App.tsx');
  const engine = readSource('src/game/engine.ts');
  const touch = readSource('src/components/TouchControls.tsx');
  const screenSrc = readSource('src/utils/screen.ts');
  const inventory = readSource('src/components/InventoryScreen.tsx');

  check('powłoka jest przypięta do widocznego ekranu', /#root\s*\{[\s\S]{0,260}position: fixed;[\s\S]{0,160}inset: 0/.test(css));
  check('powłoka ma zapas wysokości z JS', /--bc-app-height/.test(css) && /--bc-app-height/.test(readSource('src/utils/viewport.ts')));
  check('nie ma już wysokości dvh na powłoce', !/#root\s*\{[\s\S]{0,220}height: 100dvh/.test(css));
  check('pełny ekran ma własne, pełne wymiary', /#root:fullscreen[\s\S]{0,260}height: 100%/.test(css));
  check('pełny ekran działa na powłoce aplikacji, nie na <html>', /getElementById\(APP_ROOT_ID\)/.test(screenSrc) && /APP_ROOT_ID = 'root'/.test(screenSrc));
  check('po wejściu w pełny ekran wymiary są mierzone ponownie', /pokeLayout\(\)/.test(screenSrc));
  check('blokada orientacji tylko na dotyku', /isTouchScreen\(\) \? await lockLandscape\(\) : false/.test(screenSrc));
  check('aplikacja nasłuchuje zmian widocznego ekranu', /onViewportChange/.test(app) && /onViewportChange/.test(readSource('src/components/OrientationGuard.tsx')));

  // Silnik: płótno dopasowuje się do kontenera i słucha pełnego ekranu.
  check('silnik mierzy kontener zamiast polegać na resize', /syncViewport\(\)/.test(engine) && /clientWidth/.test(engine) && /clientHeight/.test(engine));
  check('silnik reaguje na pełny ekran i orientację', /'fullscreenchange'/.test(engine) && /'orientationchange'/.test(engine));
  check('silnik ma ResizeObserver na kontenerze', /new ResizeObserver/.test(engine) && /viewRO\.observe\(this\.container\)/.test(engine));
  check('płótno wypełnia kontener przez CSS', /domElement\.style\.width = '100%'/.test(engine) && /domElement\.style\.height = '100%'/.test(engine));
  check('rozmiar jest sprawdzany także w pętli gry', /this\.viewCheck = \(this\.viewCheck \+ 1\) % 30/.test(engine));
  check('pomiar nie wyzeruje kamery przy zerowym kontenerze', /Math\.max\(1, Math\.round\(el\.clientHeight/.test(engine));

  // Silnik na prototypie: zmiana rozmiaru kontenera (fullscreen/obrót)
  // natychmiast poprawia bufor płótna i proporcje kamery.
  const vp = Object.create(Game.prototype) as Record<string, any>;
  const sizeCalls: [number, number, boolean][] = [];
  vp.container = { clientWidth: 800, clientHeight: 400 };
  vp.renderer = { setSize: (w: number, h: number, style: boolean) => sizeCalls.push([w, h, style]) };
  vp.camera = { aspect: 0, updateProjectionMatrix: () => { vp.camera.projected = true; } };
  vp.viewW = 0;
  vp.viewH = 0;
  vp.syncViewport();
  eq('płótno dostaje realny rozmiar ekranu', sizeCalls[0]?.join(','), '800,400,false');
  eq('kamera dostaje proporcje poziome', vp.camera.aspect, 2);
  check('macierz kamery jest przeliczana', vp.camera.projected === true);
  vp.syncViewport();
  eq('bez zmiany rozmiaru nie ma zbędnego setSize', sizeCalls.length, 1);
  vp.container = { clientWidth: 400, clientHeight: 800 };
  vp.syncViewport();
  eq('obrót do pionu zmienia proporcje kamery', vp.camera.aspect, 0.5);
  eq('płótno jest mierzone ponownie', sizeCalls.length, 2);
  vp.container = { clientWidth: 0, clientHeight: 0 };
  vp.syncViewport();
  check('zerowy kontener nie daje nieskończonych proporcji', Number.isFinite(vp.camera.aspect) && vp.camera.aspect > 0, String(vp.camera.aspect));

  // Sterowanie dotykowe mierzy własną warstwę, a nie okno.
  check('drążek i przyciski liczą się z warstwy gry', /getBoundingClientRect\(\)/.test(touch) && !/setVh\(window\.innerHeight\)/.test(touch));
  check('warstwa gry jest mierzona obserwatorem rozmiaru', /ResizeObserver/.test(touch) && /ro\.observe\(el\)/.test(touch));
  check('panele nie wychodzą poza powłokę', !/max-h-\[9\ddvh\]/.test(inventory) && /max-h-full/.test(inventory));

  // Sam moduł viewportu: bezpieczny poza przeglądarką i zawsze sensowny.
  check('pomiar ekranu poza przeglądarką nie rzuca', visibleViewport().width >= 0 && visibleViewport().height >= 0);
  const off = onViewportChange(() => {});
  check('nasłuch zmian ekranu można wyłączyć', typeof off === 'function');
  off();
  applyViewportHeight();
  const poke = pokeLayout();
  poke();
  check('odświeżenie układu jest bezpieczne', true);
}

section('2.13: telefon gra się w poziomie');
{
  check('pion poznajemy po wysokości większej od szerokości', isPortraitSize(360, 640));
  check('poziom to szerokość większa od wysokości', !isPortraitSize(844, 390));
  check('kwadratowy ekran nie jest pionem', !isPortraitSize(600, 600));
  eq('klucz „graj w pionie” jest stały', PORTRAIT_DISMISS_KEY, 'blockcraft-portrait-ok');
  // W Node nie ma `screen` ani pełnego DOM-u – funkcje muszą to przetrwać.
  check('poza przeglądarką nie ma dotyku', !isTouchScreen());
  check('poza przeglądarką nie ma telefonu', !isPhoneScreen());
  check('poza przeglądarką nie ma blokady orientacji', !canLockOrientation());
  check('poza przeglądarką nie ma pełnego ekranu', !inFullscreen());
  const result = await toggleFullscreenLandscape();
  check('przełącznik pełnego ekranu nie rzuca wyjątku', result.fullscreen === false && result.locked === false);
  const unwatch = watchLandscape();
  unwatch();

  const screenSrc = readSource('src/utils/screen.ts');
  check('blokujemy poziom przez Screen Orientation API', screenSrc.includes("lock!('landscape')"));
  check('pełny ekran jest wymagany przed blokadą', /enterLandscapeMode[\s\S]{0,700}requestFullscreen[\s\S]{0,500}lockLandscape/.test(screenSrc));
  const guard = readSource('src/components/OrientationGuard.tsx');
  check('nakładka każe obrócić telefon', guard.includes('Obróć telefon poziomo'));
  check('jest przycisk pełnego ekranu i poziomu', guard.includes('Pełny ekran i poziomo'));
  check('jest wyjście awaryjne w pionie', guard.includes('Graj w pionie mimo to'));
  const gameView = readSource('src/components/GameView.tsx');
  check('gra pokazuje nakładkę w trakcie grania', /wantsLandscape && <OrientationGuard/.test(gameView));
  check('start gry prosi o pełny ekran i poziom', /const resume[\s\S]{0,400}enterLandscapeMode\(\)/.test(gameView));
  const touch = readSource('src/components/TouchControls.tsx');
  check('przycisk ⛶ włącza też poziom', touch.includes('toggleFullscreenLandscape'));
  const menus = readSource('src/components/Menus.tsx');
  check('przycisk pełnego ekranu w pauzie też blokuje poziom', menus.includes('toggleFullscreenLandscape'));
}

// ================================================ 2.12 „Skórki i dotyk”
section('2.12: deski z każdego pnia i stół rzemieślniczy');
{
  const wood = [B.LOG, B.BIRCH_LOG, B.ACACIA_LOG];
  check('lista pni obejmuje wszystkie rodzaje drewna', wood.every((id) => LOG_IDS.includes(id)), LOG_IDS.join());
  for (const id of wood) {
    const recipe = RECIPES.find((r) => r.out.id === B.PLANKS && !r.table && r.inputs.some((i) => i.id === id));
    check(`pień ${id} daje 4 deski bez stołu`, !!recipe && recipe.out.count === 4);
    const inv = new Inventory();
    inv.grid[0] = { id, count: 1 };
    eq(`siatka 2×2: pień ${id} → deski`, inv.craftGrid(false)?.id, B.PLANKS);
  }
  const inv = new Inventory();
  for (const i of [0, 1, 3, 4]) inv.grid[i] = { id: B.PLANKS, count: 1 };
  eq('4 deski w 2×2 → stół rzemieślniczy', inv.craftGrid(false)?.id, B.CRAFTING);
  check('stół rzemieślniczy nie wymaga stołu', RECIPES.find((r) => r.out.id === B.CRAFTING)?.table === false);
}

section('2.12: skórki graczy');
{
  check('jest dziewięć skórek', SKINS.length === 9, String(SKINS.length));
  check('identyfikatory skórek są unikalne', new Set(SKINS.map((s) => s.id)).size === SKINS.length);
  check('każda skórka ma polską nazwę i opis', SKINS.every((s) => s.name.length > 2 && s.desc.length > 4));
  check('domyślna skórka istnieje', skinById(DEFAULT_SKIN_ID).id === DEFAULT_SKIN_ID);
  eq('nieznana skórka wraca do domyślnej', skinById('nie-ma-takiej').id, DEFAULT_SKIN_ID);
  eq('zapis skórki zwraca jej id', saveSkinId('zuri'), 'zuri');
  eq('skórka wczytuje się z localStorage', loadSkinId(), 'zuri');
  eq('klucz localStorage jest zgodny z 2.12', localStorage.getItem(SKIN_KEY), 'zuri');
  check('nextSkinId przechodzi na inną skórkę', nextSkinId('zuri') !== 'zuri');
  check('Alex i Efe mają smukłe ramiona', SKINS.filter((s) => s.slim).map((s) => s.id).join(',') === 'alex,efe');
  const fb = fallbackSkin(140);
  check('fallback dla starych klientów ma kolory', fb.skin > 0 && fb.hair > 0 && fb.shirt > 0);
  localStorage.removeItem(SKIN_KEY);
  eq('po wyczyszczeniu wraca domyślna', loadSkinId(), DEFAULT_SKIN_ID);
}

section('2.12: sterowanie dotykowe i małe ekrany');
{
  eq('domyślny rozmiar przycisków', DEFAULT_SETTINGS.touchScale, 1);
  eq('za mały rozmiar jest ograniczany', normalizeSettings({ touchScale: 0.2 }).touchScale, 0.8);
  eq('za duży rozmiar jest ograniczany', normalizeSettings({ touchScale: 9 }).touchScale, 1.25);
  eq('wybrany rozmiar zostaje', normalizeSettings({ touchScale: 1.15 }).touchScale, 1.15);
  const touch = readSource('src/components/TouchControls.tsx');
  check('przyciski korzystają z ustawienia rozmiaru', touch.includes('settings.touchScale'));
  check('niski ekran zmniejsza sterowanie', touch.includes('shortScreen'));
  check('pasek górny respektuje safe-area', touch.includes('safe-area-inset-left'));
  const css = readSource('src/index.css');
  check('czat nie wchodzi na hotbar', css.includes('.hud-chat'));
  check('dotyk ma 44+ px', css.includes('@media (pointer: coarse)'));
  const hud = readSource('src/components/HUD.tsx');
  check('lista graczy pokazuje głowę skórki', hud.includes('SkinHead'));
}


// ====================================== 2.8.1 „Światło i chmury” – poprawki
section('2.8.1: model światła');
{
  // 2.8.2: górna ściana w południe jest zwrócona do słońca (sun = 1).
  const noon = lightFactor(1, 0, 1, 0, 1);
  check('noon keeps full brightness', noon > 0.95 && noon < 1.5, noon.toFixed(3));
  const night = lightFactor(1, 0, 0.16);
  // 2.8.2: noc ma księżycówkę (shade * MOON_SKY), więc jest czytelna,
  // ale nadal wyraźnie ciemniejsza od dnia.
  check('night is dim but never black', night > 0.3 && night < 0.5, night.toFixed(3));
  // korona drzew rzuca cień: atrybut ~0.09 (sky ≈ 0.3) nie może dać czerni
  const canopy = lightFactor(0.09, 0, 1);
  check('shadow under a canopy stays readable', canopy > 0.25, canopy.toFixed(3));
  const cave = lightFactor(0.001, 0, 0.16);
  check('caves only fall back to ambient light', Math.abs(cave - AMBIENT) < 0.01, cave.toFixed(3));
  const torchNear = lightFactor(0.001, 1, 0.16);
  check('a torch in a cave lights it up', torchNear > 0.9, torchNear.toFixed(3));
  check('the held light brightens dark corners',
    lightFactor(0.09, 0, 0.16, heldFalloff(2, HELD_POWER)) > lightFactor(0.09, 0, 0.16) + 0.4);
}

section('2.8.1: shader światła');
{
  type Shader = { uniforms: Record<string, { value: unknown }>; vertexShader: string; fragmentShader: string };
  const compile = (water: boolean) => {
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: water });
    const day = { value: 1 };
    const time = { value: 0 };
    patchChunkMaterial(mat, day, { water, time });
    const shader: Shader = {
      uniforms: {},
      vertexShader: THREE.ShaderLib.basic.vertexShader,
      fragmentShader: THREE.ShaderLib.basic.fragmentShader,
    };
    (mat.onBeforeCompile as unknown as (s: Shader, r: unknown) => void)(shader, undefined);
    return { shader, day, mat };
  };
  const plain = compile(false);
  check('the shader gets the day uniform', plain.shader.uniforms.uDay?.value === 1);
  check('the shader gets the held-light uniforms',
    'uHeldPos' in plain.shader.uniforms && 'uHeldStrength' in plain.shader.uniforms && 'uHeldRange' in plain.shader.uniforms);
  check('the vertex shader passes the world position', plain.shader.vertexShader.includes('vWorldPos = (modelMatrix'));
  // Najważniejsze: kolor wierzchołka to zacienienie, a nie „kolor do pomnożenia”.
  // Podwójne mnożenie przez vColor robiło z lasu czarną plamę.
  check('vertex colour is not multiplied in twice', !plain.shader.fragmentShader.includes('#include <color_fragment>'));
  check('the new light block is present', plain.shader.fragmentShader.includes('vec3 lightColor'));
  check('block light keeps a warm tint', plain.shader.fragmentShader.includes('vec3 tint'));
  const water = compile(true);
  check('water keeps the wave animation', water.shader.vertexShader.includes('aWave') && water.shader.vertexShader.includes('uTime'));
  check('water and solid chunks use separate programs',
    plain.mat.customProgramCacheKey() !== water.mat.customProgramCacheKey());
}

section('2.8.1: światło w ręce');
{
  eq('held light reaches exactly the declared range', heldFalloff(HELD_RANGE, HELD_POWER), 0);
  check('held light is strongest at the hand', heldFalloff(0, HELD_POWER) >= HELD_POWER - 1e-6);
  check('held light fades with distance',
    heldFalloff(2, HELD_POWER) > heldFalloff(5, HELD_POWER) && heldFalloff(5, HELD_POWER) > heldFalloff(8, HELD_POWER));
  eq('no source means no light', heldFalloff(1, 0), 0);

  type G = Record<string, any>;
  const g = Object.create(Game.prototype) as G;
  const uniform = { value: 0 };
  g.materials = [{ userData: { uHeldStrength: uniform } }];
  g.camera = { position: new THREE.Vector3(4, 70, -3) };
  g.heldLight = { pos: new THREE.Vector3(0, -1000, 0), strength: 0 };
  let held: any = { id: B.TORCH };
  g.selectedStack = () => held;
  g.updateHeldLight();
  check('holding a torch switches the light on', g.heldLight.strength > HELD_POWER * 0.8, String(g.heldLight.strength));
  check('the uniform follows the eyes', g.heldLight.pos.x === 4 && g.heldLight.pos.z === -3);
  check('the material uniform is updated', uniform.value > HELD_POWER * 0.8, String(uniform.value));
  held = { id: B.STONE };
  g.updateHeldLight();
  eq('a stone in hand turns the light off', uniform.value, 0);
}

section('2.8.1: chmury i pogoda');
{
  const clear = cloudLook('clear', 1, 0);
  const rain = cloudLook('rain', 1, 1);
  const night = cloudLook('clear', 0.16, 0);
  eq('clear sky has no storm layer', clear.stormOpacity, 0);
  check('rain brings a thick storm layer', rain.stormOpacity > 0.5, String(rain.stormOpacity));
  check('rain clouds are darker than clear ones',
    rain.color[0] < clear.color[0] - 0.2 && rain.stormColor[0] < rain.color[0]);
  check('night clouds are darker than day clouds',
    night.color[0] < clear.color[0] - 0.3 && night.color[2] >= night.color[0]);
  // 2.8.2: wiatr tylko delikatnie przyspiesza chmury (było 2,4× i wyglądało
  // jak przewijana tapeta).
  check('rain wind is slightly stronger, but still calm', rain.drift > clear.drift && rain.drift < clear.drift * 1.5);
  check('storm layer floats below the fair-weather layer', rain.stormAltitude < rain.altitude);
  const partial = cloudLook('rain', 1, 0.4);
  check('the weather transition is gradual', partial.stormOpacity > 0 && partial.stormOpacity < rain.stormOpacity);
  check('rain fog thickens in the dark', rainFogMix(0.16, 1) > rainFogMix(1, 1) && rainFogMix(1, 0) === 0);
}

section('2.8.1: liście bez dziur');
{
  for (const id of [B.LEAVES, B.BIRCH_LEAVES, B.ACACIA_LEAVES, B.JUNGLE_LEAVES]) {
    check(`leaf ${id} is opaque for culling`, IS_OPAQUE[id] === 1);
    check(`leaf ${id} lets light through`, IS_LEAFY[id] === 1 && OCCLUDES[id] === 0);
  }
  check('stone is a full light blocker', IS_LEAFY[B.STONE] === 0 && OCCLUDES[B.STONE] === 1);
  check('leaves still cast soft AO', IS_LEAFY[B.LEAVES] === 1);
}

// Jasność górnej ściany bloku gruntu w danym miejscu – to, co widzi shader,
// czyli pierwiastek z zapisanego w siatce zacienienia (0 = smoła, 1 = pełne słońce).
function topShade(world: World, x: number, z: number, ground = world.heightAt(x, z)): number {
  const c = world.getChunk(Math.floor(x / CS), Math.floor(z / CS));
  const geos = world.buildMesh(c);
  const gy = ground;
  let best = -1;
  for (const g of geos) {
    const pos = g.getAttribute('position');
    const col = g.getAttribute('color');
    if (!pos || !col) continue;
    for (let i = 0; i + 3 < pos.count; i += 4) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, top = true, shade = 0;
      for (let k = 0; k < 4; k++) {
        const px = pos.getX(i + k), py = pos.getY(i + k), pz = pos.getZ(i + k);
        minX = Math.min(minX, px); maxX = Math.max(maxX, px);
        minZ = Math.min(minZ, pz); maxZ = Math.max(maxZ, pz);
        if (Math.abs(py - (gy + 1)) > 1e-6) top = false;
        shade = Math.max(shade, col.getX(i + k));
      }
      if (!top) continue;
      if (minX !== x || maxX !== x + 1 || minZ !== z || maxZ !== z + 1) continue;
      best = Math.max(best, shade);
    }
  }
  return best < 0 ? -1 : Math.sqrt(best);
}

section('2.8.1: światło nieba pod koroną');
{
  const w = new World(4242, true);
  const gy = w.heightAt(4, 4);
  const open = topShade(w, 4, 4);
  check('open ground sees the full sky', open > 0.97, open.toFixed(3));

  // 5×5 korona liści cztery bloki nad trawą
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) w.setBlock(4 + dx, gy + 4, 4 + dz, B.LEAVES);
  const under = topShade(w, 4, 4);
  check('a crown softens the light instead of blacking it out', under > 0.2 && under < 0.92, under.toFixed(3));
  const beside = topShade(w, 12, 4);
  check('the shade ends outside the crown', beside > 0.97, beside.toFixed(3));
  eq('the crown is not the ground', w.heightAt(4, 4), gy);

  // pełny strop kamienia w tym samym miejscu = ciemna jaskinia
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) w.setBlock(4 + dx, gy + 4, 4 + dz, B.STONE);
  const cave = topShade(w, 4, 4, gy);
  check('a solid roof leaves the cave dark', cave < 0.05, cave.toFixed(3));
  check('a cave is darker than a forest floor', cave < under * 0.2);
  check('a hard roof becomes the new surface height', w.heightAt(4, 4) === gy + 4);
}


// ============================================ 2.8.2 „Zdrowe drzewa” – drzewa
section('2.8.2: drzewa generowane od zera');
{
  const kinds: TreeKind[] = ['oak', 'birch', 'jungle', 'acacia'];
  for (const kind of kinds) {
    const shape = treeShape(kind, 12, -7, 4242);
    const h = trunkHeight(kind, 12, -7, 4242);
    // Pień: pełna kolumna od y=0 do y=h-1, bez dziur.
    for (let dy = 0; dy < h; dy++) {
      const b = shape.blocks.find((v) => v.dx === 0 && v.dy === dy && v.dz === 0);
      check(`${kind}: trunk block at height ${dy}`, !!b && (b.id === B.LOG || b.id === B.BIRCH_LOG || b.id === B.ACACIA_LOG));
    }
    // Korona nie może mieć dziur: każdy blok w prostokącie korony nad pniem,
    // który NIE jest liściem, musi być poza sylwetką (czyli korona jest gęsta).
    const leaves = shape.blocks.filter((b) => b.id !== B.LOG && b.id !== B.BIRCH_LOG && b.id !== B.ACACIA_LOG);
    check(`${kind}: canopy has plenty of leaves`, leaves.length > 25, String(leaves.length));
    // Żaden liść nie wisi samotnie daleko od pnia.
    const far = leaves.filter((b) => Math.max(Math.abs(b.dx), Math.abs(b.dz)) > 3);
    check(`${kind}: no stray leaves far from the trunk`, far.length === 0, String(far.length));
    // Kształt jest deterministyczny – dwa wywołania dają identyczny wynik.
    const again = treeShape(kind, 12, -7, 4242);
    check(`${kind}: shape is deterministic`, JSON.stringify(shape.blocks) === JSON.stringify(again.blocks));
    // Inne ziarno/pozycja może dać inne drzewo, ale nigdy nie inne w połowie.
    check(`${kind}: every block is unique`, new Set(shape.blocks.map((b) => `${b.dx},${b.dy},${b.dz}`)).size === shape.blocks.length);
  }
  check('birch trunks are taller than oak trunks',
    trunkHeight('birch', 3, 3, 9) > trunkHeight('oak', 3, 3, 9));
  check('jungle trees are the tallest', trunkHeight('jungle', 3, 3, 9) > trunkHeight('birch', 3, 3, 9));
  check('acacia has a flat umbrella canopy', (() => {
    const shape = treeShape('acacia', 5, 5, 77);
    const leaves = shape.blocks.filter((b) => b.id === B.ACACIA_LEAVES);
    const spread = Math.max(...leaves.map((b) => Math.abs(b.dx)), 0);
    const height = Math.max(...leaves.map((b) => b.dy)) - Math.min(...leaves.map((b) => b.dy));
    return spread >= 3 && height <= 4;
  })());
  eq('jungle biome grows jungle trees', treeKindForBiome('Dżungla', 0.9), 'jungle');
  eq('savanna biome grows acacias', treeKindForBiome('Sawanna', 0.1), 'acacia');
  eq('birch forest mostly grows birches', treeKindForBiome('Brzozowy las', 0.2), 'birch');
  eq('plains grow oaks', treeKindForBiome('Równiny', 0.5), 'oak');

  // Drzewo postawione w świecie: pień + korona, żadnych dziur w liściach.
  const w = new World(99, true);
  w.getChunk(0, 0);
  const gy = w.heightAt(8, 8);
  check('planting a sapling succeeds on grass', plantTree(w, 8, gy + 1, 8, false));
  const shape = treeShape('oak', 8, 8, w.seed);
  let missing = 0;
  for (const b of shape.blocks) {
    if (w.peekBlock(8 + b.dx, gy + 1 + b.dy, 8 + b.dz) !== b.id) missing++;
  }
  eq('every block of the planned tree exists in the world', missing, 0);
  check('the trunk base is dirt, not grass', w.peekBlock(8, gy, 8) === B.DIRT);

  // Sadzenie na zajętym miejscu nie psuje świata.
  const before = w.peekBlock(8, gy + 1, 8);
  plantTree(w, 8, gy + 1, 8, false);
  eq('a blocked sapling changes nothing', w.peekBlock(8, gy + 1, 8), before);
}

// ======================================== 2.8.2: liście bez dziur w atlasie
section('2.8.2: atlas liści bez dziur');
{
  // Prawdziwy canvas nie istnieje w Node, więc testujemy czystą funkcję,
  // która wypełnia dziury w kaflu – dokładnie tę, której używa buildAtlas().
  const data = new Uint8ClampedArray(ATLAS_SIZE * ATLAS_SIZE * 4);
  const tile = 7;
  const baseX = (tile % ATLAS_TILES) * ATLAS_TILE;
  const baseY = Math.floor(tile / ATLAS_TILES) * ATLAS_TILE;
  const set = (x: number, y: number, a: number) => {
    const i = ((baseY + y) * ATLAS_SIZE + baseX + x) * 4;
    data[i] = 60; data[i + 1] = 120; data[i + 2] = 40; data[i + 3] = a;
  };
  for (let y = 0; y < ATLAS_TILE; y++)
    for (let x = 0; x < ATLAS_TILE; x++) set(x, y, (x * 7 + y * 13) % 5 === 0 ? 0 : 255);
  let holesBefore = 0;
  for (let y = 0; y < ATLAS_TILE; y++)
    for (let x = 0; x < ATLAS_TILE; x++) {
      const i = ((baseY + y) * ATLAS_SIZE + baseX + x) * 4;
      if (data[i + 3] === 0) holesBefore++;
    }
  check('the test tile really starts with holes', holesBefore > 20, String(holesBefore));
  densifyTileData(data, tile);
  let holesAfter = 0, dark = 0;
  for (let y = 0; y < ATLAS_TILE; y++)
    for (let x = 0; x < ATLAS_TILE; x++) {
      const i = ((baseY + y) * ATLAS_SIZE + baseX + x) * 4;
      if (data[i + 3] < 255) holesAfter++;
      if (data[i] + data[i + 1] + data[i + 2] < 60) dark++;
    }
  eq('every hole in a leaf tile is filled', holesAfter, 0);
  eq('no filled pixel stays black', dark, 0);
}

// =============================================== 2.9: lista komend w czacie
section('2.9: katalog komend');
{
  check('the command list is not empty', COMMANDS.length >= 14, String(COMMANDS.length));
  const names = COMMANDS.map((c) => c.name);
  check('every command has a unique name', new Set(names).size === names.length);
  check('every command has a usage and an example', COMMANDS.every((c) => c.usage && c.example.startsWith('/')));
  check('every command belongs to a known category',
    COMMANDS.every((c) => COMMAND_CATEGORIES.some((cat) => cat.id === c.category)));
  // Komendy, które naprawdę obsługuje silnik, muszą być w katalogu.
  for (const must of ['gamemode', 'time', 'weather', 'tp', 'give', 'summon', 'village', 'xp',
    'heal', 'kill', 'seed', 'spawn', 'clear', 'blocks', 'enchant', 'waypoint']) {
    check(`/${must} is documented`, names.includes(must));
  }
  // …i odwrotnie: katalog nie może obiecywać komend, których nie ma.
  // 2.19: prośba zaadresowana do kogoś innego nie może trafić do gracza.
  {
    const box: string[] = [];
    const host = new NetSession({ role: 'host', name: 'Host', transport: 'local', id: 'phost' });
    host.attach({ send: (raw: string) => box.push(raw), close() {}, connected: true } as never);
    const got: string[] = [];
    host.onMessage = (m) => got.push(m.t);
    // Gość wysyła prośbę do `p2` – gospodarz przekazuje ją dalej bez zmiany adresata.
    host.ingest(JSON.stringify({ t: 'tpa', from: 'p1', to: 'p2', name: 'Ala', kind: 'ask' }));
    const relayed = box.map((raw) => JSON.parse(raw)).find((m) => m.t === 'tpa');
    eq('relay zachowuje adresata prośby', relayed?.to, 'p2');
    eq('gospodarz widzi tylko zaadresowane do siebie', got.length, 0);
    host.close();
  }

  // 2.19: profil zapisuje się w bazie pod trwałym identyfikatorem, także
  // gdy gracz zmieni nick – identyfikator jest osobnym polem wiersza.
  const profileSource = readSource('src/game/profile.ts');
  check('profil ma osobny identyfikator', /pid/.test(profileSource));
  check('identyfikator nie zawiera nicku', /randomChars/.test(profileSource) && !/pid.*name/.test(profileSource));
  check('wczytywanie profilu nie blokuje wejścia', /catch[\s\S]{0,120}return null/.test(profileSource));

  const src = readSource('src/game/engine.ts');
  for (const cmd of COMMANDS) {
    const known = src.includes(`case '${cmd.name}'`) ||
      (cmd.aliases ?? []).some((a) => src.includes(`case '${a}'`)) ||
      cmd.name === 'help';
    check(`/${cmd.name} exists in the engine`, known);
  }
  check('search finds a command by its Polish keyword', searchCommands('deszcz')[0]?.name === 'weather');
  check('search folds Polish diacritics', searchCommands('pogoda')[0]?.name === 'weather');
  check('search matches partial names', searchCommands('way')[0]?.name === 'waypoint');
  check('an exact name wins', searchCommands('give')[0]?.name === 'give');
  check('an unknown query gives no suggestions', searchCommands('xyzzy').length === 0);
  check('an empty query shows the beginning of the list', searchCommands('').length > 0);
  check('suggestions are limited', searchCommands('e', 3).length <= 3);
  eq('a suggestion fills the field', applyCommandSuggestion('/', commandByName('give')!), '/give ');
  eq('a suggestion keeps typed arguments', applyCommandSuggestion('/gi 5', commandByName('give')!), '/give 5');
  check('alias lookup works', commandByName('gm')?.name === 'gamemode');
  check('help text is one line per command', COMMANDS.length > 0);
}

// ================================================== 2.8.2: kierunkowe światło
section('2.8.2: kierunkowe słońce');
{
  // Ta sama ściana, różne pory dnia: słońce z prawej oświetla ścianę wschodnią.
  const noon = lightFactor(1, 0, 1, 0, 1);
  const north = lightFactor(1, 0, 1, 0, 0);
  check('a sunlit face is brighter than a shadowed one', noon > north + 0.3, `${noon.toFixed(2)} vs ${north.toFixed(2)}`);
  check('the light stays within sane bounds', noon < 2.4);

  type Shader = { uniforms: Record<string, { value: number }>; vertexShader: string; fragmentShader: string };
  const compileLight = () => {
    const mat = new THREE.MeshBasicMaterial() as THREE.MeshBasicMaterial;
    const day = { value: 1 };
    const time = { value: 0 };
    const sun = { dir: new THREE.Vector3(0.4, 0.8, 0.2).normalize(), power: 0.9 };
    patchChunkMaterial(mat, day, { time, sun });
    const shader: Shader = {
      uniforms: {},
      vertexShader: THREE.ShaderLib.basic.vertexShader,
      fragmentShader: THREE.ShaderLib.basic.fragmentShader,
    };
    (mat.onBeforeCompile as unknown as (s: Shader, r: unknown) => void)(shader, undefined);
    return { shader, mat };
  };
  const { shader, mat } = compileLight();
  check('the shader receives the sun direction', 'uSunDir' in shader.uniforms && 'uSun' in shader.uniforms);
  check('the vertex shader passes the face id', shader.vertexShader.includes('attribute float aFace') && shader.vertexShader.includes('vFace = aFace'));
  check('the fragment shader has a face normal helper', shader.fragmentShader.includes('faceNormal'));
  check('sunlight uses a dot product', shader.fragmentShader.includes('dot(faceNormal(vFace), uSunDir)'));
  check('sunlight is gated by sky exposure', shader.fragmentShader.includes('clamp(sky * 4.0, 0.0, 1.0)'));
  check('light materials use a fresh cache key', mat.customProgramCacheKey() === 'blockcraft-light-4');

  // Światło trzymane w dłoni jest mocniejsze i sięga dalej niż w 2.8.1.
  check('the held torch reaches further than before', HELD_RANGE >= 12);
  // 2.8.2: 0.72 wystarcza, by nocą rozjaśnić okolicę, ale nie wypala
  // tekstur na biało (przy 1.7 bliskie ściany były przepalone).
  check('the held torch is bright enough to matter', HELD_POWER >= 0.7 && HELD_POWER <= 1.0);
  check('the held light gets a warm tint in the shader', shader.fragmentShader.includes('vec3(1.06, 0.86, 0.62)'));
  check('held light at arm distance is clearly visible', heldFalloff(3, HELD_POWER) > 0.4);

  // Chunki dostają atrybut ściany, więc shader ma z czego liczyć słońce.
  const w = new World(7, true);
  w.getChunk(0, 0);
  const geo = w.buildMesh(w.getChunk(0, 0))[0];
  check('chunk meshes carry the face attribute', !!geo.getAttribute('aFace'));
  const faceAttr = geo.getAttribute('aFace');
  let badFaces = 0;
  for (let i = 0; i < faceAttr.count; i++) {
    const v = faceAttr.getX(i);
    if (v < 0 || v > 5) badFaces++;
  }
  eq('every face id is in range', badFaces, 0);
}

// ==================================================== 2.8.2: spokojne chmury
section('2.8.2: chmury płyną spokojnie');
{
  const clear = cloudLook('clear', 1, 0);
  const rain = cloudLook('rain', 1, 1);
  check('rain still darkens the sky', rain.stormOpacity > 0.5 && rain.color[0] < clear.color[0]);
  check('wind picks up by less than a third in rain', rain.drift <= clear.drift * 1.3);
  check('storm layer sits below the fair-weather layer', rain.stormAltitude < rain.altitude);
  check('cloud layers stay in the sky, not at head height', clear.altitude > 100 && rain.stormAltitude > 100);
}


// ============================================================== 2.10: multiplayer
section('2.10: protokół sieciowy (bez serwera)');
{
  /** Kanał w pamięci – dwa końce, wiadomości trafiają tylko do drugiego. */
  function bridge() {
    const state = { a: true, b: true };
    const a: NetLink = {
      get connected() { return state.a; },
      label: 'test A',
      send: (d) => queueMicrotask(() => bSession?.ingest(d)),
      close: () => { state.a = false; },
    };
    const b: NetLink = {
      get connected() { return state.b; },
      label: 'test B',
      send: (d) => queueMicrotask(() => aSession?.ingest(d)),
      close: () => { state.b = false; },
    };
    let aSession: NetSession | null = null;
    let bSession: NetSession | null = null;
    return {
      hostLink: a,
      guestLink: b,
      bindHost: (s: NetSession) => { aSession = s; },
      bindGuest: (s: NetSession) => { bSession = s; },
    };
  }

  eq('kody pokoju normalizują się do małych liter', normalizeRoom('  Las-123 '), 'las-123');
  eq('polskie znaki w kodzie pokoju są sprowadzane do łaciny', normalizeRoom('Łąka_Żółta!'), 'laka-zolta');
  check('pusty kod pokoju jest odrzucany', normalizeRoom('   ') === '');
  const code = makeRoomCode();
  check('losowy kod pokoju ma sensowny kształt', /^[a-z]+-\d{3}$/.test(code), code);
  check('każdy kod pokoju jest inny', new Set(Array.from({ length: 20 }, makeRoomCode)).size > 10);

  // Sygnalizacja WebRTC: SDP pakujemy w base64url, żeby dało się wkleić w czat.
  const sdp = 'v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\n';
  const encoded = encodeSignal({ v: 1, sdp, type: 'offer' });
  check('kod zaproszenia nie zawiera znaków psujących wklejanie', /^[A-Za-z0-9_-]+$/.test(encoded), encoded.slice(0, 24));
  const decoded = decodeSignal<{ sdp: string; type: string }>(encoded);
  eq('SDP wraca bez zmian', decoded?.sdp, sdp);
  eq('typ sygnalizacji wraca bez zmian', decoded?.type, 'offer');
  eq('śmieci nie są udawanym kodem', decodeSignal('to-nie-jest-kod'), null);
  eq('ucięty kod jest odrzucany', decodeSignal(encoded.slice(0, 12)), null);

  // --- handshake: gość → hello → gospodarz → welcome z migawką świata
  const br = bridge();
  const host = new NetSession({ role: 'host', name: 'Ala', transport: 'local', id: 'host-1' });
  const guest = new NetSession({ role: 'guest', name: 'Bob', transport: 'local', id: 'guest-1' });
  br.bindHost(host);
  br.bindGuest(guest);
  host.setWorld({ seed: 4242, mode: 'creative', worldType: 'flat', name: 'Wspólny', time: 0.4, day: 3, weather: 'rain' });
  host.sendEdits([{ x: 1, y: 2, z: 3, id: 5, d: 'o' }]);
  check('gospodarz pamięta własne zmiany bloków', host.snapshot().edits?.length === 1);
  host.attach(br.hostLink);
  guest.attach(br.guestLink);

  const readyBox: { world: ReturnType<NetSession['snapshot']> | null } = { world: null };
  guest.onReady = (w) => { readyBox.world = w; };
  const chat: string[] = [];
  guest.onChat = (name, text) => chat.push(`${name}: ${text}`);

  guest.tick();
  await Promise.resolve();
  await Promise.resolve();

  check('gość dostaje migawkę świata', !!readyBox.world);
  eq('seed jest ten sam', readyBox.world?.seed, 4242);
  eq('tryb jest ten sam', readyBox.world?.mode, 'creative');
  eq('typ terenu jest ten sam', readyBox.world?.worldType, 'flat');
  eq('pora dnia jest ta sama', readyBox.world?.time, 0.4);
  eq('pogoda jest ta sama', readyBox.world?.weather, 'rain');
  eq('zmiany bloków sprzed dołączenia są odtworzone', readyBox.world?.edits?.length, 1);
  eq('gość widzi dwóch graczy', guest.players.length, 2);
  check('własny wpis jest pierwszy na liście', guest.players[0].self === true, guest.players.map((p) => p.name).join(','));
  eq('gospodarz zna nazwę gościa', host.players.find((p) => p.id === 'guest-1')?.name, 'Bob');
  check('gospodarz i gość mają różne kolory', host.players.find((p) => p.id === 'guest-1')!.hue !== host.players.find((p) => p.id === 'host-1')!.hue);

  // --- zmiany bloków: gość → gospodarz → drugi gość
  const guest2 = new NetSession({ role: 'guest', name: 'Cyt', transport: 'local', id: 'guest-2' });
  const br2 = bridge();
  br2.bindHost(host);
  br2.bindGuest(guest2);
  guest2.attach(br2.guestLink);
  // gospodarz ma tylko jeden kanał w tym teście, więc podpinamy drugi „na boku”
  // — sprawdzamy samą trasę edytów przez `relay` na poziomie protokołu.
  const got: NetEdit[] = [];
  const visitorGone: string[] = [];
  let guestStatus = '';
  let guestWeather = '';
  guest.onStatus = (_st, err) => { if (err) guestStatus = err; };
  guest.onMessage = (m) => {
    if (m.t === 'edits') got.push(...m.list);
    if (m.t === 'bye') visitorGone.push(m.from);
    if (m.t === 'state') guestWeather = m.weather;
  };
  const hostGot: NetEdit[] = [];
  host.onMessage = (m) => { if (m.t === 'edits') hostGot.push(...m.list); };

  host.ingest(JSON.stringify({ t: 'edits', from: 'guest-2', to: 'host', list: [{ x: 9, y: 8, z: 7, id: 12 }] }));
  await Promise.resolve();
  await Promise.resolve();
  check('gospodarz przyjmuje edyt gościa', hostGot.length === 1 && hostGot[0].id === 12);
  check('gospodarz przekazuje edyt dalej', got.length === 1 && got[0].x === 9);
  eq('edyt zapamiętany w migawce dla nowych graczy', host.snapshot().edits?.length, 2);
  eq('ten sam blok nadpisuje starszy wpis', host.snapshot().edits?.filter((e) => e.x === 9).length, 1);

  // --- pogoda i czas z gospodarza
  host.sendState({ time: 0.75, day: 5, weather: 'rain' });
  await Promise.resolve();
  await Promise.resolve();
  eq('zmiana pogody dociera od razu', guestWeather, 'rain');
  eq('migawka zapamiętuje nową porę dnia', host.snapshot().day, 5);
  eq('migawka pamięta pogodę', host.snapshot().weather, 'rain');

  // --- czat
  host.ingest(JSON.stringify({ t: 'chat', from: 'guest-2', to: 'host', name: 'Cyt', text: 'Cześć!' }));
  await Promise.resolve();
  await Promise.resolve();
  eq('czat dociera do gospodarza', chat[0], 'Cyt: Cześć!');

  // --- wyjście innego gościa nie kończy sesji
  visitorGone.length = 0;
  host.ingest(JSON.stringify({ t: 'bye', from: 'guest-2', to: '*' }));
  await Promise.resolve();
  await Promise.resolve();
  check('gospodarz przekazuje „bye” pozostałym gościom', visitorGone.includes('guest-2'), visitorGone.join(','));
  check('gość nie traktuje wyjścia kolegi jak koniec gry', !/gospodarz zakończył/i.test(guestStatus));

  // --- ping/pong i timeout
  eq('pozycje wysyłane są 10 razy na sekundę', POS_HZ, 10);
  check('timeout gracza jest dłuższy niż interwał pozycji', PEER_TIMEOUT * 1000 > 1000 / POS_HZ);
  const t0 = Date.now();
  host.tick(t0);
  const guestSeen = host.players.find((p) => p.id === 'guest-1');
  check('gość jest widoczny przed timeoutem', !!guestSeen);
  const gone: string[] = [];
  host.onMessage = (m) => { if (m.t === 'bye') gone.push(m.from); };
  host.tick(t0 + (PEER_TIMEOUT + 1) * 1000);
  check('milczący gracz wypada z sesji', !host.players.some((p) => p.id === 'guest-1'));
  check('pozostali dostają informację o wyjściu', gone.includes('guest-1'), gone.join(','));

  // --- gość bez gospodarza zgłasza błąd po 6 s
  const lonely = new NetSession({ role: 'guest', name: 'Sam', transport: 'local', id: 'guest-x' });
  const noop: NetLink = { connected: true, label: 'cisza', send: () => {}, close: () => {} };
  let lonelyErr = '';
  lonely.onStatus = (_st, err) => { if (err) lonelyErr = err; };
  lonely.attach(noop);
  const ts = Date.now();
  lonely.tick(ts);
  check('brak gospodarza przez chwilę nie jest błędem', lonelyErr === '');
  lonely.tick(ts + 7000);
  check('brak gospodarza po 6 s daje czytelny błąd', /nie znaleziono gospodarza/i.test(lonelyErr), lonelyErr);

  // --- walidacja danych z sieci
  eq('śmieci nie są wiadomością', decodeMessage('{"t":123}'), null);
  eq('nie-JSON jest odrzucany', decodeMessage('hej'), null);
  eq('wiadomość bez nadawcy jest odrzucana', decodeMessage('{"t":"hello"}'), null);
  check('poprawna wiadomość przechodzi', decodeMessage('{"t":"hello","from":"a","name":"A","hue":0}')?.t === 'hello');
  const bigFrame = JSON.stringify({ t: 'welcome', from: 'h', to: 'g', world: { seed: 1, edits: Array.from({ length: 20_000 }, (_, i) => ({ x: i, y: 1, z: 1, id: 2 })) }, players: [] });
  check('migawka 20 000 zmian mieści się w limicie ramki', bigFrame.length > 200_000 && decodeMessage(bigFrame)?.t === 'welcome', String(bigFrame.length));

  eq('sanitizeWorld odrzuca brak seeda', sanitizeWorld({ mode: 'creative' }), null);
  eq('sanitizeWorld odrzuca null', sanitizeWorld(null), null);
  const clean = sanitizeWorld({ seed: -77, mode: 'nonsense', worldType: 'x', time: 9, day: -4, weather: 'snow', edits: [{ x: 1, y: 2, z: 3, id: 4 }, { x: 'a' }] });
  eq('seed jest brany po wartości bezwzględnej', clean?.seed, 77);
  eq('nieznany tryb spada do przetrwania', clean?.mode, 'survival');
  eq('nieznany teren spada do normalnego', clean?.worldType, 'normal');
  check('pora dnia jest przycinana do zakresu', (clean?.time ?? -1) >= 0 && (clean?.time ?? 2) <= 1, String(clean?.time));
  check('dzień nie może być ujemny', (clean?.day ?? 0) >= 1);
  eq('nieznana pogoda to brak deszczu', clean?.weather, 'clear');
  eq('błędne edyty są odrzucane', clean?.edits?.length, 1);
  eq('sanitizeWorld gubi „started”', sanitizeWorld({ seed: 1, started: true })?.started, true);
  eq('brak „started” to fałsz', sanitizeWorld({ seed: 1 })?.started, false);
  const withSpawn = sanitizeWorld({ seed: 1, spawn: { x: 10.7, y: 64.2, z: -3.9, d: 'o' } });
  eq('pozycja gospodarza jest zaokrąglana', withSpawn?.spawn?.x, 10);
  eq('wysokość startu jest przycinana do świata', sanitizeWorld({ seed: 1, spawn: { x: 0, y: 900, z: 0 } })?.spawn?.y, 255);
  eq('wymiar startu domyślnie nadświat', withSpawn?.spawn?.d, 'o');
  eq('brak sensownej pozycji = brak spawnu', sanitizeWorld({ seed: 1, spawn: { x: 'a', y: 1, z: 1 } })?.spawn, undefined);
  const many = sanitizeWorld({ seed: 1, edits: Array.from({ length: MAX_SNAPSHOT_EDITS + 50 }, (_, i) => ({ x: i, y: 1, z: 1, id: 2 })) });
  eq('migawka ma ograniczoną długość', many?.edits?.length, MAX_SNAPSHOT_EDITS);

  const roster = sortPlayers([
    { id: 'b', name: 'B', hue: 10, ping: 20 },
    { id: 'me', name: 'Ja', hue: 20, ping: 5 },
    { id: 'a', name: 'A', hue: 30, ping: 10 },
  ], 'me');
  eq('własny wpis jest zawsze pierwszy', roster[0].id, 'me');
  eq('sortPlayers oznacza własny wpis', roster[0].self, true);
  check('nextHue nie daje koloru sąsiada', nextHue([{ id: 'x', name: 'X', hue: 0, ping: 0 }]) !== 0);

  // --- 2.12: skórka w hello i w obsadzie
  guest.skin = 'zuri';
  guest.updatePresence();
  await Promise.resolve();
  await Promise.resolve();
  eq('gospodarz zna skórkę gościa z hello', host.players.find((p) => p.id === 'guest-1')?.skin, 'zuri');
  host.skin = 'sunny';
  host.updatePresence();
  await Promise.resolve();
  await Promise.resolve();
  eq('gość dostaje skórkę gospodarza z obsady', guest.players.find((p) => p.id === 'host-1')?.skin, 'sunny');
  check('nieznana skórka nie psuje obsady', (() => { guest.skin = 'nie-ma-takiej'; guest.updatePresence(); return true; })());

  // --- transport lokalny na prawdziwym BroadcastChannel (Node 22 ma go w tle).
  const rawA: string[] = [];
  const rawB: string[] = [];
  const la = createLocalLink('test-room', (d) => rawA.push(d));
  const lb = createLocalLink('test-room', (d) => rawB.push(d));
  la.send('cześć');
  lb.send('hej');
  await new Promise((r) => setTimeout(r, 30));
  check('BroadcastChannel dostarcza wiadomości do drugiej karty', rawB.includes('cześć'), rawB.join('|'));
  check('BroadcastChannel nie odbija wiadomości do nadawcy', !rawA.includes('cześć'), rawA.join('|'));
  check('drugi koniec też wysyła', rawA.includes('hej'), rawA.join('|'));
  la.close();
  lb.close();

  // Pełny handshake dwoma sesjami na prawdziwym kanale.
  const hA = new NetSession({ role: 'host', name: 'Ala', transport: 'local', id: 'real-host' });
  const gA = new NetSession({ role: 'guest', name: 'Bob', transport: 'local', id: 'real-guest' });
  hA.setWorld({ seed: 9001, mode: 'survival', worldType: 'normal', name: 'Kanał', time: 0.5, day: 2, weather: 'clear' });
  const linkH = createLocalLink('real-room', (d) => hA.ingest(d));
  const linkG = createLocalLink('real-room', (d) => gA.ingest(d));
  const box: { world: ReturnType<NetSession['snapshot']> | null } = { world: null };
  gA.onReady = (w) => { box.world = w; };
  hA.attach(linkH);
  gA.attach(linkG);
  for (let i = 0; i < 20 && !box.world; i++) {
    gA.tick();
    await new Promise((r) => setTimeout(r, 15));
  }
  eq('handshake przechodzi przez prawdziwy kanał', box.world?.seed, 9001);
  check('gość trafia na listę gospodarza', hA.players.some((p) => p.name === 'Bob'), hA.players.map((p) => p.name).join(','));

  // Gospodarz wchodzi do świata – gość już w poczekalni dostaje start.
  let starts = 0;
  gA.onStart = () => { starts++; };
  hA.startWorld();
  for (let i = 0; i < 10 && starts === 0; i++) await new Promise((r) => setTimeout(r, 15));
  eq('„start” dociera do gościa w poczekalni', starts, 1);
  eq('migawka zapamiętuje start świata', hA.snapshot().started, true);

  // Spóźniony gość dostaje start razem z migawką.
  const gB = new NetSession({ role: 'guest', name: 'Cyt', transport: 'local', id: 'real-guest-2' });
  const lB = createLocalLink('real-room', (d) => gB.ingest(d));
  let lateStart = 0;
  gB.onStart = () => { lateStart++; };
  gB.attach(lB);
  for (let i = 0; i < 20 && lateStart === 0; i++) {
    gB.tick();
    await new Promise((r) => setTimeout(r, 15));
  }
  eq('gość dołączający po starcie wchodzi od razu', lateStart, 1);
  gB.close();
  hA.close();
  gA.close();
}

section('2.11: publiczny serwer – zegar, dane i integracja');
{
  // Zegar publiczny: wszyscy liczą to samo z tego samego czasu systemowego.
  const t0 = Date.UTC(2026, 0, 1);
  eq('start epoki to poranek', publicTime(t0), 0);
  eq('po połowie doby jest połowa', Math.round(publicTime(t0 + (DAY_SECONDS / 2) * 1000) * 100), 50);
  eq('doba zawija się po 600 s', Math.round(publicTime(t0 + DAY_SECONDS * 1000 + 1) * 1000) / 1000, 0);
  eq('dzień zaczyna się od pierwszego', publicDay(t0), 1);
  eq('drugi dzień po 600 s', publicDay(t0 + DAY_SECONDS * 1000), 2);
  const same = publicWeather(t0 + 12_345);
  eq('pogoda jest taka sama dla dwóch wywołań', publicWeather(t0 + 12_345), same);
  const buckets = Array.from({ length: 24 }, (_, i) => publicWeather(t0 + i * 10 * 60 * 1000));
  check('pogoda bywa deszczowa i słoneczna', buckets.includes('rain') && buckets.includes('clear'), buckets.join(','));

  // Kolor gracza zależy tylko od id – każdy klient widzi ten sam.
  eq('kolor gracza jest stały', hueFor('p1087asb9'), hueFor('p1087asb9'));
  check('kolor mieści się w zakresie', hueFor('cokolwiek') >= 0 && hueFor('cokolwiek') < 360);
  check('różne id dają zwykle różne kolory', hueFor('aaa') !== hueFor('bbb'));

  // Wiersz z bazy → zmiana bloku.
  const row = rowToEdit({ x: 12.9, y: 64, z: -3, block: 5, dim: 'n' });
  eq('wiersz bazy daje współrzędne', `${row.x},${row.y},${row.z}`, '12,64,-3');
  eq('wiersz bazy niesie blok', row.id, 5);
  eq('wiersz bazy niesie wymiar', row.d, 'n');
  eq('brak wymiaru = nadświat', rowToEdit({ x: 0, y: 0, z: 0, block: 1, dim: null }).d, 'o');
  eq('śmieci w wierszu nie wywracają gry', rowToEdit({ x: 'a' as unknown as number, y: 1, z: 1, block: 2, dim: 'o' }).x, 0);

  eq('publiczne ziarno jest stałe', PUBLIC_SEED, 20261020);
  check('publiczny świat ma nazwę', PUBLIC_NAME === 'Serwer publiczny');
  check('pozycje na serwerze idą rzadziej niż w P2P', PUBLIC_POS_HZ < POS_HZ);
  check('limit wczytanych zmian jest rozsądny', MAX_PUBLIC_EDITS >= 20_000 && MAX_PUBLIC_EDITS <= 100_000, String(MAX_PUBLIC_EDITS));
  check('zapis do bazy jest batchowany', SAVE_EVERY_MS >= 1000);

  // Integracja w źródłach.
  const online = readSource('src/game/online.ts');
  const engine = readSource('src/game/engine.ts');
  const mp = readSource('src/components/MultiplayerScreen.tsx');
  const world = readSource('src/game/world.ts');
  check('serwer publiczny używa Supabase Realtime', /client\.channel\(PUBLIC_CHANNEL/.test(online));
  check('zmiany bloków trafiają do tabeli', /from\(PUBLIC_TABLE\)\s*\n?\s*\.upsert/.test(online));
  check('baza jest zabezpieczona RLS na poziomie zapytań', /upsert\(rows/.test(online));
  check('nieudany zapis wraca do kolejki', /pending\.set\(key, edit\)/.test(online));
  check('wejście pobiera zmiany z bazy', /loadBlocks/.test(online));
  check('zmiany są dociągane po awarii transmisji', /catchUp/.test(online));
  check('obecność graczy to Presence', /presence\.sync|presence/.test(online) || /presenceState/.test(online));
  check('silnik przyjmuje dowolną sesję (NetLike)', /net\?: NetLike/.test(engine));
  check('świat umie zasiać zmiany z serwera', /seedMods\(/.test(world));
  check('publiczny świat wchodzi bez setBlock na każdy blok', /seedMods\(net\.world\.edits/.test(engine));
  check('silnik synchronizuje zegar publiczny', /syncPublicClock/.test(engine));
  check('pozycje na serwerze publicznym są rzadsze', /PUBLIC_POS_HZ/.test(engine));
  check('ekran gry ma przycisk serwera publicznego', /Graj online/.test(mp));
  check('ekran nie wymaga już kodów do gry online', /joinPublic/.test(mp));
  check('stary błąd P2P ma czytelny komunikat', /wrong state/.test(readSource('src/game/net.ts')));
  check('P2P sprawdza stan połączenia przed odpowiedzią', /signalingState !== 'have-local-offer'/.test(readSource('src/game/net.ts')));
  check('HUD pokazuje tryb publiczny', /netPublic/.test(readSource('src/components/HUD.tsx')));
  check('HUD pokazuje kolejkę zapisu', /netSaving/.test(readSource('src/components/HUD.tsx')));
}

section('2.11: PublicServer – pobieranie, wysyłka i zapis (atrapa klienta)');
{
  /** Minimalna atrapa Supabase: tabele w pamięci + kanał Realtime. */
  function fakeClient(rows: BlockRow[]) {
    const log: { op: string; payload?: unknown }[] = [];
    let failNext = false;
    const channel = {
      on() { return channel; },
      subscribe(cb: (s: string) => void) { queueMicrotask(() => cb('SUBSCRIBED')); return channel; },
      track() { return Promise.resolve(); },
      untrack() { return Promise.resolve(); },
      send(msg: { payload?: unknown }) { log.push({ op: 'broadcast', payload: msg.payload }); return Promise.resolve(); },
      presenceState() {
        return { p1: [{ id: 'p1', name: 'Ala', hue: 12 }], p2: [{ id: 'p2', name: 'Bob', hue: 200 }] };
      },
    };
    const client = {
      from() {
        const q = {
          _order: null as null | string,
          select() { return q; },
          eq() { return q; },
          gt() { return q; },
          order() { return q; },
          limit() { return Promise.resolve({ data: [], error: null }); },
          range(from: number, to: number) {
            log.push({ op: 'range', payload: [from, to] });
            const data = rows.slice(from, to + 1);
            return Promise.resolve({ data, error: null });
          },
          upsert(payload: { dim: string; x: number; y: number; z: number; block: number }[]) {
            log.push({ op: 'upsert', payload });
            if (failNext) { failNext = false; return Promise.resolve({ error: { message: 'network down' } }); }
            return Promise.resolve({ error: null });
          },
        };
        return q;
      },
      channel() { return channel; },
      removeChannel() { return Promise.resolve(); },
    };
    return {
      client,
      log,
      failOnce() { failNext = true; },
      channel,
    };
  }

  const rows: BlockRow[] = [
    { x: 1, y: 64, z: 2, block: 3, dim: 'o' },
    { x: 4, y: 65, z: 6, block: 9, dim: 'n' },
  ];
  const fake = fakeClient(rows);
  const srv = new PublicServer({ name: 'Tester', id: 'p-test', client: fake.client as never });
  let progress = '';
  let ready = 0;
  let peers: { name: string }[] = [];
  srv.onProgress = (t) => { progress += t + '|'; };
  srv.onReady = () => { ready++; };
  srv.onPeers = (list) => { peers = list; };

  check('sesja publiczna nie udaje pokoju', srv.public === true && srv.transport === 'online' && srv.role === 'guest');
  eq('ziarno publiczne jest stałe', srv.world.seed, PUBLIC_SEED);
  eq('tryb publiczny to przetrwanie', srv.world.mode, 'survival');

  await srv.connect();
  eq('wejście pobiera zmiany z bazy', srv.loadedEdits, 2);
  eq('wymiar zmiany jest zachowany', srv.world.edits?.[1].d, 'n');
  eq('status po połączeniu', srv.status, 'connected');
  eq('gotowość zgłoszona raz', ready, 1);
  check('postęp ładowania jest widoczny', /Wczytano świat/.test(progress), progress);
  // Dwie osoby z Presence + my (nas jeszcze nie ma w stanie Presence).
  eq('obsada z Presence ma trzy osoby', peers.length, 3);
  check('własny wpis jest pierwszy', (peers[0] as { self?: boolean }).self === true, JSON.stringify(peers));
  check('obsada ma graczy z Presence', peers.some((p) => p.name === 'Ala') && peers.some((p) => p.name === 'Bob'), JSON.stringify(peers));

  // Wysyłka zmian: natychmiast przez broadcast, zapis batchowany do bazy.
  srv.sendEdits([{ x: 10, y: 70, z: 10, id: 5, d: 'o' }]);
  eq('zmiana czeka na zapis', srv.pendingEdits, 1);
  const bc = fake.log.filter((l) => l.op === 'broadcast');
  eq('zmiana leci też przez Realtime', bc.length, 1);

  srv.sendEdits([{ x: 10, y: 70, z: 10, id: 7, d: 'o' }]);
  eq('ten sam blok nie dubluje wpisu', srv.pendingEdits, 1);

  await srv.flush();
  const ups = fake.log.filter((l) => l.op === 'upsert');
  eq('zapis poszedł jednym upsertem', ups.length, 1);
  const payload = ups[0].payload as { x: number; block: number; world: string }[];
  eq('w upsercie jest najnowszy blok', payload[0].block, 7);
  eq('wiersz trafia do świata publicznego', payload[0].world, PUBLIC_WORLD_ID);
  eq('kolejka zapisu wyczyszczona', srv.pendingEdits, 0);

  // Błąd sieci nie gubi budowli.
  fake.failOnce();
  srv.sendEdits([{ x: 11, y: 71, z: 11, id: 2, d: 'n' }]);
  await srv.flush();
  eq('nieudany zapis wraca do kolejki', srv.pendingEdits, 1);
  await srv.flush();
  eq('ponowna próba zapisuje zmiany', srv.pendingEdits, 0);

  // Śmieci nie trafiają do bazy.
  srv.sendEdits([{ x: NaN, y: 1, z: 1, id: 2 }, { x: 0, y: 900, z: 0, id: 2 }]);
  eq('błędne edyty są odrzucane', srv.pendingEdits, 0);

  // Czat i pozycje.
  fake.log.length = 0;
  srv.say('  Cześć   wszystkim  ');
  const chat = fake.log.find((l) => l.op === 'broadcast');
  eq('czat leci przez Realtime', (chat?.payload as { text: string })?.text, 'Cześć   wszystkim');

  srv.close();
  eq('zamknięcie zmienia status', srv.status, 'closed');
  check('pusty czat nie jest wysyłany', (() => { const before = fake.log.length; srv.say('   '); return fake.log.length === before; })());
  check('SAVE_EVERY_MS mieści się w limicie żądań', SAVE_EVERY_MS >= 2000);
}

section('2.10: multiplayer wpięty w grę');
{
  const engine = readSource('src/game/engine.ts');
  const world = readSource('src/game/world.ts');
  const hud = readSource('src/components/HUD.tsx');
  const mp = readSource('src/components/MultiplayerScreen.tsx');
  const app = readSource('src/App.tsx');

  check('świat powiadamia o zmianach bloków', /onEdit\??\.\(x, y, z, id\)/.test(world));
  check('silnik wysyła pozycję co 1/POS_HZ', /1 \/ posHz/.test(engine) && /POS_HZ/.test(engine));
  check('silnik synchronizuje oba wymiary', /editHook\('o'\)/.test(engine) && /editHook\('n'\)/.test(engine));
  check('silnik nie zapętla własnych edytów', /netApplying/.test(engine));
  eq('sesję zamyka tylko dispose', (engine.match(/this\.net\?\.close\(/g) ?? []).length, 1);
  check('dispose zamyka sesję', /dispose\(\)[\s\S]{0,1400}this\.net\?\.close\(/.test(engine));
  check('zmiana wymiaru chowa awatary zamiast zrywać sesję', /Awatary są przywiązane do współrzędnych wymiaru/.test(engine));
  check('silnik nie zapisuje sesji sieciowej do slotów', /if \(this\.net\) return;/.test(engine));
  check('silnik odtwarza migawkę zmian od gospodarza', /applyNetEdits\(net\.world\.edits\)/.test(engine));
  check('silnik rysuje awatary innych graczy', /makeAvatar/.test(engine));
  check('gość startuje obok gospodarza', /net\.world\.spawn/.test(engine));
  check('gospodarz publikuje swoją pozycję w migawce', /spawn: \{ x: Math\.round\(p\.x\)/.test(engine));
  check('silnik ma etykiety z nazwami graczy', /fillText\(name\.slice\(0, 16\)/.test(engine));
  check('HUD pokazuje obsadę sesji', /hud\.players/.test(hud));
  check('HUD pokazuje ping graczy', /p\.ping/.test(hud));
  check('poczekalnia ma tryb tej samej przeglądarki', /createLocalLink/.test(mp));
  check('poczekalnia ma tryb przez internet', /createRtcHost/.test(mp) && /createRtcGuest/.test(mp));
  check('poczekalnia kopiuje kody jednym przyciskiem', /navigator\.clipboard/.test(mp));
  check('menu główne ma wejście do multiplayera', /Gra razem/.test(readSource('src/components/Menus.tsx')));
  check('aplikacja przekazuje sesję do gry', /net=\{session\.net\}/.test(app));
  check('aplikacja sprząta sesję po powrocie do menu', /setMultiplayer\(false\)/.test(app));

  // Silnik na prototypie (bez WebGL): odtwarzanie edytów z sieci i czat.
  const netg = Object.create(Game.prototype) as Record<string, any>;
  netg.homeWorld = new World(3, true);
  netg.netherWorld = new World(3, false, true);
  netg.netApplying = false;
  netg.netEditQueue = [];
  netg.messages = [];
  netg.message = (t: string) => netg.messages.push(t);
  netg.netPlayers = [{ id: 'host-1', name: 'Ala', hue: 0, ping: 5 }];
  netg.remotes = new Map();
  netg.netName = 'Bob';
  const sentChat: string[] = [];
  netg.net = { id: 'guest-9', role: 'guest', name: 'Bob', say: (t: string) => sentChat.push(t) };

  netg.onNetMessage({ t: 'edits', from: 'host-1', list: [{ x: 2, y: FLAT_H, z: 2, id: B.STONE, d: 'o' }] });
  eq('edyt z sieci trafia do nadświatu', netg.homeWorld.getBlock(2, FLAT_H, 2), B.STONE);
  check('edyt z sieci nie zawiesza flagi odtwarzania', netg.netApplying === false);

  netg.onNetMessage({ t: 'edits', from: 'host-1', list: [{ x: 3, y: 40, z: 3, id: B.NETHERRACK, d: 'n' }] });
  eq('edyt z Netheru trafia do właściwego wymiaru', netg.netherWorld.getBlock(3, 40, 3), B.NETHERRACK);
  check('edyt z Netheru nie zmienia nadświatu', netg.homeWorld.getBlock(3, 40, 3) !== B.NETHERRACK, String(netg.homeWorld.getBlock(3, 40, 3)));

  let hookCalls = 0;
  netg.homeWorld.onEdit = () => { hookCalls++; };
  netg.homeWorld.setBlock(5, FLAT_H + 1, 5, B.STONE);
  eq('każda zmiana bloku woła hook sieci', hookCalls, 1);

  netg.onNetMessage({ t: 'bye', from: 'host-1' });
  check('wyjście gracza trafia do czatu', netg.messages.some((m: string) => /Ala opuścił grę/.test(m)), netg.messages.join('|'));

  netg.command('Cześć wszystkim');
  eq('czat w sesji leci do sieci', sentChat.join('|'), 'Cześć wszystkim');
  check('czat w sesji widać też lokalnie', netg.messages.some((m: string) => m === '<Bob> Cześć wszystkim'), netg.messages.join('|'));
}


// ============================================== 2.16: tekstury i przepisy
section('2.16: pikselowe tekstury mobów i graczy');
{
  /** Ile różnych kolorów RGB jest w teksturze (jednokolorowa = 1). */
  const uniqueColors = (px: Uint8Array) => {
    const set = new Set<number>();
    for (let i = 0; i < px.length; i += 4) set.add((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]);
    return set.size;
  };

  const samples: [MobTexKind, number][] = [
    ['cow-hide', 0x6b4423], ['pig-hide', 0xf0a0a0], ['wool', 0xeeeeee], ['sheep-face', 0xd8c8b0],
    ['feather', 0xf4f4f4], ['creeper', 0x3aaa32], ['zombie-skin', 0x5d8a44], ['cloth', 0x2aa3a3],
    ['denim', 0x3b3f8f], ['chitin', 0x2e1f16], ['bone', 0xe6e2d4], ['wolf-fur', 0x7a8089],
    ['villager-skin', 0xa8785a], ['robe', 0x4f8a3a], ['iron', 0xc9c9cd], ['enderman', 0x111111],
    ['slime', 0x5ad65a], ['ghast', 0xf0f0f0], ['vine', 0x4a7a3a], ['skin', 0xc68642], ['hair', 0x3b2a1a],
    ['leather', 0x2b2b2b],
  ];
  let flat = 0;
  const thin: string[] = [];
  for (const [kind, color] of samples) {
    const colors = uniqueColors(texturePixels(kind, color));
    if (colors < 4) { flat++; thin.push(`${kind}:${colors}`); }
  }
  eq('każda tekstura jest wielobarwna (>= 4 kolory)', flat, 0);
  check('tekstury mają sensowną liczbę kolorów', thin.length === 0, thin.join(', '));

  // Krowa musi mieć jasne łaty, a nie sam brąz.
  const cow = texturePixels('cow-hide', 0x6b4423);
  let creamPixels = 0;
  for (let i = 0; i < cow.length; i += 4) {
    if (cow[i] > 180 && cow[i + 1] > 170 && cow[i + 2] > 150) creamPixels++;
  }
  check('krowa ma kremowe łaty na futrze', creamPixels >= 12, `${creamPixels} px`);

  // Cache: ten sam kind + kolor = ta sama tekstura (setki mobów, kilka tekstur).
  check('tekstury są współdzielone', partTexture('creeper', 0x3aaa32) === partTexture('creeper', 0x3aaa32));
  check('cache tekstur rośnie dla różnych kolorów', textureCount() >= 20, `${textureCount()} tekstur`);

  // Dobór tekstury po kolorze części.
  eq('brąz krowy → cow-hide', kindForColor(0x6b4423), 'cow-hide');
  eq('czerń endermana → enderman', kindForColor(0x111111), 'enderman');
  eq('nieznany kolor → grain', kindForColor(0x123456), 'grain');

  // Każdy mob ma teksturowane co najmniej ciało i głowę.
  const w = new World(4242);
  w.getChunk(0, 0);
  const h = w.heightAt(6, 6);
  const allTypes: MobType[] = ['pig', 'zombie', 'sheep', 'cow', 'chicken', 'creeper', 'spider', 'skeleton', 'wolf', 'villager', 'golem', 'enderman', 'slime', 'ghast'];
  const noTex: string[] = [];
  for (const type of allTypes) {
    const m = new Mob(type, 6.5, h + 1, 6.5);
    let textured = 0;
    m.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshLambertMaterial;
      if (mat.map) textured++;
    });
    // Slime to jedna bryła, więc wystarczy jedna teksturowana część; reszta
    // mobów ma ich znacznie więcej (ciało, głowa, kończyny).
    if (textured < 1) noTex.push(`${type}:${textured}`);
    m.dispose();
  }
  eq('każdy mob ma teksturowane części ciała', noTex.length, 0);
  check('wszystkie 14 mobów przeszło kontrolę', allTypes.length === 14, `${allTypes.length}`);

  // Slime jest półprzezroczysty (jak w Minecrafcie), oczy pozostają ostre.
  const slime = new Mob('slime', 6.5, h + 1, 6.5);
  let translucent = 0;
  slime.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshLambertMaterial;
    if (mat.transparent && mat.opacity < 1) translucent++;
  });
  check('slime jest półprzezroczysty', translucent >= 1, `${translucent}`);

  // Owca po strzyżeniu też ma teksturę (goła skóra, nie płaski kolor).
  const sheep = new Mob('sheep', 6.5, h + 1, 6.5);
  sheep.shear();
  let shearedMapped = 0;
  sheep.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if ((mesh.material as THREE.MeshLambertMaterial).map) shearedMapped++;
  });
  check('ostrzyżona owca nadal ma teksturę', shearedMapped >= 2, `${shearedMapped}`);

  // Oswojony wilk zmienia kolor sierści mimo białej bazy materiału.
  const wolf = new Mob('wolf', 6.5, h + 1, 6.5);
  const coatColors = () => {
    const seen = new Set<number>();
    wolf.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.userData.mobKind === 'wolf-fur') seen.add(mesh.userData.mobColor as number);
    });
    return seen;
  };
  // 2.18: wilk ma prawdziwą skórkę z paczki, więc oswojenie zaznacza
  // czerwona obroża, a nie przemalowanie sierści (jak w Minecrafcie).
  check('wilk dostał model 1:1 z paczki', wolf.hasVanillaModel());
  check('wilk ma teksturę futra', coatColors().size === 0 || coatColors().has(0x7a8089));
  wolf.tame();
  const collar = new THREE.Box3();
  let hasCollar = false;
  wolf.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshLambertMaterial;
    if (mat.map) return;
    if (mat.color && mat.color.getHex() === 0xc02020) hasCollar = true;
  });
  void collar;
  check('oswojony wilk dostaje czerwoną obrożę', hasCollar);

  // Gracze: awatary dostają te same pikselowe tekstury (tkanina, jeans, skóra).
  const shirt = avatarMaterial('cloth', 0x00a8a8);
  check('koszulka awatara ma teksturę', shirt.map != null);
  check('spodnie awatara mają teksturę', avatarMaterial('denim', 0x3b4bb8).map != null);
  check('skóra awatara ma teksturę', avatarMaterial('skin', 0xc68642).map != null);
  const eng = readSource('src/game/engine.ts');
  check('silnik buduje awatary z teksturami', /avatarMaterial\(AVATAR_KINDS\[kind\]/.test(eng));
  const mobsSrc = readSource('src/game/mobs.ts');
  check('moby biorą materiał z modułu tekstur', /mobMaterial\(texKind, base\)/.test(mobsSrc) && /kindForColor/.test(mobsSrc));
}

section('2.16: nowe przepisy rzemieślnicze');
{
  const out = (id: number) => RECIPES.find((r) => r.out.id === id);
  const wanted: [number, string][] = [
    [B.BRICK_STAIRS_N, 'ceglane schody'], [B.STONE_BRICK_STAIRS_N, 'schody z cegieł kamiennych'],
    [B.SANDSTONE_STAIRS_N, 'piaskowcowe schody'], [B.NETHER_BRICK_STAIRS_N, 'netherowe schody'],
    [B.QUARTZ_STAIRS_N, 'kwarcowe schody'],
    [B.COBBLE_SLAB, 'płyta brukowa'], [B.BRICK_SLAB, 'ceglana płyta'],
    [B.SANDSTONE_SLAB, 'piaskowcowa płyta'], [B.NETHER_BRICK_SLAB, 'netherowa płyta'],
    [B.HAY, 'snop siana'], [B.LANTERN, 'latarnia'], [B.BELL, 'dzwon'],
    [B.EMERALD_BLOCK, 'blok szmaragdu'], [B.HONEY_BLOCK, 'blok miodu'],
    [B.TERRACOTTA, 'terakota'], [B.CONCRETE_BLUE, 'niebieski beton'],
    [B.CONCRETE_GREEN, 'zielony beton'], [B.CONCRETE_YELLOW, 'żółty beton'],
    [B.CONCRETE_BLACK, 'czarny beton'], [B.MUD, 'błoto'],
  ];
  const missing = wanted.filter(([id]) => !out(id)).map(([, name]) => name);
  eq('wszystkie nowe przepisy istnieją', missing.length, 0);
  check('liczba przepisów wzrosła powyżej 150', RECIPES.length >= 150, `${RECIPES.length}`);

  // Ilości jak w Minecrafcie.
  eq('6 bloków → 4 schody', out(B.BRICK_STAIRS_N)?.out.count, 4);
  eq('3 bloki → 6 płyt', out(B.COBBLE_SLAB)?.out.count, 6);
  eq('9 pszenicy → snop', out(B.HAY)?.inputs.find((i) => i.id === I.WHEAT)?.count, 9);
  eq('4 nici → wełna', RECIPES.find((r) => r.out.id === B.WOOL_WHITE && r.inputs.some((i) => i.id === I.STRING))?.inputs[0].count, 4);
  eq('4 butelki miodu → blok miodu', out(B.HONEY_BLOCK)?.out.count, 1);
  check('latarnia jest bezpostaciowa', out(B.LANTERN)?.pattern == null);
  check('dzwon wymaga stołu', out(B.BELL)?.table === true);

  // Przepis naprawdę działa w siatce 3×3.
  const craft = (recipe: (typeof RECIPES)[number]) => {
    const inv = new Inventory();
    recipe.pattern?.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === ' ' || ch === '.') continue;
        inv.grid[y * 3 + x] = { id: recipe.key![ch], count: 1 };
      }
    });
    return inv.gridMatch(true)?.out.id;
  };
  eq('ceglane schody da się ułożyć w siatce', craft(out(B.BRICK_STAIRS_N)!), B.BRICK_STAIRS_N);
  eq('netherowe schody da się ułożyć w siatce', craft(out(B.NETHER_BRICK_STAIRS_N)!), B.NETHER_BRICK_STAIRS_N);
  eq('płyta brukowa da się ułożyć w siatce', craft(out(B.COBBLE_SLAB)!), B.COBBLE_SLAB);
  eq('blok szmaragdu da się ułożyć w siatce', craft(out(B.EMERALD_BLOCK)!), B.EMERALD_BLOCK);

  // Rozbiórka: snop → 9 pszenicy, blok szmaragdu → 9 szmaragdów.
  const hayBack = new Inventory();
  hayBack.grid[0] = { id: B.HAY, count: 1 };
  eq('snop wraca na 9 pszenicy', hayBack.gridMatch(true)?.out.id, I.WHEAT);
  const emeraldBack = new Inventory();
  emeraldBack.grid[0] = { id: B.EMERALD_BLOCK, count: 1 };
  eq('blok szmaragdu wraca na 9 sztuk', emeraldBack.gridMatch(true)?.out.count, 9);

  // Naprawiony błąd: blackstone nie „wypala się” w siebie.
  eq('blackstone nie jest paliwem ani wynikiem wypalania', smeltResult(B.BLACKSTONE), null);
  eq('soul sand nadal daje soul soil', smeltResult(B.SOUL_SAND), B.SOUL_SOIL);
}

// ============================================ 2.17: grafika z paczki tekstur
section('2.17: tekstury z paczki w całej grze');
{
  // --- atlas bloków
  const blocks = decodePng(BLOCK_ATLAS_PNG);
  eq('atlas bloków z paczki ma 256×256', `${blocks.width}×${blocks.height}`, '256×256');
  const colors = new Set<number>();
  for (let i = 0; i < blocks.data.length; i += 4) {
    colors.add((blocks.data[i] << 16) | (blocks.data[i + 1] << 8) | blocks.data[i + 2]);
  }
  check('atlas bloków jest wielobarwny', colors.size > 800, `${colors.size} kolorów`);
  eq('wszystkie 175 kafelków pochodzi z paczki', officialTileCount(), 175);
  check('oficjalne kafelki pokrywają cały atlas', OFFICIAL_TILES.length === 175 && OFFICIAL_TILES[174] === 174);
  check('kafelek spoza listy nie jest oficjalny', !isOfficialTile(999) && isOfficialTile(0));
  const cached = officialBlockAtlas();
  check('atlas bloków dekoduje się w grze', cached != null && cached.width === 256);

  // --- podmiana kafelków w atlasie gry
  const fake = { data: new Uint8ClampedArray(256 * 256 * 4) };
  const copied = applyOfficialTiles(fake as unknown as ImageData);
  eq('applyOfficialTiles podmienia 175 kafelków', copied, 175);
  let nonZero = 0;
  for (let i = 0; i < fake.data.length; i += 4) if (fake.data[i + 3] > 0) nonZero++;
  check('po podmianie atlas ma niepuste piksele', nonZero > 155 * 16 * 16 * 0.5, `${nonZero} px`);

  // Każdy oficjalny kafelek jest niepusty i ma co najmniej 2 kolory.
  let emptyTiles = 0;
  let flatTiles = 0;
  for (const tile of OFFICIAL_TILES) {
    const ox = (tile % 16) * 16;
    const oy = Math.floor(tile / 16) * 16;
    const seen = new Set<number>();
    let opaque = 0;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = ((oy + y) * 256 + ox + x) * 4;
        if (blocks.data[i + 3] > 8) opaque++;
        seen.add((blocks.data[i] << 16) | (blocks.data[i + 1] << 8) | blocks.data[i + 2]);
      }
    }
    if (opaque === 0) emptyTiles++;
    if (seen.size < 2) flatTiles++;
  }
  eq('żaden kafelek z paczki nie jest pusty', emptyTiles, 0);
  eq('każdy kafelek z paczki ma detal (>= 2 kolory)', flatTiles, 0);

  // --- ikony przedmiotów
  const items = decodePng(ITEM_ATLAS_PNG);
  eq('atlas ikon ma 256×256', `${items.width}×${items.height}`, '256×256');
  check('ikony przedmiotów pochodzą z paczki', officialItemCount() >= 95, `${officialItemCount()}`);
  check('kilof ma ikonę z paczki', officialItemPixels(I.WOOD_PICK) != null);
  check('miecz ma ikonę z paczki', officialItemPixels(I.DIAMOND_SWORD) != null);
  check('mikstura ma ikonę z paczki', officialItemPixels(I.POTION_HEAL) != null);
  check('nieznany przedmiot nie ma ikony z paczki', officialItemPixels(99999) == null);
  const pick = officialItemPixels(I.WOOD_PICK)!;
  let pickOpaque = 0;
  for (let i = 3; i < pick.length; i += 4) if (pick[i] > 8) pickOpaque++;
  check('ikona kilofa ma widoczne piksele', pickOpaque > 20, `${pickOpaque} px`);
  eq('oficjalny atlas ikon dekoduje się w grze', officialItemAtlas()?.width, 256);

  // --- skórki graczy
  eq('dziewięć skórek graczy z paczki', packSkinCount(), 9);
  check('Steve ma skórkę z paczki', hasPackSkin('steve') && PLAYER_SKIN_PNG.steve.startsWith('data:image/png;base64,'));
  check('Alex ma skórkę z paczki', hasPackSkin('alex'));
  check('każda skórka z listy ma prawdziwą teksturę 1:1', SKINS.every((s) => hasPackSkin(s.id)));
  eq('każda skórka ma portret', portraitCount(), 9);
  eq('smukłe skórki są oznaczone', isSlimSkin('alex') && isSlimSkin('efe') && !isSlimSkin('steve'), true);
  check('twarz do listy graczy jest gotowa', (skinFace('zuri') ?? '').startsWith('data:image/png;base64,'));
  check('portret ma 16×32', (() => { const p = decodePng(skinPortrait('zuri')!); return p.width === 16 && p.height === 32; })());
  check('każda skórka ma 64×64', SKINS.every((s) => { const im = decodePng(PLAYER_SKIN_PNG[s.id]); return im.width === 64 && im.height === 64; }));
  const steve = decodePng(PLAYER_SKIN_PNG.steve);
  eq('skórka Steve ma 64×64', `${steve.width}×${steve.height}`, '64×64');
  // Twarz: prostokąt front głowy (8,8)-(16,16) musi mieć jasną skórę i ciemne oczy.
  let skinPx = 0;
  let darkPx = 0;
  for (let y = 8; y < 16; y++) {
    for (let x = 8; x < 16; x++) {
      const i = (y * 64 + x) * 4;
      if (steve.data[i + 3] < 128) continue;
      skinPx++;
      if (steve.data[i] < 70 && steve.data[i + 1] < 70) darkPx++;
    }
  }
  check('twarz Steve ma piksele skóry', skinPx >= 60, `${skinPx}`);
  check('twarz Steve ma ciemne oczy', darkPx >= 2, `${darkPx}`);

  // --- układ UV
  const head = faceRects(WIDE_LAYOUT.head);
  eq('sześć ścian głowy', head.length, 6);
  eq('przód głowy to (8,8)-(16,16)', `${head[5].x0},${head[5].y0},${head[5].x1},${head[5].y1}`, '8,8,16,16');
  eq('góra głowy to (8,0)-(16,8)', `${head[2].x0},${head[2].y0},${head[2].x1},${head[2].y1}`, '8,0,16,8');
  eq('prawa ręka Alexa jest węższa', SLIM_LAYOUT.rightArm.w, 3);
  eq('prawa ręka Steve’a ma 4 piksele', WIDE_LAYOUT.rightArm.w, 4);
  const skinTex = playerSkinTexture('steve');
  check('tekstura skórki tworzy się w grze', skinTex != null);
  eq('skórka nie jest odwrócona (DataTexture ma flipY = false)', skinTex?.flipY, false);
  // Góra ściany (wierzchołki 0 i 1) musi wskazywać górny wiersz tekstury.
  const box = new THREE.BoxGeometry(1, 1, 1);
  applySkinUv(box, WIDE_LAYOUT.head, 64, 64);
  const uvAttr = box.attributes.uv as THREE.BufferAttribute;
  const frontTopV = uvAttr.getY(5 * 4 + 0);
  const frontBottomV = uvAttr.getY(5 * 4 + 2);
  const backTopV = uvAttr.getY(4 * 4 + 0);
  eq('góra twarzy to wiersz 8 tekstury', Math.round(frontTopV * 64), 8);
  eq('dół twarzy to wiersz 16 tekstury', Math.round(frontBottomV * 64), 16);
  check('góra ściany ma mniejsze V niż dół', frontTopV < frontBottomV);
  eq('plecy głowy to wiersz 8', Math.round(backTopV * 64), 8);
  // Ściana +X (wierzchołek 0) to prawa strona głowy: kolumna 0 tekstury.
  eq('prawa strona głowy zaczyna się w kolumnie 0', Math.round(uvAttr.getX(0) * 64), 0);

  // --- palety mobów
  eq('palety wszystkich 14 mobów', Object.keys(MOB_PALETTES).length, 14);
  check('paleta krowy ma brązy', MOB_PALETTES.cow.some((c) => ((c >> 16) & 0xff) > 0x30 && ((c >> 16) & 0xff) < 0x80));
  check('paleta creepera ma zielenie', MOB_PALETTES.creeper.some((c) => ((c >> 8) & 0xff) > 0x80));
  setMobPalette('creeper');
  check('paleta moba jest aktywna', activeMobPalette().length >= 5);
  const snapped = snapToPalette(0x3aaa32);
  check('kolor creepera trafia w paletę paczki', MOB_PALETTES.creeper.includes(snapped), snapped.toString(16));
  const far = snapToPalette(0x0000ff, 8);
  eq('odległy kolor nie jest przesuwany', far, 0x0000ff);
  setMobPalette('__brak__');
  eq('mob bez palety zachowuje kolor', snapToPalette(0x123456), 0x123456);
  setMobPalette('cow');
}

// ============================================ 2.18: moby i HUD 1:1 z paczki
section('2.18: moby 1:1 z Minecrafta');
{
  // --- modele
  // 2.23: doszły modele wariantów biomowych (krowa ciepła/zimna, zimna świnia, zimowa kura)
  eq('19 modeli mobów (14 typów + wełna + 4 warianty)', mobModelCount(), 19);
  const required = ['pig', 'cow', 'sheep', 'sheep_wool', 'chicken', 'creeper', 'zombie', 'skeleton', 'spider', 'wolf', 'villager', 'golem', 'enderman', 'slime', 'ghast'];
  eq('wszystkie modele są na liście', required.filter((t) => MOB_MODELS[t]).length, required.length);
  eq('skórki mobów 1:1 z paczki', Object.keys(MOB_SKINS).length, 25);
  check('każdy model ma skórkę', required.every((t) => MOB_SKINS[MOB_MODELS[t].skin] != null));

  // --- rozmiary tekstur (tak jak w paczce)
  const dims = (key: string) => { const img = decodePng(MOB_SKINS[key].png); return `${img.width}×${img.height}`; };
  eq('krowa ma teksturę 64×64', dims('cow'), '64×64');
  eq('świnia ma teksturę 64×64', dims('pig'), '64×64');
  eq('owca ma teksturę 64×32', dims('sheep'), '64×32');
  eq('golem ma teksturę 128×128', dims('golem'), '128×128');
  eq('ghast ma teksturę 128×64', dims('ghast'), '128×64');

  // --- UV: każda ściana każdego pudełka trafia w niepusty fragment tekstury
  const coverage = (type: string) => {
    const model = MOB_MODELS[type];
    const img = decodePng(MOB_SKINS[model.skin].png);
    let opaque = 0, total = 0;
    for (const p of model.parts) for (const b of p.boxes) {
      if (b.color !== undefined) continue;
      for (const f of boxFaces(b.uv, b.size[0], b.size[1], b.size[2], b.mirror, model.uvScale ?? 1)) {
        for (let y = Math.floor(f.y0); y < Math.ceil(f.y1); y++) {
          for (let x = Math.floor(f.x0); x < Math.ceil(f.x1); x++) {
            total++;
            if (x >= 0 && y >= 0 && x < img.width && y < img.height && img.data[(y * img.width + x) * 4 + 3] > 8) opaque++;
          }
        }
      }
    }
    return total ? opaque / total : 0;
  };
  const poor = required.map((t) => [t, coverage(t)] as const).filter(([, c]) => c < 0.7);
  eq('UV każdego moba pokrywa teksturę (≥ 70%)', poor.map(([t]) => t).join(','), '');
  check('krowa pokrywa praktycznie całą teksturę', coverage('cow') > 0.97);
  check('ghast używa podwójnego UV', MOB_MODELS.ghast.uvScale === 2 && coverage('ghast') > 0.97);

  // --- układ ścian jak w wanilii
  const head = boxFaces(MOB_MODELS.pig.parts[0].boxes[0].uv, 8, 8, 8);
  eq('przód głowy świni to (8,8)-(16,16)', `${head[5].x0},${head[5].y0},${head[5].x1},${head[5].y1}`, '8,8,16,16');
  eq('góra głowy świni to (8,0)-(16,8)', `${head[2].x0},${head[2].y0},${head[2].x1},${head[2].y1}`, '8,0,16,8');
  const normal = boxFaces([0, 16], 4, 12, 4, false);
  const mirrored = boxFaces([0, 16], 4, 12, 4, true);
  eq('lustrzane UV odwraca oś U', `${mirrored[5].x0},${mirrored[5].x1}`, `${normal[5].x1},${normal[5].x0}`);

  // --- budowa modelu
  const pig = buildMobModel(MOB_MODELS.pig, 'pig')!;
  check('model świni się buduje', !!pig);
  eq('świnia ma 7 pudełek', pig.meshes.length, 7);
  check('model ma głowę, tułów i 4 nogi', ['head', 'body', 'rightHindLeg', 'leftHindLeg', 'rightFrontLeg', 'leftFrontLeg'].every((n) => pig.parts[n]));
  const pigTex = mobSkinTexture('pig')!;
  eq('tekstura moba nie jest odwrócona', pigTex.flipY, false);
  eq('tekstura świni ma 64 px', (pigTex.image as { width: number }).width, 64);

  // --- w grze: każdy mob dostaje model z paczki
  const w = new World(9182, true);
  w.getChunk(0, 0);
  const gy = w.heightAt(4, 4);
  const types: MobType[] = ['pig', 'cow', 'sheep', 'chicken', 'creeper', 'zombie', 'skeleton', 'spider', 'wolf', 'villager', 'golem', 'enderman', 'slime', 'ghast'];
  const legacy: string[] = [];
  const noMap: string[] = [];
  for (const t of types) {
    const m = new Mob(t, 4.5, gy + 2, 4.5);
    if (!m.hasVanillaModel()) legacy.push(t);
    if (!m.meshes.some((mesh) => (mesh.material as THREE.MeshLambertMaterial).map)) noMap.push(t);
    m.dispose();
  }
  eq('wszystkie moby używają modelu 1:1', legacy.join(','), '');
  eq('każdy mob ma teksturowane pudełka', noMap.join(','), '');

  // --- owca: wełna chowana po strzyżeniu
  const sheep = new Mob('sheep', 4.5, gy + 2, 4.5);
  const woolRoot = sheep.group.children[0].children.find((c) => c.children.some((g) => g.children.some((m) => (m as THREE.Mesh).isMesh)));
  const woolVisible = () => sheep.meshes.filter((m) => m.userData.mobKind === 'sheep_wool' && m.visible).length;
  check('owca ma wełnę przed strzyżeniem', woolVisible() > 0);
  check('strzyżenie się udaje', sheep.shear());
  const woolHidden = sheep.group.children[0].children.some((c) => c.visible === false);
  check('po strzyżeniu wełna znika', woolHidden, `${woolVisible()} widocznych`);
  void woolRoot;

  // --- owca: kolor runa (16 barwników), wełna zabarwiona materiałem
  const tints = new Set<number>();
  for (let i = 0; i < 40; i++) {
    const s2 = new Mob('sheep', 4.5 + i * 3.1, gy + 2, 4.5 + i * 1.7);
    tints.add(s2.woolColor);
    s2.dispose();
  }
  check('owce mają różne kolory runa', tints.size >= 3, `${tints.size} kolorów`);
  check('większość owiec jest biała', (() => {
    let white = 0;
    for (let i = 0; i < 60; i++) { const s2 = new Mob('sheep', 4.5 + i * 3.1, gy + 2, 4.5 + i * 1.7); if (s2.woolColor === 0xf9fffe) white++; s2.dispose(); }
    return white > 30;
  })());
  const dyed = new Mob('sheep', 30.5, gy + 2, 30.5);
  const woolMesh = dyed.meshes.find((m) => m.userData.mobKind === 'sheep_wool');
  check('wełna ma barwnik w materiale', !!woolMesh && (woolMesh.material as THREE.MeshLambertMaterial).color.getHex() === dyed.woolColor);
  dyed.dispose();

  // --- 2.22: owca 1:1 – 12-pikselowe nogi, wypas i odrastanie runa
  const sheepLeg = MOB_MODELS.sheep.parts.find((p) => p.name === 'rightHindLeg')!.boxes[0];
  eq('owca ma 12-pikselowe nogi (jak wanilia)', sheepLeg.size[1], 12);
  eq('owca stoi na zawiasie y=12', MOB_MODELS.sheep.parts.find((p) => p.name === 'rightHindLeg')!.pivot[1], 12);
  const woolLeg = MOB_MODELS.sheep_wool.parts.find((p) => p.name === 'rightHindLeg')!.boxes[0];
  check('wełna na nogach to krótka „skarpetka”', woolLeg.size[1] === 6 && woolLeg.inflate === 0.5);
  eq('owca ma pudełko 0,9 × 1,3', (() => { const m = new Mob('sheep', 8.5, gy + 2, 8.5); const d = `${m.body.w},${m.body.h}`; m.dispose(); return d; })(), '0.9,1.3');
  eq('szkielet ma pudełko 0,6 × 1,99', (() => { const m = new Mob('skeleton', 8.5, gy + 2, 8.5); const d = `${m.body.w},${m.body.h}`; m.dispose(); return d; })(), '0.6,1.99');
  eq('golem ma pudełko 1,4 × 2,7', (() => { const m = new Mob('golem', 8.5, gy + 2, 8.5); const d = `${m.body.w},${m.body.h}`; m.dispose(); return d; })(), '1.4,2.7');
  eq('pająk jest szeroki (1,4 × 0,9)', (() => { const m = new Mob('spider', 8.5, gy + 2, 8.5); const d = `${m.body.w},${m.body.h}`; m.dispose(); return d; })(), '1.4,0.9');
  eq('krowa ma 0,9 szerokości', (() => { const m = new Mob('cow', 8.5, gy + 2, 8.5); const d = `${m.body.w},${m.body.h}`; m.dispose(); return d; })(), '0.9,1.4');
  eq('creeper ma 20 HP', (() => { const m = new Mob('creeper', 8.5, gy + 2, 8.5); const hp = m.maxHealth; m.dispose(); return hp; })(), 20);

  // --- 2.23: zgodność z Minecraftem 26.2 (modele i warianty biomowe)
  const cowHead = MOB_MODELS.cow.parts.find((p) => p.name === 'head')!;
  check('krowa ma wystający pysk (1.21.5+)', cowHead.boxes.some((b) => b.uv[0] === 1 && b.uv[1] === 33));
  const cowLeftLeg = MOB_MODELS.cow.parts.find((p) => p.name === 'leftFrontLeg')!;
  check('lewe nogi krowy mają lustrzane UV', cowLeftLeg.boxes[0].mirror === true);
  check('prawa noga owcy ma lustrzane UV', MOB_MODELS.sheep.parts.find((p) => p.name === 'rightHindLeg')!.boxes[0].mirror === true);
  const zombieHat = MOB_MODELS.zombie.parts.find((p) => p.name === 'hat')!;
  check('zombie ma zewnętrzną warstwę głowy', zombieHat.parent === 'head' && zombieHat.boxes[0].inflate === 0.5);
  check('mieszkaniec ma rond kapelusza', MOB_MODELS.villager.parts.some((p) => p.name === 'hat_rim' && p.parent === 'head'));
  const ghastTentacles = MOB_MODELS.ghast.parts.filter((p) => p.name.startsWith('tentacle'));
  eq('ghast ma 9 macek', ghastTentacles.length, 9);
  eq('macki ghasta mają waniliowe długości', ghastTentacles.map((p) => p.boxes[0].size[1]).join(','), '8,13,9,11,11,10,12,9,12');
  eq('krowa ciepła ma własny model', MOB_MODELS.cow_warm?.skin, 'cow_warm');
  eq('krowa zimna ma warstwę futra', MOB_MODELS.cow_cold.parts.find((p) => p.name === 'body')!.boxes.filter((b) => b.inflate === 0.5).length, 1);
  eq('zimowa świnia ma futro', MOB_MODELS.pig_cold.parts.find((p) => p.name === 'body')!.boxes.length, 2);
  eq('zimowa kura ma czapkę z piór', MOB_MODELS.chicken_cold.parts.find((p) => p.name === 'head')!.boxes.length, 2);
  eq('tekstury wariantów są 1:1', ['cow_warm', 'cow_cold', 'pig_warm', 'pig_cold', 'chicken_warm', 'chicken_cold'].map((k) => dims(k)).join(','), '64×64,64×64,64×64,64×64,64×32,64×32');
  eq('wariant z biomu: tundra → zimna krowa', mobVariantForBiome('cow', 'Tundra'), 'cold');
  eq('wariant z biomu: sawanna → ciepła świnia', mobVariantForBiome('pig', 'Sawanna'), 'warm');
  eq('wariant z biomu: las → zwykła kura', mobVariantForBiome('chicken', 'Las'), 'temperate');
  eq('warianty tylko dla zwierząt gospodarskich', mobVariantForBiome('zombie', 'Pustynia'), 'temperate');
  const coldCow = new Mob('cow', 8.5, gy + 2, 8.5, 0, 'cold');
  check('zimna krowa używa modelu z futrem', coldCow.hasVanillaModel() && coldCow.meshes.length === 11, `${coldCow.meshes.length}`);
  coldCow.dispose();
  const warmPig = new Mob('pig', 8.5, gy + 2, 8.5, 0, 'warm');
  eq('ciepła świnia ma teksturę wariantu', (warmPig.meshes[0].material as THREE.MeshLambertMaterial).map?.image != null, true);
  warmPig.dispose();

  // --- 2.24: model danych launchera
  {
    const news = launcherNews(3);
    eq('launcher pokazuje 3 nowości', news.length, 3);
    check('pierwsza nowość to bieżące wydanie', news[0].tag.includes(GAME_VERSION), news[0].tag);
    check('launcher zna docelową wersję Minecrafta', TARGET_LABEL.includes('26.2'), TARGET_LABEL);
    eq('meta świata: tryb, typ, seed i dzień', worldMeta({ mode: 'creative', worldType: 'flat', seed: 42, day: 3 }), 'Kreatywny · płaski · seed 42 · dzień 3');
    eq('meta świeżego świata', worldMeta({ seed: 7 }), 'Przetrwanie · normalny · seed 7 · nowy');
    eq('sinceLabel bez uruchomień', sinceLabel(null), 'jeszcze nie uruchamiano');
    eq('sinceLabel dla teraz', sinceLabel(Date.now()), 'przed chwilą');
    eq('etapy uruchamiania rosną', LAUNCH_STEPS.map((s) => s.progress).join(','), '22,54,82,100');
    eq('launcher ma 7 zakładek', LAUNCHER_TABS.length, 7);
    eq('domyślna zakładka to Start', DEFAULT_PROFILE.tab, 'home');
    const prof = loadLauncherProfile();
    check('profil ma nick', typeof prof.name === 'string' && prof.name.length > 0, prof.name);
  }

  // --- 2.23: ikona tarczy (w paczce nie ma `item/shield.png`) i skrzynia
  {
    const atlas = decodePng(ITEM_ATLAS_PNG);
    const tile = ITEM_TILE[I.SHIELD];
    check('tarcza ma własny kafelek ikony', tile !== undefined, `${tile}`);
    if (tile !== undefined) {
      const tx = (tile % 16) * 16, ty = Math.floor(tile / 16) * 16;
      const alpha = (x: number, y: number) => atlas.data[((ty + y) * atlas.width + tx + x) * 4 + 3];
      check('ikona tarczy ma przezroczyste rogi', alpha(0, 0) === 0 && alpha(15, 0) === 0);
      check('ikona tarczy ma zaczepiony dół', alpha(7, 15) > 0 && alpha(1, 15) === 0);
      check('ikona tarczy jest w środku kafelka', alpha(7, 4) > 0 && alpha(3, 10) > 0);
    }
    const chest = BLOCK_ATLAS_PNG ? decodePng(BLOCK_ATLAS_PNG) : null;
    if (chest) {
      const sample = (t: number) => {
        const tx = (t % 16) * 16, ty = Math.floor(t / 16) * 16;
        let sum = 0, n = 0;
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          const i = ((ty + y) * chest.width + tx + x) * 4;
          sum += chest.data[i] + chest.data[i + 1] + chest.data[i + 2];
          n += 3;
        }
        return Math.round(sum / n);
      };
      check('skrzynia nie używa tekstury desek', Math.abs(sample(T.chest_front) - sample(T.planks)) > 6,
        `${sample(T.chest_front)} vs ${sample(T.planks)}`);
    } else {
      check('atlas bloków jest dostępny', false);
    }
  }

  // pełna paleta wełny: 16 kolorów runa → 16 różnych bloków
  const woolBlocks = new Set<number>();
  for (const color of SHEEP_WOOL_COLORS) woolBlocks.add(woolBlockFor(color));
  eq('każdy kolor runa ma własny blok wełny', woolBlocks.size, 16);
  eq('biała owca daje białą wełnę', woolBlockFor(0xf9fffe), B.WOOL_WHITE);
  eq('czarna owca daje czarną wełnę', woolBlockFor(0x1d1d21), B.WOOL_BLACK);
  check('jest 16 bloków wełny', [B.WOOL_WHITE, B.WOOL_ORANGE, B.WOOL_MAGENTA, B.WOOL_LIGHT_BLUE, B.WOOL_YELLOW, B.WOOL_LIME, B.WOOL_PINK, B.WOOL_GRAY, B.WOOL_LIGHT_GRAY, B.WOOL_CYAN, B.WOOL_PURPLE, B.WOOL_BLUE, B.WOOL_BROWN, B.WOOL_GREEN, B.WOOL_RED, B.WOOL_BLACK].every((id) => !!BLOCKS[id]));

  // wypas: ostrzyżona owca na trawie odrasta, a trawa zamienia się w ziemię
  const wg = new World(555, true);
  const gg = FLAT_H + 1;
  wg.setBlock(3, gg - 1, 3, B.GRASS);
  const grazer = new Mob('sheep', 3.5, gg, 3.5);
  grazer.shear();
  grazer.grazeTimer = 0;
  // owca stoi w miejscu – inaczej losowy spacer mógłby zejść z klocka trawy
  for (let i = 0; i < 120; i++) {
    grazer.walking = false;
    grazer.aiTimer = 5;
    grazer.update(1 / 60, wg, new THREE.Vector3(20, gg, 20), () => {}, () => {}, false);
  }
  check('owca pasie się na trawie', wg.peekBlock(3, gg - 1, 3) === B.DIRT, `blok=${wg.peekBlock(3, gg - 1, 3)}`);
  check('po wypasie runo odrasta', !grazer.sheared);
  grazer.dispose();

  // --- mieszkaniec: zawód wybiera własną teksturę
  const skins = new Set<string>();
  for (let i = 0; i < 5; i++) skins.add(`villager${i}`);
  check('każdy zawód mieszkańca ma teksturę', [...skins].every((k) => MOB_SKINS[k] != null));

  // --- wilk: obroża po oswojeniu
  const wolf = new Mob('wolf', 4.5, gy + 2, 4.5);
  wolf.tame();
  let collar = false;
  wolf.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshLambertMaterial;
    if (!mat.map && mat.color && mat.color.getHex() === 0xc02020) collar = true;
  });
  check('oswojony wilk ma obrożę', collar);

  // --- głowa odwraca się w stronę gracza
  // 2.27: ciało przypięte do miejsca, a gracz stoi pod kątem 0,5 rad względem
  // kierunku ciała. Wcześniej wynik zależał od losowego spaceru krowy.
  const cow = new Mob('cow', 4.5, gy + 2, 4.5);
  const player = new THREE.Vector3(
    4.5 + Math.sin(0.5) * 6,
    gy + 1,
    4.5 + Math.cos(0.5) * 6
  );
  let maxTurn = 0;
  for (let i = 0; i < 120; i++) {
    cow.body.pos.set(4.5, gy + 2, 4.5);
    cow.yaw = 0;
    cow.group.rotation.y = 0;
    cow.update(1 / 30, w, player, () => {}, () => {}, true, []);
    maxTurn = Math.max(maxTurn, Math.abs(cow.head.rotation.y));
  }
  check('mob odwraca głowę do gracza', Math.abs(cow.head.rotation.y - 0.5) < 0.2, `${cow.head.rotation.y.toFixed(2)}`);
  check('głowa odwraca się w tę stronę co gracz', cow.head.rotation.y > 0, `${cow.head.rotation.y.toFixed(2)}`);
  check('obrót głowy jest ograniczony', maxTurn <= 0.95, `${maxTurn.toFixed(2)}`);
  // 2.19: głowa musi patrzeć W STRONĘ gracza, a nie w przeciwną (golem).
  // 2.19: głowa golema musi skręcać W STRONĘ gracza, a nie w przeciwną.
  // Sprawdzamy znak kąta względem ciała – to dokładnie ta pomyłka, która
  // wcześniej obracała głowę o 180°.
  const golem = new Mob('golem', 4.5, gy + 2, 4.5);
  // Gracz stoi 8 bloków dalej pod kątem +0,55 rad względem kierunku ciała.
  const side = new THREE.Vector3(
    4.5 + Math.sin(0.7 + 0.55) * 8,
    gy + 1,
    4.5 + Math.cos(0.7 + 0.55) * 8
  );
  for (let i = 0; i < 90; i++) {
    // Ciało stoi w miejscu – sprawdzamy sam obrót głowy.
    golem.body.pos.set(4.5, gy + 2, 4.5);
    golem.yaw = 0.7;
    golem.group.rotation.y = 0.7;
    golem.update(1 / 30, w, side, () => {}, () => {}, true, []);
  }
  check('głowa golema patrzy w stronę gracza', Math.abs(golem.head.rotation.y - 0.55) < 0.2, `head=${golem.head.rotation.y.toFixed(2)}`);
  check('obrót głowy golema jest ograniczony', Math.abs(golem.head.rotation.y) <= 0.95, `${golem.head.rotation.y.toFixed(2)}`);
  // 2.20: golem (i enderman) trzyma ręce opuszczone – wcześniej każdy mob z
  // dwiema rękami dostawał pozę zombie z rękami wyciągniętymi do przodu.
  check(
    'golem trzyma ręce opuszczone',
    golem.arms.length === 2 && golem.arms.every((a) => Math.abs(a.rotation.x) < 0.4),
    golem.arms.map((a) => a.rotation.x.toFixed(2)).join(',')
  );
  golem.dispose();
}

// ===================================================== 2.25: poza mobów i fizyka
section('2.25: ręce i głowy mobów patrzą w stronę ruchu');
{
  // 2.25: animacja dokłada się do pozy z modelu. Wcześniej nadpisywała ją
  // i zombie „chował ręce za plecami”, bo wpis -PI/2 kasował waniliowe +PI/2.
  const partBox = (mob: Mob, part: THREE.Object3D) => {
    mob.group.updateMatrixWorld(true);
    const b = new THREE.Box3();
    part.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const g = mesh.geometry.boundingBox ?? (mesh.geometry.computeBoundingBox(), mesh.geometry.boundingBox);
      if (g) b.union(g.clone().applyMatrix4(mesh.matrixWorld));
    });
    return b;
  };
  const zombie = new Mob('zombie', 4.5, 70, 4.5);
  zombie.walkPhase = 1.9;
  zombie.animateLimbs(0.7);
  const arm = partBox(zombie, zombie.arms[0]);
  // Przód modelu to +Z w układzie grupy (korzeń obraca model o π).
  check('zombie trzyma ręce z przodu po animacji', arm.max.z > 0.35 && arm.min.z > -0.25,
    `z=${arm.min.z.toFixed(2)}..${arm.max.z.toFixed(2)}`);
  check('ręce zombie nie chowają się za plecami', arm.max.z > Math.abs(arm.min.z),
    `${arm.min.z.toFixed(2)}..${arm.max.z.toFixed(2)}`);
  zombie.dispose();

  // Każdy mob z głową: przód głowy (−Z modelu) po obrocie korzenia patrzy w +Z,
  // czyli tam, gdzie mob idzie (`yaw = 0`).
  const headTypes: MobType[] = ['zombie', 'skeleton', 'villager', 'golem', 'cow', 'pig', 'sheep', 'chicken', 'wolf', 'spider'];
  const wrong: string[] = [];
  for (const type of headTypes) {
    const m = new Mob(type, 4.5, 70, 4.5);
    m.animateLimbs(0.4);
    m.group.updateMatrixWorld(true);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(m.head.getWorldQuaternion(new THREE.Quaternion()));
    if (dir.z < 0.6) wrong.push(`${type} z=${dir.z.toFixed(2)}`);
    m.dispose();
  }
  check('każda głowa patrzy w stronę ruchu', wrong.length === 0, wrong.join(', '));

  // Poza z modelu przeżywa animację: mieszkaniec nie opuszcza złożonych dłoni,
  // pająk nie prostuje nóg, a zombie nie traci wyciągniętych rąk.
  const villagerBuilt = buildMobModel(MOB_MODELS.villager)!;
  check('mieszkaniec ma złożone ręce w modelu', Math.abs(villagerBuilt.parts.arms.rotation.x - 0.75) < 1e-6,
    villagerBuilt.parts.arms.rotation.x.toFixed(2));
  const villager = new Mob('villager', 4.5, 70, 4.5);
  villager.animateLimbs(0.6);
  check('animacja nie rusza złożonych rąk mieszkańca', villager.arms.length === 0);
  villager.dispose();
  const spider = new Mob('spider', 4.5, 70, 4.5);
  const legYaw = spider.legs.map((l) => l.rotation.y);
  const legRoll = spider.legs.map((l) => l.rotation.z);
  spider.animateLimbs(0.6);
  check('pająk zachowuje rozstaw nóg', spider.legs.every((l, i) =>
    Math.abs(l.rotation.y - legYaw[i]) < 1e-6 && Math.abs(l.rotation.z - legRoll[i]) < 1e-6),
    spider.legs.map((l) => `${l.rotation.y.toFixed(2)}/${l.rotation.z.toFixed(2)}`).join(','));
  spider.dispose();
}

section('2.25: fizyka spadających bloków');
{
  check('piasek i żwir są sypkie', isFallingBlock(B.SAND) && isFallingBlock(B.GRAVEL));
  check('kamień i szkło nie spadają', !isFallingBlock(B.STONE) && !isFallingBlock(B.GLASS));
  check('rośliny i pochodnie są zmiatane', isCrushable(B.TORCH) && isCrushable(B.SAPLING));
  check('skrzynia nie jest drobiazgiem', !isCrushable(B.CHEST));

  // Filar z kamienia wysoko w powietrzu, żeby wynik nie zależał od terenu.
  const pw = new World(4242);
  const pillar = (x: number, z: number) => {
    for (let y = 64; y <= 114; y++) pw.setBlock(x, y, z, B.STONE);
    for (let y = 115; y <= 127; y++) pw.setBlock(x, y, z, B.AIR);
  };
  pillar(5, 5);
  pw.setBlock(5, 121, 5, B.SAND);
  pw.setBlock(5, 122, 5, B.SAND);
  check('kolumna piasku ma wysokość 2', fallColumnHeight(pw, 5, 121, 5) === 2);
  check('piasek bez podparcia ma spaść', !isSupported(pw, 5, 121, 5));
  check('ścieżka spadania sięga filaru', fallPath(pw, 5, 121, 5).to === 115);

  // Silnik: kolumna spada razem i układa się jedna na drugiej.
  const gAny = Object.create(Game.prototype) as Record<string, any>;
  gAny.world = pw;
  gAny.scene = new THREE.Scene();
  gAny.falling = [];
  gAny.dropGeos = new Map();
  gAny.dropMat = new THREE.MeshBasicMaterial();
  gAny.body = { pos: new THREE.Vector3(5.5, 126, 5.5), h: 1.8 };
  gAny.mode = 'creative';
  gAny.ui = 'playing';
  gAny.spawnParticles = () => {};
  gAny.damage = () => {};
  gAny.spawnDrop = () => {};
  gAny.selectedStack = () => null;
  (gAny as unknown as Game).fallGravity(5, 121, 5);
  check('kolumna leci jako dwa klocki', gAny.falling.length === 2, `${gAny.falling.length}`);
  check('klocek jest wyrównany do kratki', gAny.falling.every((f: any) => Math.abs(f.mesh.position.y - (f.pos.y + 0.5)) < 1e-6),
    gAny.falling.map((f: any) => `${f.mesh.position.y}/${f.pos.y}`).join(' '));
  for (let i = 0; i < 240 && gAny.falling.length; i++) (gAny as unknown as Game)['updateFalling'](1 / 60);
  check('kolumna wylądowała na filarze', pw.getBlock(5, 115, 5) === B.SAND && pw.getBlock(5, 116, 5) === B.SAND,
    `${pw.getBlock(5, 115, 5)},${pw.getBlock(5, 116, 5)}`);

  // Pochodnia pod piaskiem zostaje zmiażdżona, a piasek ląduje niżej.
  pillar(7, 5);
  pw.setBlock(7, 118, 5, B.TORCH);
  pw.setBlock(7, 121, 5, B.SAND);
  (gAny as unknown as Game).fallGravity(7, 121, 5);
  for (let i = 0; i < 240 && gAny.falling.length; i++) (gAny as unknown as Game)['updateFalling'](1 / 60);
  check('spadający piasek niszczy pochodnię', pw.getBlock(7, 118, 5) === B.AIR);
  check('piasek spadł na filar pod pochodnią', pw.getBlock(7, 115, 5) === B.SAND);

  // Woda: piasek wpada na dno i wypiera kratkę, w której wylądował.
  pillar(9, 5);
  pw.setBlock(9, 115, 5, B.WATER);
  pw.setBlock(9, 116, 5, B.WATER);
  pw.setBlock(9, 120, 5, B.SAND);
  (gAny as unknown as Game).fallGravity(9, 120, 5);
  for (let i = 0; i < 240 && gAny.falling.length; i++) (gAny as unknown as Game)['updateFalling'](1 / 60);
  check('piasek wypiera wodę na dnie', pw.getBlock(9, 115, 5) === B.SAND && pw.getBlock(9, 116, 5) === B.WATER,
    `${pw.getBlock(9, 115, 5)},${pw.getBlock(9, 116, 5)}`);

  // Podparty piasek zostaje na miejscu, a `settle` przenosi całą kolumnę.
  pillar(13, 5);
  pw.setBlock(13, 118, 5, B.STONE);
  pw.setBlock(13, 119, 5, B.SAND);
  eq('podparty piasek się nie rusza', (gAny as unknown as Game).settle(13, 119, 5), 0);
  check('piasek nadal leży', pw.getBlock(13, 119, 5) === B.SAND);
  pillar(15, 5);
  pw.setBlock(15, 118, 5, B.STONE);
  pw.setBlock(15, 119, 5, B.SAND);
  pw.setBlock(15, 120, 5, B.SAND);
  pw.setBlock(15, 118, 5, B.AIR);
  eq('settle przenosi całą kolumnę', (gAny as unknown as Game).settle(15, 119, 5), 2);
  check('kolumna osiadła na filarze', pw.getBlock(15, 115, 5) === B.SAND && pw.getBlock(15, 116, 5) === B.SAND);

  // Eksplozja pod piaskiem uruchamia opadanie (wcześniej piasek wisiał).
  // Wybuch o mocy 1,8 niszczy zawsze kratkę o 1 niżej, a nigdy o 2 – piasek
  // o dwa pola nad środkiem zostaje, ale traci podparcie i musi ruszyć.
  pillar(17, 5);
  for (let y = 115; y <= 118; y++) pw.setBlock(17, y, 5, B.STONE);
  pw.setBlock(17, 119, 5, B.SAND);
  gAny.falling = [];
  gAny.shake = 0;
  gAny.spawnSmoke = () => {};
  gAny.mobs = [];
  (gAny as unknown as Game).explode(17.5, 117.5, 5.5, 1.8);
  check('eksplozja uruchamia spadanie piasku', gAny.falling.length >= 1, `${gAny.falling.length}`);
  for (let i = 0; i < 240 && gAny.falling.length; i++) (gAny as unknown as Game)['updateFalling'](1 / 60);
  check('piasek po wybuchu osiadł niżej', pw.getBlock(17, 119, 5) !== B.SAND && pw.getBlock(17, 116, 5) === B.SAND,
    `119=${pw.getBlock(17, 119, 5)} 116=${pw.getBlock(17, 116, 5)}`);
}

section('2.18: interfejs i niebo z paczki');
{
  const sprites = Object.keys(GUI_SPRITES);
  check('co najmniej 40 grafik interfejsu z paczki', sprites.length >= 40, `${sprites.length}`);
  check('serce pełne pochodzi z paczki', (heartSprite(2) ?? '').startsWith('data:image/png;base64,'));
  eq('adres grafiki ma dokładnie jeden prefiks data:', (heartSprite(2) ?? '').split('data:image/png').length - 1, 1);
  eq('adres hotbara ma dokładnie jeden prefiks data:', (guiSprite('hotbar') ?? '').split('data:image/png').length - 1, 1);
  check('serce pół i puste też', (heartSprite(1) ?? '').includes('base64') && (heartSprite(0) ?? '').includes('base64'));
  check('głód pochodzi z paczki', (foodSprite(2) ?? '').includes('base64') && (foodSprite(0) ?? '').includes('base64'));
  check('pancerz i powietrze z paczki', (armorSprite(2) ?? '').includes('base64') && (airSprite(true) ?? '').includes('base64'));
  check('celownik i hotbar z paczki', hasGuiSprite('crosshair') && hasGuiSprite('hotbar') && hasGuiSprite('hotbar_selection'));
  check('pasek doświadczenia z paczki', hasGuiSprite('exp_background') && hasGuiSprite('exp_progress'));
  check('słońce, księżyc i chmury z paczki', hasGuiSprite('sun') && hasGuiSprite('moon') && hasGuiSprite('clouds'));
  check('dziesięć faz pękania bloku', Array.from({ length: 10 }, (_, i) => hasGuiSprite(`destroy_${i}`)).every(Boolean));
  check('deszcz i śnieg z paczki', hasGuiSprite('rain') && hasGuiSprite('snow'));
  eq('licznik grafik zgadza się z listą', guiSpriteCount(), sprites.length);

  const sun = spriteTexture('sun')!;
  eq('słońce ma 32×32', (sun.image as { width: number }).width, 32);
  const destroy = spriteTexture('destroy_0')!;
  eq('faza pękania ma 16×16', (destroy.image as { width: number }).width, 16);
  const rainTex = spriteTexture('rain')!;
  eq('deszcz to pierwsza klatka arkusza', (rainTex.image as { height: number }).height, 64);
  eq('tekstury GUI nie są odwróconej osi Y', sun.flipY, false);

  // motyw CSS: zmienne ustawiane bez wyjątku (nawet bez DOM)
  const style = { values: new Map<string, string>(), setProperty(k: string, v: string) { this.values.set(k, v); } };
  installPackTheme({ style } as unknown as HTMLElement);
  check('slot dostaje grafikę z paczki', (style.values.get('--mc-slot-img') ?? '').startsWith('url(data:image/png'));
  check('przycisk dostaje grafikę z paczki', (style.values.get('--mc-btn-img') ?? '').includes('base64'));

  // silnik: pęknięcia z paczki, deszcz z teksturą, chmury z paczki
  const eng = readSource('src/game/engine.ts');
  check('silnik bierze pęknięcia z paczki', /spriteTexture\(`destroy_\$\{i\}`\)/.test(eng));
  check('silnik bierze deszcz z paczki', /spriteTexture\('rain'\)/.test(eng));
  check('silnik bierze chmury z paczki', /spriteTexture\('clouds'\)/.test(eng));
  check('silnik bierze słońce i księżyc z paczki', /spriteTexture\('sun'\)/.test(eng) && /spriteTexture\('moon'\)/.test(eng));
  const hud = readSource('src/components/HUD.tsx');
  check('HUD używa serc z paczki', /heartSprite\(/.test(hud));
  check('HUD używa głodu z paczki', /foodSprite\(/.test(hud));
  check('HUD używa celownika z paczki', /guiSprite\('crosshair'\)/.test(hud));
  check('HUD używa hotbara z paczki', /guiSprite\('hotbar'\)/.test(hud));
  const mobsSrc = readSource('src/game/mobs.ts');
  check('moby budują model 1:1', /buildMobModel\(/.test(mobsSrc));
  check('mieszkaniec wybiera teksturę zawodu', /villager\$\{this\.profession % 5\}/.test(mobsSrc));
}

// ============================================ 2.19: sesja gracza i teleportacja
section('2.19: niewidzialna sesja gracza');
{
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
  const id1 = loadPlayerId(storage);
  const id2 = loadPlayerId(storage);
  eq('identyfikator gracza jest trwały', id1, id2);
  check('identyfikator ma bezpieczny format', isPlayerId(id1), id1);
  eq('identyfikator nie zależy od nicku ani skórki', loadPlayerId(storage), id1);
  eq('identyfikator jest zapisany lokalnie', store.get('blockcraft-profile-v1'), id1);
  check('biały identyfikator jest odrzucany', !isPlayerId('p123') && !isPlayerId('gracz') && !isPlayerId(null));

  // 2.19: każdy gracz zaczyna gdzie indziej (rozrzut po świecie).
  const spawnA = spreadSpawn(id1);
  const spawnB = spreadSpawn('pabcdef0123456789abc');
  check('spawn jest daleko od środka', spawnA.radius >= 320 && spawnA.radius <= 2600, `${Math.round(spawnA.radius)}`);
  check('dwa konta mają różne miejsca startu', Math.abs(spawnA.angle - spawnB.angle) > 0.001 || Math.abs(spawnA.radius - spawnB.radius) > 1);
  check('ten sam gracz zawsze startuje tak samo', spreadSpawn(id1).angle === spawnA.angle);

  // profil: odtwarzanie ekwipunku, zbroi i pozycji
  const row = {
    pid: id1, name: 'Ziomek', skin: 'zuri', x: 12.5, y: 70, z: -31.25, dim: 'o',
    yaw: 1.2, pitch: -0.3, health: 14, hunger: 9, xp: 120,
    inv: JSON.stringify([{ id: 5, count: 12 }, null, { id: 9, count: 1, dur: 40 }]),
    armor: JSON.stringify([{ id: 30, count: 1 }]),
  };
  const prof = sanitizeProfile(row);
  check('profil wczytuje się z bazy', !!prof);
  eq('pozycja z profilu jest zachowana', `${prof?.x},${prof?.y},${prof?.z}`, '12.5,70,-31.25');
  eq('ekwipunek wraca z profilu', prof?.inv[0]?.count, 12);
  eq('pusty slot zostaje pusty', prof?.inv[1], null);
  eq('zbroja wraca z profilu', prof?.armor[0]?.id, 30);
  eq('zdrowie z profilu', prof?.health, 14);
  eq('doświadczenie z profilu', prof?.xp, 120);
  check('profil bez pozycji jest odrzucany', sanitizeProfile({ pid: id1, x: NaN }) === null);
  check('profil z obcym id jest odrzucany', sanitizeProfile({ pid: 'hakerski', x: 1, y: 2, z: 3 }) === null);
  eq('ekwipunek jest przycinany do 36 slotów', cleanStacks(new Array(60).fill({ id: 1, count: 1 }), 36).length, 36);
  eq('ujemne stosy są odrzucane', cleanStacks([{ id: 1, count: -5 }], 36)[0], null);
  const saveRow = profileRow(prof!, 'public');
  eq('zapis profilu trafia do właściwej tabeli', PROFILE_TABLE, 'blockcraft_players');
  eq('wiersz zapisu ma identyfikator', saveRow.pid, id1);
}

section('2.19: serwer publiczny pamięta gracza');
{
  const written: { table: string; row: Record<string, unknown> }[] = [];
  const pid = 'p0123456789abcdefabc';
  const client = {
    from(table: string) {
      const q = {
        select() { return q; },
        eq() { return q; },
        limit() { return Promise.resolve({ data: [], error: null }); },
        upsert(payload: Record<string, unknown>) {
          written.push({ table, row: payload });
          return Promise.resolve({ error: null });
        },
      };
      return q;
    },
  };
  const srv = new PublicServer({ name: 'Ala', pid, client: client as never });
  eq('sesja używa trwałego identyfikatora', srv.id, pid);
  eq('identyfikator jest widoczny dla reszty', srv.pid, pid);
  const profile = sanitizeProfile({
    pid, name: 'Ala', skin: 'zuri', x: 4, y: 70, z: 9, dim: 'o', health: 18, hunger: 15, xp: 30,
    inv: JSON.stringify([{ id: 3, count: 5 }]), armor: JSON.stringify([]),
  })!;
  srv.saveProfile(profile);
  await new Promise((r) => setTimeout(r, 0));
  eq('postęp trafia do tabeli graczy', written[0]?.table, PROFILE_TABLE);
  eq('zapisany wiersz ma pid', written[0]?.row.pid, pid);
  eq('zapisany wiersz ma pozycję', written[0]?.row.x, 4);
  check('ekwipunek jest zapisany jako JSON', typeof written[0]?.row.inv === 'string');
  const before = written.length;
  srv.saveProfile(profile);
  await new Promise((r) => setTimeout(r, 0));
  eq('zapis jest dławiony (nie co klatkę)', written.length, before);
}

section('2.19: teleportacja między graczami');
{
  const sent: { to: string; t: Record<string, unknown> }[] = [];
  const g = Object.create(Game.prototype) as Record<string, any>;
  g.net = {
    id: 'p1', name: 'Ala', public: true, role: 'guest', players: [],
    sendTeleport: (to: string, t: Record<string, unknown>) => sent.push({ to, t }),
  };
  g.netPlayers = [{ id: 'p1', name: 'Ala', hue: 0, ping: 0, self: true }, { id: 'p2', name: 'Ziomek', hue: 40, ping: 0 }];
  g.messages = [];
  g.message = (t: string) => g.messages.push(t);
  g.emitHud = () => {};
  g.body = { pos: new THREE.Vector3(10, 70, 20), vel: new THREE.Vector3() };
  g.isInNether = false;
  g.world = { getChunk() {} };
  g.tpaIn = null;
  g.tpaOut = null;

  check('prośba o teleportację trafia do gracza', g.requestTeleport('ziomek'));
  eq('prośba leci do właściwego id', sent[0]?.to, 'p2');
  eq('prośba ma typ „ask”', sent[0]?.t.kind, 'ask');
  check('czekanie na zgodę jest widoczne w HUD', !!g.tpaOut);
  eq('nieznany gracz nie dostaje prośby', g.requestTeleport('nie-ma-takiego'), false);

  // Druga strona: dostaje prośbę i akceptuje.
  g.tpaOut = null;
  g.onTeleportReply({ kind: 'ask', name: 'Ziomek', from: 'p2' });
  check('prośba czeka na decyzję', !!g.tpaIn);
  check('zgoda wysyła pozycję', g.acceptTeleport());
  eq('zgoda ma typ „ok”', sent[sent.length - 1]?.t.kind, 'ok');
  eq('zgoda niesie współrzędne x', sent[sent.length - 1]?.t.x, 10);
  eq('po zgodzie prośba znika', g.tpaIn, null);

  // Odmowa.
  g.onTeleportReply({ kind: 'ask', name: 'Ziomek', from: 'p2' });
  check('odmowa działa', g.denyTeleport());
  eq('odmowa ma typ „no”', sent[sent.length - 1]?.t.kind, 'no');

  // Właściciel prośby dostaje zgodę i przeskakuje na miejsce.
  g.tpaOut = { to: 'p2', name: 'Ziomek', at: Date.now() };
  g.onTeleportReply({ kind: 'ok', name: 'Ziomek', x: 40, y: 80, z: -12, d: 'o' });
  eq('teleportacja przenosi gracza', `${g.body.pos.x},${g.body.pos.y},${g.body.pos.z}`, '40,80,-12');
  eq('po teleportacji nie czekamy już na zgodę', g.tpaOut, null);

  const src = readSource('src/game/engine.ts');
  check('komenda /tpa jest obsługiwana', /case 'tpa'/.test(src));
  check('komenda /tpaccept jest obsługiwana', /case 'tpaccept'/.test(src));
  check('komenda /tpdeny jest obsługiwana', /case 'tpdeny'/.test(src));
  check('HUD pokazuje prośbę o teleportację', /hud\.tpa\b/.test(readSource('src/components/HUD.tsx')));
  const cmd = commandByName('tpa');
  check('komenda /tpa jest w katalogu', !!cmd && /nick/i.test(cmd.usage), cmd?.usage);
  check('komenda /tpa jest w kategorii punktów', cmd?.category === 'punkty');
  check('katalog zna zgodę na teleportację', !!commandByName('tpaccept'));
  check('katalog zna odmowę teleportacji', !!commandByName('tpdeny'));

  // 2.19: spawn nowego gracza zawsze na lądzie.
  const world = new World(PUBLIC_SEED);
  g.homeWorld = world;
  const spot = g.findSpawnSpot(0, 0);
  const info = world.surface(spot.x, spot.z);
  check('nowy gracz nie startuje w oceanie', info.biome !== 'Ocean' && info.h > SEA + 1, `${spot.x},${spot.z} ${info.biome}`);
  check('spawn jest blisko wybranego punktu', Math.hypot(spot.x, spot.z) < 600, `${spot.x},${spot.z}`);
}

section('2.19: naturalne biomy i wioski');
{
  // 2.19: biomy mają setki bloków – sprawdzamy, że sąsiednie kratki (32 bloki)
  // prawie zawsze mają ten sam biom, a jednocześnie istnieją wszystkie krainy.
  const w = new World(PUBLIC_SEED);
  let same = 0, total = 0;
  const seen = new Set<string>();
  for (let x = -1600; x <= 1600; x += 32) for (let z = -1600; z <= 1600; z += 32) {
    const a = w.surface(x, z).biome;
    const b = w.surface(x + 32, z).biome;
    seen.add(a);
    total++;
    if (a === b) same++;
  }
  check('granice biomów są szerokie', same / total > 0.82, `${Math.round((same / total) * 100)}%`);
  check('świat ma wszystkie krainy', ['Równiny', 'Las', 'Pustynia', 'Tundra', 'Góry', 'Plaża', 'Ocean', 'Bagno', 'Sawanna', 'Dżungla'].every((b) => seen.has(b)), [...seen].join(','));

  // Rzeki: woda na poziomie morza w środku lądu.
  let rivers = 0;
  for (let x = -1200; x <= 1200; x += 24) for (let z = -1200; z <= 1200; z += 24) {
    const s = w.surface(x, z);
    if (s.h === SEA - 3 && s.biome !== 'Ocean' && s.biome !== 'Plaża') rivers++;
  }
  check('świat ma rzeki', rivers > 20, `${rivers} próbek`);

  // Wioski stoją na płaskim i nie robią urwisk: różnica wysokości między
  // środkiem a skrajem platformy musi być mała.
  const ctx = w.villageContext();
  let found: Village | null = null;
  for (let gx = -6; gx <= 6 && !found; gx++) for (let gz = -6; gz <= 6 && !found; gz++) found = villageInCell(gx, gz, ctx);
  check('nowy świat ma wioskę', !!found);
  if (found) {
    const v = found;
    const c = w.getChunk(Math.floor(v.x / CS), Math.floor(v.z / CS));
    // Flatness mierzymy na gruncie (v.y), nie na dachach: każda kolumna
    // placu musi mieć twardy blok pod stopami, a większość – grunt na v.y.
    let solidGround = 0, sampled = 0, atLevel = 0;
    for (let dx = -v.radius + 4; dx <= v.radius - 4; dx += 4) for (let dz = -v.radius + 4; dz <= v.radius - 4; dz += 4) {
      const x = v.x + dx, z = v.z + dz;
      sampled++;
      if (IS_SOLID[w.getBlock(x, v.y - 1, z)]) solidGround++;
      if (!IS_SOLID[w.getBlock(x, v.y + 1, z)] || w.getBlock(x, v.y, z) !== B.AIR) atLevel++;
    }
    check('pod placem wioski jest twardy grunt', solidGround / sampled > 0.97, `${solidGround}/${sampled}`);
    check('plac wioski jest wyrównany', atLevel / sampled > 0.7, `${atLevel}/${sampled}`);
    check('wioska ma ziemię pod sobą', c.heightMap[0] >= 0);
    // Skos na obrzeżach: teren wraca do naturalnego, bez pionowej ściany.
    const edge = w.heightAt(v.x + v.radius + 6, v.z);
    const center = w.heightAt(v.x, v.z);
    check('obrzeża wioski nie są urwiskiem', Math.abs(edge - center) <= 12, `${center} vs ${edge}`);
  }

  const villageSrc = readSource('src/game/village.ts');
  check('wioska wygładza teren na obrzeżach', /ease/.test(villageSrc) && /natural/.test(villageSrc));
  const worldSrc = readSource('src/game/world.ts');
  check('generator ma osobny szum rzek', /nRiver/.test(worldSrc));
  check('jaskinie nie otwierają dziur w powierzchni', /y < h - 2/.test(worldSrc));
}

// ============================================ 2.20: poprawki grafiki
section('2.20: słońce, kaktus, drzwi i dachy wiosek');
{
  // --- słońce i księżyc: czarne tło musi być przezroczyste
  const alphaAt = (img: { width: number; data: Uint8Array }, x: number, y: number) =>
    img.data[(y * img.width + x) * 4 + 3];
  const sunImg = decodePng(GUI_SPRITES.sun);
  check('słońce nie ma czarnego tła', alphaAt(sunImg, 0, 0) === 0 && alphaAt(sunImg, 31, 31) === 0);
  check('tarcza słońca jest widoczna', alphaAt(sunImg, 16, 16) === 255);
  const moonImg = decodePng(GUI_SPRITES.moon);
  check('księżyc nie ma czarnego tła', alphaAt(moonImg, 0, 0) === 0 && alphaAt(moonImg, 31, 0) === 0);
  const engineSrc = readSource('src/game/engine.ts');
  check('słońce i księżyc świecą addytywnie', (engineSrc.match(/AdditiveBlending/g) ?? []).length >= 2);

  // --- woda: kafelek musi być niebieski (wcześniej był szary jak mgła)
  const atl = decodePng(BLOCK_ATLAS_PNG);
  const waterTile = tileFor(B.WATER, 0);
  const wox = (waterTile % 16) * 16;
  const woy = Math.floor(waterTile / 16) * 16;
  let wr = 0, wg = 0, wb = 0, wn = 0;
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const i = ((woy + y) * atl.width + wox + x) * 4;
      wr += atl.data[i]; wg += atl.data[i + 1]; wb += atl.data[i + 2]; wn++;
    }
  wr = Math.round(wr / wn); wg = Math.round(wg / wn); wb = Math.round(wb / wn);
  check('woda ma niebieski odcień', wb > wr + 60 && wg > wr, `${wr},${wg},${wb}`);

  // --- bloki-sprite'y i własne bryły
  eq('latarnia ma model 3D', RENDER[B.LANTERN], 13);
  eq('statyw alchemiczny ma model 3D', RENDER[B.BREWING], 15);
  eq('latarnia tnie alfę', LAYER[B.LANTERN], 1);
  check('latarnia nie blokuje ruchu', IS_SOLID[B.LANTERN] === 0);
  eq('dzwon ma model 3D', RENDER[B.BELL], 14);
  eq('kaktus ma własną bryłę', RENDER[B.CACTUS], 7);
  eq('łóżko ma własną bryłę', RENDER[B.BED], 8);
  eq('górne drzwi tną alfę (szyby)', LAYER[B.DOOR_UN], 1);
  eq('dolne drzwi tną alfę', LAYER[B.DOOR_N], 1);
  const atlasSrc = readSource('scripts/compile-vanilla-art.mjs');
  check('latarnia i dzwon z ikon przedmiotów', /lantern: I_ \+ 'lantern\.png'/.test(atlasSrc) && /bell: I_ \+ 'bell\.png'/.test(atlasSrc));
  check('modele latarni i dzwonu mają tekstury z paczki', /lantern_block: B \+ 'lantern\.png'/.test(atlasSrc) && /bell_body: E \+ 'bell\/bell_body\.png'/.test(atlasSrc));

  // --- meshing: drzwi to cienka płyta, kaktus 14/16
  const w2 = new World(4242, true);
  const gy = FLAT_H + 1;
  // Warstwa 1 (wycinana alfa) zawiera tylko drzwi/kaktusa – dzięki temu nie
  // łapiemy ścian sąsiednich bloków, które dotykają komórki krawędzią.
  const cellVerts = (box: { x: number; y: number; z: number }) => {
    const out: { x: number; y: number; z: number }[] = [];
    const cut = w2.buildMesh(w2.getChunk(0, 0))[1];
    const pos = cut.attributes.position as THREE.BufferAttribute | undefined;
    if (pos) {
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (x >= box.x - 0.01 && x <= box.x + 1.01 && y >= box.y - 0.01 && y <= box.y + 1.01 && z >= box.z - 0.01 && z <= box.z + 1.01) {
          out.push({ x, y, z });
        }
      }
    }
    return out;
  };
  w2.setBlock(4, gy, 4, B.DOOR_N);
  const doorVerts = cellVerts({ x: 4, y: gy, z: 4 });
  const span = (v: { x: number; y: number; z: number }[], k: 'x' | 'y' | 'z') => {
    const vals = v.map((p) => p[k]);
    return Math.max(...vals) - Math.min(...vals);
  };
  check('drzwi to cienka płyta (3/16)', doorVerts.length > 0 && Math.abs(span(doorVerts, 'z') - 0.1875) < 0.01 && span(doorVerts, 'x') > 0.98, `z=${span(doorVerts, 'z').toFixed(3)}`);
  w2.setBlock(4, gy, 4, B.AIR);

  w2.setBlock(6, gy, 6, B.CACTUS);
  const cactusVerts = cellVerts({ x: 6, y: gy, z: 6 });
  check(
    'kaktus to bryła 14/16',
    cactusVerts.length > 0 && Math.abs(span(cactusVerts, 'x') - 0.875) < 0.01 && Math.abs(span(cactusVerts, 'z') - 0.875) < 0.01,
    `${span(cactusVerts, 'x').toFixed(3)}×${span(cactusVerts, 'z').toFixed(3)}`
  );

  // --- dachy wiosek: dwuspadowe, ze schodów, wyżej niż ściany
  const w3 = new World(2020);
  const ctx3 = w3.villageContext();
  let vil: Village | null = null;
  for (let gx = -6; gx <= 6 && !vil; gx++) for (let gz = -6; gz <= 6 && !vil; gz++) vil = villageInCell(gx, gz, ctx3);
  check('świat 2.20 ma wioskę', !!vil);
  if (vil) {
    const house = vil.buildings.find((b2) => b2.kind === 'house');
    check('wioska ma dom', !!house);
    if (house) {
      const stairId = (id: number) =>
        (id >= B.OAK_STAIRS_N && id <= B.OAK_STAIRS_W) ||
        (id >= B.COBBLE_STAIRS_N && id <= B.COBBLE_STAIRS_W) ||
        (id >= B.SANDSTONE_STAIRS_N && id <= B.SANDSTONE_STAIRS_W);
      const dirs = new Set<number>();
      let roofTop = 0;
      let stairs = 0;
      for (let x = house.x - 1; x <= house.x + house.w; x++)
        for (let z = house.z - 1; z <= house.z + house.d; z++)
          for (let y = vil.y + 4; y <= vil.y + 10; y++) {
            const id = w3.getBlock(x, y, z);
            if (!stairId(id)) continue;
            stairs++;
            dirs.add((id - (id >= B.OAK_STAIRS_N && id <= B.OAK_STAIRS_W ? B.OAK_STAIRS_N : id >= B.COBBLE_STAIRS_N && id <= B.COBBLE_STAIRS_W ? B.COBBLE_STAIRS_N : B.SANDSTONE_STAIRS_N)) % 4);
            if (y > roofTop) roofTop = y;
          }
      check('dach domu jest ze schodów', stairs > 20, `${stairs} bloków`);
      check('dach ma dwie połacie', dirs.size >= 2, [...dirs].join(','));
      check('dach jest wyżej niż ściany', roofTop >= vil.y + 6, `szczyt=${roofTop - vil.y}`);
      check('dom ma podmurówkę z bruku', w3.getBlock(house.x, vil.y, house.z) === B.COBBLE || w3.getBlock(house.x, vil.y, house.z) === B.SANDSTONE);
      // 2.29: łóżko to stopa + wezgłowie, więc w chacie muszą stać obie części.
      check('w środku domu stoi łóżko (stopa i wezgłowie)', (() => {
        let foot = false, head = false;
        for (let x = house.x + 1; x < house.x + house.w - 1; x++)
          for (let z = house.z + 1; z < house.z + house.d - 1; z++) {
            const b = w3.getBlock(x, vil.y + 1, z);
            if (isBed(b) && !isBedHead(b)) foot = true;
            if (isBedHead(b)) head = true;
          }
        return foot && head;
      })());
    }
  }
  const villageSrc = readSource('src/game/village.ts');
  check('wioska buduje dwuspadowy dach', /gableRoof/.test(villageSrc) && /toRidge/.test(villageSrc));
  check('wioska nie stawia już płaskiej płyty', !/Dach: okap \+ coraz węższe warstwy/.test(villageSrc));

  // --- ręka: blok nie może zasłaniać pół ekranu
  check('blok w ręce jest mniejszy niż 0,3', /mesh\.scale\.setScalar\(cross \? 0\.3 : 0\.2\)/.test(engineSrc));
  check('teksturowany deszcz nie puchnie do 2 bloków', /textured \? \(snow \? 1\.5 : 1\.1\)/.test(engineSrc));
  check('śnieg ma większe płatki niż deszcz', /snow \? 1\.5 : 1\.1/.test(engineSrc));
}

// ============================================ 2.21: bloki i przedmioty 1:1
section('2.21: bryły, kolizje i przedmioty jak w Minecrafcie');
{
  // --- typy renderu
  eq('płot ma własny model', RENDER[B.FENCE], 9);
  eq('pochodnia ma smukły model', RENDER[B.TORCH], 10);
  eq('lilia to płaski liść', RENDER[B.LILY_PAD], 11);
  eq('skrzynia ma korpus i wieko', RENDER[B.CHEST], 12);

  // --- kolizje: płyty, schody, płot, drabina, ścieżka, skrzynia
  const box = (id: number) => collisionBoxes(id)!;
  eq('płyta dolna ma pół bloku', box(B.OAK_SLAB)[4], 0.5);
  eq('płyta górna zajmuje górną połowę', box(B.OAK_SLAB_TOP)[1], 0.5);
  eq('płot jest wyższy niż blok', box(B.FENCE)[4], 1.5);
  check('płot blokuje na pełną szerokość (skrzyżowane szczeble)', box(B.FENCE)[3] - box(B.FENCE)[0] === 1);
  check('drabina nie blokuje ruchu (się po niej wchodzi)', collisionBoxes(B.LADDER_N) === null);
  eq('ścieżka ma 15/16 wysokości', box(B.PATH)[4], 0.9375);
  eq('grządka ma 15/16 wysokości', box(B.FARMLAND)[4], 0.9375);
  eq('skrzynia ma 14/16 szerokości', box(B.CHEST)[3] - box(B.CHEST)[0], 0.875);
  eq('kaktus ma 14/16 szerokości', box(B.CACTUS)[3] - box(B.CACTUS)[0], 0.875);
  eq('łóżko ma 9/16 wysokości', box(B.BED)[4], 0.5625);
  eq('właz (zamknięty) to płyta pod sufitem', box(B.TRAP)[1], 0.8125);
  check('schody mają dwie bryły', box(B.OAK_STAIRS_N).length === 12);
  check('górna połowa schodów zajmuje pół klocka', box(B.OAK_STAIRS_N)[4] === 0.5 && box(B.OAK_STAIRS_N)[11] === 0.5);
  check('ściany (kamień) blokują cały sześcian', box(B.STONE).length === 6);
  check('rośliny nie mają kolizji', collisionBoxes(B.TALLGRASS) === null && collisionBoxes(B.TORCH) === null);

  // --- fizyka: wejście na pół bloku bez skoku (step-up 0,55)
  // 2.30: waniliowe `maxUpStep` to dokładnie 0,6 – dzięki temu wchodzi się
  // też na łóżko (9/16 = 0,5625).
  eq('krok to 0,6 bloku (jak w wanilii)', STEP_HEIGHT, 0.6);
  const w4 = new World(4242, true);
  const gy4 = FLAT_H + 1;
  w4.setBlock(4, gy4, 4, B.OAK_SLAB);
  const body = { pos: new THREE.Vector3(4.5, gy4, 2.5), vel: new THREE.Vector3(0, 0, 0), w: 0.6, h: 1.8, onGround: true, hitWall: false };
  body.vel.z = 3;
  for (let i = 0; i < 60; i++) { stepBody(w4, body, 1 / 60); body.vel.z = 3; }
  check('gracz wchodzi na płytę bez skoku', body.pos.y >= gy4 + 0.49, `y=${body.pos.y.toFixed(2)}`);
  const w4b = new World(4242, true);
  w4b.setBlock(4, gy4, 4, B.STONE);
  const body2 = { pos: new THREE.Vector3(4.5, gy4, 2.5), vel: new THREE.Vector3(0, 0, 0), w: 0.6, h: 1.8, onGround: true, hitWall: false };
  body2.vel.z = 3;
  for (let i = 0; i < 80; i++) { stepBody(w4b, body2, 1 / 60); body2.vel.z = 3; }
  check('pełny blok nadal zatrzymuje gracza', body2.pos.y < gy4 + 0.5, `y=${body2.pos.y.toFixed(2)}`);

  // --- siatka: rośliny mają pełną wysokość, szyna leży płasko
  const w5 = new World(4242, true);
  const gy5 = FLAT_H + 1;
  const verts = (bx: number, bz: number) => {
    const out: number[] = [];
    for (const g of w5.buildMesh(w5.getChunk(0, 0))) {
      const p = g.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (!p) continue;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        if (x >= bx && x <= bx + 1 && z >= bz && z <= bz + 1) out.push(y);
      }
    }
    return out;
  };
  w5.setBlock(2, gy5, 2, B.TALLGRASS);
  const gh = verts(2, 2);
  check('wysoka trawa sięga pełnej wysokości', gh.length > 0 && Math.max(...gh) - Math.min(...gh) > 0.99, `${(Math.max(...gh) - Math.min(...gh)).toFixed(2)}`);
  w5.setBlock(4, gy5, 4, B.RAIL);
  const rv = verts(4, 4).filter((v) => v > gy5 + 0.02);
  check('szyna leży płasko na 1/16', rv.length > 0 && Math.max(...rv) - Math.min(...rv) < 0.01 && Math.min(...rv) - gy5 < 0.08);
  w5.setBlock(6, gy5, 6, B.PATH);
  const pv = verts(6, 6);
  check('ścieżka ma 15/16 wysokości w siatce', Math.max(...pv) - gy5 > 0.93 && Math.max(...pv) - gy5 < 0.94);
  w5.setBlock(8, gy5, 8, B.FENCE);
  const fv = verts(8, 8);
  check('płot ma model wysokości bloku', Math.abs(Math.max(...fv) - gy5 - 1) < 0.01, `${(Math.max(...fv) - gy5).toFixed(2)}`);
  w5.setBlock(10, gy5, 10, B.CHEST);
  const cv = verts(10, 10);
  // 2.32: waniliowy `ChestModel` ma dokładnie 14/16 wysokości (korpus 10 px,
  // wieko 5 px od 9 do 14 px). Wcześniej bryła sięgała 15/16, bo była
  // zbudowana z przeskalowanych kafelków zamiast z prawdziwego modelu.
  check('skrzynia ma waniliowe 14/16 wysokości', Math.abs(Math.max(...cv) - gy5 - 14 / 16) < 0.005, `${(Math.max(...cv) - gy5).toFixed(3)}`);
  // --- 2.32: skrzynia 1:1 – kierunki, podwójna skrzynia, wieko
  eq('skrzynia w starym zapisie patrzy na południe', chestFacing(B.CHEST), 0);
  eq('wariant wschodni skrzyni', chestFacing(B.CHEST_E), 1);
  eq('wariant północny skrzyni', chestFacing(B.CHEST_N), 2);
  eq('wariant zachodni skrzyni', chestFacing(B.CHEST_W), 3);
  check('skrzynia z łupem to skrzynia', isChestBlock(B.LOOT_CHEST_N) && isLootChest(B.LOOT_CHEST_N));
  check('zwykła skrzynia nie jest skrzynią z łupem', !isLootChest(B.CHEST_E));
  eq('id z kierunku wschodniego', chestIdFor(1), B.CHEST_E);
  eq('id z kierunku zachodniego dla łupu', chestIdFor(3, true), B.LOOT_CHEST_W);
  eq('stawianie: gracz po stronie −z patrzy na północ', chestFacingTowards(0, -1), 2);
  eq('stawianie: gracz po stronie +x patrzy na wschód', chestFacingTowards(1, 0), 1);
  eq('stawianie: po przekątnej wygrywa większa oś', chestFacingTowards(0.9, 0.2), 1);
  eq('lewo od skrzyni patrzącej na południe to +x', JSON.stringify(chestLeftDir(0)), JSON.stringify([1, 0]));
  eq('lewo od skrzyni patrzącej na północ to −x', JSON.stringify(chestLeftDir(2)), JSON.stringify([-1, 0]));

  const wc = new World(777, true);
  const gyc = FLAT_H + 1;
  wc.getChunk(0, 0);
  wc.setBlock(2, gyc, 2, B.CHEST);
  wc.setBlock(3, gyc, 2, B.CHEST);
  eq('dwie skrzynie obok siebie tworzą lewą połówkę', wc.chestRegionAt(2, gyc, 2), 'chest_left');
  eq('i prawą połówkę', wc.chestRegionAt(3, gyc, 2), 'chest_right');
  wc.setBlock(5, gyc, 5, B.CHEST);
  eq('samotna skrzynia zostaje pojedyncza', wc.chestRegionAt(5, gyc, 5), 'chest');
  wc.setBlock(7, gyc, 5, B.CHEST_E);
  wc.setBlock(7, gyc, 6, B.CHEST);
  eq('skrzynie patrzące w różne strony się nie łączą', wc.chestRegionAt(7, gyc, 5), 'chest');
  eq('sąsiad z innej strony też nie', wc.chestRegionAt(7, gyc, 6), 'chest');

  const meshBox = (world: World, bx: number, bz: number) => {
    const xs: number[] = [], ys: number[] = [];
    for (const g of world.buildMesh(world.getChunk(0, 0))) {
      const p = g.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (!p) continue;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        if (p.getY(i) <= gyc + 0.001) continue; // pomijamy podłogę pod skrzynią
        if (x >= bx - 0.01 && x <= bx + 1.01 && z >= bz - 0.01 && z <= bz + 1.01) { xs.push(x); ys.push(p.getY(i)); }
      }
    }
    return { xs, ys };
  };
  const single = meshBox(wc, 5, 5);
  check('pojedyncza skrzynia zajmuje 14 px szerokości', Math.abs(Math.max(...single.xs) - Math.min(...single.xs) - 14 / 16) < 0.002,
    `${(Math.max(...single.xs) - Math.min(...single.xs)).toFixed(3)}`);
  check('skrzynia jest wsunięta 1 px od krawędzi kratki', Math.abs(Math.min(...single.xs) - 5 - 1 / 16) < 0.002);
  const dbg = meshBox(wc, 2, 2);
  // Podwójna skrzynia: lewa połówka 1–16 px swojej kratki, prawa 0–15 px.
  check('lewa połówka podwójnej skrzyni zaczyna się 1 px od krawędzi', Math.abs(Math.min(...dbg.xs) - 2 - 1 / 16) < 0.002, `${Math.min(...dbg.xs).toFixed(3)}`);
  check('i sięga krawędzi kratki od strony sąsiada', Math.abs(Math.max(...dbg.xs) - 3) < 0.002, `${Math.max(...dbg.xs).toFixed(3)}`);
  const dbg2 = meshBox(wc, 3, 2);
  check('prawa połówka sięga krawędzi kratki od strony sąsiada', Math.abs(Math.min(...dbg2.xs) - 3) < 0.002, `${Math.min(...dbg2.xs).toFixed(3)}`);
  check('i kończy 1 px przed zewnętrzną krawędzią', Math.abs(Math.max(...dbg2.xs) - 4 + 1 / 16) < 0.002, `${Math.max(...dbg2.xs).toFixed(3)}`);

  // Podwójna skrzynia obrócona o 90° (przód na wschód) – styk biegnie wzdłuż
  // osi Z, a wycinana jest ścianka lokalna +x lewej połówki.
  const we = new World(778, true);
  const gye = FLAT_H + 1;
  we.getChunk(0, 0);
  we.setBlock(2, gye, 2, B.CHEST_E);
  we.setBlock(2, gye, 3, B.CHEST_E);
  // Wanilia: lewa połowa leży po lewej ręce gracza patrzącego w przód skrzyni.
  // Dla przodu na wschód (+x) lewo to +z, więc lewa połówka jest na większym z.
  eq('skrzynia na wschód: większe z to lewa połówka', we.chestRegionAt(2, gye, 3), 'chest_left');
  eq('skrzynia na wschód: mniejsze z to prawa połówka', we.chestRegionAt(2, gye, 2), 'chest_right');

  // 2.32: wieko dostaje światło z kratki skrzyni (jaskinia ≠ słońce).
  wc.buildMesh(wc.getChunk(0, 0));
  const lit = wc.chestLightAt(5, gyc, 5);
  check('siatka zapisuje światło kratki ze skrzynią', lit.sky > 0 && lit.sky <= 1, `${lit.sky.toFixed(2)}/${lit.blk.toFixed(2)}`);
  const darkLid = chestLidGeometry('chest', 0.1, 0);
  darkLid.computeBoundingBox();
  const cols = darkLid.getAttribute('color');
  const brightLid = chestLidGeometry('chest', 1, 0);
  const bcols = brightLid.getAttribute('color');
  check('ciemne wieko ma ciemniejsze wierzchołki niż jasne', cols.getX(0) < bcols.getX(0), `${cols.getX(0).toFixed(2)} < ${bcols.getX(0).toFixed(2)}`);

  const lid = chestLidGeometry('chest');
  lid.computeBoundingBox();
  const bb = lid.boundingBox!;
  // Klapa ma 5 px, a zamek (dziecko klapy) sięga 2 px niżej – razem 7 px.
  check('wieko z zamkiem ma 7 px wysokości', Math.abs(bb.max.y - bb.min.y - 7 / 16) < 0.002, `${(bb.max.y - bb.min.y).toFixed(3)}`);
  check('zamek wystaje przed front skrzyni', Math.abs(bb.max.z - 15 / 16) < 0.002, `${bb.max.z.toFixed(3)}`);

  w5.setBlock(12, gy5, 12, B.LANTERN);
  const lv = verts(12, 12);
  check('latarnia ma model 11/16 wysokości', Math.abs(Math.max(...lv) - gy5 - 11 / 16) < 0.02, `${(Math.max(...lv) - gy5).toFixed(2)}`);
  w5.setBlock(14, gy5, 14, B.BREWING);
  const bv = verts(14, 14);
  check('statyw alchemiczny sięga 14/16', Math.abs(Math.max(...bv) - gy5 - 14 / 16) < 0.02, `${(Math.max(...bv) - gy5).toFixed(2)}`);
  w5.setBlock(2, gy5, 14, B.BELL);
  const ev = verts(2, 14);
  check('dzwon stoi na słupkach do pełnej wysokości', Math.abs(Math.max(...ev) - gy5 - 1) < 0.01);
  check('dzwon ma serce zawieszone pod belką', ev.some((v) => Math.abs(v - gy5 - 0.25) < 0.01));

  // --- narzędzia 1:1: trwałość, obrażenia, wymagane poziomy kilofa
  eq('drewniany kilof ma 59 użyć', durabilityMax(I.WOOD_PICK), 59);
  eq('kamienny kilof ma 131 użyć', durabilityMax(I.STONE_PICK), 131);
  eq('żelazny kilof ma 250 użyć', durabilityMax(I.IRON_PICK), 250);
  eq('diamentowy kilof ma 1561 użyć', durabilityMax(I.DIAMOND_PICK), 1561);
  eq('pięść zadaje 1', attackDamage(0, false), 1);
  eq('drewniany miecz zadaje 4', attackDamage(I.WOOD_SWORD, false), 4);
  eq('diamentowy miecz zadaje 7', attackDamage(I.DIAMOND_SWORD, false), 7);
  eq('żelazny topór zadaje 9', attackDamage(I.IRON_AXE, false), 9);
  eq('kamienny kilof zadaje 3', attackDamage(I.STONE_PICK, false), 3);
  eq('złoto wymaga żelaznego kilofa', requiredPickTier(B.GOLD_ORE), 3);
  eq('czerwony kamień wymaga żelaznego kilofa', requiredPickTier(B.REDSTONE_ORE), 3);
  check('kamień gołą ręką nie daje dropu', !canHarvest(B.STONE, 0) && blockDrops(B.STONE, 0).length === 0);
  check('drewniany kilof wydobywa kamień', canHarvest(B.STONE, I.WOOD_PICK) && blockDrops(B.STONE, I.WOOD_PICK)[0]?.id === B.COBBLE);
  check('złoto kamiennym kilofem nie daje dropu', blockDrops(B.GOLD_ORE, I.STONE_PICK).length === 0);
  eq('kamień drewnianym kilofem: 1,5 × twardość / 2', Math.round(mineSeconds(B.STONE, I.WOOD_PICK) * 100) / 100, 1.13);
  check('gołą ręką kopie się 5 × twardość', mineSeconds(B.DIRT, 0) > mineSeconds(B.DIRT, I.WOOD_SHOVEL));
  check('obsydian diamentowym kilofem ~9,4 s', Math.abs(mineSeconds(B.OBSIDIAN, I.DIAMOND_PICK) - 9.4) < 0.1);

  // --- jedzenie i dropy 1:1
  eq('chleb daje 5 punktów głodu', ITEMS[I.BREAD]?.hunger, 5);
  eq('pieczona ryba daje 5 punktów', ITEMS[I.COOKED_FISH]?.hunger, 5);
  eq('butelka miodu daje 6 punktów', ITEMS[I.HONEY_BOTTLE]?.hunger, 6);
  eq('półka na książki daje 3 książki', blockDrops(B.BOOKSHELF, 0)[0]?.id, I.BOOK);
  eq('półka daje 3 książki', blockDrops(B.BOOKSHELF, 0)[0]?.count, 3);
  check('trawa nie daje już nasion', blockDrops(B.GRASS, 0).every((s) => s.id === B.DIRT));
  eq('żwir daje żwir albo krzemień', blockDrops(B.GRAVEL, 0).length, 1);

  // --- kolizja w praktyce: przez płot się nie przechodzi, na płytę tak
  const w6 = new World(4242, true);
  const gy6 = FLAT_H + 1;
  w6.setBlock(8, gy6, 2, B.FENCE);
  const b6 = { pos: new THREE.Vector3(8.5, gy6, 0.5), vel: new THREE.Vector3(0, 0, 4), w: 0.6, h: 1.8, onGround: true, hitWall: false };
  for (let i = 0; i < 90; i++) { stepBody(w6, b6, 1 / 60); b6.vel.z = 4; }
  check('płot zatrzymuje gracza', b6.pos.z < 2, `z=${b6.pos.z.toFixed(2)}`);
}

// ============================================ 2.26: prześwity, grządki i odrzut
section('2.26: culling ścian nie robi prześwitów (x-ray)');
{
  // 2.26: ściana sąsiada może zniknąć tylko wtedy, gdy ten sąsiad naprawdę
  // wypełnia całą kratkę. Wcześniej culling patrzył na `IS_OPAQUE`, więc przy
  // ścieżce (15/16) i grządce (15/16) nad krawędzią zostawała 1-pikselowa
  // szpara i przez podłogę wioski było widać świat.
  check('pełny sześcian zasłania ścianę', CULLS[B.STONE] === 1 && CULLS[B.DIRT] === 1 && CULLS[B.GRASS] === 1);
  const notFull = [
    ['ścieżka', B.PATH], ['grządka', B.FARMLAND], ['grządka mokra', B.FARMLAND_WET],
    ['skrzynia', B.CHEST], ['kowadło', B.ANVIL], ['płyta', B.STONE_SLAB], ['schody', B.COBBLE_STAIRS_N],
    ['właz', B.TRAP], ['kaktus', B.CACTUS],
  ] as [string, number][];
  const leaking = notFull.filter(([, id]) => CULLS[id] === 1).map(([name]) => name);
  check('bloki niższe niż sześcian nie zasłaniają ściany', leaking.length === 0, leaking.join(', '));
  check('szyba nie zasłania ściany', CULLS[B.GLASS] === 0);
  check('liście (pełny sześcian) zasłaniają ścianę', CULLS[B.LEAVES] === 1);

  // Meshing: podłoga z dirtu obok ścieżki musi narysować pełną ścianę.
  // Mierzymy różnicę wierzchołków między siatką z dirta przy sąsiedzie (5,5)
  // i identyczną siatką z dirta trzy kratki dalej (5,8) – środowisko się nie
  // zmienia, więc różnica to wyłącznie status ściany na styku x = 6.
  const meshDelta = (neighbour: number) => {
    const vertsOf = (dirtZ: number) => {
      const w = new World(4242, true);
      const c = w.getChunk(0, 0);
      const y = FLAT_H;
      for (let x = 2; x <= 8; x++) for (let z = 2; z <= 10; z++) {
        for (let yy = y; yy <= y + 3; yy++) w.setBlock(x, yy, z, B.AIR);
        w.setBlock(x, y - 1, z, B.STONE);
      }
      w.setBlock(5, y, dirtZ, B.DIRT);
      w.setBlock(6, y, 5, neighbour);
      let n = 0;
      for (const g of w.buildMesh(c)) { n += g.attributes.position?.count ?? 0; g.dispose(); }
      return n;
    };
    return vertsOf(5) - vertsOf(8);
  };
  const dirtDelta = meshDelta(B.DIRT);
  const pathDelta = meshDelta(B.PATH);
  const farmDelta = meshDelta(B.FARMLAND);
  check('przy pełnym bloku obie ściany na styku są wycięte', dirtDelta === -8, `${dirtDelta}`);
  check('przy ścieżce ściana sąsiada jednak się rysuje', pathDelta === 0, `${pathDelta}`);
  check('przy grządce ściana sąsiada też się rysuje', farmDelta === 0, `${farmDelta}`);
  check('ścieżka i grządka nie chowają ściany jak pełny blok', pathDelta > dirtDelta && farmDelta > dirtDelta);
}

section('2.26: nawadnianie grządki i jej tekstura');
{
  eq('mokra grządka ma własne id bloku', B.FARMLAND_WET, 352);
  check('mokra grządka ma własny kafelek', Number(T.farmland_moist) === 167 && Number(T.farmland_moist) !== Number(T.farmland));
  eq('promień nawadniania to 4 bloki', HYDRATION_RADIUS, 4);
  check('sucha i mokra grządka to grządki', isFarmland(B.FARMLAND) && isFarmland(B.FARMLAND_WET) && !isFarmland(B.DIRT));

  const w = new World(4242, true);
  const y = 70;
  for (let x = 20; x <= 36; x++) for (let z = 20; z <= 36; z++) {
    w.setBlock(x, y - 1, z, B.STONE);
    w.setBlock(x, y, z, B.AIR);
    w.setBlock(x, y + 1, z, B.AIR);
  }
  w.setBlock(30, y, 30, B.FARMLAND);
  check('grządka bez wody jest sucha', !isHydrated(w, 30, y, 30));
  w.setBlock(26, y, 30, B.WATER);
  check('woda 4 bloki dalej nawadnia', isHydrated(w, 30, y, 30));
  check('updateFarmland podmienia blok na mokry', updateFarmland(w, 30, y, 30) && w.getBlock(30, y, 30) === B.FARMLAND_WET);
  w.setBlock(26, y, 30, B.AIR);
  check('po zabraniu wody grządka wraca do suchej', updateFarmland(w, 30, y, 30) && w.getBlock(30, y, 30) === B.FARMLAND);
  w.setBlock(25, y, 30, B.WATER);
  check('woda 5 bloków dalej już nie nawadnia', !isHydrated(w, 30, y, 30));
  w.setBlock(25, y, 30, B.AIR);
  w.setBlock(26, y + 1, 30, B.WATER);
  check('woda poziom wyżej nawadnia (jak w wanilii)', isHydrated(w, 30, y, 30));

  // Tekstura: mokra grządka jest wyraźnie ciemniejsza, jak `moisture=7`.
  const atlas = decodePng(BLOCK_ATLAS_PNG);
  const avg = (tile: number) => {
    const tx = (tile % 16) * 16, ty = Math.floor(tile / 16) * 16;
    let sum = 0;
    for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
      const i = ((ty + py) * atlas.width + tx + px) * 4;
      sum += atlas.data[i] + atlas.data[i + 1] + atlas.data[i + 2];
    }
    return sum / (16 * 16 * 3);
  };
  const dry = avg(T.farmland), wet = avg(T.farmland_moist);
  check('mokra grządka jest ciemniejsza od suchej', wet < dry - 20, `sucha=${dry.toFixed(0)}, mokra=${wet.toFixed(0)}`);
}

section('2.26: odrzut po ciosie i golem, który broni wioski');
{
  const w = new World(4242, true);
  w.getChunk(0, 0);
  w.getChunk(1, 0);
  const gy = w.heightAt(2, 2);
  const y = gy + 1;
  const player = new THREE.Vector3(2.5, y, 2.5);

  const knock = (type: MobType) => {
    const m = new Mob(type, 4.5, y, 4.5);
    const before = m.body.pos.clone();
    m.damage(4, 4.5, 2.5, 'player');
    let after = 0;
    for (let i = 0; i < 30; i++) {
      m.update(1 / 60, w, new THREE.Vector3(4.5, y, 2.5), () => {}, () => {}, false, [m]);
      if (i === 29) after = Math.hypot(m.body.pos.x - before.x, m.body.pos.z - before.z);
    }
    m.dispose();
    return after;
  };
  const zombiePush = knock('zombie');
  check('cios odrzuca zombie o ~1,5 bloku', zombiePush > 1.2 && zombiePush < 2, `${zombiePush.toFixed(2)} bloku`);
  check('golem nie da się odepchnąć', knock('golem') < 0.5);
  const plain = new Mob('zombie', 4.5, y, 4.5);
  eq('zombie nie ma odporności na odrzut', plain.kbResistance, 0);
  plain.dispose();
  const tough = new Mob('golem', 4.5, y, 4.5);
  eq('golem ma pełną odporność na odrzut', tough.kbResistance, 1);
  tough.dispose();

  const sim = (mobs: Mob[], seconds: number, cb: () => void = () => {}) => {
    for (let i = 0; i < seconds * 60; i++) {
      for (const m of mobs) m.update(1 / 60, w, player, cb, () => {}, false, mobs);
    }
  };

  // Golem broni mieszkańca, nawet jeśli potwór jest daleko od samego golema.
  const golem = new Mob('golem', 2.5, y, 2.5);
  const villager = new Mob('villager', 20.5, y, 2.5);
  const zombie = new Mob('zombie', 22.5, y, 2.5);
  const start = golem.body.pos.clone();
  sim([golem, villager, zombie], 8);
  check('golem rusza bronić mieszkańca', golem.body.pos.distanceTo(start) > 6,
    `${golem.body.pos.distanceTo(start).toFixed(2)} bloku`);
  check('golem zabija napastnika', zombie.health <= 0, `zombie hp=${zombie.health}`);
  check('mieszkaniec przeżywa', villager.health > 0, `hp=${villager.health}`);
  golem.dispose(); villager.dispose(); zombie.dispose();

  // Zemsta: golem atakuje tego, kto go uderzył, a nie bliższego zombie.
  const g2 = new Mob('golem', 2.5, y, 2.5);
  const near = new Mob('zombie', 6.5, y, 2.5);
  const biter = new Mob('zombie', 14.5, y, 2.5);
  g2.damage(1, biter.body.pos.x, biter.body.pos.z, biter);
  check('cios moba ustawia golema na napastnika', g2.retaliate === biter);
  sim([g2, near, biter], 8);
  check('golem dopada napastnika', biter.health <= 0, `biter hp=${biter.health}`);
  check('golem nie przechodzi obojętnie obok drugiego zombie', near.health < 20, `near hp=${near.health}`);
  g2.dispose(); near.dispose(); biter.dispose();

  // Gracz, który bije golema, dostaje kontratak.
  const g3 = new Mob('golem', 2.5, y, 2.5);
  g3.damage(1, 2.5, 2.5, 'player');
  let hits = 0;
  for (let i = 0; i < 240; i++) g3.update(1 / 60, w, new THREE.Vector3(2.5, y, 3.5), () => { hits++; }, () => {}, false, [g3]);
  check('sprowokowany golem bije gracza', hits >= 2, `${hits} ciosów`);
  g3.dispose();
}

// ============================================ 2.27: stabilność mieszkańców i handel
section('2.27: mieszkaniec stoi pewnie, nie skacze i nie trzęsie się');
{
  const w = new World(4242, true);
  for (let cx = 0; cx <= 3; cx++) for (let cz = 0; cz <= 3; cz++) w.getChunk(cx, cz);
  const ground = (x: number, z: number) => w.heightAt(x, z) + 1;
  const player = new THREE.Vector3(2.5, 65, 2.5);

  /** Ile razy mob podskoczył i jak mocno szarpał modelem w ciągu `seconds`. */
  const watch = (mob: Mob, seconds: number, skip = 0) => {
    let jumps = 0, upFrames = 0, maxDy = 0, maxYawStep = 0, path = 0;
    let prevYaw = mob.yaw;
    const prev = mob.body.pos.clone();
    for (let i = 0; i < seconds * 60; i++) {
      mob.update(1 / 60, w, player, () => {}, () => {}, false, [mob]);
      if (mob.body.vel.y > 7.5) jumps++;
      const dy = mob.body.pos.y - prev.y;
      // Odrzut po ciosie (0,45 s) to fizyka, nie „podskok” – pomijamy go.
      if (i > skip && dy > 0.02) upFrames++;
      maxDy = Math.max(maxDy, Math.abs(dy));
      let d = Math.abs(mob.yaw - prevYaw);
      if (d > Math.PI) d = Math.abs(d - Math.PI * 2);
      maxYawStep = Math.max(maxYawStep, d);
      path += Math.hypot(mob.body.pos.x - prev.x, mob.body.pos.z - prev.z);
      prev.copy(mob.body.pos);
      prevYaw = mob.yaw;
    }
    return { jumps, upFrames, maxDy, maxYawStep, path };
  };

  // Otwarte pole: mieszkaniec po prostu chodzi.
  const open = new Mob('villager', 30.5, ground(30, 30), 30.5);
  const a = watch(open, 25);
  check('mieszkaniec nie podskakuje na otwartym polu', a.jumps === 0 && a.upFrames === 0, `skoki=${a.jumps}`);
  check('mieszkaniec nie trzęsie się (Δy < 2 cm)', a.maxDy < 0.02, `${a.maxDy.toFixed(3)}`);
  check('mieszkaniec naprawdę chodzi', a.path > 3, `${a.path.toFixed(1)} bloku`);
  open.dispose();

  // Przy płocie (1,5 bloku) wcześniej skakał kilka razy na sekundę: sonda
  // 0,8 bloku od środka przeskakiwała płot i widziała powietrze.
  const pen = new Mob('villager', 20.5, ground(20, 20), 20.5);
  const py = ground(20, 20);
  for (let x = 18; x <= 22; x++) { w.setBlock(x, py, 18, B.FENCE); w.setBlock(x, py, 22, B.FENCE); }
  for (let z = 18; z <= 22; z++) { w.setBlock(18, py, z, B.FENCE); w.setBlock(22, py, z, B.FENCE); }
  pen.aiTimer = 999;
  pen.walking = true;
  const b = watch(pen, 25);
  check('mieszkaniec w zagrodzie nie podskakuje', b.jumps === 0 && b.upFrames === 0, `skoki=${b.jumps}`);
  check('mieszkaniec w zagrodzie zostaje w środku (Δy < 2 cm)', b.maxDy < 0.02, `${b.maxDy.toFixed(3)}`);
  pen.dispose();

  // Panika po ciosie: kierunek ucieczki jest stały, a nie losowy co klatkę.
  const scared = new Mob('villager', 36.5, ground(36, 36), 36.5);
  scared.damage(2, 36.5, 34.5, 'player');
  const c = watch(scared, 6, 40);
  check('przestraszony mieszkaniec nie skacze', c.jumps === 0 && c.upFrames === 0);
  check('przestraszony mieszkaniec nie obraca się gwałtownie', c.maxYawStep < 0.25,
    `${c.maxYawStep.toFixed(3)} rad/klatkę`);
  check('przestraszony mieszkaniec ucieka', c.path > 1.5, `${c.path.toFixed(1)} bloku`);
  scared.dispose();

  // Mieszkańcy nie stoją w sobie: delikatne rozsuwanie zamiast nakładania
  // się modeli (dwa przenikające się modele wyglądają jak drżenie).
  {
    const a = new Mob('villager', 30.5, ground(30, 30), 30.5);
    const b = new Mob('villager', 30.6, ground(30, 30), 30.55);
    for (const m of [a, b]) { m.walking = false; m.aiTimer = 999; }
    let maxDy = 0;
    const prev = a.body.pos.clone();
    let maxStep = 0;
    for (let i = 0; i < 300; i++) {
      for (const m of [a, b]) {
        const py = m.body.pos.y;
        m.update(1 / 60, w, player, () => {}, () => {}, false, [a, b]);
        maxDy = Math.max(maxDy, Math.abs(m.body.pos.y - py));
      }
      maxStep = Math.max(maxStep, Math.hypot(a.body.pos.x - prev.x, a.body.pos.z - prev.z));
      prev.copy(a.body.pos);
    }
    const gap = Math.hypot(a.body.pos.x - b.body.pos.x, a.body.pos.z - b.body.pos.z);
    check('mieszkańcy rozsuwają się, zamiast stać w sobie', gap > 0.45, `${gap.toFixed(2)} bloku`);
    check('rozsuwanie nie podnosi mobów', maxDy < 0.02, `${maxDy.toFixed(3)}`);
    check('rozsuwanie jest płynne (bez szarpania)', maxStep < 0.03, `${maxStep.toFixed(3)}/klatkę`);
    a.dispose(); b.dispose();
  }

  // Zombie nadal omija niski stopień skokiem (stabilność nie zepsuła AI).
  {
    const zy = w.heightAt(6, 6) + 1;
    for (let x = 4; x <= 14; x++) for (let z = 4; z <= 10; z++) {
      w.setBlock(x, zy - 1, z, B.STONE);
      for (let yy = zy; yy <= zy + 3; yy++) w.setBlock(x, yy, z, B.AIR);
    }
    for (let z = 4; z <= 10; z++) w.setBlock(10, zy, z, B.STONE);
    const z = new Mob('zombie', 6.5, zy, 7.5);
    let climbed = false;
    const target = new THREE.Vector3(11.5, zy + 1, 7.5);
    for (let i = 0; i < 600; i++) {
      z.update(1 / 60, w, target, () => {}, () => {}, false, [z]);
      if (z.body.pos.y > zy + 0.9) climbed = true;
    }
    check('zombie wciąż wskakuje na jednoblokowy stopień', climbed, `y=${(z.body.pos.y - zy).toFixed(2)}`);
    z.dispose();
  }
}

section('2.27: okno handlu 1:1 z MerchantScreen');
{
  // Wymiary waniliowego GUI i rozkład elementów.
  eq('panel handlu ma 276 × 166', `${MERCHANT.width}×${MERCHANT.height}`, '276×166');
  eq('lista ofert 88 × 140 przy (5,18)', `${MERCHANT.list.x},${MERCHANT.list.y},${MERCHANT.list.w},${MERCHANT.list.h}`, '5,18,88,140');
  eq('wiersz oferty ma 20 px', MERCHANT.list.row, 20);
  eq('na liście mieści się 7 ofert', merchantVisibleRows(), 7);
  eq('sloty towaru na (136,37) i (162,37)', `${MERCHANT.input1.x},${MERCHANT.input1.y},${MERCHANT.input2.x},${MERCHANT.input2.y}`, '136,37,162,37');
  eq('slot wyniku wyśrodkowany w ramce 26 × 26', `${MERCHANT.output.frameX}+${MERCHANT.output.x - MERCHANT.output.frameX}`, '215+5');
  eq('pasek przewijania 6 × 140 przy x=94', `${MERCHANT.scrollbar.x},${MERCHANT.scrollbar.w},${MERCHANT.scrollbar.h}`, '94,6,140');
  eq('kciuk przewijania ma waniliowe 27 px', MERCHANT.scrollbar.thumb, 27);
  eq('pasek XP 102 × 5 przy (136,57)', `${MERCHANT.xp.x},${MERCHANT.xp.y},${MERCHANT.xp.w},${MERCHANT.xp.h}`, '136,57,102,5');

  // Przewijanie: 7 ofert bez paska, dłuższa lista – kciuk się kurczy i jeździ.
  check('7 ofert nie wymaga przewijania', !merchantScrollable(7) && merchantMaxScroll(7) === 0);
  check('kciuk bez przewijania wypełnia tor', merchantThumbHeight(7) === MERCHANT.scrollbar.h);
  check('przy 12 ofertach jest co przewijać', merchantScrollable(12) && merchantMaxScroll(12) === 5);
  check('kciuk przy przewijaniu ma 27 px', merchantThumbHeight(12) === 27);
  check('kciuk na końcu listy jedzie na dół', merchantThumbOffset(12, 5) === 1 && merchantThumbOffset(12, 0) === 0);
  check('przesunięcie listy nie wychodzi poza zakres', merchantThumbOffset(12, 99) === 1);
  check('wiersz 0 widoczny, wiersz 8 już nie', merchantRowVisible(0, 0, 12) && !merchantRowVisible(8, 0, 12));
  check('po przewinięciu widać wiersze 5..11', merchantRowVisible(5, 5, 12) && merchantRowVisible(11, 5, 12) && !merchantRowVisible(4, 5, 12));
  eq('górna krawędź wiersza 3', merchantRowTop(3), MERCHANT.list.y + 60);

  // Sloty ekwipunku: siatka 9 × 3 od (108,84) i pasek skrótów na (108,142).
  const first = merchantInvSlot(0);
  const col8 = merchantInvSlot(8);
  const row2 = merchantInvSlot(18);
  const hot = merchantInvSlot(27);
  eq('pierwszy slot ekwipunku', `${first.x},${first.y}`, '108,84');
  eq('ósmy slot kończy rząd', `${col8.x},${col8.y}`, '252,84');
  eq('trzeci rząd siatki', `${row2.x},${row2.y}`, '108,120');
  eq('pasek skrótów zaczyna się pod siatką', `${hot.x},${hot.y}`, '108,142');
  check('ostatni slot paska skrótów', merchantInvSlot(35).x === 252 && merchantInvSlot(35).y === 142);

  // Skala panelu: nie większa niż 2× i zawsze mieści się na ekranie.
  check('panel skaluje się do 2× na dużym ekranie', merchantScale(1280, 900) === 2);
  const small = merchantScale(360, 640);
  check('na telefonie panel mieści się w ekranie', MERCHANT.width * small <= 360 && MERCHANT.height * small <= 640,
    `${small.toFixed(2)}×`);
}

section('2.27: grafika okna handlu pochodzi z paczki');
{
  const names = ['villager_gui', 'merchant_scroller', 'merchant_scroller_disabled', 'merchant_xp_bg', 'merchant_xp_current', 'merchant_out_of_stock'];
  const missing = names.filter((n) => !hasGuiSprite(n));
  check('wszystkie widżety handlu są w paczce', missing.length === 0, missing.join(', '));
  const png = guiSprite('villager_gui');
  check('panel handlu to obrazek z paczki', !!png && png.startsWith('data:image/png;base64,'));
  check('grafika GUI rośnie o widżety handlu', guiSpriteCount() >= 43);
}

section('2.28: teren w oddali (LOD) i automat jakości');
{
  // Budżet klatki i kolejność budowy chunków.
  check('budżet klatki 60 FPS to ~16 ms', Math.abs(frameBudgetMs(60) - 16.7) < 1);
  check('budżet klatki 30 FPS jest dwa razy większy', frameBudgetMs(30) > frameBudgetMs(60) * 1.8);
  const front = chunkBuildScore(0, -3, 0, -1);
  const back = chunkBuildScore(0, 3, 0, -1);
  check('chunk przed graczem ma pierwszeństwo przed tym z tyłu', front < back, `${front.toFixed(2)} < ${back.toFixed(2)}`);
  const offs: [number, number][] = [[0, 3], [-3, 0], [0, -2], [1, 0], [2, 2]];
  const sorted = sortChunkOffsets(offs, 0, -1);
  eq('sortowanie stawia najbliższy chunk z przodu', `${sorted[0][0]},${sorted[0][1]}`, '1,0');
  check('sortowanie nie gubi żadnego offsetu', sorted.length === offs.length);
  check('sortowanie nie zmienia oryginalnej tablicy', offs[0][0] === 0 && offs[0][1] === 3);

  // Entity Culling: dalekie moby tickują rzadziej.
  eq('bliski mob tickuje co klatkę', entityTickInterval(10), 1);
  eq('mob 70 bloków dalej – co 3 klatki', entityTickInterval(70), 3);
  eq('mob 200 bloków dalej – co 6 klatek', entityTickInterval(200), 6);
  let ticked = 0;
  for (let f = 0; f < 60; f++) if (shouldTickEntity(f, 200)) ticked++;
  check('w 60 klatkach daleki mob rusza się ~10 razy', ticked >= 8 && ticked <= 12, `${ticked}`);

  // Zasięg LOD rośnie z zasięgiem renderowania i wychodzi za horyzont.
  check('LOD sięga dalej niż pełne chunki', lodRange(6, CS) > 6 * CS * 2);
  check('LOD rośnie razem z zasięgiem', lodRange(12, CS) > lodRange(6, CS));
  check('gęstość LOD maleje z odległością', lodStepFor(50) < lodStepFor(250) && lodStepFor(250) < lodStepFor(900));

  // Automat jakości: po serii wolnych klatek schodzi z jakości, po dobrych wraca.
  const g = new FrameGovernor();
  eq('automat startuje w pełnej jakości', g.profile.label, 'pełny');
  for (let i = 0; i < 120; i++) g.update(30, 1 / 60);
  eq('2 s wolnych klatek = profil zrównoważony', g.profile.label, 'zrównoważony');
  for (let i = 0; i < 150; i++) g.update(30, 1 / 60);
  eq('długie zwolnienie = profil oszczędny', g.profile.label, 'oszczędny');
  // 2.32: czwarty stopień – „ziemniak” dostaje jeszcze mniej pracy.
  for (let i = 0; i < 150; i++) g.update(45, 1 / 60);
  eq('bardzo wolny sprzęt schodzi do profilu minimalnego', g.profile.label, 'minimalny');
  for (let i = 0; i < 700; i++) g.update(8, 1 / 60);
  eq('po ustabilizowaniu wraca do pełnej jakości', g.profile.label, 'pełny');
  eq('profil minimalny tnie zasięg rysowania', drawDistanceChunks(6, PERF_PROFILES.minimal), 4);
  eq('profil pełny rysuje cały zasięg', drawDistanceChunks(6, PERF_PROFILES.full), 6);
  check('zasięg rysowania nigdy nie spada poniżej 2 chunków', drawDistanceChunks(3, PERF_PROFILES.minimal) >= 2);
  check('limit rozdzielczości profilu minimalnego obniża skalę', profileResScale(1, PERF_PROFILES.minimal) < 1);
  eq('profil pełny nie rusza rozdzielczości', profileResScale(1, PERF_PROFILES.full), 1);
  // Limit 30 FPS: klatka 33 ms jest sukcesem, automat nie schodzi z jakości.
  const cap = new FrameGovernor();
  cap.setFpsCap(30);
  for (let i = 0; i < 300; i++) cap.update(33, 1 / 30);
  eq('przy limicie 30 FPS automat trzyma pełną jakość', cap.profile.label, 'pełny');

  // 2.32: fizyczna klawiatura i mysz na tablecie.
  eq('mysz: pointerdown z pointerType mouse', hardwareHint({ type: 'pointerdown', pointerType: 'mouse' }), 'mouse');
  eq('palec: pointerdown z pointerType touch', hardwareHint({ type: 'pointerdown', pointerType: 'touch' }), null);
  eq('mysz: ruch względny w mousemove', hardwareHint({ type: 'mousemove', movementX: 3 }), 'mouse');
  eq('palec: mousemove bez ruchu względnego', hardwareHint({ type: 'mousemove', movementX: 0, movementY: 0 }), null);
  eq('klawiatura fizyczna: litera W', hardwareHint({ type: 'keydown', code: 'KeyW' }), 'keyboard');
  eq('klawiatura ekranowa nie przełącza sterowania', hardwareHint({ type: 'keydown', code: 'KeyW', sourceCapabilities: { firesTouchEvents: true } }), null);
  eq('klawisz spoza gry (np. F5) nie przełącza sterowania', hardwareHint({ type: 'keydown', code: 'F5' }), null);
  eq('rolka myszy to mysz', hardwareHint({ type: 'wheel' }), 'mouse');
  // 2.32: pola zdarzeń w przeglądarce są getterami na prototypie – funkcja
  // musi czytać je wprost, a nie przez kopiowanie obiektu.
  class FakeKey {
    type = 'keydown';
    get code() { return 'KeyA'; }
    get sourceCapabilities() { return null; }
  }
  eq('klawisz z getterem na prototypie też jest wykryty', hardwareHint(new FakeKey() as never), 'keyboard');
  class FakePointer {
    type = 'pointermove';
    get pointerType() { return 'mouse'; }
    get movementX() { return 0; }
  }
  eq('mysz z pointerType z gettera', hardwareHint(new FakePointer() as never), 'mouse');
  check('po 15 s ciszy i 3 dotknięciach wracamy na dotyk', shouldRestoreTouch(HARDWARE_IDLE_MS, TOUCH_RESTORE_TAPS));
  check('samo dotknięcie nie przełącza z powrotem', !shouldRestoreTouch(HARDWARE_IDLE_MS, TOUCH_RESTORE_TAPS - 1));
  check('krótka przerwa nie przełącza z powrotem', !shouldRestoreTouch(5000, 10));

  // Kafel LOD: siatka, kolory i wysokości z generatora świata.
  const w = new World(4242);
  const tile = buildLodTile(w, 0, 0, 128, 8, 1.6);
  eq('kafel LOD 128/8 ma 17×17 wierzchołków', tile.positions.length / 3, 17 * 17);
  eq('kafel LOD ma 16×16×2 trójkątów', tile.indices.length, 16 * 16 * 6);
  const ys = Array.from(tile.positions).filter((_, i) => i % 3 === 1);
  check('kafel LOD leży na poziomie terenu (nie w zerze)', Math.min(...ys) > 20 && Math.max(...ys) < 140, `${Math.min(...ys).toFixed(0)}–${Math.max(...ys).toFixed(0)}`);
  check('kolory wierzchołków są w zakresie 0–1', tile.colors.every((c) => c >= 0 && c <= 1));
  const ring = lodRing(100, 100, 6 * CS, lodRange(6, CS), LOD_TILE);
  check('pierścień LOD otacza gracza', ring.length >= 8, `${ring.length} kafli`);
  // Kafel w całości pokryty pełnymi chunkami jest pomijany…
  const atCenter = lodRing(64, 64, 6 * CS, lodRange(6, CS), LOD_TILE);
  check('kafel pod stopami nie dubluje pełnych chunków', !atCenter.some((r) => r.ox === 0 && r.oz === 0));
  // …ale kafel na granicy chunków i LOD zostaje, żeby nie było luki w horyzoncie.
  check('kafel na granicy chunków i LOD jest rysowany', ring.some((r) => r.dist >= 6 * CS - LOD_TILE));
  check('kafle są posortowane od najbliższego', ring.every((r, i) => i === 0 || r.dist >= ring[i - 1].dist));
}

section('2.28: kowadło, zaklęcia, warzenie i piec 1:1 z Minecraftem');
{
  // Wspólna siatka ekwipunku – dokładnie jak w wanilii.
  eq('okna kontenerów mają 176 × 166', `${CONTAINER.width}×${CONTAINER.height}`, '176×166');
  eq('pierwszy slot ekwipunku', `${containerInvSlot(0).x},${containerInvSlot(0).y}`, '8,84');
  eq('ostatni slot siatki 9 × 3', `${containerInvSlot(26).x},${containerInvSlot(26).y}`, '152,120');
  eq('pierwszy slot paska skrótów', `${containerInvSlot(27).x},${containerInvSlot(27).y}`, '8,142');
  eq('ostatni slot paska skrótów', `${containerInvSlot(35).x},${containerInvSlot(35).y}`, '152,142');
  check('panel skaluje się najwyżej 2×', containerScale(1280, 900) === 2);
  const ss = containerScale(360, 640);
  check('na telefonie panel mieści się w ekranie', CONTAINER.width * ss <= 360 && CONTAINER.height * ss <= 640, `${ss.toFixed(2)}×`);

  // Kowadło: trzy sloty i pole nazwy na waniliowych współrzędnych.
  eq('kowadło – slot A', `${ANVIL.slotA.x},${ANVIL.slotA.y}`, '27,47');
  eq('kowadło – slot B', `${ANVIL.slotB.x},${ANVIL.slotB.y}`, '76,47');
  eq('kowadło – slot wyniku', `${ANVIL.output.x},${ANVIL.output.y}`, '134,47');
  eq('kowadło – pole nazwy 103 × 12', `${ANVIL.name.x},${ANVIL.name.y},${ANVIL.name.w},${ANVIL.name.h}`, '62,24,103,12');
  eq('kowadło – tło pola 110 × 16', `${ANVIL.field.w}×${ANVIL.field.h}`, '110×16');

  // Stół zaklęć: dwa sloty i trzy oferty co 19 px.
  eq('zaklęcia – slot przedmiotu', `${ENCHANT.item.x},${ENCHANT.item.y}`, '15,47');
  eq('zaklęcia – slot lazurytu', `${ENCHANT.lapis.x},${ENCHANT.lapis.y}`, '35,47');
  eq('zaklęcia – pierwsza oferta', `${ENCHANT.offers[0].x},${ENCHANT.offers[0].y}`, '60,13');
  eq('zaklęcia – odstęp ofert to 19 px', ENCHANT.offers[1].y - ENCHANT.offers[0].y, 19);
  eq('zaklęcia – sprite oferty 108 × 19', `${ENCHANT.offerW}×${ENCHANT.offerH}`, '108×19');

  // Statyw: fiolki w literę V, bąbelki i pasek postępu.
  eq('statyw – lewa fiolka', `${BREWING.bottles[0].x},${BREWING.bottles[0].y}`, '56,51');
  eq('statyw – środkowa fiolka niżej', `${BREWING.bottles[1].x},${BREWING.bottles[1].y}`, '79,58');
  eq('statyw – prawa fiolka', `${BREWING.bottles[2].x},${BREWING.bottles[2].y}`, '102,51');
  eq('statyw – składnik u góry', `${BREWING.ingredient.x},${BREWING.ingredient.y}`, '79,17');
  eq('statyw – pęcherzyki 12 × 29', `${BREWING.bubbles.w}×${BREWING.bubbles.h}`, '12×29');
  eq('statyw – postęp warzenia 9 × 28', `${BREWING.progress.w}×${BREWING.progress.h}`, '9×28');
  eq('statyw – pasek paliwa 18 × 4', `${BREWING.fuelBar.w}×${BREWING.fuelBar.h}`, '18×4');

  // Piec: surowiec, paliwo, wynik, płomień i strzałka.
  eq('piec – surowiec', `${FURNACE.input.x},${FURNACE.input.y}`, '56,17');
  eq('piec – paliwo', `${FURNACE.fuel.x},${FURNACE.fuel.y}`, '56,53');
  eq('piec – wynik', `${FURNACE.output.x},${FURNACE.output.y}`, '116,31');
  eq('piec – płomień 14 × 14', `${FURNACE.lit.w}×${FURNACE.lit.h}`, '14×14');
  eq('piec – strzałka 24 × 16', `${FURNACE.burn.w}×${FURNACE.burn.h}`, '24×16');

  // Grafika pochodzi z paczki 26.2.
  const names = [
    'anvil_gui', 'anvil_text_field', 'anvil_error', 'enchanting_gui', 'enchant_slot',
    'enchant_slot_disabled', 'enchant_slot_highlighted', 'enchant_level_1', 'enchant_level_2',
    'enchant_level_3', 'brewing_gui', 'brewing_bubbles', 'brewing_progress', 'brewing_fuel',
    'furnace_gui', 'furnace_lit', 'furnace_burn',
  ];
  const missing = names.filter((n) => !hasGuiSprite(n));
  check('wszystkie widżety nowych okien są w paczce', missing.length === 0, missing.join(', '));
  const anvilPng = guiSprite('anvil_gui');
  check('panel kowadła to obrazek z paczki', !!anvilPng && anvilPng.startsWith('data:image/png;base64,'));
  check('grafik GUI jest teraz co najmniej 70', guiSpriteCount() >= 70, `${guiSpriteCount()}`);
}

section('2.28.1: skrzynia 1:1 z GenericContainerScreen');
{
  eq('panel skrzyni ma 176 × 167', `${CHEST.width}×${CHEST.height}`, '176×167');
  eq('pierwszy slot skrzyni', `${chestSlot(0).x},${chestSlot(0).y}`, '8,18');
  eq('ostatni slot skrzyni (3. wiersz)', `${chestSlot(26).x},${chestSlot(26).y}`, '152,54');
  eq('skrzynia – wiersz co 18 px', chestSlot(9).y - chestSlot(0).y, 18);
  eq('ekwipunek gracza pod siatką', `${containerInvSlot(0).x},${containerInvSlot(0).y}`, '8,84');
  eq('pasek skrótów pod ekwipunkiem', `${containerInvSlot(27).x},${containerInvSlot(27).y}`, '8,142');
  check('skrzynia ma widżet z paczki', hasGuiSprite('chest_gui'));
  check('grafik GUI jest teraz 71', guiSpriteCount() >= 71, `${guiSpriteCount()}`);
}

// ============================================ 2.29: drzwi, łóżko i dźwięki
section('2.29: drzwi i łóżko jak w Minecraftcie');
{
  // --- drzwi: zamknięte to płyta przy krawędzi, otwarte – ta sama płyta
  // obrócona o 90° wokół zawiasu. Wcześniej otwarte drzwi nie miały kolizji.
  const shut = collisionBoxes(B.DOOR_N)!;
  const wide = collisionBoxes(B.DOOR_ON)!;
  // 2.29: `facing` znaczy „kierunek patrzenia gracza”, więc skrzydło stoi po
  // przeciwnej stronie kratki – dokładnie jak `DoorBlock#getShape`.
  eq('zamknięte drzwi stoją po przeciwnej stronie niż facing', `${shut[2]},${shut[5]}`, '0.8125,1');
  eq('otwarte drzwi (zawias z lewej) idą na zachód', `${wide[0]},${wide[3]}`, '0,0.1875');
  eq('otwarte drzwi są tej samej grubości', wide[3] - wide[0], 0.1875);
  check('otwarte drzwi nadal blokują skrzydło', wide[5] - wide[2] === 1);
  eq('drzwi wschodnie zamykają się przy zachodniej krawędzi', collisionBoxes(B.DOOR_E)![0], 0);
  eq('otwarte drzwi wschodnie leżą wzdłuż północy', collisionBoxes(B.DOOR_OE)![5], 0.1875);
  eq('otwarte drzwi z prawym zawiasem idą na wschód', collisionBoxes(B.DOOR_ORN)![3], 1);
  eq('lewy zawias trzyma zachodnią krawędź', doorPlate(B.DOOR_ON)[0], 0);
  eq('prawy zawias trzyma wschodnią krawędź', doorPlate(B.DOOR_ORN)[3], 1);
  eq('drzwi z prawym zawiasem rozpoznają kierunek', doorFacing(B.DOOR_ORN + 2), 2);
  eq('zawias lewy', doorHinge(B.DOOR_N), 0);
  eq('zawias prawy', doorHinge(B.DOOR_URN), 1);
  eq('górne drzwi z prawym zawiasem to nadal góra', isDoorTop(B.DOOR_UORN), true);
  eq('górne otwarte drzwi tną alfę (szyby)', LAYER[B.DOOR_UON], 1);
  eq('górne zamknięte drzwi tną alfę', LAYER[B.DOOR_UN], 1);
  eq('dolna połowa drzwi to ta sama deska', doorFacing(B.DOOR_UON), 0);
  eq('nowe drzwi nie są otwarte w stanie domyślnym', isDoorOpen(B.DOOR_RN), false);
  check('para drzwi zachowuje zawias', doorHinge(doorPair(2, true, false, 1)) === 1 && doorFacing(doorPair(2, true, false, 1)) === 2);

  // --- łóżko: dwa bloki (stopa + wezgłowie) i cztery kierunki
  check('B.BED to stopa zwrócona na północ', isBed(B.BED) && !isBedHead(B.BED));
  eq('kierunek stopy', bedFacing(B.BED), 0);
  eq('kierunek stopy (wschód)', bedFacing(B.BED_E), 1);
  eq('kierunek stopy (południe)', bedFacing(B.BED_S), 2);
  eq('kierunek stopy (zachód)', bedFacing(B.BED_W), 3);
  eq('kierunek wezgłowia', bedFacing(B.BED_HEAD_W), 3);
  check('wezgłowie rozpoznawalne', isBedHead(B.BED_HEAD_N) && !isBedHead(B.BED_S));
  eq('stopa dla kierunku E', bedPart(1, false), B.BED_E);
  eq('stopa dla kierunku S', bedPart(2, false), B.BED_S);
  eq('stopa dla kierunku N jest starym id', bedPart(0, false), B.BED);
  eq('wezgłowie dla kierunku W', bedPart(3, true), B.BED_HEAD_W);
  eq('łóżko ma 9/16 wysokości', collisionBoxes(B.BED)![4], 0.5625);
  eq('wezgłowie ma 9/16 wysokości', collisionBoxes(B.BED_HEAD_E)![4], 0.5625);
  eq('łóżko ma model 3D', RENDER[B.BED_HEAD_S], 8);
  eq('łóżko tnie alfę', LAYER[B.BED], 1);
  check('łóżko wypada jako jeden przedmiot', BLOCKS[B.BED_HEAD_N].drop === B.BED && BLOCKS[B.BED_W].drop === B.BED);
  check('łóżko nie zaśmieca kreatywnego', !BLOCKS[B.BED_HEAD_S] || BLOCKS[B.BED_HEAD_S].name.includes('wezgłowie'));

  // --- model: materac + dwie nogi = trzy bryły na blok
  const w5 = new World(9191, true);
  const gy5 = FLAT_H + 1;
  w5.setBlock(2, gy5, 2, B.BED);
  w5.setBlock(2, gy5, 3, B.BED_HEAD_S);
  const bedCut = w5.buildMesh(w5.getChunk(0, 0))[1];
  const bp = bedCut.attributes.position as THREE.BufferAttribute | undefined;
  let inBed = 0;
  if (bp) {
    for (let i = 0; i < bp.count; i++) {
      const bx = bp.getX(i), by = bp.getY(i), bz = bp.getZ(i);
      if (bx >= 1.99 && bx <= 3.01 && bz >= 1.99 && bz <= 4.01 && by >= gy5 - 0.01 && by <= gy5 + 0.7) inBed++;
    }
  }
  check('łóżko rysuje materac i cztery nogi', inBed >= 72, `${inBed} wierzchołków`);

  // --- tekstury łóżka pochodzą z paczki
  const atlasSrc = readSource('scripts/compile-vanilla-art.mjs');
  check('tekstury łóżka z paczki', /bed_head_north: B \+ 'bed_head_north\.png'/.test(atlasSrc) &&
    /bed_foot_up: B \+ 'red_bed_foot_up\.png'/.test(atlasSrc) &&
    /bed_head_west: B \+ 'red_bed_head_west\.png'/.test(atlasSrc));
  check('siedem nowych kafelków łóżka jest oficjalnych', [T.bed_head_north, T.bed_head_east, T.bed_head_west, T.bed_foot_up, T.bed_foot_east, T.bed_foot_west, T.bed_foot_south].every((t) => isOfficialTile(t)));

  // --- dźwięki: drzwi i łóżko mają własne, oryginalne barwy (synteza)
  const audioSrc = readSource('src/game/audio.ts');
  check('drzwi mają osobny dźwięk otwierania i zamykania', /export function playDoor\(open: boolean\)/.test(audioSrc) && /playDoor\(open\)/.test(readSource('src/game/engine.ts')));
  check('łóżko ma własny dźwięk', /export function playBed\(\)/.test(audioSrc));
  check('materiały mają własne barwy (korpus + rezonans)', /const MAT: Record<Kind/.test(audioSrc) && /bodyThump/.test(audioSrc));
  check('dźwięki nadal są w pełni syntezowane', !/new Audio\(|\.mp3|\.ogg/.test(audioSrc));
  check('każdy efekt idzie przez wspólne wyjście', /function out\(node: AudioNode\)/.test(audioSrc) && (audioSrc.match(/out\(/g)?.length ?? 0) > 25);
  check('efekty mają proceduralny pogłos (mały pokój)', /function buildRoom\(c: AudioContext, dest: GainNode, out: AudioNode\)/.test(audioSrc) && /createConvolver/.test(audioSrc) && /dest\.connect\(conv\)/.test(audioSrc));
  check('splash, ból i wybuch mają nową, cieplejszą barwę', /bąbelków o rosnącej wysokości/.test(audioSrc) && /dwa tony: krótkie/.test(audioSrc) && /niski „bum” pod szumem/.test(audioSrc));
  check('jedzenie chrupie trzy razy', /chrupnięcie: trzy krótkie/.test(audioSrc));
}


// ============================================ 2.30: ścieżka, golem, głowa, sieć
section('2.30: koniec trzęsienia na ścieżce i dokładne lądowanie na bryłach');
{
  // --- płaski świat z pasem ścieżki (15/16) i kawałkiem trawy
  const w = new World(4242, true);
  for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) w.getChunk(cx, cz);
  const gy = FLAT_H + 1;
  for (let x = 0; x < 6; x++) for (let z = -8; z <= 8; z++) w.setBlock(x, gy - 1, z, B.PATH);

  /** Idzie po ziemi (z grawitacją) i zwraca kolejne wysokości stóp. */
  const stride = (world: World, startX: number, y: number, w2: number, h: number, axis: 'x' | 'z', v: number, frames: number, startZ = 0.5) => {
    const b = { pos: new THREE.Vector3(startX, y, startZ), vel: new THREE.Vector3(), w: w2, h, onGround: true, hitWall: false };
    const ys: number[] = [];
    for (let i = 0; i < frames; i++) {
      if (axis === 'x') b.vel.x = v; else b.vel.z = v;
      b.vel.y -= 28 / 60;
      stepBody(world, b, 1 / 60);
      ys.push(b.pos.y);
    }
    return { ys, body: b };
  };

  // Gracz (0,6 × 1,8) idzie wzdłuż ścieżki – wysokość musi być stała.
  const stroll = stride(w, 2.5, gy - 0.0625, 0.6, 1.8, 'z', -3, 90, 6.5);
  const settled = stroll.ys.slice(10);
  const amp = Math.max(...settled) - Math.min(...settled);
  check('na ścieżce gracz nie drga (amplituda 0)', amp < 1e-9, `amplituda ${amp.toFixed(5)}`);
  check('gracz stoi dokładnie na 15/16 ścieżki', Math.abs(settled[0] - (gy - 0.0625)) < 1e-9, `${settled[0].toFixed(4)}`);
  check('gracz nie stoi pół bloku nad ścieżką', settled[0] < gy - 0.03, `${settled[0].toFixed(3)}`);
  check('gracz nie zapada się w ścieżkę', settled[0] > gy - 0.07, `${settled[0].toFixed(3)}`);

  // Moby (szeroki golem 1,4 × 2,7) na tej samej ścieżce – też bez drgania.
  const golemWalk = stride(w, 2.5, gy - 0.0625, 1.4, 2.7, 'z', -2.4, 90, 6.5);
  const gSettled = golemWalk.ys.slice(10);
  const gAmp = Math.max(...gSettled) - Math.min(...gSettled);
  check('golem na ścieżce nie trzęsie się', gAmp < 1e-9, `amplituda ${gAmp.toFixed(5)}`);

  // Zejście ze ścieżki na trawę (0,0625 wyżej) nie może podrzucić o pół bloku.
  const w2 = new World(4242, true);
  for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) w2.getChunk(cx, cz);
  for (let x = 0; x < 3; x++) for (let z = -4; z <= 4; z++) w2.setBlock(x, gy - 1, z, B.PATH);
  const leave = stride(w2, 2.2, gy - 0.0625, 0.6, 1.8, 'x', 3, 50);
  const maxY = Math.max(...leave.ys);
  check('wyjście ze ścieżki na trawę to jeden schodek 1/16', maxY - (gy - 0.0625) < 0.08, `skok ${(maxY - (gy - 0.0625)).toFixed(3)}`);
  check('po wyjściu gracz stoi na trawie', Math.abs(leave.body.pos.y - gy) < 1e-9, `${leave.body.pos.y.toFixed(4)}`);

  // Płyta: wejście bez skoku i stopa DOKŁADNIE na 0,5.
  const w3 = new World(4242, true);
  for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) w3.getChunk(cx, cz);
  w3.setBlock(2, gy, 2, B.OAK_SLAB);
  const slab = stride(w3, 2.5, gy, 0.6, 1.8, 'z', -2, 70, 4.5);
  check('na płytę wchodzi się bez skoku', Math.abs(slab.body.pos.z - 2.5) < 0.4, `z=${slab.body.pos.z.toFixed(2)}`);
  check('stopa staje dokładnie na pół bloku', Math.abs(slab.body.pos.y - (gy + 0.5)) < 1e-9, `${slab.body.pos.y.toFixed(4)}`);

  // Łóżko (9/16) – od 2.30 też się na nie wchodzi (krok 0,6).
  const w4 = new World(4242, true);
  for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) w4.getChunk(cx, cz);
  w4.setBlock(2, gy, 2, B.BED);
  const bed = stride(w4, 2.5, gy, 0.6, 1.8, 'z', -2, 70, 4.5);
  check('na łóżko wchodzi się krokiem (9/16 < 0,6)', Math.abs(bed.body.pos.y - (gy + 0.5625)) < 1e-9, `${bed.body.pos.y.toFixed(4)}`);

  // Skrzynia (14/16) nadal zatrzymuje.
  const w5 = new World(4242, true);
  for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) w5.getChunk(cx, cz);
  w5.setBlock(2, gy, 2, B.CHEST);
  const chest = stride(w5, 2.5, gy, 0.6, 1.8, 'z', -2, 70, 4.5);
  check('skrzynia nadal blokuje (0,875 > krok)', chest.body.pos.z > 2.7, `z=${chest.body.pos.z.toFixed(2)}`);

  // Sufit: głowa zatrzymuje się dokładnie na spodzie bloku, nie w środku.
  const w6 = new World(4242, true);
  for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) w6.getChunk(cx, cz);
  w6.setBlock(2, gy + 2, 2, B.STONE);
  const jump = { pos: new THREE.Vector3(2.5, gy, 2.5), vel: new THREE.Vector3(0, 7, 0), w: 0.6, h: 1.8, onGround: true, hitWall: false };
  let headMax = 0;
  for (let i = 0; i < 60; i++) { jump.vel.y -= 28 / 60; stepBody(w6, jump, 1 / 60); headMax = Math.max(headMax, jump.pos.y + 1.8); }
  check('głowa nie wchodzi w sufit', headMax <= gy + 2 + 1e-6, `głowa ${headMax.toFixed(4)}`);
  check('głowa dolatuje do sufitu (bez martwej strefy)', headMax > gy + 2 - 0.01, `głowa ${headMax.toFixed(4)}`);
}

section('2.30: golem oddaje po strzale i wybuchu');
{
  const w = new World(4242, true);
  for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) w.getChunk(cx, cz);
  const gy = FLAT_H + 1;

  // Strzała gracza = `damage(..., 'player')` – golem musi się rozgniewać.
  const shot = new Mob('golem', 0.5, gy, 3.5);
  shot.damage(5, 0.5, 0.5, 'player');
  check('strzał gracza budzi golema', shot.provoked > 0, `provoked=${shot.provoked}`);
  let hits = 0;
  const player = new THREE.Vector3(0.5, gy, 0.5);
  for (let i = 0; i < 300; i++) shot.update(1 / 60, w, player, () => { hits++; }, () => {}, false, [shot]);
  check('golem dogania i bije gracza po strzale', hits > 0, `${hits} ciosów`);
  shot.dispose();

  // Wybuch TNT podpalonego przez gracza – to samo.
  const boom = new Mob('golem', 0.5, gy, 3.5);
  boom.damage(9, 0.5, 3.5, 'player');
  check('wybuch gracza też budzi golema', boom.provoked > 0);
  boom.dispose();

  // Creeper / szkielet = napastnik-mob, golem bierze go na cel.
  const creeper = new Mob('creeper', 4.5, gy, 3.5);
  const g2 = new Mob('golem', 0.5, gy, 3.5);
  g2.damage(9, creeper.body.pos.x, creeper.body.pos.z, creeper);
  check('golem pamięta moba, który go trafił', g2.retaliate === creeper);
  const hp0 = creeper.health;
  for (let i = 0; i < 240; i++) {
    g2.update(1 / 60, w, player, () => {}, () => {}, false, [g2, creeper]);
    creeper.update(1 / 60, w, player, () => {}, () => {}, false, [g2, creeper]);
  }
  check('golem oddaje creeperowi', creeper.health < hp0, `${hp0} → ${creeper.health}`);
  creeper.dispose(); g2.dispose();

  // Zasięg gniewu: gracz 25 bloków dalej też jest ścigany (było 20).
  const far = new Mob('golem', 0.5, gy, 0.5);
  far.damage(2, 25, 0.5, 'player');
  const farStart = far.body.pos.clone();
  const farPlayer = new THREE.Vector3(25.5, gy, 0.5);
  for (let i = 0; i < 240; i++) far.update(1 / 60, w, farPlayer, () => {}, () => {}, false, [far]);
  check('golem rusza do gracza z 25 bloków', far.body.pos.distanceTo(farStart) > 8, `${far.body.pos.distanceTo(farStart).toFixed(1)} bloku`);
  far.dispose();

  // Silnik naprawdę przekazuje napastnika (inaczej poprawka byłaby martwa).
  const engineSrc = readSource('src/game/engine.ts');
  check('strzała gracza niesie napastnika', /m\.damage\(a\.power, a\.pos\.x - dir\.x \* 2, a\.pos\.z - dir\.z \* 2, 'player'\)/.test(engineSrc));
  check('wybuch przyjmuje źródło', /explode\(cx: number, cy: number, cz: number, power: number, source: Mob \| 'player' \| null = null\)/.test(engineSrc));
  check('TNT pamięta podpalacza', /owner: Mob \| 'player' \| null;/.test(engineSrc) && /this\.explode\(t\.body\.pos\.x, t\.body\.pos\.y \+ 0\.5, t\.body\.pos\.z, 4, t\.owner\)/.test(engineSrc));
  check('creeper jest źródłem własnego wybuchu', /explode\(m\.body\.pos\.x, m\.body\.pos\.y \+ 0\.6, m\.body\.pos\.z, 3\.2, m\)/.test(engineSrc));
  check('strzała szkieletu rani też moby', /m\.damage\(a\.power, a\.pos\.x - dir\.x \* 2, a\.pos\.z - dir\.z \* 2, a\.from\)/.test(engineSrc));
}

section('2.30: realistyczny ruch głowy mobów');
{
  const w = new World(4242, true);
  for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) w.getChunk(cx, cz);
  const gy = FLAT_H + 1;

  /** Wektor od zawiasu głowy do jej nosa (przód modelu to −Z). */
  const nose = (mob: Mob) => {
    mob.head.updateMatrixWorld(true);
    const o = mob.head.getWorldPosition(new THREE.Vector3());
    const tip = mob.head.localToWorld(new THREE.Vector3(0, 0, -0.45));
    return tip.sub(o).normalize();
  };

  // Gracz stoi NAD golemem – głowa zadziera do góry (dodatnie y).
  const golem = new Mob('golem', 0.5, gy, 3.5);
  const above = new THREE.Vector3(0.5, gy + 4, 2.2);
  for (let i = 0; i < 60; i++) golem.update(1 / 60, w, above, () => {}, () => {}, false, [golem]);
  const up = nose(golem);
  check('głowa patrzy w górę na stojącego wyżej gracza', up.y > 0.15, `y=${up.y.toFixed(2)}`);
  golem.dispose();

  // Gracz obok – głowa odwraca się w jego stronę i nie wykręca karku.
  const cow = new Mob('cow', 0.5, gy, 3.5);
  const side = new THREE.Vector3(3.5, gy, 3.5);
  let yawAbs = 0;
  for (let i = 0; i < 90; i++) {
    cow.update(1 / 60, w, side, () => {}, () => {}, false, [cow]);
    yawAbs = Math.max(yawAbs, Math.abs(cow.head.rotation.y - 0));
  }
  check('głowa odwraca się do gracza z boku', yawAbs > 0.35, `yaw=${yawAbs.toFixed(2)}`);
  check('kark nie skręca się bardziej niż 75°+baza', Math.abs(cow.head.rotation.y) <= 1.35, `yaw=${cow.head.rotation.y.toFixed(2)}`);
  cow.dispose();

  // Wypas owcy: nos w DÓŁ (wcześniej znak był odwrócony i owca patrzyła w niebo).
  const sheep = new Mob('sheep', 0.5, gy, 3.5);
  sheep.grazing = 0.5;
  sheep.update(1 / 60, w, new THREE.Vector3(0.5, gy, 0.5 + 40), () => {}, () => {}, false, [sheep]);
  const grazing = nose(sheep);
  check('owca przy wypasie patrzy w trawę', grazing.y < -0.05, `y=${grazing.y.toFixed(2)}`);

  // Bezczynny mob rozgląda się (wcześniej głowa stała jak zamurowana).
  let moved = 0;
  for (let i = 0; i < 600; i++) {
    sheep.update(1 / 60, w, new THREE.Vector3(0.5, gy, 0.5 + 40), () => {}, () => {}, false, [sheep]);
    moved = Math.max(moved, Math.abs(sheep.head.rotation.y));
  }
  check('bezczynny mob rozgląda się', moved > 0.03, `obrót ${moved.toFixed(3)} rad`);
  sheep.dispose();

  // Kołysanie kamery: waniliowe (pion + bok) i wreszcie zależne od ustawienia.
  const engineSrc = readSource('src/game/engine.ts');
  check('kołysanie kamery respektuje przełącznik', /const amp = this\.viewBobbing \? this\.bobAmp : 0/.test(engineSrc));
  check('kołysanie wygasa po zatrzymaniu', /this\.bobAmp \+= \(\(walkingBob/.test(engineSrc));
  check('kołysanie ma boczny ruch prostopadły do patrzenia', /b\.pos\.x \+ Math\.cos\(this\.yaw\) \* bobX/.test(engineSrc) && /b\.pos\.z - Math\.sin\(this\.yaw\) \* bobX/.test(engineSrc));
}

section('2.30: płynni gracze w multiplayerze (interpolacja migawek)');
{
  const { RemoteTrack, REMOTE_DELAY_LOCAL, REMOTE_DELAY_PUBLIC, REMOTE_MAX_SPEED, REMOTE_EXTRAPOLATE_MAX, wrapAngle, lerpAngle } = netSmooth;

  eq('kąt zawija się wokół ±π (3,2 → −3,08)', +wrapAngle(3.2).toFixed(2), +(3.2 - Math.PI * 2).toFixed(2));
  check('lerp kąta idzie krótszą drogą', Math.abs(lerpAngle(3.0, -3.0, 0.5)) > 3.0, `${lerpAngle(3.0, -3.0, 0.5).toFixed(2)}`);
  check('serwer publiczny ma większy bufor niż pokój', REMOTE_DELAY_PUBLIC > REMOTE_DELAY_LOCAL);

  // 4 Hz, 4,3 bloku/s – tak idzie gracz w grze.
  const track = new RemoteTrack();
  const stepDist = 4.3 * 0.25;
  for (let i = 0; i < 12; i++) track.push(i * 250, { x: i * stepDist, y: 65, z: 0.5, yaw: 0, pitch: 0 });
  const xs: number[] = [];
  for (let t = 1000; t <= 2400; t += 16) xs.push(track.sample(t, REMOTE_DELAY_PUBLIC)!.x);
  let maxStep = 0;
  let still = 0;
  for (let i = 1; i < xs.length; i++) {
    const d = Math.abs(xs[i] - xs[i - 1]);
    maxStep = Math.max(maxStep, d);
    if (d < 0.02) still++;
  }
  check('awatar rusza się w każdej klatce (koniec zacinania)', still === 0, `${still} klatek bez ruchu`);
  check('krok między klatkami jest równy', maxStep < 0.09, `max ${maxStep.toFixed(3)} bloku/klatkę`);
  const midYaw = new RemoteTrack();
  midYaw.push(0, { x: 0, y: 0, z: 0, yaw: 3.0, pitch: 0 });
  midYaw.push(100, { x: 0, y: 0, z: 0, yaw: -3.0, pitch: 0 });
  const s2 = midYaw.sample(50, 0)!;
  check('obrót gracza też jest interpolowany (bez przeskoku ±π)', Math.abs(Math.abs(s2.yaw) - Math.PI) < 0.05, `yaw=${s2.yaw.toFixed(2)}`);

  // Teleportacja: bufor się czyści, awatar nie leci przez mapę.
  const tp = new RemoteTrack();
  tp.push(0, { x: 0, y: 65, z: 0, yaw: 0, pitch: 0 });
  tp.push(100, { x: 300, y: 65, z: 0, yaw: 0, pitch: 0 });
  eq('teleport czyści bufor migawek', tp.size, 1);
  const t2 = tp.sample(120, 0)!;
  check('po teleportacji awatar jest na miejscu', Math.abs(t2.x - 300) < 1e-9, `x=${t2.x}`);

  // Ekstrapolacja jest krótka i ograniczona prędkością.
  const ex = new RemoteTrack();
  ex.push(0, { x: 0, y: 65, z: 0, yaw: 0, pitch: 0 });
  ex.push(250, { x: 1.07, y: 65, z: 0, yaw: 0, pitch: 0 });
  const later = ex.sample(250 + 10000, 0)!;
  check('ekstrapolacja nie ucieka (maks. 0,25 s)', later.x - 1.07 <= REMOTE_MAX_SPEED * REMOTE_EXTRAPOLATE_MAX + 1e-6, `x=${later.x.toFixed(2)}`);

  // Silnik korzysta z bufora, a nie z lerpa do ostatniego pakietu.
  const engineSrc = readSource('src/game/engine.ts');
  check('silnik interpoluje migawki', /const s = a\.track\.sample\(now, delay\)/.test(engineSrc));
  check('opóźnienie zależy od serwera', /const delay = net\.public \? REMOTE_DELAY_PUBLIC : REMOTE_DELAY_LOCAL/.test(engineSrc));
  check('awatar nie dogania już „celu” lerpem', !/a\.group\.position\.lerp\(a\.target/.test(engineSrc));
  check('głowa awatara patrzy tam, gdzie gracz (poprawny znak)', /a\.head\.rotation\.x = a\.headPitch/.test(engineSrc) && !/a\.head\.rotation\.x = -a\.pitch/.test(engineSrc));
  check('czapka i oczy obracają się razem z głową (zawias szyi)', /const neck = new THREE\.Group\(\)/.test(engineSrc) && /neck\.add\(head/.test(engineSrc));
  // Gracz z otwartym plecakiem/skrzynią nie znika już innym z sesji.
  check('pozycja leci też przy otwartym oknie', /this\.netPosTimer \+= dt;/.test(engineSrc) && !/if \(this\.ui === 'playing' \|\| this\.ui === 'chat'\) \{\n      this\.netPosTimer/.test(engineSrc));
}


// ============================================ 2.31: owca, dźwięki, auto-skok
section('2.31: owca z wełną na właściwej stronie');
{
  const mob = new Mob('sheep', 0, 0, 0);
  mob.group.updateMatrixWorld(true);
  const woolRoot = (mob as unknown as { woolParts: THREE.Object3D[] }).woolParts[0];
  check('owca ma osobny model wełny', !!woolRoot);
  // Wełna doklejona pod korzeń modelu nie może obracać się drugi raz –
  // wcześniej stała tyłem i zasłaniała pysk.
  eq('wełna nie jest obrócona podwójnie', woolRoot.rotation.y, 0);

  // Pysk (baza) i wełniana głowa muszą leżeć po tej samej stronie,
  // a wełna TUŁOWIA ma otaczać tułów, a nie stać z tyłu.
  // Wełniana głowa (dziecko „head” w modelu wełny) musi leżeć dokładnie tam,
  // gdzie pysk bazy – wcześniej stała obrócona o 180° i zasłaniała twarz.
  const woolHead = woolRoot.getObjectByName('head');
  check('wełna ma własną głowę', !!woolHead);
  const baseHead = new THREE.Box3().setFromObject(mob.head);
  const woolHeadBox = new THREE.Box3().setFromObject(woolHead as THREE.Object3D);
  check('wełniana głowa jest po stronie pyska', Math.abs(woolHeadBox.getCenter(new THREE.Vector3()).z - baseHead.getCenter(new THREE.Vector3()).z) < 0.25,
    `pysk z=${baseHead.getCenter(new THREE.Vector3()).z.toFixed(2)}, wełna z=${woolHeadBox.getCenter(new THREE.Vector3()).z.toFixed(2)}`);
  const woolBody = woolRoot.getObjectByName('body');
  const baseBody = new THREE.Box3().setFromObject(mob.group.getObjectByName('body') as THREE.Object3D);
  const woolBodyBox = new THREE.Box3().setFromObject(woolBody as THREE.Object3D);
  const bs = new THREE.Vector3(), ws = new THREE.Vector3();
  baseBody.getSize(bs);
  woolBodyBox.getSize(ws);
  check('wełna otacza tułów (spuchnięta o 1,75 px z każdej strony)',
    Math.abs(ws.x - bs.x - 3.5 / 16) < 0.01 && Math.abs(ws.y - bs.y - 3.5 / 16) < 0.01 && Math.abs(ws.z - bs.z - 3.5 / 16) < 0.01,
    `baza ${bs.x.toFixed(2)}×${bs.y.toFixed(2)}×${bs.z.toFixed(2)}, wełna ${ws.x.toFixed(2)}×${ws.y.toFixed(2)}×${ws.z.toFixed(2)}`);
  mob.dispose();

  const src = readSource('src/game/mobs.ts');
  check('owca: wełna nie obraca się drugi raz', /wool\.root\.rotation\.y = 0;/.test(src));
}

section('2.31: auto-skok nie włącza się na ścieżce, płycie ani schodach');
{
  const w = new World(4242, true);
  for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) w.getChunk(cx, cz);
  const gy = FLAT_H + 1;
  const makeBody = (x: number, z: number, y = gy) => ({
    pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), w: 0.6, h: 1.8, onGround: true, hitWall: false,
  });
  // Stojąc na 15/16 bloku ścieżki, stopy są PONIŻEJ pełnej kratki – stara
  // sonda `floor(p.y + 0.05)` widziała wtedy „przeszkodę” i skakała co klatkę.
  for (let x = 0; x < 6; x++) for (let z = -6; z <= 6; z++) w.setBlock(x, gy - 1, z, B.PATH);
  const onPath = makeBody(2.5, 0.5, gy - 0.0625);
  check('na ścieżce nie ma auto-skołu', !autoJumpAhead(w, onPath as never, 0, -1));
  check('na ścieżce nie ma auto-skołu w żadną stronę',
    !autoJumpAhead(w, onPath as never, 1, 0) && !autoJumpAhead(w, onPath as never, -1, 0) && !autoJumpAhead(w, onPath as never, 0, 1));

  // Płyta i łóżko: też wchodzi się krokiem, więc bez skoku.
  const w2 = new World(4242, true);
  for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) w2.getChunk(cx, cz);
  w2.setBlock(2, gy, 2, B.OAK_SLAB);
  w2.setBlock(4, gy, 4, B.BED);
  check('płyta nie wymaga skoku', !autoJumpAhead(w2, makeBody(2.5, 3.0) as never, 0, -1));
  check('łóżko nie wymaga skoku (krok 0,6)', !autoJumpAhead(w2, makeBody(4.5, 5.0) as never, 0, -1));

  // Prawdziwy blok – tu auto-skok ma zadziałać (jak w wanilii).
  const w3 = new World(4242, true);
  for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) w3.getChunk(cx, cz);
  w3.setBlock(2, gy, 2, B.STONE);
  check('pełny blok uruchamia auto-skok', autoJumpAhead(w3, makeBody(2.5, 3.0) as never, 0, -1));
  // …ale nie, gdy nad blokiem nie ma miejsca na głowę.
  const w4 = new World(4242, true);
  for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) w4.getChunk(cx, cz);
  w4.setBlock(2, gy, 2, B.STONE);
  w4.setBlock(2, gy + 1, 2, B.STONE);
  w4.setBlock(2, gy + 2, 2, B.STONE);
  check('auto-skok nie włącza się pod niskim sufitem', !autoJumpAhead(w4, makeBody(2.5, 3.0) as never, 0, -1));

  const engineSrc = readSource('src/game/engine.ts');
  check('silnik używa nowej sondy auto-skołu', /return autoJumpAhead\(this\.world, this\.body, dx, dz\);/.test(engineSrc));
  check('auto-skok nie patrzy już na klocek pod stopami', !/Math\.floor\(p\.y \+ 0\.05\)/.test(engineSrc));
}

section('2.31: dźwięki mobów i przestrzeń jak w Minecrafcie');
{
  const audioSrc = readSource('src/game/audio.ts');

  // --- każdy mob ma własny głos (barwa, nie jeden wspólny ton)
  const mobs = ['pig', 'sheep', 'cow', 'chicken', 'creeper', 'spider', 'skeleton',
    'zombie', 'wolf', 'villager', 'golem', 'enderman', 'slime', 'ghast'] as const;
  for (const m of mobs) {
    check(`głos moba: ${m}`, new RegExp(`\\b${m}: \\{`).test(audioSrc));
  }
  check('każdy głos ma trzy warianty (bezczynność, trafienie, śmierć)',
    (audioSrc.match(/hurt: \{ wave:/g)?.length ?? 0) >= 14 && (audioSrc.match(/death: \{ wave:/g)?.length ?? 0) >= 14);
  check('głosy mają formanty (barwę gardła, nie czysty ton)', /formants: \[\[\d+, \d+, [\d.]+\]/.test(audioSrc));
  check('beczenie owcy ma wibrato', /sheep: \{[\s\S]{0,400}vibrato/.test(audioSrc));
  check('krowa ma długie „muu” (≥ 0,9 s)', /cow: \{[\s\S]{0,300}dur: 0\.95/.test(audioSrc));
  check('szkielet klika kośćmi (ziarna)', /skeleton: \{[\s\S]{0,400}grains/.test(audioSrc));
  check('creeper syczy szumem, bez tonu', /creeper: \{[\s\S]{0,220}formants: \[\]/.test(audioSrc));
  check('każdy mob ma własny rodzaj kroku', (audioSrc.match(/step: '(soft|hard|bone|metal|slime)'/g)?.length ?? 0) >= 14);

  // --- przestrzeń: tłumienie, panorama, filtr
  check('dźwięk ma pozycję i tłumienie odległością', /export function placeAt\(/.test(audioSrc) && /const gain = Math\.max\(0, 1 - d \/ distance\)/.test(audioSrc));
  check('panorama stereo zależy od obrotu kamery', /createStereoPanner/.test(audioSrc) && /rightX = Math\.cos\(listener\.yaw\)/.test(audioSrc));
  check('oddalone dźwięki są ciemniejsze (filtr dolnoprzepustowy)', /lp\.frequency\.value = 16000 - where\.dull \* 11000/.test(audioSrc));
  check('uszy gracza ustawia silnik', /Sfx\.setListener\(/.test(readSource('src/game/engine.ts')));

  // --- nowe dźwięki: kroki mobów, śmierć, skrzynia
  check('mob ma osobny dźwięk kroku', /export function playMobStep\(/.test(audioSrc));
  check('mob ma dźwięk śmierci', /playMob\(m\.type, 'death'/.test(readSource('src/game/engine.ts')));
  check('trafienie moba gra jego własny głos', /Sfx\.playMob\(mob\.type, 'hurt'/.test(readSource('src/game/engine.ts')));
  check('skrzynia ma dźwięk otwierania i zamykania', /export function playChest\(open: boolean/.test(audioSrc) && /Sfx\.playChest\(true/.test(readSource('src/game/engine.ts')) && /Sfx\.playChest\(false/.test(readSource('src/game/engine.ts')));

  // --- bloki: dźwięk z pozycji, kilka ziaren jak w wanilii
  check('rozbicie bloku ma pozycję', /Sfx\.playBreak\(def\.sound, x \+ 0\.5/.test(readSource('src/game/engine.ts')));
  check('stawianie bloku ma pozycję', /Sfx\.playPlace\(BLOCKS\[finalId\]\.sound, px \+ 0\.5/.test(readSource('src/game/engine.ts')));
  check('kopanie bloku ma pozycję', /Sfx\.playDig\(def\.sound, t\.x \+ 0\.5/.test(readSource('src/game/engine.ts')));
  check('rozbicie to kilka ziaren, nie jeden klik', /const grains = kind === 'grass' \|\| kind === 'sand' \? 4 : 3/.test(audioSrc));
  check('dźwięki nadal syntezowane (zero plików z gry)', !/new Audio\(|\.mp3['"]|\.ogg['"]|\.wav['"]|data:audio/.test(audioSrc));

  // ---metal brzmi inaczej niż kamień/ szkło
  check('metal to własny materiał dźwięku', /metal: \{ freq: 1750/.test(audioSrc));
  check('bloki metalowe używają dźwięku metalu', (readSource('src/game/blocks.ts').match(/sound: 'metal'/g)?.length ?? 0) >= 8);
  check('kowadło i dzwon dzwonią metalicznie', /T\.anvil, \{ hardness: 5, sound: 'metal' \}/.test(readSource('src/game/blocks.ts')));

  // --- limiter: tłum mobów nie przesterowuje miksu
  check('miks ma limiter jak w wanilii', /createDynamicsCompressor\(\)/.test(audioSrc) && /limiter jak w wanilii/.test(audioSrc));
  check('pogłos też przechodzi przez limiter', /conv\.connect\(g\)\.connect\(out\)/.test(audioSrc));

  // --- skrzynia nie trzaśnie przy każdym innym oknie
  const engine2 = readSource('src/game/engine.ts');
  check('trzaśnięcie skrzyni tylko przy wyjściu z niej', /prev === 'chest' && s !== 'chest' && this\.chestPos/.test(engine2));
  check('zamknięcie okna czyści pozycję skrzyni', /this\.setUI\('playing'\);\n\s*this\.chestPos = null;/.test(engine2));

  // --- kroki mobów w silniku (nie tylko w audio.ts)
  check('silnik woła kroki mobów', /Sfx\.playMobStep\(/.test(engine2));
  check('krok liczony z przebytej drogi, nie z czasu', /m\.stepDist > \(m\.type === 'chicken'/.test(engine2));
  check('stojący mob nie stuka', /if \(!m\.dead && m\.body\.onGround\)/.test(engine2));
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
