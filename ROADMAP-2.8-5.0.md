# BlockCraft — mapa wydań 2.8–5.0

**Harmonogram odbiorów, nie lista ukończonych funkcji.** Pełne, niezmienione kryteria punktów #1–100 są w [specyfikacji](PLAN-100-BLOCKCRAFT-3.0.md). Każdy punkt ma dokładnie **jedno pierwsze wydanie docelowe** poniżej; w 5.0 przechodzi ponowną regresję, a nie drugi raz implementację. Numer etapu nie daje zaliczenia: kod, grywalność, testy, zgodność zapisów i próba w grze są obowiązkowe. Nie ma deklarowanych dat.

## Najbliższa wersja: 2.8 RC3 — Szlaki i nawigacja

**Do pełnego odbioru w 2.8: #1, #15, #33, #34.** Sześć rozpoznawalnych biomów, zapisywana mapa odkryć, kompas biomów i namierzanie lornetką. W każdej z tych funkcji konieczne są realne interakcje w grze na PC i dotyku, odpowiedzi na błędy oraz zapis/odczyt/import/eksport. To mniejsza bramka niż wcześniejsze osiem punktów RC2; nie jest to oznaczenie tych czterech jako wykonanych.

**Nie wycofujemy istniejącego kodu.** W RC2 są już wysokości v4, wody v5, jaskinie v7 oraz presety jakości. Pozostają grywalne w 2.8 i nadal podlegają testom bezpieczeństwa, kolizji, wydajności i zgodności wszystkich zapisów, ale pełne wymagania #2, #3 i #100 są odbierane w 2.9, a #4 w 2.10. Nie nazywamy ich ukończonymi tylko dlatego, że są widoczne w RC3.

**Wspólna bramka każdego wydania:** uruchomienie gry (Survival i Creative tam, gdzie dotyczy), adekwatne testy silnika/UI i próba Chromium/WebGL2 PC + emulowanego dotyku, typecheck i build, zachowanie dawnych generatorów, bloków i ID, zapis/import/eksport, aktualizacja pomocy oraz pomiar ryzyka wydajności. Test fizycznego telefonu/GPU pozostaje osobną, jawną bramką sprzętową; bez dostępu do sprzętu nie twierdzimy, że został wykonany. Użytkownik nie musi nic testować. Gdy błąd w już obecnej funkcji blokuje grę, naprawiamy go przed wydaniem, nawet jeśli pełny odbiór tej funkcji ma późniejszy numer.

## Podział 100 pomysłów na mniejsze wydania

| Wydanie | Punkty do pierwszego pełnego odbioru | Grywalny cel |
| --- | --- | --- |
| **2.8 — Szlaki i nawigacja** | **1, 15, 33–34** | Sześć biomów, mapa odkryć, kompas biomów i lorneta; zapis i nawigacja na PC oraz emulowanym dotyku. |
| **2.9 — Wysokości, woda i płynność** | **2–3, 100** | Odrębne formacje wysokościowe, spójne rzeki i jeziora, presety obrazu na słabszych urządzeniach. |
| **2.10 — Podziemne szlaki** | **4, 31–32** | Jaskinie bez pułapek bez wyjścia oraz lina i kotwica do bezpiecznych zejść i powrotów. |
| **2.11 — Fundamenty budownictwa** | **16–19, 23** | Drewno, kamień, roślinne powierzchnie, glina i kompletne schody/płyty. |
| **2.12 — Warsztat architekta** | **20–22, 24–27** | Szkło, światło, okucia, belki, kolumny, tkaniny i pojemniki na rośliny. |
| **2.13 — Dom i ogród** | **28–30, 43, 50** | Rośliny, ceramika, pogoda na budowlach, amunicja i dekoracyjne wyposażenie. |
| **2.14 — Podróżny ekwipunek** | **44–49** | Polowanie, biwak, kuchnia, przynęty i niekumulujące się talizmany. |
| **3.0 — Wyposażenie wyprawy** | **35–42** | Plecak, mikstury i naprawy oraz tarcze, bronie i cięciwy; to wydanie etapowe, nie koniec planu. |
| **3.1 — Zwierzęta i biomy** | **52–58** | Króliki, lisy, płazy, żółwie, niedźwiedzie, latające i małe bagienne stworzenia. |
| **3.2 — Sąsiedzi i przeciwnicy** | **59–65** | Karawany, straż, rytm dnia, reakcje na pogodę/ogień i przeciwnicy jaskiń/pustyni. |
| **3.3 — Zachowanie i czytelność** | **51, 67–70** | Sylwetki, warianty, ograniczony koszt ścieżkowania, sygnały walki i zaufanie. |
| **3.4 — Rolnictwo** | **86–90** | Uprawy, nawadnianie, sady, dorastanie zwierząt i pszczoły. |
| **3.5 — Żywe wioski** | **91–95** | Zawody, rozbudowa osad, warsztaty i etapowe przetwarzanie. |
| **4.0 — Odkrywanie ruin** | **5–8, 66** | Podziemne i powierzchniowe ruiny, kopalnie, obozy i osiągalny strażnik ruin. |
| **4.1 — Świat opowieści** | **9–14** | Wioski biomowe, drogowskazy, zdarzenia, Nether, przeprawy i znajdowana historia. |
| **4.2 — Wielkie starcia** | **71–74** | Bossowie, mini-bossowie i różne wzorce ataków bez nieuczciwych pułapek. |
| **4.3 — Tryb wyprawy** | **82–85** | Przygoda, arena, nagrody otwierające podróż i ostrzeżenia o zagrożeniach. |
| **4.4 — Walka i progresja** | **75–81** | Uniki, pancerze, zaklęcia, mikstury, dziennik, nagrody i trudność. |
| **4.5 — Ostateczny szlif** | **96–99** | Spójne tekstury, czytelne ikony, zróżnicowane powierzchnie i sterowane dźwięki. |
| **5.0 — odbiór całości** | — *(bez nowych numerów)* | Regresja 100/100 punktów, interoperacyjność, historia zapisów, testy PC/dotyku, balans i dopiero wtedy pełny Release 5.0. |

