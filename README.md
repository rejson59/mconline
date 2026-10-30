# BlockCraft 4.6.0 🌍

Gra sandboxowa w stylu **Minecraft** działająca w przeglądarce. Od 2.11 ma **jeden publiczny serwer**: wchodzisz jednym kliknięciem i budujesz wspólny świat razem ze wszystkimi, którzy są online – bez kodów, bez gospodarza i bez zakładania konta. Budowle zapisują się w chmurze (Supabase + Postgres), więc zostają po wyjściu i po odświeżeniu strony. Gra działa też offline i na telefonie.

## Wersja 4.6.0 „Działki i trwałe osiągnięcia”

- **Piec (6b8053c8).** Góra i spód błędnie używały tekstury ściany bocznej. Dodano oryginalny `furnace_top.png` z paczki do ostatniego wolnego kafelka 175 (przed atlasami encji), także dla rozpalonego pieca i ikony. Front i boki już korzystały z paczki. Bez zrzutu nie wiadomo, czy zgłoszenie dotyczyło właśnie góry, innej ściany czy okna pieca — nie uznajemy dowolnego problemu tekstur za odtworzony.
- **Wilki (c889bd43).** PPM i tapnięcie z kością oswajają dzikiego wilka, zużywając jedną kość w survivalu, żadnej w creative. Uwzględniono priorytet głównej ręki; ponowne użycie na oswojonym wilku nie zużywa kości. Mięso przestało być przedmiotem oswajającym. Pozostawiono dotychczasową gwarantowaną skuteczność, bez dodawania losowania prób.
- **Działki (7b81e8d2).** `/dzialka zajmij`, `/dzialka info`, `/dzialka lista`, `/dzialka zwolnij` (aliasy `/działka`, `/plot`). Jeden chunk 16×16, Y 0–255, tylko świat główny serwera publicznego, maksymalnie cztery na klucz. Cudzych ani starszych zapisanych budowli nie można objąć działką; własne nowe budowle można. Zwolnienie pozostawia bloki. Klient blokuje kopanie, stawianie i używanie pojemników przed zużyciem przedmiotów; centralna kontrola bloków obejmuje automatyczne zmiany. Wybuchy nie niszczą działek, a przepływy wody nie przechodzą przez granicę różnych właścicieli / terenu wolnego.
- **Ochrona w bazie.** Prywatny 256-bitowy klucz działek jest przechowywany wyłącznie w lokalnym storage i przesyłany do RPC przez HTTPS; baza publikuje tylko jego SHA-256. Nick i publiczny pid nie uprawniają do budowania. Transakcyjne RPC serializują zajmowanie terenu i zapis bloków; usunięto bezpośredni zapis tabeli dla `anon`/`authenticated`. Realtime jest tylko powiadomieniem o zmianie, nie wiarygodnym źródłem bloków. Odczyty delta mają rosnącą rewizję serwera zamiast zegara przeglądarki; odmowa SQL przywraca bloki lokalnie. Zwykłe zmiany pozostają batchowane co 2,5 s. Prawa działek odświeżają się co 3 s, więc przy równoczesnym zajęciu terenu może wystąpić krótka optymistyczna zmiana u nadawcy, odrzucona przez bazę; zużytego w tej kolizji przedmiotu klient nie refunduje automatycznie.
- **Granice działek.** Nie dodano kont, członków działki, PvP-safe-zone, pełnego anty-cheata ani współdzielonej bazy zawartości skrzyń. Limit jest na klucz, nie na człowieka — nowe klucze pozwalają obejść limit. Usunięcie danych przeglądarki traci własność; eksport świata nie zawiera prywatnego klucza. Przed produkcyjnym rozwojem ekonomii/limitów potrzebne jest uwierzytelnianie i narzędzia administratora. Starsi klienci po migracji nie mogą zapisywać bloków: wymagane odświeżenie do 4.6.0.
- **Osiągnięcia (f24c80d1).** Potwierdzony brak pola w profilu publicznym: teraz JSON ekwipunku ma kompatybilny ogon 50 z listą odznak. Odczyt waliduje znane ID, a kopia awaryjna i profil zachowują listę. Odblokowanie uruchamia zapis od razu; trigger SQL scala odznaki ze starego i nowego zapisu, także przy dwóch kartach i starszym kliencie. Offline istniejący zapis już zawierał odznaki — skrócono okno utraty przed autosave. Nie da się odzyskać osiągnięć, których nigdy wcześniej nie zapisano. Pokoje lokalne nadal są sesjami bez trwałego profilu serwera.
- **Szkielet (fd9ab339).** Łuk przyczepiony do ręki także w modelu teksturowanym, 0,8 s napinania, zmiana pozy obu rąk i cięciwy, widoczna przygotowana strzała, odrzut po zwolnieniu. Pocisk powstaje przy końcu animacji. Przeszkoda, utrata celu lub tryb pokojowy przerywają przygotowanie; sprzęt jest zwalniany razem z mobem.
- **Skróty (ebdbcc26).** Ruch anuluje domyślne zachowanie zdarzenia przed obsługą auto-repeat. Dodano sprint **R** obok dwukrotnego W i dotychczasowego Ctrl; pomoc zaleca R/W×2. Pola tekstowe, czat i pauza zachowują zwykłe skróty. Zarezerwowany Ctrl+W może nie trafić do strony — sama strona nie może zagwarantować jego zablokowania w każdym systemie. Bez dokładnych kroków z Windows nie potwierdzamy, że zgłoszenie dotyczyło wyłącznie Ctrl+W; bezpieczne sterowanie nie wymaga Ctrl.

### Wdrożenie bazy 4.6.0

Uruchomić kolejno `supabase/migrations/202610300001_plots.sql` i `202610300002_achievement_union.sql`, a następnie wdrożyć klienta. Nie usuwać starych budowli ani profili. Test `supabase/tests/plots.sql` działa w transakcji jako `anon` i wycofuje dane; celowo odmawia wykonania, jeśli współrzędne testowe są zajęte. Starsze instrukcje tworzenia tabel poniżej opisują bootstrap — migracje są wymagane dla aktualnego klienta.

## Wersja 4.5.0 „Płynąca woda i czyste dłonie”

- **Fizyka wody (65a36235).** Źródła pozostają źródłami; osobne poziomy strumienia spływają w dół, rozlewają się do siedmiu bloków po podłożu, omijają przeszkody i cofają po usunięciu źródła lub zablokowaniu dopływu. Po spadku zasięg poziomy zaczyna się od nowa. Otwarta kopaniem wnęka dostaje przepływ, nie kolejne sztuczne źródło. Puste wiadro ignoruje strumienie i zbiera tylko źródło; fiolka działa także w strumieniu.
- **Poziomy i prąd.** Mesher rysuje rzeczywistą wysokość płynu oraz boczne ścianki pomiędzy poziomami. Pływanie, oddychanie, mgła i HUD sprawdzają również wysokość tafli; prąd porusza gracza i przedmioty. Nawadnianie, trzcina, łowienie i omijanie wody przez moby rozpoznają strumienie. Spławik dopasowuje się do poziomu i opada, gdy woda odpłynie.
- **Ograniczony koszt i zgodność.** Symulacja co 0,2 s przetwarza maksymalnie 256 oczekujących kratek. Nie generuje terenu: działa w załadowanych chunkach i wznawia przepływ po wczytaniu sąsiada. Stare źródła/zapisy zachowują ID; nowe ID 444–451 zapisują poziomy offline. W multiplayerze przesyłane są dotychczasowe zmiany graczy/źródeł, a przepływ każdy klient odtwarza lokalnie — bez zapisu każdego kroku do Supabase i bez migracji bazy. Stan przejściowy może różnić się przy różnym czasie ładowania chunków; to nie autorytatywny serwer płynów.
- **Dłonie ponad przezroczystym światem (53d456a7).** Przyczyną był podział renderera na kolejkę brył nieprzezroczystych i przezroczystości: wysokie `renderOrder` bryły w dłoni nie przenosiło jej za wodę/chmury. Obie dłonie mają teraz osobną scenę renderowaną na końcu, po wyczyszczeniu wyłącznie głębokości. Świat pozostaje widoczny, a bryły i przezroczyste ikony mają własny poprawny test głębokości.
- **Weryfikacja.** 105 nowych regresji silnika obejmuje przepływ, cofanie, przeszkody, prąd, pływanie, spławik, wysokości siatki, zapis, granice chunków, odtwarzanie zmian publicznych oraz zbieżność klientów z różnymi budżetami pracy. Dodatkowa próba w Chromium 153 z programowym WebGL odtworzyła stare zabarwienie bryły, po poprawce sprawdziła piksele obu dłoni i otwory przezroczystej ikony; uruchomienie świata creative/flat nie zgłosiło błędów JS. To nie test konkretnego Edge/Chrome 156 ani wydajności na komputerze zgłaszającego.
- **Zakres.** Ogólne „dodaj fizykę” zinterpretowano jako przepływ i prąd. To nie pełna zgodność płynów z Minecraftem: bez waterloggingu, automatycznej produkcji źródeł, wypłukiwania roślin i nowych reakcji z lawą. Nie zmieniano fizyki lawy ani zamkniętych zgłoszeń 4.4.1. Zgłoszenie warstw nie miało zrzutu ekranu, więc naprawa dotyczy potwierdzonej przyczyny w kodzie i testowanego przypadku renderowania, nie identycznego odtworzenia sesji zgłaszającego.

