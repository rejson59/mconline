# BlockCraft 🟩

Gra sandboxowa w stylu **Minecraft** działająca w całości w przeglądarce – bez instalacji, bez serwera i bez pobierania assetów z sieci.

**Wersja 1.9 „Czysty ekwipunek”**: wszystkie **ikony przedmiotów zostały narysowane od nowa** – każdy przedmiot wygląda teraz jak to, czym naprawdę jest: mięso to mięso (kotlety z żyłką tłuszczu, udko z kością), sztabki mają fazy, diament i szmaragd są szlifowane, kompasy i zegary mają tarcze, nożyce są skrzyżowane, krzesiwo ma krzemień i iskry, a wiadra trzymają wodę i lawę z uchwytem na uchu. Ikony są spójne w ekwipunku, na pasku, u stołów, w okienkach handlu i na upuszczonych przedmiotach w świecie 3D. Do tego **perła Endu jest rzucana** (PPM): leci jak pocisk, a gracz teleportuje się w miejsce upadku (2 obrażenia, krótki odstęp między rzutami). Netherowa gospodarka ma wreszcie sens: **pył jasnogłazu składa się w jasnogłaz**, **magmowy krem w blok magmy**, **płomienna różdżka** (rzadki łup Ghasta, paliwo na 60 s) buduje **statyw alchemiczny** z brukiem, **łza Ghasta + obsydian = płaczący obsydian**, **brodawka Netheru** (skrzynie w jaskiniach) farbuje wełnę na czerwono, a netherrack wytapia się na netherową cegłę. Nowe osiągnięcie: „Skok przez wymiar”.

**Wersja 1.8 „Prawdziwy Nether”**: portal prowadzi teraz do **osobnego wymiaru** – Nether to drugi, w pełni niezależny świat z własnym generatorem (falująca podłoga z netherracku, piaski dusz, jaskinie, ogromna jaskinia pod skalnym stropem z jasnogłazami, kwarc, magma, bazaltowe filary i morze lawy), własnymi chunkami, modyfikacjami bloków i zapisem. **Nadświat nigdy już nie jest nadpisywany** – stare wejście do Netheru skanowało i „stemplowało” teren wioski pośrodku mapy, przez co światy wchodziły sobie nawzajem w drogę. Wejście i wyjście są **budżetowane** (jeden chunk przy lądowaniu zamiast 81 naraz), więc portal **nie zawiesza klatek**, a powrót prowadzi dokładnie do portalu, przez który wszedłeś (w Netherze zawsze stoi gotowa rama powrotna). Osobne są też **moby, przedmioty, strzały, TNT i kule XP** obu wymiarów, skrzynie i piece (klucze z prefiksem wymiaru – piec w Netherze nie kasuje pieca w nadświecie), a w Netherze panuje stałe, czerwone światło: bez deszczu, snu i cyklu dnia. Poprawki: piec w niezaładowanym chunku **nie traci już zawartości**, spawn mobów nigdy nie wypadnie na dno lawy, a postęp w Netherze zapisuje się w zapisie gry (`netherMods`, `isInNether`, `portalExit`).

**Wersja 1.7 „Nether & Redstone”**: pierwsze portale Netheru, redstone (przewód, dźwignie, przyciski, lampy, tłoki, obserwator, dispenser, dzwonek), ruda kwarcu i kilka nowych bloków.

