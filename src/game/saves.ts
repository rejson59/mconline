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
  /** Menu-only metadata is preserved when the engine overwrites the save. */
  favorite?: boolean;
  [key: string]: unknown;
}

export const MAX_SAVES = 8;
export const MAX_WORLD_NAME = 40;

/** Keeps player-provided names readable and safe for the compact world cards. */
export function cleanWorldName(name: string, fallback = 'Świat'): string {
  const clean = name.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.slice(0, MAX_WORLD_NAME) || fallback;
}

// Account libraries never overwrite the pre-4.28 device library. Cloud world IDs
// bind late engine/pagehide saves to their ORIGINAL account even after a switch.
let namespace: string | null = null;
const saveTargets = new Map<string, string | null>();
export function registerSaveTarget(id: string) { saveTargets.set(id, namespace); }
export const SAVES_CHANGED = 'mconline-saves-changed';
export const SAVES_FAILED = 'mconline-saves-failed';
export function saveNamespace() { return namespace; }
export function setSaveNamespace(owner: string | null) { namespace = owner; }
export function saveKey(owner = namespace) { return owner ? `mconline-worlds-20261105:${owner}` : SAVES_KEY; }
export function newSaveId() { return namespace ? `a${namespace}_${crypto.randomUUID()}` : `w${Date.now().toString(36)}`; }
export function readScopedSaves(owner: string | null): StoredWorld[] { return readList(owner); }
export function replaceScopedSaves(owner: string, list: StoredWorld[]) { localStorage.setItem(saveKey(owner), JSON.stringify(list)); }
export interface SaveJournal { revisions: Record<string, number>; dirty: string[]; conflicts: string[] }
export function readSaveJournal(owner: string): SaveJournal {
  try {
    const r = JSON.parse(localStorage.getItem(`${saveKey(owner)}:sync`) || 'null');
    if (r && r.revisions && Array.isArray(r.dirty) && Array.isArray(r.conflicts)) return r;
  } catch { /* first use or damaged metadata: do not upload unknown revisions */ }
  return { revisions: {}, dirty: readList(owner).map(w => w.id), conflicts: [] };
}
export function writeSaveJournal(owner: string, journal: SaveJournal) { localStorage.setItem(`${saveKey(owner)}:sync`, JSON.stringify(journal)); }
function ownerFor(id: string) { return saveTargets.has(id) ? saveTargets.get(id)! : /^a([a-f0-9-]{36})_/.exec(id)?.[1] ?? namespace; }
function readList(owner = namespace): StoredWorld[] {
  try {
    const raw = localStorage.getItem(saveKey(owner));
    if (!raw) return [];
    const list = JSON.parse(raw) as StoredWorld[];
    return Array.isArray(list) ? list.filter((s) => s && typeof s.seed === 'number') : [];
  } catch {
    return [];
  }
}

function writeList(list: StoredWorld[], owner = namespace) {
  try {
  if (owner) {
    // Journal intent BEFORE the payload, including tombstones. A crash, logout
    // or failed last HTTP request cannot turn a dirty recovery copy into clean data.
    const journal = readSaveJournal(owner);
    const before = readList(owner);
    for (const id of new Set([...before.map(w => w.id), ...list.map(w => w.id)])) {
      if (JSON.stringify(before.find(w => w.id === id)) !== JSON.stringify(list.find(w => w.id === id))) journal.dirty = [...new Set([...journal.dirty, id])];
    }
    writeSaveJournal(owner, journal);
  }
  localStorage.setItem(saveKey(owner), JSON.stringify(list));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SAVES_CHANGED, { detail: { owner } }));
  } catch (error) {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SAVES_FAILED, { detail: { owner } }));
    throw error;
  }
}

