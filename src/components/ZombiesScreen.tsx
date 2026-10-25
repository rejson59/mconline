import { useState } from 'react';
import { ZOMBIES_MAPS, getMapLayout } from '../game/zombies';
import type { ZombiesMapId } from '../game/zombies';

export default function ZombiesScreen({
  onStart,
  onBack,
}: {
  onStart: (mapId: ZombiesMapId) => void;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<ZombiesMapId>('deadend');
  const layout = getMapLayout(selected);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-black to-black" />
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, #ef4444 0%, transparent 60%)' }} />
      <div className="relative z-10 flex h-full w-full flex-col items-center overflow-y-auto px-3 py-4 sm:px-6">
        <div className="w-full max-w-[1100px] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <button className="mc-btn !w-auto !px-4" onClick={onBack}>← Powrót</button>
            <div className="text-xs text-white/60">BlockCraft ZOMBIES • 1:1 Hypixel</div>
          </div>

          <div className="text-center">
            <h1 className="text-4xl font-black tracking-widest text-red-500" style={{ textShadow: '0 2px 0 #7f1d1d, 0 6px 20px rgba(239,68,68,0.6)' }}>ZOMBIES</h1>
            <div className="text-sm text-white/70 mt-1">Wybierz mapę • 4 graczy • 30 rund • Drzwi, Perki, Ultimate</div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(ZOMBIES_MAPS) as ZombiesMapId[]).map((id) => {
              const m = ZOMBIES_MAPS[id];
              const isSel = selected === id;
              return (
                <button
                  key={id}
                  onClick={() => setSelected(id)}
                  className={`text-left p-3 border-2 transition-all ${isSel ? 'bg-red-900/40 border-red-500 scale-[1.02]' : 'bg-black/40 border-white/10 hover:border-white/20'}`}
                >
                  <div className="text-lg font-bold text-white">{m.name}</div>
                  <div className="text-xs text-red-300">{m.subtitle}</div>
                  <div className="text-xs text-white/60 mt-2 leading-snug">{m.description}</div>
                  <div className="mt-2 text-[11px] text-white/40">Spawn: {m.spawnRoomId} • Power: {m.powerRoomId}</div>
                  {isSel && <div className="mt-2 text-xs font-bold text-emerald-400">● WYBRANO</div>}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 mc-card p-4">
              <div className="text-lg text-yellow-200 mb-2">{layout.meta.name} — szczegóły</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-black/30 p-2 border border-white/10">
                  <div className="text-white/50">Pokoje</div>
                  <div className="text-white font-semibold">{layout.rooms.length}</div>
                  <div className="text-white/60 mt-1">{layout.rooms.map(r => r.name).join(' • ')}</div>
                </div>
                <div className="bg-black/30 p-2 border border-white/10">
                  <div className="text-white/50">Drzwi</div>
                  <div className="text-white font-semibold">{layout.doors.length} przejść</div>
                  <div className="text-white/60 mt-1">{layout.doors.map(d => `${d.from}→${d.to} ${d.cost}g`).join(' • ')}</div>
                </div>
                <div className="bg-black/30 p-2 border border-white/10">
                  <div className="text-white/50">Sklepy / Perki</div>
                  <div className="text-white font-semibold">{layout.shops.length}</div>
                  <div className="text-white/60 mt-1">{layout.shops.map(s => s.kind === 'weapon_wall' ? s.weaponId : s.perkId ?? s.kind).join(', ')}</div>
                </div>
                <div className="bg-black/30 p-2 border border-white/10">
                  <div className="text-white/50">Okna do naprawy</div>
                  <div className="text-white font-semibold">{layout.rooms.reduce((a, r) => a + r.windows, 0)}</div>
                  <div className="text-white/60 mt-1">Każde daje 30g, pełne 50g bonusu</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="border border-emerald-500/30 bg-emerald-900/20 p-2">
                  <div className="text-emerald-300 font-semibold">Perki Dead End</div>
                  <div className="text-white/70">Fast Revive (500), Speed (500), Flame/Frozen (750/1000), Quick Fire (1000), Extra Health (1000), Extra Weapon (1500)</div>
                </div>
                <div className="border border-amber-500/30 bg-amber-900/20 p-2">
                  <div className="text-amber-300 font-semibold">Złoto</div>
                  <div className="text-white/70">Hit 10g (15g crit), Kill +20-65g, Okno 30g, Runda bonus, Double Gold powerup</div>
                </div>
              </div>
            </div>

            <div className="mc-card p-4 flex flex-col gap-3">
              <div className="text-base text-white">Gotowy?</div>
              <div className="text-xs text-white/60">Tryb publiczny (wszyscy na tej samej arenie) + solo/co-op 4. Startujesz w {layout.meta.spawnRoomId} z Pistoletem (300 ammo). Otwieraj drzwi, kupuj Shotgun w Office/Library, Sniper w Apartments/Dungeon, włącz prąd, kupuj perki, ulepszaj w Garden/Graveyard.</div>
              <button className="mc-btn mc-btn-primary text-lg py-3" onClick={() => onStart(selected)}>
                ▶ GRAJ ZOMBIES: {layout.meta.name.toUpperCase()}
              </button>
              <div className="text-[11px] text-white/40">MVP: Dead End w pełni grywalny. Bad Blood / Alien Arcadium / Prison mają layout 1:1 – spawn i bossy aktywne w v2.33.</div>
              <div className="text-[11px] text-white/30">Tip: Celuj w głowę – Sniper przebija 2-4 zombie na raz. Shotgun 10 pelletów z bliska = instant kill do rundy 8.</div>
            </div>
          </div>

          <div className="mc-card p-3 text-xs text-white/60">
            <div className="text-white font-semibold mb-1">Jak grać (1:1 Hypixel)</div>
            <ul className="list-disc pl-4 space-y-1">
              <li><b className="text-white">Rundy 1-30:</b> Co rundę więcej zombie, mocniejszy pancerz (Chain → Iron) i szybsze. Boss co 10 rund (Inferno r10, Wither r20, Giant r30).</li>
              <li><b className="text-white">Złoto:</b> Strzelanie, zabijanie, naprawa okien (przytrzymaj przy oknie). Drzwi 500-1250g, perki 500-1500g, Mystery Chest 1000g, Ultimate 1500g.</li>
              <li><b className="text-white">Perki:</b> Wymagają prądu (Power Station). Gubisz je po padnięciu – Ultimate zostaje.</li>
              <li><b className="text-white">Co-op:</b> Padniętego reanimujesz w 1,5s (0,3s z Fast Revive). Wszyscy muszą przeżyć rundę.</li>
              <li><b className="text-white">Power-ups:</b> Insta-Kill, Max Ammo, Double Gold dropią losowo z zombie.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
