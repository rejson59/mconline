import { useState } from 'react';
import GameView from './components/GameView';
import { MainMenu, type WorldCard, type WorldType } from './components/Menus';
import { type GameMode, type SaveData } from './game/engine';
import { deleteSave, loadSaves } from './game/saves';

interface Session {
  seed: number;
  mode: GameMode;
  save?: SaveData;
  id: number;
  worldId: string;
  worldName: string;
  worldType: WorldType;
}

function asSave(raw: ReturnType<typeof loadSaves>[number]): SaveData {
  return raw as unknown as SaveData;
}

function cards(): WorldCard[] {
  return loadSaves().map((s) => ({
    id: s.id,
    name: s.name,
    seed: s.seed,
    mode: s.mode,
    day: s.day,
    worldType: s.worldType === 'flat' ? 'flat' : 'normal',
  }));
}

/** Seed + mode can be shared through the URL hash, e.g. #seed=1234&mode=creative */
function readSharedWorld(): { seed: number | null; mode: GameMode | null } {
  try {
    const p = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const rawSeed = p.get('seed');
    const rawMode = p.get('mode');
    const seed = rawSeed && /^-?\d+$/.test(rawSeed) ? Math.abs(parseInt(rawSeed, 10) | 0) : null;
    const mode: GameMode | null = rawMode === 'creative' || rawMode === 'survival' ? rawMode : null;
    return { seed, mode };
  } catch {
    return { seed: null, mode: null };
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [saves, setSaves] = useState<WorldCard[]>(cards);
  const [shared, setShared] = useState(readSharedWorld);

  const refresh = () => setSaves(cards());

  if (session) {
    return (
      <GameView
        key={session.id}
        seed={session.seed}
        mode={session.mode}
        save={session.save}
        worldId={session.worldId}
        worldName={session.worldName}
        worldType={session.worldType}
        onQuit={() => {
          setSession(null);
          setTimeout(refresh, 50);
        }}
      />
    );
  }

  return (
    <MainMenu
      saves={saves}
      sharedSeed={shared.seed}
      sharedMode={shared.mode}
      onDelete={(id) => {
        deleteSave(id);
        refresh();
      }}
      onImported={refresh}
      onPlay={(id) => {
        const s = loadSaves().find((w) => w.id === id);
        if (!s) return;
        const save = asSave(s);
        setSession({
          seed: save.seed,
          mode: save.mode ?? 'survival',
          save,
          id: Date.now(),
          worldId: save.id || id,
          worldName: save.name || 'Świat',
          worldType: save.worldType === 'flat' ? 'flat' : 'normal',
        });
      }}
      onNew={(seed, mode, name, worldType) => {
        if (saves.length >= 8) {
          window.alert('Możesz mieć najwyżej 8 światów. Usuń jeden, żeby utworzyć nowy.');
          return;
        }
        try {
          window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
        } catch {
          /* ignore */
        }
        setShared({ seed: null, mode: null });
        setSession({ seed, mode, id: Date.now(), worldId: 'w' + Date.now().toString(36), worldName: name, worldType });
      }}
    />
  );
}