## Wersja 4.4.1 „Zbroja, głód i rudy”

- **Widoczna zbroja (d1e3313e).** Cztery sloty wyposażenia są przesyłane razem z pozycją w publicznym multiplayerze i pokojach local/WebRTC. Awatar ma bryłowe nakładki hełmu, napierśnika z naramiennikami, nogawic i butów; kolory rozróżniają skórę, żelazo, złoto i diament. Zbroja podąża za animacją głowy i kończyn, przeżywa zmianę skórki i znika po zdjęciu/zniszczeniu. Podgląd w plecaku pokazuje te same elementy. Nie są to importowane tekstury zbroi 1:1.
- **Głód (9559da6e).** Zamiast ciągłego odejmowania paska: zapas nasycenia (domyślnie 5) i licznik wyczerpania. Każde 4 punkty wyczerpania zużywają najpierw 1 punkt nasycenia, potem jedzenia. Zwykły marsz i stanie nic nie kosztują; sprint kosztuje 0,1/blok, pływanie 0,01/blok, skok 0,05 (sprintowy 0,2), kopanie 0,005, atak/otrzymany cios 0,1. Ruch w ścianę nie jest naliczany jako przebyty dystans. Posiłki uzupełniają jedzenie i właściwe nasycenie, nie leczą natychmiast. Naturalne leczenie działa przy co najmniej 18 punktach jedzenia co 4 s, szybciej przy pełnym pasku i nasyceniu; kosztuje wyczerpanie. Głodzenie w normalnym poziomie zatrzymuje się na 1 HP i nie uszkadza pancerza. Zapasy zapisują się lokalnie i w profilu publicznym (kompatybilny ogon JSON, bez migracji bazy).
- **Rudy (d13cc6c3): potwierdzony exploit XP naprawiony.** Kopanie żelaza/złota zwracało ten sam blok oraz kolejne XP. Również Jedwabny dotyk dawał XP za odzyskane rudy. Teraz odzyskanie bloku nie daje doświadczenia, a wydobycie surowca zwykłym kilofem nadal daje XP. Jedwabny dotyk zachowuje też kwarc i redstone, które wcześniej ginęły. Testy ośmiu cykli stawiania/kopania wszystkich ośmiu rud potwierdzają zużycie przy stawianiu, brak dodatkowych sztuk i brak odnawialnego XP.
- **Granica ustaleń.** Zgłoszenie rud nie zawiera kroków, trybu gry ani wskazania konkretnej rudy. Nie odtworzono klonowania samych sztuk w sprawdzonym lokalnym cyklu; nie uznajemy tej części za definitywnie wyjaśnioną. Potrzebne są dokładne kroki lub nagranie (szczególnie jeśli dotyczy równoczesnych działań multiplayer). Samo stawianie rud i nieograniczone zasoby creative są zamierzone i nie zostały zablokowane. Wcześniej wdrożonego PvP i wspólnych przedmiotów nie implementowano ponownie.

## Wersja 4.4.0 „Wspólne przedmioty i PvP”

- **Przedmioty naprawdę wspólne.** Wyrzucanie przez Q/Ctrl+Q, ekwipunek i śmierć tworzą obiekty sieciowe, widoczne i możliwe do zebrania przez innych. Zachowują liczbę sztuk, nazwy, zaklęcia oraz wytrzymałość. Przedmioty należą do swojego wymiaru, znikają po 5 minutach i są odtwarzane dla dołączających graczy. Fizyka używa wspólnych kroków 25 ms, niezależnie od FPS; nadrabia również długie tonięcie w wodzie i czeka na niezaładowany teren.
- **Jeden przedmiot, jeden odbiorca.** W pokojach decyduje gospodarz; na serwerze publicznym transakcyjne RPC w Postgresie. Powtórzone żądania i jednoczesne zbieranie nie przyznają dodatkowej kopii. Pełny plecak nie zabiera przedmiotu. Przyznanie czekające na miejsce/odrodzenie jest ponawiane; publiczny profil zapisuje przedmiot razem z potwierdzeniem odbioru przed zamknięciem transakcji dostawy. Lokalny dziennik zachowuje też wyrzucony przedmiot razem z pomniejszonym ekwipunkiem, zanim zacznie się wysyłka.
- **PvP wręcz i z łuku.** Ręczny LPM, przytrzymanie i przycisk dotykowy wybierają bliższego gracza lub moba. Odbiorca sprawdza zasięg, widoczność, wymiar, świeżość pozycji, cooldown i powtórzenia zdarzeń; krótka historia ruchu kompensuje interpolację awatarów. Strzały mają fizyczny lot i kolizje ze ścianami, szkłem oraz pośrednimi celami. Pancerz, tarcza, zaklęcia, totem i odrzut korzystają ze zwykłej logiki walki. Creative jest odporny, a wejście/odrodzenie daje 3 sekundy ochrony. Automatyczne wspomaganie walki nadal atakuje tylko wrogie moby.
- **Śmierć i menu.** Łup obejmuje również kursor, siatkę craftingu, przedmiot w zaklinaniu i nazwaną zbroję. Menu nie pauzuje wspólnego świata ani strzał; w trybie offline pauza działa jak wcześniej.
- **Baza dla serwera publicznego.** Migracja `supabase/migrations/202610290001_shared_drops.sql` tworzy chronioną tabelę i RPC `blockcraft_drop_op`; jest wymagana przed wdrożeniem klienta. Test transakcyjny w `supabase/tests/shared_drops.sql` działa jako `anon` i wycofuje swoje dane. Pokoje lokalne/WebRTC nie potrzebują tej bazy. To nadal dotychczasowy model anonimowych klientów: walidacja utrudnia błędne komunikaty, ale nie zastępuje autorytatywnego serwera fizyki ani pełnego systemu anty-cheat.

## Wersja 4.3.1 „Wiadra i druga ręka”

