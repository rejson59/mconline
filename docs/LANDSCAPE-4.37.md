# 4.37 — na telefonie tylko poziomo

Na wyraźne życzenie właściciela **wycofano możliwość rozgrywki w pionie**. Nie naprawiamy ani nie utrzymujemy już pionowego kadru dłoni/HUD. Menu, konto i wybór światów można nadal przeglądać bez obracania telefonu. Zapisów nie usunięto.

## Co działa teraz

- Nie ma przycisku „Graj w pionie mimo to” ani współdzielonego „Pomiń”. Stary klucz `blockcraft-portrait-ok` nie jest czytany przez runtime i nie odblokowuje gry.
- Telefon/tablet z dotykowym głównym wskaźnikiem wymaga szerokości co najmniej równej wysokości. Wymuszony tryb komputerowego sterowania na telefonie nie omija blokady. Wąskie okno komputera z myszą nie jest traktowane jak telefon.
- Polityka opiera się na układzie okna, nie na wysokości `visualViewport`: pojawienie się klawiatury ekranowej nie udaje obrotu urządzenia.
- Komunikat jest obecny przez **całą sesję świata**: również przed dołączeniem, w pauzie, oknach ze slotami, czacie, dzienniku i na ekranie śmierci.
- Pod komunikatem powierzchnia gry jest `inert` i ukryta dla technologii asystujących. Fokus trafia na przycisk komunikatu; dotykowe sterowanie zostaje odmontowane. Nie wystarczy zasłonić przyciski przezroczystą warstwą.
- Silnik niezależnie od nakładki odrzuca klawiaturę, wznowienie przez `setUI('playing')` i przechwycenie myszy w pionie. Przestawienie ustawień sterowania nie umożliwia wznowienia.
- Obrót anuluje trzymane klawisze, kopanie/stawianie, naciąg łuku, sprint i celowanie dotykiem. Jeśli trwała zwykła gra, wchodzi w pauzę. Powrót do poziomu **nie wznawia gry ani starych akcji automatycznie**.
- Obrót z otwartym oknem nie zamyka go: kursor i siatka craftingu pozostają nienaruszone. Nie wywołujemy zamykania kontenera ani zwrotu/dropu składników tylko z powodu obrotu.
- Singleplayer nie symuluje świata za blokadą. Multiplayer zachowuje dotychczasową symulację/sesję — nie udajemy, że obrót jednego telefonu pauzuje wspólny serwer.
- Pozostaje próba pełnego ekranu i blokady orientacji. Gdy API jest niedostępne/odrzucone, komunikat poleca ręczny obrót i odblokowanie rotacji systemowej. **Nie ma awaryjnego wejścia do gry w pionie**.
- Z blokady można **zapisać i wrócić do menu**, korzystając z istniejącej ścieżki zakończenia gry. Nie potrzeba zgody na fullscreen do wyjścia.

## Weryfikacja

`npm run test:landscape`, także standardowy `npm test`: **28 grup PASS**. Rzeczywista polityka dla telefonów/tabletów (w tym duży tablet), kwadratu i komputera, stary klucz, klawiatura ekranowa; rzeczywiste anulowanie akcji dla wszystkich 13 stanów UI, brak automatycznego wznowienia, nietknięte kursor/grid; realne ścieżki blokowania klawiatury/UI/pointer lock; montowany komponent React, fokus, ręczny fallback, obrót w obie strony i nieblokujące menu. Reguła pauzy SP/MP jest sprawdzana osobno.

`npm run test:browser:landscape`: produkcyjny Chromium, świeże syntetyczne lokalne światy i wymuszone odrzucenie fullscreen/orientation-lock. **PASS** dla dotyku oraz komputerowego trybu sterowania na emulowanym telefonie; `errors=[]` na obu. Widoki **390×844 → 844×390 → 390×844**, kilka kolejnych obrotów. Sprawdzono start z poprzednią zgodą na pion, brak obejścia Escape/W/E/R, nieaktywny interfejs pod komunikatem, czyszczenie akcji, nieruchomy czas/pozycję SP za blokadą, zachowanie kursora/grid, brak samowznowienia oraz zapis i wyjście w pionie. Osobno wąskie okno desktop **600×900** pozostaje bez blokady.

`npm run test:browser:trapitem`: **PASS** desktop 960×600 i telefon **844×390**, bez klikania starego obejścia. Nadal 504 UV świata, 1024 kanały atlasu i 72 UV rzeczywistych siatek obu rąk/dropu na widok, alpha/obrys ikony oraz stany/kolizje/interakcje drzwi i włazów. Na sprawdzonym zrzucie poziomego ekranu widać oba trzymane włazy; nie jest to nowe referencyjne ustawienie dłoni.

Pełne typecheck/test/build/diff-check: PASS; **16 972** kontrole silnika, **409** UI i wszystkie dotychczasowe zestawy kont, zapisów i SQL. Audit: **0 podatności**. Przeglądarkowe scenariusze rozgrywki przeniesiono do poziomu, usuwając stare próby kliknięcia obejścia; testy samych menu/konta zachowują pion.

Opcjonalne narzędzia są w `.cache/browser-tools`, zrzuty i raport w `.cache/verification437`. Małe trwałe [pokwitowanie](benchmarks/landscape-4.37.json) nie zawiera danych graczy.

## Zakres i następny krok

Bez zmian backendu, ID, protokołu, migracji, kont, formatów zapisu ani resetów. Nie zmieniono geometrii/UV z 4.36. Ustawienie i animacje przedmiotów nadal są projektowe. Następny odcinek dotyczy **referencyjnych pozycji dłoni i dropu w poziomie**, nie kadrowania pionowego.

Emulowany dotyk nie dowodzi wydajności fizycznego telefonu ani obsługi wszystkich rzeczywistych przeglądarek. Brak testu rzeczywistych uwierzytelnionych sesji multiplayer; ten wynik nie jest pełnym porównaniem z uruchomionym oryginałem Minecrafta ani wdrożeniem oryginalnych transformów modeli.
