import { useEffect, useState } from 'react';
import type { Settings } from '../utils/settings';
import { applyPreset } from '../utils/settings';
import { JavaButton, JavaPage } from './JavaMenus';
import { SkinPicker } from './SkinPicker';
import { loadSkinId, saveSkinId } from '../game/skins';

/** Functional Java-style options hierarchy; unsupported engine options aren't faked. */
export default function JavaSettings({ settings, onChange, onClose, onSkin, overlay = false }: { settings: Settings; onChange: (s: Settings) => void; onClose: () => void; onSkin?: (id: string) => void; overlay?: boolean }) {
  const [page, setPage] = useState<'main'|'video'|'controls'|'sound'|'skin'|'extensions'>('main');
  const [skin, setSkin] = useState(loadSkinId);
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; e.preventDefault(); e.stopImmediatePropagation(); if (page === 'main') onClose(); else setPage('main'); };
    window.addEventListener('keydown', key, true); return () => window.removeEventListener('keydown', key, true);
  }, [page, onClose]);
  const toggle = (key: keyof Settings, label: string) => <JavaButton width={150} onClick={() => set({ [key]: !settings[key] })}>{label}: {settings[key] ? 'Wł.' : 'Wył.'}</JavaButton>;
  const slider = (key: keyof Settings, label: string, min: number, max: number, step: number, text: string) => <label className="java-slider"><span>{label}: {text}</span><input aria-label={label} type="range" min={min} max={max} step={step} value={settings[key] as number} onChange={e => set({ [key]: +e.target.value })} /></label>;
  return <JavaPage overlay={overlay} title={{ main:'Opcje',video:'Ustawienia grafiki',controls:'Sterowanie',sound:'Muzyka i dźwięki',skin:'Dostosowanie skórki',extensions:'Rozszerzenia przeglądarkowe' }[page]} footer={<JavaButton onClick={() => page === 'main' ? onClose() : setPage('main')}>Gotowe</JavaButton>}>
    {page === 'main' ? <div className="java-options-grid">
      {slider('fov','Pole widzenia',50,110,1,settings.fov === 70 ? 'Normalne' : `${settings.fov}`)}
      <JavaButton width={150} onClick={() => setPage('skin')}>Dostosowanie skórki...</JavaButton>
      <JavaButton width={150} onClick={() => setPage('sound')}>Muzyka i dźwięki...</JavaButton><JavaButton width={150} onClick={() => setPage('video')}>Ustawienia grafiki...</JavaButton>
      <JavaButton width={150} onClick={() => setPage('controls')}>Sterowanie...</JavaButton><JavaButton width={150} onClick={() => setPage('extensions')}>Rozszerzenia...</JavaButton>
    </div> : page === 'video' ? <div className="java-options-grid">
      {slider('renderDistance','Zasięg renderowania',2,14,1,`${settings.renderDistance} chunków`)}
      <JavaButton width={150} onClick={() => set({ guiScale: (settings.guiScale + 1) % 5 })}>Skala interfejsu: {settings.guiScale || 'Auto'}</JavaButton>
      <JavaButton width={150} onClick={() => onChange(applyPreset(settings, settings.quality === 'high' ? 'low' : settings.quality === 'low' ? 'medium' : 'high'))}>Grafika: {settings.quality === 'high' ? 'Dokładna' : settings.quality === 'medium' ? 'Szybka' : settings.quality === 'auto' ? 'Auto' : 'Minimalna'}</JavaButton>
      <JavaButton width={150} onClick={() => set({ fpsCap: settings.fpsCap === 0 ? 30 : settings.fpsCap === 30 ? 60 : 0 })}>Limit klatek: {settings.fpsCap || 'Bez limitu'}</JavaButton>
      {toggle('viewBobbing','Kołysanie widoku')}{toggle('clouds','Chmury')}
      {slider('particles','Cząsteczki',0,1,.1,`${Math.round(settings.particles * 100)}%`)}
      <JavaButton width={150} onClick={() => { if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {}); else void document.documentElement.requestFullscreen?.().catch(() => {}); }}>Pełny ekran</JavaButton>
    </div> : page === 'sound' ? <div className="java-options-grid">{slider('volume','Głośność główna',0,1,.01,`${Math.round(settings.volume * 100)}%`)}<p className="java-muted">Silnik ma jeden wspólny mikser dźwięków. Nie wyświetlamy pozornych suwaków muzyki ani kategorii, których nie obsługuje.</p></div> : page === 'controls' ? <div className="java-options-grid">
      {slider('sensitivity','Czułość myszy',.2,3,.05,`${Math.round(settings.sensitivity * 100)}%`)}{toggle('autoJump','Automatyczny skok')}
      <JavaButton width={150} onClick={() => set({ controlMode: settings.controlMode === 'auto' ? 'desktop' : settings.controlMode === 'desktop' ? 'touch' : 'auto' })}>Sterowanie: {settings.controlMode === 'auto' ? 'Auto' : settings.controlMode === 'desktop' ? 'Mysz' : 'Dotyk'}</JavaButton>
      <div className="java-key-list"><p>W / A / S / D — ruch</p><p>Spacja — skok / 2× lot</p><p>Shift — skradanie</p><p>Ctrl / R / W×2 — sprint</p><p>E — ekwipunek</p><p>F — zamień ręce</p><p>Q / Ctrl+Q — wyrzuć</p><p>T / / — czat / komenda</p><p>F3 — debugowanie</p><p>Esc — powrót / menu gry</p></div>
    </div> : page === 'skin' ? <SkinPicker value={skin} onChange={id => { const selected = saveSkinId(id); setSkin(selected); onSkin?.(selected); }} /> : <div className="java-options-grid">
      {toggle('minimap','Minimapa')}{toggle('showFps','Licznik FPS')}{toggle('autoAttack','Automatyczny atak')}{toggle('autoQuality','Automatyczna jakość')}{toggle('dynamicResolution','Dynamiczna rozdzielczość')}{toggle('lod','Odległy teren')}{toggle('haptics','Wibracje')}{toggle('joystickFixed','Stały drążek')}
      <JavaButton width={150} onClick={() => set({ touchMode: settings.touchMode === 'tap' ? 'buttons' : 'tap' })}>Dotyk: {settings.touchMode === 'tap' ? 'Gesty' : 'Przyciski'}</JavaButton>{slider('touchScale','Rozmiar przycisków',.8,1.25,.05,`${Math.round(settings.touchScale * 100)}%`)}
    </div>}
  </JavaPage>;
}
