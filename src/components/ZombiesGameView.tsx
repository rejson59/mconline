import { useEffect, useMemo, useRef, useState } from 'react';
import { Game, type GameMode, type HUDState, type UIState } from '../game/engine';
import type { ZombiesMapId } from '../game/zombies';
import HUD from './HUD';
import type { NetLike } from '../game/net';
import { DeathScreen, PauseMenu, worldShareUrl } from './Menus';
import { ChatInput } from './ChatScreen';
import TouchControls from './TouchControls';
import OrientationGuard from './OrientationGuard';
import { enterLandscapeMode } from '../utils/screen';
import { effectiveSettings, loadSettings, saveSettings, type Settings } from '../utils/settings';
import { resolveControlMode } from '../utils/input';
import { detectDeviceProfile, recommendPreset, PRESETS, type DeviceProfile } from '../utils/performance';
import { setVolume } from '../game/audio';

export default function ZombiesGameView({
  mapId,
  seed,
  worldId,
  worldName,
  net,
  onQuit,
}: {
  mapId: ZombiesMapId;
  seed: number;
  worldId: string;
  worldName: string;
  net?: NetLike;
  onQuit: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HUDState | null>(null);
  const [ui, setUi] = useState<UIState>('paused');
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [, _force] = useState(0); void _force;
  const [started, setStarted] = useState(false);
  const [chatList, setChatList] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [touch, setTouch] = useState(() => resolveControlMode(loadSettings()) === 'touch');
  const [controlNotice, setControlNotice] = useState(false);
  useEffect(() => {
    if (!controlNotice) return;
    const t = window.setTimeout(() => setControlNotice(false), 6000);
    return () => window.clearTimeout(t);
  }, [controlNotice]);

  const profile: DeviceProfile = useMemo(() => detectDeviceProfile(), []);
  const effective = useMemo(() => effectiveSettings(settings, profile), [settings, profile]);
  const gfxPreset = PRESETS[effective.quality === 'auto' ? recommendPreset(profile) : effective.quality];

  // Zombies HUD extension: gold, round, power
  const [zGold, setZGold] = useState(500);
  const [zRound, setZRound] = useState(1);
  const [zPower, setZPower] = useState(false);

  useEffect(() => {
    const s = effectiveSettings(loadSettings(), profile);
    setSettings(loadSettings());
    let game: Game | null = null;
    try {
      const mode: GameMode = 'zombies';
      // Pass zombiesMapId via extra opts (engine reads it)
      game = new Game(
        containerRef.current!,
        { seed, mode, renderDistance: s.renderDistance, worldId, worldName, worldType: 'normal', net, zombiesMapId: mapId } as never,
        {
          onHud: (h) => {
            setHud(h);
            // Try to extract zombies gold if present in custom HUD field
            const anyHud = h as unknown as { zombiesGold?: number; zombiesRound?: number; zombiesPower?: boolean };
            if (anyHud.zombiesGold != null) setZGold(anyHud.zombiesGold);
            if (anyHud.zombiesRound != null) setZRound(anyHud.zombiesRound);
            if (anyHud.zombiesPower != null) setZPower(anyHud.zombiesPower);
          },
          onUI: setUi,
          onControl: (kind) => {
            setTouch(kind === 'touch');
            if (kind === 'desktop') setControlNotice(true);
          },
        }
      );
    } catch (e) {
      console.error(e);
      setFatal('Nie udało się uruchomić Zombies (WebGL). Sprawdź akcelerację sprzętową.');
      return;
    }
    game.touchInput = touch;
    game.autoControl = s.controlMode === 'auto';
    game.sensitivity = s.sensitivity;
    game.fovBase = s.fov;
    game.showMinimap = s.minimap;
    game.viewBobbing = s.viewBobbing;
    game.showFps = s.showFps;
    setVolume(s.volume);
    gameRef.current = game;
    (window as unknown as { blockcraft?: { game: Game } }).blockcraft = { game };
    return () => {
      game?.save();
      game?.dispose();
      gameRef.current = null;
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    const g = gameRef.current;
    const touchNow = resolveControlMode(effective) === 'touch';
    setTouch(touchNow);
    if (!g) return;
    g.touchInput = touchNow;
    g.autoControl = effective.controlMode === 'auto';
    if (touchNow && document.pointerLockElement) try { document.exitPointerLock(); } catch {}
    g.setRenderDistance(effective.renderDistance);
    g.applyGfx({
      renderDistance: effective.renderDistance,
      pixelRatio: effective.pixelRatio,
      particles: effective.particles,
      clouds: effective.clouds,
      dynamicResolution: effective.dynamicResolution,
      fpsCap: effective.fpsCap,
      lod: effective.lod,
      autoQuality: effective.autoQuality,
      chunkBudgetMs: gfxPreset.chunkBudgetMs,
      chunksPerFrame: gfxPreset.chunksPerFrame,
      unloadMargin: gfxPreset.unloadMargin,
      autoJump: effective.autoJump,
      autoAttack: effective.autoAttack,
      haptics: effective.haptics,
      viewBobbing: effective.viewBobbing,
      showFps: effective.showFps,
    });
    g.sensitivity = effective.sensitivity;
    g.fovBase = effective.fov;
    g.showMinimap = effective.minimap;
    setVolume(effective.volume);
    saveSettings(settings);
  }, [effective]); // eslint-disable-line

  if (fatal) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-3xl mc-text">Błąd</div>
        <div className="max-w-[520px] text-gray-200 mc-text">{fatal}</div>
        <button className="mc-btn w-[280px]" onClick={onQuit}>Powrót</button>
      </div>
    );
  }

  const game = gameRef.current;
  const icons = game?.icons ?? {};

  const resume = () => {
    setStarted(true);
    gameRef.current?.setUI('playing');
    if (touch) void enterLandscapeMode();
  };

  const wantsLandscape = ui === 'playing' || ui === 'inventory' || ui === 'paused';

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />
      {/* Zombies HUD bar on top */}
      {hud && (
        <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-center justify-between gap-2 bg-black/60 px-3 py-2 text-xs text-white">
          <div className="flex items-center gap-3">
            <span className="text-red-400 font-bold">ZOMBIES {mapId.toUpperCase()}</span>
            <span>Runda {zRound}/30</span>
            <span className={zPower ? 'text-emerald-300' : 'text-white/40'}>⚡ {zPower ? 'PRĄD WŁ.' : 'PRĄD WYŁ.'}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-yellow-300 font-bold">💰 {zGold}g</span>
            <span>Drzwi: E • Sklep: PPM • Strzał: LPM</span>
          </div>
        </div>
      )}
      {hud && game && ui !== 'dead' && (
        <HUD hud={hud} icons={icons} minimap={game.minimapCanvas} touchControls={touch} onSelectSlot={touch ? (i) => { game.selected = i; game.emitHud(); } : undefined} onTpaAccept={() => game.acceptTeleport()} onTpaDeny={() => game.denyTeleport()} />
      )}
      {hud && ui === 'playing' && !hud.locked && !touch && (
        <div className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 bg-black/50 px-4 py-2 text-xl mc-text">Kliknij, aby kontynuować</div>
      )}
      {game && ui === 'playing' && touch && (
        <TouchControls game={game} settings={effective} onInventory={() => game.openInventory(false)} onPause={() => game.setUI('paused')} onChat={() => { setChatList(false); game.setUI('chat'); }} onWaypoints={() => game.setUI('waypoints')} />
      )}
      {controlNotice && ui === 'playing' && <div className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 rounded bg-black/65 px-4 py-2 text-center text-sm text-white mc-text">Wykryto klawiaturę i mysz – sterowanie komputerowe.</div>}
      {wantsLandscape && <OrientationGuard />}
      {game && hud && ui === 'journal' && <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4"><div className="mc-card p-4 max-w-[600px]"><div className="text-lg text-yellow-200 mb-2">Dziennik Zombies</div><div className="text-sm text-white/80">Runda {zRound}/30 • Zabij wszystkie zombie, otwieraj drzwi, kupuj perki i ulepszaj broń w Garden. Boss co 10 rund!</div><button className="mc-btn mt-3" onClick={() => game.setUI('playing')}>Gotowe</button></div></div>}
      {game && ui === 'chat' && <ChatInput onSubmit={(t) => game.command(t)} onClose={() => game.setUI('playing')} showListInitially={chatList} />}
      {game && ui === 'dead' && <DeathScreen onRespawn={() => game.respawn()} onQuit={() => { game.health = 20; game.body.pos.copy(game.spawnPoint); onQuit(); }} />}
      {game && ui === 'paused' && !started && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6" style={{ background: 'rgba(0,0,0,0.65)' }}>
          <div className="text-4xl font-bold mc-text text-red-500">🧟 ZOMBIES – {mapId.toUpperCase()}</div>
          <div className="px-6 text-center text-gray-200 mc-text max-w-[560px]">Masz Pistol. Strzelaj LPM, celuj jak w MC, naprawiaj okna (E przy oknie) za złoto, otwieraj drzwi (E na drzwiach), kupuj Shotgun/Sniper/Perki. Runda 1 startuje automatycznie – nie giń!</div>
          <div className="w-[360px] max-w-[86vw]"><button className="mc-btn mc-btn-primary" onClick={resume}>{touch ? 'Dotknij, aby grać' : 'Kliknij, aby grać'}</button></div>
          <div className="text-xs text-white/50">Tip: Sniper przebija zombie – ustaw się w linii. Shotgun z bliska = 1 hit do rundy 8.</div>
        </div>
      )}
      {game && ui === 'paused' && started && (
        <PauseMenu settings={settings} shareUrl={worldShareUrl(game.world.seed, game.mode as never)} worldName={worldName} unlocked={game.achievementIds()} onSettings={setSettings} onResume={resume} onJournal={() => game.setUI('journal')} onWaypoints={() => game.setUI('waypoints')} onCommands={() => { setChatList(true); game.setUI('chat'); }} onSave={() => game.save()} onSkin={(id) => gameRef.current?.setSkin(id)} session={hud?.players?.length ? { role: hud.netRole ?? 'host', players: hud.players } : null} onQuit={() => { game.save(); onQuit(); }} />
      )}
    </div>
  );
}
