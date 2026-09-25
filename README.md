# BlockCraft 🟩

Gra sandboxowa w stylu **Minecraft** działająca w całości w przeglądarce – bez instalacji, bez serwera i bez pobierania assetów z sieci.
**Wersja 1.3 „Łowy”**: łuk i strzały, szkieletowe stwory strzelają z dystansu, pająki wspinają się po ścianach i dają strunę, kury dają pióra, a z 9 sztabek żelaza, złota lub diamentów można wykonać bloki magazynowe. Nowy typ świata – **płaski** – do budowania bez przeszkód, oraz **eksport i import zapisów** do pliku JSON.
Wersja 1.2 „Dom” zostaje: skrzynie (także w jaskiniach), dwublokowe drzwi, drabiny, płot, właz, ognisko, nożyce, krzesiwo, kompas i zegar.
Wersja 1.1 zostaje: narzędzia z wytrzymałością, głód, piec, farming, wiadra, pochodnie, łóżko, deszcz, creepery i kilka światów.
Proceduralny świat, kopanie i budowanie, crafting, moby, TNT, cykl dnia i nocy oraz tryb kreatywny z lataniem.

Zbudowana w **React 19 + TypeScript + Three.js + Vite + Tailwind CSS 4**, gotowa do publikacji na **GitHub Pages** jednym kliknięciem.

---

## 🎮 Sterowanie

| Klawisz / przycisk | Akcja |
| --- | --- |
| `W A S D` | ruch |
| mysz | rozglądanie się (po kliknięciu – blokada kursora) |
| `Spacja` | skok / pływanie w górę |
| `Spacja` ×2 lub `F` | latanie (tryb kreatywny) |
| `Shift` | skradanie / lot w dół |
| `W` ×2 lub `Ctrl` | sprint |
| LPM (przytrzymaj) | kopanie / atak / podpalenie TNT |
| PPM | postawienie bloku / użycie stołu rzemieślniczego |
| ŚPM | wybór bloku z celownika |
| `1`–`9`, kółko myszy | wybór slotu na pasku |
| `E` | ekwipunek i wytwarzanie |
| `Q` | wyrzucenie przedmiotu |
| `T` lub `/` | czat i komendy |
| `PPM` na jedzeniu | jedzenie (głód) |
| `PPM` na piecu | przetapianie |
| `PPM` na łóżku | sen w nocy i punkt odrodzenia |
| `PPM` na drzwiach lub włazie | otwórz / zamknij |
| `PPM` na skrzyni | schowek |
| drabina + `W` lub spacja | wspinaczka |
| nożyce + LPM na owcy | wełna bez zabijania |
| krzesiwo + `PPM` na TNT | podpalenie |
| łuk: przytrzymaj `PPM`, puść | wystrzał ze strzały |
| kompas / zegar w ręce | kierunek odrodzenia i pora dnia |
| motyka + `PPM` | grządka pod pszenicę |
| `M` | minimapa |
| `F3` | informacje debugowania |
| `Esc` | pauza |

### Na telefonie i tablecie

Gra wykrywa ekran dotykowy i włącza sterowanie dotykowe:

* **lewy drążek** (dolna-lewa część ekranu) – ruch,
* **przeciąganie palcem** po pozostałej części ekranu – rozglądanie się,
* przyciski po prawej – **skok / lot**, **kopanie**, **stawianie**,
* przyciski w lewym górnym rogu – **pauza** i **ekwipunek**,
* dwukrotne dotknięcie przycisku skoku w trybie kreatywnym – latanie.

### Komendy czatu

```
/help                      lista komend
/gamemode <survival|creative>
/time set <day|night|noon|midnight>
/weather <clear|rain>
/tp <x> <y> <z>            teleportacja
/give <nazwa|id> [ilość]   np. /give wegiel 16, /give drewniany_kilof
/summon <pig|sheep|cow|chicken|zombie|creeper|spider|skeleton>
/heal  /kill  /seed  /spawn  /clear  /blocks
```

---

## 🚀 Uruchomienie lokalne

Wymagany **Node.js 20+**.

```bash
npm install      # instalacja zależności
npm run dev      # serwer developerski -> http://localhost:5173
npm run build    # produkcyjny build do katalogu dist/
npm run preview  # podgląd produkcyjnego builda
npm run typecheck
```

Build jest **pojedynczym plikiem `dist/index.html`** (JS i CSS są wbudowane w HTML), a jedynym dodatkowym plikiem jest `dist/menu-bg.jpg`.
Dzięki temu grę można otworzyć nawet bezpośrednio z dysku (`file://`) albo wrzucić na dowolny hosting statyczny.

---

## 🌐 Publikacja na GitHub Pages

### Wariant A – automatycznie (zalecany)

W repozytorium jest gotowy workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).

1. Wypchnij projekt na gałąź `main`.
2. Wejdź w **Settings → Pages** i jako *Source* wybierz **GitHub Actions**.
3. Po każdym pushu na `main` workflow zbuduje grę (`npm ci` → `npm run typecheck` → `npm run build`) i opublikuje katalog `dist/`.

