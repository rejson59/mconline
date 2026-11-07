# 4.36 — cienki właz także jako przedmiot

Po poprawkach [stanów](TRAPDOORS-4.34.md) i [UV świata](TRAPDOOR-UV-4.35.md) dębowy właz nadal był sześcianem jako przedmiot. Ten odcinek poprawia **geometrię obu rąk, wyrzuconego przedmiotu i ikonę ekwipunku**. Nie zmienia ID, kolizji, reguł podnoszenia, zapisów, kont ani backendu. Bez migracji i resetów.

## Referencja, nie domyślny sześcian

Rzeczywisty plik **`assets/minecraft/items/oak_trapdoor.json`** wskazuje `minecraft:block/oak_trapdoor_bottom`. To nowa definicja przedmiotu, a nie zgadywana ścieżka `models/item`. Rodzice modelu to `template_trapdoor_bottom` → `thin_block` → `block/block`.

Przypięto trzy dodatkowe pliki JSON z mirrora Java **26.3**, `InventivetalentDev/minecraft-assets`, commit **`9073095a88699785bb1f63f8f86d33322711e4fd`**: definicję przedmiotu oraz `models/block/thin_block.json` i `models/block/block.json`. Manifest długości/SHA-256 i notice: `.harness/fixtures/java-trapdoor-item-26.3/`. Modele płyty i PNG są tymi samymi ośmioma plikami z 4.35, bez kopiowania/zmiany. Oryginalne dane są **NOT MIT**, oddzielone od własnego kodu i wyłączone z bundla gry. Nie dodano JAR-a ani pełnego korpusu do Git/Pages/artifacts.

## Implementacja

- Wspólny `src/game/trapdoorItem.ts`: płyta od `[0,0,0]` do `[16,3,16]`, czyli grubość **3/16**, względem środka całego bloku, a nie środka samej płyty.
- `blockGeometry()` przekazuje atlasowe UV dla każdej ściany; rzeczywiste ścieżki głównej ręki, drugiej ręki i dropu używają tego samego helpera. Nie rozciągamy pełnej tekstury na wąskie krawędzie. Materiały nadal korzystają z istniejącego cutout.
- Wszystkie **21 stanów** (68–72, 503–518) jako przedmiot mają tę samą geometrię i ikonę dolnej płyty, niezależnie od stanu postawionego włazu.
- GUI używa odziedziczonej rotacji **[30,225,0]**, skali **0,625** i zerowej translacji. Własna projekcja ortograficzna canvasu zachowuje odwrócone osie UV. Każda widoczna ściana jest cieniowana na osobnym buforze, by otwory nie przyciemniały ścian za nią.
- Ikona kanoniczna jest wyliczana raz i współdzielona przez pozostałe stany. Istniejące cache geometrii dropów pozostają w użyciu.

## Testy i pomiar przed/po

`npm run test:trapitem`, również w standardowym `npm test`: **34 grupy PASS / 0 FAIL, 504/504 pary UV**.

Kontrole obejmują hashe trzech nowych fixture, rzeczywistą definicję przedmiotu i łańcuch rodziców, odziedziczony transform GUI, wszystkie 21 brył i ich UV, normalne/winding/pole powierzchni, kanoniczne fingerprinty oraz niezależną projekcję GUI. Interpreter referencyjnych ścian nie korzysta z produkcyjnego helpera UV. Test canvasu sprawdza izolację ścian i przywracanie stanu kontekstu. Testy rzeczywistych `updateHand()` / `spawnDrop()` sprawdzają cienkie siatki, cutout, zachowanie liczby i opóźnienia podnoszenia oraz współdzielenie geometrii.

Kontrolny pomiar z **oryginalnym `engine.ts` sprzed poprawki**, przy tym samym nowym teście: **11 PASS / 23 FAIL, 0/504 UV**. Następnie bezpiecznie przywrócono nowy kod. Nie jest to wymyślony wynik porównania z oryginalnym klientem.

Pełne `typecheck`, `npm test`, produkcyjny build i `git diff --check`: PASS. W tym dotychczasowe 73 grupy UV świata, 114 stanów, 62 paneli, 79 płotów, 45 ruchu, 83 kontrole SQL, **16 973** kontrole silnika i **409** UI. `npm audit`: **0 podatności**.

### Produkcyjny Chromium

`npm run test:browser:trapitem`, świeży lokalny gość, desktop **960×600** i emulacja dotyku **390×844**: PASS, `errors=[]` na obu.

Na każdym widoku sprawdzono:

- rzeczywiste siatki głównej/drugiej ręki i dropu: wysokość **0,1875**, materiał cutout i **72 pary UV**;
- liczbę/opóźnienie dropu oraz identyczność wszystkich 21 ikon;
- rzeczywisty PNG ikony 48×48: granice `[2,21,45,47]`, **4 próby otworów**, **44 próby drewna**, 504 piksele całkowicie nieprzezroczyste i 1673 całkowicie przezroczyste; granice i próby wyliczane osobno z referencji;
- zachowane kontrole świata z 4.35: 504 pary UV, 1024 kanały atlasu względem PNG, celowanie/kolizje paneli, 32 stany drzwi i stawianie/otwieranie/zamykanie włazu.

Skrypt: `scripts/verify-panels-browser.mjs`. Opcjonalne narzędzia są tylko w `.cache/browser-tools`, raport i zrzuty w `.cache/verification436`. Trwałe małe [pokwitowanie](benchmarks/trapdoor-item-4.36.json) nie zawiera oryginalnego korpusu ani danych graczy.

## Jawne ograniczenia i następny odcinek

To zgodność konkretnej geometrii/UV i transformu GUI z przypiętymi plikami, **nie dowód pełnego obrazu 1:1 z uruchomioną Java 26.3**. Oświetlenie pozostaje uproszczonym cieniowaniem projektu.

Pozy, skale, bobbing i animacje ręki/dropu celowo pozostały dotychczasowe. Nie wdrożono referencyjnego `firstperson_*` (m.in. skala 0,4 i translacja Y=4,2), `thirdperson_*` ani `ground` (skala 0,25, translacja Y=3). Samo poprawienie siatki nie oznacza zastosowania tych transformów.

Zrzut pionowego ekranu pokazuje ograniczenie dotychczasowego kadrowania ręki: trzymany przedmiot może wypadać poza widok. Test na emulacji telefonu potwierdza siatki i ikonę, **nie pełną widoczność dłoni**, wydajność fizycznego telefonu, ręczne gesty ani wielosesyjny multiplayer. Następny odcinek powinien rozliczyć kadrowanie i pozy zamiast przedstawiać ten wynik jako zakończone 1:1.

Pozostałe rodziny włazów, redstone/powered, waterlogging, pełne światło/cullface i porównanie z uruchomionym klientem pozostają otwarte. Pełny transfer oryginałów i niezależny backup nadal nie są potwierdzone. Ten odcinek nie zmienia ich infrastruktury.
