# BlockCraft 2.22 🐑

Gra sandboxowa w stylu **Minecraft** działająca w przeglądarce. Od 2.11 ma **jeden publiczny serwer**: wchodzisz jednym kliknięciem i budujesz wspólny świat razem ze wszystkimi, którzy są online – bez kodów, bez gospodarza i bez zakładania konta. Budowle zapisują się w chmurze (Supabase + Postgres), więc zostają po wyjściu i po odświeżeniu strony. Gra działa też offline i na telefonie.

**Wersja 2.22 „Moby i świat 1:1 jak w grze”** – owca i moby dokładnie jak w Minecrafcie:

* **Owca wygląda jak w grze.** Model owcy powstał z `QuadrupedEntityModel.getModelData(12)`: nogi mają **12 px** (wcześniej 6), więc tułów siedzi na właściwej wysokości, a runo (`sheep_wool`, dylatacja 1,75 px na torsie i 0,5 px na nogach) tworzy znany puchaty kształt z „skarpetkami”. Owca co 10–24 s opuszcza głowę i skubie trawę (`getNeckAngle`/`getHeadAngle`), a ostrzyżona po wypasie **odrasta** – klocek trawy zamienia się w ziemię, dokładnie jak `SheepEntity.eatGrass`.
* **Pełna paleta 16 kolorów wełny.** Doszło 10 brakujących bloków (pomarańczowa, karmazynowa, jasnoniebieska, jasnozielona, różowa, szara, jasnoszara, turkusowa, fioletowa, brązowa) – razem 16 barwników jak w grze. Owca strzyżona i zabita oddaje wełnę **swojego koloru** (`SHEEP_WOOL_BLOCKS`), a nie zawsze białą. Rozkład runa jest waniliowy: 83,6% białych, po 5% czarnych/szarych/jasnoszarych, 3% brązowych i 2% różowych.
* **Pudełka kolizji z wanilii.** Każdy mob ma wymiary z `EntityDimensions`: szkielet **0,6 × 1,99** (wcześniej 0,9 × 0,9, więc nie dało się trafić go w głowę), krowa 0,9 × 1,4, owca 0,9 × 1,3, golem 1,4 × 2,7, pająk 1,4 × 0,9, enderman 0,6 × 2,9, ghast 4 × 4. Creeper ma **20 HP** jak w grze.
* **Poprawione modele mobów.** Pająk ma odwłok na własnym zawiasie (`body1`, z = 9) – wcześniej cały tułów siedział w jednym miejscu i pająk wyglądał na „zgniecionego”. Szkielet trzyma ręce wzdłuż tułowia (wcześniej uniesione jak u zombie), a kura ma **obie nogi** z prawdziwej tekstury zamiast jednej żółtej kostki.
* **Pająk naprawdę się wspina.** Sonda ściany liczy się od krawędzi pudełka (`b.w / 2 + 0,35`), a nie od środka – przy szerokości 1,4 bloku pająk stał tuż przy ścianie i wcześniej nigdy nie zaczynał wspinaczki.
* **Testy.** `npm test` to **1833 kontrole silnika + 222 testy UI**. Nowa sekcja 2.22 sprawdza 12-pikselowe nogi owcy, pudełka kolizji sześciu mobów, 16 kolorów wełny, wypas z zamianą trawy w ziemię i odrastanie runa. `npx tsc --noEmit`, `npm test` i `npm run build` przechodzą.

**Wersja 2.21 „Bloki i przedmioty jak w grze”** – bryły, kolizje i statystyki 1:1:

* **Koniec billboardów.** Latarnia to waniliowy model z paczki (`template_lantern.json`): korpus 6×7 px, czapka 4×2 px i uchwyt z prętów, z UV każdej ściany z osobna. Dzwon składa się z kamiennych słupków i drewnianej belki (`bell_floor.json`) oraz serca dzwonu – trzech zwężających się brył z tekstury encji `entity/bell/bell_body`, bo w wanilii dzwon rysuje renderer encji. Statyw alchemiczny dostał słupek 2×14 px i trzy ramiona podstawy (`brewing_stand.json`). Wszystkie trzy mają też własny kształt w ręce i w ekwipunku.
* **Bloki z własnym modelem.** Płot (`render: 'fence'`) ma słupek 4×16 px i po dwa szczeble w stronę każdego sąsiada – łączy się też z pełnymi blokami. Pochodnia (`'torch'`) to dokładnie 2×10 px patyczka z kafelka, na ziemi i na ścianie. Skrzynia (`'chest'`) dostała **prawdziwą teksturę encji** (`entity/chest/normal.png`): kompilator wycina z niej przód, bok i wieko do trzech nowych kafelków (`chest_front/side/top` w `T`), a siatka rysuje korpus 0–10/16 i wieko 10–15/16 z osobnymi UV. Kowadło to cztery waniliowe elementy z `template_anvil`, ognisko – cztery bale w dwóch warstwach (plus ogień), ścieżka i grządka mają 15/16 wysokości z bokiem przyciętym o górny przezroczysty piksel, a lilia to płaski liść 0,25 px nad wodą.
* **Mniejsze modele, które wcześniej były sześcianami.** Szyna leży płasko na 1/16, rośliny (trawa, kwiaty, pszenica, trzcina, sadzonki) sięgają pełnej wysokości kratki, drabina to deska 0,3 px od ściany, a skrzynia/kaktus nie są już pełnymi blokami. W ręce trzymasz ten sam kształt, co w świecie.
* **Prawdziwe kolizje.** Nowa tabela `COLLISION` w `src/game/blocks.ts` (`collisionBoxes()`): płyta to pół bloku (górna i dolna), schody – dwie bryły, płot ma **1,5 bloku** wysokości, kaktus i skrzynia są węższe od kratki (14/16), łóżko 9/16, właz 3/16, ścieżka i grządka 15/16, ognisko 7/16, drzwi 3/16. Drabina i rośliny nie blokują ruchu.
* **Wchodzenie bez skoku.** `physics.ts` dostał `STEP_HEIGHT = 0.55`: gracz wchodzi na płytę i schodek jak w Minecrafcie, a pełny blok nadal zatrzymuje. `moveAxis` sprawdza kolizję o pół bloku wyżej, więc nie trzeba skakać na każdą płytę.
* **Narzędzia 1:1.** Trwałości 59 / 131 / 250 / 1561, obrażenia: pięść 1, miecze 4–7, topory 7–9, kilofy 2–5, łopaty 2,5–5,5. Kopanie liczy się waniliowo (1,5 × twardość z właściwym narzędziem, 5 × bez), obsydian diamentowym kilofem 9,4 s. Poziomy kilofów: złoto, diament, szmaragd i czerwony kamień wymagają żelaza, kwarcowi wystarczy drewno.
* **Dropy, jedzenie, stosy.** Bez wymaganego poziomu kilofa blok znika bez dropu (`canHarvest`). Trawa daje tylko ziemię, półka – 3 książki, liście – 5% sadzonki i 0,5% jabłka, żwir – 10% krzemienia, dojrzała pszenica – 1 pszenica i 0–3 nasion. Chleb i pieczona ryba po 5 punktów głodu, miód 6. Puste wiadro stackuje się do 16, pełne i mikstury zajmują slot; skórzany/żelazny/złoty/diamentowy pancerz ma punkty i trwałość z wanilii.
* **Rośliny.** Kaktus rośnie tylko na piasku i do trzech bloków, lilię kładzie się wyłącznie na wodzie, a pochodnia, sadzonka i lilia znikają razem z blokiem pod nimi.
* **Testy.** `npm test` to **1813 kontroli silnika + 222 testy UI**. Nowa sekcja 2.21 sprawdza modele (także latarni, dzwonu i statywu) i pudełka kolizji, step-up na płytę, zatrzymanie przez płot i pełny blok, pełną wysokość roślin, płaską szynę, trwałości i obrażenia, poziomy kilofów, dropy, jedzenie oraz stosy. `npx tsc --noEmit`, `npm test` i `npm run build` przechodzą.

**Wersja 2.20 „Poprawki grafiki”** – wszystko, co na zrzutach ekranu wyglądało źle:

* **Słońce i księżyc bez czarnych kwadratów.** Tekstury `sun.png` i `moon_phases.png` nie mają kanału alfa – ich tłem jest zwykła czerń. Kompilator atlasu zamienia teraz czerń na przezroczystość (`keyBlackSprite`), a w grze słońce i księżyc rysują się z `AdditiveBlending`, więc świecą jak w oryginale, bez czarnej ramki na niebie.
* **Latarnie, dzwon i pochodnia.** Latarnia i dzwon w paczce to **atlasy UV modelu**, a nie zwykłe tekstury – na sześcianie zostawiały czarne plamy. Teraz są sprite’ami z ikon przedmiotów (`item/lantern.png`, `item/bell.png`) na warstwie z wycinaniem alfa, nie blokują ruchu i stoją jak w grze. Pochodnia w dłoni i na ścianie używa tego samego mechanizmu.
* **Drzwi to naprawdę drzwi.** Zamiast sześcianu z drzwiami na każdej ścianie – cienka płyta **3/16** przy ościeżnicy (otwarte: przy zawiasie), górna połowa z szybą i ościeżnicą z bali. `specialBoxes()` w `src/game/world.ts` decyduje o kształcie, `tileUVInset()` przycina kafelek do widocznej części.
* **Kaktus i łóżko z własną bryłą.** Kaktus to prostopadłościan **14/16** (render type 7) z kafelkiem przyciętym o przezroczysty margines – koniec z „billboardami”. Łóżko ma wysokość **9/16** (render type 8), więc kołdra leży tylko na górze, a nie na wszystkich ścianach.
* **Dachy wiosek jak w Minecrafcie.** Nowy `gableRoof()` buduje dwuspadowy dach z okapem i kalenicą wzdłuż dłuższej ściany, ze schodów w stylu każdej osady (`roofStyleFor`: dąb, bruk, piaskowiec). Dom ma podmurówkę, słupki z bali, strop, okna z szyby, latarnię pod sufitem i ogrodową przy wejściu; wysokość dachu liczona jest z szerokości domu (`ceil(min(w, d) * 0.6)`), więc nie ma już „pagód”. Studnia dostała piramidalny daszek z latarnią.
* **Golem bez pozy zombie.** Ręce wyciągnięte do przodu dostawał każdy mob z dwiema rękami – teraz tylko zombie; golem i enderman machają rękami w chodzie. Blok trzymany w dłoni jest mniejszy (0,20–0,30 zamiast 0,45), a woda ma barwę oceanu (`59,111,213`, alfa 180) zamiast szarej mgły.
* **Testy.** `npm test` to **1747 kontroli silnika + 222 testy UI**. Nowa sekcja 2.20 sprawdza: przezroczyste tło słońca i księżyca oraz addytywne świecenie, niebieski kafelek wody, warstwy i kształty latarni, dzwonu, kaktusa (14/16), łóżka i drzwi (płyta 3/16), dwuspadowy dach domu w prawdziwej wiosce (schody, kalenica, dwie połacie), podmurówkę i łóżko w środku, a także opuszczone ręce golema i mniejszy model trzymanego bloku. `npx tsc --noEmit`, `npm test` i `npm run build` przechodzą.

**Wersja 2.19 „Świat jak w Minecrafcie”** – trwała sesja gracza, teleportacja i nowy generator:

