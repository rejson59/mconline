import * as THREE from 'three';
import { World, CS, CH, SEA, plantTree, type Biome } from './world';
import { B, BLOCKS, IS_SOLID, RENDER, tileFor, isDoor, isDoorOpen, isDoorTop, isLadder, isTrap, isTrapOpen, doorFacing, doorPair, ladderFacing, facingFromNormal } from './blocks';
import { getAtlas, tileUV, AVG_COLOR } from './textures';
import { stepBody, aabbIntersectsBlock, type Body } from './physics';
import { Mob, type MobType } from './mobs';
import { Inventory, RECIPES, type Stack } from './inventory';
import * as Sfx from './audio';
import { patchChunkMaterial } from './lighting';
import { buildItemIcons } from './itemIcons';
import {
  ITEMS, I, displayName, isItem, isFood, isHoe, mineSeconds, attackDamage, attackCooldown,
  blockDrops, toolHelps, isOre, smeltResult, fuelSeconds, resolveId, stackLimit, pickHint,
} from './items';
import { type FurnaceState, emptyFurnace, furnaceKey, tickFurnace } from './furnace';
import { type ChestState, chestKey, emptyChest, lootChest } from './chest';
import { achievementById } from './achievements';
import { upsertSave } from './saves';

export type GameMode = 'survival' | 'creative';
export type UIState = 'playing' | 'paused' | 'inventory' | 'chat' | 'dead' | 'furnace' | 'chest';

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
  updated?: number;
  hunger?: number;
  spawn?: [number, number, number];
  furnaces?: FurnaceState[];
  chests?: ChestState[];
  unlocked?: string[];
}

export const SAVE_KEY = 'blockcraft-save-v1';

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
}

interface DropEntity {
  id: number;
  count: number;
  dur?: number;
  mesh: THREE.Object3D;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
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
  mode: GameMode;
  ui: UIState = 'paused';
  inventory = new Inventory();
  selected = 0;
  icons: Record<number, string>;
  craftingTable = false;
  renderDistance = 6;
  sensitivity = 1;
  fovBase = 72;

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
  private campfireHurt = 0;
  private arrows: ArrowEntity[] = [];
  private arrowGeo!: THREE.BufferGeometry;
  private arrowMat!: THREE.MeshBasicMaterial;
  /** Seconds the bow has been drawn, -1 when idle. */
  private bowDraw = -1;
  private biomeCache = new Map<string, Biome>();
  worldId = '';
  worldName = 'Świat';
  worldType: 'normal' | 'flat' = 'normal';
  unlocked = new Set<string>();
  toast: { title: string; text: string; at: number } | null = null;
  showMinimap = true;
  minimapCanvas!: HTMLCanvasElement;
  private minimapCtx!: CanvasRenderingContext2D;
  private uDay = { value: 1 };
  private dropMat!: THREE.MeshBasicMaterial;
  private itemTex = new Map<number, THREE.Texture>();
  private dropGeos = new Map<number, THREE.BufferGeometry>();
  private growables = new Map<string, number>();
  private growAcc = 0;
  private growCursor = 0;
  private eatCooldown = 0;
  private toldPick = false;
  private wasInWater = false;
  weather: 'clear' | 'rain' = 'clear';
  private weatherTimer = 70;
  private lightning = 0;
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
    this.world = new World(seed, worldType === 'flat');
    if (opts.save) this.world.loadMods(opts.save.mods);

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.domElement.style.display = 'block';
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(this.fovBase, container.clientWidth / container.clientHeight, 0.05, 1200);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.scene.fog = new THREE.Fog(0x88bbff, 20, this.renderDistance * CS);

