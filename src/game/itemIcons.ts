import { ITEM_LIST, type ItemDef } from './items';

function paint(draw: (set: (x: number, y: number, color: string) => void) => void): string {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  const set = (x: number, y: number, color: string) => {
    if (x < 0 || y < 0 || x > 15 || y > 15) return;
    ctx.fillStyle = color;
    ctx.fillRect(x | 0, y | 0, 1, 1);
  };
  draw(set);
  const out = document.createElement('canvas');
  out.width = 48;
  out.height = 48;
  const o = out.getContext('2d');
  if (!o) return c.toDataURL();
  o.imageSmoothingEnabled = false;
  o.drawImage(c, 0, 0, 48, 48);
  return out.toDataURL();
}

const HANDLE = '#8a5a2b';
const HANDLE_DK = '#5c3b1c';

function handle(set: (x: number, y: number, color: string) => void) {
  for (let i = 0; i < 9; i++) {
    set(5 + i, 13 - i, i % 3 === 0 ? HANDLE_DK : HANDLE);
    set(6 + i, 13 - i, HANDLE_DK);
  }
}

function toolIcon(it: ItemDef): string {
  const head = it.color;
  const edge = '#222';
  return paint((set) => {
    handle(set);
    const k = it.tool;
    if (k === 'pick') {
      for (let x = 2; x <= 12; x++) set(x, 3, head);
      set(2, 4, head);
      set(12, 4, head);
      set(3, 4, edge);
      set(11, 4, edge);
      set(7, 4, head);
    } else if (k === 'axe') {
      for (let y = 1; y <= 6; y++) {
        set(3, y, head);
        set(4, y, head);
        set(2, y, y === 1 || y === 6 ? edge : head);
      }
      set(5, 2, head);
      set(5, 5, head);
    } else if (k === 'shovel') {
      for (let y = 1; y <= 5; y++) for (let x = 5; x <= 8; x++) set(x, y, y === 1 || x === 5 ? edge : head);
      set(6, 2, head);
      set(7, 2, '#fff');
    } else if (k === 'sword') {
      for (let i = 0; i < 10; i++) {
        set(11 - i, 1 + i, head);
        set(12 - i, 1 + i, edge);
      }
      set(6, 8, '#ddd');
      set(5, 9, '#ddd');
    } else if (k === 'shears') {
      for (let i = 0; i < 8; i++) { set(3 + i, 3 + i, head); set(4 + i, 3 + i, edge); }
      for (let i = 0; i < 8; i++) { set(12 - i, 3 + i, head); set(11 - i, 3 + i, edge); }
      set(7, 8, '#c44848');
      set(8, 8, '#c44848');
    } else if (k === 'igniter') {
      for (let i = 0; i < 8; i++) set(4 + i, 10 - i, i % 2 ? HANDLE_DK : HANDLE);
      for (let y = 2; y <= 6; y++) { set(10, y, '#9a9aa2'); set(11, y, head); }
      set(11, 2, '#f0f0f4');
    } else if (k === 'bow') {
      // wooden arc with a taut string
      for (let a = 0; a <= 12; a++) {
        const t = (a / 12) * Math.PI;
        const x = Math.round(4 + Math.sin(t) * 7);
        const y = Math.round(2 + (1 - Math.cos(t)) * 5.5);
        set(x, y, head);
        set(x, y + 1, edge);
      }
      for (let y = 3; y <= 13; y++) set(4, y, '#e8e8ea');
      set(10, 8, head);
    } else if (k === 'shield') {
      // wooden shield with an iron boss
      for (let y = 2; y <= 12; y++) {
        const half = y < 7 ? 4 : y < 10 ? 3 : 2;
        for (let x = 8 - half; x <= 8 + half; x++) {
          if (y === 12 && Math.abs(x - 8) > 1) continue;
          set(x, y, head);
        }
      }
      for (let y = 3; y <= 11; y++) set(5, y, '#5c3b1c');
      for (let y = 4; y <= 7; y++) set(9, y, '#c8c8d0');
      set(9, 5, '#f0f0f4');
      set(10, 6, '#9a9aa2');
    } else {
      // hoe
      for (let x = 3; x <= 10; x++) set(x, 2, head);
      set(3, 3, head);
      set(4, 3, edge);
      set(9, 3, head);
    }
  });
}

function foodIcon(it: ItemDef): string {
  return paint((set) => {
    const c = it.color;
    if (it.id === 108) {
      // apple
      for (let y = 4; y <= 13; y++) for (let x = 4; x <= 12; x++) {
        const dx = x - 8, dy = y - 8;
        if (dx * dx + dy * dy < 18) set(x, y, c);
      }
      set(8, 3, '#6a3a1a');
      set(9, 2, '#3e8a32');
      set(10, 2, '#3e8a32');
      set(6, 6, '#ffb0a8');
    } else if (it.id === 109) {
      for (let y = 5; y <= 11; y++) for (let x = 3; x <= 12; x++) set(x, y, y === 5 || y === 11 ? '#a87438' : c);
      set(6, 7, '#f0d0a0');
      set(9, 8, '#f0d0a0');
    } else {
      for (let y = 4; y <= 12; y++) for (let x = 4; x <= 11; x++) {
        if ((x + y) % 5 === 0) set(x, y, '#fff');
        else set(x, y, c);
      }
      set(5, 5, '#fff');
    }
  });
}

