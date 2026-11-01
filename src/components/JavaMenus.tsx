import { playClick, setVolume, setSoundLevels } from '../game/audio';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import type { MainMenu as LegacyMainMenu, PauseMenu as LegacyPauseMenu } from './Menus';
import { Controls, filterAndSortWorlds } from './Menus';
import { exportSave, importSaves, MAX_SAVES } from '../game/saves';
import { guiSprite } from '../game/art/uiSprites';
import { GAME_VERSION } from '../utils/version';
import { loadSettings, saveSettings } from '../utils/settings';
import { useJavaScale } from '../utils/guiScale';
import JavaSettings from './JavaSettings';
import JavaPanorama from './JavaPanorama';

export function JavaButton({ children, onClick, disabled, width = 200 }: { children: ReactNode; onClick?: () => void; disabled?: boolean; width?: number }) {
  return <button className="java-btn" style={{ width }} onClick={() => { const s = loadSettings(); setVolume(s.volume); setSoundLevels(s.soundVolumes); playClick(); onClick?.(); }} disabled={disabled}>{children}</button>;
}
export function JavaPage({ title, children, footer, overlay = false }: { title: string; children: ReactNode; footer?: ReactNode; overlay?: boolean }) {
  const scale = useJavaScale();
  return <div className={`java-screen ${overlay ? 'java-screen-overlay' : 'java-dirt'}`} style={overlay ? undefined : { backgroundImage: `url(${guiSprite('dirt')})` }}>
    <div className="java-page" style={{ width: 320, height: `calc(100% / ${scale})`, transform: `translateX(-50%) scale(${scale})` }}>
      <h1>{title}</h1><div className="java-page-content">{children}</div>{footer && <div className="java-page-footer">{footer}</div>}
    </div>
  </div>;
}
export function JavaMainMenu(props: ComponentProps<typeof LegacyMainMenu>) {
  const { saves, onPlay, onNew, onDelete, onRename, onDuplicate, onImported, onMultiplayer, onAccount, sharedSeed, sharedMode } = props;
  const [view, setView] = useState<'main'|'worlds'|'new'|'options'|'controls'|'edit'|'delete'|'about'>(sharedSeed != null ? 'new' : 'main');
  const [settings, setSettings] = useState(loadSettings), [selected, setSelected] = useState<string | null>(saves[0]?.id ?? null);
  const [query, setQuery] = useState(''), [name, setName] = useState('Nowy świat'), [seed, setSeed] = useState(sharedSeed?.toString() ?? '');
  const [mode, setMode] = useState<'survival'|'creative'>(sharedMode ?? 'survival'), [flat, setFlat] = useState(false), [notice, setNotice] = useState('');
  const [worldTab, setWorldTab] = useState<'game'|'world'>('game');
  const scale = useJavaScale(), world = saves.find(s => s.id === selected);
  useEffect(() => { if (/^#(?:launcher|client)$/.test(window.location.hash)) { try { window.history.replaceState(null, '', window.location.pathname + window.location.search); } catch { /* unavailable history */ } } }, []);
  const back = () => setView('main');
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setView(v => v === 'edit' || v === 'delete' || v === 'new' ? 'worlds' : 'main'); } };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, []);
  const create = () => {
    let number = seed.trim() ? /^-?\d+$/.test(seed.trim()) ? Number(seed) | 0 : [...seed].reduce((v, ch) => Math.imul(v, 31) + ch.charCodeAt(0) | 0, 0) : Math.floor(Math.random() * 2147483647);
    onNew(number, mode, name.trim() || 'Nowy świat', flat ? 'flat' : 'normal');
  };
  const download = () => {
    if (!selected) return; const json = exportSave(selected); if (!json) return;
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' })), a = document.createElement('a'); a.href = url; a.download = `${world?.name || 'swiat'}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  if (view === 'options') return <JavaSettings settings={settings} onChange={s => { setSettings(s); saveSettings(s); }} onClose={back} />;
  if (view === 'controls') return <JavaPage title="Sterowanie" footer={<JavaButton onClick={back}>Gotowe</JavaButton>}><Controls /></JavaPage>;
  if (view === 'worlds') return <JavaPage title="Wybierz świat" footer={<>
    <div className="java-button-row"><JavaButton width={150} disabled={!world} onClick={() => world && onPlay(world.id)}>Graj w wybranym świecie</JavaButton><JavaButton width={150} disabled={saves.length >= MAX_SAVES} onClick={() => { setName('Nowy świat'); setView('new'); }}>Stwórz nowy świat</JavaButton></div>
    <div className="java-button-row"><JavaButton width={72} disabled={!world} onClick={() => { setName(world?.name || 'Świat'); setView('edit'); }}>Edytuj</JavaButton><JavaButton width={72} disabled={!world} onClick={() => setView('delete')}>Usuń</JavaButton><JavaButton width={72} onClick={() => document.getElementById('java-world-import')?.click()}>Importuj</JavaButton><JavaButton width={72} onClick={back}>Anuluj</JavaButton></div>
  </>}>
    <input className="java-input" aria-label="Szukaj światów" placeholder="Szukaj..." value={query} onChange={e => setQuery(e.target.value)} />
    <input id="java-world-import" type="file" accept=".json,application/json" hidden onChange={e => { const file = e.target.files?.[0]; if (!file) return; void file.text().then(text => { const n = importSaves(text); setNotice(n ? `Zaimportowano: ${n}` : 'Nieprawidłowy plik świata.'); onImported?.(); }).catch(() => setNotice('Nie można odczytać pliku.')); e.target.value = ''; }} />
    <div className="java-world-list" role="listbox" aria-label="Zapisane światy">
      {filterAndSortWorlds(saves, query, 'recent').map(s => <button key={s.id} className="java-world" role="option" aria-selected={selected === s.id} onClick={() => setSelected(s.id)} onDoubleClick={() => onPlay(s.id)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onPlay(s.id); } }}>
        <span className="java-world-icon">▦</span><span><strong>{s.name || 'Świat'}</strong><small>{s.id} ({new Date(s.updated ?? 0).toLocaleDateString('pl')})</small><small>{s.mode === 'creative' ? 'Tryb kreatywny' : 'Tryb przetrwania'}{s.worldType === 'flat' ? ', superpłaski' : ''}</small></span>
      </button>)}
      {!saves.length && <p className="java-muted">Brak zapisanych światów.</p>}
    </div>{notice && <p role="status">{notice}</p>}
  </JavaPage>;
  if (view === 'new') return <JavaPage title="Stwórz nowy świat" footer={<div className="java-button-row"><JavaButton width={150} disabled={saves.length >= MAX_SAVES} onClick={create}>Stwórz nowy świat</JavaButton><JavaButton width={150} onClick={() => setView('worlds')}>Anuluj</JavaButton></div>}>
    <div className="java-button-row java-world-tabs"><JavaButton width={150} onClick={() => setWorldTab('game')}>Gra</JavaButton><JavaButton width={150} onClick={() => setWorldTab('world')}>Świat</JavaButton></div>
    {worldTab === 'game' ? <><label className="java-field">Nazwa świata<input autoFocus className="java-input" value={name} onChange={e => setName(e.target.value)} maxLength={64} /></label>
    <div className="java-centered"><JavaButton onClick={() => setMode(mode === 'survival' ? 'creative' : 'survival')}>Tryb gry: {mode === 'survival' ? 'Przetrwanie' : 'Kreatywny'}</JavaButton><p className="java-muted">{mode === 'survival' ? 'Szukaj zasobów, wytwarzaj, zdobywaj poziomy, zdrowie i głód.' : 'Nieograniczone zasoby, swobodne latanie i natychmiastowe niszczenie.'}</p></div></> : <><label className="java-field">Ziarno generatora świata<input className="java-input" value={seed} onChange={e => setSeed(e.target.value)} placeholder="Losowe ziarno" /></label>
    <div className="java-centered"><JavaButton onClick={() => setFlat(!flat)}>Typ świata: {flat ? 'Superpłaski' : 'Domyślny'}</JavaButton></div></>}
    {sharedSeed != null && <p className="java-muted">Świat z linku — wspólne ziarno, lokalny zapis.</p>}
  </JavaPage>;
  if (view === 'delete') return <JavaPage title="Usunąć ten świat?" footer={<div className="java-button-row"><JavaButton width={150} onClick={() => { if (selected) onDelete(selected); setSelected(null); setView('worlds'); }}>Usuń</JavaButton><JavaButton width={150} onClick={() => setView('worlds')}>Anuluj</JavaButton></div>}><p className="java-confirm">„{world?.name || 'Świat'}” zostanie utracony na zawsze!<br />Tej operacji nie można cofnąć.</p></JavaPage>;
  if (view === 'edit') return <JavaPage title="Edytuj świat" footer={<JavaButton onClick={() => { if (selected) onRename?.(selected, name.trim() || 'Świat'); setView('worlds'); }}>Zapisz</JavaButton>}><label className="java-field">Nazwa świata<input className="java-input" value={name} onChange={e => setName(e.target.value)} maxLength={64} /></label><div className="java-centered"><JavaButton onClick={download}>Eksportuj kopię świata</JavaButton><JavaButton onClick={() => { if (selected) onDuplicate?.(selected); setView('worlds'); }}>Utwórz kopię</JavaButton><JavaButton onClick={() => setView('worlds')}>Anuluj</JavaButton></div></JavaPage>;
  if (view === 'about') return <JavaPage title="O tej wersji" footer={<JavaButton onClick={back}>Gotowe</JavaButton>}><p>Nieoficjalny projekt przeglądarkowy BlockCraft {GAME_VERSION}. Interfejs odtwarza Minecraft Java 1.20.4. To nie jest oficjalny Minecraft ani klient Mojang.</p><p>Grafiki i bitmapy czcionki Minecraft: © Mojang / Microsoft. Światy i serwer publiczny tego projektu nie są zgodne z serwerami Java/Bedrock.</p><div className="java-centered"><JavaButton onClick={() => setView('controls')}>Sterowanie i rozszerzenia</JavaButton>{onAccount && <JavaButton onClick={onAccount}>Konto społeczności</JavaButton>}</div></JavaPage>;
  return <div className="java-title-screen" style={{ backgroundImage: `url(${guiSprite('panorama')})` }}>
    <JavaPanorama /><div className="java-panorama-shade" />
    <div className="java-title-canvas" style={{ transform: `translate(-50%,-50%) scale(${scale})` }}>
      <div className="java-title-logo"><img src={guiSprite('logo')!} alt="Minecraft" width={274} height={68} /><img src={guiSprite('edition')!} alt="Java Edition" className="java-edition" /><span className="java-splash">Also try the browser!</span></div>
      <div className="java-title-buttons"><JavaButton onClick={() => setView('worlds')}>Tryb jednoosobowy</JavaButton><JavaButton disabled={!onMultiplayer} onClick={onMultiplayer}>Tryb wieloosobowy</JavaButton><JavaButton onClick={() => setView('about')}>O wersji przeglądarkowej...</JavaButton><div className="java-button-row"><JavaButton width={98} onClick={() => setView('options')}>Opcje...</JavaButton><JavaButton width={98} onClick={() => setView('about')}>Informacje</JavaButton></div></div>
    </div>
    <footer className="java-title-footer"><span>BlockCraft {GAME_VERSION} · Java GUI 1.20.4</span><span>Nieoficjalny projekt · Minecraft © Mojang</span></footer>
  </div>;
}
export function JavaPauseMenu(props: ComponentProps<typeof LegacyPauseMenu>) {
  const [view, setView] = useState<'main'|'options'|'extensions'|'controls'>('main');
  useEffect(() => { const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && view !== 'main') { e.preventDefault(); e.stopImmediatePropagation(); setView('main'); } }; window.addEventListener('keydown', key, true); return () => window.removeEventListener('keydown', key, true); }, [view]);
  if (view === 'options') return <JavaSettings settings={props.settings} onChange={props.onSettings} onClose={() => setView('main')} onSkin={props.onSkin} overlay />;
  return <JavaPage title={view === 'main' ? 'Menu gry' : view === 'controls' ? 'Sterowanie' : 'Rozszerzenia przeglądarkowe'} overlay footer={view !== 'main' ? <JavaButton onClick={() => setView('main')}>Gotowe</JavaButton> : undefined}>
    {view === 'main' ? <div className="java-pause-buttons"><JavaButton onClick={props.onResume}>Powrót do gry</JavaButton><div className="java-button-row"><JavaButton width={98} onClick={props.onJournal}>Postępy</JavaButton><JavaButton width={98} onClick={() => setView('extensions')}>Rozszerzenia...</JavaButton></div><div className="java-button-row"><JavaButton width={98} onClick={() => setView('options')}>Opcje...</JavaButton><JavaButton width={98} onClick={() => setView('controls')}>Sterowanie...</JavaButton></div><JavaButton onClick={() => { if (!props.session) props.onSave(); props.onQuit(); }}>{props.session ? 'Rozłącz' : 'Zapisz i wyjdź do menu'}</JavaButton></div> : view === 'controls' ? <Controls /> : <div className="java-centered">
      {props.onWaypoints && <JavaButton onClick={props.onWaypoints}>Punkty podróży</JavaButton>}{props.onCommands && <JavaButton onClick={props.onCommands}>Czat i komendy</JavaButton>}{!props.session && <JavaButton onClick={props.onSave}>Zapisz świat</JavaButton>}
      {props.session?.players.map(p => <p key={p.id}>{p.name} — {p.ping} ms</p>)}<p className="java-muted">Dziennik, działki i punkty podróży są dodatkami tego projektu, nie elementami oryginalnej Javy.</p>
    </div>}
  </JavaPage>;
}
export function JavaDeathScreen({ onRespawn, onQuit }: { onRespawn: () => void; onQuit: () => void }) {
  const scale = useJavaScale();
  return <div className="java-death"><div style={{ position: 'absolute', top: '25%', left: '50%', width: 300, textAlign: 'center', transform: `translateX(-50%) scale(${scale})`, transformOrigin: 'top center' }}><h1 style={{ fontSize: 16 }}>Zginąłeś!</h1><div className="java-centered" style={{ marginTop: 50 }}><JavaButton onClick={onRespawn}>Odrodzenie</JavaButton><JavaButton onClick={onQuit}>Menu główne</JavaButton></div></div></div>;
}
