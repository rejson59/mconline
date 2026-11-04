import { useEffect, useState } from 'react';
import { cloudState, CLOUD_CHANGED, refreshCloud, resolveCloudConflict } from '../game/accountWorlds';
import { exportSaves, readScopedSaves, saveKey } from '../game/saves';
function recovery(owner: string) { try { return localStorage.getItem(`${saveKey(owner)}:recovery`); } catch { return null; } }
export default function CloudStatus({ onAccount, playing }: { onAccount: () => void; playing: boolean }) {
  const [state, setState] = useState(cloudState);
  useEffect(() => { const changed = () => setState(cloudState()); window.addEventListener(CLOUD_CHANGED, changed); return () => window.removeEventListener(CLOUD_CHANGED, changed); }, []);
  if (playing && (state.phase === 'guest' || state.phase === 'ready')) return null;
  const download = () => {
    const blob = new Blob([exportSaves()], { type: 'application/json' });
    const href = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = href; a.download = 'minecraft-kopia-lokalna.json'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(href), 1000);
  };
  const resolve = async () => {
    if (!state.owner || !window.confirm('Zachować kopię lokalnego postępu i wczytać wersję z chmury? W chmurze niczego nie nadpiszemy. Kopia zostanie pobrana i zachowana na tym urządzeniu.')) return;
    try {
      // Keep a recovery copy even if the browser blocks the file download.
      localStorage.setItem(`${saveKey(state.owner)}:recovery`, JSON.stringify({ blockcraft: 1, saves: readScopedSaves(state.owner) }));
      download(); await resolveCloudConflict();
    } catch { window.alert('Nie można zachować kopii lub wczytać chmury. Nie kontynuuj na innym urządzeniu, dopóki synchronizacja nie zostanie potwierdzona. Wyeksportuj światy z menu.'); }
  };
  return <aside className="fixed left-2 top-2 z-[60] max-w-[min(330px,calc(100vw-16px))] border border-white/20 bg-black/85 p-2 text-xs text-white shadow-lg" aria-label="Zapis i konto">
    <p role="status">{state.message}</p>
    {!playing && <div className="mt-1 flex flex-wrap gap-3">
      <button className="underline" onClick={onAccount}>{state.owner ? 'Konto / światy lokalne' : 'Zaloguj się (opcjonalnie)'}</button>
      {state.owner && <button className="underline" onClick={() => void refreshCloud()}>Ponów / odśwież chmurę</button>}
      {(state.phase === 'error' || state.phase === 'conflict') && state.owner && <button className="underline" onClick={download}>Pobierz kopię lokalną</button>}
      {state.phase === 'conflict' && <button className="underline text-amber-200" onClick={() => void resolve()}>Zachowaj kopię i wczytaj chmurę</button>}
      {state.owner && recovery(state.owner) && <button className="underline" onClick={() => {
        const blob = new Blob([recovery(state.owner!)!], { type: 'application/json' }); const href = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = href; a.download = 'minecraft-kopia-konfliktu.json'; a.click(); setTimeout(() => URL.revokeObjectURL(href), 1000);
      }}>Kopia wcześniejszego konfliktu</button>}
    </div>}
  </aside>;
}
