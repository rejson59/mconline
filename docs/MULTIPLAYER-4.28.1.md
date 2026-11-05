# 4.28.1 — fałszywa blokada „konto na innym urządzeniu”

Zgłoszenie: `1b53b6a5-0561-46ac-b8ef-899eeb26f32f`, nowe, błąd, priorytet normalny. Środowisko zgłaszającego: Chrome 155 / Linux, 1680×1050. Naprawa nie ponawia resetu z 4.28.

## Co udało się ustalić

W produkcyjnym `mconline_member` każda próba wejścia z nowym UUID połączenia była przez 60 sekund traktowana jak inne urządzenie. Klient generował nowe UUID przy każdej próbie, także po odświeżeniu tej samej karty. Brakowało zwalniania połączenia przy nawigacji, a odrzucona odpowiedź `join` mogła ukrywać skuteczne zajęcie sesji. Szybki powrót przed zakończeniem ostatniego zapisu profilu również mógł zastać poprzednią rezerwację.

Odtworzono starą blokadę **na rzeczywistej bazie**: dwa kolejne `join` jednego syntetycznego konta, bez drugiego urządzenia, zwracały komunikat „innym urządzeniu”. Fixture został w całości wycofany transakcyjnie. Nie przeglądano sesji ani danych zgłaszającego.

Zgłoszenie podaje liczbę **3** błędów konsoli, ale bez ich treści, stosów i znaczników czasu. Nie można przypisać każdego wpisu do konkretnego żądania ani potwierdzić dokładnej sekwencji działań tej osoby. Potwierdzono i naprawiono opisany mechanizm, nie zakładając, że ktoś faktycznie grał na drugim urządzeniu.

## Zmiany

1. **Bezpieczny powrót tej samej karty.** Osobny losowy dowód wznowienia w sessionStorage, przypisany do konta. Automatyczne wznowienie jest używane tylko po uzyskaniu ekskluzywnego Web Lock dla tego konta. Skopiowanie sessionStorage przez „Duplikuj kartę” nie wystarcza do zajęcia aktywnej sesji drugiej karty.
2. **Nowa generacja przy każdym wejściu.** SQL `mconline_member_v2` sprawdza zweryfikowane konto i skrót dowodu. Późne `leave`, heartbeat lub poll starej generacji nie mogą zamknąć ani odnowić nowego połączenia. Profil, PID i klucz własności działek pozostają bez zmian. Czas rezerwacji liczony jest od uzyskania blokady SQL, nie od początku czekającej transakcji.
3. **Sprzątanie i kolejność.** Błąd/utrata odpowiedzi `join` oraz anulowanie powodują próbę zwolnienia dokładnie tej generacji. Wyjście nawigacją wysyła małe żądanie `keepalive`; nie traktujemy jego dostarczenia jako gwarantowanego. Normalne rozłączenie czeka na ostatnie zapisy profilu, a szybki powrót czeka na zakończenie poprzedniego zamykania. Zwolnienie klienta jest idempotentne. Usunięty wyścig podwójnego kliknięcia przed odświeżeniem stanu Reacta.
4. **Jawne odzyskanie starego połączenia.** Backend zwraca kod `ACCOUNT_IN_USE`, bez kategorycznego stwierdzania „inne urządzenie”. UI pokazuje „Odzyskaj połączenie” z potwierdzeniem. Tylko zalogowany właściciel może zastąpić swoją poprzednią sesję; jej stara generacja traci dostęp. Nie robimy automatycznego przejęcia nieznanej sesji innego urządzenia.
5. **Fallback.** Bez Web Locks lub przy zablokowanym sessionStorage automatyczny dowód nie jest używany. Pozostają poprawnie opisany konflikt, wygaśnięcie po minucie i świadome odzyskanie. Powrót z BFCache po zamknięciu transportu wymaga ponownego dołączenia, zamiast pozostawiać pozornie aktywną grę.

Dowód wznowienia nie jest tokenem logowania. Do każdego żądania nadal wymagane jest serwerowe sprawdzenie ogólnego konta. Dowód nie trafia do URL, światów, eksportów ani logów; baza przechowuje tylko jego skrót. Model zaufania wspólnego originu pozostaje bez zmian.

## Backend i brak resetu

- Projekt świata `bewwejewgqzctnjrbclu`: migracja `202611050006_multiplayer_resume.sql`, wdrożona jako `mconline_multiplayer_resume_fencing`.
- Edge `mconline-gateway` v2 ACTIVE; build z `supabase/functions/mconline-gateway/index.ts`. Nowe RPC dostępne wyłącznie dla service role, nigdy bezpośrednio dla anon/authenticated. Stare wywołania serwisowe pozostają kompatybilne.
- **Bez kasowania światów, ekwipunku, działek, kont ani masowego wylogowywania graczy.** Poprzedni reset 4.28 nie jest wykonywany ponownie. Projekt ogólnego konta nie był zmieniany.
- Po pierwszym przejściu ze starej wersji 4.28 jej osierocona sesja nie ma jeszcze dowodu wznowienia: można użyć „Odzyskaj połączenie”. Kolejne odświeżenia tej samej karty są już obsługiwane automatycznie w obsługiwanej przeglądarce.

## Testy

- Typecheck, produkcyjny build i pełny harness/bootstraps: PASS. W tym **12** nowych scenariuszy cyklu połączenia oraz **22** testy chmury/bramki.
- **Rzeczywisty SQL**, `supabase/tests/multiplayer_resume.sql`: **16** kontroli — role, wznowienie, zachowanie własności, tylko skrót dowodu, spóźnione leave/heartbeat/poll, odmowa innemu urządzeniu i staremu API, świadome zastąpienie, unieważnienie starego dowodu, normalne wyjście i wygasła rezerwacja. Wszystkie fixture’y wycofane.
- **Produkcyjna przeglądarka**, `verify-multiplayer-lease-browser.mjs`: prawdziwy przypięty helper i Web Locks, symulowany backend. Potwierdzone odzyskanie starej sesji, anulowanie potwierdzenia bez przejęcia, odświeżenie po utraconym leave, świeża generacja, blokada zduplikowanej karty z identycznym dowodem i brak automatycznego przejęcia przez inne środowisko przeglądarki. Rzeczywisty silnik i transport zostają uruchomione; podczas otwierania dodatkowych kart zatrzymywany jest jedynie renderer headless WebGL, a polling i blokada pozostają aktywne.
- Regresje `verify-cloud-browser.mjs` oraz `verify-account-browser.mjs`: PASS — zapis/odtworzenie na drugim urządzeniu, konflikty i quota, zmiana konta, desktop/mobile, preview/file/obcy origin. Browser RPC są jawnie symulowane, nie są testem z kontami rzeczywistych ludzi.
- CI: `verify-cloud-live.mjs` sprawdza też rzeczywiste publiczne HTTP — odrzucenie anonimowego nowego RPC i anonimowego przejęcia, poza dotychczasowymi kontrolami autoryzacji. Nie wykonuje trwałych zapisów ani nie używa prawdziwych sesji.

Ograniczenia: zamknięcie procesu nie gwarantuje dostarczenia ostatniego żądania; wznowienie lub jawne odzyskanie zabezpiecza dostęp, ale nie obiecuje dostarczenia każdego ostatniego ruchu gracza. Nie jest to przebudowa symulacji multiplayer na autorytatywny serwer antycheat.
