# 4.14.0 — Obrażenia i przetrwanie

Cel: zbliżyć **konkretne mechaniki survivalu** do Minecraft Java 1.20.4,
naprawiając błędy, a nie deklarować pełną zgodność 1:1 całej gry.

## Zbroja i zdrowie

- Efektywna zbroja `Aeff = min(20, max(A/5, A - D/(2 + T/4)))`;
  obrażenia po zbroi `D × (1 - Aeff/25)`. D to surowe trafienie, A punkty
  zbroi, T twardość. Każda istniejąca diamentowa część ma T=2, pozostałe T=0.
- Ochrona jest **osobnym** etapem: po 1 EPF na poziom każdej części, potem
  `obrażenia × (1 - min(20, EPF)/25)`. Nie dodajemy procentów Ochrony do
  procentów zbroi i nie zaokrąglamy wyniku do całych HP.
- Upadek i topienie omijają punkty zbroi/twardość oraz nie zużywają pancerza.
  Ochrona nadal je ogranicza. Tylko upadek dodaje 3 EPF na poziom Lekkiego kroku
  z butów, ze wspólnym limitem 20 EPF (80% redukcji).
- `/kill`, pustka i głód zachowują dotychczasową osobną ścieżkę całkowitego
  pominięcia ochrony. Creative pozostaje odporny na zwykłe obrażenia.
- Zużycie każdej założonej części: `max(1, floor(D/4))`, od surowego trafienia,
  nie od utraconego zdrowia. Niezniszczalność losuje **każdy punkt** oddzielnie.
  Zbroja ma obowiązkowe 60% szans zużycia, a pozostałe 40% używa zwykłego
  losowania `1/(poziom+1)`. Zatem III oznacza średnio 70% zużywanych punktów,
  a nie 25% jak dla narzędzia. Opis zaklęcia rozróżnia te przypadki.
- Etap atrybutów pancerza jest obliczany przed zmianą trwałości, etap zaklęć
  korzysta z ocalałych elementów. Pęknięta część znika ze slotu. To nie pełna
  implementacja natywnego cache atrybutów i kolejności wszystkich zdarzeń ticka.
- Skórzane buty mają maksymalnie 65 użyć zamiast błędnych 55. Już zapisane
  wartości `dur` nie są przepisywane ani automatycznie naprawiane.

Niezależne przykłady dla nieuszkodzonej zbroi bez zaklęć:

| Trafienie | Zbroja | Utrata HP |
| ---: | --- | ---: |
| 4 | brak | 4 |
| 4 | pełne żelazo | 1,92 |
| 4 | pełny diament | 0,96 |
| 20 | pełne żelazo | 16 |
| 20 | pełny diament | 8 |
| 1 | pełny diament | 0,21 |
| upadek 10 | pełny diament | 10 |
| upadek 10 | Lekki krok IV bez Ochrony | 5,2 |
| upadek 10 | Lekki krok IV + pełna Ochrona IV | 2 |

## Lądowanie i woda

- Surowe obrażenia od upadku: `ceil((odległość - 3) × mnożnik)`; wartości
  nieujemne, z tolerancją 1e-7 na szum obliczeń fizyki. Usunięto próg 3,4
  i błędne zaokrąglanie w dół: upadek 3,01 bloku daje 1 HP przed ochroną.
- Siano i miód: mnożnik obrażeń 0,2. Łóżka obu części/kierunków mają inną
  kolejność: najpierw połowa **odległości**, potem odjęcie 3 bezpiecznych bloków
  i zaokrąglenie w górę. Dlatego 6 bloków na łóżko nie zadaje obrażeń.
- Szlam bez kucania: brak obrażeń i odbicie z rzeczywistej prędkości pionowej
  **sprzed** kolizji. Fizyczny resolver zeruje ją przy kontakcie, więc dawniej
  odbicie zawsze miało sztuczną minimalną siłę. Dla gracza mnożnik prędkości
  wynosi 1, nie 0,8. Stanie na szlamie nie tworzy kolejnych odbić.
- Kucanie na szlamie: brak odbicia, zwykłe obrażenia od upadku. Początek
  kolejnego upadku jest wysokością, nie sumą wysokości i prędkości.
- Zanurzenie stóp sprawdzane również **po ruchu**, aby szybkie wejście w płytką
  wodę w klatce lądowania nie powodowało fałszywych obrażeń.
- Rezerwa powietrza 15 s (300 ticków); zejście do -1 s (-20 ticków) daje
  2 HP obrażeń i rozpoczyna kolejny cykl. Powietrze jest wewnętrznie ze znakiem,
  dzięki czemu krótki oddech nie kasuje magicznie całego ujemnego stanu.
  Odzyskiwanie: 4 sekundy rezerwy na sekundę oddychania. Przeliczanie na czas
  renderera nie jest deklaracją identycznej natywnej latencji wejścia/ticków.

