# Audyt 10 zgłoszeń — 4.42.0

Zgłoszenia potraktowano jako dane do sprawdzenia, nie instrukcje nadpisujące zasady projektu. Punktem wyjścia był wdrożony `f2c5180d1e4c17fd9c652ce0c69e6a46775bf939` (4.41.1). Dziewięć identycznych ID znajduje się już w [audycie 4.30](REFINEMENTS-4.30.md). Ich status „Nowe” nie dowodzi braku wcześniejszych poprawek. Przed zmianami ponownie uruchomiono tamte **90 regresji — PASS**.

## Status każdego zgłoszenia

| Zgłoszenie | Ustalenie i wynik w 4.42.0 | Co pozostaje |
|---|---|---|
| `8aa7997d-21c2-47b0-9f31-84993c872c94` — creeper przez ściany | **Potwierdzony i poprawiony bieżący błąd.** Bliskość uruchamiała lont bez widoczności, rozpoczęty lont nie sprawdzał osłony, a radialne obrażenia ignorowały ściany. Teraz fizyczne przeszkody blokują zapłon; utrata widoczności/oddalenie wygaszają lont. Osłona ogranicza obrażenia i odrzut. | To naprawa wskazanej klasy błędu, nie deklaracja identycznego algorytmu eksplozji Java. |
| `c04fce61-5a1d-4c22-8f1e-9f6caec9b8a2` — złote narzędzia | **Wcześniejsza poprawka potwierdzona.** Wszystkie pięć narzędzi i ich receptury istnieją; nie dodawano duplikatów. Porównano rzeczywisty crafting z ośmioma wybranymi recepturami 26.3, w tym wszystkimi pięcioma złotymi narzędziami oraz tagiem materiału złota. | Nie jest to audyt wszystkich mechanik walki/zaklęć/napraw. |
| `9a8e246f-ab93-407b-a21c-db41ef3851b3` — realistyczniejsza woda | **Wcześniejsze ulepszenia zachowane.** Istnieją fale w układzie świata, zależne od kąta przybliżenie odbicia nieba oraz oddzielna symulacja przepływu/prądów. W produkcyjnym WebGL woda nadal renderuje się bez błędów. | „Realistyczniej” nie ma obiektywnego kryterium w raporcie. Nie deklarujemy pełnych odbić, fizyki ani wyglądu Java; bez kolejnej arbitralnej zmiany fal. |
| `da6c1fb5-ca34-474e-9963-aa1e7a0d12f6` — przyspieszające chmury | **Naprawa przyczyny nadal obecna i objęta regresją.** `CloudMotion` integruje prędkość zamiast mnożyć cały czas sesji przez zmienną pogodę, ogranicza krok po pauzie. | Nie odtworzono oryginalnej sesji zgłaszającego. |
| `73a27930-3d26-4a6f-af0f-70eed595b402` — kompletna łódka | **Otwarte.** Brak kompletnego pojazdu: pasażerów, wejścia/wyjścia, pływalności, kolizji, trwałego zapisu i synchronizacji. Nie zarejestrowano referencyjnej receptury jako działającej łódki. | Wymaga osobnego wdrożenia całego pojazdu. Sama ikona lub przepis nie zamknęłyby zgłoszenia. |
| `35038f9f-ece0-458f-83f7-33eaa482758c` — przepisy jak Minecraft | **Częściowe, z nowymi konkretnymi poprawkami.** Drabina/płot miały błędną flagę stołu mimo dużego kształtu; wymaganie jest teraz wyprowadzane z wymiarów receptury. Usunięto zmyślone przekształcenie jednej rudy lapisu w cztery barwniki. Osiem wybranych receptur porównano z 26.3. | Nie przeaudytowano całego katalogu/tagów i pozyskania wszystkich materiałów w survivalu; nie deklarujemy zamknięcia raportu. |
| `67066485-8a4d-4b5d-9d09-40b4fbf00968` — płaskie małe przedmioty | **Znaleziono i poprawiono pozostałą płaską ścieżkę.** Pochodnia miała już prawdziwy pręt 2×2×10/16. Jednak blokowe rośliny `RENDER=1` w ręce/dropie nadal korzystały z jednej płaszczyzny. Teraz mają przód, tył i obrys nieprzezroczystych pikseli o grubości 1/16; wspólny generator wykorzystuje oryginalny kafelek, jeżeli jest dostępny. Wszystkie 10 aktualnych ID tej rodziny przeszły test. | Nie zmieniono krzyżujących się płaszczyzn roślin stojących w świecie ani celowo płaskich elementów poziomych. Nie ma wizualnego audytu każdego ID, transformacji i fallbacku. |
| `008b340b-3bb2-407e-b5c5-f878f9f132b9` — połówki łóżek i ikona | **Wcześniejsza lokalna poprawka potwierdzona.** Osiem kombinacji połowa/kierunek usuwa parę i daje jeden drop; ikona ma poduszkę i koc. Nie przepisano poprawnego kodu ponownie. | Ogólna atomowość równoczesnego kopania/dropów przez klientów oraz pełna zgodność modelu świata z Java pozostają częściowe. |
| `9738fc2b-9f59-4aee-a1ee-6f6f0447e612` — światło na awatarach | **Reakcja na światło potwierdzona pikselami.** Materiały świata reagują na światło kierunkowe i trzymaną pochodnię; podglądy UI pozostają celowo nieoświetlane. | Brak pełnego oświetlenia voxelowego i zasłaniania przez jaskinie/ściany. Test nie oznacza zamknięcia pełnego wyglądu 1:1. |
| `7ee4375d-09d1-4629-adac-648f385de631` — czas kopania | **Istniejące mechanizmy potwierdzone, bez cofania nowszych prac.** Kod ma kroki 20 Hz, rozdzielenie szybkości narzędzia/poziomu zbioru, dzielnik 30/100, addytywne Efficiency oraz kary za wodę i brak podparcia. Pełna istniejąca regresja silnika przeszła ponownie. | Nie wykonano kompletnej macierzy każdego bloku, narzędzia, efektu i warunku w natywnym kliencie 26.3. Status częściowy. |

