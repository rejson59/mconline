import { useEffect, useRef, useState } from 'react';
import type { HUDState } from '../game/engine';
import { displayName, durabilityMax } from '../game/items';

const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
const BUBBLE = ['.XXX.', 'X..XX', 'X.XXX', 'XXXXX', '.XXX.'];

const outline = 'drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000)';

function Heart({ fill }: { fill: 0 | 1 | 2 }) {
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
  return (
    <svg width={16} height={16} viewBox="0 0 5 5" style={{ filter: outline, opacity: pop ? 0.25 : 1 }} shapeRendering="crispEdges">
      {BUBBLE.flatMap((row, y) =>
        row.split('').map((c, x) =>
          c === 'X' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#3a8ee6" /> : c === '.' ? null : null
        )
      )}
      <rect x={1} y={1} width={1} height={1} fill="#fff" />
    </svg>
  );
}

function ArmorPiece({ icon, frac }: { icon: string; frac: number }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 22, height: 22, background: 'rgba(40,40,40,0.5)', border: '1px solid #1a1a1a' }}>
      <img src={icon} className="pixelated" width={18} height={18} draggable={false} />
      {frac < 1 && <span className="dur-bar"><i style={{ width: `${frac * 100}%`, background: frac < 0.25 ? '#e04040' : '#3dba3d' }} /></span>}
    </div>
  );
}

