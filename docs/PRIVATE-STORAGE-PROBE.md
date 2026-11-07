# Prywatny test magazynu dla właściciela — etap 1

2026-11-07. To przygotowanie drogi do analizowania oryginalnych plików Java 26.3, **nie wdrożenie uploadu Minecrafta ani ukończonej zgodności 1:1**. Wersja silnika pozostaje 4.30.0.

**Aktualizacja po teście właściciela:** zgłoszono pozytywny wynik 79 bajtów z oczekiwanym SHA-256. Odczyt metadanych potwierdził istnienie obiektu i prywatny bucket. Odczyt przez osobne środowisko analizy nadal wymaga [etapu 2](REFERENCE-PRIVATE-READ.md).

## Potwierdzono

- Właściciel uruchomił ręcznie [CI 42314690988](https://github.com/rejson59/mconline/actions/runs/42314690988). Odczytano osobną adnotację zadania `reference-network`, nie tylko zielony status całego workflow.
- Runner zweryfikował SHA-1 oficjalnego manifestu 26.3 i indeksu zasobów. Indeks wskazuje 5147 obiektów / 485 135 675 bajtów. Obiektów nie pobrano. Klient: tylko 16-bajtowy prefiks ZIP, bez pełnego pobrania i sprawdzenia sumy całego JAR-a. Wymaganie runtime'u: Java 25.
- Anonimowy `HEAD` Storage dał HTTP 200. To łączność, nie dowód autoryzowanego zapisu lub odczytu.
- Odczyt systemu kont potwierdził jedno konto `rejson59`. Stały UUID wpisano do serwerowej allowlisty panelu. Nie pobierano sesji, haseł ani tokenów użytkownika.
- Przed etapem 1 Storage nie miał bucketów ani polityk `storage.objects`/`storage.buckets`; RLS obu tabel jest włączony. Żadnych polityk ani grantów nie zmieniono.

Raport łączności: [benchmarks/reference-connectivity-proof.json](benchmarks/reference-connectivity-proof.json).

## Nowe elementy

- [Panel `/mconline/testy/`](https://rejson59.github.io/mconline/testy/) — niezależny, mały HTML/JS, bez uruchamiania gry i bez wyboru plików. Kopiowany przez Vite z `public/testy/`.
- Osobna funkcja `mconline-reference-storage`, nie zmiana produkcyjnej bramki gry. `verify_jwt=false` jest celowe: sesja ogólnego konta nie jest JWT Supabase. Każde żądanie biznesowe weryfikuje sesję przez `mconline_identity`, a następnie porównuje zwrócony UUID z allowlistą właściciela. Podrobiona nazwa `rejson59`, token w localStorage lub element UI nie przyznają dostępu.
- Funkcję wdrożono jako ACTIVE v2 (ID `c9bffb80-4465-4479-8599-5f0e244bf273`). Wdrożono samodzielny moduł skompilowany z `supabase/functions/mconline-reference-storage/index.ts`, bez zdalnych importów kodu podczas uruchamiania. Odtworzenie: `node scripts/compile-reference-storage.mjs`; sumy źródła i wyniku: [benchmarks/reference-storage-build.json](benchmarks/reference-storage-build.json). To własny kod tego repo, nie kod gry Mojanga. Pierwszy wariant wdrożenia v1 z importem nie przeszedł rzeczywistej kontroli HTTP; zastąpiono go modułem v2, po czym CI autoryzacji przeszło. Nie usuwano i nie osłabiano testów.
- Klucz service-role pozostaje wyłącznie w środowisku Supabase. Klucze anon są publiczne i nie zastępują kontroli właściciela. Frontend nie ma klucza administracyjnego.

## Instrukcja na telefonie

1. Otwórz **https://rejson59.github.io/mconline/testy/**.
2. Jeśli nie jesteś zalogowany, wybierz **Zaloguj przez konto strony**. Używamy istniejącego helpera na tym samym dokładnym originie; nie nowego formularza haseł ani oddzielnego konta. Po powrocie strona ponownie sprawdza sesję.
3. Poczekaj na komunikat **Potwierdzone konto właściciela: rejson59**.
4. Naciśnij **Uruchom test prywatnego zapisu**.
5. Po komunikacie **TEST BACKENDU OK** naciśnij **Sprawdź ponowny odczyt**. Można też odświeżyć stronę i powtórzyć sam odczyt, aby potwierdzić obecność pliku w późniejszym żądaniu.
6. Napisz w rozmowie, co pokazał test. Jeśli się nie udał, wystarczy tekst komunikatu albo zrzut ekranu bez danych sesji. Nie wysyłaj tokenów ani haseł.

**Nadal nie pobieraj i nie przesyłaj dużych oryginałów.** Osobny runner odczytał już prywatny plik testowy 79 B — [etap 2 i pokwitowanie](REFERENCE-PRIVATE-READ.md). Transport dużych plików i niezależna kopia zapasowa nie są jeszcze gotowe.

## Co robi przycisk — i czego nie robi

Dostępne są tylko operacje `status`, `probe`, `read`. Nie ma operacji nadawania ról, usuwania, dowolnego uploadu, listowania cudzych danych lub zmiany światów.

- `status`: sprawdza konto; nic nie tworzy w Storage.
- `probe`: dopiero po autoryzacji może utworzyć prywatny bucket `mconline-reference-private`, limit obiektu 10 MiB i wyłącznie MIME text/plain, application/octet-stream, application/json. To limit przyszłego transportu porcjami, nie obietnica uploadu bez limitów. Jedyna obecnie zapisywalna zawartość to stały, **79-bajtowy** tekst pod `probes/roundtrip-v1.txt`.
- Istniejącego bucketu nie przekształca w prywatny po cichu: jeśli jest publiczny lub nie można tego potwierdzić, test kończy się błędem.
- Zapis ma `x-upsert:false`. Istniejącego pliku nie nadpisuje; jeśli różni się od oczekiwanego tekstu, zgłasza błąd i zostawia go nietkniętego. Równoległe utworzenie jest rozstrzygane ponownym odczytem identycznych bajtów.
- Weryfikuje zawartość po prywatnym odczycie, oblicza SHA-256, sprawdza odmowę odczytu przez publiczny endpoint. Odpowiedź 5xx lub nieoczekiwana odpowiedź publicznego endpointu nie jest uznawana za potwierdzoną ochronę.
- `read`: sprawdza istniejący bucket/plik, nie tworzy ich i ponawia porównanie.
- Brak automatycznego usuwania i operacji DELETE. Plik testowy zostaje. Nie ustawiono mechanizmu retencji usuwającego oryginały, bo oryginały nie są jeszcze przesyłane.

Nawet sukces potwierdza **round-trip backend ↔ Storage**, nie odczyt przez sandbox/runner. Odpowiedź jawnie zawiera `analysisPrivateReadVerified:false` i `originalsUploaded:false`. Prywatny bucket nie jest niezależną kopią zapasową i nie gwarantuje przechowywania po usunięciu projektu lub utracie konta.

## Sesje i bezpieczeństwo

- Dozwolony origin: dokładnie `https://rejson59.github.io`. Preview, HTTP, obcy host i `file:` nie ładują helpera i nie wysyłają sesji.
- Frontend korzysta z `RejsonAccount.getSession()` przed każdym żądaniem. Token trafia wyłącznie do ciała HTTPS POST; nie do URL, DOM, logów, nowego localStorage ani raportów.
- Zmiana konta/wylogowanie czyści wynik, blokuje przyciski i unieważnia spóźnione odpowiedzi. Serwer sprawdza UUID przy każdym wywołaniu.
- Obsłużono limit rzeczywiście czytanego ciała żądania, nie tylko deklarowany Content-Length; timeouty i limit odpowiedzi backendu. Nie są zwracane surowe błędy ani wartości kluczy.
- CORS nie jest autoryzacją. Testy obejmują poprawny origin ze złym tokenem oraz inną tożsamość ze sfałszowaną nazwą właściciela.
- Nie zmieniono ról kont, uprawnień w grze, konta GitHub, danych światów, profili/CAS, sesji gry, działek, bramki multiplayer ani starych migracji. Nie uruchomiono SQL resetu/migracji.

## Weryfikacja

- 16 regresji Node/jsdom: brak sesji, zła sesja, cudzy UUID z nazwą właściciela, granice origin/rozmiaru, brak nadpisania, prywatność, błędy upstreamu, logout/race, brak tokenów w DOM/URL i zamknięcie UI na obcym originie — PASS.
- Pełne `npm test`: **25 825 sprawdzeń**, typecheck/build — PASS. `npm audit --omit=dev`: 0 podatności.
- Chromium desktop i emulowany mobile 390×844: status właściciela, test, ponowny odczyt, logout, brak poziomego przewijania; zero wyjątków. Obcy origin: zero pobrań helpera i zablokowany test. **Provider i backend w tym teście są syntetyczne, nie jest to test prawdziwej sesji właściciela ani Storage.** Raport: [benchmarks/reference-storage-ui.json](benchmarks/reference-storage-ui.json).
- CI rozszerzono o rzeczywiste, niemutujące negatywne kontrole wdrożonej funkcji: brak tokenu, fałszywy token/cross-project, zły origin i preflight. Nie zapisują plików i nie używają prawdziwych sesji.
- Właściciel wykonał test na żywym koncie i zgłosił sukces; raport ma 79 bajtów i SHA-256 zgodny z oczekiwanym. Niezależnie potwierdzono metadane obiektu i prywatny bucket. Sam ten raport nie dowodzi odczytu przez runner. Późniejszy osobny [etap 2](REFERENCE-PRIVATE-READ.md) przeszedł: runner odczytał ten sam plik 79 B z poprawną sumą.

Kontrola HTTP PR po poprawieniu wdrożenia: [CI 42316809139](https://github.com/rejson59/mconline/actions/runs/42316809139) — PASS, w tym brak sesji, nieprawidłowa sesja, zły origin i preflight nowej funkcji. To nadal nie zastępuje pozytywnego testu właściciela.
