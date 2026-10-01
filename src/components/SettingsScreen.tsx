import { useMemo, useState } from 'react';
import { applyPreset, DEFAULT_SETTINGS, effectiveDetail, type ControlMode, type Settings, type TouchMode } from '../utils/settings';
import { detectInputKind } from '../utils/input';
import {
  PRESETS,
  autoPreset,
  describeProfile,
  recommendPreset,
  type DeviceProfile,
  type PresetName,
} from '../utils/performance';

// Keep the button component identity stable: the HUD refreshes frequently
// during play, and defining this inside SettingsScreen remounted every option
// button on each refresh, interrupting touch taps on slower devices.
const Btn = ({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) => (
  <button
    className={`mc-btn !py-2 !text-[15px] ${active ? 'ring-2 ring-inset ring-yellow-300' : ''}`}
    onClick={onClick}
    aria-pressed={active}
  >
    {children}
  </button>
);

/**
 * BlockCraft 2.0 – wspólny ekran opcji dla menu głównego i pauzy.
 * Zakładki: Grafika (automat jakości + szczegóły), Sterowanie (mysz + dotyk),
 * Dźwięk i HUD. Duże elementy dotykowe, wszystko działa też na małych ekranach.
 */
export default function SettingsScreen({
  settings,
  onChange,
  onClose,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'gfx' | 'controls' | 'sound'>('gfx');
  // Profil urządzenia liczony raz – służy tylko do podglądu i trybu „Auto”.
  const profile: DeviceProfile = useMemo(() => autoPreset().profile, []);
  const auto = recommendPreset(profile);
  const detail = effectiveDetail(settings, profile);
  const detailText = { auto: 'Auto', low: 'Oszczędne', full: 'Pełne' };
  const nextDetail = (v: Settings['textureDetail']): Settings['textureDetail'] => v === 'auto' ? 'low' : v === 'low' ? 'full' : 'auto';

  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });

  const pickQuality = (name: 'auto' | PresetName) => {
    if (name === 'auto') onChange(applyPreset({ ...settings, quality: 'auto' }, auto, true));
    else onChange(applyPreset(settings, name));
  };

  const qualityLabel: Record<Settings['quality'], string> = {
    auto: `Auto (${PRESETS[auto].label.toLowerCase()})`,
    low: 'Niskie',
    medium: 'Średnie',
    high: 'Wysokie',
  };

  const cycleFps = () => {
    const order = [0, 30, 60];
    const i = order.indexOf(settings.fpsCap);
    set({ fpsCap: order[(i + 1) % order.length] });
  };
  const fpsLabel = settings.fpsCap === 0 ? 'bez limitu' : `${settings.fpsCap} FPS`;

  const cycleTouch = () => set({ touchMode: (settings.touchMode === 'tap' ? 'buttons' : 'tap') as TouchMode });

  /** 2.5: wersja PC / dotykowa z podglądem, co wykrył automat. */
  const cycleControlMode = () => {
    const order: ControlMode[] = ['auto', 'desktop', 'touch'];
    const i = order.indexOf(settings.controlMode);
    set({ controlMode: order[(i + 1) % order.length] });
  };
  const detected = detectInputKind();
  const modeLabel: Record<ControlMode, string> = {
    auto: `Automat (wykryto: ${detected === 'touch' ? 'dotyk' : 'komputer'})`,
    desktop: 'Komputer (mysz + klawiatura)',
    touch: 'Dotyk (telefon / tablet)',
  };

  return (
    <div className="flex w-full flex-col gap-3 bg-black/55 p-4">
      <div className="flex items-center justify-between">
        <div className="text-lg mc-text">Opcje</div>
        <div className="flex gap-2">
          <button
            className="mc-btn !w-auto !px-3 !py-1 !text-xs"
            onClick={() => onChange({ ...DEFAULT_SETTINGS })}
            title="Przywróć domyślne ustawienia obrazu, sterowania i dźwięku"
          >
            Przywróć domyślne
          </button>
          <button className="mc-btn !w-auto !px-4 !py-1 !text-sm" onClick={onClose}>
            Gotowe
          </button>
        </div>
      </div>

      <div className="flex gap-2" role="tablist" aria-label="Zakładki opcji">
        {(
          [
            ['gfx', 'Grafika'],
            ['controls', 'Sterowanie'],
            ['sound', 'Dźwięk i HUD'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            id={`settings-tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            aria-controls={`settings-panel-${id}`}
            className="mc-btn !py-1.5 !text-sm"
            style={tab === id ? { background: 'linear-gradient(#8e98d6,#6c75b8)', color: '#ffffa0' } : undefined}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div id="settings-panel-gfx" role="tabpanel" aria-labelledby="settings-tab-gfx" hidden={tab !== 'gfx'} className="flex flex-col gap-3">
          <div className="text-xs leading-snug text-green-300 mc-text">Twoje urządzenie: {describeProfile(profile)}</div>
          <div className="grid grid-cols-2 gap-2">
            <Btn active={settings.quality === 'auto'} onClick={() => pickQuality('auto')}>
              Jakość: {qualityLabel.auto}
            </Btn>
            <div className="grid grid-cols-3 gap-1">
              {(['low', 'medium', 'high'] as PresetName[]).map((p) => (
                <button
                  key={p}
                  className="mc-btn !px-1 !py-2 !text-[13px]"
                  aria-pressed={settings.quality === p}
                  style={settings.quality === p ? { background: 'linear-gradient(#8e98d6,#6c75b8)', color: '#ffffa0' } : undefined}
                  onClick={() => pickQuality(p)}
                >
                  {PRESETS[p].label}
                </button>
              ))}
            </div>
          </div>
          {settings.quality === 'auto' && (
            <div className="text-[11px] leading-tight opacity-70">
              Tryb Auto dobiera grafikę do urządzenia przy każdym uruchomieniu gry. Wskazówka na dziś: {PRESETS[auto].label.toLowerCase()}.
            </div>
          )}
          <OptionSlider label="Zasięg renderowania" value={settings.renderDistance} min={2} max={14} step={1} fmt={(v) => `${v} chunków`} onChange={(v) => set({ renderDistance: v })} />
          <OptionSlider label="Rozdzielczość" value={settings.pixelRatio} min={0.75} max={2} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ pixelRatio: v })} />
          <Btn onClick={() => set({ textureDetail: nextDetail(settings.textureDetail) })}>
            Tekstury: {detailText[settings.textureDetail]} ({detail.textureDetail === 'low' ? '8 px/kafelek' : '16 px/kafelek'})
          </Btn>
          <Btn onClick={() => set({ effectDetail: nextDetail(settings.effectDetail) })}>
            Efekty: {detailText[settings.effectDetail]} ({detail.effectDetail === 'low' ? 'mniej cząsteczek i opadów' : 'pełne'})
          </Btn>
          <OptionSlider label="Cząsteczki i deszcz" value={settings.particles} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ particles: v })} />
          <Btn active={settings.dynamicResolution} onClick={() => set({ dynamicResolution: !settings.dynamicResolution })}>
            Dynamiczna rozdzielczość: {settings.dynamicResolution ? 'włączona' : 'wyłączona'}
          </Btn>
          <Btn active={settings.clouds} onClick={() => set({ clouds: !settings.clouds })}>
            Chmury: {settings.clouds ? 'włączone' : 'wyłączone'}
          </Btn>
          <Btn active={settings.fpsCap > 0} onClick={cycleFps}>
            Limit klatek: {fpsLabel}
          </Btn>
      </div>
      <div id="settings-panel-controls" role="tabpanel" aria-labelledby="settings-tab-controls" hidden={tab !== 'controls'} className="flex flex-col gap-3">
          <div className="text-xs text-green-300 mc-text">Wersja sterowania</div>
          <Btn onClick={cycleControlMode}>
            Tryb sterowania: {modeLabel[settings.controlMode]}
          </Btn>
          <div className="text-[11px] leading-tight opacity-70">
            Automat wybiera wersję wg głównego wskaźnika urządzenia – ekran dotykowy w laptopie NIE wymusza już sterowania mobilnego.
            Jeśli coś wykrył źle, wymuś wersję „Komputer” albo „Dotyk”. Zmiana działa od razu, bez restartu świata.
          </div>
          <OptionSlider label="Czułość patrzenia" value={settings.sensitivity} min={0.2} max={3} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ sensitivity: v })} />
          <OptionSlider label="Pole widzenia" value={settings.fov} min={50} max={110} step={1} fmt={(v) => `${v}°`} onChange={(v) => set({ fov: v })} />
          <div className="mt-1 text-xs text-green-300 mc-text">Ekran dotykowy</div>
          <Btn onClick={cycleTouch}>
            Sposób kopania: {settings.touchMode === 'tap' ? 'Tapnij / przytrzymaj' : 'Przyciski ⛏ ▣'}
          </Btn>
          <Btn active={settings.joystickFixed} onClick={() => set({ joystickFixed: !settings.joystickFixed })}>
            Drążek: {settings.joystickFixed ? 'stały w rogu' : 'pojawia się pod palcem'}
          </Btn>
          <Btn active={settings.autoJump} onClick={() => set({ autoJump: !settings.autoJump })}>
            Auto-skok na schodki: {settings.autoJump ? 'włączony' : 'wyłączony'}
          </Btn>
          <Btn active={settings.haptics} onClick={() => set({ haptics: !settings.haptics })}>
            Wibracje: {settings.haptics ? 'włączone' : 'wyłączone'}
          </Btn>
          <Btn active={settings.viewBobbing} onClick={() => set({ viewBobbing: !settings.viewBobbing })}>
              Kołysanie kamery: {settings.viewBobbing ? 'włączone' : 'wyłączone'}
          </Btn>
      </div>

      <div id="settings-panel-sound" role="tabpanel" aria-labelledby="settings-tab-sound" hidden={tab !== 'sound'} className="flex flex-col gap-3">
          <OptionSlider label="Głośność (0% = wyciszenie wszystkich dźwięków)" value={settings.volume} min={0} max={1} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ volume: v })} />
          <Btn active={settings.minimap} onClick={() => set({ minimap: !settings.minimap })}>
            Minimapa: {settings.minimap ? 'włączona' : 'wyłączona'}
          </Btn>
          <Btn active={settings.showFps} onClick={() => set({ showFps: !settings.showFps })}>
            Rozszerzony licznik FPS: {settings.showFps ? 'włączony' : 'wyłączony'}
          </Btn>
      </div>
    </div>
  );
}

export function OptionSlider({
  label,
  value,
  min,
  max,
  step,
  fmt,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="relative w-full">
      <input
        type="range"
        className="mc-range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-valuetext={fmt(value)}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center text-[15px] mc-text">
        {label}: {fmt(value)}
      </div>
    </div>
  );
}