**Wersja 1.6 „Wioska”**: świat stał się **zamieszkały**. Nowy generator stawia **wioski** – wyrównany plac, krzyżowe drogi ze **ścieżek**, **studnię** z wodą, domy z drzwiami, szybami i wnętrzami (łóżko, skrzynia, piec, stół rzemieślniczy, pochodnie), **bibliotekę** z biblioteczkami, **kuźnię** z piecami i skrytką, **zagrody** z płotem, wodnymi rowkami i pszenicą, stogi **siana**, **latarnie** wzdłuż dróg i **plac z dzwonem**. W osadach mieszkają **mieszkańcy pięciu zawodów** (rolnik, kowal, bibliotekarz, pasterz i budowniczy) – **PPM** otwiera **ekran handlu**: oddajesz surowce, dostajesz **szmaragdy**, jedzenie i rzadsze przedmioty (żelazne narzędzia i zbroję, diamenty, bloki, latarnie). Każda oferta ma zapas, który wyczerpuje się i **uzupełnia po ok. 2,5 minuty**, a każda wymiana daje mieszkańcowi doświadczenie: od **Ucznia** do **Arcymistrza** odblokowuje lepsze towary. Osad strzegą **żelazne golemy** – atakują potwory, a skrzywdzony mieszkaniec sprowadza je na gracza. Doszły też **ruda szmaragdu** (góry i głębokie warstwy, żelazny kilof) oraz **ścieżka** (łopata na trawie), **siano** (paliwo), **latarnie** i **dzwon**, a minimapa pokazuje znalezione wioski.

**Wersja 1.5 „Zaklęcia”** zostaje: nowy system **zaklęć** – **ruda lazurytu** w jaskiniach, **trzcina cukrowa** nad wodą (→ papier → książka), **stół zaklęć** z recepturą z 2 diamentów, 4 obsydianów i książki, a obok niego pierścień **biblioteczek** (do 15), które podbijają poziom ofert do 30. Jedenaście zaklęć podzielonych na narzędzia, broń i pancerz: **Wydajność**, **Szczęście**, **Jedwabny dotyk**, **Niezniszczalność**, **Ostrość**, **Moc**, **Nieskończoność**, **Odrzut**, **Grabież**, **Ochrona** i **Lekki krok**. Każdy wybór zużywa punkty doświadczenia oraz **1–3 lazurytu**, a przedmiot w stole czeka na ciebie, aż wrócisz. Zaklęte przedmioty świecą animowaną poświatą, mają fioletowe nazwy w podpowiedziach i nowe osiągnięcia („Pierwsze zaklęcie”, „Mistrz zaklęć”). Comenda `/enchant <nazwa> [poziom]` pozwala zaklnąć trzymany przedmiot od ręki.

**Wersja 1.4 „Pancerz”**: system **doświadczenia** (kule XP od mobów i rud, poziomy, pasek nad paskiem), **pancerz** w czterech zestawach (skóra, żelazo, złoto, diament × kaptur/napierśnik/nogawice/buty) ze slotami w ekwipunku, wytrzymałością i redukcją obrażeń, **tarcza** przyłapująca strzały i osłabiająca ciosy, oraz nowy mob – **wilk**, którego zatamej surowym mięsem; wierny piesek podąża za graczem i broni go przed potworami. Krowy dają skórę.
Wersja 1.3 „Łowy” zostaje: łuk i strzały, szkieletowe stwory strzelają z dystansu, pająki wspinają się po ścianach i dają strunę, kury dają pióra, a z 9 sztabek żelaza, złota lub diamentów można wykonać bloki magazynowe. Nowy typ świata – **płaski** – do budowania bez przeszkód, oraz **eksport i import zapisów** do pliku JSON.
Wersja 1.2 „Dom” zostaje: skrzynie (także w jaskiniach), dwublokowe drzwi, drabiny, płot, właz, ognisko, nożyce, krzesiwo, kompas i zegar.
Wersja 1.1 zostaje: narzędzia z wytrzymałością, głód, piec, farming, wiadra, pochodnie, łóżko, deszcz, creepery i kilka światów.
Proceduralny świat, kopanie i budowanie, crafting, moby, TNT, cykl dnia i nocy oraz tryb kreatywny z lataniem.

Zbudowana w **React 19 + TypeScript + Three.js + Vite + Tailwind CSS 4**, gotowa do publikacji na **GitHub Pages** jednym kliknięciem.

---

## 🎮 Sterowanie

