import { useEffect, useRef, useState } from 'react';
import type { HUDState } from '../game/engine';
import { displayName, durabilityMax } from '../game/items';
import { enchList } from '../game/enchant';
import { GAME_RELEASE_NAME, GAME_VERSION } from '../utils/version';
import { SkinHead } from './SkinPicker';
import { airSprite, armorSprite, foodSprite, guiSprite, heartSprite } from '../game/art/uiSprites';

const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
const BUBBLE = ['.XXX.', 'X..XX', 'X.XXX', 'XXXXX', '.XXX.'];

const outline = 'drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000)';

/**
 * 2.18: serca, głód i powietrze rysujemy grafiką z paczki (`gui/sprites/hud`).
 * Gdyby jej zabrakło (starszy build), zostaje pikselowy rysunek SVG.
 */
function PackIcon({ src, size, alt = '' }: { src: string | null; size: number; alt?: string }) {
  if (!src) return null;
  return <img src={src} width={size} height={size} className="pixelated" alt={alt} draggable={false} />;
}

function Heart({ fill }: { fill: 0 | 1 | 2 }) {
  const src = heartSprite(fill);
  if (src) {
    return (
      <span style={{ filter: outline, display: 'inline-flex' }}>
        <PackIcon src={src} size={18} />
      </span>
    );
  }
  return (
    <svg width={18} height={16} viewBox="0 0 7 6" style={{ filter: outline }} shapeRendering="crispEdges">
      {HEART.flatMap((row, y) =>
        row.split('').map((c, x) => {
          if (c !== 'X') return null;
          let color = '#3b0a0a';
          if (fill === 2 || (fill === 1 && x < 4)) color = y === 1 && x === 1 ? '#ffb0b0' : '#d91616';
          return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} />;
        })
      )}
    </svg>
  );
}

function Bubble({ pop }: { pop: boolean }) {
  const src = airSprite(pop);
  if (src) return <PackIcon src={src} size={16} />;
  return (
    <svg width={16} height={16} viewBox="0 0 5 5" style={{ filter: outline, opacity: pop ? 0.25 : 1 }} shapeRendering="crispEdges">
      {BUBBLE.flatMap((row, y) =>
        row.split('').map((c, x) =>
          c === 'X' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#3a8ee6" /> : null
        )
      )}
      <rect x={1} y={1} width={1} height={1} fill="#fff" />
    </svg>
  );
}

function ArmorPiece({ icon, frac, enchanted }: { icon: string; frac: number; enchanted?: boolean }) {
  const plate = armorSprite(frac >= 0.66 ? 2 : frac >= 0.33 ? 1 : 0);
  return (
    <div className="relative flex items-center justify-center" style={{ width: 22, height: 22, background: 'rgba(40,40,40,0.5)', border: '1px solid #1a1a1a' }}>
      {plate && <img src={plate} width={22} height={22} className="pixelated absolute inset-0 opacity-70" alt="" draggable={false} />}
      <img src={icon} className="pixelated" width={18} height={18} draggable={false} />
      {enchanted && <span className="ench-glint" />}
      {frac < 1 && <span className="dur-bar"><i style={{ width: `${frac * 100}%`, background: frac < 0.25 ? '#e04040' : '#3dba3d' }} /></span>}
    </div>
  );
}

function Drumstick({ fill }: { fill: 0 | 1 | 2 }) {
  const src = foodSprite(fill);
  if (src) {
    return (
      <span style={{ filter: outline, display: 'inline-flex' }}>
        <PackIcon src={src} size={18} />
      </span>
    );
  }
  const meat = fill === 0 ? '#4a2a12' : '#c47a32';
  const bone = fill === 0 ? '#3a3a3a' : '#f2efe6';
  return (
    <svg width={18} height={16} viewBox="0 0 8 7" style={{ filter: outline }} shapeRendering="crispEdges">
      <rect x={1} y={1} width={4} height={3} fill={meat} />
      <rect x={1} y={1} width={1} height={1} fill={fill ? '#f0c090' : meat} />
      <rect x={4} y={3} width={3} height={1} fill={bone} />
      <rect x={5} y={4} width={2} height={2} fill={bone} />
      {fill === 1 && <rect x={3} y={1} width={2} height={3} fill="#4a2a12" />}
    </svg>
  );
}

