/** Multi-slot worlds. Does not import the engine, so Game.save() can call it safely. */

export const SAVES_KEY = 'blockcraft-saves-v2';
export const LEGACY_KEY = 'blockcraft-save-v1';

export interface StoredWorld {
  id: string;
  name?: string;
  seed: number;
  mode?: string;
  day?: number;
  updated?: number;
  [key: string]: unknown;
}

function readList(): StoredWorld[] {
  try {
    const raw = localStorage.getItem(SAVES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as StoredWorld[];
    return Array.isArray(list) ? list.filter((s) => s && typeof s.seed === 'number') : [];
  } catch {
    return [];
  }
}

function writeList(list: StoredWorld[]) {
  localStorage.setItem(SAVES_KEY, JSON.stringify(list));
}

/** Loads every world and folds the old single-slot save in once. */
export function loadSaves(): StoredWorld[] {
  const list = readList();
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy) as StoredWorld;
      if (old && typeof old.seed === 'number' && !list.some((s) => s.id === 'legacy')) {
        list.push({
          ...old,
          id: 'legacy',
          name: old.name || 'Zapis z poprzedniej wersji',
          updated: old.updated || Date.now(),
        });
        writeList(list);
      }
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch {
    /* ignore a broken legacy blob */
  }
  return list.sort((a, b) => (b.updated || 0) - (a.updated || 0));
}

export function upsertSave(data: StoredWorld) {
  const list = readList().filter((s) => s.id !== data.id);
  list.unshift({ ...data, updated: Date.now() });
  writeList(list.slice(0, 8));
}

export function deleteSave(id: string) {
  writeList(readList().filter((s) => s.id !== id));
}