- **Nabieranie płynów działa.** PPM z pustym wiadrem celuje w wodę/lawę, a fiolka w wodę. Zwykłe kopanie i stawianie nadal ignoruje płyny. Wymiana jednego pustego/pełnego pojemnika używa jego dotychczasowego slotu, więc działa przy pełnym plecaku. Dla stosu najpierw sprawdzane jest miejsce na wynik; nie ma utraty przedmiotu ani usunięcia źródła przy braku miejsca. Fiolka napełnia jedną sztukę, nie cały stos. Creative zachowuje źródło.
- **Rzeczywista druga ręka.** Slot w survivalu i creative, osobny model po lewej stronie oraz HUD z liczbą sztuk, zaklęciem i zużyciem. **F** zamienia całe stosy z bieżącym slotem; nad slotem ekwipunku zamienia wskazany stos. Działają LPM/PPM, Shift, cyfry, Q i zbieranie stosów. Nazwy, zaklęcia i wytrzymałość zostają zachowane w zapisie lokalnego świata, profilu multiplayer i kopii awaryjnej. Śmierć wyrzuca zawartość drugiej ręki dokładnie raz.
- **Użyteczna podczas gry.** Pochodnia w drugiej ręce oświetla kopalnię obok kilofa, tarcza chroni i zużywa własną wytrzymałość, totem zapobiega śmierci. PPM może użyć z drugiej ręki m.in. bloku, wiadra, fiolki lub jedzenia, kiedy główna ręka nie ma własnej akcji użycia. Łuk, wędka i lorneta pozostają obsługiwane w głównej ręce — można je przenieść klawiszem F. Lot creative: **dwukrotna spacja**, nie F.
- **Bez bicia przez szkło.** Wspólny promień fizyczny przechodzi przez wszystkie przecinane kratki i sprawdza pudełka kolizji. Szkło i liście blokują ciosy, trawa nie; otwarte drzwi oraz płyty zachowują wolną część przejścia. Kontrola obejmuje wybór ręcznego/dotykowego celu, auto-bicie, handel/oswajanie oraz ciosy mobów w gracza.
- **Zabezpieczenia podłogi i kopania.** Kliknięcie odświeża cel zamiast używać celu z poprzedniej klatki — po obrocie kamery nie rozbija już starego bloku pod nogami. Utrata fokusu, anulowanie wskaźnika i odczyt puszczonych przycisków kasują zacięte kopanie. Postęp nie przechodzi przez pusty cel. Przebudowa chunka zachowuje poprzednią geometrię do uzyskania nowej; błąd zostawia ją widoczną i kolejkuje ponowną próbę.
- **Weryfikacja anonimowego zgłoszenia kopalni.** Bez konkretnego świata i kroków nie da się przypisać zgłoszenia jednej przyczynie. Regresje obejmują powyższe błędy wejścia, wymuszoną awarię meshera, widoczne górne ściany wszystkich odsłoniętych desek, kolizje, granice chunków, cztery obroty i zachowanie podłóg po oddaleniu oraz wczytaniu zapisu. Nie blokujemy celowego kopania pod sobą ani normalnego działania wybuchów i grawitacji. Nie zmieniamy generatora 4.3.0 ani łupów.

## Wersja 4.3.0 „Osady i niebezpieczne wyprawy”

- **Więcej budynków, nie tylko ozdób.** Osady mają promień 34–40 bloków zamiast 20–27 i do 16 parceli połączonych bocznymi ulicami. Na odpowiednim terenie pojawiają się co najmniej cztery domy mieszkalne, kuźnia, biblioteka, farma, nowa **piekarnia**, **dom alchemika** i **wieża strażnicza**. Kuźnia ma piece i kowadło, piekarnia piece i zapasy, alchemik statyw, a wieża dostępną drabiną kondygnację i dach z blankami. Trudne parcele są pomijane; nie wyrównujemy całego terenu ani nie prowadzimy dróg przez wnętrza domów.
- **Bogatsze skrzynie.** Zwykłe domy nie generują już pustych skrzyń. Dwanaście tematycznych pul obejmuje profesje wioski i miejsca wypraw. Każda daje **5–8 różnych stosów**: np. żelazo, narzędzia i zbroję w kuźni, książki i papier w bibliotece, pieczywo i pszenicę w piekarni, butelki i składniki u alchemika, strzały w wieży, tory i surowce w kopalni. Wagi ograniczają rzadkie nagrody, a narzędzia i eliksiry przestrzegają limitów stosu. Stare skrzynie jaskiniowe zachowują dotychczasową pulę.
- **Opuszczone kopalnie.** Widoczne wejście prowadzi schodami do podziemnego skrzyżowania chodników z podporami, torami, rudami i dwiema skrzyniami. Można zejść i wrócić bez przekopywania tunelu. To autorskie szablony inspirowane Minecraftem, nie import oryginalnych struktur 1:1.
- **Kratery i różne powierzchnie.** Nieregularne zagłębienia z mieszaniną bazaltu, czernitu, żwiru i odsłoniętego węgla; warianty suche i gorące. Gorący środek zawiera prawdziwą lawę i magmę, a duży spadek jest zagrożeniem także w suchym kraterze. Łup znajduje się z boku, nie w środku lawy.
- **Więcej ruin portali.** Dodatkowa warstwa miejsc eksploracji na siatce 128 bloków uzupełnia wcześniejsze świątynie, ruiny i chatki. Portale pozostają zniszczone i nieaktywne. Struktury omijają wioski, siebie nawzajem, oceany, plaże i urwiska; nie rzeźbią superflat ani Netheru.
- **Szukaj bez ryzykownego teleportu:** `/locate kopalnia`, `/locate krater`, `/locate portal`, `/locate świątynia`, `/locate ruiny`, `/locate chatka` (alias `/znajdz`). Komenda podaje współrzędne najbliższego pasującego miejsca do 768 bloków, bez generowania chunków ani przenoszenia gracza.
- **Bez odnawiania łupów.** Otwieranie i rozbijanie nietkniętej skrzyni korzysta z tej samej deterministycznej puli. Otwarty znacznik staje się zwykłą skrzynią; zapisana zawartość ma pierwszeństwo. Skrzynie stawiane przez gracza nie dostają darmowych przedmiotów, także wewnątrz wioski.
- **Testy regresji.** Typy budynków, przejścia drzwiowe i drabiny, brak dróg przecinających domy, legalne i różnorodne łupy, brak ponownego napełniania, granice chunków i cztery obroty. Fizyka sprawdza zejście i powrót schodami kopalni. Pełne generowanie świata sprawdza kolejność chunków, dekoracje oraz pierwszeństwo zapisanych edycji.

**Ważne dla starych światów:** zmieniły się układ wiosek i generator miejsc eksploracji. Przed aktualizacją ważnego lokalnego świata wyeksportuj kopię. Zapisane modyfikacje bloków, ekwipunki i zawartość skrzyń są zachowane, ale otoczenie niezmodyfikowanych fragmentów starych osad może się zmienić. Najczytelniejszy efekt daje nowy świat lub wyprawa do nowych okolic; istniejące skrzynie nie są automatycznie uzupełniane.

## Wersja 4.2.2 — trwały postęp multiplayer i skróty ekwipunku

- **Naprawa odrzucanych zapisów.** Głód zmniejsza się płynnie, ale tabela graczy miała kolumny `integer` dla zdrowia i głodu. Ułamkowa wartość odrzucała cały zapis, razem z ekwipunkiem i pozycją. Obie kolumny mają teraz typ `double precision`; migracje są w `supabase/migrations/` i zostały zastosowane na publicznym serwerze.
- **Zapis przy wyjściu, pauzie, ukryciu strony i odświeżeniu.** Multiplayer zapisuje profil zamiast pomijać `Game.save()`. Współrzędne nie są zaokrąglane do pełnych bloków. Zapisy obejmują też kursor, siatkę craftingu i przedmiot w zaklinaniu; zachowują nazwy, zaklęcia i zużycie.
- **Kopia awaryjna w przeglądarce.** Migawka jest zapisywana synchronicznie w `localStorage`, przed wysłaniem do chmury, oddzielnie dla świata i identyfikatora gracza. Wczytywany jest nowszy zapis (lokalny lub z chmury). Błąd odczytu bez kopii nie jest już traktowany jak pierwsza wizyta, a błąd wysłania jest sygnalizowany w czacie. Kolejka zapisów oraz zabezpieczenie w bazie chronią przed nadpisaniem nowszego postępu starszym żądaniem.
- **Shift+klik:** pasek ↔ plecak, plecak ↔ otwarta skrzynia, odpowiednie sloty pieca, kowadła, zaklinania i statywu; automatyczne zakładanie zbroi. Najpierw uzupełniane są istniejące stosy, a nadmiar zostaje w źródle — bez kasowania i bez zamiany kursora.
- **Shift+wynik craftingu:** wytwarzanie kolejnych partii, aż zabraknie składników lub miejsca, bez zużywania składników za niedający się pomieścić wynik.
- **1–9** nad zwykłym slotem zamienia go z odpowiednim miejscem paska. **Dwuklik LPM** zbiera pasujące przedmioty do limitu stosu. **Q / Ctrl+Q** wyrzuca jedną sztukę / cały stos spod kursora. Pola wyszukiwania i nazywania przechwytują pisanie, bez przypadkowego przenoszenia przedmiotów.
- **Jednolite LPM/PPM w craftingu:** lewy przycisk / tapnięcie bierze lub odkłada cały stos; prawy przycisk / długie przytrzymanie bierze połowę albo odkłada jedną sztukę. Nie jest już odwrotnie niż w pozostałych slotach.
- **Testy:** trwałość profilu, awarie odczytu/zapisu, kolejność żądań, pełny ekwipunek, metadane i reguły slotów; dodatkowo interaktywne testy React w jsdom dla Shift, cyfr, Q, dwukliku, LPM/PPM i krótkiego/długiego dotyku. To nie jest deklaracja pełnej zgodności wszystkich gestów z Minecraftem — np. rozdzielanie stosu przeciąganiem pozostaje poza tą aktualizacją.