Gra będzie dostępna pod adresem:

```
https://<użytkownik>.github.io/<repo>/
```

### Wariant B – ręcznie na gałęzi `gh-pages`

```bash
npm run deploy:branch   # build + publikacja dist/ na gałęzi gh-pages
```

Następnie w **Settings → Pages** ustaw *Source: Deploy from a branch* i wybierz `gh-pages` / `/ (root)`.

### Dlaczego build działa pod `/nazwa-repozytorium/`?

Katalogi projektowe GitHub Pages są serwowane z podkatalogu (`https://user.github.io/repo/`), więc wszystkie ścieżki w buildzie są **względne**:

* `vite.config.ts` ustawia `base: "./"`,
* tło menu jest ładowane jako `./menu-bg.jpg` (`import.meta.env.BASE_URL`) – **nie** jako `/menu-bg.jpg`,
* `public/.nojekyll` wyłącza przetwarzanie przez Jekylla (pliki zaczynające się od `_` nie znikają),
* cały JavaScript i CSS są wbudowane w `index.html`, więc nie ma żadnych zewnętrznych `assets/*` do zgubienia.

---

## 🧱 Co jest w grze

* **Proceduralny świat** – kontynenty, wzgórza, góry, jaskinie, rudy (węgiel, żelazo, złoto, diament), biomy: równiny, las, las brzozowy, pustynia z kaktusami, tundra, góry, plaża, ocean.
* **Ponad 55 bloków** (trawa, rudy, wełna, TNT, obsydian, pochodnia, sadzonki, grządka, pszenica, łóżko, rozpalony piec) z proceduralnie rysowaną teksturą 16×16 px – atlas + ikony 3D do ekwipunku.
* **Światło blokowe**: pochodnie, lawa i rozpalony piec rozjaśniają jaskinie także w nocy.
* **Narzędzia** (drewno, kamień, żelazo, diament): kilof, siekiera, łopata, miecz i motyka. Mają wytrzymałość i przyspieszają kopanie właściwych bloków. Węgiel chce dowolnego kilofa, żelazo i złoto – kamiennego, diamenty – żelaznego, obsydian – diamentowego.
* **Głód i jedzenie**: jabłka z liści, surowe i pieczone mięso, chleb z pszenicy. Regeneracja działa tylko przy pełnym brzuchu; sprint wymaga jedzenia.
* **Piec**: PPM otwiera przetapianie (ruda → sztabka, piasek → szkło, pień → węgiel drzewny, mięso). Paliwem jest węgiel, deski, patyki albo pnie.
* **Uprawa**: motyka robi grządkę, nasiona (z trawy) rosną w pszenicę szybciej przy wodzie. Sadzonki z liści wyrastają w drzewa.
* **Wiadra** z żelaza zbierają i stawiają wodę oraz lawę.
* **Kilkadziesiąt receptur** wytwarzania, część wymaga stołu rzemieślniczego. Lista ma filtr „tylko możliwe”. Wśród nich łuk (3 patyki + 3 struny) i strzały (krzemień + patyk + pióro) oraz bloki żelaza, złota i diamentów (9 sztabek → 1 blok i z powrotem).
* **Moby**: świnie, owce, krowy i kury (zostawiają jedzenie, wełnę albo pióra), zombie (atakują w nocy i w jaskiniach, palą się w dzień), creepery (podchodzą i wybuchają), **pająki** (szybkie, wspinają się po ścianach, dają strunę) oraz **szkieletowe stwory** – trzymają dystans i strzelają z łuku, a same rzucają kości, strzały i czasem łuk.
* **Fizyka**: kolizje AABB, grawitacja, obrażenia od upadku, pływanie i tonięcie, lawa, kaktusy, wybuchy TNT z odrzutem.
* **Świat i cykl dnia**: 10-minutowa doba, wschody i zachody słońca, gwiazdy, chmury, mgła pod wodą i w lawie.
* **Do 8 światów** w `localStorage` (nazwa, typ świata, modyfikacje bloków, pozycja, ekwipunek, głód, piece, osiągnięcia) + autozapis co 30 s, przy zamykaniu karty i przy chowaniu karty. Stary pojedynczy zapis jest przenoszony automatycznie.
* **Eksport i import zapisów** – przyciski w menu głównym pobierają wszystkie światy do pliku `blockcraft-swiety.json` i wczytują go z powrotem (np. przy zmianie przeglądarki albo komputera).
* **Przedmioty leżą na ziemi** po kopaniu, śmierci i zabiciu moba – podnosisz je, podchodząc.
* **Pogoda**: deszcz i śnieg (w tundrze i górach), błyskawice, ciemniejsze niebo. Na pustyni nie pada.
* **Muzyka ambientowa** – rzadkie, ciche frazy pentatoniczne w tle podczas eksploracji (generowane w Web Audio, bez żadnych plików dźwiękowych).
* **Minimapa** (klawisz `M`) obraca się razem z graczem.
* **Dom**: dwublokowe drzwi (PPM otwiera), skrzynia na 27 slotów, drabina, płot, właz i ognisko, na którym piecze się mięso. Moby nie przeskakują płotu ani zamkniętych drzwi.
* **Jaskinie** czasem kryją starą skrzynię z pochodniami, jedzeniem i rzadziej żelazem albo diamentem.
* **Nożyce** zbierają liście i wełnę z żywej owcy. Żwir czasem daje krzemień, a krzesiwo podpala TNT. Kompas wskazuje punkt odrodzenia, zegar porę dnia.
* **Osiągnięcia** za drewno, kilof, diament, sen, creepera, dom, łuk, strunę i inne pierwsze razy.
* **Linki do świata**: w pauzie przycisk *„Kopiuj link do świata”* zapisuje ziarno i tryb w adresie (`#seed=1234&mode=creative`) – po otwarciu takiego linku menu jest już wypełnione.
* **Pełny ekran** jednym przyciskiem (menu główne i pauza) oraz **usuwanie zapisu** z menu głównego.
* **Awaryjne komunikaty**: brak WebGL, błąd inicjalizacji czy zablokowany dźwięk nie zostawiają czarnej strony.
* **Tryb kreatywny**: latanie, natychmiastowe niszczenie, nieograniczone bloki i przedmioty, brak obrażeń i głodu.
* **Świat płaski** – przy tworzeniu świata wybierz typ *Płaski*: równa trawna równina na wysokości 64 z rudami pod spodem i kilkoma drzewami. Idealny do budowania i szybkiego kopania.

