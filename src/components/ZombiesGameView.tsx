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

  // Zombies HUD extension: gold, round, power, ammo, perks, zombies left
  const [zGold, setZGold] = useState(500);
  const [zRound, setZRound] = useState(1);
  const [zPower, setZPower] = useState(false);
  const [zAmmo, setZAmmo] = useState('12/60');
  const [zWeapon, setZWeapon] = useState('Pistol');
  const [zLeft, setZLeft] = useState(0);
  const [zInsta, setZInsta] = useState(false);
  const [zDouble, setZDouble] = useState(false);
  const [zInter, setZInter] = useState(0);
  const [zPerks, setZPerks] = useState('');
  const [zKills, setZKills] = useState(0);

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
            const anyHud = h as unknown as { zombiesGold?: number; zombiesRound?: number; zombiesPower?: boolean; zombiesAmmo?: string; zombiesWeapon?: string; zombiesZombiesLeft?: number; zombiesInsta?: boolean; zombiesDoubleGold?: boolean; zombiesRoundIntermission?: number; zombiesPerks?: string; zombiesKills?: number };
            if (anyHud.zombiesGold != null) setZGold(anyHud.zombiesGold);
            if (anyHud.zombiesRound != null) setZRound(anyHud.zombiesRound);
            if (anyHud.zombiesPower != null) setZPower(anyHud.zombiesPower);
            if (anyHud.zombiesAmmo) setZAmmo(anyHud.zombiesAmmo);
            if (anyHud.zombiesWeapon) setZWeapon(anyHud.zombiesWeapon);
            if (anyHud.zombiesZombiesLeft != null) setZLeft(anyHud.zombiesZombiesLeft);
            if (anyHud.zombiesInsta != null) setZInsta(!!anyHud.zombiesInsta);
            if (anyHud.zombiesDoubleGold != null) setZDouble(!!anyHud.zombiesDoubleGold);
            if (anyHud.zombiesRoundIntermission != null) setZInter(anyHud.zombiesRoundIntermission);
            if (anyHud.zombiesPerks != null) setZPerks(anyHud.zombiesPerks);
            if (anyHud.zombiesKills != null) setZKills(anyHud.zombiesKills);
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
      {/* Zombies HUD bar on top – 1:1 Hypixel style */}
      {hud && (
        <div className="pointer-events-none absolute left-0 right-0 top-0 flex flex-wrap items-center justify-between gap-2 bg-black/70 px-3 py-1.5 text-xs text-white">
          <div className="flex items-center gap-3">
            <span className="text-red-400 font-bold">ZOMBIES {mapId.toUpperCase()}</span>
            <span className="rounded bg-red-900/60 px-2 py-0.5 font-bold">Runda {zRound}/30 {zInter > 0 ? `(start ${Math.ceil(zInter)}s)` : `• ${zLeft} zombie`}</span>
            <span className={`${zPower ? 'text-emerald-300' : 'text-white/40'} text-[11px]`}>⚡ {zPower ? 'PRĄD WŁ.' : 'PRĄD WYŁ.'}</span>
            {zInsta && <span className="animate-pulse rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold">INSTA-KILL</span>}
            {zDouble && <span className="animate-pulse rounded bg-yellow-600 px-1.5 py-0.5 text-[10px] font-bold">×2 GOLD</span>}
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded bg-black/60 px-2 py-0.5 text-yellow-300 font-bold">💰 {zGold}g</span>
            <span className="hidden sm:inline text-white/70">Drzwi: E • Sklep: PPM • Strzał: LPM • R przeładuj</span>
          </div>
        </div>
      )}
      {/* Ammo + weapon – bottom center like CoD */}
      {hud && ui === 'playing' && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 bg-black/60 px-4 py-1.5 text-white border border-white/10">
          <div className="text-[11px] text-white/60 tracking-widest">{zWeapon.toUpperCase()}</div>
          <div className={`text-xl font-bold tracking-wider ${zAmmo.startsWith('0/') ? 'text-red-400' : 'text-white'}`}>{zAmmo}</div>
          <div className="text-[10px] text-white/40">1-3 przełącz • R przeładuj • T czat</div>
        </div>
      )}
      {/* Scoreboard prawo jak Hypixel */}
      {hud && ui === 'playing' && (
        <div className="pointer-events-none absolute right-2 top-12 hidden md:flex flex-col gap-1 bg-black/70 border border-yellow-900/40 p-2 text-xs text-white min-w-[140px]">
          <div className="text-yellow-300 font-bold text-center border-b border-white/20 pb-1">ZOMBIES</div>
          <div>Runda: <b className="text-red-400">{zRound}/30</b></div>
          <div>Zombie: <b className={zLeft === 0 ? 'text-green-400' : 'text-white'}>{zLeft}</b></div>
          <div>Złoto: <b className="text-yellow-300">{zGold}g</b></div>
          <div>Zabicia: <b>{zKills}</b></div>
          <div>Broń: <b className="text-cyan-300">{zWeapon}</b> <span className="text-white/60">{zAmmo}</span></div>
          <div>Prąd: <b className={zPower ? 'text-emerald-400' : 'text-white/40'}>{zPower ? 'ON' : 'OFF'}</b></div>
          <div className="border-t border-white/20 pt-1 text-[10px]">Perki: {zPerks ? zPerks.split(',').map(p => ({ quickFire: '⚡QF', flameBullets: '🔥', frozenBullets: '❄️', extraHealth: '❤️', extraWeapon: '🎒', speed: '👟', fastRevive: '💉' } as never)[p] ?? p).join(' ') : <span className="text-white/40">brak</span>}</div>
        </div>
      )}
      {/* crosshair hint when looking at shop/door */}
      {hud && hud.target !== '-' && ui === 'playing' && hud.target && (
        <div className="pointer-events-none absolute left-1/2 top-[52%] -translate-x-1/2 rounded bg-black/70 px-2 py-1 text-[11px] text-white/90">{hud.target}</div>
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
