# 4.20.0 „Chunki w tle”

Kolejny etap po [analizie Horizon i 4.19](PERFORMANCE-4.19.md), 2 listopada
2026. **Meshing działa w prawdziwym Web Workerze**, nie w `setTimeout`
na tym samym wątku. Pozostaje JavaScript/Three.js/WebGL; nie przepisano całej
gry do Rust i nie obiecujemy 500 FPS.

## Jak działa nowa ścieżka

1. Początkowe 3×3 siatki wokół punktu wejścia powstają jak wcześniej,
   synchronicznie. Gracz dostaje pobliski teren przed uruchomieniem pętli gry.
2. Późniejsze doczytywanie i przebudowy używają **jednego Workera i najwyżej
   jednego zadania w locie**. Pozostała praca zostaje w istniejącej kolejce
   świata — bez kopiowania nieograniczonej liczby snapshotów i bez tworzenia
   tylu workerów, ile przeglądarka zgłosi rdzeni.
3. Snapshot obejmuje dane 3×3 chunków, wysokości, źródła światła, `maxY`,
   informację o Netherze i ukryte wieka skrzyń. **Kopiowane są dane**, nigdy
   nie jest transferowany żywy bufor świata. Kolizje, fizyka, zapis i sieć
   nadal mają własne, nieodłączone tablice.
4. Worker korzysta z **tego samego meshera**. Nie generuje brakującego terenu,
   nie symuluje wody, nie zapisuje świata ani nie wykonuje połączeń sieciowych.
   Niepełny snapshot to błąd, a nie zgoda na wymyślenie brakujących sąsiadów.
5. Atrybuty i indeksy wracają jako transferowane `ArrayBuffer`. Worker liczy
   również sfery ograniczające geometrię, żeby nie skanować ponownie pozycji
   na głównym wątku przy pierwszym sprawdzaniu frustum.
6. Przed przyjęciem wyniku sprawdzane są **tożsamość i rewizje wszystkich
   dziewięciu chunków** oraz stan wiek. Zmiana bloku, sąsiedniego światła,
   otwarcie skrzyni lub wyładowanie/ponowne utworzenie chunka unieważnia stary
   wynik. Taki wynik nie usuwa poprzedniej podłogi i nie kasuje edycji.
7. Dopiero kompletna zaakceptowana geometria zastępuje poprzednią. Światło
   skrzyń wraca razem z wynikiem, więc animowane wieka nadal korzystają
   z oświetlenia korpusu. Publikacja i rysowanie GPU pozostają na wątku gry.

`Chunk` może teraz otrzymać istniejące bufory przy konstrukcji. Worker nie
alokuje pustych dziewięciu tablic tylko po to, żeby natychmiast zastąpić je
odebranymi danymi. Domyślne tworzenie chunków w grze pozostaje bez zmian.

## Bezpieczeństwo i ścieżki zapasowe

- **Nieaktualny wynik:** odrzucenie i ponowne zakolejkowanie, nigdy cofnięcie
  nowszych bloków. To celowo konserwatywna walidacja całego otoczenia.
- **Ciągłe edycje/przepływ wody:** po trzech kolejnych odrzuceniach danego
  chunka następna próba jest synchroniczną naprawą. Inaczej szybko zmieniający
  się teren mógłby nigdy nie doczekać się aktualnego obrazu.
- **Brak podłogi po teleporcie/szybkim locie:** zadanie w tle jest anulowane,
  a chunk pod graczem dostaje priorytetową synchroniczną budowę. Wspólny budżet
  z 4.19 liczy tę próbę. Poprawny teren jest ważniejszy niż unikanie każdego
  synchronicznego zadania.
- **Brak obsługi, blokada, błąd konstruktora/postMessage/Workera lub dekodowania:**
  tryb zapasowy do końca tej sesji gry. Watchdog bez odpowiedzi po około 8 s
  również wyłącza Workera; opóźnienie timera zależy od przeglądarki.
