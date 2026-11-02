# 4.19.0 „Płynniejsze chunki” — Horizon i pierwsza przebudowa

Stan analizy: **2 listopada 2026**. To ulepszenie istniejącego klienta
TypeScript / Three.js / WebGL, nie port całej gry do Rust ani obietnica 500 FPS.
Nie instalowano i nie benchmarkowano natywnego Horizon w tym środowisku.

## Co to jest Horizon?

Chodzi o **[horizon-rust/horizon](https://github.com/horizon-rust/horizon)**,
nie o mod Distant Horizons ani inny projekt o podobnej nazwie. README opisuje
nieoficjalną reimplementację Minecraft Java 26.3 w Rust. Nie jest to mod
przyspieszający naszą stronę ani warstwa uruchamiająca wszystkie mody Java.
Wymaga własnej kopii gry i konta Microsoft posiadającego Java Edition;
oryginalne pliki `.jar` modów Java nie działają w nim bezpośrednio.
MIT dotyczy własnego kodu projektu, nie zasobów Mojang/Microsoft.

Źródła przypięto do rewizji
[`0b58feba0e723d5fd39fae8768b4204645d58595`](https://github.com/horizon-rust/horizon/tree/0b58feba0e723d5fd39fae8768b4204645d58595),
ponieważ projekt szybko się zmienia:

1. [README, wymagania i licencja](https://github.com/horizon-rust/horizon/blob/0b58feba0e723d5fd39fae8768b4204645d58595/README.md).
2. [Mesher i TerrainVertex](https://github.com/horizon-rust/horizon/blob/0b58feba0e723d5fd39fae8768b4204645d58595/crates/horizon-client-render/src/mesher.rs):
   wierzchołek terenu ma 24 bajty; pozycje pozostają float, UV/światło/kolor są
   pakowane. Ścieżka `mesh_reusing` ponownie wykorzystuje bufory i `MeshScratch`
   w workerach zamiast przydzielać wszystko dla każdej sekcji.
3. [Arena geometrii](https://github.com/horizon-rust/horizon/blob/0b58feba0e723d5fd39fae8768b4204645d58595/crates/horizon-client-render/src/gfx/arena.rs):
   sekcje współdzielą zakresy dużych buforów, a rysowanie wykorzystuje indirect
   multi-draw zamiast wiązać osobny zestaw buforów dla każdej sekcji.
4. [Culling](https://github.com/horizon-rust/horizon/blob/0b58feba0e723d5fd39fae8768b4204645d58595/crates/horizon-client-render/src/gfx/cull.rs):
   dwufazowy test zasłonięcia ogranicza niewidoczną geometrię nieprzezroczystą;
   szczegóły i koszty różnią się między Vulkan, Metal i sterownikami.

W praktyce: **mniej przesyłanych danych, mniej zbędnego rysowania, ponowne
używanie pamięci i rozłożenie budowania siatek na wątki**. Rust pomaga
kontrolować pamięć i współbieżność, ale sama zmiana języka nie gwarantuje FPS.
Nasz klient nie dostał w tym wydaniu workerów, multi-draw ani tego cullingu.
Inspiracją są zasady organizacji pracy; nie skopiowano implementacji Horizon.

## A co z „500 FPS na słabym komputerze”?

Nie znaleziono podstaw do takiej uniwersalnej gwarancji. Opublikowany
[benchmark Windows](https://github.com/horizon-rust/horizon/blob/0b58feba0e723d5fd39fae8768b4204645d58595/benchmarks/perf/windows-9800x3d-5080-2026-10-29.md)
dotyczy **Ryzen 7 9800X3D, RTX 5080, 94 GB RAM i 1280×720**, nie słabego
laptopa. W lesie przy RD16 podano 2424 ±138 FPS, ale 1% low to 709 ±165 FPS.
Przy RD32 nad oceanem Horizon osiągnął 1189 ±27 FPS i 155 ±9 1% low,
a vanilla odpowiednio 1223 ±33 i 236 ±17. Nie wygrywa w każdej scenie.
To wyniki autorów, nie nasze niezależne pomiary.

[Metodologia](https://github.com/horizon-rust/horizon/blob/0b58feba0e723d5fd39fae8768b4204645d58595/docs/benchmark.md)
kontroluje seed, trasę, rozdzielczość, zasięg, VSync i powtórzenia. Historyczne,
zamknięte [zgłoszenie #678](https://github.com/horizon-rust/horizon/issues/678)
pokazuje też, że licznik ponad 500 FPS może współistnieć z przycięciami.
Nie traktujemy go jako dowodu nadal niewyeliminowanego błędu.

500 FPS oznacza około **2 ms na całą klatkę**. Średnia ukrywa pojedyncze
opóźnienia. Dlatego mierzymy także długie klatki, a nie tylko średnie FPS.
Przeglądarkowy `requestAnimationFrame` jest zwykle synchronizowany z ekranem;
wybranie „bez limitu” nie odblokowuje automatycznie 500 prezentowanych klatek
na monitorze 60 Hz. Wyniki Node nie są wynikami renderowania WebGL.

## Co rzeczywiście przebudowano u nas

### Dane terenu bez pogarszania obrazu

- `aFace` i `aWave`: `Float32Array` → **`Uint8Array`**, bez normalizacji.
  Shader nadal dostaje te same wartości 0–5 i 0/1. Oszczędność **6 B/wierzchołek**.
- Pozycje, UV, kolory, światło, indeksy, topologia, AO i ruch wody bez zmian.
  Nie zmniejszono zasięgu ani liczby detali, aby poprawić wynik.
- Trzy bufory robocze są ponownie używane. Pozostaje maksymalnie **4 MiB na
  warstwę / 12 MiB razem**; większe jednorazowe bufory są zwalniane w `finally`.
  Gotowe geometrie dostają niezależne kopie, nie widoki na nadpisywany scratch.
- To **nie jest zero-allocation** ani dowód spadku całego RAM gry o 12,8%.
  Pula zachowuje część pamięci, a publikowanie geometrii nadal alokuje.

### Jedna kolejka pracy zamiast dwóch osobnych przydziałów

Edytowane i doczytywane chunki współdzielą limit liczby prób i czasu. Wcześniej
osobna faza edycji mogła przebudować do sześciu chunków niezależnie od limitu
streamingu. Teraz wyczerpanie wspólnego budżetu nie daje drugiej fazie kolejnego
przydziału. Zmiany blisko gracza mają pierwszeństwo przed odległymi edycjami.
Budżet uwzględnia wybrany limit FPS i istniejący automat jakości.

Przy błędzie meshera poprzednia geometria/podłoga pozostaje na ekranie,
a ponowna próba czeka 250 ms. Snapshot kolejki zapobiega ponawianiu tego samego
nieudanego zadania bez końca w jednej klatce. Usuwanie chunków i zmiana wymiaru
czyszczą wpisy retry. Praca daleko poza aktualnym widokiem może zaczekać,
ale nie gubi zmian danych świata.

**Ograniczenie:** cały chunk nadal budowany jest synchronicznie i atomowo.
Pierwsze zadanie może przekroczyć budżet — to zabezpieczenie przed zagłodzeniem
kolejki, nie twarda gwarancja czasu klatki. Nie wyeliminowano wszystkich przycięć.

### Uczciwe pomiary w F3

- Ostatnie **600** rzeczywistych odstępów między renderowanymi klatkami;
  p50/p95/p99/max w ms oraz 1% low = odwrotność średniego czasu najwolniejszego
  1% próbek. Przy małej liczbie próbek wynik jest orientacyjny.
- Sortowanie i kopia próbek tylko podczas odświeżania otwartego F3, nie co klatkę.
- FPS liczy rzeczywisty czas, nie czas przycięty do 100 ms na potrzeby fizyki.
  Zmiana widoczności karty resetuje pomiary i okno FPS, aby przerwa w tle nie
  udawała opóźnienia aktywnej gry.
- Licznik kreśleń obejmuje teraz **świat + ręce**. Poprzedni reset Three.js
  przed ostatnim przebiegiem sprawiał, że często widoczne były głównie ręce.
  Wyższa poprawiona liczba sama w sobie nie oznacza regresji renderera.
- Widać liczbę prób budowy oraz zmierzony czas / budżet. Wynik może uczciwie
  pokazać przekroczenie budżetu przez niepodzielny chunk.

## Wyniki, które da się sprawdzić

`npm run bench:meshing --silent` uruchamia wyłącznie CPU meshing, bez sieci
czy telemetrii. `BENCH_ITERATIONS=60` ustawia 60 budów/scenariusz; domyślnie 12,
zakres 2–100. Są 3 rozgrzewki, 3×3 wygenerowanych sąsiadów, stałe seedy,
scenariusze terenu, Netheru, płaskiego świata, modeli i chronionego miasta.

Bazą jest kod **4.18.0 / ce87f55f2a90ca324eaebaf168e44a86217aa7f2** z tym
samym nowym sterownikiem benchmarku. Bundle bazy utworzono przed zmianą silnika.
Pięć par uruchomiono kolejno, naprzemiennie AB/BA, po 60 budów/scenariusz;
bez równoległych przebiegów obu wersji. Node 22.22.3, Linux x64,
Intel Xeon 2,60 GHz, współdzielone środowisko wirtualne.

| Scenariusz | Geometria przed → po (B, z indeksami) | Mediana median CPU przed → po (ms) |
|---|---:|---:|
| Teren | 454 208 → 396 224 | 6,171 → 5,962 |
| Nether | 407 020 → 355 060 | 18,112 → 18,196 |
| Płaski | 127 464 → 111 192 | 2,821 → 2,690 |
| Modele | 94 564 → 82 492 | 3,577 → 3,412 |
| Miasto | 48 128 → 41 984 | 2,686 → 2,518 |

We wszystkich pięciu przypadkach **−12,77% bajtów geometrii z indeksami**.
Pięć semantycznych hashy pozostaje identycznych: wartości atrybutów i indeksów
są kanonizowane niezależnie od typu liczbowego. Stare hashe/liczby są zapisane
w `.harness/fixtures/meshing-4.18.json`.

**CPU: niewielkie i zmienne różnice, zakresy wyników nakładają się. Nether
praktycznie bez poprawy. Nie wykazano ogólnego wzrostu FPS.** Szczegółowe wyniki
każdego przebiegu, zakresy median i środowisko:
[`benchmarks/meshing-4.19.json`](benchmarks/meshing-4.19.json).

### Weryfikacja lokalna

- `npm run typecheck`, `npm test`, `npm run build`, `git diff --check`: PASS.
- **17 264 kontrole** = 16 458 silnika + 395 audio + 404 UI + 5 konta
  + 2 bootstrapu portalu. Testy parytetu geometrii, niezależności i limitu puli,
  priorytetu podłogi, wspólnego limitu, awarii/retry, percentyli, czasu w tle
  i obu przebiegów renderera.
- Produkcyjny build uruchomiony w Chromium/WebGL (SwiftShader), desktop
  960×600 i mobilny viewport 390×844. Renderowanie tych samych danych flag
  jako Uint8 i kontrolnie Float32 dało **identyczne piksele**: 1 049 760
  desktop i 599 114 mobile. Dotyczy kontrolowanej sceny z wodą, roślinnością,
  światłem i modelami; to nie dowód parytetu wszystkich możliwych scen.
- Natywne draw calls: desktop 24 świat + 1 ręce = 25, mobile 18 + 1 = 19.
  Faktyczny scheduler przestrzegał jednego ustawionego wspólnego zadania.
  Kontrolowana luka 500 ms została pokazana jako 2 FPS, bez ukrycia przez
  clamp fizyki. **To test regresji, nie pomiar osiągów urządzenia.**
- Zapis/odświeżenie przywraca podłogę, wodę i GUI 2 / zapisane Auto 0.
  Zero błędów konsoli. Mobilny viewport nie zastępuje fizycznego telefonu,
  a SwiftShader nie służy do porównania wydajności rzeczywistych kart GPU.

## Zgodność i następny sensowny etap

Bez zmian ID, formatów światów/ustawień, praw działek, ulic, protokołu
multiplayer czy migracji SQL. Survival, Creative, publiczne światy i dawne
klucze `blockcraft-*` pozostają. Zachowane oznaczenie nieoficjalnego projektu
i informacje o prawach do oryginalnych zasobów.

Największą dalszą zmianą architektury byłoby **przeniesienie meshingu do Web
Workera** oraz dzielenie pracy na sekcje. Wymaga to snapshotów danych i światła,
przesyłania buforów, odrzucania wyników starszych rewizji oraz pozostawiania
ostatniej prawidłowej podłogi do chwili publikacji nowej. Dopiero wtedy warto
porównywać JS z Rust/WASM na tym samym wejściu. Opcjonalny renderer WebGPU /
areny geometrii wymaga osobnego pomiaru i zachowania fallbacku WebGL; nie jest
częścią tej wersji. Sama zamiana języka nie rozwiązuje blokującej kolejki.
