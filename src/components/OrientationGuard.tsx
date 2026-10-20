import { useEffect, useState } from 'react';
import {
  dismissPortrait,
  enterLandscapeMode,
  isPhoneScreen,
  isPortrait,
  portraitDismissed,
  watchLandscape,
} from '../utils/screen';

/**
 * 2.13: „Obróć telefon” – BlockCraft gra się w poziomie.
 *
 * Na telefonie w pionie pokazujemy dużą, czytelną nakładkę z jednym
 * przyciskiem, który wchodzi w pełny ekran i blokuje orientację poziomą.
 * W menu wystarcza pasek u góry – nie chcemy blokować ekranu startowego
 * komuś, kto tylko zagląda. W grze nakładka jest pełna (wariant `game`),
 * bo w pionie HUD, drążek i przyciski nachodzą na siebie.
 *
 * Telefony z zablokowaną rotacją (iPhone z „Blokadą orientacji”) nie dadzą
 * się zmusić – wtedy zostaje przycisk „Graj w pionie”, żeby nikt nie utknął
 * na ekranie, którego nie da się zamknąć.
 */
export default function OrientationGuard({ variant = 'game' }: { variant?: 'game' | 'menu' }) {
  const [phone, setPhone] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    const check = () => {
      setPhone(isPhoneScreen());
      setPortrait(isPortrait());
      setDismissed(portraitDismissed());
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    const unwatch = watchLandscape(check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
      unwatch();
    };
  }, []);

  if (!phone || !portrait || dismissed) return null;

  const goLandscape = async () => {
    setBusy(true);
    setNote('');
    const result = await enterLandscapeMode();
    setBusy(false);
    if (!result.locked) {
      setNote(
        result.fullscreen
          ? 'Pełny ekran włączony, ale ta przeglądarka nie umie sama obrócić ekranu – obróć telefon ręcznie.'
          : 'Ta przeglądarka nie pozwala wymusić orientacji – obróć telefon ręcznie albo odblokuj rotację w ustawieniach.',
      );
    }
  };

  const skip = () => {
    dismissPortrait();
    setDismissed(true);
  };

  const button = (
    <button
      type="button"
      className="mc-btn mc-btn-primary !w-auto !px-5 !py-3 !text-base"
      disabled={busy}
      onClick={goLandscape}
    >
      {busy ? 'Włączam…' : '⛶ Pełny ekran i poziomo'}
    </button>
  );

  if (variant === 'menu') {
    return (
      <div
        className="mc-orient-banner z-[85] flex w-full max-w-3xl flex-wrap items-center gap-2 border-2 border-black px-3 py-2 text-sm"
        style={{ background: 'rgba(20, 40, 20, 0.92)', color: '#eaffd8' }}
        role="status"
      >
        <span className="rotate-phone" aria-hidden="true">📱</span>
        <span className="min-w-0 flex-1 leading-tight">
          <b>Obróć telefon poziomo</b> – gra jest zaprojektowana na ekran w poziomie, jak Minecraft.
        </span>
        {button}
        <button type="button" className="px-2 py-1 text-xs underline opacity-70" onClick={skip}>
          Pomiń
        </button>
      </div>
    );
  }

  return (
    <div
      className="mc-orient-guard absolute inset-0 z-[80] flex flex-col items-center justify-center gap-3 px-5 text-center"
      style={{ background: 'linear-gradient(180deg, rgba(8, 12, 18, 0.96), rgba(4, 6, 10, 0.98))' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="orient-title"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="rotate-phone text-5xl" aria-hidden="true">📱</div>
      <h2 id="orient-title" className="text-2xl leading-tight mc-text">
        Obróć telefon poziomo
      </h2>
      <p className="max-w-[340px] text-sm leading-snug text-white/75">
        BlockCraft gra się w poziomie – tak jak Minecraft na telefonie. Wtedy widać cały hotbar,
        drążek i przyciski akcji. Przycisk poniżej włączy pełny ekran i zablokuje obrót.
      </p>
      {button}
      <button type="button" className="text-xs text-white/50 underline" onClick={skip}>
        Graj w pionie mimo to
      </button>
      {note && (
        <p className="max-w-[340px] text-xs leading-snug text-amber-200" role="status">
          {note}
        </p>
      )}
    </div>
  );
}
