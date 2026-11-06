# 4.28.2 — bezpieczny ekwipunek i regeneracja

## Zgłoszenia i pewność diagnozy

- `0438975b-3044-42dc-be5f-1caf93a0a380`, Nowe / Błąd / Normalny: „stracilem ekwipunek”.
- `c544b65d-a186-4ac7-a08b-5fcf1ad5566b`, Nowe / Błąd / Normalny: powolna/brak regeneracji i niemożność leczenia jedzeniem przy pełnym głodzie.

Oba: opublikowana gra, Chrome 156 / Linux, 1536×730. Nie podano trybu, konta, świata, kroków, FPS ani logów. Nie przypisujemy im na podstawie samego opisu jednej konkretnej sesji. Sprawdzono kod i odtworzono poniższe błędy, bez przeglądania danych graczy.

**Nie wykonano resetu świata, kont, ekwipunku ani działek.** Nie powtórzono resetu 4.28. Zweryfikowano, że produkcyjne kolumny zdrowia/głodu są już double precision — stara poprawka ułamkowych parametrów nie jest wykonywana ponownie.

## 1. Ekwipunek — potwierdzony błąd identyfikatora

Po zmianie na kontowy multiplayer `PublicServer.pid` pochodził z backendu, ale `Game.buildProfile()` nadal wpisywał losowy, dawny identyfikator urządzenia. `PublicServer.saveProfile()` poprawnie odrzucał cudzy PID. W rezultacie poprawny profil **własnego** gracza nie trafiał ani do zapisu chmurowego, ani kopii lokalnej. Test rzeczywistego silnika potwierdził brak zapisów przy różnych identyfikatorach. To nie było jedynie opóźnienie sieci.

Teraz snapshot i deterministyczny spawn używają zweryfikowanej tożsamości transportu publicznego. Identyfikator urządzenia nie jest zmieniany ani przypisywany do innego konta. Singleplayer i jego wcześniejsze zapisy pozostają osobne.

### Ochrona ostatnich i niepotwierdzonych zmian

- Zmiana przedmiotów widoczna przy aktualizacji HUD robi lokalny checkpoint. Zachowywane są plecak, pancerz, druga ręka, kursor, siatka craftingu, przedmiot zaklinania i potwierdzenia podniesienia przedmiotów. Rozpoczyna się to dopiero po pełnym zastosowaniu profilu przy wejściu.
- Dziennik `blockcraft-profile-v1:<world>:<pid>:pending` zawiera snapshot, dokładną wersję bazową z serwera i identyfikatory wysłanych zapisów. Nie wybieramy nowszego ekwipunku według zegara komputera.
- Jeśli serwer nadal ma bazową wersję, można bezpiecznie odtworzyć i ponowić niepotwierdzony snapshot. Jeśli odpowiedź zginęła już po zatwierdzeniu, `save_id` rozpoznaje ten zapis — także gdy podczas żądania powstał nowszy lokalny snapshot.
- Jeśli serwer naprawdę zmienił się niezależnie, wejście jest jawnie przerywane: obie wersje pozostają, zamiast automatycznie nadpisywać lub scalać przedmioty. Taki konflikt wymaga porównania kopii, nie kolejnego przejmowania połączenia. Nie dodano automatycznego zwrotu ani duplikowania przedmiotów.
- Błędny JSON całego ekwipunku/pancerza nie jest już interpretowany jako pusty ekwipunek.
- Przed `pagehide` silnik przechwytuje świeży snapshot w fazie capture, przed rozłączeniem adaptera. Mały checkpoint i leave są przekazywane przez keepalive do **jednej transakcji SQL**. Duże snapshoty nie przekraczają limitu keepalive — pozostają w dzienniku do zwykłego ponowienia.

### Backend

`supabase/migrations/202611060007_profile_checkpoints.sql` dodaje tylko `save_id` i serwisowe RPC `mconline_profile`. Zapis i opcjonalne leave sprawdzają aktualną generację połączenia pod tymi samymi blokadami SQL. Późny zapis starej generacji nie może nadpisać nowej. Wersja jest porównywana atomowo, a ponowienie tego samego `save_id` jest idempotentne. Odpowiedź pochodzi z `RETURNING`, czyli z rzeczywistego wiersza po istniejących triggerach zachowujących osiągnięcia — nie z nieznormalizowanego wejścia.

Wdrożenia na projekcie świata: `mconline_atomic_profile_checkpoints`, następnie korekta `mconline_profile_return_committed_row` wykryta testem triggera przed publikacją klienta. Źródło 007 zawiera końcową poprawną definicję. Edge `mconline-gateway` v3 ACTIVE; weryfikacja ogólnego konta na każdym żądaniu i service-role-only ACL zachowane. Projekt ogólnego konta nie był zmieniany.