| Klawisz / przycisk | Akcja |
| --- | --- |
| `W A S D` | ruch |
| mysz | rozglądanie się (po kliknięciu – blokada kursora) |
| `Spacja` | skok / pływanie w górę |
| `Spacja` ×2 lub `F` | latanie (tryb kreatywny) |
| `Shift` | skradanie / lot w dół |
| `W` ×2 lub `Ctrl` | sprint |
| LPM (przytrzymaj) | kopanie / atak / podpalenie TNT |
| PPM | postawienie bloku / użycie stołu rzemieślniczego |
| ŚPM | wybór bloku z celownika |
| `1`–`9`, kółko myszy | wybór slotu na pasku |
| `E` | ekwipunek i wytwarzanie |
| `Q` | wyrzucenie przedmiotu |
| `T` lub `/` | czat i komendy |
| `PPM` na jedzeniu | jedzenie (głód) |
| `PPM` na piecu | przetapianie |
| `PPM` na łóżku | sen w nocy i punkt odrodzenia |
| `PPM` na drzwiach lub włazie | otwórz / zamknij |
| `PPM` na skrzyni | schowek |
| drabina + `W` lub spacja | wspinaczka |
| nożyce + LPM na owcy | wełna bez zabijania |
| krzesiwo + `PPM` na TNT | podpalenie |
| łuk: przytrzymaj `PPM`, puść | wystrzał ze strzały |
| perła Endu + `PPM` | rzut perłą – teleportacja w miejsce upadku |
| kompas / zegar w ręce | kierunek odrodzenia i pora dnia |
| motyka + `PPM` | grządka pod pszenicę |
| `PPM` na wilku z surowym mięsem | zatamej wilka (podąża i broni gracza) |
| `PPM` na stole zaklęć | ekran zaklęć (wrzuć przedmiot, wybierz ofertę) |
| `PPM` na mieszkańcu | ekran handlu (wymiana towarów na szmaragdy i odwrotnie) |
| `PPM` na dzwonie | zwołanie mieszkańców na plac |
| łopata + `PPM` na trawie | ścieżka (jak w wioskach) |
| tarcza w ręku | przyłap strzały, ciosy tracą połowę mocy |
| sloty pancerza (w `E`) | załóż / zdejmij pancerz (4 elementy) |
| `M` | minimapa |
| `F3` | informacje debugowania |
| `Esc` | pauza |

### Na telefonie i tablecie

Gra wykrywa ekran dotykowy i włącza sterowanie dotykowe:

* **lewy drążek** (dolna-lewa część ekranu) – ruch,
* **przeciąganie palcem** po pozostałej części ekranu – rozglądanie się,
* przyciski po prawej – **skok / lot**, **kopanie**, **stawianie**,
* przyciski w lewym górnym rogu – **pauza** i **ekwipunek**,
* dwukrotne dotknięcie przycisku skoku w trybie kreatywnym – latanie.

### Komendy czatu

```
/help                      lista komend
/gamemode <survival|creative>
/time set <day|night|noon|midnight>
/weather <clear|rain>
/tp <x> <y> <z>            teleportacja
/give <nazwa|id> [ilość]   np. /give wegiel 16, /give drewniany_kilof, /give zelazny_kaptur
/summon <mob> [zawód]        np. /summon villager kowal, /summon golem
/village                   teleportacja do najbliższej wioski
/xp <ilość>               dodaj doświadczenie (np. /xp 50)
/enchant <nazwa> [poziom]  zaklnij trzymany przedmiot (np. /enchant wydajnosc 5)
/heal  /kill  /seed  /spawn  /clear  /blocks
```

---

## 🚀 Uruchomienie lokalne

Wymagany **Node.js 20+**.

```bash
npm install      # instalacja zależności
npm run dev      # serwer developerski -> http://localhost:5173
npm run build    # produkcyjny build do katalogu dist/
npm run preview  # podgląd produkcyjnego builda
npm run typecheck
```

Build jest **pojedynczym plikiem `dist/index.html`** (JS i CSS są wbudowane w HTML), a jedynym dodatkowym plikiem jest `dist/menu-bg.jpg`.
Dzięki temu grę można otworzyć nawet bezpośrednio z dysku (`file://`) albo wrzucić na dowolny hosting statyczny.

---

## 🌐 Publikacja na GitHub Pages

### Wariant A – automatycznie (zalecany)

W repozytorium jest gotowy workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).

