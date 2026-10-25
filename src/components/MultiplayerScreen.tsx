import { useEffect, useRef, useState } from 'react';
import {
  createLocalLink,
  createRtcGuest,
  createRtcHost,
  makeRoomCode,
  NetSession,
  normalizeRoom,
  type NetLike,
  type NetPlayer,
  type NetStatus,
} from '../game/net';
import { PublicServer, PUBLIC_NAME, PUBLIC_SEED } from '../game/online';
import { loadSkinId, saveSkinId, skinById } from '../game/skins';
import { SkinPicker, SkinAvatar, SkinHead } from './SkinPicker';
import type { GameMode } from '../game/engine';
import type { WorldType } from './Menus';
import type { ZombiesMapId } from '../game/zombies';
import { ZOMBIES_MAPS } from '../game/zombies/types';
import CloseButton from './CloseButton';

/**
 * 2.11: wejście do wspólnej gry.
 *
 * Główny przycisk to **serwer publiczny** – jeden świat dla wszystkich,
 * bez kodów i bez gospodarza (Supabase Realtime + Postgres). Kody pokoju
 * i zaproszenia zostały jako „inne sposoby”: szybka gra w dwóch kartach
 * tej samej przeglądarki i gra bezpośrednio przez internet.
 */

export interface NetStart {
  net: NetLike;
  seed: number;
  mode: GameMode;
  worldType: WorldType;
  worldName: string;
  zombiesMapId?: ZombiesMapId;
}

const NICK_KEY = 'blockcraft-nick';
type Mode = 'public' | 'local' | 'p2p';

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
// 16 px zapobiega automatycznemu przybliżaniu strony na iPhonie po dotknięciu pola.
const inputCls = 'mc-input !py-2 !text-[16px]';
const tabCls = (on: boolean) => `${on ? 'mc-tab' : 'mc-tab opacity-60'} min-w-0 flex-1 !px-2 !text-[12px] leading-tight sm:!px-3 sm:!text-[14px]`;

