# Narzędzia, łóżka i światło — 4.30.0 (2026-11-06)

Audyt dziewięciu nowych zgłoszeń. Punktem odniesienia jest **Minecraft Java Edition 1.20.4**, nie Bedrock ani dowolna najnowsza wersja. To wydanie poprawia konkretne mechanizmy; **nie zamyka wszystkich dziewięciu zgłoszeń ani nie deklaruje pełnej zgodności 1:1**. Wcześniejsze poprawki 4.29.0 zachowano i objęto regresją.

## Status wszystkich zgłoszeń

| ID | Wynik analizy i zmiana | Status po 4.30.0 |
|---|---|---|
| `c04fce61-5a1d-4c22-8f1e-9f6caec9b8a2` | Brakowało złotych narzędzi. Dodano kilof, siekierę, łopatę, miecz i motykę, natywne ikony oraz receptury. Trwałość 32, prędkość dopasowanego narzędzia 12, poziom zbioru złotego kilofa jak drewnianego. | **Naprawiony brak craftingu**. Nie jest to audyt wszystkich zasad walki, napraw i zaklinania złota. |
| `9a8e246f-ab93-407b-a21c-db41ef3851b3` | „Realistyczniejsza woda” to sugestia bez jednoznacznego wzorca akceptacji. Zmniejszono amplitudę fal, połączono dwie składowe i użyto współrzędnych świata, aby faza nie zaczynała się od nowa na granicach chunków. Dodano subtelne przybliżenie odbicia nieba zależne od kąta patrzenia. | **Zrealizowana poprawka wizualna**, nie nowa fizyka wody ani pełny system odbić. |
| `da6c1fb5-ca34-474e-9963-aa1e7a0d12f6` | Pozycja chmur była iloczynem całego czasu działania i zmiennego mnożnika pogody. Zmiana pogody dawała skok narastający z czasem sesji. Teraz integrowana jest prędkość; pojedynczy krok ograniczono do 250 ms. | **Naprawiona ustalona przyczyna**. Testy obejmują zmianę pogody, FPS i przerwę w animacji. |
| `73a27930-3d26-4a6f-af0f-70eed595b402` | W kodzie nie ma kompletnej łódki. Sama ikona lub receptura nie zapewni pasażerów, wsiadania/wysiadania, kolizji, pływalności, niszczenia, trwałości zapisu ani synchronizacji multiplayer. | **Otwarte — nie zaimplementowano łódek.** Natywna receptura jest wyłącznie materiałem referencyjnym i nie jest rejestrowana w grze. |
| `35038f9f-ece0-458f-83f7-33eaa482758c` | Dodano niezależny korpus 24 natywnych receptur: złoto/bryłki, lorneta, latarnia, wędka, kamienne cegły, piaskowiec, biała wełna, dźwignia, obserwator, czerwone łóżko, cegły, wybrane barwniki i miód. Zastąpiono wybrane błędne przepisy, usunięto część zmyślonych skrótów. | **Częściowe.** Nie przeaudytowano całego katalogu Java, wszystkich tagów i wariantów. Nowa miedź i ametyst nie mają kompletnej ścieżki pozyskania w survivalu. |
| `67066485-8a4d-4b5d-9d09-40b4fbf00968` | Oddzielono wymiary małych bloków od pełnego sześcianu; poprawiono wycinki ikon m.in. pochodni. Sprite'y przedmiotów w ręce i jako drop mają bryłę o grubości 1/16 zamiast samej płaszczyzny. Łóżko ma osobny model. | **Poprawione wskazane ścieżki renderowania.** Nie zweryfikowano wizualnie każdego przedmiotu; zdalna reprezentacja trzymanego przedmiotu nadal jest uproszczona. |
| `008b340b-3bb2-407e-b5c5-f878f9f132b9` | Sąsiad łóżka był ustalany po skasowaniu klikniętej połówki. Para jest teraz ustalana wcześniej i sprawdzana pod kątem kierunku oraz uprawnień. Usuwane są obie połówki, powstaje jeden drop. Poprawiono również usuwanie po utracie podparcia. Ikona/ręka/drop przedstawiają całe łóżko: dwa materace i cztery nogi. | **Naprawiona odtworzona lokalna duplikacja i ikona**. Równoczesne kopanie przez klientów nie ma ogólnej atomowej transakcji bloku/dropu — nie deklarujemy zamknięcia tej klasy wyścigów multiplayer. Model/tekstury łóżka w świecie nie są pełną kopią Java. |
| `9738fc2b-9f59-4aee-a1ee-6f6f0447e612` | Skórki i ich druga warstwa używały materiału nieoświetlanego. Awatary świata używają teraz Lambert; podglądy UI pozostają nieoświetlane. Dodano pięć lokalnych świateł dla własnego i pobliskich trzymanych źródeł. | **Naprawiona reakcja na światło kierunkowe i pochodnie**. Brak pełnego próbkowania światła voxelowego i zasłaniania przez ściany/jaskinie — zgodność Java częściowa. |
| `7ee4375d-09d1-4629-adac-648f385de631` | Zachowano istniejący model postępu kopania; dodano osobną szybkość złota, dopasowanie siekiery do łóżek i mnożnik miecza dla wełny. Złoto nie otrzymuje poziomu zbioru żelaza. | **Częściowe.** Nie wykonano wyczerpującej macierzy wszystkich bloków, narzędzi, efektów i warunków Java. |

