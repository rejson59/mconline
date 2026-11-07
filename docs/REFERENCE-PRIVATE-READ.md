# Odczyt prywatnego pliku przez runner — etap 2

2026-11-07. Etap techniczny drogi transferu, nie migracja runtime'u gry. Wersja pozostaje 4.30.0; oryginały Minecrafta nie są jeszcze przesyłane.

## Wynik testu właściciela

Właściciel zgłosił `TEST BACKENDU OK`, utworzenie pliku 79 bajtów, poprawny prywatny odczyt oraz zablokowany publiczny odczyt. Suma:

```text
a46cc1a5248a3967c1b3ec5adccfcd83d86fdcc7fdeed200646d495b45c756b6
```

Obliczona niezależnie suma oczekiwanego tekstu jest identyczna. Odczyt metadanych Storage potwierdził prywatny bucket `mconline-reference-private`, limit 10 MiB i obiekt `probes/roundtrip-v1.txt` o rozmiarze 79 bajtów. Taki odczyt metadanych **nie pobiera zawartości** obiektu.

[Pokwitowanie i metadane](benchmarks/reference-owner-probe-receipt.json) rozróżniają raport właściciela od obserwacji agenta. Pierwsza próba runnera zakończyła się HTTP 403. Po poprawce tożsamości OIDC właściciel ponowił zadanie: **próba 2 zakończyła się sukcesem rzeczywistego prywatnego odczytu** (szczegóły poniżej).

## Potwierdzony odczyt runnera

