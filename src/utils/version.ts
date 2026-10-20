/** Single release label shared by the menu, HUD, and in-game help. */
export const GAME_VERSION = '2.8.1';
export const GAME_RELEASE_NAME = 'Światło i chmury';

/**
 * 2.8.1: krótka lista zmian pokazywana w menu pauzy.
 * Poprawki zgłoszone po 2.8: czarne drzewa, prześwitujące liście,
 * nierealistyczne światło i chmury niezgodne z pogodą.
 */
export const RELEASE_HIGHLIGHTS: { title: string; text: string }[] = [
  { title: 'Żywe światło', text: 'Nowy model światła: miękki cień koron i ścian, ciemne jaskinie i wieczór bez czarnych plam.' },
  { title: 'Pochodnia w dłoni', text: 'Trzymana pochodnia, latarnia albo jasnogłaz naprawdę oświetla najbliższe bloki.' },
  { title: 'Gęste liście', text: 'Liście bez dziur i czarnych ścianek, a pod koroną zostaje zielony półcień zamiast smoły.' },
  { title: 'Chmury zgodne z pogodą', text: 'Deszcz sprowadza niską, ciemną warstwę chmur, noc je przygasza, a wiatr gna je szybciej.' },
  { title: 'Płynna pogoda', text: 'Deszcz gasi niebo, pogrubia i zabarwia mgłę, a przejście pogody trwa kilka sekund.' },
  { title: 'Lepszy start', text: 'Nowy świat nie zaczyna się już na czubku drzewa – gracz staje na prawdziwym gruncie.' },
];
