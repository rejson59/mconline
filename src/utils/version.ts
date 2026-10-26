/** Single release label shared by the menu, HUD, and in-game help. */
export const GAME_VERSION = '4.2.0';
export const GAME_RELEASE_NAME = 'Naturalne osady i struktury';
/** Wersja Minecrafta, do której gra dopasowuje tekstury, modele i zachowanie. */
export const MINECRAFT_TARGET = 'Minecraft: Java Edition 1.20.4';

/**
 * 2.32: skrzynia jak z Minecrafta, gra na „ziemniaku” i klawiatura na tablecie.
 * Skrzynia ma teraz prawdziwy model `ChestModel` z paczki 26.2: korpus
 * 14 × 10 × 14 px, wieko 5 px na zawiasie y = 9, zamek wystający 1 px przed
 * front i teksturę `entity/chest/normal.png` wprost z atlasu – pojedyncza
 * oraz podwójna, z lewą i prawą połówką (`normal_left/right.png`) i klapą,
 * która podnosi się, gdy gracz podejdzie. Skrzynia staje przodem do gracza
 * (cztery kierunki, jak `HorizontalDirectionalBlock#FACING`). Wydajność:
 * automat jakości ma czwarty stopień („minimalny”), tnie zasięg rysowania,
 * limit rozdzielczości i cząsteczki, presety dostały „Ziemniaka” (3 chunki),
 * a mesher liczy specjalne bryły raz na typ bloku i czyta UV z gotowej
 * tabeli – mniej pracy na chunk i mniej śmieci dla GC. Sterowanie: tablet
 * z klawiaturą lub myszką Bluetooth przełącza się na tryb komputerowy
 * w locie (mysz działa nawet bez Pointer Lock), a po 15 s ciszy i trzech
 * dotknięciach ekranu wraca do drążka.
 * 2.31: owca z runem na właściwej stronie, dźwięki 1:1 i spokojna ścieżka.
 * Wełna owcy była doklejona pod korzeń modelu, który sam obraca się o 180°,
 * i miała własny obrót – razem 360°, więc runo stało tyłem i czarna bryła
 * zasłaniała pysk. Teraz wełna dziedziczy tylko obrót korzenia. Warstwa
 * dźwięku dostała prawdziwą przestrzeń: każdy dźwięk liczy odległość od
 * uszu gracza, cichnie liniowo do zera (16–24 bloki jak waniliowe
 * `attenuation_distance`), przesuwa się w panoramie zależnie od obrotu
 * kamery i ciemnieje filtrem dolnoprzepustowym. Każdy z 14 mobów ma własny
 * głos (barwa, formanty, wibrato, szum oddechu, ziarna) w trzech wariantach
 * – bezczynność, trafienie, śmierć – plus własny rodzaj stąpania, a moby
 * wreszcie stawiają słyszalne kroki. Skrzynia skrzypi przy otwarciu
 * i trzaśnie przy zamknięciu, metale dzwonią jak `block.metal`, a limiter
 * na wyjściu chroni miks przed przesterowaniem. Auto-skok patrzy teraz
 * tylko na powierzchnie WYŻSZE od stóp i pomija wszystko w zasięgu kroku
 * 0,6 – wcześniej sonda brała `floor(stopa + 0,05)`, trafiała w blok
 * ścieżki pod nogami i gracz podskakiwał bez przerwy.
 * 2.30: koniec trzęsienia na ścieżce, golem oddaje, płynni gracze.
 * Fizyka ląduje teraz na RZECZYWISTEJ powierzchni bryły (ścieżka 15/16,
 * grządka 15/16, płyta 1/2, łóżko 9/16) zamiast na górnej krawędzi całej
 * kratki – właśnie to podnosiło postać o 1/16 bloku co klatkę i trzęsło
 * kamerą oraz mobami. Krok to waniliowe 0,6 bloku, więc wchodzi się też na
 * łóżko, a wejście na płytę stawia stopy dokładnie na 0,5 (wcześniej
 * postać podskakiwała o pół bloku). Strzały i wybuchy niosą informację,
 * kto je spowodował, więc żelazny golem oddaje także po strzale z łuku
 * i po TNT, a w pościgu omija przeszkody, zamiast wbijać się w drzewo.
 * Zdalni gracze są interpolowani z bufora migawek (4 Hz na serwerze
 * publicznym), więc awatar płynie, a nie skacze i zamiera. Moby patrzą
 * na gracza także górą/dół i rozglądają się, gdy nikt nie jest blisko.
 * 2.29: drzwi i łóżko wreszcie działają jak w Minecrafcie, a dźwięki
 * brzmią jak wanilia. Drzwi mają prawdziwe modele z zawiasem (lewy i prawy),
 * skrzydło stoi po przeciwnej stronie niż patrzył gracz, otwarte obraca się
 * o 90° wokół zawiasu i nadal blokuje, a krawędzie dostają własne wycinki
 * tekstury. Łóżko to dwa bloki (stopa + wezgłowie) w czterech kierunkach,
 * z materacem 6 px na nogach 3 px, własnymi teksturami głowy i stopy oraz
 * respawnem przy stopie. Dźwięki zyskały proceduralny pogłos małego
 * pomieszczenia, barwy materiałów (rezonans + korpus) i nowe efekty:
 * drzwi, łóżko, plusk, ból, chrupanie, wybuch i cięciwa łuku.
 * 2.28: wbudowane „mody wydajności” i pozostałe okna 1:1 z Minecraftem.
 * Teren w oddali (odpowiednik Distant Horizons) rysuje tanie pasmo kafli
 * za horyzontem – widać góry i morza setki bloków dalej bez budowania
 * pełnych chunków. Chunki powstają w kolejności patrzenia (Sodium),
 * dalekie moby aktualizują się co kilka klatek (Entity Culling), a automat
 * jakości pilnuje czasu klatki i sam zmniejsza budżet, gdy gra zwalnia
 * (ImmediatelyFast/Nvidium). Kowadło, stół zaklęć, statyw alchemiczny
 * i piec mają teraz prawdziwe panele z paczki i waniliowe współrzędne.
 * 2.27: stabilni mieszkańcy i okno handlu 1:1 z Minecraftem.
 * Mieszkaniec nie podskakuje już przy płocie i ścianie (skok miał czas
 * odnowienia, a sonda sięga od krawędzi ciała), przestał też trząść się
 * w panice (kierunek ucieczki jest stały, a nie losowy co klatkę), a moby
 * delikatnie się rozsuwają, zamiast stać w sobie. Okno handlu to prawdziwy
 * `MerchantScreen`: panel 276 × 166 z paczki, lista ofert 88 × 140,
 * przewijanie `scroller`, strzałka i znaczek „brak towaru” z paczki,
 * pasek doświadczenia mieszkańca i ekwipunek 9 × 3 + pasek skrótów
 * na waniliowych współrzędnych.
 * 2.26: koniec prześwitów w wioskach, nawadniane grządki, odrzut i golem.
 * Siatka bloku culluje ścianę sąsiada tylko wtedy, gdy ten naprawdę wypełnia
 * całą kratkę (`CULLS`), więc ścieżka i grządka (15/16) nie robią już
 * 1-pikselowej szpary, przez którą było widać świat. Grządka ma dwa warianty
 * jak `moisture` w wanilii: suchy i nawodniony (woda w promieniu 4 bloków,
 * także poziom wyżej), a nawodniona rośnie szybciej i ma ciemniejszą teksturę.
 * Cios gracza naprawdę odrzuca moby (~1,5 bloku w pół sekundy), żelazny golem
 * jest na to odporny i staje w obronie mieszkańców oraz oddaje napastnikowi.
 * 2.25: ręce mobów i fizyka bloków. Animacja kończyn dokłada się teraz do
 * pozy z modelu (zombie nie chowa już rąk za plecami), a piasek i żwir
 * spadają całą kolumną: z przyspieszeniem, kurzem, wypieraniem wody,
 * niszczeniem drobiazgów po drodze i osypywaniem się po wybuchu.
 * 2.24.1: powrót do poprzedniego wyglądu – pierwszym ekranem jest znowu
 * klasyczne menu gry (tło z paczki, duże BLOCKCRAFT, przyciski jak wcześniej).
 * Launcher został w kodzie i wchodzi się do niego tylko pod adresem
 * `#launcher`; nie zmienia niczego w rozgrywce, zapisach ani grafice.
 * 2.24: launcher w przeglądarce – gra startuje z klienta w stylu Lunar Client:
 * profil gracza i skórka, instancje światów (seed, tryb, typ), publiczny
 * serwer, paczka tekstur z ustawieniami wydajności, ustawienia gry i konsola
 * zdarzeń. Launcher jest w 100% lokalny, nie pobiera plików Mojanga i nie
 * łączy się z kontem Minecrafta – uruchamia tę samą grę co wcześniej, tylko
 * z wybranym światem i profilem.
 * 2.23: zgodność z Minecraftem 26.2 – modele mobów z waniliowej geometrii tej
 * wersji (pysk i rogi krowy, lustrzane UV nóg, czapka zombie,
 * rond kapelusza mieszkańca, macki ghasta), warianty biomowe krowy, świni
 * i kury (ciepły/zimny/umiarkowany), ikona tarczy z tekstury paczki i 100/100
 * ikon przedmiotów, barwienie tylko szarych tekstur (trzcina cukrowa i inne
 * kolorowe pliki nie są już przyciemniane zielenią biomu).
 * 2.22: moby 1:1 z Minecraftem – poprawiona owca, pudełka kolizji prosto
 * z waniliowych `EntityDimensions`, pełna paleta 16 kolorów wełny, wypas
 * i odrastanie runa, modele pająka, szkieletu i kury bez błędów.
 * 2.21: bryły i zachowanie bloków oraz przedmiotów 1:1 z Minecraftem –
 * własne modele płotu, pochodni, skrzyni, kowadła, ogniska, ścieżki, lilii,
 * latarni, dzwonu i statywu alchemicznego,
 * kolizje płyty/schodów/płotu, step-up, waniliowe trwałości, obrażenia,
 * poziomy kilofów, dropy, jedzenie i stosy.
 * Lista jest kumulatywna – trzyma też wpisy z poprzednich wydań.
 */