function materialIcon(it: ItemDef): string {
  return paint((set) => {
    const c = it.color;
    if (it.keys.includes('stick')) {
      for (let i = 0; i < 12; i++) set(3 + (i >> 1), 2 + i, i % 2 ? HANDLE_DK : HANDLE);
    } else if (it.keys.includes('coal')) {
      const pts = [[5, 4], [6, 4], [7, 5], [4, 6], [5, 6], [6, 6], [8, 6], [5, 7], [6, 8], [7, 8], [9, 7], [4, 8], [8, 9], [6, 10]];
      for (const [x, y] of pts) set(x, y, c);
      set(6, 5, '#555');
    } else if (it.keys.includes('diamond')) {
      const gem = [[8, 2], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [11, 6], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [7, 10], [8, 10], [9, 10], [8, 12]];
      for (const [x, y] of gem) set(x, y, c);
      set(7, 5, '#eaffff');
      set(8, 7, '#eaffff');
    } else if (it.keys.includes('seeds')) {
      for (const [x, y] of [[5, 6], [6, 7], [8, 5], [9, 8], [7, 10], [10, 6], [4, 9]]) set(x, y, c);
      set(6, 6, '#d8c45a');
      set(9, 7, '#d8c45a');
    } else if (it.keys.includes('wheat')) {
      for (let i = 0; i < 8; i++) {
        set(7, 4 + i, '#c6a04a');
        set(6, 3 + (i % 5), c);
        set(8, 4 + (i % 4), c);
      }
      set(5, 3, c);
      set(9, 3, c);
    } else if (it.kind === 'bucket' || it.keys[0].startsWith('wiadro')) {
      for (let y = 4; y <= 12; y++) {
        set(4, y, '#9a9aa0');
        set(11, y, '#9a9aa0');
      }
      for (let x = 4; x <= 11; x++) set(x, 12, '#9a9aa0');
      set(5, 3, '#777');
      set(10, 3, '#777');
      if (it.keys.includes('water_bucket')) for (let y = 6; y <= 11; y++) for (let x = 5; x <= 10; x++) set(x, y, '#3a6ad4');
      if (it.keys.includes('lava_bucket')) for (let y = 6; y <= 11; y++) for (let x = 5; x <= 10; x++) set(x, y, y < 8 ? '#ffb040' : '#e05010');
    } else if (it.keys.includes('leather')) {
      // hide: rounded brown patch with darker stitches
      for (let y = 4; y <= 11; y++) for (let x = 4; x <= 11; x++) {
        const dx = x - 7.5, dy = y - 7.5;
        if (dx * dx + dy * dy < 16) set(x, y, c);
      }
      for (const [x, y] of [[5, 5], [10, 5], [5, 10], [10, 10], [7, 6], [9, 9]]) set(x, y, '#5c3b1c');
      set(7, 8, '#f0d8b0');
    } else if (it.keys.includes('gunpowder')) {
      for (let i = 0; i < 28; i++) set(4 + (i * 3) % 8, 4 + (i * 5) % 8, i % 4 === 0 ? '#aaa' : c);
    } else if (it.keys.includes('flint')) {
      for (const [x, y] of [[6, 3], [7, 4], [5, 5], [6, 5], [7, 5], [8, 6], [5, 7], [6, 7], [7, 8], [8, 9], [6, 10]]) set(x, y, c);
      set(7, 6, '#aaa');
    } else if (it.keys.includes('compass')) {
      for (let a = 0; a < 12; a++) {
        const t = (a / 12) * Math.PI * 2;
        set(8 + Math.round(Math.cos(t) * 5), 8 + Math.round(Math.sin(t) * 5), '#888');
      }
      for (let y = 3; y <= 8; y++) set(8, y, '#e24a4a');
      for (let y = 8; y <= 12; y++) set(8, y, '#eee');
      set(8, 8, '#222');
    } else if (it.keys.includes('clock')) {
      for (let a = 0; a < 12; a++) {
        const t = (a / 12) * Math.PI * 2;
        set(8 + Math.round(Math.cos(t) * 5), 8 + Math.round(Math.sin(t) * 5), c);
      }
      set(8, 4, '#fff');
      set(8, 5, '#fff');
      set(8, 6, '#fff');
      set(9, 8, '#fff');
      set(10, 8, '#fff');
      set(8, 8, '#5a3a10');
    } else if (it.keys.includes('struna')) {
      for (let i = 0; i < 10; i++) { set(3 + i, 3 + (i >> 1), c); set(3 + i, 4 + (i >> 1), '#b9b9bd'); }
      for (let i = 0; i < 6; i++) { set(4 + i, 9 + (i >> 1), c); set(4 + i, 10 + (i >> 1), '#b9b9bd'); }
    } else if (it.keys.includes('kosc')) {
      for (let y = 5; y <= 10; y++) { set(7, y, c); set(8, y, '#ddd6c2'); }
      for (const [x, y] of [[6, 3], [7, 3], [8, 3], [9, 3], [6, 4], [9, 4]]) set(x, y, c);
      for (const [x, y] of [[6, 11], [7, 11], [8, 11], [9, 11], [6, 12], [9, 12]]) set(x, y, c);
      set(7, 7, '#fff');
    } else if (it.keys.includes('pioro')) {
      for (let i = 0; i < 9; i++) { set(4 + i, 12 - i, '#8a7a5a'); set(5 + i, 12 - i, '#6a5c44'); }
      for (let i = 0; i < 7; i++) for (let j = 0; j <= i; j++) set(4 + i - j, 3 + j, i % 2 ? c : '#ffffff');
    } else if (it.keys.includes('strzala')) {
      for (let i = 0; i < 9; i++) { set(4 + i, 11 - i, '#8a6a3a'); set(5 + i, 11 - i, '#6a4e28'); }
      for (const [x, y] of [[11, 4], [12, 3], [13, 2], [10, 5], [9, 6]]) set(x, y, '#4a4a52');
      for (let i = 0; i < 4; i++) { set(4 + i, 11 - i, '#e8e8ea'); set(3 + i, 12 - i, '#c8c8cc'); }
    } else {
      // ingot
      for (let y = 6; y <= 10; y++) for (let x = 3; x <= 12; x++) set(x, y, x === 3 || y === 10 ? '#555' : c);
      set(5, 7, '#fff');
      set(6, 7, '#fff');
    }
  });
}