## Receptury, zapisy i bezpieczeństwo

- Identyfikatory nowych przedmiotów są dopisane od 600; nie kolidują ze stanami pieca 497–502 ani nie zmieniają dawnych ID zapisów.
- Zachowano odwrotne receptury bloków żelaza, złota i diamentu. Natywne zamienniki nie przestawiają bez potrzeby istniejących pozycji książki receptur.
- Kulka gliny pochodzi z gliny (cztery sztuki bez Silk Touch), cegła z przetopienia kulki; kaktus daje zielony barwnik. Kolorowanie wełny wykorzystuje barwniki zamiast zmyślonych bezpośrednich zamienników.
- Blok miodu powstaje z czterech butelek miodu i zwraca cztery puste butelki. Odwrócenie potrzebuje bloku i czterech pustych butelek. Ścieżki siatki oraz craftingu do plecaka uwzględniają pozostałości, brak miejsca i rollback — nic nie jest po cichu kasowane przy przepełnieniu.
- Bez migracji backendu, resetu światów, kasowania lokalnych zapisów lub powtarzania migracji z 4.29.0. Nie zmieniono zasad logowania, weryfikacji sesji, checkpointów/CAS, dzienników odzyskiwania ani chronionych działek/ulic.

## Defekt znaleziony podczas kontroli obrazu

Pierwsza implementacja umieszczała teksturę łóżka 64×64 w atlasie terenu 256×256. Obszar nachodził na klatki ognia ogniska; sama geometria i test poprawnego formatu PNG nie wykrywały zniszczonej poduszki. Kontrola powiększonej ikony ujawniła problem **przed wydaniem**.

Łóżko ma teraz izolowaną teksturę 64×64. Zarówno ikona, jak i materiały ręki/dropu używają natywnego obrazu bez wpisywania go do atlasu ognia/skrzyni. Dodano regresję rozmiaru dedykowanej tekstury i rzeczywistych jasnych pikseli poduszki/czerwonego koca w ikonie. Ponowiono testy natywnego renderera i ognia (desktop, emulowany mobile, `file:`).

## Źródła i odtwarzalność

- Mirror: `InventivetalentDev/minecraft-assets`, commit `90d256dfee7b6fd8014e1bc3b107e64a530c5f9b`, Java 1.20.4.
- `scripts/sync-java-refinements.py`: 42 przypięte pliki — 16 ikon, tekstura łóżka i 25 receptur; łódka jest jedynie referencją, 24 pozostałe receptury porównuje harness.
- `.harness/fixtures/java-refinements-1.20.4/manifest.json`: rozmiary i SHA-256. Runtime nie pobiera tych danych z sieci.
- Dane i grafika Mojang/Microsoft **nie są objęte MIT projektu**; uzupełniono `public/Minecraft-NOTICE.txt`.

## Weryfikacja

- `npm run typecheck` — PASS.
- `npm test` — **25 785 sprawdzeń**, w tym 90 nowych regresji, 16 972 silnika, 409 UI, 23 kont oraz 17/22 lokalnych kontroli PostgreSQL skrzyń/mobów. Testy SQL nie uruchamiają migracji produkcyjnych.
- `npm run build` — PASS; `npm audit --omit=dev` — 0 podatności.
- `npm run test:browser:refinements` — Chromium desktop i emulowany dotyk: crafting złota, głębokość geometrii, osiem przypadków połówka/kierunek łóżka, kompilacja wody bez błędów GL, piksele oświetlenia awatara, ikona łóżka, selekcja/dotyk i edycja pól.
- Rzeczywisty framebuffer awatara: ciemność `[0,2,2]`, słońce `[0,132,132]`, pochodnia około `[0,49,32]` (nieznaczna zmienność klatek). To kontrola reakcji renderera, nie dowód pełnej zgodności oświetlenia Java.
- Regresja poprzednich sześciu zgłoszeń desktop/mobile — PASS; wspólny stan — **27 kontroli dwóch rendererów**, bez nieobsłużonych błędów.
- Natywny renderer i ogień: desktop, mobile, `file:` — PASS.
- Raport nowego testu: [benchmarks/refinements-4.30.json](benchmarks/refinements-4.30.json).

Chromium/SwiftShader i emulowany dotyk nie zastępują fizycznego telefonu, Safari, sesji dwóch rzeczywistych kont ani porównania wszystkich zachowań z uruchomioną grą Java. Nie potwierdzono odtworzenia dokładnego środowiska anonimowych zgłaszających (Chrome 154 / Windows / 1875×956).
