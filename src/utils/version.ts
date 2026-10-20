/** Single release label shared by the menu, HUD, and in-game help. */
export const GAME_VERSION = '2.14.0';
export const GAME_RELEASE_NAME = 'Auto-bicie';

/**
 * 2.10: krótka lista zmian pokazywana w menu pauzy.
 * Nowość: multiplayer bez serwera – dwie karty tej samej przeglądarki
 * (BroadcastChannel) albo gra przez internet (WebRTC + kody zaproszeń).
 */
export const RELEASE_HIGHLIGHTS: { title: string; text: string }[] = [
  {
    title: 'Auto-bicie wrogich mobów',
    text: 'Postać sama uderza zombie, creepery, szkielety, pająki, slimy, endermany i ghasty w zasięgu ręki – z tym samym cooldownem, obrażeniami narzędzia i dźwiękami, co ręczny cios. Auto-bicie nie bije przez ściany, a zwierzęta i mieszkańcy zostają bezpieczni.',
  },
  {
    title: 'Auto-skok, który wreszcie działa',
    text: 'Stara wersja wymagała zderzenia ze ścianą i niezerowej prędkości, a zderzenie zeruje prędkość – więc auto-skok prawie nigdy się nie odpalał. Teraz postać sprawdza klocek przed sobą i wskakuje na każdy jednoblokowy schodek bez zatrzymania. Auto-skok wyciąga też z wody na brzeg.',
  },
  {
    title: 'Włączasz w pauzie, nie w opcjach',
    text: 'W menu pauzy są teraz dwa szybkie przełączniki: Auto-skok i Auto-bicie. To samo znajdziesz w Opcje → Sterowanie. Wybór zapisuje się w przeglądarce i obowiązuje w każdym świecie.',
  },
  {
    title: 'Wygodne na telefonie i na komputerze',
    text: 'Na dotyku postać dodatkowo delikatnie obraca się w stronę najbliższego wroga, więc walka palcem nie wymaga precyzyjnego celowania. Na komputerze działa to samo auto-bicie, a kamera zostaje pod pełną kontrolą myszy.',
  },
  {
    title: 'Nadal: publiczny serwer, ekwipunek i poziom',
    text: 'Osiem skórek, publiczny serwer z jednym wspólnym światem i budowlami w chmurze, ekwipunek jak w Minecrafcie (siatka 2×2, stół 3×3, 1 pień → 4 deski), wymuszony poziom i pełny ekran na telefonie, dotykowe sterowanie, nowoczesne tekstury, lista komend w czacie, pochodnia w dłoni i naprawione kody zaproszeń („wrong state”) – wszystko zostaje.',
  },
];
