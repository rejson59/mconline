/** Single release label shared by the menu, HUD, and in-game help. */
export const GAME_VERSION = '2.9.0';
export const GAME_RELEASE_NAME = 'Nowy wygląd';

/**
 * 2.9: krótka lista zmian pokazywana w menu pauzy.
 * Poprawki zgłoszone po 2.8.2: brak wyjścia z ekwipunku na telefonie,
 * niewygodne komendy i tekstury w stylu najstarszych wersji Minecrafta.
 */
export const RELEASE_HIGHLIGHTS: { title: string; text: string }[] = [
  {
    title: 'Ekwipunek zamyka się na dotyku',
    text: 'Każde okno (ekwipunek, skrzynia, piec, kowadło, statyw, handel) ma duży przycisk „Zamknij”, przycisk „Gotowe” na dole i zamyka się tapnięciem w tło.',
  },
  {
    title: 'Czat z listą komend',
    text: 'Wpisz „/”, aby zobaczyć podpowiedzi, albo otwórz pełną listę pogrupowaną tematycznie. Tapnięcie wstawia komendę, a „Wyślij” działa bez klawisza Enter.',
  },
  {
    title: 'Tekstury jak w nowym Minecrafcie',
    text: 'Nowy warsztat malarski: wygładzony szum zamiast ziarna, krótka paleta, światło z lewej góry, kora z bruzdami, deski z sękami, kiście liści i kamyki w żwirze.',
  },
  {
    title: 'Czytelne bloki',
    text: 'Każdy kafel ma delikatny skos i spójne krawędzie, więc bloki odróżniają się od siebie, a sąsiednie ściany nie zlewają się w jedną plamę.',
  },
  {
    title: 'Nadal: drzewa, światło i pochodnia',
    text: 'Wszystko z 2.8.2 zostaje: pełne korony, kierunkowe słońce, księżycówka w nocy i pochodnia świecąca w dłoni na 14 bloków.',
  },
];
