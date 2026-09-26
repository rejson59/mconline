import { useEffect, useMemo, useRef, useState } from 'react';
import { Game, type GameMode, type HUDState, type SaveData, type UIState } from '../game/engine';
import { setVolume } from '../game/audio';
import HUD from './HUD';
import InventoryScreen from './InventoryScreen';
import FurnaceScreen from './FurnaceScreen';
import ChestScreen from './ChestScreen';
import EnchantScreen from './EnchantScreen';
import TradeScreen from './TradeScreen';
import { ChatInput, DeathScreen, PauseMenu, worldShareUrl, type WorldType } from './Menus';
import TouchControls, { isTouchDevice } from './TouchControls';
import {
  effectiveSettings,
  loadSettings,
  saveSettings,
  type Settings,
} from '../utils/settings';
import { detectDeviceProfile, type DeviceProfile } from '../utils/performance';

export type { Settings };

type WakeLockSentinelLike = { release: () => Promise<void>; released?: boolean };
type WakeLockNav = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } };

export default function GameView({
  seed,
  mode,
  save,
  worldId,
  worldName,
  worldType,
  onQuit,
}: {
  seed: number;
  mode: GameMode;
  save?: SaveData;
  worldId: string;
  worldName: string;
  worldType: WorldType;
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
  const [portraitHint, setPortraitHint] = useState(false);
  const touch = useRef(isTouchDevice()).current;

  // Profil urządzenia liczony raz – steruje trybem „Auto”.
  const profile: DeviceProfile = useMemo(() => detectDeviceProfile(), []);
  // Ustawienia efektywne (Auto = dobierane do urządzenia).
  const effective = useMemo(() => effectiveSettings(settings, profile), [settings, profile]);

  useEffect(() => {
    const s = effectiveSettings(loadSettings(), profile);
    setSettings(loadSettings());
    let game: Game | null = null;
    try {
      game = new Game(
        containerRef.current!,
        { seed, mode, save, renderDistance: s.renderDistance, worldId, worldName, worldType },
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
    game.viewBobbing = s.viewBobbing;
    game.showFps = s.showFps;
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

  // 2.0: każda zmiana ustawień trafia do silnika na żywo (bez restartu świata).
  useEffect(() => {
    const g = gameRef.current;
    if (!g) return;
    g.setRenderDistance(effective.renderDistance);
    g.applyGfx({
      renderDistance: effective.renderDistance,
      pixelRatio: effective.pixelRatio,
      particles: effective.particles,
      clouds: effective.clouds,
      dynamicResolution: effective.dynamicResolution,
      fpsCap: effective.fpsCap,
      autoJump: effective.autoJump,
      haptics: effective.haptics,
      viewBobbing: effective.viewBobbing,
      showFps: effective.showFps,
    });
    g.sensitivity = effective.sensitivity;
    g.fovBase = effective.fov;
    g.showMinimap = effective.minimap;
    setVolume(effective.volume);
    saveSettings(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effective]);

  useEffect(() => {
    const save = () => gameRef.current?.save();
    window.addEventListener('beforeunload', save);
    window.addEventListener('pagehide', save);
    return () => {
      window.removeEventListener('beforeunload', save);
      window.removeEventListener('pagehide', save);
    };
  }, []);

  // 2.0: Wake Lock – ekran telefonu nie gaśnie podczas gry.
  useEffect(() => {
    if (!touch) return;
    const nav = navigator as WakeLockNav;
    if (!nav.wakeLock) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let released = true;
    const acquire = async () => {
      if (!sentinel || released) {
        try {
          sentinel = await nav.wakeLock!.request('screen');
          released = false;
        } catch {
          /* brak zgody albo nieobsługiwane – gra działa dalej */
        }
      }
    };
    const release = () => {
      try {
        void sentinel?.release();
      } catch {
        /* ignore */
      }
      released = true;
    };
    if (ui === 'playing') void acquire();
    else release();
    const onVis = () => {
      if (document.hidden) release();
      else if (ui === 'playing') void acquire();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      release();
    };
  }, [ui, touch]);

  // 2.0: podpowiedź „obróć telefon” w pionie na małych ekranach.
  useEffect(() => {
    if (!touch) return;
    const check = () => setPortraitHint(window.innerHeight > window.innerWidth && window.innerWidth < 560);
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, [touch]);

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
      {hud && game && ui !== 'dead' && (
        <HUD
          hud={hud}
          icons={icons}
          minimap={game.minimapCanvas}
          onSelectSlot={touch ? (i) => { game.selected = i; game.emitHud(); } : undefined}
        />
      )}
      {hud && ui === 'playing' && !hud.locked && !touch && (
        <div className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 bg-black/50 px-4 py-2 text-xl mc-text">
          Kliknij, aby kontynuować
        </div>
      )}
      {game && ui === 'playing' && touch && (
        <TouchControls
          game={game}
          settings={effective}
          onInventory={() => game.openInventory(false)}
          onPause={() => game.setUI('paused')}
          onChat={() => game.setUI('chat')}
        />
      )}
      {touch && portraitHint && ui === 'playing' && (
        <div className="absolute left-1/2 top-2 z-40 flex -translate-x-1/2 items-center gap-2 px-3 py-1.5 text-sm mc-text" style={{ background: 'rgba(0,0,0,0.6)', border: '2px solid #3a3a3a' }}>
          <span>Obróć telefon poziomo – będzie wygodniej</span>
          <button className="px-1 text-base opacity-80" onClick={() => setPortraitHint(false)}>
            ✕
          </button>
        </div>
      )}
      {game && ui === 'inventory' && <InventoryScreen game={game} icons={icons} onChange={() => { game.emitHud(); force((n) => n + 1); }} />}
      {game && ui === 'furnace' && <FurnaceScreen game={game} icons={icons} onChange={() => { game.emitHud(); force((n) => n + 1); }} />}
      {game && ui === 'chest' && <ChestScreen game={game} icons={icons} onChange={() => { game.emitHud(); force((n) => n + 1); }} />}
      {game && ui === 'enchant' && <EnchantScreen game={game} icons={icons} onChange={() => { game.emitHud(); force((n) => n + 1); }} />}
      {game && ui === 'trade' && <TradeScreen game={game} icons={icons} onChange={() => { game.emitHud(); force((n) => n + 1); }} />}
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
          <div className="px-6 text-center text-gray-200 mc-text">
            {game.mode === 'creative'
              ? 'Tryb kreatywny – buduj bez ograniczeń. Grafika dopasowana do twojego urządzenia.'
              : 'Tryb przetrwania – zetnij drzewo, wytwórz kilof, znajdź wioskę i handluj z mieszkańcami.'}
          </div>
          <div className="w-[360px] max-w-[86vw]">
            <button className="mc-btn" onClick={resume}>
              Kliknij, aby grać
            </button>
          </div>
          <div className="px-6 text-center text-sm text-gray-300 mc-text">
            {touch
              ? 'Drążek – ruch (pchnij do oporu = sprint) · tapnij – postaw / użyj · przytrzymaj – kop · ⬆ – skok (2× = latanie)'
              : 'Esc – pauza · E – ekwipunek · T – czat · M – minimapa · F3 – debug · PPM na mieszkańcu – handel'}
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
