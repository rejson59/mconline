# Prywatny magazyn oryginałów — etap 0: test drogi transferu

Opis pierwotnego etapu 0: 2026-11-07. **Aktualizacja:** właściciel uruchomił [zadanie 42314690988](https://github.com/rejson59/mconline/actions/runs/42314690988), test sieci runnera przeszedł. Szczegóły i następny etap: [PRIVATE-STORAGE-PROBE.md](PRIVATE-STORAGE-PROBE.md). Poniższe punkty o nieustalonym wyniku opisują stan sprzed tego uruchomienia.

Cel: oryginalne pliki **Java 26.3** jako odniesienie dla pełnej migracji, nie tylko wybranych receptur. Ten dokument nie oznacza ukończenia portu ani dostępnego panelu uploadu.

## Stan faktyczny

- Bezpośrednie połączenie z hostem Mojanga oraz projektem Storage z bieżącego środowiska roboczego kończy się błędem SSL. Potwierdzono także przez `scripts/probe-reference-network.mjs`: `ok:false`, brak udanego odczytu oficjalnych źródeł i Storage.
- Łącznik administracyjny umożliwił odczyt metadanych: projekt gry `BlockCraft` jest aktywny; zapytanie do `storage.buckets` zwróciło zero wierszy. Odczyt tabeli nie jest dowodem działania uploadu ani pobierania obiektów.
- **Nie utworzono bucketu, nie zmieniono RLS, funkcji produkcyjnych, kont, światów lub zapisów.** Nie uruchomiono żadnej migracji.
- Próba `gh workflow run ci.yml --ref arena/883bb210-mconline -f reference_network_probe=true` została odrzucona jako `403 Resource not accessible by integration`. Nie podejmowano obejścia ograniczenia. Brak także uprawnienia integracji do listowania sekretów Actions; nie pobrano ich wartości i do tego testu nie są potrzebne.
- Dodano ręcznie włączany, bezsekretowy test z innego środowiska: GitHub-hosted runner. Jego wynik z sieci runnera **pozostaje nieustalony do czasu ręcznego uruchomienia przez właściciela**.

## Krok 1 dla właściciela — również na telefonie

Dopiero gdy zmiany są scalone do `main`:

1. W przeglądarce otwórz [Actions → CI](https://github.com/rejson59/mconline/actions/workflows/ci.yml), będąc zalogowanym do GitHub na koncie z prawem uruchamiania zadań.
2. Wybierz **Run workflow**, gałąź **main**.
3. Zaznacz **Test połączenia z oryginalnymi plikami (bez uploadu)** i zatwierdź **Run workflow**.
4. Przekaż w rozmowie link do uruchomienia albo napisz, że test został uruchomiony. Agent odczyta status i adnotacje testu przez API. Nie przesyłaj tokenu ani hasła.

Jeśli kontrolka jest niewidoczna, można użyć widoku komputerowego w przeglądarce. Brak dostępu lub komunikat błędu należy zgłosić zamiast zmieniać ustawienia bezpieczeństwa lub dodawać sekrety na ślepo. Ponowne połączenie GitHub w Arena z właściwymi uprawnieniami jest inną możliwością rozwiązania ograniczenia integracji, lecz nie jest wymagane do ręcznego kliknięcia w GitHub.

## Co dokładnie sprawdza test

- Pobiera **przypięty oficjalny manifest 26.3**, weryfikuje SHA-1, identyfikator wydania oraz metadane klienta; nie przyjmuje snapshotu lub dowolnego adresu zastępczego.
- Pobiera indeks zasobów, sprawdza SHA-1 i rozmiar, liczy wskazane obiekty. **Nie pobiera tych obiektów.**
- Żąda wyłącznie pierwszych 16 bajtów klienta, sprawdza sygnaturę ZIP/JAR. Gdy serwer ignoruje `Range`, anuluje pozostały strumień. **Nie sprawdza sumy kontrolnej całego klienta i nie instaluje gry.**
- Wykonuje anonimowe `HEAD` na adres Storage. Odpowiedź 401 oznacza działające połączenie HTTP, **nie dostęp do prywatnych plików**. Upload i autoryzowany odczyt mają osobne statusy `false`.
- Używa tylko stałej listy hostów HTTPS, nie śledzi przekierowań, ogranicza wielkość odpowiedzi i czas. Nie wysyła tokenów ani kluczy. Wynik jest w podsumowaniu i adnotacji zadania, bez artefaktu zawierającego grę.
- Ręczny test jest domyślnie wyłączony. Zwykły PR/push/Pages nie wykonuje dodatkowych pobrań oryginału; syntetyczne testy narzędzia działają offline w `npm test`.

**Sukces tego testu nie jest jeszcze sukcesem prywatnego magazynu.** Najpierw trzeba osobno potwierdzić autoryzowany zapis, powtórny odczyt identycznych bajtów i dostęp narzędzi analitycznych. Nie prosimy użytkownika o duży upload przed tym potwierdzeniem.

## Projekt dalszego magazynu — jeszcze niewdrożony

- Prywatny, wydzielony bucket; brak publicznego listowania, publicznego odczytu i anonimowego uploadu.
- Panel `/mconline/testy/` ograniczony do wskazanego właściciela, z autoryzacją backendu. CORS ani ukryty adres nie zastępują logowania. Klucze administracyjne nigdy nie trafiają do HTML, localStorage ani chatu.
- Transfer z możliwością wznowienia, jawne limity przestrzeni/rozmiaru i kontrola kompletności. Nie nazywamy tego „bez limitów”.
- Oryginały nie są nadpisywane: ścieżki wersja/hash, manifest pochodzenia, rozmiaru i sum kontrolnych. Części transferu nie stają się „kompletnym plikiem”, dopóki nie zweryfikowano całości.
- Bez automatycznego kasowania oryginałów i bez rotacji usuwającej poprzednią wersję. Usuwanie wymaga osobnej świadomej decyzji. Wygaśnięcie linku dostępu nie oznacza usunięcia pliku.
- Osobna kopia zapasowa jest nadal potrzebna; sam bucket nie daje gwarancji wiecznego przechowywania, ochrony przed usunięciem projektu lub utratą konta.
- Oryginalne pliki nie trafiają do Gita, Pages ani publicznych artefaktów. Repo zawiera własny kod, locki, raporty i testy. Obecność plików nie zmienia praw do nich ani nie oznacza ukończonej zgodności 1:1.

## Dalsze prowadzenie krok po kroku

1. **Teraz:** właściciel uruchamia opisany test, agent odczytuje wynik.
2. **Po udanym teście:** wybór i sprawdzenie autoryzowanej drogi magazyn ↔ środowisko analizy. Osobny test małego pliku bez ruszania zapisów gry.
3. **Po potwierdzeniu odczytu/zapisu:** identyfikacja uprawnionego konta i wdrożenie panelu; dopiero wtedy instrukcja przesłania potrzebnych plików z telefonu. Jeżeli runner może bezpiecznie pobrać oryginały bezpośrednio, telefon nie musi pośredniczyć w pobieraniu tych plików.
4. **Dopiero potem:** pełny manifest klienta, serwera, bibliotek i zewnętrznych zasobów oraz macierz zgodności z testami zachowań. Braki nie są oznaczane jako zgodne. Nie wystarczy jeden JAR ani sama zmiana etykiety wersji.

## Testy kodu etapu 0

12 syntetycznych regresji: allowlista HTTPS, limity/odwołanie strumienia, integralność manifestu i indeksu, nieprawidłowa wersja i sygnatura, błędy transportu, brak wycieku surowych błędów, rozróżnienie łączności od autoryzacji i ręczne włączenie workflow. Wszystkie PASS. Pełne `typecheck`, `npm test` (25 809 sprawdzeń), build — PASS; audit produkcyjny 0 podatności.
