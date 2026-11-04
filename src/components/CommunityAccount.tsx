import { useEffect, useRef, useState } from 'react';
import { ProjectAccount, type AccountState } from '../game/communityAccount';

/** General website account; this screen neither owns credentials nor game saves. */
export default function CommunityAccount({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<AccountState>({ view: 'checking', identity: null, message: '' });
  const controller = useRef<ProjectAccount | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const account = new ProjectAccount(window, setState); controller.current = account; account.start();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); onClose(); return; }
      if (event.key !== 'Tab' || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]'));
      const first = items[0], last = items[items.length - 1];
      if (!first) { event.preventDefault(); panel.current.focus(); return; }
      if (!panel.current.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', keydown, true);
    return () => { account.dispose(); controller.current = null; window.removeEventListener('keydown', keydown, true); previous?.focus(); };
  }, [onClose]);
  const busy = state.view === 'checking' || state.view === 'opening';
  return <div className="absolute inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/80 p-3" role="presentation">
    <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="community-title" className="my-auto w-full max-w-md border-2 border-black bg-[#272119] p-5 text-white shadow-2xl">
      <div className="flex items-center justify-between gap-3"><h2 id="community-title" className="mc-text text-xl">Konto rejson59.github.io</h2><button type="button" className="mc-btn !w-auto !px-3" onClick={onClose} aria-label="Zamknij konto">✕</button></div>
      <p className="my-3 text-sm text-white/80">Ogólne konto strony i podłączonych projektów. Logowanie i rejestracja odbywają się na stronie konta, w tej samej karcie.</p>
      <p className="mb-3 text-sm text-amber-100">Gra działa też bez konta. Światy lokalne, profil multiplayer i prawa działek pozostają niezależne. Połączenie konta nie synchronizuje ani nie przenosi tych danych.</p>
      {state.view === 'checking' && <p role="status">Sprawdzam konto…</p>}
      {state.view === 'connected' && state.identity && <div>
        <p>Potwierdzone konto: <strong>{state.identity.username}</strong>.</p>
        <button type="button" className="mc-btn mt-3" onClick={() => controller.current?.manage()}>Zarządzaj kontem na stronie</button>
        <button type="button" className="mc-btn mt-3" onClick={() => controller.current?.disconnect()}>Rozłącz ten projekt</button>
        <p className="mt-2 text-xs text-white/75">Rozłączenie dotyczy tylko tej gry w tej karcie. Aby wylogować konto strony, użyj strony zarządzania kontem.</p>
      </div>}
      {state.view === 'unsupported' ? <div>
        <p role="status">Wspólne logowanie działa wyłącznie pod https://rejson59.github.io. Podgląd, lokalny HTML i inne domeny nie współdzielą tej sesji.</p>
        <a className="mt-3 inline-block underline" href="https://rejson59.github.io/mconline/">Otwórz grę na obsługiwanej domenie</a>
        <p className="mt-2 text-xs text-white/75">Nie przesyłamy tokenów między domenami. Otwarcie konta na innej domenie nie zaloguje tej kopii gry.</p>
      </div> : state.view !== 'connected' && <button type="button" className="mc-btn mc-btn-primary mt-3" disabled={busy} onClick={() => { void controller.current?.refresh(true); }}>Zaloguj się przez rejson59.github.io</button>}
      {state.view === 'unavailable' && <button type="button" className="mc-btn mt-3" onClick={() => { void controller.current?.refresh(false); }}>Spróbuj ponownie</button>}
      {state.message && <p className="mt-3 text-sm text-amber-100" role="status">{state.message}</p>}
    </div>
  </div>;
}
