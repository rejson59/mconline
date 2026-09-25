import { useEffect, useRef, useState } from 'react';
import { Game, type GameMode, type HUDState, type SaveData, type UIState } from '../game/engine';
import { setVolume } from '../game/audio';
import HUD from './HUD';
import InventoryScreen from './InventoryScreen';
import { ChatInput, DeathScreen, PauseMenu, type Settings } from './Menus';

const SETTINGS_KEY = 'blockcraft-settings';

function loadSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '');
    return { renderDistance: 6, sensitivity: 1, fov: 72, volume: 0.5, ...s };
  } catch {
    return { renderDistance: 6, sensitivity: 1, fov: 72, volume: 0.5 };
  }
}

export default function GameView({
  seed,
  mode,
  save,
  onQuit,
}: {
  seed: number;
  mode: GameMode;
  save?: SaveData;
  onQuit: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HUDState | null>(null);
  const [ui, setUi] = useState<UIState>('paused');
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [, force] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const s = loadSettings();
    const game = new Game(
      containerRef.current!,
      { seed, mode, save, renderDistance: s.renderDistance },
      { onHud: setHud, onUI: setUi }
    );
    game.sensitivity = s.sensitivity;
    game.fovBase = s.fov;
    setVolume(s.volume);
    gameRef.current = game;
    return () => {
      game.save();
      game.dispose();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const g = gameRef.current;
    if (!g) return;
    if (g.renderDistance !== settings.renderDistance) g.setRenderDistance(settings.renderDistance);
    g.sensitivity = settings.sensitivity;
    g.fovBase = settings.fov;
    setVolume(settings.volume);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const save = () => gameRef.current?.save();
    window.addEventListener('beforeunload', save);
    return () => window.removeEventListener('beforeunload', save);
  }, []);

  const game = gameRef.current;
  const icons = game?.icons ?? {};

  const resume = () => {
    setStarted(true);
    gameRef.current?.setUI('playing');
  };

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />
      {hud && game && ui !== 'dead' && <HUD hud={hud} icons={icons} />}
      {hud && ui === 'playing' && !hud.locked && (
        <div className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 bg-black/50 px-4 py-2 text-xl mc-text">
          Kliknij, aby kontynuować
        </div>
      )}
      {game && ui === 'inventory' && <InventoryScreen game={game} icons={icons} onChange={() => { game.emitHud(); force((n) => n + 1); }} />}
      {game && ui === 'chat' && (
        <ChatInput
          onSubmit={(t) => game.command(t)}
          onClose={() => game.setUI('playing')}
        />
      )}
      {game && ui === 'dead' && (
        <DeathScreen
          onRespawn={() => game.respawn()}
          onQuit={() => {
            game.health = 20;
            game.body.pos.copy(game.spawnPoint);
            onQuit();
          }}
        />
      )}
      {game && ui === 'paused' && !started && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="text-4xl font-bold mc-text">Świat gotowy!</div>
          <div className="text-center text-gray-200 mc-text">
            {game.mode === 'creative' ? 'Tryb kreatywny – buduj bez ograniczeń.' : 'Tryb przetrwania – zdobywaj drewno z drzew, aby zacząć.'}
          </div>
          <div className="w-[360px]">
            <button className="mc-btn" onClick={resume}>
              Kliknij, aby grać
            </button>
          </div>
          <div className="text-sm text-gray-300 mc-text">Esc – pauza · E – ekwipunek · T – czat · F3 – debug</div>
        </div>
      )}
      {game && ui === 'paused' && started && (
        <PauseMenu
          settings={settings}
          onSettings={setSettings}
          onResume={resume}
          onSave={() => game.save()}
          onQuit={() => {
            game.save();
            onQuit();
          }}
        />
      )}
    </div>
  );
}
