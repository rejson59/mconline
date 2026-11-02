# 4.21 — krzesiwo i płomienie

## Naprawiony błąd

`Game.tryUseHeld()` obsługiwał krzesiwem wyłącznie TNT i szczególny przypadek portalu. Zwykłego bloku ognia nie było, więc PPM na kamieniu, drewnie czy netherracku nie robił nic. Stary detektor portalu wymagał pełnej ramy 4×5, łącznie z narożnikami.

Teraz:

- PPM na pełnej górnej powierzchni podpala wolną kratkę. Piasek/gleba dusz daje niebieski ogień. Także górne płyty, szkło i inne pełne powierzchnie kolizji mogą podtrzymywać płomień; nie powstaje on nad pustką, wodą, dolną płytą ani zajętą kratką.
- Krzesiwo działa w głównej ręce oraz w istniejącej ścieżce drugiej ręki (np. miecz w głównej, krzesiwo w drugiej). Nie zmieniamy ogólnych zasad wyboru ręki.
- Udane użycie zużywa jeden punkt z 64 trwałości, z dotychczasowym Unbreaking. Nieudana/zabroniona akcja nie zużywa narzędzia. Creative nie zużywa trwałości.
- Ogień jest niekolizyjny, świeci (15 zwykły / 10 dusz) i zadaje graczowi kontaktowo 1 / 2 obrażenia co 0,5 s, przed dotychczasowym rozliczeniem pancerza. Creative i efekt ognioodporności chronią przed kontaktem. Sprawdzana jest objętość ciała, nie tylko blok pod stopami.
- LPM gasi płomień bez dropów i zużycia narzędzia. Wiadro zastępuje wskazany płomień płynem; przepływ wody może go zastąpić. Samo wstawienie do kolejki wody **nie** kasuje suchego ognia, także na chronionej granicy przepływu.
- Łopata gasi ognisko, krzesiwo je rozpala. Zgaszony stan zachowuje model/kolizję, ale nie emituje światła, nie gotuje i nie parzy. Nie jest osobnym przedmiotem Creative; kopiowanie daje zwykłe ognisko. Zapalone ogniska mają widoczne animowane płomienie.
- TNT zapalone krzesiwem ma lont 4 s. Weryfikowany jest rzeczywisty blok i wynik usunięcia, więc ponowne wywołanie na pustej kratce nie duplikuje TNT. Przypisanie wybuchu graczowi pozostaje. W Mieście TNT celowo nie jest uzbrajane: blok i trwałość zostają, a komunikat wyjaśnia ograniczenie. Ochrona sprawdza zarówno tryb sieci, jak i miejski świat.

## Portale i ochrona terenu

Nowy detektor startuje od **sąsiedniej kratki wskazanej klikniętą ścianą**, nie od dowolnego pobliskiego fragmentu obsydianu. Działa w obu osiach, dla wnętrza 2–21 bloków szerokości i 3–21 wysokości (zewnętrzna rama do 23×23), bez wymaganych narożników. Dopuszcza ogień w pustym wnętrzu. Płaczący obsydian nadal nie tworzy ramy. Całkowicie aktywny portal nie kosztuje kolejnej trwałości.

Przed pierwszym zapisem sprawdzane jest całe wnętrze i **każda** jego kolumna względem uprawnień silnika oraz świata. Zabroniona część nie powoduje połowicznego portalu. Zwykłe podpalanie wymaga uprawnienia do wskazanego podłoża i docelowej kratki. Użycie narzędzia *w miejscu*, np. na własnym ognisku przy granicy ulicy, nie wymaga uprawnienia do niezmienianej sąsiedniej ulicy. Gaszenie i naturalne wygaszanie także korzystają z normalnych ograniczeń zapisu.

Nie zmieniono SQL, RPC, formatu zapisu ani protokołu. Dopisano bloki 491–493 w istniejącym zakresie 0–511; dawnych ID nie przesunięto. Rzeczywiste testy sieciowe przeciw publicznej bazie nie były wykonywane w tej wersji — testy uprawnień są lokalne i nie ingerują w graczy ani działki.

## Ograniczenia: to nie jest pełna symulacja ognia Java

**Nie ma rozprzestrzeniania ani spalania budowli.** Nie dodano podpalania mobów, odroczonych obrażeń po wyjściu z płomienia, podpalania sąsiedniego TNT przez ogień, dymu, zależności od deszczu ani wariantów płomieni przyklejonych do boków bloków. Nie dodano waterlogged stanu ogniska ani pełnego systemu zanikania uszkodzonej ramy portalu. To świadomie ograniczona naprawa, nie deklaracja 1:1 całej mechaniki.

Zwykły płomień gaśnie po około 30 s czasu symulacji. Na netherracku, na bedrocku w Netherze i w poprawnym stanie dusz pozostaje do ugaszenia. Utrata podparcia lub dopływ wody także go wygasza. Kolejka obrabia najwyżej 16 źródeł co 0,25 s, z miękkim limitem 2 ms pomiędzy źródłami; duża liczba płomieni może opóźnić reakcję. To limit pracy ticka, nie gwarancja 2 ms dla każdej operacji świata.

