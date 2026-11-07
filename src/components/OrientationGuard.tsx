import { useEffect, useRef, useState } from "react";
import { enterLandscapeMode } from "../utils/screen";
import { useLandscapeRequired } from "../utils/useLandscapeRequired";

/** Portrait is a non-dismissible gate during the whole game session, including
 * pause, containers and death. Menus remain usable without rotating.
 */
export default function OrientationGuard({
  variant = "game",
  onQuit,
}: {
  variant?: "game" | "menu";
  onQuit?: () => void;
}) {
  const blocked = useLandscapeRequired();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!blocked || variant !== "game") return;
    const previous = document.activeElement as HTMLElement | null;
    buttonRef.current?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [blocked, variant]);

  if (!blocked) return null;

  const goLandscape = async () => {
    setBusy(true);
    setNote("");
    const result = await enterLandscapeMode();
    setBusy(false);
    if (!result.locked) {
      setNote(
        result.fullscreen
          ? "Pełny ekran włączony, ale ta przeglądarka nie umie sama obrócić ekranu – obróć telefon ręcznie."
          : "Ta przeglądarka nie pozwala wymusić orientacji – obróć telefon ręcznie albo odblokuj rotację w ustawieniach.",
      );
    }
  };

  const button = (
    <button
      ref={buttonRef}
      type="button"
      className="mc-btn mc-btn-primary !w-auto !px-5 !py-3 !text-base"
      disabled={busy}
      onClick={goLandscape}
    >
      {busy ? "Włączam…" : "⛶ Pełny ekran i poziomo"}
    </button>
  );

  if (variant === "menu") {
    return (
      <div
        className="mc-orient-banner z-[85] flex w-full max-w-3xl flex-wrap items-center gap-2 border-2 border-black px-3 py-2 text-sm"
        style={{ background: "rgba(20, 40, 20, 0.92)", color: "#eaffd8" }}
        role="status"
      >
        <span className="rotate-phone" aria-hidden="true">
          📱
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <b>Obróć telefon poziomo</b> – gra jest zaprojektowana na ekran w
          poziomie, jak Minecraft.
        </span>
        {button}
      </div>
    );
  }

  return (
    <div
      className="mc-orient-guard absolute inset-0 z-[1000] flex flex-col items-center justify-center gap-3 px-5 text-center"
      style={{
        background:
          "linear-gradient(180deg, rgba(8, 12, 18, 0.96), rgba(4, 6, 10, 0.98))",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="orient-title"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="rotate-phone text-5xl" aria-hidden="true">
        📱
      </div>
      <h2 id="orient-title" className="text-2xl leading-tight mc-text">
        Obróć telefon poziomo
      </h2>
      <p className="max-w-[340px] text-sm leading-snug text-white/75">
        Gra na telefonie działa tylko w poziomie. Obróć urządzenie. Jeśli ekran
        się nie obraca, wyłącz blokadę obrotu w ustawieniach telefonu. Możesz
        też spróbować przycisku poniżej.
      </p>
      {button}
      {onQuit && (
        <button type="button" className="mc-btn !w-auto !px-5" onClick={onQuit}>
          Zapisz i wróć do menu
        </button>
      )}
      <p className="max-w-[340px] text-xs text-white/60">
        Po obrocie wrócisz do tego samego świata. Multiplayer nadal działa —
        obrót nie zatrzymuje serwera.
      </p>
      {note && (
        <p
          className="max-w-[340px] text-xs leading-snug text-amber-200"
          role="status"
        >
          {note}
        </p>
      )}
    </div>
  );
}
