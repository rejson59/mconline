import { useEffect, useRef, useState } from 'react';
import { JavaButton, JavaPage } from './JavaMenus';
import { PublicServer, PUBLIC_NAME } from '../game/online';
import { CITY_NAME } from '../game/city';
import { cloudState, CLOUD_CHANGED } from '../game/accountWorlds';
import { openAccountServer } from '../game/accountMultiplayer';
import type { NetLike } from '../game/net';
import type { GameMode } from '../game/engine';
import type { WorldType } from './Menus';
import { loadSkinId } from '../game/skins';
export interface NetStart { net: NetLike; seed: number; mode: GameMode; worldName: string; worldType: WorldType }
/** Only account-authorized servers are exposed. Legacy BroadcastChannel/WebRTC
 * entry points are retired, not hidden behind a cosmetic login check. */
export default function MultiplayerScreen({ onStart, onClose, onAccount }: {
  onStart: (session: NetStart) => void; onClose: () => void; onAccount?: () => void;
  /** Ignored compatibility prop: cannot re-enable unauthenticated transports. */
  defaultMode?: 'public' | 'local' | 'p2p';
}) {
  const [world, setWorld] = useState<'public' | 'city'>('public');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [account, setAccount] = useState(cloudState);
  const net = useRef<PublicServer | null>(null);
  const attempt = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const [canReplace, setCanReplace] = useState(false);
  const handedOff = useRef(false);
  useEffect(() => {
    const changed = () => setAccount(cloudState()); window.addEventListener(CLOUD_CHANGED, changed);
    return () => { window.removeEventListener(CLOUD_CHANGED, changed); attempt.current++; if (!handedOff.current) { pending.current?.abort(); net.current?.close('Anulowano'); } };
  }, []);
  const join = async (selected = world, replace = false) => {
    if (!account.owner || pending.current) return;
    const controller = new AbortController(); pending.current = controller;
    setCanReplace(false);
    const serial = ++attempt.current;
    setBusy(true); setMessage('Potwierdzam konto na serwerze…');
    try {
      const access = await openAccountServer(selected, { replace, signal: controller.signal });
      if (serial !== attempt.current) { access.release(); return; }
      const server = new PublicServer({ name: access.name, pid: access.pid, client: access.client, worldId: selected, onClose: access.release, accountBound: true });
      net.current = server;
      server.skin = loadSkinId();
      server.onProgress = setMessage;
      await server.connect();
      if (serial !== attempt.current) { server.close('Anulowano'); return; }
      handedOff.current = true; pending.current = null;
      onStart({ net: server, seed: server.world.seed, mode: server.world.mode, worldName: server.world.name, worldType: server.world.worldType ?? 'normal' });
    } catch (error) {
      net.current?.close('Błąd połączenia');
      if (serial !== attempt.current) return;
      setCanReplace((error as { code?: string }).code === 'ACCOUNT_IN_USE');
      setBusy(false); setMessage(error instanceof Error ? error.message : 'Nie można połączyć się z serwerem.');
    } finally { if (pending.current === controller) pending.current = null; }
  };
  return <JavaPage title={busy ? 'Łączenie z serwerem...' : 'Tryb wieloosobowy'} footer={<>
    <JavaButton disabled={busy || !account.owner} onClick={() => void join()}>Dołącz do serwera</JavaButton>
    {!account.owner && <JavaButton onClick={onAccount}>Zaloguj się przez rejson59.github.io</JavaButton>}
    <JavaButton onClick={() => { attempt.current++; pending.current?.abort(); net.current?.close('Anulowano'); onClose(); }}>Anuluj</JavaButton>
  </>}>
    <p className="java-muted">{account.owner ? `Konto: ${account.username}. Profil i działki należą do konta, nie do urządzenia.` : 'Tylko zalogowani mogą grać w trybie wieloosobowym. Bez konta nadal możesz grać jednoosobowo.'}</p>
    <div className="java-world-list" role="listbox" aria-label="Serwery">
      {(['public','city'] as const).map(id => <button key={id} className="java-world" role="option" aria-selected={world === id} disabled={busy} onClick={() => setWorld(id)} onDoubleClick={() => void join(id)}>
        <span className="java-world-icon">{id === 'city' ? '▥' : '▦'}</span><span><strong>{id === 'city' ? CITY_NAME : PUBLIC_NAME}</strong><small>{id === 'city' ? 'Creative · działki 32×32 · chronione ulice' : 'Publiczny świat przetrwania'}</small><small>Serwer przeglądarkowy · zapis w chmurze · osobny ekwipunek</small></span>
      </button>)}
    </div>
    {world === 'city' && <p className="java-muted">Creative dla każdego. Wejdź na trawiastą działkę i wpisz /dzialka zajmij (maks. 4). Budujesz tylko u siebie; ulice i wolne działki są chronione. Własność jest przypisana do konta i działa na innych urządzeniach.</p>}
    {canReplace && <div role="alert" className="java-muted">
      <p>Serwer pamięta poprzednie połączenie — nie jest to dowód logowania na innym urządzeniu. Jeśli to pozostałość po odświeżeniu lub awarii, możesz odzyskać dostęp. Naprawdę aktywne poprzednie połączenie zostanie rozłączone.</p>
      <JavaButton disabled={busy} onClick={() => { if (window.confirm('Zastąpić poprzednie połączenie tego konta? Jeśli gra nadal działa w innej karcie lub na innym urządzeniu, zostanie rozłączona.')) void join(world, true); }}>Odzyskaj połączenie</JavaButton>
    </div>}
    {message && <p role="status" style={{ margin: '10px 5px', color: '#ffaa00' }}>{message}</p>}
    <p className="java-muted">Nowy start: 5 listopada 2026. Jedno konto może grać na jednym urządzeniu naraz. Stare niezabezpieczone pokoje lokalne/P2P są wyłączone.</p>
    <p className="java-muted">To serwer tego projektu. Adresy oryginalnych serwerów Minecraft Java / Bedrock nie są obsługiwane.</p>
  </JavaPage>;
}
