import { useState } from 'react';
import type { Game } from '../game/engine';
import DiscoveryMapView from './DiscoveryMapView';

export default function WaypointsScreen({ game, onClose }: { game: Game; onClose: () => void }) {
  const [name, setName] = useState('');
  const [showMap, setShowMap] = useState(true);
  const [mapFocus, setMapFocus] = useState<{ x: number; z: number } | null>(null);
  const [, refresh] = useState(0);
  const dimension = game.currentDimension();
  const label = dimension === 'nether' ? 'Nether' : 'Nadświat';

  const add = () => {
    const point = game.addWaypoint(name || `Punkt ${game.waypoints.length + 1}`);
    if (point) {
      setName('');
      refresh((n) => n + 1);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 p-3">
      <div className="flex max-h-[92dvh] w-full max-w-[560px] flex-col gap-3 overflow-y-auto border-2 border-black bg-stone-800 p-4 shadow-xl">
        <div>
          <h2 className="text-2xl text-yellow-200 mc-text">Punkty podróży</h2>
          <p className="text-sm text-gray-300">{label} · zaznacz bazę, kopalnię lub ciekawe miejsce i śledź je na HUD-zie oraz minimapie.</p>
        </div>

        <button className="mc-btn !py-1 !text-sm" onClick={() => setShowMap((v) => !v)}>
          {showMap ? 'Ukryj mapę' : 'Pokaż mapę odkrywania'}
        </button>
        {showMap && <DiscoveryMapView game={game} focus={mapFocus} onChange={() => refresh((n) => n + 1)} />}

        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <label className="sr-only" htmlFor="waypoint-name">Nazwa nowego punktu</label>
          <input
            id="waypoint-name"
            className="mc-input min-w-0 flex-1 !text-base"
            value={name}
            maxLength={32}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="np. Dom albo kopalnia"
          />
          <button type="submit" className="mc-btn !w-auto !px-4 !text-base" disabled={game.waypoints.length >= 12}>Dodaj tutaj</button>
        </form>

        <div className="max-h-40 shrink-0 space-y-2 overflow-y-auto pr-1">
          {game.waypoints.map((point) => {
            const active = point.id === game.activeWaypointId;
            const here = point.dimension === dimension;
            const distance = here ? Math.round(Math.hypot(point.x - game.body.pos.x, point.z - game.body.pos.z)) : null;
            return (
              <div key={point.id} className={`flex flex-wrap items-center gap-2 border p-2 ${active ? 'border-yellow-300 bg-yellow-900/25' : 'border-white/20 bg-black/25'}`}>
                <div className="min-w-0 flex-1">
                  <div className={point.kind === 'death' ? 'text-red-300' : 'text-white'}>{point.kind === 'death' ? '☠ ' : '◆ '}{point.name}</div>
                  <div className="text-xs text-gray-300">
                    {point.dimension === 'nether' ? 'Nether' : 'Nadświat'} · {point.x}, {point.y}, {point.z}{distance !== null ? ` · ${distance} m` : ''}
                  </div>
                </div>
                <button
                  className="mc-btn !w-auto !px-3 !py-1 !text-sm"
                  onClick={() => { game.activateWaypoint(active ? null : point.id); refresh((n) => n + 1); }}
                >
                  {active ? 'Nie śledź' : 'Śledź'}
                </button>
                {here && showMap && <button className="mc-btn !w-auto !px-2 !py-1 !text-sm" onClick={() => setMapFocus({ x: point.x, z: point.z })}>Mapa</button>}
                <button
                  aria-label={`Usuń punkt ${point.name}`}
                  className="mc-btn !w-10 !px-1 !py-1 !text-sm"
                  onClick={() => { game.removeWaypoint(point.id); refresh((n) => n + 1); }}
                >
                  ✕
                </button>
              </div>
            );
          })}
          {!game.waypoints.length && <div className="py-8 text-center text-gray-300">Brak punktów. Stań w ważnym miejscu i wybierz „Dodaj tutaj”.</div>}
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-gray-400">{game.waypoints.length}/12 · skrót K</span>
          <button className="mc-btn !w-40" onClick={onClose}>Wróć do gry</button>
        </div>
      </div>
    </div>
  );
}
