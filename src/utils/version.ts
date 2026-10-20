/** Single release label shared by the menu, HUD, and in-game help. */
export const GAME_VERSION = '2.15.0';
export const GAME_RELEASE_NAME = 'Stabilny ekran';

/**
 * 2.10: krótka lista zmian pokazywana w menu pauzy.
 * Nowość: multiplayer bez serwera – dwie karty tej samej przeglądarki
 * (BroadcastChannel) albo gra przez internet (WebRTC + kody zaproszeń).
 */
export const RELEASE_HIGHLIGHTS: { title: string; text: string }[] = [
  {
    title: 'Kamera nie „przybliża się” po pełnym ekranie',
    text: 'Po wejściu w pełny ekran obraz potrafił się przyciąć i wyglądał jak zoom. Teraz płótno gry ma zawsze bufor dokładnie tej wielkości co widoczny ekran, a proporcje kamery są przeliczane natychmiast – także wtedy, gdy przeglądarka zgłosi nowy rozmiar z opóźnieniem po obrocie.',
  },
  {
    title: 'Przyciski i drążek zawsze w kadrze',
    text: 'Sterowanie dotykowe mierzy własną warstwę gry, a nie `window.innerHeight`, który po pełnym ekranie bywa nieaktualny. Drążek, skok, ekwipunek i pasek górny zostają na swoim miejscu – nie znikają poza dolną krawędź.',
  },
  {
    title: 'Panele znów się przewijają',
    text: 'Powłoka aplikacji jest przypięta do widocznego ekranu (z zapasem z `visualViewport`), a okna plecaka, kowadła, statywu, dziennika i punktów podróży liczą wysokość od niej, nie od `dvh`. Koniec z listami, których nie dało się doscrollować po obrocie.',
  },
  {
    title: 'Czyste wejście i wyjście z pełnego ekranu',
    text: 'Pełny ekran działa na powłoce aplikacji (nie na `<html>`), orientację blokujemy tylko na urządzeniach dotykowych, a Esc lub gest systemowy zawsze zwalnia blokadę i przebudza pomiary. Kilka kontrolnych pomiarów w pierwszej sekundzie łapie spóźnione zdarzenia przeglądarki.',
  },
  {
    title: 'Nadal: publiczny serwer, ekwipunek i poziom',
    text: 'Auto-bicie wrogich mobów i auto-skok na każdy schodek, ekwipunek jak w Minecrafcie (siatka 2×2, stół 3×3, książka receptur), wymuszony poziom i pełny ekran na telefonie, publiczny serwer z jednym wspólnym światem i zapisem w chmurze, skórki postaci (osiem wzorów), nowoczesne tekstury, lista komend w czacie, pochodnia w dłoni i naprawione kody zaproszeń („wrong state”) – wszystko zostaje. Jedna pień daje cztery deski, a cztery deski – stół rzemieślniczy.',
  },
];
