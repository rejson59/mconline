# BlockCraft 3.0 — specyfikacja 100 pomysłów

> **Cel:** kompletny brief dla agenta wdrażającego pełne wydanie 3.0. To dokument projektowy, nie lista funkcji już obecnych w grze. Wszystkie 100 punktów ma zostać zaprojektowanych, zaimplementowanych, przetestowanych i opisanych przed uznaniem 3.0 za gotowe. Nie oznaczaj wydania jako ukończonego, jeśli którykolwiek punkt pozostaje tylko opisem, atrapą, nieosiągalną zawartością albo nieprzetestowanym kodem.

## Zasady wdrożenia

1. Zachowaj zgodność starych światów: nowe ID bloków/przedmiotów dopisuj, nie zmieniaj znaczenia zapisanych ID; dodaj migracje tylko wtedy, gdy są konieczne.
2. Każda nowa zawartość ma być osiągalna w Survival (generacja, crafting, drop, handel lub nagroda) oraz widoczna w Creative, jeśli ma sens jako blok/przedmiot.
3. Każda nowa mechanika ma mieć opis i czytelny feedback w grze. Unikaj elementów, które istnieją wyłącznie w kodzie lub komendach.
4. Tekstury, ikony, modele, animacje i dźwięki muszą być spójne stylistycznie, czytelne w małej skali i działać na słabszych urządzeniach.
5. Zachowaj działanie na PC i ekranach dotykowych, istniejące sterowanie, zapisy, import/eksport oraz tryby gry.
6. Dla każdego punktu dodaj testy adekwatne do mechaniki. Dodatkowo wykonaj pełne testy, typecheck, build i próbę ręczną nowej zawartości w grze.
7. Agent powinien aktualizować ten plik checkboxami dopiero po wdrożeniu i weryfikacji funkcji. Nie usuwaj pozycji tylko dlatego, że są trudne.

## A. Świat i eksploracja

1. [ ] **Nowe biomy:** dodaj bagna, sawannę, tajgę, dżunglę, pustkowie i kwiecistą łąkę. Każdy ma rozpoznawalną roślinność, podłoże, paletę i zasady generacji; sprawdź stabilność dla ziarna.
2. [ ] **Biomy wysokościowe:** generuj ośnieżone szczyty, płaskowyże, wąwozy i głębokie doliny jako odrębne warianty terenu, z bezpiecznymi granicami chunków.
3. [ ] **Rzeki i jeziora:** generuj połączone, ciągłe systemy wodne prowadzące przez wiele chunków; zapewnij brzegi, źródła i poprawną nawigację.
4. [ ] **Większe jaskinie:** dodaj komory, tunele, podziemne jeziora i korytarze łączące różne wysokości; gracz nie może trafiać do uwięzionych ani nieosiągalnych kieszeni bez wyjścia.
5. [ ] **Podziemne ruiny:** generuj rzadkie, eksplorowalne lokacje z łupem, pułapkami i wskazówkami fabularnymi; nagrody muszą mieć sensowną tabelę łupów.
6. [ ] **Opuszczone kopalnie:** buduj systemy z drewnianymi podporami, torami i skrzyniami; struktury mają być spójne między chunkami i nie przecinać się wadliwie z terenem.
7. [ ] **Ruiny powierzchniowe:** dodaj pozostałości wież, mostów i obozowisk z czytelnymi śladami dawnych mieszkańców oraz możliwymi nagrodami.
8. [ ] **Obozowiska:** generuj małe miejsca postoju z ogniskiem, namiotem, skrzynką i tropami; zapewnij różne warianty oraz bezpieczne rozmieszczenie.
9. [ ] **Wioski biomowe:** rozróżnij układ, materiały i zabudowę wiosek zależnie od biomu; zachowaj działanie mieszkańców, handlu i golemów.
10. [ ] **Dalekie punkty orientacyjne:** generuj rzadkie, widoczne z daleka ruiny, samotne drzewa, latarnie i szczyty ułatwiające nawigację.
11. [ ] **Wydarzenia podróżne:** dodaj opcjonalne spotkania podczas wędrówki, np. burzę, zasadzkę lub handlarza; wydarzenia nie mogą uruchamiać się zbyt często ani blokować gracza.
12. [ ] **Podziemia Netheru:** rozbuduj wymiar o nowe formacje, ruiny i lokacje z odmiennym łupem oraz zagrożeniami; zachowaj osobne dane Netheru.
13. [ ] **Naturalne przeprawy:** generuj brody, przełęcze i mosty pozwalające czytelnie przechodzić przez trudny teren.
14. [ ] **Historia świata:** dodaj znajdowane fragmenty dzienników, inskrypcje i dekoracje ujawniające historię bez długich przerywników.
15. [ ] **Mapa odkrywania:** dodaj mapę z odkrywanymi obszarami, znacznikami i możliwością powrotu do ważnych miejsc; zapisz jej stan w świecie.

