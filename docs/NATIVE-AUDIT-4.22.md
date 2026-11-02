# 4.22 — pierwszy audyt porównawczy danych Java

## Metoda zamiast zgadywania

Punktem odniesienia jest **Minecraft Java 1.20.4**, nie Bedrock ani inna wersja Java. Oryginalny klient JVM i nasza gra TypeScript/Three.js nie mają porównywalnej struktury plików. Wspólnym, sensownym punktem odniesienia są natomiast oryginalne JSON-y receptur i tabel łupu.

W `.harness/fixtures/java-1.20.4/` przypięto **31 oryginalnych plików, 19 750 bajtów**: 20 receptur i 11 tabel łupu. Manifest zapisuje ścieżki, długości i SHA-256. Źródło:

https://github.com/InventivetalentDev/minecraft-assets/tree/90d256dfee7b6fd8014e1bc3b107e64a530c5f9b/data/minecraft

Nie pobieramy ich w czasie gry ani podczas zwykłego CI. Odświeżanie wymaga jawnego uruchomienia `python3 scripts/sync-java-audit.py` i uwierzytelnionego `gh`; cache jest rozdzielony po pełnym SHA źródła. Nie zmieniono zależności gry. Oryginalne dane są opisane osobno od kodu MIT w `public/Minecraft-NOTICE.txt`.

### Co robi test

`npm run test:native` uruchamia mały, niezależny interpreter wybranego podzbioru JSON, **nieużywany przez grę**. Nie importuje produkcyjnych funkcji liczenia bonusu ani receptur do obliczania oczekiwanego wyniku. Produkcyjne `Inventory` i `blockDrops()` są stroną porównywaną.

- Weryfikuje integralność plików względem manifestu.
- Generuje siatki na podstawie oryginalnego wzoru: oba odbicia, dozwolone przesunięcia, 2×2/3×3, wynik, ilości i pobranie jednej sztuki z każdej użytej kratki.
- Sprawdza położenie składników przez książkę receptur, brak przedwczesnego wydawania produktu i rzeczywiste wytworzenie wyniku. Odrzuca wybrane złe układy i usunięte, wymyślone skróty materiałowe.
- Interpretuje wybrane warunki i funkcje loot-table: Silk Touch, `table_bonus`, `set_count`, `ore_drops`, `uniform_bonus_count`, `limit_count`. Nieznane operacje powodują błąd zamiast domyślnego zaliczenia.
- Dla 10 tabel porównuje zwykły drop / Silk Touch i Fortune 0–III przy kontrolowanych kwantylach losowania, w tym progach szans krzemienia. Nie porównuje bitowej sekwencji generatora Java z `Math.random()`.
- Sprawdza też zachowanie nieprawidłowego Fortune oraz zachowanie dziewięciu kulek szlamu w cyklu kompresja → rozbicie → dekompresja.

**5 746 takich samych kontroli:** na historycznym kodzie 4.21 występuje **1 041 niezgodnych przypadków**, po poprawkach **0**. To liczba scenariuszy, nie 1 041 niezależnych błędów. Różne warianty tego samego błędu mogą nie przejść wielu kontroli.

Historyczny wynik jest powtarzalny bez przełączania brancha, checkoutu ani nadpisywania plików roboczych:

```sh
# Ten przebieg ma zakończyć się niepowodzeniem: uruchamia testy przeciw błędnemu kodowi 4.21.
AUDIT_REPORT=/tmp/native-before.json node scripts/audit-native-baseline.mjs ef50fb4bc8ef8b991fd4cb9a10514795f10f4f9a
# Aktualna implementacja powinna przejść:
AUDIT_REPORT=/tmp/native-after.json npm run test:native
```

Skrypt zastępuje podczas bundlowania tylko historyczne moduły `inventory.ts` i `items.ts`, przez odczyt `git show`. Pozostałe moduły/identyfikatory w tym porównaniu nie zostały zmienione. To nie uruchomienie całego oryginalnego klienta Minecraft.

## Naprawione rozbieżności

| Obszar | Było | Jest / oryginalny punkt odniesienia |
|---|---|---|
| TNT | Dodatkowa receptura z węgla; brak wymaganego układu | 5 prochów + 4 piaski, układ szachownicy; `recipes/tnt.json` |
| Kompas | Węgiel zamiast redstone; dowolny układ | 4 żelaza wokół redstone; `compass.json` |
| Zegar | Węgiel zamiast redstone; dowolny układ | 4 złota wokół redstone; `clock.json` |
| Ognisko | 3 patyki + węgiel, bez drewna | 3 patyki + węgiel + 3 pnie, wzór 3×3; `campfire.json` (kanoniczny podzbiór: dąb/węgiel) |
| Papier | Bezkształtny w 2×2 | 3 trzciny w poziomie, stół; `paper.json` |
| Chleb | Bezkształtny w 2×2 | 3 pszenice w poziomie, stół; `bread.json` |
| Wiadro | Dowolne 3 żelaza | Wzór V; `bucket.json` |
| Strzały | Bezkształtne w 2×2 | Krzemień / patyk / pióro w pionie, stół; `arrow.json` |
| Nożyce | Bezkształtne, tylko stół | Dwa żelaza po przekątnej, także 2×2; `shears.json` |
| Biblioteczka | Dodatkowa receptura z wełną | Usunięta; pozostają deski i 3 książki; `bookshelf.json` |
| Blok plastra miodu | Wzór 2×2 wymagał stołu | Da się wykonać w osobistym 2×2; `honeycomb_block.json` |
| Receptury kształtne | Tylko jedna orientacja | Dopuszczone odbicie poziome, ale nie obrót o 90°; m.in. siekiera, motyka, łuk, schody |
| Blok szlamu | Po rozbiciu 1 kulka, utrata wartości 8 kulek | Wypada cały blok; `loot_tables/blocks/slime_block.json` |
| Blok plastra miodu | Po rozbiciu 4 plastry | Wypada cały blok; `honeycomb_block.json` |
| Żwir | Stale 10% krzemienia, ignorowane Fortune | 10% / 14,285715% / 25% / 100%, Silk Touch zachowuje żwir |
| Ruda węgla, diamentu, szmaragdu, kwarcu | Niepoprawne mnożniki lub brak wzrostu na Fortune I | `ore_drops`: na Fortune I mnożniki 1, 1, 2; dalej właściwy wzrost do 4 na III |
| Lapis | Podstawa 4–7 i dodawany bonus | Podstawa 4–9 pomnożona przez bonus rudy |
| Jasnogłaz | Możliwe więcej niż 4 pyły | Podstawa 2–4 + bonus, limit 4 |