* **Niewidzialna sesja konta.** `src/game/profile.ts` nadaje przeglądarce losowy identyfikator (20 znaków z `localStorage`) i wysyła go **zamiast nicku** do tabeli `blockcraft_players` w Supabase. Po wyjściu serwer pamięta pozycję, wymiar, zdrowie, głód, doświadczenie, ekwipunek i zbroję, więc gracz wraca dokładnie tam, gdzie skończył – **także po zmianie nicku i skórki**. Zapis leci co 6 s, przy zmianie wymiaru i jeszcze raz przy zamykaniu karty. Brak tabeli nie blokuje wejścia – świat bloków działa dalej.
* **Teleportacja za zgodą (`/tpa`).** `/tpa nick` wysyła prośbę do konkretnego gracza (także po fragmencie nicku), a zaproszony dostaje w HUD duże przyciski **„Przyjmij”/„Odmów”** – wygodne na telefonie. Dopiero po zgodzie gracz przenosi się na jego pozycję, razem z wymiarem; prośba wygasa po minucie. Komendy `/tpaccept` i `/tpdeny` działają z czatu, a katalog komend podpowiada je w wyszukiwarce.
* **Kontynenty, rzeki i spójne biomy.** Generator w `src/game/world.ts` został przepisany: kontynenty 2600 bloków (fbm 5 oktaw), pagórki 380, góry 1900 + grzbiety 700, osobny szum rzek (`|noise| < 0.06` → dno na poziomie morza) i klimat 2200. Teraz obok siebie leżą duże krainy – równiny, lasy, tajga, pustynia, sawanna, dżungla, bagno i góry – zamiast drobnej szachownicy łatek. Jaskinie są ucinane dwie warstwy pod powierzchnią, więc nie robią dziur w trawie.
* **Wioski jak w Minecrafcie.** Osady powstają tylko na **równinach, sawannie, pustyni i tundrze**, na terenie o różnicy wysokości do 9 bloków (siatka 5×5 próbek co 9 bloków). Środek placu jest równy, a na obrzeżach grunt **łagodnie wraca do naturalnego** (skos 16 bloków, krok ≤ 1 blok), więc nie ma już wiszących platform, pionowych ścian wykopu ani dziur pod domami. Pod placem brakujące warstwy są zasypywane ziemią (na pustyni piaskowcem).
* **9 skórek gracza 1:1.** Steve, Alex, Ari, Efe, Kai, Makena, Noor, Sunny i Zuri mają prawdziwe skórki 64×64 z waniliowym układem UV, Alex i Efe – smukłe ręce (`slim`). Wybór skórki w menu pokazuje **prawdziwe portrety** (`skinPortrait`), a twarze w liście graczy to wycinki 8×8 z czapką (`skinFace`) – bez canvasu, jako gotowe PNG.
* **Losowy start.** Nowy gracz startuje w losowym miejscu od 320 do 2600 bloków od środka mapy, zawsze na suchym lądzie (`findSpawnSpot` szuka pierścieniami co 16 bloków). Nikt nie rodzi się na plecach kolegi, a gdy ktoś się zgubi – jest `/tpa`.
* **Naprawiona głowa golema.** Kąt obrotu głowy był dodawany ze złym znakiem, więc golem patrzył w przeciwną stronę niż gracz. Teraz `want = clamp(rel, ±0,9)` trafia w `head.rotation.y` bez odwrócenia, a test sprawdza znak i ograniczenie kąta.
* **Testy.** `npm test` to **1705 kontroli silnika + 222 testy UI**. Nowe sekcje 2.19 sprawdzają: trwałość identyfikatora gracza (ten sam po zmianie nicku), rozrzut spawnu, wczytywanie i sanityzację profilu (ekwipunek, zbroja, zdrowie, doświadczenie), zapis do `blockcraft_players` z dławieniem, wysyłkę i odbiór prośby `/tpa` (ask/ok/no), teleportację na współrzędne, przyciski zgody w HUD, szerokość granic biomów, obecność rzek, płaski plac wioski bez dziur oraz 9 prawdziwych portretów w wyborze skórki. `npx tsc --noEmit`, `npm test` i `npm run build` przechodzą.

**Wersja 2.18 „Moby jak w Minecrafcie”** – prawdziwe modele i pikselowy interfejs:

* **Moby 1:1 z gry.** Nowy moduł `src/game/mobModels.ts` odwzorowuje **waniliowe modele** z Minecrafta: te same prostopadłościany, te same punkty zawiasów (`pivot`) i ten sam układ UV, co w grze. Dzięki temu tekstura z paczki trafia dokładnie na swoją ścianę – oczy, ryjek, łaty krowy i grymas creepera są tam, gdzie w oryginale. Modele przechodzą konwersję waniliowego układu (piksele, oś Y w dół, stopy w y = 24) na świat Three – razem z dylatacją (wełna owcy, czapka mieszkańca) i lustrzanymi UV lewych kończyn. W grze: **14 typów mobów + wełna owcy** = 15 modeli, każdy z własną skórką z paczki.
* **Zachowanie jak w grze.** Owca ma osobny, „spuchnięty” model wełny, który znika po strzyżeniu, a jej runo ma jeden z **16 kolorów barwników** (większość owiec jest biała, kolorowe trafiają się rzadziej – jak w grze). Wilk po oswojeniu dostaje **czerwoną obrożę** (zamiast przemalowanej sierści). Mieszkaniec wybiera jedną z **pięciu tekstur zawodów** (rolnik, kowal, bibliotekarz, pasterz, budowniczy). Każdy mob **odwraca głowę w stronę gracza** (z ograniczeniem kąta), a modele humanoidalne mają skalę 15/16 jak w wanilii.
* **Interfejs z paczki.** `src/game/art/uiSprites.ts` + `packTheme.ts`: serca (pełne, pół, kontur), drumsticki głodu, pancerz, pęcherzyki powietrza, pasek doświadczenia, celownik, tło hotbara i ramka wybranego slotu, tekstura slotów ekwipunku oraz **przyciski menu** (`button`, `button_highlighted`, `button_disabled`) wstawiane przez zmienne CSS. Wszystko z fallbackiem do rysunków z poprzednich wersji.
* **Niebo i efekty z paczki.** Chmury mają kształty kłębów z paczki (maska 1-bitowa zamieniona na białe chmury z przezroczystym tłem, sterowana pogodą), słońce i księżyc są pikselowe, deszcz pada jako kropla z tekstury, a kopany blok pokazuje **10 prawdziwych faz pękania** (`destroy_stage_0..9`).
* **Testy.** `npm test` to **1637 kontroli silnika + 214 testów UI** (stan z wydania 2.18). Nowa sekcja sprawdzała m.in.: 15 modeli i 19 skórek, rozmiary tekstur (krowa 64×64, owca 64×32, golem 128×128, ghast 128×64), pokrycie UV każdego moba ≥ 70%, układ ścian głowy świni, lustrzane UV, chowanie wełny, obrożę, obrót głowy, a także grafiki HUD, motyw CSS z paczki, słońce, deszcz i fazy pękania.

**Wersja 2.17 „Grafika jak w Minecrafcie”** – prawdziwa paczka tekstur w całej grze:

* **Wszystkie bloki z paczki.** Świat rysuje się teraz teksturami z dołączonej paczki w stylu waniliowego Minecrafta – **167 kafelków**, od trawy, bruku i desek, przez rudy, beton i terakotę, po kwarc, nether, błoto i lilię wodną. Trawa i liście są barwione kolorami z `colormap` paczki (`grass 124,189,108`, `foliage 91,171,71`), a animacje (woda, lawa, magma, portal) biorą pierwszą klatkę. Kafelki z paczki nie przechodzą już przez „wygładzanie” proceduralne, więc drobny rysunek (cegły, deski, sęki) zostaje ostry.
* **Ikony przedmiotów jak w oryginale.** **99 z 100** przedmiotów ma prawdziwe ikony 16×16: kilofy, siekiery, miecze, zbroje, jedzenie, sztabki, klejnoty, mikstury z kolorowym płynem (warstwa `potion_overlay` zabarwiona jak w grze), wiadra, pochodnie i wędka. Są powiększane do 48 px bez wygładzania, więc wyglądają ostro także na telefonie.
* **Steve i Alex w prawdziwych skórkach.** Skórki 64×64 z paczki są rozłożone na ciało według **waniliowego układu UV** (twarz, koszulka, spodnie, buty – każda ściana z właściwego miejsca tekstury). Pozostałe skórki zachowują pikselowe tekstury z 2.16, więc wybór wyglądu nadal działa.
* **Moby w kolorach z paczki.** Każdy z **14 mobów** dostaje paletę wyliczoną z własnej tekstury encji (najczęstsze kolory), a odcień każdej części ciała trafia na najbliższy kolor z tej palety. Dzięki temu krowa ma brązy i kremowe łaty, creeper soczyste zielenie, a zombie zieleń i turkus – bez ryzykownego mapowania UV na uproszczonych modelach.
* **Bez zależności i bez sieci.** Cała grafika jest wkompilowana w build jako PNG w base64 (razem ~63 kB) i dekodowana własnym dekoderem PNG + DEFLATE (`src/game/art/miniPng.ts`), synchronicznie, bez canvasu – działa też w testach w Node. Build pozostaje jednym plikiem HTML.
* **Testy.** `npm test` to **1565 kontroli silnika + 214 testów UI** – m.in. dekodowanie obu atlasów, 155 niepustych kafelków z detalem, podmiana kafelków w atlasie gry, ikony przedmiotów, 64×64 skórka Steve’a z ciemnymi oczami w prostokącie twarzy, układ UV ścian głowy, palety wszystkich 14 mobów i zrzut kolorów na paletę. `npx tsc --noEmit`, `npm test` i `npm run build` przechodzą; wersja **2.17.0** jest na GitHub Pages.

**Wersja 2.16 „Pikselowe tekstury”** – moby i gracze jak w Minecrafcie, plus 23 nowe przepisy:

* **Każdy mob ma wielobarwną teksturę 16 × 16.** Wcześniej każda część ciała była jednym, płaskim kolorem – owca wyglądała jak biały karton, a zombie jak zielony kloc. Teraz krowa ma kremowe łaty na brązowej sierści, owca kędzierzawe runo, creeper ciemnozielone plamy i jasny mech, pająk włochaty pancerz z połyskiem, szkielet szare pęknięcia na kościach, wilk pręgi futra, mieszkaniec fałdy szaty, a żelazny golem szczotkowane żelazo z nitami. Slime jest w końcu półprzezroczysty (oczy zostają ostre), a strzyżona owca ma teksturę gołej skóry.
* **Skórki graczy też są pikselowe.** Koszulka i rękawy mają splot tkaniny ze ściegami, spodnie ukośny jeansowy splot i szwy, buty skórzaną podeszwę, włosy pasma, a skóra delikatne cieniowanie i rumieńce. Zmiana skórki nadal działa jednym kliknięciem, a pozostali gracze widzą ją na publicznym serwerze.
* **23 nowe przepisy (razem 155).** Doszły schody ceglane, z cegieł kamiennych, piaskowcowe, netherowe i kwarcowe (6 bloków → 4 stopnie), płyty brukowe, ceglane, piaskowcowe i netherowe (3 bloki → 6 płyt), snop siana i rozbiórka na 9 pszenicy, latarnia, dzwon, blok szmaragdu (i rozbiórka), blok miodu z 4 butelek, terakota, beton w czterech nowych kolorach (niebieski, zielony, żółty, czarny), błoto oraz wełna z 4 nici – klasyczny ratunek, gdy w pobliżu nie ma owiec.
* **Naprawiony blackstone.** Wypalanie blackstone’u zwracało… blackstone, więc piec zużywał paliwo i nic nie robił. Teraz blackstone nie jest już ani paliwem, ani wynikiem wypalania, a soul sand nadal daje soul soil.
* **Wydajność.** Wszystkie tekstury to `DataTexture` 16 × 16 (bez canvasu i bez DOM), cache’owane globalnie: setki mobów dzielą kilkadziesiąt tekstur, a każdy `kind` + kolor zawsze daje tę samą instancję.
* **Testy.** `npm test` to **1523 kontrole silnika + 214 testów UI** – m.in. wielobarwność każdej z 22 tekstur, teksturowane części wszystkich 14 mobów, przezroczystość slime’a, tekstury awatarów, nowe przepisy w siatce 3×3 i brak samowypalania blackstone’u. `npx tsc --noEmit`, `npm test` i `npm run build` przechodzą; wersja **2.16.0** jest na GitHub Pages.