**Ograniczenie odzyskiwania:** opis nie wskazuje utraconej zawartości ani zapisu. Przedmiotów, które poprzednia wersja odrzuciła przed utworzeniem jakiejkolwiek kopii, nie można odtworzyć z samego zgłoszenia. Nie obiecujemy zapisu ostatniej klatki po zabiciu procesu, odcięciu sieci lub zablokowaniu pamięci przeglądarki; utrata możliwości kopii jest sygnalizowana. Nie kasujemy istniejących kopii, by ukryć konflikt.

## 2. Zdrowie — potwierdzony błąd zegara na niskim FPS

Regeneracja działała wewnątrz kroku gracza ograniczonego do 100 ms na klatkę. Przy 2 FPS jedna sekunda oznaczała dla regeneracji tylko 0,2 s — pięciokrotne spowolnienie. Sama logika nasycenia, 0,5-sekundowej szybkiej i 4-sekundowej wolnej regeneracji już istniała i nie wymagała zastąpienia.

Teraz jedzenie/regeneracja korzystają z osobnego zegara widocznych klatek, niezależnego od limitu fizyki. Jedna spóźniona klatka może przetworzyć kilka należnych impulsów, z ponownym sprawdzeniem głodu/nasycenia. Ograniczamy nadrabianie po długim zawieszeniu i nie bankujemy leczenia w ukrytej karcie. Stan pauzy singleplayer nadal zatrzymuje symulację; menu multiplayer nie jest globalną pauzą serwera.

**Pełny pasek głodu nie oznacza pełnego nasycenia.** Przy 20 punktach głodu i zapasie nasycenia działa szybka regeneracja; bez zapasu nadal możliwe jest pół serca co 4 s, dopóki głód wynosi co najmniej 18. Poniżej tego poziomu naturalne leczenie ustaje. Jedzenie odbudowuje te zasoby, a nie dodaje bezpośrednio HP.

Brak możliwości zjedzenia zwykłego chleba przy pełnym głodzie jest zgodny z zasadami Minecrafta, nie osobnym błędem do „naprawienia” darmowym leczeniem. Komunikat przy próbie jedzenia wyjaśnia regenerację i możliwość użycia mikstury leczenia przy pełnym głodzie. Test sprawdza także rzeczywiste działanie tej mikstury i zwrot butelki.

## Weryfikacja

- `npm run typecheck`, `npm test`, `npm run build`: PASS; **25 436** kontroli offline, w tym 12 nowych scenariuszy dziennika/zegara, 23 bramki/chmury i regresje integracji Game → PublicServer z celowo różnymi PID.
- `supabase/tests/profile_checkpoints.sql`: **13 rzeczywistych kontroli SQL**, syntetyczne konto i pełny rollback. Role, właściciel/świat, ułamkowe HP, normalizacja triggera, idempotencja, monotoniczna wersja, odrzucenie starej wersji i błędnego JSON, atomowy checkpoint+leave, odmowa spóźnionym zapisom po leave i z innej generacji.
- `scripts/verify-multiplayer-lease-browser.mjs`: prawdziwy build produkcyjny, przypięty helper, silnik WebGL i Web Locks; syntetyczne RPC. Widok 1536×730. Regeneracja podczas rzeczywistego renderowania z limitem **2 FPS**; utrata zwykłego zapisu i leave; odtworzenie plecaka/kursora/craftingu/offhand; rzeczywiste ponowienie do mocka serwera; odbiór na oddzielnym browser context; udany ostatni checkpoint i wznowienie po utracie jego potwierdzenia. Ochrona duplikatu karty i brak automatycznego przejmowania urządzenia z 4.28.1 nadal PASS. Przy otwieraniu kolejnych silników zatrzymywany jest renderer pierwszego, nie jego blokada ani polling.
- Regresje chmury singleplayer: zapis pełnego świata i ekwipunku, drugi browser context, offline, konflikty i quota — PASS.
- Regresje konta: desktop, mobile, preview, file i obcy origin — PASS.
- CI uruchamia **15** rzeczywistych publicznych kontroli HTTP autoryzacji/CORS, w tym odmowę anonimowego nowego RPC. Bez prawdziwych sesji i trwałych zapisów testowych.

Testy przeglądarkowe nie korzystają z kont ludzi i nie są fizycznym testem urządzenia zgłaszającego. Pozytywne RPC przeglądarki są jawnie symulowane; realne transakcje i ACL badane są osobno w SQL. Wyniki skrótowe i hash buildu: `docs/benchmarks/inventory-health-4.28.2.json`.
