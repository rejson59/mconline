import { useState } from 'react';
import GameView from './components/GameView';
import { MainMenu } from './components/Menus';
import { SAVE_KEY, type GameMode, type SaveData } from './game/engine';
import type { SaveSummary } from './components/Menus';

interface Session {
  seed: number;
  mode: GameMode;
  save?: SaveData;
  id: number;
}

function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SaveData;
  } catch {
    return null;
  }
}

function summarize(s: SaveData | null): SaveSummary | null {
  if (!s) return null;
  return { mode: s.mode ?? 'survival', day: s.day ?? 1, seed: s.seed };
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
  const [hasSave, setHasSave] = useState(() => !!loadSave());
  const [saveInfo, setSaveInfo] = useState<SaveSummary | null>(() => summarize(loadSave()));
  const [shared, setShared] = useState(() => readSharedWorld());

  if (session) {
    return (
      <GameView
        key={session.id}
        seed={session.seed}
        mode={session.mode}
        save={session.save}
        onQuit={() => {
          setSession(null);
          setTimeout(() => {
            const s = loadSave();
            setHasSave(!!s);
            setSaveInfo(summarize(s));
          }, 50);
        }}
      />
    );
  }

  return (
    <MainMenu
      hasSave={hasSave}
      saveInfo={saveInfo}
      sharedSeed={shared.seed}
      sharedMode={shared.mode}
      onDeleteSave={() => {
        try {
          localStorage.removeItem(SAVE_KEY);
        } catch {
          /* ignore */
        }
        setHasSave(false);
        setSaveInfo(null);
      }}
      onContinue={() => {
        const s = loadSave();
        if (s) setSession({ seed: s.seed, mode: s.mode, save: s, id: Date.now() });
      }}
      onNew={(seed, mode) => {
        localStorage.removeItem(SAVE_KEY);
        try {
          window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
        } catch {
          /* ignore */
        }
        setShared({ seed: null, mode: null });
        setSession({ seed, mode, id: Date.now() });
      }}
    />
  );
}
