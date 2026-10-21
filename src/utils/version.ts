/** Single release label shared by the menu, HUD, and in-game help. */
export const GAME_VERSION = '2.22.0';
export const GAME_RELEASE_NAME = 'Moby i świat 1:1 jak w grze';

/**
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
