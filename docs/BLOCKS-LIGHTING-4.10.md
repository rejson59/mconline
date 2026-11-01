# BlockCraft 4.10.0 — tory, skrzynie i światło

## Naprawione przyczyny

- Tory miały jeden nierotowany quad z teksturą północ–południe. Teraz oś
  stawiania wynika ze spojrzenia; sąsiedzi wyznaczają połączenia, cztery łuki
  i cztery podjazdy. Zasilane i detekcyjne tory nie zakręcają. Zmieniają się
  rzeczywiste UV oraz wysokości wierzchołków, nie tylko ikona.
- Model skrzyni w świecie już istniał, ale przód i tył miały pomylone wycinki
  UV, grafika pochodziła ze starej paczki, a przedmiot/ikona używały uproszczeń.
  Wspólny `chestModel.ts` wyznacza korpus, wieko, zamek i wycinki tekstury.
  Świat, animowane wieko, model w dłoni, drop oraz izometryczna ikona korzystają
  z tej samej definicji. Otwarcie trwa około 0,5 s z sześciennym wygładzeniem
  kąta; już animowane wieko odświeża kolory po zmianie światła korpusu.
- Niebo było liczone tylko pionowo. Dach odcinał światło także w otwartej
  wiacie. Pole 0–15 propaguje teraz światło bocznie przez otwory, ze stratą
  poziomu na krok. Tylko bezpośrednie światło 15 nie słabnie w dół; po liściach
  lub wodzie słabnie dalej również w powietrzu. Całkowicie zamknięta komora
  ma poziom nieba 0, nie fikcyjne światło przez kamień.
- Bufor światła blokowego i unieważnianie siatek obejmują promień 15, zamiast
  obcinać światło albo pozostawiać stare kolory w sąsiednim chunku. `seedMods`
  odświeża indeks emiterów i oświetlenie, także przy usunięciu źródła. Zmiana
  w niewczytanym sąsiedzie może unieważnić istniejącą siatkę bez generowania
  tego sąsiada.

## Model światła i koszt

`lightMap.ts` ma ograniczone pole i kolejki według poziomów. Nie przeszukuje
świata bez końca, nie ładuje chunków i ponownie wykorzystuje bufor. Mesher
pomija puste warstwy nad najwyższym modelem w sąsiedztwie. Skala światła
używa krzywej Java `n / (60 - 3n)`, z tablicą dla całkowitych poziomów 0–15.
Wierzchołki zwykłych brył dostają uśrednienie światła sąsiednich komórek;
diagonalna próbka nie przechodzi przez dwa pełne okludery. AO i kierunek
ściany pozostają osobnymi czynnikami. Niepełne modele z historycznie
nieprzezroczystym ID dostają światło powierzchni z sąsiedniego powietrza,
a nie z wnętrza litej komórki. Nie zmieniano przez to kolizji ani heightmapy
skrzyni. Ambient zmniejszono z 0,13 do 0,04, nocny dodatek od nieba z 0,22
do 0,10. Opcja jasności nadal działa i nie kasuje zapisanych preferencji.

To więcej pracy niż dawne pojedyncze kolumny. W lokalnym porównaniu Node 22
(sześć seedów × 20 przebudów, wcześniej wygenerowane 3×3 chunki) średnia
wyniosła około **12,5 ms/przebudowę**, wobec **8,6 ms** dla poprzedniego meshera;
najszybsze serie około 5,0 i 3,3 ms. Wyniki zależą od rozgrzania JIT i obciążenia
sandboxa. To pomiar CPU meshera, **nie** obietnica FPS na telefonie. Zachowano
istniejący budżet przebudów i opcje wydajności; nie dodawano buforów światła
utrzymywanych osobno dla każdego chunka.

## Oryginalne grafiki i odtworzenie