**Wersja 2.15 „Stabilny ekran”** – pełny ekran bez znikających przycisków:

* **Kamera nie „przybliża się” po wejściu w pełny ekran.** Wcześniej po fullscreenie (i wymuszonym obrocie) płótno gry mogło zostać z rozmiarem sprzed zmiany, a przeglądarka rozciągała obraz – wyglądało to jak zoom kamery i przycinało scenę. Teraz bufor rysowania zawsze odpowiada **faktycznemu** rozmiarowi kontenera (`canvas { width/height: 100% }` + `renderer.setSize(w, h, false)`), a proporcje kamery są przeliczane od razu.
* **Przyciski i drążek zostają na ekranie.** Sterowanie dotykowe mierzy własną warstwę gry (`getBoundingClientRect` + `ResizeObserver` + zapasowy pomiar co 0,8 s), a nie `window.innerHeight`, który po fullscreenie bywał nieaktualny. Dzięki temu drążek, skok, ekwipunek i górny pasek nie uciekają poza dolną krawędź.
* **Panele znów się przewijają.** Powłoka `#root` jest przypięta do widocznego ekranu (`position: fixed; inset: 0`, wysokość z `visualViewport` w `--bc-app-height`) zamiast `height: 100dvh`. Okna plecaka, kowadła, statywu, dziennika i punktów podróży mają `max-h-full`, więc mieszczą się w kadrze i można je doscrollować także po obrocie.
* **Czyste wejście i wyjście z pełnego ekranu.** Fullscreen działa na powłoce aplikacji (`#root`), a nie na `<html>`, więc style przeglądarki nie mieszają się z układem. Orientację blokujemy wyłącznie na urządzeniach dotykowych; Esc/gest systemowy zawsze ją zwalnia. Po każdej zmianie (`resize`, `orientationchange`, `fullscreenchange`, `visualViewport`) silnik robi kilka kontrolnych pomiarów w pierwszej sekundzie, więc spóźnione zdarzenia mobilnych przeglądarek nie zostawiają gry w złym rozmiarze.
* **Testy.** `npm test` to **1483 kontrole silnika + 214 testów UI** (stan z wydania 2.15) – m.in. przypięcie powłoki do viewportu, pełny ekran na `#root`, pomiar płótna i proporcji kamery po obrocie (także przy zerowym kontenerze), drążek liczony z warstwy gry oraz panele bez `dvh`.

**Wersja 2.14 „Auto-bicie”** – automatyczna walka i auto-skok:

* **Auto-bicie wrogich mobów.** Silnik sam wybiera najbliższego wrogiego moba w zasięgu ręki (zombie, creeper, szkielet, pająk, enderman, slime, ghast) i uderza go z normalnym cooldownem, obrażeniami narzędzia, zużyciem i dźwiękami – dokładnie tak, jak ręczny cios. Cios nie przechodzi przez ściany (promień od oczu do moba), a zwierzęta, mieszkańcy i golemy są bezpieczni. Włączasz w **Opcje → Sterowanie** albo jednym przyciskiem **Auto-bicie** w pauzie.
* **Auto-skok, który wreszcie działa.** Stara wersja wymagała jednocześnie zderzenia ze ścianą (`hitWall`) **i niezerowej prędkości** – a `stepBody` zeruje prędkość dokładnie w chwili zderzenia, więc auto-skok praktycznie nigdy się nie odpalał. Teraz postać sprawdza klocek *przed* sobą i wskakuje na każdy jednoblokowy schodek, zanim się o niego zablokuje. Auto-skok wyciąga też z wody na brzeg.
* **Dwa szybkie przełączniki w pauzie.** W menu gry są teraz przyciski **Auto-skok: wł./wył.** i **Auto-bicie: wł./wył.** – bez wchodzenia w opcje. Wybór zapisuje się w `localStorage` razem z resztą ustawień i działa w każdym świecie.
* **Wygodnie na telefonie.** Na dotyku postać delikatnie obraca się w stronę najbliższego wroga (5 rad/s), więc walka palcem nie wymaga precyzyjnego celowania. Na komputerze kamera zostaje w pełni pod kontrolą myszy.
* **Testy.** `npm test` to **1453 kontrole silnika + 214 testów UI** – m.in. wybór tylko wrogich mobów, cios przez ścianę vs szybę, cooldown, wyłączenie w ekwipunku, `applyGfx`, prawdziwe obrażenia na mobie, skok na schodek, przełączniki w opcjach i pauzie.

**Wersja 2.12 „Skórki i dotyk”** – crafting, postać i telefon:

* **Stół rzemieślniczy wreszcie działa z każdego drewna.** Przepis na deski był tylko dla dębu i brzozy, więc **akacja nie dawała desek** – w sawannie nie dało się zrobić nawet stołu. Teraz lista `LOG_IDS` (`LOG`, `BIRCH_LOG`, `ACACIA_LOG`) generuje przepisy dla wszystkich pni: **1 pień → 4 deski**, a **4 deski ułożone w kwadrat 2×2 → stół rzemieślniczy**, dokładnie jak w Minecrafcie. Nowy pień wystarczy dopisać do jednej listy, żeby nie zgubił przepisu.
* **Wybór skórki.** Nowy moduł `src/game/skins.ts` ma 8 wyglądów postaci: Steve, Alex, creeper, enderman, rycerz, ninja, złoty i podróżnik. Wybierasz je w **Opcje → Postać** oraz w pasku skórek w poczekalni multiplayera. Awatar w podglądzie jest rysowany z prostokątów, więc działa też na telefonie bez WebGL. Skórka zapisuje się w `localStorage` (`blockcraft-skin`), a w grze trafia do `hello`/`pos` w P2P i do Presence na serwerze publicznym – inni widzą Twój wygląd, a lista graczy pokazuje miniaturkę głowy. Zmiana w pauzie działa od razu, bez restartu świata.
* **Telefon na pierwszym miejscu.** W opcjach jest **rozmiar przycisków dotykowych** (małe / średnie / duże). Telefon obrócony poziomo sam zmniejsza przyciski, drążek i hotbar, żeby nie zasłaniały celu. Pasek górny, czat i menu uwzględniają `safe-area-inset` (notch, pasek gestów), więc nic nie chowa się pod systemem. Pola tekstowe mają 16 px – iOS nie przybliża przy tym strony – a każde dotknięcie trafia w element o wysokości co najmniej 44 px.
* **Czytelniejszy ekwipunek.** Siatka rzemieślnicza nie rozjeżdża się już na małych ekranach (nie ma sztywnej szerokości 3×44 px), a opis pod siatką przypomina, że 4 deski dają stół i odblokowują 3×3.
* **Testy i wydanie.** `npm test` to **1383 kontrole silnika + 197 testów UI** – m.in. deski z każdego pnia, stół z 4 desek, osiem skórek i ich zapis, skórka w `hello`/obsadzie oraz rozmiar przycisków dotykowych. `npx tsc --noEmit`, `npm test` i `npm run build` przechodzą; wersja **2.12.0** jest na GitHub Pages.

**Wersja 2.11 „Wspólny świat”** – publiczny serwer:

* **Jeden przycisk „Graj online”.** W menu „Gra razem” nie ma już kodów pokoju ani gospodarza: wpisujesz nazwę i wchodzisz do wspólnego świata. Wszyscy gracze trafiają do tego samego terenu (stałe ziarno `20261020`).
* **Budowle zostają.** Każde postawienie lub zburzenie bloku trafia do tabeli `blockcraft_blocks` w Supabase (upsert po współrzędnych). Po wejściu gra pobiera cały świat, a w trakcie gry zmiany idą natychmiast przez Realtime; co 45 sekund klient dociąga to, co mogło zginąć w transmisji. Nieudany zapis wraca do kolejki, więc budowla nie przepada przy zerwaniu internetu.
* **Kto jest online.** Lista graczy pochodzi z Presence i pokazuje nazwy, kolory, liczbę osób oraz kto właśnie dołączył (komunikat w czacie). Pozycje idą 4 razy na sekundę – wystarczająco płynnie, a nie przekracza limitów Realtime.
* **Wspólna pora dnia i pogoda.** Dzień, noc i deszcz wynikają z zegara, nie z serwera: każdy klient liczy identyczną porę dnia (doba = 600 s) i pogodę z tego samego okna czasu, więc niebo jest takie samo u wszystkich bez wysyłania stanu.
* **Naprawione kody zaproszeń.** Wcześniej dwukrotne użycie tego samego kodu kończyło się surowym błędem przeglądarki `Failed to set remote answer sdp: Called in wrong state: stable`. Teraz gra sprawdza stan połączenia i pokazuje po polsku, że zaproszenie zostało już użyte, a każdy błąd WebRTC dostaje zrozumiały komunikat.
* **Tryby dodatkowe.** „Ta przeglądarka” (BroadcastChannel – dwie karty, działa offline) i „Przez internet” (WebRTC z ręcznymi kodami) zostały dla osób, które chcą własnego, prywatnego świata. Serwer publiczny nie wymaga od nich niczego.
* **Testy.** `npm test` to **1347 kontroli silnika + 187 testów UI**: protokół obu transportów, zegar publiczny, mapowanie wierszy bazy, paginacja wczytywania, batchowanie upsertu, ponawianie nieudanego zapisu, obsada z Presence, ekran „Gra razem” i HUD.

**Wersja 2.10 „Gra razem”** – pierwszy multiplayer bez serwera:
**Wersja 2.10 „Gra razem”** – multiplayer bez serwera:

