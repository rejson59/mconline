# 4.13.0 — Kopanie i narzędzia

Cel projektu pozostaje **Minecraft: Java Edition 1.20.4**. To wydanie poprawia
konkretny podzbiór zachowania własnego silnika; nie oznacza pełnej zgodności gry,
protokołu Minecrafta, wszystkich bloków, łupów ani systemu zaklinania.

## Wzór i rytm

`src/game/mining.ts` zawiera czyste funkcje, a `items.ts` mapuje istniejące
przedmioty/bloki. Szybkość skutecznego narzędzia jest oddzielona od uprawnienia
do otrzymania dropu. Drewniany kilof nadal przyspiesza niszczenie rudy diamentu,
ale nie pozwala jej zebrać.

- Bazowe szybkości istniejących narzędzi: drewno 2, kamień 4, żelazo 6, diament 8.
- Wydajność dodaje `poziom² + 1` **tylko kiedy bazowa szybkość > 1**; nie jest
  mnożnikiem procentowym i nie podnosi poziomu materiału kilofa.
- Głowa w wodzie dzieli szybkość przez 5, chyba że hełm ma Wydajność pod wodą.
- Brak podparcia dzieli szybkość przez kolejne 5, również z tym zaklęciem.
- Postęp na tick: `szybkość / twardość / (można zebrać ? 30 : 100)`.
- Twardość ujemna jest niezniszczalna w survivalu; zerowa kończy się jednym
  krokiem klienta. Postęp narasta w krokach 50 ms, nie w każdym renderowanym FPS.
- Po zwykłym ukończeniu działa pięć ticków przerwy; nadmiar postępu nie przechodzi
  na kolejny blok. Przejście na inne współrzędne/blok albo zmianę narzędzia,
  jego obrażeń, nazwy lub zaklęć zeruje postęp. Kolejność kluczy zaklęć i liczność
  stosu nie identyfikują nowego narzędzia.
- Puszczenie przycisku, utrata fokusu, zmiana UI, trybu lub świata zeruje także
  ułamek ticka. Pęknięcia nadal używają istniejących rodzimych grafik i brył.

Przykłady na ziemi, bez efektów/zanurzenia (bez późniejszej przerwy):

| Blok i narzędzie | Ticki | Sekundy |
| --- | ---: | ---: |
| Ziemia, ręka | 15 | 0,75 |
| Pień, ręka | 60 | 3,00 |
| Kamień, drewniany kilof | 23 | 1,15 |
| Obsydian, diamentowy kilof | 188 | 9,40 |
| Obsydian, diamentowy kilof / Wydajność V | 45 | 2,25 |

**Ograniczenie rytmu:** to próbkowany zegar klienta, nie reimplementacja
natywnej pętli wejścia. Pierwsza próbka również czeka na pełny tick; Java ma
osobną ścieżkę pierwszego natychmiastowego trafienia. Nie deklarujemy identycznej
latencji kliku, wejścia lub działania przy utracie FPS. Długie klatki są ograniczane,
zamiast pozwalać jednym zaległym krokiem usunąć wiele bloków. Ten etap nie dodaje
Haste/Mining Fatigue ani innych nieistniejących jeszcze efektów.

## Narzędzia i bezpieczeństwo

- Motyki: cztery istniejące rodzaje liści, siano, tarcza strzelnicza, grzyboświatło.
- Nożyce: liście szybkość 15 i wszystkie 16 kolorów wełny szybkość 5.
- Miecze: szybkość 1,5 dla obsługiwanych roślin z `sword_efficient`, nie dla kaktusa.
- Blok dźwiękowy: siekiera; jasnogłaz i lampy nie dostają premii kilofa.
- Tory obu osi: premia kilofa, ale nie wymagają kilofa do zebrania.
- Tłoki/lód: skuteczność kilofa nie oznacza wymogu kilofa. To rozdzielenie nie
  zmienia istniejących specjalnych reguł dropów lodu.
- Mokra i sucha grządka zachowują tę samą skuteczność łopaty.
- Blok lapisu wymaga kamiennego kilofa, szmaragdów żelaznego, kowadło drewnianego.
  Kwarc daje surowiec już z drewnianym kilofem. Blok śniegu wymaga łopaty;
  pełna zgodność jego łupów (m.in. śnieżki) nie jest przedmiotem tego wydania.