/** Loads every world and folds the old single-slot save in once. */
export function loadSaves(): StoredWorld[] {
  const list = readList();
  try {
    const legacy = namespace ? null : localStorage.getItem(LEGACY_KEY);
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
  const owner = ownerFor(data.id);
  const current = readList(owner);
  const previous = current.find((s) => s.id === data.id);
  const list = current.filter((s) => s.id !== data.id);
  // `favorite` belongs to the save manager, not the engine's SaveData. Without
  // carrying it over every autosave would silently unpin the world.
  const favorite = data.favorite ?? previous?.favorite;
  list.unshift({ ...data, ...(favorite ? { favorite: true } : {}), name: cleanWorldName(data.name ?? previous?.name ?? 'Świat'), updated: Date.now() });
  writeList(owner ? list : list.slice(0, MAX_SAVES), owner);
}

export function deleteSave(id: string) {
  writeList(readList().filter((s) => s.id !== id));
}

/** Renames a save without loading the (potentially large) world into the game. */
export function renameSave(id: string, name: string): boolean {
  const list = readList();
  const world = list.find((s) => s.id === id);
  if (!world) return false;
  world.name = cleanWorldName(name, world.name || 'Świat');
  writeList(list);
  return true;
}

/** Pins/unpins a world in the menu. The timestamp intentionally stays intact. */
export function toggleFavoriteSave(id: string): boolean | null {
  const list = readList();
  const world = list.find((s) => s.id === id);
  if (!world) return null;
  world.favorite = !world.favorite;
  writeList(list);
  return world.favorite;
}

/**
 * Creates an independent copy of a world. Returns its id, or null when the
 * world does not exist / all slots are occupied.
 */
export function duplicateSave(id: string): string | null {
  const list = readList();
  const source = list.find((s) => s.id === id);
  if (!source || list.length >= MAX_SAVES) return null;
  const now = Date.now();
  let copyId = namespace ? newSaveId() : `w${now.toString(36)}-copy`;
  let suffix = 2;
  while (list.some((s) => s.id === copyId)) copyId = `w${now.toString(36)}-copy${suffix++}`;
  const copy: StoredWorld = {
    ...source,
    id: copyId,
    name: cleanWorldName(`${source.name || 'Świat'} — kopia`),
    updated: now,
    favorite: false,
  };
  writeList([copy, ...list]);
  return copyId;
}

/** Every world as one JSON blob – lets players back up or move their saves. */
export function exportSaves(): string {
  return JSON.stringify({ blockcraft: 1, exportedAt: new Date().toISOString(), saves: readList() }, null, 1);
}

/** One world in the same format accepted by importSaves(). */
export function exportSave(id: string): string | null {
  const world = readList().find((s) => s.id === id);
  return world ? JSON.stringify({ blockcraft: 1, exportedAt: new Date().toISOString(), saves: [world] }, null, 1) : null;
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
  let imported = 0;
  for (const raw of valid) {
    // Importing an old/local/other-account backup is an explicit COPY into this
    // account, never an ownership transfer or a write into the source account.
    const s = namespace && !raw.id.startsWith(`a${namespace}_`) ? { ...raw, id: newSaveId() } : raw;
    const i = list.findIndex((w) => w.id === s.id);
    // 2.3: import nie może wstrzyknąć dziwnej nazwy – czyscimy ją tak samo,
    // jak nazwę wpisaną ręcznie (sterowniki, długość, spacje).
    const entry = { ...s, name: cleanWorldName(s.name ?? 'Świat'), updated: s.updated || Date.now() };
    if (i >= 0) { list[i] = entry; imported++; }
    else if (!namespace || list.length < MAX_SAVES) { list.push(entry); imported++; }
  }
  // Keep the newest saves when an import would exceed the browser slot limit.
  list.sort((a, b) => (b.updated || 0) - (a.updated || 0));
  writeList(namespace ? list : list.slice(0, MAX_SAVES));
  // Report all valid records seen in the file; storage still enforces MAX_SAVES.
  return namespace ? imported : valid.length;
}