## 📁 Struktura projektu

```
index.html                 # szablon strony (meta, favicon, ekran ładowania)
public/
  menu-bg.jpg              # tło menu głównego
  .nojekyll                # dla GitHub Pages
src/
  main.tsx                 # start aplikacji + komunikat o braku WebGL
  App.tsx                  # menu ↔ gra, wczytywanie zapisu
  index.css                # styl w klimacie Minecrafta (Tailwind 4)
  components/
    Menus.tsx              # menu główne, pauza, ekran śmierci, czat
    GameView.tsx           # montowanie silnika, HUD, obsługa błędów
    HUD.tsx                # serca, głód powietrza, pasek, komunikaty, F3
    InventoryScreen.tsx    # ekwipunek i crafting
    TouchControls.tsx      # sterowanie dotykowe (telefony/tablety)
  game/
    engine.ts              # pętla gry, gracz, interakcje, zapis
    world.ts               # chunk'i, generator terenu, meshowanie
    blocks.ts              # definicje bloków
    textures.ts            # proceduralny atlas tekstur i ikony
    physics.ts             # kolizje i ruch
    mobs.ts                # moby i ich AI
    inventory.ts           # ekwipunek i receptury
    noise.ts               # szum Simplexa
    audio.ts               # dźwięki generowane przez Web Audio
.github/workflows/
  deploy-pages.yml         # automatyczna publikacja na GitHub Pages
.harness/                  # (poza gitem) headless testy silnika: node .harness/run.mjs
```

## 🧪 Testy (bez przeglądarki)

```bash
npm run typecheck   # tsc --noEmit
npm test            # headless testy silnika + test UI w jsdom
```

`.harness/smoke.ts` to kilkanaście tysięcy asercji na czysty silnik (generowanie świata, bloki, fizykę, ekwipunek, receptury, piece, moby, zapisy) – działa bez WebGL.
`.harness/ui.mjs` renderuje całe menu w `jsdom`, przechodzi tworzenie świata (w tym przełącznik typu świata) i sprawdza, że brak WebGL kończy się czytelnym komunikatem, a nie białą stroną. UI wymaga `npm i --no-save jsdom`; bez niego jest pomijany.

## 🛠️ Rozwiązywanie problemów

| Problem | Rozwiązanie |
| --- | --- |
| Czarny ekran i komunikat o WebGL | Włącz akcelerację sprzętową w przeglądarce (Chrome: `chrome://settings/system`, Firefox: `about:preferences#general`). |
| Brak tła w menu | Sprawdź, czy plik `menu-bg.jpg` został wgrany razem z `index.html` (build kopiuje go z `public/`). |
| Brak dźwięku | Gra działa bez dźwięku, jeśli przeglądarka blokuje Web Audio – kliknij w ekran gry, aby odblokować dźwięk. |
| „Kliknij, aby kontynuować” i brak reakcji na klawiaturę | Kliknij w ekran gry – przeglądarka musi ponownie przejąć blokadę kursora. |
| Zbyt wolno na słabym sprzęcie | Zmniejsz *Zasięg renderowania* w **Esc → Opcje**. |
| Chcę przenieść światy na inny komputer | Menu główne → *Eksport zapisów*, a na drugim urządzeniu *Import zapisów*. |

## 📜 Licencja

Kod gry: **MIT** – rób z nim, co chcesz.
Projekt inspirowany grą *Minecraft* (Mojang Studios); nie jest z nią powiązany i nie zawiera jej zasobów – wszystkie tekstury rysowane są proceduralnie w przeglądarce.
