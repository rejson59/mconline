# 4.28 — światy na koncie i nowy start

Data: 5.11.2026. Zatwierdzony zakres: nowe publiczne serwery i nowa biblioteka kontowa, **bez kasowania starych zapisów urządzeń**. Opis 4.27 dotyczy poprzedniej, wyłącznie prezentacyjnej integracji konta.

## Dla gracza

- Konto jest opcjonalne dla singleplayera. Gość korzysta z dotychczasowej biblioteki urządzenia, również offline.
- Po zalogowaniu otwiera się **osobna biblioteka konta**. Światy zapisują się automatycznie przez istniejący zapis silnika (co 30 sekund, przy pauzie, wyjściu i zdarzeniach cyklu strony). Zapisywane są m.in. zmiany bloków obu wymiarów, ekwipunek, pozycja, zdrowie, kontenery, piece, postępy i metadane świata.
- Przed przejściem na inne urządzenie wróć do menu i **poczekaj na potwierdzenie zapisu na koncie**. Zamknięcie procesu przeglądarki nie gwarantuje dostarczenia ostatniego żądania HTTP; kolejka i kopia lokalna pozwalają ponowić zapis po powrocie.
- Login nie kopiuje ani nie usuwa dawnych światów lokalnych. Są dostępne po „Rozłącz ten projekt”. Eksport pliku, ponowne połączenie i import to świadome utworzenie kopii na koncie.
- Multiplayer wymaga konta i internetu. Dostępne są dwa autoryzowane serwery: publiczny survival i wspólne miasto Creative z chronionymi ulicami. Dawne niezabezpieczone pokoje BroadcastChannel/WebRTC nie są już dostępne w interfejsie.
- Profil, identyfikator gracza i własność nowych działek są przypisane do konta. Jedno konto ma jedną aktywną sesję multiplayer; po utracie połączenia rezerwacja wygasa po maks. minucie.

## Własność i autoryzacja

Sesja ogólnego konta jest **nieprzezroczystym tokenem, nie JWT Supabase Auth**. Nazwa z localStorage, nick, podany PID ani dawny klucz działek nie stanowią autoryzacji konta.

### Singleplayer — projekt konta `hzbqzfimtroixnldzjeq`

Nowe `mconline_identity` sprawdza ten sam skrót tokena co oficjalny `community_whoami`, łączy sesję ze stabilnym UUID użytkownika i odrzuca brak/unieważnienie sesji. Nie zmienia istniejącej funkcji ani schematu kont. Nowy FK biblioteki ma ON DELETE CASCADE, żeby nie blokować dotychczasowego usuwania ogólnego konta. `mconline_worlds_op` sprawdza token **przy każdej operacji** i wymusza `owner = zweryfikowany UUID` wewnątrz SECURITY DEFINER. Bez bezpośredniego dostępu anon/authenticated do tabeli.

Operacje konta są serializowane blokadą transakcyjną. Zapis i usunięcie wymagają oczekiwanej rewizji (CAS). Rewizja pochodzi z prywatnej sekwencji: usunięcie i ponowne utworzenie tego samego UUID nie dopuszcza ataku/wyścigu ABA. Limit: 8 światów, 8 MiB JSON na świat, 32 MiB JSON na konto.

### Multiplayer — projekt świata `bewwejewgqzctnjrbclu`

Edge Function `mconline-gateway` weryfikuje token w projekcie konta przy **każdym żądaniu**. Dopiero potem wewnętrznie używa wbudowanego service role projektu świata. Sekret nie jest pobierany do repozytorium/przeglądarki. Bramkę opublikowano z `verify_jwt=false`, ponieważ sama sprawdza rzeczywistą sesję strony — nie zastępuje jej publicznym anon JWT.

Bramka ma zamkniętą listę tabel, pól i RPC. Świat, PID, nick i klucz działek są wybierane po stronie serwera; klient nie może podać tożsamości innej osoby. Zegar klienta nie ustawia czasu profilu. SQL wymusza dotychczasową ochronę działek, ulic, dropów i edycji. Odczyt profilu jest ograniczony do własnego PID. Uprawnienia anon/authenticated/PUBLIC do dawnych tabel i RPC zostały odebrane.

Zamiast publicznego Realtime używany jest autoryzowany inbox/polling. Roster i wiadomości są dostępne wyłącznie przez bramkę. SQL nadpisuje nadawcę/nick, deduplikuje próby HTTP po identyfikatorze wiadomości, stronicuje po ostatniej zwróconej rewizji i usuwa wiadomości starsze niż dwie minuty. Kilka kolejnych błędów zamyka oficjalną sesję gry. **Polling ma większe opóźnienie niż poprzedni Realtime; nie wykonano testu dużej liczby graczy.**

## Klient i odzyskiwanie

Token jest utrzymywany tylko w prywatnym transporcie pamięciowym. Nie trafia do React state, światów, eksportów, nowych kluczy storage, URL, logów ani postMessage. Nadal obowiązuje dokładny origin `https://rejson59.github.io`. Podgląd i lokalny HTML mają tylko tryb gościa; nie zbudowano cross-domain SSO. Projekty współdzielące origin nie są wzajemnie izolowanymi sandboxami.