## B. Bloki i budowanie

16. [ ] **Nowe drewno:** dodaj kilka drzew biomowych i pełne zestawy z ich drewna: deski, płoty, drzwi, schody, płyty i pozostałe pasujące elementy.
17. [ ] **Odmiany kamienia:** dodaj łupek, granit, marmur i bazalt wraz z pełnymi wariantami budowlanymi oraz właściwymi narzędziami i recepturami.
18. [ ] **Mech i porosty:** dodaj bloki/rośliny do ruin i zielonych ścian; zapewnij rozmnażanie lub rzadkie generowanie, jeśli pasuje do balansu.
19. [ ] **Glina i terakota:** rozszerz paletę barw i dodaj wzorzyste bloki; udostępnij przepisy i spójne ikony.
20. [ ] **Szkło barwione:** dodaj barwione tafle, szyby i witraże; poprawnie obsłuż przezroczystość i meshing sąsiednich bloków.
21. [ ] **Bloki oświetlenia:** dodaj lampiony, świece i lampy o kilku wartościach światła; światło ma być widoczne, ale nie może nadmiernie obciążać silnika.
22. [ ] **Łańcuchy i haki:** dodaj dekoracyjne łańcuchy oraz haki do kuźni, mostów, kopalń i pułapek; obsłuż placement i zniszczenie.
23. [ ] **Więcej schodów i płyt:** rozszerz zestawy materiałowe oraz sprawdź łączenie, orientację, kolizje i złożone powierzchnie.
24. [ ] **Belki konstrukcyjne:** dodaj widoczne drewniane i metalowe belki do budowy, z poprawną orientacją i recepturami.
25. [ ] **Kolumny i kapitele:** dodaj elementy architektoniczne do świątyń, zamków i wejść; tekstury powinny pasować do bloków bazowych.
26. [ ] **Dywany i tkaniny:** dodaj kolorowe, wzorzyste dywany oraz możliwość barwienia; bloki nie powinny utrudniać chodzenia.
27. [ ] **Donice i skrzynki na rośliny:** pozwól umieszczać kwiaty i sadzonki w dekoracyjnych pojemnikach.
28. [ ] **Krzewy i liście:** dodaj żywopłoty, paprocie i rośliny zależne od biomu wraz z dropami i interakcjami.
29. [ ] **Garncarstwo:** dodaj glinę garncarską, wypalane naczynia i wzorzyste płytki; udostępnij przepisy/stację i UI, jeśli potrzebne.
30. [ ] **Pogodowe warianty bloków:** wizualizuj śnieg na dachach, mokre powierzchnie podczas deszczu i mech na starych ruinach; efekty muszą respektować jakość grafiki.

## C. Przedmioty, narzędzia i crafting