export function Hotbar({ hud, icons, onSelect }: { hud: HUDState; icons: Record<number, string>; onSelect?: (i: number) => void }) {
  return (
    <div
      className="hotbar flex"
      style={{
        background: guiSprite('hotbar') ? undefined : 'rgba(0,0,0,0.35)',
        backgroundImage: guiSprite('hotbar') ? `url(${guiSprite('hotbar')})` : undefined,
        backgroundSize: '100% 100%',
        imageRendering: 'pixelated',
        border: guiSprite('hotbar') ? undefined : '2px solid #1a1a1a',
        padding: 2,
        pointerEvents: onSelect ? 'auto' : undefined,
      }}
    >
      {hud.hotbar.map((s, i) => {
        const max = s ? durabilityMax(s.id) : 0;
        const frac = s && max && s.dur !== undefined ? Math.max(0, s.dur / max) : 1;
        return (
          <div
            key={i}
            className={`hotbar-slot relative flex items-center justify-center ${i === hud.selected ? 'is-selected' : ''}`}
            aria-current={i === hud.selected ? 'true' : undefined}
            onPointerDown={onSelect ? (e) => { e.stopPropagation(); onSelect(i); } : undefined}
            style={{
              border: i === hud.selected ? '3px solid #fdfdfd' : '3px solid rgba(0,0,0,0.28)',
              outline: i === hud.selected ? '2px solid #000' : undefined,
              background: i === hud.selected
                ? 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(90,90,90,0.45))'
                : 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(20,20,20,0.35))',
              margin: -1,
              cursor: onSelect ? 'pointer' : undefined,
              touchAction: onSelect ? 'none' : undefined,
            }}
          >
            {s && <img src={icons[s.id]} className="pixelated" width={34} height={34} draggable={false} />}
            {s && hud.mode === 'survival' && s.count > 1 && <span className="mc-count">{s.count}</span>}
            {s?.ench && <span className="ench-glint" />}
            {s && max > 0 && s.dur !== undefined && s.dur < max && (
              <span className="dur-bar"><i style={{ width: `${frac * 100}%`, background: frac < 0.25 ? '#e04040' : '#3dba3d' }} /></span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function HUD({ hud, icons, minimap, touchControls, onSelectSlot }: { hud: HUDState; icons: Record<number, string>; minimap?: HTMLCanvasElement | null; touchControls?: boolean; onSelectSlot?: (i: number) => void }) {
  const [label, setLabel] = useState<{ text: string; key: number } | null>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const sel = hud.hotbar[hud.selected];
  const selId = sel ? sel.id : -1;

  useEffect(() => {
    if (selId < 0) { setLabel(null); return; }
    const list = sel ? enchList(sel) : [];
    setLabel({ text: list.length ? `${displayName(selId)} · ${list.join(', ')}` : displayName(selId), key: Date.now() });
    const t = setTimeout(() => setLabel(null), 2600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId, hud.selected]);

  useEffect(() => {
    const dst = mapRef.current;
    if (!dst || !minimap || !hud.minimap) return;
    const ctx = dst.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(minimap, 0, 0, dst.width, dst.height);
  });

  const hearts = [];
  for (let i = 0; i < 10; i++) {
    const v = hud.health - i * 2;
    hearts.push(<Heart key={i} fill={v >= 2 ? 2 : v >= 1 ? 1 : 0} />);
  }
  const drums = [];
  for (let i = 0; i < 10; i++) {
    const v = hud.hunger - i * 2;
    drums.push(<Drumstick key={i} fill={v >= 2 ? 2 : v >= 1 ? 1 : 0} />);
  }
  const bubbles = [];
  const airFrac = hud.air / hud.maxAir;
  for (let i = 0; i < 10; i++) bubbles.push(<Bubble key={i} pop={airFrac * 10 < i + 0.5} />);

  const hours = Math.floor(((hud.time * 24 + 6) % 24));
  const mins = Math.floor(((hud.time * 24 * 60) % 60));

  return (
    <div className="pointer-events-none absolute inset-0 z-30 select-none">
      {/* overlays */}
      {hud.underwater && <div className="absolute inset-0" style={{ background: 'rgba(20,60,160,0.35)' }} />}
      {hud.inLava && <div className="absolute inset-0" style={{ background: 'rgba(230,90,10,0.6)' }} />}
      {hud.hurtCount > 0 && <div key={hud.hurtCount} className="hurt-flash absolute inset-0" style={{ background: 'radial-gradient(circle, rgba(255,0,0,0.1) 30%, rgba(200,0,0,0.7))' }} />}
      {hud.mode === 'survival' && hud.health <= 6 && hud.health > 0 && (
        <div
          className="low-health absolute inset-0"
          style={{ background: 'radial-gradient(circle, rgba(120,0,0,0) 45%, rgba(190,0,0,0.55) 100%)' }}
        />
      )}

      {/* 2.3: przy lornetcie celownik znika, a ramka zasłania kąty widzenia */}
      {hud.zoom && (
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 34%, rgba(0,0,0,0.85) 72%)' }} />
      )}

      {/* crosshair – 2.18: obrazek z paczki, z pikselowym fallbackiem */}
      {!hud.zoom && guiSprite('crosshair') && (
        <img
          src={guiSprite('crosshair')!}
          width={18}
          height={18}
          className="pixelated absolute left-1/2 top-1/2"
          style={{ transform: 'translate(-50%,-50%)', filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.9))' }}
          alt=""
          draggable={false}
          aria-hidden="true"
        />
      )}
      {!hud.zoom && !guiSprite('crosshair') && (
        <div className="absolute left-1/2 top-1/2" style={{ transform: 'translate(-50%,-50%)' }} aria-hidden="true">
          <div style={{ position: 'absolute', left: -10, top: -2.5, width: 20, height: 5, background: 'rgba(0,0,0,0.55)' }} />
          <div style={{ position: 'absolute', left: -2.5, top: -10, width: 5, height: 20, background: 'rgba(0,0,0,0.55)' }} />
          <div style={{ position: 'absolute', left: -9, top: -1.5, width: 18, height: 3, background: '#fff', boxShadow: '0 0 3px rgba(0,0,0,0.5)' }} />
          <div style={{ position: 'absolute', left: -1.5, top: -9, width: 3, height: 18, background: '#fff', boxShadow: '0 0 3px rgba(0,0,0,0.5)' }} />
          <div style={{ position: 'absolute', left: -1, top: -1, width: 2, height: 2, background: 'rgba(255,255,255,0.85)' }} />
        </div>
      )}

      {/* 2.3: stan wędkarstwa nad celownikiem (2.5: treść wg wersji sterowania) */}
      {hud.fishing !== 'idle' && (
        <div className="absolute left-1/2 top-[58%] -translate-x-1/2 px-2 py-0.5 text-sm mc-text" style={{ background: 'rgba(0,0,0,0.45)' }}>
          {hud.fishing === 'bite' ? (touchControls ? '🎣 Brań! Dotknij, aby zaciągnąć' : '🎣 Brań! Kliknij, aby zaciągnąć') : hud.fishing === 'waiting' ? '🎣 Przynęta czeka…' : '🎣 Przynęta leci…'}
        </div>
      )}

      {/* 2.2: aktywny punkt podróży — strzałka obraca się względem kierunku patrzenia. */}
      {hud.waypoint && !hud.debug && (
        <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 border border-black bg-black/60 px-3 py-1 text-sm mc-text">
          <span className="inline-block text-lg text-yellow-300" style={{ transform: `rotate(${hud.waypoint.bearing}rad)` }}>↑</span>
          <span className="max-w-[45vw] truncate text-yellow-100">{hud.waypoint.name}</span>
          <span className="whitespace-nowrap text-white/80">{Math.round(hud.waypoint.distance)} m · {hud.waypoint.direction}</span>
        </div>
      )}

      {/* wskazówka o istocie pod celownikiem (1.6) */}
      {hud.mobHint && !hud.debug && (
        <div className="absolute left-1/2 top-[54%] -translate-x-1/2 px-2 py-0.5 text-sm mc-text" style={{ background: 'rgba(0,0,0,0.45)' }}>
          {hud.mobHint}
        </div>
      )}

      {/* debug */}
      {hud.debug ? (
        <div className="absolute left-2 top-2 space-y-0.5 text-[15px] leading-tight">
          {[
            `BlockCraft ${GAME_VERSION} „${GAME_RELEASE_NAME}” (${hud.fps} fps, skala ${Math.round(hud.resScale * 100)}%, ${hud.drawCalls} kresleń)`,
            `XYZ: ${hud.pos[0].toFixed(2)} / ${hud.pos[1].toFixed(2)} / ${hud.pos[2].toFixed(2)}`,
            `Blok: ${Math.floor(hud.pos[0])} ${Math.floor(hud.pos[1])} ${Math.floor(hud.pos[2])}`,
            `Chunk: ${Math.floor(hud.pos[0] / 16)} ${Math.floor(hud.pos[2] / 16)}  (załadowane: ${hud.chunks})`,
            `Kierunek: ${hud.facing}`,
            `Biom: ${hud.biome}`,
            `Czas: dzień ${hud.day}, ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`,
            `Świat: ${hud.worldName} (${hud.worldType === 'flat' ? 'płaski' : 'normalny'})`,
            `Moby: ${hud.mobs}`,
            `Wioska: ${hud.village ?? 'brak'}  ·  wymiany: ${hud.trades}`,
            `Cel: ${hud.target}`,
            `Ziarno: ${hud.seed}`,
            `Tryb: ${hud.mode === 'creative' ? 'Kreatywny' : 'Przetrwanie'}${hud.flying ? ' (lot)' : ''}${hud.sprinting ? ' sprint' : ''} · sterowanie: ${hud.touch ? 'dotyk' : 'PC'}`,
            `Głód: ${hud.hunger.toFixed(1)}  Pogoda: ${hud.weather === 'rain' ? 'deszcz' : 'jasno'}`,
            `Poziom: ${hud.level} (${Math.round(hud.xpFrac * 100)}% do następnego)  Pancerz: ${hud.armorPoints} pkt`,
          ].map((l, i) => (
            <div key={i} className="w-fit px-1" style={{ background: 'rgba(0,0,0,0.45)' }}>
              {l}
            </div>
          ))}
        </div>
      ) : hud.showFps ? (
        <div className="absolute left-2 top-2 px-1.5 py-0.5 text-[13px] leading-tight mc-text" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div>{hud.fps} FPS{hud.resScale < 1 ? ` · skala ${Math.round(hud.resScale * 100)}%` : ''}</div>
          <div className="opacity-70">chunki: {hud.chunks} · kresl.: {hud.drawCalls}</div>
        </div>
      ) : (
        <div className="absolute left-2 top-2 text-sm opacity-70 mc-text">{hud.fps} FPS</div>
      )}

      {hud.toast && (
        <div className="absolute left-1/2 top-16 w-[min(420px,90vw)] -translate-x-1/2 px-4 py-2 text-center" style={{ background: 'rgba(0,0,0,0.72)', border: '2px solid #3a3a3a' }}>
          <div className="text-sm text-yellow-300">Osiągnięcie zdobyte</div>
          <div className="text-xl mc-text">{hud.toast.title}</div>
          <div className="text-sm opacity-80">{hud.toast.text}</div>
        </div>
      )}

      {/* 2.10: obsada sesji – widoczna tylko w multiplayerze. */}
      {(hud.players?.length ?? 0) > 0 && (
        <div className="absolute right-2 top-16 flex flex-col items-end gap-1 sm:left-2 sm:right-auto sm:top-9 sm:items-start">
          <div className="px-2 py-1 text-[11px] leading-tight mc-text" style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.18)' }}>
            <span className="text-green-300">● {hud.players!.length}</span> {hud.netPublic ? 'online' : 'w sesji'}
            {hud.netPublic && <span className="ml-1 text-sky-200">· serwer publiczny</span>}
            {!hud.netPublic && hud.netRole === 'host' && <span className="ml-1 text-yellow-200">· gospodarz</span>}
          </div>
          {hud.netPublic && (hud.netSaving ?? 0) > 0 && (
            <div className="px-2 py-0.5 text-[10px] leading-tight text-amber-200 mc-text" style={{ background: 'rgba(0,0,0,0.45)' }}>
              zapisuję {(hud.netSaving ?? 0)} zmian…
            </div>
          )}
          <div className="flex flex-col items-end gap-0.5 sm:items-start">
            {hud.players!.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] leading-tight mc-text"
                style={{ background: 'rgba(0,0,0,0.45)' }}
                title={p.ping >= 0 ? `${p.ping} ms` : 'ping…'}
              >
                <SkinHead skin={p.skin || `hsl(${p.hue} 60% 55%)`} size={14} />
                <span className={p.self ? 'text-yellow-200' : ''}>{p.name}{p.self ? ' (ty)' : ''}</span>
                <span className="text-white/45">{p.ping >= 0 ? `${p.ping} ms` : '…'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hud.minimap && (
        <div className="absolute right-3 top-3 hidden flex-col items-center gap-1 sm:flex">
          <div className="relative" style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.55))' }}>
            <canvas
              ref={mapRef}
              width={96}
              height={96}
              className="pixelated block"
              style={{ width: 116, height: 116, border: '2px solid #0b0b0b', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)', background: '#0c0e12' }}
            />
            <span
              className="pointer-events-none absolute left-1/2 top-0.5 -translate-x-1/2 text-[10px] font-bold"
              style={{ color: '#ffe066', textShadow: '1px 1px 0 #000' }}
            >
              N
            </span>
          </div>
          <div className="px-1.5 py-0.5 text-[10px] leading-none mc-text" style={{ background: 'rgba(0,0,0,0.5)' }}>
            {hud.biome} · dzień {hud.day}
          </div>
        </div>
      )}

      {/* chat messages */}
      <div className="hud-chat absolute left-2 max-w-[640px] space-y-0.5">
        {hud.messages.map((m, i) => (
          <div key={i + '-' + m.t} className="px-2 py-0.5 text-[15px] mc-text" style={{ background: 'rgba(0,0,0,0.45)' }}>
            {m.text}
          </div>
        ))}
      </div>

      {/* bottom HUD */}
      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {label && (
          <div key={label.key} className="mb-2 text-lg mc-text">
            {label.text}
          </div>
        )}
        {/* 2.4: aktywne wzmocnienia napojów */}
        {hud.effects.length > 0 && (
          <div className="mb-0.5 flex flex-wrap justify-center gap-1">
            {hud.effects.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[12px] mc-text"
                style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(120,220,120,0.5)' }}
              >
                <span className="text-[13px] leading-none">{e.icon}</span>
                <span className="leading-none">{e.name}</span>
                <span className="leading-none text-green-300">{Math.ceil(e.left)}s</span>
              </div>
            ))}
          </div>
        )}
        {hud.armor.some((s) => s) && (
          <div className="mb-0.5 flex justify-center gap-[2px]">
            {hud.armor.map((s, i) => {
              if (!s) return <div key={i} style={{ width: 22, height: 22, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(0,0,0,0.45)' }} />;
              const max = durabilityMax(s.id);
              const frac = s.dur !== undefined && max > 0 ? Math.max(0, s.dur / max) : 1;
              return <ArmorPiece key={i} icon={icons[s.id]} frac={frac} enchanted={!!s.ench} />;
            })}
          </div>
        )}
        {hud.mode === 'survival' && (
          <div className="mb-1 flex w-full flex-col gap-1" style={{ width: 'min(432px, calc(100vw - 16px))' }}>
            <div className="hud-strip flex items-center justify-between" style={{ borderRadius: 1 }}>
              <div className="flex gap-[2px]">{hearts}</div>
              <div className="flex flex-row-reverse gap-[2px]">{hud.air < hud.maxAir - 0.01 ? bubbles : null}</div>
            </div>
            <div className="hud-strip flex items-center justify-between" style={{ borderRadius: 1 }}>
              <div className="flex gap-[2px]">{drums}</div>
              <span className="px-1 text-[10px] leading-none opacity-70">
                {Math.round(hud.health)}/20
              </span>
            </div>
          </div>
        )}
        {hud.heldHint && <div className="mb-1 text-sm text-yellow-200 mc-text">{hud.heldHint}</div>}
        {hud.bow >= 0 && (
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm mc-text">Naciąg</span>
            <div className="h-2.5 w-32 border-2 border-black bg-black/60">
              <div className="h-full bg-yellow-300" style={{ width: `${Math.round(hud.bow * 100)}%` }} />
            </div>
          </div>
        )}
        {hud.sprinting && <div className="mb-1 text-sm opacity-80 mc-text">Sprint</div>}
        {hud.mode === 'creative' && hud.flying && <div className="mb-1 text-sm opacity-80 mc-text">✈ Latanie</div>}
        <div
          className="relative mb-1 h-[14px] overflow-hidden"
          style={{
            width: 'min(432px, calc(100vw - 16px))',
            background: guiSprite('exp_background')
              ? `url(${guiSprite('exp_background')}) 0 0 / 100% 100% no-repeat, #101510`
              : 'linear-gradient(180deg, #101510, #1d241d)',
            imageRendering: 'pixelated',
            border: guiSprite('exp_background') ? undefined : '2px solid #0a0a0a',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
          }}
        >
          <div
            className="h-full transition-[width] duration-200"
            style={guiSprite('exp_progress')
              ? {
                width: `${Math.round(hud.xpFrac * 100)}%`,
                background: `url(${guiSprite('exp_progress')}) 0 0 / 100% 100% no-repeat`,
                imageRendering: 'pixelated',
              }
              : { width: `${Math.round(hud.xpFrac * 100)}%`, background: 'linear-gradient(180deg, #a6e86a, #5cae3a)' }}
          />
          <span
            className="absolute inset-0 flex items-center justify-center text-[11px] font-bold"
            style={{ color: '#f4ffcc', textShadow: '1px 1px 0 #000, -1px -1px 0 #000' }}
          >
            {hud.level}
          </span>
        </div>
        <Hotbar hud={hud} icons={icons} onSelect={onSelectSlot} />
      </div>

      {hud.loading < 0.5 && (
        <div className="absolute left-1/2 top-1/4 -translate-x-1/2 text-center mc-text">
          <div className="text-lg">Przygotowuję świat… {Math.round(hud.loading * 100)}%</div>
          <div className="mx-auto mt-1.5 h-2 w-72 overflow-hidden border border-black/60 bg-black/60">
            <div className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-[width] duration-200" style={{ width: `${hud.loading * 100}%` }} />
          </div>
          <div className="mt-1 text-xs opacity-70">Chunki budują się w tle – możesz już się rozejrzeć</div>
        </div>
      )}
    </div>
  );
}
