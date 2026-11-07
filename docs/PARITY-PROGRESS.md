# Jeden pasek postępu — audyt bazowy 2026-11-07

Cel: jeden zbiorczy pasek drogi do własnej implementacji **Java 26.3**, a nie średnia z 20 równych działów, licznik aktualizacji, linii kodu czy zielonych testów. Audyt nie zmienia działającej gry **4.37.0**.

## Co rzeczywiście policzono

`npm run progress:audit` buduje i odczytuje prawdziwe rejestry TypeScript, nie liczy wpisów przez regex. Typy mobów/biomów odczytuje z AST TypeScript. Referencja jest weryfikowana po długości/SHA-256 z istniejącego locka; ucięte drzewo zostaje odrzucone. Nie pobiera ani nie zapisuje niczego w backendzie.

| Pomiar runtime | Wynik | Co to oznacza |
| --- | ---: | --- |
| Zarejestrowane stany bloków | 304 | Nie 304 unikalne i kompletne bloki Java |
| Wpisy bloków dostępne w creative | 149 | Wpisy naszego menu, nie mapa pełnego rejestru Java |
| Zarejestrowane przedmioty | 124 | Obecność definicji, nie dowód kompletnego zachowania |
| Receptury craftingu | 221 | Rzeczywista lista po generatorach i poprawkach, nie same literały źródłowe |
| Typy mobów | 14 | Literalne typy silnika, nie pełne AI wszystkich encji |
| Etykiety biomów | 12 | Etykiety naszego generatora, nie zgodność seedów/biomów Java |

Przypięty inwentarz referencji: **1290 definicji blockstates**, **1660 definicji przedmiotów**, **2042 receptury**. Te liczby mają różne jednostki i **nie są wspólnym mianownikiem ukończenia gry**. W szczególności nie dzielimy 304 stanów projektu przez 1290 plików blockstates.

## Nowe porównanie craftingu z runtime

Dotychczasowy audyt 26.3 porównywał próbkę starych fixture JSON. Nowy porównuje znormalizowane dane z **rzeczywistej listy `RECIPES`** z przypiętym korpusem 26.3:

- **23 receptury: zgodny kształt/składniki i wynik danych** w części z jawną mapą nazw;
- **1179**: brak dopasowania w tym ograniczonym mapowaniu — **nie oznacza automatycznie braku receptury w grze**;
- **840**: typ poza porównywanymi shaped/shapeless — nie oceniamy tu warzenia, przetapiania itd.;
- **0** błędów interpretacji referencyjnych receptur shaped/shapeless przy obecnych tagach;
- z 221 rekordów runtime **26** ma pełne jawne mapowanie do tego porównania; **195** nie ma go jeszcze w całości.

Nie zgadujemy nazw przedmiotów po polskich etykietach. Ogólny alias `planks` nie staje się fikcyjnym przedmiotem `minecraft:planks`. Tagi referencji rozwijane są w całości, bez zawężania alternatyw do tych wygodnych dla projektu. Duplikaty receptur nie mnożą zaliczeń. Niezgodna deklaracja zużycia względem wzoru i nieporównane metadane są odrzucane. Porównanie zachowuje odbicie poziome, rozróżnia shapeless/shaped i wielokrotność składników.

**To nadal porównanie danych**, nie test wykonania receptur, dostępności siatki 2×2/3×3, zużycia kursora, pozostałości ani uruchomionego oryginalnego klienta. Nie nadaje procentu ukończenia craftingu ani całej gry.

## Rejestr prac i reguła wspólnego paska

`docs/parity-scope.json` jest pierwszym otwartym rejestrem: **69 wpisów** z kryteriami i ścieżkami dowodów. Obecnie 61 to obszary częściowe, 6 jest niesprawdzonych, a 2 to wąskie porównania geometrii/UV włazu z danymi 26.3. Te dwa wpisy nie oznaczają dwóch w pełni ukończonych systemów gry. Sam plik źródłowy przy częściowym wpisie wskazuje obszar pracy, nie potwierdza zgodności.