- Wydajność pod wodą (`aquaaffinity`, alias `aqua_affinity`) ma tylko poziom I,
  trafia wyłącznie na hełmy przez istniejący system zaklinania. Komenda:
  trzymaj hełm, wpisz `/enchant aqua_affinity`, załóż go. Dane zaklęcia korzystają
  z dotychczasowego formatu stosu, bez nowych ID przedmiotów i migracji.
- Zużycie przy **udanym** kopaniu: miecz 2, kilof/siekiera/łopata/motyka 1 przy
  niezerowej twardości; nożyce 1 również na nieskutecznych blokach i roślinach
  o twardości zero. Łuk, tarcza, wędka, krzesiwo i luneta nie zużywają się od kopania.
  Niezniszczalność losuje każdy punkt osobno. Odmowa uprawnień nie kosztuje
  trwałości ani wyczerpania, i nie pokazuje fikcyjnego narastania pęknięć.
- LPM wydobywa TNT, a nie zapala go. Krzesiwo nadal zapala TNT przez użycie przedmiotu.
- Miecz w Creative nie niszczy bloków przez klik ani przytrzymanie. Creative może
  usunąć bedrock, ale nie fundament miasta Y=0, cudzą działkę ani chronioną ulicę.
  Próby poza wysokością świata nie udają udanego usunięcia bloku.

Nie zmieniono formatów światów, generatora, geometrii, ID bloków, migracji SQL,
kanałów multiplayer, praw działek ani preferencji GUI. To nie jest pełny audyt
wszystkich wcześniejszych tabel dropów/zaklęć ani autorytatywny serwer anty-cheat.

## Źródła i pochodzenie

Tagi **dokładnie 1.20.4**: [misode/mcmeta, dane 1.20.4](https://github.com/misode/mcmeta/tree/16d9f1b62461b12992e32236e46333d6036a40e7/data/minecraft/tags/blocks),
commit `16d9f1b62461b12992e32236e46333d6036a40e7`:
`mineable/{pickaxe,axe,shovel,hoe}.json`, `sword_efficient.json`,
`needs_{stone,iron,diamond}_tool.json`. Tagi skuteczności nie ustalają samodzielnie
właściwości `requiresCorrectToolForDrops` — dlatego są osobne wyjątki dla tłoków,
lodu i torów oraz osobny wymóg łopaty dla śniegu.

Pomocniczy odczyt historycznej implementacji Java: [mahtomedi/minecraft](https://github.com/mahtomedi/minecraft/tree/6ac5fe18be48a7395be84148be051908111d6772),
commit `6ac5fe18be48a7395be84148be051908111d6772`, pliki `Player`,
`MultiPlayerGameMode`, `ShearsItem`, `SwordItem`, `DiggerItem`. **Ten mirror
identyfikuje się jako 1.20.3-pre1, nie 1.20.4** — służy do sprawdzenia wzorów
Wydajności, środowiska, kosztów trwałości i przerwy, nie jako dowód pełnej
zgodności implementacji docelowej wersji. Testy czasów opierają się na niezależnie
obliczonych wartościach, a nie drugim wywołaniu funkcji produkcyjnej.

Nie skopiowano nowych grafik, dźwięków ani całych klas Java. Istniejące grafiki
pozostają własnością ich autorów, poza MIT kodu projektu:
[Minecraft-NOTICE.txt](../public/Minecraft-NOTICE.txt).

## Weryfikacja

- `npm run typecheck`, `npm test`, `npm run build`, `git diff --check`.
- Deterministyczne przypadki czasów, poziomów kilofów, praw do dropów, wszystkich
  kolorów wełny, premii motyk/mieczy, środowiska, hełmów i tożsamości narzędzia.
- Zegar 20 Hz przy renderowaniu 20/30/60/144 FPS; składanie połówek ticka.
- Rzeczywista metoda interakcji Game na testowym świecie: wymiana narzędzia,
  pięciotickowa przerwa, założony hełm, odmowa działki bez kosztów, Creative z
  mieczem, LPM na TNT, fundament miasta, utrata fokusu i podwójne zużycie miecza
  z osobnymi losowaniami Niezniszczalności.
- Chromium/WebGL z pełnym obiektem Game i rendererem: pęknięcia kamienia po
  10 tickach drewnianego kilofa (postęp 4/9), reset na diamentowy i ukończenie
  po 6 tickach, trwałość 1560/1561, miecz Creative i bezpieczne wydobycie TNT;
  brak błędów konsoli/wyjątków strony. To nie test natywnego klienta Minecraft
  ani wieloosobowej sesji z dwoma aktywnymi przeglądarkami.