## Co zmieniono technicznie

- `blast.ts` używa istniejącego DDA `World.raycast` z **rzeczywistymi bryłami kolizji**, a nie przezroczystością tekstury lub rzadkimi próbkami. Obejmuje m.in. szkło i cienkie panele; nie generuje niezaładowanych chunków. Nieznany teren jest przeszkodą. Ten sam test widoczności obsługuje również istniejące ataki dystansowe mobów.
- Zwykły creeper kontynuuje detekcję podczas lontu. Schowanie się lub dystans co najmniej 7 bloków powoduje jego wygaszanie. Oddzielnego lontu TNT nie cofamy.
- `Game.explode` zapamiętuje widoczną część ciała gracza/mobów **przed** niszczeniem bloków. Sprawdzanie po pętli niszczenia usuwałoby ścianę, która powinna chronić. Próbkowanie wielopromieniowe (do 125 promieni na ciało, tylko w zasięgu) odróżnia osłonę pełną od częściowej. Wynik wpływa zarówno na obrażenia, jak i impuls, również w istniejących ścieżkach wspólnych mobów/graczy.
- Destrukcja terenu i wzór bazowych obrażeń pozostają algorytmem projektu, nie portem natywnego algorytmu Java. Pełna zgodność wybuchów, płynów, odporności materiałów i wszystkich efektów nie została wykazana.
- `spritePixelsGeometry` współdzieli istniejący generator grubości/obrysu ikon z blokowymi roślinami. Pochodnia zachowuje swój pręt i wycinek UV — nie zastąpiono jej grubym sześcianem. Nie zmieniono oryginalnych grafik.
- Brak nowych ID bloków/przedmiotów, schematów zapisu, zmian protokołu, SQL, resetów, kont, CAS, dzienników odzyskiwania lub ochrony ulic/działek.

