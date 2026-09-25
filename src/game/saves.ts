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

/** Every world as one JSON blob – lets players back up or move their saves. */
export function exportSaves(): string {
  return JSON.stringify({ blockcraft: 1, saves: readList() }, null, 1);
}

/**
 * Merges worlds from a previously exported file. Unknown or broken entries are
 * skipped; ids are kept so re-importing updates instead of duplicating.
 * Returns how many worlds were imported.
 */
export function importSaves(json: string): number {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return 0;
  }
  const raw: unknown = (parsed as { saves?: unknown })?.saves ?? (Array.isArray(parsed) ? parsed : []);
  if (!Array.isArray(raw)) return 0;
  const valid = raw.filter(
    (s): s is StoredWorld => !!s && typeof (s as StoredWorld).seed === 'number' && typeof (s as StoredWorld).id === 'string'
  );
  if (!valid.length) return 0;
  const list = readList();
  for (const s of valid) {
    const i = list.findIndex((w) => w.id === s.id);
    const entry = { ...s, updated: s.updated || Date.now() };
    if (i >= 0) list[i] = entry;
    else list.push(entry);
  }
  writeList(list.slice(0, 8));
  return valid.length;
}
