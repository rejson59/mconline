# Oficjalny korpus: plan i lokalny audyt integralności

Etap 1 planu [MINECRAFT-IMPLEMENTATION-PLAN.md](MINECRAFT-IMPLEMENTATION-PLAN.md), 2026-11-07. Kod: `scripts/reference-corpus.mjs`. **Narzędzie działa offline: nie pobiera, nie wysyła, nie wykonuje ani nie usuwa plików.** To przygotowany element przyszłego transportu, nie gotowy transport dużych oryginałów.

## Wejście i zakres

Planner wymaga surowych bajtów oficjalnego manifestu **26.3** przypiętego w `scripts/probe-reference-network.mjs` oraz wskazanego przez niego indeksu assetów. Sprawdza hash manifestu przed parsowaniem, a indeksu także rozmiar. CLI nie przyjmuje innego wydania, snapshotu, dowolnego serwera metadanych ani wyłącznika weryfikacji. Nie ma komendy pobierania ani dostępu do kont użytkownika.

Do planu trafiają:

- manifest wersji i indeks assetów jako obiekty do zachowania;
- wszystkie wpisy `downloads` — wymagany klient i serwer oraz mapowania, jeżeli manifest je deklaruje;
- **każdy** obiekt z indeksu assetów, z zachowaniem aliasów nazw;
- wszystkie artefakty oraz klasyfikatory każdej biblioteki, także zadeklarowane warianty natives i wpisy wyłączone regułami dla systemu runnera;
- zadeklarowane konfiguracje logowania. To konfiguracje programu, nie prywatne logi lub konta użytkownika;
- wymagana wersja i komponent Javy, reguły bibliotek, selektory natives i informacje `extract` — jako wymagania, jeszcze nie instrukcje wykonywane przez instalator.

Nieznany typ pobrania biblioteki lub nieprawidłowy descriptor kończą planowanie błędem, zamiast pominięcia pliku. Źródła mają rozdzielone allowlisty hostów i ścieżek: oficjalne metadane, pliki klienta/serwera, biblioteki, obiekty assetów. Dane nie mogą podać URL z poświadczeniami, innym protokołem, query, portem, obcym hostem ani traversalem. Planowanie ma jawny budżet 8 GiB unikalnych zadeklarowanych plików, 1 GiB na obiekt, 512 KiB manifestu i 2 MiB indeksu. **To limity narzędzia, nie informacja o opłaconym miejscu w Storage.**

## Czego ten plan jeszcze nie zawiera

Manifest wersji nie wylicza wszystkiego wewnątrz JAR-ów ani samych plików dystrybucji Javy. Dlatego każdy wynik pozostawia `fullCorpusReady:false` i jawne `pending`:

- platformowe manifesty i pliki wymaganej Javy;
- inwentarz zasobów wewnątrz klienta;
- inwentarz bundla serwera, w tym bibliotek/wersji wewnątrz niego;
- rzeczywisty transfer do prywatnego trwałego magazynu;
- niezależną kopię i sprawdzone odtworzenie;
- wykonanie i porównanie zachowań.

Biblioteki stanowią nadzbiór wszystkich zadeklarowanych wariantów. Zachowanie reguł nie oznacza, że przetestowano ich resolver, uruchamianie na każdej platformie czy kompletność każdej platformy. Nie pobieramy alternatywnych, nieprzypiętych runtime'ów pod pretekstem zgodności numeru major.

## Format obiektów i integralność

Każdy unikalny plik otrzymuje klucz:

```text
objects/sha1/<pierwsze-dwa-znaki>/<pełny-sha1>
```

Deduplikacja nie usuwa referencji logicznych. Dwie nazwy assetu wskazujące ten sam hash pozostają dwiema referencjami do jednego obiektu. Sprzeczne rozmiary dla tego samego hashu są błędem. Nazwy z manifestów nie służą do konstruowania lokalnych ścieżek ani wypakowywania archiwów.

`planSHA256` to deterministyczny hash własnego dokumentu planu, bez tej jednej właściwości. Sortowanie nie zależy od locale. To wykrywanie zmiany planu, **nie podpis ani zamiennik weryfikacji oficjalnych metadanych**. Inna serializacja surowego manifestu zmienia jego hash i pochodzenie; nie jest po cichu traktowana jako identyczny dokument.

Lokalny `audit` niczego nie pobiera i nie tworzy brakujących plików. Otwiera wyłącznie klucze wynikające z prawidłowych hashy, odrzuca symlinki i nieregularne pliki, nie blokuje się na FIFO, sprawdza faktyczny rozmiar i strumieniowo liczy hash w buforze 64 KiB. Nie ufa polu „verified” z cache. Zmiana pliku podczas odczytu powoduje błąd integralności. Statusy:

- `verified` — rozmiar i SHA-1 faktycznie odczytanych bajtów zgodne; dodatkowo zapisany SHA-256;
- `missing` — brak pliku lub katalogu;
- `different-or-unreadable` — uszkodzenie, zły typ/rozmiar, symlink, brak uprawnień lub inny błąd odczytu.

Raport nie zawiera bajtów plików ani tokenów. Nawet `declaredObjectsVerified:true` nie oznacza pełnego korpusu, backupu ani zgodności gry.

## Obsługa deweloperska — nie instrukcja wymagająca PC od właściciela

Docelowo te operacje wykona narzędzie transferu w autoryzowanym środowisku. Poniższe komendy służą rozwojowi kodu. Właściciel korzystający z telefonu **nie ma teraz pobierać ani dostarczać tych plików**.

```sh
npm run reference:corpus -- --help
npm run reference:corpus -- plan \
  --manifest .cache/reference-private/26.3.json \
  --asset-index .cache/reference-private/assets.json
# Domyślny wynik: .cache/reference-corpus/26.3-plan.json

npm run reference:corpus -- audit \
  --plan .cache/reference-corpus/26.3-plan.json \
  --root .cache/reference-private

npm run test:reference:corpus
```

`plan` może zapisać swój wynik wyłącznie w ignorowanym `.cache/`, z trybem 0600 i bez podążania za symlinkami katalogów. Powtórzenie identycznego planu jest dozwolone; inny plan pod tą samą ścieżką jest konfliktem, nie nadpisaniem. Raw manifesty, pliki obiektów i kompletny wynik z nazwami pozostają poza Git. Samo CLI `audit` tylko odczytuje katalog, nie organizuje plików ani nie udaje trwałego prywatnego backendu.

Kody wyjścia: `0` — plan powstał albo wszystkie **zadeklarowane** obiekty przeszły audyt; `2` — audyt wykazał braki/różnice; `1` — błędne wejście lub konflikt. Każdy raport audytu nadal ma `fullCorpusReady:false`, `independentBackupVerified:false`, `gameParityVerified:false`.

## Dowód i ograniczenia tej porcji

**23 testy syntetyczne offline** obejmują kategorie, aliasy, warianty bibliotek/natives, reguły, stabilność planu, brak/korupcję, duży strumień, pusty plik, fałszywe źródła i ścieżki, zmieniony plan, limity, symlinki oraz kody CLI. Są częścią `npm test`, bez cache i bez sieci.

W tej porcji nie pobrano oficjalnego klienta, serwera, pełnych assetów ani bibliotek. Planner nie został jeszcze uruchomiony na pełnych rzeczywistych metadanych 26.3 w runnerze. Syntetyczny sukces nie jest takim uruchomieniem. Nie rozszerzono funkcji probe ani workflow o zapis, nie zmieniono polityk Storage, ról, gry, formatów zapisów lub runtime'u.
