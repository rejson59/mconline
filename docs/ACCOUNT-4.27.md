# 4.27 — Jedno konto, wspólne logowanie

## Źródło i zgoda

Zmiana wykonana na wyraźne zlecenie właściciela: zastąpienie dotychczasowych metod logowania według [wspolne-konto-projekty.md](https://github.com/rejson59/rejson59.github.io/blob/main/docs/wspolne-konto-projekty.md).

Przeczytano cały dokument oraz implementacje `js/rejson-account.js` i `js/konto-demo.js`. Dokument i faktyczny provider przypięto w testach do commita **0a6fd96d02dfe4b9f62e2fb62859d2134f438a20**, z długościami i SHA-256 w `.harness/fixtures/rejson-account/manifest.json`. Kopie są materiałem referencyjnym upstreamu, nie nową autorską implementacją dostawcy tożsamości.

## Co zastąpiono

Usunięto formularze logowania/rejestracji nazwa + hasło/PIN w grze, ich walidatory, bezpośrednie wywołania `community_login` / `community_register`, kopię klucza anon konta, własny zapis tokenu i dawny przycisk usuwający wspólną sesję z localStorage. Historyczne nazwy plików/identyfikatory `community_*` nie są migrowane ani usuwane z backendu.

Zamiast nich:

1. Bezpośredni przycisk **Konto rejson59.github.io...** w menu i dostęp przez Informacje. UI mówi o ogólnym koncie strony, nie „koncie społecznościowym”.
2. Jawny bootstrap w HTML dołącza `<script defer src="/js/rejson-account.js?v=1">` **tylko** na `https://rejson59.github.io`. Nie wymaga wcześniejszej wizyty na stronie głównej ani service workera. Czeka na `rj:account-ready`, obsługuje błąd ładowania i timeout.
3. Przycisk **Zaloguj się przez rejson59.github.io** wywołuje `getSession()`. Potwierdzona nazwa trafia do UI; brak sesji po świadomym kliknięciu zapisuje tylko znacznik zamiaru i wywołuje `open()`. To skrypt strony obsługuje adres powrotu.
4. Po powrocie do gry znacznik otwiera panel i wymusza ponowne sprawdzenie. Sam powrót nie oznacza sukcesu. Brak sesji nie uruchamia pętli przekierowań. Obsłużono także `pageshow`/powrót BFCache.
5. `subscribe()` powoduje ponowną weryfikację po zmianie konta lub wylogowaniu. Poprzednia nazwa jest usuwana przed oczekiwaniem na odpowiedź. Numery żądań i anulowanie oczekiwań nie pozwalają opóźnionej odpowiedzi poprzedniego konta zastąpić nowego.
6. **Rozłącz ten projekt** czyści tylko stan gry w tej karcie. Nie usuwa `rejson_community_session_v1`, nie wywołuje globalnego logout i nie wylogowuje innych projektów. Jawne rozłączenie jest pamiętane również w pamięci dokumentu, gdy sessionStorage jest zablokowane. **Zarządzaj kontem na stronie** otwiera wspólną stronę w tej samej karcie z ponowną weryfikacją po powrocie.
7. Osobne stany: sprawdzanie, potwierdzone konto, brak sesji, błąd sieci z ponowieniem, otwieranie strony i nieobsługiwany origin. Zamknięcie panelu usuwa subskrypcje/nasłuchy i unieważnia oczekujące odpowiedzi. Focus trap/Escape działają również podczas sprawdzania.

Projekt zapisuje w sessionStorage wyłącznie `mconline-account-pending-v1` (czas zamiaru, ważny do 30 minut), `mconline-account-connected-v1` i `mconline-account-disconnected-v1` (znaczniki). Żaden z tych znaczników nie jest dowodem tożsamości. Adapter przekazuje do UI tylko `{username}` z potwierdzonego wyniku, **nie kopiuje tokenu**. Brak bezpiecznego zapisu zamiaru nie uruchamia przekierowania do logowania.

## Origin i granice zaufania

`https://rejson59.github.io/mconline/` ma ten sam origin co strona główna. Inny protokół, host lub port, Vercel, preview oraz `file://` go nie mają. Nie ładujemy tam providera, nie czytamy sesji strony i nie oferujemy zastępczego logowania własnym formularzem. UI kieruje do produkcyjnej gry. Nie ma przesyłania tokenu w URL, historii, QR, iframe ani `postMessage`. To **nie OAuth/OIDC ani nowy dostawca SSO**.

Produkcyjny skrypt strony pozostaje zewnętrzną zależnością na tym samym originie. Weryfikuje token przez serwerowe `community_whoami`; nie ufa nazwie zapisanej w localStorage. Kontroler gry nie jest serwerem autoryzacji. Projekty współdzielące origin **nie są wzajemnie odizolowane** — skrypty tego originu mogą czytać wspólną pamięć. Nie deklarujemy inaczej.

W repo nie ma blokującej meta CSP; istniejący bootstrap używa inline JS. Przy dodaniu CSP musi ona pozwalać na jawny helper oraz wymagane połączenie z serwerem konta. Integracja obsługuje niedostępność providera/serwera jako błąd, nie jako zalogowanie.

## Audyt zapisu/autoryzacji i czego nie migrowano

Sprawdzono `src/game/profile.ts`, `src/game/online.ts`, interfejs multiplayer oraz migracje RPC działek/miasta. Backend świata (`bewwejewgqzctnjrbclu`) jest **inny** od backendu ogólnego konta, używanego przez upstreamowy helper (`hzbqzfimtroixnldzjeq`). Publiczny profil opiera się na dotychczasowym identyfikatorze przeglądarki; chronione zapisy działek/miasta używają osobnego klucza-capability i kontroli właściciela w RPC. Nie ma obecnie serwerowego mapowania tych identyfikatorów na ogólne konto strony.

Dlatego nie podstawiono nazwy użytkownika ani wspólnego tokenu za klucz gracza/działek. Nie dodano autoryzacji prywatnych danych polegającej na nazwie, UI, user_id lub localStorage. Nie powstał nowy magazyn prywatnych danych konta. To potwierdzona sesja do warstwy konta w UI, **nie nowe uprawnienia do świata**.

Bez zmian SQL, identyfikatorów, profili, światów, ekwipunku, praw działek/ulic i danych na publicznych serwerach. Gra bez konta nadal jest dostępna; nazwa/nick gracza nie jest osobnym formularzem logowania. Lokalne światy pozostają danymi urządzenia, nie są ukrywane ani kasowane po zmianie ogólnego konta. Synchronizacja i migracja właścicieli wymagają osobnej zgody, projektu backendowego, kontroli właściciela oraz testów prywatności — nie są obiecywane w tej zmianie.

## Weryfikacja

- Typecheck, produkcyjny build, pełny zestaw **25 370 kontroli** na Node 22.22.3 i `git diff --check`: 240 panoramy, 599 kierunków, 678 pieca, 5746 audytu natywnego, 16 747 silnika, 436 ognia, 81 meshingu, 403 audio, 413 UI, **23 scenariusze konta**, 4 testy bootstrapów.
- Testy konta obejmują ścisły origin, TTL/nieprawidłowy zamiar, weryfikację nazwy zamiast danych z pamięci, wycięcie tokenu z modelu UI, powrót z/bez sesji, brak automatycznych pętli, błędy/timeout/ponowienie, zmianę konta, spóźnione odpowiedzi, logout strony, rozłączenie projektu, zablokowaną pamięć, opóźnione załadowanie helpera i sprzątanie.
- Statyczny bootstrap jest wykonywany w VM dla źródłowego i zbudowanego HTML: ścisła lista originów i brak duplikowania helpera.
- Produkcyjny Chromium/SwiftShader na desktopie i mobilnym viewporcie 390×844: zbudowany HTML i **rzeczywisty przypięty skrypt providera**, ale symulowana strona logowania i odpowiedzi `community_whoami`, wyłącznie syntetyczne konta. To **nie test żywych kont ani publicznego serwera auth**.
- W obu przypadkach pierwszy bezpośredni start bez service workera ładuje helper; nawigacja w tej samej karcie do strony logowania i z powrotem automatycznie otwiera panel; potwierdzona nazwa różni się od celowo sfałszowanej nazwy w pamięci. Sprawdzono ponowne użycie istniejącej sesji, zarządzanie kontem/powrót, rozłączenie tylko projektu, zmianę konta z przetrzymaną starą odpowiedzią, logout strony, HTTP 503 i ponowienie. Zapisy świata i profil pozostały identyczne. Nie ma wywołań starych RPC logowania/rejestracji ani sekretów w URL.
- Preview, lokalny HTML i inny HTTPS origin: informacja o ograniczeniu, zero pobrań helpera, zero formularzy poświadczeń. Zero wyjątków aplikacji w pięciu przypadkach. Oczekiwany błąd HTTP 503 w scenariuszu awarii jest rozróżniany od błędu aplikacji.
- Obejrzano mobilny ekran konta. Mobilny viewport nie jest fizycznym telefonem. Produkcyjna regresja pieca/GUI/Workera/zapisu na desktopie również przeszła.

Raport: [benchmarks/account-4.27.json](benchmarks/account-4.27.json). Bieżące raporty i zrzuty są w ignorowanym `.cache/verification427/`.

```sh
npm ci
npm run typecheck && npm run build && npm test
npm run test:account
npm install --prefix .cache/browser-tools puppeteer-core @sparticuz/chromium
npm run preview -- --host 0.0.0.0 --port 4173
# Drugi terminal; same-origin scenariusze mają przechwyconą sieć, nie żywy auth:
npm run test:browser:account
BROWSER_CASES=desktop npm run test:browser:facing
```

Nie próbowano logowania prawdziwymi kontami, nie tworzono kont testowych w publicznej bazie i nie zmieniano repo strony głównej. Żadne dane uwierzytelniające nie były wymagane od użytkownika. Nadal obowiązują ograniczenia zgodności Minecraft opisane w poprzednich wydaniach.

Artefakt lokalny: `dist/index.html`, **11245132 bajtów**, SHA-256 `38ef92984370616f3d9147cca5bead8f33ff65a433378e1daed47bff30e7c2bc`.