1. Wypchnij projekt na gałąź `main`.
2. Wejdź w **Settings → Pages** i jako *Source* wybierz **GitHub Actions**.
3. Po każdym pushu na `main` workflow zbuduje grę (`npm ci` → `npm run typecheck` → `npm run build`) i opublikuje katalog `dist/`.

Gra będzie dostępna pod adresem:

```
https://<użytkownik>.github.io/<repo>/
```

### Wariant B – ręcznie na gałęzi `gh-pages`

```bash
npm run deploy:branch   # build + publikacja dist/ na gałęzi gh-pages
```

Następnie w **Settings → Pages** ustaw *Source: Deploy from a branch* i wybierz `gh-pages` / `/ (root)`.

### Dlaczego build działa pod `/nazwa-repozytorium/`?

Katalogi projektowe GitHub Pages są serwowane z podkatalogu (`https://user.github.io/repo/`), więc wszystkie ścieżki w buildzie są **względne**:

* `vite.config.ts` ustawia `base: "./"`,
* tło menu jest ładowane jako `./menu-bg.jpg` (`import.meta.env.BASE_URL`) – **nie** jako `/menu-bg.jpg`,
* `public/.nojekyll` wyłącza przetwarzanie przez Jekylla (pliki zaczynające się od `_` nie znikają),
* cały JavaScript i CSS są wbudowane w `index.html`, więc nie ma żadnych zewnętrznych `assets/*` do zgubienia.

---

## 🧱 Co jest w grze

