# BlockCraft 3.0 🟩

Gra sandboxowa w stylu **Minecraft** działająca w przeglądarce – bez serwera i bez zewnętrznych zasobów wymaganych do uruchomienia. Wydanie **3.0 „Nowy rozdział”** łączy rozbudowany świat znany z poprzednich wydań z dopracowanym sterowaniem, zapisem lokalnym i dostępniejszymi opcjami. Gra działa na komputerach i urządzeniach dotykowych.

**Wersja 3.0 „Nowy rozdział”**:
- szybkie przywracanie domyślnych ustawień obrazu, sterowania i dźwięku z ekranu Opcji,
- spójny numer wydania 3.0 w grze, pakiecie i dokumentacji,
- pełna weryfikacja silnika, interfejsu, typów TypeScript i kompilacji produkcyjnej.

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

## 📜 Licencja

Kod gry: **MIT** – rób z nim, co chcesz.
Projekt inspirowany grą *Minecraft* (Mojang Studios); nie jest z nią powiązany i nie zawiera jej zasobów – wszystkie tekstury rysowane są proceduralnie w przeglądarce.
