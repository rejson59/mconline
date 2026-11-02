# 4.25 — Menu w ruchu

## Co zmieniono

Menu miało już sześć ścian panoramy, lecz obracało je bardzo wolno, w 15 klatkach/s, według absolutnego zegara strony. Bez WebGL pozostawało zdjęcie, a wczesna blokada w `main.tsx` nie pozwalała nawet otworzyć menu.

Teraz:

- rzeczywisty sześcian panoramy ma płynny obrót kamery: 2°/s lokalnego czasu animacji, pitch 10°, FOV 85°; pętla renderowania jest ograniczona do 30 klatek/s;
- dostępne są **wiśniowy gaj (Java 1.20), góry (1.18) i Nether (1.16)**, plus losowanie scenerii przy otwarciu menu;
- panel „Tło menu” zapisuje wybór i zatrzymanie ruchu w osobnym kluczu `minecraft-menu-panorama-v1`, nie zmieniając ustawień ani zapisów światów;
- opcje działają myszą, dotykiem i klawiaturą; Escape zamyka panel;
- systemowe `prefers-reduced-motion` jest respektowane również po zmianie w czasie działania;
- ukrycie dokumentu zatrzymuje pętlę; powrót nie nadrabia ukrytego czasu i nie powoduje skoku obrotu;
- rozdzielczość tła ma limit 1280×720 i mnożnik 0,75 bez mnożenia przez DPR; rozmiar i proporcje kamery aktualizuje ResizeObserver;
- pauza nie odtwarza renderera, zmiana sceny sprząta poprzedni, wyjście z menu zwalnia teksturę, kontekst, canvas i nasłuchy;
- utrata kontekstu pokazuje lekkie tło, a odzyskanie przywraca panoramę;
- bez WebGL działa samo menu z przesuwanym tłem CSS. **To fallback jednego obrazu, nie panorama 3D.** Wejście do świata nadal wymaga WebGL i korzysta z istniejącego komunikatu błędu GameView.

Ruch domyślnej scenerii i sześć ścian przybliżają charakter menu Minecrafta. **Wybór wielu teł jest zamówionym dodatkiem przeglądarkowym, a nie funkcją vanilla Java 1.20.4.** Dokładne wartości zegara, filtrowanie i renderer są implementacją projektu, nie wykonaniem kodu klienta Mojang ani obietnicą identycznych końcowych pikseli.

## Źródła i wielkość zasobów

Domyślna scena nadal korzysta z istniejącego pakietu sześciu ścian Java 1.20.4 (`javaGui.generated.ts`). Dwie dodatkowe scenerie pochodzą z oryginalnych zasobów Mojang/Microsoft w lustrze `InventivetalentDev/minecraft-assets`:

- [Java 1.18, commit 65c67a1ffd41640355d0aadb691567a821879b72](https://github.com/InventivetalentDev/minecraft-assets/tree/65c67a1ffd41640355d0aadb691567a821879b72);
- [Java 1.16, commit 1bca5976bce1c7c553762aecb04c29f41c7ba96e](https://github.com/InventivetalentDev/minecraft-assets/tree/1bca5976bce1c7c553762aecb04c29f41c7ba96e).

Każda ma sześć plików `assets/minecraft/textures/gui/title/background/panorama_0..5.png`. Manifest [menu-panoramas-manifest.json](menu-panoramas-manifest.json) przypina źródła i SHA-256 zarówno oryginałów, jak i osadzonych wyników.

**12 oryginalnych PNG: 9 578 260 bajtów.** Opcjonalne scenerie są jawnie zmniejszone z 1024×1024 do 512×512 i skompresowane WebP quality 90: **504 806 bajtów** przed base64. To nie identyczne bajty/piksele oryginalnych PNG. Kompresja nie dotyczy dotychczasowej sceny 1.20.4. Obrazy są osadzone w HTML, także offline; bez pobierania podczas gry, bez nowych zależności produkcyjnych. Materiały Mojang/Microsoft **nie są objęte MIT projektu**; atrybucja jest w `public/Minecraft-NOTICE.txt`.

## Weryfikacja

- `typecheck`, pełny `npm test`, produkcyjny build i `git diff --check`.
- **25 271 kontroli** na Node 22.22.3: 161 nowych panoramy/preferencji/aktywnych elementów menu i 25 110 wcześniejszych. Testy obejmują walidację/uszkodzenie/brak pamięci lokalnej, izolację klucza, losowanie, kąty, limity rozdzielczości, sześć niezależnych ścian, format i SHA-256 osadzonych WebP.
- Produkcyjny Chromium/SwiftShader: **desktop, viewport dotykowy 390×844, lokalny HTML oraz wymuszony brak kontekstu WebGL**. W czterech przypadkach rzeczywiste zrzuty tła mają różne piksele podczas ruchu i identyczne po zatrzymaniu; nie mierzymy tylko zmiany stylu lub licznika.
- Rzeczywiste przełączenie scen, zapis/odświeżenie, zatrzymanie rysowania, żywa zmiana systemowego ograniczenia ruchu, syntetyczne zdarzenie ukrycia dokumentu, powrót z wyboru światów i brak pracy renderera po odmontowaniu.
- W trzech przypadkach 3D wymuszono rzeczywistą utratę/odtworzenie kontekstu przez `WEBGL_lose_context`; po powrocie jest dokładnie jeden canvas.
- Desktop dodatkowo: otwieranie klawiaturą/Escape i zmiana rozmiaru do 1920×1080 z limitem canvasa 1280×720.
- Zero błędów konsoli i zewnętrznych żądań sieciowych w tych scenariuszach. Dodatkowa desktopowa regresja poprzedniego wydania: piec/GUI, atlas, Worker i zapis/odświeżenie.
- Zrzuty desktopu i mobilnego viewportu obejrzano. Mobilny viewport nie jest fizycznym telefonem, SwiftShader nie jest pomiarem sprzętowego FPS. Zmiana pikseli potwierdza ruch, **nie** pełną zgodność obrazu z oryginalnym klientem.

Test wykrył problem ciężkiego fallbacku CSS (animowana transformacja z filtrem) w renderowaniu programowym. Fallback używa teraz animacji pozycji tła, bez filtra i bez transformowanej warstwy GPU; cały czterowariantowy test przeszedł po tej poprawce.

Raport: [benchmarks/panorama-4.25.json](benchmarks/panorama-4.25.json). Zrzuty pomocnicze i bieżący raport są generowane do ignorowanego `.cache/verification425/`.

```sh
npm ci
npm run typecheck && npm test && npm run build
npm run test:panorama
npm install --prefix .cache/browser-tools puppeteer-core @sparticuz/chromium
npm run preview -- --host 0.0.0.0 --port 4173
# Drugi terminal:
npm run test:browser:panorama
BROWSER_CASES=desktop npm run test:browser:facing
# Opcjonalne odtworzenie dodatkowych grafik:
python3 -m pip install --target .cache/python-tools Pillow==11.3.0
PYTHONPATH=.cache/python-tools python3 scripts/compile-menu-panoramas.py
```

Artefakt lokalny: `dist/index.html`, **11242582 bajtów**, SHA-256 `0df3c588717033e21802f7867fca66a66c07256587f56a9718e9df26533900c5`.

## Granice tego wydania

Nie zmieniono mechanik świata, SQL, protokołu, praw miasta ani publicznych danych; nie wykonywano żywej sesji multiplayer. Nadal pozostają wcześniejsze rozbieżności dotyczące XP pieca, pełnych receptur/tagów materiałów, struktur i pozostałych mechanik. To kolejne ulepszenie menu, **nie deklaracja zgodności całej gry 1:1**.
