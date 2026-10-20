/** Single release label shared by the menu, HUD, and in-game help. */
export const GAME_VERSION = '2.12.0';
export const GAME_RELEASE_NAME = 'Skórki i dotyk';

/**
 * 2.10: krótka lista zmian pokazywana w menu pauzy.
 * Nowość: multiplayer bez serwera – dwie karty tej samej przeglądarki
 * (BroadcastChannel) albo gra przez internet (WebRTC + kody zaproszeń).
 */
export const RELEASE_HIGHLIGHTS: { title: string; text: string }[] = [
  {
    title: 'Wreszcie stół rzemieślniczy z każdego drewna',
    text: 'Każdy pień – dąb, brzoza i akacja – daje teraz 4 deski w siatce 2×2, a 4 deski składają się w stół rzemieślniczy. Wcześniej przepis na deski z akacji nie istniał, więc w sawannie nie dało się zrobić nawet stołu.',
  },
  {
    title: 'Wybierz swoją postać',
    text: 'Nowa zakładka „Postać” w opcjach i pasek skórek w poczekalni multiplayera: 8 wyglądów (Steve, Alex, creeper, enderman, rycerz, ninja, złoty i podróżnik). Skórka zapisuje się w przeglądarce i jest widoczna u innych graczy – także na liście osób online.',
  },
  {
    title: 'Telefon wreszcie na pierwszym miejscu',
    text: 'Możesz wybrać rozmiar przycisków dotykowych (małe, średnie, duże). Na niskim ekranie – czyli po obróceniu telefonu poziomo – przyciski i hotbar same się zmniejszają, czat nie wchodzi na serca, a menu i okna omijają notcha oraz pasek gestów (safe-area).',
  },
  {
    title: 'Wygodniejszy ekwipunek na dotyku',
    text: 'Siatka rzemieślnicza nie rozjeżdża się już na małych ekranach, pola tekstowe mają 16 px (iOS nie przybliża wtedy strony), a każde dotknięcie trafia w element o wysokości co najmniej 44 px.',
  },
  {
    title: 'Publiczny serwer i pochodnia w dłoni – bez zmian',
    text: 'Serwer publiczny z jednym wspólnym światem działa jak w 2.11, a pochodnia trzymana w dłoni nadal oświetla najbliższe bloki w jaskini i w nocy. Tekstury, liście i chmury zostały po staremu.',
  },
  {
    title: 'Nadal: serwer, tekstury, komendy i dotyk',
    text: 'Wszystko z 2.9–2.11 zostaje: jeden przycisk „Graj online”, wspólny świat i budowle w chmurze, nowoczesne tekstury, lista komend w czacie, naprawione kody zaproszeń (koniec błędu „wrong state”) oraz zamykanie ekwipunku dotykiem.',
  },
];