31. [ ] **Lina:** dodaj linę do wspinania, prowadzenia zwierząt i budowy prostych pułapek; określ jej zasięg, recepturę i zachowanie po śmierci/przeładowaniu.
32. [ ] **Kotwica wspinaczkowa:** umożliwiaj bezpieczne zejście do jaskiń i powrót; dodaj czytelne ograniczenia oraz obsługę PC/dotyku.
33. [ ] **Kompas biomów:** pozwól wybrać biom i wskazuj najbliższy jego obszar; dodaj UI wyboru i przypadki, gdy biom nie został wygenerowany w zasięgu.
34. [ ] **Lornetka:** dodaj przybliżenie widoku i użyteczne namierzanie punktów; nie może blokować wejścia ani powodować nadmiernego FOV.
35. [ ] **Plecak:** dodaj ograniczoną, dodatkową przestrzeń podróżną z UI; obsłuż zapis, przeciąganie stosów, import, eksport i śmierć gracza.
36. [ ] **Pojemnik na mikstury:** umożliwiaj wygodne przechowywanie kilku mikstur w jednym wyposażonym przedmiocie; zachowaj ich efekty i typy.
37. [ ] **Zestaw naprawczy:** naprawiaj wyposażenie w terenie za materiały i doświadczenie; wyświetl koszt i wynik przed użyciem.
38. [ ] **Różne tarcze:** dodaj warianty materiałowe, wzory i wyważone różnice w wadze/ochronie; obsłuż blokowanie i zużycie.
39. [ ] **Włócznia:** broń o większym zasięgu i wolniejszym ataku; dodaj crafting, animację, balans i działanie w dotyku.
40. [ ] **Młot:** wolna broń z atakiem obszarowym, dodatkowo skuteczna wobec wskazanych bloków; zapobiegaj przypadkowemu niszczeniu otoczenia.
41. [ ] **Sztylet:** szybka broń krótkiego zasięgu współpracująca z unikami; dodaj animację, receptury i czytelny feedback trafienia.
42. [ ] **Łuki i cięciwy:** dodaj warianty cięciwy wpływające na naciąg i siłę; opisz statystyki oraz nie psuj istniejącego łuku.
43. [ ] **Specjalne strzały:** dodaj strzały świetlne, spowalniające i oznaczające cel; każdy efekt ma mieć czas trwania, UI i testy.
44. [ ] **Pułapki łowieckie:** pozwól polować bez bezpośredniej walki; ogranicz częstotliwość łupów i zabezpiecz przed duplikowaniem.
45. [ ] **Zestaw biwakowy:** dodaj namiot, ognisko i proste łóżko podróżne; określ punkt odrodzenia, rozkładanie i usuwanie.
46. [ ] **Kocioł podróżny:** umożliwiaj ograniczone gotowanie i warzenie poza bazą; dodaj receptury, paliwo i stan zapisu.
47. [ ] **Więcej posiłków:** dodaj zupy, pieczone warzywa i dania z krótkimi, zbalansowanymi premiami; pokaż aktywne efekty.
48. [ ] **Przynęty wędkarskie:** wpływaj na szanse połowu określonych ryb i skarbów; zachowaj timing minigry oraz dodaj testy tabel połowów.
49. [ ] **Talizmany:** dodaj rzadkie przedmioty z niewielkimi, jasno opisanymi efektami użytkowymi; zapobiegaj kumulowaniu nieograniczonych premii.
50. [ ] **Dekoracyjne receptury:** dodaj obrazy, chorągwie, wazony i elementy wyposażenia wnętrz; zapewnij crafting, placement i ikony.

## D. Moby i ich zachowanie