/** Armor pieces share a painter; the slot picks the silhouette. */
function armorIcon(it: ItemDef): string {
  const c = it.color;
  const dk = shade(c, -34);
  const lite = shade(c, 46);
  const slot = it.armor?.slot ?? 0;
  return paint((set) => {
    if (slot === 0) {
      // helmet: dome with a brim
      for (let y = 2; y <= 9; y++) for (let x = 3; x <= 12; x++) {
        const dx = x - 7.5, dy = y - 3.5;
        if (dx * dx + dy * dy * 1.25 < 17 && (y > 4 || Math.abs(dx) < 3)) set(x, y, c);
      }
      for (let x = 2; x <= 13; x++) set(x, 9, dk);
      for (let y = 5; y <= 8; y++) set(4, y, dk);
      set(6, 4, lite);
      set(7, 3, lite);
    } else if (slot === 1) {
      // chestplate: two shoulders, V-collar, torso
      for (let y = 3; y <= 13; y++) for (let x = 4; x <= 11; x++) {
        if (y >= 12 && Math.abs(x - 7.5) > 2.5) continue;
        set(x, y, y >= 3 && y <= 4 && (x < 5 || x > 10) ? dk : c);
      }
      for (let y = 4; y <= 7; y++) set(8, y, dk);
      for (let y = 6; y <= 9; y++) set(7, y, dk);
      set(5, 4, lite);
      set(10, 4, lite);
    } else if (slot === 2) {
      // leggings: waistband and two legs
      for (let x = 4; x <= 11; x++) { set(x, 3, c); set(x, 4, c); }
      for (let y = 5; y <= 13; y++) {
        for (let x = 4; x <= 7; x++) set(x, y, c);
        for (let x = 9; x <= 12; x++) set(x, y, c);
      }
      for (let x = 4; x <= 11; x++) set(x, 4, dk);
      set(5, 6, lite);
      set(10, 6, lite);
      for (let y = 5; y <= 13; y++) { set(3, y, dk); set(12, y, dk); }
    } else {
      // boots: two feet pointing out
      for (let y = 5; y <= 11; y++) for (let x = 3; x <= 6; x++) set(x, y, c);
      for (let y = 5; y <= 11; y++) for (let x = 9; x <= 12; x++) set(x, y, c);
      for (let x = 2; x <= 6; x++) { set(x, 12, c); set(x, 13, c); }
      for (let x = 9; x <= 13; x++) { set(x, 12, c); set(x, 13, c); }
      for (let y = 5; y <= 11; y++) { set(6, y, dk); set(9, y, dk); }
      for (let x = 3; x <= 6; x++) set(x, 5, dk);
      for (let x = 9; x <= 12; x++) set(x, 5, dk);
      set(4, 7, lite);
      set(11, 7, lite);
    }
  });
}

/** Darkens/lightens a #rrggbb colour by a fixed amount (negative = darker). */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, v + amt));
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function buildItemIcons(): Record<number, string> {
  const icons: Record<number, string> = {};
  for (const it of ITEM_LIST) {
    if (it.kind === 'armor') icons[it.id] = armorIcon(it);
    else if (it.kind === 'tool') icons[it.id] = toolIcon(it);
    else if (it.kind === 'food') icons[it.id] = foodIcon(it);
    else icons[it.id] = materialIcon(it);
  }
  return icons;
}
