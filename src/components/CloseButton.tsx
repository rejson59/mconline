/**
 * 2.9: wspólny przycisk zamykania okien gry.
 *
 * Na telefonie nie ma klawisza `E` ani `Esc`, a dotychczasowe okna (poza
 * skrzynią) nie miały żadnego widocznego wyjścia – ekwipunek dawało się
 * zamknąć tylko klawiaturą. Przycisk jest duży (44 px), przyklejony do
 * narożnika okna i ma etykietę tekstową na większych ekranach.
 */
export function CloseButton({
  onClose,
  label = 'Zamknij',
  className = '',
  compact = false,
}: {
  onClose: () => void;
  label?: string;
  className?: string;
  /** Tylko ikona (np. w ciasnym nagłówku panelu). */
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={`${label} (Esc)`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      className={`mc-close-btn ${compact ? 'mc-close-btn-compact' : ''} ${className}`}
    >
      <span aria-hidden className="text-base leading-none">
        ✕
      </span>
      {!compact && <span className="hidden text-xs font-bold sm:inline">{label}</span>}
    </button>
  );
}

export default CloseButton;
