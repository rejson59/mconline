import * as THREE from 'three';
import { World, CS, CH, SEA, type Biome } from './world';
import { B, BLOCKS, IS_SOLID, RENDER, tileFor, BLOCK_COUNT } from './blocks';
import { getAtlas, tileUV, AVG_COLOR } from './textures';
import { stepBody, aabbIntersectsBlock, type Body } from './physics';
import { Mob, type MobType } from './mobs';
import { Inventory, RECIPES, type Stack } from './inventory';
import * as Sfx from './audio';

export type GameMode = 'survival' | 'creative';
export type UIState = 'playing' | 'paused' | 'inventory' | 'chat' | 'dead';

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
    opts: { seed: number; mode: GameMode; save?: SaveData; renderDistance?: number },
    cb: { onHud: (h: HUDState) => void; onUI: (s: UIState) => void }
  ) {
    this.container = container;
    this.onHud = cb.onHud;
    this.onUI = cb.onUI;
    this.mode = opts.save ? opts.save.mode : opts.mode;
    this.renderDistance = opts.renderDistance ?? 6;
    const seed = opts.save ? opts.save.seed : opts.seed;
    this.world = new World(seed);
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
    this.icons = atlas.icons;
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

    this.computeOffsets();

    // Player setup
    if (opts.save) {
      this.body.pos.set(...opts.save.pos);
      this.yaw = opts.save.yaw;
      this.pitch = opts.save.pitch;
      this.time = opts.save.time;
      this.health = opts.save.health > 0 ? opts.save.health : 20;
      this.day = opts.save.day || 1;
      opts.save.inv.forEach((s, i) => (this.inventory.slots[i] = s ? { ...s } : null));
      this.findSpawn();
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
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
    this.message('Witaj w BlockCraft! Naciśnij T aby otworzyć czat, /help po komendy.');
  }

  giveStarterItems() {
    const inv = this.inventory;
    if (this.mode === 'creative') {
      const hot = [B.GRASS, B.STONE, B.PLANKS, B.LOG, B.GLASS, B.BRICK, B.TNT, B.GLOWSTONE, B.WATER];
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
    if (this.ui === 'inventory') {
      if (e.code === 'KeyE' || e.code === 'Escape') {
        e.preventDefault();
        this.closeInventory();
      }
      return;
    }
    if (this.ui !== 'playing' || !this.locked) return;
    if (e.code === 'F3') { e.preventDefault(); this.debug = !this.debug; this.emitHud(); return; }
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
    this.onUI(s);
  }

  openInventory(table: boolean) {
    this.craftingTable = table;
    this.setUI('inventory');
  }
  closeInventory() {
    this.inventory.returnCursor();
    this.setUI('playing');
    this.emitHud();
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
        this.message('Komendy: /gamemode <survival|creative>, /time set <day|night|noon|midnight>, /tp x y z, /give <id> [ilość], /summon <pig|sheep|zombie>, /kill, /seed, /spawn, /clear, /blocks');
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
        const id = parseInt(args[0]);
        const n = parseInt(args[1] || '64');
        if (isNaN(id) || id <= 0 || id >= BLOCK_COUNT) { this.message('Nieprawidłowe ID. Użyj /blocks aby zobaczyć listę.'); break; }
        this.inventory.add(id, n);
        this.message(`Otrzymano ${n}x ${BLOCKS[id].name}`);
        break;
      }
      case 'blocks':
        this.message(BLOCKS.filter((b) => b && b.id > 0).map((b) => `${b.id}:${b.name}`).join(', '));
        break;
      case 'summon': {
        const t = (args[0] || 'pig') as MobType;
        if (!['pig', 'sheep', 'zombie'].includes(t)) { this.message('Moby: pig, sheep, zombie'); break; }
        const d = this.lookDir();
        this.spawnMob(t, this.body.pos.x + d.x * 3, this.body.pos.y + 1, this.body.pos.z + d.z * 3);
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
        seed: this.world.seed,
        mode: this.mode,
        mods: this.world.serializeMods(),
        pos: [this.body.pos.x, this.body.pos.y, this.body.pos.z],
        yaw: this.yaw,
        pitch: this.pitch,
        inv: this.inventory.slots,
        time: this.time,
        health: this.health,
        day: this.day,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
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
    }
    let mesh: THREE.Mesh;
    if (id < 0) {
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
      this.attackCooldown = 0.35;
      const dmg = this.sprinting ? 6 : 4;
      if (mob.damage(dmg, this.body.pos.x, this.body.pos.z)) {
        Sfx.playHurt();
        Sfx.playMob(mob.type);
      }
      this.mouseLeft = false;
      return;
    }
    if (this.target && this.target.id === B.TNT) {
      this.igniteTNT(this.target.x, this.target.y, this.target.z, 4);
      this.mouseLeft = false;
      return;
    }
    if (this.mode === 'creative' && this.target) {
      this.breakBlock(this.target.x, this.target.y, this.target.z);
      this.breakCooldown = 0.25;
    }
  }

  tryUse() {
    const t = this.target;
    this.placeCooldown = 0.22;
    if (!t) return;
    if (t.id === B.CRAFTING && !this.keys.has('ShiftLeft')) {
      this.openInventory(true);
      return;
    }
    const s = this.selectedStack();
    if (!s) return;
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
      // fluids always need a solid neighbour, otherwise they look detached
      const below = this.world.getBlock(px, py - 1, pz);
      const around = [this.world.getBlock(px + 1, py, pz), this.world.getBlock(px - 1, py, pz), this.world.getBlock(px, py, pz + 1), this.world.getBlock(px, py, pz - 1)];
      if (!IS_SOLID[below] && !around.some((n) => IS_SOLID[n])) return;
    }
    // plants need ground
    if (RENDER[id] === 1) {
      const below = this.world.getBlock(px, py - 1, pz);
      if (below !== B.GRASS && below !== B.DIRT && below !== B.SNOW) return;
    }
    this.world.setBlock(px, py, pz, id);
    this.settle(px, py, pz);
    Sfx.playPlace(BLOCKS[id].sound);
    this.swingT = 0;
    if (this.mode === 'survival') {
      s.count--;
      if (s.count <= 0) this.inventory.slots[this.selected] = null;
      this.emitHud();
    }
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
    if (this.mode === 'survival') {
      s.count--;
      if (s.count <= 0) this.inventory.slots[this.selected] = null;
    } else {
      this.inventory.slots[this.selected] = null;
    }
    const e = this.eyePos();
    const d = this.lookDir();
    this.spawnParticles(e.x + d.x, e.y + d.y - 0.2, e.z + d.z, s.id, 6, 0.1);
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
    this.world.setBlock(x, y, z, fill);
    if (!silent) {
      this.spawnParticles(x + 0.5, y + 0.5, z + 0.5, id, 14, 0.35);
      Sfx.playBreak(def.sound);
    }
    if (this.mode === 'survival' && def.drop >= 0 && !silent) {
      if (this.inventory.add(def.drop, 1)) Sfx.playPop();
      this.emitHud();
    }
    // things above that need support
    const above = this.world.getBlock(x, y + 1, z);
    if (RENDER[above] === 1 || above === B.CACTUS) this.breakBlock(x, y + 1, z, silent);
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
      this.message('Gracz zginął.');
      this.inventory.slots.fill(null);
      this.setUI('dead');
    }
    this.emitHud();
  }

  respawn() {
    this.health = 20;
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

    const active = this.ui === 'playing' || this.ui === 'inventory' || this.ui === 'chat' || this.ui === 'dead';
    if (active) {
      const sub = dt > 0.05 ? 2 : 1;
      for (let i = 0; i < sub; i++) this.updatePlayer(dt / sub);
      this.updateInteraction(dt);
      this.updateMobs(dt);
      this.updateEntities(dt);
      this.time = (this.time + dt / 600) % 1;
      if (this.time < dt / 600) this.day++;
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

    let speed = this.flying ? (this.sprinting ? 22 : 11) : sneaking ? 1.3 : this.sprinting ? 5.6 : 4.3;
    if (inWater && !this.flying) speed *= 0.55;
    if (inLava && !this.flying) speed *= 0.35;

    const len = Math.hypot(fx, fz) || 1;
    fx /= len; fz /= len;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wx = fx * cos + fz * sin;
    const wz = -fx * sin + fz * cos;
    const tx = wx * speed, tz = wz * speed;
    const accel = this.flying ? 8 : b.onGround ? 14 : inWater ? 6 : 2.5;
    const hasInput = fx !== 0 || fz !== 0;
    const a = Math.min(1, accel * dt * (hasInput || b.onGround || this.flying ? 1 : 0.3));
    b.vel.x += (tx - b.vel.x) * a;
    b.vel.z += (tz - b.vel.z) * a;

    const jump = playing && k.has('Space');
    if (this.flying) {
      const ty = jump ? 9 : playing && k.has('ShiftLeft') ? -9 : 0;
      b.vel.y += (ty - b.vel.y) * Math.min(1, dt * 10);
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
    // regen
    if (this.health < 20 && this.health > 0 && performance.now() - this.lastHurt > 4000) {
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
        if (key !== this.breakKey) { this.breakKey = key; this.breakProgress = 0; }
        const def = BLOCKS[t.id];
        if (def.hardness >= 0) {
          const time = def.hardness * 0.75 + 0.05;
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
            this.breakBlock(t.x, t.y, t.z);
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
      const passive = this.mobs.filter((m) => m.type !== 'zombie').length;
      const hostile = this.mobs.length - passive;
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
      if (passive < 10 && dl > 0.5) {
        const pos = tryPos(20, 48);
        if (pos && pos.top === B.GRASS) {
          const type: MobType = Math.random() < 0.5 ? 'pig' : 'sheep';
          const n = 1 + Math.floor(Math.random() * 3);
          for (let i = 0; i < n; i++) this.spawnMob(type, pos.x + (Math.random() - 0.5) * 2, pos.y + 0.1, pos.z + (Math.random() - 0.5) * 2);
        }
      }
      if (hostile < 8 && dl < 0.4) {
        const pos = tryPos(18, 40);
        if (pos && IS_SOLID[pos.top] && pos.top !== B.LEAVES) this.spawnMob('zombie', pos.x, pos.y + 0.1, pos.z);
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
      fog.near = this.renderDistance * CS * 0.45;
      fog.far = this.renderDistance * CS * 0.95;
      this.scene.background = sky;
    }

    const lin = Math.pow(dl, 2.2);
    for (const m of this.materials) (m as THREE.MeshBasicMaterial).color.setScalar(lin);
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
    (this.clouds.material as THREE.MeshBasicMaterial).color.setScalar(Math.max(0.15, dl));
  }

  emitHud() {
    const p = this.body.pos;
    const f = ((Math.round(this.yaw / (Math.PI / 2)) % 4) + 4) % 4;
    const now = performance.now();
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
      biome: this.world.surface(Math.floor(p.x), Math.floor(p.z)).biome,
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
    });
  }

  get recipes() {
    return RECIPES;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    for (const [t, type, fn, opts] of this.listeners) t.removeEventListener(type, fn, opts);
    if (document.pointerLockElement) document.exitPointerLock();
    for (const c of this.world.chunks.values()) for (const m of c.meshes) m.geometry.dispose();
    for (const m of this.mobs) m.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