- **Zmiana wymiaru:** anulowanie, zakończenie starego Workera i zachowanie
  jego niezrealizowanej edycji w starym świecie. Spóźniona wiadomość nie może
  opublikować geometrii w nowym wymiarze ani zepsuć jego nowego zadania.
- **Wyjście z gry:** usunięcie handlerów, timera i zakończenie Workera.
- **Błąd publikacji/generowania w ścieżce budowy:** poprzednia siatka pozostaje,
  a wspólny mechanizm retry chroni przed nieustannym ponawianiem w jednej klatce.

Nie wymaga to `SharedArrayBuffer`, cross-origin isolation, konta ani serwera
obliczeniowego. Vite osadza kod Workera w HTML (`?worker&inline`), więc nie
pojawia się osobny wymagany plik z błędną ścieżką na GitHub Pages. Sprawdzono
również otwieranie produkcyjnego HTML z `file://` w testowym Chromium.

## F3: praca nie zniknęła, zmieniła wątek

Nowe informacje pokazują tryb gotowy/pracujący/zapasowy, liczbę przyjętych
wyników i odrzuconych nieaktualnych odpowiedzi oraz:

- **snapshot:** generowanie potrzebnych sąsiadów i kopiowanie danych na wątku gry;
- **worker:** przygotowanie i obliczenia po stronie Workera, w tym bounds;
- **razem:** czas od gotowego snapshotu do przyjęcia wyniku, z wysłaniem,
  oczekiwaniem, dostarczeniem i publikacją. Nie zawiera wcześniejszego snapshotu.

Wiersz budżetu chunków jest teraz jawnie opisany jako **wątek gry**.
Krótki czas wysłania nie oznacza, że cały chunk powstał w tym czasie.

## Ograniczenia i koszty

To nie jest całkowicie nieblokujący silnik. Generowanie terenu/sąsiadów,
kopiowanie, publikacja geometrii, przesyłanie jej do GPU, początkowe siatki,
naprawy po serii odrzuceń i awaryjna podłoga nadal mogą blokować. Pojedyncze
zadanie w trybie zapasowym może przekroczyć budżet. Czas oczekiwania na nową
siatkę może być dłuższy niż sama synchroniczna budowa.

Snapshot danych i wysokości to około **0,57 MiB**, plus emitery i metadane.
Osobny Worker ma własny limit 12 MiB zachowywanego scratch, oprócz puli wątku
gry. Zatem **nie deklarujemy spadku całkowitego RAM**. Duża pojedyncza geometria
nadal może kosztować dużo pamięci i czasu. Brak dodatkowych zależności gry.

Produkcyjny HTML: 4.19 **10 283 382 B**, testowany 4.20 **10 483 752 B**,
około **+1,95%** nieskompresowanego rozmiaru. Bazę zbudowano z archiwum
`7a21b289d9b10cc4426f5650e3ded35214ce5efc`, na tych samych zależnościach,
bez przełączania gałęzi. Drobne kolejne zmiany dokumentacji nie wpływają na HTML.

## Weryfikacja

- Typecheck, testy, build i `git diff --check`: PASS.
- **17 347 kontroli**: 81 nowej ścieżki meshingu + 16 458 silnika + 395 audio
  + 406 UI + 5 konta + 2 bootstrapu portalu.
- Pięć scenariuszy: teren, Nether, płaski świat, modele i chronione miasto.
  Dokładna zgodność wartości geometrii, typów, bajtów, indeksów i sfer frustum
  między ścieżką synchroniczną i transportem Workera. Nadal przechodzą oryginalne
  hashe geometrii sprzed optymalizacji 4.19.
- Testy rzeczywistego transferu kopii przez `structuredClone`, edycji w locie,
  światła sąsiadów, podwójnych skrzyń na granicy chunków, wiek bez rewizji bloku,
  wyładowania i ponownego utworzenia, anulowania, timeoutu, błędów, kolejki,
  publikacji, postępu ładowania i awaryjnej podłogi po teleporcie.