* **Nowy ekran „Gra razem”.** W menu głównym jest teraz przycisk otwierający poczekalnię. Ustawiasz nazwę, wybierasz **„Ta sama przeglądarka”** albo **„Przez internet”**, tworzysz sesję lub dołączasz do istniejącej. Cała komunikacja i etykiety są po polsku, a każdy krok ma duży przycisk – także na telefonie.
* **Dwie karty, zero konfiguracji.** Tryb lokalny działa na `BroadcastChannel`: wystarczy otworzyć grę w drugiej karcie lub oknie i wpisać ten sam kod pokoju (np. `las-123`). Nie potrzeba internetu, konta ani serwera – wiadomości nie opuszczają przeglądarki.
* **Internet na kodach zaproszeń.** Tryb P2P używa **WebRTC** z publicznym STUN-em: gospodarz kopiuje kod zaproszenia, gość wkleja go i odsyła krótki kod odpowiedzi – oba kopiują się jednym przyciskiem. Topologia gwiazdy: gospodarz przekazuje ruch między gośćmi, więc każdy łączy się tylko z nim.
* **Wspólny świat bez przesyłania terenu.** Świat jest deterministyczny, więc nowy gracz dostaje tylko **ziarno, tryb, typ terenu, porę dnia, pogodę** oraz listę zmienionych bloków (do 20 000, z deduplikacją). Dzięki temu dołączenie jest natychmiastowe i nie zamula łącza.
* **Zmiany bloków, czat i awatary.** Każde postawienie lub zburzenie bloku (w obu wymiarach) leci do pozostałych graczy, czat w grze działa jak zwykły czat, a nad innymi graczami widać **kolorowe awatary z nazwami**, animacją nóg i trzymanym blokiem. Pozycje idą 10 razy na sekundę i są wygładzane, więc ruch nie „skacze”.
* **Dołączanie obok gospodarza.** Gość pojawia się kilka bloków od gospodarza (na ziemi), a nie w tym samym punkcie startowym – dzięki temu awatary nie nachodzą na kamerę. Gospodarz wysyła swoją pozycję w migawce świata.
* **Lista graczy i ping w HUD.** W prawym górnym rogu widać liczbę osób, nazwy, kolory i opóźnienie; gospodarz ma oznaczenie. Milczący gracz wypada z sesji po 12 sekundach, a wyjście jest komunikowane w czacie.
* **Bezpieczne dane z sieci.** Wiadomości przechodzą walidację (rozmiar, typy, zakresy) – śmieci nie mogą wywrócić generatora ani silnika. Sesje multiplayer **nie zapisują się** do slotów: świat należy do gospodarza, a gracz zawsze może wrócić do menu i dołączyć ponownie.

**Wersja 2.9 „Nowy wygląd”** – tekstury, dotyk i komendy:

* **Ekwipunek zamyka się na dotyku.** Każde okno – ekwipunek, skrzynia, piec, kowadło, statyw alchemiczny i handel – ma teraz duży czerwony przycisk **✕** w narożniku, a ekwipunek dodatkowo szeroki przycisk **„Gotowe – zamknij ekwipunek”** na dole, w zasięgu kciuka. Tapnięcie w ciemne tło też zamyka okno, a trzymany przedmiot wraca do plecaka (`closeInventory()`), więc nic nie ginie. W poziomie sloty zmniejszają się teraz na podstawie **wysokości** ekranu (`max-height`), a nie tylko szerokości – wcześniej telefon obrócony poziomo dostawał pełne 44-pikselowe sloty i okno nie mieściło się na ekranie.
* **Czat z listą komend.** Nowy ekran `ChatScreen` ma przycisk **„Komendy”** z pełną, pogrupowaną listą (Gracz, Świat, Przedmioty i moby, Punkty podróży, Pomoc). Każda pozycja pokazuje składnię i gotowy przykład, a tapnięcie **wstawia** komendę do pola albo wysyła przykład jednym kliknięciem. Podpowiedzi filtrują się w trakcie pisania (po nazwie, aliasie i polskim słowie – np. „deszcz” znajduje `/weather`), a pod polem są szybkie skróty i **„Wyślij”**, więc nie trzeba trafiać w klawisz Enter wirtualnej klawiatury. Wysokość panelu uwzględnia `visualViewport`, więc na iPhonie pole nie chowa się pod klawiaturą.
* **Jedno źródło prawdy dla komend.** Nowy moduł `src/game/commands.ts` trzyma nazwy, aliasy, składnię, opisy, przykłady i słowa kluczowe. `/help` wypisuje z niego listę, `/help <komenda>` pokazuje szczegóły, a literówka w komendzie podpowiada najbliższe trafienia (`/giwe` → „Może: /give?”). Testy sprawdzają w obie strony: każda komenda z katalogu istnieje w silniku i każda komenda silnika jest w katalogu.
* **Tekstury w stylu współczesnego Minecrafta.** Nowy warsztat malarski w `textures.ts`: zamiast losowego ziarna na każdym pikselu – **wygładzony szum z zawijaniem** (kafelek łączy się sam ze sobą) w dwóch–trzech oktawach, krótka paleta kolorów i światło z lewego górnego rogu. Ziemia ma grudki i kamyki, trawa – nierówną krawędź i źdźbła, kamień – miękkie łaty i pęknięcia, bruk – zaokrąglone otoczaki z fugą, kora – pionowe bruzdy i sęki, deski – cztery klepki z własnym odcieniem i sękami, liście – nakładające się kiście z jasną górną i ciemną dolną krawędzią. Żwir to obtoczone kamyki, piasek drobne ziarno z muszelkami, a rudy mają grudki z błyskiem i cieniem zamiast przypadkowych kropek.
* **Nowe generatory dla reszty bloków.** Wełna ma splot nitek, beton drobne kruszywo, lawa rozżarzone komórki na stygnącej skale, obsydian szkliste fioletowe refleksy, lód rysy i rozbłyski, a netherrack, end stone, kwarc, purpur i terakota wspólny generator skały (`rockTile`). Bloki magazynowe (żelazo, złoto, diament, lapis, szmaragd, kwarc) dostały siatkę sztabek z fazowaniem i błyskiem.
* **Czytelne bloki.** Każdy nieprzezroczysty kafel dostaje delikatny skos (górna i lewa jaśniejsza, dolna i prawa ciemniejsza), a mieszanie krawędzi zmalało z 40% do 28% – wcześniej zjadało drobny rysunek (sęki, listki, żebra) i wszystkie bloki wyglądały podobnie. Generowanie atlasu zajmuje ok. 130 ms przy starcie, bez wpływu na klatki.
* **Testy.** `npm test` obejmuje teraz **1347 kontroli + 187 testów UI**: protokół i ekran multiplayera, katalog komend (spójność z silnikiem, wyszukiwanie po polsku, wstawianie do pola), przyciski zamknięcia w ekwipunku, czat (lista, przykłady, wysyłanie) oraz zgodność etykiet wydania 2.11.

**Wersja 2.8.1 „Światło i chmury”** – poprawki i realistyczne światło:

* **Koniec z czarnymi drzewami.** Shader nie dzieli już koloru wierzchołka przez jasność nieba (przez co całe zacienienie było skracane do zera), a zacienienie nie jest już liczone podwójnie – wcześniej kolor wierzchołka mnożył się raz w swoim fragmencie, a drugi raz w standardowym `color_fragment`, więc cień szedł do trzeciej potęgi i las zlewał się w czerń. Teraz kolor wierzchołka to prawdziwe zacienienie (AO, kierunek ściany, ekspozycja na niebo), a noc ma **podłogę jasności** dopasowaną do jasności nieba. Cień korony nadal jest wyraźnie ciemniejszy – po prostu nie jest już czarny.
* **Pochodnia w dłoni naprawdę świeci.** Trzymany przedmiot emitujący światło (pochodnia, latarnia, jasnogłaz, ognisko, grzyboświatło, zapalona lampa czerwonego kamienia) oświetla najbliższe bloki ciepłym, lekko migoczącym blaskiem w promieniu 9 klocków – także w jaskini i w Netherze. Blask pochodzi z oczu gracza i pada na to, na co patrzysz.
* **Ciepłe światło bloków.** Pochodnie, lawa i ogniska dają teraz pomarańczowy odcień zamiast białego rozświetlenia, a ich blask łagodnie wygasa (`sqrt` zamiast kwadratu). Dodano stałą, bardzo ciemną poświatę otoczenia, więc jaskinie są mroczne, ale nie są dziurą w ekranie.
* **Cień korony zamiast smoły.** Światło nieba liczone jest teraz kolumnowo od góry: pełny blok odcina je całkowicie (jaskinie są ciemne, jak być powinno), a liście tłumią je stopniowo – po kilku blokach korony zostaje miękki, zielony półcień. Pień i dolne gałęzie przestały być czarnymi plamami, a cień pod drzewem nadal jest wyraźnie ciemniejszy od otwartej polany. Liście nie są już też pełnym okluderem AO, więc załomy korony nie zapadają się w czerń.
* **Gęste liście bez dziur.** Liście (dębu, brzozy, akacji i dżungli) są nieprzezroczyste dla siatki: tekstura jest zagęszczana (puste piksele dostają kolor sąsiada), więc korona nie prześwituje i nie ma w niej czarnych ścianek. Wewnętrzne ścianki liści są cullowane, co dodatkowo oszczędza rysowanie w lasach.
* **Mgła opowiada tę samą pogodę.** W deszczu mgła gęstnieje, ciemnieje i lekko sinieje razem z chmurami, więc horyzont nie zostaje jasny, gdy nad głową wisi burza.
* **Chmury zgodne z pogodą.** Oprócz warstwy „ładnej” pogody jest druga, gęsta i niska warstwa burzowa. Gdy pada, podstawowe chmury ciemnieją i gęstnieją, dochodzi ciemna warstwa burzowa, a wiatr gna je ponad dwa razy szybciej. Nocą chmury są granatowe, a nie białe. Przejście pogody jest płynne (kilka sekund), bez skoku koloru i krycia.
* **Lepszy start świata.** Nowy świat nie zaczyna się na czubku drzewa: gracz zawsze staje na prawdziwym gruncie. Wysokość kolumny ignoruje korony, więc deszcz, minimapa, moby i punkt odrodzenia widzą ziemię, a nie czubek liści.
* **Nowe testy.** Zestaw kontrolny sprawdza model światła (południe, noc, cień korony, jaskinia, pochodnia), spadek światła trzymanego przedmiotu, aktualizację uniformu w silniku, wygląd chmur dla pogody i pory dnia, to, że wszystkie rodzaje liści są pełne, oraz – na prawdziwej siatce – że korona daje półcień, a kamienny strop prawdziwą ciemność.

**Wersja 2.8 „Płynny świat”** – mniej zacięć, więcej klimatu:

