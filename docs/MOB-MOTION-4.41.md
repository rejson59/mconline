# 4.41 — płynne moby bez przenikania

## Przyczyny i poprawka

1. **Widoczny skok podczas każdej symulacji sieciowej.** `pollSharedMobs` wykonywał `Mob.update`, który kopiował pozycję fizyczną prosto do modelu. To omijało wygładzanie wykonywane w kolejnych klatkach. Symulacja nadal tworzy ten sam snapshot do potwierdzenia CAS, ale zachowuje poprzednią pozycję i obrót widocznego modelu. Odczyt snapshotu również zachowuje obrót, nie tylko pozycję.
2. **Sprint–postój między odpowiedziami.** Zamiast wykładniczego doganiania ostatniego punktu, osobny `MobMotion` prowadzi model przez cały interwał aktualizacji. Dostosowuje długość przejścia do obserwowanego odstępu (z limitem .6 s). Obrót wybiera krótszy łuk, a kończyny reagują na rzeczywiście pokonaną drogę modelu; nie maszerują dalej, gdy model stoi. Przy dłuższym braku danych ruch kończy się na ostatnim punkcie — nie zgadujemy bez końca ruchu przez ściany.
3. **Duży skok czasu dla fizyki.** Jeden krok do .4 s został zastąpiony maksymalnie 12 krokami po najwyżej 1/30 s. Dotyczy wszystkich 14 typów, odrzutu i zapalonego TNT. Po zawieszeniu karty nie odtwarzamy sekund zaległych ataków. Moby aktualizowane rzadziej z powodu odległości zbierają rzeczywisty czas pominiętych klatek, zamiast mnożyć ostatnie `dt` przez liczbę klatek. Ich modele nadal są prezentowane między tickami.
4. **Niebezpieczne pozycje.** Pojawienie się sprawdza całą bryłę danego gatunku, włącznie z sąsiednim blokiem, sufitem i dostępnym terenem. Nieudane `/summon` podaje komunikat zamiast ogłaszać sukces. Losowe offsety naturalnego stada również nie omijają tej kontroli. Enderman odrzuca teleport wewnątrz bryły kolizji lub poza wczytany teren.
5. **Istniejący mob wewnątrz bloku.** Ograniczona próba wyjścia wybiera najbliższą sprawdzoną pozycję przy rzeczywistej ścianie kolizji, nie granicy całego voxela. Maksymalny dystans odzyskiwania: 2 bloki. Nie niszczy bloków ani nie skanuje mapy. Powtarzające się wyjścia są deduplikowane, a nieudana próba ma 250 ms przerwy przed ponownym droższym szukaniem. Całkowicie zamurowany mob pozostaje zatrzymany i ukryty, bez atakowania; nie jest po cichu kasowany ani lootowany.
6. **Wczytywanie terenu.** Brakujący chunk nie jest już powietrzem dla ruchu moba. Symulacja czeka na teren i nie generuje go sama; przekroczenie granicy dostępnego terenu cofa wyłącznie dany krok ruchu. Wygładzanie też sprawdza teren i przesuwa widoczną bryłę przez istniejące kolizje. Dwa bezpieczne końce odcinka nie pozwalają przeciąć ściany na zakręcie.
7. **Koszt tłumu.** Rozsuwanie wykorzystuje siatkę pobliskich sąsiadów zamiast skanu wszystkich mobów dla każdego moba w każdym podkroku. Pozostałe AI nadal otrzymuje pełną listę sojuszników; nie zmieniono semantyki szukania celów golema/wilka. Test 400 rozproszonych ciał wymaga poniżej 2000 kandydatów zamiast 160 000 par.

## Testy regresji

`npm run test:mobmotion`: **34 grupy PASS / 0 FAIL**:

- każdy z 14 typów: 12 dużych ticków, odrzut i wysoka ściana, bez nachodzenia brył;
- jawne oczekiwanie integracji grawitacji przy sieciowym kroku .4 s;
- odzyskanie ze środka kamienia, płotu, skrzyni, włazu i drzwi według ich faktycznych kształtów;
- całkowite zamurowanie, zatrzymanie i ukrycie; niewczytany świat, zatrzymanie lontu i brak generowania chunków;
- odrzucony teleport endermana, sąsiednia ściana/sufit przy spawnie;
- płynne kroki na strumieniu 350 ms, brak mutacji ciała przez prezentację, zakręt za ścianą, teleport i obrót przez ±π, zatrzymanie po utracie danych;
- siatka sąsiadów przez granice komórek i budżet 400 ciał;
- rzeczywisty asynchroniczny `pollSharedMobs` i zachowanie prezentacji mimo nowego snapshotu fizyki;
- zmienne czasy klatek przy cullingu; strumień 500 ms przy 20/30/60 FPS.