Biblioteka konta ma oddzielny klucz `mconline-worlds-20261105:<UUID>`. Identyfikator świata zawiera właściciela; dodatkowe przypięcie celu zapisu chroni też późny cleanup świata gościa po zmianie konta. Zdarzenie zmiany sesji zatrzymuje poprzedni transport i grę przed podpięciem nowej biblioteki. Odpowiedzi starej sesji nie mogą zostać zastosowane do nowej.

Dziennik rewizji i zamiarów zapisu/usunięcia jest zapisywany przed lokalnym snapshotem. Wysyłanie jest kolejkowane. Brak potwierdzenia nie oznacza sukcesu. Przy konflikcie chmura nie jest nadpisywana, a lokalny snapshot pozostaje. Menu pozwala pobrać kopię i wczytać chmurę; dodatkowa kopia konfliktu zostaje na urządzeniu. Ręczny import do innego konta tworzy nowe UUID zamiast przenosić właściciela. Import kontowy nie usuwa starych światów, by zrobić miejsce.

**Ograniczenia:** lokalny cache jest nadal w localStorage; limity/quota przeglądarki mogą być niższe od limitu serwera. Nie oferujemy bezgłośnego rozwiązywania konfliktów, blokady edycji singleplayera na dwóch urządzeniach, scalania zmian ani gwarancji dostarczenia żądania przy zabiciu procesu. Do wczytania biblioteki kontowej i rozpoczęcia jej gry potrzebna jest sieć. Kopia konta nie jest automatycznie przełączana na bibliotekę gościa przy awarii. Gość może grać offline po świadomym rozłączeniu projektu. Multiplayer jest nadal grą symulowaną po stronie klientów, nie pełnym serwerem antycheat.

## Wykonany reset i migracje

- Konto: nowe `mconline_worlds` i prywatna sekwencja. Nowa biblioteka potwierdzona pusta. Nie kasowano kont, sesji użytkowników, danych społecznościowych ani innych projektów.
- Świat: usunięto aktywne `public`/`city` z blocks, players, plots i drops. Odczyt po resecie: **0/0/0/0**. Ziarna terenu pozostają takie same; nowy start dotyczy budowli, ekwipunku, postępu i własności. Dawna archiwalna tabela nie jest udostępniana klientom.
- Pliki `202611050001`, `003` i `005` są dla projektu konta; `002` i `004` dla projektu świata. **Nie uruchamiać wszystkich migracji na jednej bazie. `004` jest destrukcyjnym, jednorazowym przełączeniem.**
- Odpowiedniki wdrożone: `mconline_account_worlds_v1`, `mconline_world_revision_aba`, `mconline_account_multiplayer_v1`, `mconline_authenticated_cutover_reset_20261105`, `mconline_world_account_deletion`; Edge `mconline-gateway` v1 ACTIVE.

## Weryfikacja

1. Typecheck, build, pełny harness i bootstrap: **25 386 kontroli PASS**; nowa `.harness/cloud.ts` obejmuje dwa urządzenia, CAS, awarię sieci, izolację kont, późny zapis, kopię/import/usunięcie oraz zamkniętą autoryzowaną bramkę. Testy wcześniejszych transportów w bibliotece protokołu pozostają, ale interfejs nie uruchamia już tych transportów.
2. `verify-cloud-browser.mjs`: produkcyjny HTML i rzeczywisty przypięty helper, dwa izolowane konteksty (desktop/mobile), **symulowany** RPC. Rzeczywisty silnik zapisuje blok i ekwipunek, drugie urządzenie je odtwarza; konflikt offline zachowuje lokalny postęp, pełna pamięć przeglądarki daje jawne ostrzeżenie i można ponowić zapis, zmiana konta zamyka grę, stare lokalne światy pozostają. Silniki uruchamiane kolejno, żeby nie przeciążyć headless WebGL.
3. Dotychczasowe `verify-account-browser.mjs`: desktop/mobile oraz preview/file/other-origin, prawdziwy helper z symulowanymi odpowiedziami konta. Dodatkowe RPC świata są jawnie mockowane.
4. **Rzeczywisty SQL:** `supabase/tests/account_worlds.sql` i `account_multiplayer.sql` — stabilny UUID, izolacja, nieważna/unieważniona sesja, CAS i ABA, prywatne ACL, sesja urządzenia, podpis nadawcy, deduplikacja, stronicowanie 512+1, wygaśnięcie. Syntetyczne fixture’y są w całości wycofywane; nie odczytywano rzeczywistych tokenów ani prywatnych światów użytkowników.
5. `verify-cloud-live.mjs` w CI wykonuje niemutujące żądania publicznego HTTP do wdrożonych usług: anon, błędny token, dawny klucz działek, prywatne mapowanie, zły origin i poprawny preflight. Bez prawdziwych sesji i bez sekretów w Actions.

Nie deklarujemy testu z dwoma prawdziwymi kontami ludzi na dwóch fizycznych urządzeniach. Testy przeglądarkowe symulują backend; niezależne rzeczywiste SQL/HTTP sprawdzają wdrożoną autoryzację.
