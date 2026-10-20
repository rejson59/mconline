/** Single release label shared by the menu, HUD, and in-game help. */
export const GAME_VERSION = '2.10.0';
export const GAME_RELEASE_NAME = 'Gra razem';

/**
 * 2.10: krótka lista zmian pokazywana w menu pauzy.
 * Nowość: multiplayer bez serwera – dwie karty tej samej przeglądarki
 * (BroadcastChannel) albo gra przez internet (WebRTC + kody zaproszeń).
 */
export const RELEASE_HIGHLIGHTS: { title: string; text: string }[] = [
  {
    title: 'Gra razem – bez serwera',
    text: 'Nowy ekran „Gra razem” w menu głównym. Otwórz pokój, podaj kod znajomym i grajcie we wspólnym świecie – BlockCraft nie potrzebuje własnego serwera.',
  },
  {
    title: 'Dwie karty na jednym komputerze',
    text: 'Tryb „Ta sama przeglądarka” działa od razu: otwórz grę w drugiej karcie, wpisz ten sam kod pokoju i jesteście w jednym świecie. Działa też offline.',
  },
  {
    title: 'Przez internet na kodach',
    text: 'Tryb „Przez internet” łączy bezpośrednio (WebRTC). Gospodarz wysyła kod zaproszenia, gość odsyła kod odpowiedzi – oba kopiują się jednym przyciskiem, także na telefonie.',
  },
  {
    title: 'Wspólny świat i gracze',
    text: 'Wszyscy widzą te same bloki, czat, porę dnia i pogodę. Nad innymi graczami unoszą się kolorowe awatary z nazwami, a w HUD jest lista osób z pingiem.',
  },
  {
    title: 'Nadal: tekstury, dotyk i komendy',
    text: 'Wszystko z 2.9 zostaje: nowoczesne tekstury, zamykanie ekwipunku dotykiem, lista komend w czacie oraz drzewa, światło i pochodnia z 2.8.2.',
  },
];
