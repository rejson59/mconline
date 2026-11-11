# Survival — natywne reguły narzędzi i receptur, 4.43.0

## Cel i metoda

Kolejny mały etap zbliżania rozgrywki do Minecrafta: surowiec → narzędzie → wydobycie → przetopienie → kolejne narzędzie. Bazą jest wdrożone 4.42.0, commit `450c6c4f2bde06a0cd995d911b66c92051bac657`.

Zastosowano analizę wsteczną istniejącej implementacji oraz kontraktów natywnych danych: prześledzono dopasowanie i zużywanie składników, książkę receptur, szybkość narzędzia, uprawnienie do dropu oraz kroki kopania i pieca. Zamiast uznać wcześniejszy komentarz „waniliowe” za dowód, porównano go z `minecraft:tool`, recepturami i rozwiniętymi tagami z przypiętego korpusu **Java 26.3**.

Bieżąca lista wydań w mirrorze `misode/mcmeta` nadal wskazuje 26.3 jako najnowsze stabilne wydanie; bieżący `version.json` wskazuje już snapshot 26.4, którego nie traktujemy jako stabilnego celu. Ten etap nie migruje całej gry ani nie zmienia historycznego opisu referencji 1.20.4 pozostałych modułów.

**Nie uruchamiano ani nie dekompilowano klienta Java w tym etapie.** To implementacja na podstawie oryginalnych struktur danych udostępnionych przez przypięty mirror, z niezależnym porównaniem i testami rzeczywistego silnika projektu. Nie jest to dowód identyczności całego natywnego wykonania ani zastępstwo dla niedokończonej pracy nad pełnym prywatnym korpusem oryginałów.

## Zmiany widoczne w grze

### 1. Alternatywne i mieszane składniki

- Kamienne narzędzia, piec i statyw alchemiczny przyjmują **czernit (blackstone)** oprócz bruku. Można mieszać oba materiały w jednej recepturze.
- Ognisko przyjmuje dostępne pnie dębu, brzozy i akacji — także różne w jednym rzędzie — oraz węgiel lub węgiel drzewny.
- Alternatywa jest przypisana do pojedynczego składnika, nie do całego przepisu. Nie trzeba dodawać setek kombinacji jako oddzielnych wpisów książki.
- Dopasowanie ręcznej siatki, książka receptur, filtr „Możliwe” oraz istniejąca metoda craftingu do plecaka korzystają z tych samych dozwolonych zamienników.
- Książka układa i zużywa **rzeczywiste posiadane materiały**, nie dopisuje ich kanonicznych odpowiedników. Zachowuje metadane przenoszonych stosów, a nieudana operacja niczego nie zużywa.
- Generator alokacji rozwiązuje także nachodzące na siebie grupy składników i nie używa jednej sztuki dwa razy. Wynik i pozostałości po craftingu są sprawdzane na projekcji ekwipunku przed zatwierdzeniem.

### 2. Wybrane przepisy bez niepotrzebnego stołu

Blok kwarcu, kwarcowy filar, netherowe cegły i cegły Endu mogą powstać w siatce 2×2, zgodnie z wymiarami natywnych receptur. Wcześniej odręczna flaga wymuszała stół. Duże przepisy nadal wymagają stołu.

Łącznie **47 wybranych receptur** pochodzi teraz z danych 26.3: po pięć narzędzi drewnianych/kamiennych/żelaznych/złotych/diamentowych oraz 22 receptury podstawowej infrastruktury i materiałów. Poprawne dotychczasowe kształty zachowano; liczba 47 nie oznacza 47 nowych funkcji ani kompletnego katalogu Minecrafta. Zastępowanie całych rodzin wyników usuwa stare duplikaty wariantów węgla, ale zachowuje dotychczasowe położenie receptur w książce.

### 3. Kopanie według komponentów narzędzi

Zamiast osobnych ręcznych list „siekiera do tego, miecz do tamtego” runtime otrzymuje przetłumaczone reguły `minecraft:tool` dla **26 istniejących narzędzi** i jawne powiązania **304 istniejących stanów bloków**.

Potwierdzone poprawki obejmują m.in.:

- **łóżko nie jest przyspieszane siekierą** przez nieistniejący tag;
- **miecz nie dostaje bonusu na wełnie**, kwiatach, uprawach, trzcinie i trawie, których nie obejmuje odpowiednia reguła 26.3;
- kilof ma właściwą szybkość m.in. na kamiennym przycisku i głowicy tłoka;
- warianty drzwi, włazów, skrzyń, pieców, schodów, płyt i szyn otrzymują regułę dla właściwego natywnego bloku, zamiast gubić ją przy zmianie stanu;
- złoty kilof nadal szybko niszczy odpowiedni materiał, ale **nie uzyskuje przez to prawa do dropu diamentu**. Reguła odmawiająca dropu nie zasłania późniejszej reguły określającej szybkość.

Test 4.30 błędnie utrwalał bonus miecza do wełny i siekiery do łóżka. Zmieniono te oczekiwania jawnie na podstawie komponentów 26.3; nie zachowano starego zachowania tylko po to, żeby wcześniejszy test był zielony.

Dotychczasowe 20 Hz, Efficiency, kary za wodę/brak podparcia, poziomy zbioru, zużycie narzędzi i surowe żelazo/złoto nie są dodawane ponownie. Nowy test łączy je z poprawionymi recepturami w jedną ścieżkę.

## Referencje, generowanie i granice pokrycia

