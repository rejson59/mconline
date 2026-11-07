# 4.38 — właz we właściwej pozie modelu

Wdrożono lokalne ustawienia `display` dębowego włazu w obu rękach, dropie i głównej ręce zdalnego gracza. To kolejny odcinek po [geometrii/ikonie 4.36](TRAPDOOR-ITEM-4.36.md) i [wycofaniu pionowej rozgrywki 4.37](LANDSCAPE-4.37.md). Bez zmian ID, fizyki, podnoszenia, danych kont/światów, protokołu i backendu. Bez resetów i migracji.

## Oryginalne ustawienia modelu

Referencja Java **26.3**, `InventivetalentDev/minecraft-assets` commit **9073095a88699785bb1f63f8f86d33322711e4fd**. Te same przypięte pliki `.harness/fixtures/java-trapdoor-item-26.3/` i manifest SHA-256, bez nowych kopii oryginałów. `items/oak_trapdoor.json` wybiera model dolny, który dziedziczy `thin_block` → `block/block`.

| Kontekst | Rotacja XYZ w stopniach | Translacja w pikselach modelu | Skala XYZ |
|---|---|---|---|
| firstperson_righthand | 0, 45, 0 | 0, 4.2, 0 | .4, .4, .4 |
| firstperson_lefthand | 0, 225, 0 | 0, 4.2, 0 | .4, .4, .4 |
| ground | 0, 0, 0 | 0, 3, 0 | .25, .25, .25 |
| thirdperson_righthand | 75, 45, 0 | 0, 2.5, 2 | .375, .375, .375 |

Translacja jest dzielona przez 16. Lewa ręka odwraca znak translacji X i rotacji Y/Z, nie geometrii/skali; wybiera przy tym osobny `firstperson_lefthand`. Macierz jest składana jako **kotwica projektu × T_display × R_XYZ × S_display**, nie w odwrotnej kolejności. Zmiana nie przepisuje współrzędnych kanonicznej płyty ani UV. Pomocnik obsługuje też odziedziczony lewy thirdperson; zdalny offhand nie jest jednak renderowany w tym wydaniu.

Konwencję aplikacji `ItemTransform` dodatkowo sprawdzono w historycznym [kodzie Java](https://github.com/mahtomedi/minecraft/blob/6ac5fe18be48a7395be84148be051908111d6772/src/main/java/net/minecraft/client/renderer/block/model/ItemTransform.java), SHA-256 **b9667593faa6c8d9a209a5511f6c904d713d37b6e1234dce14df9d77d73a3b7e**. To historyczny renderer, **nie kod ani wykonanie klienta 26.3**. Dane rotacji/translacji/skali powyżej pochodzą z przypiętych modeli 26.3. Kod referencyjny odczytano tylko do ignorowanego cache, nie skopiowano do źródeł/bundla.

## Rzeczywiste ścieżki gry

- `updateHand`: główna i druga ręka stosują własny model display, zamiast wspólnej skali .2. Grupowy bobbing/swing pozostaje niezmieniony. Cache aktualizacji nie nakłada macierzy ponownie co klatkę.
- `spawnDrop` i `updateDrops`: skala .25 i przesunięcie +3/16 są zachowane również po aktualizacji animacji. Pozycja/wektor fizyczny `d.pos`/`d.vel`, liczba, metadane, referencja shared i opóźnienie podnoszenia pozostają niezależne od wizualnej translacji.
- Zdalny gracz: zamiast starej złotej kostki jest faktyczna cienka płyta z atlasem/cutout i pozycją thirdperson. Zmiana stanu/przedmiotu odtwarza pozycję bazową, nie sumuje przesunięć. Pozostałe rodziny przedmiotów zachowują dotychczasową ścieżkę.
- Zmiana przedmiotu zwalnia własną geometrię/materiał. Usunięcie awatara zwalnia klon materiału, ale **nie wspólny atlas świata**; nadal zwalnia własne tekstury skóry/etykiety.
- Wszystkie **21 aliasów** (68–72, 503–518) korzysta z jednego kanonicznego modelu. Nie zmienia się geometria stawianego bloku ani ikona GUI.

## Sprawdzenia

`npm run test:trappose` (również w `npm test`): **81 grup PASS, 0 FAIL; 2040 porównań przekształconych wierzchołków**. Niezależna wyrocznia używa JSON z fixture i skalarnej trygonometrii, nie produkcyjnego helpera macierzy. Obejmuje rzeczywiste `updateHand`, `spawnDrop`, `updateRemoteHeld`, `updateDrops`, `dropRemote`, wszystkie aliasy, obie ręce, kolejność składania macierzy, ochronę cache, materiałów/atlasu, zachowanie metadanych oraz niezmienione skale innych bloków.

Kontrolnie przywrócono wyłącznie **bazowy engine.ts sprzed zmiany** przy tych samych nowych testach: **15 PASS / 66 FAIL, 0 przekształconych wierzchołków zgodnych**. Nowy silnik przywrócono w `finally` i powtórzono pozytywny test. To pomiar regresji projektu, nie porównanie z wykonanym klientem Java.

Dotychczasowy `trapitem`: **34 grupy PASS / 504 pary UV**. Produkcyjny Chromium (`npm run test:browser:trappose`): desktop **960×600** i dotyk w poziomie **844×390**, oba **PASS / errors=[]**. Każdy sprawdza:

- rzeczywiste modele obu rąk, dropu i syntetycznego zdalnego awatara: **96 wierzchołków transformów i 96 par UV**;
- utrzymanie translacji dropu po aktualizacji oraz bezpieczne usunięcie rzeczywistego awatara;
- geometrię 3/16, cutout i wspólny atlas, nie tylko same stałe;
- niezmienione GUI (granice `[2,21,45,47]`, 4 próby otworów i 44 drewna);
- wcześniejsze 504 pary UV świata, 1024 kanały atlasu, celowanie, kolizje, stawianie i stany drzwi/włazów.

[Trwałe pokwitowanie](benchmarks/trapdoor-poses-4.38.json). Zrzuty i roboczy raport: ignorowane `.cache/verification438/`. Test tworzy lokalnego gościa i sztucznego awatara, **nie loguje użytkownika ani nie dołącza do prawdziwej sesji MP**.

## Regresje całego projektu

Pełne `npm run typecheck`, `npm test`, produkcyjny `npm run build`, `npm audit --audit-level=low` i `git diff --check`: **PASS; 0 podatności**. W pełnym zestawie m.in. 16 972 kontrole silnika, 409 UI, 83 kontrole SQL stanów włazów, 73 grupy UV, 114 stanów, 62 paneli, 79 płotów, 45 ruchu i 28 blokady pionu. Oddzielnie produkcyjny `npm run test:browser:landscape`: **PASS touch / desktop** przy runtime 4.38. Testy nie wykonują resetów ani migracji na backendzie.

## Granice tego odcinka

Zgodność dotyczy lokalnych ustawień modelu `display` z przypiętych JSON, **nie całego obrazu/animacji Java 26.3**. Kotwice kamery/ramienia, animacje używania/bobbing, oświetlenie, ruch dropów i sposób pokazywania stosu pozostają projektowe. Ręka zdalnego awatara nie jest jeszcze pełną animowaną warstwą trzymanego przedmiotu; inne rodziny i offhand zdalnego gracza pozostają otwarte. Nie wykonano oryginalnego klienta ani pomiaru na fizycznym telefonie. Podstawą runtime nadal jest 1.20.4, celem projektu 26.3. Nie dodano JAR-a/pełnego korpusu, nie zmieniono licencji oryginalnych danych NOT MIT ani infrastruktury archiwum.
