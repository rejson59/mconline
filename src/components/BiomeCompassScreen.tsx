import { useEffect, useState } from 'react';
import type { Game } from '../game/engine';
import { BIOME_TARGETS, BiomeSearch, COMPASS_RANGE, COMPASS_STEP } from '../game/biomeCompass';
import type { Biome } from '../game/world';

export default function BiomeCompassScreen({ game, onClose }: { game: Game; onClose: () => void }) {
  const [target, setTarget] = useState<Biome>('Tajga');
  const [search, setSearch] = useState<BiomeSearch | null>(null);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!search || search.done) return;
    let alive = true;
    let raf = 0;
    const step = () => {
      if (!alive) return;
      const done = search.advance();
      setProgress(search.checked);
      if (!done) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [search]);

  const start = () => {
    setNotice('');
    setProgress(0);
    // Reads a deterministic seed field; doesn't load any unexplored chunks.
    setSearch(new BiomeSearch(game.homeWorld, game.body.pos.x, game.body.pos.z, target));
  };

  const mark = () => {
    if (!search?.result) return;
    const w = game.addWaypoint(`Biom: ${target}`, 'custom', search.result);
    if (w) onClose();
    else setNotice('Brak miejsca na znacznik. Usuń zbędny punkt podróży (K) i spróbuj ponownie.');
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
      <section className="flex max-h-[92dvh] w-full max-w-[420px] flex-col gap-3 overflow-y-auto border-2 border-black bg-stone-800 p-4 shadow-xl" aria-label="Kompas biomów">
        <h2 className="text-2xl text-yellow-200 mc-text">Kompas biomów</h2>
        <p className="text-sm text-gray-200">Wybierz biom. Przyrząd szuka najbliższego przybliżonego punktu w promieniu {COMPASS_RANGE} bloków co {COMPASS_STEP} bloki. Poszukiwanie nie odsłania mapy ani nie tworzy chunków.</p>
        <label htmlFor="biome-target">Szukany biom</label>
        <select id="biome-target" className="mc-input !text-base" value={target} onChange={(e) => { setTarget(e.target.value as Biome); setSearch(null); setNotice(''); }}>
          {BIOME_TARGETS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <button className="mc-btn" onClick={start}>Szukaj biomu</button>
        {search && !search.done && <p role="status" className="text-sm text-gray-200">Szukam… {progress}/{search.total} próbek</p>}
        {search?.done && search.result && (
          <div className="space-y-2 border border-green-300 p-2 text-sm" role="status">
            <p>Najbliższy znaleziony obszar: {search.result.x}, {search.result.z} · około {search.result.distance} m.</p>
            <button className="mc-btn" onClick={mark}>Zaznacz i śledź na HUD</button>
          </div>
        )}
        {search?.done && !search.result && <p role="status" className="text-sm text-amber-200">Nie znaleziono biomu w zasięgu {COMPASS_RANGE} bloków. Spróbuj w innym miejscu.</p>}
        {notice && <p role="alert" className="text-sm text-red-200">{notice}</p>}
        <button className="mc-btn" onClick={onClose}>Wróć do gry</button>
      </section>
    </div>
  );
}