Tożsamość multiplayer nadal jest powiązana z danymi tej przeglądarki, nie z nickiem ani kontem. **Nie czyść danych witryny**, jeśli chcesz zachować identyfikator i kopię awaryjną. Ta poprawka nie odzyska przedmiotów, których wcześniejszy odrzucony zapis nigdy nie zachował.

## Wersja 4.2.1 — progi drzwi i skrzynie

- **Przejście ze ścieżki do domu.** Ścieżka jest niższa od pełnego bloku o 1/16. Silnik sprawdza teraz prześwit nad rzeczywistą wysokością kroku, a nie 0,6 bloku wyżej — nadproże nie blokuje poprawnego wejścia. Dotyczy wszystkich kierunków i obu zawiasów. Zamknięte drzwi, otwarte skrzydło i zbyt niski sufit nadal mają kolizję; rozmiar gracza nie został zmniejszony.
- **Jedno naciśnięcie — jedno przełączenie drzwi.** Przytrzymanie przycisku użycia, także na ekranie dotykowym, nie zamyka otwartych właśnie drzwi podczas wchodzenia.
- **Skrzynie nie otwierają się przy podejściu.** Animacja jest powiązana z używanym oknem skrzyni. Po jego zamknięciu wieko opada, nawet gdy gracz stoi obok. W podwójnej skrzyni otwierają się tylko pasujące boczne połówki, nie skrzynie stojące przed nią lub za nią.
- **Porządkowanie animacji.** Poprawiono oś zawiasu obróconych skrzyń oraz usuwanie animowanych wiek przy zmianie wymiaru i zamykaniu gry. Statyczne wieka są przywracane we właściwym świecie, a geometria animacji zwalniana.
- **Bez migracji zapisów.** Naprawa dotyczy fizyki i interakcji, nie wymaga nowego świata ani przebudowania domów. Testy regresji odtwarzają próg, nadproże, oba zawiasy i cztery kierunki przy 60, 30 i 10 FPS, a także cykl otwarcia/zamknięcia, podwójne skrzynie i zmianę wymiaru.

## Wersja 4.2 „Naturalne osady i struktury”

- **Bez płaskiego talerza pod wioską.** Domy mają indywidualne poziomy fundamentów, a drogi korzystają z miejscowej wysokości. Wyrównywany jest tylko obrys budynku z krótkim przejściem do otoczenia. Niezabudowane fragmenty zachowują naturalne pagórki i drzewa.
- **Detale zabudowy.** Strome dachy ze schodów, okapy, zamknięte szczyty i kalenice z płyt; piaskowcowe tarasy z niskimi attykami na pustyni; akacjowe słupy na sawannie; kominy i kowadła w kuźniach.
- **Cztery struktury inspirowane Minecraftem** (autorskie szablony, nie import oryginalnych budowli 1:1): pustynna świątynia z dwiema wieżami i dostępnym skarbcem, zamszone ruiny w dżungli, chatka na palach na bagnie oraz zniszczony, nieaktywny portal z nieregularnym podłożem. Wszystkie mają skrzynie z łupem.
- **Generator.** Położenie zależy od ziarna i biomu, a orientacja może przyjąć cztery kierunki. Budowle przekraczają granice chunków bez szwów, omijają wioski, oceany i zbyt strome zbocza. Nie pojawiają się w Netherze ani na superflat. Generowanie nie zapisuje sztucznych modyfikacji gracza.
- **Zapisy.** Najlepiej obejrzeć zmiany w nowym świecie. Generator odtwarza teren również przy ponownym wczytaniu starych światów; zapisane edycje bloków nadal nakładane są na końcu, ale otoczenie starych budowli może się zmienić. Przed aktualizacją ważnego świata warto wyeksportować kopię.
- **Weryfikacja.** Testy obejmują lokalne fundamenty, zachowanie naturalnego terenu, osobne cache świata płaskiego i naturalnego, biomy, obroty, kolejność generowania chunków, wnętrza i pierwszeństwo zapisanych edycji. Przy okazji przywrócono wywołanie zwykłego lootu mobów, pominięte podczas usuwania osobnego trybu gry.

## Wersja 2.32 „Skrzynia 1:1, tryb ziemniak i klawiatura na tablecie” 📦 🥔 ⌨️

Trzy rzeczy z jednego zgłoszenia: skrzynia, która nie wyglądała jak w Minecrafcie, gra, która musi działać na „ziemniaku” w 30 FPS, i tablet z klawiaturą oraz myszką, na którym nie dało się sterować.

* **Skrzynia z prawdziwego modelu.** Wcześniej była to bryła z trzech rozciągniętych kafelków 16 × 16: piksele się gubiły, a przód z klamrą nie zgadzał się z grą. Teraz rysujemy dokładnie waniliowy `ChestModel` z 26.2: **korpus 14 × 10 × 14 px** od (1, 0, 1), **wieko 5 px** zawieszone na y = 9, z = 1 i **zamek 2 × 4 × 1 px**, który wystaje 1 px przed front. Tekstura `entity/chest/normal.png` (64 × 64) leży w całości w atlasie, a UV liczymy jak w `ModelPart.Cube` — łącznie z tym, że zewnętrzna góra wieka to inny prostokąt niż ciemne wnętrze. Skrzynia ma teraz **cztery kierunki** (przodem do gracza, jak `HorizontalDirectionalBlock#FACING`) i staje się **podwójna**, gdy przylega do drugiej skrzyni patrzącej w tę samą stronę: lewa i prawa połówka biorą `normal_left/right.png`, mają wspólną klamrę na środku i żadnej szczeliny (ścianki stykowe są wycinane).
* **Wieko się otwiera i ma własne światło.** Gdy podejdziesz na 5 bloków, klapa podnosi się o 90° wokół zawiasu (y = 9 px, z = 1 px) i opada po odejściu — dokładnie jak `ChestBlockEntity#getOpenCount`. Korpus zostaje w siatce chunka, a wieko z zamkiem to osobny model z animacją, więc nic nie jest przebudowywane co klatkę. W podwójnej skrzyni obie klapy idą razem, a zamek jest dzielony na dwie połówki przy styku. Wieko jest osobnym modelem, więc siatka zapisuje dla niego światło kratki (`chestLightAt`) — w jaskini klapa jest ciemna, a w słońcu jasna, tak jak korpus.
* **Gra na „ziemniaku”.** Automat jakości ma **czwarty stopień („minimalny”)**: przy złych klatkach zmniejsza **zasięg rysowania** (chunki zostają w pamięci, więc powrót jest natychmiastowy), obniża limit rozdzielczości i tnie cząsteczki — a mgła kończy się tam, gdzie kończą się siatki, więc horyzont nie wygląda na urwany. Nowy preset **„Ziemniak”** (3 chunki, pixelRatio 0,75, limit 30 FPS) jest dla sprzętu, na którym „Niskie” to za dużo, a bardzo słabe telefony dostają go automatycznie. Sam mesher też przyspieszył: specjalne bryły liczy **raz na typ bloku** (zamiast ~18 tys. razy na chunk), a UV ścian czyta z gotowej tabeli zamiast liczyć je dla każdego wierzchołka.
* **Klawiatura i mysz na tablecie.** Tablet z klawiaturą/myszką Bluetooth (albo USB) zgłasza się jako urządzenie dotykowe, więc gra pokazywała drążek i ignorowała sprzęt. Teraz pierwszy realny ruch myszy (`movementX`) albo klawisz gry przełącza sterowanie na komputerowe **w locie**, bez restartu świata, a drążek i gesty znikają. Mysz działa nawet tam, gdzie przeglądarka nie pozwala przechwycić kursora (iPad): kamera obraca się różnicą pozycji wskaźnika. Po **15 s** bez sprzętu i **trzech** dotknięciach ekranu gra sama wraca do drążka, a klawiatura ekranowa (`sourceCapabilities.firesTouchEvents`) nigdy nie przełącza sterowania.
* **Testy.** `npm test` to **2263 kontroli silnika + 234 testy UI**. Sekcja 2.32 sprawdza kierunki skrzyni i stawianie przodem do gracza, łączenie w podwójną (i brak łączenia przy różnych kierunkach), szerokość 14 px i połówki przy krawędziach, wysokość wieka i wystający zamek, czwarty stopień automatu, zasięg rysowania i limit rozdzielczości, „Ziemniaka”, a także wykrywanie sprzętu (mysz, klawiatura fizyczna, klawiatura ekranowa) i powrót na dotyk. `npx tsc --noEmit`, `npm test` i `npm run build` przechodzą w całości.