**69 nie jest nową liczbą etapów do końca.** Rejestr nie jest kompletny; duże obszary trzeba rozbić na zachowania i rozliczyć zależności. Nie wolno obliczać `2/69`, przypisywać każdemu wpisowi tej samej wagi ani podwójnie naliczać wąskiego porównania i nadrzędnego systemu.

Dlatego aktualny raport ma:

- `overall.percent: null` — **nie 0%**;
- `overall.remainingPercent: null` — nie wymyślone 100%;
- jawne blokady: niezamknięty zakres wymagań i nieskalibrowane wagi pracy;
- `weight: null` przy nieskalibrowanych wagach — nie udajemy zerowego nakładu.

Kalkulator jest gotowy do późniejszego liczenia **jednego wyniku ważonego**, gdy zakres i wagi będą rozliczone. Wtedy zalicza wyłącznie zweryfikowaną pracę względem właściwego celu, bez automatycznego „pół punktu” za stan częściowy. Prezentuje setne procenta przez konserwatywne obcięcie, nie zaokrągla nieukończonego wyniku do 100%. Sama arytmetyka nie czyni wag obiektywnym pomiarem nakładu — ich późniejsza kalibracja wymaga jawnego uzasadnienia. Zmiany zakresu/wag trzeba raportować jako zmianę podstawy, nie zysk lub utratę implementacji.

Dopóki zakres pozostaje otwarty, wspólny pasek brzmi:

```text
🌍 Minecraft 1:1 — cały projekt
[????????????????????] — procent całości w trakcie ustalania
```

Nie pokazujemy drugiego procentu dla samego audytu w miejsce procentu gry.

## Powtarzalność, CI i aktualizowanie wyniku

- **`npm run progress:audit`** — pełna regeneracja `docs/benchmarks/parity-progress.json`; wymaga już pobranego, ignorowanego cache referencji. Brak cache: jawny błąd, bez zgadywania.
- **`node scripts/parity-progress.mjs --check`** — porównanie pełnej regeneracji z zapisanym raportem, bez nadpisania go.
- **`npm run progress:check`** — szybki test driftu offline, również w standardowym `npm test`: hash każdego źródła `.ts/.tsx`, dowodów, locka, skryptów audytu i lista źródeł. Zmiana treści lub nowy niezinwentaryzowany moduł unieważnia raport.
- **`npm run test:progress`** — 32 regresje kalkulatora, walidacji, mapowania, normalizacji i wykrywania starego raportu. Bez sieci, JAR-a, kont i cache oryginałów.
- Po zmianie kodu należy ponownie wykonać audyt, nie ręcznie dopisać korzystniejszy procent do JSON.

Hash pełnego drzewa źródeł i hashy dowodów jest pokwitowaniem spójności, nie dowodem zgodności całej gry. Repozytorium przechowuje jedynie własny raport/liczniki/nazwy dopasowań, nie pełny oryginalny korpus. Cache nie wchodzi do gry ani artefaktów Pages. Bez zmian wersji runtime, backendu, zapisów, kont, ID, migracji i resetów.

## Co nadal jest otwarte

To **pierwszy audyt bazowy**, nie ukończony audyt wszystkich zachowań. Do domknięcia podstawy procentowej potrzebne są dalsze mapowania rejestrów, szczegółowe kryteria i dowody dla pozostałych systemów oraz kalibracja wag bez nakładania się zakresów. Rzeczywiste porównanie z uruchomionym klientem i pełny korpus/backup pozostają otwarte.

W pracy nad grą najbliższym odcinkiem pozostają referencyjne pozy przedmiotów w rękach i na ziemi, wyłącznie na poziomym ekranie. Samo dodanie licznika nie zwiększa zgodności zachowania Minecrafta.