- Prawdziwy Chromium/WebGL/Worker: desktop 960×600, mobilny viewport 390×844,
  świat normalny oraz lokalny HTML. W kontrolnych renderach **zero różnic pikseli**
  względem synchronicznej geometrii: 1 049 760 pikseli desktop i 599 114 mobile.
  Sprawdzone odrzucanie odpowiedzi po edycji i przerwanie odległego zadania,
  gdy po teleporcie potrzebna jest podłoga.
- Symulowany niedostępny konstruktor Workera: świat ładuje się i działa
  synchronicznie. Zapis/odświeżenie zachowuje podłogę, wodę i GUI 2 / Auto 0.
  Wyjście usuwa Workera; zero błędów konsoli. Nie wykonywano zmian chmurowej bazy.

### Obserwacja czasu blokowania — nie benchmark FPS

W zamrożonej pętli gry, po rozgrzaniu jednej stałej sceny, wywoływano kolejno
synchroniczną budowę i asynchroniczne zlecenie na tych samych danych. Siedem par,
stała kolejność sync→async, bez losowania. Środowisko wirtualne, Chromium 153 /
SwiftShader; mobilny viewport **nie jest pomiarem fizycznego telefonu**.

| Uruchomienie | Mediana blokującej budowy | Mediana blokującego wysłania | Mediana czasu do gotowego wyniku |
|---|---:|---:|---:|
| Desktop | 5,2 ms | 0,7 ms | 9,0 ms |
| Mobilny viewport | 6,3 ms | 0,8 ms | 18,0 ms |
| Powtórzenie desktop | 10,3 ms | 0,8 ms | 14,8 ms |

**Praca nie stała się darmowa.** Wysyłanie miało też próbki 5,9–9,9 ms,
zakresy nakładają się, a oczekiwanie potrafiło być dłuższe od synchronicznej
budowy. To mała obserwacja działania mechanizmu, nie wiarygodny pomiar wzrostu
FPS ani gwarancja opóźnień na urządzeniach graczy. Surowe wyniki obu przebiegów,
parytet obrazu i awaryjna podłoga:
[`benchmarks/meshing-worker-4.20.json`](benchmarks/meshing-worker-4.20.json).

### Powtórzenie testów

```sh
npm ci
npm run typecheck
npm run test:meshing
npm test
npm run build
```

Opcjonalny test prawdziwej przeglądarki w Linux x64, narzędzia poza zależnościami
gry i cache poza Git. Wykorzystuje nowy, tymczasowy profil przeglądarki, nie
codzienny profil użytkownika. Nie dołącza do publicznego multiplayera.

```sh
npm install --prefix .cache/browser-tools puppeteer-core@25.16.0 @sparticuz/chromium@153.0.0
# Osobny terminal: npm run preview -- --host 0.0.0.0 --port 4173
npm run test:browser:meshing
```

`BROWSER_TOOLS` wskazuje inny katalog narzędzi, `BROWSER_URL` inny adres preview,
`BROWSER_CASES=desktop` ogranicza zestaw. Wyniki i zrzuty trafiają do ignorowanego
`.cache/verification420`. Zwykłe CI wykonuje deterministyczną nową suitę bez
pobierania Chromium; test przeglądarkowy wykonano osobno na produkcyjnym buildzie.

## Zgodność

Bez migracji SQL, zmian protokołu, ID, formatów zapisu i ustawień. Zachowane
survival, Creative, publiczne światy, prawa działek i chronionych ulic,
GUI domyślnie 2 i zapisane Auto 0. Bez dodawania treści usuniętego trybu Zombies.
Pozostają oznaczenia nieoficjalnego projektu i prawa do zasobów Minecrafta.
Następny większy etap to odciążenie również generowania i sekcjonowanie pracy,
nie obietnica, że sam Worker albo Rust/WASM rozwiązuje każde ograniczenie.
