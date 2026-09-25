# BlockCraft 🟩

Gra sandboxowa w stylu **Minecraft** działająca w całości w przeglądarce – bez instalacji, bez serwera i bez pobierania assetów z sieci.
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
/tp <x> <y> <z>            teleportacja
/give <id> [ilość]         np. /give 3 64
/summon <pig|sheep|zombie>
/kill  /seed  /spawn  /clear  /blocks
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
* **43 rodzaje bloków** (od trawy, przez rudy i wełny, po TNT i obsydian) z proceduralnie rysowaną teksturą 16×16 px – atlas + ikony 3D do ekwipunku.
* **20 receptur** wytwarzania (deski, stół, piec, szkło, cegły, TNT, wełna, obsydian…), część wymaga stołu rzemieślniczego.
* **Moby**: świnie, owce, zombie (atakują w nocy, palą się w dzień), AI chodzenia, skoków i unikania wody.
* **Fizyka**: kolizje AABB, grawitacja, obrażenia od upadku, pływanie i tonięcie, lawa, kaktusy, wybuchy TNT z odrzutem.
* **Świat i cykl dnia**: 10-minutowa doba, wschody i zachody słońca, gwiazdy, chmury, mgła pod wodą i w lawie.
* **Zapis gry** w `localStorage` (modyfikacje bloków, pozycja, ekwipunek, czas) + autozapis co 30 s, przy zamykaniu karty i przy chowaniu karty.
* **Linki do świata**: w pauzie przycisk *„Kopiuj link do świata”* zapisuje ziarno i tryb w adresie (`#seed=1234&mode=creative`) – po otwarciu takiego linku menu jest już wypełnione.
* **Pełny ekran** jednym przyciskiem (menu główne i pauza) oraz **usuwanie zapisu** z menu głównego.
* **Awaryjne komunikaty**: brak WebGL, błąd inicjalizacji czy zablokowany dźwięk nie zostawiają czarnej strony.
* **Tryb kreatywny**: latanie, natychmiastowe niszczenie, nieograniczone bloki, brak obrażeń.

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
```

## 🛠️ Rozwiązywanie problemów

| Problem | Rozwiązanie |
| --- | --- |
| Czarny ekran i komunikat o WebGL | Włącz akcelerację sprzętową w przeglądarce (Chrome: `chrome://settings/system`, Firefox: `about:preferences#general`). |
| Brak tła w menu | Sprawdź, czy plik `menu-bg.jpg` został wgrany razem z `index.html` (build kopiuje go z `public/`). |
| Brak dźwięku | Gra działa bez dźwięku, jeśli przeglądarka blokuje Web Audio – kliknij w ekran gry, aby odblokować dźwięk. |
| „Kliknij, aby kontynuować” i brak reakcji na klawiaturę | Kliknij w ekran gry – przeglądarka musi ponownie przejąć blokadę kursora. |
| Zbyt wolno na słabym sprzęcie | Zmniejsz *Zasięg renderowania* w **Esc → Opcje**. |

## 📜 Licencja

Kod gry: **MIT** – rób z nim, co chcesz.
Projekt inspirowany grą *Minecraft* (Mojang Studios); nie jest z nią powiązany i nie zawiera jej zasobów – wszystkie tekstury rysowane są proceduralnie w przeglądarce.