## Pełna lista według wydań

Tytuły poniżej są dokładnie tytułami oryginalnych 100 punktów. Pełne warunki każdego punktu pozostają w [specyfikacji](PLAN-100-BLOCKCRAFT-3.0.md). Już obecny kod późniejszego punktu nie przesuwa go automatycznie do 2.8.

### 2.8 — teraz: Szlaki i nawigacja

- **#1 — Nowe biomy**
- **#15 — Mapa odkrywania**
- **#33 — Kompas biomów**
- **#34 — Lornetka**

### 2.9 — później: Wysokości, woda i płynność

- **#2 — Biomy wysokościowe**
- **#3 — Rzeki i jeziora**
- **#100 — Ustawienia jakości tekstur i efektów**

### 2.10 — później: Podziemne szlaki

- **#4 — Większe jaskinie**
- **#31 — Lina**
- **#32 — Kotwica wspinaczkowa**

### 2.11 — później: Fundamenty budownictwa

- **#16 — Nowe drewno**
- **#17 — Odmiany kamienia**
- **#18 — Mech i porosty**
- **#19 — Glina i terakota**
- **#23 — Więcej schodów i płyt**

### 2.12 — później: Warsztat architekta

- **#20 — Szkło barwione**
- **#21 — Bloki oświetlenia**
- **#22 — Łańcuchy i haki**
- **#24 — Belki konstrukcyjne**
- **#25 — Kolumny i kapitele**
- **#26 — Dywany i tkaniny**
- **#27 — Donice i skrzynki na rośliny**

### 2.13 — później: Dom i ogród

- **#28 — Krzewy i liście**
- **#29 — Garncarstwo**
- **#30 — Pogodowe warianty bloków**
- **#43 — Specjalne strzały**
- **#50 — Dekoracyjne receptury**

### 2.14 — później: Podróżny ekwipunek

- **#44 — Pułapki łowieckie**
- **#45 — Zestaw biwakowy**
- **#46 — Kocioł podróżny**
- **#47 — Więcej posiłków**
- **#48 — Przynęty wędkarskie**
- **#49 — Talizmany**

### 3.0 — później: Wyposażenie wyprawy

- **#35 — Plecak**
- **#36 — Pojemnik na mikstury**
- **#37 — Zestaw naprawczy**
- **#38 — Różne tarcze**
- **#39 — Włócznia**
- **#40 — Młot**
- **#41 — Sztylet**
- **#42 — Łuki i cięciwy**

### 3.1 — później: Zwierzęta i biomy

