# 4.33 — włazy i drzwi bez pustych trafień

Kolejna poprawka działającej gry po [płotach 4.32](FENCES-4.32.md). Bez zmiany ID bloków, formatu zapisów, resetu światów, migracji bazy ani zmian kont i backendu.

## Efekt w grze

- Cztery otwarte włazy mają fizyczne skrzydło grubości **3/16 bloku**, dokładnie tam, gdzie już był ich model. Można przejść obok skrzydła, ale nie przez nie. Zamknięty właz zachowuje dotychczasową górną płytę.
- Rendering synchroniczny i worker korzystają teraz z tych samych wymiarów włazu co kolizja. Nie utrzymujemy drugiej ręcznej tabeli modeli.
- Celownik trafia w rzeczywistą płytę włazu lub drzwi, nie w pustą część kratki. Dotyczy wszystkich **32 istniejących stanów drzwi**: czterech kierunków, obu zawiasów, obu połówek i otwarcia/zamknięcia. Promień walki nadal sprawdza fizyczną bryłę.
- Obrys zaznaczenia i nakładka pękania podążają za cienkim skrzydłem. Przełączenie na zwykły blok przywraca pełny sześcian.
- Stawianie włazu sprawdza wynikowy kierunek i rzeczywistą płytę. Odmawia przy przecięciu gracza lub żywego moba, bez zużycia przedmiotu; nie odmawia tylko dlatego, że postać jest w pustej części kratki. Ochrona docelowej działki pozostaje obowiązkowa.
- Pojedyncze użycie włazu zwalnia przytrzymaną akcję, tak jak drzwi: przytrzymanie przycisku nie przełącza go z powrotem co 0,22 s.

## Weryfikacja

**62 grupy regresji** (`npm run test:panels`, także w `npm test`):

- wszystkie pięć starych ID włazu: niezależnie oczekiwane bryły, granice siatki i identyczność renderingu synchronicznego/workera;
- szybki ruch z obu stron każdej płyty, trafienie powierzchni oraz przepuszczanie celownika i promienia walki przez wolną przestrzeń;
- wszystkie 32 stany drzwi: dokładny promień i cienki obrys;
- dynamiczna nakładka pękania, cache geometrii i powrót do sześcianu;
- prawdziwa ścieżka `tryUse`: przełączanie, stawianie na ścianach i podłodze, odmowa kolizji, żywy/martwy mob, ochrona działek i licznik zużycia;
- niezmienione ID **68–72**, jeden wpis Creative, kanoniczny drop i zapis/wczytanie.

Pierwsze 56 grup uruchomiono przed poprawką: **4 PASS / 52 FAIL**. Po poprawce i dodaniu sześciu dalszych grup: **62 PASS / 0 FAIL**. Dotychczasowy test drzwi nie został usunięty: sprawdza teraz brak zamknięcia przy celowaniu przez pustą przestrzeń, a następnie zamknięcie po skierowaniu promienia na obrócone skrzydło.

Pełne `typecheck`, `npm test`, `build`, `git diff --check`: PASS. Test silnika: **16 973 kontrole / 0 błędów**, UI: **409 / 0**; wcześniejsze 79 grup płotów i 45 ruchu także PASS. `npm audit --audit-level=low`: **0 podatności**.

**Produkcyjny Chromium, nowe lokalne światy gościa**: desktop 960×600 oraz dotykowy mobile 390×844, bez kont i publicznego multiplayera. Skrypt uruchamia rzeczywiste `updatePlayer`: cztery otwarte skrzydła zatrzymują na odpowiedniej płaszczyźnie, obok nich można przejść; dokładne promienie, obrysy oraz wszystkie 32 stany drzwi przechodzą kontrolę. Brak błędów konsoli. To kontrola gry w mobilnym widoku, nie badanie wydajności fizycznego telefonu.

Skrypt: `scripts/verify-panels-browser.mjs`, komenda `npm run test:browser:panels`. Opcjonalne narzędzia przeglądarkowe jak w teście płotów, wyłącznie w ignorowanym `.cache/browser-tools`. Raport i zrzuty pozostają w `.cache/verification433`; minimalny wynik w [pokwitowaniu](benchmarks/panels-4.33.json). Właściciel nie musi niczego instalować.

## Pozostałe różnice — to nie pełne 1:1

Ta porcja uzgadnia fizykę i celowanie z istniejącym modelem. Nie przeprowadzono nowego porównania z uruchomionym oryginalnym klientem Java 26.3 i nie zmieniano tekstur/UV. Własne regresje nie dowodzą pełnej zgodności z oryginałem.

Stary format włazu ma **tylko jeden zamknięty stan górny i cztery otwarte kierunki**. Nie zapisuje pełnej kombinacji kierunku i górnej/dolnej połowy; zamknięcie nadal traci poprzedni kierunek. Stawianie od spodu nadal jest odmawiane, a zależność od podparcia przy niszczeniu pozostaje stara. Pełne stany, ich bezpieczna migracja, waterlogging, redstone i pozostałe rodziny włazów pozostają otwarte. Nie przemianowano gry na ukończony port 26.3.
