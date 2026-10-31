import { useCallback, useEffect, useState } from 'react';
import GameView from './components/GameView';
import { MainMenu, type WorldCard, type WorldType } from './components/Menus';
import Launcher from './components/Launcher';
import { type GameMode, type SaveData } from './game/engine';
import MultiplayerScreen, { type NetStart } from './components/MultiplayerScreen';
import OrientationGuard from './components/OrientationGuard';
import CommunityAccount from './components/CommunityAccount';
import type { NetLike } from './game/net';
import { deleteSave, duplicateSave, loadSaves, MAX_SAVES, renameSave, toggleFavoriteSave } from './game/saves';
import { onViewportChange } from './utils/viewport';
import { watchLandscape } from './utils/screen';

interface Session {
  seed: number;
  mode: GameMode;
  save?: SaveData;
  id: number;
  worldId: string;
  worldName: string;
  worldType: WorldType;
  /** 2.10: sesja sieciowa (null/brak = gra jednoosobowa). */
  net?: NetLike;
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
    updated: s.updated,
    favorite: s.favorite,
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
  // 2.15: powłoka trzyma się zmierzonego widocznego ekranu (pełny ekran,
  // obrót, pasek adresu). Bez tego po fullscreenie `#root` potrafił być
  // wyższy niż ekran i ucinać dolne przyciski oraz panele.
  useEffect(() => {
    const offViewport = onViewportChange(() => {});
    // 2.15: wyjście z pełnego ekranu (Esc, gest systemowy) zawsze zwalnia
    // blokadę orientacji – nawet gdy ekran gry z nią nie jest otwarty.
    const offFullscreen = watchLandscape();
    return () => {
      offViewport();
      offFullscreen();
    };
  }, []);

  const [session, setSession] = useState<Session | null>(null);
  const [saves, setSaves] = useState<WorldCard[]>(cards);
  const [shared, setShared] = useState(readSharedWorld);
  const [multiplayer, setMultiplayer] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const closeAccount = useCallback(() => setAccountOpen(false), []);
  // 2.24.1: pierwszym ekranem znów jest klasyczne menu gry. Launcher został
  // w projekcie, ale domyślnie się nie pokazuje – wchodzi się do niego tylko
  // pod adresem #launcher (i wychodzi „Klasycznym menu”).
  const [screen, setScreen] = useState<'launcher' | 'menu'>(() => {
    try {
      const hash = window.location.hash.replace(/^#/, '');
      return hash === 'launcher' || hash === 'client' ? 'launcher' : 'menu';
    } catch {
      return 'menu';
    }
  });

  // Zamknięcie launchera przywraca adres bez hasha, żeby odświeżenie strony
  // nie wrzucało gracza z powrotem do klienta.
  const leaveLauncher = () => {
    setScreen('menu');
    try {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    } catch {
      /* ignore */
    }
  };

  const startMultiplayer = (s: NetStart) => {
    setMultiplayer(false);
    try {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    } catch {
      /* ignore */
    }
    setSession({
      seed: s.seed,
      mode: s.mode,
      id: Date.now(),
      worldId: 'mp' + Date.now().toString(36),
      worldName: s.worldName,
      worldType: s.worldType,
      net: s.net,
    });
  };

  const refresh = () => setSaves(cards());

  /** 2.24: wspólne wejście do świata dla launchera i klasycznego menu. */
  const playWorld = (id: string) => {
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
  };

  /** 2.24: nowy świat z launchera albo z klasycznego menu. */
  const newWorld = (seed: number, mode: GameMode, name: string, worldType: WorldType) => {
    if (saves.length >= MAX_SAVES) {
      window.alert(`Możesz mieć najwyżej ${MAX_SAVES} światów. Usuń jeden, żeby utworzyć nowy.`);
      return;
    }
    try {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    } catch {
      /* ignore */
    }
    setShared({ seed: null, mode: null });
    setSession({ seed, mode, id: Date.now(), worldId: 'w' + Date.now().toString(36), worldName: name, worldType });
  };

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
        net={session.net}
        onQuit={() => {
          setSession(null);
          setTimeout(refresh, 50);
        }}
      />
    );
  }

  if (multiplayer) {
    return (
      <div className="flex h-full w-full flex-col">
        <OrientationGuard variant="menu" />
        <div className="relative min-h-0 w-full flex-1">
          <MultiplayerScreen onStart={startMultiplayer} onClose={() => setMultiplayer(false)} />
        </div>
      </div>
    );
  }

  if (screen === 'launcher') {
    return (
      <div className="flex h-full w-full flex-col">
        <OrientationGuard variant="menu" />
        <div className="relative min-h-0 w-full flex-1">
          <Launcher
            saves={saves}
            onPlayWorld={playWorld}
            onNewWorld={newWorld}
            onDeleteWorld={(id) => {
              deleteSave(id);
              refresh();
            }}
            onRenameWorld={(id, name) => {
              renameSave(id, name);
              refresh();
            }}
            onDuplicateWorld={(id) => {
              const copied = duplicateSave(id) !== null;
              if (copied) refresh();
              return copied;
            }}
            onToggleFavoriteWorld={(id) => {
              toggleFavoriteSave(id);
              refresh();
            }}
            onMultiplayer={() => setMultiplayer(true)}
            onClassicMenu={leaveLauncher}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <OrientationGuard variant="menu" />
      <div className="relative min-h-0 w-full flex-1">
        <MainMenu
          onAccount={() => setAccountOpen(true)}
          onMultiplayer={() => setMultiplayer(true)}
          saves={saves}
          sharedSeed={shared.seed}
          sharedMode={shared.mode}
          onDelete={(id) => {
            deleteSave(id);
            refresh();
          }}
          onRename={(id, name) => {
            renameSave(id, name);
            refresh();
          }}
          onDuplicate={(id) => {
            const copied = duplicateSave(id) !== null;
            if (copied) refresh();
            return copied;
          }}
          onToggleFavorite={(id) => {
            toggleFavoriteSave(id);
            refresh();
          }}
          onImported={refresh}
          onPlay={playWorld}
          onNew={newWorld}
        />
        {accountOpen && <CommunityAccount onClose={closeAccount} />}
      </div>
    </div>
  );
}