51. [ ] **Przegląd wyglądu mobów:** popraw sylwetki, tekstury i animacje ruchu, ataku oraz odpoczynku; dodaj warianty biomowe i sprawdź czytelność na małym ekranie.
52. [ ] **Króliki:** dodaj płochliwe króliki uciekające przed graczem, generowane głównie na łąkach; obsłuż dropy i animację skoku.
53. [ ] **Lisy:** polują na małe zwierzęta, mogą podkradać jedzenie leżące na ziemi i uciekają przed zagrożeniem.
54. [ ] **Żaby:** generuj je przy wodzie; dodaj skoki, rechot/feedback i polowanie na drobne stworzenia.
55. [ ] **Żółwie:** dodaj powolne moby przybrzeżne składające jaja na piasku; jaja muszą mieć cykl wzrostu i poprawny zapis.
56. [ ] **Niedźwiedzie:** zwykle neutralne, lecz bronią młodych i zasobów; dodaj telegraph ataku i możliwość ucieczki.
57. [ ] **Sowy lub nietoperze:** dodaj animowany mob latający z zachowaniem zależnym od pory dnia.
58. [ ] **Kameleony/jaszczurki:** dodaj małe moby bagienne kamuflujące się na tle roślinności; kamuflaż nie może czynić ich całkowicie niewidzialnymi.
59. [ ] **Wędrowny kupiec z karawaną:** dodaj spotkania na szlaku, zwierzęta transportowe i oferty zależne od regionu.
60. [ ] **Strażnik wioski:** dodaj patrolującego NPC, który rozpoznaje zagrożenia i broni mieszkańców.
61. [ ] **Codzienne życie mieszkańców:** dodaj pracę, odpoczynek, spotkania i reakcje na porę dnia bez psucia handlu i ścieżkowania.
62. [ ] **Reakcje mobów na pogodę:** zwierzęta chowają się przed burzą lub wychodzą podczas deszczu; zachowania muszą być przewidywalne.
63. [ ] **Reakcje na ogień:** wybrane moby unikają ogniska i pochodni; sprawdź pathfinding przy źródłach światła.
64. [ ] **Ślepy mob jaskiniowy:** dodaj przeciwnika nasłuchującego kroków, kopania i rzuconych przedmiotów; daj graczowi sposoby cichego poruszania się.
65. [ ] **Przeciwnik pustynny:** dodaj moba wyskakującego z piasku z czytelnym wcześniejszym ostrzeżeniem.
66. [ ] **Strażnik ruin:** dodaj przeciwnika pilnującego skarbów, który może uruchamiać proste pułapki.
67. [ ] **Warianty mobów:** różnicuj kolory, wyposażenie i odporności według biomu, zachowując czytelną telemetrię i balans.
68. [ ] **Pathfinding mobów:** moby omijają przeszkody i nie próbują bez końca przechodzić przez ściany; dodaj limity obliczeń dla wydajności.
69. [ ] **Animacje walki:** dodaj sygnały przed atakiem, odrzut i reakcje na trafienie; ataki muszą pozostać sprawiedliwe i czytelne.
70. [ ] **Oswajanie przez zaufanie:** zwierzęta stopniowo przyzwyczajają się do gracza; pokaż postęp, warunki i zachowanie po ponownym uruchomieniu świata.

## E. Walka, wyzwania i progresja

71. [ ] **Boss ruin:** zbuduj specjalną lokację i starcie z wieloma fazami, czytelnymi atakami oraz nagrodą wspierającą eksplorację.
72. [ ] **Boss Netheru:** dodaj wymagające przygotowania starcie korzystające z odporności i strategii; zachowaj dostępność świata po porażce.
73. [ ] **Mini-bossowie biomowi:** dodaj rzadkich, rozpoznawalnych przeciwników bez wymagania uruchamiania kampanii.
74. [ ] **Różne wzorce ataków:** dodaj uniki, szarże, ataki dystansowe i okna kontry; komunikuj zagrożenie animacją/dźwiękiem.
75. [ ] **Unik i blok kierunkowy:** nagradzaj timing zamiast szybkiego klikania; obsłuż sterowanie PC i dotykowe.
76. [ ] **Specjalizowane zbroje:** dodaj warianty z odpornością na ogień, szybszym pływaniem lub ochroną przed upadkiem; zbalansuj koszt i pancerz.
77. [ ] **Warianty zaklęć:** dodaj kilka sensownych ulepszeń do wyboru, nie tylko proste zwiększanie obrażeń; wyświetl zasady i konflikt zaklęć.
78. [ ] **Nowe mikstury:** dodaj widzenie w ciemności, odporność na upadek i krótkotrwały sprint; obsłuż UI efektów, brewing i zapis.
79. [ ] **Wyzwania dziennika:** dodaj cele z eksploracji, budowania i walki, a nie wyłącznie zbieranie; zapisuj postęp i nagrody.
80. [ ] **Nagrody za odkrywanie:** powiąż osiągnięcia i dziennik z nowymi lokacjami/biomami i unikaj nagradzania wielokrotnego za ten sam wyczyn.
81. [ ] **Trudność świata:** dodaj niezależne ustawienia agresji mobów, obrażeń i zasobów; ustawienia mają działać dla już istniejących światów.
82. [ ] **Tryb przygody:** dodaj ograniczenia niszczenia bloków i zadania w przygotowanych lokacjach; zachowaj osobne zasady od Survival/Creative.
83. [ ] **Arena treningowa:** dodaj bezpieczne miejsce do testowania broni i pancerza bez utraty ekwipunku.
84. [ ] **Łupy bossów jako narzędzia:** nagrody otwierają nowe sposoby podróżowania/eksploracji, nie tylko zwiększają obrażenia.
85. [ ] **Czytelne ostrzeganie o zagrożeniach:** muzyka, efekty i animacje sygnalizują zbliżającego się przeciwnika; zapewnij ustawienia głośności i dostępności.