function Drumstick({ fill }: { fill: 0 | 1 | 2 }) {
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

export function Hotbar({ hud, icons }: { hud: HUDState; icons: Record<number, string> }) {
  return (
    <div className="flex" style={{ background: 'rgba(0,0,0,0.35)', border: '2px solid #1a1a1a', padding: 2 }}>
      {hud.hotbar.map((s, i) => {
        const max = s ? durabilityMax(s.id) : 0;
        const frac = s && max && s.dur !== undefined ? Math.max(0, s.dur / max) : 1;
        return (
          <div
            key={i}
            className="relative flex items-center justify-center"
            style={{
              width: 48,
              height: 48,
              border: i === hud.selected ? '3px solid #fff' : '3px solid #6b6b6b',
              outline: i === hud.selected ? '2px solid #000' : 'none',
              zIndex: i === hud.selected ? 2 : 1,
              background: 'rgba(40,40,40,0.35)',
              margin: -1,
            }}
          >
            {s && <img src={icons[s.id]} className="pixelated" width={34} height={34} draggable={false} />}
            {s && hud.mode === 'survival' && s.count > 1 && <span className="mc-count">{s.count}</span>}
            {s && max > 0 && s.dur !== undefined && s.dur < max && (
              <span className="dur-bar"><i style={{ width: `${frac * 100}%`, background: frac < 0.25 ? '#e04040' : '#3dba3d' }} /></span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function HUD({ hud, icons, minimap }: { hud: HUDState; icons: Record<number, string>; minimap?: HTMLCanvasElement | null }) {
  const [label, setLabel] = useState<{ text: string; key: number } | null>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const sel = hud.hotbar[hud.selected];
  const selId = sel ? sel.id : -1;

  useEffect(() => {
    if (selId < 0) { setLabel(null); return; }
    setLabel({ text: displayName(selId), key: Date.now() });
    const t = setTimeout(() => setLabel(null), 2000);
    return () => clearTimeout(t);
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
    <div className="pointer-events-none absolute inset-0 select-none">
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

      {/* crosshair */}
      <div className="absolute left-1/2 top-1/2" style={{ transform: 'translate(-50%,-50%)', mixBlendMode: 'difference' }}>
        <div style={{ position: 'absolute', left: -10, top: -1.5, width: 20, height: 3, background: '#fff' }} />
        <div style={{ position: 'absolute', left: -1.5, top: -10, width: 3, height: 20, background: '#fff' }} />
      </div>

      {/* debug */}
      {hud.debug ? (
        <div className="absolute left-2 top-2 space-y-0.5 text-[15px] leading-tight">
          {[
            `BlockCraft 1.4 (${hud.fps} fps)`,
            `XYZ: ${hud.pos[0].toFixed(2)} / ${hud.pos[1].toFixed(2)} / ${hud.pos[2].toFixed(2)}`,
            `Blok: ${Math.floor(hud.pos[0])} ${Math.floor(hud.pos[1])} ${Math.floor(hud.pos[2])}`,
            `Chunk: ${Math.floor(hud.pos[0] / 16)} ${Math.floor(hud.pos[2] / 16)}  (załadowane: ${hud.chunks})`,
            `Kierunek: ${hud.facing}`,
            `Biom: ${hud.biome}`,
            `Czas: dzień ${hud.day}, ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`,
            `Świat: ${hud.worldName} (${hud.worldType === 'flat' ? 'płaski' : 'normalny'})`,
            `Moby: ${hud.mobs}`,
            `Cel: ${hud.target}`,
            `Ziarno: ${hud.seed}`,
            `Tryb: ${hud.mode === 'creative' ? 'Kreatywny' : 'Przetrwanie'}${hud.flying ? ' (lot)' : ''}${hud.sprinting ? ' sprint' : ''}`,
            `Głód: ${hud.hunger.toFixed(1)}  Pogoda: ${hud.weather === 'rain' ? 'deszcz' : 'jasno'}`,
            `Poziom: ${hud.level} (${Math.round(hud.xpFrac * 100)}% do następnego)  Pancerz: ${hud.armorPoints} pkt`,
          ].map((l, i) => (
            <div key={i} className="w-fit px-1" style={{ background: 'rgba(0,0,0,0.45)' }}>
              {l}
            </div>
          ))}
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

      {hud.minimap && (
        <canvas
          ref={mapRef}
          width={96}
          height={96}
          className="pixelated absolute right-3 top-3 hidden sm:block"
          style={{ width: 112, height: 112, border: '2px solid #111', boxShadow: '0 0 0 2px rgba(255,255,255,0.25)', background: '#111' }}
        />
      )}

      {/* chat messages */}
      <div className="absolute bottom-40 left-2 max-w-[640px] space-y-0.5">
        {hud.messages.map((m, i) => (
          <div key={i + '-' + m.t} className="px-2 py-0.5 text-[15px] mc-text" style={{ background: 'rgba(0,0,0,0.45)' }}>
            {m.text}
          </div>
        ))}
      </div>

      {/* bottom HUD */}
      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 flex-col items-center">
        {label && (
          <div key={label.key} className="mb-2 text-lg mc-text">
            {label.text}
          </div>
        )}
        {hud.armor.some((s) => s) && (
          <div className="mb-0.5 flex justify-center gap-[2px]">
            {hud.armor.map((s, i) => {
              if (!s) return <div key={i} style={{ width: 22, height: 22, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(0,0,0,0.45)' }} />;
              const max = durabilityMax(s.id);
              const frac = s.dur !== undefined && max > 0 ? Math.max(0, s.dur / max) : 1;
              return <ArmorPiece key={i} icon={icons[s.id]} frac={frac} />;
            })}
          </div>
        )}
        {hud.mode === 'survival' && (
          <div className="mb-1 flex w-full flex-col gap-0.5 px-1" style={{ width: 9 * 48 }}>
            <div className="flex justify-between">
              <div className="flex gap-[2px]">{hearts}</div>
              <div className="flex flex-row-reverse gap-[2px]">{hud.air < hud.maxAir - 0.01 ? bubbles : null}</div>
            </div>
            <div className="flex gap-[2px]">{drums}</div>
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
        <div className="relative mb-1 h-[10px]" style={{ width: 9 * 48, background: 'rgba(0,0,0,0.55)', border: '2px solid #1a1a1a' }}>
          <div className="h-full" style={{ width: `${Math.round(hud.xpFrac * 100)}%`, background: '#7ec850' }} />
          <span
            className="absolute inset-0 flex items-center justify-center text-[11px] font-bold"
            style={{ color: '#ffe97a', textShadow: '1px 1px 0 #000, -1px -1px 0 #000' }}
          >
            {hud.level}
          </span>
        </div>
        <Hotbar hud={hud} icons={icons} />
      </div>

      {hud.loading < 0.5 && (
        <div className="absolute left-1/2 top-24 -translate-x-1/2 text-center mc-text">
          <div className="text-lg">Generowanie terenu... {Math.round(hud.loading * 100)}%</div>
          <div className="mx-auto mt-1 h-2 w-64 bg-black/60">
            <div className="h-full bg-green-500" style={{ width: `${hud.loading * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
