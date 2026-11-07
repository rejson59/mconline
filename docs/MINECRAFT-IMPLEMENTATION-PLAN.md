# Plan wykonania: własna implementacja Minecraft Java w przeglądarce

2026-11-07. Cel referencyjny: **Java 26.3** z `java-reference.lock.json`. Runtime projektu pozostaje **4.30.0**, z dotychczasową bazą porównań **1.20.4**. Nie ogłaszamy migracji do 26.3 ani zgodności całej gry na podstawie indeksu plików.

To plan wykonywania kodu, nie obietnica terminu pełnej zgodności. Duży projekt dzielimy na zakończone, testowalne odcinki. „Własna implementacja” nie oznacza wyrzucenia już przetestowanego silnika, kont i zapisów. Bazą pozostają TypeScript, Three.js i istniejące workery. Ewentualny WebAssembly wymaga pomiaru konkretnego wąskiego gardła, nie zmiany języka dla samej nazwy.

## Zasady pracy

- **Stała preferencja właściciela:** duży cel realizujemy krok po kroku. Zamiast kończyć na wyliczaniu trudności, wykonujemy następną sprawdzalną porcję kodu i raportujemy wynik. Ograniczenia opisujemy konkretnie, bez rezygnowania z celu ani obiecywania niezweryfikowanej idealności.
- Każda porcja: kod → testy lokalne → PR → zielone CI → merge do `main` → kontrola CI/Pages na `main`.
- Własny kod w Git. Oryginały i pełny cache poza Git, Pages, publicznymi artefaktami i bundlem gry. Oryginały pozostają odrębne od MIT projektu.
- Nie zmieniamy wersji docelowej na snapshot automatycznie. Zmiana celu wymaga nowego przypięcia i audytu różnic.
- Bez resetu światów, kont, ról, działek i bibliotek zapisów. Bez ponawiania starych migracji. Nowa funkcja musi zachować autoryzację, CAS, dzienniki i ogrodzenia sesji.
- Żadnych haseł, plików kont launchera, sesji Microsoft, kluczy administracyjnych czy tokenów użytkownika w danych odniesienia.
- Telefon nie ma służyć jako pośrednik w pobieraniu całej instalacji, jeśli oficjalne pliki może pobrać autoryzowany runner. Jednorazowa autoryzacja właściwego transferu nie jest kolejnym testem pliku 79 B. Nie obchodzimy ograniczenia integracji na `workflow_dispatch`.
- Dla każdej funkcji osobny status: **zgodne / różne / brak / niesprawdzone**. Testy syntetyczne nie są porównaniem z uruchomionym oryginałem.

## Kolejność i warunki zakończenia