## Wersja 2.30 „Ścieżka bez trzęsienia i golem, który oddaje” 🧱 🤖 🎮

Cztery błędy z jednego zgłoszenia: trzęsienie na ścieżce, golem, który nie oddaje, zacinający się gracze na multiplayerze i sztywny ruch głowy mobów.

* **Koniec trzęsienia na ścieżce.** Fizyka ląduje teraz na **rzeczywistej powierzchni bryły** (`supportTop`/`ceilingBottom`), a nie na górnej krawędzi całej kratki. Ścieżka i grządka mają 15/16 bloku, więc wcześniej stojąca na nich postać była co klatkę podnoszona o 1/16 i opadała pod grawitacją – kamera drgała, a moby „dygotały”. Teraz stopa staje dokładnie na 15/16. Krok to waniliowe **0,6 bloku** (`maxUpStep`), więc wchodzi się także na łóżko (9/16), a wejście na płytę kończy się na 0,5 – wcześniej dodawaliśmy całe 0,55 i postać spadała pół bloku. Sufit zatrzymuje głowę dokładnie na spodzie bloku.
* **Golem oddaje po strzale i wybuchu.** Każde źródło obrażeń przekazuje napastnika: strzała gracza (`'player'`), strzała szkieletu (mob), TNT z zapamiętanym podpalaczem i creeper. Żelazny golem bierze napastnika na cel także po trafieniu z łuku lub wybuchem, ściga go z **32 bloków**, a w pościgu **omija przeszkody** (drzewa, płoty) zamiast wbijać się w nie bez końca – wcześniej obrót po zderzeniu był co klatkę kasowany przez „idź prosto na cel”.
* **Płynni gracze w multiplayerze.** Nowy moduł `netSmooth.ts` trzyma bufor migawek pozycji i rysuje zdalnego gracza **w środku przedziału między dwiema z nich** (120 ms w pokoju, 320 ms na serwerze publicznym, gdzie pakiety lecą 4 × na sekundę). Koniec ze „skokiem i zamarciem na 0,2 s”, obrót jest interpolowany po krótszej drodze, a nogi i ręce animują się z faktycznej prędkości. Pozycja leci też przy otwartym plecaku czy skrzyni, więc gracz nie znika innym z sesji.
* **Żywszy ruch głowy i kołysanie kamery.** Moby patrzą na gracza w poziomie **i w pionie** (`LookControl` w wanilii), odwracają głowę do 75° od tułowia, a bezczynne rozglądają się co kilka sekund. Owca przy wypasie patrzy w trawę (znak był odwrócony – patrzyła w niebo), a zdalny gracz ma zawias szyi, więc czapka, włosy i oczy obracają się razem z głową (wcześniej zostawały w miejscu). Kołysanie kamery ma wreszcie boczny ruch prostopadły do patrzenia, wygasa po zatrzymaniu i **respektuje przełącznik** „Kołysanie kamery” (wcześniej ustawienie nic nie robiło).
* **Testy.** `npm test` to **2145 kontroli silnika + 234 testy UI**. Sekcja 2.30 sprawdza brak drgań na ścieżce (gracz i golem), dokładne wysokości lądowania (15/16, 0,5, 9/16), blokowanie skrzyni, sufit, reakcję golema na strzał i wybuch, omijanie drzewa w pościgu, pionowy obrót głowy i wypas owcy oraz interpolację migawek (brak klatek bez ruchu, zawijanie kąta, teleport, limit ekstrapolacji). `npx tsc --noEmit`, `npm test` i `npm run build` przechodzą w całości.

## Wersja 2.29 „Drzwi, łóżko i dźwięki jak w grze” 🚪 🛏️ 🔊

Naprawa dwóch bloków, które do tej pory tylko udawały Minecrafta – **drzwi** i **łóżko** – oraz przebudowa warstwy dźwięku na oryginalne, waniliowe brzmienie. Wszystko dalej syntezowane proceduralnie: żadnych plików Mojanga.

* **Drzwi z prawdziwym zawiasem.** Drzwi mają dwa warianty zawiasu (`hinge=left` i `hinge=right`, nowe ID 422–437) i stoją po **przeciwnej** stronie kratki niż patrzył gracz – dokładnie jak `DoorBlock#getShape`. Zamknięte to płyta 3/16 przy ościeżnicy, otwarte obracają się o 90° wokół zawiasu, a zawias wybiera ta strona, po której stoi gracz. Model bierze waniliowe wycinki: duża płaszczyzna to cały kafelek (front lustrzanie), 3-pikselowe krawędzie – tylko skrajne kolumny deski, góra i dół – paski 3 px. Otwarte drzwi wreszcie **blokują ruch** (wcześniej nie miały kolizji i były dziurą w ścianie).
* **Łóżko z dwóch bloków.** Stopa i wezgłowie to osobne bloki w czterech kierunkach (ID 415–421; stare `B.BED` zostaje stopą zwróconą na północ, więc zapisy dalej stoją). Model to materac 6 px zawieszony 3 px nad podłogą plus dwie nogi 3×3×3 px na blok – razem cztery nogi, jak w `template_bed_head/foot.json`. Każda ściana ma własną teksturę z paczki (`red_bed_head_up/east/west`, `bed_head_north`, `red_bed_foot_up/east/west/south`). Stawiasz jednym kliknięciem (głowa dalej od ciebie), rozbicie dowolnej połowy usuwa całość i daje jedno łóżko, a punkt odrodzenia ustawia się przy stopie. Łóżka w wioskach też mają teraz obie części.
* **Oryginalne dźwięki.** Każdy efekt przechodzi przez proceduralny **pogłos małego pomieszczenia** (syntezowany impuls 0,55 s z wczesnymi odbiciami i miękkim ogonem), a materiały mają własne barwy: rezonans pasmowy plus niskie „korpus” uderzenia – drewno ciepłe, kamień twardszy, wełna głucha, szkło dzwoni. Nowe efekty: **drzwi** (skrzypienie przy otwieraniu, klaśnięcie przy zamykaniu), **łóżko** (skrzypienie materaca po nocy), **plusk** z bąbelkami, **ból** z dwóch opadających tonów, **chrupanie** (trzy szumy), **wybuch** z niskim „bum” i spadającym gruzem oraz **cięciwa** łuku z świstem.
* **Testy.** `npm test` to **2091 kontroli silnika + 234 testy UI**. Sekcja 2.29 sprawdza kolizję i model drzwi dla obu zawiasów, obrót skrzydła, nowe ID i `doorPlate`, obie połowy łóżka w czterech kierunkach, wysokość materaca, dropy, alfę, a także obecność nowych dźwięków, wspólne wyjście efektów i proceduralny pogłos. `npx tsc --noEmit`, `npm test` i `npm run build` przechodzą w całości.

