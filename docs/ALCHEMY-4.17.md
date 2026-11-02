# 4.17.0 — Alchemia Java

Kolejny ograniczony etap zgodności z Minecraft Java 1.20.4. Nie jest to
stwierdzenie pełnej zgodności całego klienta, wszystkich mikstur ani protokołu.

## Najważniejszy znaleziony błąd: zamrożona symulacja

Rzeczywisty test pętli renderującej wykazał, że przy `ui === 'brewing'` świat
singleplayer nie wykonywał aktualizacji. Z identycznym błędem pozostawało
kowadło. Same testy `tickBrewing` nie mogły tego wykryć.

Zamiast niepełnej listy warunków jest teraz wyczerpująca mapa
`Record<UIState, boolean>` i funkcja `worldSimulationActive` używana przez pętlę.
Warzenie, kowadło i pozostałe kontenery nie pauzują świata. Właściwa pauza,
dziennik i punkty podróży nadal pauzują singleplayer; sieć pozostaje aktywna
przy każdym ekranie. Dodanie nowego UI wymaga jawnego określenia tej własności.

## Statyw i receptury

- **Płomienny proszek**, nie różdżka: 20 ładunków paliwa. Różdżka daje dwa
  proszki w craftingu; proszek i kula szlamu dają krem magmowy.
- Proszek jest ładowany już na ticku pustego statywu, ale ładunek jest
  zużywany dopiero przy rozpoczęciu prawidłowej partii.
- Partia odlicza **400 ticków po ticku uruchomienia**. Od pierwszego wywołania
  symulacji jest to 401 ticków = 20,05 s, a nie fikcyjna partia 8 sekund.
- Dokładnie **jeden** składnik na partię, maksymalnie trzy butelki. Nie jeden
  składnik na każdą butelkę i nie składnik pozostający w nieskończoność.
- Zmiana paliwa nie resetuje odliczania. Usunięcie jednej butelki nie resetuje
  pozostałych prawidłowych; usunięcie wszystkich anuluje partię przy kolejnym ticku.
- Zmiana rodzaju składnika anuluje trwającą partię bez zwrotu wydanego ładunku.
  Zachowano kolejność warunków źródła: na samym ostatnim ticku sprawdzane jest
  najpierw ukończenie z aktualnym prawidłowym składnikiem, potem anulowanie.
- Zwykłe kliknięcie, Shift, zamiana i przeciąganie respektują butelkowy slot
  o pojemności 1. Shift+proszek celuje najpierw w paliwo, nie składnik siły.
- Wynik konwersji ma nowy typ mikstury i resetuje custom dane butelki jak
  odczytane `PotionBrewing.mix`; butelki niepodlegające recepturze zostają bez zmian.

| Baza | Składnik | Wynik |
| --- | --- | --- |
| Woda | brodawka netherowa | klarowna mikstura |
| Klarowna | lśniący arbuz | leczenie |
| Klarowna | krem magmowy | ognioodporność |
| Klarowna | cukier | szybkość |
| Klarowna | złota marchewka | noktowizja |
| Klarowna | płomienny proszek | siła |
| Klarowna | łza ghasta | regeneracja |
| Woda | pył jasnogłazu | gęsta mikstura, bez efektu |
| Woda | redstone lub obsługiwane dodatki poza marchewką | mdła mikstura, bez efektu |

Woda z łzą nie leczy, a pył jasnogłazu nie tworzy sam Noktowizji/Regeneracji.
Złota marchewka i lśniący arbuz są dostępne w Creative i dodane do własnej
puli łupów zrujnowanych portali. Nie jest to pełna natywna tabela łupów.
Uprawa marchewek/arbuzów i ich pełny crafting pozostają poza wydaniem.

## Parametry podstawowych mikstur I

| Mikstura | Wartość/czas |
| --- | --- |
| Leczenie | +4 HP, nie 7 |
| Szybkość | +20%, nie 30%; 180 s |
| Siła | +3 obrażenia, nie 4; 180 s |
| Ognioodporność | 180 s |
| Noktowizja | 180 s |
| Regeneracja I | 45 s; dotychczasowy rytm 50 ticków |

Picie oddaje pustą butelkę. Ostatnia mikstura jest zastępowana w wybranym
slocie; przy historycznym stosie reszta zostaje, a pusta butelka trafia do
plecaka lub dokładnie raz na ziemię, gdy plecak jest pełny. Creative nie
zużywa pełnej mikstury i nie tworzy darmowej pustej butelki. Woda także jest
obsługiwana przez ścieżkę picia. Usunięto wymyślone komunikaty każdej mikstury
oraz czerwone/yellow drobinki ukończenia. Zachowano istniejące osiągnięcia projektu.

## Wygląd i dźwięk

Sześć niezmodyfikowanych źródłowych PNG 16×16 z Java **dokładnie 1.20.4**:
`blaze_powder`, `golden_carrot`, `glistering_melon_slice`, `glass_bottle`,
`potion`, `potion_overlay`. Ikony mikstur są składane według oryginalnego
modelu: kolorowany `potion_overlay` jako warstwa 0, niebarwione szkło jako
warstwa 1. Użyto kolorów obsługiwanych efektów, bez starej dowolnej palety.

