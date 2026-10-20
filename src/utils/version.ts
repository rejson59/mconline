/** Single release label shared by the menu, HUD, and in-game help. */
export const GAME_VERSION = '2.8.2';
export const GAME_RELEASE_NAME = 'Zdrowe drzewa';

/**
 * 2.8.2: krótka lista zmian pokazywana w menu pauzy.
 * Poprawki zgłoszone po 2.8.1: czarne drzewa, przezroczyste liście,
 * nierealistyczne światło i zbyt szybkie chmury.
 */
export const RELEASE_HIGHLIGHTS: { title: string; text: string }[] = [
  { title: 'Drzewa od zera', text: 'Nowy generator: pełne korony bez dziur, osobne liście akacji i drzewa rosnące z sadzonki w dokładnie ten sam kształt.' },
  { title: 'Koniec czarnych pni', text: 'Naprawiony atlas – liście dżungli i akacji nie są już w 100% puste, a wygładzanie krawędzi w końcu trafia na teksturę.' },
  { title: 'Słońce i cień', text: 'Światło pada kierunkowo: ściany od słońca jaśnieją, przeciwne gasną, a noc ma łagodną księżycówkę zamiast smoły.' },
  { title: 'Pochodnia naprawdę świeci', text: 'Trzymana pochodnia, latarnia lub jasnogłaz oświetlają okolicę na 14 bloków, także w jaskini.' },
  { title: 'Spokojne chmury', text: 'Chmury z miękkiego szumu płyną dwa razy wolniej i nie znikają po horyzoncie – pogoda wygląda jak pogoda.' },
];
