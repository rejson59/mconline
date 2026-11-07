# 4.35 — włazy bez rozciągniętych tekstur

Kolejny krok w grze po [stanach włazów 4.34](TRAPDOORS-4.34.md). Poprawiono **wygląd dębowych włazów w świecie**, bez zmiany ID, zapisów, kolizji, reguł stawiania, kont i backendu. Bez migracji bazy i resetów.

## Co zmieniono

- Krawędzie cienkich płyt korzystają z właściwych **pasków 3 pikseli** tekstury, zamiast całej tekstury rozciągniętej na 3/16 bloku. Dotyczy płyt zamkniętych i otwartych skrzydeł.
- Górna/dolna powierzchnia oraz obie strony pionowego panelu mają właściwą orientację UV. Otwarte skrzydło obraca UV razem z modelem, bez `uvlock`.
- Włazy trafiają do istniejącej warstwy **cutout z alphaTest=0,5**, a nie materiału nieprzezroczystego: przez wycięte otwory widać scenę, zamiast czarnych pól tekstury. Nie jest to półprzezroczysta warstwa wody/szkła.
- Zmiana obejmuje **wszystkie 21 zapisanych stanów**: pięć starych ID 68–72 i szesnaście nowych 503–518. Stare włazy nie są przesuwane ani przepisywane.
- UV są wyliczane raz dla pięciu układów (zamknięty + cztery kierunki otwarcia) i używane ponownie. Geometria i liczba 24 wierzchołków na izolowany właz pozostają bez zmian. Worker i mesher synchroniczny otrzymują tę samą poprawkę.

## Nie zgadywaliśmy odbić według połowy

Model dębowego włazu ma rodziców **`template_trapdoor_bottom/top/open`**, nie `template_orientable_trapdoor_*`. Te szablony mają inne UV — sprawdzenie faktycznego rodzica było istotne.

W przypiętych blockstates dębu zamknięte kierunki nie obracają tekstury; obie połowy mają takie same UV. Również otwarte dolne/górne skrzydło używa tego samego modelu i obrotu Y. Nie dodano wymyślonego obrotu X ani odbicia tylko dlatego, że właz jest górny. N/E/S/W projektu nadal oznacza krawędź panelu, przeciwną do Java `FACING`.

## Podstawa porównania

Przypięty mirror **Java 26.3**, repozytorium `InventivetalentDev/minecraft-assets`, commit **`9073095a88699785bb1f63f8f86d33322711e4fd`**:

- `blockstates/oak_trapdoor.json`;
- modele `oak_trapdoor_bottom/top/open.json` i rzeczywiste szablony rodziców `template_trapdoor_bottom/top/open.json`;
- `textures/block/oak_trapdoor.png` — **16×16**.

Te osiem małych plików ma przypięte długości/SHA-256 w `.harness/fixtures/java-trapdoor-26.3/manifest.json`; są oddzielnymi plikami odniesienia, nie częścią bundla gry. Dane modeli i grafika Mojang/Microsoft **nie podlegają MIT projektu**; notice jest obok fixture i w `public/Minecraft-NOTICE.txt`. Nie dodano JAR-a ani pełnego zbioru oryginałów do Git/Pages/artifacts.

Istniejący kafelek atlasu był już identyczny z tym PNG we wszystkich **1024 kanałach RGBA**. Nie zmieniano grafiki ani nie generowano jej ponownie — błędne były UV i warstwa renderowania.

Kolejność narożników Java pomocniczo zweryfikowano w historycznym `FaceInfo.java`, mirror `mahtomedi/minecraft`, commit `6ac5fe18be48a7395be84148be051908111d6772` (1.20.3-pre1). Surowy plik pozostał w ignorowanym cache; hash w pokwitowaniu. To pomocnicza kontrola konwencji, nie uruchomiony klient 26.3.

## Weryfikacja

**73 grupy** (`npm run test:trapuv`, również standardowy `npm test`):

- osiem plików odniesienia sprawdzonych po długości i SHA-256;
- niezależny interpreter rzeczywistych rodziców modeli, prostokątów UV, blockstates i obrotów Y — **nie korzysta z produkcyjnego helpera UV ani dekodera stanów**;
- wszystkie 21 stanów: niezależne granice bryły, **504/504 pary UV narożników**, brak włazu w warstwie opaque oraz zgodność pełnych siatek synchronicznych/workera;
- zgodność pikseli atlasu z PNG, również alpha, oraz kontrola, że nie wymyślono obrotów dla połowy/kierunku zamkniętego dębu.

Pierwszy poprawnie uruchomiony pomiar UV przed poprawką: **52 grupy PASS / 21 FAIL** — wszystkie grupy UV stanów zawierały różnice. Po poprawce i uzupełnieniu kontroli warstwy: **73 PASS / 0 FAIL**. Testy wcześniejszych wersji korzystające z bufora opaque zostały przełączone na bufor cutout, zachowując te same oczekiwane wymiary i kontrolę blokowania.

Poprzednie 114 grup stanów, 62 paneli, 79 płotów, 45 ruchu i 83 kontrole SQL: PASS. Pełne typecheck/test/build/diff check: PASS; smoke **16 973 / 0 błędów**, UI **409 / 0**; audit **0 podatności**.

**Produkcyjny Chromium**, świeży lokalny gość, desktop 960×600 i emulacja dotyku 390×844: PASS, errors=[]. Porównano UV rzeczywistych siatek produkcyjnego świata: **504 narożniki** na każdym urządzeniu, właściwy materiał cutout/alphaTest oraz **1024 kanały rzeczywistego canvasu atlasu** z plikiem odniesienia. Zachowano kontrole ruchu, celowania, 32 stanów drzwi i faktycznego `tryUse` podłoga503→511→503/sufit507. Zrzuty pokazują zamknięty dolny/górny właz i pionowe skrzydła.

Skrypt: `scripts/verify-panels-browser.mjs`; komenda `npm run test:browser:trapuv`. Opcjonalne narzędzia tylko w `.cache/browser-tools`, raporty/zrzuty w `.cache/verification435`. Wynik minimalny: [pokwitowanie](benchmarks/trapdoor-uv-4.35.json). Właściciel nie musi instalować narzędzi ani wykonywać testów na swoim telefonie.

## Granice wyniku

To porównanie z konkretnymi modelami/PNG **mirrora**, a nie z uruchomionym oryginalnym klientem. Nie dowodzi identyczności końcowego obrazu całej sceny, oświetlenia, cullface/AO, wydajności fizycznego telefonu ani pełnego 1:1 Java 26.3. Nie zmieniono modeli dłoni/ikony przedmiotu, pozostałych rodzin włazów, redstone ani waterlogging. Nie wykonano nowego transferu pełnych oryginałów; backend archiwum i wcześniejsze ograniczenia pozostają bez zmian.