* **Proceduralny świat** – kontynenty, wzgórza, góry, jaskinie, rudy (węgiel, żelazo, złoto, diament), biomy: równiny, las, las brzozowy, pustynia z kaktusami, tundra, góry, plaża, ocean.
* **Wioski (1.6)** – generator stawia na równinach, w lasach i na pustyni osady z krzyżowymi drogami, studnią, domami (drzwi, szyby, dach ze schodkami, łóżko, skrzynia, piec, stół rzemieślniczy, pochodnie), biblioteką, kuźnią, zagrodami z pszenicą, stogami siana, latarniami i dzwonem. Ścieżki, siano, latarnie, ruda i blok szmaragdu oraz dzwon to nowe bloki; minimapa znaczy odkryte wioski, a komenda `/village` teleportuje do najbliższej.
* **Mieszkańcy i handel (1.6)** – pięć zawodów z własnym ubiorem i ofertami, rosnący poziom (Uczeń → Czeladnik → Mistrz → Arcymistrz), zapasy ofert i ich uzupełnianie, ceny w szmaragdach. Mieszkańcy krążą po osadzie, uciekają przed potworami i chowają się przy dzwonie. **Żelazne golemy** patrolują wioskę, atakują zombie, pająki, creepery i szkielety, a po skrzywdzeniu mieszkańca ruszają na gracza (upuszczają przy tym sztabki żelaza i maki).
* **Ponad 60 bloków** (teraz także ruda lazurytu, blok lazurytu, stół zaklęć, trzcina, ścieżka, siano, latarnia, ruda i blok szmaragdu oraz dzwon) (trawa, rudy, wełna, TNT, obsydian, pochodnia, sadzonki, grządka, pszenica, łóżko, rozpalony piec) z proceduralnie rysowaną teksturą 16×16 px – atlas + ikony 3D do ekwipunku.
* **Światło blokowe**: pochodnie, lawa i rozpalony piec rozjaśniają jaskinie także w nocy.
* **Narzędzia** (drewno, kamień, żelazo, diament): kilof, siekiera, łopata, miecz i motyka. Mają wytrzymałość i przyspieszają kopanie właściwych bloków. Węgiel chce dowolnego kilofa, żelazo i złoto – kamiennego, diamenty – żelaznego, obsydian – diamentowego.
* **Głód i jedzenie**: jabłka z liści, surowe i pieczone mięso, chleb z pszenicy. Regeneracja działa tylko przy pełnym brzuchu; sprint wymaga jedzenia.
* **Piec**: PPM otwiera przetapianie (ruda → sztabka, piasek → szkło, pień → węgiel drzewny, mięso). Paliwem jest węgiel, deski, patyki albo pnie.
* **Uprawa**: motyka robi grządkę, nasiona (z trawy) rosną w pszenicę szybciej przy wodzie. Sadzonki z liści wyrastają w drzewa.
* **Wiadra** z żelaza zbierają i stawiają wodę oraz lawę.
* **Prawdziwe craftowanie wzorowe** – siatka 2×2 w ekwipunku i 3×3 u stołu rzemieślniczego. Kilof to trzy bloki nad dwoma patykami, łuk to patyki na ukos ze struną, a skrzynia to osiem desek w ramie. Wzory pasują w dowolnym miejscu siatki, a PPM kładzie po jednym przedmiocie. Lista receptur (z filtrem „tylko możliwe”) działa nadal – szybciej, gdy wiesz czego chcesz. Wśród nich łuk (3 patyki + 3 struny) i strzały (krzemień + patyk + pióro) oraz bloki żelaza, złota i diamentów (9 sztabek → 1 blok i z powrotem).
* **Moby**: świnie, owce, krowy (dają też skórę) i kury (zostawiają jedzenie, wełnę albo pióra), **mieszkańcy** (neutralni, handlują, uciekają przed potworami, nie dają łupów – uważaj, żeby nie rozgniewać golemów), **żelazne golemy** (100 HP, 7 obrażeń, bronią osady, sypią żelazem i makami), zombie (atakują w nocy i w jaskiniach, palą się w dzień), creepery (podchodzą i wybuchają), **pająki** (szybkie, wspinają się po ścianach – nawet kilka bloków w górę, dają strunę), **szkieletowe stwory** – trzymają dystans i strzelają z łuku, a same rzucają kości, strzały i czasem łuk – oraz **wilki**: dzikie kręcą się po łąkach, a surowym mięsem (PPM) zatamej je; przybrane wilki (czerwona grzywa) podążają za graczem, regenerują się i atakują potwory w jego obronie.
* **Pancerz i tarcza**: cztery zestawy (skóra, żelazo, złoto, diament) po cztery elementy – kaptur, napierśnik, nogawice, buty. Wytwarzasz je wzorowo u stołu (5/8/7/4 kawałki materiału), zakładasz w slotach nad ekwipunkiem (E), a każdy punkt pancerza redukuje obrażenia o 4% (do 80%). Zbroja ma wytrzymałość, pęka przy silnych ciosach i wypada z Ciebie przy śmierci. **Tarcza** (6 desek + żelazo) w dłoni przyłapuje strzały szkieletów i osłabia ciosy wręcz o połowę.
* **Zaklęcia (1.5)**: ruda lazurytu (pas y = 9–44, potrzebny kamienny kilof, 4–8 kryształów), trzcina cukrowa rosnąca w kępach przy brzegach wody i w światach płaskich (ścina się samą, rośnie dalej przy wodzie, maks. 3 segmenty), papier z trzech trzcin i książka z papieru ze skórą. **Stół zaklęć** (2 diamenty + 4 obsydiany + książka, tylko przy stole 3×3) daje trzy oferty; każda kosztuje punkty doświadczenia i lazuryt (1–3), a jakość rośnie z liczbą **biblioteczek w pierścieniu wokół stołu** (maks. 15 → poziom 30). Zaklęcia: Wydajność (szybsze kopanie), Szczęście (więcej rud i plonów), Jedwabny dotyk (blok w oryginalnej formie), Niezniszczalność (rzadsze zużycie), Ostrość (obrażenia), Moc (strzały), Nieskończoność (łuk bez strzał), Odrzut, Grabież (dodatkowe łupy), Ochrona (pancerz) i Lekki krok (mniejszy upadek). Zaklęte przedmioty mają poświatę, fioletowe nazwy w podpowiedziach i przeżywają śmierć razem z ekwipunkiem.
* **Doświadczenie**: moby i rudy (węgiel, żelazo, złoto, diament) zrzucają zielone kule XP, które przyciąga do gracza; pieczenie w piecu i strzyżenie owiec też dają punkty. Pasek nad paskiem pokazuje postęp, a poziom 10 to osiągnięcie „Weteran”. Doświadczenie zapisuje się razem ze światem.
* **Fizyka**: kolizje AABB, grawitacja, obrażenia od upadku, pływanie i tonięcie, lawa, kaktusy, wybuchy TNT z odrzutem.
* **Realistyczny świat**: piasek i żwir się przewracają, gdy wykopiesz bloczek pod nimi (blisko gracza widać spadające bloki, a przygniść mogą głowę), a liście odpadają, gdy w okolicy nie zostanie żaden pień – tak jak w Minecraftcie.
* **Świat i cykl dnia**: 10-minutowa doba, wschody i zachody słońca, gwiazdy, chmury, mgła pod wodą i w lawie.
* **Do 8 światów** w `localStorage` (nazwa, typ świata, modyfikacje bloków, pozycja, ekwipunek, głód, piece, osiągnięcia) + autozapis co 30 s, przy zamykaniu karty i przy chowaniu karty. Stary pojedynczy zapis jest przenoszony automatycznie.
* **Eksport i import zapisów** – przyciski w menu głównym pobierają wszystkie światy do pliku `blockcraft-swiety.json` i wczytują go z powrotem (np. przy zmianie przeglądarki albo komputera).
* **Przedmioty leżą na ziemi** po kopaniu, śmierci i zabiciu moba – podnosisz je, podchodząc.
* **Pogoda**: deszcz i śnieg (w tundrze i górach), błyskawice, ciemniejsze niebo. Na pustyni nie pada.
* **Muzyka ambientowa** – rzadkie, ciche frazy pentatoniczne w tle podczas eksploracji (generowane w Web Audio, bez żadnych plików dźwiękowych).
* **Minimapa** (klawisz `M`) obraca się razem z graczem.
* **Dom**: dwublokowe drzwi (PPM otwiera), skrzynia na 27 slotów, drabina, płot, właz i ognisko, na którym piecze się mięso. Moby nie przeskakują płotu ani zamkniętych drzwi.
* **Jaskinie** czasem kryją starą skrzynię z pochodniami, jedzeniem i rzadziej żelazem albo diamentem.
* **Nożyce** zbierają liście i wełnę z żywej owcy. Żwir czasem daje krzemień, a krzesiwo podpala TNT. Kompas wskazuje punkt odrodzenia, zegar porę dnia.
* **Osiągnięcia** za drewno, kilof, diament, sen, creepera, dom, łuk, strunę, lazuryt, książkę, stół zaklęć, pierwsze zaklęcie, a od 1.6 także za odkrycie wioski, pierwszą wymianę, 25 wymian („Kupiec”), szmaragd, spotkanie golema i dzwon, a od 1.9 za teleportację perłą Endu.
* **Linki do świata**: w pauzie przycisk *„Kopiuj link do świata”* zapisuje ziarno i tryb w adresie (`#seed=1234&mode=creative`) – po otwarciu takiego linku menu jest już wypełnione.
* **Pełny ekran** jednym przyciskiem (menu główne i pauza) oraz **usuwanie zapisu** z menu głównego.
* **Awaryjne komunikaty**: brak WebGL, błąd inicjalizacji czy zablokowany dźwięk nie zostawiają czarnej strony.
* **Tryb kreatywny**: latanie, natychmiastowe niszczenie, nieograniczone bloki i przedmioty, brak obrażeń i głodu.
* **Świat płaski** – przy tworzeniu świata wybierz typ *Płaski*: równa trawna równina na wysokości 64 z rudami pod spodem i kilkoma drzewami. Idealny do budowania i szybkiego kopania.