Receptury kontrolne, które już były poprawne, również pozostają w macierzy, m.in. stół, piec, pochodnie, patyki, łuk i schody oraz łup rudy redstone (4–5 + bonus Fortune). Dotychczasowe przedmioty, budowle, ustawienia i zapisy **nie są usuwane ani konwertowane**. Poprawki receptur dotyczą nowych czynności. Nie zmieniono ID, protokołu, SQL, zasad miasta, mechaniki ognia ani Workera.

## Jawne granice i następne zadania

Ten audyt nie oznacza, że cała gra jest zgodna 1:1.

1. **Tagi materiałów mają profil kanoniczny:** dębowe deski/pnie, zwykły węgiel, piasek i bruk. Nie testujemy wszystkich rozwinięć tagów Java. W szczególności ognisko nie obsługuje jeszcze pełnej mieszanki różnych pni ani węgla drzewnego; piec nie wszystkich alternatywnych kamieni.
2. **Tabela łupu ogniska została znaleziona, ale nie wdrożona:** Java bez Silk Touch daje 2 węgle drzewne. Gra nie ma jeszcze tego odrębnego przedmiotu. Zachowano dotychczasowy drop ogniska; plik jest punktem wyjścia do osobnej poprawki obejmującej item, ikonę, paliwo i receptury.
3. **Inne receptury pozostają poza tą próbką.** Nadal istnieją wcześniejsze uproszczenia, m.in. niektóre skróty przetapiania w craftingu i uproszczone materiały. Nie usuwamy całej ekonomii jednym niezweryfikowanym przepisaniem.
4. **Łup:** test używa odpowiedniego diamentowego kilofa. Wymagania narzędzi są sprawdzane przez istniejące testy silnika, nie przez te JSON-y. Wyłączono eksplozje, wszystkie inne bloki, doświadczenie, pełne tagi i specyficzny generator losowy Java.
5. **Piece i postęp:** czasy przetapiania oraz brak surowego żelaza/złota to osobne, nadal istniejące rozbieżności; nie zmieniono ich w tym wydaniu.
6. Nie porównano kodu całej gry, fizyki, wszystkich modeli, stanów bloków ani multiplayera z oryginalnym serwerem. Nie wykonywano zmian ani prób na publicznej bazie/graczach.

## Weryfikacja wydania

- **23 532 kontrole:** 5 746 referencyjnych, 16 453 silnika, 436 ognia, 81 Workera, 403 dźwięku, 406 UI, 5 konta, 2 bootstrapu.
- `npm run typecheck`, `npm test`, `npm run build`, `git diff --check` — PASS.
- Produkcyjny Chromium/SwiftShader: desktop 960×600, dotykowy viewport 390×844 i lokalny HTML. Książka receptur układa natywny kompas, rzeczywiste kliknięcie/tapnięcie wyniku pobiera składniki raz, zużywa redstone i żelazo, a zostawia zapas węgla. Zamknięcie okna zwraca kompas do ekwipunku, zapis/odświeżenie zachowuje ilości oraz GUI 2/Auto 0.
- Rzeczywiste `Game.breakBlock()` w produkcyjnym kliencie tworzy poprawne encje dropu bloku szlamu i plastra miodu. Zero błędów konsoli.
- Dodatkowa regresja zapłonu i Workera została wykonana osobno na desktopie. To testy sandboxa VM, nie fizycznego telefonu ani oryginalnego klienta Java; nie są pomiarem FPS.

Artefakt `dist/index.html`: **10 554 600 bajtów**, SHA-256 `7978128c33ea6c9f14d8de0113fd33be363aa028516acc3299e3f655f13c7a4d`.

Raporty: [`benchmarks/native-audit-4.22.json`](benchmarks/native-audit-4.22.json). Większe zrzuty i narzędzia są w ignorowanym `.cache/`.

```sh
npm ci
npm run typecheck && npm test && npm run build
# Opcjonalny test przeglądarkowy, Linux x64, odrębny lokalny profil:
npm install --prefix .cache/browser-tools puppeteer-core @sparticuz/chromium
npm run preview -- --host 0.0.0.0 --port 4173
# Drugi terminal:
npm run test:browser:native
```