- Repozytorium danych: `misode/mcmeta`, commit `d96c75fec200c4580dd75e033a76341521165461`.
- `docs/survival-reference.lock.json`: przypięte SHA-256 agregatów receptur, tagów przedmiotów/bloków i komponentów przedmiotów. Skompresowany transport komponentów jest rozpakowywany przed sprawdzeniem hasha.
- `scripts/sync-survival-reference.mjs` / `npm run reference:survival`: pobranie tylko brakującego cache przez GitHub API, kontrola hashy, wydzielenie małego korpusu i wygenerowanie danych runtime. Znany hash jest wymagany również dla istniejącego cache; nie ma cichego przejścia na nowszy snapshot.
- `scripts/survival-bindings.ts`: jawne powiązania obecnych reprezentacji projektu. Przykładowo kierunki jednego łóżka to stany natywnego `red_bed`, a projektowa skrzynia z łupem korzysta z reguły skrzyni. Nie są to nowe bloki ani nowe ID zapisów.
- `.harness/fixtures/survival-26.3/`: kanoniczne podzbiory oryginalnych struktur, manifest/hash i NOTICE. Hash podzbioru nie jest przedstawiany jako hash oryginalnego pliku agregatu.
- `unrepresented-tag-members.json`: jawna lista natywnych członków tagów nieobecnych w grze, np. łupkowy bruk i brakujące rodzaje drewna. Ich brak **nie jest uznany za wdrożenie**. Nieistniejące przedmioty nie są generowane ani rejestrowane jako działające.
- Oryginalne dane Mojang/Microsoft pozostają **NOT-MIT**; bez pełnego JAR-a w Git, bez nowych wygenerowanych zamienników grafik.

To nadal **częściowa zgodność survivalu**, nie pełna macierz czasu/durability/dropów/XP najnowszej Java. Twardości pozostają w istniejącym rejestrze projektu; 7904 porównania dotyczą **bazowej szybkości narzędzia i powiązań stanów**, a nie niezależnego potwierdzenia wszystkich twardości, efektów i warunków. Sprawdzono także maksymalną trwałość 26 narzędzi względem komponentów. Nie przepisano całego mechanizmu `correct_for_drops`, natywnych loot tables ani doświadczenia pieca. Nie dodano miedzi do generowania świata, pełnego ametystu, nowych gatunków drewna, łódek ani voxelowego oświetlenia.

## Bezpieczeństwo

Bez zmian SQL, resetów, backendu, logowania, CAS/dzienników odzyskiwania, protokołu lub ochrony działek/ulic. Nie zmieniono żadnego ID bloku/przedmiotu ani formatu zapisów. `ingredientChoices` jest wewnętrzną definicją receptury, nie polem zapisywanego ekwipunku. Pełny plecak, brak materiałów lub zajęty kursor powodują odmowę bez częściowego zużycia. To nie jest deklaracja rozwiązania wszystkich wieloklientowych wyścigów blok/drop.

## Weryfikacja

- `npm run test:survival`: **89 grup PASS / 0 FAIL**, w tym **7904 porównania szybkości** (26 × 304), hashe, trwałość, 47 natywnych receptur, odbicia/przesunięcia, zamienniki, mieszane materiały, pełny ekwipunek, metadane i ścieżka piec/narzędzia/rudy.
- Kontrola negatywna z `items.ts` i `inventory.ts` z produkcji 4.42.0: **58 grup PASS / 31 FAIL**. Nowy planner pozostawał obecny, ale stary runtime go nie używał. Po przywróceniu poprawek: 89/0. Liczba 31 to grupy regresji, nie 31 niezależnych nowych funkcji.
- `npm run typecheck`, pełne `npm test`, `npm run build`, `npm run progress:audit`, `npm run progress:check`, `git diff --check`: PASS. Pełny zestaw zawiera m.in. **16 964 sprawdzenia silnika** i **412 UI**, w tym prawdziwe kliknięcie książki układające osiem sztuk czernitu i odebranie pieca. Zmiana liczby starych sprawdzeń wynika też z usunięcia duplikatów receptur w iterowanych katalogach.
- `npm audit --omit=dev`: **0 podatności**.
- `npm run test:browser:survival`: produkcyjny HTML w Chromium/SwiftShader, desktop **1875×956** oraz emulowany dotyk **753×360**, `errors: []`. Rzeczywista pętla `Game.updateInteraction`, raycast, usunięcie bloku, zużycie narzędzia, drop surowego żelaza i rzeczywisty `Game.updateFurnaces`.
  - Kamień drewnianym kilofem: **23 ticki**, pozostaje 58 użyć.
  - Łóżko złotą siekierą: **6 ticków**, pozostaje 31 użyć.
  - Wełna drewnianym mieczem: **24 ticki**, pozostaje 57 użyć.
  - Ruda żelaza kamiennym kilofem: **23 ticki**, pozostaje 130 użyć; drop surowego żelaza.
  - Surowe żelazo w piecu: brak wyniku przed 200 tickami, sztabka przy 200 tickach.
  - Zachowana regresja creepera/osłony, złota, ośmiu łóżek, modeli, wody i pikseli światła.
- Browser shared: **27 kontroli**, dwa renderery — PASS.
- Browser recovery: zarchiwizowana rozbieżna kopia, wybrany ekwipunek serwera, pełny teren i powrót do rozgrywki — PASS, `errors: []`.

Zapis maszynowy: [benchmarks/survival-4.43.json](benchmarks/survival-4.43.json). Testy używają izolowanych profili, syntetycznej bramki/sieci i przygotowanych zasobów. Nie są testem naturalnego przejścia całego świata, fizycznego telefonu właściciela ani jego konta produkcyjnego.

Następny obszar po tym etapie: oświetlenie voxelowe/osłanianie światła, a następnie pełny pojazd łódki; katalog receptur, twardości i loot tables pozostaje otwarty do dalszych porównań.