## 📁 Struktura projektu

```
index.html                 # szablon strony (meta, favicon, ekran ładowania)
public/
  menu-bg.jpg              # tło menu głównego
  .nojekyll                # dla GitHub Pages
src/
  main.tsx                 # start aplikacji + komunikat o braku WebGL
  App.tsx                  # menu ↔ gra, wczytywanie zapisu
  index.css                # styl w klimacie Minecrafta (Tailwind 4)
  components/
    Menus.tsx              # menu główne, pauza, ekran śmierci, czat
    GameView.tsx           # montowanie silnika, HUD, obsługa błędów
    HUD.tsx                # serca, głód powietrza, pasek, komunikaty, F3
    InventoryScreen.tsx    # ekwipunek i crafting
    EnchantScreen.tsx      # stół zaklęć (1.5)
    TradeScreen.tsx        # handel z mieszkańcami (1.6)
    TouchControls.tsx      # sterowanie dotykowe (telefony/tablety)
  game/
    engine.ts              # pętla gry, gracz, interakcje, zapis
    world.ts               # chunk'i, generator terenu, meshowanie
    village.ts             # generator wiosek (1.6)
    trading.ts             # zawody, oferty i poziomy mieszkańców (1.6)
    constants.ts           # rozmiary świata (CS/CH/SEA/FLAT_H)
    blocks.ts              # definicje bloków
    textures.ts            # proceduralny atlas tekstur i ikony
    physics.ts             # kolizje i ruch
    mobs.ts                # moby i ich AI (w tym tamed wilki)
    inventory.ts           # ekwipunek i receptury
    armor.ts               # statystyki pancerza i redukcja obrażeń
    enchant.ts             # zaklęcia: dane, oferty stołu, efekty (1.5)
    xp.ts                  # krzywa poziomu doświadczenia
    noise.ts               # szum Simplexa
    audio.ts               # dźwięki generowane przez Web Audio
.github/workflows/
  deploy-pages.yml         # automatyczna publikacja na GitHub Pages
.harness/                  # headless testy: node .harness/run.mjs (smoke.ts + ui.tsx)
```

