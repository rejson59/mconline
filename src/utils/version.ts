/** Single release label shared by the menu, HUD, and in-game help. */
export const GAME_VERSION = '2.20.0';
export const GAME_RELEASE_NAME = 'Poprawki grafiki';

/**
 * 2.20: wydanie naprawcze grafiki – wszystko, co na zrzutach ekranu wyglądało
 * źle: czarne słońce, kaktusy-billboardy, czarne latarnie i drzwi, płaskie
 * dachy wiosek, ręce golema jak u zombie i za duży blok w dłoni.
 * Lista jest kumulatywna – trzyma też wpisy z poprzednich wydań.
 */
export const RELEASE_HIGHLIGHTS: { title: string; text: string }[] = [
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