    const atlas = getAtlas();
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
      for (const f of opts.save.furnaces ?? []) this.furnaces.set(furnaceKey(f.x, f.y, f.z), { ...f, input: f.input ? { ...f.input } : null, fuel: f.fuel ? { ...f.fuel } : null, output: f.output ? { ...f.output } : null });
      for (const c of opts.save.chests ?? []) this.chests.set(chestKey(c.x, c.y, c.z), { x: c.x, y: c.y, z: c.z, slots: (c.slots ?? []).slice(0, 27).map((s) => (s ? { ...s } : null)) });
      for (const id of opts.save.unlocked ?? []) this.unlocked.add(id);
      if ((opts.save.day || 1) >= 2) this.unlocked.add('night');
      this.findSpawn();
      if (opts.save.spawn) this.spawnPoint.set(...opts.save.spawn);
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
      ? 'Tryb kreatywny. T – czat, /help – komendy, M – minimapa.'
      : 'BlockCraft 1.3: zetnij drzewo, wytwórz kilof, a potem łuk. Po zmroku grasują nieumarli, a w jaskiniach pająki.');
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
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked && this.ui === 'playing') this.setUI('paused');
      if (!this.locked) { this.mouseLeft = false; this.mouseRight = false; this.keys.clear(); }
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
      const s = 0.0022 * this.sensitivity;
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
    this.on(window, 'keyup', ((e: KeyboardEvent) => { this.keys.delete(e.code); }) as EventListener);
    this.on(document, 'visibilitychange', () => {
      if (document.hidden) {
        this.keys.clear();
        this.mouseLeft = this.mouseRight = false;
        this.save();
      }
    });
  }

  private onKeyDown(e: KeyboardEvent) {
    if (this.ui === 'chat') return;
    if (this.ui === 'inventory' || this.ui === 'furnace' || this.ui === 'chest') {
      if (e.code === 'KeyE' || e.code === 'Escape') {
        e.preventDefault();
        this.closeInventory();
      }
      return;
    }
    if (this.ui !== 'playing' || !this.locked) return;
    if (e.code === 'F3') { e.preventDefault(); this.debug = !this.debug; this.emitHud(); return; }
    if (e.code === 'KeyM') { this.showMinimap = !this.showMinimap; this.emitHud(); return; }
    if (e.code.startsWith('Digit')) {
      const n = parseInt(e.code.slice(5));
      if (n >= 1 && n <= 9) { this.selected = n - 1; this.emitHud(); }
    }
    if (e.code === 'KeyE') { this.openInventory(false); return; }
    if (e.code === 'KeyT' || e.code === 'Slash') { e.preventDefault(); this.setUI('chat'); return; }
    if (e.code === 'KeyQ') { this.dropItem(); }
    if (e.code === 'KeyF' && this.mode === 'creative') { this.toggleFly(); }
    if (e.code === 'Space' && !e.repeat) {
      const now = performance.now();
      if (this.mode === 'creative' && now - this.lastSpace < 300) { this.toggleFly(); }
      this.lastSpace = now;
    }
    if (e.code === 'KeyW' && !e.repeat) {
      const now = performance.now();
      if (now - this.lastW < 280) this.sprinting = true;
      this.lastW = now;
    }
    if (['Space', 'ControlLeft', 'Tab'].includes(e.code)) e.preventDefault();
    this.keys.add(e.code);
  }

  lockPointer() {
    const c = this.renderer.domElement as HTMLCanvasElement & { requestPointerLock: () => unknown };
    try {
      const p = c.requestPointerLock();
      if (p && typeof (p as Promise<void>).catch === 'function') (p as Promise<void>).catch(() => {});
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
    this.keys.clear();
    this.mouseLeft = this.mouseRight = false;
    this.bowDraw = -1;
    this.onUI(s);
  }

  openInventory(table: boolean) {
    this.craftingTable = table;
    this.setUI('inventory');
  }
  closeInventory() {
    this.inventory.returnCursor();
    this.furnacePos = null;
    this.chestPos = null;
    this.setUI('playing');
    this.emitHud();
  }

  openFurnace(x: number, y: number, z: number) {
    const key = furnaceKey(x, y, z);
    if (!this.furnaces.has(key)) this.furnaces.set(key, emptyFurnace(x, y, z));
    this.furnacePos = { x, y, z };
    this.setUI('furnace');
  }

  currentFurnace(): FurnaceState | null {
    if (!this.furnacePos) return null;
    return this.furnaces.get(furnaceKey(this.furnacePos.x, this.furnacePos.y, this.furnacePos.z)) ?? null;
  }

  openChest(x: number, y: number, z: number) {
    const key = chestKey(x, y, z);
    let chest = this.chests.get(key);
    if (!chest) {
      const id = this.world.getBlock(x, y, z);
      chest = id === B.LOOT_CHEST ? lootChest(this.world.seed, x, y, z) : emptyChest(x, y, z);
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
    return this.chests.get(chestKey(this.chestPos.x, this.chestPos.y, this.chestPos.z)) ?? null;
  }

  clickChest(i: number, right: boolean) {
    const c = this.currentChest();
    if (!c || i < 0 || i >= c.slots.length) return;
    this.transfer(() => c.slots[i], (s) => { c.slots[i] = s; }, right);
    if (this.inventory.cursor) this.notePickup(this.inventory.cursor.id);
  }

  private spillChest(x: number, y: number, z: number) {
    const key = chestKey(x, y, z);
    const saved = this.chests.get(key);
    const id = this.world.getBlock(x, y, z);
    const stacks = saved ? saved.slots : id === B.LOOT_CHEST ? lootChest(this.world.seed, x, y, z).slots : [];
    for (const s of stacks) {
      if (s) this.spawnDrop(s.id, s.count, x + 0.5, y + 0.5, z + 0.5, s.dur, (Math.random() - 0.5) * 2, 2, (Math.random() - 0.5) * 2);
    }
    this.chests.delete(key);
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
        this.inventory.cursor = { id: s.id, count: half, dur: s.dur };
        s.count -= half;
      } else {
        this.inventory.cursor = s;
        set(null);
      }
      return;
    }
    if (!s) {
      if (right) {
        set({ id: c.id, count: 1, dur: c.dur });
        c.count--;
        if (c.count <= 0) this.inventory.cursor = null;
      } else {
        set(c);
        this.inventory.cursor = null;
      }
      return;
    }
    if (s.id === c.id && s.dur === undefined && c.dur === undefined) {
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

  private notePickup(id: number) {
    if (id === B.LOG || id === B.BIRCH_LOG) this.unlock('wood');
    if (id === I.COAL) this.unlock('coal');
    if (id === I.DIAMOND) this.unlock('diamond');
    if (id === I.IRON) this.unlock('iron');
    if (id === I.WHEAT) this.unlock('farm');
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
    if (s.dur === undefined) s.dur = max;
    s.dur--;
    if (s.dur <= 0) {
      this.inventory.slots[this.selected] = null;
      Sfx.playBreak('wood');
      this.message(`${displayName(s.id)} się zniszczyło.`);
    }
    this.emitHud();
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
      if (this.mode === 'survival' && !this.inventory.add(filled, 1)) {
        this.message('Brak miejsca na wiadro.');
        return;
      }
      this.world.setBlock(t.x, t.y, t.z, B.AIR);
      Sfx.playSplash();
      this.consumeSelected();
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

  private cookOnCampfire(s: Stack): boolean {
    const cooked: Record<number, number> = { [I.RAW_PORK]: I.COOKED_PORK, [I.RAW_BEEF]: I.COOKED_BEEF, [I.RAW_CHICKEN]: I.COOKED_CHICKEN };
    const out = cooked[s.id];
    if (!out) return false;
    this.consumeSelected();
    if (!this.inventory.add(out, 1)) {
      this.spawnDrop(out, 1, this.body.pos.x, this.body.pos.y + 1, this.body.pos.z);
      this.message('Brak miejsca – mięso upadło na ziemię.');
    } else this.message(`Upieczono: ${displayName(out)}.`);
    Sfx.playEat();
    this.unlock('food');
    this.swingT = 0;
    return true;
  }

  private trySleep(x: number, y: number, z: number) {
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
    const f = this.furnaces.get(furnaceKey(x, y, z));
    if (!f) return;
    for (const s of [f.input, f.fuel, f.output]) {
      if (s) this.spawnDrop(s.id, s.count, x + 0.5, y + 0.6, z + 0.5, s.dur);
    }
    this.furnaces.delete(furnaceKey(x, y, z));
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

  spawnDrop(id: number, count: number, x: number, y: number, z: number, dur?: number, vx = (Math.random() - 0.5) * 2.2, vy = 2.4 + Math.random() * 1.5, vz = (Math.random() - 0.5) * 2.2) {
    if (count <= 0 || this.drops.length > 120) return;
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
    this.drops.push({ id, count, dur, mesh, pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(vx, vy, vz), age: 0 });
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
        this.message('Komendy: /gamemode, /time set <day|night>, /weather <clear|rain>, /tp x y z, /give <nazwa|id> [ilość], /summon <pig|sheep|cow|chicken|zombie|creeper|spider|skeleton>, /heal, /kill, /seed, /spawn, /clear, /blocks');
        break;
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
        const fallback = ITEMS[id]?.kind === 'tool' || ITEMS[id]?.kind === 'bucket' ? 1 : 64;
        const n = args[1] ? parseInt(args[1], 10) : fallback;
        const count = Number.isNaN(n) ? fallback : Math.max(1, Math.min(fallback === 1 ? 1 : 256, n));
        this.inventory.add(id, count);
        this.message(`Otrzymano ${count}x ${displayName(id)}`);
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
          pig: 'pig', swinia: 'pig', świnia: 'pig', sheep: 'sheep', owca: 'sheep', zombie: 'zombie',
          cow: 'cow', krowa: 'cow', chicken: 'chicken', kurczak: 'chicken', creeper: 'creeper',
          spider: 'spider', pająk: 'spider', pajak: 'spider', skeleton: 'skeleton', szkielet: 'skeleton',
        };
        const t = map[raw];
        if (!t) { this.message('Moby: pig, sheep, cow, chicken, zombie, creeper, spider, skeleton'); break; }
        const d = this.lookDir();
        this.spawnMob(t, this.body.pos.x + d.x * 3, this.body.pos.y + 1, this.body.pos.z + d.z * 3);
        this.message('Przyzwano: ' + t);
        break;
      }
      case 'kill':
        this.damage(1000, true);
        break;
      case 'seed':
        this.message('Ziarno świata: ' + this.world.seed);
        break;
      case 'spawn':
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
  save() {
    try {
      const data: SaveData = {
        id: this.worldId,
        name: this.worldName,
        worldType: this.worldType,
        seed: this.world.seed,
        mode: this.mode,
        mods: this.world.serializeMods(),
        pos: [this.body.pos.x, this.body.pos.y, this.body.pos.z],
        yaw: this.yaw,
        pitch: this.pitch,
        inv: this.inventory.slots,
        time: this.time,
        health: this.health,
        hunger: this.hunger,
        day: this.day,
        spawn: [this.spawnPoint.x, this.spawnPoint.y, this.spawnPoint.z],
        furnaces: [...this.furnaces.values()],
        chests: [...this.chests.values()],
        unlocked: [...this.unlocked],
        updated: Date.now(),
      };
      upsertSave({ ...data, id: this.worldId });
    } catch (e) {
      console.warn('Save failed', e);
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
      if (built < 3 && performance.now() - t0 < 12) {
        this.buildChunk(pcx + dx, pcz + dz);
        built++;
        done++;
      }
    }
    this.loadingProgress = done / Math.max(1, total);
    this.unloadTimer -= 1 / 60;
    if (this.unloadTimer <= 0) {
      this.unloadTimer = 2;
      const lim = this.renderDistance + 2;
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
    let mat = this.particleMats.get(id);
    if (!mat) {
      const c = AVG_COLOR[id] || [128, 128, 128];
      mat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace) });
      this.particleMats.set(id, mat);
    }
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 400) break;
      const m = new THREE.Mesh(this.particleGeo, mat);
      const s = 0.06 + Math.random() * 0.08;
      m.scale.setScalar(s);
      m.position.set(x + (Math.random() - 0.5) * spread * 2, y + (Math.random() - 0.5) * spread * 2, z + (Math.random() - 0.5) * spread * 2);
      this.scene.add(m);
      this.particles.push({ mesh: m, vel: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4 + 1, (Math.random() - 0.5) * 4), life: 0, max: 0.5 + Math.random() * 0.5, gravity: 16 });
    }
  }

  spawnSmoke(x: number, y: number, z: number, n: number, spread: number) {
    let mat = this.particleMats.get(-1);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.8 });
      this.particleMats.set(-1, mat);
    }
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 500) break;
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
    const d = this.lookDir();
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
        this.mouseLeft = false;
        if (!mob.shear()) { this.message('Ta owca jest już ostrzyżona.'); return; }
        const n = 1 + (Math.random() < 0.4 ? 1 : 0);
        this.spawnDrop(B.WOOL_WHITE, n, mob.body.pos.x, mob.body.pos.y + 0.6, mob.body.pos.z, undefined, (Math.random() - 0.5) * 2, 2, (Math.random() - 0.5) * 2);
        this.wearTool();
        this.unlock('shear');
        Sfx.playPlace('cloth');
        this.message(n > 1 ? 'Ostrzyżono owcę. Dwie wełny.' : 'Ostrzyżono owcę.');
        return;
      }
      this.attackCooldown = attackCooldown(toolId);
      const dmg = attackDamage(toolId, this.sprinting);
      if (mob.damage(dmg, this.body.pos.x, this.body.pos.z)) {
        Sfx.playHurt();
        Sfx.playMob(mob.type);
        this.wearTool();
        if (this.mode === 'survival') this.hunger = Math.max(0, this.hunger - 0.08);
      }
      this.mouseLeft = false;
      return;
    }
    if (this.target && this.target.id === B.TNT) {
      this.igniteTNT(this.target.x, this.target.y, this.target.z, 4);
      this.unlock('boom');
      this.mouseLeft = false;
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
    if (this.mode === 'survival' && this.inventory.countOf(I.ARROW) <= 0) {
      this.message('Brak strzał. Wytwórz je z krzemienia, patyka i pióra.');
      return;
    }
    if (this.mode === 'survival') this.inventory.remove(I.ARROW, 1);
    const eye = this.eyePos();
    const d = this.lookDir();
    this.spawnArrow(eye.addScaledVector(d, 0.5), d, 22 + charge * 26, null, 4 + charge * 5);
    Sfx.playBow();
    this.swingT = 0;
    this.wearTool();
    this.unlock('archer');
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
      while (travel > 0 && !spent) {
        const stepLen = Math.min(0.3, travel);
        travel -= stepLen;
        a.pos.addScaledVector(dir, stepLen);
        const block = this.world.peekBlock(Math.floor(a.pos.x), Math.floor(a.pos.y), Math.floor(a.pos.z));
        if (block !== B.AIR && RENDER[block] !== 2 && IS_SOLID[block]) { spent = true; break; }
        if (a.from) {
          // hostile arrow vs player
          const p = this.body.pos;
          if (
            a.pos.x > p.x - 0.45 && a.pos.x < p.x + 0.45 &&
            a.pos.y > p.y - 0.1 && a.pos.y < p.y + this.body.h + 0.1 &&
            a.pos.z > p.z - 0.45 && a.pos.z < p.z + 0.45
          ) {
            this.damage(a.power);
            this.body.vel.x += dir.x * 2.5;
            this.body.vel.z += dir.z * 2.5;
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
              if (m.damage(a.power, a.pos.x - dir.x * 2, a.pos.z - dir.z * 2)) {
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
      if (spent) { this.scene.remove(a.mesh); Sfx.playArrowHit(); continue; }
      a.mesh.position.copy(a.pos);
      a.mesh.lookAt(a.pos.clone().add(a.vel));
      keep.push(a);
    }
    this.arrows = keep;
  }

  tryUse() {
    const t = this.target;
    this.placeCooldown = 0.22;
    const sneaking = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    if (t && !sneaking) {
      if (isDoor(t.id)) { this.toggleDoor(t.x, t.y, t.z); return; }
      if (isTrap(t.id)) { this.toggleTrap(t.x, t.y, t.z, t.nx, t.nz); return; }
      if (t.id === B.CHEST || t.id === B.LOOT_CHEST) { this.openChest(t.x, t.y, t.z); return; }
      if (t.id === B.CRAFTING) { this.openInventory(true); return; }
      if (t.id === B.FURNACE || t.id === B.FURNACE_ON) { this.openFurnace(t.x, t.y, t.z); return; }
      if (t.id === B.BED) { this.trySleep(t.x, t.y, t.z); return; }
    }
    const s = this.selectedStack();
    if (!s) return;
    if (t && s.id === I.FLINT_STEEL && t.id === B.TNT) {
      this.igniteTNT(t.x, t.y, t.z, 3.2);
      this.unlock('boom');
      this.wearTool();
      this.swingT = 0;
      return;
    }
    if (t && t.id === B.CAMPFIRE && this.cookOnCampfire(s)) return;
    if (s.id === I.BOW) { this.bowDraw = 0.0001; this.swingT = 0; return; }
    if (isFood(s.id)) { this.tryEat(s); return; }
    if (!t) return;
    if (isHoe(s.id) && this.tryTill(t)) return;
    if (s.id === I.SEEDS && this.tryPlant(t, s)) return;
    if (s.id === I.BUCKET || s.id === I.WATER_BUCKET || s.id === I.LAVA_BUCKET) {
      this.tryBucket(t, s);
      return;
    }
    if (isItem(s.id) || !BLOCKS[s.id]) return;
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
    if (id === B.SAPLING || id === B.BIRCH_SAPLING) {
      if (below !== B.GRASS && below !== B.DIRT && below !== B.FARMLAND) return;
    } else if (id === B.CROP0 || id === B.CROP1 || id === B.CROP2 || id === B.CROP3) {
      if (below !== B.FARMLAND) return;
    } else if (id === B.TORCH) {
      const attached = this.world.getBlock(px - t.nx, py - t.ny, pz - t.nz);
      if (!IS_SOLID[attached] && !IS_SOLID[below]) return;
    } else if (isDoor(id)) {
      if (!this.placeDoor(px, py, pz, t.nx, t.ny, t.nz)) return;
      Sfx.playPlace('wood');
      this.swingT = 0;
      this.consumeSelected();
      this.unlock('home');
      return;
    } else if (isLadder(id)) {
      if (t.ny !== 0) { this.message('Drabina musi wisieć na ścianie.'); return; }
      const face = facingFromNormal(-t.nx, -t.nz);
      this.world.setBlock(px, py, pz, B.LADDER_N + face);
      Sfx.playPlace('wood');
      this.swingT = 0;
      this.consumeSelected();
      return;
    } else if (isTrap(id)) {
      if (t.ny === 1) this.world.setBlock(px, py, pz, B.TRAP);
      else if (t.ny === 0) this.world.setBlock(px, py, pz, B.TRAP_N + facingFromNormal(-t.nx, -t.nz));
      else { this.message('Właz kładzie się na podłodze albo na ścianie.'); return; }
      Sfx.playPlace('wood');
      this.swingT = 0;
      this.consumeSelected();
      return;
    } else if (id === B.CHEST) {
      this.unlock('stash');
    } else if (RENDER[id] === 1) {
      if (below !== B.GRASS && below !== B.DIRT && below !== B.SNOW && below !== B.FARMLAND) return;
    }
    this.world.setBlock(px, py, pz, id);
    this.settle(px, py, pz);
    if (id === B.SAPLING || id === B.BIRCH_SAPLING || (id >= B.CROP0 && id <= B.CROP2)) this.growables.set(`${px},${py},${pz}`, performance.now());
    if (id === B.TORCH) this.unlock('torch');
    Sfx.playPlace(BLOCKS[id].sound);
    this.swingT = 0;
    this.consumeSelected();
  }

  pickBlock() {
    if (!this.target) return;
    const id = this.target.id;
    const idx = this.inventory.slots.findIndex((s, i) => i < 9 && s && s.id === id);
    if (idx >= 0) { this.selected = idx; this.emitHud(); return; }
    if (this.mode === 'creative') {
      this.inventory.slots[this.selected] = { id, count: 64 };
      this.emitHud();
    }
  }

  dropItem() {
    const s = this.selectedStack();
    if (!s) return;
    const e = this.eyePos();
    const d = this.lookDir();
    const dur = s.dur;
    if (this.mode === 'survival') {
      this.spawnDrop(s.id, 1, e.x + d.x * 0.6, e.y + d.y * 0.4, e.z + d.z * 0.6, dur, d.x * 4, 2, d.z * 4);
      s.count--;
      if (s.count <= 0) this.inventory.slots[this.selected] = null;
    } else {
      this.spawnDrop(s.id, 1, e.x + d.x * 0.6, e.y, e.z + d.z * 0.6, dur, d.x * 4, 2, d.z * 4);
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
      for (const drop of blockDrops(id, toolId)) this.spawnDrop(drop.id, drop.count, x + 0.5, y + 0.45, z + 0.5);
      if (isDoorTop(id)) this.spawnDrop(B.DOOR_N, 1, x + 0.5, y + 0.2, z + 0.5);
    }
    // things above that need support
    const above = this.world.getBlock(x, y + 1, z);
    if (RENDER[above] === 1 || above === B.CACTUS || above === B.TRAP || (isDoor(above) && !isDoorTop(above))) this.breakBlock(x, y + 1, z, silent);
    this.settle(x, y + 1, z);
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

  explode(cx: number, cy: number, cz: number, power: number) {
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
      this.damage(dmg);
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
    this.health -= amount;
    this.hurtCount++;
    this.lastHurt = performance.now();
    this.shake = Math.max(this.shake, 0.25);
    Sfx.playHurt();
    if (this.health <= 0) {
      this.health = 0;
      this.message('Gracz zginął. Przedmioty leżą w miejscu śmierci.');
      if (this.mode === 'survival') {
        const y = this.body.pos.y < 1 ? this.spawnPoint.y : this.body.pos.y + 0.4;
        const x = this.body.pos.y < 1 ? this.spawnPoint.x : this.body.pos.x;
        const z = this.body.pos.y < 1 ? this.spawnPoint.z : this.body.pos.z;
        for (const s of this.inventory.slots) {
          if (s) this.spawnDrop(s.id, s.count, x + (Math.random() - 0.5), y, z + (Math.random() - 0.5), s.dur, (Math.random() - 0.5) * 3, 3, (Math.random() - 0.5) * 3);
        }
      }
      this.inventory.slots.fill(null);
      this.inventory.cursor = null;
      this.setUI('dead');
    }
    this.emitHud();
  }

  respawn() {
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

  spawnMob(type: MobType, x: number, y: number, z: number) {
    const m = new Mob(type, x, y, z);
    this.mobs.push(m);
    this.scene.add(m.group);
    return m;
  }

  // ---------- Update ----------
  private loop(now: number) {
    this.raf = requestAnimationFrame(this.loop);
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

    const active = this.ui === 'playing' || this.ui === 'inventory' || this.ui === 'furnace' || this.ui === 'chest' || this.ui === 'chat' || this.ui === 'dead';
    if (active) {
      const sub = dt > 0.05 ? 2 : 1;
      for (let i = 0; i < sub; i++) this.updatePlayer(dt / sub);
      this.updateInteraction(dt);
      this.updateMobs(dt);
      this.updateEntities(dt);
      this.updateArrows(dt);
      this.updateDrops(dt);
      this.updateGrowth(dt);
      this.updateFurnaces(dt);
      this.updateWeather(dt);
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
    if (playing && k.has('ControlLeft') && forward) this.sprinting = true;
    if (!forward || (b.hitWall && !this.flying)) this.sprinting = false;
    const sneaking = playing && k.has('ShiftLeft') && !this.flying;
    if (sneaking) this.sprinting = false;

    if (this.mode === 'survival' && this.hunger <= 6) this.sprinting = false;
    let speed = this.flying ? (this.sprinting ? 22 : 11) : sneaking ? 1.3 : this.sprinting ? 5.6 : 4.3;
    if (inWater && !this.flying) speed *= 0.55;
    if (inLava && !this.flying) speed *= 0.35;

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
      const ty = jump ? 9 : playing && k.has('ShiftLeft') ? -9 : 0;
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

    // fall damage
    if (this.flying || inWater || b.vel.y > 0) this.fallStart = b.pos.y;
    else if (!b.onGround) this.fallStart = Math.max(this.fallStart, b.pos.y);
    if (b.onGround && !wasGround) {
      const fall = this.fallStart - b.pos.y;
      if (fall > 3.4 && this.mode === 'survival' && !inWater) this.damage(Math.floor(fall - 3));
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
    if (under === B.CAMPFIRE && b.onGround && this.mode === 'survival' && !this.flying) {
      this.campfireHurt += dt;
      if (this.campfireHurt > 0.45) { this.campfireHurt = 0; this.damage(1); }
    }
    // lava
    if (inLava && this.mode === 'survival') {
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
    this.eatCooldown = Math.max(0, this.eatCooldown - dt);
    if (this.swingT < 1) this.swingT = Math.min(1, this.swingT + dt * 4);

    const e = this.eyePos();
    const d = this.lookDir();
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

    if (this.mouseLeft && t) {
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
        const time = mineSeconds(t.id, this.selectedStack()?.id ?? 0);
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
    } else if (!this.mouseLeft) {
      this.breakProgress = 0;
    }
    if (this.breakProgress > 0 && t) {
      this.crackMesh.visible = true;
      this.crackMesh.position.set(t.x + 0.5, t.y + 0.5, t.z + 0.5);
      const stage = Math.min(9, Math.floor(this.breakProgress * 10));
      const mat = this.crackMesh.material as THREE.MeshBasicMaterial;
      if (mat.map !== this.crackTex[stage]) { mat.map = this.crackTex[stage]; mat.needsUpdate = true; }
    } else this.crackMesh.visible = false;

    if (this.mouseRight && this.placeCooldown <= 0) this.tryUse();
    if (this.bowDraw >= 0) {
      if (this.selectedStack()?.id === I.BOW && this.ui === 'playing') {
        if (this.mouseRight) {
          this.bowDraw = Math.min(1, this.bowDraw + dt);
          if (this.swingT >= 1) this.swingT = 0.55;
        } else this.releaseBow();
      } else this.bowDraw = -1;
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
        this.damage(dmg);
        if (this.mode === 'survival') {
          const dx = p.x - mob.body.pos.x, dz = p.z - mob.body.pos.z;
          const l = Math.hypot(dx, dz) || 1;
          this.body.vel.x += (dx / l) * 8;
          this.body.vel.z += (dz / l) * 8;
          this.body.vel.y = 5;
        }
      }, (mob) => {
        // skeleton shot: aim slightly above the player's chest
        const from = new THREE.Vector3(mob.body.pos.x, mob.body.pos.y + mob.body.h * 0.85, mob.body.pos.z);
        const to = new THREE.Vector3(p.x, p.y + 1.0, p.z);
        const dir = to.sub(from).normalize();
        this.spawnArrow(from.addScaledVector(dir, 0.6), dir, 24, mob, 4);
      }, peaceful);
      if (m.soundTimer <= 0) {
        m.soundTimer = 6 + Math.random() * 12;
        if (m.body.pos.distanceTo(p) < 16) Sfx.playMob(m.type);
      }
      // zombies burn in daylight
      if (m.type === 'zombie' && dl > 0.7 && !m.dead) {
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
        this.explode(m.body.pos.x, m.body.pos.y + 0.6, m.body.pos.z, 3.2);
      } else if (m.dead && !m.looted) {
        m.looted = true;
        this.mobLoot(m);
      }
    }
    this.mobs = this.mobs.filter((m) => {
      const far = m.body.pos.distanceTo(p) > 90;
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
      const hostile = alive.filter((m) => m.type === 'zombie' || m.type === 'creeper').length;
      const passive = alive.length - hostile;
      const tryPos = (minD: number, maxD: number) => {
        const ang = Math.random() * Math.PI * 2;
        const dist = minD + Math.random() * (maxD - minD);
        const x = Math.floor(p.x + Math.cos(ang) * dist), z = Math.floor(p.z + Math.sin(ang) * dist);
        if (!this.world.hasChunk(Math.floor(x / CS), Math.floor(z / CS))) return null;
        const h = this.world.heightAt(x, z);
        const top = this.world.getBlock(x, h, z);
        if (IS_SOLID[this.world.getBlock(x, h + 1, z)] || IS_SOLID[this.world.getBlock(x, h + 2, z)]) return null;
        return { x: x + 0.5, y: h + 1, z: z + 0.5, top };
      };
      if (passive < 12 && dl > 0.5) {
        const pos = tryPos(20, 48);
        if (pos && pos.top === B.GRASS) {
          const roll = Math.random();
          const type: MobType = roll < 0.3 ? 'cow' : roll < 0.55 ? 'chicken' : roll < 0.78 ? 'pig' : 'sheep';
          const n = type === 'chicken' ? 1 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 3);
          for (let i = 0; i < n; i++) this.spawnMob(type, pos.x + (Math.random() - 0.5) * 2, pos.y + 0.1, pos.z + (Math.random() - 0.5) * 2);
        }
      }
      if (hostile < 8 && dl < 0.4) {
        const pos = tryPos(18, 40);
        if (pos && IS_SOLID[pos.top] && pos.top !== B.LEAVES) {
          const roll = Math.random();
          const type: MobType = roll < 0.25 ? 'creeper' : roll < 0.6 ? 'zombie' : 'skeleton';
          this.spawnMob(type, pos.x, pos.y + 0.1, pos.z);
        }
      }
      if (hostile < 6) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 14 + Math.random() * 22;
        const x = Math.floor(p.x + Math.cos(ang) * dist);
        const z = Math.floor(p.z + Math.sin(ang) * dist);
        if (this.world.hasChunk(Math.floor(x / CS), Math.floor(z / CS))) {
          for (let y = Math.floor(p.y) + 2; y > 8 && y > p.y - 18; y--) {
            const here = this.world.peekBlock(x, y, z);
            const below = this.world.peekBlock(x, y - 1, z);
            if (here === B.AIR && this.world.peekBlock(x, y + 1, z) === B.AIR && IS_SOLID[below] && below !== B.LEAVES && y < this.world.heightAt(x, z) - 2) {
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
    cam.fov += (targetFov - cam.fov) * Math.min(1, dt * 8);
    cam.updateProjectionMatrix();

    // hand
    const sw = Math.sin(this.swingT * Math.PI);
    this.hand.position.set(bobX - sw * 0.25, -Math.abs(bob) * 0.6 + sw * 0.12, -sw * 0.15);
    this.hand.rotation.set(-sw * 0.9, sw * 0.4, 0);
  }

  private updateSky() {
    const ang = this.time * Math.PI * 2;
    const sunY = Math.sin(ang);
    const dl = this.daylight();
    const dayCol = new THREE.Color(0.47, 0.66, 1.0);
    const nightCol = new THREE.Color(0.012, 0.015, 0.05);
    const sky = nightCol.clone().lerp(dayCol, Math.max(0, Math.min(1, (dl - 0.16) / 0.84)));
    const sunset = Math.max(0, 1 - Math.abs(sunY) * 4) * (Math.cos(ang) > 0 || sunY > -0.2 ? 1 : 0);
    sky.lerp(new THREE.Color(1.0, 0.5, 0.25), sunset * 0.45);
    const biome = this.biomeAt();
    const raining = this.weather === 'rain' && biome !== 'Pustynia';
    if (raining) sky.multiplyScalar(0.62);
    if (this.lightning > 0) sky.lerp(new THREE.Color(0.85, 0.88, 1), Math.min(1, this.lightning));

    const fog = this.scene.fog as THREE.Fog;
    const eyeBlock = this.world.peekBlock(Math.floor(this.camera.position.x), Math.floor(this.camera.position.y), Math.floor(this.camera.position.z));
    if (eyeBlock === B.WATER) {
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

    const lin = Math.pow(dl, 2.2);
    this.uDay.value = lin;
    this.handMat.color.setScalar(Math.max(0.35, lin));
    this.ambient.intensity = 0.3 + dl * 1.0;
    this.dirLight.intensity = Math.max(0, sunY) * 1.2 + 0.1;

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
    });
  }

  private heldHint(): string | null {
    const id = this.selectedStack()?.id;
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
    if (id === I.CLOCK) {
      const hour = (this.time * 24 + 6) % 24;
      const label = hour < 5 || hour >= 20 ? 'noc' : hour < 7 ? 'świt' : hour < 17 ? 'dzień' : 'zmierzch';
      const h = Math.floor(hour);
      const m = Math.floor((hour * 60) % 60);
      return `Zegar: ${label}, ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    return null;
  }

  get recipes() {
    return RECIPES;
  }

  private mobLoot(m: Mob) {
    const x = m.body.pos.x, y = m.body.pos.y + 0.4, z = m.body.pos.z;
    if (m.type === 'pig') this.spawnDrop(I.RAW_PORK, 1, x, y, z);
    else if (m.type === 'cow') this.spawnDrop(I.RAW_BEEF, 1, x, y, z);
    else if (m.type === 'chicken') {
      this.spawnDrop(I.RAW_CHICKEN, 1, x, y, z);
      if (Math.random() < 0.4) this.spawnDrop(I.FEATHER, 1, x, y, z);
    } else if (m.type === 'sheep' && !m.sheared) this.spawnDrop(B.WOOL_WHITE, 1, x, y, z);
    else if (m.type === 'creeper') this.spawnDrop(I.GUNPOWDER, 1, x, y, z);
    else if (m.type === 'spider') this.spawnDrop(I.STRING, 1 + (Math.random() < 0.5 ? 1 : 0), x, y, z);
    else if (m.type === 'skeleton') {
      this.spawnDrop(I.BONE, 1 + (Math.random() < 0.5 ? 1 : 0), x, y, z);
      if (Math.random() < 0.5) this.spawnDrop(I.ARROW, 1 + Math.floor(Math.random() * 3), x, y, z);
      if (Math.random() < 0.08) this.spawnDrop(I.BOW, 1, x, y, z);
    }
    if (m.type === 'zombie') this.unlock('zombie');
    if (m.type === 'creeper') this.unlock('creeper');
    if (m.type === 'spider') this.unlock('string');
    if (m.type === 'skeleton') this.unlock('skeleton');
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
        if (this.inventory.add(d.id, d.count, d.dur)) {
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
      if (id !== B.SAPLING && id !== B.BIRCH_SAPLING && (id < B.CROP0 || id > B.CROP2)) continue;
      const y = (i / (CS * CS)) | 0;
      const rem = i % (CS * CS);
      const z = (rem / CS) | 0;
      const x = rem % CS;
      const key = `${ox + x},${y},${oz + z}`;
      if (!this.growables.has(key)) this.growables.set(key, performance.now());
      const elapsed = (performance.now() - (this.growables.get(key) ?? 0)) / 1000;
      if (id === B.SAPLING || id === B.BIRCH_SAPLING) {
        if (elapsed < 28 + ((x * 5 + z) % 12)) continue;
        const px = this.body.pos.x, pz = this.body.pos.z, py = this.body.pos.y;
        if (Math.abs(px - (ox + x)) < 1.4 && Math.abs(pz - (oz + z)) < 1.4 && py > y - 1 && py < y + 6) continue;
        if (plantTree(this.world, ox + x, y, oz + z, id === B.BIRCH_SAPLING)) {
          this.growables.delete(key);
          this.unlock('tree');
          Sfx.playPlace('grass');
        } else this.growables.set(key, performance.now());
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

  private cropWatered(x: number, y: number, z: number): boolean {
    for (let dx = -4; dx <= 4; dx++)
      for (let dz = -4; dz <= 4; dz++) {
        if (dx * dx + dz * dz > 18) continue;
        if (this.world.peekBlock(x + dx, y, z + dz) === B.WATER || this.world.peekBlock(x + dx, y - 1, z + dz) === B.WATER) return true;
      }
    return false;
  }

  private updateFurnaces(dt: number) {
    for (const [key, f] of this.furnaces) {
      const id = this.world.peekBlock(f.x, f.y, f.z);
      if (id !== B.FURNACE && id !== B.FURNACE_ON) {
        this.furnaces.delete(key);
        continue;
      }
      if (!this.world.hasChunk(Math.floor(f.x / CS), Math.floor(f.z / CS))) continue;
      const before = f.output?.count ?? 0;
      const lit = tickFurnace(f, dt);
      if ((f.output?.count ?? 0) > before && f.output?.id === I.IRON) this.unlock('iron');
      const want = lit ? B.FURNACE_ON : B.FURNACE;
      if (id !== want) this.world.setBlock(f.x, f.y, f.z, want);
    }
  }

  private setWeather(w: 'clear' | 'rain') {
    this.weather = w;
    this.weatherTimer = w === 'rain' ? 45 + Math.random() * 40 : 90 + Math.random() * 80;
    Sfx.setRain(w === 'rain');
    this.message(w === 'rain' ? 'Zaczyna padać.' : 'Niebo się przejaśnia.');
  }

  private updateWeather(dt: number) {
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
    const img = ctx.createImageData(S, S);
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
    for (const c of this.world.chunks.values()) for (const m of c.meshes) m.geometry.dispose();
    for (const m of this.mobs) m.dispose();
    for (const t of this.tnts) (t.mesh.material as THREE.Material).dispose();
    this.tnts = [];
    for (const a of this.arrows) this.scene.remove(a.mesh);
    this.arrows = [];
    for (const d of this.drops) {
      this.scene.remove(d.mesh);
      const mesh = d.mesh as THREE.Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material;
      if (mat && !Array.isArray(mat)) mat.dispose();
    }
    this.drops = [];
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
    this.renderer.dispose();
    // Browsers cap the number of live WebGL contexts – release this one for good.
    try { this.renderer.forceContextLoss(); } catch { /* not supported everywhere */ }
    this.renderer.domElement.remove();
  }
}
