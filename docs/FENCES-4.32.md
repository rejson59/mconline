# 4.32 — płoty bez niewidzialnej kratki

Kolejny odcinek **działającej gry**, po [ruchu 4.31](MOVEMENT-4.31.md). Nie zmieniono ID bloków, formatów zapisów, kont, ochrony działek ani backendu. Nie resetowano światów i nie uruchamiano migracji.

## Zmiany widoczne w grze

- Odizolowany płot blokuje tylko słupek **4/16 × 4/16**, nie całą kratkę. Połączenia dodają odpowiednie ramiona. Da się przejść obok słupka, ale nie przez niego.
- **Jeden układ N/E/S/W** steruje szczeblami i fizyczną bryłą. Płot łączy się z płotem i pełnymi powierzchniami podparcia. Liście, dynia, pojedyncza płyta, skrzynia, kowadło, drzwi czy szyba nie powodują już fałszywych szczebli. Dla schodów sprawdzana jest rzeczywista pełna strona, także przy górnej połowie i narożnikach, a nie sama nieprzezroczystość.
- Kolizja pozostaje wysoka na **1,5 bloku**. Kształt zaznaczania i pękania ma **1 blok wysokości**: nie celujemy w niewidzialne powietrze nad płotem. Celownik przepuszcza promień przez wolne narożniki.
- Obrys i nakładka pękania śledzą układ słupka oraz ramion. Sampler półbloków nie nadawał się do słupka 4/16 — dodano dokładny podział na granice brył, bez ukrytych wewnętrznych ścian. Dotychczasowa szybka ścieżka płyt/schodów pozostaje bez zmian.
- Stawianie płotu sprawdza rzeczywistą bryłę. Sprawdza też **nowe ramię istniejącego sąsiedniego płotu**, wywołane dostawieniem płotu lub pełnego bloku. Zablokowane są kolizje z graczem i żywymi mobami, bez zużycia przedmiotu. Ochrona działek nadal obowiązuje.
- Sąsiedzi są odczytywani bez generowania chunków. Niewczytany chunk nie staje się fałszywym ramieniem. Kształty są wyliczane z istniejących bloków: nie dodano 16 wariantów ID do zapisów.

## Weryfikacja

**79 nowych grup testów** w standardowym `npm test`; osobno `npm run test:fences`:

- wszystkie 16 układów połączeń: niezależne oczekiwane bryły, rozdzielone wysokości, dokładna powierzchnia zewnętrzna i kierunek ścian;
- zgodność liczby renderowanych szczebli z maską, identyczne siatki synchroniczne i workera;
- wyjątki połączeń i pełne strony schodów we wszystkich kierunkach i obu połowach;
- dodatnie i ujemne granice chunków, usunięcie sąsiada, aktualizacja dirty/revision, odrzucenie starej odpowiedzi workera i zapis/wczytanie;
- ruch, górna kolizja, celownik, promień walki, dokładny obrys i ponowne użycie geometrii;
- preflight oraz rzeczywista ścieżka użycia/stawiania, nowe ramię w sąsiedniej kratce, żywy/martwy mob, brak zużycia po odmowie i ochrona działek.

Pozostałe **45 grup ruchu 4.31** oraz pełne typecheck/test/build: PASS. Stare oczekiwania „płot zajmuje pełną szerokość kratki” zastąpiono dokładną szerokością i kontaktem ze słupkiem; nie usunięto kontroli blokowania. `npm audit --audit-level=low`: 0 podatności.

**Chromium na buildzie produkcyjnym**, świeże konteksty gościa, desktop 960×600 i touch mobile 390×844: PASS. Test rzeczywiście wchodzi do świata i uruchamia `updatePlayer` produkcyjnej gry: przejście obok słupka, zatrzymanie dokładnie na x=5,075, trafienie celownikiem w słupek i dynamiczna zmiana obrysu po dostawieniu sąsiada. Bez błędów konsoli. Nie używa kont właściciela ani publicznego multiplayera.

Kod: `scripts/verify-fences-browser.mjs`, `npm run test:browser:fences`. Opcjonalne zależności przeglądarkowe instaluje deweloper w ignorowanym `.cache/browser-tools`; właściciel z telefonem nie musi niczego instalować. Raporty i obrazy testowe pozostają w ignorowanym `.cache/verification432`, a minimalny wynik jest w [pokwitowaniu](benchmarks/fences-4.32.json).

## Granica dowodu

Wymiary i regułę pełnej strony/wyjątków sprawdzono pomocniczo w przypiętym **historycznym** mirrorze źródła `mahtomedi/minecraft`, commit `6ac5fe18be48a7395be84148be051908111d6772`, opisany jako **1.20.3-pre1**. To nie oryginalny uruchomiony klient i **nie dowód zgodności 26.3**. Surowe pliki są tylko w ignorowanym cache, nie w Git ani bundlu; pokwitowanie zapisuje pochodzenie i hashe. Wcześniejszy przegląd małych modeli mirrora 26.3 potwierdzał wymiary widocznego słupka, nie zachowanie całej gry.

Cel Java 26.3 pozostaje bez zmian. Otwarte: porównanie z uruchomioną referencją, piksele materiału i UV szczebli, bramki, pozostałe rodziny płotów i waterlogging. Nie deklarujemy pełnego portu, identycznych końcowych obrazów ani kompletnego autorytatywnego serwera fizyki. Ta porcja poprawia konkretną bryłę, interakcję i spójność renderingu, zamiast zatrzymywać rozwój na magazynie materiałów odniesienia.