## Ułamki zdrowia, jedzenie i zgodność zapisów

- HUD używa `ceil(health)` do wyboru pełnych/połówek serc: nawet 0,01 HP jest
  widoczne jako pół serca. To tylko prezentacja — zdrowie nie jest zaokrąglane.
- Sanitacja profilu zachowuje dodatnie wartości poniżej 1 HP. Wcześniej
  ponowne wejście podnosiło takie zdrowie do 1. Niepoprawne/martwe profile
  zachowują wcześniejszą bezpieczną obsługę. Lokalny zapis już obsługiwał ułamki.
- Przy końcowym ułamku regeneracji koszt pochodzi z **żądanego** leczenia,
  nie z brakujących HP. Zwykła regeneracja nadal płaci 6 wyczerpania,
  nasycona płaci `min(nasycenie, 6)`.
- Głód na Normal zadaje 1 HP, jeśli zdrowie >1; może zostawić np. 0,5 HP,
  ale dalej nie zabija. Nie ma sztucznego zaokrąglenia do 1 HP.
- Brak nowych ID, formatów świata, migracji SQL i zmian ochrony miasta.
  Istniejąca migracja `202610270001_player_vitals_fractional.sql` już używa
  `double precision` dla zdrowia/głodu; nie należy wdrażać jej ponownie.

## Źródła i ograniczenia

Dokładne tagi obrażeń **1.20.4**:
[misode/mcmeta — bypasses_armor](https://github.com/misode/mcmeta/blob/16d9f1b62461b12992e32236e46333d6036a40e7/data/minecraft/tags/damage_type/bypasses_armor.json),
commit `16d9f1b62461b12992e32236e46333d6036a40e7` — zawiera `fall` i `drown`.
Nie oznacza to, że w tym wydaniu dodano wszystkie typy obrażeń z tej listy.

Pomocniczy historyczny odczyt implementacji:
[mahtomedi/minecraft](https://github.com/mahtomedi/minecraft/tree/6ac5fe18be48a7395be84148be051908111d6772),
commit `6ac5fe18be48a7395be84148be051908111d6772`:
`CombatRules`, `LivingEntity`, `Inventory`, `ProtectionEnchantment`,
`DigDurabilityEnchantment`, `FoodData`, `SlimeBlock`, `HayBlock`, `HoneyBlock`,
`BedBlock`. **Ten mirror to 1.20.3-pre1, nie 1.20.4**. Służy do sprawdzenia
wzorów/zasad, nie stanowi dowodu pełnej zgodności binarnej z docelową wersją.
Nie kopiowano całych klas ani nowych grafik/dźwięków; prawa do dotychczasowych
materiałów pozostają opisane w [Minecraft-NOTICE.txt](../public/Minecraft-NOTICE.txt).

Poza zakresem: pełna walka Java z oknami nietykalności, wszystkie źródła obrażeń,
Absorption/Resistance, Respiration, pełne zachowanie totemu, odbijanie łóżek,
ślizganie po ścianach miodu, pełna fizyka 20 Hz i serwer autorytatywny. Pozostałe
mechaniki jedzenia/efektów nie są w całości ponownie implementowane w tym etapie.

## Weryfikacja

- `npm run typecheck`, `npm test`, `npm run build`, `git diff --check`.
- Niezależne fixture'y liczbowe obrażeń, twardości, limitów zaklęć i trwałości;
  wyliczenie rozkładu Niezniszczalności bez losowego testu Monte Carlo.
- Prawdziwe `Game.updatePlayer` + resolver kolizji na testowym świecie:
  lądowania przy 20/30/60/144 FPS, amortyzacja, prędkość szlamu i kucanie,
  wejście w wodę podczas ruchu, topienie i niezużywanie zbroi.
- Powietrze i pierwszy cykl topienia przy 20/60 FPS, dodatnie ułamki zdrowia
  w profilu, końcowe koszty regeneracji i ochrona Creative.
- Rzeczywisty komponent HUD: 19,01 / 18,01 / 1,01 / 0,01 / 0 HP.
- Chromium/WebGL: pełny Game i renderer + React HUD, desktop 960×600 i mobilny
  viewport 390×844. Upadek 4 bloków zabiera 1 HP mimo diamentu i nie niszczy
  pancerza; małe trafienie zabiera 0,21 HP; szlam odbija z zachowanej prędkości;
  0,25 HP daje widoczną połówkę serca w granicach obu ekranów. Brak wyjątków
  strony i błędów konsoli. Nie jest to test fizycznego telefonu ani sesji
  z dwoma aktywnymi klientami multiplayer.
