# 4.24 — Piec we właściwą stronę

Kolejny konkretny audyt względem **Minecraft Java 1.20.4**: kierunki, dwa stany rozpalania, tekstury i UV pieca. Nie jest certyfikatem zgodności całej gry 1:1.

## Oryginalne źródła

Przypięte lustro: [InventivetalentDev/minecraft-assets, commit 90d256dfee7b6fd8014e1bc3b107e64a530c5f9b](https://github.com/InventivetalentDev/minecraft-assets/tree/90d256dfee7b6fd8014e1bc3b107e64a530c5f9b).

`scripts/sync-java-facing.py` odtwarza **11 plików / 3782 bajty**:

- `blockstates/furnace.json`: osiem kombinacji `facing` i `lit`, obroty north=0°, east=90°, south=180°, west=270°;
- modele `furnace`, `furnace_on`, `orientable`, `orientable_with_bottom`, `cube`: dziedziczenie tekstur, front na północy modelu i domyślne UV sześcianu;
- tabela łupu pieca;
- cztery oryginalne PNG 16×16: `furnace_front`, `furnace_front_on`, `furnace_side`, `furnace_top`.

Kopie i manifest SHA-256 są w `.harness/fixtures/java-facing-1.20.4/`. Grafika osadzona w `src/game/art/javaFacing.generated.ts` nie wymaga pobierania w trakcie gry. Pozostaje własnością Mojang/Microsoft, **nie jest MIT**; zobacz `public/Minecraft-NOTICE.txt`.

Modele i blockstates potwierdzają tekstury, geometrię i obroty, **nie kod wykonywania gry**. Reguła ustawiania frontem do gracza jest implementacją zachowania Java, testowaną niezależną macierzą kątów; nie wykonujemy oryginalnego serwera. Identyczne bajty atlasu i UV nie oznaczają identycznego końcowego obrazu całego świata: oświetlenie, shader i kamera pozostają implementacją projektu.

## Co poprawiono

| Obszar | Wcześniej | 4.24 |
|---|---|---|
| Ustawianie | Jeden front na południu | Cztery poziome kierunki, niezależne od pitch kamery |
| Rozpalanie/gaszenie | Tylko dwa ID, bez kierunku | Zachowanie tego samego frontu i obiektu zawartości |
| Tekstury | Wspólny atlas, bez gwarancji zgodności z 1.20.4 | Cztery dokładne oryginalne PNG, wgrywane po filtrach atlasu |
| Góra i spód | Ogólne UV sześcianu | Obrót i orientacja zgodne z modelem, również w geometrii przedmiotu |
| Kopanie i interakcje | Rozpoznawane tylko stare dwa ID | Wszystkie osiem stanów; właściwe narzędzie, zwykły piec jako drop/pick, także z Silk Touch |
| Zawartość i ochrona | Ścieżki ograniczone do dwóch ID | Otwieranie, gotowanie, wysypanie zawartości i ochrona miasta obejmują nowe kierunki |
| Creative i nazwy | Nie było wariantów kierunku | Jeden widoczny przedmiot; wewnętrzne warianty nie nadpisują aliasu `/give piec` |

## Zgodność zapisów

Nie przenumerowano istniejących bloków. Stare **28/53** pozostają południowymi stanami zgaszonym/rozpalonym. Dodano tylko **497–502**: północ, wschód i zachód w obu stanach. Przedmiot pieca nadal ma ID 28. Postęp, pozostałe ciepło i zawartość zachowują istniejący format.

Nie zmieniono SQL, protokołu multiplayer, praw działek/ulic ani publicznych danych. Test ochrony miasta wykonano lokalnie na rzeczywistych metodach silnika. **Nie testowano żywej sesji multiplayer ani publicznej bazy w tym wydaniu.** Nie przywrócono Zombies.

## Weryfikacja i reprodukcja

- **25 110 kontroli:** 599 kierunków/tekstur, 678 pieca, 5746 wcześniejszego audytu, 16 747 silnika, 436 ognia, 81 meshingu, 403 audio, 413 UI, 5 konta, 2 bootstrapu.
- `typecheck`, pełny zestaw testów i build przeszły na Node 22.22.3; pełny zestaw testów również na Node 20.20.2.
- Niezależny audyt sprawdza SHA/rozmiary źródeł, rozwiązuje dziedziczenie modeli i obroty, porównuje rzeczywiste UV meshera oraz Workera, bajty PNG/atlasu, narzędzia, kolizję, światło i Creative.
- Silnik: **280 dodatkowych kontroli**, m.in. 12 rzeczywistych ustawień (cztery yaw × trzy pitch), zużycie przedmiotu, otwieranie, zapłon i gaszenie bez utraty zawartości, kopanie, pick block, eksplozja i blokada zniszczeń w mieście, 64 kontrole UV modelu w ręce.
- Produkcyjny Chromium/SwiftShader: **desktop, viewport dotykowy 390×844, lokalny HTML**. W każdym: osiem rzeczywistych ustawień, otwieranie, zapłon, **4096 dokładnie zgodnych kanałów atlasu**, **32 736 zgodnych wartości atrybutów geometrii z rzeczywistego Workera**, zapis/odświeżenie wszystkich ośmiu stanów i zawartości; zero błędów konsoli.
- Zachowano wcześniejsze rzeczywiste kliknięcia/tapnięcia odbioru sztabki, dropy, GUI 2/Auto 0 i zapis. Symulacja pieca jest posuwana kontrolowanymi krokami, nie przez czekanie czasu zegarowego. Dodatkowo produkcyjne regresje ognia i meshingu na desktopie.
- Mobilny viewport nie jest fizycznym telefonem, a SwiftShader nie jest benchmarkiem sprzętowego FPS. Zrzuty ekranu są pomocnicze, nie stanowią automatycznego porównania pełnych kadrów z klientem Mojang.

```sh
npm ci
npm run typecheck && npm test && npm run build
npm run test:facing
# Opcjonalne narzędzia przeglądarkowe:
npm install --prefix .cache/browser-tools puppeteer-core @sparticuz/chromium
npm run preview -- --host 0.0.0.0 --port 4173
# Drugi terminal:
npm run test:browser:facing
BROWSER_CASES=desktop npm run test:browser:fire
BROWSER_CASES=desktop npm run test:browser:meshing
```

Artefakt lokalny: `dist/index.html`, **10562395 bajtów**, SHA-256 `1992e088c4eff25c0e72f22441a3f3c73542cb958e2163c57bcdb839b309231d`.

Raport maszynowy: [benchmarks/facing-4.24.json](benchmarks/facing-4.24.json).

## Pozostałe rozbieżności

Pełne XP pieca, hoppery, offline progress, wszystkie paliwa i tagi materiałów, pozostałe skróty craftingu oraz pełna grafika/świat/struktury Java nadal wymagają osobnych audytów. Generator wiosek nadal zawiera dekoracyjny rozpalony piec; nie porównano jego szablonów ze strukturami Java. Ta zmiana nie obiecuje identycznego PRNG Java ani pełnego serwera 20 TPS. Dotychczasowe ograniczenia z [4.23](FURNACE-4.23.md) pozostają, z wyjątkiem naprawionego tutaj kierunku i tekstur pieca.
