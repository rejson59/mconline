import { SKINS, skinById, type Skin } from '../game/skins';

/**
 * 2.12: podgląd skórki i wybór wyglądu postaci.
 *
 * Awatar rysujemy z prostokątów (bez canvasu i bez Three.js), więc ten sam
 * komponent działa w menu, w pauzie i w poczekalni multiplayera – także na
 * telefonie. Kolory pochodzą wprost z `skins.ts`, czyli z tego samego źródła,
 * z którego silnik buduje awatara w świecie.
 */

export function SkinAvatar({ skin, size = 56, label }: { skin: Skin | string; size?: number; label?: string }) {
  const s = typeof skin === 'string' ? skinById(skin) : skin;
  const px = (n: number) => `${(size * n) / 100}px`;
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size * 1.45 }}
      aria-label={label ?? `Podgląd skórki ${s.name}`}
      role="img"
    >
      {/* włosy / hełm */}
      <div style={{ position: 'absolute', left: px(24), top: 0, width: px(52), height: px(16), background: `#${s.hair.toString(16).padStart(6, '0')}` }} />
      {/* głowa */}
      <div style={{ position: 'absolute', left: px(26), top: px(14), width: px(48), height: px(44), background: `#${s.skin.toString(16).padStart(6, '0')}` }}>
        <span
          style={{
            position: 'absolute',
            top: px(16),
            left: px(8),
            width: px(9),
            height: px(9),
            background: `#${(s.eye ?? s.hair).toString(16).padStart(6, '0')}`,
          }}
        />
        <span
          style={{
            position: 'absolute',
            top: px(16),
            right: px(8),
            width: px(9),
            height: px(9),
            background: `#${(s.eye ?? s.hair).toString(16).padStart(6, '0')}`,
          }}
        />
      </div>
      {/* tułów i ręce */}
      <div style={{ position: 'absolute', left: px(26), top: px(58), width: px(48), height: px(38), background: `#${s.shirt.toString(16).padStart(6, '0')}` }} />
      <div style={{ position: 'absolute', left: px(12), top: px(58), width: px(14), height: px(36), background: `#${s.sleeve.toString(16).padStart(6, '0')}` }} />
      <div style={{ position: 'absolute', right: px(12), top: px(58), width: px(14), height: px(36), background: `#${s.sleeve.toString(16).padStart(6, '0')}` }} />
      {/* nogi i buty */}
      <div style={{ position: 'absolute', left: px(27), top: px(96), width: px(20), height: px(34), background: `#${s.pants.toString(16).padStart(6, '0')}` }} />
      <div style={{ position: 'absolute', right: px(27), top: px(96), width: px(20), height: px(34), background: `#${s.pants.toString(16).padStart(6, '0')}` }} />
      <div style={{ position: 'absolute', left: px(27), bottom: 0, width: px(20), height: px(14), background: `#${s.shoes.toString(16).padStart(6, '0')}` }} />
      <div style={{ position: 'absolute', right: px(27), bottom: 0, width: px(20), height: px(14), background: `#${s.shoes.toString(16).padStart(6, '0')}` }} />
    </div>
  );
}

/** 2.12: sama głowa – do listy graczy w HUD i w pauzie (mała, czytelna). */
export function SkinHead({ skin, size = 16 }: { skin: Skin | string; size?: number }) {
  const s = typeof skin === 'string' ? skinById(skin) : skin;
  const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
  return (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{ width: size, height: size, background: hex(s.skin), border: '1px solid #000' }}
      aria-hidden="true"
    >
      <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '30%', background: hex(s.hair) }} />
      <div style={{ position: 'absolute', left: '16%', top: '46%', width: '22%', height: '20%', background: hex(s.eye ?? s.hair) }} />
      <div style={{ position: 'absolute', right: '16%', top: '46%', width: '22%', height: '20%', background: hex(s.eye ?? s.hair) }} />
    </div>
  );
}

export function SkinPicker({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (id: string) => void;
  /** Wersja do wąskiego paska (poczekalnia multiplayera). */
  compact?: boolean;
}) {
  const current = skinById(value);
  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {SKINS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            title={`${s.name} – ${s.desc}`}
            aria-label={`Skórka ${s.name}`}
            aria-pressed={s.id === current.id}
            className="flex items-center gap-1 border-2 px-1.5 py-0.5 text-[11px] transition-colors"
            style={{
              borderColor: s.id === current.id ? '#f4d03f' : 'rgba(255,255,255,0.15)',
              background: s.id === current.id ? 'rgba(244,208,63,0.18)' : 'rgba(0,0,0,0.35)',
            }}
          >
            <span style={{ width: 10, height: 10, background: `#${s.shirt.toString(16).padStart(6, '0')}`, border: '1px solid #000' }} />
            {s.name}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 border border-white/10 bg-black/30 p-2">
        <SkinAvatar skin={current} size={54} />
        <div className="min-w-0">
          <div className="mc-text text-base text-yellow-200">{current.name}</div>
          <div className="text-[12px] leading-snug text-white/60">{current.desc}</div>
          <div className="text-[11px] text-white/40">Widać ją w grze razem – w świecie i na liście graczy.</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SKINS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            aria-label={`Skórka ${s.name}: ${s.desc}`}
            aria-pressed={s.id === current.id}
            title={s.desc}
            className="flex min-h-[64px] items-center gap-2 border-2 px-2 py-1.5 text-left transition-colors"
            style={{
              borderColor: s.id === current.id ? '#f4d03f' : 'rgba(255,255,255,0.14)',
              background: s.id === current.id ? 'rgba(244,208,63,0.16)' : 'rgba(0,0,0,0.28)',
            }}
          >
            <SkinAvatar skin={s} size={30} />
            <span className="min-w-0">
              <span className="block truncate text-[13px] text-white">{s.name}</span>
              <span className="block text-[10px] leading-tight text-white/45">{s.desc.split(',')[0]}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
