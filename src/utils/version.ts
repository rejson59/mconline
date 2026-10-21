/** Single release label shared by the menu, HUD, and in-game help. */
export const GAME_VERSION = '2.19.0';
export const GAME_RELEASE_NAME = 'Świat jak w Minecrafcie';

/**
 * 2.19: prawdziwe kontynenty i rzeki zamiast łatek biomów, wioski wtopione
 * w teren, 9 skórek gracza 1:1 z Minecrafta, niewidzialna sesja konta na
 * serwerze publicznym (pozycja i bloki po wyjściu) oraz teleportacja za zgodą.
 */
export const RELEASE_HIGHLIGHTS: { title: string; text: string }[] = [
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