## Wersja 2.28.1 – skrzynia 1:1 📦

Domknięcie okien: **skrzynia** rysuje prawdziwy panel `generic_54.png`, sklejony przy kompilacji z dwóch fragmentów – górnej części 176 × 71 i paska ekwipunku 176 × 96 – dokładnie tak, jak robi to waniliowe `GenericContainerScreen`. Siatka 9 × 3 leży na (8, 18), wiersz co 18 px, ekwipunek gracza na (8, 84), pasek skrótów na (8, 142), a panel ma 176 × 167 pikseli GUI. Zniknął `mc-panel` z własnymi ramkami – sloty są już w teksturze. Testy: **2045 kontroli silnika + 234 testy UI**.

## Wersja 2.28 „Więcej FPS i okna jak w grze” ⚡ 🖥️

Wbudowane odpowiedniki modów wydajnościowych – **Distant Horizons, Sodium, Entity Culling, ImmediatelyFast i Nvidium** – plus **kowadło, stół zaklęć, statyw alchemiczny i piec 1:1** z Minecrafta.

* **Teren za horyzontem (Distant Horizons).** Za pełnymi chunkami rysujemy tanie pasmo kafli LOD: siatka 128 × 128 bloków próbkuje generator co 4–16 bloków (im dalej, tym rzadziej), dostaje kolory biomów, cieniowanie zboczy i śnieg na szczytach. Zasięg to `max(CS × (R + 2), CS × R × 4)`, czyli przy zasięgu 6 chunków **384 bloki** zamiast 96 – z góry widać góry i morza, a koszt to kilkanaście tysięcy trójkątów i ~40 draw calli. Kafle są obniżone o 1,6 bloku, więc chowają się pod prawdziwym terenem i nie migoczą; budują się partiami po 12, żeby nie zamrozić klatki.
* **Sodium: kolejność budowy wg patrzenia.** Kolejka chunków jest sortowana po odległości **oraz** kierunku patrzenia (`hypot + (1 − facing) × 0,9`), więc teren w polu widzenia powstaje pierwszy. Sortowanie przelicza się dopiero po obrocie o ~0,4 rad albo co 0,5 s – sortowanie 169 par na każdą klatkę zjadłoby cały zysk.
* **Entity Culling.** Moby dalej niż 48 bloków aktualizują się co 2–6 klatek, a ruch liczymy z `dt × interwał`, więc nic nie zwalnia – po prostu próbkujemy rzadziej. Ticki są rozłożone po indeksie moba, żeby nie wypadały wszystkie w jednej klatce.
* **ImmediatelyFast / Nvidium: automat jakości.** `FrameGovernor` mierzy czas klatki (EMA 0,08) i po 1,5 s złych klatek schodzi z profilu `pełny → zrównoważony → oszczędny` (budżet budowy × 0,8 / × 0,55, zasięg LOD × 0,85 / × 0,6, interwał mobów × 1,5 / × 2), a po 3 s płynnej gry wraca. W opcjach: „Teren w oddali (LOD)” i „Automat jakości”.
* **Kowadło 1:1 (`AnvilScreen`).** Panel `anvil.png` 176 × 166, sloty (27, 47), (76, 47) i wynik (134, 47), pole nazwy 103 × 12 na (62, 24) na tle `text_field` (110 × 16), koszt poziomów pod wynikiem – zielony `#80ff20`, czerwony `#ff6060`.
* **Stół zaklęć 1:1.** Slot przedmiotu (15, 47) i lazurytu (35, 47), trzy przyciski ofert `enchantment_slot` (108 × 19) na wysokościach 13 / 32 / 51, warianty `_disabled` i `_highlighted` z paczki.
* **Statyw alchemiczny 1:1.** Trzy fiolki w literę V – (56, 51), (79, 58), (102, 51), składnik (79, 17), różdżka (17, 17), pęcherzyki `bubbles` (12 × 29) rosnące od dołu, postęp `brew_progress` (9 × 28) i pasek paliwa `fuel_length` (18 × 4) na (60, 44).
* **Piec 1:1.** Surowiec (56, 17), paliwo (56, 53), wynik (116, 31), płomień `lit_progress` (14 × 14) na (56, 36) i strzałka `burn_progress` (24 × 16) na (79, 34).
* **Testy.** `npm test` to **2045 kontroli silnika + 234 testy UI** (w 2.28). Nowa sekcja 2.28 sprawdza budżet klatki, kolejność budowy, interwały ticków, progi automatu, siatkę i pierścień LOD (17 × 17 wierzchołków kafla, wysokości z generatora, sortowanie po dystansie) oraz każdą współrzędną czterech nowych okien i obecność 17 widżetów w paczce. `npx tsc --noEmit`, `npm test` i `npm run build` przechodzą w całości.

## Wersja 2.27 „Handel jak w grze, mieszkańcy bez drżenia” 🧑‍🌾 🤝

Mieszkańcy przestali podskakiwać i trząść się, a okno handlu jest teraz **prawdziwym `MerchantScreen`** z Minecrafta – z panelem, listą ofert i przewijaniem prosto z paczki 26.2.

* **Mieszkaniec nie skacze.** Skok przy przeszkodzie dokładał się w każdej klatce (`vel.y = 8.2` bez żadnego odstępu), a sonda przeszkody sięgała 0,8 bloku od środka ciała, więc przy płocie 1,5 bloku „widziała” powietrze i podskakiwała w miejscu. Teraz sonda mierzy od krawędzi ciała, skok ma 0,55 s odnowienia i tylko dla mobów, które naprawdę skaczą – mieszkaniec i żelazny golem, jak w wanilii, w ogóle nie skaczą, tylko zawracają (najwyżej raz na 0,7 s).
* **Koniec trzęsienia.** W panice mieszkaniec dodawał losowy obrót w każdej klatce (`yaw += (random − 0,5) × 0,25`), co wyglądało jak dygotanie modelu. Kierunek ucieczki jest teraz zapamiętany w chwili ciosu, a tylko łagodnie faluje (sinus ±0,35 rad). Losowe obroty przy wodzie, klifie i ścianie też mają czas odnowienia.
* **Moby rozsuwają się, zamiast stać w sobie.** Dwa przenikające się modele wyglądają jak drżenie, więc doszło waniliowe `pushEntities` w wersji bezpiecznej: delikatny impuls prędkości (do ~5 bloku/s², maks. 2,2 bloku/s), który zwykła fizyka rozwiązuje z kolizjami – bez wpychania mobów w ściany i bez podnoszenia ich w powietrze.
* **Okno handlu 1:1 z `MerchantScreen`.** Panel 276 × 166 z `gui/container/villager.png` (przycięty z 512 × 256), lista ofert 88 × 140 przy (5, 18) z wierszem 20 px, przewijanie sprite'em `scroller` (6 × 27) i `scroller_disabled`, dwa sloty towaru (136, 37) i (162, 37), duży slot wyniku w ramce 26 × 26 przy (220, 37), znaczek `out_of_stock` i szara strzałka przy wyczerpanej ofercie, pasek doświadczenia mieszkańca `experience_bar_*` (102 × 5) i plakietka poziomu. Ekwipunek gracza to siatka 9 × 3 i pasek skrótów na waniliowych współrzędnych – bez własnych ramek, bo sloty są już w teksturze panelu.
* **Handel jak w grze.** Klikasz wiersz, żeby wybrać ofertę, a wymianę wykonuje dopiero slot wyniku (albo dwuklik na wierszu) – wcześniej każde kliknięcie wiersza od razu handlowało. Panel skaluje się do 2× i zawsze mieści się na ekranie telefonu; kółko myszy i tapnięcie na torze przewijają listę.
* **Testy.** `npm test` to **1974 kontrole silnika + 225 testów UI**. Nowa sekcja 2.27 sprawdza, że mieszkaniec nie podskakuje na otwartym polu, w zagrodzie i w panice (Δy < 2 cm), że nie obraca się gwałtowniej niż 0,25 rad na klatkę, że nadal chodzi i ucieka, że rozsuwanie mobów jest płynne, oraz cały układ waniliowego GUI (wymiary, sloty, scrollbar, skala) i obecność widżetów handlu w paczce. `npx tsc --noEmit`, `npm test` i `npm run build` przechodzą w całości.

