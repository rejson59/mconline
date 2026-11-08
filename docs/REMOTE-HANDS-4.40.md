# 4.40 — obie ręce innych graczy

## Zmiana widoczna w grze

- Inni gracze pokazują teraz **główną i drugą rękę**, a nie tylko jeden nieruchomy uchwyt. Oba przedmioty są dziećmi właściwych ramion i podążają za ich przeciwnymi fazami ruchu podczas chodzenia.
- Złota kostka nie zastępuje już pozostałych przedmiotów: używane są istniejące modele bloków, teksturowane sylwetki narzędzi/jedzenia i materiał łóżka. Sprawdzono geometrię wszystkich **427 dodatnich zarejestrowanych identyfikatorów** w obu rękach (303 stany bloków + 124 przedmioty, bez powietrza).
- **Kamień, bruk, ziemia, dębowe deski, piasek i dębowy właz** korzystają z wcześniej przypiętych ustawień `thirdperson` modeli 26.3 także w lewej ręce innych graczy. Odbicie ustawień lewej ręki nie odwraca znaku skali ani UV.
- Pusta/niepoprawna ręka niczego nie pokazuje. Śmierć ukrywa oba przedmioty; odrodzenie przy tych samych ID je przywraca. Zmiana wymiaru ukrywa cały awatar, a odejście go usuwa.
- Wymiana skóry od razu zachowuje oba przedmioty, kierunek, pozycję i bieżące ustawienie kończyn. Zmiana jednego przedmiotu nie przebudowuje drugiego.

## Współdzielone tekstury i zgodność

Każdy uchwyt posiada własną geometrię i materiał. Przy wymianie zwalnia poprzednie własne zasoby, ale **nie usuwa pożyczonych tekstur** atlasu, ikon, łóżka ani skóry. Dotyczy to także globalnie buforowanych skórek i proceduralnych części awatara: usunięcie jednego gracza nie może unieważnić mapy używanej przez drugiego. Własna tekstura etykiety nadal jest zwalniana.

Nie zmieniono pakietów sieciowych: wykorzystywane są istniejące pola `held` i `offhand`. Nie dodano migracji, zapisu profili, nowych ID, resetów ani zmian kont/autoryzacji/CAS/dzienników, ochrony działek i ulic. Dane lokalnego gracza nie są źródłem wyposażenia zdalnego awatara.

## Weryfikacja

### Silnik bez WebGL

`npm run test:remotehands`: **62 grupy PASS / 0 FAIL**.

- Niezależna skalarna wyrocznia, oryginalne fixture modeli: **2496 wierzchołków świata** dla 26 aliasów sześciu rodzin × skórka klasyczna/smukła × obie ręce. Uwzględnia ustawienie `display`, skalę postaci, położenie ramienia, animację i obrót/pozycję awatara. Nie używa produkcyjnego helpera transformacji jako oczekiwanego wyniku.
- Fingerprinty rzeczywistej geometrii bloków i sprite'ów dla wszystkich 427 ID w obu rękach. Jest to test wyboru istniejącego modelu, **nie** dowód zgodności wszystkich modeli z Java.
- Niezależne cache, puste/nieprawidłowe ID, śmierć/odrodzenie, rzeczywisty `RemoteTrack`/`tickNet`, zmiana skóry, własność materiałów/tekstur i usuwanie awatara.
- Kontrola negatywna z dokładnym `engine.ts` produkcyjnej 4.39 (`c36875857abe404f2060309a0387b04745119946`): **1 PASS / 61 FAIL**. Po przywróceniu nowego kodu: **62 PASS / 0 FAIL**. To porównanie starego i nowego silnika projektu, nie dwóch oryginalnych klientów Java.
- Regresje `cubepose`: **37 grup / 480 wierzchołków PASS**; `trappose`: **81 grup / 2040 wierzchołków PASS**. Dla niezweryfikowanego szkła oczekiwana projektowa skala wynosi teraz .25, nie rozmiar dawnej kostki zastępczej.

### Produkcyjna przeglądarka

`npm run test:browser:remotehands`: **desktop 960×600 i emulowany dotyk 844×390 PASS, errors=[]**. W każdym kontekście:

