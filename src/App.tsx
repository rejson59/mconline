import { useState } from 'react';
import GameView from './components/GameView';
import { MainMenu } from './components/Menus';
import { SAVE_KEY, type GameMode, type SaveData } from './game/engine';

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

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [hasSave, setHasSave] = useState(() => !!loadSave());

  if (session) {
    return (
      <GameView
        key={session.id}
        seed={session.seed}
        mode={session.mode}
        save={session.save}
        onQuit={() => {
          setSession(null);
          setTimeout(() => setHasSave(!!loadSave()), 50);
        }}
      />
    );
  }

  return (
    <MainMenu
      hasSave={hasSave}
      onContinue={() => {
        const s = loadSave();
        if (s) setSession({ seed: s.seed, mode: s.mode, save: s, id: Date.now() });
      }}
      onNew={(seed, mode) => {
        localStorage.removeItem(SAVE_KEY);
        setSession({ seed, mode, id: Date.now() });
      }}
    />
  );
}
