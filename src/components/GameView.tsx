import { useEffect, useRef, useState } from 'react';
import { Game, type GameMode, type HUDState, type SaveData, type UIState } from '../game/engine';
import { setVolume } from '../game/audio';
import HUD from './HUD';
import InventoryScreen from './InventoryScreen';
import FurnaceScreen from './FurnaceScreen';
import ChestScreen from './ChestScreen';
import { ChatInput, DeathScreen, PauseMenu, worldShareUrl } from './Menus';
import TouchControls, { isTouchDevice } from './TouchControls';
import { loadSettings, saveSettings, type Settings } from '../utils/settings';

export type { Settings };

export default function GameView({
  seed,
  mode,
  save,
  worldId,
  worldName,
  onQuit,
}: {
  seed: number;
  mode: GameMode;
  save?: SaveData;
  worldId: string;
  worldName: string;
  onQuit: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HUDState | null>(null);
  const [ui, setUi] = useState<UIState>('paused');
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [, force] = useState(0);
  const [started, setStarted] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const touch = useRef(isTouchDevice()).current;

  useEffect(() => {
    const s = loadSettings();
    let game: Game | null = null;
    try {
      game = new Game(
        containerRef.current!,
        { seed, mode, save, renderDistance: s.renderDistance, worldId, worldName },
        { onHud: setHud, onUI: setUi }
      );
    } catch (e) {
      console.error('Nie udało się uruchomić silnika gry', e);
      setFatal(
        'Nie udało się uruchomić grafiki 3D (WebGL). ' +
          'Sprawdź, czy sprzętowa akceleracja w przeglądarce jest włączona i spróbuj ponownie.'
      );
      return;
    }
    game.sensitivity = s.sensitivity;
    game.fovBase = s.fov;
    game.showMinimap = s.minimap;
    setVolume(s.volume);
    gameRef.current = game;
    // handy for debugging from the browser console: blockcraft.game.…
    (window as unknown as { blockcraft?: { game: Game } }).blockcraft = { game };
    return () => {
      game?.save();
      game?.dispose();
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
    g.showMinimap = settings.minimap;
    setVolume(settings.volume);
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    const save = () => gameRef.current?.save();
    window.addEventListener('beforeunload', save);
    window.addEventListener('pagehide', save);
    return () => {
      window.removeEventListener('beforeunload', save);
      window.removeEventListener('pagehide', save);
    };
  }, []);

  if (fatal) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-3xl mc-text">Błąd</div>
        <div className="max-w-[520px] text-gray-200 mc-text">{fatal}</div>
        <div className="w-[280px]">
          <button className="mc-btn" onClick={onQuit}>
            Powrót do menu
          </button>
        </div>
      </div>
    );
  }

  const game = gameRef.current;
  const icons = game?.icons ?? {};

  const resume = () => {
    setStarted(true);
    gameRef.current?.setUI('playing');
  };

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />
      {hud && game && ui !== 'dead' && <HUD hud={hud} icons={icons} minimap={game.minimapCanvas} />}
      {hud && ui === 'playing' && !hud.locked && !touch && (
        <div className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 bg-black/50 px-4 py-2 text-xl mc-text">
          Kliknij, aby kontynuować
        </div>
      )}
      {game && ui === 'playing' && touch && (
        <TouchControls
          game={game}
          onInventory={() => game.openInventory(false)}
          onPause={() => game.setUI('paused')}
        />
      )}
      {game && ui === 'inventory' && <InventoryScreen game={game} icons={icons} onChange={() => { game.emitHud(); force((n) => n + 1); }} />}
      {game && ui === 'furnace' && <FurnaceScreen game={game} icons={icons} onChange={() => { game.emitHud(); force((n) => n + 1); }} />}
      {game && ui === 'chest' && <ChestScreen game={game} icons={icons} onChange={() => { game.emitHud(); force((n) => n + 1); }} />}
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
            {game.mode === 'creative' ? 'Tryb kreatywny – buduj bez ograniczeń. Pochodnie, ognisko i lawa świecą.' : 'Tryb przetrwania – zetnij drzewo, wytwórz kilof, postaw drzwi i skrzynię.'}
          </div>
          <div className="w-[360px]">
            <button className="mc-btn" onClick={resume}>
              Kliknij, aby grać
            </button>
          </div>
          <div className="px-6 text-center text-sm text-gray-300 mc-text">
            {touch
              ? 'Lewy drążek – ruch · przeciągnij po ekranie – rozglądanie · przyciski po prawej – skok, kopanie, stawianie'
              : 'Esc – pauza · E – ekwipunek · T – czat · M – minimapa · F3 – debug'}
          </div>
        </div>
      )}
      {game && ui === 'paused' && started && (
        <PauseMenu
          settings={settings}
          shareUrl={worldShareUrl(game.world.seed, game.mode)}
          worldName={game.worldName}
          unlocked={game.achievementIds()}
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
