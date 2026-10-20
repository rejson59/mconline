import { useEffect, useRef, useState } from 'react';
import {
  createLocalLink,
  createRtcGuest,
  createRtcHost,
  makeRoomCode,
  NetSession,
  normalizeRoom,
  type NetPlayer,
  type WorldHandshake,
} from '../game/net';
import type { GameMode } from '../game/engine';
import type { WorldType } from './Menus';
import CloseButton from './CloseButton';

/**
 * 2.10: poczekalnia multiplayer.
 *
 * Dwa sposoby grania bez serwera:
 *  • „Ta przeglądarka” – pokój na `BroadcastChannel`. Wystarczy otworzyć grę
 *    w drugiej karcie/oknie (także na drugim monitorze) i wpisać ten sam kod.
 *    Zero konfiguracji, działa też offline.
 *  • „Przez internet” – WebRTC z ręcznym sygnalizowaniem. Gospodarz wysyła
 *    kod zaproszenia, gość odsyła kod odpowiedzi. Żadnego serwera.
 *
 * Ekran jest celowo „krok po kroku”, bo ręczne sygnalizowanie jest trudne do
 * wytłumaczenia w dwóch zdaniach – duże przyciski „Kopiuj” i „Wklej” robią
 * większość roboty za gracza (także na telefonie).
 */

export interface NetStart {
  net: NetSession;
  seed: number;
  mode: GameMode;
  worldType: WorldType;
  worldName: string;
}

const NICK_KEY = 'blockcraft-nick';