- po **2496 lokalnych + 2496 światowych wierzchołków** obu rąk, klasycznej i smukłej skórki, porównanych z niezależnymi oczekiwaniami referencyjnych ustawień modeli;
- prawdziwe `onNetMessage`, `RemoteTrack`, `tickNet`, tworzenie/wymiana/usuwanie awatarów i produkcyjne materiały/sylwetki; dwa równocześnie widoczne awatary;
- zmiana tylko offhandu, sprite'y i łóżko, puste/nieprawidłowe pakiety, śmierć/wymiar/odrodzenie, zachowanie pozy po wymianie skóry, ruch obu ramion i brak zmiany lokalnego ekwipunku;
- **0** zdarzeń usunięcia współdzielonych ikon, łóżka i skóry; **2** zwolnione własne etykiety; atlas również pozostaje żywy;
- zachowane dotychczasowe kontrole paneli, UV, 480 wierzchołków pięciu sześcianów i 96 włazu.

Finalny kadr pokazuje Steve'a z kamieniem i włazem oraz Alex z diamentowym mieczem i jabłkiem. Zrzuty lokalne: `.cache/verification440/{desktop,mobile}.png`. Trwałe małe pokwitowanie: [remote-hands-4.40.json](benchmarks/remote-hands-4.40.json). Pakiety są syntetyczne; to nie zalogowane konta dwóch osób ani test na fizycznym telefonie właściciela.

### Regresja powrotu na serwer

`npm run test:browser:recovery`: **PASS / errors=[]** na 4.40.0, razem z odświeżeniem, utraconym ACK, blokadami drugiej karty/urządzenia, zachowaniem rozbieżnych/uszkodzonych kopii i eksportem `/kopie`. Test trwale czeka teraz na pełne wygenerowanie terenu (`>= .999`), klika „Dołącz do świata” i potwierdza `ui === 'playing'`, a nie sam ekran wczytywania. [Pokwitowanie](benchmarks/server-recovery-4.40.json). `npm run test:browser:shared`: **27 kontroli PASS**, dwa renderery i brak nieobsłużonych błędów. Nie wykonywano zapisów w prawdziwych sesjach właściciela.

## Granice tego odcinka i następny kierunek

Sześć wymienionych rodzin ma porównane ustawienia modeli; pozostałe bloki używają projektowej skali **.25**, a sprite'y **.32**. Wykorzystanie ich faktycznej istniejącej geometrii nie oznacza pełnego importu modeli i ustawień Java. Zachowano dotychczasowe środkowe osie obrotu ramion i projektowy cykl chodu — **nie są jeszcze zweryfikowaną animacją ramion Java 26.3**. Brak porównania z uruchomionym oryginalnym klientem; renderer, światło i pełne zachowanie używania przedmiotów pozostają częściowe. Runtime nadal bazuje na 1.20.4, cel pozostaje 26.3.

Kolejny krok wizualny: referencyjne ustawienia modeli narzędzi i ich chwytu oraz osie/animacje ramion, zamiast uznawania projektowego fallbacku za gotowe 1:1. Ten odcinek nie zmienia receptur ani mianownika audytu całej gry.

## Kontrole wydania

`npm run typecheck`, pełne `npm test`, produkcyjny `npm run build`, `npm audit --audit-level=low` i `git diff --check`: **PASS, 0 podatności**. Pełny zestaw obejmuje m.in. 16 973 kontrole silnika, 409 UI, 62 nowe grupy obu rąk, 28 checkpointu, 12 cyklu połączenia i 15 współdzielonego stanu. `npm run test:browser:account`: **desktop i emulowany telefon PASS / errors=[]**, prawdziwy przypięty provider z syntetycznym logowaniem/whoami; ponadto kontrola origin preview/file/obcej domeny PASS. Zmiana konta, spóźniona odpowiedź, wylogowanie, offline/retry i zachowanie światów/profili pozostają sprawdzone. Audyt dowodów odświeżono dla 4.40.0 bez zmiany mianownika ani wymyślania globalnego procentu.