| Etap | Praca w kodzie | Kryterium zakończenia | Stan |
| --- | --- | --- | --- |
| 0. Dostęp | Właściciel → prywatny backend; OIDC runner → prywatny probe | Rzeczywisty odczyt 79 B, zgodny hash, odmowa publicznego odczytu | **Potwierdzony**; [pokwitowanie](benchmarks/reference-runner-read-proof.json) |
| 1. Inwentarz | Plan wszystkich pobrań deklarowanych przez oficjalny manifest i indeks zasobów; content-addressed obiekty; audyt zawartości | Deterministyczne plany, deduplikacja bez utraty aliasów, odrzucanie uszkodzeń i raportowanie braków | **Kod, regresje offline i rzeczywisty inwentarz PASS**: [5266 obiektów / 5147 assetów](REFERENCE-ARCHIVE-BACKEND.md#potwierdzony-rzeczywisty-inwentarz). Pełny oficjalny korpus jeszcze nie pobrany |
| 2. Transport | Osobna, wąska autoryzacja zapisu; części plików, wznowienie, limity bajtów, potwierdzenie kompletności | Zerwanie i kontynuacja transferu, pełny hash po złożeniu, brak nadpisania, obce konto/repo/ścieżka odrzucone | **Częściowo wykonane:** [protokół, wznowienie, źródło HTTPS i lokalny adapter](REFERENCE-TRANSFER-PROTOCOL.md), 31 regresji offline. [Backend OIDC i adapter chmurowy](REFERENCE-ARCHIVE-BACKEND.md) dodane i wdrożone z budżetem zapisu 0; 27 dalszych regresji. Rzeczywisty transfer i backup niepotwierdzone; endpointy probe bez zmian |
| 3. Domknięcie korpusu | Platformowe manifesty i pliki wymaganej Javy; inwentarz wnętrza klienta i bundla serwera; kopia niezależna | Wszystkie wymagane kategorie rozliczone; rzeczywisty odczyt i odtworzenie drugiej kopii | **Częściowo: [analizator wnętrza JAR-ów i bundla](REFERENCE-EMBEDDED-INVENTORY.md), 29 regresji offline.** Rzeczywista analiza, pliki Javy i backup niewykonane. Sam bucket nie jest backupem |
| 4. Stanowisko porównań | Legalnie dostępna referencja + te same kontrolowane scenariusze w projekcie; ślady stanu i obrazy | Powtarzalne porównanie przynajmniej pierwszego pionowego odcinka, z jawną wersją, wejściami i tolerancjami | **Niewykonane dla 26.3**. Nie pobieramy sesji kont i nie obchodzimy logowania |
| 5. Bloki, obraz, ruch | Mapa rejestrów/starych ID, stany i modele bloków, materiały/oświetlenie, ruch, kolizje i interakcje | Kontrolowane sceny i ślady zachowania; brak regresji zapisów; pomiar desktop/mobile | **Rozpoczęto w runtime 4.31:** [kontakty z częściowymi bryłami, podparcie i materiał płotu](MOVEMENT-4.31.md), 45 nowych grup regresji. Bez deklaracji pełnej zgodności 26.3 |
| 6. Przedmioty i survival | Ekwipunek, komponenty, crafting/przetwarzanie, narzędzia, zużycie, dropy, walka | Każda rodzina receptur i mechanik ma testy oryginał ↔ projekt; brakujący składnik jawnie raportowany | Istnieją implementacje częściowe; zgodność całego zakresu 26.3 **niesprawdzona** |
| 7. Świat i symulacja | Generator, biomy, struktury/jaskinie, płyny, ticki, moby/AI, redstone i byty blokowe | Osobne zestawy scenariuszy, seedy i testy długotrwałe; nie tylko podobny zrzut ekranu | Istnieją implementacje częściowe; pełne 1:1 **niepotwierdzone** |
| 8. Sieć i trwałość | Synchronizacja zachowań, autorytatywność, konflikty, sesje, migracje formatów | Dwie rzeczywiste sesje, utrata sieci, ponowienie, wznowienie i odtworzenie zapisów | Zachować obecną infrastrukturę; pełna zgodność protokołu Java **nie jest deklarowana** |

Etapy 5–8 nie oznaczają jednego wielkiego PR na etap. Dzielimy je na małe pionowe odcinki: implementacja + integracja + porównanie + regresje. Prace, dla których mamy zweryfikowaną referencję, nie muszą czekać na ukończenie wszystkich innych kategorii korpusu. Nie wolno jednak podpisać niezbadanego zachowania jako „zgodne z 26.3”.

## Pierwszy pionowy odcinek gry po przygotowaniu referencji

**Scena bloków i ruchu** — ograniczony, mierzalny zakres zamiast wymiany całego silnika:

1. Jawne odwzorowanie wybranych identyfikatorów referencji na `src/game/blocks.ts`; nie zmieniać znaczenia zapisanych ID.
2. Pełny blok, dolna/górna/podwójna płyta, schody i drzwi: wszystkie objęte stany, bryły kolizji, UV/model oraz interakcje. Brak modelu nie staje się po cichu zwykłym sześcianem.
3. `src/game/physics.ts`: chodzenie, skok, spadanie, dojście do krawędzi, przejścia między chunkami i dynamiczna zmiana bloku pod graczem. Oddzielić brak geometrii renderowanej od rzeczywistego braku kolizji.
4. `src/game/world.ts`, mesher i światło: ponowne ładowanie chunków i stanów nie może usuwać podłogi ani przywracać starej siatki po nowszej zmianie.
5. Testy porównawcze dla kontrolowanych scen oraz istniejące `.harness/smoke.ts`, `.harness/facing.ts`, `.harness/meshing.ts` i testy browserowe. Zestaw testów projektu nie jest sam w sobie dowodem zgodności z Javą.
6. Porównywać osobno: stan świata, pozycję/prędkość, interakcję oraz obraz. Tolerancje liczbowe i obrazowe trzeba ustalić przed oceną, nie dopasowywać do błędnego wyniku.

Pierwsza część tego odcinka jest już w runtime 4.31: [ruch i widoczność płotów](MOVEMENT-4.31.md). Pozostałe stany/modelowanie bloków i porównanie z uruchomioną Java 26.3 pozostają otwarte; naprawa fizyki nie oznacza rozliczenia wszystkich zgłoszeń podłogi.

## Poprzednia porcja: planner korpusu

- Dodano `scripts/reference-corpus.mjs`: plan pobrań z **oryginalnych, przypiętych SHA-1 surowych metadanych**, nie z domysłów ani listy jednego JAR-a.
- Ujęto klienta, serwer, wszystkie pozostałe deklarowane pobrania (w tym mapowania, jeżeli występują), cały indeks assetów, wszystkie zadeklarowane biblioteki i klasyfikatory natives, konfiguracje logowania oraz same manifesty.
- Zachowano reguły platformowe i selektory natives. Plan to celowo nadzbiór, nie ciche ograniczenie do systemu runnera. Nie jest jeszcze instalatorem ani resolverem platformy.
- Deduplikacja po hashu zachowuje każdą nazwę logiczną. Nazwy źródłowe nie są używane jako lokalne ścieżki.
- Strumieniowy audyt porównuje rzeczywiste bajty, rozmiary i oficjalne SHA-1; dla poprawnych obiektów wylicza dodatkowy SHA-256. Rozróżnia brak i uszkodzenie, nie naprawia przez nadpisanie.
- Dodano **23 regresje offline** do standardowego `npm test`. Nie pobierają ani nie publikują oryginałów.

**Nie wykonano teraz:** rzeczywistego transferu dużych plików, zapisu ich do prywatnego backendu, pobrania Javy, przeglądu wnętrza archiwów, niezależnego backupu, uruchomienia oryginału ani migracji mechanik. Narzędzie zapisuje te luki w każdym planie, nawet jeśli wszystkie zadeklarowane obiekty przejdą lokalny audyt.

## Poprzednia porcja: rdzeń transferu

Zaimplementowano `scripts/reference-transfer.mjs`: części 4 MiB, binarny rekord z checksumem i powiązaniem do planu/obiektu/próby/indeksu, wznowienie tylko brakujących części, kontrolę całego SHA-1/SHA-256 przed publikacją pokwitowania, źródło ścisłych zakresów HTTPS i lokalny adapter z atomowym zapisem bez nadpisania. **31 regresji offline** obejmuje przerwanie i utratę ACK, konkurencję, błędne dane, weryfikację w osobnym procesie i granice źródła HTTP. [Szczegóły i ograniczenia](REFERENCE-TRANSFER-PROTOCOL.md).

To nie jest wdrożony backend ani niezależny backup. Nie przesyłano oryginałów, nie uruchamiano nowych workflow i nie zmieniano funkcji probe. Pozostałe etapy zachowują dotychczasowy stan.

## Poprzednia porcja: backend OIDC i klient

Dodano [backend i adapter](REFERENCE-ARCHIVE-BACKEND.md), samodzielne wdrożenie ACTIVE v1 z zapisem zablokowanym w kodzie (`budgetBytes:0`), serwerowe zatwierdzanie oficjalnych metadanych i niezależne finalize oraz 27 nowych regresji. Planner i protokół są współdzielone przez czyste moduły bez filesystemu. Dodano ręczny, domyślnie wyłączony job rzeczywistego inwentarza; nie transferuje oryginałów ani nie zapisuje Storage. Właściciel wykonał job `42368321972`, check `128391030962`: PASS. Zwykłe CI nadal go pomija; [pokwitowanie](benchmarks/reference-archive-inventory-proof.json) zapisuje rzeczywistą adnotację.

Odczyt metadanych potwierdził prywatny bucket, limit pliku 10 MiB i tylko 1 obiekt / 79 B. Nie jest to dowód wolnej pojemności konta ani backupu. Dotychczasowe probe, konta, gra i zapisy bez zmian.

## Poprzednia porcja: analizator wnętrza archiwów

Dodano `scripts/reference-embedded.mjs`: pełne SHA-1/SHA-256 źródła, weryfikację ZIP i rzeczywistych bajtów wszystkich wpisów, kategorie zasobów/danych/klas, listy bibliotek i wersji bundla serwera oraz weryfikację i inwentarz zagnieżdżonych JAR-ów. Oficjalne wejście wyprowadza deskryptory z przypiętych surowych metadanych, nie z samego hashu planu. **29 regresji syntetycznych** wchodzi do standardowego `npm test`; [zakres, limity i granice dowodu](REFERENCE-EMBEDDED-INVENTORY.md).

Nie pobrano ani nie przeanalizowano jeszcze rzeczywistych oryginałów. Java runtime, backup i porównania pozostają otwarte. Nie zmieniono workflow, wdrożonego backendu, budżetu zapisu, kont, gry ani zapisów. Kontynuowanie tej pracy offline nie wymaga od właściciela zrzutów panelu ani obsługi komputera; nieznana pojemność pozostaje bramką dużego zapisu, nie bramką całego rozwoju.

## Poprzednia porcja: poprawki gry 4.31

Praca nie czeka na magazyn: naprawiono kontakty z rzeczywistymi powierzchniami drzwi/skrzyń/szyb, swept collision dla cienkich brył, uwzględnienie wystającej części płotu, pionowy kontakt i sprawdzanie całej drogi step-up. Płot używa nieprzezroczystego materiału desek, zamiast wycinanej ikonki. **45 nowych grup regresji**, pełna regresja, build oraz istniejący test produkcyjny Chromium na desktop/mobile: PASS. [Granice i macierz zgodności](MOVEMENT-4.31.md); to nie jest dowód pełnej zgodności ruchu lub obrazu z oryginalnym klientem.

## Poprzednia porcja: płoty 4.32

Usunięto pełną kratkę kolizji płotu: słupek i ramiona wynikają z jednej maski sąsiadów wspólnej z renderingiem. Dodano oddzielny kształt zaznaczania, dynamiczny obrys/pękanie i ochronę stawiania przed nowymi ramionami sąsiedniego płotu. **79 grup regresji oraz rzeczywisty test produkcyjnej gry w Chromium desktop/touch mobile: PASS.** [Zakres i granica dowodu](FENCES-4.32.md). Nie deklarujemy pełnej zgodności z 26.3 na podstawie historycznego źródła ani własnych regresji.

## Obecna porcja: włazy i drzwi 4.33

Otwarte włazy blokują rzeczywistym skrzydłem 3/16. Rendering, kolizje i celowanie korzystają ze wspólnej bryły; drzwi i włazy mają dokładny obrys/pękanie, a stawianie włazu sprawdza wynikowy kierunek i przecięcie ciał. **62 grupy regresji oraz produkcyjny Chromium desktop/touch mobile: PASS.** Bez zmiany ID i resetu. [Zakres i jawne ograniczenia starego formatu](PANELS-4.33.md): nadal jeden stan zamknięty, brak pełnej połowy/kierunku, bez dowodu kompletnej zgodności z 26.3.

## Dalsza porcja — od inwentarza do kontrolowanego transportu

1. **Wykonano rdzeń i regresje offline; backend i adapter także już dodane, pozostają bramki operacyjne.** Protokół transferu części obiektu z planu: hash obiektu, długość, indeks/rozmiar części i hash części; limit części poniżej istniejącego limitu Storage 10 MiB.
2. **Wykonano backend z osobnym audience i blokadą zapisu.** **Rzeczywista tożsamość i pobranie metadanych potwierdzone** jobem inwentarza; 706 205 684 B plików, górny szacunek archiwum 717 451 342 B, bez Javy i pozostałych luk. Wolny limit konta nie jest znany z udostępnionych metadanych. Plan zatwierdza dozwolone obiekty; nie wolno przyjmować dowolnego URL/ścieżki. Żadnego publicznego uploadu ani service-role w Actions/przeglądarce.
3. **Źródło HTTPS i lokalne wznowienie wykonane, źródła rzeczywiste jeszcze niesprawdzone.** Integracja klienta z backendem jest w kodzie i regresjach; rzeczywisty transfer nie został jeszcze uruchomiony. Obiekt istniejący musi zostać zweryfikowany, a nie pobrany ponownie w ciemno. Części nie oznaczają kompletnego pliku.
4. **Regresje protokołu i podpisanej autoryzacji wykonane.** Poprawny token i rzeczywisty inwentarz są już potwierdzone. Pozostają transfer danych do Storage, limity operacyjne i test odtworzenia przed transferem oryginałów.
5. Przed rzeczywistym dużym transferem potwierdzić dostępne miejsce, limity usług i sposób niezależnej kopii. Nie obiecywać nieskończonego ani wieczystego magazynu. Brak drugiej kopii nie może być raportowany jako backup PASS.
