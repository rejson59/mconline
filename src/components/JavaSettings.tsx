import { SOUND_CATEGORIES, type SoundCategory } from '../utils/soundSettings';
import { setVolume, setSoundLevels } from '../game/audio';
import { useEffect, useState } from 'react';
import type { Settings } from '../utils/settings';
import { FPS_LIMITS, applyPreset } from '../utils/settings';
import { JavaButton, JavaPage } from './JavaMenus';
import { SkinPicker } from './SkinPicker';
import { loadSkinId, saveSkinId } from '../game/skins';

/** Functional Java-style options hierarchy; unsupported engine options aren't faked. */
export default function JavaSettings({ settings, onChange, onClose, onSkin, overlay = false }: { settings: Settings; onChange: (s: Settings) => void; onClose: () => void; onSkin?: (id: string) => void; overlay?: boolean }) {
  const [page, setPage] = useState<'main'|'video'|'controls'|'sound'|'skin'|'extensions'|'chat'>('main');
  useEffect(() => { setVolume(settings.volume); setSoundLevels(settings.soundVolumes); }, [settings.volume, settings.soundVolumes]);
  const soundLabels: Record<SoundCategory, string> = { music: 'Muzyka', records: 'Bloki dźwiękowe', weather: 'Pogoda', blocks: 'Bloki', hostile: 'Wrogie stworzenia', neutral: 'Przyjazne stworzenia', players: 'Gracze', ambient: 'Otoczenie' };
  const [skin, setSkin] = useState(loadSkinId);
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; e.preventDefault(); e.stopImmediatePropagation(); if (page === 'main') onClose(); else setPage('main'); };
    window.addEventListener('keydown', key, true); return () => window.removeEventListener('keydown', key, true);
  }, [page, onClose]);
  const toggle = (key: keyof Settings, label: string) => <JavaButton width={150} onClick={() => set({ [key]: !settings[key] })}>{label}: {settings[key] ? 'Wł.' : 'Wył.'}</JavaButton>;
  const slider = (key: keyof Settings, label: string, min: number, max: number, step: number, text: string) => <label className="java-slider"><span>{label}: {text}</span><input aria-label={label} type="range" min={min} max={max} step={step} value={settings[key] as number} onChange={e => set({ [key]: +e.target.value })} /></label>;
  return <JavaPage overlay={overlay} title={{ main:'Opcje',chat:'Ustawienia czatu',video:'Ustawienia grafiki',controls:'Sterowanie',sound:'Muzyka i dźwięki',skin:'Dostosowanie skórki',extensions:'Rozszerzenia przeglądarkowe' }[page]} footer={<JavaButton onClick={() => page === 'main' ? onClose() : setPage('main')}>Gotowe</JavaButton>}>
    {page === 'main' ? <div className="java-options-grid">
      {slider('fov','Pole widzenia',50,110,1,settings.fov === 70 ? 'Normalne' : `${settings.fov}`)}
      <JavaButton width={150} onClick={() => setPage('skin')}>Dostosowanie skórki...</JavaButton>
      <JavaButton width={150} onClick={() => setPage('sound')}>Muzyka i dźwięki...</JavaButton><JavaButton width={150} onClick={() => setPage('video')}>Ustawienia grafiki...</JavaButton>
      <JavaButton width={150} onClick={() => setPage('chat')}>Ustawienia czatu...</JavaButton>
      <JavaButton width={150} onClick={() => setPage('controls')}>Sterowanie...</JavaButton><JavaButton width={150} onClick={() => setPage('extensions')}>Rozszerzenia...</JavaButton>
    </div> : page === 'video' ? <div className="java-options-grid">
      {slider('renderDistance','Zasięg renderowania',2,14,1,`${settings.renderDistance} chunków`)}
      <JavaButton width={150} onClick={() => set({ guiScale: (settings.guiScale + 1) % 5 })}>Skala interfejsu: {settings.guiScale || 'Auto'}</JavaButton>
      <JavaButton width={150} onClick={() => onChange(applyPreset(settings, settings.quality === 'high' ? 'low' : settings.quality === 'low' ? 'medium' : 'high'))}>Grafika: {settings.quality === 'high' ? 'Dokładna' : settings.quality === 'medium' ? 'Szybka' : settings.quality === 'auto' ? 'Auto' : 'Minimalna'}</JavaButton>
      <JavaButton width={150} onClick={() => set({ fpsCap: FPS_LIMITS[(FPS_LIMITS.indexOf(settings.fpsCap as typeof FPS_LIMITS[number]) + 1) % FPS_LIMITS.length], fpsCapUserSet: true })}>Limit klatek: {settings.fpsCap || 'Bez limitu'}</JavaButton>
      {slider('entityDistance','Zasięg istot',.5,1.5,.1,`${Math.round(settings.entityDistance * 100)}%`)}
      {slider('brightness','Jasność',0,1,.01,`${Math.round(settings.brightness * 100)}%`)}
      {slider('fovEffects','Efekty pola widzenia',0,1,.01,`${Math.round(settings.fovEffects * 100)}%`)}
      {slider('damageTilt','Przechylenie przy obrażeniach',0,1,.01,`${Math.round(settings.damageTilt * 100)}%`)}
      {toggle('viewBobbing','Kołysanie widoku')}{toggle('clouds','Chmury')}
      {slider('particles','Cząsteczki',0,1,.1,`${Math.round(settings.particles * 100)}%`)}
      <JavaButton width={150} onClick={() => { if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {}); else void document.documentElement.requestFullscreen?.().catch(() => {}); }}>Pełny ekran</JavaButton>
    </div> : page === 'chat' ? <div className="java-options-grid">
      {toggle('chatVisible','Powiadomienia czatu')}
      {slider('chatOpacity','Przezroczystość tekstu',0,1,.05,`${Math.round(settings.chatOpacity * 100)}%`)}
      {slider('chatBackground','Krycie tła',0,1,.05,`${Math.round(settings.chatBackground * 100)}%`)}
      {slider('chatScale','Skala czatu',.5,1,.05,`${Math.round(settings.chatScale * 100)}%`)}
      {slider('chatWidth','Szerokość czatu',.3,1,.05,`${Math.round(settings.chatWidth * 100)}%`)}
      {slider('chatLines','Wiersze czatu',1,10,1,`${settings.chatLines}`)}
      <div data-testid="chat-preview" style={{gridColumn:'1 / -1',width:`${settings.chatWidth * 100}%`,fontSize:12*settings.chatScale,opacity:settings.chatVisible ? settings.chatOpacity : .25,background:`rgba(0,0,0,${settings.chatBackground})`,padding:4}}>Podgląd: &lt;Budowniczy&gt; Witaj w mieście!</div>
      <p className="java-muted" style={{gridColumn:'1 / -1'}}>Zmieniają powiadomienia w HUD. T i / nadal otwierają czat oraz komendy. Zasięg istot zmienia widoczność, nie symulację.</p>
    </div> : page === 'sound' ? <div className="java-options-grid"><div className="java-master-volume">{slider('volume','Głośność główna',0,1,.01,`${Math.round(settings.volume * 100)}%`)}</div>{SOUND_CATEGORIES.map(category => <label key={category} className="java-slider"><span>{soundLabels[category]}: {Math.round(settings.soundVolumes[category] * 100)}%</span><input aria-label={soundLabels[category]} type="range" min={0} max={1} step={.01} value={settings.soundVolumes[category]} onChange={e => set({ soundVolumes: { ...settings.soundVolumes, [category]: +e.target.value } })} /></label>)}<p className="java-muted" style={{ gridColumn: '1 / -1' }}>Oryginalne efekty Java 1.20.4. Muzyka jest własną kompozycją, nie ścieżką Minecrafta. Kanał bloków dźwiękowych działa; szaf grających jeszcze nie ma.</p></div> : page === 'controls' ? <div className="java-options-grid">
      {slider('sensitivity','Czułość myszy',.2,3,.05,`${Math.round(settings.sensitivity * 100)}%`)}{toggle('autoJump','Automatyczny skok')}{toggle('invertMouse','Odwróć mysz')}
      <JavaButton width={150} onClick={() => set({ controlMode: settings.controlMode === 'auto' ? 'desktop' : settings.controlMode === 'desktop' ? 'touch' : 'auto' })}>Sterowanie: {settings.controlMode === 'auto' ? 'Auto' : settings.controlMode === 'desktop' ? 'Mysz' : 'Dotyk'}</JavaButton>
      <div className="java-key-list"><p>W / A / S / D — ruch</p><p>Spacja — skok / 2× lot</p><p>Shift — skradanie</p><p>Ctrl / R / W×2 — sprint</p><p>E — ekwipunek</p><p>F — zamień ręce</p><p>Q / Ctrl+Q — wyrzuć</p><p>T / / — czat / komenda</p><p>F3 — debugowanie</p><p>Esc — powrót / menu gry</p></div>
    </div> : page === 'skin' ? <SkinPicker value={skin} onChange={id => { const selected = saveSkinId(id); setSkin(selected); onSkin?.(selected); }} /> : <div className="java-options-grid">
      {toggle('minimap','Minimapa')}{toggle('showFps','Licznik FPS')}{toggle('autoAttack','Automatyczny atak')}{toggle('autoQuality','Automatyczna jakość')}{toggle('dynamicResolution','Dynamiczna rozdzielczość')}{toggle('lod','Odległy teren')}{toggle('haptics','Wibracje')}{toggle('joystickFixed','Stały drążek')}
      <JavaButton width={150} onClick={() => set({ touchMode: settings.touchMode === 'tap' ? 'buttons' : 'tap' })}>Dotyk: {settings.touchMode === 'tap' ? 'Gesty' : 'Przyciski'}</JavaButton>{slider('touchScale','Rozmiar przycisków',.8,1.25,.05,`${Math.round(settings.touchScale * 100)}%`)}
    </div>}
  </JavaPage>;
}