* **Chunki budują się w tle i nie przerywają gry.** Przebudowa terenu ma teraz własny **budżet czasu na klatkę** (domyślnie 0–12 ms zależnie od presetu): silnik kończy bieżący chunk, odkłada resztę na następną klatkę i nie zamraża sterowania. Podczas ładowania świata limit jest podwojony, więc pierwsze sekundy są krótsze, a ekran ładowania pokazuje realny postęp.
* **Światło bez skanowania całego chunku.** Każdy chunk prowadzi **indeks emiterów** (pochodnie, ogniska, lawa, świecące bloki), aktualizowany przy stawianiu i burzeniu. Pętla świateł odwiedza tylko bloki, które naprawdę świecą – na dużych światach to nawet kilkadziesiąt razy mniej pracy na klatkę.
* **Pojedyncze zapytania o blok są wielokrotnie tańsze.** `peekBlock` i `heightAt` korzystają z jednowpisowego cache ostatniego chunku, więc fizyka, moby i cząstki nie tworzą już tysięcy kluczy tekstowych „cx,cz” na sekundę.
* **Cząstki w jednym obiekcie.** Zamiast setek osobnych meshy każdy kolor ma jedną `InstancedMesh` z własną pulą; wybuch, kopanie bloku i dym z ogniska to nadal **jedno kreslenie na kolor**, a cząstki są recyklingowane zamiast tworzone od zera.
* **Lżejsze przedmioty na ziemi.** Ikony dropów współdzielą jedną geometrię i cztery materiały zamiast tworzyć nowe materiały przy każdym wyrzuceniu – mniej pracy dla sterownika i mniej śmieci w pamięci.
* **Płynniejsza woda.** Górna tafla wody faluje w vertex shaderze (`aWave` + `uTime`), więc animacja nie kosztuje ani jednego przebudowania siatki. Efekt działa też w Netherze na lawie.
* **Nowe niebo.** Kopuła nieba z czterostopniowym gradientem (od chłodnego zenitu po ciepły horyzont), słońce i księżyc na wspólnym kierunku, mocniejsze gwiazdy nocą oraz warstwowe chmury – wszystko bez alokacji w pętli klatki.
* **Tekstury bez „kafelkowej” siatki.** Generator atlasu miesza teraz krawędzie kafli z ich przeciwległymi odpowiednikami, delikatnie podbija górne i lewe krawędzie oraz przyciemnia dolne i prawe. Bloki z przezroczystością (liście, szkło, rośliny) są pomijane, więc nie pojawiają się na nich obwódki.
* **Odświeżony interfejs.** Nowe menu główne z kartami światów, wyszukiwaniem i sortowaniem, spójne przyciski (`mc-btn`), karty (`mc-card`), odznaki wersji i panele. Menu pauzy pokazuje **„Nowości w 2.8”**, ekran Opcji – jednym kliknięciem **tryb wydajności**, a HUD dostał czytelniejszy celownik, ramkę minimapy z kompasem, biomem i dniem, pasek doświadczenia z gradientem oraz licznik zdrowia.
* **Minimapa liczona tylko wtedy, gdy coś się zmieniło.** Rysowanie 96×96 pikseli korzysta z numerycznego indeksu chunków i odcisku stanu (pozycja, obrót, suma rewizji chunków, wymiar, punkty podróży); bez zmian w świecie obraz nie jest liczony ponownie.
* **Nowe testy.** Zestaw kontrolny sprawdza indeks świateł, atrybut fali tylko na powierzchni wody, kompaktowe indeksy 16-bitowe, przebudowę sąsiadów po dojściu nowego chunku, pule cząstek, cache zwalniania chunków oraz etykiety wydania 2.8.

**Wersja 2.7 „Nowe horyzonty”**:
- trzy nowe, generowane proceduralnie biomy: **Bagno**, **Sawanna** i **Dżungla**; ich rozmieszczenie jest stabilne dla ziarna świata,
- biomowe ukształtowanie terenu i roślinności: mokradła z błotem i liliami wodnymi, gęstsze zarośla dżungli oraz rzadsze, charakterystyczne akacje sawanny,
- pięć nowych bloków z własnymi teksturami: błoto, pień akacji, liście akacji, gęste liście tropikalne i lilia wodna; nowe drzewa reagują na ścinanie i opadanie liści,
- przywracanie domyślnych ustawień obrazu, sterowania i dźwięku z ekranu Opcji,
- nowe ID bloków są dopisane bez naruszania starych zapisów; testy sprawdzają powtarzalność i dostępność nowych biomów.

**Wersja 2.6 „Warsztat bez wpadek”**:

* **Ekwipunek działa transakcyjnie.** Niepełne miejsce nie przyjmuje po cichu części stosu – łup zostaje na ziemi, a nieudana wymiana nie pobiera zapłaty. Wynik rzemiosła nie znika, gdy plecak jest pełny; receptury uwzględniają miejsce zwalniane przez składniki.
* **Własne nazwy i zaklęcia są bezpieczne przy przenoszeniu.** Dodawanie i zwracanie stosów zachowuje nazwę, wytrzymałość i zaklęcia. Stosy łączą się tylko wtedy, gdy ich metadane naprawdę pasują; przedmioty odkładane z siatki rzemieślniczej nie tracą imienia.
* **Wyszukiwarka receptur** znajduje wynik lub składnik i ignoruje polskie znaki diakrytyczne. Filtr „Możliwe” ukrywa przepisy bez składników, stołu albo wolnego miejsca na wynik.
* **Naprawa ustawień.** Wartości wczytane ze starszego lub uszkodzonego zapisu są walidowane i ograniczane do prawidłowych zakresów, zamiast psuć renderowanie lub sterowanie.
* **Lepsze dopasowanie do telefonu.** Pasek skrótów i sloty zmniejszają się na wąskich ekranach, ekwipunek mieści się w viewportcie, przyciski uwzględniają safe-area, a elementy HUD-u nie są już podnoszone dwukrotnie przez margines wycięcia.
* **Pikselowy krój pisma jest lokalny.** Pixelify Sans jest osadzany w buildzie zamiast pobierania z Google Fonts, dzięki czemu menu działa offline i nie czeka na zewnętrzną sieć. Licencja fontu znajduje się w `public/OFL-Pixelify-Sans.txt`.
* **Kontrola jakości w PR.** Nowy workflow GitHub Actions uruchamia typecheck, testy i build dla pull requestów.

**Wersja 2.5 „Wielka naprawa”** to poprzednie wydanie, które rozdzieliło sterowanie komputerowe i dotykowe oraz naprawiło kluczowe błędy wejścia:

* **Osobna wersja PC i osobna wersja dotykowa.** Wcześniej wystarczył ekran dotykowy (choćby w laptopie z Windows), żeby gra wymusiła sterowanie mobilne – Pointer Lock nie startował, więc **mysz i klawiatura były martwe** i na takich maszynach nie dało się praktycznie grać. Teraz o wersji decyduje **główny wskaźnik urządzenia** (`pointer: coarse`), laptopy z ekranem dotykowym dostają pełną wersję PC, a w Opcjach → Sterowanie jest wybór **Tryb sterowania: Automat / Komputer / Dotyk** – przełączany w locie, bez restartu świata.
* **Klawiatura nie „zamiera” bez blokady kursora.** Całe sterowanie klawiszowe było zależne od aktywnej blokady myszy – po Alt-Tabie albo odrzuconym Pointer Locku klawisze nic nie robiły, dopóki gracz nie kliknął ponownie w ekran. Teraz tylko rozglądanie myszą wymaga blokady; ruch, ekwipunek, czat, sloty i skróty działają zawsze.
* **Esc w pauzie wraca do gry**, Enter/R odradza na ekranie śmierci, a Esc zamyka okna nawet wtedy, gdy fokus został w polu nazwy albo wyszukiwania (wcześniej Esc „nic nie robił” po kliknięciu w input).
* **Trzymany LPM bije dalej.** `tryAttack()` zerował wciśnięcie myszy po każdym trafieniu: walka wymagała szalonego klikania, a mob wejściem w celownik **przerywał kopanie** do ponownego kliknięcia. Teraz trzymany przycisk atakuje z cooldownem broni, a kopanie płynnie wraca po zabiciu moba.
* **Koniec wkurzającego spamu z owcy.** Nożyce na już ostrzyżonej owcy spamowały komunikatem „Ta owca jest już ostrzyżona” przy każdym powtórzeniu – teraz dostaje zwykły cios.
* **Miecz nie otwierał ekwipunku w kółko.** Przytrzymanie klawisza `E` otwierało i zamykało ekwipunek w kółko (powtórzenia klawisza były traktowane jak nowe wciśnięcia). Akcje jednorazowe (`E`, `Q`, `J`, `K`, `T`, `F`) reagują teraz tylko na świeże wciśnięcie, a przytrzymanie utrzymuje wyłącznie ruch.
* **Tapnięcie po mieszkańcu otwiera handel, a nie bije go.** Na dotyku tap w mieszkańca atakował go i budził golemy. Teraz tap = PPM: mieszkaniec → handel, wilk + surowe mięso → oswajanie, potwór → atak.
* **Na dotyku celownik to palec – naprawdę.** `findMobTarget()` celował zawsze w środek ekranu, więc tapnięcie w moba obok celownika trafiało w próżnię albo w coś zupełnie innego; **strzała z łuku, perła Endu i spławik wędki leciały w środek ekranu**, nie tam, gdzie celował palec. Wszystkie rzuty korzystają teraz z kierunku palca.
* **Drążek odporny na drugi palec.** Drugi dotyk w strefie drążka (np. otarta dłoń) podmieniał drążek, a jego puszczenie zatrzymywało postać. Teraz drążek jest tylko jeden, a dodatkowy palec w strefie rozgląda się.
* **Okno tapu przestało „gubić” ostatnie milisekundy.** Tap trwał do 260 ms, a przytrzymanie startowało po 250 ms – ostatnie 10 ms tapu wykonywało niechciany cios. Okna są teraz spójne (250 ms).
* **Skróty i wygoda na PC:** `Ctrl+Q` wyrzuca **cały stos** (Q – pojedynczy przedmiot), skradanie działa też na **prawym Shifcie**, sprint na **prawym Ctrl**, sloty wybiera też **klawiatura numeryczna**, a mysz celuje z **surowego wejścia** (`unadjustedMovement`) – bez przyspieszeń systemu.
* **Okna przedmiotów działają na dotyku.** Wszystkie sloty (ekwipunek, skrzynia, piec, kowadło, statyw, stół zaklęć, handel) dostały wspólny slot obsługujący dotyk: **tapnij** – weź/połóż, **przytrzymaj** – akcja „połowa / jeden” (wcześniej prawy przycisk był na telefonie **niedostępny**). Sloty pokazują też pasek wytrzymałości.
* **Poprawki drobne:** lorneta spowalnia też rozglądanie palcem; podwójne W liczone od nowa po puszczeniu klawisza (W→S→W nie włącza już sprintu); pełny ekran na telefonie nie zostawia błędów w konsoli; podwójne tapnięcie na iOS nie zoomuje widoku; wyrzucanie przedmiotu niesie nazwę z kowadła także przy Ctrl+Q; historia czatu obsługuje strzałkę w dół; przy zniknięciu karty resetują się wszystkie stany dotyku (w tym sprint).

**Wersja 2.4 „Godzina alchemika”** dociera wreszcie do statywu alchemicznego, który od 1.9 stał w świecie jako ozdobny krzyż – teraz warzy prawdziwe eliksiry:

* **Działający statyw alchemiczny** – `PPM` przy bloku otwiera ekran z trzema slotami na fiolki, kubkiem na składnik i podstawą na paliwo. Warzenie jednej partii trwa **8 s**, a **jedna płomienność różdżki** (z Netheru) utrzymuje ogień przez **3 partii**. Składnik nie zużywa się – jak w klasyku. Stan statywu (także w Netherze) zapisuje się ze światem, a rozbicie bloku wysypuje fiolki, składnik i paliwo na ziemię.
* **Fiolki** (3 szkła w literę V) – pusta fiolka napełnia się **nad wodą** (`PPM` na fiolce przy źródełku; źródło wody zostaje). To punkt wyjścia każdego eliksiru.
* **Siedem napojów** – **zaczarowany napój** (woda + brodawka Netheru) to baza; dalej: **leczenie** (+7 serc od razu, łza ghaasta), **ognioodporność** (45 s – lawa, ogniska i magma nie ranią), **szybkość** (+30% biegu, 20 s, cukier), **nocne widzenie** (30 s, pył miodu/żarłoczny kamień), **siła** (+4 obrażeń, 15 s, różdżka) oraz **regeneracja** (+1 serce co 2 s przez 10 s, zaczarowany + pył). Cukier powstaje z trzciny cukrowej, a miód z plastry **butelka miodu** (8 pkt głodu).
* **Wzmocnienia na HUD-zie** – aktywne efekty z ikonami i odliczaniem sekund nad paskiem pancerza.
* **Nowe przedmioty** – cukier, szklana fiolka, fiolka z wodą, butelka miodu i siedem napojów, każda z własną ikoną w stylu piksel-art.
* **Osiągnięcia i dziennik** – cztery nowe cele: „Pierwsze warzenie”, „Ziołowy tonik”, „Ognioodporny” (wymaga wejścia do lawy pod ochroną) i „Mistrz eliksirów” (6 różnych napojów), oraz dziewiąty rozdział dziennika „Godzina alchemika”.
* **Naprawione błędy**:
  * **Wiadro w trybie kreatywnym niszczowało wodę.** Zużycie pustego wiadra na źródle wody/lawy usuwało blok bez wręczenia pełnego wiadra; w kreatywie wiadro zamienia się teraz w pełne, a źródło zostaje nietknięte.
  * **Martwy kod w stawianiu płyt.** `(t as any).hitY` nie istniał w wyniku raycastu – płyta górna/dolna dobierana jest teraz czysto po normalnym uderzenia (`ny === -1`).
  * **Mylący komentarz o sezonach.** `cookOnCampfire` sugerowało „ryby tylko latem”, choć żadnego systemu pór roku nie ma.