## Wersja 2.26 „Koniec prześwitów, golem na posterunku” 🧱 🤖

Trzy zgłoszone błędy z rzędu: **chodnik w wiosce przestał działać jak rentgen**, **cios naprawdę odrzuca zombie**, a **żelazny golem wreszcie reaguje na potwory**. Do tego grządka dostała waniliowe nawadnianie i własną, ciemniejszą teksturę.

* **Koniec prześwitu przy ścieżce (x-ray).** Siatka chowała ścianę sąsiada, gdy ten miał flagę „nieprzezroczysty” – a ścieżka i grządka mają tylko 15/16 wysokości, więc nad ich górną krawędzią zostawała 1-pikselowa szpara i przez podłogę wioski było widać świat. Nowa tablica `CULLS` liczy **faktyczny kształt bryły** (pełne pudełko kolizji, a nie samą flagę), więc 15/16 bloki nie zasłaniają już niczego, a kowadło (pełna kolizja, model 12/16) też przestało chować ściany. Testy mierzą to na siatce: przy pełnym bloku na styku znikają dwie ściany, przy ścieżce i grządce zostaje ściana sąsiada.
* **Grządka jak `FarmBlock` z wanilii.** Dwa warianty: sucha i nawodniona (`moisture=7`). Woda w promieniu czterech bloków – także na skos (`dx² + dz² ≤ 18`) i o poziom wyżej – zmienia blok na ciemniejszy kafelek `farmland_moist` (168. kafelek paczki), a rośliny rosną na nim dwa razy szybciej (9 s zamiast 18 s). Po zabraniu wody grządka wraca do suchej wersji, a stan liczy ten sam moduł `farmland.ts`, co wzrost roślin, więc tekstura i tempo nigdy się nie rozjeżdżają. Sadzenie i zamiana ziemi w grządkę (`tryTill`) od razu wybierają właściwy wariant.
* **Cios naprawdę odrzuca.** Trafiony zombie leci ~1,5 bloku w pół sekundy, dostaje lekkie podbicie i przez 0,45 s nie steruje ruchem, więc odepchnięcie jest widoczne, a nie tylko kosmetyczne. Prędkość pościgu zombie spadła przy tym do 2,15 bloku/s (wanilia ~2,1–2,3), więc nie dogania gracza w pół kroku. Odrzut jest liczony od pozycji gracza, a moby z paniką (np. krowa) i tak uciekają dalej.
* **Golem na posterunku.** Żelazny golem dostaje cel, gdy potwór atakuje mieszkańca, nawet jeśli sam golem stoi daleko (do 32 bloków) – wcześniej patrzył wyłącznie na odległość od siebie. Gdy ktoś go uderzy, zapamiętuje napastnika na 40 s i oddaje mu ciosy, nawet jeśli obok stoi bliższy zombie. Gracz, który go sprowokuje, dostaje kontratak, a odrzucić go nie można (`kbResistance = 1`, jak odporność na odrzut w wanilii).
* **Testy.** `npm test` to **1934 kontrole silnika + 246 testów UI**. Nowa sekcja 2.26 sprawdza culling (`CULLS` dla ścieżki, grządki, skrzyni, kowadła, płyt, schodów, szyby i liści), różnicę wierzchołków siatki na styku z pełnym blokiem i z 15/16 blokiem, nawadnianie w promieniu 4 (także po skosie, o poziom wyżej i po zabraniu wody), ciemniejszy kafelek mokrej grządki, odrzut zombie ~1,5 bloku, odporność golema, obronę mieszkańca, zemstę na napastniku i kontratak na gracza. `npx tsc --noEmit`, `npm test` i `npm run build` przechodzą w całości.

## Wersja 2.25 „Ręce do przodu, piasek w dół” 🧟 🏖️

Dwie rzeczy naraz: **moby przestały odwracać się plecami** (animacja nie kasuje już pozy z modelu), a **świat dostał prawdziwą fizykę sypkich bloków** – piasek i żwir spadają, niszczą drobiazgi po drodze, wypierają wodę i osypują się po wybuchu.

* **Koniec z rękami do tyłu.** Animacja kończyn dokłada się teraz do obrotu zapisanego w modelu, a nie go nadpisuje. Zombie ma w modelu waniliową pozę +90° (ręce do przodu), a kod animacji wpisywał −90° – w pierwszej klatce ręce wędrowały więc za plecy. Teraz baza zostaje, a chód tylko lekko ją kołysze (±0,08 rad).
* **Audyt wszystkich 19 modeli.** Nowa sekcja testów przechodzi po każdym mobie i sprawdza, że głowa patrzy w stronę ruchu (lokalne −Z po obrocie korzenia o π daje +Z, czyli kierunek `yaw`), a animacja nie psuje pozy z modelu: mieszkaniec nie opuszcza złożonych rąk, pająk nie prostuje nóg (zostaje mu yaw ±π/4 i roll ±0,58), kura nie chowa skrzydeł, a golem i enderman nie dostają pozy zombie.
* **Piasek i żwir naprawdę spadają.** Cała kolumna naraz (a nie blok po bloku), z przyspieszeniem do 30 bloków/s, chmurą kurzu i dźwiękiem osiadania. Blisko gracza widać lecące klocki, dalej materiał osiada od razu – bez marnowania klatek. Nowy moduł `src/game/gravity.ts` trzyma czyste reguły (`isFallingBlock`, `fallPath`, `isCrushable`), więc fizykę da się testować bez WebGL.
* **Fizyka, która sprząta po sobie.** Spadający blok niszczy po drodze pochodnie, rośliny, szyny i lilie (wypadają jako przedmioty), wypiera wodę, rani za 2 serca, jeśli spadnie na głowę, a po wylądowaniu uruchamia opadanie tego, co leżało wyżej. Wybuch dopisuje zniszczone kratki do kolejki i osypuje piasek nad wyrwą – wcześniej wisiał w powietrzu.
* **Przedmioty toną powoli.** W wodzie przedmioty wyhamowują i opadają z prędkością do 2,2 bloku/s zamiast spadać jak kamień.
* **Testy.** `npm test` to **1900 kontroli silnika + 222 testy UI** (246 z jsdom). Sekcja 2.25 sprawdza pozę zombie po animacji, kierunek głów wszystkich mobów, bazę pozy mieszkańca i pająka oraz fizykę: kolumnę piasku, zmiażdżoną pochodnię, wypartą wodę, podparty piasek, `settle` i osypywanie po wybuchu. `npx tsc --noEmit`, `npm test` i `npm run build` przechodzą.

## Wersja 2.24.1 „Klasyczne menu wraca” 🔙

Pierwszym ekranem jest znów **klasyczne menu gry** – tło z paczki, wielkie BLOCKCRAFT, podpis wersji i te same przyciski co przed 2.24. Nic w rozgrywce, zapisach ani grafice się nie zmieniło. Launcher z 2.24 nie zniknął: otwiera się tylko pod adresem **`#launcher`** (albo `#client`), a „Klasyczne menu” w nim czyści hash i wraca do poprzedniego widoku. Dzięki temu klient nie zmienia pierwszego wrażenia ani nie zabiera miejsca na telefonie.

