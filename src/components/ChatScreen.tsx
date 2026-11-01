import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useJavaScale } from '../utils/guiScale';
import {
  COMMANDS,
  COMMAND_CATEGORIES,
  applyCommandSuggestion,
  searchCommands,
  type CommandInfo,
} from '../game/commands';

/**
 * 2.9: czat i komendy w wersji „na telefon i komputer”.
 *
 * Co było nie tak w 2.8:
 *  – jedynym sposobem wysłania wiadomości był Enter z klawiatury (na telefonie
 *    trzeba było trafić w klawisz „Go” wirtualnej klawiatury),
 *  – nie było ŻADNEJ listy komend, więc trzeba było znać je na pamięć,
 *  – pole przyklejone do dołu potrafiło schować się pod klawiaturą,
 *  – nie było przycisku zamykania.
 *
 * Teraz panel jest arkuszem dolnym (`fixed`), ma duże przyciski „Wyślij”
 * i „✕”, podpowiedzi filtrowane w trakcie pisania oraz pełną, tapowalną listę
 * komend z gotowymi przykładami. Wszystko opiera się na `commands.ts`, z
 * którego korzysta też `/help` w silniku – lista nie może się rozjechać.
 */
export function ChatInput({
  onSubmit,
  onClose,
  showListInitially = false,
}: {
  onSubmit: (t: string) => void;
  onClose: () => void;
  /** Od razu otwiera pełną listę komend (np. z przycisku „Komendy”). */
  showListInitially?: boolean;
}) {
  const scale = useJavaScale();
  const [text, setText] = useState('');
  const [showList, setShowList] = useState(showListInitially);
  const [expanded, setExpanded] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const history = useRef<string[]>([]);
  const hIdx = useRef(-1);
  // 2.9: iOS nie zmniejsza layoutu przy wirtualnej klawiaturze – bez tego
  // pole tekstowe znikało POD klawiaturą i nie dało się wysłać komendy.
  const [keyboard, setKeyboard] = useState(0);
  // Lista jest długa – po otwarciu klawiatury zwijamy ją, żeby pole zostało widoczne.
  useEffect(() => {
    if (keyboard > 0) setShowList(false);
  }, [keyboard]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const hidden = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboard(hidden > 80 ? hidden : 0);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  useEffect(() => {
    // Opóźnienie chroni przed utratą fokusu, gdy przeglądarka dopiero
    // pokazuje wirtualną klawiaturę po zmianie stanu UI.
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (showList) listRef.current?.scrollTo({ top: 0 });
  }, [showList]);

  const suggestions = useMemo(() => {
    if (!text.startsWith('/')) return [];
    return searchCommands(text);
  }, [text]);

  const send = (raw?: string) => {
    const value = (raw ?? text).trim();
    if (value) {
      history.current.unshift(value);
      hIdx.current = -1;
      onSubmit(value);
    }
    setText('');
    onClose();
  };

  const insert = (cmd: CommandInfo) => {
    setText(applyCommandSuggestion(text, cmd));
    setShowList(false);
    // Fokus wraca do pola, żeby od razu można było dopisać argument.
    window.setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const end = el.value.length;
      try {
        el.setSelectionRange(end, end);
      } catch {
        /* pole typu search nie zawsze wspiera selekcji */
      }
    }, 10);
  };

  const quick = COMMANDS.filter((c) => ['help', 'gamemode', 'time', 'give', 'tp', 'weather'].includes(c.name));

  return (
    <div
      className="java-chat fixed inset-0 z-[70] flex flex-col justify-end"
      style={{ '--java-chat-scale': scale, background: 'rgba(0,0,0,0.35)', paddingBottom: keyboard > 0 ? keyboard : undefined } as CSSProperties}
      role="dialog"
      aria-label="Czat i komendy"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div
        className="mx-auto w-full max-w-[760px] border-2 border-black text-white shadow-[0_-8px_32px_rgba(0,0,0,0.55)] sm:mb-4 sm:rounded"
        style={{
          background: 'linear-gradient(180deg, rgba(18,20,26,0.97), rgba(8,9,12,0.98))',
          paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
        }}
      >
        {/* Nagłówek: tytuł, lista komend i zamknięcie – wszystko w zasięgu kciuka. */}
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
          <span className="text-sm font-semibold tracking-wide text-white/90">Czat i komendy</span>
          <span className="hidden text-[11px] text-white/40 sm:inline">
            {text.startsWith('/') ? 'wpisz argumenty i wyślij' : 'napisz wiadomość albo zacznij od /'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="flex min-h-[36px] items-center gap-1 border-2 border-white/25 px-2 text-xs font-semibold"
              style={{ background: showList ? 'rgba(120,190,90,0.35)' : 'rgba(255,255,255,0.08)' }}
              aria-expanded={showList}
              onClick={() => setShowList((v) => !v)}
            >
              <span aria-hidden>❓</span>
              <span>Komendy</span>
            </button>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center border-2 border-white/30 text-base"
              style={{ background: 'rgba(255,255,255,0.08)' }}
              aria-label="Zamknij czat"
              title="Zamknij (Esc)"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Pełna lista komend – grupy, składnia, opis i gotowy przykład. */}
        {showList && (
          <div ref={listRef} className="max-h-[min(460px,46vh)] overflow-y-auto px-2 py-2" role="list">
            {COMMAND_CATEGORIES.map((cat) => {
              const items = COMMANDS.filter((c) => c.category === cat.id);
              if (!items.length) return null;
              return (
                <section key={cat.id} className="mb-2">
                  <div className="sticky top-0 z-10 mb-1 flex items-center gap-2 bg-[#12141a]/95 px-1 py-1 text-[11px] font-bold uppercase tracking-widest text-green-300/90">
                    <span aria-hidden>{cat.icon}</span>
                    {cat.label}
                  </div>
                  {items.map((cmd) => {
                    const open = expanded === cmd.name;
                    return (
                      <div key={cmd.name} className="border-b border-white/5">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-1 py-2 text-left hover:bg-white/5"
                          onClick={() => setExpanded(open ? null : cmd.name)}
                          aria-expanded={open}
                        >
                          <code className="shrink-0 text-[13px] font-bold text-yellow-200">/{cmd.usage}</code>
                          {/* Gotowy przykład widać od razu – nie trzeba rozwijać. */}
                          <span className="ml-auto hidden min-w-0 truncate text-[11px] text-white/35 sm:inline">
                            np. {cmd.example}
                          </span>
                          <span className="ml-auto shrink-0 text-xs text-white/40 sm:ml-1">{open ? '▲' : '▼'}</span>
                        </button>
                        {open && (
                          <div className="pb-2 pl-1 pr-1">
                            <p className="text-xs leading-snug text-white/75">{cmd.description}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                className="border border-green-400/50 bg-green-400/15 px-2 py-1 text-[11px] font-semibold text-green-200"
                                onClick={() => insert(cmd)}
                              >
                                Wstaw /{cmd.name}
                              </button>
                              <button
                                type="button"
                                className="border border-white/20 bg-white/5 px-2 py-1 text-[11px] text-white/70"
                                onClick={() => send(cmd.example)}
                              >
                                Wyślij „{cmd.example}”
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </section>
              );
            })}
            <p className="px-1 py-1 text-[11px] leading-snug text-white/40">
              Tapnij komendę, aby rozwinąć opis, albo użyj „Wstaw”, by uzupełnić pole. Komendy działają
              także na komputerze – wpisz je w czacie klawiszem T.
            </p>
          </div>
        )}

        {/* Szybkie skróty – widoczne od razu, bez rozwijania listy. */}
        {!showList && (
          <div className="java-chat-quick flex gap-1 overflow-x-auto px-2 pt-2 [scrollbar-width:none]">
            {quick.map((cmd) => (
              <button
                key={cmd.name}
                type="button"
                className="shrink-0 border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/75 active:bg-white/15"
                onClick={() => insert(cmd)}
              >
                /{cmd.name}
              </button>
            ))}
          </div>
        )}

        {/* Podpowiedzi dopasowane do tego, co już wpisano. */}
        {!showList && suggestions.length > 0 && (
          <div className="java-chat-suggestions mx-2 mt-2 overflow-hidden border border-white/10">
            {suggestions.map((cmd, i) => (
              <button
                key={cmd.name}
                type="button"
                className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs ${
                  i === 0 ? 'bg-green-400/10' : 'bg-black/20'
                } hover:bg-white/10`}
                onClick={() => insert(cmd)}
              >
                <code className="font-bold text-yellow-200">/{cmd.usage}</code>
                <span className="truncate text-white/50">{cmd.description}</span>
              </button>
            ))}
          </div>
        )}

        <form
          className="flex items-center gap-2 px-2 pb-1 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            ref={inputRef}
            className="min-w-0 flex-1 border-2 border-white/20 bg-black/50 px-2 py-2 text-[16px] text-white outline-none focus:border-green-400/70"
            value={text}
            placeholder="Wiadomość lub /komenda…"
            aria-label="Wiadomość lub komenda"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="send"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                send();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                hIdx.current = Math.min(history.current.length - 1, hIdx.current + 1);
                if (history.current[hIdx.current]) setText(history.current[hIdx.current]);
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                hIdx.current = Math.max(-1, hIdx.current - 1);
                setText(hIdx.current >= 0 ? history.current[hIdx.current] ?? '' : '');
              } else if (e.key === 'Tab' && suggestions.length) {
                e.preventDefault();
                insert(suggestions[0]);
              }
            }}
          />
          <button
            type="submit"
            className="flex min-h-[44px] min-w-[64px] items-center justify-center gap-1 border-2 border-black text-sm font-bold text-[#10240c]"
            style={{ background: 'linear-gradient(#8ede7a, #4f9c3d)' }}
            aria-label="Wyślij"
          >
            <span aria-hidden>➤</span>
            <span className="hidden min-[420px]:inline">Wyślij</span>
          </button>
        </form>
        <div className="px-3 pb-1 pt-0.5 text-[10px] leading-snug text-white/35">
          Enter – wyślij · Esc – zamknij · ↑/↓ – historia · wpisz <b>/help</b>, aby zobaczyć komendy
        </div>
      </div>
    </div>
  );
}

export default ChatInput;