- **#52 — Króliki**
- **#53 — Lisy**
- **#54 — Żaby**
- **#55 — Żółwie**
- **#56 — Niedźwiedzie**
- **#57 — Sowy lub nietoperze**
- **#58 — Kameleony/jaszczurki**

### 3.2 — później: Sąsiedzi i przeciwnicy

- **#59 — Wędrowny kupiec z karawaną**
- **#60 — Strażnik wioski**
- **#61 — Codzienne życie mieszkańców**
- **#62 — Reakcje mobów na pogodę**
- **#63 — Reakcje na ogień**
- **#64 — Ślepy mob jaskiniowy**
- **#65 — Przeciwnik pustynny**

### 3.3 — później: Zachowanie i czytelność

- **#51 — Przegląd wyglądu mobów**
- **#67 — Warianty mobów**
- **#68 — Pathfinding mobów**
- **#69 — Animacje walki**
- **#70 — Oswajanie przez zaufanie**

### 3.4 — później: Rolnictwo

- **#86 — Nowe uprawy**
- **#87 — Nawadnianie**
- **#88 — Drzewa owocowe**
- **#89 — Etapy wzrostu zwierząt**
- **#90 — Pszczoły i ule**

### 3.5 — później: Żywe wioski

- **#91 — Zawody mieszkańców**
- **#92 — Rozbudowa wiosek**
- **#93 — Crafting zależny od stacji**
- **#94 — Nowe stacje**
- **#95 — Przetwarzanie etapowe**

### 4.0 — później: Odkrywanie ruin

- **#5 — Podziemne ruiny**
- **#6 — Opuszczone kopalnie**
- **#7 — Ruiny powierzchniowe**
- **#8 — Obozowiska**
- **#66 — Strażnik ruin**

### 4.1 — później: Świat opowieści

- **#9 — Wioski biomowe**
- **#10 — Dalekie punkty orientacyjne**
- **#11 — Wydarzenia podróżne**
- **#12 — Podziemia Netheru**
- **#13 — Naturalne przeprawy**
- **#14 — Historia świata**

### 4.2 — później: Wielkie starcia

- **#71 — Boss ruin**
- **#72 — Boss Netheru**
- **#73 — Mini-bossowie biomowi**
- **#74 — Różne wzorce ataków**

### 4.3 — później: Tryb wyprawy

- **#82 — Tryb przygody**
- **#83 — Arena treningowa**
- **#84 — Łupy bossów jako narzędzia**
- **#85 — Czytelne ostrzeganie o zagrożeniach**

### 4.4 — później: Walka i progresja

- **#75 — Unik i blok kierunkowy**
- **#76 — Specjalizowane zbroje**
- **#77 — Warianty zaklęć**
- **#78 — Nowe mikstury**
- **#79 — Wyzwania dziennika**
- **#80 — Nagrody za odkrywanie**
- **#81 — Trudność świata**

### 4.5 — później: Ostateczny szlif

- **#96 — Spójny przegląd tekstur**
- **#97 — Czytelniejsze ikony**
- **#98 — Lepsze tekstury bloków**
- **#99 — Dźwięki środowiska i walki**

## 5.0 — regresja całości

Dopiero po pierwszym odbiorze każdego punktu w przypisanym wydaniu i ponownym sprawdzeniu wszystkich 100 razem wolno deklarować „kompletne BlockCraft 5.0”. 3.0 i 4.0 są wydaniami etapowymi. Nie zmieniamy znaczenia ID, nie wycofujemy niezakończonych pozycji z planu i nie publikujemy stabilnego wydania na podstawie samej makiety lub zielonych testów jednostkowych.

## Otwarta bramka RC3

2.8 pozostaje kandydatem: #1, #15, #33 i #34 wymagają dopięcia prób w grze i scenariuszy zgodności zapisu; już obecne wysokości, rzeki, jaskinie i grafika wymagają regresji bezpieczeństwa, nie mogą blokować rozgrywki. RC3 przeszedł 1906 testów silnika, 253 UI, 51 prób Chromium/WebGL2 (w tym rzeczywisty eksport/import mapy i celów) oraz import rzeczywistych eksportów 2.7/v2 (9/9) i RC1/v6 (10/10). Nie zastępuje to długiej próby na fizycznym telefonie/GPU. Szczegóły stanu: [3.0-STATUS.md](3.0-STATUS.md).