**Wersja 2.3 „Wyprawa i ratunek”** dokłada wędkarstwo, naprawę narzędzi i drugie życie:

* **Wędkarstwo** – nowa **wędka** (3 patyki + 2 struny u stołu). `PPM` zarzuca pływak: przy brzegu, na rzece albo na oceanie czeka **4–11 s**, potem ryba bierze i masz **1,7 s** na kliknięcie. Wyciągnięty łup ląduje w ekwipunku – **70% to ryby** (surowa ryba 2 pkt głodu, surowy łosoś 2 pkt + regeneracja), a **30% to śmieci z plaży** (struna, skóra, kość, patyk, krzemień, nasiona). `PPM` w powietrzu **wciąga przynętę**, a zbyt długo zignorowany pływak przepływa. Piec i ognisko pieczą ryby tak samo jak mięso, a ugotowana ryba jest dwukrotnie sycąca.
* **Lorneta** (4 szkła + sztabka złota) – przytrzymane `PPM` **zwęża pole widzenia do 24°** (czarne winiety, celownik znika) i spowalnia rozglądanie do 0,4×, więc można wypatrzyć jaskinię albo wioskę z drugiego końca plaży. Nie da się jej zakląć ani użyć jako broni.
* **Działające kowadło** – `PPM` przy bloku otwiera ekran z trzema slotami. **Dwa zniszczone narzędzia tego samego typu** dają jeden przedmiot, w którym wytrzymałości się sumują, a zaklęcia zachowują najlepszy poziom (maks. 3). W polu nazwy nadajesz przedmiotowi **własne imię** (do 28 znaków) – wskazówka, ekwipunek, skrzynie, skrzynie TNT i wszystkie okna pokazują je złotą kursywą, a nazwa nie znika przy łączeniu, dzieleniu stosu ani po śmierci. Operacja kosztuje **1 poziom doświadczenia**; stan kowadła (także w Netherze) zapisuje się ze światem, a zniszczenie bloku wysypuje jego zawartość na ziemię. Nowe osiągnięcie: „Kowal”.
* **Totem Ratowania** (4 szmaragdy + sztabka złota) – **zabity w ostatnim zdrowiu nie ginie**: totem w ekwipunku zużywa się, wstajesz z 6 sercami, zapełnionym brzuchem i 6 sekundami regeneracji, a ekran śmierci w ogóle się nie pojawia. Nowe osiągnięcie: „Nieśmiertelny”.
* **HUD podczas wędkowania** – pasek brań nad ekwipunkiem pokazuje, czy przynęta czeka, „🎣 Brań!” (biały błysk pływaka i drganie), czy właśnie leci z wodą, a pasek cierpliwości odlicza ostatnie sekundy.
* **Osiągnięcia i dziennik** – cztery nowe cele (rybak, geodeta, kowal, nieśmiertelny) i ósmy rozdział dziennika przygód, „Wyprawa i ratunek”.
* **Naprawione błędy**:
  * **Miecz bije jak topór.** `attackDamage()` kasował obrażenia zależne od poziomu miecza – diamentowy miecz zadawał 4 zamiast 9 obrażeń, dopóki nie trafił na zaklęcie Ostrość.
  * **Blok szlamu nie odbijał.** Warunek `wasGround === false` nigdy nie był prawdą, więc wskoczenie na szlam kończyło się jak zwykłe lądowanie. Reguła odbicia żyje teraz w `physics.slimeBounce()` i ma testy.
  * **Połówka stosu gubiła zaklęcia i nazwę.** `Shift + LPM` dzielił stos, zrzucając wytrzymałość, zaklęcia i własną nazwę – teraz wszystko jest zachowywane (także w siatce rzemieślniczej i przy przenoszeniu między skrzynią, piecem a kowadłem). Stosy o różnych nazwach nie łączą się już w jeden.
  * **ŚPM działał tylko na pasku.** Wybranie bloku, który leżał głębiej w ekwipunku, nic nie robiło; teraz przedmiot zamienia się miejscami z trzymanym.
  * **Rudy bez doświadczenia.** Ruda czerwonego kamienia, kwarcu i szmaragdu nie zrzucała kulek XP (teraz 5 / 2 / 6).
  * **Klawiatura „jadła” znaki.** Naciskanie klawiszy w polu nazwy przedmiotu (kowadło) albo w czacie nie działało – obsługa klawiatury ignoruje teraz aktywne `input`/`textarea`.
  * **Import zapisów nie czyścił nazw.** Nazwa świata z pliku `.json` mogła zawierać znaki sterujące – import oczyszcza ją i skraca tak samo jak wpis w menu.
  * **Płyty łączone magiczną zmienną.** Kod stawiał blok „na szczycie” przez podmienną prywatnego pola silnika – teraz jest czysta funkcja `slabFullBlock()`.
  * **Wędka i lorneta były zaklęwalne.** `targetsOf()` przemycał je jako cel zaklęcia (dzięki `as Target`); teraz zaklęcia ich nie dotyczą.

**Wersja 2.2 „Szlak odkrywcy”** rozbudowuje właściwą rozgrywkę i naprawia sterowanie na telefonach:

* **Punkty podróży** (`K`, przycisk w pauzie lub 📍 na telefonie) pozwalają zaznaczyć bazę, kopalnię, portal i inne ważne miejsca. Wybrany cel ma kierunkową strzałkę oraz odległość na HUD-zie, wszystkie punkty są widoczne na minimapie i zapisywane osobno dla Nadświata oraz Netheru. Po śmierci gra automatycznie tworzy czerwony znacznik **„Ostatnia śmierć”**, żeby łatwiej odzyskać ekwipunek. Dostępne są także komendy `/waypoint` i `/punkt`.
* **Naprawione sterowanie mobilne** – gra nie próbuje już uruchamiać Pointer Lock na telefonie, obsługuje urządzenia z grubym wskaźnikiem, stabilniej przechwytuje wielodotyk w Safari i Androidzie, a strefa drążka obejmuje całą lewą dolną część ekranu. Gesty są czyszczone po schowaniu karty, więc klawisze nie zostają „wciśnięte”.
* **Przypinanie światów** – ulubione zapisy można oznaczyć gwiazdką; pozostają na górze listy niezależnie od wybranego sortowania, a przypięcie nie znika po autozapisie.
* **Zarządzanie zapisem** – z menu świata można zmienić jego nazwę, utworzyć niezależną kopię, usunąć go albo wyeksportować tylko ten jeden świat. Kopiowanie pilnuje limitu 8 slotów, a import i eksport pozostają zgodne ze starszym formatem kopii zapasowych.
* **Bezpieczniejsze metadane** – nazwy są czyszczone i ograniczane do 40 znaków, kopie otrzymują unikalne identyfikatory, a import przekraczający limit zachowuje najnowsze światy.

**Wersja 2.1 „Dziennik przygód”** rozbudowuje eksplorację i ułatwia ogarnianie zapisów:

* **Dziennik przygód** (`J` lub przycisk w pauzie) śledzi postęp w rozdziałach: od pierwszych narzędzi i schronienia, przez wioskę i zaklinanie, aż po wyprawę do Netheru (w 2.3 doszedł ósmy rozdział „Wyprawa i ratunek”). Cele aktualizują się na podstawie odblokowanych osiągnięć, a dziennik pokazuje pasek postępu, współrzędne, biom, dzień, poziom, seed i pełną listę osiągnięć. Wpisy można filtrować i wyszukiwać.
* **Usprawnione menu światów** – wyszukiwanie po nazwie, ziarnie i trybie (z obsługą polskich znaków), sortowanie według ostatniego zapisu, nazwy albo długości rozgrywki oraz widoczny limit 8 zapisów. Menu i lista światów przewijają się na małych ekranach; elementy mają czytelne obramowanie fokusu klawiatury i respektują ustawienie ograniczenia animacji systemu.

**Wersja 2.0 „Mobilny skok”** to potężny update skupiony na interfejsie i urządzeniach mobilnych:

* **Automat ustawień graficznych** – gra poznaje twoje urządzenie (rdzenie CPU, pamięć, model GPU przez `WEBGL_debug_renderer_info`, gęstość pikseli) i wybiera jeden z trzech profili: **Niskie / Średnie / Wysokie**. W trybie **Auto** dobiera je przy każdym uruchomieniu – słaby telefon dostanie krótszy zasięg, niższą rozdzielczość, mniej cząsteczek, brak chmur i limit 30 FPS, a mocny komputer pełne ustawienia. Profil urządzenia podejrzyszysz w opcjach („Twoje urządzenie: …”).
* **Dynamiczna rozdzielczość (DRS)** – silnik stale mierzy FPS i sam obniża skalę renderowania do 55%, gdy klatki zaczynają spadać, i podnosi ją z powrotem, gdy jest zapas. Płynność trzyma się sama, bez grzebania w opcjach.
* **Pełne sterowanie dotykowe w stylu wersji kieszonkowej**: drążek ruchu (stały albo pojawiający się pod palcem) z **sprintem przez pchnięcie do oporu**, rozglądanie przeciągnięciem, **tapnięcie = postaw blok / użyj / zjedz / atakuj moba**, **przytrzymanie = kopanie** z celownikiem podążającym za palcem i pierścieniem postępu, duże przyciski skoku/skradania, przycisk latania w trybie kreatywnym, pasek górny (pauza, ekwipunek, czat, pełny ekran) i **tapowalny pasek ekwipunku**. Alternatywnie klasyczny tryb „Przyciski” z ⛏ i ▣ celującymi w środek ekranu.
* **Automatyczne ułatwienia mobilne**: **auto-skok** na 1-blokowe schodki, **wibracje** przy kopaniu i obrażeniach, **Wake Lock** (ekran nie gaśnie w trakcie gry), podpowiedź „obróć telefon”, safe-area dla ekranów z nacięciem oraz łuk naciągany przytrzymaniem palca.
* **Nowy ekran opcji** (wspólny dla menu i pauzy) z zakładkami **Grafika / Sterowanie / Dźwięk i HUD**: presety jakości, suwaki zasięgu, rozdzielczości i cząsteczek, limit klatek (bez / 30 / 60), dynamiczna rozdzielczość, chmury, kołysanie kamery, czułość, FOV, tryb dotyku, drążek, auto-skok, wibracje, minimapa i rozbudowany licznik FPS (pokazuje też skalę renderowania i liczbę wywołań rysowania).
* **Wydajność pod kontrolą**: budżet czasu na generowanie chunków i ich liczba na klatkę zależą od profilu (na „Niskich” 6 ms i 2 chunki), deszcz i cząsteczki są skalowane budżetem, a margines zwalniania chunków kurczy się na urządzeniach z małą ilością pamięci.

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
| mysz | rozglądanie się (po kliknięciu – blokada kursora, surowe wejście bez przyspieszeń systemu) |
| `Spacja` | skok / pływanie w górę |
| `Spacja` ×2 lub `F` | latanie (tryb kreatywny) |
| `Shift` (lewy lub prawy) | skradanie / lot w dół |
| `W` ×2 lub `Ctrl` (lewy lub prawy) | sprint |
| LPM (przytrzymaj) | kopanie · atak bije dalej z cooldownem broni |
| PPM | postawienie bloku / użycie stołu rzemieślniczego |
| ŚPM | wybór bloku z celownika |
| `1`–`9` (także numeryczne), kółko myszy | wybór slotu na pasku |
| `E` | ekwipunek i wytwarzanie · wyszukiwarka receptur po nazwie i składniku (2.6) |
| `Q` | wyrzucenie przedmiotu (`Ctrl+Q` – cały stos) |
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
| `PPM` na kowadle | ekran kowadła (scal dwa narzędzia, nadaj nazwę) (2.3) |
| wędka: `PPM` | zarzuć przynętę; `PPM` przy brań łapie rybę (2.3) |
| wędka: `PPM` w powietrzu | wciągnij przynętę (2.3) |
| lorneta: przytrzymaj `PPM` | przybliżenie 24° (2.3) |
| `PPM` na mieszkańcu | ekran handlu (wymiana towarów na szmaragdy i odwrotnie) |
| `PPM` na dzwonie | zwołanie mieszkańców na plac |
| łopata + `PPM` na trawie | ścieżka (jak w wioskach) |
| tarcza w ręku | przyłap strzały, ciosy tracą połowę mocy |
| sloty pancerza (w `E`) | załóż / zdejmij pancerz (4 elementy) |
| `M` | minimapa |
| `Esc` | pauza (ponowne `Esc` w pauzie wraca do gry) |
| `Enter` / `R` | odrodzenie na ekranie śmierci |
| `J` | dziennik przygód i postęp celów (2.1) |
| `F3` | informacje debugowania |