* **Co wróciło.** Kolejność ekranów, tło menu, przyciski (Graj, Nowy świat, Światy, Multiplayer, Ustawienia), podpis wersji i splashe – bez nowych pasków ani nawigacji. Usunięty został też zdublowany podpis „Minecraft 26.2”, który w 2.24 pojawiał się dwa razy.
* **Co zostało.** Cały launcher z 2.24 (profil i skórki, instancje światów z wyszukiwarką, serwery, paczki i mody, konsola) jest dostępny pod `#launcher` – dokładnie ten sam kod, bez zmian w grze.
* **Testy.** `npm test` to **1874 kontrole silnika + 222 testy UI** (246 z jsdom). Test jsdom sprawdza teraz, że pierwszy ekran to klasyczne menu, launcher otwiera się wyłącznie z `#launcher`, a wyjście z niego czyści adres. `npx tsc --noEmit`, `npm test` i `npm run build` przechodzą.

## Wersja 2.24 „Launcher w przeglądarce” 🚀

W 2.24 gra startowała z **launchera** w stylu Lunar Client / Prism Launcher: klient z profilem, światami-instancjami, serwerem, paczkami, skórkami, ustawieniami i konsolą, a **GRAJ** uruchamiał tę samą grę co wcześniej – z wybranym światem i profilem. Od 2.24.1 ten ekran jest dostępny pod `#launcher`, a domyślnie pokazuje się klasyczne menu.

* **Ekran Start.** Karta powitalna z wersją i celem zgodności (Minecraft 26.2 „Chaos Cubed”), obracający się blok trawy z prawdziwych tekstur paczki (CSS 3D, bez canvasu), statystyki paczki (167 kafelków, 100 ikon, 25 skórek), karta „Kontynuuj grę” z ostatnim światem i nowości z historii wydań – każdą można otworzyć w okienku z pełnym opisem.
* **Światy jako instancje.** Tworzenie świata z nazwą, seedem (liczba albo dowolny tekst), trybem (przetrwanie/kreatywny) i typem (normalny/płaski); karty światów mają grę, zmianę nazwy, duplikowanie, ulubione i usuwanie z potwierdzeniem. Listę można filtrować (nazwa, seed, tryb) i sortować po dacie, nazwie albo dniu w grze. Ostatnio używany świat jest podświetlony.
* **Serwery.** Osobna karta publicznego serwera (jeden świat dla wszystkich, zapis w chmurze, `/tpa`, czat), jednoklikowe dołączanie i skrót „Gram solo”. W karcie jest też uczciwa informacja: launcher uruchamia BlockCraft, nie oryginalny klient Java.
* **Paczki i mody.** Wbudowana paczka 26.2 z listą zawartości, realne ustawienia wydajności (presety Niskie/Średnie/Wysokie/Ultra, zasięg renderowania, cząsteczki, chmury, dynamiczna rozdzielczość) oraz sekcja „Mody i ułatwienia” z przełącznikami rozgrywki: auto-skok, auto-bicie, licznik FPS, kołysanie kamery, minimapa i wibracje.
* **Skórki i profil.** 9 postaci z paczki z podglądem portretu 16×32, edycja nicku (ten sam nick co w multi) i licznik uruchomień zapisany lokalnie.
* **Konsola.** Dziennik klienta z etapami uruchamiania (sprawdzanie plików → atlas → świat → scena), wykrytym sprzętem, zmianami ustawień i zdarzeniami świata.
* **Bez pieca w tle.** Launcher nie pobiera niczego z sieci i nie potrzebuje konta: profil, ustawienia i dziennik siedzą w `localStorage`, a grafika jest wbudowana w build. Klasyczne menu gry jest domyślnym ekranem, a samo okno klienta otwiera się pod `#launcher`.
* **Testy.** `npm test` to **1872 kontrole silnika + 222 testy UI**. Sekcja 2.24 sprawdza model launchera (nowości, zakładki, etapy postępu, etykiety czasu, metadane światów) i renderuje cały ekran klienta. `npx tsc --noEmit`, `npm test` i `npm run build` przechodzą.

## Wersja 2.23 „Minecraft 26.2: moby i tekstury 1:1” 🐄

Punkt odniesienia to **Minecraft Java Edition 26.2 „Chaos Cubed”** (resource pack format 88.0) – dokładnie ta wersja, dla której zrobiona jest paczka `26.2.x-Template.zip`. Geometria mobów pochodzi z waniliowych modeli encji (najnowszy dostępny zrzut: 26.1.2, te same modele są w 26.2), a każdy piksel tekstury trafia na właściwą ścianę.

* **Modele prosto z gry, z zagnieżdżonymi częściami.** `MobPart` ma pole `parent`, więc czapka zombie, rond kapelusza mieszkańca oraz rogi zimowej krowy siedzą w zawiasie głowy – obrót głowy pociąga je za sobą, tak jak `PartDefinition` w Minecrafcie. Krowa ma wystający **pysk** (`[1,33]`, 6 × 3 × 1 px) i rogi (`[22,0]` na z = −5), a ghast – **dziewięć macek** o waniliowych długościach 8–13 px i pozycjach ±3,75 / ±1,25 / ±6,25 px (wcześniej losowanych). Mieszkaniec dostał **rond kapelusza** (`[30,47]`, 16 × 16 × 1 px pod głową, pivot −0,5 px).
* **Lustrzane UV nóg.** Tak jak `Mirror` w wanilii: lewe nogi krowy i świni oraz prawe nogi owcy mają odbite UV. Bez tego „łatki” na nogach nie pasowały do tułowia i mob wyglądał, jakby miał obce kończyny.
* **Warianty biomowe.** Krowa ma **trzy modele** (zwykły, ciepły z innymi rogami, zimny z kudłatym futrem i grubymi rogami skierowanymi w tył), a świnia i kura – zimowe warstwy futra i piór (`cold_pig`, `cold_chicken`). Wariant wynika z biomu, w którym mob się rodzi: zimny w tundrze i górach, ciepły w sawannie, dżungli i na pustyni. Do tego 25 skórek z paczki, w tym wszystkie trzy warianty każdego zwierzęcia.
* **Tarcza i wszystkie 100 ikon.** W paczce nie ma `item/shield.png`, bo tarcza jest modelem 3D (`minecraft:special`) renderowanym z tekstury encji. Ikona powstaje z jej przedniej płyty (wycinek 12 × 22 px, `crop` + `mask`): ramka, deski i zaokrąglony dół, a rogi kafelka zostają przezroczyste. Teraz **każdy** przedmiot ma ikonę z paczki (100/100, wcześniej 99).
* **Kolory dokładnie jak w paczce.** Barwienie biomem dostają wyłącznie tekstury **szare**, tak jak w wanilii – kolorowa trzcina cukrowa nie jest już przyciemniana zielenią (różnica wobec pliku z paczki: 0).
* **Testy.** `npm test` to **1859 kontroli silnika + 222 testy UI**. Sekcja 2.23 sprawdza pysk i rogi krowy, lustrzane UV nóg, warstwy głów i rond kapelusza, dziewięć macek ghasta, warianty biomowe (model + tekstura), sylwetkę ikony tarczy oraz to, że skrzynia nie używa tekstury desek. `npx tsc --noEmit`, `npm test` i `npm run build` przechodzą.

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
* **Zapis:** serwer publiczny zapisuje bloki i profile graczy w chmurze; profile mają też lokalną kopię awaryjną. Pokój lokalny/P2P żyje w pamięci gospodarza i nie trafia do slotów zapisu.

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

## Przejście z portalu Rejson

Na `https://rejson59.github.io` dokument rozpoznaje jednorazowy znacznik przejścia i wczytuje animację wyjścia przed startem aplikacji — również wtedy, gdy projekt ma własny service worker. Bez znacznika, w ramce, na innych domenach i przy niedostępnej pamięci sesji kod nie pobiera zasobów portalu. Skrypt nie przenosi kont ani danych między domenami; na innych originach wyjście z portalu nie jest gwarantowane.