function loadNick(): string {
  try {
    return (localStorage.getItem(NICK_KEY) || '').slice(0, 20);
  } catch {
    return '';
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard?.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const btn = 'mc-btn !w-auto !px-4 !py-2 !text-[15px]';
const btnPrimary = 'mc-btn mc-btn-primary !w-auto !px-5 !py-2 !text-[15px]';
const inputCls = 'mc-input !py-2 !text-[15px]';

export default function MultiplayerScreen({
  onStart,
  onClose,
}: {
  onStart: (s: NetStart) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(() => loadNick() || 'Gracz');
  const [tab, setTab] = useState<'local' | 'internet'>('local');
  const [role, setRole] = useState<'host' | 'guest'>('host');
  const [room, setRoom] = useState('las-123');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000));
  const [mode, setMode] = useState<GameMode>('survival');
  const [worldType, setWorldType] = useState<WorldType>('normal');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [players, setPlayers] = useState<NetPlayer[]>([]);
  const [invite, setInvite] = useState('');
  const [answerIn, setAnswerIn] = useState('');
  const [answerOut, setAnswerOut] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const session = useRef<NetSession | null>(null);
  /** Po wejściu do świata sesja przechodzi do silnika – nie zamykamy jej. */
  const handedOff = useRef(false);
  const rtc = useRef<ReturnType<typeof createRtcHost> | ReturnType<typeof createRtcGuest> | null>(null);
  const tick = useRef(0);

  useEffect(() => {
    try {
      localStorage.setItem(NICK_KEY, name.trim().slice(0, 20) || 'Gracz');
    } catch {
      /* prywatny tryb przeglądarki */
    }
  }, [name]);

  // Sprzątanie po wyjściu z poczekalni.
  useEffect(
    () => () => {
      clearInterval(tick.current);
      if (!handedOff.current) session.current?.close('Opuszczono poczekalnię');
      if (!handedOff.current) rtc.current?.close();
    },
    []
  );

  /** Zamyka poprzednią sesję, żeby „Odśwież pokój” nie zostawił dwóch gospodarzy. */
  const reset = () => {
    clearInterval(tick.current);
    handedOff.current = false;
    session.current?.close('Nowa sesja');
    session.current = null;
    rtc.current?.close();
    rtc.current = null;
    setPlayers([]);
    setInvite('');
    setAnswerIn('');
    setAnswerOut('');
    setStatus('idle');
    setMessage('');
  };

  const pump = (s: NetSession) => {
    clearInterval(tick.current);
    tick.current = window.setInterval(() => s.tick(), 250);
  };

  const handOff = (s: NetSession) => {
    handedOff.current = true;
    clearInterval(tick.current);
    session.current = null;
    onStart({
      net: s,
      seed: s.world?.seed ?? seed,
      mode: s.world?.mode ?? mode,
      worldType: s.world?.worldType ?? worldType,
      worldName: s.world?.name ?? `Świat ${name.trim() || 'Gracza'}`,
    });
  };

  const wire = (s: NetSession) => {
    session.current = s;
    s.onStatus = (st, err) => {
      setStatus(st === 'connected' ? 'connected' : st === 'error' ? 'error' : st === 'closed' ? 'error' : 'connecting');
      if (err) setMessage(err);
      else if (st === 'connected' && s.role === 'guest') setMessage('Połączono! Czekam, aż gospodarz uruchomi świat…');
    };
    s.onPeers = (list) => setPlayers(list);
    s.onStart = () => handOff(s);
    s.onReady = (w: WorldHandshake) => {
      setMessage(
        w.started
          ? 'Gospodarz jest w świecie – wchodzę…'
          : 'Połączono. Gospodarz wybierze świat i da znać o starcie.'
      );
    };
  };

  const startLocalHost = () => {
    reset();
    const code = normalizeRoom(room) || makeRoomCode();
    setRoom(code);
    const s = new NetSession({ role: 'host', name: name.trim() || 'Gracz', transport: 'local' });
    s.setWorld({ seed, mode, worldType, name: `Świat ${name.trim() || 'Gracza'}`, time: 0.25, day: 1, weather: 'clear' });
    wire(s);
    try {
      s.attach(createLocalLink(code, (raw) => s.ingest(raw)));
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Ta przeglądarka nie obsługuje pokoi lokalnych.');
      return;
    }
    setStatus('connected');
    setMessage(`Pokój „${code}” otwarty. Otwórz grę w drugiej karcie i wpisz ten kod.`);
    pump(s);
  };

  const joinLocal = () => {
    reset();
    const s = new NetSession({ role: 'guest', name: name.trim() || 'Gracz', transport: 'local' });
    wire(s);
    try {
      s.attach(createLocalLink(room, (raw) => s.ingest(raw)));
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Nie udało się dołączyć');
      return;
    }
    setStatus('connecting');
    setMessage(`Szukam gospodarza pokoju „${normalizeRoom(room)}”…`);
    pump(s);
  };

  const createInvite = async () => {
    reset();
    let host: ReturnType<typeof createRtcHost>;
    try {
      host = createRtcHost(
        (raw) => session.current?.ingest(raw),
        (link) => {
          session.current?.attach(link);
          setMessage('Kanał otwarty. Uruchom świat, żeby gość wszedł.');
        }
      );
    } catch (e) {
      setStatus('error');
      setMessage(
        'Ta przeglądarka nie obsługuje połączeń bezpośrednich (WebRTC). ' +
          'Użyj trybu „Ta sama przeglądarka”.'
      );
      console.error('WebRTC niedostępne', e);
      return;
    }
    rtc.current = host;
    session.current = new NetSession({ role: 'host', name: name.trim() || 'Gracz', transport: 'p2p' });
    session.current.setWorld({ seed, mode, worldType, name: `Świat ${name.trim() || 'Gracza'}`, time: 0.25, day: 1, weather: 'clear' });
    wire(session.current);
    setStatus('connecting');
    try {
      setInvite(await host.createOffer());
      setMessage('Skopiuj kod zaproszenia i wyślij go znajomemu. Potem wklej jego kod odpowiedzi.');
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Nie udało się utworzyć zaproszenia');
    }
  };

  const acceptAnswer = async () => {
    const host = rtc.current as ReturnType<typeof createRtcHost> | null;
    if (!host || !('acceptAnswer' in host)) {
      setStatus('error');
      setMessage('Najpierw utwórz kod zaproszenia (krok 1), a potem wklej odpowiedź gościa.');
      return;
    }
    try {
      await host.acceptAnswer(answerIn);
      setMessage('Kod przyjęty – łączę…');
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Nieprawidłowy kod odpowiedzi');
    }
  };

  const acceptInvite = async () => {
    reset();
    let guest: ReturnType<typeof createRtcGuest>;
    try {
      guest = createRtcGuest(
        (raw) => session.current?.ingest(raw),
        (link) => {
          session.current?.attach(link);
        }
      );
    } catch (e) {
      setStatus('error');
      setMessage(
        'Ta przeglądarka nie obsługuje połączeń bezpośrednich (WebRTC). ' +
          'Poproś gospodarza o tryb „Ta sama przeglądarka”.'
      );
      console.error('WebRTC niedostępne', e);
      return;
    }
    rtc.current = guest;
    session.current = new NetSession({ role: 'guest', name: name.trim() || 'Gracz', transport: 'p2p' });
    wire(session.current);
    setStatus('connecting');
    try {
      const code = await guest.acceptOffer(invite);
      setAnswerOut(code);
      setMessage('Skopiuj kod odpowiedzi i odeślij gospodarzowi. Czekam na połączenie…');
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Nieprawidłowe zaproszenie');
    }
  };

  const enterWorld = () => {
    const s = session.current;
    if (!s) return;
    s.startWorld();
    handOff(s);
  };

  const copy = async (what: 'invite' | 'answer', text: string) => {
    if (await copyText(text)) {
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1500);
    } else {
      setMessage('Nie mogłem skopiować – zaznacz kod i skopiuj ręcznie.');
    }
  };

  const isHost = role === 'host';

  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center overflow-y-auto p-3 sm:items-center" style={{ background: 'rgba(4,6,9,0.82)' }}>
      <CloseButton onClose={onClose} label="Wróć" className="absolute right-3 top-3 z-10" />
      <div className="mc-window w-[min(720px,100%)] p-4 text-white sm:p-6">
        <div className="mb-1 text-2xl mc-text">Gra razem</div>
        <p className="mb-4 text-sm leading-snug text-white/70">
          BlockCraft nie ma serwera – gracze łączą się bezpośrednio. Możesz grać w dwóch kartach na tym samym
          komputerze albo przez internet, wysyłając sobie kody.
        </p>

        <label className="mb-1 block text-xs uppercase tracking-widest text-white/50">Twoja nazwa</label>
        <input
          className={`${inputCls} mb-4`}
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="np. Ania"
        />

        <div className="mb-3 flex gap-1">
          <button
            type="button"
            className={`${tab === 'local' ? 'mc-tab' : 'mc-tab opacity-60'} min-w-0 flex-1 !px-2 !text-[12px] leading-tight sm:!px-3 sm:!text-[14px]`}
            aria-selected={tab === 'local'}
            onClick={() => setTab('local')}
          >
            💻 Ta sama przeglądarka
          </button>
          <button
            type="button"
            className={`${tab === 'internet' ? 'mc-tab' : 'mc-tab opacity-60'} min-w-0 flex-1 !px-2 !text-[12px] leading-tight sm:!px-3 sm:!text-[14px]`}
            aria-selected={tab === 'internet'}
            onClick={() => setTab('internet')}
          >
            🌍 Przez internet
          </button>
        </div>

        <div className="mb-3 flex gap-1">
          <button
            type="button"
            className={`${isHost ? 'mc-tab' : 'mc-tab opacity-60'} min-w-0 flex-1 !text-[13px] sm:!text-[14px]`}
            aria-selected={isHost}
            onClick={() => setRole('host')}
          >
            Utwórz sesję
          </button>
          <button
            type="button"
            className={`${!isHost ? 'mc-tab' : 'mc-tab opacity-60'} min-w-0 flex-1 !text-[13px] sm:!text-[14px]`}
            aria-selected={!isHost}
            onClick={() => setRole('guest')}
          >
            Dołącz
          </button>
        </div>

        {tab === 'local' && (
          <div className="mb-3 space-y-2">
            <label className="block text-xs uppercase tracking-widest text-white/50">Kod pokoju</label>
            <div className="flex flex-wrap gap-2">
              <input
                className={`${inputCls} min-w-0 flex-1`}
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="np. las-123"
                maxLength={24}
              />
              {isHost && (
                <button type="button" className={btn} onClick={() => setRoom(makeRoomCode())}>
                  Losuj
                </button>
              )}
            </div>
            <p className="text-[11px] leading-snug text-white/45">
              Otwórz grę w drugiej karcie lub oknie (na tym samym profilu przeglądarki) i wpisz ten sam kod
              po drugiej stronie.
            </p>
          </div>
        )}

        {isHost && (
          <div className="mb-3 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-widest text-white/50">Ziarno świata</span>
              <input
                className={inputCls}
                type="number"
                value={seed}
                onChange={(e) => setSeed(Math.abs(parseInt(e.target.value || '1', 10) || 1))}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-widest text-white/50">Tryb / teren</span>
              <div className="flex gap-1">
                <button type="button" className={`${btn} !px-2`} onClick={() => setMode(mode === 'survival' ? 'creative' : 'survival')}>
                  {mode === 'survival' ? 'Przetrwanie' : 'Kreatywny'}
                </button>
                <button type="button" className={`${btn} !px-2`} onClick={() => setWorldType(worldType === 'normal' ? 'flat' : 'normal')}>
                  {worldType === 'normal' ? 'Normalny' : 'Płaski'}
                </button>
              </div>
            </label>
          </div>
        )}

        {tab === 'internet' && (
          <div className="mb-3 space-y-2 rounded border border-white/10 bg-black/30 p-3">
            {isHost ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className={btnPrimary} onClick={createInvite}>
                    1. Utwórz kod zaproszenia
                  </button>
                  {invite && (
                    <button type="button" className={btn} onClick={() => copy('invite', invite)}>
                      {copied === 'invite' ? 'Skopiowano ✓' : 'Kopiuj kod'}
                    </button>
                  )}
                </div>
                {invite && (
                  <textarea
                    readOnly
                    value={invite}
                    className="h-20 w-full resize-none bg-black/60 p-2 text-[11px] text-white/70"
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label="Kod zaproszenia"
                  />
                )}
                <label className="block text-xs uppercase tracking-widest text-white/50">2. Wklej kod odpowiedzi od gościa</label>
                <textarea
                  value={answerIn}
                  onChange={(e) => setAnswerIn(e.target.value)}
                  className="h-20 w-full resize-none bg-black/60 p-2 text-[11px] text-white/70"
                  placeholder="Wklej tutaj kod odpowiedzi…"
                  onKeyDown={(e) => e.stopPropagation()}
                  aria-label="Kod odpowiedzi"
                />
                <button type="button" className={btnPrimary} onClick={acceptAnswer} disabled={!answerIn.trim()}>
                  3. Połącz
                </button>
              </>
            ) : (
              <>
                <label className="block text-xs uppercase tracking-widest text-white/50">1. Wklej kod zaproszenia</label>
                <textarea
                  value={invite}
                  onChange={(e) => setInvite(e.target.value)}
                  className="h-20 w-full resize-none bg-black/60 p-2 text-[11px] text-white/70"
                  placeholder="Wklej tutaj długi kod od gospodarza…"
                  onKeyDown={(e) => e.stopPropagation()}
                  aria-label="Kod zaproszenia"
                />
                <button type="button" className={btnPrimary} onClick={acceptInvite} disabled={!invite.trim()}>
                  2. Przyjmij zaproszenie
                </button>
                {answerOut && (
                  <>
                    <label className="block text-xs uppercase tracking-widest text-white/50">3. Odeślij ten kod gospodarzowi</label>
                    <textarea
                      readOnly
                      value={answerOut}
                      className="h-20 w-full resize-none bg-black/60 p-2 text-[11px] text-white/70"
                      onFocus={(e) => e.currentTarget.select()}
                      aria-label="Kod odpowiedzi"
                    />
                    <button type="button" className={btn} onClick={() => copy('answer', answerOut)}>
                      {copied === 'answer' ? 'Skopiowano ✓' : 'Kopiuj kod odpowiedzi'}
                    </button>
                  </>
                )}
              </>
            )}
            <p className="text-[11px] leading-snug text-white/45">
              Połączenie przechodzi przez publiczny serwer STUN. Jeśli dostawca internetu blokuje P2P (NAT symetryczny),
              użyj trybu „Ta sama przeglądarka” albo sieci lokalnej.
            </p>
          </div>
        )}

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {tab === 'local' &&
            (isHost ? (
              <button type="button" className={btnPrimary} onClick={startLocalHost}>
                {status === 'connected' ? 'Odśwież pokój' : 'Otwórz pokój'}
              </button>
            ) : (
              <button type="button" className={btnPrimary} onClick={joinLocal}>
                Dołącz do pokoju
              </button>
            ))}
        </div>

        {message && (
          <div
            className="mb-3 border px-3 py-2 text-sm"
            style={{
              background: status === 'error' ? 'rgba(120,20,20,0.35)' : status === 'connected' ? 'rgba(20,80,30,0.35)' : 'rgba(0,0,0,0.35)',
              borderColor: status === 'error' ? 'rgba(255,120,120,0.4)' : 'rgba(255,255,255,0.15)',
            }}
            role="status"
          >
            {message}
          </div>
        )}

        {players.length > 0 && (
          <div className="mb-3">
            <div className="mb-1 text-xs uppercase tracking-widest text-white/50">W sesji ({players.length})</div>
            <div className="flex flex-wrap gap-2">
              {players.map((p) => (
                <span key={p.id} className="flex items-center gap-2 border border-white/15 bg-black/30 px-2 py-1 text-sm">
                  <span style={{ width: 10, height: 10, background: `hsl(${p.hue} 60% 55%)`, border: '1px solid #000' }} />
                  {p.name}
                  {p.self && <span className="text-xs text-yellow-200">(ty)</span>}
                  <span className="text-xs text-white/40">{p.ping >= 0 ? `${p.ping} ms` : '…'}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {isHost && status === 'connected' && (
          <button type="button" className="mc-btn w-full !py-3 !text-lg" onClick={enterWorld}>
            Wejdź do świata i zaproś graczy
          </button>
        )}
        {!isHost && (
          <p className="text-center text-sm text-white/60">
            {status === 'connected' ? 'Czekam, aż gospodarz uruchomi świat…' : 'Po połączeniu świat uruchomi się automatycznie.'}
          </p>
        )}
        <p className="mt-3 text-center text-[11px] text-white/35">
          Wspólny jest świat (bloki), gracze, czat, pora dnia i pogoda. Moby i pogoda lokalna liczą się u każdego gracza osobno.
        </p>
      </div>
    </div>
  );
}