## 🧪 Testy (bez przeglądarki)

```bash
npm run typecheck   # tsc --noEmit
npm test            # obie suity (silnik + UI)
npm run test:engine # tylko asercje na silnik
npm run test:ui     # tylko test interfejsu React
```

Runner `.harness/run.mjs` bundluje testy przez **esbuild** i uruchamia je w Node – nie trzeba niczego instalować dodatkowo.

`.harness/smoke.ts` to asercje na czysty silnik: generowanie świata (także płaskiego), bloki, przedmioty, ekwipunek i receptury (w tym papier, książka, biblioteczka i stół zaklęć), **system zaklęć** (dopasowanie, oferty, pierścień biblioteczek, zużycie XP i lazurytu, dropy ze Szczęściem i Jedwabnym Dotykiem), fizyka, AI mobów, piece i skrzynie, zapisy, osiągnięcia, tekstury oraz algorytm opadania liści – wszystko bez WebGL.
`.harness/ui.tsx` renderuje menu przez `react-dom/server` (bez przeglądarki), a gdy zainstalowany jest `jsdom` (`npm i --no-save jsdom`) montuje całe `<App/>`, przechodzi tworzenie świata i sprawdza, że brak WebGL kończy się czytelnym komunikatem, a nie białą stroną. Bez jsdom ten drugi krok jest pomijany.

## 🛠️ Rozwiązywanie problemów

| Problem | Rozwiązanie |
| --- | --- |
| Czarny ekran i komunikat o WebGL | Włącz akcelerację sprzętową w przeglądarce (Chrome: `chrome://settings/system`, Firefox: `about:preferences#general`). |
| Brak tła w menu | Sprawdź, czy plik `menu-bg.jpg` został wgrany razem z `index.html` (build kopiuje go z `public/`). |
| Brak dźwięku | Gra działa bez dźwięku, jeśli przeglądarka blokuje Web Audio – kliknij w ekran gry, aby odblokować dźwięk. |
| „Kliknij, aby kontynuować” i brak reakcji na klawiaturę | Kliknij w ekran gry – przeglądarka musi ponownie przejąć blokadę kursora. |
| Zbyt wolno na słabym sprzęcie | Zmniejsz *Zasięg renderowania* w **Esc → Opcje**. |
| Chcę przenieść światy na inny komputer | Menu główne → *Eksport zapisów*, a na drugim urządzeniu *Import zapisów*. |

## 📜 Licencja

Kod gry: **MIT** – rób z nim, co chcesz.
Projekt inspirowany grą *Minecraft* (Mojang Studios); nie jest z nią powiązany i nie zawiera jej zasobów – wszystkie tekstury rysowane są proceduralnie w przeglądarce.