2026-11-07: [uruchomienie 42318667829, próba 2](https://github.com/rejson59/mconline/actions/runs/42318667829/attempts/2), zadanie `reference-private-read`, check `128370776531` — **SUCCESS**. Adnotacja **Private reference read proof** potwierdza `verified:true`, **79 bajtów** i SHA-256 zgodny z powyższym. `storageWrites:false`, `originalsAccessTested:false`, `sandboxDirectAccess:false`. Właściciel i wyzwalający: GitHub ID `185239338`, zdarzenie `workflow_dispatch`, gałąź `main`.

[Trwałe pokwitowanie odczytu](benchmarks/reference-runner-read-proof.json) zapisuje bezpieczną adnotację API, identyfikatory próby i ograniczenia dowodu. Runner rzeczywiście pobrał bajty i niezależnie sprawdził rozmiar, hash oraz nagłówek. Agent odczytał ten raport przez API GitHub, nie bajty bezpośrednio ze Storage. Ponowienie użyło starszego commita klienta `f3fd7217086aef4734082e8a57988ae6f636a601`; skrypt był niezmieniony i skontaktował się z poprawioną funkcją v2.

**Nie trzeba ponawiać testu.** Kolejny etap to dopiero przygotowanie transportu dużych plików z wznawianiem, manifestami, sumami i niezależną kopią zapasową. Obecne endpointy nadal obsługują wyłącznie stały plik testowy, nie oryginały. Odczyt probe nie jest dowodem kompletności korpusu ani zgodności gry 1:1.

## Opcjonalne powtórzenie na telefonie

Aby kiedyś powtórzyć test, można otworzyć [poprzednie uruchomienie](https://github.com/rejson59/mconline/actions/runs/42318667829) i wybrać **Re-run failed jobs**. Skrypt klienta nie zmienił się; ponowienie otrzyma świeżą tożsamość. Napisz potem „uruchomione”.

Alternatywnie można rozpocząć nowe uruchomienie:

1. Otwórz [GitHub → Actions → CI](https://github.com/rejson59/mconline/actions/workflows/ci.yml).
2. Wybierz **Run workflow**, gałąź **main**.
3. Zaznacz nową opcję **Odczyt prywatnego pliku testowego (79 bajtów, bez zapisu)**.
4. Kliknij **Run workflow**. Poprzedniej opcji testu połączenia nie trzeba zaznaczać.
5. Napisz w rozmowie „uruchomione” albo podaj link do zadania. Agent odczyta osobne zadanie `reference-private-read` i jego adnotację **Private reference read proof**. Zielony zwykły CI z pominiętym zadaniem nie jest wynikiem tego testu.

Nie potrzebujesz nowych haseł, tokenów, sekretów Actions ani pobierania plików na telefon. Integracja Arena wcześniej otrzymała 403 na ręczny dispatch, dlatego nie powtarzamy próby ani nie zmieniamy triggera, aby obchodzić to ograniczenie.

## Pierwszy wynik i poprawka tożsamości OIDC

[Uruchomienie 42318667829](https://github.com/rejson59/mconline/actions/runs/42318667829), pierwsza próba, zadanie `128237565631`: **HTTP 403**, bez dowodu odczytania bajtów. Zwykła weryfikacja CI przeszła, ale nie jest dowodem prywatnego odczytu.

Przyczyną niezgodności konfiguracji był oczekiwany przez nas stary format `sub`. Niezależny od kodu odczyt API konfiguracji repozytorium potwierdził `use_immutable_subject=true` i prefiks z identyfikatorami właściciela/repozytorium. [Obserwacja API i przypięta dokumentacja GitHuba](reference-oidc-trust.json) wskazują dokładnie:

```text
repo:rejson59@185239338/mconline@1387893577:ref:refs/heads/main
```

Wdrożona v2 wymaga wyłącznie tej wartości. Nie akceptuje równolegle starego formatu, nie zmienia konfiguracji OIDC repozytorium i zachowuje wszystkie pozostałe warunki podpisu, czasu, właściciela, repozytorium, workflow oraz brancha. Nie rejestrowano rzeczywistych tokenów.

Wcześniejsze testy budowały `sub` z tej samej stałej co serwer, dlatego nie mogły wykryć błędnego założenia o konfiguracji zewnętrznej. Teraz poprawny podpisany token w testach używa niezależnie zaobserwowanej wartości z pokwitowania API. Dodatkowe regresje sprawdzają zgodność konfiguracji, akceptację ponowienia (`run_attempt=2`) oraz odrzucanie starego formatu i zmienionych identyfikatorów przed kontaktem ze Storage. Testy lokalne nie zastępują rzeczywistego wyniku. Po poprawce niezależna próba 2 runnera przeszła, jak opisano wyżej.

## Nowa, wąska ścieżka odczytu

Osobna funkcja `mconline-reference-reader` (ACTIVE v2, ID `a1492d8f-4734-431c-ad41-792b0501c848`) ma tylko jedną zdolność: odczyt istniejącego pliku testowego. Nie przyjmuje ścieżki, treści, identyfikatora innego obiektu ani parametrów query. Nie zapisuje, nie tworzy bucketu, nie listuje i nie usuwa danych. Nie zmienia istniejącej funkcji panelu ani bramki gry.

Autoryzacja nie korzysta z Twojej sesji strony ani service-role w GitHub. Ręcznie uruchomione zadanie otrzymuje krótkotrwały token tożsamości GitHub Actions OIDC. Serwer sprawdza podpis i czas ważności biblioteką **jose 6.2.15**, wyłącznie RS256, z kluczami pobieranymi ze stałego, zaufanego adresu GitHub. Nie ufa samemu rozkodowanemu payloadowi i nie pobiera kluczy z adresu podanego w JWT.

Weryfikowane są:

- issuer `https://token.actions.githubusercontent.com`;
- audience `mconline-reference-probe-read-v1`;
- stały identyfikator repozytorium `1387893577` i nazwa `rejson59/mconline`;
- stały identyfikator właściciela GitHub `185239338` jako `actor_id`;
- gałąź `refs/heads/main`, zdarzenie `workflow_dispatch`, konkretny plik `.github/workflows/ci.yml` na `main` i zgodny `sub`;
- `runner_environment=github-hosted`, poprawne identyfikatory run/attempt;
- wymagane `iat`, `nbf`, `exp` i maksymalny wiek tokenu 10 minut, z tolerancją zegara 30 sekund.

Żądania przeglądarki z Origin są odrzucane, nie ma CORS. Brak lub nieprawidłowy token nie daje odczytu. Token innego repozytorium, brancha, workflow, właściciela lub zdarzenia także nie daje odczytu, nawet jeśli jest poprawnie podpisany przez GitHub. Uprawnienie `id-token:write` istnieje **tylko** w tym ręcznym zadaniu; pozostałe zadania nadal mają `contents:read`.

Po autoryzacji funkcja potwierdza, że bucket nadal jest prywatny. Pobiera maksymalnie 79 bajtów ze stałej ścieżki i sprawdza dokładny rozmiar oraz SHA-256. Dopiero wtedy zwraca bajty zadaniu. Zmiana zawartości, publiczny bucket, brak obiektu lub błąd upstreamu powodują odmowę, nie zastępowanie zawartości wzorcowym tekstem.

`scripts/read-reference-probe.mjs` niezależnie liczy SHA-256 faktycznie otrzymanych bajtów i porównuje rozmiar, oczekiwaną sumę oraz nagłówek odpowiedzi. Tokeny pozostają w pamięci, nie są wypisywane, zapisywane w repo ani dodawane do artefaktów. Raport publiczny zawiera tylko wynik, rozmiar, sumę i jawne granice testu, bez zawartości pliku i bez poświadczeń.

## Zakres dowodu

Uzyskany pozytywny wynik oznacza **prywatny Storage → autoryzowana funkcja → GitHub-hosted runner**, z kontrolą integralności w obu miejscach. Agent odczytuje raport przez API GitHub. Nie oznacza to bezpośredniego dostępu sieciowego sandboxa do Storage.

To test jednego, niesekretnego pliku 79 bajtów. Nie udostępnia dowolnych oryginałów, nie jest uploadem, kopią zapasową ani dowodem poprawnego przetwarzania dużych plików. Panel `/testy/` nadal pokazuje wynik swojego testu backendu, a nie globalny stan osobnego workflow; jego pole `analysisPrivateReadVerified:false` nie jest aktualizowane przez samo uruchomienie Actions.

Oryginalny plik pozostaje w magazynie bez nadpisania i automatycznego kasowania. Nie nadawano admina, nie zmieniano ról, RLS, polityk Storage, profili, światów i kont ani nie uruchamiano migracji. Nie wyłączano żadnych zabezpieczeń, żeby test przeszedł.

## Kod i weryfikacja

- Źródło: `supabase/functions/mconline-reference-reader/index.ts`.
- Odtworzenie wdrażanego modułu: `node scripts/compile-reference-reader.mjs`; SHA i dokładna zależność npm w [reference-reader-build.json](benchmarks/reference-reader-build.json). Bez importowania kodu z ruchomego brancha GitHub.
- 14 regresji offline, z **rzeczywistymi podpisami RSA** i syntetycznym JWKS: zły podpis/issuer/audience, token wygasły/przyszły/stary, brak claimów, obce repo/actor/ref/workflow/event, body/query/origin, publiczny bucket, ucięty/zmieniony plik, cache JWKS i świeży odczyt obiektu, kontekst joba i integralność po stronie klienta.
- `npm test`: **25 839 sprawdzeń**; typecheck i build — PASS. Użyto nowego patcha Vite 7.3.7 i source-map-js 1.2.2, usuwających zgłoszone przez audit podatności narzędzi deweloperskich; `npm audit` dla całego drzewa — **0 podatności**. Brak aktualizacji major.
- CI ma dodatkowe rzeczywiste negatywne kontrole endpointu: brak tożsamości zadania, fałszywa tożsamość, zwykły anon JWT Supabase i żądanie z przeglądarki. Nie odczytują pliku i nie używają rzeczywistych sesji użytkownika.
- **Pozytywny test rzeczywistego OIDC i prywatnego odczytu w runnerze: PASS**, uruchomienie `42318667829`, próba 2, check `128370776531`. To odrębny dowód od lokalnych podpisów, statusu ACTIVE i negatywnych kontroli CI.