### Na telefonie i tablecie (sterowanie 2.5, dopracowane w 2.6)

Od 2.5 wersja dotykowa i komputerowa są **wyraźnie rozdzielone**: o wyborze decyduje główny wskaźnik urządzenia (laptop z ekranem dotykowym dostaje wersję PC), a w Opcjach → Sterowanie → **Tryb sterowania** można wymusić „Komputer” albo „Dotyk” – zmiana działa natychmiast, bez restartu świata.

Gra włącza pełne sterowanie kieszonkowe:

* **drążek ruchu** w lewym dolnym rogu – ruch; **pchnij do oporu = sprint**, dwa szybkie pchnięcia = zablokowany sprint; w opcjach wybierasz drążek stały albo pojawiający się pod palcem,
* **przeciągnięcie palcem** po reszcie ekranu – rozglądanie się,
* **tapnięcie w blok** – postawienie / użycie / jedzenie / atakowanie moba (tryb *Tapnij*),
* **przytrzymanie bloku** – kopanie; celownik podąża za palcem, a pierścień pokazuje postęp,
* **tapnięcie moba** – atak, ale mieszkaniec otwiera handel, a wilk z mięsem pozwala się oswoić (2.5),
* **sloty w oknach (E)** – tapnij: weź/połóż stos, **przytrzymaj**: połowa / jeden sztuka (2.5),
* **przytrzymanie i puszczenie z łukiem** – naciągnięcie i strzał,
* duże przyciski po prawej – **skok** (2× tap w trybie kreatywnym = latanie), **skradanie / lot w dół**, **✈ latanie**; w trybie *Przyciski* także **⛏** i **▣** celujące w środek ekranu,
* **pasek górny** – pauza, ekwipunek, czat i pełny ekran,
* **tap w slot paska** na dole wybiera przedmiot,
* **wędka i lorneta na dotyku** – tap wędką zarzuca (i wciąga) przynętę, a lorneta działa jak przełącznik: pierwsze dotknięcie przybliża, drugie wraca (2.3),
* **auto-skok** wskakuje na 1-blokowe schodki, gdy idziesz w przeszkodę (można wyłączyć),
* **wibracje** potwierdzają kopanie i obrażenia, a **Wake Lock** nie pozwala ekranowi zgasnąć,
* w pionie pojawia się dyskretna podpowiedź „obróć telefon”.

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

## 👥 Gra razem (multiplayer)

### Serwer publiczny (domyślnie)

1. Menu główne → **Gra razem · multiplayer** → zakładka **🌍 Serwer publiczny**.
2. Wpisz nazwę i kliknij **▶ Graj online**.
3. To wszystko – jesteś w wspólnym świecie. Pozostali gracze są na liście w prawym górnym rogu, a ich awatary widać w terenie.

Świat jest **jeden dla wszystkich**: stałe ziarno, tryb przetrwania, zapis bloków w chmurze. Pora dnia i pogoda są wspólne. Ekwipunek, zdrowie, moby i ustawienia grafiki są indywidualne.

**Jak to działa bez własnego serwera?** Gra jest hostowana statycznie na GitHub Pages, więc trwały stan i transmisję trzyma Supabase:

| Warstwa | Rola |
| --- | --- |
| Postgres (`blockcraft_blocks`) | trwały zapis bloków – jeden wiersz na współrzędną, upsert nadpisuje starszy |
| Realtime broadcast | natychmiastowe zmiany bloków, pozycje (4 Hz) i czat |
| Presence | lista graczy online i ich kolory |

Klucz użyty w grze jest **publiczny** („anon”) – nie da się nim nic zepsuć poza światem gry: reguły RLS pozwalają tylko czytać oraz dopisywać/aktualizować bloki świata `public`, w zakresie wysokości 0–255.

Jeśli chcesz własną kopię serwera, utwórz projekt Supabase, wykonaj SQL z sekcji „Baza danych” poniżej i podmień `SUPABASE_URL`/`SUPABASE_ANON` w `src/game/online.ts`.

### Ta sama przeglądarka (offline, dwie karty)

1. Zakładka **💻 Ta przeglądarka** → **Utwórz sesję**, nazwa, kod pokoju (albo **Losuj**), **Otwórz pokój**.
2. W drugiej karcie/oknie: **Dołącz** i ten sam kod.
3. Gospodarz klika **„Wejdź do świata i zaproś graczy”** – gość wchodzi automatycznie.

Działa bez internetu; karty muszą być w tej samej przeglądarce i na tym samym profilu.

### Przez internet (WebRTC, kody)

1. Gospodarz: **🔗 Przez internet → Utwórz sesję → 1. Utwórz kod zaproszenia**, **Kopiuj kod** i wyślij go znajomemu.
2. Gość: **Dołącz**, wkleja kod, klika **2. Przyjmij zaproszenie** i odsyła gospodarzowi **kod odpowiedzi**.
3. Gospodarz wkleja odpowiedź i klika **3. Połącz**, a potem wchodzi do świata.

Połączenie jest bezpośrednie (P2P, publiczny STUN). Jeśli sieć blokuje P2P (NAT symetryczny), użyj serwera publicznego – działa zawsze.

### Co jest wspólne, a co osobne

* **Wspólne:** bloki (także w Netherze), czat, pora dnia, pogoda, lista graczy, awatary.
* **Osobne:** ekwipunek, zdrowie, głód, osiągnięcia, moby, minimapa, punkty podróży i ustawienia grafiki. Każdy gracz ma własny punkt odrodzenia.
* **Zapis:** serwer publiczny zapisuje bloki w chmurze. Pokój lokalny/P2P żyje w pamięci gospodarza i nie trafia do slotów zapisu.

### Baza danych (Supabase)

```sql
create table public.blockcraft_blocks (
  id bigserial primary key,
  world text not null default 'public',
  dim char(1) not null default 'o',
  x integer not null,
  y smallint not null,
  z integer not null,
  block smallint not null,
  updated_at timestamptz not null default now(),
  unique (world, dim, x, y, z)
);
alter table public.blockcraft_blocks enable row level security;
create policy blockcraft_read on public.blockcraft_blocks for select to anon using (true);
create policy blockcraft_insert on public.blockcraft_blocks for insert to anon
  with check (world = 'public' and y between 0 and 255);
create policy blockcraft_update on public.blockcraft_blocks for update to anon
  using (true) with check (world = 'public');
grant select, insert, update on public.blockcraft_blocks to anon;
```

### Bezpieczeństwo

Wiadomości i wiersze z bazy są walidowane (zakresy współrzędnych i identyfikatorów, długość czatu, nazwy skracane do 20 znaków), a zapis do bazy jest ograniczony regułami RLS. Nie ma kont ani haseł – nazwa jest tylko etykietą.

## 🚀 Uruchomienie lokalne

Wymagany **Node.js 20+**.

```bash
npm install      # instalacja zależności
npm run dev      # serwer developerski -> http://localhost:5173
npm run build    # produkcyjny build do katalogu dist/
npm run preview  # podgląd produkcyjnego builda
npm run typecheck
```

Build jest **pojedynczym plikiem `dist/index.html`** (JavaScript, CSS i font są wbudowane w HTML). Pozostałe pliki to lokalne tło `dist/menu-bg.jpg`, licencja fontu `dist/OFL-Pixelify-Sans.txt` oraz techniczny znacznik `dist/.nojekyll` dla GitHub Pages.
Dzięki temu grę można otworzyć nawet bezpośrednio z dysku (`file://`) albo wrzucić na dowolny hosting statyczny – po zbudowaniu nie są potrzebne Google Fonts ani inne zewnętrzne zasoby.

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
* JavaScript, CSS i lokalne fonty są wbudowane w `index.html`; publikacja nie zależy od zewnętrznego CDN ani `assets/*`.

---

## 🧱 Co jest w grze