export default function MultiplayerScreen({
  onStart,
  onClose,
  defaultMode = 'public',
}: {
  onStart: (s: NetStart) => void;
  onClose: () => void;
  /** Zakładka otwierana na starcie (testy renderują też warianty lokalne). */
  defaultMode?: Mode;
}) {
  const [name, setName] = useState(() => loadNick() || 'Gracz');
  const [skin, setSkin] = useState(loadSkinId);
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [role, setRole] = useState<'host' | 'guest'>('host');
  const [room, setRoom] = useState('las-123');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000));
  const [gameMode, setGameMode] = useState<GameMode>('survival');
  const [zombiesMap, setZombiesMap] = useState<ZombiesMapId>('deadend');
  const [worldType, setWorldType] = useState<WorldType>('normal');
  const [status, setStatus] = useState<NetStatus | 'idle'>('idle');
  const [message, setMessage] = useState('');
  const [players, setPlayers] = useState<NetPlayer[]>([]);
  const [invite, setInvite] = useState('');
  const [answerIn, setAnswerIn] = useState('');
  const [answerOut, setAnswerOut] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const session = useRef<NetLike | null>(null);
  const rtc = useRef<ReturnType<typeof createRtcHost> | ReturnType<typeof createRtcGuest> | null>(null);
  const tick = useRef(0);
  /** Po wejściu do świata sesja przechodzi do silnika – nie zamykamy jej. */
  const handedOff = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(NICK_KEY, name.trim().slice(0, 20) || 'Gracz');
    } catch {
      /* prywatny tryb przeglądarki */
    }
  }, [name]);

  useEffect(
    () => () => {
      clearInterval(tick.current);
      if (!handedOff.current) {
        session.current?.close('Opuszczono poczekalnię');
        rtc.current?.close();
      }
    },
    []
  );

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

  const handOff = (net: NetLike) => {
    handedOff.current = true;
    clearInterval(tick.current);
    session.current = null;
    const detectedZombies = ((net.world?.mode as string) === 'zombies' ? (net.world as unknown as { zombiesMapId?: ZombiesMapId }).zombiesMapId : undefined) ?? (gameMode === 'zombies' ? zombiesMap : undefined);
    onStart({
      net,
      seed: net.world?.seed ?? PUBLIC_SEED,
      mode: (net.world?.mode as GameMode) ?? gameMode,
      worldType: net.world?.worldType ?? worldType,
      worldName: net.world?.name ?? PUBLIC_NAME,
      zombiesMapId: detectedZombies,
    });
  };

  const wire = (s: NetSession) => {
    s.skin = skin;
    session.current = s;
    s.onStatus = (st, err) => {
      setStatus(st);
      if (err) setMessage(err);
      else if (st === 'connected' && s.role === 'guest') setMessage('Połączono! Czekam, aż gospodarz uruchomi świat…');
    };
    s.onPeers = (list) => setPlayers(list);
    s.onStart = () => handOff(s);
  };

  const pump = (s: NetSession) => {
    clearInterval(tick.current);
    tick.current = window.setInterval(() => s.tick(), 250);
  };

  // ------------------------------------------------------- serwer publiczny

  const joinPublic = async () => {
    reset();
    setMode('public');
    setBusy(true);
    setStatus('connecting');
    setMessage('Łączę z serwerem publicznym…');
    const s = new PublicServer({ name: name.trim() || 'Gracz' });
    s.skin = skin;
    session.current = s;
    s.onProgress = (text) => setMessage(text);
    s.onPeers = (list) => setPlayers(list);
    s.onStatus = (st, err) => {
      setStatus(st);
      if (err) setMessage(err);
    };
    try {
      await s.connect();
      setBusy(false);
      setMessage('Wchodzę do wspólnego świata…');
      handOff(s);
    } catch (e) {
      setBusy(false);
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Nie udało się połączyć z serwerem publicznym.');
    }
  };

  // -------------------------------------------------- ta sama przeglądarka

  const startLocalHost = () => {
    reset();
    const code = normalizeRoom(room) || makeRoomCode();
    setRoom(code);
    const s = new NetSession({ role: 'host', name: name.trim() || 'Gracz', transport: 'local' });
    const worldExtra = gameMode === 'zombies' ? { zombiesMapId: zombiesMap } : {};
    s.setWorld({ seed, mode: gameMode as 'survival', worldType, name: `Świat ${name.trim() || 'Gracza'}`, time: 0.25, day: 1, weather: 'clear', ...(worldExtra as object) } as never);
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

  // ------------------------------------------------------------- internet

  const createInvite = async () => {
    reset();
    let host: ReturnType<typeof createRtcHost>;
    try {
      host = createRtcHost(
        (raw) => session.current?.ingest?.(raw),
        (link) => {
          (session.current as NetSession | null)?.attach(link);
          setMessage('Kanał otwarty. Uruchom świat, żeby gość wszedł.');
        }
      );
    } catch (e) {
      setStatus('error');
      setMessage('Ta przeglądarka nie obsługuje połączeń bezpośrednich (WebRTC). Użyj serwera publicznego albo trybu „Ta sama przeglądarka”.');
      console.error('WebRTC niedostępne', e);
      return;
    }
    rtc.current = host;
    const s = new NetSession({ role: 'host', name: name.trim() || 'Gracz', transport: 'p2p' });
    const extra2: object = gameMode === 'zombies' ? { zombiesMapId: zombiesMap } : {};
    s.setWorld({ seed, mode: gameMode as 'survival', worldType, name: `Świat ${name.trim() || 'Gracza'}`, time: 0.25, day: 1, weather: 'clear', ...extra2 } as never);
    wire(s);
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
      setStatus('connecting');
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
        (raw) => session.current?.ingest?.(raw),
        (link) => {
          (session.current as NetSession | null)?.attach(link);
        }
      );
    } catch (e) {
      setStatus('error');
      setMessage('Ta przeglądarka nie obsługuje połączeń bezpośrednich (WebRTC). Poproś gospodarza o serwer publiczny.');
      console.error('WebRTC niedostępne', e);
      return;
    }
    rtc.current = guest;
    const s = new NetSession({ role: 'guest', name: name.trim() || 'Gracz', transport: 'p2p' });
    wire(s);
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
    (s as NetSession).startWorld?.();
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
  const connected = status === 'connected';

  return (
    <div
      className="absolute inset-0 z-40 flex items-start justify-center overflow-y-auto px-2 pb-[max(12px,env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))] sm:items-center sm:p-3"
      style={{ background: 'rgba(4,6,9,0.82)' }}
    >
      <CloseButton onClose={onClose} label="Wróć" className="mc-close-safe absolute z-10" />
      <div className="mc-window w-[min(720px,100%)] p-4 text-white sm:p-6">
        <div className="mb-1 text-2xl mc-text">Gra razem</div>
        <p className="mb-4 text-sm leading-snug text-white/70">
          Wskakuj do <b className="text-yellow-200">wspólnego świata</b> na serwerze publicznym – bez kodów, bez
          gospodarza. Wszyscy budują to samo i widzą się nawzajem.
        </p>
        <p className="mb-4 border-l-2 border-yellow-300/50 pl-3 text-xs leading-relaxed text-white/60">
          Twoja postać ma <b className="text-white/80">własną sesję w tej przeglądarce</b>: po powrocie wracasz tam,
          gdzie skończyłeś, z tym samym ekwipunkiem – nawet jeśli zmienisz nick albo skórkę. Zgubiłeś się?
          Wpisz na czacie <b className="text-white/80">/tpa nick</b>, a kolega zatwierdzi teleportację jednym
          przyciskiem.
        </p>

        <label className="mb-1 block text-xs uppercase tracking-widest text-white/50">Twoja nazwa</label>
        <input
          className={`${inputCls} mb-3`}
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="np. Ania"
        />

        <div className="mb-4 flex items-center gap-3 rounded border border-white/10 bg-black/30 p-2">
          <SkinAvatar skin={skin} size={40} />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-xs uppercase tracking-widest text-white/50">Skórka</span>
              <span className="truncate text-[12px] text-yellow-200">{skinById(skin).name}</span>
            </div>
            <SkinPicker
              value={skin}
              compact
              onChange={(id) => {
                const clean = saveSkinId(id);
                setSkin(clean);
              }}
            />
          </div>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-1">
          <button type="button" className={tabCls(mode === 'public')} aria-selected={mode === 'public'} onClick={() => { reset(); setMode('public'); }}>
            🌍 Serwer publiczny
          </button>
          <button type="button" className={tabCls(mode === 'local')} aria-selected={mode === 'local'} onClick={() => { reset(); setMode('local'); }}>
            💻 Ta przeglądarka
          </button>
          <button type="button" className={tabCls(mode === 'p2p')} aria-selected={mode === 'p2p'} onClick={() => { reset(); setMode('p2p'); }}>
            🔗 Przez internet
          </button>
        </div>

        {mode === 'public' && (
          <div className="mb-3 space-y-2">
            <div className="border border-green-400/25 bg-green-900/20 p-3 text-sm">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-green-300">● Publiczny świat</span>
                <span className="text-white/50">
                  ziarno {PUBLIC_SEED} · tryb przetrwania · zapis w chmurze
                </span>
              </div>
              <p className="text-[12px] leading-snug text-white/70">
                Zmiany bloków zapisują się na serwerze, więc budowle zostają po wyjściu i po odświeżeniu strony.
                Pora dnia i pogoda są wspólne dla wszystkich, a lista graczy pokazuje, kto jest online.
              </p>
            </div>
            <button type="button" className="mc-btn w-full !py-4 !text-lg" onClick={joinPublic} disabled={busy}>
              {busy ? 'Łączę…' : '▶ Graj online'}
            </button>
            <p className="text-[11px] leading-snug text-white/45">
              Do gry wystarczy przeglądarka i internet. Serwer działa 24/7 – nie musisz nic otwierać ani nikogo zapraszać.
            </p>
          </div>
        )}

        {mode !== 'public' && (
          <>
            <div className="mb-3 flex gap-1">
              <button type="button" className={tabCls(isHost)} aria-selected={isHost} onClick={() => setRole('host')}>
                Utwórz sesję
              </button>
              <button type="button" className={tabCls(!isHost)} aria-selected={!isHost} onClick={() => setRole('guest')}>
                Dołącz
              </button>
            </div>

            {mode === 'local' && (
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
                  Otwórz grę w drugiej karcie lub oknie (ten sam profil przeglądarki) i wpisz ten sam kod po drugiej stronie.
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
                  <div className="flex flex-col gap-1">
                    <div className="flex gap-1">
                      <button type="button" className={`${btn} !px-2 !text-[11px]`} onClick={() => setGameMode(gameMode === 'survival' ? 'creative' : gameMode === 'creative' ? 'zombies' : 'survival')}>
                        {gameMode === 'survival' ? 'Przetrwanie' : gameMode === 'creative' ? 'Kreatywny' : '🧟 ZOMBIES'}
                      </button>
                      <button type="button" className={`${btn} !px-2 ${gameMode === 'zombies' ? 'opacity-40' : ''}`} onClick={() => setWorldType(worldType === 'normal' ? 'flat' : 'normal')} disabled={gameMode === 'zombies'}>
                        {worldType === 'normal' ? 'Normalny' : 'Płaski'}
                      </button>
                    </div>
                    {gameMode === 'zombies' && (
                      <div className="grid grid-cols-2 gap-1">
                        {(Object.entries(ZOMBIES_MAPS) as [ZombiesMapId, { name: string }][]).map(([id, m]) => (
                          <button key={id} type="button" className={`${zombiesMap === id ? 'mc-btn mc-btn-primary !py-1 !text-[11px]' : 'mc-btn !py-1 !text-[11px] opacity-70'}`} onClick={() => setZombiesMap(id as ZombiesMapId)}>{m.name}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              </div>
            )}
            {isHost && gameMode === 'zombies' && mode === 'local' && (
              <div className="mb-2 text-xs text-red-300">Po wejściu wszyscy spawnują w {ZOMBIES_MAPS[zombiesMap].name} – drzwi 500-1500g, prąd 750g</div>
            )}

            {mode === 'p2p' && (
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
                  Połączenie jest bezpośrednie (WebRTC, publiczny STUN). Jeśli sieć blokuje P2P (NAT symetryczny),
                  użyj serwera publicznego – działa zawsze.
                </p>
              </div>
            )}

            <div className="mb-3 flex flex-wrap items-center gap-2">
              {mode === 'local' &&
                (isHost ? (
                  <button type="button" className={btnPrimary} onClick={startLocalHost}>
                    {connected ? 'Odśwież pokój' : 'Otwórz pokój'}
                  </button>
                ) : (
                  <button type="button" className={btnPrimary} onClick={joinLocal}>
                    Dołącz do pokoju
                  </button>
                ))}
            </div>
          </>
        )}

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
            <div className="mb-1 text-xs uppercase tracking-widest text-white/50">Online ({players.length})</div>
            <div className="flex flex-wrap gap-2">
              {players.map((p) => (
                <span key={p.id} className="flex items-center gap-2 border border-white/15 bg-black/30 px-2 py-1 text-sm">
                  <SkinHead skin={p.skin || `hsl(${p.hue} 60% 55%)`} size={14} />
                  {p.name}
                  {p.self && <span className="text-xs text-yellow-200">(ty)</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {mode !== 'public' && isHost && connected && (
          <button type="button" className="mc-btn w-full !py-3 !text-lg" onClick={enterWorld}>
            Wejdź do świata i zaproś graczy
          </button>
        )}
        {mode !== 'public' && !isHost && (
          <p className="text-center text-sm text-white/60">
            {connected ? 'Czekam, aż gospodarz uruchomi świat…' : 'Po połączeniu świat uruchomi się automatycznie.'}
          </p>
        )}
        <p className="mt-3 text-center text-[11px] text-white/35">
          Wspólny jest świat (bloki), gracze, czat, pora dnia i pogoda. Ekwipunek, zdrowie i moby liczą się u każdego gracza osobno.
        </p>
      </div>
    </div>
  );
}
