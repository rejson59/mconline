/** Single release label shared by the menu, HUD, and in-game help. */
export const GAME_VERSION = '2.13.0';
export const GAME_RELEASE_NAME = 'Jak w Minecrafcie';

/**
 * 2.10: krótka lista zmian pokazywana w menu pauzy.
 * Nowość: multiplayer bez serwera – dwie karty tej samej przeglądarki
 * (BroadcastChannel) albo gra przez internet (WebRTC + kody zaproszeń).
 */
export const RELEASE_HIGHLIGHTS: { title: string; text: string }[] = [
  {
    title: 'Ekwipunek jak w Minecrafcie',
    text: 'Plecak ma teraz siatkę rzemieślniczą 2×2 na górze (a przy stole 3×3), obok zbroję i podgląd własnej postaci, pod spodem 27 slotów i pasek szybkiego dostępu. Książka przepisów otwiera się jednym przyciskiem.',
  },
  {
    title: 'Deski i stół bez zgadywania',
    text: 'Tapnięcie kładzie w siatce JEDEN przedmiot, więc cztery deski w kwadracie robi się czterema tapnięciami. Na górze są też skróty „Deski (dąb)” i „Stół rzemieślniczy” – jeśli masz składniki, wystarczy jedno dotknięcie.',
  },
  {
    title: 'Telefon gra się w poziomie',
    text: 'W grze w pionie pojawia się czytelna prośba o obrót, a przycisk „Pełny ekran i poziomo” włącza fullscreen i blokuje orientację (tam, gdzie przeglądarka na to pozwala). Przycisk ⛶ w grze robi teraz jedno i drugie.',
  },
  {
    title: 'Lepszy dotyk w oknach',
    text: 'Książka przepisów jest domyślnie otwarta na komputerze i schowana na telefonie, przycisk zamykania omija notch, a w poziomie panel plecaka mieści się bez przewijania.',
  },
  {
    title: 'Nadal: publiczny serwer, skórki i pochodnia',
    text: 'Osiem skórek, publiczny serwer z jednym wspólnym światem, budowle w chmurze, wspólna pora dnia i pogoda, nowoczesne tekstury, lista komend w czacie, pochodnia w dłoni oświetlająca okolicę i naprawione kody zaproszeń (koniec błędu „wrong state”) – wszystko zostaje.',
  },
];
