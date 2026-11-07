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
| 1. Inwentarz | Plan wszystkich pobrań deklarowanych przez oficjalny manifest i indeks zasobów; content-addressed obiekty; audyt zawartości | Deterministyczne plany, deduplikacja bez utraty aliasów, odrzucanie uszkodzeń i raportowanie braków | **Kod i regresje offline wykonane w tej porcji**; [narzędzie](REFERENCE-CORPUS.md). Pełny oficjalny korpus jeszcze nie pobrany |
| 2. Transport | Osobna, wąska autoryzacja zapisu; części plików, wznowienie, limity bajtów, potwierdzenie kompletności | Zerwanie i kontynuacja transferu, pełny hash po złożeniu, brak nadpisania, obce konto/repo/ścieżka odrzucone | **Częściowo wykonane:** [protokół, wznowienie, źródło HTTPS i lokalny adapter](REFERENCE-TRANSFER-PROTOCOL.md), 31 regresji offline. Backend OIDC i transfer do chmury nadal niewdrożone; endpointy probe bez zmian |
| 3. Domknięcie korpusu | Platformowe manifesty i pliki wymaganej Javy; inwentarz wnętrza klienta i bundla serwera; kopia niezależna | Wszystkie wymagane kategorie rozliczone; rzeczywisty odczyt i odtworzenie drugiej kopii | **Niewykonane**. Sam bucket nie jest backupem |
| 4. Stanowisko porównań | Legalnie dostępna referencja + te same kontrolowane scenariusze w projekcie; ślady stanu i obrazy | Powtarzalne porównanie przynajmniej pierwszego pionowego odcinka, z jawną wersją, wejściami i tolerancjami | **Niewykonane dla 26.3**. Nie pobieramy sesji kont i nie obchodzimy logowania |
| 5. Bloki, obraz, ruch | Mapa rejestrów/starych ID, stany i modele bloków, materiały/oświetlenie, ruch, kolizje i interakcje | Kontrolowane sceny i ślady zachowania; brak regresji zapisów; pomiar desktop/mobile | **Pierwszy odcinek właściwej migracji**, nie ukończona funkcja 26.3 |
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

Ten odcinek nie jest oznaczony jako wykonany w niniejszej porcji. Dzisiejsze zmiany nie zmieniają renderingu ani fizyki i nie naprawiają automatycznie zgłoszeń gry.

## Poprzednia porcja: planner korpusu

- Dodano `scripts/reference-corpus.mjs`: plan pobrań z **oryginalnych, przypiętych SHA-1 surowych metadanych**, nie z domysłów ani listy jednego JAR-a.
- Ujęto klienta, serwer, wszystkie pozostałe deklarowane pobrania (w tym mapowania, jeżeli występują), cały indeks assetów, wszystkie zadeklarowane biblioteki i klasyfikatory natives, konfiguracje logowania oraz same manifesty.
- Zachowano reguły platformowe i selektory natives. Plan to celowo nadzbiór, nie ciche ograniczenie do systemu runnera. Nie jest jeszcze instalatorem ani resolverem platformy.
- Deduplikacja po hashu zachowuje każdą nazwę logiczną. Nazwy źródłowe nie są używane jako lokalne ścieżki.
- Strumieniowy audyt porównuje rzeczywiste bajty, rozmiary i oficjalne SHA-1; dla poprawnych obiektów wylicza dodatkowy SHA-256. Rozróżnia brak i uszkodzenie, nie naprawia przez nadpisanie.
- Dodano **23 regresje offline** do standardowego `npm test`. Nie pobierają ani nie publikują oryginałów.

**Nie wykonano teraz:** rzeczywistego transferu dużych plików, zapisu ich do prywatnego backendu, pobrania Javy, przeglądu wnętrza archiwów, niezależnego backupu, uruchomienia oryginału ani migracji mechanik. Narzędzie zapisuje te luki w każdym planie, nawet jeśli wszystkie zadeklarowane obiekty przejdą lokalny audyt.

## Obecna porcja: rdzeń transferu

Zaimplementowano `scripts/reference-transfer.mjs`: części 4 MiB, binarny rekord z checksumem i powiązaniem do planu/obiektu/próby/indeksu, wznowienie tylko brakujących części, kontrolę całego SHA-1/SHA-256 przed publikacją pokwitowania, źródło ścisłych zakresów HTTPS i lokalny adapter z atomowym zapisem bez nadpisania. **31 regresji offline** obejmuje przerwanie i utratę ACK, konkurencję, błędne dane, weryfikację w osobnym procesie i granice źródła HTTP. [Szczegóły i ograniczenia](REFERENCE-TRANSFER-PROTOCOL.md).

To nie jest wdrożony backend ani niezależny backup. Nie przesyłano oryginałów, nie uruchamiano nowych workflow i nie zmieniano funkcji probe. Pozostałe etapy zachowują dotychczasowy stan.

## Dalsza porcja kodu — bez kolejnego probe

1. **Wykonano rdzeń i regresje offline; pozostała integracja backendu.** Protokół transferu części obiektu z planu: hash obiektu, długość, indeks/rozmiar części i hash części; limit części poniżej istniejącego limitu Storage 10 MiB.
2. Dodać osobny backend z tą samą ścisłą tożsamością OIDC, lecz oddzielnymi uprawnieniami i ograniczoną przestrzenią nazw. Plan zatwierdza dozwolone obiekty; nie wolno przyjmować dowolnego URL/ścieżki. Żadnego publicznego uploadu ani service-role w Actions/przeglądarce.
3. **Źródło HTTPS i lokalne wznowienie wykonane, źródła rzeczywiste jeszcze niesprawdzone.** Zintegrować klienta z backendem chmurowym. Obiekt istniejący musi zostać zweryfikowany, a nie pobrany ponownie w ciemno. Części nie oznaczają kompletnego pliku.
4. **Regresje protokołu wykonane; brak jeszcze regresji nowej autoryzacji backendu.** Po integracji sprawdzić także obcą tożsamość i rzeczywiste odpowiedzi Storage przed transferem oryginałów.
5. Przed rzeczywistym dużym transferem potwierdzić dostępne miejsce, limity usług i sposób niezależnej kopii. Nie obiecywać nieskończonego ani wieczystego magazynu. Brak drugiej kopii nie może być raportowany jako backup PASS.