Minecraft Java Edition **1.20.4**, lustro
[InventivetalentDev/minecraft-assets](https://github.com/InventivetalentDev/minecraft-assets/tree/90d256dfee7b6fd8014e1bc3b107e64a530c5f9b/assets/minecraft/textures),
commit `90d256dfee7b6fd8014e1bc3b107e64a530c5f9b`:

- `entity/chest/normal.png`, `normal_left.png`, `normal_right.png` — 64×64;
- `block/rail.png`, `rail_corner.png`, `powered_rail.png`,
  `detector_rail.png` — 16×16.

```sh
python3 scripts/compile-java-blocks.py
```

Kompilator potrzebuje Python 3 i uwierzytelnionego `gh`, ale bez Pillow.
Wynik to `src/game/art/javaBlocks.generated.ts`; cache `.cache/java-blocks/`
nie wchodzi do Git. Build i gra nie pobierają tych grafik z sieci. Szyny
nakładane są po proceduralnym wykańczaniu atlasu, więc zachowują oryginalne
piksele i przezroczystość. Test sprawdza wszystkie piksele czterech kafelków
oraz rzeczywiste krawędzie połączeń we wszystkich dziesięciu kształtach.

**Grafiki Mojang/Microsoft nie podlegają MIT projektu.** Lustro ani niniejszy
dokument nie przyznają prawa redystrybucji. Zobacz
[Minecraft-NOTICE.txt](../public/Minecraft-NOTICE.txt).

## Zapisy, sieć i ograniczenia

- Poprzednie ID szyn 328–330 pozostają wariantem północ–południe. Dopisano
  **453–455** dla izolowanego wariantu wschód–zachód. Kształt połączeń jest
  wyliczany, bez nowej tabeli stanów ani modyfikowania działek sąsiadów.
- Creative pokazuje jedną pozycję na rodzaj toru. Zwykły drop, Jedwabny Dotyk
  i ŚPM normalizują oś do bazowego przedmiotu. Po zniszczeniu podłoża tor też
  znika. W dłoni i jako drop jest płaską szyną, nie kostką metalu.
- Nie zmieniano starych ID, zapisów, płynów ani domyślnej skali GUI 2.
  Bez migracji SQL; obecny zakres protokołu 0–511 obejmuje nowe warianty.
  Starsze klienty muszą odświeżyć stronę, aby znały nowe ID.
- To nie pełny silnik światła ani renderer Minecrafta. Nie dodano wagoników,
  kompletnego zasilania torów, przełączania rozjazdów redstonem, waterloggingu,
  pełnej propagacji przez kształt każdej częściowej bryły czy ray tracingu.
  Skrzyżowania z więcej niż dwoma sąsiadami rozstrzygane są deterministycznie
  według zapisanej osi; to nie pełna logika zwrotnicy Java.

## Weryfikacja

- `npm run typecheck`, `npm test`, `npm run build`.
- **4226** asercji silnika (148 więcej niż przed tą zmianą), **386** audio,
  **327** UI, **5** konta oraz **2** testy bootstrapu: łącznie **4946**.
- Nowe regresje: rzeczywiste stawianie według spojrzenia, wszystkie łuki
  i podjazdy, styki chunków, zapis osi, creative/drop/ŚPM/Jedwabny Dotyk,
  usunięcie podłoża, oryginalne piksele i UV, model przedmiotu skrzyni,
  wygładzenie i aktualizacja światła już otwartego wieka, zamknięcie wejścia,
  liście/woda, boczne światło, usunięcie emitera i edycje sieciowe.
- Chromium 153 / WebGL (SwiftShader): kontrolowane sceny szyn i skrzyń,
  dzień/noc, pokój z zamkniętym dachem oświetlony przez wejście i okno,
  ten sam pokój po dodaniu pochodni; kontrola ikon. Oddzielnie uruchomiony
  produkcyjny build 4.10.0 i faktyczne wejście do załadowanego świata creative.
  Bez błędów JS, konsoli ani kompilacji shaderów. Nie jest to test dwóch
  prawdziwych graczy publicznych ani pomiar sprzętu użytkownika.