## Źródła referencyjne

Docelowa wersja projektu pozostaje 26.3; duża część runtime nadal opiera się na 1.20.4. Tych wersji nie utożsamiamy.

- Istniejące oryginalne grafiki: przypięty zestaw opisany w [4.30](REFINEMENTS-4.30.md); bez nowych obrazów generowanych lub pełnego archiwum klienta.
- Mały nowy korpus: `.harness/fixtures/report-recipes-26.3/`, 8 receptur + tag materiału złota z `misode/mcmeta` commit `d96c75fec200c4580dd75e033a76341521165461`.
- `scripts/sync-report-recipes.mjs` odtwarza te pliki offline z agregatów cache zweryfikowanych SHA-256 względem `docs/java-reference.lock.json`. Przy braku cache najpierw `npm run reference:sync`. Manifest odróżnia hashe kanonicznych fixture'ów od hashy źródłowych agregatów. Do runtime nie dodano całego katalogu referencyjnego.
- Dane Mojang/Microsoft pozostają **NOT-MIT**, zgodnie z NOTICE; nie rozpowszechniamy pełnego JAR-a.

## Testy i dowody

- Przed zmianami: istniejące `refinements` **90 PASS**.
- `npm run test:reports442`: **49 grup PASS** — zapłon, utrata widoczności/oddalenie, TNT, szkło/panele, przerwa pod włazem, brakujący teren, pełna/częściowa osłona, rzeczywisty wybuch burzący ścianę, lokalne/wspólne moby i gracze, ochrona miasta, pochodnie, 10 geometrii roślinnych, hashe i crafting referencyjny.
- Kontrola negatywna: nowe testy z poprzednimi wersjami `engine.ts`, `mobs.ts`, `inventory.ts` z produkcji 4.41.1: **28 PASS / 21 FAIL**. Po przywróceniu poprawionych plików: **49 PASS / 0 FAIL**. Nowy helper DDA pozostawał obecny, więc negatywna kontrola dotyczy integracji poprawek, a nie wcześniejszego istnienia helpera.
- `npm run typecheck`, `npm test`, `npm run build`, `npm run progress:audit`, `git diff --check`: PASS. Pełny test obejmuje m.in. **16 970 sprawdzeń silnika**, nie tylko nowy plik.
- `npm audit --omit=dev`: **0 podatności**.
- `npm run test:browser:reports442`: produkcyjny HTML, Chromium/SwiftShader, desktop **1875×956** i emulowany dotyk **753×360**. Testowany jest rzeczywisty silnik, bez podmiany implementacji. Ściany z kamienia/szkła/paneli, odkładanie lontu, rzeczywiste obrażenia/odrzut, głębokość modeli, złoty kilof, 8 łóżek, shader wody i piksele światła: PASS, `errors: []`.
- `npm run test:browser:mobmotion`: wszystkie 14 typów, 1764 próbki i 112 kontroli ścian na kontekst desktop/dotyk, brak skoków po pakietach, brak zmiany ekwipunku: PASS.
- `npm run test:browser:shared`: **27 kontroli**, dwa renderery: PASS.
- `npm run test:browser:recovery`: archiwizacja rozbieżnej gałęzi ekwipunku, wybór serwera, pełne wygenerowanie terenu i powrót do rzeczywistej gry: PASS, `errors: []`.

Zwięzły zapis maszynowy: [benchmarks/report-fixes-4.42.json](benchmarks/report-fixes-4.42.json). Testy przeglądarkowe używają izolowanych profili i syntetycznej sieci/bramki; **nie są testem na fizycznym telefonie właściciela, jego koncie produkcyjnym ani oryginalnym kliencie Java**. Nie zmieniano statusów raportów w zewnętrznej bazie.