export const RELEASE_HIGHLIGHTS: { title: string; text: string }[] = [
  { title: 'Osady dopasowane do terenu', text: 'Każdy dom ma własny poziom fundamentu. Ścieżki idą po pagórkach, bez wielkiej płaskiej platformy. Dachy ze schodów i okapami, kominy kuźni oraz piaskowcowe tarasy na pustyni.' },
  { title: 'Cztery nowe struktury', text: 'Pustynne świątynie ze skarbcem, zamszone ruiny w dżungli, chatki na palach na bagnach i zniszczone portale. Szukaj ich w nowym świecie; zapisane zmiany bloków nadal mają pierwszeństwo.' },
  {
    title: 'Skrzynia 1:1 z Minecrafta',
    text: 'Skrzynia nie jest już bryłą z trzech rozciągniętych kafelków 16 × 16. Ma prawdziwy model `ChestModel` z paczki 26.2: korpus 14 × 10 × 14 px od (1,0,1), wieko 5 px zawieszone na y = 9 i zamku wystający 1 px przed front, a wszystko czyta piksele wprost z `entity/chest/normal.png` (UV liczone jak w waniliowym `ModelPart.Cube`). Skrzynia staje przodem do gracza, łączy się w podwójną (lewa i prawa połówka z `normal_left/right.png`, wspólna klamra na środku, bez szczeliny), a wieko podnosi się, gdy podejdziesz, i opada po odejściu.',
  },
  {
    title: 'Gramy na „ziemniaku” – 30 FPS i więcej',
    text: 'Automat jakości dostał czwarty stopień („minimalny”). Gdy klatki są wolne, gra nie tylko buduje chunki rzadziej, ale przede wszystkim zmniejsza zasięg rysowania (bez kasowania świata w pamięci), obniża limit rozdzielczości i tnie cząsteczki – a mgła kończy się tam, gdzie kończą się siatki, więc horyzont nie wygląda na urwany. Nowy preset „Ziemniak” (3 chunki, rozdzielczość 0,75) jest dla sprzętu, na którym „Niskie” to za dużo. Sam mesher też przyspieszył: specjalne bryły liczy raz na typ bloku, a UV czyta z gotowej tabeli.',
  },
  {
    title: 'Klawiatura i mysz na tablecie',
    text: 'Tablet z klawiaturą albo myszką Bluetooth (albo USB) zgłasza się jako urządzenie dotykowe, więc wcześniej gra pokazywała drążek i ignorowała sprzęt. Teraz pierwszy realny ruch myszy lub klawisz gry przełącza sterowanie na komputerowe w locie, bez restartu świata – mysz działa nawet tam, gdzie przeglądarka nie pozwala przechwycić kursora (iPad), bo kamera obraca się różnicą pozycji wskaźnika. Po 15 s bez sprzętu i trzech dotknięciach ekranu gra sama wraca do drążka, a klawiatura ekranowa nigdy nie przełącza sterowania.',
  },
  {
    title: 'Owca z runem na właściwej stronie',
    text: 'Runo było doklejone pod korzeń modelu, który sam obraca się o 180°, a miało jeszcze własny obrót – razem pełne 360°. Efekt: wełniana bryła stała tyłem i zasłaniała pysk, a wełniane nogi wyrastały z tyłu głowy. Teraz wełna dziedziczy wyłącznie obrót korzenia: runo otacza tułów (spuchnięte o 1,75 px z każdej strony), głowa ma własną czapkę z wełny, a pysk jest widoczny. Model zgadza się co do piksela z waniliowym `sheep.json` z 26.1.2.',
  },
  {
    title: 'Głosy mobów 1:1 z grą',
    text: 'Każdy z 14 mobów ma własny, syntezowany głos: świnia chrząka szybkim wibratem, owca beczy wolno (9 Hz), krowa ma długie, niskie „muu”, szkielet klika kośćmi, creeper syczy szumem bez tonu, a enderman „vwuuup” z powolnym atakiem. Do tego trzy warianty – bezczynność, trafienie i śmierć – oraz własny rodzaj stąpania (miękkie łapy, twarde, kości, metal, szlam). Moby wreszcie stawiają słyszalne kroki liczone z przebytej drogi, więc stojący mob nie stuka.',
  },
  {
    title: 'Dźwięk w przestrzeni, skrzynia i metal',
    text: 'Każdy dźwięk liczy teraz odległość od uszu gracza, cichnie do zera na 16–24 blokach, przesuwa się w panoramie zależnie od obrotu kamery i ciemnieje filtrem dolnoprzepustowym, gdy źródło jest daleko – dokładnie jak waniliowe `attenuation_distance`. Skrzynia skrzypi przy otwarciu i trzaśnie przy zamknięciu (i tylko wtedy – nie przy każdym innym oknie), a żelazo, złoto, kowadło, dzwon, latarnia i tory dzwonią jak `block.metal`. Limiter na wyjściu chroni miks przed przesterowaniem, gdy kilkanaście mobów gra naraz.',
  },
  {
    title: 'Koniec podskoków na ścieżce',
    text: 'Auto-skok sprawdzał `floor(stopa + 0,05)`. Odkąd fizyka stawia stopy dokładnie na 15/16 ścieżki, ten `floor` trafiał w blok POD nogami – gracz widział przeszkodę w każdej klatce i podskakiwał bez przerwy. Nowa sonda (`autoJumpAhead`) patrzy wyłącznie na powierzchnie wyższe od stóp, pomija wszystko w zasięgu kroku 0,6 (ścieżka, grządka, płyta, łóżko, schody) i sprawdza, czy nad przeszkodą jest miejsce na głowę. Skok włącza się tylko przy prawdziwym bloku – jak w wanilii.',
  },
  {
    title: 'Koniec trzęsienia na ścieżce',
    text: 'Postać ląduje teraz na rzeczywistej powierzchni bryły, a nie na górnej krawędzi całej kratki. Ścieżka i grządka mają 15/16 bloku, więc wcześniej gracz i moby były co klatkę podnoszone o 1/16 i opadały – kamera dosłownie drgała. Teraz stopa staje dokładnie na 15/16, a wejście na płytę kończy się na 0,5 (wcześniej było 0,55 w górę i pół bloku spadania).',
  },
  {
    title: 'Golem oddaje po strzale i wybuchu',
    text: 'Każde źródło obrażeń mówi teraz, kto je zadał: strzała gracza, strzała szkieletu, TNT podpalone ogniwem i creeper. Dzięki temu żelazny golem bierze napastnika na cel także wtedy, gdy oberwie z łuku albo wybuchem, ściga go z 32 bloków i w pościgu omija drzewa i płoty, zamiast wbijać się w nie bez końca.',
  },
  {
    title: 'Płynni gracze w multiplayerze',
    text: 'Zdalny gracz nie „dogania” już ostatniego pakietu – pozycje trafiają do bufora migawek, a awatar jest rysowany w środku przedziału między dwiema z nich. Przy 4 pakietach na sekundę (serwer publiczny) ruch jest ciągły jak w Minecrafcie, obrót także jest interpolowany po krótszej drodze, a nogi i ręce animują się z faktycznej prędkości.',
  },
  {
    title: 'Żywszy ruch głowy',
    text: 'Mob patrzy na gracza nie tylko w poziomie, ale i w pionie – golem stojący nad tobą zadziera łeb, a krowa obok patrzy ci w oczy. Głowa odwraca się do 75° od tułowia (jak w wanilii), a gdy nikt nie jest blisko, mob co kilka sekund rozgląda się na boki. Naprawiony został też znak przy wypasie: owca skubiąca trawę patrzy w dół, a nie w niebo.',
  },
  {
    title: 'Drzwi z prawdziwym zawiasem',
    text: 'Drzwi mają teraz dwa modele z paczki – zawias z lewej i z prawej – i stoją po przeciwnej stronie kratki niż patrzył gracz, dokładnie jak w `DoorBlock`. Zamknięte to płyta 3/16 przy ościeżnicy, otwarte obracają się o 90° wokół zawiasu, a krawędzie dostają własne 3-pikselowe wycinki tekstury, więc nie widać już ściśniętych drzwi na boku. Otwarte skrzydło wreszcie blokuje ruch, a nie jest dziurą w ścianie.',
  },
  {
    title: 'Łóżko z dwóch bloków',
    text: 'Łóżko to stopa i wezgłowie – dwa bloki w czterech kierunkach, jak w 26.2. Materac ma 6 px grubości i wisi 3 px nad podłogą na czterech nogach 3×3 px, a każda ściana bierze własną teksturę z paczki (`red_bed_head_east`, `red_bed_foot_up`…). Stawiasz je jednym kliknięciem, głowa ląduje dalej od ciebie, a punkt odrodzenia ustawia się przy stopie.',
  },
  {
    title: 'Dźwięki jak w grze',
    text: 'Każdy efekt przechodzi teraz przez proceduralny pogłos małego pomieszczenia, a materiały mają własne barwy: rezonans i niskie „korpus” pod dłonią. Drzwi skrzypią i kłapią, łóżko szeleści po przespanej nocy, woda pluska bąbelkami, ból to dwa opadające tony, jedzenie chrupie trzy razy, a wybuch ma niski „bum” i spadający gruz. Wszystko syntezowane na bieżąco – zero plików z gry.',
  },
  {
    title: 'Skrzynia jak w Minecrafcie',
    text: 'Ostatnie duże okno bez waniliowego wyglądu: skrzynia ma teraz prawdziwy panel z `generic_54.png`, sklejony dokładnie tak, jak robi to `GenericContainerScreen` – górna część 176 × 71 i pasek ekwipunku 176 × 96. Siatka 9 × 3 leży na (8, 18), ekwipunek wraca na (8, 84), a pasek skrótów na (8, 142).',
  },
  {
    title: 'Teren za horyzontem',
    text: 'Za pełnymi chunkami rysujemy teraz tanie pasmo terenu (LOD): siatka próbkuje generator świata co 4–16 bloków i dostaje kolory biomów, cieniowanie zboczy i śnieg na szczytach. Z góry widać góry i morza setki bloków dalej – zasięg to cztery razy zasięg renderowania, a koszt to kilkanaście tysięcy trójkątów. To odpowiednik moda Distant Horizons, włączany w opcjach („Teren w oddali”).',
  },
  {
    title: 'Chunki budują się tam, gdzie patrzysz',
    text: 'Kolejka budowy sortuje chunki po odległości i kierunku patrzenia – to, co jest przed graczem, powstaje pierwsze, a to, co za plecami, poczeka. Sortowanie przelicza się dopiero po obrocie o ~0,4 rad albo co pół sekundy, więc nie zjada klatek. Efekt jest taki jak w Sodium: nowy teren pojawia się w polu widzenia, zamiast losowo wokół gracza.',
  },
  {
    title: 'Automat jakości i culling mobów',
    text: 'Automat mierzy czas klatki i po 1,5 s zwolnień sam zmniejsza budżet budowania oraz zasięg LOD, a po 3 s płynnej gry wraca do pełnej jakości – bez skoków obrazu. Moby dalej niż 48 bloków aktualizują się co 2–6 klatek (Entity Culling), z ruchem liczonym z pełnym czasem, więc nic nie zwalnia – po prostu rzadziej próbkujemy. Razem: więcej FPS przy tym samym zasięgu.',
  },
  {
    title: 'Kowadło jak w Minecrafcie',
    text: 'Prawdziwy panel `anvil.png` 176 × 166, dwa sloty wejściowe i wynik na waniliowych współrzędnych, pole nazwy na tle `text_field` (110 × 16) i koszt w poziomach pod wynikiem – zielony, gdy stać, czerwony, gdy brakuje. Zniknęły duże opisy i etykiety – zostaje to, co w grze.',
  },
  {
    title: 'Stół zaklęć, statyw i piec 1:1',
    text: 'Stół zaklęć ma trzy przyciski ofert (108 × 19) na wysokościach 13 / 32 / 51, slot przedmiotu i lazurytu. Statyw alchemiczny rysuje pęcherzyki (12 × 29) rosnące od dołu, pionowy postęp warzenia (9 × 28) i pasek paliwa (18 × 4). Piec dostał płomień (14 × 14) i strzałkę postępu (24 × 16) prosto z paczki, a wszystkie cztery okna dzielą waniliową siatkę ekwipunku 9 × 3 + pasek skrótów.',
  },
  {
    title: 'Testy i build',
    text: 'Nowa sekcja testów 2.28 sprawdza budżet klatki, kolejność budowy chunków, interwały ticków mobów, progi automatu jakości, siatkę i pierścień LOD oraz każdą współrzędną nowych okien (sloty, pole nazwy, oferty, pącherzyki, płomień). `npx tsc --noEmit`, `npm test` i `npm run build` przechodzą w całości.',
  },
  {
    title: 'Mieszkańcy przestali drżeć',
    text: 'Mieszkaniec podskakiwał przy płocie i ścianie, bo skok dokładał się w każdej klatce — teraz ma własny czas odnowienia, a sonda przeszkody sięga od krawędzi ciała (wcześniej 0,8 bloku od środka przeskakiwało płot i kod „widział” powietrze). Jak w wanilii mieszkaniec i golem w ogóle nie skaczą: po prostu zawracają, i to najwyżej raz na 0,7 s.',
  },
  {
    title: 'Koniec trzęsienia w panice',
    text: 'Po ciosie mieszkaniec dodawał losowy obrót w każdej klatce, więc model dosłownie dygotał w miejscu. Teraz kierunek ucieczki jest zapamiętany przy trafieniu, a tylko lekko faluje (sinus ±0,35 rad). Losowe obroty przy wodzie i klifie też mają czas odnowienia, a moby stojące w sobie delikatnie się rozsuwają — zamiast przenikać się modelami.',
  },
  {
    title: 'Okno handlu jak w Minecrafcie',
    text: 'Zamiast listy zielonych przycisków jest prawdziwy `MerchantScreen`: panel 276 × 166 z paczki, lista ofert 88 × 140 (7 wierszy po 20 px) z przewijaniem `scroller`, dwa sloty towaru i duży slot wyniku, strzałka i znaczek „brak towaru” (`out_of_stock`) z paczki, pasek doświadczenia mieszkańca i ekwipunek 9 × 3 + pasek skrótów na waniliowych współrzędnych.',
  },
  {
    title: 'Handel jak w grze',
    text: 'Klikasz wiersz, żeby wybrać ofertę, a dopiero slot wyniku (albo dwuklik na wierszu) wykonuje wymianę — dokładnie jak w Minecrafcie. Zostało widać zapas oferty, brak towaru zaznacza czerwony krzyżyk, a wyczerpana oferta dostaje szarą strzałkę. Panel skaluje się do 2× i zawsze mieści się na telefonie.',
  },
  {
    title: 'Koniec prześwitów w wioskach',
    text: 'Ściana sąsiada znika teraz tylko wtedy, gdy ten sąsiad naprawdę wypełnia całą kratkę. Wcześniej siatka patrzyła na samą flagę „nieprzezroczysty”, więc ścieżka i grządka o wysokości 15/16 chowały sąsiadowi pełną ścianę – nad ich krawędzią zostawała 1-pikselowa szpara i przez podłogę wioski było widać świat. Nowa tablica `CULLS` liczy faktyczny kształt bryły, a kowadło (pełna kolizja, model 12/16) też przestało zasłaniać ściany.',
  },
  {
    title: 'Grządka wie, gdzie jest woda',
    text: 'Grządka ma teraz dwa warianty jak `moisture` w Minecrafcie: suchy i nawodniony. Wystarczy woda w promieniu czterech bloków – także na skos i o poziom wyżej – żeby blok zrobił się ciemniejszy, a rośliny rosły dwa razy szybciej (9 s zamiast 18 s). Po zabraniu wody grządka wraca do suchej wersji, dokładnie jak w waniliowym `FarmBlock`.',
  },
  {
    title: 'Cios naprawdę odrzuca',
    text: 'Zombie po trafieniu odlatuje o jakieś półtora bloku i dopiero po pół sekundy wraca do pościgu – wcześniej cios tylko ujmował mu zdrowie, a mob biegł dalej, jakby nic się nie stało. Prędkość pościgu zombie spadła do 2,15 bloku/s (wanilia ~2,1–2,3), więc nie dogania gracza w pół kroku, a odrzut ma własny czas, w którym AI nie steruje ruchem.',
  },
  {
    title: 'Golem staje w obronie wioski',
    text: 'Żelazny golem reaguje teraz na potwory, które atakują mieszkańca, nawet jeśli same są od niego daleko: leci do napastnika (do 32 bloków), a nie do najbliższego zombie. Gdy ktoś go uderzy, zapamiętuje napastnika i oddaje mu ciosy. Gracz, który go sprowokuje, dostaje kontratak, a odrzucić go nie można – tak jak w wanilii (odporność na odrzut 100%).',
  },
  {
    title: 'Koniec z rękami do tyłu',
    text: 'Animacja kończyn dokłada się teraz do pozy zapisanej w modelu, a nie ją nadpisuje. Zombie znów trzyma ręce wyciągnięte do przodu: waniliowa poza zostaje, a chód tylko lekko ją kołysze. Wcześniej wpis −90° z animacji kasował ją w pierwszej klatce i ręce wędrowały za plecy.',
  },
  {
    title: 'Audyt wszystkich mobów',
    text: 'Test przechodzi po wszystkich 19 modelach i sprawdza, że głowa każdego moba patrzy w stronę ruchu, a animacja nie psuje pozy z modelu: mieszkaniec nie opuszcza złożonych rąk, pająk nie prostuje nóg, kura nie chowa skrzydeł, a golem i enderman nie dostają pozy zombie.',
  },
  {
    title: 'Piasek naprawdę spada',
    text: 'Piasek i żwir spadają całą kolumną naraz, z przyspieszeniem, chmurą kurzu i dźwiękiem. Blisko gracza widać lecące klocki, dalej materiał osiada od razu, żeby nie marnować klatek – wcześniej blok potrafił zniknąć albo przeskoczyć o kilka kratek.',
  },
  {
    title: 'Fizyka, która sprząta po sobie',
    text: 'Spadający blok niszczy po drodze pochodnie, rośliny, szyny i lilie (wypadają jako przedmioty), wypiera wodę i rani, jeśli spadnie na głowę. Wybuch uruchamia osypywanie się piasku nad wyrwą, a kolumna nad wybitym blokiem spada razem.',
  },
  {
    title: 'Przedmioty toną powoli',
    text: 'W wodzie przedmioty wyhamowują i opadają wolniej zamiast spadać jak kamień – łatwiej je złapać, gdy wpadną do jeziora albo rzeki.',
  },
  {
    title: 'Klasyczne menu wraca',
    text: 'Po 2.24 pierwszym ekranem znów jest stare, dobre menu gry: tło z paczki, wielkie BLOCKCRAFT, podpis wersji i te same przyciski co wcześniej. Nic nie zostało przeprojektowane – wrócił dokładnie poprzedni wygląd.',
  },
  {
    title: 'Launcher bez przeszkadzania',
    text: 'Klient z 2.24 nie zniknął: profile, instancje światów, paczki, skórki i konsola czekają pod adresem z dopiskiem #launcher. Domyślnie się nie pokazuje, więc nie zmienia pierwszego wrażenia ani nie zabiera miejsca na telefonie.',
  },
  {
    title: 'Światy jako instancje',
    text: 'Zakładka „Światy” to menedżer instancji: tworzysz świat z własnym seedem, trybem (przetrwanie/kreatywny) i typem (normalny/płaski), a potem grasz, zmieniasz nazwę, duplikujesz, przypinasz do ulubionych lub usuwasz. Ostatni świat wraca jednym kliknięciem z ekranu Start.',
  },
  {
    title: 'Paczki, wydajność i skórki',
    text: 'Zakładka „Paczki i mody” pokazuje wbudowaną paczkę 26.2 (168 kafelków, 100 ikon, 25 skórek) i pozwala przełączać presety graficzne oraz suwaki cząsteczek i zasięgu. W „Skórkach” wybierasz jedną z 9 postaci z paczki i ustawiasz nick, a profil pamięta liczbę uruchomień.',
  },
  {
    title: 'Serwer i konsola',
    text: 'Publiczny serwer ma własną kartę z jednoklikowym dołączeniem, a konsola pokazuje dziennik launchera: etapy uruchamiania, wykryty sprzęt, zmiany ustawień i zdarzenia świata. Wszystko po polsku i czytelnie – także na telefonie.',
  },
  {
    title: 'Uczciwie o oryginale',
    text: 'Oryginalny klient Minecrafta (Java) nie działa w przeglądarce i nie da się go legalnie uruchomić bez plików Mojanga, dlatego launcher obsługuje BlockCraft: własną grę z paczką tekstur 26.2. Nie łączy się z kontem ani serwerami Minecrafta i niczego nie pobiera z sieci.',
  },
  {
    title: 'Moby z modeli Minecrafta 26.2',
    text: 'Modele zwierząt pochodzą teraz z waniliowej geometrii wersji 26.2: krowa ma wystający pysk i rogi w miejscu z gry, nogi krowy, świni i owcy mają lustrzane UV, zombie nosi zewnętrzną warstwę głowy, mieszkaniec dostał rond kapelusza, a ghast – dziewięć macek o prawdziwych długościach. Dzięki temu każdy piksel tekstury z paczki trafia dokładnie tam, gdzie w grze.',
  },
  {
    title: 'Warianty biomowe zwierząt',
    text: 'Krowa, świnia i kura mają po trzy wersje – umiarkowaną, ciepłą i zimną – i dostają ją przy narodzinach z biomu, jak w Minecrafcie: zimna krowa z kudłatym futrem i grubymi rogami w tundrze i górach, ciepła w sawannie, dżungli i na pustyni, a zimowa świnia i kura mają dodatkowe warstwy futra i piór.',
  },
  {
    title: 'Tarcza i wszystkie 100 ikon',
    text: 'W paczce nie ma osobnego obrazka tarczy, więc ikona powstała z przedniej ściany prawdziwej tekstury tarczy (12 × 22 px) – teraz każdy przedmiot w grze ma ikonę z paczki (100/100), a nie tylko 99.',
  },
  {
    title: 'Kolory dokładnie jak w paczce',
    text: 'Barwienie biomem dostają tylko tekstury szare, tak jak w wanilii. Kolorowe pliki – trzcina cukrowa, kwiaty i inne – pokazują teraz oryginalne barwy z paczki zamiast przyciemnionej zieleni biomu.',
  },
  {
    title: 'Testy i build',
    text: 'Nowa sekcja testów 2.23 sprawdza pysk i rogi krowy, lustrzane UV nóg, warstwy głów, rond kapelusza, dziewięć macek ghasta, warianty biomowe (model i tekstura) oraz 25 skórek mobów. `npx tsc --noEmit`, `npm test` (1859 kontroli silnika + 222 UI) i `npm run build` przechodzą w całości.',
  },
  {
    title: 'Owca wygląda jak w grze',
    text: 'Owca stała na 6-pikselowych nóżkach, a w wanilii ma 12-pikselowe (`QuadrupedEntityModel.getModelData(12)`) – teraz tułów jest na właściwej wysokości, a runo układa się w znany „puchaty” kształt z krótkimi skarpetkami na nogach. Owca co kilkanaście sekund opuszcza głowę i skubie trawę, a ostrzyżona po wypasie odrasta, zamieniając klocek trawy w ziemię, dokładnie jak `SheepEntity.eatGrass`.',
  },
  {
    title: 'Pełna paleta 16 kolorów wełny',
    text: 'Doszło 10 brakujących kolorów wełny (pomarańczowa, karmazynowa, jasnoniebieska, jasnozielona, różowa, szara, jasnoszara, turkusowa, fioletowa i brązowa) – teraz owca strzyżona i zabita oddaje wełnę dokładnie swojego koloru, a nie zawsze białą. Rozkład kolorów runa jest jak w wanilii: 83,6% białych, po 5% czarnych, szarych i jasnoszarych, 3% brązowych i 2% różowych.',
  },
  {
    title: 'Pudełka kolizji mobów 1:1',
    text: 'Każdy mob ma wymiary z waniliowych `EntityDimensions`: szkielet 0,6 × 1,99 bloku (wcześniej 0,9 × 0,9 – nie dało się trafić go w głowę), krowa 0,9 × 1,4, golem 1,4 × 2,7, pająk 1,4 × 0,9, ghast 4 × 4, a creeper ma 20 punktów zdrowia jak w grze.',
  },
  {
    title: 'Poprawione modele: pająk, szkielet, kura',
    text: 'Pająk ma odwłok na własnym zawiasie (`body1` z = 9), więc tułów siedzi z przodu, a nie w środku. Szkielet trzyma ręce wzdłuż tułowia zamiast uniesionych jak zombie, a kura ma obie nogi z prawdziwej tekstury zamiast jednej żółtej kostki.',
  },
  {
    title: 'Koniec billboardów: latarnia, dzwon i statyw',
    text: 'Latarnia to teraz waniliowy model z paczki: korpus 6×7 px, czapka 4×2 px i uchwyt z prętów (wcześniej dwie skrzyżowane ikony). Dzwon dostał kamienne słupki i drewnianą belkę z `bell_floor.json`, a samo serce dzwonu – trzy zwężające się bryły z tekstury `entity/bell/bell_body`. Statyw alchemiczny ma słupek 2×14 px i trzy ramiona podstawy z `brewing_stand.json`. Wszystkie trzy trzymają w ręce ten sam kształt co w świecie.',
  },
  {
    title: 'Bryły bloków 1:1 z Minecraftem',
    text: 'Płot ma słupek 4×16 px i dwa szczeble w stronę sąsiadów, pochodnia to dokładnie 2×10 px patyczka (na ziemi i na ścianie), skrzynia dostała prawdziwą teksturę encji z korpusem 14/16 i wiekiem, kowadło – cztery waniliowe elementy z własnym UV każdej ściany, ognisko – cztery bale w dwóch warstwach, ścieżka i grządka – 15/16 wysokości z przyciętym bokiem, a lilia to płaski liść tuż nad wodą. Szyna leży płasko na 1/16, rośliny sięgają pełnej wysokości kratki, a drabina to deska 0,3 px od ściany.',
  },
  {
    title: 'Kolizje i wchodzenie na bloki',
    text: 'Fizyka zna teraz prawdziwe pudełka: płyta to pół bloku (górna i dolna), schody – dwie bryły, płot ma 1,5 bloku wysokości, kaktus i skrzynia są węższe od kratki, łóżko ma 9/16, właz 3/16, a ścieżka 15/16. Gracz wchodzi na płytę i schodek bez skoku (krok 0,55 bloku), ale pełny blok nadal zatrzymuje – tak jak w grze.',
  },
  {
    title: 'Narzędzia, trwałości i obrażenia z wanilii',
    text: 'Drewno ma 59 użyć, kamień 131, żelazo 250, diament 1561; miecze zadają 4–7, topory 7–9, kilofy 2–5, łopaty 2,5–5,5, pięść 1. Czas kopania to 1,5 × twardość z właściwym narzędziem i 5 × bez niego (obsydian diamentowym kilofem 9,4 s). Poziomy kilofów są jak w grze: złoto, diament, szmaragd i czerwony kamień wymagają żelaza, kwarcowi wystarczy drewno.',
  },
  {
    title: 'Dropy, jedzenie i stosy',
    text: 'Bez wymaganego poziomu kilofa blok znika bez dropu (kamień gołą ręką, złoto kamiennym kilofem). Trawa daje tylko ziemię, półka – trzy książki, liście – 5% sadzonki i 0,5% jabłka, żwir – 10% krzemienia, dojrzała pszenica – 1–3 nasion. Chleb i pieczona ryba dają po 5 punktów głodu, miód 6. Puste wiadro stackuje się do 16, pełne i mikstury zajmują slot, a skórny, żelazny, złoty i diamentowy pancerz mają punkty i trwałość jak w oryginale.',
  },
  {
    title: 'Rośliny i sadzenie',
    text: 'Kaktus rośnie tylko na piasku, nie lubi sąsiadów i wyrasta do trzech bloków; lilię kładzie się wyłącznie na wodzie; pochodnia, sadzonka i lilia tracą podparcie razem z blokiem, na którym stały. Kaktus nadal rani za dotknięcie, a trzcina potrzebuje wody przy podstawie.',
  },
  {
    title: 'Testy i build',
    text: 'Nowa sekcja testów 2.21 sprawdza typy renderu, pudełka kolizji (płyty, schody, płot, ścieżka, skrzynia, kaktus, łóżko, właz), step-up na płytę, zatrzymanie przez płot i pełny blok, pełną wysokość roślin, płaską szynę, trwałości i obrażenia narzędzi, poziomy kilofów, dropy, jedzenie oraz stackowanie wiader i mikstur. `npx tsc --noEmit`, `npm test` i `npm run build` przechodzą w całości.',
  },
  {
    title: 'Słońce i księżyc bez czarnych kwadratów',
    text: 'Tekstury ciał niebieskich w paczce nie mają kanału alfa – tło jest po prostu czarne, więc w grze rysował się czarny kwadrat wokół tarczy. Teraz czerń jest kluczowana na przezroczystość przy kompilacji atlasu, a słońce i księżyc świecą addytywnie, jak w oryginale: poświata rozjaśnia niebo, a czarne piksele znikają całkowicie.',
  },
  {
    title: 'Latarnie, dzwon i drzwi przestały być czarne',
    text: 'Latarnia i dzwon były pełnymi sześcianami z tekstury, która w paczce jest atlasem UV modelu – na ścianach zostawały czarne piksele. Teraz to sprite’y z ikon przedmiotów na warstwie z wycinaniem alfa. Drzwi są cienką płytą 3/16 przy ościeżnicy (zamiast sześcianu z drzwiami na każdej ścianie), a górna połowa ma prawdziwe szyby zamiast czarnych kwadratów.',
  },
  {
    title: 'Kaktusy i łóżka z własną bryłą',
    text: 'Kaktus to teraz bryła 14/16 z kafelkiem przyciętym o przezroczysty margines – wcześniej pełny sześcian z wycinaną alfą wyglądał jak cztery krzyżujące się billboardy. Łóżko ma wysokość 9/16 i kołdrę tylko na górze, więc nie przypomina już skrzyni z czerwonym wiekiem.',
  },
  {
    title: 'Domy w wioskach jak w Minecrafcie',
    text: 'Dachy są dwuspadowe i składają się ze stopniowanych schodów z okapem, kalenicą i szczytami z desek – zamiast płaskiej płyty nad ścianami. Domy dostały podmurówkę z bruku, słupki z bali w narożnikach i przy drzwiach, okna z prawdziwego szkła, lampkę pod sufitem i latarnię na słupku przy wejściu. Studnia ma piramidalny daszek, a wnętrza są umeblowane (łóżko, skrzynia, stół, piec, kowadło).',
  },
  {
    title: 'Golem nie chodzi już jak zombie',
    text: 'Ręce wyciągnięte do przodu dostawał każdy mob z dwiema rękami – teraz tylko zombie. Żelazny golem i enderman trzymają ręce opuszczone i kołyszą nimi w chodzie. Blok trzymany w dłoni jest mniejszy (ok. 1/4 wysokości ekranu) i nie ucina się o krawędź, a woda ma waniliowy błękit oceanu zamiast szarej mgły.',
  },
  {
    title: 'Testy i build',
    text: 'Nowa sekcja testów 2.20 sprawdza przezroczyste tło słońca i księżyca, niebieski kafelek wody, warstwy i kształty latarni, dzwonu, kaktusa, łóżka i drzwi (grubość płyty 3/16, bryła kaktusa 14/16), dwuspadowy dach domu w prawdziwej wiosce oraz opuszczone ręce golema. `npx tsc --noEmit`, `npm test` i `npm run build` przechodzą w całości.',
  },
  {
    title: 'Twoja własna, niewidzialna sesja konta',
    text: 'Gracz nie jest już tylko nickiem przy wejściu: przeglądarka dostaje losowy identyfikator, zapisany lokalnie i wysyłany razem z postępem. Dzięki temu serwer pamięta, gdzie skończyłeś i co miałeś w ekwipunku – nawet jeśli zmienisz nick albo skórkę. Po powrocie wracasz dokładnie tam, gdzie wyszedłeś, z blokami, zbroją i doświadczeniem; zapis w chmurze leci co kilka sekund i jeszcze raz przy wyjściu.',
  },
  {
    title: 'Teleportacja za zgodą – /tpa',
    text: 'Gdy ktoś się zgubi, wystarczy /tpa nick. Zaproszony dostaje prośbę z dużymi przyciskami „Przyjmij” i „Odmów” (działa też dotykiem na telefonie), a po zgodzie teleportujesz się do niego – nawet do Netheru. Prośba wygasa po minucie, więc nikt nie wciągnie cię na drugi koniec świata bez twojej wiedzy.',
  },
  {
    title: 'Nowe biomy: kontynenty, góry i rzeki',
    text: 'Generowanie świata zostało przepisane od zera: kontynenty mają teraz tysiące bloków, w środku rosną góry z grzbietami, a klimat i lasy zmieniają się falami – obok siebie leżą duże, spójne krainy, a nie pojedyncze łatki. Między nimi płyną rzeki na poziomie morza, jaskinie nie otwierają już dziur na powierzchni, a każdy świat startuje z innego zakątka mapy.',
  },
  {
    title: 'Wioski jak w Minecrafcie – bez dziur i platform',
    text: 'Osady powstają tam, gdzie w oryginale: na równinach, sawannie, pustyni i tundrze, na w miarę płaskim terenie. Środek placu jest równy, a na obrzeżach grunt łagodnie wraca do naturalnego – bez wiszących platform, pionowych ścian i dziur pod domami. Wioska ma drogi, studnię, dzwon, latarnie, farmy, kuźnię, bibliotekę i pełne wyposażenie wnętrz.',
  },
  {
    title: '9 skórek gracza 1:1 jak w Minecrafcie',
    text: 'Steve, Alex, Ari, Efe, Kai, Makena, Noor, Sunny i Zuri mają prawdziwe skórki 64×64 rozłożone na ciało według waniliowego układu UV. Alex i Efe mają smukłe ręce, każda postać dostała twarz i portret do wyboru skórki, a w grze widzisz te same piksele, co w oryginale – przodem, z czapką i rękawami na swoim miejscu.',
  },
  {
    title: 'Każdy zaczyna w innym miejscu świata',
    text: 'Nowy gracz nie rodzi się na plecach kolegi: start jest losowy, ale zawsze na suchym lądzie – w promieniu od 320 do 2600 bloków od środka mapy. Świat jest duży, więc każdy może znaleźć własny kąt, a gdy ktoś się zgubi, jest /tpa i wspólne budowanie.',
  },
  {
    title: 'Moby 1:1, tekstury, bloki i ekwipunek jak w grze',
    text: 'Krowa ma łaty i różowy ryjek, owca runo, świnia plamy, creeper grymas, a 15 modeli używa waniliowych pudełek, zawiasów i układu UV – w tym golem, któremu głowa patrzy teraz tam, gdzie powinna. Serca, hotbar i głód to grafiki z paczki, chmury i deszcz mają kształty z tekstur, a kopany blok pęka w dziesięciu prawdziwych fazach pękania. Postacie graczy noszą pikselowe ubrania: tkaninę, jeans i skórę.',
  },
  {
    title: 'Serwer publiczny, pełny ekran i poziom na telefonie',
    text: 'Jeden wspólny świat z zapisem bloków w chmurze i listą komend w czacie (od /help po /tpa) – bez kodów pokoi i bez „wrong state”. Pochodnia w dłoni oświetla okolicę, pełny ekran nie przybliża kamery ani nie zasłania przycisków, panele ekwipunku i czatu przewijają się palcem (scroll), a dotykowy drążek, przyciski i auto-skok na każdy schodek działają też w poziomie. Auto-bicie wrogich mobów, ekwipunek jak w Minecrafcie (siatka 2×2, stół 3×3, 155 przepisów ze schodami, płytami, latarniami), jeden pień daje cztery deski, a cztery deski – stół rzemieślniczy.',
  },
];
