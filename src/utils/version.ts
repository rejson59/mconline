/** Single release label shared by the menu, HUD, and in-game help. */
export const GAME_VERSION = '2.11.0';
export const GAME_RELEASE_NAME = 'Wspólny świat';

/**
 * 2.10: krótka lista zmian pokazywana w menu pauzy.
 * Nowość: multiplayer bez serwera – dwie karty tej samej przeglądarki
 * (BroadcastChannel) albo gra przez internet (WebRTC + kody zaproszeń).
 */
export const RELEASE_HIGHLIGHTS: { title: string; text: string }[] = [
  {
    title: 'Serwer publiczny – jeden świat dla wszystkich',
    text: 'W menu „Gra razem” jest teraz jeden przycisk „Graj online”. Nie ma kodów, gospodarza ani zapraszania: każdy wchodzi do tego samego świata i widzi pozostałych graczy.',
  },
  {
    title: 'Budowle zostają w chmurze',
    text: 'Zmiany bloków zapisują się na serwerze (Supabase) i wracają po odświeżeniu strony oraz po wejściu z innego urządzenia. Nic nie ginie po zamknięciu karty.',
  },
  {
    title: 'Wspólna pora dnia i pogoda',
    text: 'Dzień, noc i deszcz wynikają z zegara serwera, więc wszyscy widzą to samo niebo bez wysyłania stanu. Wieczorem zapada zmierzch, w dzień świeci słońce.',
  },
  {
    title: 'Naprawione kody zaproszeń',
    text: 'Błąd „Called in wrong state: stable” już się nie pojawia – drugie użycie tego samego kodu daje czytelną podpowiedź po polsku. Tryby „Ta przeglądarka” i „Przez internet” zostały jako dodatki.',
  },
  {
    title: 'Nadal: tekstury, dotyk i komendy',
    text: 'Wszystko z 2.9–2.10 zostaje: nowoczesne tekstury, zamykanie ekwipunku dotykiem, lista komend, awatary graczy z nazwami, czat, drzewa i pochodnia w dłoni z 2.8.2.',
  },
];