* **Proceduralny świat** – kontynenty, wzgórza, góry, jaskinie, rudy (węgiel, żelazo, złoto, diament), biomy: równiny, las, las brzozowy, pustynia z kaktusami, tundra, góry, plaża, ocean.
* **Wioski (1.6)** – generator stawia na równinach, w lasach i na pustyni osady z krzyżowymi drogami, studnią, domami (drzwi, szyby, dach ze schodkami, łóżko, skrzynia, piec, stół rzemieślniczy, pochodnie), biblioteką, kuźnią, zagrodami z pszenicą, stogami siana, latarniami i dzwonem. Ścieżki, siano, latarnie, ruda i blok szmaragdu oraz dzwon to nowe bloki; minimapa znaczy odkryte wioski, a komenda `/village` teleportuje do najbliższej.
* **Mieszkańcy i handel (1.6)** – pięć zawodów z własnym ubiorem i ofertami, rosnący poziom (Uczeń → Czeladnik → Mistrz → Arcymistrz), zapasy ofert i ich uzupełnianie, ceny w szmaragdach. Mieszkańcy krążą po osadzie, uciekają przed potworami i chowają się przy dzwonie. **Żelazne golemy** patrolują wioskę, atakują zombie, pająki, creepery i szkielety, a po skrzywdzeniu mieszkańca ruszają na gracza (upuszczają przy tym sztabki żelaza i maki).
* **Ponad 60 bloków** (teraz także ruda lazurytu, blok lazurytu, stół zaklęć, trzcina, ścieżka, siano, latarnia, ruda i blok szmaragdu oraz dzwon) (trawa, rudy, wełna, TNT, obsydian, pochodnia, sadzonki, grządka, pszenica, łóżko, rozpalony piec) z proceduralnie rysowaną teksturą 16×16 px – atlas + ikony 3D do ekwipunku.
* **Światło blokowe**: pochodnie, lawa i rozpalony piec rozjaśniają jaskinie także w nocy.
* **Narzędzia** (drewno, kamień, żelazo, diament): kilof, siekiera, łopata, miecz i motyka. Mają wytrzymałość i przyspieszają kopanie właściwych bloków. Węgiel chce dowolnego kilofa, żelazo i złoto – kamiennego, diamenty – żelaznego, obsydian – diamentowego.
* **Wędkarstwo (2.3)**: **wędka** (3 patyki + 2 struny) zanurza pływak, ryba bierze po 4–11 s, a kliknięcie `PPM` w 1,7-sekundowym oknie wciąga zdobycz. 70% zarzuceń to ryba albo łosoś (do pieczenia w piecu lub na ognisku), 30% to śmieci z plaży, a po 45 s pływak przepływa. Pływak znika przy zmianie wymiaru i przy zamknięciu karty, a jego stan zapisuje się ze światem.
* **Lorneta (2.3)**: 4 szkła i sztabka złota dają przybliżenie 24° z winietą i spowolnionym rozglądaniem (0,4× czułości) – do wypatrywania jaskiń, wioskek i mobów.
* **Kowadło (2.3)**: blok stawiany jak każdy inny otwiera ekran z dwoma wejściami i wynikiem. Dwa zniszczone narzędzia tego samego typu łączą się (suma wytrzymałości, najlepsze zaklęcia, maks. 3), a pole nazwy pozwala nadać przedmiotowi własne imię do 28 znaków. Każda operacja kosztuje 1 poziom doświadczenia, zawartość kowadła zapisuje się ze światem (także w Netherze), a po rozbiciu bloku wypada na ziemię razem z jego wytrzymałością i zaklęciami.
* **Totem Ratowania (2.3)**: 4 szmaragdy i sztabka złota. Pierwszy cios, który zabiłby gracza, zużywa totem zamiast wersji ze śmiercią – 6 serc, pełny brzuch i 6 s regeneracji. W trybie kreatywnym nie działa, bo tam nie ma obrażeń.
* **Głód i jedzenie**: jabłka z liści, surowe i pieczone mięso, chleb z pszenicy. Regeneracja działa tylko przy pełnym brzuchu; sprint wymaga jedzenia.
* **Piec**: PPM otwiera przetapianie (ruda → sztabka, piasek → szkło, pień → węgiel drzewny, mięso). Paliwem jest węgiel, deski, patyki albo pnie.
* **Uprawa**: motyka robi grządkę, nasiona (z trawy) rosną w pszenicę szybciej przy wodzie. Sadzonki z liści wyrastają w drzewa.
* **Wiadra** z żelaza zbierają i stawiają wodę oraz lawę.
* **Prawdziwe craftowanie wzorowe** – siatka 2×2 w ekwipunku i 3×3 u stołu rzemieślniczego. Kilof to trzy bloki nad dwoma patykami, łuk to patyki na ukos ze struną, a skrzynia to osiem desek w ramie. Wzory pasują w dowolnym miejscu siatki, a PPM kładzie po jednym przedmiocie. Lista receptur ma wyszukiwarkę po nazwie wyniku i składników (bez względu na polskie znaki) oraz filtr „Możliwe”, który uwzględnia miejsce na wynik. Wśród przepisów: łuk, strzały oraz bloki żelaza, złota i diamentów (9 sztabek → 1 blok i z powrotem).
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
* **Osiągnięcia** za drewno, kilof, diament, sen, creepera, dom, łuk, strunę, lazuryt, książkę, stół zaklęć, pierwsze zaklęcie, a od 1.6 także za odkrycie wioski, pierwszą wymianę, 25 wymian („Kupiec”), szmaragd, spotkanie golema i dzwon, a od 1.9 za teleportację perłą Endu, a od 2.3 za złowioną rybę, rozpoznanie okolicy lornetą, scalenie narzędzi i ocalenie z Totemem Ratowania.
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
    MultiplayerScreen.tsx  # „Gra razem”: serwer publiczny, pokoje lokalne i kody WebRTC
    SettingsScreen.tsx     # 2.0: opcje w zakładkach (grafika/sterowanie/dźwięk)
    JournalScreen.tsx      # 2.1: dziennik rozdziałów, cele i postęp
    GameView.tsx           # montowanie silnika, HUD, obsługa błędów
    HUD.tsx                # serca, głód powietrza, pasek, komunikaty, F3
    InventoryScreen.tsx    # ekwipunek i crafting
    EnchantScreen.tsx      # stół zaklęć (1.5)
    TradeScreen.tsx        # handel z mieszkańcami (1.6)
    AnvilScreen.tsx        # 2.3: ekran kowadła (scalanie i nazwy przedmiotów)
    TouchControls.tsx      # 2.0: pełne sterowanie dotykowe (drążek, tapnij/przytrzymaj)
    Slot.tsx               # 2.5: wspólny slot okien – mysz i dotyk (przytrzymaj = PPM)
  utils/
    settings.ts            # ustawienia gracza + presety jakości
    input.ts               # 2.5: wybór wersji sterowania (PC / dotyk) i wykrywanie urządzenia
    performance.ts         # 2.0: profil urządzenia i automat graficzny
  game/
    engine.ts              # pętla gry, gracz, interakcje, zapis
    net.ts                 # protokół sesji, BroadcastChannel, WebRTC, zegar publiczny
    online.ts              # 2.11: publiczny serwer – Supabase Realtime + zapis bloków w chmurze
    world.ts               # chunk'i, generator terenu, meshowanie
    village.ts             # generator wiosek (1.6)
    trading.ts             # zawody, oferty i poziomy mieszkańców (1.6)
    constants.ts           # rozmiary świata (CS/CH/SEA/FLAT_H)
    blocks.ts              # definicje bloków
    textures.ts            # proceduralny atlas tekstur i ikony
    physics.ts             # kolizje i ruch
    mobs.ts                # moby i ich AI (w tym tamed wilki)
    inventory.ts           # ekwipunek, stosy z nazwami i receptury
    fishing.ts             # 2.3: tabele połowu, czas brań, pieczenie ryb
    anvil.ts               # 2.3: reguły kowadła (scalanie, nazwy, koszt)
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

`.harness/smoke.ts` to asercje na czysty silnik: generowanie świata (także płaskiego), bloki, przedmioty, ekwipunek i receptury (w tym papier, książka, biblioteczka i stół zaklęć), **system zaklęć** (dopasowanie, oferty, pierścień biblioteczek, zużycie XP i lazurytu, dropy ze Szczęściem i Jedwabnym Dotykiem), fizyka, AI mobów, piece i skrzynie, zapisy, osiągnięcia, tekstury oraz algorytm opadania liści – wszystko bez WebGL. Od 2.3 dołączyły **tabele połowu i czas brań, receptury wędki/lornety/totemu, reguły kowadła (scalanie, nazwy, koszt poziomu) razem z kowadłem w silniku, Totem Ratowania w `damage()` oraz zestaw naprawionych błędów** (dzielenie stosu, ŚPM poza paskiem, import nazw, odbicie szlamu, obrażenia miecza, XP z rud).
Od 2.11 dochodzi **publiczny serwer**: zegar dnia i pogody, mapowanie wierszy bazy na bloki, paginacja wczytywania świata, batchowanie upsertu (maks. 300 wierszy), ponawianie nieudanego zapisu, obsada z Presence oraz brak wysyłki pustych wiadomości – wszystko na atrapie klienta Supabase, bez sieci. Od 2.10 jest **protokół multiplayer**: normalizacja kodów pokoju, pakowanie SDP w kod base64url, handshake `hello → welcome` z migawką świata, przekazywanie edytów i czatu przez gospodarza, ping/pong, timeout gracza, walidacja danych z sieci, a także handshake na **prawdziwym `BroadcastChannel`** (Node ma go wbudowany, więc test nie potrzebuje przeglądarki). Kontrole źródła pilnują, że silnik wysyła pozycje, synchronizuje oba wymiary i nie zapętla własnych edytów.

`.harness/ui.tsx` renderuje menu przez `react-dom/server` (bez przeglądarki), a gdy zainstalowany jest `jsdom` (`npm i --no-save jsdom`) montuje całe `<App/>`, przechodzi tworzenie świata i sprawdza, że brak WebGL kończy się czytelnym komunikatem, a nie białą stroną. Bez jsdom ten drugi krok jest pomijany. Od 2.3 renderuje też **ekran kowadła** (oba wejścia, wynik z kosztem, ostrzeżenie o braku poziomów, pole nazwy) i sprawdza **nowy rozdział dziennika przygód**.

## 🛠️ Rozwiązywanie problemów

| Problem | Rozwiązanie |
| --- | --- |
| Czarny ekran i komunikat o WebGL | Włącz akcelerację sprzętową w przeglądarce (Chrome: `chrome://settings/system`, Firefox: `about:preferences#general`). |
| Brak tła w menu | Sprawdź, czy plik `menu-bg.jpg` został wgrany razem z `index.html` (build kopiuje go z `public/`). |
| Brak dźwięku | Gra działa bez dźwięku, jeśli przeglądarka blokuje Web Audio – kliknij w ekran gry, aby odblokować dźwięk. |
| „Kliknij, aby kontynuować” i brak reakcji na klawiaturę | Kliknij w ekran gry – przeglądarka musi ponownie przejąć blokadę kursora. |
| Zbyt wolno na słabym sprzęcie | Wybierz profil **Niskie** (albo zostaw **Auto**) w opcjach – zasięg, rozdzielczość, cząsteczki i limit FPS dostosują się same. Dynamiczna rozdzielczość dodatkowo utrzymuje płynność w ruchu. |
| Chcę przenieść światy na inny komputer | Menu główne → *Eksport zapisów*, a na drugim urządzeniu *Import zapisów*. |
| „Nie znaleziono gospodarza pokoju” | Sprawdź kod pokoju (małe litery, myślnik zamiast spacji) i upewnij się, że druga karta jest w **tej samej przeglądarce** i na tym samym profilu. |
| Połączenie P2P wisi na „Łączę…” | Sieć blokuje ruch bezpośredni (NAT symetryczny, firewall). Spróbujcie w tej samej sieci Wi-Fi albo użyjcie trybu „Ta sama przeglądarka”. |
| Gość nie widzi zmian bloków | Sprawdź, czy oba okna pokazują ten sam kod pokoju i czy gospodarz nie zamknął karty – sesja żyje tylko w jego przeglądarce. |
| „Brak połączenia z internetem” na serwerze publicznym | Gra potrzebuje sieci, żeby pobrać świat. Sprawdź połączenie i odśwież stronę – budowle są w chmurze, więc nic nie ginie. |
| „Baza serwera nie jest jeszcze przygotowana” | W projekcie Supabase brakuje tabeli `blockcraft_blocks` – wykonaj SQL z sekcji „Baza danych”. |
| Chcę grać bez internetu | Wybierz **Ta przeglądarka** – pokój działa lokalnie, a świat nie opuszcza komputera. |

## 📜 Licencja

Kod gry: **MIT** – rób z nim, co chcesz.
Projekt inspirowany grą *Minecraft* (Mojang Studios); nie jest z nią powiązany i nie zawiera jej zasobów – wszystkie tekstury rysowane są proceduralnie w przeglądarce.