Źródła rejestrowane są przy edycji, wczytaniu chunka i zmianach sieciowych; zwolnienie chunka usuwa ich lokalne liczniki. Czas życia **nie** jest zapisywany ani uzgadniany przez serwer: po ponownym wczytaniu zwykły płomień dostaje nowy licznik. Nie ma symulacji niezaładowanych obszarów/offline ani nowego autorytatywnego zegara ognia. Wygaśnięcie zapisuje i rozsyła uprawniony klient przez istniejącą ścieżkę zmian; obserwator cudzej działki nie usuwa jej bloków. Po aktualizacji publiczni gracze powinni odświeżyć klienta, żeby obsługiwał nowe ID.

## Grafika, dźwięk i koszt

- Natywne PNG/OGG Java 1.20.4 z przypiętego źródła `90d256dfee7b6fd8014e1bc3b107e64a530c5f9b`, osadzone offline. Kompilator: `scripts/compile-java-fire.py`. Oryginalne materiały Mojang/Microsoft **nie są MIT**; uzupełniono `public/Minecraft-NOTICE.txt`.
- Metadane `.png.mcmeta` zachowują kolejność klatek. Aby zmieścić się w istniejącym atlasie 256×256, animacja próbkuje **8 z 32** klatek zwykłego ognia, **4 z 32** dusz i **4 z 8** ogniska. Okresy wynoszą odpowiednio 1,6 / 1,6 / 0,8 s; nie jest to pełna płynność oryginalnych animacji. Ogień ma cztery pochylone płaszczyzny inspirowane modelem podłogowym Java, nie wszystkie warianty modelu blokowego.
- Atlas: ogień 240–247, dusz 248–251, ognisko 188–191, wygaszony bal 204. Nie nadpisano pieca 175, tekstur skrzyń w kolumnach 0–11 w wierszach 11–14, krawędzi szkła 252 ani narożnika torów 253. Test porównuje każdy inny kafelek bajt w bajt.
- Flagi `aWave` 2/3/4 wybierają klatki w shaderze warstwy cutout, z tym samym `uTime` co silnik. Zwykła geometria i woda zachowują swoje flagi. Animacja nie przebudowuje siatki, nie przesyła atlasu co klatkę i nie dodaje warstwy rysowania. Ta sama geometria działa w Workerze oraz trybie zapasowym.
- Dźwięki `item.flintandsteel.use` i `block.fire.extinguish` są oryginalnymi nagraniami, przestrzenne i respektują mikser bloków. Zapłon ma zakres losowej wysokości 0,8–1,2.
- Dodatkowa poprawa: `Chunk.updateEmitter()` utrzymuje posortowany indeks źródeł światła przez wyszukanie binarne i wstawienie/usunięcie. Edycja pochodni/płomienia nie skanuje już 32 768 komórek chunka. Generowanie nadal używa pełnego skanu. Test 130 edycji porównuje dokładny indeks ze skanem referencyjnym. Nie jest to obietnica wzrostu FPS; wstawianie/usuwanie nadal może przesuwać tablicę źródeł.

Końcowy samodzielny HTML: **10,554,287 B** (4.20: 10 483 752 B, **+0.67%**). Nie dodano zależności gry. Nowe narzędzia Chromium są wyłącznie opcjonalnym, ignorowanym wyposażeniem testów.

## Weryfikacja

`npm run typecheck`, `npm test`, `npm run build`, `git diff --check`: **PASS**. Łącznie **17 791** kontroli: 436 ognia/narzędzi/portali/ochrony, 81 Workera, 16 458 silnika, 403 dźwięku, 406 UI, 5 konta, 2 bootstrapu. Nowy zestaw: `npm run test:fire`.

Produkcja w Chromium/SwiftShader w sandboxie:

- desktop 960×600, mobilny viewport dotykowy 390×844 i lokalny `file://`;
- rzeczywisty raycast, syntetyczny event PPM / metoda wejścia `touchTap`, zużycie krzesiwa, drugą rękę, gaszenie;
- widoczna zmiana pikseli między klatkami ognia, flagi trzech animacji, brak kolizji, poprawna kompilacja shaderów i brak błędów WebGL/konsoli;
- rzeczywiste dekodowanie obu OGG: 0,425 s i 1,248 s, 44,1 kHz;
- zapis/odświeżenie przywraca zwykły ogień, dusz, zgaszone ognisko i trwałość drugiej ręki;
- ponowny zestaw 4.20: Worker, odrzucanie nieaktualnych wyników, awaryjny tryb synchroniczny, zwykły teren, podłoga, GUI 2/Auto 0 i sprzątanie. Zero różnicy pikseli pomiędzy geometrią referencyjną i Workerem: 1 049 760 pikseli desktop / 599 114 mobilny viewport, także 1 049 760 na normalnym terenie.

To testy VM, nie fizycznego telefonu i nie pomiar FPS. Surowe wyniki: [`benchmarks/fire-4.21.json`](benchmarks/fire-4.21.json). Zrzuty i duże pliki pozostają w ignorowanym `.cache/verification421`.

Opcjonalne powtórzenie (Linux x64, oddzielny profil przeglądarki, lokalny świat):

```sh
npm ci
npm run typecheck && npm test && npm run build
npm install --prefix .cache/browser-tools puppeteer-core @sparticuz/chromium
npm run preview -- --host 0.0.0.0 --port 4173
# W drugim terminalu:
npm run test:browser:fire
npm run test:browser:meshing
```

Oba skrypty przyjmują `BROWSER_URL`, `BROWSER_TOOLS` i `BROWSER_CASES`. Nie używają publicznego multiplayera. Testy przeglądarkowe nie są wymaganiem zwykłego `npm test`.
