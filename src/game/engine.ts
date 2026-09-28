import * as THREE from 'three';
import { World, CS, CH, SEA, plantTree, type Biome } from './world';
import { DiscoveryMap, type DiscoverySave } from './discoveryMap';
import { CHALLENGES, normalizeChallenges, type ChallengeId, type ChallengeProgress } from './challenges';
import { DEFAULT_DIFFICULTY, normalizeDifficulty, hostileCap, hostileSpeed, mobDamage, resourceDropCount, animalMeatYield, type WorldDifficulty } from './difficulty';
import { B, BLOCKS, IS_SOLID, RENDER, tileFor, isDoor, isDoorOpen, isDoorTop, isLadder, isTrap, isTrapOpen, doorFacing, doorPair, ladderFacing, facingFromNormal, isStairs, stairsBase, isSlab, slabBase, slabFullBlock, isPiston } from './blocks';
import { tickRedstone, toggleLever as rsToggleLever, pressButton as rsPressButton, tryCreatePortal } from './redstone';
import { biteDelay, cookedOf, isFishStack, rollCatch, BITE_WINDOW, PATIENCE, type BaitId } from './fishing';
import { anvilKey, anvilResult, cleanItemName, emptyAnvil, type AnvilResult, type AnvilState } from './anvil';
import {
  BREW_FUELS, BREWING_INGREDIENTS, HEAL_AMOUNT, SPEED_FACTOR, STRENGTH_DAMAGE, POTIONS,
  brewingKey, emptyBrewing, tickBrewing, sprintFactor, fallDamageAfterPotion, restoreEffects,
  type BrewingState, type PotionEffectId,
} from './brewing';
import { getAtlas, compactAtlas, tileUV, AVG_COLOR } from './textures';
import { stepBody, aabbIntersectsBlock, slimeBounce, type Body } from './physics';
import { Mob, isHostileMob, pickPassiveMob, type FoxFood, type MobType } from './mobs';

/** Mobs that attack the player – used for the night/cave spawn cap. */
const HOSTILE_MOBS: ReadonlySet<MobType> = new Set<MobType>(['zombie', 'creeper', 'skeleton', 'spider', 'enderman', 'slime', 'ghast']);
import { Inventory, RECIPES, type Stack } from './inventory';
import {
  rollEnchantOptions, countShelves, canAddEnch, addEnch, enchLevel, enchName,
  canEnchant, resolveEnch, ENCHANTS, enchList, wearChance,
  sharpnessDamage, knockbackFactor, powerFactor, totalProtection, fallDamageFactor,
  type EnchOption,
} from './enchant';
import * as Sfx from './audio';
import { patchChunkMaterial } from './lighting';
import { buildItemIcons } from './itemIcons';
import { GAME_RELEASE_NAME, GAME_VERSION } from '../utils/version';
import {
  ITEMS, I, displayName, isItem, isFood, isPotion, isHoe, mineSeconds, attackDamage, attackCooldown,
  blockDrops, toolHelps, isOre, smeltResult, fuelSeconds, resolveId, stackLimit, pickHint, oreXp,
} from './items';
import { type FurnaceState, emptyFurnace, furnaceKey, tickFurnace } from './furnace';
import { type ChestState, chestKey, emptyChest, lootChest } from './chest';
import { achievementById, BIOME_DISCOVERY_GOALS } from './achievements';
import { upsertSave } from './saves';
import { Xp } from './xp';
import { armorPoints, damageReduction, armorSlotOf, ARMOR_SLOT_COUNT } from './armor';
import {
  applyTrade,
  canTrade,
  offersFor,
  professionFor,
  restockIfDue,
  restockIn,
  usesLeft,
  villagerLevel,
  villagerProgress,
  villagerTitle,
  PROFESSIONS,
  createVillagerState,
  type TradeBlock,
  type TradeOffer,
  type VillagerState,
} from './trading';
import { villageSpawnSpots } from './village';
import { isVillageMob } from './mobs';

export type GameMode = 'survival' | 'creative';
export type UIState = 'playing' | 'paused' | 'inventory' | 'chat' | 'dead' | 'furnace' | 'chest' | 'enchant' | 'trade' | 'journal' | 'waypoints' | 'biomeCompass' | 'anvil' | 'brewing';

export interface Waypoint {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  dimension: 'overworld' | 'nether';
  kind?: 'custom' | 'death';
}

export interface HUDState {
  hotbar: (Stack | null)[];
  selected: number;
  health: number;
  air: number;
  maxAir: number;
  mode: GameMode;
  fps: number;
  pos: [number, number, number];
  facing: string;
  biome: Biome;
  chunks: number;
  time: number;
  target: string;
  underwater: boolean;
  inLava: boolean;
  flying: boolean;
  debug: boolean;
  hurtCount: number;
  mobs: number;
  seed: number;
  messages: { text: string; t: number }[];
  loading: number;
  day: number;
  locked: boolean;
  hunger: number;
  weather: 'clear' | 'rain';
  toast: { title: string; text: string } | null;
  sprinting: boolean;
  worldName: string;
  worldType: 'normal' | 'flat';
  minimap: boolean;
  heldHint: string | null;
  /** -1 when the bow is idle, otherwise the draw charge 0–1. */
  bow: number;
  /** Experience level (bar above the hotbar). */
  level: number;
  /** 0–1 progress inside the current level. */
  xpFrac: number;
  /** Four equipped armor pieces (head, chest, legs, feet). */
  armor: (Stack | null)[];
  /** Sum of armor points of the equipped pieces. */
  armorPoints: number;
  /** 1.6: co jest pod celownikiem (mob) – nazwa i wskazówka. */
  mobHint: string | null;
  /** 1.6: opis najbliższej wioski, gdy gracz jest na jej terenie. */
  village: string | null;
  /** 1.6: liczba udanych wymian z mieszkańcami. */
  trades: number;
  /** 2.0: bieżąca skala rozdzielczości (dynamiczna rozdzielczość). */
  resScale: number;
  /** 2.5: czy gra używa wersji dotykowej (podpowiedzi HUD adaptują treść). */
  touch: boolean;
  /** 2.5: chwilowe „cooldown” po wyjściu z blokady kursora (Esc w Chrome). */
  lockCooldown: boolean;
  /** 2.0: czy pokazywać wzmocniony licznik FPS w HUD. */
  showFps: boolean;
  /** 2.0: wywołania rysowania w ostatniej klatce (debug). */
  drawCalls: number;
  /** 2.2: aktywny cel nawigacji w tym wymiarze. */
  waypoint: { name: string; distance: number; direction: string; bearing: number } | null;
  /** 2.3: lorneta w dłoni – pole widzenia jest zwężone. */
  zoom: boolean;
  /** 2.3: stan wędkarstwa: 'idle' | 'cast' | 'waiting' | 'bite'. */
  fishing: 'idle' | 'cast' | 'waiting' | 'bite';
  bait?: string | null;
  /** 2.4: aktywne efekty napojów (ikona, nazwa, sekundy pozostałe). */
  effects: { id: string; icon: string; name: string; left: number }[];
  challenges: ChallengeProgress;
}

export interface TradeRow {
  /** Pozycja oferty w liście – podawana do tradeWith(). */
  index: number;
  offer: TradeOffer;
  /** Ile wymian zostało do wyczerpania zapasów. */
  left: number;
  max: number;
  blocked: 'ok' | 'uses' | 'items' | 'space';
}

export interface SaveData {
  seed: number;
  mode: GameMode;
  mods: Record<string, number[]>;
  pos: [number, number, number];
  yaw: number;
  pitch: number;
  inv: (Stack | null)[];
  time: number;
  health: number;
  day: number;
  id?: string;
  name?: string;
  worldType?: 'normal' | 'flat';
  /** Missing in older saves: keep the original 2.7 generator for them. */
  terrainVersion?: 2 | 3;
  updated?: number;
  hunger?: number;
  spawn?: [number, number, number];
  furnaces?: FurnaceState[];
  chests?: ChestState[];
  unlocked?: string[];
  weather?: 'clear' | 'rain';
  xp?: number;
  armor?: (Stack | null)[];
  /** 1.6: licznik wymian (osiągnięcie „Kupiec”). */
  trades?: number;
  /** 1.8: modyfikacje bloków w Netherze – osobny wymiar, osobny zapis. */
  netherMods?: Record<string, number[]>;
  /** 1.8: czy zapis jest w środku Netheru. */
  isInNether?: boolean;
  /** 1.8: powrót do nadświatu – pozycja portalu, przez który gracz wszedł. */
  portalExit?: [number, number, number];
  /** 2.2: własne punkty nawigacyjne i aktualnie śledzony punkt. */
  waypoints?: Waypoint[];
  activeWaypointId?: string | null;
  /** 2.3: zawartość kowadeł (scalanie i przemianowywanie narzędzi). */
  anvils?: AnvilState[];
  /** 2.3: ile ryb udało się złowić (osiągnięcie „Wędkarz”). */
  fishCaught?: number;
  /** Prepared bait, already removed from inventory; expires after a bite. */
  fishingBait?: BaitId | null;
  /** 2.4: zawartość statywów alchemicznych (fiolki, składnik, paliwo). */
  brewings?: BrewingState[];
  /** 2.4: wypiłe typy napojów (osiągnięcie „Mistrz eliksirów”). */
  potionsDrunk?: number[];
  /** Milliseconds remaining per effect; optional in saves predating 3.0. */
  effects?: Record<string, number>;
  /** Optional 3.0 per-world rules. Older worlds use the 2.7 normal defaults. */
  difficulty?: WorldDifficulty;
  challengeProgress?: ChallengeProgress;
  /** Explored chunk tiles, stored separately for both dimensions. Absent in 2.x saves. */
  discovery?: DiscoverySave;
}

export const SAVE_KEY = 'blockcraft-save-v1';

/** 2.4: ikona i nazwa wzmocnienia dla HUD-u (klucz = PotionEffectId bez 'none'). */
const EFFECT_META: Record<Exclude<PotionEffectId, 'none'>, { icon: string; name: string }> = {
  heal: { icon: '❤', name: 'Leczenie' },
  fire: { icon: '🔥', name: 'Ognioodporność' },
  speed: { icon: '🏃', name: 'Szybkość' },
  night: { icon: '👁', name: 'Nocne widzenie' },
  strength: { icon: '💪', name: 'Siła' },
  regen: { icon: '✚', name: 'Regeneracja' },
  fall: { icon: '🪶', name: 'Lekkie lądowanie' },
  sprint: { icon: '⚡', name: 'Zryw' },
};

/** Polskie nazwy mobów – używane w podpowiedzi pod celownikiem. */
export const MOB_NAMES: Record<MobType, string> = {
  pig: 'Świnia',
  rabbit: 'Królik',
  fox: 'Lis',
  sheep: 'Owca',
  cow: 'Krowa',
  chicken: 'Kurczak',
  wolf: 'Wilk',
  zombie: 'Zombie',
  creeper: 'Creeper',
  spider: 'Pająk',
  skeleton: 'Szkielet',
  villager: 'Mieszkaniec',
  golem: 'Żelazny golem',
  enderman: 'Enderman',
  slime: 'Slime',
  ghast: 'Ghast',
};

/** A sand/gravel block tumbling down until it lands. */
interface FallingBlock {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: number;
  id: number;
}

/**
 * Everything that lives in ONE dimension and must never leak into the other:
 * mobs, ground items, arrows, TNT, XP orbs, falling blocks and the redstone
 * timers. Stashed whole (meshes included) when the player uses a portal.
 */
interface DimStash {
  mobs: Mob[];
  drops: DropEntity[];
  arrows: ArrowEntity[];
  tnts: TNTEntity[];
  orbs: { mesh: THREE.Mesh; pos: THREE.Vector3; vel: THREE.Vector3; value: number; age: number }[];
  falling: FallingBlock[];
  buttons: [string, number][];
  redstone: string[];
}

function emptyStash(): DimStash {
  return { mobs: [], drops: [], arrows: [], tnts: [], orbs: [], falling: [], buttons: [], redstone: [] };
}

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  max: number;
  gravity: number;
  grow?: number;
}

interface TNTEntity {
  mesh: THREE.Mesh;
  body: Body;
  fuse: number;
}

interface ArrowEntity {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  power: number;
  /** The mob that fired it, or null when the player shot it. */
  from: Mob | null;
  /** Perła Endu: nie rani, tylko teleportuje gracza w miejsce upadku (1.9). */
  pearl?: boolean;
}

interface DropEntity {
  id: number;
  count: number;
  dur?: number;
  ench?: Record<string, number>;
  name?: string;
  mesh: THREE.Object3D;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
}

/** 2.3: spławik wędkarstwa – lekki, tonie w wodzie i czeka na brań. */
interface Bobber {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  /** flying – w locie, rest – leży, water – czeka, bite – brań, reeling – wraca. */
  state: 'flying' | 'rest' | 'water' | 'bite' | 'reeling';
  /** Ile przynęta czeka (s) – po tym czasie woda ją zmywa. */
  wait: number;
  /** Kiedy nadeszła brań – czas oczekiwania na branie (s). */
  biteAt: number;
  /** Ile zostało na branie (s). */
  window: number;
}

function blockGeometry(id: number): THREE.BufferGeometry {
  if (RENDER[id] === 1) {
    const g = new THREE.PlaneGeometry(1, 1);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const t = tileFor(id, 0);
    for (let i = 0; i < uv.count; i++) {
      const [U, V] = tileUV(t, Math.round(uv.getX(i)), Math.round(uv.getY(i)));
      uv.setXY(i, U, V);
    }
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(uv.count * 3).fill(1), 3));
    return g;
  }
  const g = new THREE.BoxGeometry(1, 1, 1);
  const faceMap = [1, 0, 3, 2, 5, 4];
  const shades = [0.62, 0.62, 1, 0.5, 0.8, 0.8];
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const cols = new Float32Array(uv.count * 3);
  for (let f = 0; f < 6; f++) {
    const tile = tileFor(id, faceMap[f]);
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      const [U, V] = tileUV(tile, Math.round(uv.getX(i)), Math.round(uv.getY(i)));
      uv.setXY(i, U, V);
      const s = shades[f] * shades[f];
      cols[i * 3] = cols[i * 3 + 1] = cols[i * 3 + 2] = s;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g;
}

