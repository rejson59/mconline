/** Single release label shared by the menu, HUD, and in-game help. */
export const GAME_VERSION = '2.8';
export const GAME_RELEASE_NAME = 'Płynny świat';

/** 2.8: krótka lista zmian pokazywana w menu pauzy. */
export const RELEASE_HIGHLIGHTS: { title: string; text: string }[] = [
  { title: 'Szybsze chunki', text: 'Indeks świateł i typowane bufory – mniej pracy na każdą klatkę.' },
  { title: 'Lżejsze efekty', text: 'Cząstki w jednym obiekcie (instancing) i współdzielone ikony na ziemi.' },
  { title: 'Płynniejsza woda', text: 'Delikatna fala na tafli wody i gradientowe niebo o zachodzie.' },
  { title: 'Bez zacięć na krawędziach', text: 'Chunki wchodzące w zasięg naprawiają siatkę sąsiadów.' },
  { title: 'Czystszy interfejs', text: 'Nowe menu, wyraźniejszy wybrany slot i czytelniejsze paski.' },
];
