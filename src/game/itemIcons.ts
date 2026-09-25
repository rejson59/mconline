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
    } else {
      // ingot
      for (let y = 6; y <= 10; y++) for (let x = 3; x <= 12; x++) set(x, y, x === 3 || y === 10 ? '#555' : c);
      set(5, 7, '#fff');
      set(6, 7, '#fff');
    }
  });
}

export function buildItemIcons(): Record<number, string> {
  const icons: Record<number, string> = {};
  for (const it of ITEM_LIST) {
    icons[it.id] = it.kind === 'tool' ? toolIcon(it) : it.kind === 'food' ? foodIcon(it) : materialIcon(it);
  }
  return icons;
}