function makeCanvasTex(size: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  draw(ctx);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const FACING = ['Północ (-Z)', 'Zachód (-X)', 'Południe (+Z)', 'Wschód (+X)'];

export class Game {
  container: HTMLElement;
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  world: World;
  /** Nadświat – zawsze tickuje i zapisuje się niezależnie od tego, gdzie jest gracz. */
  homeWorld: World;
  /** Nether – osobny wymiar z własnymi chunkami i modyfikacjami. */
  netherWorld: World;
  /** Powrót: pozycja (stopy) portalu w nadświanie, przez który gracz wszedł. */
  portalExit: [number, number, number] | null = null;
  /** Obiekty odłożone na czas pobytu w drugim wymiarze. */
  private dimStash = { home: emptyStash(), nether: emptyStash() };
  mode: GameMode;
  ui: UIState = 'paused';
  inventory = new Inventory();
  selected = 0;
  icons: Record<number, string>;
  craftingTable = false;
  renderDistance = 6;
  sensitivity = 1;
  fovBase = 72;

  // ——— 2.0: automat graficzny ———
  /** Sprzętowy pixel ratio ograniczony do 2 – punkt wyjścia dla skalowania. */
  basePixelRatio = 1;
  /** Bieżąca skala rozdzielczości (dynamiczna rozdzielczość, 0.55–1). */
  resScale = 1;
  /** Czy silnik może sam zmieniać rozdzielczość (DRS). */
  drEnabled = true;
  private drCooldown = 2;
  /** Twardy limit klatek (0 = bez limitu). Oszczędza baterię na telefonach. */
  fpsCap = 0;
  /** Budżety jakości ustawiane przez applyGfx(). */
  gfx = { chunkBudgetMs: 12, chunksPerFrame: 3, unloadMargin: 2, particleScale: 1, requestedParticles: 1, effectDetail: 'full' as 'low' | 'full', clouds: true };
  /** Automatyczne wskakiwanie na 1-blokowe schodki (sterowanie mobilne). */
  autoJump = false;
  /** Krótkie wibracje przy kopaniu i obrażeniach. */
  haptics = false;
  viewBobbing = true;
  showFps = false;
  /** Telefon nie używa Pointer Lock — blokował on gesty w części mobilnych przeglądarek. */
  touchInput = false;
  /** Cel dotyku w NDC (-1..1) – gdy ustawione, celownik podąża za palcem. */
  touchAim: { x: number; y: number } | null = null;
  /** Kierunek celowania z ostatniej klatki (crosshair albo palec). */
  aimDir: THREE.Vector3 | null = null;
  /** Ostatni automatyczny skok – anty-drganiowa przerwa. */
  private autoJumpCd = 0;

  // player
  body: Body = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), w: 0.6, h: 1.8, onGround: false, hitWall: false };
  yaw = 0;
  pitch = 0;
  health = 20;
  hunger = 20;
  air = 12;
  maxAir = 12;
  flying = false;
  sprinting = false;
  eyeHeight = 1.62;
  fallStart = 0;
  hurtCount = 0;
  lastHurt = 0;
  regenAcc = 0;
  drownAcc = 0;
  starveAcc = 0;
  lavaAcc = 0;
  stepDist = 0;
  bobPhase = 0;
  shake = 0;
  spawnPoint = new THREE.Vector3();

  // input
  keys = new Set<string>();
  mouseLeft = false;
  mouseRight = false;
  locked = false;
  /** 2.5: kiedy ostatnio utracono blokadę kursora (Esc cooldown w Chrome). */
  lastLockExit = 0;
  lastSpace = 0;
  lastW = 0;
  debug = false;

  // interaction
  target: ReturnType<World['raycast']> = null;
  breakProgress = 0;
  breakKey = '';
  breakCooldown = 0;
  placeCooldown = 0;
  attackCooldown = 0;
  digSoundTimer = 0;
  swingT = 1;

  // world time
  time = 0.03;
  day = 1;

  // rendering
  materials: THREE.Material[];
  atlasTex: THREE.Texture;
  private fullAtlasCanvas!: HTMLCanvasElement;
  private lowAtlasCanvas: HTMLCanvasElement | null = null;
  private textureDetail: 'low' | 'full' = 'full';
  selection: THREE.LineSegments;
  crackMesh: THREE.Mesh;
  crackTex: THREE.Texture[];
  hand = new THREE.Group();
  handMesh: THREE.Mesh | null = null;
  handId = -2;
  handMat: THREE.MeshBasicMaterial;
  sun: THREE.Mesh;
  moon: THREE.Mesh;
  stars: THREE.Points;
  clouds: THREE.Mesh;
  cloudTex: THREE.Texture;
  ambient: THREE.HemisphereLight;
  dirLight: THREE.DirectionalLight;
  particleGeo = new THREE.BoxGeometry(1, 1, 1);
  particleMats = new Map<number, THREE.MeshBasicMaterial>();
  particles: Particle[] = [];
  tnts: TNTEntity[] = [];
  mobs: Mob[] = [];
  tntGeo: THREE.BufferGeometry;
  drops: DropEntity[] = [];
  furnaces = new Map<string, FurnaceState>();
  furnacePos: { x: number; y: number; z: number } | null = null;
  chests = new Map<string, ChestState>();
  chestPos: { x: number; y: number; z: number } | null = null;
  /** 2.3: kowadła – PPM otwiera ekran scalania i przemianowywania. */
  anvils = new Map<string, AnvilState>();
  anvilPos: { x: number; y: number; z: number } | null = null;
  /** 2.4: statywy alchemiczne – PPM otwiera ekran warzenia napojów. */
  brewings = new Map<string, BrewingState>();
  brewingPos: { x: number; y: number; z: number } | null = null;
  /** Aktywne efekty napojów (id → pozostałe ms), zachowywane w zapisie. */
  private effects = new Map<PotionEffectId, number>();
  difficulty: WorldDifficulty = { ...DEFAULT_DIFFICULTY };
  challengeProgress: ChallengeProgress = normalizeChallenges(undefined);
  /** 2.4: odliczanie leczenia z napoju regeneracji. */
  private potionRegenAcc = 0;
  /** 2.4: jakie butelki gracz kiedykolwiek wypił (osiągnięcie „Mistrz eliksirów”). */
  potionsDrunk = new Set<number>();
  /** 2.3: aktywna wędka (spławik w locie / w wodzie). */
  private bobber: Bobber | null = null;
  private bobberGeo: THREE.BoxGeometry | null = null;
  private bobberMat: THREE.MeshBasicMaterial | null = null;
  /** 2.3: licznik złowionych ryb (zapisuje się ze światem). */
  fishCaught = 0;
  fishingBait: BaitId | null = null;
  /** 2.3: lorneta – prawy przycisk myszy w dłoni. */
  private zooming = false;
  /** 2.5: podgląd lornety dla sterowania dotykowego (spowolnienie gestu). */
  isZooming() {
    return this.zooming;
  }
  /** 2.3: sekundy regeneracji po uratowaniu przez totem. */
  private totemHeal = 0;
  private campfireHurt = 0;
  private arrows: ArrowEntity[] = [];
  private arrowGeo!: THREE.BufferGeometry;
  private arrowMat!: THREE.MeshBasicMaterial;
  /** Experience – persisted as a total, level derived from the curve. */
  xp = new Xp(0);
  /** Equipped armor: [head, chest, legs, feet]. */
  armor: (Stack | null)[] = new Array(ARMOR_SLOT_COUNT).fill(null);
  /** Floating XP orbs dropped by mobs and ores. */
  private orbs: { mesh: THREE.Mesh; pos: THREE.Vector3; vel: THREE.Vector3; value: number; age: number }[] = [];
  private orbGeo!: THREE.BufferGeometry;
  private orbMat!: THREE.MeshBasicMaterial;
  /** Seconds the bow has been drawn, -1 when idle. */
  private bowDraw = -1;
  /** Rzuty perłą Endu mają krótki odstęp (1.9). */
  private pearlCd = 0;
  private pearlGeo: THREE.SphereGeometry | null = null;
  private pearlMat: THREE.MeshBasicMaterial | null = null;
  private biomeCache = new Map<string, Biome>();
  /** Stół zaklęć: gdzie stoi i co właśnie w nim siedzi. */
  enchantPos: { x: number; y: number; z: number } | null = null;
  enchantItem: Stack | null = null;
  enchOptions: EnchOption[] = [];
  /** 1.6: mieszkaniec, z którym właśnie handlujemy. */
  tradeMob: Mob | null = null;
  /** 1.6: liczba udanych wymian i wioski już odwiedzone w tej sesji. */
  trades = 0;
  private villageSeen = new Set<string>();
  private villageName: string | null = null;
  private villageCheck = 0;
  worldId = '';
  worldName = 'Świat';
  worldType: 'normal' | 'flat' = 'normal';
  unlocked = new Set<string>();
  toast: { title: string; text: string; at: number } | null = null;
  showMinimap = true;
  /** 2.2: maksymalnie 12 znaczników na świat, w tym automatyczny punkt śmierci. */
  waypoints: Waypoint[] = [];
  discovery = new DiscoveryMap();
  activeWaypointId: string | null = null;
  minimapCanvas!: HTMLCanvasElement;
  private minimapCtx!: CanvasRenderingContext2D;
  private minimapImg: ImageData | null = null;
  private uDay = { value: 1 };
  private dropMat!: THREE.MeshBasicMaterial;
  private itemTex = new Map<number, THREE.Texture>();
  private dropGeos = new Map<number, THREE.BufferGeometry>();
  private falling: FallingBlock[] = [];
  /** Leaves waiting to fall apart after their tree lost its last log. */
  private leafDecay: { x: number; y: number; z: number; t: number }[] = [];
  private growables = new Map<string, number>();
  private buttonTimers = new Map<string, number>();
  private redstoneDirty = new Set<string>();
  portalCooldown = 0;
  isInNether = false;
  private growAcc = 0;
  private growCursor = 0;
  private eatCooldown = 0;
  private toldPick = false;
  private wasInWater = false;
  weather: 'clear' | 'rain' = 'clear';
  private weatherTimer = 70;
  private lightning = 0;
  private musicTimer = 90 + Math.random() * 150;
  private ambientTimer = 12 + Math.random() * 18;
  private underground = false;
  private nextBolt = 12;
  private rain!: THREE.Points;
  private rainGeo!: THREE.BufferGeometry;

  private offsets: [number, number][] = [];
  private raf = 0;
  private lastTime = performance.now();
  private hudTimer = 0;
  private fpsFrames = 0;
  private fpsTime = 0;
  private fps = 0;
  private spawnTimer = 0;
  private unloadTimer = 0;
  private saveTimer = 0;
  private messages: { text: string; t: number }[] = [];
  private loadingProgress = 0;
  private onHud: (h: HUDState) => void;
  private onUI: (s: UIState) => void;
  private listeners: [EventTarget, string, EventListener, AddEventListenerOptions | undefined][] = [];

  constructor(
    container: HTMLElement,
    opts: { seed: number; mode: GameMode; save?: SaveData; renderDistance?: number; worldId?: string; worldName?: string; worldType?: 'normal' | 'flat' },
    cb: { onHud: (h: HUDState) => void; onUI: (s: UIState) => void }
  ) {
    this.container = container;
    this.onHud = cb.onHud;
    this.onUI = cb.onUI;
    this.mode = opts.save ? opts.save.mode : opts.mode;
    this.renderDistance = opts.renderDistance ?? 6;
    this.worldId = opts.worldId || opts.save?.id || 'w' + Date.now().toString(36);
    this.worldName = opts.worldName || opts.save?.name || 'Świat';
    const seed = opts.save ? opts.save.seed : opts.seed;
    const worldType = opts.save?.worldType ?? opts.worldType ?? 'normal';
    this.worldType = worldType;
    this.world = new World(seed, worldType === 'flat', false, opts.save && opts.save.terrainVersion !== 3 ? 2 : 3);
    this.homeWorld = this.world;
    // Nether istnieje od razu jako osobny wymiar – nigdy nie nadpisuje nadświatu.
    this.netherWorld = new World(seed, false, true);
    if (opts.save) {
      this.world.loadMods(opts.save.mods);
      this.netherWorld.loadMods(opts.save.netherMods ?? {});
    }

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.basePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(Math.min(this.basePixelRatio, 1.5));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.domElement.style.display = 'block';
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(this.fovBase, container.clientWidth / container.clientHeight, 0.05, 1200);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.scene.fog = new THREE.Fog(0x88bbff, 20, this.renderDistance * CS);

    const atlas = getAtlas();
    this.fullAtlasCanvas = atlas.canvas;
    this.icons = { ...atlas.icons, ...buildItemIcons() };
    const tex = new THREE.CanvasTexture(atlas.canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.atlasTex = tex;
    this.materials = [
      new THREE.MeshBasicMaterial({ map: tex, vertexColors: true }),
      new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide }),
      new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    ];
    for (const m of this.materials) patchChunkMaterial(m as THREE.MeshBasicMaterial, this.uDay);
    this.dropMat = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, alphaTest: 0.4, side: THREE.DoubleSide });
    this.crackTex = atlas.cracks.map((c) => {
      const t = new THREE.CanvasTexture(c);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      return t;
    });

    // selection box
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004));
    this.selection = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }));
    this.selection.visible = false;
    this.scene.add(this.selection);
    this.crackMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.006, 1.006, 1.006),
      new THREE.MeshBasicMaterial({ map: this.crackTex[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })
    );
    this.crackMesh.visible = false;
    this.scene.add(this.crackMesh);

    // lights for mobs
    this.ambient = new THREE.HemisphereLight(0xffffff, 0x666666, 1.2);
    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.scene.add(this.ambient, this.dirLight, this.dirLight.target);

    // sky objects
    const sunTex = makeCanvasTex(32, (c) => {
      c.fillStyle = 'rgba(255,240,150,0.25)';
      c.fillRect(0, 0, 32, 32);
      c.fillStyle = '#fff8c0';
      c.fillRect(6, 6, 20, 20);
      c.fillStyle = '#ffffff';
      c.fillRect(9, 9, 14, 14);
    });
    this.sun = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false, depthWrite: false }));
    const moonTex = makeCanvasTex(32, (c) => {
      c.fillStyle = '#dde2ee';
      c.fillRect(8, 8, 16, 16);
      c.fillStyle = '#9aa0b0';
      c.fillRect(11, 11, 4, 4);
      c.fillRect(18, 16, 3, 3);
      c.fillRect(13, 19, 2, 2);
    });
    this.moon = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, fog: false, depthWrite: false }));
    this.sun.renderOrder = -1;
    this.moon.renderOrder = -1;
    this.scene.add(this.sun, this.moon);
    const starPos: number[] = [];
    for (let i = 0; i < 1500; i++) {
      const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar(500);
      starPos.push(v.x, v.y, v.z);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false }));
    this.scene.add(this.stars);

    this.cloudTex = makeCanvasTex(128, (c) => {
      c.clearRect(0, 0, 128, 128);
      c.fillStyle = '#ffffff';
      for (let i = 0; i < 90; i++) {
        const x = Math.floor(Math.random() * 128), y = Math.floor(Math.random() * 128);
        const w = 2 + Math.floor(Math.random() * 7), h = 2 + Math.floor(Math.random() * 5);
        c.fillRect(x, y, w, h);
        c.fillRect((x + 64) % 128, y, 1, 1);
      }
    });
    this.cloudTex.wrapS = this.cloudTex.wrapT = THREE.RepeatWrapping;
    this.cloudTex.repeat.set(2, 2);
    this.clouds = new THREE.Mesh(
      new THREE.PlaneGeometry(2400, 2400),
      new THREE.MeshBasicMaterial({ map: this.cloudTex, transparent: true, opacity: 0.8, fog: false, depthWrite: false, side: THREE.DoubleSide })
    );
    this.clouds.rotation.x = -Math.PI / 2;
    this.scene.add(this.clouds);

    // hand
    this.handMat = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, depthTest: false, alphaTest: 0.3, side: THREE.FrontSide });
    this.camera.add(this.hand);
    this.tntGeo = blockGeometry(B.TNT);
    this.arrowGeo = new THREE.BoxGeometry(0.09, 0.09, 0.78);
    this.arrowMat = new THREE.MeshBasicMaterial({ color: 0x9a7a4a });
    this.orbGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    this.orbMat = new THREE.MeshBasicMaterial({ color: 0x8ef55a });

    this.computeOffsets();

    // Player setup
    if (opts.save) {
      this.body.pos.set(...opts.save.pos);
      this.yaw = opts.save.yaw;
      this.pitch = opts.save.pitch;
      this.time = opts.save.time;
      this.health = opts.save.health > 0 ? opts.save.health : 20;
      this.hunger = opts.save.hunger ?? 20;
      this.day = opts.save.day || 1;
      opts.save.inv.forEach((s, i) => (this.inventory.slots[i] = s ? { ...s } : null));
      for (const f of opts.save.furnaces ?? []) this.furnaces.set((f.dim ? 'n:' : '') + furnaceKey(f.x, f.y, f.z), { ...f, input: f.input ? { ...f.input } : null, fuel: f.fuel ? { ...f.fuel } : null, output: f.output ? { ...f.output } : null });
      for (const c of opts.save.chests ?? []) this.chests.set((c.dim ? 'n:' : '') + chestKey(c.x, c.y, c.z), { x: c.x, y: c.y, z: c.z, dim: c.dim, slots: (c.slots ?? []).slice(0, 27).map((s) => (s ? { ...s } : null)) });
      for (const a of opts.save.anvils ?? []) {
        if (!a || typeof a.x !== 'number' || typeof a.y !== 'number' || typeof a.z !== 'number') continue;
        this.anvils.set((a.dim ? 'n:' : '') + anvilKey(a.x, a.y, a.z), {
          x: a.x, y: a.y, z: a.z, dim: a.dim,
          a: a.a ? { ...a.a, ench: a.a.ench ? { ...a.a.ench } : undefined } : null,
          b: a.b ? { ...a.b, ench: a.b.ench ? { ...a.b.ench } : undefined } : null,
          name: cleanItemName(a.name ?? ''),
          burn: a.burn ?? 0, burnMax: a.burnMax ?? 0,
        });
      }
      // 2.4: statywy alchemiczne – fiolki, składnik i paliwo wracają do kotła.
      for (const b of opts.save.brewings ?? []) {
        if (!b || typeof b.x !== 'number' || typeof b.y !== 'number' || typeof b.z !== 'number') continue;
        const clean = emptyBrewing(b.x, b.y, b.z);
        clean.dim = b.dim;
        clean.bottles = (Array.isArray(b.bottles) ? b.bottles : []).slice(0, 3).map((s) => (s && typeof s.id === 'number' ? { ...s } : null));
        while (clean.bottles.length < 3) clean.bottles.push(null);
        clean.ingredient = b.ingredient && typeof b.ingredient.id === 'number' ? { ...b.ingredient } : null;
        clean.fuel = b.fuel && typeof b.fuel.id === 'number' ? { ...b.fuel } : null;
        clean.fuelLeft = Math.max(0, Math.min(BREW_FUELS, Math.floor(b.fuelLeft ?? 0)));
        clean.progress = Math.max(0, Math.min(8, b.progress ?? 0));
        this.brewings.set((b.dim ? 'n:' : '') + brewingKey(b.x, b.y, b.z), clean);
      }
      this.effects = restoreEffects(opts.save.effects);
      this.difficulty = normalizeDifficulty(opts.save.difficulty);
      this.fishCaught = Math.max(0, Math.floor(opts.save.fishCaught ?? 0));
      this.fishingBait = opts.save.fishingBait === I.WORM_BAIT || opts.save.fishingBait === I.GLOW_BAIT ? opts.save.fishingBait : null;
      for (const id of Array.isArray(opts.save.potionsDrunk) ? opts.save.potionsDrunk : []) {
        if (typeof id === 'number' && POTIONS[id]) this.potionsDrunk.add(id);
      }
      for (const id of opts.save.unlocked ?? []) this.unlocked.add(id);
      this.challengeProgress = normalizeChallenges(opts.save.challengeProgress, this.unlocked);
      this.weather = opts.save.weather === 'rain' ? 'rain' : 'clear';
      this.xp = new Xp(opts.save.xp ?? 0);
      // Pre-3.0 explorers with three recorded biome visits deserve the new
      // chapter reward once, even if all six biomes were already visited.
      if (this.challengeProgress.challenge_explorer >= CHALLENGES.challenge_explorer.target && !this.unlocked.has('challenge_explorer')) {
        this.unlocked.add('challenge_explorer');
        this.xp.add(CHALLENGES.challenge_explorer.rewardXp);
      }
      this.trades = opts.save.trades ?? 0;
      this.discovery = DiscoveryMap.fromSave(opts.save.discovery);
      this.waypoints = (opts.save.waypoints ?? []).filter((w) =>
        w && typeof w.id === 'string' && typeof w.name === 'string' &&
        Number.isFinite(w.x) && Number.isFinite(w.y) && Number.isFinite(w.z) &&
        (w.dimension === 'overworld' || w.dimension === 'nether')
      ).slice(0, 12).map((w) => ({ ...w, name: w.name.slice(0, 32) }));
      this.activeWaypointId = this.waypoints.some((w) => w.id === opts.save?.activeWaypointId) ? (opts.save.activeWaypointId ?? null) : null;
      if (opts.save.armor) {
        for (let i = 0; i < ARMOR_SLOT_COUNT; i++) {
          const s = opts.save.armor[i];
          this.armor[i] = s ? { id: s.id, count: s.count, dur: s.dur, ench: s.ench ? { ...s.ench } : undefined } : null;
        }
      }
      if ((opts.save.day || 1) >= 2) this.unlocked.add('night');
      this.findSpawn();
      if (opts.save.spawn) this.spawnPoint.set(...opts.save.spawn);
      // Zapis w Netherze: aktywuj wymiar PRZED wczytaniem chunków wokół gracza.
      if (opts.save.isInNether) {
        this.world = this.netherWorld;
        this.isInNether = true;
        this.portalExit = opts.save.portalExit ?? null;
      }
      this.world.getChunk(Math.floor(this.body.pos.x / CS), Math.floor(this.body.pos.z / CS));
    } else {
      this.findSpawn();
      this.body.pos.copy(this.spawnPoint);
      this.giveStarterItems();
    }
    this.fallStart = this.body.pos.y;

    // Build nearby chunks right away
    const pcx = Math.floor(this.body.pos.x / CS), pcz = Math.floor(this.body.pos.z / CS);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) this.buildChunk(pcx + dx, pcz + dz);

    this.bindEvents();
    this.updateHand();
    this.initWeather();
    this.minimapCanvas = document.createElement('canvas');
    this.minimapCanvas.width = this.minimapCanvas.height = 96;
    this.minimapCtx = this.minimapCanvas.getContext('2d')!;
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
    this.message(this.mode === 'creative'
      ? 'Tryb kreatywny. K – mapa i punkty podróży, J – dziennik; użyj kompasu biomów, aby wyszukać cel.'
      : `BlockCraft ${GAME_VERSION} „${GAME_RELEASE_NAME}”: szukaj receptur po nazwie lub składniku; pełny ekwipunek nie gubi łupu. K – mapa odkrywania i punkty podróży, J – dziennik. Na telefonie tapnij, aby użyć, przytrzymaj, aby kopać.`);
  }

  /** True when solid rock covers the player – used for cave ambience. */
  private checkUnderground() {
    const x = Math.floor(this.body.pos.x), y = Math.floor(this.body.pos.y), z = Math.floor(this.body.pos.z);
    for (let dy = 1; dy <= 26; dy++) {
      const id = this.world.peekBlock(x, y + dy, z);
      if (id === B.AIR) continue;
      this.underground = IS_SOLID[id] !== 0 || RENDER[id] === 1;
      return;
    }
    this.underground = false;
  }

  private initWeather() {
    const N = 420;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 36;
      pos[i * 3 + 1] = Math.random() * 22;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 36;
    }
    this.rainGeo = new THREE.BufferGeometry();
    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.Points(
      this.rainGeo,
      new THREE.PointsMaterial({ color: 0xb7d4ff, size: 2.1, sizeAttenuation: false, transparent: true, opacity: 0.55, fog: false, depthWrite: false })
    );
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.scene.add(this.rain);
  }

  giveStarterItems() {
    const inv = this.inventory;
    if (this.mode === 'creative') {
      const hot = [B.GRASS, B.STONE, B.PLANKS, B.LOG, B.GLASS, B.BRICK, B.TORCH, B.GLOWSTONE, B.TNT];
      hot.forEach((id, i) => (inv.slots[i] = { id, count: 64 }));
    } else {
      inv.slots.fill(null);
    }
  }

  findSpawn() {
    for (let r = 0; r < 800; r += 8) {
      for (let a = 0; a < Math.max(1, r / 2); a++) {
        const ang = (a / Math.max(1, r / 2)) * Math.PI * 2;
        const x = Math.floor(Math.cos(ang) * r), z = Math.floor(Math.sin(ang) * r);
        const s = this.world.surface(x, z);
        if (s.h > SEA + 1 && s.biome !== 'Ocean' && s.biome !== 'Góry') {
          let y = this.world.heightAt(x, z) + 1;
          while (y < CH - 2 && (IS_SOLID[this.world.getBlock(x, y, z)] || IS_SOLID[this.world.getBlock(x, y + 1, z)] || this.world.getBlock(x, y - 1, z) === B.LEAVES)) y++;
          this.spawnPoint.set(x + 0.5, y, z + 0.5);
          return;
        }
      }
    }
    this.spawnPoint.set(0.5, 100, 0.5);
  }

  computeOffsets() {
    const R = this.renderDistance;
    this.offsets = [];
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) if (dx * dx + dz * dz <= R * R + 1) this.offsets.push([dx, dz]);
    this.offsets.sort((a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]));
  }

  setRenderDistance(r: number) {
    this.renderDistance = r;
    this.computeOffsets();
  }

  /**
   * 2.0: nakłada ustawienia graficzne w czasie rzeczywistym – wywoływane
   * przez ekran opcji i automat ustawień. Nie wymaga restartu świata.
   */
  applyGfx(o: {
    renderDistance?: number;
    pixelRatio?: number;
    particles?: number;
    textureDetail?: 'low' | 'full';
    effectDetail?: 'low' | 'full';
    clouds?: boolean;
    dynamicResolution?: boolean;
    fpsCap?: number;
    chunkBudgetMs?: number;
    chunksPerFrame?: number;
    unloadMargin?: number;
    autoJump?: boolean;
    haptics?: boolean;
    viewBobbing?: boolean;
    showFps?: boolean;
  }) {
    if (o.renderDistance !== undefined && o.renderDistance !== this.renderDistance) this.setRenderDistance(o.renderDistance);
    if (o.pixelRatio !== undefined) {
      this.basePixelRatio = Math.max(0.6, Math.min(3, o.pixelRatio));
      this.applyResScale();
    }
    if (o.textureDetail !== undefined && o.textureDetail !== this.textureDetail) {
      this.textureDetail = o.textureDetail;
      if (o.textureDetail === 'low' && !this.lowAtlasCanvas) this.lowAtlasCanvas = compactAtlas(this.fullAtlasCanvas);
      this.atlasTex.image = o.textureDetail === 'low' ? this.lowAtlasCanvas! : this.fullAtlasCanvas;
      this.atlasTex.needsUpdate = true;
    }
    if (o.effectDetail !== undefined) this.gfx.effectDetail = o.effectDetail;
    if (o.particles !== undefined) this.gfx.requestedParticles = Math.max(0, Math.min(1, o.particles));
    if (o.particles !== undefined || o.effectDetail !== undefined) {
      this.gfx.particleScale = Math.min(this.gfx.requestedParticles, this.gfx.effectDetail === 'low' ? 0.35 : 1);
      if (this.rainGeo) this.rainGeo.setDrawRange(0, Math.floor(420 * this.gfx.particleScale));
    }
    if (o.clouds !== undefined) this.gfx.clouds = o.clouds;
    if (o.dynamicResolution !== undefined) {
      this.drEnabled = o.dynamicResolution;
      if (!this.drEnabled && this.resScale !== 1) {
        this.resScale = 1;
        this.applyResScale();
      }
    }
    if (o.fpsCap !== undefined) this.fpsCap = o.fpsCap > 0 ? Math.max(10, Math.min(240, o.fpsCap)) : 0;
    if (o.chunkBudgetMs !== undefined) this.gfx.chunkBudgetMs = Math.max(3, Math.min(24, o.chunkBudgetMs));
    if (o.chunksPerFrame !== undefined) this.gfx.chunksPerFrame = Math.max(1, Math.min(6, o.chunksPerFrame));
    if (o.unloadMargin !== undefined) this.gfx.unloadMargin = Math.max(1, Math.min(4, o.unloadMargin));
    if (o.autoJump !== undefined) this.autoJump = o.autoJump;
    if (o.haptics !== undefined) this.haptics = o.haptics;
    if (o.viewBobbing !== undefined) this.viewBobbing = o.viewBobbing;
    if (o.showFps !== undefined) this.showFps = o.showFps;
    this.emitHud();
  }

  /** Stosuje bieżącą skalę rozdzielczości do renderera. */
  private applyResScale() {
    try {
      this.renderer.setPixelRatio(this.basePixelRatio * this.resScale);
    } catch {
      /* renderer może być już zniszczony przy wyłączaniu gry */
    }
  }

  /** Krótkie wibracje (jeśli urządzenie wspiera i gracz ich chce). */
  private buzz(ms: number) {
    if (!this.haptics) return;
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* brak wsparcia – ignoruj */
    }
  }

  /** Publiczne: przelicza cel (crosshair albo palec) bez czekania na klatkę. */
  refreshTarget() {
    this.updateInteraction(0);
  }

  /**
   * 2.0: tapnięcie palcem (tryb „Tapnij”). Najpierw sprawdzamy, czy pod
   * palcem jest mob (atak), a gdy nie – używamy/postawiamy jak PPM.
   * 2.5: tapnięcie po mieszkańcu otwiera handel (wcześniej uderzało go, co
   * budziło golemy!), a tapnięcie wilka z surowym mięsem go oswoiło.
   */
  touchTap(nx: number, ny: number) {
    if (this.ui !== 'playing') return;
    const prev = this.touchAim;
    this.touchAim = { x: nx, y: ny };
    this.refreshTarget();
    const { mob, dist } = this.findMobTarget(3.5);
    const blockDist = this.target ? this.target.dist : Infinity;
    const held = this.selectedStack();
    if (mob && dist < blockDist && mob.type === 'villager' && !mob.dead) {
      this.openTrade(mob);
    } else if (mob && dist < blockDist && mob.type === 'wolf' && !mob.tamed && !mob.dead && (held?.id === I.RAW_PORK || held?.id === I.RAW_BEEF || held?.id === I.RAW_CHICKEN)) {
      this.placeCooldown = 0;
      this.tryUse();
    } else if (mob && dist < blockDist && this.attackCooldown <= 0) {
      this.tryAttack();
    } else {
      this.placeCooldown = 0;
      this.tryUse();
    }
    this.touchAim = prev;
  }

  // ---------- Events ----------
  private on(t: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions) {
    t.addEventListener(type, fn, opts);
    this.listeners.push([t, type, fn, opts]);
  }

  private bindEvents() {
    const canvas = this.renderer.domElement;
    this.on(window, 'resize', () => {
      const w = this.container.clientWidth, h = this.container.clientHeight;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    });
    this.on(document, 'pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      // Sterowanie dotykowe nie korzysta z Pointer Lock. Na części telefonów
      // jego nieudana aktywacja natychmiast pauzowała grę i zerowała gesty.
      if (!this.touchInput && !this.locked && this.ui === 'playing') this.setUI('paused');
      if (!this.locked && !this.touchInput) { this.mouseLeft = false; this.mouseRight = false; this.keys.clear(); }
      if (was && !this.locked) this.lastLockExit = performance.now();
    });
    // 2.5: odrzucona blokada kursora (np. cooldown Chrome po Esc) nie może
    // zostawić gracza bez żadnej reakcji – gra czeka na kolejne kliknięcie.
    this.on(document, 'pointerlockerror', () => {
      this.locked = false;
    });
    this.on(canvas, 'mousedown', ((e: MouseEvent) => {
      if (this.ui !== 'playing') return;
      if (!this.locked) { this.lockPointer(); return; }
      Sfx.unlockAudio();
      if (e.button === 0) { this.mouseLeft = true; this.tryAttack(); }
      else if (e.button === 2) { this.mouseRight = true; this.placeCooldown = 0; this.tryUse(); }
      else if (e.button === 1) { e.preventDefault(); this.pickBlock(); }
    }) as EventListener);
    this.on(window, 'mouseup', ((e: MouseEvent) => {
      if (e.button === 0) { this.mouseLeft = false; this.breakProgress = 0; }
      if (e.button === 2) this.mouseRight = false;
    }) as EventListener);
    this.on(canvas, 'contextmenu', (e) => e.preventDefault());
    this.on(window, 'mousemove', ((e: MouseEvent) => {
      if (!this.locked) return;
      // 2.3: przy lornetcie celownik musi dać się ustawić precyzyjnie.
      const s = 0.0022 * this.sensitivity * (this.zooming ? 0.4 : 1);
      this.yaw -= e.movementX * s;
      this.pitch -= e.movementY * s;
      this.pitch = Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001, this.pitch));
    }) as EventListener);
    this.on(window, 'wheel', ((e: WheelEvent) => {
      if (!this.locked) return;
      this.selected = (this.selected + (e.deltaY > 0 ? 1 : -1) + 9) % 9;
      this.emitHud();
    }) as EventListener, { passive: true });
    this.on(window, 'keydown', ((e: KeyboardEvent) => this.onKeyDown(e)) as EventListener);
    this.on(window, 'keyup', ((e: KeyboardEvent) => {
      this.keys.delete(e.code);
      // 2.5: dwuklik W na sprint liczony od nowa po puszczeniu klawisza –
      // wcześniej W→S→W w krótkim odstępie uruchamiało sprint.
      if (e.code === 'KeyW') this.lastW = 0;
    }) as EventListener);
    this.on(document, 'visibilitychange', () => {
      if (document.hidden) {
        this.keys.clear();
        this.mouseLeft = this.mouseRight = false;
        this.save();
      }
    });
  }

  /** Klawisze ruchu – powtórzenia (e.repeat) mają je po prostu utrzymywać. */
  static readonly HOLD_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight']);

  private onKeyDown(e: KeyboardEvent) {
    if (this.ui === 'chat') return;
    // 2.5: Escape działa nawet, gdy fokus ma pole tekstowe (szukanie w
    // dzienniku, suwak w opcjach) – bez tego Esc „nic nie robił”, dopóki
    // gracz nie kliknął poza polem.
    if (e.code === 'Escape') {
      if (this.ui === 'paused' || this.ui === 'journal' || this.ui === 'waypoints' || this.ui === 'biomeCompass') {
        e.preventDefault();
        this.setUI('playing');
        return;
      }
      if (['inventory', 'furnace', 'chest', 'enchant', 'trade', 'anvil', 'brewing'].includes(this.ui)) {
        e.preventDefault();
        this.closeInventory();
        return;
      }
      // 2.5: Esc pauzuje także, gdy blokada kursora nie jest aktywna (gdy jest,
      // wyjście z blokady samo wywołuje pauzę przez pointerlockchange).
      if (this.ui === 'playing' && !this.locked && !this.touchInput) {
        e.preventDefault();
        this.setUI('paused');
        return;
      }
    }
    // 2.3: pole nazwy w kowadle (i każdy inny input) ma pierwszeństwo dla
    // pozostałych klawiszy – inaczej litera „e” zamykałaby ekran w trakcie pisania.
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    if (this.ui === 'journal' || this.ui === 'waypoints' || this.ui === 'biomeCompass') {
      if (e.code === 'Escape' || (this.ui === 'waypoints' && e.code === 'KeyK')) {
        e.preventDefault();
        this.setUI('playing');
      }
      return;
    }
    if (this.ui === 'inventory' || this.ui === 'furnace' || this.ui === 'chest' || this.ui === 'enchant' || this.ui === 'trade' || this.ui === 'anvil' || this.ui === 'brewing') {
      if (e.code === 'KeyE') {
        e.preventDefault();
        this.closeInventory();
      }
      return;
    }
    // 2.5: ekran śmierci obsługuje klawiaturę – Enter albo R odradza.
    if (this.ui === 'dead') {
      if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'KeyR') {
        e.preventDefault();
        this.respawn();
      }
      return;
    }
    // 2.5: Esc w pauzie wraca do gry (jak w klasyku); wcześniej pauzę można
    // było opuścić wyłącznie myszą.
    if (this.ui === 'paused') {
      if (e.code === 'Escape') {
        e.preventDefault();
        this.setUI('playing');
      }
      return;
    }
    // 2.5: klawisze działają też bez aktywnej blokady kursora (np. po
    // Alt-Tabs albo odrzuconym Pointer Lock) – blokada jest potrzebna tylko
    // do rozglądania się myszą. Wcześniej całe sterowanie „zamierało”,
    // dopóki gracz nie kliknął ponownie w ekran.
    if (this.ui !== 'playing') return;
    if (e.repeat) {
      // Przytrzymane klawisze pozostają wciśnięte, ale akcje jednorazowe
      // (E, Q, J…) nie mogą odpalać się wielokrotnie – wcześniej trzymanie
      // „E” otwierało i zamykało ekwipunek w kółko.
      if (Game.HOLD_KEYS.has(e.code)) this.keys.add(e.code);
      return;
    }
    if (e.code === 'F3') { e.preventDefault(); this.debug = !this.debug; this.emitHud(); return; }
    if (e.code === 'KeyM') { this.showMinimap = !this.showMinimap; this.emitHud(); return; }
    if (e.code === 'KeyJ') { e.preventDefault(); this.setUI('journal'); return; }
    if (e.code === 'KeyK') { e.preventDefault(); this.setUI('waypoints'); return; }
    if (e.code === 'KeyG' && this.zooming) { e.preventDefault(); this.markSpyglass(); return; }
    if (e.code.startsWith('Digit') || e.code.startsWith('Numpad')) {
      const n = parseInt(e.code.slice(e.code.startsWith('Digit') ? 5 : 6), 10);
      if (n >= 1 && n <= 9) { this.selected = n - 1; this.emitHud(); }
    }
    if (e.code === 'KeyE') { this.openInventory(false); return; }
    if (e.code === 'KeyT' || e.code === 'Slash') { e.preventDefault(); this.setUI('chat'); return; }
    // 2.5: Ctrl+Q wyrzuca cały stos (Q – pojedynczy przedmiot, jak w klasyku).
    if (e.code === 'KeyQ') { this.dropItem(e.ctrlKey); }
    if (e.code === 'KeyF' && this.mode === 'creative') { this.toggleFly(); }
    if (e.code === 'Space') {
      const now = performance.now();
      if (this.mode === 'creative' && now - this.lastSpace < 300) { this.toggleFly(); }
      this.lastSpace = now;
    }
    if (e.code === 'KeyW') {
      const now = performance.now();
      if (this.lastW > 0 && now - this.lastW < 280) this.sprinting = true;
      this.lastW = now;
    }
    if (['Space', 'ControlLeft', 'ControlRight', 'Tab'].includes(e.code)) e.preventDefault();
    this.keys.add(e.code);
  }

  lockPointer() {
    if (this.touchInput) return;
    const c = this.renderer.domElement as HTMLCanvasElement & {
      requestPointerLock: (opts?: { unadjustedMovement?: boolean }) => unknown;
    };
    // 2.5: surowy ruch myszy (bez przyspieszania z ustawień systemowych) daje
    // celowanie jak w prawdziwym FPS; starsze przeglądarki dostają zwykłą wersję.
    try {
      const p = c.requestPointerLock({ unadjustedMovement: true });
      if (p && typeof (p as Promise<void>).catch === 'function') {
        (p as Promise<void>).catch(() => {
          try {
            const fallback = c.requestPointerLock();
            if (fallback && typeof (fallback as Promise<void>).catch === 'function') (fallback as Promise<void>).catch(() => {});
          } catch { /* ignore */ }
        });
      }
    } catch { /* ignore */ }
  }

  setUI(s: UIState) {
    this.ui = s;
    try {
      if (s === 'playing') {
        this.lockPointer();
        Sfx.unlockAudio();
      } else if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    } catch (e) {
      // Pointer lock / audio can be blocked by the browser: never let that
      // stop the game from switching state (the React UI stays in sync).
      console.warn('setUI side effect failed', e);
    }
    if (s === 'paused') this.save();
    // Leaving the inventory must never eat the items sitting in the grid.
    if (s !== 'inventory' && s !== 'chest' && s !== 'furnace' && s !== 'enchant') {
      for (const left of this.inventory.returnGrid()) {
        if (left) this.spawnDrop(left.id, left.count, this.body.pos.x, this.body.pos.y + 1, this.body.pos.z, left.dur, undefined, undefined, undefined, left.ench, left.name);
      }
    }
    // …i dla mieszkańca, z którym właśnie handlowano.
    if (s !== 'trade' && this.tradeMob) this.tradeMob = null;
    // …same for the item waiting in the enchanting table.
    if (s !== 'enchant' && this.enchantItem) {
      const it = this.enchantItem;
      this.enchantItem = null;
      this.enchOptions = [];
      if (!this.inventory.add(it.id, it.count, it.dur, it.ench, it.name)) {
        this.spawnDrop(it.id, it.count, this.body.pos.x, this.body.pos.y + 1, this.body.pos.z, it.dur, undefined, undefined, undefined, it.ench, it.name);
      }
    }
    this.keys.clear();
    this.mouseLeft = this.mouseRight = false;
    this.bowDraw = -1;
    this.zooming = false;
    this.touchAim = null;
    if (s !== 'anvil') this.anvilPos = null;
    if (s !== 'brewing') this.brewingPos = null;
    if (s === 'anvil' && this.anvilPos) this.returnHeldStack();
    this.onUI(s);
  }

  openInventory(table: boolean) {
    this.craftingTable = table;
    this.setUI('inventory');
  }

  /** Returns a held UI stack safely, spilling it instead of silently dropping it. */
  private returnHeldStack() {
    const held = this.inventory.cursor;
    if (!held || this.inventory.returnCursor()) return;
    this.inventory.cursor = null;
    this.spawnDrop(held.id, held.count, this.body.pos.x, this.body.pos.y + 1, this.body.pos.z, held.dur, undefined, undefined, undefined, held.ench, held.name);
    this.message('Brak miejsca – przedmiot z kursora upadł na ziemię.');
  }

  closeInventory() {
    this.returnHeldStack();
    this.furnacePos = null;
    this.chestPos = null;
    this.enchantPos = null;
    this.setUI('playing');
    this.emitHud();
  }

  // ---------- Handel z mieszkańcami (1.6) ----------

  openTrade(mob: Mob) {
    if (mob.type !== 'villager' || mob.dead) return;
    if (!mob.trade) mob.trade = createVillagerState(mob.profession, this.nowSeconds());
    this.tradeMob = mob;
    this.setUI('trade');
  }

  closeTrade() {
    this.tradeMob = null;
    this.setUI('playing');
    this.emitHud();
  }

  /** Czas w sekundach – używany do uzupełniania zapasów mieszkańców. */
  private nowSeconds(): number {
    return performance.now() / 1000;
  }

  /** Nazwa rozmówcy razem z jego poziomem („Rolnik (Czeladnik)”). */
  tradeTitle(): string {
    const st = this.tradeMob?.trade;
    return st ? villagerTitle(st) : 'Mieszkaniec';
  }

  tradeLevel(): number {
    const st = this.tradeMob?.trade;
    return st ? villagerLevel(st) : 1;
  }

  tradeProgress(): number {
    const st = this.tradeMob?.trade;
    return st ? villagerProgress(st) : 0;
  }

  /** Ile sekund zostało do uzupełnienia zapasów. */
  tradeRestockIn(): number {
    const st = this.tradeMob?.trade;
    return st ? restockIn(st, this.nowSeconds()) : 0;
  }

  /** Bieżące oferty mieszkańca, gotowe do wyświetlenia. */
  tradeRows(): TradeRow[] {
    const st = this.tradeMob?.trade;
    if (!st) return [];
    restockIfDue(st, this.nowSeconds());
    return offersFor(st).map((offer, index) => ({
      index,
      offer,
      left: usesLeft(st, offer),
      max: offer.uses,
      blocked: this.tradeBlocked(st, offer),
    }));
  }

  private tradeBlocked(st: VillagerState, offer: TradeOffer): TradeBlock {
    if (usesLeft(st, offer) <= 0) return 'uses';
    // W trybie kreatywnym towar jest darmowy (zapasy nadal obowiązują),
    // ale pełny ekwipunek nie może po cichu pożreć odebranego przedmiotu.
    if (this.mode === 'creative') return this.inventory.canAdd(offer.get.id, offer.get.count) ? 'ok' : 'space';
    return canTrade(st, this.inventory, offer);
  }

  /** Wykonuje wymianę o podanym numerze. Zwraca false, gdy się nie udała. */
  tradeWith(i: number): boolean {
    const st = this.tradeMob?.trade;
    if (!st) return false;
    const row = this.tradeRows()[i];
    if (!row) return false;
    if (row.blocked === 'uses') {
      this.message('Zapasy tej oferty się wyczerpały – mieszkaniec uzupełni je po chwili.');
      return false;
    }
    if (row.blocked === 'items') {
      this.message('Nie masz dość towaru na tę wymianę.');
      return false;
    }
    if (row.blocked === 'space') {
      this.message('Brak miejsca w ekwipunku na towar z wymiany.');
      return false;
    }
    const before = villagerLevel(st);
    if (this.mode === 'creative') {
      if (!this.inventory.add(row.offer.get.id, row.offer.get.count)) return false;
      st.used[row.offer.key] = (st.used[row.offer.key] ?? 0) + 1;
      st.xp += row.offer.xp;
    } else if (!applyTrade(st, this.inventory, row.offer)) {
      return false;
    }
    this.trades++;
    this.gainXp(row.offer.xp);
    this.unlock('trade');
    if (this.trades >= 25) this.unlock('merchant');
    Sfx.playPop();
    const got = `${displayName(row.offer.get.id)} ×${row.offer.get.count}`;
    const after = villagerLevel(st);
    this.message(after > before ? `${got} – mieszkańcowi przybyło doświadczenia (poziom ${after}).` : `${got} w zamian za towar.`);
    this.emitHud();
    return true;
  }

  /** Klucz pieca z prefiksem wymiaru – piec w Netherze nie koliduje z piecem w nadświecie. */
  private fKey(x: number, y: number, z: number) {
    return (this.isInNether ? 'n:' : '') + furnaceKey(x, y, z);
  }

  /** Klucz skrzyni z prefiksem wymiaru. */
  private cKey(x: number, y: number, z: number) {
    return (this.isInNether ? 'n:' : '') + chestKey(x, y, z);
  }

  openFurnace(x: number, y: number, z: number) {
    const key = this.fKey(x, y, z);
    if (!this.furnaces.has(key)) {
      const f = emptyFurnace(x, y, z);
      f.dim = this.isInNether ? 1 : 0;
      this.furnaces.set(key, f);
    }
    this.furnacePos = { x, y, z };
    this.setUI('furnace');
  }

  currentFurnace(): FurnaceState | null {
    if (!this.furnacePos) return null;
    return this.furnaces.get(this.fKey(this.furnacePos.x, this.furnacePos.y, this.furnacePos.z)) ?? null;
  }

  /** Stół zaklęć: liczba biblioteczek w pierścieniu 5×5 wokół stołu. */
  enchantPower(): number {
    if (!this.enchantPos) return 0;
    const { x, y, z } = this.enchantPos;
    return countShelves((bx, by, bz) => this.world.peekBlock(bx, by, bz), x, y, z);
  }

  openEnchant(x: number, y: number, z: number) {
    this.enchantPos = { x, y, z };
    this.enchOptions = rollEnchantOptions(this.enchantItem, this.enchantPower(), Math.random);
    this.setUI('enchant');
    this.emitHud();
  }

  /** Moves the item between the cursor and the table's single slot. */
  clickEnchantSlot(right: boolean) {
    this.transfer(() => this.enchantItem, (s) => { this.enchantItem = s; }, right);
    this.enchOptions = rollEnchantOptions(this.enchantItem, this.enchantPower(), Math.random);
    this.emitHud();
  }

  /** True when the offer can be bought right now (levels, lapis, room on the stack). */
  canEnchantWith(i: number): boolean {
    const opt = this.enchOptions[i];
    if (!opt || !this.enchantItem) return false;
    if (!canAddEnch(this.enchantItem, opt.ench)) return false;
    if (this.mode === 'creative') return true;
    return this.xp.canSpend(opt.cost) && this.inventory.countOf(I.LAPIS) >= opt.lapis;
  }

  /** Buys offer `i`: spends levels + lapis, stamps the enchantment on the item. */
  enchantWith(i: number): boolean {
    const opt = this.enchOptions[i];
    const item = this.enchantItem;
    if (!opt || !item || !canAddEnch(item, opt.ench)) return false;
    if (this.mode !== 'creative') {
      if (!this.xp.spend(opt.cost)) { this.message('Za mało doświadczenia.'); return false; }
      if (this.inventory.countOf(I.LAPIS) < opt.lapis) { this.message('Potrzebny jest lazuryt.'); return false; }
      this.inventory.remove(I.LAPIS, opt.lapis);
    }
    addEnch(item, opt.ench, opt.level);
    Sfx.playEnchant();
    this.spawnParticles(this.body.pos.x, this.body.pos.y + 1.4, this.body.pos.z, B.GLOWSTONE, 18, 1.1);
    this.message(`Zaklęcie: ${enchName(opt.ench, opt.level)}.`);
    this.unlock('enchant');
    if (opt.level >= 4) this.unlock('enchant_master');
    // nowa partia ofert na tym samym przedmiocie
    this.enchOptions = rollEnchantOptions(item, this.enchantPower(), Math.random);
    this.emitHud();
    return true;
  }

  openChest(x: number, y: number, z: number) {
    const key = this.cKey(x, y, z);
    let chest = this.chests.get(key);
    if (!chest) {
      const id = this.world.getBlock(x, y, z);
      chest = id === B.LOOT_CHEST ? lootChest(this.world.seed, x, y, z) : emptyChest(x, y, z);
      chest.dim = this.isInNether ? 1 : 0;
      if (id === B.LOOT_CHEST) {
        this.world.setBlock(x, y, z, B.CHEST);
        this.unlock('loot');
      }
      this.chests.set(key, chest);
    }
    while (chest.slots.length < 27) chest.slots.push(null);
    this.chestPos = { x, y, z };
    this.setUI('chest');
  }

  currentChest(): ChestState | null {
    if (!this.chestPos) return null;
    return this.chests.get(this.cKey(this.chestPos.x, this.chestPos.y, this.chestPos.z)) ?? null;
  }

  clickChest(i: number, right: boolean) {
    const c = this.currentChest();
    if (!c || i < 0 || i >= c.slots.length) return;
    this.transfer(() => c.slots[i], (s) => { c.slots[i] = s; }, right);
    if (this.inventory.cursor) this.notePickup(this.inventory.cursor.id);
  }

  private spillChest(x: number, y: number, z: number) {
    const key = this.cKey(x, y, z);
    const saved = this.chests.get(key);
    const id = this.world.getBlock(x, y, z);
    const stacks = saved ? saved.slots : id === B.LOOT_CHEST ? lootChest(this.world.seed, x, y, z).slots : [];
    for (const s of stacks) {
      if (s) this.spawnDrop(s.id, s.count, x + 0.5, y + 0.5, z + 0.5, s.dur, (Math.random() - 0.5) * 2, 2, (Math.random() - 0.5) * 2, s.ench, s.name);
    }
    this.chests.delete(key);
  }

  // ---------- 2.3: kowadło ----------
  private aKey(x: number, y: number, z: number) {
    return (this.isInNether ? 'n:' : '') + anvilKey(x, y, z);
  }

  openAnvil(x: number, y: number, z: number) {
    const key = this.aKey(x, y, z);
    let anvil = this.anvils.get(key);
    if (!anvil) {
      anvil = emptyAnvil(x, y, z);
      anvil.dim = this.isInNether ? 1 : 0;
      this.anvils.set(key, anvil);
    }
    this.anvilPos = { x, y, z };
    this.setUI('anvil');
    this.emitHud();
  }

  currentAnvil(): AnvilState | null {
    if (!this.anvilPos) return null;
    return this.anvils.get(this.aKey(this.anvilPos.x, this.anvilPos.y, this.anvilPos.z)) ?? null;
  }

  /** What the anvil would hand over right now (pure – see game/anvil.ts). */
  anvilOffer(): AnvilResult {
    const a = this.currentAnvil();
    return a ? anvilResult(a.a, a.b, a.name) : { out: null, action: 'none', cost: 0, label: '' };
  }

  /** True when the player can afford the offered operation. */
  canAnvilTake(): boolean {
    const offer = this.anvilOffer();
    if (!offer.out) return false;
    if (this.mode === 'creative') return true;
    return this.xp.canSpend(offer.cost);
  }

  /**
   * Takes the result: charges levels, clears the inputs it consumed and adds
   * the intact output to inventory (or drops it if the inventory is full).
   */
  takeAnvilResult(): boolean {
    const a = this.currentAnvil();
    const offer = this.anvilOffer();
    if (!a || !offer.out) return false;
    if (this.mode !== 'creative' && !this.xp.spend(offer.cost)) {
      this.message('Za mało poziomów doświadczenia.');
      return false;
    }
    // Never merge into the cursor by id alone: anvil outputs may have a new
    // name, durability or enchantments, and tools themselves are unstackable.
    if (!this.giveOrDrop(offer.out)) return false;
    if (offer.action === 'merge') { a.a = null; a.b = null; this.unlock('smith'); }
    if (offer.action === 'rename') { a.a = null; a.name = ''; this.unlock('namer'); }
    a.burn = offer.cost;
    a.burnMax = Math.max(a.burnMax, offer.cost * 8);
    Sfx.playPlace('stone');
    this.message(offer.action === 'merge' ? 'Przedmioty połączone.' : 'Nowa nazwa nadana.');
    this.emitHud();
    return true;
  }

  /** Cursor → inventory, or onto the ground when everything else is full. */
  private giveOrDrop(stack: Stack): boolean {
    if (this.inventory.add(stack.id, stack.count, stack.dur, stack.ench, stack.name)) return true;
    this.spawnDrop(stack.id, stack.count, this.body.pos.x, this.body.pos.y + 1, this.body.pos.z, stack.dur, undefined, undefined, undefined, stack.ench, stack.name);
    this.message('Brak miejsca – przedmiot upadł na ziemię.');
    return true;
  }

  /** Rename field: the screen keeps the text, the rules live in game/anvil.ts. */
  setAnvilName(name: string) {
    const a = this.currentAnvil();
    if (a) a.name = cleanItemName(name);
  }

  clickAnvilSlot(slot: 'a' | 'b', right: boolean) {
    const a = this.currentAnvil();
    if (!a) return;
    this.transfer(() => (slot === 'a' ? a.a : a.b), (s) => { if (slot === 'a') a.a = s; else a.b = s; }, right);
    if (slot === 'a' && a.a && !a.name) a.name = '';
  }

  /** Returns both inputs to the player when the screen is closed. */
  private spillAnvil(x: number, y: number, z: number) {
    const key = this.aKey(x, y, z);
    const anvil = this.anvils.get(key);
    if (!anvil) return;
    for (const s of [anvil.a, anvil.b]) {
      if (s) this.spawnDrop(s.id, s.count, x + 0.5, y + 0.6, z + 0.5, s.dur, undefined, undefined, undefined, s.ench, s.name);
    }
    this.anvils.delete(key);
  }

  // ---------- 2.4: statyw alchemiczny ----------
  private bKey(x: number, y: number, z: number) {
    return (this.isInNether ? 'n:' : '') + brewingKey(x, y, z);
  }

  openBrewing(x: number, y: number, z: number) {
    const key = this.bKey(x, y, z);
    let stand = this.brewings.get(key);
    if (!stand) {
      stand = emptyBrewing(x, y, z);
      stand.dim = this.isInNether ? 1 : 0;
      this.brewings.set(key, stand);
    }
    while (stand.bottles.length < 3) stand.bottles.push(null);
    this.brewingPos = { x, y, z };
    this.setUI('brewing');
    this.emitHud();
  }

  currentBrewing(): BrewingState | null {
    if (!this.brewingPos) return null;
    return this.brewings.get(this.bKey(this.brewingPos.x, this.brewingPos.y, this.brewingPos.z)) ?? null;
  }

  /**
   * Move stacks between the cursor and a stand slot. `slot` is one of the
   * three bottles, the ingredient cup or the fuel tray. The fuel tray only
   * accepts blaze rods; the cup only accepts real brewing ingredients.
   */
  clickBrewing(slot: 'b0' | 'b1' | 'b2' | 'ingredient' | 'fuel', right: boolean) {
    const s = this.currentBrewing();
    if (!s) return;
    const cur = this.inventory.cursor;
    if (slot === 'fuel' && cur && cur.id !== I.BLAZE_ROD) {
      this.message('Statyw pali się tylko płomienną różdżką.');
      return;
    }
    if (slot === 'ingredient' && cur && !BREWING_INGREDIENTS.has(cur.id)) {
      this.message('To nie jest składnik do warzenia.');
      return;
    }
    const get = () => (slot === 'b0' ? s.bottles[0] : slot === 'b1' ? s.bottles[1] : slot === 'b2' ? s.bottles[2] : slot === 'ingredient' ? s.ingredient : s.fuel);
    const set = (v: Stack | null) => {
      if (slot === 'b0') s.bottles[0] = v;
      else if (slot === 'b1') s.bottles[1] = v;
      else if (slot === 'b2') s.bottles[2] = v;
      else if (slot === 'ingredient') s.ingredient = v;
      else s.fuel = v;
    };
    this.transfer(get, set, right);
    if (this.inventory.cursor) this.notePickup(this.inventory.cursor.id);
    // a touched slot restarts the batch, so a new mix re-brews from zero
    s.progress = 0;
    this.emitHud();
  }

  /** Spills bottles, ingredient and fuel when the stand block is gone. */
  private spillBrewing(x: number, y: number, z: number) {
    const key = this.bKey(x, y, z);
    const s = this.brewings.get(key);
    if (!s) return;
    for (const stack of [...s.bottles, s.ingredient, s.fuel]) {
      if (stack) this.spawnDrop(stack.id, stack.count, x + 0.5, y + 0.6, z + 0.5, stack.dur, undefined, undefined, undefined, stack.ench, stack.name);
    }
    this.brewings.delete(key);
  }

  /** Ticks every stand in the current dimension; a vanished block spills. */
  private updateBrewings(dt: number) {
    const dim = this.isInNether ? 1 : 0;
    for (const s of this.brewings.values()) {
      if ((s.dim ?? 0) !== dim) continue;
      if (!this.world.hasChunk(Math.floor(s.x / CS), Math.floor(s.z / CS))) continue;
      if (this.world.peekBlock(s.x, s.y, s.z) !== B.BREWING) {
        if (this.brewingPos && this.brewingPos.x === s.x && this.brewingPos.y === s.y && this.brewingPos.z === s.z) this.closeInventory();
        this.spillBrewing(s.x, s.y, s.z);
        continue;
      }
      const before = s.bottles.map((b) => (b ? b.id : 0));
      const { done } = tickBrewing(s, dt);
      if (done) {
        const after = s.bottles.map((b) => (b ? b.id : 0));
        const first = after.findIndex((id, i) => id !== before[i] && id !== 0);
        if (first >= 0) {
          Sfx.playEnchant();
          this.spawnParticles(s.x + 0.5, s.y + 0.8, s.z + 0.5, POTIONS[after[first]] ? B.GLOWSTONE : B.WOOL_WHITE, 14, 0.7);
          this.message(`Zawarzone: ${displayName(after[first])}.`);
          this.unlock('alchemist');
        }
      }
    }
  }

  /** 2.4: applies (or refreshes) a potion buff. Durations never stack. */
  applyEffect(id: PotionEffectId, seconds: number) {
    if (id === 'none') return;
    const cur = this.effects.get(id) ?? 0;
    this.effects.set(id, Math.max(cur, seconds * 1000));
  }

  effectLeft(id: PotionEffectId): number {
    return Math.max(0, this.effects.get(id) ?? 0) / 1000;
  }

  hasEffect(id: PotionEffectId): boolean {
    return this.effectLeft(id) > 0;
  }

  /** Ticks buffs down; regeneration heals on its own rhythm.
   *  The HUD refresh rides on the main 10 Hz emit, no extra calls needed. */
  private updateEffects(dt: number) {
    if (!this.effects.size) {
      if (this.potionRegenAcc > 0) this.potionRegenAcc = 0;
      return;
    }
    for (const [id, ms] of [...this.effects.entries()]) {
      const next = ms - dt * 1000;
      if (next <= 0) this.effects.delete(id);
      else this.effects.set(id, next);
    }
    if (this.hasEffect('regen') && this.mode === 'survival') {
      this.potionRegenAcc += dt;
      if (this.potionRegenAcc >= 2) {
        this.potionRegenAcc = 0;
        if (this.health < 20 && this.health > 0) {
          this.health = Math.min(20, this.health + 1);
          Sfx.playEat();
          this.spawnParticles(this.body.pos.x, this.body.pos.y + 1.4, this.body.pos.z, B.WOOL_RED, 8, 0.8);
        }
      }
    }
  }

  /** 2.4: drinks the selected bottle. Awkward brews taste like dirt. */
  private drinkPotion(s: Stack) {
    const def = POTIONS[s.id];
    if (!def) return;
    if (this.mode === 'survival') this.consumeSelected();
    Sfx.playDrink();
    this.swingT = 0;
    // Mistrz eliksirów: only real (non-awkward) potions count, once per type.
    if (def.effect !== 'none') {
      this.potionsDrunk.add(s.id);
      if (this.potionsDrunk.size >= 6) this.unlock('potioneer');
    }
    if (def.effect === 'none') {
      this.message('Mętny smak. Potrzebny składnik do pełnej mocy.');
      return;
    }
    if (def.effect === 'heal') {
      this.health = Math.min(20, this.health + HEAL_AMOUNT);
      this.spawnParticles(this.body.pos.x, this.body.pos.y + 1.2, this.body.pos.z, B.WOOL_RED, 16, 1);
      this.message(`Wypito: ${def.name}. +${HEAL_AMOUNT} zdrowia.`);
      this.unlock('tonic');
    } else {
      this.applyEffect(def.effect, def.duration);
      this.message(`Wypito: ${def.name} (${def.duration} s).`);
    }
    this.emitHud();
  }

  /** Move stacks between the cursor and a furnace slot. Output can only be taken. */
  clickFurnace(slot: 'input' | 'fuel' | 'output', right: boolean) {
    const f = this.currentFurnace();
    if (!f) return;
    const cur = this.inventory.cursor;
    if (slot === 'output') {
      const o = f.output;
      if (!o) return;
      if (!cur) {
        if (right && o.count > 1) {
          const half = Math.ceil(o.count / 2);
          this.inventory.cursor = { id: o.id, count: half };
          o.count -= half;
        } else {
          this.inventory.cursor = o;
          f.output = null;
        }
      } else if (cur.id === o.id && cur.dur === undefined) {
        const n = Math.min(stackLimit(o.id) - cur.count, o.count);
        cur.count += n;
        o.count -= n;
        if (o.count <= 0) f.output = null;
      }
      if (this.inventory.cursor) this.notePickup(this.inventory.cursor.id);
      if (f.output?.id === I.IRON || this.inventory.cursor?.id === I.IRON) this.unlock('iron');
      return;
    }
    if (cur && slot === 'input' && smeltResult(cur.id) == null) {
      this.message('Tego nie da się przetopić.');
      return;
    }
    if (cur && slot === 'fuel' && fuelSeconds(cur.id) <= 0) {
      this.message('To nie jest paliwo. Węgiel, deski, patyki albo pnie.');
      return;
    }
    const prev = f.input?.id;
    const get = () => (slot === 'input' ? f.input : f.fuel);
    const set = (s: Stack | null) => { if (slot === 'input') f.input = s; else f.fuel = s; };
    this.transfer(get, set, right);
    if (f.input?.id !== prev) f.cook = 0;
  }

  private transfer(get: () => Stack | null, set: (s: Stack | null) => void, right: boolean) {
    const s = get();
    const c = this.inventory.cursor;
    if (!c) {
      if (!s) return;
      if (right && s.count > 1) {
        const half = Math.ceil(s.count / 2);
        // 2.3: połówka musi zachować zaklęcia i własną nazwę (jak w ekwipunku).
        this.inventory.cursor = { id: s.id, count: half, dur: s.dur, ench: s.ench ? { ...s.ench } : undefined, name: s.name };
        s.count -= half;
      } else {
        this.inventory.cursor = s;
        set(null);
      }
      return;
    }
    if (!s) {
      if (right) {
        set({ id: c.id, count: 1, dur: c.dur, ench: c.ench ? { ...c.ench } : undefined, name: c.name });
        c.count--;
        if (c.count <= 0) this.inventory.cursor = null;
      } else {
        set(c);
        this.inventory.cursor = null;
      }
      return;
    }
    // 2.3: stosy o różnej nazwie (albo o zaklęciach/wytrzymałości) nigdy się nie łączą.
    if (s.id === c.id && s.dur === undefined && c.dur === undefined && !s.ench && !c.ench && s.name === c.name) {
      const n = Math.min(stackLimit(s.id) - s.count, right ? 1 : c.count);
      s.count += n;
      c.count -= n;
      if (c.count <= 0) this.inventory.cursor = null;
      return;
    }
    set(c);
    this.inventory.cursor = s;
  }

  onCraft(outId: number) {
    this.unlock('craft');
    if (ITEMS[outId]?.tool === 'pick') this.unlock('pick');
    if (outId === B.IRON_BLOCK) this.unlock('foundry');
    if (outId === I.BOOK) this.unlock('book');
    if (outId === B.ENCHANT) this.unlock('table');
    this.notePickup(outId);
  }

  achievementIds(): string[] {
    return [...this.unlocked];
  }

  private unlock(id: string) {
    if (this.unlocked.has(id)) return;
    this.unlocked.add(id);
    const a = achievementById(id);
    if (!a) return;
    this.toast = { title: a.title, text: a.text, at: performance.now() };
    this.message(`Osiągnięcie: ${a.title}`);
    this.emitHud();
  }

  /** Bounded counters and once-per-world rewards, shared by building, combat and exploration. */
  private advanceChallenge(id: ChallengeId) {
    // Older prototype-only tests and imported saves can omit this optional field.
    this.challengeProgress ??= normalizeChallenges(undefined, this.unlocked);
    const rule = CHALLENGES[id];
    const next = Math.min(rule.target, this.challengeProgress[id] + 1);
    if (next === this.challengeProgress[id]) return;
    this.challengeProgress[id] = next;
    if (next === rule.target && !this.unlocked.has(id)) {
      this.unlock(id);
      if (this.mode === 'survival') {
        this.gainXp(rule.rewardXp);
        this.message(`Ukończono wyzwanie: ${rule.label}. +${rule.rewardXp} PD.`);
      }
    }
  }

  /** Only entering a biome earns its journal goal; the unlocked set is saved. */
  private lastBiomeVisitKey = '';

  private discoverBiome(biome: Biome) {
    const id = BIOME_DISCOVERY_GOALS[biome];
    if (!id || this.unlocked.has(id)) return;
    this.unlock(id);
    this.advanceChallenge('challenge_explorer');
    if (this.mode === 'survival') {
      this.gainXp(3);
      this.message('Odkrycie biomu: +3 PD.');
    }
  }

  /** Called on HUD ticks, but terrain noise runs only after entering a new block. */
  private observeBiomeAtPlayer() {
    const bx = Math.floor(this.body.pos.x), bz = Math.floor(this.body.pos.z);
    const visitKey = `${this.currentDimension()}:${bx},${bz}`;
    if (visitKey === this.lastBiomeVisitKey) return;
    this.lastBiomeVisitKey = visitKey;
    this.discoverBiome(this.world.surface(bx, bz).biome);
  }

  private notePickup(id: number) {
    if (id === B.LOG || id === B.BIRCH_LOG || id === B.SPRUCE_LOG) this.unlock('wood');
    if (id === I.COAL) this.unlock('coal');
    if (id === I.DIAMOND) this.unlock('diamond');
    if (id === I.IRON) this.unlock('iron');
    if (id === I.WHEAT) this.unlock('farm');
    if (id === I.LAPIS) this.unlock('lapis');
    if (id === I.EMERALD) this.unlock('emerald');
    if (id === B.SUGARCANE) this.unlock('cane');
  }

  private consumeSelected(n = 1) {
    if (this.mode !== 'survival') return;
    const s = this.selectedStack();
    if (!s) return;
    s.count -= n;
    if (s.count <= 0) this.inventory.slots[this.selected] = null;
    this.emitHud();
  }

  private wearTool() {
    if (this.mode !== 'survival') return;
    const s = this.selectedStack();
    if (!s) return;
    const max = ITEMS[s.id]?.durability;
    if (!max) return;
    // Niezniszczalność: część użyć nie kosztuje wytrzymałości
    const lvl = enchLevel(s, 'unbreaking');
    if (lvl > 0 && Math.random() > wearChance(lvl)) {
      if (s.dur === undefined) s.dur = max;
      this.emitHud();
      return;
    }
    if (s.dur === undefined) s.dur = max;
    s.dur--;
    if (s.dur <= 0) {
      this.inventory.slots[this.selected] = null;
      Sfx.playBreak('wood');
      this.message(`${displayName(s.id)} się zniszczyło.`);
    }
    this.emitHud();
  }

  // ---------- Experience ----------

  /** Grants XP; a level-up plays a chime and pops green particles. */
  gainXp(n: number) {
    const before = this.xp.info().level;
    this.xp.add(n);
    const after = this.xp.info().level;
    if (after > before) {
      Sfx.playLevelUp();
      this.spawnParticles(this.body.pos.x, this.body.pos.y + 1.1, this.body.pos.z, B.WOOL_GREEN, 24, 1.4);
      this.message(`Poziom doświadczenia: ${after}!`);
      if (after >= 10) this.unlock('xp10');
      this.emitHud();
    }
  }

  /** One XP orb; mobs and ores scatter 1–3 of them around the kill site. */
  spawnOrb(x: number, y: number, z: number, value: number) {
    if (this.orbs.length > 48) return;
    const pos = new THREE.Vector3(x, y, z);
    const mesh = new THREE.Mesh(this.orbGeo, this.orbMat);
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.orbs.push({
      mesh,
      pos,
      vel: new THREE.Vector3((Math.random() - 0.5) * 1.6, 1.4 + Math.random() * 1.6, (Math.random() - 0.5) * 1.6),
      value,
      age: 0,
    });
  }

  /** Splits `total` XP into 1–3 orbs around a point. */
  private dropXpOrbs(total: number, x: number, y: number, z: number) {
    const n = total > 4 ? 3 : total > 2 ? 2 : 1;
    let left = total;
    for (let i = 0; i < n; i++) {
      const v = i === n - 1 ? left : Math.max(1, Math.round(left / (n - i)));
      left -= v;
      this.spawnOrb(x + (Math.random() - 0.5) * 0.9, y, z + (Math.random() - 0.5) * 0.9, Math.max(1, v));
    }
  }

  /** Mobs drop XP worth their type: hostiles 3–7, passives 1–3, wolves 2–5. */
  private mobXp(m: Mob, x: number, y: number, z: number) {
    if (m.type === 'villager') return; // wieśniak nie daje doświadczenia
    const total = m.type === 'golem'
      ? 5 + Math.floor(Math.random() * 4)
      : m.type === 'wolf'
      ? 2 + Math.floor(Math.random() * 4)
      : isHostileMob(m.type)
        ? 3 + Math.floor(Math.random() * 5)
        : 1 + Math.floor(Math.random() * 3);
    this.dropXpOrbs(total, x, y, z);
  }

  private updateOrbs(dt: number) {
    const p = this.body.pos;
    this.orbs = this.orbs.filter((o) => {
      o.age += dt;
      if (o.age > 300) { this.scene.remove(o.mesh); return false; }
      o.vel.y -= 22 * dt;
      o.pos.addScaledVector(o.vel, dt);
      const bx = Math.floor(o.pos.x), by = Math.floor(o.pos.y), bz = Math.floor(o.pos.z);
      if (this.world.isSolid(bx, by, bz)) {
        o.pos.y = by + 1.02;
        o.vel.y = Math.max(0, -o.vel.y * 0.25);
        o.vel.x *= 0.82;
        o.vel.z *= 0.82;
      }
      const dist = Math.hypot(o.pos.x - p.x, o.pos.z - p.z, o.pos.y - (p.y + 0.9));
      if (o.age > 0.5 && dist < 5 && dist > 0.2) {
        o.vel.x += ((p.x - o.pos.x) / dist) * dt * 16;
        o.vel.z += ((p.z - o.pos.z) / dist) * dt * 16;
        o.vel.y += ((p.y + 0.6 - o.pos.y) / dist) * dt * 10;
      }
      if (o.age > 0.4 && dist < 1.4 && this.ui !== 'dead') {
        this.gainXp(o.value);
        Sfx.playPop();
        this.scene.remove(o.mesh);
        return false;
      }
      o.mesh.position.set(o.pos.x, o.pos.y + 0.12 + Math.sin(o.age * 3.2) * 0.06, o.pos.z);
      o.mesh.rotation.y += dt * 3;
      return true;
    });
  }

  // ---------- Armor ----------

  /** Inventory-screen click on one of the four armor slots. */
  clickArmorSlot(i: number) {
    if (i < 0 || i >= ARMOR_SLOT_COUNT) return;
    const cur = this.inventory.cursor;
    const slot = this.armor[i];
    if (!cur) {
      if (!slot) return;
      this.inventory.cursor = slot;
      this.armor[i] = null;
    } else if (armorSlotOf(cur.id) === i) {
      this.armor[i] = cur;
      this.inventory.cursor = slot ?? null;
      this.emitHud();
    } else return;
    if (this.armor.every((s) => s)) this.unlock('armor');
    this.emitHud();
  }

  /** Every equipped piece takes a quarter of the hit; broken pieces fall off. */
  private wearArmor(dealt: number) {
    if (this.mode !== 'survival') return;
    const wear = Math.max(1, Math.ceil(dealt / 4));
    for (let i = 0; i < ARMOR_SLOT_COUNT; i++) {
      const s = this.armor[i];
      if (!s) continue;
      const lvl = enchLevel(s, 'unbreaking');
      if (lvl > 0 && Math.random() > wearChance(lvl)) continue;
      const max = ITEMS[s.id]?.durability;
      if (!max) continue;
      if (s.dur === undefined) s.dur = max;
      s.dur -= wear;
      if (s.dur <= 0) {
        this.armor[i] = null;
        Sfx.playBreak('cloth');
        this.message(`${displayName(s.id)} się zniszczyło.`);
      }
    }
  }

  /** Shield takes durability damage; used by parried hits and blocked arrows. */
  private wearShield(n: number) {
    if (this.mode !== 'survival') return;
    const s = this.selectedStack();
    if (!s || ITEMS[s.id]?.tool !== 'shield') return;
    const lvl = enchLevel(s, 'unbreaking');
    if (lvl > 0 && Math.random() > wearChance(lvl)) return;
    const max = ITEMS[s.id]?.durability ?? 1;
    if (s.dur === undefined) s.dur = max;
    s.dur -= n;
    if (s.dur <= 0) {
      this.inventory.slots[this.selected] = null;
      Sfx.playBreak('wood');
      this.message('Tarcza się zniszczyła.');
    }
    this.emitHud();
  }

  private holdingShield(): boolean {
    const s = this.selectedStack();
    return !!s && ITEMS[s.id]?.tool === 'shield';
  }

  private tryEat(s: Stack) {
    const food = ITEMS[s.id];
    if (!food || food.kind !== 'food') return;
    if (this.eatCooldown > 0) return;
    if (this.hunger >= 20 && (food.heal ?? 0) <= 0) {
      this.message('Nie jesteś głodny.');
      return;
    }
    this.hunger = Math.min(20, this.hunger + (food.hunger ?? 0));
    this.health = Math.min(20, this.health + (food.heal ?? 0));
    this.eatCooldown = 0.7;
    this.swingT = 0;
    Sfx.playEat();
    this.unlock('food');
    this.consumeSelected();
  }

  private tryTill(t: NonNullable<ReturnType<World['raycast']>>): boolean {
    if (t.ny !== 1) return false;
    const id = this.world.getBlock(t.x, t.y, t.z);
    if (id !== B.DIRT && id !== B.GRASS) return false;
    const above = this.world.getBlock(t.x, t.y + 1, t.z);
    if (above !== B.AIR && RENDER[above] !== 1) return false;
    if (RENDER[above] === 1) this.breakBlock(t.x, t.y + 1, t.z);
    this.world.setBlock(t.x, t.y, t.z, B.FARMLAND);
    Sfx.playDig('grass');
    this.swingT = 0;
    this.wearTool();
    return true;
  }

  private tryPlant(t: NonNullable<ReturnType<World['raycast']>>, s: Stack): boolean {
    let x = t.x, y = t.y, z = t.z;
    if (this.world.getBlock(x, y, z) === B.FARMLAND) y += 1;
    else if (t.ny === 1 && this.world.getBlock(x, y, z) === B.FARMLAND) y += 1;
    else {
      x = t.x + t.nx; y = t.y + t.ny; z = t.z + t.nz;
    }
    if (this.world.getBlock(x, y - 1, z) !== B.FARMLAND) return false;
    if (this.world.getBlock(x, y, z) !== B.AIR) return false;
    this.world.setBlock(x, y, z, B.CROP0);
    this.growables.set(`${x},${y},${z}`, performance.now());
    Sfx.playPlace('grass');
    this.swingT = 0;
    void s;
    this.consumeSelected();
    return true;
  }

  private tryBucket(t: NonNullable<ReturnType<World['raycast']>>, s: Stack) {
    if (s.id === I.BUCKET) {
      if (t.id !== B.WATER && t.id !== B.LAVA) {
        this.message('Najedź na wodę albo lawę.');
        return;
      }
      const filled = t.id === B.WATER ? I.WATER_BUCKET : I.LAVA_BUCKET;
      if (this.mode === 'survival') {
        if (!this.inventory.add(filled, 1)) {
          this.message('Brak miejsca na wiadro.');
          return;
        }
        this.world.setBlock(t.x, t.y, t.z, B.AIR);
        Sfx.playSplash();
        this.consumeSelected();
      } else {
        // 2.4 fix: w trybie kreatywnym wiadro nie rozbierało już źródła wody
        // ani lawy – a samo zamieniało się w pełne wiadro.
        s.id = filled;
        Sfx.playSplash();
        this.updateHand();
        this.emitHud();
      }
      return;
    }
    const fluid = s.id === I.WATER_BUCKET ? B.WATER : B.LAVA;
    let px = t.x + t.nx, py = t.y + t.ny, pz = t.z + t.nz;
    if (RENDER[t.id] === 1) { px = t.x; py = t.y; pz = t.z; }
    const cur = this.world.getBlock(px, py, pz);
    if (cur !== B.AIR && RENDER[cur] !== 1 && cur !== B.WATER && cur !== B.LAVA) return;
    if (py < 0 || py >= CH) return;
    this.world.setBlock(px, py, pz, fluid);
    Sfx.playSplash();
    this.swingT = 0;
    if (this.mode === 'survival') {
      this.consumeSelected();
      this.inventory.add(I.BUCKET, 1);
    }
  }

  private facingOf(nx: number, ny: number, nz: number): number {
    if (ny !== 0) {
      const fx = -Math.sin(this.yaw);
      const fz = -Math.cos(this.yaw);
      return facingFromNormal(fx, fz);
    }
    return facingFromNormal(nx, nz);
  }

  private placeDoor(x: number, y: number, z: number, nx: number, ny: number, nz: number): boolean {
    if (y + 1 >= CH) { this.message('Drzwi potrzebują dwóch wolnych kratek.'); return false; }
    const above = this.world.getBlock(x, y + 1, z);
    if (above !== B.AIR && RENDER[above] !== 1 && RENDER[above] !== 2) { this.message('Drzwi potrzebują dwóch wolnych kratek.'); return false; }
    const b = this.body;
    if (aabbIntersectsBlock(b.pos.x, b.pos.y, b.pos.z, b.w, b.h, x, y + 1, z)) return false;
    const face = this.facingOf(nx, ny, nz);
    this.world.setBlock(x, y, z, doorPair(face, false, false));
    this.world.setBlock(x, y + 1, z, doorPair(face, false, true));
    return true;
  }

  private toggleDoor(x: number, y: number, z: number) {
    const id = this.world.getBlock(x, y, z);
    const face = doorFacing(id);
    if (face < 0) return;
    const top = isDoorTop(id);
    const open = !isDoorOpen(id);
    const otherY = top ? y - 1 : y + 1;
    const other = this.world.getBlock(x, otherY, z);
    this.world.setBlock(x, y, z, doorPair(face, open, top));
    if (other === B.AIR || isDoor(other)) this.world.setBlock(x, otherY, z, doorPair(face, open, !top));
    Sfx.playPlace('wood');
    this.swingT = 0;
  }

  private toggleTrap(x: number, y: number, z: number, nx: number, nz: number) {
    const id = this.world.getBlock(x, y, z);
    if (id === B.TRAP) {
      const face = nx !== 0 || nz !== 0 ? facingFromNormal(nx, nz) : this.facingOf(0, 1, 0);
      this.world.setBlock(x, y, z, B.TRAP_N + face);
    } else if (isTrapOpen(id)) {
      this.world.setBlock(x, y, z, B.TRAP);
    }
    Sfx.playPlace('wood');
    this.swingT = 0;
  }

  private toggleLever(x: number, y: number, z: number) {
    if (rsToggleLever(this.world, x, y, z)) {
      Sfx.playPlace('stone');
      this.swingT = 0;
      this.onBlockChanged(x, y, z);
      this.unlock('redstone');
    }
  }

  private pressButton(x: number, y: number, z: number) {
    if (rsPressButton(this.world, x, y, z)) {
      Sfx.playPlace('stone');
      this.swingT = 0;
      this.onBlockChanged(x, y, z);
      this.buttonTimers.set(`${x},${y},${z}`, 1.2);
      this.unlock('redstone');
    }
  }

  private playNoteBlock(x: number, y: number, z: number) {
    const below = this.world.getBlock(x, y - 1, z);
    const pitch = (x + z) % 24;
    Sfx.playNote(pitch, below);
    this.spawnParticles(x + 0.5, y + 1, z + 0.5, B.NOTE_BLOCK, 4, 0.2);
    this.swingT = 0;
  }

  private enterPortal() {
    if (this.portalCooldown > 0 || this.ui !== 'playing') return;
    if (this.isInNether) { this.leaveNether(); return; }
    this.message('Wkraczasz do portalu Netheru...');
    this.portalCooldown = 4;
    const px = this.body.pos.x, py = this.body.pos.y, pz = this.body.pos.z;
    this.portalExit = [px, py, pz];
    // Osobny wymiar: nadświat zostaje nietknięty w pamięci, gracz ląduje w
    // zupełnie nowym świecie (współrzędne /8 jak w klasyku).
    this.switchDimension(this.netherWorld);
    const spot = this.prepareNetherArrival(px / 8, pz / 8);
    this.body.pos.set(spot.x, spot.y, spot.z);
    this.body.vel.set(0, 0, 0);
    this.fallStart = spot.y;
    this.spawnParticles(spot.x, spot.y + 1, spot.z, B.NETHER_PORTAL, 20, 0.5);
    Sfx.playPortal();
    this.message('Przeniesiono do Netheru! Uważaj na lawę i Ghasty.');
    this.unlock('nether');
    this.emitHud();
  }

  /** Powrót przez portal do nadświatu – dokładnie w miejsce, z którego gracz wszedł. */
  private leaveNether() {
    if (!this.isInNether) return;
    this.portalCooldown = 4;
    this.switchDimension(this.homeWorld);
    const [ex, ey, ez] = this.portalExit ?? [this.spawnPoint.x, this.spawnPoint.y, this.spawnPoint.z];
    this.portalExit = null;
    // Stań TUŻ OBOK portalu – w środku natychmiast odbiłbyś się z powrotem.
    let sx = ex, sy = ey, sz = ez;
    const inPortal = (x: number, y: number, z: number) =>
      this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) === B.NETHER_PORTAL ||
      this.world.getBlock(Math.floor(x), Math.floor(y) + 1, Math.floor(z)) === B.NETHER_PORTAL;
    if (inPortal(sx, sy, sz)) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
        const tx = sx + dx, tz = sz + dz;
        const below = this.world.getBlock(Math.floor(tx), Math.floor(sy) - 1, Math.floor(tz));
        if (!inPortal(tx, sy, tz) && IS_SOLID[below]) { sx = tx; sz = tz; break; }
      }
    }
    this.body.pos.set(sx, sy, sz);
    this.body.vel.set(0, 0, 0);
    this.fallStart = sy;
    this.spawnParticles(sx, sy + 1, sz, B.NETHER_PORTAL, 20, 0.5);
    Sfx.playPortal();
    this.message('Wróciłeś do normalnego świata.');
    this.emitHud();
  }

  /**
   * Zamienia aktywny wymiar. Chunki wymiaru, z którego wychodzimy, zostają
   * w pamięci (raz z siatkami) – powrót jest natychmiastowy, bez regeneracji.
   * Wszystkie żyjące obiekty (moby, przedmioty, strzały, TNT, XP) są
   * przełączane razem ze światem, więc nigdy nie „wchodzą" na siebie.
   */
  private switchDimension(next: World) {
    const prev = this.world;
    if (prev === next) return;

    // 1. odepnij siatki wymiaru, z którego wychodzimy (geometria zostaje)
    for (const c of prev.chunks.values()) for (const m of c.meshes) this.scene.remove(m);
    // 2. odłóż jego żyjące obiekty
    this.stashLiveEntities();

    // 3. przeskocz
    this.world = next;
    this.isInNether = next !== this.homeWorld;

    // 4. przypnij siatki nowego wymiaru
    for (const c of next.chunks.values()) for (const m of c.meshes) this.scene.add(m);
    // 5. przywróć jego obiekty
    this.restoreStashedEntities();

    // 6. cache'e i stan przejściowy
    this.biomeCache.clear();
    this.villageName = null;
    this.chestPos = null;
    this.furnacePos = null;
    this.enchantPos = null;
    this.anvilPos = null;
    // 2.3: przynęta i tak nie przeżyłaby zmiany wymiaru.
    this.removeBobber();
    this.tradeMob = null;
    this.breakProgress = 0;
    this.breakKey = '';
    this.loadingProgress = 0;
    this.unloadTimer = 0;
  }

  private stashLiveEntities() {
    const s = this.dimStash[this.isInNether ? 'nether' : 'home'];
    for (const m of this.mobs) this.scene.remove(m.group);
    for (const d of this.drops) this.scene.remove(d.mesh);
    for (const a of this.arrows) this.scene.remove(a.mesh);
    for (const t of this.tnts) this.scene.remove(t.mesh);
    for (const o of this.orbs) this.scene.remove(o.mesh);
    for (const f of this.falling) this.scene.remove(f.mesh);
    s.mobs = this.mobs;
    s.drops = this.drops;
    s.arrows = this.arrows;
    s.tnts = this.tnts;
    s.orbs = this.orbs;
    s.falling = this.falling;
    s.buttons = [...this.buttonTimers.entries()];
    s.redstone = [...this.redstoneDirty];
    this.mobs = [];
    this.drops = [];
    this.arrows = [];
    this.tnts = [];
    this.orbs = [];
    this.falling = [];
    this.buttonTimers.clear();
    this.redstoneDirty.clear();
    this.tradeMob = null;
    // cząstki są ulotne – znikają razem z wymiarem
    for (const p of this.particles) this.scene.remove(p.mesh);
    this.particles = [];
  }

  private restoreStashedEntities() {
    const s = this.dimStash[this.isInNether ? 'nether' : 'home'];
    for (const m of s.mobs) this.scene.add(m.group);
    for (const d of s.drops) this.scene.add(d.mesh);
    for (const a of s.arrows) this.scene.add(a.mesh);
    for (const t of s.tnts) this.scene.add(t.mesh);
    for (const o of s.orbs) this.scene.add(o.mesh);
    for (const f of s.falling) this.scene.add(f.mesh);
    this.mobs = s.mobs;
    this.drops = s.drops;
    this.arrows = s.arrows;
    this.tnts = s.tnts;
    this.orbs = s.orbs;
    this.falling = s.falling;
    this.buttonTimers.clear();
    for (const [k, v] of s.buttons) this.buttonTimers.set(k, v);
    this.redstoneDirty.clear();
    for (const k of s.redstone) this.redstoneDirty.add(k);
    s.buttons = [];
    s.redstone = [];
  }

  /**
   * Lądowanie w Netherze: wyrównuje mały plac, stawia ramę portalu z powrotem
   * do nadświatu i zwraca punkt, w którym staje gracz (PRZED portalem).
   * Maksymalnie dwa chunki generowane synchronicznie – reszta doładuje się
   * budżetowo w pętli, więc wejście nie zawiesza klatek.
   */
  private prepareNetherArrival(nx: number, nz: number): { x: number; y: number; z: number } {
    const w = this.netherWorld;
    const cx = Math.floor(nx / CS), cz = Math.floor(nz / CS);
    w.getChunk(cx, cz);
    // Kandydaci na plac – w całości w środku chunka (max 2 generacje synchroniczne).
    let bx = cx * CS + 6, bz = cz * CS + 6, h = 0;
    for (const [ox, oz] of [[6, 6], [6, 9], [9, 6], [9, 9], [4, 4], [11, 11]]) {
      const hh = w.heightAt(cx * CS + ox, cz * CS + oz);
      if (hh >= 16) { bx = cx * CS + ox; bz = cz * CS + oz; h = hh; break; }
      if (hh > h) { bx = cx * CS + ox; bz = cz * CS + oz; h = hh; }
    }
    h = Math.max(8, Math.min(CH - 10, h));
    for (let dx = 0; dx <= 3; dx++) {
      for (let dz = -1; dz <= 2; dz++) {
        const x = bx + dx, z = bz + dz;
        for (let y = h + 1; y <= h + 5; y++) if (w.getBlock(x, y, z) !== B.AIR) w.setBlock(x, y, z, B.AIR);
        if (!IS_SOLID[w.getBlock(x, h, z)]) w.setBlock(x, h, z, B.NETHERRACK); // likwiduje dziury i lawę
      }
    }
    // klasyczna rama 4×5 z wnętrzem 2×3
    for (let dx = 0; dx <= 3; dx++) {
      w.setBlock(bx + dx, h, bz, B.OBSIDIAN);
      w.setBlock(bx + dx, h + 4, bz, B.OBSIDIAN);
    }
    for (let y = h + 1; y <= h + 3; y++) {
      w.setBlock(bx, y, bz, B.OBSIDIAN);
      w.setBlock(bx + 3, y, bz, B.OBSIDIAN);
      w.setBlock(bx + 1, y, bz, B.NETHER_PORTAL);
      w.setBlock(bx + 2, y, bz, B.NETHER_PORTAL);
    }
    return { x: bx + 1.5, y: h + 1, z: bz + 2 };
  }

  private onBlockChanged(x: number, y: number, z: number) {
    this.redstoneDirty.add(`${x},${y},${z}`);
    // also add neighbors
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as [number, number, number][]) {
      this.redstoneDirty.add(`${x + dx},${y + dy},${z + dz}`);
    }
  }

  private cookOnCampfire(s: Stack): boolean {
    // mięso i ryby piecze się tu jak w piecu – cookedOf() łączy reguły 2.3
    const meats: Record<number, number> = { [I.RAW_PORK]: I.COOKED_PORK, [I.RAW_BEEF]: I.COOKED_BEEF, [I.RAW_CHICKEN]: I.COOKED_CHICKEN, [I.RAW_RABBIT]: I.COOKED_RABBIT };
    const out = meats[s.id] ?? cookedOf(s.id);
    if (!out) return false;
    this.consumeSelected();
    if (!this.inventory.add(out, 1)) {
      this.spawnDrop(out, 1, this.body.pos.x, this.body.pos.y + 1, this.body.pos.z);
      this.message('Brak miejsca – mięso upadło na ziemię.');
    } else this.message(`Upieczono: ${displayName(out)}.`);
    Sfx.playEat();
    this.unlock('food');
    if (out === I.COOKED_FISH || out === I.COOKED_SALMON) this.unlock('chef');
    this.swingT = 0;
    return true;
  }

  private trySleep(x: number, y: number, z: number) {
    if (this.isInNether) {
      this.message('W Netheru nie da się spać – wróć przez portal.');
      return;
    }
    this.spawnPoint.set(x + 0.5, y + 1, z + 0.5);
    this.message('Punkt odrodzenia ustawiony.');
    if (this.daylight() > 0.55) {
      this.message('Możesz spać tylko w nocy.');
      return;
    }
    const near = this.mobs.some((m) => !m.dead && (m.type === 'zombie' || m.type === 'creeper') && m.body.pos.distanceTo(this.body.pos) < 8);
    if (near) {
      this.message('Nie możesz spać – potwory są zbyt blisko.');
      return;
    }
    this.time = 0.03;
    this.day++;
    this.health = Math.min(20, this.health + 2);
    this.unlock('bed');
    this.message('Przespałeś noc. Dzień ' + this.day + '.');
    this.emitHud();
  }

  private spillFurnace(x: number, y: number, z: number) {
    const f = this.furnaces.get(this.fKey(x, y, z));
    if (!f) return;
    for (const s of [f.input, f.fuel, f.output]) {
      // 2.3: zaklęty przedmiot w rozbitym piecu nie może stracić zaklęć ani nazwy.
      if (s) this.spawnDrop(s.id, s.count, x + 0.5, y + 0.6, z + 0.5, s.dur, undefined, undefined, undefined, s.ench, s.name);
    }
    this.furnaces.delete(this.fKey(x, y, z));
  }

  private itemTexture(id: number): THREE.Texture {
    let t = this.itemTex.get(id);
    if (t) return t;
    t = new THREE.Texture();
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    const img = new Image();
    img.onload = () => { t!.image = img; t!.needsUpdate = true; };
    img.src = this.icons[id] || '';
    this.itemTex.set(id, t);
    return t;
  }

  spawnDrop(id: number, count: number, x: number, y: number, z: number, dur?: number, vx = (Math.random() - 0.5) * 2.2, vy = 2.4 + Math.random() * 1.5, vz = (Math.random() - 0.5) * 2.2, ench?: Record<string, number>, name?: string) {
    if (count <= 0) return;
    // The oldest drop makes room instead of silently eating the new item.
    while (this.drops.length >= 120) {
      const victim = this.drops.shift();
      if (!victim) break;
      this.scene.remove(victim.mesh);
      const mat = (victim.mesh as THREE.Mesh).material;
      if (mat && !Array.isArray(mat)) mat.dispose();
    }
    let mesh: THREE.Object3D;
    if (BLOCKS[id]) {
      let geo = this.dropGeos.get(id);
      if (!geo) { geo = blockGeometry(id); this.dropGeos.set(id, geo); }
      mesh = new THREE.Mesh(geo, this.dropMat);
      mesh.scale.setScalar(RENDER[id] === 1 ? 0.4 : 0.28);
    } else {
      mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.32, 0.32),
        new THREE.MeshBasicMaterial({ map: this.itemTexture(id), transparent: true, alphaTest: 0.2, side: THREE.DoubleSide })
      );
    }
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.drops.push({ id, count, dur, ench, name, mesh, pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(vx, vy, vz), age: 0 });
  }

  // ---------- Messages & commands ----------
  message(text: string) {
    this.messages.push({ text, t: performance.now() });
    if (this.messages.length > 50) this.messages.shift();
    this.emitHud();
  }

  command(input: string) {
    const txt = input.trim();
    if (!txt) return;
    if (!txt.startsWith('/')) { this.message('<Gracz> ' + txt); return; }
    const [cmd, ...args] = txt.slice(1).split(/\s+/);
    switch (cmd.toLowerCase()) {
      case 'help':
        this.message(
          'Komendy: /gamemode, /time set <day|night>, /weather <clear|rain>, /tp x y z, ' +
            '/give <nazwa|id> [ilość], /summon <mob> [zawód], /village (najbliższa wioska), ' +
            '2.4: statyw alchemiczny (PPM), fiolka nad wodą, napoje, ' +
            '2.3: wędka (PPM), lorneta (przytrzymaj PPM), kowadło (PPM), ' +
            '/waypoint <add|list|select|remove> [nazwa], /xp <ilość>, /enchant <nazwa> [poziom], ' +
            '/heal, /kill, /seed, /spawn, /clear, /blocks'
        );
        break;
      case 'enchant': {
        const ench = resolveEnch(args[0] || '');
        const held = this.selectedStack();
        if (!ench) { this.message(`Zaklęcia: ${ENCHANTS.map((e) => e.id).join(', ')}`); break; }
        if (!held) { this.message('Trzymaj przedmiot w ręce.'); break; }
        if (!canEnchant(held.id, ench)) { this.message(`${displayName(held.id)} nie przyjmuje tego zaklęcia.`); break; }
        const lvl = Math.max(1, Math.min(10, parseInt(args[1] || '1', 10) || 1));
        addEnch(held, ench, lvl);
        this.message(`${displayName(held.id)}: ${enchName(ench, lvl)}.`);
        this.unlock('enchant');
        break;
      }
      case 'waypoint': case 'punkt': {
        const action = (args.shift() || 'list').toLowerCase();
        if (['add', 'dodaj'].includes(action)) {
          const point = this.addWaypoint(args.join(' ') || `Punkt ${this.waypoints.length + 1}`);
          this.message(point ? `Dodano punkt „${point.name}” (${point.x}, ${point.y}, ${point.z}).` : 'Nie można dodać punktu — limit to 12.');
        } else if (['list', 'lista'].includes(action)) {
          this.message(this.waypoints.length ? this.waypoints.map((w, i) => `${i + 1}:${w.name}${w.id === this.activeWaypointId ? '*' : ''}`).join(', ') : 'Nie masz jeszcze punktów. Użyj /waypoint add <nazwa>.');
        } else if (['select', 'wybierz'].includes(action)) {
          const index = parseInt(args[0] || '', 10) - 1;
          const point = this.waypoints[index];
          if (point) { this.activateWaypoint(point.id); this.message(`Śledzisz punkt „${point.name}”.`); }
          else this.message('Podaj numer z /waypoint list.');
        } else if (['remove', 'usun', 'usuń'].includes(action)) {
          const index = parseInt(args[0] || '', 10) - 1;
          const point = this.waypoints[index];
          if (point) { this.removeWaypoint(point.id); this.message(`Usunięto punkt „${point.name}”.`); }
          else this.message('Podaj numer z /waypoint list.');
        } else this.message('Użycie: /waypoint <add|list|select|remove> [nazwa/numer]');
        break;
      }
      case 'gamemode': case 'gm': {
        const m = (args[0] || '').toLowerCase();
        if (['creative', 'c', '1', 'kreatywny'].includes(m)) this.setMode('creative');
        else if (['survival', 's', '0', 'przetrwanie'].includes(m)) this.setMode('survival');
        else this.message('Użycie: /gamemode <survival|creative>');
        break;
      }
      case 'time': {
        const v = (args[1] || args[0] || '').toLowerCase();
        const map: Record<string, number> = { day: 0.05, dzien: 0.05, noon: 0.25, night: 0.55, noc: 0.55, midnight: 0.75 };
        if (v in map) this.time = map[v];
        else if (!isNaN(parseFloat(v))) this.time = (parseFloat(v) / 24000 + 0.0) % 1;
        else { this.message('Użycie: /time set <day|night|noon|midnight>'); break; }
        this.message('Ustawiono czas.');
        break;
      }
      case 'tp': {
        const [x, y, z] = args.map(Number);
        if ([x, y, z].some((n) => isNaN(n))) { this.message('Użycie: /tp x y z'); break; }
        this.body.pos.set(x, y, z);
        this.body.vel.set(0, 0, 0);
        this.fallStart = y;
        this.message(`Teleportowano do ${x} ${y} ${z}`);
        break;
      }
      case 'give': {
        const id = resolveId(args[0] || '');
        if (id == null) { this.message('Nie znam takiego przedmiotu. Np. /give kilof, /give wegiel 16, /give 5'); break; }
        const fallback = ITEMS[id]?.kind === 'tool' || ITEMS[id]?.kind === 'bucket' || ITEMS[id]?.stack === 1 ? 1 : 64;
        const n = args[1] ? parseInt(args[1], 10) : fallback;
        const count = Number.isNaN(n) ? fallback : Math.max(1, Math.min(fallback === 1 ? 1 : 256, n));
        if (this.inventory.add(id, count)) {
          this.message(`Otrzymano ${count}x ${displayName(id)}`);
        } else {
          this.spawnDrop(id, count, this.body.pos.x, this.body.pos.y + 1, this.body.pos.z);
          this.message(`Brak miejsca – ${count}x ${displayName(id)} upadło obok.`);
        }
        this.notePickup(id);
        break;
      }
      case 'weather': case 'pogoda': {
        const v = (args[0] || '').toLowerCase();
        if (['clear', 'sun', 'slonce', 'słońce', 'jasno'].includes(v)) this.setWeather('clear');
        else if (['rain', 'deszcz', 'burza'].includes(v)) this.setWeather('rain');
        else this.message('Użycie: /weather <clear|rain>');
        break;
      }
      case 'xp': {
        const n = parseInt(args[0] || '', 10);
        if (Number.isNaN(n) || n <= 0) { this.message('Użycie: /xp <ilość>  (np. /xp 50)'); break; }
        this.gainXp(Math.min(5000, n));
        this.message(`Dodano ${Math.min(5000, n)} doświadczenia. Poziom: ${this.xp.info().level}.`);
        break;
      }
      case 'heal':
        this.health = 20;
        this.hunger = 20;
        this.air = this.maxAir;
        this.message('Uleczono.');
        break;
      case 'blocks':
        this.message(BLOCKS.filter((b) => b && b.id > 0).map((b) => `${b.id}:${b.name}`).join(', '));
        break;
      case 'summon': {
        const raw = (args[0] || 'pig').toLowerCase();
        const map: Record<string, MobType> = {
          pig: 'pig', swinia: 'pig', świnia: 'pig', rabbit: 'rabbit', krolik: 'rabbit', królik: 'rabbit', fox: 'fox', lis: 'fox', sheep: 'sheep', owca: 'sheep', zombie: 'zombie',
          cow: 'cow', krowa: 'cow', chicken: 'chicken', kurczak: 'chicken', creeper: 'creeper',
          spider: 'spider', pająk: 'spider', pajak: 'spider', skeleton: 'skeleton', szkielet: 'skeleton',
          wolf: 'wolf', wilk: 'wolf', pies: 'wolf',
          villager: 'villager', mieszkaniec: 'villager', wieśniak: 'villager', wiesniak: 'villager',
          golem: 'golem', zelazny_golem: 'golem', 'żelazny_golem': 'golem',
          enderman: 'enderman', endermen: 'enderman', enderman_pl: 'enderman',
          slime: 'slime', szlam: 'slime',
          ghast: 'ghast',
        };
        const t = map[raw];
        if (!t) {
          this.message('Moby: pig, rabbit, fox, sheep, cow, chicken, wolf, zombie, creeper, spider, skeleton, villager, golem, enderman, slime, ghast');
          break;
        }
        const d = this.lookDir();
        // Zawód mieszkańca można wybrać: /summon villager kowal
        let profession = Math.random();
        if (t === 'villager' && args[1]) {
          const want = args[1].toLowerCase();
          const idx = PROFESSIONS.findIndex((pr) => pr.id === want || pr.name.toLowerCase() === want);
          if (idx < 0) {
            this.message(`Zawody: ${PROFESSIONS.map((pr) => `${pr.id} (${pr.name})`).join(', ')}`);
            break;
          }
          profession = (idx + 0.5) / PROFESSIONS.length;
        }
        const mob = this.spawnMob(t, this.body.pos.x + d.x * 3, this.body.pos.y + 1, this.body.pos.z + d.z * 3, profession);
        if (t === 'golem') this.unlock('golem');
        this.message('Przyzwano: ' + (t === 'villager' ? `mieszkańca (${villagerTitle(mob.trade ?? createVillagerState(professionFor(profession), this.nowSeconds()))})` : t));
        break;
      }
      case 'village': case 'wioska': {
        const near = this.world.nearestVillage(this.body.pos.x, this.body.pos.z, 4);
        if (!near) { this.message('Nie znalazłem wioski w pobliżu – spróbuj w innym miejscu albo w nowym świecie.'); break; }
        const v = near.village;
        this.body.pos.set(v.x + 4.5, v.y + 1.4, v.z + 4.5);
        this.body.vel.set(0, 0, 0);
        this.fallStart = this.body.pos.y;
        this.message(`Wioska ${Math.round(v.x)} ${Math.round(v.z)} – ${Math.round(near.dist)} bloków stąd, ${v.buildings.length} budynków.`);
        break;
      }
      case 'kill':
        this.damage(1000, true);
        break;
      case 'seed':
        this.message('Ziarno świata: ' + this.world.seed);
        break;
      case 'spawn':
        // W Netherze komenda najpierw odsyła gracza do nadświatu.
        if (this.isInNether) this.switchDimension(this.homeWorld);
        this.body.pos.copy(this.spawnPoint);
        this.body.vel.set(0, 0, 0);
        this.fallStart = this.body.pos.y;
        break;
      case 'clear':
        this.inventory.slots.fill(null);
        this.message('Wyczyszczono ekwipunek.');
        break;
      default:
        this.message('Nieznana komenda. Wpisz /help');
    }
    this.emitHud();
  }

  currentDimension(): Waypoint['dimension'] {
    return this.isInNether ? 'nether' : 'overworld';
  }

  addWaypoint(name: string, kind: Waypoint['kind'] = 'custom', at: { x: number; y: number; z: number } = this.body.pos): Waypoint | null {
    // Some embedders/tests create a lightweight Game-shaped object without
    // running the constructor; keep this helper defensive as the rest of API.
    if (!Array.isArray(this.waypoints)) this.waypoints = [];
    const clean = name.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 32);
    if (!clean) return null;
    if (kind === 'death') {
      this.waypoints = this.waypoints.filter((w) => w.kind !== 'death');
      if (this.waypoints.length >= 12) this.waypoints.shift();
    }
    if (this.waypoints.length >= 12) return null;
    const waypoint: Waypoint = {
      id: `p${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: clean,
      x: Math.floor(at.x), y: Math.floor(at.y), z: Math.floor(at.z),
      dimension: this.currentDimension(), kind,
    };
    this.waypoints.push(waypoint);
    this.activeWaypointId = waypoint.id;
    if (kind === 'custom' && this.unlocked instanceof Set) this.unlock('cartographer');
    this.emitHud();
    return waypoint;
  }

  /** Marks the actual block under the spyglass reticle, never a generated-on-
   * demand point or the fake STONE sentinel at an unloaded chunk boundary. */
  markSpyglass(): boolean {
    if (this.ui !== 'playing' || !this.zooming || this.selectedStack()?.id !== I.SPYGLASS) return false;
    const eye = this.eyePos();
    const dir = this.aimDir ?? this.lookDir();
    const reach = Math.min(96, this.renderDistance * CS - 2);
    const hit = this.world.raycast(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, reach);
    if (!hit || !this.world.hasChunk(Math.floor(hit.x / CS), Math.floor(hit.z / CS))) {
      this.message('Lorneta: nie widać celu w zasięgu załadowanego świata.');
      return false;
    }
    const point = this.addWaypoint(`Namierzono: ${BLOCKS[hit.id]?.name ?? 'miejsce'}`, 'custom', hit);
    if (!point) { this.message('Lorneta: usuń stary znacznik (K), aby dodać nowy.'); return false; }
    this.message(`Lorneta: śledzisz cel ${point.x}, ${point.y}, ${point.z}.`);
    return true;
  }

  activateWaypoint(id: string | null) {
    this.activeWaypointId = id && this.waypoints.some((w) => w.id === id) ? id : null;
    this.emitHud();
  }

  removeWaypoint(id: string) {
    this.waypoints = this.waypoints.filter((w) => w.id !== id);
    if (this.activeWaypointId === id) this.activeWaypointId = null;
    this.emitHud();
  }

  /** Toggle creative flight (used by F, double-space and the touch controls). */
  toggleFly() {
    if (this.mode !== 'creative') return;
    this.flying = !this.flying;
    this.body.vel.y = 0;
    this.emitHud();
  }

  setMode(m: GameMode) {
    this.mode = m;
    if (m === 'survival') this.flying = false;
    this.health = 20;
    this.message(m === 'creative' ? 'Tryb gry: Kreatywny' : 'Tryb gry: Przetrwanie');
    this.emitHud();
  }

  // ---------- Save ----------
  /** Change one rule on this world only. Does not mutate global visual settings. */
  setDifficulty(patch: Partial<WorldDifficulty>): boolean {
    this.difficulty = normalizeDifficulty({ ...this.difficulty, ...patch });
    const saved = this.save();
    this.emitHud();
    return saved;
  }

  save() {
    try {
      // homeWorld zawsze istnieje w pełnej grze; defensywny fallback
      // przydaje się też testom, które budują obiekt przez Game.prototype.
      const home = this.homeWorld ?? this.world;
      const data: SaveData = {
        id: this.worldId,
        name: this.worldName,
        worldType: this.worldType,
        terrainVersion: home.terrainVersion,
        seed: home.seed,
        mode: this.mode,
        mods: home.serializeMods(),
        // 1.8: Nether zapisywany jest osobno – stare zapisy bez netherMods
        // po prostu dostają pusty (nowy) wymiar.
        netherMods: this.netherWorld ? this.netherWorld.serializeMods() : {},
        isInNether: !!this.isInNether,
        portalExit: this.portalExit ?? undefined,
        pos: [this.body.pos.x, this.body.pos.y, this.body.pos.z],
        yaw: this.yaw,
        pitch: this.pitch,
        inv: this.inventory.slots.map((s) => (s ? { ...s, ench: s.ench ? { ...s.ench } : undefined } : null)),
        time: this.time,
        health: this.health,
        hunger: this.hunger,
        day: this.day,
        spawn: [this.spawnPoint.x, this.spawnPoint.y, this.spawnPoint.z],
        furnaces: [...this.furnaces.values()],
        chests: [...this.chests.values()],
        anvils: this.anvils ? [...this.anvils.values()] : [],
        brewings: this.brewings ? [...this.brewings.values()] : [],
        potionsDrunk: this.potionsDrunk ? [...this.potionsDrunk] : [],
        effects: Object.fromEntries(this.effects ?? []),
        difficulty: normalizeDifficulty(this.difficulty),
        challengeProgress: { ...this.challengeProgress },
        unlocked: [...this.unlocked],
        weather: this.weather,
        xp: this.xp.total,
        trades: this.trades,
        waypoints: (this.waypoints ?? []).map((w) => ({ ...w })),
        activeWaypointId: this.activeWaypointId ?? null,
        discovery: (this.discovery ?? new DiscoveryMap()).serialize(),
        armor: this.armor.map((s) => (s ? { ...s, ench: s.ench ? { ...s.ench } : undefined } : null)),
        fishCaught: this.fishCaught,
        fishingBait: this.fishingBait,
        updated: Date.now(),
      };
      upsertSave({ ...data, id: this.worldId });
      return true;
    } catch (e) {
      console.warn('Save failed', e);
      // A failed quota write leaves the previous localStorage value intact.
      // Never tell the player it was saved; offer export/space recovery instead.
      if (this.messages && typeof this.onHud === 'function') this.message('Nie zapisano świata: pamięć przeglądarki jest pełna lub niedostępna. Zwolnij miejsce i spróbuj ponownie.');
      return false;
    }
  }

  // ---------- Chunks ----------
  buildChunk(cx: number, cz: number) {
    const c = this.world.getChunk(cx, cz);
    for (const m of c.meshes) {
      this.scene.remove(m);
      m.geometry.dispose();
    }
    c.meshes = [];
    const geos = this.world.buildMesh(c);
    geos.forEach((g, i) => {
      if (!g.getAttribute('position')) { g.dispose(); return; }
      const m = new THREE.Mesh(g, this.materials[i]);
      m.matrixAutoUpdate = false;
      m.renderOrder = i;
      this.scene.add(m);
      c.meshes.push(m);
    });
    c.built = true;
  }

  private updateChunks() {
    const pcx = Math.floor(this.body.pos.x / CS), pcz = Math.floor(this.body.pos.z / CS);
    // dirty first
    let rebuilt = 0;
    for (const k of this.world.dirty) {
      const c = this.world.chunks.get(k);
      this.world.dirty.delete(k);
      if (c && c.built) { this.buildChunk(c.cx, c.cz); rebuilt++; }
      if (rebuilt > 10) break;
    }
    let built = 0;
    const t0 = performance.now();
    let total = 0, done = 0;
    for (const [dx, dz] of this.offsets) {
      total++;
      const c = this.world.chunks.get(World.key(pcx + dx, pcz + dz));
      if (c && c.built) { done++; continue; }
      // 2.0: budżet zależny od jakości (na słabych telefonach mniejszy).
      if (built < this.gfx.chunksPerFrame && performance.now() - t0 < this.gfx.chunkBudgetMs) {
        this.buildChunk(pcx + dx, pcz + dz);
        built++;
        done++;
      }
    }
    this.loadingProgress = done / Math.max(1, total);
    this.unloadTimer -= 1 / 60;
    if (this.unloadTimer <= 0) {
      this.unloadTimer = 2;
      const lim = this.renderDistance + this.gfx.unloadMargin;
      for (const [k, c] of this.world.chunks) {
        if (Math.abs(c.cx - pcx) > lim || Math.abs(c.cz - pcz) > lim) {
          for (const m of c.meshes) { this.scene.remove(m); m.geometry.dispose(); }
          this.world.chunks.delete(k);
        }
      }
    }
  }

  // ---------- Helpers ----------
  lookDir() {
    return new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  eyePos() {
    return new THREE.Vector3(this.body.pos.x, this.body.pos.y + this.eyeHeight, this.body.pos.z);
  }

  selectedStack(): Stack | null {
    return this.inventory.slots[this.selected];
  }

  /** Biome under the player, cached per chunk so noise runs once per chunk, not per frame. */
  private biomeAt(): Biome {
    const cx = Math.floor(this.body.pos.x / CS), cz = Math.floor(this.body.pos.z / CS);
    const key = World.key(cx, cz);
    let b = this.biomeCache.get(key);
    if (b === undefined) {
      b = this.world.surface(this.body.pos.x, this.body.pos.z).biome;
      if (this.biomeCache.size > 64) this.biomeCache.clear();
      this.biomeCache.set(key, b);
    }
    return b;
  }

  daylight(): number {
    const s = Math.sin(this.time * Math.PI * 2);
    return Math.max(0.16, Math.min(1, 0.55 + s * 1.6));
  }

  spawnParticles(x: number, y: number, z: number, id: number, n = 12, spread = 0.5) {
    // 2.0: budżet cząsteczek zależy od jakości (na „Niskich” leci ~35%).
    const scale = this.gfx.particleScale;
    if (scale <= 0.01) return;
    n = Math.max(1, Math.round(n * scale));
    let mat = this.particleMats.get(id);
    if (!mat) {
      const c = AVG_COLOR[id] || [128, 128, 128];
      mat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace) });
      this.particleMats.set(id, mat);
    }
    for (let i = 0; i < n; i++) {
      if (this.particles.length > Math.floor(400 * Math.max(0.35, scale))) break;
      const m = new THREE.Mesh(this.particleGeo, mat);
      const s = 0.06 + Math.random() * 0.08;
      m.scale.setScalar(s);
      m.position.set(x + (Math.random() - 0.5) * spread * 2, y + (Math.random() - 0.5) * spread * 2, z + (Math.random() - 0.5) * spread * 2);
      this.scene.add(m);
      this.particles.push({ mesh: m, vel: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4 + 1, (Math.random() - 0.5) * 4), life: 0, max: 0.5 + Math.random() * 0.5, gravity: 16 });
    }
  }

  spawnSmoke(x: number, y: number, z: number, n: number, spread: number) {
    const scale = this.gfx.particleScale;
    if (scale <= 0.01) return;
    n = Math.max(1, Math.round(n * scale));
    let mat = this.particleMats.get(-1);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.8 });
      this.particleMats.set(-1, mat);
    }
    for (let i = 0; i < n; i++) {
      if (this.particles.length > Math.floor(500 * Math.max(0.35, scale))) break;
      const m = new THREE.Mesh(this.particleGeo, mat);
      m.scale.setScalar(0.3 + Math.random() * 0.4);
      m.position.set(x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread, z + (Math.random() - 0.5) * spread);
      this.scene.add(m);
      this.particles.push({ mesh: m, vel: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3), life: 0, max: 0.8 + Math.random() * 0.8, gravity: -1, grow: 1.2 });
    }
  }

  // ---------- Hand ----------
  updateHand() {
    const s = this.selectedStack();
    const id = s ? s.id : -1;
    if (id === this.handId) return;
    this.handId = id;
    if (this.handMesh) {
      this.hand.remove(this.handMesh);
      this.handMesh.geometry.dispose();
      const mat = this.handMesh.material;
      if (mat !== this.handMat && !Array.isArray(mat)) mat.dispose();
    }
    let mesh: THREE.Mesh;
    if (isItem(id)) {
      mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.42, 0.42),
        new THREE.MeshBasicMaterial({ map: this.itemTexture(id), transparent: true, depthTest: false, alphaTest: 0.12, side: THREE.DoubleSide })
      );
      mesh.position.set(0.48, -0.36, -0.62);
      mesh.rotation.set(0.15, -0.55, 0.2);
    } else if (id < 0) {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.7), new THREE.MeshBasicMaterial({ color: 0xc89a78, depthTest: false }));
      mesh.position.set(0.5, -0.45, -0.55);
      mesh.rotation.set(0.2, 0.15, 0);
    } else {
      mesh = new THREE.Mesh(blockGeometry(id), this.handMat);
      const cross = RENDER[id] === 1;
      mesh.scale.setScalar(cross ? 0.45 : 0.36);
      mesh.position.set(0.5, -0.42, -0.72);
      mesh.rotation.set(0.05, cross ? -0.3 : Math.PI / 4 + 0.1, 0);
    }
    mesh.renderOrder = 1000;
    this.handMesh = mesh;
    this.hand.add(mesh);
  }

  // ---------- Interaction ----------
  private findMobTarget(maxDist: number) {
    const o = this.eyePos();
    // 2.5: na dotyku mobów szukamy wzdłuż kierunku PALCA (touchAim), nie
    // środka ekranu – wcześniej tapnięcie w moba obok celownika atakowało
    // w próżnię albo trafiało w coś zupełnie innego.
    const d = this.aimDir ?? this.lookDir();
    let best: Mob | null = null;
    let bd = maxDist;
    for (const m of this.mobs) {
      if (m.dead) continue;
      const t = m.rayHit(o, d, maxDist);
      if (t !== null && t < bd) { bd = t; best = m; }
    }
    return { mob: best, dist: bd };
  }

  tryAttack() {
    this.swingT = 0;
    const blockDist = this.target ? this.target.dist : 99;
    const { mob, dist } = this.findMobTarget(3.5);
    if (mob && dist < blockDist && this.attackCooldown <= 0) {
      const toolId = this.selectedStack()?.id ?? 0;
      if (ITEMS[toolId]?.tool === 'shears' && mob.type === 'sheep') {
        this.attackCooldown = 0.35;
        if (mob.shear()) {
          const n = 1 + (Math.random() < 0.4 ? 1 : 0);
          this.spawnDrop(B.WOOL_WHITE, n, mob.body.pos.x, mob.body.pos.y + 0.6, mob.body.pos.z, undefined, (Math.random() - 0.5) * 2, 2, (Math.random() - 0.5) * 2);
          this.wearTool();
          this.unlock('shear');
          this.gainXp(1);
          Sfx.playPlace('cloth');
          this.message(n > 1 ? 'Ostrzyżono owcę. Dwie wełny.' : 'Ostrzyżono owcę.');
          return;
        }
        // 2.5: już ostrzyżona owca dostaje zwykły cios – wcześniej
        // przytrzymany LPM spamował komunikatem „już ostrzyżona”.
      }
      this.attackCooldown = attackCooldown(toolId);
      const held = this.selectedStack();
      let dmg = attackDamage(toolId, this.sprinting, sharpnessDamage(enchLevel(held, 'sharpness')));
      // 2.4: napój siły dorzuca obrażenia do każdego trafienia
      if (this.hasEffect('strength')) dmg += STRENGTH_DAMAGE;
      const kb = knockbackFactor(enchLevel(held, 'knockback'));
      if (mob.damage(dmg, this.body.pos.x, this.body.pos.z)) {
        if (kb > 1) {
          mob.body.vel.x *= kb;
          mob.body.vel.z *= kb;
          mob.body.vel.y = Math.max(mob.body.vel.y, 6 * kb);
        }
        if (mob.dead && isHostileMob(mob.type)) this.advanceChallenge('challenge_hunter');
        Sfx.playHurt();
        Sfx.playMob(mob.type);
        this.wearTool();
        if (this.mode === 'survival') this.hunger = Math.max(0, this.hunger - 0.08);
        // Grabież: remember the level so mobLoot() can roll extras once
        mob.bonusLoot = Math.max(mob.bonusLoot, enchLevel(held, 'looting'));
        // 1.6: krzywda mieszkańca budzi okoliczne golemy
        if (mob.type === 'villager') {
          const n = this.provokeGolems(mob.body.pos.x, mob.body.pos.z, 26, 20);
          if (n > 0) this.message(n === 1 ? 'Golem w okolicy to zauważył!' : 'Golemy w okolicy to zauważyły!');
        }
      }
      // 2.5: NIE zwalniamy LPM – trzymany przycisk bije dalej z cooldownem
      // (updateInteraction). Wcześniej każde trafienie „zjadało” wciśnięcie,
      // więc walka wymagała ręcznego klikania, a kopanie zamierało, gdy mob
      // wejdzie w celownik.
      return;
    }
    if (this.target && this.target.id === B.TNT) {
      this.igniteTNT(this.target.x, this.target.y, this.target.z, 4);
      this.unlock('boom');
      this.mouseLeft = false; // podpalenie tylko na kliknięcie – bez trzymania
      return;
    }
    if (this.mode === 'creative' && this.target) {
      this.breakBlock(this.target.x, this.target.y, this.target.z);
      this.breakCooldown = 0.25;
    }
  }

  /** Fires an arrow when the player lets go of RMB while holding a bow. */
  private releaseBow() {
    const charge = Math.max(0.12, Math.min(1, this.bowDraw));
    this.bowDraw = -1;
    const bow = this.selectedStack();
    const power = powerFactor(enchLevel(bow, 'power'));
    const infinite = enchLevel(bow, 'infinity') > 0;
    if (this.mode === 'survival' && this.inventory.countOf(I.ARROW) <= 0) {
      this.message('Brak strzał. Wytwórz je z krzemienia, patyka i pióra.');
      return;
    }
    // Nieskończoność: jedna strzała w ekwipunku wystarczy na wiele wystrzałów
    if (this.mode === 'survival' && !infinite) this.inventory.remove(I.ARROW, 1);
    const eye = this.eyePos();
    // 2.5: na dotyku strzała leci tam, gdzie celuje palec (touchAim),
    // a nie w środek ekranu – wcześniej naciąganie łuku celowało „obok”.
    const d = this.aimDir ?? this.lookDir();
    this.spawnArrow(eye.addScaledVector(d, 0.5), d, 22 + charge * 26, null, (4 + charge * 5) * power);
    Sfx.playBow();
    this.swingT = 0;
    this.wearTool();
    this.unlock('archer');
  }

  /** PPM z perłą Endu: rzut; gracz teleportuje się tam, gdzie perła spadnie (1.9). */
  private throwPearl() {
    if (this.pearlCd > 0 || this.ui === 'dead') return;
    this.pearlCd = 0.9;
    if (this.mode === 'survival') this.consumeSelected();
    if (!this.pearlGeo) this.pearlGeo = new THREE.SphereGeometry(0.1, 8, 6);
    if (!this.pearlMat) this.pearlMat = new THREE.MeshBasicMaterial({ color: 0x49d8c0 });
    const mesh = new THREE.Mesh(this.pearlGeo, this.pearlMat);
    const eye = this.eyePos();
    const d = this.aimDir ?? this.lookDir(); // 2.5: cel dotyku, nie środek ekranu
    mesh.position.copy(eye);
    this.scene.add(mesh);
    this.arrows.push({ mesh, pos: eye.clone(), vel: d.clone().multiplyScalar(24), life: 0, power: 0, from: null, pearl: true });
    Sfx.playBow();
    this.swingT = 0;
  }

  // ---------- 2.3: wędkarstwo ----------

  /** One bait is removed when prepared, never at pickup. It persists through
   * save/load and is lost on a completed or missed bite or player death. */
  attachBait(id: BaitId): boolean {
    if (this.fishingBait) { this.message('Na haczyku jest już przynęta. Zużyj ją przed zmianą.'); return false; }
    if (this.bobber) { this.message('Zwiń wędkę, zanim założysz przynętę.'); return false; }
    if (this.inventory.countOf(I.FISHING_ROD) < 1) { this.message('Potrzebujesz wędki w ekwipunku.'); return false; }
    if (this.mode === 'survival') this.consumeSelected();
    this.fishingBait = id;
    this.message(`Założono: ${displayName(id)}. Przełącz na wędkę i zarzuć.`);
    this.emitHud();
    return true;
  }

  /** PPM z wędką: rzuca przynętę albo zwina haczyk. */
  useRod() {
    if (this.bobber) {
      this.reelRod();
      return;
    }
    if (this.ui !== 'playing') return;
    if (!this.bobberGeo) this.bobberGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    if (!this.bobberMat) this.bobberMat = new THREE.MeshBasicMaterial({ color: 0xd83a3a });
    const mesh = new THREE.Mesh(this.bobberGeo, this.bobberMat);
    const eye = this.eyePos();
    const d = this.aimDir ?? this.lookDir(); // 2.5: spławik leci pod palcem
    mesh.position.copy(eye);
    this.scene.add(mesh);
    this.bobber = {
      mesh,
      pos: eye.clone(),
      vel: d.clone().multiplyScalar(16 + (this.sprinting ? 6 : 0)),
      state: 'flying',
      wait: 0,
      biteAt: 0,
      window: 0,
    };
    Sfx.playPop();
    this.swingT = 0;
    this.wearTool();
    this.emitHud();
  }

  /** Druga wędkarstwo: branie, wyciągnięcie albo strata przynęty. */
  private reelRod() {
    const b = this.bobber;
    if (!b) return;
    if (b.state === 'bite') {
      this.landFish();
    } else if (b.state === 'water') {
      this.message('Nic nie brało. Zostaw przynętę dłużej w wodzie.');
    } else if (b.state === 'reeling') {
      return;
    } else {
      this.message('Wciągasz wędkę.');
    }
    this.pullBobberBack();
  }

  /** Wynik zakończonego haczenia. */
  private landFish() {
    const haul = rollCatch(Math.random, this.fishingBait);
    this.fishingBait = null;
    if (this.mode === 'survival') this.giveOrDrop({ ...haul });
    Sfx.playPop();
    this.spawnParticles(this.body.pos.x, this.body.pos.y + 1.2, this.body.pos.z, isFishStack(haul) ? I.RAW_FISH : I.STRING, 8, 0.4);
    const howmany = haul.count > 1 ? ` ×${haul.count}` : '';
    this.message(`Złowiono: ${displayName(haul.id)}${howmany}.`);
    if (isFishStack(haul)) {
      this.fishCaught++;
      this.gainXp(3);
      this.unlock('fisher');
      if (this.fishCaught >= 5) this.unlock('angler');
    } else {
      this.gainXp(1);
    }
    this.wearTool();
  }

  /** Spławik wraca do gracza i znika w ręce. */
  private pullBobberBack() {
    const b = this.bobber;
    if (!b) return;
    b.state = 'reeling';
    this.wearTool();
  }

  private removeBobber() {
    const b = this.bobber;
    if (!b) return;
    this.scene.remove(b.mesh);
    this.bobber = null;
    this.emitHud();
  }

  /** Stan wędkarstwa na HUD. */
  fishingState(): 'idle' | 'cast' | 'waiting' | 'bite' {
    const b = this.bobber;
    if (!b) return 'idle';
    if (b.state === 'bite') return 'bite';
    if (b.state === 'water' || b.state === 'rest') return 'waiting';
    return 'cast';
  }

  /** 2.3: lot, tonięcie, branie i zmywanie przynęty. */
  private updateFishing(dt: number) {
    const b = this.bobber;
    if (!b || this.ui !== 'playing') return;
    const eye = this.eyePos();
    if (b.state === 'reeling') {
      b.vel.subVectors(eye, b.pos).normalize().multiplyScalar(26);
      b.pos.addScaledVector(b.vel, dt);
      b.mesh.position.copy(b.pos);
      if (b.pos.distanceTo(eye) < 0.7) this.removeBobber();
      return;
    }
    if (b.state === 'flying' || b.state === 'rest') {
      b.vel.y -= 20 * dt;
      b.pos.addScaledVector(b.vel, dt);
      b.mesh.position.copy(b.pos);
      if (b.pos.y < 0) { this.removeBobber(); return; }
      const x = Math.floor(b.pos.x), y = Math.floor(b.pos.y), z = Math.floor(b.pos.z);
      const block = this.world.peekBlock(x, y, z);
      if (block === B.LAVA) {
        this.message('Przynęta spaliła się w lawie.');
        this.fishingBait = null;
        this.removeBobber();
        return;
      }
      if (block === B.WATER) {
        b.state = 'water';
        b.pos.y = y + 0.9;
        b.vel.set(0, 0, 0);
        b.wait = 0;
        b.biteAt = biteDelay(Math.random, this.fishingBait);
        this.message('Przynęta w wodzie. Czekaj na brań…');
        return;
      }
      if (b.state === 'flying' && this.world.isSolid(x, y, z)) {
        b.state = 'rest';
        b.pos.y = y + 1.05;
        b.vel.set(0, 0, 0);
      }
    }
    // spławik leży w wodzie, na ziemi albo właśnie bierze
    const x = Math.floor(b.pos.x), y = Math.floor(b.pos.y), z = Math.floor(b.pos.z);
    const inWater = this.world.peekBlock(x, y, z) === B.WATER;
    b.wait += dt;
    if (b.state === 'bite') {
      b.window -= dt;
      b.mesh.position.set(b.pos.x, b.pos.y + Math.abs(Math.sin(b.window * 9)) * -0.35 + 0.1, b.pos.z);
      if (b.window <= 0) {
        this.message('Ryba uciekła z przynęty.');
        this.fishingBait = null;
        this.removeBobber();
      }
      return;
    }
    if (b.state === 'rest' && inWater) {
      b.state = 'water';
      b.pos.y = y + 0.9;
      b.wait = 0;
      b.biteAt = biteDelay(Math.random, this.fishingBait);
      this.message('Przynęta w wodzie. Czekaj na brań…');
      return;
    }
    if (b.state === 'rest') {
      b.mesh.position.set(b.pos.x, b.pos.y, b.pos.z);
      if (b.wait > PATIENCE) {
        this.message('Przynęta zgniła – wyrzuć wędkę dalej od brzegu.');
        this.removeBobber();
      }
      return;
    }
    // water
    b.pos.y = y + 0.9 - Math.sin(b.wait * 2.2) * 0.06;
    b.mesh.position.set(b.pos.x, b.pos.y, b.pos.z);
    if (this.bobberMat) this.bobberMat.color.setHex(0xd83a3a);
    if (b.wait >= b.biteAt) {
      b.state = 'bite';
      b.window = BITE_WINDOW;
      if (this.bobberMat) this.bobberMat.color.setHex(0xf2f2f2);
      Sfx.playPop();
      this.spawnParticles(b.pos.x, b.pos.y, b.pos.z, B.WATER, 6, 0.3);
      this.message('Brań! PPM, aby zaciągnąć.');
    } else if (b.wait > PATIENCE) {
      this.message('Woda zmyła przynętę.');
      this.fishingBait = null;
      this.removeBobber();
    }
  }

  /** Perła wylądowała: gracz pojawia się w ostatnim wolnym punkcie lotu. */
  private pearlTeleport(to: THREE.Vector3) {
    if (this.ui === 'dead') return;
    const b = this.body;
    b.pos.set(to.x, to.y, to.z);
    b.vel.set(0, 0, 0);
    // podnieś pozycję, aż stopy i głowa będą w wolnych blokach
    let guard = 0;
    while (guard++ < CH && (this.world.isSolid(Math.floor(b.pos.x), Math.floor(b.pos.y), Math.floor(b.pos.z)) ||
      this.world.isSolid(Math.floor(b.pos.x), Math.floor(b.pos.y + b.h - 0.1), Math.floor(b.pos.z)))) {
      b.pos.y += 1;
    }
    this.damage(2);
    Sfx.playPortal();
    this.unlock('pearl');
    this.swingT = 1;
  }

  /** Spawns a flying arrow. `from` is the mob that shot it (null = player). */
  spawnArrow(origin: THREE.Vector3, dir: THREE.Vector3, speed: number, from: Mob | null, power: number) {
    if (this.arrows.length > 48) return;
    const mesh = new THREE.Mesh(this.arrowGeo, this.arrowMat);
    mesh.position.copy(origin);
    this.scene.add(mesh);
    this.arrows.push({ mesh, pos: origin.clone(), vel: dir.clone().multiplyScalar(speed), life: 0, power, from });
  }

  private updateArrows(dt: number) {
    const keep: ArrowEntity[] = [];
    for (const a of this.arrows) {
      a.life += dt;
      if (a.life > 20) { this.scene.remove(a.mesh); continue; }
      a.vel.y -= 18 * dt;
      const dir = a.vel.clone().normalize();
      let travel = a.vel.length() * dt;
      let spent = false;
      let prev: THREE.Vector3 | null = null;
      while (travel > 0 && !spent) {
        const stepLen = Math.min(0.3, travel);
        travel -= stepLen;
        prev = a.pos.clone();
        a.pos.addScaledVector(dir, stepLen);
        const block = this.world.peekBlock(Math.floor(a.pos.x), Math.floor(a.pos.y), Math.floor(a.pos.z));
        if (block !== B.AIR && RENDER[block] !== 2 && IS_SOLID[block]) { spent = true; break; }
        if (a.from) {
          // hostile arrow vs player – a shield in hand parries it
          const p = this.body.pos;
          if (
            a.pos.x > p.x - 0.45 && a.pos.x < p.x + 0.45 &&
            a.pos.y > p.y - 0.1 && a.pos.y < p.y + this.body.h + 0.1 &&
            a.pos.z > p.z - 0.45 && a.pos.z < p.z + 0.45
          ) {
            if (this.holdingShield()) {
              Sfx.playShield();
              this.wearShield(12);
              this.unlock('guardian');
            } else {
              this.damage(mobDamage(a.power, this.difficulty.damage));
              this.body.vel.x += dir.x * 2.5;
              this.body.vel.z += dir.z * 2.5;
            }
            spent = true;
            break;
          }
        } else {
          // player arrow vs mobs
          for (const m of this.mobs) {
            if (m.dead) continue;
            const mb = m.body;
            const r = mb.w / 2 + 0.12;
            if (
              a.pos.x > mb.pos.x - r && a.pos.x < mb.pos.x + r &&
              a.pos.y > mb.pos.y - 0.1 && a.pos.y < mb.pos.y + mb.h + 0.1 &&
              a.pos.z > mb.pos.z - r && a.pos.z < mb.pos.z + r
            ) {
              if (a.pearl) { spent = true; break; }
              if (m.damage(a.power, a.pos.x - dir.x * 2, a.pos.z - dir.z * 2)) {
                if (m.dead && isHostileMob(m.type)) this.advanceChallenge('challenge_hunter');
                mb.vel.x += dir.x * 4;
                mb.vel.z += dir.z * 4;
                mb.vel.y = Math.max(mb.vel.y, 2.5);
                Sfx.playHurt();
                Sfx.playMob(m.type);
                this.wearTool();
              }
              spent = true;
              break;
            }
          }
        }
      }
      if (spent) {
        this.scene.remove(a.mesh);
        if (a.pearl) this.pearlTeleport(prev ?? a.pos);
        else Sfx.playArrowHit();
        continue;
      }
      a.mesh.position.copy(a.pos);
      if (!a.pearl) a.mesh.lookAt(a.pos.clone().add(a.vel));
      keep.push(a);
    }
    this.arrows = keep;
  }

  tryUse() {
    const t = this.target;
    this.placeCooldown = 0.22;
    const sneaking = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    // Mieszkaniec ma pierwszeństwo – PPM otwiera okno handlu.
    const vt = this.findMobTarget(4.5);
    if (vt.mob && vt.mob.type === 'villager' && !vt.mob.dead) {
      this.openTrade(vt.mob);
      return;
    }
    if (t && !sneaking) {
      if (t.id === B.BELL) { this.ringBell(t.x, t.y, t.z); return; }
      if (isDoor(t.id)) { this.toggleDoor(t.x, t.y, t.z); return; }
      if (isTrap(t.id)) { this.toggleTrap(t.x, t.y, t.z, t.nx, t.nz); return; }
      if (t.id === B.CHEST || t.id === B.LOOT_CHEST) { this.openChest(t.x, t.y, t.z); return; }
      if (t.id === B.CRAFTING) { this.openInventory(true); return; }
      if (t.id === B.FURNACE || t.id === B.FURNACE_ON) { this.openFurnace(t.x, t.y, t.z); return; }
      if (t.id === B.ENCHANT) { this.openEnchant(t.x, t.y, t.z); return; }
      if (t.id === B.BED) { this.trySleep(t.x, t.y, t.z); return; }
      if (t.id === B.LEVER || t.id === B.LEVER_ON) { this.toggleLever(t.x, t.y, t.z); return; }
      if (t.id === B.BUTTON || t.id === B.BUTTON_ON) { this.pressButton(t.x, t.y, t.z); return; }
      if (t.id === B.NOTE_BLOCK) { this.playNoteBlock(t.x, t.y, t.z); return; }
      if (t.id === B.NETHER_PORTAL) { this.enterPortal(); return; }
      // 2.3: kowadło wreszcie działa – naprawa, scalanie i nazwy przedmiotów.
      if (t.id === B.ANVIL) { this.openAnvil(t.x, t.y, t.z); return; }
      // 2.4: statyw alchemiczny – PPM otwiera kocioł, a woda leci do fiolki.
      if (t.id === B.BREWING) { this.openBrewing(t.x, t.y, t.z); return; }
    }
    const s = this.selectedStack();
    if (!s) return;
    // 2.4: fiolka nad wodą staje się fiolką z wodą (źródło wody zostaje).
    if (s.id === I.BOTTLE && t && t.id === B.WATER) {
      s.id = I.WATER_BOTTLE;
      Sfx.playSplash();
      this.message('Napełniono fiolkę wodą.');
      this.updateHand();
      this.emitHud();
      this.swingT = 0;
      return;
    }
    if (t && s.id === I.FLINT_STEEL) {
      if (t.id === B.TNT) {
        this.igniteTNT(t.x, t.y, t.z, 3.2);
        this.unlock('boom');
        this.wearTool();
        this.swingT = 0;
        return;
      }
      if (t.id === B.OBSIDIAN || t.id === B.CRYING_OBSIDIAN) {
        if (tryCreatePortal(this.world, t.x, t.y, t.z)) {
          this.message('Portal do Netheru został aktywowany!');
          Sfx.playPlace('glass');
          this.wearTool();
          this.swingT = 0;
          this.unlock('portal');
          return;
        }
      }
    }
    if (t && t.id === B.CAMPFIRE && this.cookOnCampfire(s)) return;
    // Taming: right-click a wild wolf while holding raw meat.
    if (s.id === I.RAW_PORK || s.id === I.RAW_BEEF || s.id === I.RAW_CHICKEN) {
      const wt = this.findMobTarget(4.5);
      if (wt.mob && wt.mob.type === 'wolf' && !wt.mob.tamed) {
        if (this.mode === 'survival') this.consumeSelected();
        wt.mob.tame();
        Sfx.playEat();
        Sfx.playPop();
        this.message('Wilk przyjął mięso i od tej pory jest posłuszny.');
        this.unlock('wolf');
        this.swingT = 0;
        return;
      }
    }
    if (s.id === I.BOW) {
      // holding RMB keeps drawing; only a fresh press starts a new draw
      if (this.bowDraw < 0) this.bowDraw = 0.0001;
      this.swingT = 0;
      return;
    }
    // 2.3: wędka rzuca lub zwina przynętę, lorneta przybliża (trzymana w PPM).
    if (s.id === I.FISHING_ROD) { this.useRod(); return; }
    if (s.id === I.WORM_BAIT || s.id === I.GLOW_BAIT) { this.attachBait(s.id); return; }
    // 2.3: bez przytrzymania (telefon) lorneta działa jak przełącznik.
    if (s.id === I.SPYGLASS) { this.zooming = this.touchInput ? !this.zooming : true; return; }
    if (s.id === I.BIOME_COMPASS) {
      if (this.isInNether) this.message('Kompas biomów działa tylko w Nadświecie.');
      else this.setUI('biomeCompass');
      return;
    }
    if (s.id === I.ENDER_PEARL) {
      this.throwPearl();
      return;
    }
    if (isFood(s.id)) { this.tryEat(s); return; }
    // 2.4: fiolki pije się dokładnie tak jak jedzenie – PPM w powietrzu.
    if (isPotion(s.id)) { this.drinkPotion(s); return; }
    if (!t) return;
    if (isHoe(s.id) && this.tryTill(t)) return;
    if (this.tryMakePath(t)) return;
    if (s.id === I.SEEDS && this.tryPlant(t, s)) return;
    if (s.id === I.BUCKET || s.id === I.WATER_BUCKET || s.id === I.LAVA_BUCKET) {
      this.tryBucket(t, s);
      return;
    }
    if (isItem(s.id) || !BLOCKS[s.id]) return;
    // 2.3: schody i płyty potrafią zmienić to, co faktycznie zostanie postawione.
    let placeId: number | undefined;
    let px = t.x + t.nx, py = t.y + t.ny, pz = t.z + t.nz;
    if (RENDER[t.id] === 1) { px = t.x; py = t.y; pz = t.z; }
    if (py < 0 || py >= CH) return;
    const cur = this.world.getBlock(px, py, pz);
    if (cur !== B.AIR && RENDER[cur] !== 2 && RENDER[cur] !== 1) return;
    const id = s.id;
    if (IS_SOLID[id]) {
      const b = this.body;
      if (aabbIntersectsBlock(b.pos.x, b.pos.y, b.pos.z, b.w, b.h, px, py, pz)) return;
      for (const m of this.mobs) if (!m.dead && aabbIntersectsBlock(m.body.pos.x, m.body.pos.y, m.body.pos.z, m.body.w, m.body.h, px, py, pz)) return;
    }
    if (id === B.WATER || id === B.LAVA) {
      const below = this.world.getBlock(px, py - 1, pz);
      const around = [this.world.getBlock(px + 1, py, pz), this.world.getBlock(px - 1, py, pz), this.world.getBlock(px, py, pz + 1), this.world.getBlock(px, py, pz - 1)];
      if (!IS_SOLID[below] && !around.some((n) => IS_SOLID[n])) return;
    }
    const below = this.world.getBlock(px, py - 1, pz);
    if (id === B.SAPLING || id === B.BIRCH_SAPLING || id === B.SPRUCE_SAPLING) {
      if (below !== B.GRASS && below !== B.DIRT && below !== B.FARMLAND && below !== B.PODZOL && below !== B.MEADOW_GRASS) return;
    } else if (id === B.CROP0 || id === B.CROP1 || id === B.CROP2 || id === B.CROP3) {
      if (below !== B.FARMLAND) return;
    } else if (id === B.TORCH || id === B.REDSTONE_TORCH) {
      const attached = this.world.getBlock(px - t.nx, py - t.ny, pz - t.nz);
      if (!IS_SOLID[attached] && !IS_SOLID[below]) return;
    } else if (id === B.LEVER || id === B.BUTTON || id === B.REDSTONE_TORCH || id === B.REDSTONE_TORCH_OFF) {
      const attached = this.world.getBlock(px - t.nx, py - t.ny, pz - t.nz);
      if (!IS_SOLID[attached]) { this.message('Dźwignia/przycisk musi być na solidnej ścianie.'); return; }
    } else if (id === B.RAIL || id === B.POWERED_RAIL || id === B.DETECTOR_RAIL) {
      if (!IS_SOLID[below]) { this.message('Tory kładzie się na solidnym podłożu.'); return; }
    } else if (isStairs(id)) {
      // schody stawiane tyłem do gracza
      const dir = this.lookDir();
      const placed = stairsBase(id) + facingFromNormal(-dir.x, -dir.z);
      if (!BLOCKS[placed]) return;
      placeId = placed;
    } else if (isSlab(id)) {
      // płyta górna / dolna, a dwie płyty tego samego typu łączą się w pełny blok
      // (normal z raycastu wskazuje od klikniętego bloku w stronę gracza,
      //  więc ny === -1 oznacza, że uderzono wierzch – stawiamy płytę górną)
      const base = slabBase(id);
      const isTop = t.ny === -1;
      const existing = this.world.getBlock(px, py, pz);
      if (existing === base || existing === base + 1) placeId = slabFullBlock(base);
      else placeId = isTop ? base + 1 : base;
    } else if (isPiston(id)) {
      // piston facing toward player (place facing opposite to look)
      // for simplicity store facing in block id? We use same id but remember direction via placement normal
      // future: directional pistons – for now just place
    } else if (id === B.SUGARCANE) {
      if (below !== B.GRASS && below !== B.DIRT && below !== B.SAND && below !== B.SUGARCANE) {
        this.message('Trzcina rośnie na trawie, ziemi lub piasku.');
        return;
      }
      // only the base of a stack needs water, like in the classic game
      if (below !== B.SUGARCANE && !this.waterNear(px, py, pz)) {
        this.message('Trzcyna chce wody w pobliżu.');
        return;
      }
    } else if (isDoor(id)) {
      if (!this.placeDoor(px, py, pz, t.nx, t.ny, t.nz)) return;
      Sfx.playPlace('wood');
      this.swingT = 0;
      this.consumeSelected();
      this.unlock('home');
      this.advanceChallenge('challenge_builder');
      return;
    } else if (isLadder(id)) {
      if (t.ny !== 0) { this.message('Drabina musi wisieć na ścianie.'); return; }
      const face = facingFromNormal(-t.nx, -t.nz);
      this.world.setBlock(px, py, pz, B.LADDER_N + face);
      Sfx.playPlace('wood');
      this.swingT = 0;
      this.consumeSelected();
      this.advanceChallenge('challenge_builder');
      return;
    } else if (isTrap(id)) {
      if (t.ny === 1) this.world.setBlock(px, py, pz, B.TRAP);
      else if (t.ny === 0) this.world.setBlock(px, py, pz, B.TRAP_N + facingFromNormal(-t.nx, -t.nz));
      else { this.message('Właz kładzie się na podłodze albo na ścianie.'); return; }
      Sfx.playPlace('wood');
      this.swingT = 0;
      this.consumeSelected();
      this.advanceChallenge('challenge_builder');
      return;
    } else if (id === B.CHEST) {
      this.unlock('stash');
    } else if (RENDER[id] === 1) {
      if (below !== B.GRASS && below !== B.DIRT && below !== B.SNOW && below !== B.FARMLAND) return;
    }
    const finalId = placeId ?? id;
    this.world.setBlock(px, py, pz, finalId);
    this.advanceChallenge('challenge_builder');
    this.settle(px, py, pz);
    // redstone update
    this.onBlockChanged(px, py, pz);
    if (finalId === B.SAPLING || finalId === B.BIRCH_SAPLING || finalId === B.SPRUCE_SAPLING || finalId === B.SUGARCANE || (finalId >= B.CROP0 && finalId <= B.CROP2)) this.growables.set(`${px},${py},${pz}`, performance.now());
    if (finalId === B.TORCH || finalId === B.REDSTONE_TORCH) this.unlock('torch');
    if (finalId === B.NETHER_BRICKS || finalId === B.QUARTZ_BLOCK) this.unlock('nether');
    Sfx.playPlace(BLOCKS[finalId].sound);
    this.swingT = 0;
    this.consumeSelected();
  }

  pickBlock() {
    if (!this.target) return;
    const id = this.target.id;
    const hot = this.inventory.slots.findIndex((s, i) => i < 9 && s && s.id === id);
    if (hot >= 0) { this.selected = hot; this.emitHud(); return; }
    // 2.3: ŚPM działa też dla przedmiotu leżącego poza paskiem – przenosimy
    // go w wybrany slot, zamiast cicho nic nie robić.
    const any = this.inventory.slots.findIndex((s) => s && s.id === id);
    if (any >= 0) {
      const held = this.inventory.slots[this.selected];
      this.inventory.slots[this.selected] = this.inventory.slots[any];
      this.inventory.slots[any] = held;
      this.updateHand();
      this.emitHud();
      return;
    }
    if (this.mode === 'creative') {
      this.inventory.slots[this.selected] = { id, count: 64 };
      this.updateHand();
      this.emitHud();
    }
  }

  /** 2.5: `whole` = wyrzuca cały stos (Ctrl+Q), domyślnie jeden przedmiot. */
  dropItem(whole = false) {
    const s = this.selectedStack();
    if (!s) return;
    const e = this.eyePos();
    const d = this.lookDir();
    const dur = s.dur;
    const n = whole ? s.count : 1;
    if (this.mode === 'survival') {
      this.spawnDrop(s.id, n, e.x + d.x * 0.6, e.y + d.y * 0.4, e.z + d.z * 0.6, dur, d.x * 4, 2, d.z * 4, s.ench, s.name);
      s.count -= n;
      if (s.count <= 0) this.inventory.slots[this.selected] = null;
    } else {
      this.spawnDrop(s.id, n, e.x + d.x * 0.6, e.y, e.z + d.z * 0.6, dur, d.x * 4, 2, d.z * 4, s.ench, s.name);
      this.inventory.slots[this.selected] = null;
    }
    this.emitHud();
  }

  // Make sand/gravel fall
  settle(x: number, y: number, z: number) {
    const id = this.world.getBlock(x, y, z);
    if (id !== B.SAND && id !== B.GRAVEL) return;
    let ny = y;
    while (ny > 0) {
      const b = this.world.getBlock(x, ny - 1, z);
      if (b === B.AIR || RENDER[b] === 2 || RENDER[b] === 1) ny--;
      else break;
    }
    if (ny !== y) {
      this.world.setBlock(x, y, z, B.AIR);
      this.world.setBlock(x, ny, z, id);
      this.settle(x, y + 1, z);
    }
  }

  /**
   * Sand and gravel fall. Close to the player they become a visible tumbling
   * block; further away the column is resolved instantly (nobody can see it).
   */
  fallGravity(x: number, y: number, z: number) {
    const id = this.world.getBlock(x, y, z);
    if (id !== B.SAND && id !== B.GRAVEL) return;
    const dx = x + 0.5 - this.body.pos.x, dz = z + 0.5 - this.body.pos.z;
    const near = Math.hypot(dx, dz) < 40 && Math.abs(y - this.body.pos.y) < 22;
    if (!near || this.falling.length >= 24) { this.settle(x, y, z); return; }
    let ny = y;
    while (ny > 0) {
      const b = this.world.getBlock(x, ny - 1, z);
      if (b === B.AIR || RENDER[b] === 2 || RENDER[b] === 1) ny--;
      else break;
    }
    this.world.setBlock(x, y, z, B.AIR);
    let geo = this.dropGeos.get(id);
    if (!geo) { geo = blockGeometry(id); this.dropGeos.set(id, geo); }
    const mesh = new THREE.Mesh(geo, this.dropMat);
    mesh.position.set(x + 0.5, y, z + 0.5);
    this.scene.add(mesh);
    this.falling.push({ mesh, pos: new THREE.Vector3(x + 0.5, y, z + 0.5), vel: 0, id });
    // the column above keeps falling too
    this.fallGravity(x, y + 1, z);
    if (ny !== y) this.settle(x, ny, z);
  }

  private updateFalling(dt: number) {
    if (!this.falling.length) return;
    const keep: FallingBlock[] = [];
    for (const f of this.falling) {
      f.vel = Math.min(26, f.vel + 24 * dt);
      const step = f.vel * dt;
      const ny = f.pos.y - step;
      const bx = Math.floor(f.pos.x), bz = Math.floor(f.pos.z);
      const below = Math.floor(ny - 0.5);
      const hit = below < 0 || IS_SOLID[this.world.peekBlock(bx, below, bz)];
      // a falling block hurts when it lands on the player's head
      if (hit && this.ui !== 'dead' && this.mode === 'survival') {
        const p = this.body.pos;
        if (Math.abs(f.pos.x - (p.x + 0.5)) < 0.8 && Math.abs(f.pos.z - (p.z + 0.5)) < 0.8 && p.y < f.pos.y && p.y + this.body.h > f.pos.y - 0.5) {
          this.damage(2);
        }
      }
      if (hit) {
        this.scene.remove(f.mesh);
        this.world.setBlock(bx, below + 1, bz, f.id);
        Sfx.playPlace(BLOCKS[f.id].sound);
        continue;
      }
      f.pos.y = ny;
      f.mesh.position.copy(f.pos);
      keep.push(f);
    }
    this.falling = keep;
  }

  /**
   * Minecraft-style leaf decay: after a log is gone, every leaf farther than
   * four blocks from the nearest remaining log falls apart.
   */
  private decayLeaves(x: number, y: number, z: number) {
    const seen = new Set<string>([`${x},${y},${z}`]);
    let frontier: [number, number, number][] = [[x, y, z]];
    for (let dist = 0; dist < 4 && frontier.length; dist++) {
      const next: [number, number, number][] = [];
      for (const [cx, cy, cz] of frontier) {
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
          if (dx === 0 && dy === 0 && dz === 0) continue;
          const nx = cx + dx, ny = cy + dy, nz = cz + dz;
          const k = `${nx},${ny},${nz}`;
          if (seen.has(k)) continue;
          seen.add(k);
          const id = this.world.peekBlock(nx, ny, nz);
          if (id === B.LOG || id === B.BIRCH_LOG || id === B.ACACIA_LOG || id === B.SPRUCE_LOG) next.push([nx, ny, nz]);
          else if (id === B.LEAVES || id === B.BIRCH_LEAVES || id === B.ACACIA_LEAVES || id === B.JUNGLE_LEAVES || id === B.SPRUCE_LEAVES) {
            next.push([nx, ny, nz]);
            this.leafDecay.push({ x: nx, y: ny, z: nz, t: 0.25 + Math.random() * 0.9 });
          }
        }
      }
      frontier = next;
    }
  }

  private updateLeafDecay(dt: number) {
    if (!this.leafDecay.length) return;
    const keep: typeof this.leafDecay = [];
    for (const l of this.leafDecay) {
      l.t -= dt;
      if (l.t > 0) { keep.push(l); continue; }
      const id = this.world.peekBlock(l.x, l.y, l.z);
      if (id !== B.LEAVES && id !== B.BIRCH_LEAVES && id !== B.ACACIA_LEAVES && id !== B.JUNGLE_LEAVES && id !== B.SPRUCE_LEAVES) continue;
      this.world.setBlock(l.x, l.y, l.z, B.AIR);
      this.spawnParticles(l.x + 0.5, l.y + 0.5, l.z + 0.5, id, 6, 0.2);
      if (this.mode === 'survival') {
        for (const drop of blockDrops(id, 0)) this.spawnDrop(drop.id, drop.count, l.x + 0.5, l.y + 0.4, l.z + 0.5);
      }
    }
    this.leafDecay = keep;
  }

  breakBlock(x: number, y: number, z: number, silent = false) {
    const id = this.world.getBlock(x, y, z);
    if (id === B.AIR || BLOCKS[id].hardness < 0) return;
    const def = BLOCKS[id];
    // water fills in
    let fill: number = B.AIR;
    const nbs = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]];
    for (const [dx, dy, dz] of nbs) {
      const n = this.world.getBlock(x + dx, y + dy, z + dz);
      if (n === B.WATER) { fill = B.WATER; break; }
      if (n === B.LAVA) fill = B.LAVA;
    }
    if (id === B.FURNACE || id === B.FURNACE_ON) this.spillFurnace(x, y, z);
    if (id === B.CHEST || id === B.LOOT_CHEST) this.spillChest(x, y, z);
    if (id === B.ANVIL) this.spillAnvil(x, y, z);
    if (id === B.BREWING) this.spillBrewing(x, y, z);
    this.world.setBlock(x, y, z, fill);
    if (isDoor(id)) {
      const face = doorFacing(id);
      const oy = isDoorTop(id) ? y - 1 : y + 1;
      const other = this.world.getBlock(x, oy, z);
      if (isDoor(other) && doorFacing(other) === face) this.world.setBlock(x, oy, z, B.AIR);
    }
    const attach: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    for (let f = 0; f < 4; f++) {
      const lx = x - attach[f][0], lz = z - attach[f][1];
      const nid = this.world.getBlock(lx, y, lz);
      if (ladderFacing(nid) === f || (isTrapOpen(nid) && nid - B.TRAP_N === f)) this.breakBlock(lx, y, lz, silent);
    }
    this.growables.delete(`${x},${y},${z}`);
    if (id === B.LOG || id === B.BIRCH_LOG || id === B.ACACIA_LOG || id === B.SPRUCE_LOG) this.decayLeaves(x, y, z);
    if (!silent) {
      this.spawnParticles(x + 0.5, y + 0.5, z + 0.5, id, 14, 0.35);
      Sfx.playBreak(def.sound);
    }
    if (this.mode === 'survival' && !silent) {
      const toolId = this.selectedStack()?.id ?? 0;
      if (isOre(id) && ITEMS[toolId]?.tool !== 'pick' && !this.toldPick) {
        this.toldPick = true;
        this.message('Ruda wymaga kilofa – inaczej nic nie wypadnie.');
      }
      const drops = blockDrops(id, toolId, {
        fortune: enchLevel(this.selectedStack(), 'fortune'),
        silk: enchLevel(this.selectedStack(), 'silktouch') > 0,
      });
      let yielded = false;
      for (const drop of drops) {
        const count = resourceDropCount(id, drop.id, drop.count, this.difficulty.resources, enchLevel(this.selectedStack(), 'silktouch') > 0);
        if (count > 0) {
          yielded = true;
          this.spawnDrop(drop.id, count, x + 0.5, y + 0.45, z + 0.5);
        }
      }
      if (isDoorTop(id)) this.spawnDrop(B.DOOR_N, 1, x + 0.5, y + 0.2, z + 0.5);
      // ores that actually yielded something also drop XP
      const xp = oreXp(id);
      if (yielded && xp > 0) this.spawnOrb(x + 0.5, y + 0.4, z + 0.5, xp);
    }
    // things above that need support
    const above = this.world.getBlock(x, y + 1, z);
    if (RENDER[above] === 1 || above === B.CACTUS || above === B.TRAP || (isDoor(above) && !isDoorTop(above))) this.breakBlock(x, y + 1, z, silent);
    this.fallGravity(x, y + 1, z);
  }

  igniteTNT(x: number, y: number, z: number, fuse: number) {
    this.world.setBlock(x, y, z, B.AIR);
    const mesh = new THREE.Mesh(this.tntGeo, new THREE.MeshBasicMaterial({ map: this.atlasTex, vertexColors: true }));
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.scene.add(mesh);
    this.tnts.push({
      mesh,
      body: { pos: new THREE.Vector3(x + 0.5, y, z + 0.5), vel: new THREE.Vector3((Math.random() - 0.5) * 1, 3, (Math.random() - 0.5) * 1), w: 0.98, h: 0.98, onGround: false, hitWall: false },
      fuse,
    });
    Sfx.playFuse();
  }

  explode(cx: number, cy: number, cz: number, power: number, fromMob = false) {
    Sfx.playExplosion();
    this.shake = 0.6;
    const r = Math.ceil(power);
    for (let dx = -r; dx <= r; dx++)
      for (let dy = -r; dy <= r; dy++)
        for (let dz = -r; dz <= r; dz++) {
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d > power * (0.7 + Math.random() * 0.35)) continue;
          const x = Math.floor(cx + dx), y = Math.floor(cy + dy), z = Math.floor(cz + dz);
          const id = this.world.getBlock(x, y, z);
          if (id === B.AIR || id === B.BEDROCK || id === B.OBSIDIAN || id === B.WATER || id === B.LAVA) continue;
          if (id === B.TNT) { this.igniteTNT(x, y, z, 0.3 + Math.random() * 0.6); continue; }
          if (id === B.FURNACE || id === B.FURNACE_ON) this.spillFurnace(x, y, z);
          if (id === B.CHEST || id === B.LOOT_CHEST) this.spillChest(x, y, z);
          if (id === B.ANVIL) this.spillAnvil(x, y, z);
          if (id === B.BREWING) this.spillBrewing(x, y, z);
          this.world.setBlock(x, y, z, B.AIR);
          if (Math.random() < 0.05) this.spawnParticles(x + 0.5, y + 0.5, z + 0.5, id, 3, 0.4);
        }
    this.spawnSmoke(cx, cy, cz, 40, power * 1.5);
    const affect = (pos: THREE.Vector3, h: number, hit: (dmg: number, kb: THREE.Vector3) => void) => {
      const dx = pos.x - cx, dy = pos.y + h / 2 - cy, dz = pos.z - cz;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < power * 2) {
        const f = 1 - d / (power * 2);
        const kb = new THREE.Vector3(dx, dy + 0.5, dz).normalize().multiplyScalar(f * 18);
        hit(Math.floor(f * 22), kb);
      }
    };
    affect(this.body.pos, this.body.h, (dmg, kb) => {
      this.body.vel.add(kb);
      this.fallStart = this.body.pos.y;
      this.damage(fromMob ? mobDamage(dmg, this.difficulty.damage) : dmg);
    });
    for (const m of this.mobs) affect(m.body.pos, m.body.h, (dmg, kb) => {
      m.hurtTime = 0;
      m.damage(dmg, cx, cz);
      m.body.vel.add(kb);
    });
  }

  damage(amount: number, force = false) {
    if (amount <= 0) return;
    if (this.mode === 'creative' && !force) return;
    if (this.ui === 'dead') return;
    // Armor soaks damage; force kills (void, /kill) ignore it and don't break the gear.
    // Zaklęcie Ochrona dodaje 3% redukcji za każdy poziom (do 90% łącznie).
    const reduction = Math.min(0.9, damageReduction(armorPoints(this.armor)) + totalProtection(this.armor) * 0.03);
    const dealt = force ? amount : Math.max(0, Math.round(amount * (1 - reduction)));
    if (dealt > 0) {
      if (!force) this.wearArmor(dealt);
      this.health -= dealt;
      this.hurtCount++;
      this.lastHurt = performance.now();
      this.shake = Math.max(this.shake, 0.25);
      Sfx.playHurt();
      this.buzz(35);
    }
    // 2.3: Totem Ratowania kupuje drugie życie – raz na 5 sekund.
    if (this.health <= 0 && !force && this.tryTotem()) {
      this.emitHud();
      return;
    }
    if (this.health <= 0) {
      this.health = 0;
      const voidDeath = this.body.pos.y < 1;
      const deathPos = voidDeath ? this.spawnPoint : this.body.pos;
      this.addWaypoint('Ostatnia śmierć', 'death', deathPos);
      this.message('Gracz zginął. Punkt ostatniej śmierci zaznaczono na mapie.');
      if (this.mode === 'survival') {
        const y = deathPos.y + 0.4;
        const x = deathPos.x;
        const z = deathPos.z;
        for (const s of this.inventory.slots) {
          if (s) this.spawnDrop(s.id, s.count, x + (Math.random() - 0.5), y, z + (Math.random() - 0.5), s.dur, (Math.random() - 0.5) * 3, 3, (Math.random() - 0.5) * 3, s.ench, s.name);
        }
        for (const s of this.armor) {
          if (s) this.spawnDrop(s.id, 1, x + (Math.random() - 0.5), y, z + (Math.random() - 0.5), s.dur, (Math.random() - 0.5) * 3, 3, (Math.random() - 0.5) * 3, s.ench);
        }
        this.armor.fill(null);
      }
      this.effects.clear();
      this.inventory.slots.fill(null);
      this.inventory.cursor = null;
      this.fishingBait = null;
      this.setUI('dead');
    }
    this.emitHud();
  }

  /**
   * 2.3: jeśli gracz ma totem ratowania, zużywa go zamiast umrzeć.
   * Zwraca true, gdy śmierć została odwołana.
   */
  private tryTotem(): boolean {
    if (this.mode !== 'survival' || this.totemHeal > 0) return false;
    if (this.inventory.countOf(I.TOTEM) <= 0) return false;
    this.inventory.remove(I.TOTEM, 1);
    this.health = 6;
    this.hunger = Math.min(20, this.hunger + 4);
    this.totemHeal = 6;
    this.lastHurt = performance.now() - 4000;
    Sfx.playEnchant();
    Sfx.playLevelUp();
    this.spawnParticles(this.body.pos.x, this.body.pos.y + 1.2, this.body.pos.z, B.GLOWSTONE, 26, 0.9);
    this.message('Totem Ratowania rozpadł się i ocalił cię!');
    this.unlock('undying');
    return true;
  }

  /** Regeneracja po uratowaniu przez totem. */
  private updateTotem(dt: number) {
    if (this.totemHeal <= 0) return;
    this.totemHeal = Math.max(0, this.totemHeal - dt);
    if (this.health >= 20) return;
    this.regenAcc += dt;
    if (this.regenAcc >= 0.4) {
      this.regenAcc = 0;
      this.health = Math.min(20, this.health + 1);
    }
  }

  respawn() {
    // Śmierć w Netherze odsyła do nadświatu (punkt odrodzenia jest zawsze tam).
    if (this.isInNether) this.switchDimension(this.homeWorld);
    this.health = 20;
    this.hunger = 20;
    this.air = this.maxAir;
    this.body.pos.copy(this.spawnPoint);
    this.body.vel.set(0, 0, 0);
    this.fallStart = this.body.pos.y;
    if (this.mode === 'creative') this.giveStarterItems();
    this.setUI('playing');
    this.emitHud();
  }

  spawnMob(type: MobType, x: number, y: number, z: number, profession = 0) {
    const m = new Mob(type, x, y, z, profession);
    this.mobs.push(m);
    this.scene.add(m.group);
    return m;
  }

  /** Czy prostokąt r×r wokół punktu i `hgt` bloków w górę to samo powietrze? */
  private openAir(x: number, y: number, z: number, r: number, hgt: number): boolean {
    const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dy = 0; dy < hgt; dy++) {
          if (this.world.peekBlock(bx + dx, by + dy, bz + dz) !== B.AIR) return false;
        }
      }
    }
    return true;
  }

  // ---------- Update ----------
  private loop(now: number) {
    this.raf = requestAnimationFrame(this.loop);
    // 2.0: limit klatek – klatka jest po prostu pomijana, liczniki czasu
    // ruszają dopiero przy realnym renderze (ruch zostaje prawidłowy).
    if (this.fpsCap > 0 && now - this.lastTime < 1000 / this.fpsCap - 0.6) return;
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > 0.1) dt = 0.1;
    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsTime);
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }

    // 2.0: dynamiczna rozdzielczość – trzyma płynność na słabszych GPU.
    if (this.drEnabled && this.ui === 'playing') {
      this.drCooldown -= dt;
      if (this.drCooldown <= 0 && this.fps > 0) {
        if (this.fps < 26 && this.resScale > 0.55) {
          this.resScale = Math.max(0.55, this.resScale - 0.15);
          this.applyResScale();
          this.drCooldown = 1.4;
        } else if (this.fps > 56 && this.resScale < 1) {
          this.resScale = Math.min(1, this.resScale + 0.1);
          this.applyResScale();
          this.drCooldown = 2.4;
        } else {
          this.drCooldown = 0.4;
        }
      }
    }

    const active = this.ui === 'playing' || this.ui === 'inventory' || this.ui === 'furnace' || this.ui === 'chest' || this.ui === 'enchant' || this.ui === 'trade' || this.ui === 'chat' || this.ui === 'dead';
    if (active) {
      const sub = dt > 0.05 ? 2 : 1;
      for (let i = 0; i < sub; i++) this.updatePlayer(dt / sub);
      this.updateInteraction(dt);
      this.updateMobs(dt);
      this.updateEntities(dt);
      this.updateFalling(dt);
      this.updateLeafDecay(dt);
      this.updateArrows(dt);
      this.updateDrops(dt);
      this.updateOrbs(dt);
      this.updateGrowth(dt);
      this.updateFurnaces(dt);
      this.updateAnvils(dt);
      this.updateBrewings(dt);
      this.updateEffects(dt);
      this.updateFishing(dt);
      this.updateRedstone(dt);
      this.updateTotem(dt);
      this.updateWeather(dt);
      this.checkUnderground();
      this.villageCheck -= dt;
      if (this.villageCheck <= 0) {
        this.villageCheck = 1.5;
        this.checkVillage();
      }
      this.time = (this.time + dt / 600) % 1;
      if (this.time < dt / 600) {
        this.day++;
        if (this.day >= 2) this.unlock('night');
      }
      this.saveTimer += dt;
      if (this.saveTimer > 30) { this.saveTimer = 0; this.save(); }
    }
    this.updateChunks();
    this.updateCamera(dt);
    this.updateSky();

    this.hudTimer += dt;
    if (this.hudTimer > 0.1) { this.hudTimer = 0; this.emitHud(); }

    this.renderer.render(this.scene, this.camera);
  }

  private blockAt(p: THREE.Vector3, yoff: number) {
    return this.world.peekBlock(Math.floor(p.x), Math.floor(p.y + yoff), Math.floor(p.z));
  }

  /** 2.0: czy przed graczem stoi dokładnie 1 blok, na który można wejść? */
  private canAutoStep(p: THREE.Vector3, dx: number, dz: number): boolean {
    const x = Math.floor(p.x + dx * 0.7);
    const z = Math.floor(p.z + dz * 0.7);
    const y = Math.floor(p.y + 0.05);
    const step = this.world.peekBlock(x, y, z);
    const above = this.world.peekBlock(x, y + 1, z);
    const head = this.world.peekBlock(x, y + 2, z);
    return IS_SOLID[step] !== 0 && !IS_SOLID[above] && !IS_SOLID[head] && RENDER[above] !== 1;
  }

  private updatePlayer(dt: number) {
    const b = this.body;
    const k = this.keys;
    const playing = this.ui === 'playing';
    const feet = this.blockAt(b.pos, 0.1);
    const mid = this.blockAt(b.pos, 0.8);
    const inWater = feet === B.WATER || mid === B.WATER;
    const inLava = feet === B.LAVA || mid === B.LAVA;
    const onLadder = isLadder(feet) || isLadder(mid) || isLadder(this.blockAt(b.pos, 1.4));
    const eyeBlock = this.blockAt(b.pos, this.eyeHeight);
    const eyeInWater = eyeBlock === B.WATER;

    let fx = 0, fz = 0;
    if (playing) {
      if (k.has('KeyW')) fz -= 1;
      if (k.has('KeyS')) fz += 1;
      if (k.has('KeyA')) fx -= 1;
      if (k.has('KeyD')) fx += 1;
    }
    const forward = fz < 0;
    // 2.5: sprint działa też na prawym Ctrl, skradanie na prawym Shifcie
    // (wcześniej tylko lewe modyfikatory – niewygodne na niektórych klawiaturach).
    if (playing && (k.has('ControlLeft') || k.has('ControlRight')) && forward) this.sprinting = true;
    if (!forward || (b.hitWall && !this.flying)) this.sprinting = false;
    const sneakHeld = k.has('ShiftLeft') || k.has('ShiftRight');
    const sneaking = playing && sneakHeld && !this.flying;
    if (sneaking) this.sprinting = false;

    if (this.mode === 'survival' && this.hunger <= 6) this.sprinting = false;
    let speed = this.flying ? (this.sprinting ? 22 : 11) : sneaking ? 1.3 : this.sprinting ? 5.6 : 4.3;
    if (inWater && !this.flying) speed *= 0.55;
    if (inLava && !this.flying) speed *= 0.35;
    // 2.4: napój szybkości przyspiesza bieg (nie wpływa na latanie w trybie kreatywnym)
    if (!this.flying && this.hasEffect('speed')) speed *= SPEED_FACTOR;
    if (!this.flying) speed *= sprintFactor(this.hasEffect('sprint'), this.sprinting);

    const len = Math.hypot(fx, fz) || 1;
    fx /= len; fz /= len;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wx = fx * cos + fz * sin;
    const wz = -fx * sin + fz * cos;
    const tx = wx * speed, tz = wz * speed;
    const hasInput = fx !== 0 || fz !== 0;
    const feetBelow = this.world.peekBlock(Math.floor(b.pos.x), Math.floor(b.pos.y - 0.1), Math.floor(b.pos.z));
    const onIce = feetBelow === B.ICE;
    let accel = this.flying ? 8 : b.onGround ? 14 : inWater ? 6 : 2.5;
    if (onIce && !this.flying) accel = hasInput ? 1.4 : 0.45;
    const a = Math.min(1, accel * dt * (hasInput || b.onGround || this.flying ? 1 : 0.3));
    b.vel.x += (tx - b.vel.x) * a;
    b.vel.z += (tz - b.vel.z) * a;

    const jump = playing && k.has('Space');
    if (this.flying) {
      const ty = jump ? 9 : playing && sneakHeld ? -9 : 0;
      b.vel.y += (ty - b.vel.y) * Math.min(1, dt * 10);
    } else if (onLadder && !this.flying) {
      const climb = jump || (playing && k.has('KeyW'));
      const descend = sneaking || (playing && k.has('KeyS'));
      b.vel.y = climb ? 3.4 : descend ? -3.2 : 0;
      this.fallStart = b.pos.y;
      if (climb) this.unlock('climb');
    } else if (inWater || inLava) {
      b.vel.y -= 12 * dt;
      if (b.vel.y < -3.5) b.vel.y = -3.5;
      if (jump) b.vel.y = Math.min(b.vel.y + 40 * dt, 3.8);
      // jump out of water at edges
      if (jump && b.hitWall) b.vel.y = 6;
    } else {
      b.vel.y -= 32 * dt;
      if (b.vel.y < -78) b.vel.y = -78;
      if (jump && b.onGround) {
        b.vel.y = 9.1;
        if (this.sprinting) { b.vel.x += -sin * 2; b.vel.z += -cos * 2; }
      }
    }

    const wasGround = b.onGround;
    stepBody(this.world, b, dt, sneaking);
    if (this.flying && b.onGround && this.mode === 'creative' && b.vel.y <= 0 && !jump) {
      this.flying = false;
    }

    // 2.0: automatyczne wskakiwanie na 1-blokowe schodki – obowiązkowe na dotyku.
    if (this.autoJump && playing && b.onGround && b.hitWall && !this.flying && !inWater && !inLava && !onLadder && !sneaking) {
      this.autoJumpCd -= dt;
      const mvx = Math.sign(b.vel.x), mvz = Math.sign(b.vel.z);
      if ((mvx !== 0 || mvz !== 0) && this.autoJumpCd <= 0 && this.canAutoStep(b.pos, mvx, mvz)) {
        b.vel.y = 8.6;
        this.autoJumpCd = 0.35;
      }
    }

    // fall damage
    if (this.flying || inWater || b.vel.y > 0) this.fallStart = b.pos.y;
    else if (!b.onGround) this.fallStart = Math.max(this.fallStart, b.pos.y);
    if (b.onGround && !wasGround) {
      const fall = this.fallStart - b.pos.y;
      if (fall > 3.4 && this.mode === 'survival' && !inWater) {
        // Lekki krok na butach tłumi upadek
        const raw = Math.floor(fall - 3);
        this.damage(fallDamageAfterPotion(Math.max(raw > 0 ? 1 : 0, Math.round(raw * fallDamageFactor(this.armor[3]))), this.hasEffect('fall')));
      }
      if (fall > 1) {
        const below = this.world.peekBlock(Math.floor(b.pos.x), Math.floor(b.pos.y - 0.1), Math.floor(b.pos.z));
        if (below) Sfx.playStep(BLOCKS[below].sound);
      }
      this.fallStart = b.pos.y;
    }
    if (b.onGround) this.fallStart = b.pos.y;

    // void
    if (b.pos.y < -30) {
      if (this.mode === 'creative') { b.pos.y = CH; b.vel.y = 0; this.fallStart = b.pos.y; }
      else this.damage(1000, true);
    }

    // drowning
    if (eyeInWater && this.mode === 'survival') {
      this.air -= dt;
      if (this.air <= 0) {
        this.air = 0;
        this.drownAcc += dt;
        if (this.drownAcc > 1) { this.drownAcc = 0; this.damage(2); }
      }
    } else {
      this.air = Math.min(this.maxAir, this.air + dt * 4);
    }
    const under = this.world.peekBlock(Math.floor(b.pos.x), Math.floor(b.pos.y - 0.05), Math.floor(b.pos.z));
    // 1.7 special blocks effects
    // 2.3: 2.0 pisało `wasGround === false`, co nigdy nie zachodzi – blok szlamu
    // nie odbijał przy lądowaniu. Reguła żyje teraz w physics.slimeBounce().
    const bounce = slimeBounce(wasGround, b.onGround, b.vel.y);
    if (under === B.SLIME_BLOCK && bounce !== null && this.mode !== 'creative') {
      b.vel.y = bounce;
      this.fallStart = b.pos.y + bounce;
      Sfx.playSlime();
    }
    if (under === B.HONEY_BLOCK) {
      b.vel.x *= 0.4;
      b.vel.z *= 0.4;
      if (b.vel.y < 0) b.vel.y *= 0.4;
    }
    if (under === B.SOUL_SAND || under === B.SOUL_SOIL) {
      b.vel.x *= 0.6;
      b.vel.z *= 0.6;
    }
    // 2.4: ognioodporność – żar, lawa i ogniska nie ruszają odpornego gracza
    const fireImmune = this.hasEffect('fire');
    if (!fireImmune && under === B.MAGMA && b.onGround && this.mode === 'survival' && !this.flying) {
      this.campfireHurt += dt;
      if (this.campfireHurt > 0.6) { this.campfireHurt = 0; this.damage(1); this.message('Blok magmy parzy!'); }
    }
    if (!fireImmune && under === B.CAMPFIRE && b.onGround && this.mode === 'survival' && !this.flying) {
      this.campfireHurt += dt;
      if (this.campfireHurt > 0.45) { this.campfireHurt = 0; this.damage(1); }
    }
    // lava
    if (fireImmune && inLava && this.mode === 'survival') {
      // 2.4: osiągnięcie wymaga wejścia do lawy PODCZAS ognioodporności
      this.unlock('fireproof');
    } else if (inLava && this.mode === 'survival') {
      this.lavaAcc += dt;
      if (this.lavaAcc > 0.5) { this.lavaAcc = 0; this.damage(4); }
    }
    // cactus
    if (this.mode === 'survival') {
      const nearCactus = [[0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]].some(([ox, oz]) =>
        this.world.peekBlock(Math.floor(b.pos.x + ox), Math.floor(b.pos.y + 0.5), Math.floor(b.pos.z + oz)) === B.CACTUS);
      if (nearCactus) {
        this.lavaAcc += dt;
        if (this.lavaAcc > 0.5) { this.lavaAcc = 0; this.damage(1); }
      }
    }
    if (inWater && !this.wasInWater) Sfx.playSplash();
    this.wasInWater = inWater;

    // hunger – only survival, and only while actually doing something
    if (this.mode === 'survival' && this.health > 0 && playing) {
      let drain = 0;
      if (hasInput && (b.onGround || inWater)) drain += this.sprinting ? 0.085 : 0.028;
      if (jump && b.onGround) drain += 0.04;
      this.hunger = Math.max(0, this.hunger - drain * dt);
      if (this.hunger <= 0) {
        this.starveAcc += dt;
        if (this.starveAcc > 4 && this.health > 1) { this.starveAcc = 0; this.damage(1); this.message('Umierasz z głodu!'); }
      } else this.starveAcc = 0;
    }
    if (b.pos.y < 36) this.unlock('cave');

    // regen only when well fed
    if (this.mode === 'survival' && this.health < 20 && this.health > 0 && this.hunger >= 17 && performance.now() - this.lastHurt > 4000) {
      this.regenAcc += dt;
      if (this.regenAcc > 3.2) {
        this.regenAcc = 0;
        this.health = Math.min(20, this.health + 1);
        this.hunger = Math.max(0, this.hunger - 0.4);
      }
    } else if (this.mode === 'creative' && this.health < 20 && this.health > 0 && performance.now() - this.lastHurt > 4000) {
      this.regenAcc += dt;
      if (this.regenAcc > 2.5) { this.regenAcc = 0; this.health = Math.min(20, this.health + 1); }
    }

    // steps
    const hs = Math.hypot(b.vel.x, b.vel.z);
    if (b.onGround && hs > 0.5) {
      this.stepDist += hs * dt;
      this.bobPhase += hs * dt * 1.9;
      if (this.stepDist > (this.sprinting ? 2.4 : 1.9)) {
        this.stepDist = 0;
        const below = this.world.peekBlock(Math.floor(b.pos.x), Math.floor(b.pos.y - 0.1), Math.floor(b.pos.z));
        if (below && !sneaking) Sfx.playStep(BLOCKS[below].sound);
      }
    } else {
      this.bobPhase *= 0.9;
    }
    const targetEye = sneaking ? 1.42 : 1.62;
    this.eyeHeight += (targetEye - this.eyeHeight) * Math.min(1, dt * 15);
  }

  private updateInteraction(dt: number) {
    this.breakCooldown -= dt;
    this.placeCooldown -= dt;
    this.attackCooldown -= dt;
    this.pearlCd = Math.max(0, this.pearlCd - dt);
    this.eatCooldown = Math.max(0, this.eatCooldown - dt);
    if (this.swingT < 1) this.swingT = Math.min(1, this.swingT + dt * 4);

    const e = this.eyePos();
    // 2.0: na dotyku celownik podąża za palcem (touchAim w NDC).
    if (this.touchAim && this.ui === 'playing') {
      const v = new THREE.Vector3(this.touchAim.x, this.touchAim.y, 0.5).unproject(this.camera);
      const dir = v.sub(e).normalize();
      this.aimDir = dir;
    } else {
      this.aimDir = null;
    }
    const d = this.aimDir ?? this.lookDir();
    const reach = this.mode === 'creative' ? 7 : 5;
    this.target = this.ui === 'playing' || this.ui === 'dead' ? this.world.raycast(e.x, e.y, e.z, d.x, d.y, d.z, reach) : null;
    const t = this.target;
    if (t) {
      this.selection.visible = true;
      const id = t.id;
      if (RENDER[id] === 1) {
        this.selection.scale.set(0.7, 0.95, 0.7);
        this.selection.position.set(t.x + 0.5, t.y + 0.475, t.z + 0.5);
      } else {
        this.selection.scale.set(1, 1, 1);
        this.selection.position.set(t.x + 0.5, t.y + 0.5, t.z + 0.5);
      }
    } else this.selection.visible = false;

    if (this.ui !== 'playing') { this.crackMesh.visible = false; return; }

    if (this.mouseLeft) {
      // 2.5: trzymany LPM (albo palec w trybie kopania) najpierw sprawdza moba
      // na celowniku i bije go z cooldownem. Wcześniej tryAttack zerował
      // mouseLeft po każdym trafieniu, więc walka wymagała furkoczącego
      // klikania, a mob wchodzący w celownik przerywał kopanie bloku.
      const { mob, dist } = this.findMobTarget(3.5);
      const blockDist = t ? t.dist : Infinity;
      if (mob && dist < blockDist) {
        this.breakProgress = 0;
        this.breakKey = '';
        if (this.attackCooldown <= 0) this.tryAttack();
      } else if (t) {
        const key = `${t.x},${t.y},${t.z}`;
        if (this.mode === 'creative') {
          if (this.breakCooldown <= 0) { this.breakBlock(t.x, t.y, t.z); this.breakCooldown = 0.25; this.swingT = 0; }
        } else {
          if (key !== this.breakKey) {
            this.breakKey = key;
            this.breakProgress = 0;
            const hint = pickHint(t.id, this.selectedStack()?.id ?? 0);
            if (hint && !Number.isFinite(mineSeconds(t.id, this.selectedStack()?.id ?? 0))) this.message(hint);
          }
          const def = BLOCKS[t.id];
          const held = this.selectedStack();
          const time = mineSeconds(t.id, held?.id ?? 0, enchLevel(held, 'efficiency'));
          if (def.hardness >= 0 && Number.isFinite(time)) {
            let mult = 1;
            if (this.blockAt(this.body.pos, this.eyeHeight) === B.WATER) mult *= 0.25;
            if (!this.body.onGround && !this.flying) mult *= 0.4;
            this.breakProgress += (dt / time) * mult;
            this.digSoundTimer -= dt;
            if (this.swingT >= 1) this.swingT = 0;
            if (this.digSoundTimer <= 0) {
              this.digSoundTimer = 0.22;
              Sfx.playDig(def.sound);
              this.spawnParticles(t.x + 0.5 + t.nx * 0.52, t.y + 0.5 + t.ny * 0.52, t.z + 0.5 + t.nz * 0.52, t.id, 2, 0.3);
            }
            if (this.breakProgress >= 1) {
              const broken = t.id;
              this.breakBlock(t.x, t.y, t.z);
              if (BLOCKS[broken] && BLOCKS[broken].hardness > 0 && toolHelps(broken, this.selectedStack()?.id ?? 0)) this.wearTool();
              else if (BLOCKS[broken] && BLOCKS[broken].hardness > 0 && ITEMS[this.selectedStack()?.id ?? 0]?.tool) this.wearTool();
              if (this.mode === 'survival') this.hunger = Math.max(0, this.hunger - 0.015);
              this.breakProgress = 0;
              this.breakKey = '';
            }
          }
        }
      }
    } else {
      this.breakProgress = 0;
    }
    if (this.breakProgress > 0 && t) {
      this.crackMesh.visible = true;
      this.crackMesh.position.set(t.x + 0.5, t.y + 0.5, t.z + 0.5);
      const stage = Math.min(9, Math.floor(this.breakProgress * 10));
      const mat = this.crackMesh.material as THREE.MeshBasicMaterial;
      if (mat.map !== this.crackTex[stage]) { mat.map = this.crackTex[stage]; mat.needsUpdate = true; }
    } else this.crackMesh.visible = false;

    if (this.mouseRight && this.placeCooldown <= 0) {
      // 2.3: wędka i lorneta reagują wyłącznie na naciśnięcie (mousedown sam
      // woła tryUse). Bez tego przytrzymane PPM wciągało świeżo zarzuconą
      // przynętę, a lorneta stale restartowała przybliżenie.
      const held = this.selectedStack();
      if (!held || (held.id !== I.FISHING_ROD && held.id !== I.SPYGLASS)) this.tryUse();
    }
    // 2.3: lorneta działa, dopóki prawy przycisk jest wciśnięty.
    if (!this.mouseRight && !this.touchInput) this.zooming = false;
    if (this.bowDraw >= 0) {
      if (this.selectedStack()?.id === I.BOW && this.ui === 'playing') {
        if (this.mouseRight) {
          this.bowDraw = Math.min(1, this.bowDraw + dt);
          if (this.swingT >= 1) this.swingT = 0.55;
        } else {
          this.releaseBow();
          // 2.5: cel dotyku czyścimy PO wystrzale – strzała leci pod palcem,
          // a nie w środek ekranu.
          this.touchAim = null;
        }
      } else {
        this.bowDraw = -1;
        this.touchAim = null;
      }
    }
    this.updateHand();
  }

  private updateMobs(dt: number) {
    const p = this.body.pos;
    const dl = this.daylight();
    const peaceful = this.mode === 'creative';
    for (const m of this.mobs) {
      m.update(dt, this.world, p, (dmg, mob) => {
        if (this.ui === 'dead') return;
        // A raised shield halves the hit and absorbs most of the knockback.
        const shielded = this.holdingShield();
        if (shielded) {
          Sfx.playShield();
          this.wearShield(8);
          this.unlock('guardian');
        }
        this.damage(shielded ? Math.ceil(mobDamage(dmg, this.difficulty.damage) / 2) : mobDamage(dmg, this.difficulty.damage));
        if (this.mode === 'survival') {
          const dx = p.x - mob.body.pos.x, dz = p.z - mob.body.pos.z;
          const l = Math.hypot(dx, dz) || 1;
          this.body.vel.x += (dx / l) * (shielded ? 4 : 8);
          this.body.vel.z += (dz / l) * (shielded ? 4 : 8);
          this.body.vel.y = shielded ? 2 : 5;
        }
      }, (mob) => {
        // skeleton shot: aim slightly above the player's chest
        const from = new THREE.Vector3(mob.body.pos.x, mob.body.pos.y + mob.body.h * 0.85, mob.body.pos.z);
        const to = new THREE.Vector3(p.x, p.y + 1.0, p.z);
        const dir = to.sub(from).normalize();
        this.spawnArrow(from.addScaledVector(dir, 0.6), dir, 24, mob, 4);
      }, peaceful || this.difficulty.aggression === 'spokojna', this.mobs, (target) => {
        // tamed wolf's bite
        target.damage(4, m.body.pos.x, m.body.pos.z);
        Sfx.playHurt();
      }, hostileSpeed(this.difficulty.aggression), this.drops, (food: FoxFood) => {
        // Consume ONE from the actual world entity: no shadow inventory, no
        // saved held item, no duplication when the player picks up the rest.
        const i = this.drops.indexOf(food as DropEntity);
        if (i < 0 || food.count <= 0 || food.age < 0.75 || !isFood(food.id)) return false;
        const drop = this.drops[i];
        drop.count--;
        if (drop.count === 0) {
          this.drops.splice(i, 1);
          this.scene.remove(drop.mesh);
          const mesh = drop.mesh as THREE.Mesh;
          mesh.geometry?.dispose();
          if (mesh.material && !Array.isArray(mesh.material)) mesh.material.dispose();
        }
        if (m.body.pos.distanceTo(p) < 16) this.message('Lis porwał leżące jedzenie!');
        return true;
      });
      if (m.soundTimer <= 0) {
        m.soundTimer = 6 + Math.random() * 12;
        if (m.body.pos.distanceTo(p) < 16) Sfx.playMob(m.type);
      }
      // zombies burn in daylight (but never under the Nether roof)
      if (m.type === 'zombie' && dl > 0.7 && !m.dead && !this.isInNether) {
        const exposed = m.body.pos.y >= this.world.heightAt(Math.floor(m.body.pos.x), Math.floor(m.body.pos.z));
        if (exposed) {
          m.health -= dt * 2;
          if (Math.random() < dt * 8) this.spawnSmoke(m.body.pos.x, m.body.pos.y + 1.5, m.body.pos.z, 1, 0.5);
          if (m.health <= 0) { m.dead = true; m.deathTime = 0; }
        }
      }
    }
    // remove dead / far
    for (const m of this.mobs) {
      if (m.exploded && !m.looted) {
        m.looted = true;
        this.explode(m.body.pos.x, m.body.pos.y + 0.6, m.body.pos.z, 3.2, true);
      } else if (m.dead && !m.looted) {
        m.looted = true;
        this.mobLoot(m);
      }
    }
    this.mobs = this.mobs.filter((m) => {
      // Mieszkańcy i golemy trzymają się osady – nie znikają tuż za jej granicą.
      const far = m.body.pos.distanceTo(p) > (isVillageMob(m.type) ? 240 : 90);
      const gone = (m.dead && m.deathTime > 0.9) || far || m.body.pos.y < -10;
      if (gone) {
        if (m.dead && !far) this.spawnSmoke(m.body.pos.x, m.body.pos.y + 0.5, m.body.pos.z, 10, 1);
        this.scene.remove(m.group);
        m.dispose();
      }
      return !gone;
    });

    // spawn
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1.5;
      const alive = this.mobs.filter((m) => !m.dead);
      const hostile = alive.filter((m) => HOSTILE_MOBS.has(m.type)).length;
      const passive = alive.length - hostile;
      const tryPos = (minD: number, maxD: number) => {
        const ang = Math.random() * Math.PI * 2;
        const dist = minD + Math.random() * (maxD - minD);
        const x = Math.floor(p.x + Math.cos(ang) * dist), z = Math.floor(p.z + Math.sin(ang) * dist);
        if (!this.world.hasChunk(Math.floor(x / CS), Math.floor(z / CS))) return null;
        const h = this.world.heightAt(x, z);
        if (h < 12) return null; // studnia lawy albo dziura – nigdy nie spawnuj na dnie świata
        const top = this.world.getBlock(x, h, z);
        if (IS_SOLID[this.world.getBlock(x, h + 1, z)] || IS_SOLID[this.world.getBlock(x, h + 2, z)]) return null;
        return { x: x + 0.5, y: h + 1, z: z + 0.5, top };
      };
      if (!this.isInNether && passive < 12 && dl > 0.5) {
        const pos = tryPos(20, 48);
        if (pos && (pos.top === B.GRASS || pos.top === B.MEADOW_GRASS || pos.top === B.PODZOL)) {
          const biome = this.world.surface(Math.floor(pos.x), Math.floor(pos.z)).biome;
          const roll = Math.random();
          const type = pickPassiveMob(roll, biome);
          const n = type === 'fox' ? 1 : type === 'rabbit' || type === 'chicken' ? 1 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 3);
          for (let i = 0; i < n; i++) this.spawnMob(type, pos.x + (Math.random() - 0.5) * 2, pos.y + 0.1, pos.z + (Math.random() - 0.5) * 2);
        }
      }
      if (this.isInNether) {
        // Nether: piwniczne bestie zawsze, a Ghasty tylko w otwartej przestrzeni.
        if (hostile < hostileCap(this.difficulty.aggression)) {
          const pos = tryPos(16, 40);
          if (pos && IS_SOLID[pos.top] && pos.top !== B.LEAVES && pos.top !== B.LAVA) {
            const roll = Math.random();
            if (roll < 0.3 && this.openAir(pos.x, pos.y + 1, pos.z, 1, 5)) {
              this.spawnMob('ghast', pos.x, pos.y + 3, pos.z);
            } else {
              const type: MobType = roll < 0.5 ? 'zombie' : roll < 0.75 ? 'creeper' : 'skeleton';
              this.spawnMob(type, pos.x, pos.y + 0.1, pos.z);
            }
          }
        }
      } else if (hostile < hostileCap(this.difficulty.aggression) && dl < 0.4) {
        const pos = tryPos(18, 40);
        if (pos && IS_SOLID[pos.top] && pos.top !== B.LEAVES) {
          const roll = Math.random();
          const type: MobType = roll < 0.25 ? 'creeper' : roll < 0.6 ? 'zombie' : 'skeleton';
          this.spawnMob(type, pos.x, pos.y + 0.1, pos.z);
        }
      }
      this.spawnVillageFolk();
      if (hostile < Math.max(0, hostileCap(this.difficulty.aggression) - 2)) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 14 + Math.random() * 22;
        const x = Math.floor(p.x + Math.cos(ang) * dist);
        const z = Math.floor(p.z + Math.sin(ang) * dist);
        if (this.world.hasChunk(Math.floor(x / CS), Math.floor(z / CS))) {
          const ceiling = this.world.heightAt(x, z) - 2; // hoisted out of the scan loop
          for (let y = Math.floor(p.y) + 2; y > 8 && y > p.y - 18; y--) {
            const here = this.world.peekBlock(x, y, z);
            const below = this.world.peekBlock(x, y - 1, z);
            if (here === B.AIR && this.world.peekBlock(x, y + 1, z) === B.AIR && IS_SOLID[below] && below !== B.LEAVES && y < ceiling) {
              const roll = Math.random();
              const type: MobType = roll < 0.3 ? 'creeper' : roll < 0.65 ? 'zombie' : 'spider';
              this.spawnMob(type, x + 0.5, y, z + 0.5);
              break;
            }
          }
        }
      }
    }
  }

  private updateEntities(dt: number) {
    // particles
    this.particles = this.particles.filter((pt) => {
      pt.life += dt;
      if (pt.life >= pt.max) {
        this.scene.remove(pt.mesh);
        return false;
      }
      pt.vel.y -= pt.gravity * dt;
      pt.mesh.position.addScaledVector(pt.vel, dt);
      if (pt.grow) pt.mesh.scale.multiplyScalar(1 + dt * pt.grow);
      if (pt.gravity > 0) {
        const bx = Math.floor(pt.mesh.position.x), by = Math.floor(pt.mesh.position.y), bz = Math.floor(pt.mesh.position.z);
        if (this.world.isSolid(bx, by, bz)) {
          pt.mesh.position.y = by + 1.02;
          pt.vel.set(pt.vel.x * 0.5, 0, pt.vel.z * 0.5);
        }
      }
      return true;
    });
    // TNT
    const done: TNTEntity[] = [];
    for (const t of this.tnts) {
      t.fuse -= dt;
      t.body.vel.y -= 25 * dt;
      t.body.vel.x *= 0.95;
      t.body.vel.z *= 0.95;
      stepBody(this.world, t.body, dt);
      t.mesh.position.set(t.body.pos.x, t.body.pos.y + 0.49, t.body.pos.z);
      const flash = Math.floor(t.fuse * 5) % 2 === 0;
      (t.mesh.material as THREE.MeshBasicMaterial).color.setScalar(flash ? 2.5 : 1);
      const sc = t.fuse < 0.3 ? 1 + (0.3 - t.fuse) * 0.6 : 1;
      t.mesh.scale.setScalar(sc);
      if (t.fuse <= 0) done.push(t);
    }
    for (const t of done) {
      this.tnts.splice(this.tnts.indexOf(t), 1);
      this.scene.remove(t.mesh);
      (t.mesh.material as THREE.Material).dispose();
      this.explode(t.body.pos.x, t.body.pos.y + 0.5, t.body.pos.z, 4);
    }
  }

  private updateCamera(dt: number) {
    const b = this.body;
    const cam = this.camera;
    const bob = Math.sin(this.bobPhase * Math.PI) * 0.045;
    const bobX = Math.cos(this.bobPhase * Math.PI * 0.5) * 0.03;
    cam.position.set(b.pos.x, b.pos.y + this.eyeHeight + Math.abs(bob), b.pos.z);
    cam.rotation.set(this.pitch, this.yaw, 0);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.3;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.3;
      cam.rotation.z = (Math.random() - 0.5) * this.shake * 0.1;
    }
    let targetFov = this.fovBase;
    if (this.sprinting) targetFov += 10;
    if (this.flying && this.sprinting) targetFov += 5;
    // 2.3: lorneta zwęża pole widzenia do szpilkowatego „dalekiego oka”.
    if (this.zooming && this.ui === 'playing') targetFov = Math.min(targetFov, 24);
    cam.fov += (targetFov - cam.fov) * Math.min(1, dt * 8);
    cam.updateProjectionMatrix();

    // hand
    const sw = Math.sin(this.swingT * Math.PI);
    this.hand.position.set(bobX - sw * 0.25, -Math.abs(bob) * 0.6 + sw * 0.12, -sw * 0.15);
    this.hand.rotation.set(-sw * 0.9, sw * 0.4, 0);
  }

  private updateSky() {
    const nether = this.isInNether;
    const ang = this.time * Math.PI * 2;
    const sunY = Math.sin(ang);
    const dl = this.daylight();
    const dayCol = new THREE.Color(0.47, 0.66, 1.0);
    const nightCol = new THREE.Color(0.012, 0.015, 0.05);
    const sky = nightCol.clone().lerp(dayCol, Math.max(0, Math.min(1, (dl - 0.16) / 0.84)));
    const sunset = Math.max(0, 1 - Math.abs(sunY) * 4) * (Math.cos(ang) > 0 || sunY > -0.2 ? 1 : 0);
    sky.lerp(new THREE.Color(1.0, 0.5, 0.25), sunset * 0.45);
    const biome = this.biomeAt();
    const raining = !nether && this.weather === 'rain' && biome !== 'Pustynia';
    if (raining) sky.multiplyScalar(0.62);
    if (this.lightning > 0) sky.lerp(new THREE.Color(0.85, 0.88, 1), Math.min(1, this.lightning));

    const fog = this.scene.fog as THREE.Fog;
    const eyeBlock = this.world.peekBlock(Math.floor(this.camera.position.x), Math.floor(this.camera.position.y), Math.floor(this.camera.position.z));
    if (nether) {
      // Nether: stałe, czerwone mrok – bez słońca, chmur i cyklu dnia.
      fog.color.setRGB(0.23, 0.055, 0.04);
      fog.near = this.renderDistance * CS * 0.4;
      fog.far = this.renderDistance * CS * 0.95;
      this.scene.background = fog.color;
    } else if (eyeBlock === B.WATER) {
      fog.color.setRGB(0.05 * dl, 0.15 * dl, 0.5 * dl);
      fog.near = 0.1;
      fog.far = 18;
      this.scene.background = fog.color;
    } else if (eyeBlock === B.LAVA) {
      fog.color.setRGB(0.8, 0.3, 0.05);
      fog.near = 0.1;
      fog.far = 2.5;
      this.scene.background = fog.color;
    } else {
      fog.color.copy(sky);
      fog.near = this.renderDistance * CS * (raining ? 0.28 : 0.45);
      fog.far = this.renderDistance * CS * (raining ? 0.7 : 0.95);
      this.scene.background = sky;
    }

    // W Netherze oświetlenie jest stałe – bez dnia i nocy.
    const lin = nether ? 0.72 : Math.pow(dl, 2.2);
    // 2.4: nocne widzenie podnosi podłogę światła, więc jaskinie nie są już czarne.
    const night = this.hasEffect('night');
    const light = night ? Math.max(lin, 0.55) : lin;
    this.uDay.value = light;
    this.handMat.color.setScalar(Math.max(0.35, light));
    this.ambient.intensity = nether ? 0.55 : night ? Math.max(0.3 + dl * 1.0, 0.72) : 0.3 + dl * 1.0;
    this.dirLight.intensity = nether ? 0.12 : Math.max(0, sunY) * 1.2 + 0.1;
    this.sun.visible = !nether;
    this.moon.visible = !nether;
    this.stars.visible = !nether;
    this.clouds.visible = !nether && this.gfx.clouds;

    const cp = this.camera.position;
    const sunDir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0.25).normalize();
    this.sun.position.copy(cp).addScaledVector(sunDir, 400);
    this.sun.lookAt(cp);
    this.moon.position.copy(cp).addScaledVector(sunDir, -400);
    this.moon.lookAt(cp);
    this.dirLight.position.copy(cp).addScaledVector(sunDir, 50);
    this.dirLight.target.position.copy(cp);
    this.stars.position.copy(cp);
    this.stars.rotation.z = ang;
    (this.stars.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - dl * 1.8);
    this.clouds.position.set(cp.x, 132, cp.z);
    const drift = performance.now() / 1000 * 1.2;
    this.cloudTex.offset.set((cp.x + drift) / 1200, -cp.z / 1200);
    (this.clouds.material as THREE.MeshBasicMaterial).color.setScalar(Math.max(0.15, dl) * (raining ? 0.55 : 1));
    (this.clouds.material as THREE.MeshBasicMaterial).opacity = raining ? 0.95 : 0.8;
  }

  emitHud() {
    const p = this.body.pos;
    const f = ((Math.round(this.yaw / (Math.PI / 2)) % 4) + 4) % 4;
    const now = performance.now();
    // Only the chunk the player actually entered is surveyed. This is O(1)
    // on every HUD tick and doesn't generate distant chunks behind the fog.
    if (this.discovery && this.world && Number.isFinite(p.x) && Number.isFinite(p.z)) {
      const cx = Math.floor(p.x / CS), cz = Math.floor(p.z / CS);
      if (!this.discovery.get(this.currentDimension(), cx, cz)) {
        const s = this.world.surface(cx * CS + CS / 2, cz * CS + CS / 2);
        this.discovery.survey(this.currentDimension(), p.x, p.z, s.biome, s.h);
      }
    }
    // Use actual player coordinates; a biome border can cross the cached HUD chunk.
    if (this.ui === 'playing') this.observeBiomeAtPlayer();
    this.refreshMinimap();
    this.onHud({
      hotbar: this.inventory.slots.slice(0, 9).map((s) => (s ? { ...s } : null)),
      selected: this.selected,
      health: this.health,
      air: this.air,
      maxAir: this.maxAir,
      mode: this.mode,
      fps: this.fps,
      pos: [p.x, p.y, p.z],
      facing: FACING[f],
      biome: this.biomeAt(),
      chunks: this.world.chunks.size,
      time: this.time,
      target: this.target ? `${BLOCKS[this.target.id].name} (${this.target.x}, ${this.target.y}, ${this.target.z})` : '-',
      underwater: this.blockAt(p, this.eyeHeight) === B.WATER,
      inLava: this.blockAt(p, this.eyeHeight) === B.LAVA,
      flying: this.flying,
      debug: this.debug,
      hurtCount: this.hurtCount,
      mobs: this.mobs.length,
      seed: this.world.seed,
      messages: this.messages.filter((m) => now - m.t < 10000 || this.ui === 'chat').slice(-10),
      loading: this.loadingProgress,
      day: this.day,
      locked: this.locked,
      hunger: this.hunger,
      weather: this.weather,
      toast: this.toast && now - this.toast.at < 4600 ? { title: this.toast.title, text: this.toast.text } : null,
      sprinting: this.sprinting,
      worldName: this.worldName,
      worldType: this.worldType,
      minimap: this.showMinimap,
      heldHint: this.heldHint(),
      bow: this.bowDraw,
      level: this.xp.info().level,
      xpFrac: (() => { const i = this.xp.info(); return i.need > 0 ? i.inLevel / i.need : 0; })(),
      armor: this.armor.map((s) => (s ? { ...s } : null)),
      armorPoints: armorPoints(this.armor),
      mobHint: this.mobHint(),
      village: this.villageName,
      trades: this.trades,
      resScale: this.resScale,
      showFps: this.showFps,
      drawCalls: this.renderer.info.render.calls,
      zoom: this.isZooming() && this.ui === 'playing',
      // 2.5: HUD zna tryb sterowania (inna treść podpowiedzi na dotyku).
      touch: this.touchInput,
      // 2.5: świeże wyjście z blokady kursora – Chrome chwilę blokuje ponowny
      // Pointer Lock, więc podpowiedź tłumaczy, czemu klik „nic nie robi”.
      lockCooldown: !this.locked && !this.touchInput && this.lastLockExit > 0 && performance.now() - this.lastLockExit < 1600,
      fishing: this.fishingState(),
      bait: this.fishingBait ? displayName(this.fishingBait) : null,
      challenges: { ...this.challengeProgress },
      // 2.4: aktywne wzmocnienia napojów (ikona + nazwa + sekundy)
      effects: [...this.effects.entries()]
        .filter(([id]) => id !== 'none')
        .map(([id, ms]) => {
          const def = EFFECT_META[id as Exclude<PotionEffectId, 'none'>];
          return { id, icon: def.icon, name: def.name, left: ms / 1000 };
        }),
      waypoint: (() => {
        const w = this.waypoints.find((point) => point.id === this.activeWaypointId);
        if (!w || w.dimension !== this.currentDimension()) return null;
        const dx = w.x + 0.5 - p.x, dz = w.z + 0.5 - p.z;
        const distance = Math.hypot(dx, dz);
        const worldAngle = Math.atan2(-dx, -dz);
        const bearing = Math.atan2(Math.sin(worldAngle - this.yaw), Math.cos(worldAngle - this.yaw));
        const directions = ['przed tobą', 'w prawo', 'za tobą', 'w lewo'];
        const index = ((Math.round(bearing / (Math.PI / 2)) % 4) + 4) % 4;
        return { name: w.name, distance, direction: directions[index], bearing };
      })(),
    });
  }

  private heldHint(): string | null {
    const sel = this.selectedStack();
    const id = sel?.id;
    const ench = sel?.ench ? enchList(sel) : null;
    // 2.4: fiolki i napoje mają krótką podpowiedź pod celownikiem
    if (id === I.BOTTLE) return 'Fiolka: PPM nad wodą, aby napełnić';
    if (id !== undefined && isPotion(id)) return 'Napój: PPM, aby wypić';
    if (id === I.WORM_BAIT || id === I.GLOW_BAIT) return 'Przynęta: PPM / tap, aby założyć na wędkę w ekwipunku';
    if (id === I.BIOME_COMPASS) return 'Kompas biomów: PPM / tap, aby wybrać biom i śledzić cel';
    if (id === I.COMPASS) {
      const dx = this.spawnPoint.x - this.body.pos.x;
      const dz = this.spawnPoint.z - this.body.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 2) return 'Kompas: jesteś przy punkcie odrodzenia';
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      const ahead = dx * -sin + dz * -cos;
      const side = dx * cos + dz * -sin;
      const rel = Math.atan2(side, ahead);
      const names = ['przed tobą', 'w prawo', 'za tobą', 'w lewo'];
      const idx = ((Math.round(rel / (Math.PI / 2)) % 4) + 4) % 4;
      return `Kompas: odrodzenie ${names[idx]} · ${Math.round(dist)} m`;
    }
    if (id === I.SPYGLASS) {
      return this.zooming ? 'Lorneta: G / Zaznacz cel, aby śledzić widoczny blok' : 'Lorneta: przytrzymaj PPM, aby przyjrzeć się okolicy';
    }
    if (id === I.FISHING_ROD) {
      const f = this.fishingState();
      if (f === 'bite') return 'Wędka: brań! Kliknij, aby zaciągnąć';
      if (f === 'waiting') return 'Wędka: przynęta czeka w wodzie…';
      if (f === 'cast') return 'Wędka: przynęta leci…';
      return this.fishingBait ? `Wędka: ${displayName(this.fishingBait)} na haczyku · PPM, aby zarzucić` : 'Wędka: PPM, aby zarzucić';
    }
    if (id === I.CLOCK) {
      const hour = (this.time * 24 + 6) % 24;
      const label = hour < 5 || hour >= 20 ? 'noc' : hour < 7 ? 'świt' : hour < 17 ? 'dzień' : 'zmierzch';
      const h = Math.floor(hour);
      const m = Math.floor((hour * 60) % 60);
      return `Zegar: ${label}, ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    if (ench && ench.length) return `Zaklęcia: ${ench.join(', ')}`;
    return null;
  }

  /** Nazwa i wskazówka dla istoty pod celownikiem (1.6). */
  private mobHint(): string | null {
    const { mob } = this.findMobTarget(4.5);
    if (!mob || mob.dead) return null;
    if (mob.type === 'villager') {
      const st = mob.trade ?? null;
      return st ? `${villagerTitle(st)} – PPM, aby handlować` : 'Mieszkaniec – PPM, aby handlować';
    }
    if (mob.type === 'golem') return mob.provoked > 0 ? 'Żelazny golem (rozgniewany!)' : 'Żelazny golem – stróż osady';
    return `${MOB_NAMES[mob.type] ?? mob.type} · ${Math.max(0, Math.round(mob.health))}/${mob.maxHealth} HP`;
  }

  /** Rozgląda się, czy gracz stoi w wiosce; pierwsze wejście to osiągnięcie. */
  private checkVillage() {
    const p = this.body.pos;
    const v = this.world.villageAt(Math.floor(p.x), Math.floor(p.z));
    if (!v) {
      this.villageName = null;
      return;
    }
    const folk = this.mobs.filter((m) => !m.dead && m.type === 'villager' && Math.hypot(m.body.pos.x - v.x, m.body.pos.z - v.z) < 60).length;
    this.villageName = `Wioska · ${v.buildings.length} budynków${folk ? ` · mieszkańcy: ${folk}` : ''}`;
    if (this.villageSeen.has(v.key)) return;
    this.villageSeen.add(v.key);
    this.message('Trafiłeś na wioskę! Mieszkańcy handlują – kliknij na nich PPM.');
    this.unlock('village');
    this.emitHud();
  }

  /** Dzwon na placu: mieszkańcy wracają na środek osady. */
  private ringBell(x: number, _y: number, z: number) {
    Sfx.playBell();
    let n = 0;
    for (const m of this.mobs) {
      if (m.type !== 'villager' || m.dead) continue;
      if (Math.hypot(m.body.pos.x - x, m.body.pos.z - z) > 32) continue;
      m.yaw = Math.atan2(x - m.body.pos.x, z - m.body.pos.z);
      m.walking = true;
      m.aiTimer = 3.5;
      n++;
    }
    this.swingT = 0;
    this.unlock('bell');
    this.message(n > 0 ? `Dzwon bije – ${n} mieszkańców wraca na plac.` : 'Dzwon bije nad pustym placem.');
  }

  /** Łopata na trawie lub ziemi robi ścieżkę (jak w klasyku). */
  private tryMakePath(t: NonNullable<ReturnType<World['raycast']>>): boolean {
    const sel = this.selectedStack();
    if (!sel || ITEMS[sel.id]?.tool !== 'shovel') return false;
    if (t.ny !== 1) return false;
    if (t.id !== B.GRASS && t.id !== B.DIRT) return false;
    const above = this.world.getBlock(t.x, t.y + 1, t.z);
    if (above !== B.AIR) return false;
    this.world.setBlock(t.x, t.y, t.z, B.PATH);
    Sfx.playDig('grass');
    this.wearTool();
    this.swingT = 0;
    return true;
  }

  /** Golemy w promieniu wpadają w gniew na podany czas. Zwraca ich liczbę. */
  private provokeGolems(x: number, z: number, radius: number, seconds: number): number {
    let n = 0;
    for (const m of this.mobs) {
      if (m.type !== 'golem' || m.dead) continue;
      if (Math.hypot(m.body.pos.x - x, m.body.pos.z - z) > radius) continue;
      m.provoked = Math.max(m.provoked, seconds);
      n++;
    }
    return n;
  }

  /**
   * Mieszkańcy i golem pojawiają się na terenie wioski, gdy gracz jest blisko.
   * Bez tego osada byłaby tylko dekoracją.
   */
  private spawnVillageFolk() {
    const p = this.body.pos;
    const v = this.world.villageAt(Math.floor(p.x), Math.floor(p.z));
    if (!v) return;
    const near = this.mobs.filter((m) => !m.dead && isVillageMob(m.type) && Math.hypot(m.body.pos.x - v.x, m.body.pos.z - v.z) < 64);
    const villagers = near.filter((m) => m.type === 'villager').length;
    const golems = near.filter((m) => m.type === 'golem').length;
    const spots = villageSpawnSpots(v);
    const free = (x: number, y: number, z: number) => {
      if (this.world.peekBlock(Math.floor(x), Math.floor(y), Math.floor(z)) !== B.AIR) return false;
      if (this.world.peekBlock(Math.floor(x), Math.floor(y) + 1, Math.floor(z)) !== B.AIR) return false;
      const below = this.world.peekBlock(Math.floor(x), Math.floor(y) - 1, Math.floor(z));
      if (!IS_SOLID[below]) return false;
      return !this.mobs.some((m) => !m.dead && Math.hypot(m.body.pos.x - x, m.body.pos.z - z) < 1.4);
    };
    if (villagers < 7) {
      for (let attempt = 0; attempt < 4; attempt++) {
        const spot = spots[Math.floor(Math.random() * spots.length)];
        const x = spot.x + 0.5;
        const z = spot.z + 0.5;
        const y = this.world.heightAt(Math.floor(x), Math.floor(z)) + 1;
        if (!free(x, y, z)) continue;
        const mob = this.spawnMob('villager', x, y, z, Math.random());
        mob.trade = createVillagerState(mob.profession, this.nowSeconds());
        break;
      }
    }
    if (golems < 1 && Math.random() < 0.5) {
      const spot = spots[Math.floor(Math.random() * spots.length)];
      const x = spot.x + 0.5;
      const z = spot.z + 0.5;
      const y = this.world.heightAt(Math.floor(x), Math.floor(z)) + 1;
      if (free(x, y, z)) {
        this.spawnMob('golem', x, y, z);
        this.unlock('golem');
        this.message('Żelazny golem patroluje osadę.');
      }
    }
  }

  get recipes() {
    return RECIPES;
  }

  private mobLoot(m: Mob) {
    const x = m.body.pos.x, y = m.body.pos.y + 0.4, z = m.body.pos.z;
    const meat = m.type === 'pig' || m.type === 'cow' || m.type === 'rabbit' || m.type === 'chicken'
      ? animalMeatYield(this.difficulty?.resources ?? 'normalne') : 1;
    if (m.type === 'pig') { if (meat) this.spawnDrop(I.RAW_PORK, meat, x, y, z); }
    else if (m.type === 'cow') {
      if (meat) this.spawnDrop(I.RAW_BEEF, meat, x, y, z);
      const hide = Math.floor(Math.random() * 3);
      for (let i = 0; i < hide; i++) this.spawnDrop(I.LEATHER, 1, x, y, z);
    }
    else if (m.type === 'fox') {
      if (Math.random() < 0.3) this.spawnDrop(I.LEATHER, 1, x, y, z);
    }
    else if (m.type === 'rabbit') {
      if (meat) this.spawnDrop(I.RAW_RABBIT, meat, x, y, z);
      if (Math.random() < 0.25) this.spawnDrop(I.LEATHER, 1, x, y, z);
    }
    else if (m.type === 'chicken') {
      if (meat) this.spawnDrop(I.RAW_CHICKEN, meat, x, y, z);
      if (Math.random() < 0.4) this.spawnDrop(I.FEATHER, 1, x, y, z);
    } else if (m.type === 'sheep' && !m.sheared) this.spawnDrop(B.WOOL_WHITE, 1, x, y, z);
    else if (m.type === 'creeper') this.spawnDrop(I.GUNPOWDER, 1, x, y, z);
    else if (m.type === 'spider') this.spawnDrop(I.STRING, 1 + (Math.random() < 0.5 ? 1 : 0), x, y, z);
    else if (m.type === 'skeleton') {
      this.spawnDrop(I.BONE, 1 + (Math.random() < 0.5 ? 1 : 0), x, y, z);
      if (Math.random() < 0.5) this.spawnDrop(I.ARROW, 1 + Math.floor(Math.random() * 3), x, y, z);
      if (Math.random() < 0.08) this.spawnDrop(I.BOW, 1, x, y, z);
    } else if (m.type === 'wolf') {
      if (Math.random() < 0.6) this.spawnDrop(I.BONE, 1, x, y, z);
    } else if (m.type === 'golem') {
      const iron = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < iron; i++) this.spawnDrop(I.IRON, 1, x, y, z);
      const poppies = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < poppies; i++) this.spawnDrop(B.FLOWER_RED, 1, x, y, z);
    } else if (m.type === 'enderman') {
      if (Math.random() < 0.5) this.spawnDrop(I.ENDER_PEARL, 1, x, y, z);
      if (Math.random() < 0.3) this.spawnDrop(B.GRASS, 1, x, y, z);
    } else if (m.type === 'slime') {
      const balls = Math.floor(Math.random() * 3);
      for (let i = 0; i < balls; i++) this.spawnDrop(I.SLIME_BALL, 1, x, y, z);
    } else if (m.type === 'ghast') {
      if (Math.random() < 0.6) this.spawnDrop(I.GHAST_TEAR, 1, x, y, z);
      if (Math.random() < 0.8) this.spawnDrop(I.GUNPOWDER, 1, x, y, z);
      if (Math.random() < 0.3) this.spawnDrop(I.BLAZE_ROD, 1, x, y, z);
      if (Math.random() < 0.35) this.spawnDrop(I.MAGMA_CREAM, 1, x, y, z);
    } else if (m.type === 'villager') {
      this.message('Mieszkańcy nie zostawiają po sobie niczego. Golem zapamięta ten cios.');
    }
    // Grabież: each level reruns one drop roll from the same table
    if (m.bonusLoot > 0) {
      const reroll = () => {
        if (m.type === 'pig') this.spawnDrop(I.RAW_PORK, 1, x, y, z);
        else if (m.type === 'cow') {
          this.spawnDrop(I.RAW_BEEF, 1, x, y, z);
          if (Math.random() < 0.6) this.spawnDrop(I.LEATHER, 1, x, y, z);
        } else if (m.type === 'rabbit') this.spawnDrop(I.RAW_RABBIT, 1, x, y, z);
        else if (m.type === 'chicken') {
          this.spawnDrop(I.RAW_CHICKEN, 1, x, y, z);
          if (Math.random() < 0.6) this.spawnDrop(I.FEATHER, 1, x, y, z);
        } else if (m.type === 'sheep' && !m.sheared) this.spawnDrop(B.WOOL_WHITE, 1, x, y, z);
        else if (m.type === 'creeper') this.spawnDrop(I.GUNPOWDER, 1, x, y, z);
        else if (m.type === 'spider') this.spawnDrop(I.STRING, 1, x, y, z);
        else if (m.type === 'skeleton') {
          this.spawnDrop(I.BONE, 1, x, y, z);
          if (Math.random() < 0.5) this.spawnDrop(I.ARROW, 1, x, y, z);
        } else if (m.type === 'wolf') this.spawnDrop(I.BONE, 1, x, y, z);
      };
      for (let i = 0; i < m.bonusLoot; i++) if (Math.random() < 0.6) reroll();
      m.bonusLoot = 0;
    }
    if (m.type === 'zombie') this.unlock('zombie');
    if (m.type === 'creeper') this.unlock('creeper');
    if (m.type === 'spider') this.unlock('string');
    if (m.type === 'skeleton') this.unlock('skeleton');
    this.mobXp(m, x, y, z);
  }

  private updateDrops(dt: number) {
    const p = this.body.pos;
    this.drops = this.drops.filter((d) => {
      d.age += dt;
      if (d.age > 300) {
        this.scene.remove(d.mesh);
        return false;
      }
      d.vel.y -= 22 * dt;
      d.pos.addScaledVector(d.vel, dt);
      const bx = Math.floor(d.pos.x), by = Math.floor(d.pos.y), bz = Math.floor(d.pos.z);
      if (this.world.isSolid(bx, by, bz)) {
        d.pos.y = by + 1.02;
        d.vel.y = Math.max(0, -d.vel.y * 0.25);
        d.vel.x *= 0.82;
        d.vel.z *= 0.82;
      }
      const dist = Math.hypot(d.pos.x - p.x, d.pos.z - p.z, d.pos.y - (p.y + 0.9));
      if (d.age > 0.55 && dist < 3.4 && dist > 0.2) {
        d.vel.x += ((p.x - d.pos.x) / dist) * dt * 14;
        d.vel.z += ((p.z - d.pos.z) / dist) * dt * 14;
        d.vel.y += ((p.y + 0.6 - d.pos.y) / dist) * dt * 10;
      }
      if (d.age > 0.4 && dist < 1.35 && this.ui !== 'dead') {
        if (this.inventory.add(d.id, d.count, d.dur, d.ench, d.name)) {
          Sfx.playPop();
          this.notePickup(d.id);
          this.scene.remove(d.mesh);
          if (isItem(d.id)) {
            const mesh = d.mesh as THREE.Mesh;
            mesh.geometry?.dispose();
            const mat = mesh.material;
            if (mat && !Array.isArray(mat)) mat.dispose();
          }
          return false;
        }
      }
      d.mesh.position.set(d.pos.x, d.pos.y + 0.12 + Math.sin(d.age * 3) * 0.06, d.pos.z);
      d.mesh.rotation.y += dt * 2.2;
      return true;
    });
  }

  private updateGrowth(dt: number) {
    // W Netherze nic nie rośnie – nasiona, sadzonki i trzcina potrzebują
    // nadświatowego podłoża, a wskaźniki czasu należą do tamtego świata.
    if (this.isInNether) return;
    this.growAcc += dt;
    if (this.growAcc < 0.45) return;
    this.growAcc = 0;
    const loaded = [...this.world.chunks.values()];
    if (!loaded.length) return;
    const c = loaded[this.growCursor % loaded.length];
    this.growCursor++;
    const pcx = Math.floor(this.body.pos.x / CS);
    const pcz = Math.floor(this.body.pos.z / CS);
    if (Math.abs(c.cx - pcx) > 4 || Math.abs(c.cz - pcz) > 4) return;
    const ox = c.cx * CS, oz = c.cz * CS;
    for (let i = 0; i < c.data.length; i++) {
      const id = c.data[i];
      if (id !== B.SAPLING && id !== B.BIRCH_SAPLING && id !== B.SPRUCE_SAPLING && id !== B.SUGARCANE && (id < B.CROP0 || id > B.CROP2)) continue;
      const y = (i / (CS * CS)) | 0;
      const rem = i % (CS * CS);
      const z = (rem / CS) | 0;
      const x = rem % CS;
      const key = `${ox + x},${y},${oz + z}`;
      if (!this.growables.has(key)) this.growables.set(key, performance.now());
      const elapsed = (performance.now() - (this.growables.get(key) ?? 0)) / 1000;
      if (id === B.SAPLING || id === B.BIRCH_SAPLING || id === B.SPRUCE_SAPLING) {
        if (elapsed < 28 + ((x * 5 + z) % 12)) continue;
        const px = this.body.pos.x, pz = this.body.pos.z, py = this.body.pos.y;
        if (Math.abs(px - (ox + x)) < 1.4 && Math.abs(pz - (oz + z)) < 1.4 && py > y - 1 && py < y + 6) continue;
        if (plantTree(this.world, ox + x, y, oz + z, id === B.BIRCH_SAPLING, id === B.SPRUCE_SAPLING)) {
          this.growables.delete(key);
          this.unlock('tree');
          Sfx.playPlace('grass');
        } else this.growables.set(key, performance.now());
      } else if (id === B.SUGARCANE) {
        // Trzcina: rośnie w górę, dopóki jest woda przy PODSTAWIE i miejsce nad nią.
        if (elapsed < 16 + ((x * 7 + z) % 9)) continue;
        this.growables.delete(key);
        if (this.world.getBlock(ox + x, y + 1, oz + z) !== B.AIR) continue;
        // find the ground-level base of this stalk
        let base = y;
        for (let k = 1; k <= 8 && this.world.getBlock(ox + x, base - 1, oz + z) === B.SUGARCANE; k++) base--;
        const ground = this.world.getBlock(ox + x, base - 1, oz + z);
        if (ground !== B.GRASS && ground !== B.DIRT && ground !== B.SAND) continue;
        if (!this.waterNear(ox + x, base, oz + z)) continue;
        // max 3 segments per stalk
        let height = 0;
        for (let k = 0; k <= 6 && this.world.getBlock(ox + x, base + k, oz + z) === B.SUGARCANE; k++) height++;
        if (height >= 3) continue;
        this.world.setBlock(ox + x, y + 1, oz + z, B.SUGARCANE);
        this.growables.set(`${ox + x},${y + 1},${oz + z}`, performance.now());
        Sfx.playPlace('grass');
      } else if (elapsed > (this.cropWatered(ox + x, y, oz + z) ? 9 : 18)) {
        this.world.setBlock(ox + x, y, oz + z, id + 1);
        if (id + 1 >= B.CROP3) this.growables.delete(key);
        else this.growables.set(key, performance.now());
      }
    }
    if (this.growables.size > 800) {
      for (const k of this.growables.keys()) {
        const [x, , z] = k.split(',').map(Number);
        if (!this.world.hasChunk(Math.floor(x / CS), Math.floor(z / CS))) this.growables.delete(k);
      }
    }
  }

  /** Water within one block horizontally (used by sugar cane). */
  private waterNear(x: number, y: number, z: number): boolean {
    return (
      this.world.peekBlock(x + 1, y, z) === B.WATER ||
      this.world.peekBlock(x - 1, y, z) === B.WATER ||
      this.world.peekBlock(x, y, z + 1) === B.WATER ||
      this.world.peekBlock(x, y, z - 1) === B.WATER ||
      this.world.peekBlock(x + 1, y - 1, z) === B.WATER ||
      this.world.peekBlock(x - 1, y - 1, z) === B.WATER ||
      this.world.peekBlock(x, y - 1, z + 1) === B.WATER ||
      this.world.peekBlock(x, y - 1, z - 1) === B.WATER
    );
  }

  private cropWatered(x: number, y: number, z: number): boolean {
    for (let dx = -4; dx <= 4; dx++)
      for (let dz = -4; dz <= 4; dz++) {
        if (dx * dx + dz * dz > 18) continue;
        if (this.world.peekBlock(x + dx, y, z + dz) === B.WATER || this.world.peekBlock(x + dx, y - 1, z + dz) === B.WATER) return true;
      }
    return false;
  }

  private updateFurnaces(dt: number) {
    const dim = this.isInNether ? 1 : 0;
    for (const [key, f] of this.furnaces) {
      if ((f.dim ?? 0) !== dim) continue; // piec z drugiego wymiaru – nie ruszamy
      // Najpierw chunk: peekBlock bez chunka zwracał kamień i kasował piec
      // wraz z zawartością, gdy gracz oddalił się o kilkanaście bloków.
      if (!this.world.hasChunk(Math.floor(f.x / CS), Math.floor(f.z / CS))) continue;
      const id = this.world.peekBlock(f.x, f.y, f.z);
      if (id !== B.FURNACE && id !== B.FURNACE_ON) {
        this.furnaces.delete(key);
        continue;
      }
      const before = f.output?.count ?? 0;
      const lit = tickFurnace(f, dt);
      if ((f.output?.count ?? 0) > before && f.output?.id === I.IRON) this.unlock('iron');
      if ((f.output?.count ?? 0) > before && (f.output?.id === I.COOKED_FISH || f.output?.id === I.COOKED_SALMON)) this.unlock('chef');
      if (before === 0 && f.output) this.gainXp(1); // a finished smelt pays 1 XP
      const want = lit ? B.FURNACE_ON : B.FURNACE;
      if (id !== want) this.world.setBlock(f.x, f.y, f.z, want);
    }
  }

  /**
   * 2.3: kowadło trzyma zawartość tak długo, jak stoi blok. Zniknięte
   * kowadło wypada na ziemię razem z przedmiotami (jak skrzynia i piec).
   */
  private updateAnvils(dt: number) {
    for (const a of this.anvils.values()) {
      if ((a.dim ?? 0) !== (this.isInNether ? 1 : 0)) continue;
      if (a.burn > 0) a.burn = Math.max(0, a.burn - dt);
      if (!this.world.hasChunk(Math.floor(a.x / CS), Math.floor(a.z / CS))) continue;
      if (this.world.peekBlock(a.x, a.y, a.z) !== B.ANVIL) {
        if (this.anvilPos && this.anvilPos.x === a.x && this.anvilPos.y === a.y && this.anvilPos.z === a.z) this.closeInventory();
        this.spillAnvil(a.x, a.y, a.z);
      }
    }
  }

  private updateRedstone(dt: number) {
    if (this.portalCooldown > 0) this.portalCooldown -= dt;
    // button timers
    for (const [key, t] of this.buttonTimers) {
      const nt = t - dt;
      if (nt <= 0) {
        const [x, y, z] = key.split(',').map(Number);
        const id = this.world.getBlock(x, y, z);
        if (id === B.BUTTON_ON) {
          this.world.setBlock(x, y, z, B.BUTTON);
          this.onBlockChanged(x, y, z);
        }
        this.buttonTimers.delete(key);
      } else {
        this.buttonTimers.set(key, nt);
      }
    }
    if (this.redstoneDirty.size > 0) {
      tickRedstone(this.world, this.redstoneDirty);
      this.redstoneDirty.clear();
    }
    // check player standing on portal
    const px = Math.floor(this.body.pos.x), py = Math.floor(this.body.pos.y), pz = Math.floor(this.body.pos.z);
    const b = this.world.getBlock(px, py, pz);
    const b2 = this.world.getBlock(px, py + 1, pz);
    if ((b === B.NETHER_PORTAL || b2 === B.NETHER_PORTAL) && this.portalCooldown <= 0) {
      this.enterPortal();
    }
  }

  private setWeather(w: 'clear' | 'rain') {
    this.weather = w;
    this.weatherTimer = w === 'rain' ? 45 + Math.random() * 40 : 90 + Math.random() * 80;
    Sfx.setRain(w === 'rain');
    this.message(w === 'rain' ? 'Zaczyna padać.' : 'Niebo się przejaśnia.');
  }

  private updateWeather(dt: number) {
    // Sparse ambient music – never during combat-ish menus, never on the title screen.
    if (this.ui === 'playing' || this.ui === 'chat') {
      this.musicTimer -= dt;
      if (this.musicTimer <= 0) {
        this.musicTimer = 110 + Math.random() * 190;
        Sfx.playMusic();
      }
    }
    // W Netherze nie pada, nie grzmi i nie ma cyklu pogody – tylko pusty szum.
    if (this.isInNether) {
      this.rain.visible = false;
      Sfx.setRain(false);
      this.lightning = 0;
      this.weatherTimer = Math.max(this.weatherTimer, 40);
      this.ambientTimer -= dt;
      if (this.ambientTimer <= 0) {
        this.ambientTimer = 16 + Math.random() * 26;
        Sfx.playCave();
      }
      return;
    }
    // Ambient sound: wind and birds on the surface, drones in a cave.
    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = this.underground ? 18 + Math.random() * 26 : 16 + Math.random() * 30;
      const roll = Math.random();
      if (this.underground) Sfx.playCave();
      else if (this.weather === 'rain') { if (roll < 0.6) Sfx.playWind(); }
      else if (this.daylight() > 0.55) { if (roll < 0.45) Sfx.playBird(); else if (roll < 0.8) Sfx.playWind(); }
      else if (roll < 0.5) Sfx.playWind();
    }
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) this.setWeather(this.weather === 'clear' ? 'rain' : 'clear');
    this.lightning = Math.max(0, this.lightning - dt * 1.6);
    const biome = this.biomeAt();
    const raining = this.weather === 'rain' && biome !== 'Pustynia';
    this.rain.visible = raining;
    if (raining) {
      const attr = this.rainGeo.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      const snow = biome === 'Tundra' || biome === 'Góry';
      (this.rain.material as THREE.PointsMaterial).color.setHex(snow ? 0xf4f7ff : 0xb7d4ff);
      (this.rain.material as THREE.PointsMaterial).size = snow ? 2.6 : 2.1;
      const speed = snow ? 4.5 : 16;
      const cam = this.camera.position;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= speed * dt;
        if (arr[i + 1] < -2) {
          arr[i] = (Math.random() - 0.5) * 36;
          arr[i + 1] = 12 + Math.random() * 10;
          arr[i + 2] = (Math.random() - 0.5) * 36;
        }
      }
      attr.needsUpdate = true;
      this.rain.position.set(cam.x, cam.y - 4, cam.z);
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.nextBolt = 9 + Math.random() * 16;
        this.lightning = 1;
        Sfx.playThunder();
      }
    }
    Sfx.setRain(raining);
  }

  /** Called from the HUD tick so the map stays cheap. */
  refreshMinimap() {
    if (this.showMinimap) this.drawMinimap();
  }

  private drawMinimap() {
    const ctx = this.minimapCtx;
    if (!ctx) return;
    const S = 96;
    const scale = 1; // 1 pixel = 1 block
    if (!this.minimapImg || this.minimapImg.width !== S) this.minimapImg = ctx.createImageData(S, S);
    const img = this.minimapImg;
    const px = this.body.pos.x, pz = this.body.pos.z;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const fx = -sin, fz = -cos;
    const rx = cos, rz = -sin;
    for (let sy = 0; sy < S; sy++) {
      for (let sx = 0; sx < S; sx++) {
        const ox = (sx - S / 2) * scale;
        const oy = (sy - S / 2) * scale;
        const wx = Math.floor(px + rx * ox + fx * -oy);
        const wz = Math.floor(pz + rz * ox + fz * -oy);
        const cx = Math.floor(wx / CS), cz = Math.floor(wz / CS);
        const chunk = this.world.chunks.get(World.key(cx, cz));
        let r = 14, g = 14, b = 18;
        if (chunk) {
          const lx = wx - cx * CS, lz = wz - cz * CS;
          const h = chunk.heightMap[lz * CS + lx];
          const id = chunk.data[(h * CS + lz) * CS + lx];
          const c = AVG_COLOR[id] || [90, 90, 90];
          const shade = 0.62 + (h / CH) * 0.55;
          r = c[0] * shade; g = c[1] * shade; b = c[2] * shade;
        }
        const i = (sy * S + sx) * 4;
        img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // 1.6: zielone znaczniki wiosek (obrócone razem z mapą)
    const villages = this.world.villagesIn(px - S / 2 - 40, pz - S / 2 - 40, px + S / 2 + 40, pz + S / 2 + 40);
    if (villages.length) {
      ctx.fillStyle = '#2ed06a';
      ctx.strokeStyle = '#0c3a1c';
      for (const v of villages) {
        const dx = v.x - px, dz = v.z - pz;
        const ox = cos * dx - sin * dz;
        const oy = sin * dx + cos * dz;
        const sx = Math.round(ox + S / 2);
        const sy = Math.round(oy + S / 2);
        if (sx < 1 || sy < 1 || sx > S - 2 || sy > S - 2) continue;
        ctx.fillRect(sx - 1, sy - 1, 3, 3);
        ctx.strokeRect(sx - 1.5, sy - 1.5, 4, 4);
      }
    }
    // 2.2: własne punkty; aktywny jest większy, punkt śmierci czerwony.
    for (const w of this.waypoints) {
      if (w.dimension !== this.currentDimension()) continue;
      const dx = w.x - px, dz = w.z - pz;
      const sx = Math.round(cos * dx - sin * dz + S / 2);
      const sy = Math.round(sin * dx + cos * dz + S / 2);
      if (sx < 2 || sy < 2 || sx > S - 3 || sy > S - 3) continue;
      const active = w.id === this.activeWaypointId;
      ctx.fillStyle = w.kind === 'death' ? '#ff4545' : active ? '#ffe45c' : '#ff9d35';
      ctx.fillRect(sx - (active ? 2 : 1), sy - (active ? 2 : 1), active ? 5 : 3, active ? 5 : 3);
      ctx.strokeStyle = '#281400';
      ctx.strokeRect(sx - 2.5, sy - 2.5, 5, 5);
    }
    ctx.fillStyle = '#fff';
    ctx.fillRect(S / 2 - 1, S / 2 - 1, 3, 3);
    ctx.fillStyle = '#ff5555';
    ctx.fillRect(S / 2, S / 2 - 5, 1, 4);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    Sfx.setRain(false);
    for (const [t, type, fn, opts] of this.listeners) t.removeEventListener(type, fn, opts);
    if (document.pointerLockElement) document.exitPointerLock();
    // Oba wymiary – chunki netheru też trzymają geometrię.
    for (const w of [this.homeWorld, this.netherWorld]) {
      if (!w) continue;
      for (const c of w.chunks.values()) for (const m of c.meshes) m.geometry.dispose();
    }
    for (const m of this.mobs) m.dispose();
    for (const t of this.tnts) (t.mesh.material as THREE.Material).dispose();
    this.tnts = [];
    for (const a of this.arrows) this.scene.remove(a.mesh);
    this.arrows = [];
    for (const o of this.orbs) this.scene.remove(o.mesh);
    this.orbs = [];
    this.orbGeo.dispose();
    this.orbMat.dispose();
    for (const f of this.falling) this.scene.remove(f.mesh);
    this.falling = [];
    this.leafDecay = [];
    for (const d of this.drops) {
      this.scene.remove(d.mesh);
      const mesh = d.mesh as THREE.Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material;
      if (mat && !Array.isArray(mat)) mat.dispose();
    }
    this.drops = [];
    // obiekty odłożone w drugim wymiarze
    for (const st of [this.dimStash.home, this.dimStash.nether]) {
      for (const m of st.mobs) m.dispose();
      for (const t of st.tnts) (t.mesh.material as THREE.Material).dispose();
      for (const a of st.arrows) this.scene.remove(a.mesh);
      for (const o of st.orbs) this.scene.remove(o.mesh);
      for (const f of st.falling) this.scene.remove(f.mesh);
      for (const d of st.drops) {
        this.scene.remove(d.mesh);
        const mesh = d.mesh as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (mat && !Array.isArray(mat)) mat.dispose();
      }
      st.mobs = [];
      st.drops = [];
      st.arrows = [];
      st.tnts = [];
      st.orbs = [];
      st.falling = [];
    }
    for (const pt of this.particles) this.scene.remove(pt.mesh);
    this.particles = [];
    for (const mat of this.particleMats.values()) mat.dispose();
    this.particleMats.clear();
    for (const mat of this.materials) mat.dispose();
    this.materials = [];
    this.handMat.dispose();
    this.dropMat.dispose();
    this.arrowMat.dispose();
    this.arrowGeo.dispose();
    this.tntGeo.dispose();
    this.selection.geometry.dispose();
    (this.selection.material as THREE.Material).dispose();
    this.crackMesh.geometry.dispose();
    (this.crackMesh.material as THREE.Material).dispose();
    for (const t of this.crackTex) t.dispose();
    for (const t of this.itemTex.values()) t.dispose();
    this.itemTex.clear();
    this.removeBobber();
    this.bobberGeo?.dispose();
    this.bobberMat?.dispose();
    this.renderer.dispose();
    // Browsers cap the number of live WebGL contexts – release this one for good.
    try { this.renderer.forceContextLoss(); } catch { /* not supported everywhere */ }
    this.renderer.domElement.remove();
  }
}
