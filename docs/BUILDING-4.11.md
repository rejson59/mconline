# BlockCraft 4.11.0 — schody i płyty

## Co było niezgodne

Schody miały tylko dolną połówkę, cztery proste kierunki i dwie niezależne
bryły z rozciągniętym kafelkiem. W dłoni i w ikonie były kostką. Zwykły
raycast trafiał w cały voxel, także w pustą część schodów lub płyty. Obrys
oraz pęknięcia również rysowały sześcian. Stawianie odwracało kierunek
wznoszenia schodów względem spojrzenia.

Kod łączenia płyt istniał, ale kontrola zajętej kratki odrzucała ją przed
połączeniem; dodatkowo wybór górnej połowy nie uwzględniał wysokości kliknięcia
boku. Stary kod zamierzał zmieniać połówki w zwykłe deski/kamień, co traciłoby
informację, że gracz użył dwóch płyt.

## Zachowanie 4.11

- Wszystkie siedem istniejących materiałów schodów: dół/góra, N/E/S/W,
  `straight`, `outer_left/right`, `inner_left/right`.
- Reguła przód/tył i bocznego dalszego ciągu schodów. Inny materiał może
  połączyć się w narożnik, ale połowa musi pasować. Sąsiedzi są tylko
  odczytywani; obliczanie narożników nie zapisuje cudzych działek.
- Wyższy stopień ustawiany zgodnie ze spojrzeniem. Klik spodu daje górne
  schody; przy boku decyduje faktyczne miejsce trafienia promienia. Tak samo
  wybierane są połówki płyt (równo 0,5 na boku wybiera dół).
- Wypełnienie brakującej połowy płyty tego samego materiału tworzy osobny
  stan podwójnej płyty. Zniszczenie właściwym narzędziem oddaje **dwie płyty**,
  także przy Jedwabnym Dotyku. Trzecia płyta nie znika w istniejącej podwójnej
  płycie — można ją położyć wyżej. Nie można łączyć różnych materiałów.
- Walidacja kolizji korzysta z faktycznej bryły, również dla żywych mobów.
  Dozwolona jest pusta część schodów, ale nie wstawienie bryły w gracza
  lub moba. Odrzucenie nie zużywa przedmiotu.
- Zwykłe kopanie, Jedwabny Dotyk i ŚPM dają bazowy przedmiot zamiast osobnych
  stosów każdego kierunku/położenia. Creative pokazuje dotychczasowe pozycje.

## Wspólna geometria

`buildingShapes.ts` jest niezależne od świata, WebGL i ID bloków. Wyznacza
rozłączne pudełka kolizji, a następnie granicę zajętych połówek komórki.
Wewnętrzne powierzchnie są usuwane, sąsiednie współpłaszczyznowe prostokąty
łączone. Małe, ograniczone cache kształtów nie rosną wraz ze światem.

Świat, trzymane przedmioty, dropy i izometryczne ikony używają tych samych
powierzchni. UV zachowują współrzędne w obrębie całego bloku: osiem pikseli
boku płyty, zamiast całego kafelka ściśniętego na pół wysokości. Celowanie,
kolizje i promienie linii widzenia korzystają z tej samej bryły. Obrys
i nakładka pęknięć są aktualizowane tylko przy zmianie kształtu; stare
geometrie są zwalniane. Po przejściu na zwykły blok wraca zwykły sześcian.

Referencja: Java **1.20.4**, lustro `InventivetalentDev/minecraft-assets`,
commit `90d256dfee7b6fd8014e1bc3b107e64a530c5f9b`:

- [blockstates/oak_stairs.json](https://github.com/InventivetalentDev/minecraft-assets/blob/90d256dfee7b6fd8014e1bc3b107e64a530c5f9b/assets/minecraft/blockstates/oak_stairs.json),
- `models/block/{stairs,inner_stairs,outer_stairs}.json` tej samej rewizji.

Sprawdzono wszystkie **40** zajętości modeli po obrotach x/y z blockstate:
cztery kierunki × dwie połowy × pięć kształtów. Mała tablica masek w testach
to geometryczny punkt odniesienia, nie kopia tekstur. Nie dodano nowych
zasobów Mojang ani zależności; używane są istniejące kafelki atlasu. Ich
własność pozostaje opisana w `public/Minecraft-NOTICE.txt`.

## Zgodność i granice zakresu

- ID **456–483**: górne schody, siedem materiałów po cztery kierunki.
- ID **484–490**: podwójne płyty, siedem materiałów.
- Stare ID pozostają niezmienione. Nowe narożniki są wyliczane również dla
  wcześniej postawionych schodów; bez przepisywania świata i nowych tabel.
- Stare pełne deski/kamień nie są rozpoznawane wstecz jako podwójne płyty.
  Nowe połączenia zachowują tę informację dzięki nowemu ID.
- Istniejący zakres sieciowy 0–511 obejmuje nowe stany. **Bez migracji SQL**.
  Starsze karty trzeba odświeżyć. Preferencje, skala GUI 2, tory i skrzynie
  z poprzedniego wydania pozostają zachowane.
- To nie pełny klient Java. Nie dodano waterloggingu, wszystkich materiałów
  schodów, pełnych reguł przenikania światła przez każdą częściową bryłę,
  kompletnych tabel łupów od eksplozji ani przebudowy wszystkich pozostałych
  modeli bloków. Przedmiot schodów jest standardowym prostym modelem —
  narożnik wynika dopiero z sąsiedztwa w świecie.

## Weryfikacja

- `npm run typecheck`, `npm test`, `npm run build`, `git diff --check`.
- **5654** asercje silnika, **386** audio, **327** UI, **5** konta,
  **2** bootstrapu, łącznie **6374**. O **1428** więcej asercji silnika niż 4.10.
- Regresje wszystkich 40 geometrii: maski referencyjne Java, objętość,
  pole powierzchni, zewnętrzny kierunek trójkątów, brak ukrytych ścian,
  zakres UV i cache. Do tego siedem materiałów, dropy/narzędzia/creative,
  rzeczywiste stawianie, mieszane materiały, kontynuacje schodów,
  granice chunków także na ujemnych współrzędnych, zapis i zmiany sieciowe
  bez zmiany nieprzezroczystości. Prawdziwa fizyka pokonuje oba stopnie
  bez skoku w czterech kierunkach przy 60/30/10 aktualizacjach na sekundę.
- Testy płyt używają rzeczywistego raycastu. Sprawdzono łączenie obu połówek,
  kliknięcia boku, trzecią płytę, różne materiały, bezpieczeństwo gracza/moba,
  brak utraty przedmiotu, zachowanie dwóch dropów i zapis podwójnego stanu.
- Chromium 153 / SwiftShader: rzeczywisty WebGL prostych/narożnych/górnych
  schodów i płyt, widok z góry i z boku, modele w przestrzeni i ikony.
  Osobno start produkcyjnego 4.11.0 i wejście do załadowanego świata creative;
  rzeczywisty `Game` przełącza obrys płyty (0,502 z marginesem) na pełny
  sześcian (1,004). Brak błędów JS, konsoli i shaderów. To nie test dwóch
  prawdziwych klientów publicznych ani telefonu użytkownika.
- Lokalny benchmark CPU: sześć seedów × 20 przebudów, wcześniej wygenerowane
  sąsiedztwo 3×3: średnio około **10,0 ms/chunk**, najszybsza seria **4,5 ms**.
  To nie pomiar FPS ani deklaracja przyspieszenia względem innego wydania.