Postęp GUI jest przycinany od góry: `floor(28*(1-remaining/400))` pikseli.
Bąbelki używają tablicy `[29,24,20,16,11,6,0]` indeksowanej
`floor(remaining/2)%7`, a paliwo `ceil(18*fuel/20)` pikseli. Usunięto nienatywne
obramowanie wszystkich aktywnych butelek i widoczny dodatkowy tekst panelu;
komunikat stanu pozostaje dostępny czytnikom ekranu.

Dwa oryginalne OGG `block/brewing_stand/brew1` i `brew2`, event
`block.brewing_stand.brew`, zamiast dźwięku zaklinania. Kategoria bloków,
pozycjonowanie przestrzenne i wyciszenie miksera nadal działają. Materiały
są osadzone — bez pobierania podczas rozgrywki.

Źródło materiałów i tłumaczeń:
[przypięty mirror 1.20.4](https://github.com/InventivetalentDev/minecraft-assets/tree/90d256dfee7b6fd8014e1bc3b107e64a530c5f9b/assets/minecraft).
Kompilator `scripts/compile-java-brewing.py`: standardowy Python i `gh`, cache
ignorowany przez Git; ponowna kompilacja daje identyczny plik.
`src/game/art/javaBrewing.generated.ts` zawiera źródłowe bajty. Zasady własności
w [Minecraft-NOTICE](../public/Minecraft-NOTICE.txt): te materiały **nie są MIT**.

Pomocniczy odczyt mechaniki: [historyczny mirror](https://github.com/mahtomedi/minecraft/tree/6ac5fe18be48a7395be84148be051908111d6772),
`BrewingStandBlockEntity.serverTick/doBrew`, `PotionBrewing`, `Potions`,
`BrewingStandScreen`, `MobEffects`. **Ten mirror jest 1.20.3-pre1, nie 1.20.4**;
nie przedstawiamy go jako dowodu identyczności całego docelowego klienta.

## Zapis i granice

- Stare ID 341–351 pozostają bez zmian. **352 nadal jest nawodnioną grządką**;
  nowe przedmioty używają 353–357, bez kolizji bloków/przedmiotów.
- Opcjonalne `rules:1`, `remainingTicks`, `brewingIngredient`, `tickRemainder`
  w istniejącym `BrewingState`. `progress` pozostaje lustrzanym czasem dla
  starszych czytelników. Bez nowej tabeli, kolumny SQL ani zmiany praw miasta.
- Natywna nowa partia zachowuje pozostałe ticki, fazę i zapas bez ponownego
  ładowania paliwa/przyznawania darmowych przedmiotów.
- Stara partia 8 s jest restartowana. Składniki, stare stosy butelek, różdżki
  i już opłacone 0–3 ładunki pozostają. Rod można wyjąć i przekraftować, ale
  nie jest automatycznie zamieniany w 20 ładunków. Nowy statyw nie scala
  kolejnych butelek w stos wewnątrz pojedynczego slotu.
- Historyczna globalna możliwość stosowania butelek wody poza statywem
  pozostaje, żeby nie uciąć starych stosów przy odczycie profilu. Nie jest
  to deklaracja pełnej zgodności wszystkich limitów stosów Java.
- Zmienione wartości dotyczą następnego wypicia; aktywne efekty w zapisach
  zachowują swój pozostały czas. Po publikacji należy odświeżyć starsze karty.

Nadal uproszczone: czas i animacja samego picia (nie pełne użycie 32-tickowe),
cała alchemia rzucana/przedłużana/wzmocniona, pełna uprawa i crafting złotych
składników, bryła statywu z każdą kombinacją butelek, rozgrywka/protokół całego
Minecrafta i animacja totemu. To nie jest jeszcze cały Minecraft 1:1.

## Weryfikacja

PASS: typecheck, pełne testy, produkcyjny build i `git diff --check`.
**17 047 sprawdzeń** = 16 278 silnika + 395 audio + 367 UI + 5 konta + 2 portalu.
Nowe testy obejmują czas/20 paliw/zużycie składnika, anulowanie i graniczny tick,
20/30/60/144 FPS, błędny czas, zapis/legacy, sloty/Shift, pełny plecak/Creative,
kopiowanie danych grafiki, hashe oryginałów, wszystkie 400 faz animacji GUI,
mikser oraz wyczerpującą decyzję symulacji wszystkich 13 trybów UI.

Chromium/WebGL, **produkcyjny App/Game/React HUD**, 960×600 i 390×844:

1. Przy 200 tickach: 19 ładunków, trzy składniki; rzeczywisty pasek 14 px,
   bąbelki 20 px, paliwo 18 px, komplet oryginalnych ikon i panel w viewport.
2. Realny odczyt starego statywu zachował dwie różdżki, dwa ładunki i składniki.
3. Rzeczywiste ponowne otwarcie zapisanego świata zachowuje nową połowę partii.
   Dopiero ostatni tick tworzy trzy klarowne mikstury i zużywa jeden składnik.
   Następnie cukier daje trzy mikstury szybkości; wypicie daje 180 s i pustą butelkę.
4. **Prawdziwa pętla RAF** odlicza przy otwartym statywie: 400 → 379. W pauzie
   licznik się nie zmienia mimo kolejnych renderowanych klatek.
5. Faktyczne dekodowanie obu OGG: mono, 0,85333 s i 0,86132 s.
6. Zero błędów strony/konsoli. Mobilny test to viewport Chromium z jawnym
   wyborem gry w pionie, nie test fizycznego telefonu. Bez dwóch sesji Realtime.