Kontrola negatywna z dokładnym `engine.ts` i `mobs.ts` produkcyjnej 4.40 (`5141e3b5bf2612a1ad7316cb6f0e07d16a8fbd47`), przy niezmienionym nowym zestawie testów: **27 PASS / 7 FAIL**. Poległy integracja dużego kroku, atak z wnętrza ściany, niewczytany teren, teleport, spawn, przeskok modelu podczas symulacji i naliczanie czasu cullingu. Po przywróceniu poprawki: **34 PASS / 0 FAIL**. Pozostałe testy helperów nie stanowią porównania z oryginalnym klientem.

### Produkcyjny Chromium

`npm run test:browser:mobmotion`: **desktop 960×600 oraz emulowany dotyk 844×390**, rzeczywisty produkcyjny silnik i modele. Każdy kontekst sprawdza:

- wszystkie 14 typów, **1764 próbki klatkowego przesunięcia** przy aktualizacjach co 350 ms, bez sprint–postój;
- odczyt regionu i prawdziwy asynchroniczny poll właściciela bez przeskoku modelu;
- **112 kontroli ściany/odrzutu**, odrzucenie spawnu w kamieniu i odzyskanie już uwięzionego ciała;
- brak zmiany ekwipunku gracza;
- 30 pomiarów CPU symulacji 48 mobów po rozgrzewce. To izolowany pomiar CPU w sandboxie, nie FPS telefonu ani pomiar całej klatki z renderowaniem. Mediana/p95 są zapisane w pokwitowaniu, nie służą jako gwarancja wydajności każdego urządzenia.

Pełne wygenerowanie świata i wejście do rozgrywki poprzedzają test. Pakiety i regiony są syntetyczne, nie logujemy właściciela ani nie zapisujemy jego świata. Wyniki i błędy: [mob-motion-4.41.json](benchmarks/mob-motion-4.41.json). Zrzuty lokalne: `.cache/verification441/{desktop,mobile}.png`.

`test:browser:shared`: **27 kontroli PASS**, dwa renderery i PostgreSQL WASM, wspólne moby/ID/obrażenia/loot, przejęcie regionu, odrzucona epoka AI, rollback pieca, TNT i dokładnie jeden spill skrzyni. Stary fixture umieszczał głowę krowy w liściach drzewa (w kolumnie spawnu y66–67). Przygotowano wolną przestrzeń w obu izolowanych rendererach i zachowano wszystkie asercje transakcji — nie poluzowano kontroli spawnu.

`test:browser:recovery`: **PASS / errors=[]** na 4.41, pełny teren i rzeczywiste wznowienie gry, utracone ACK, izolacja kart/urządzeń, rozbieżne/uszkodzone kopie, eksport `/kopie`. Dotychczasowe headless testy pająka i TNT jawnie wczytują swój testowy chunk; symulacja nie generuje go za nie. Pełny zestaw headless obejmuje nadal 16 973 kontrole silnika i 409 UI, w tym dotychczasowe modele obu rąk i fizykę częściowych bloków.

## Bezpieczeństwo i granice

Brak resetów, migracji, zmian backendu, schematu snapshotów, CAS, dzienników, kont, ochrony działek/ulic i zasad współdzielonego łupu. Nowe obiekty prezentacji i budżety są poza zapisem mobów. Nie podniesiono częstotliwości RPC ani limitu mobów regionu. Nie zmieniono fizyki gracza ani brył kolizji świata.

To poprawka znalezionych przyczyn, a nie gwarancja usunięcia dowolnego laga sieci lub telefonu. Fizyczny telefon właściciela i prawdziwa wieloosobowa sesja nie były użyte w testach. Nie dodano pełnego pathfindingu Java, nowych modeli ani pełnej zgodności animacji 26.3. Zamurowana encja bez bezpiecznego bliskiego wyjścia nie jest teleportowana przez mapę — czeka na odsłonięcie przestrzeni.

## Kontrole wydania

`npm run typecheck`, pełne `npm test` (włącznie z SQL, odzyskiwaniem, kontem i aktualnym audytem dowodów), `npm run build`, `npm audit --audit-level=low` i `git diff --check`: **PASS, 0 podatności**. Raport 4.41 zachowuje częściowy status szerszych obszarów AI/animacji i nie zamienia liczby testów ani pomiarów CPU w procent całej gry.

### Domknięcie 4.41.1 — brak generowania także po AI

Dodatkowa kontrola wykryła, że słoneczne obrażenia zombie mogły wywołać `heightAt` już po zatrzymanym `Mob.update`, a tym samym wygenerować brakujący chunk. Strażnik całej iteracji odcina także ten etap i dźwięki. **35 grup PASS / 0 FAIL**; nowy test używa prawdziwego `Game.updateMobs`, zombie w pełnym słońcu i całkowicie niewczytanego świata, sprawdzając brak chunku, brak obrażeń i ukrycie modelu. Historyczna kontrola negatywna 27/7 dotyczy pierwszych 34 grup; nie jest przepisywana jako wynik nowej próby. Pokwitowanie przeglądarkowe 4.41.0 pozostaje historycznym pomiarem; dodatkowa poprawka nie zmienia ścieżki wczytanych mobów.