## F. Rolnictwo, wioski i rzemiosło

86. [ ] **Nowe uprawy:** dodaj kukurydzę, pomidory, dynie i uprawy zależne od biomu; zaimplementuj wzrost, zbiór, nasiona i pożywienie.
87. [ ] **Nawadnianie:** dodaj kanały wodne poprawiające wygląd i wspierające uprawy; nie dopuszczaj do nieograniczonego zalewania świata.
88. [ ] **Drzewa owocowe:** dodaj drzewa z owocami sezonowymi; zapewnij generację, sadzonki, zbiór i zbalansowane jedzenie.
89. [ ] **Etapy wzrostu zwierząt:** dodaj młode, karmienie i rozmnażanie do zwierząt hodowlanych z działającym zapisem.
90. [ ] **Pszczoły i ule:** dodaj zapylanie, miód jako jedzenie/składnik i plaster jako materiał; obsłuż pozyskiwanie oraz ochronę przed farmieniem bez limitu.
91. [ ] **Zawody mieszkańców:** dodaj kartografa, rybaka, ogrodnika i kowala z ofertami odpowiadającymi ich pracy.
92. [ ] **Rozbudowa wiosek:** pozwól budynkami gracza przyciągać mieszkańców lub poszerzać handel; zapewnij kontrolę nad generacją i stabilność save.
93. [ ] **Crafting zależny od stacji:** przypisz wybrane przepisy do konkretnych warsztatów zamiast ogólnego craftingu; aktualizuj wyszukiwarkę receptur.
94. [ ] **Nowe stacje:** dodaj piłę, krosno, kamieniarza i obróbkę metalu wraz z UI, recepturami i interakcją.
95. [ ] **Przetwarzanie etapowe:** dodaj łańcuchy typu ruda → wlewki → części narzędzia z czytelnym przepływem i bilansem surowców.

## G. Tekstury, dźwięk i interfejs

96. [ ] **Spójny przegląd tekstur:** ujednolić skalę pikseli, kontrast i paletę bloków/przedmiotów; nie obniżyć wydajności ani czytelności.
97. [ ] **Czytelniejsze ikony:** zaprojektować osobną, rozpoznawalną sylwetkę dla każdego narzędzia i materiału; sprawdzić tooltipy i małe sloty.
98. [ ] **Lepsze tekstury bloków:** ograniczyć widoczne powtórzenia ścian, ziemi i kamienia subtelnymi wariantami bez migotania UV.
99. [ ] **Dźwięki środowiska i walki:** dodać dźwięki biomów, kroków po podłożu, kopania i trafień; zapewnić sterowanie głośnością i wyłączenie dźwięku.
100. [ ] **Ustawienia jakości tekstur i efektów:** dać wybór jakości tekstur/efektów dla słabszych urządzeń bez utraty czytelności; poprawnie zapamiętać ustawienia i sprawdzić tryb automatyczny.

## Kryteria odbioru wydania 3.0

- [ ] Każda z 100 pozycji jest wdrożona, grywalna i ręcznie sprawdzona; niewdrożone punkty nie mogą być reklamowane jako funkcje 3.0.
- [ ] Nowa zawartość jest osiągalna w Survival i Creative zgodnie z przeznaczeniem.
- [ ] Stare zapisy przechodzą migrację/odczyt bez utraty świata, ekwipunku, wymiarów i ustawień.
- [ ] Testy silnika i UI, testy nowych mechanik, `npm run typecheck` oraz `npm run build` przechodzą.
- [ ] Sprawdzone są desktop, dotyk, mały ekran, niski preset grafiki, world import/export i ponowne uruchomienie świata.
- [ ] README, pomoc w grze, changelog i numer wersji opisują wyłącznie realnie dostarczone możliwości.
- [ ] Dopiero po spełnieniu powyższych kryteriów oznacz PR jako gotowy i przygotuj wydanie 3.0.
