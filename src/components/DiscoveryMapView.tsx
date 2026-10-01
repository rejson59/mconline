import { useEffect, useRef, useState } from 'react';
import type { Game } from '../game/engine';
import { CS } from '../game/constants';
import { MAP_BIOMES, MAP_COLORS } from '../game/discoveryMap';

const SIZE = 384;

/** Pause-screen atlas. Canvas stays at a fixed drawing budget (384² pixels),
 * regardless of world size; only surveyed tiles in the current viewport render. */
export default function DiscoveryMapView({ game, focus, onChange }: { game: Game; focus: { x: number; z: number } | null; onChange: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [center, setCenter] = useState(() => ({ cx: Math.floor(game.body.pos.x / CS), cz: Math.floor(game.body.pos.z / CS) }));
  const [span, setSpan] = useState(32);
  const dim = game.currentDimension();
  const player = { cx: Math.floor(game.body.pos.x / CS), cz: Math.floor(game.body.pos.z / CS) };
  const startX = center.cx - Math.floor(span / 2), startZ = center.cz - Math.floor(span / 2);
  const waypoints = game.waypoints.filter((w) => w.dimension === dim);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const tileSize = SIZE / span;
    ctx.fillStyle = '#22252a';
    ctx.fillRect(0, 0, SIZE, SIZE);
    for (let z = 0; z < span; z++) for (let x = 0; x < span; x++) {
      const t = game.discovery.get(dim, startX + x, startZ + z);
      if (!t) continue;
      ctx.fillStyle = MAP_COLORS[t[2]];
      ctx.fillRect(x * tileSize, z * tileSize, tileSize + 0.25, tileSize + 0.25);
      if (t[3] > 92 && dim === 'overworld') {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(x * tileSize, z * tileSize, tileSize + 0.25, tileSize + 0.25);
      }
    }
    // White diamond = player; red = last death; gold = active waypoint.
    const dot = (x: number, z: number, color: string, radius: number) => {
      const px = (x / CS - startX) * tileSize, pz = (z / CS - startZ) * tileSize;
      if (px < 0 || pz < 0 || px >= SIZE || pz >= SIZE) return;
      ctx.fillStyle = '#161616';
      ctx.fillRect(px - radius - 1, pz - radius - 1, radius * 2 + 2, radius * 2 + 2);
      ctx.fillStyle = color;
      ctx.fillRect(px - radius, pz - radius, radius * 2, radius * 2);
    };
    for (const w of waypoints) dot(w.x, w.z, w.kind === 'death' ? '#f46a66' : w.id === game.activeWaypointId ? '#ffe76e' : '#ffca73', 3);
    dot(game.body.pos.x, game.body.pos.z, '#ffffff', 4);
  }, [game, dim, span, startX, startZ, game.activeWaypointId, game.waypoints]);

  useEffect(() => {
    if (focus) setCenter({ cx: Math.floor(focus.x / CS), cz: Math.floor(focus.z / CS) });
  }, [focus]);

  const pan = (dx: number, dz: number) => setCenter((c) => ({ cx: c.cx + dx * Math.max(1, Math.floor(span / 3)), cz: c.cz + dz * Math.max(1, Math.floor(span / 3)) }));
  const mark = (cx: number, cz: number) => {
    const tile = game.discovery.get(dim, cx, cz);
    if (!tile) return;
    const x = cx * CS + CS / 2, z = cz * CS + CS / 2;
    const point = game.addWaypoint(`${MAP_BIOMES[tile[2]]} ${cx},${cz}`, 'custom', { x, y: tile[3] + 1, z });
    if (point) onChange();
  };

  const atMap = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    mark(startX + Math.floor((event.clientX - rect.left) / rect.width * span),
      startZ + Math.floor((event.clientY - rect.top) / rect.height * span));
  };

  return (
    <section className="flex shrink-0 flex-col items-center gap-2" aria-label="Mapa odkrywania">
      <div className="flex w-full flex-wrap items-center justify-between gap-2 text-sm text-gray-200">
        <span>Mapa · {dim === 'nether' ? 'Nether' : 'Nadświat'} · {game.discovery.count(dim)} odkrytych pól</span>
        <div className="flex gap-1">
          <button className="mc-btn !w-auto !px-2 !py-1 !text-sm" onClick={() => setCenter(player)}>Do mnie</button>
          <button aria-label="Przybliż mapę" className="mc-btn !w-9 !py-1" disabled={span <= 16} onClick={() => setSpan((s) => Math.max(16, s / 2))}>+</button>
          <button aria-label="Oddal mapę" className="mc-btn !w-9 !py-1" disabled={span >= 64} onClick={() => setSpan((s) => Math.min(64, s * 2))}>−</button>
        </div>
      </div>
      <div className="flex w-full max-w-[430px] items-center gap-1">
        <button aria-label="Przesuń mapę na zachód" className="mc-btn !w-8 !px-0" onClick={() => pan(-1, 0)}>←</button>
        <div className="min-w-0 flex-1">
          <button aria-label="Przesuń mapę na północ" className="mc-btn !py-0 !text-sm" onClick={() => pan(0, -1)}>↑ N</button>
          <canvas ref={canvas} width={SIZE} height={SIZE} onClick={atMap}
            aria-label="Odkryta mapa; kliknij odkryte pole, aby postawić znacznik"
            className="block aspect-square w-full cursor-crosshair border border-white/30 [image-rendering:pixelated]" />
          <button aria-label="Przesuń mapę na południe" className="mc-btn !py-0 !text-sm" onClick={() => pan(0, 1)}>↓ S</button>
        </div>
        <button aria-label="Przesuń mapę na wschód" className="mc-btn !w-8 !px-0" onClick={() => pan(1, 0)}>→</button>
      </div>
      <button className="mc-btn !py-1 !text-sm" disabled={!game.discovery.get(dim, center.cx, center.cz) || game.waypoints.length >= 12} onClick={() => mark(center.cx, center.cz)}>
        Zaznacz środek mapy
      </button>
      <p className="text-center text-xs text-gray-300">Ciemne pola są nieodkryte. Kliknij odkryte pole, aby zaznaczyć cel (limit 12). Biały: ty · złoty: cel · czerwony: śmierć. Strzałki przesuwają mapę.</p>
    </section>
  );
}
