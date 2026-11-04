# Ogólne konto rejson59.github.io w projektach

**Dla agentów:** konto rejson59.github.io jest ogólnym kontem strony i podłączonych projektów, nie kontem wyłącznie RejChat ani „kontem społecznościowym”. Identyfikatory techniczne `community_*` są historyczne i nie należy ich zmieniać ani usuwać. Zanim dodasz logowanie w osobnym projekcie, przeczytaj ten dokument w całości i sprawdź origin, sposób zapisu danych oraz faktyczne zabezpieczenia jego backendu. Nie przenoś ani nie nadpisuj istniejących kont i danych bez uzgodnienia. Wprowadzaj zmiany w projekcie dopiero po wymaganym zatwierdzeniu właściciela.

Działającą **demonstrację na tym samym originie** znajdziesz na `https://rejson59.github.io/konto-demo`: przycisk sprawdza aktualną sesję, a gdy jej nie ma — otwiera logowanie i po nim wraca do przykładu. Implementacja: `konto-demo.html`, `js/konto-demo.js`, `js/rejson-account.js`. To nie jest gotowy dostawca OAuth/OIDC; sama demonstracja nie podłącza żadnego innego projektu.

## Przepis dla agenta: projekt na tym samym originie

1. Potwierdź, że projekt ma dokładnie `https://rejson59.github.io` (identyczny protokół, host i port), ma własny sposób autoryzacji danych oraz obsługuje CSP dla skryptu z tej strony i połączenia z Supabase. GitHub Pages pod `/NazwaProjektu/` jest tym samym originem; inna domena albo subdomena nim nie jest.
2. Dołącz jawnie `<script defer src="/js/rejson-account.js?v=1"></script>` przed skryptem projektu; nie polegaj na wstrzykiwaniu przez service workera. Umieść w projekcie przycisk **„Zaloguj się przez rejson59.github.io”**. Dodaj stany: oczekiwanie, potwierdzone konto, brak sesji, błąd sieci i świadome rozłączenie projektu.
3. Po kliknięciu `await RejsonAccount.getSession()`. Jeśli zwróci sesję, użyj **potwierdzonej** nazwy do UI i zaloguj projekt zgodnie z jego własną autoryzacją. Jeśli zwróci `null`, zachowaj tylko znacznik zamiaru w `sessionStorage` (bez tokenu), wywołaj `RejsonAccount.open()`. Po powrocie sprawdź znacznik i ponownie `getSession()`; nie zakładaj, że samo kliknięcie oznacza sukces. Promise może się nie powieść z powodu sieci — pokaż błąd i możliwość ponowienia.
4. Nasłuchuj `RejsonAccount.subscribe(...)` i ponownie weryfikuj sesję przy zmianie konta lub wylogowaniu. Czyść stan i dane poprzedniego użytkownika; zabezpiecz się przed opóźnionymi odpowiedziami poprzedniej sesji. Wylogowanie z projektu i ze strony nie musi znaczyć tego samego — wyraźnie to opisz.
5. Każdy odczyt/zapis prywatnych danych **musi** być autoryzowany po stronie serwera na podstawie zweryfikowanej sesji i właściciela. Sama nazwa, przełącznik UI, `localStorage` lub `user_id` wysłane przez klienta nie są dowodem tożsamości. Nie przechowuj tokenów w URL, historii, logach, raportach ani `postMessage`; nie udostępniaj surowego tokenu przypadkowym aplikacjom. Dołącz testy logowania, powrotu, wylogowania, zmiany konta, braku sieci i izolacji danych.
6. Sama sesja nie synchronizuje danych projektu. Zaprojektuj i wdroż oddzielnie zapis po stronie serwera, migrację dotychczasowych danych i testy prywatności. Nie obiecuj synchronizacji, zanim projekt jej rzeczywiście nie ma.

### Inna domena / przyszłe logowanie jak Google

Istniejące `localStorage` jest ograniczone do originu, więc skrypt z tej strony nie zaloguje projektu na innej domenie. **Nie obchodzić tego** przekazywaniem tokenu w URL, iframe ani `postMessage`. Prawdziwe logowanie między domenami wymaga osobnego, zatwierdzonego projektu dostawcy tożsamości, np. OAuth 2.0/OIDC Authorization Code z PKCE: rejestracji i dokładnej listy dozwolonych adresów powrotu, `state`, `nonce`, jednorazowych krótkotrwałych kodów, bezpiecznej wymiany i weryfikacji tożsamości po stronie odbiorcy, cofania dostępu oraz testów bezpieczeństwa. Nie twierdź, że te elementy już istnieją, i nie buduj improwizowanego SSO z obecnego tokenu sesji.


Aktualnie używamy tego samego backendu Supabase i tej samej sesji `rejson_community_session_v1`, których używają strona główna, RejChat i RejStream. **Nie jest to nowy dostawca SSO** ani logowanie między domenami. Istniejące konta mogą używać starszego czterocyfrowego PIN-u lub ustawić hasło; nowe formularze strony głównej obsługują hasła. Backend ogranicza próby logowania na konto, ale może to też umożliwiać czasową blokadę konta i nie chroni przed spamem rejestracji. Rzeczywiste odpowiedzi HTTP PostgREST nie zostały jeszcze osobno potwierdzone. Nie ma automatycznego odzyskiwania zapomnianego hasła.

## Dla odwiedzającego

Na obsługiwanej stronie projektu rozwiń pigułkę feedbacku i wybierz **Konto**. Ekran logowania po udanym zalogowaniu wraca do projektu w tej samej karcie. Adres powrotu przechowywany jest tymczasowo w `sessionStorage`, nie są przekazywane tokeny w URL. Zalogowanie w projekcie i na stronie głównej dotyczy tej samej sesji tylko przy dokładnie tym samym originie (protokół, domena i port).

Wspólny service worker strony może dodać widżet i `js/rejson-account.js` do dokumentów projektów pod `https://rejson59.github.io/<projekt>/`. To nie działa niezawodnie przy pierwszym bezpośrednim wejściu bez zainstalowanego workera, gdy inny worker obsługuje dany projekt, dla stron na Vercel/innych domenach albo gdy CSP lub inne ustawienia projektu blokują skrypty. Dla niezawodności twórca projektu powinien dołączyć poniższy skrypt w samym projekcie. Odmienne domeny mają osobne `localStorage`, a osadzenie zdalnego skryptu nie daje im wspólnej sesji. Nie wysyłaj tam tokenu w adresie, QR ani `postMessage`.

## Integracja projektu

W HTML projektu na tym samym originie (i z CSP pozwalającą na skrypt oraz połączenie z Supabase):

```html
<script src="/js/rejson-account.js?v=1" defer></script>
```

Skrypt dostępny jako `window.RejsonAccount`:

```js
// Weryfikuje token w community_whoami, nie ufa nazwie z localStorage.
// null = brak lub nieważna sesja; odrzucenie Promise = sieć/serwer niedostępne.
const session = await window.RejsonAccount.getSession();
if (session) console.log('Zalogowano jako', session.username);

// Zaloguj się / zarządzaj kontem i wróć do bieżącej strony tej samej karty.
window.RejsonAccount.open();

// Wywoływane dla zdarzenia rj:session-change oraz zmian z innej karty.
const unsubscribe = window.RejsonAccount.subscribe(() => { /* ponownie sprawdź getSession() */ });
```

Kod, który zmienia sesję w tej samej karcie, powinien dodatkowo wysłać `window.dispatchEvent(new Event("rj:session-change"))`; przeglądarka nie wysyła `storage` do tej samej karty. Starsze aplikacje, które tego nie robią, mogą wymagać ponownego `getSession()`.

`session.token` jest obecnym tokenem ogólnego konta do RPC wymagających sesji, a nie nowym tokenem OAuth. Nie zapisuj go w URL, logach, zgłoszeniach ani publicznych profilach. Każdy backend musi sam potwierdzić uprawnienia tokenu; sama nazwa lub UI nie jest autoryzacją. Skrypty współdzielące origin mogą odczytywać tę samą pamięć, dlatego projekty na wspólnym originie **nie są wzajemnie odizolowane**.

Wstrzykiwany skrypt jest `defer`; projekt uruchamiany wcześniej może nasłuchiwać `rj:account-ready` lub sam dołączyć skrypt przed swoim kodem. Integracja sesji nie dodaje automatycznie zapisu danych do aplikacji. Szczególnie ProStudent ma dane lokalne i ich synchronizacja wymaga osobnego projektu i zgody użytkownika.

## Rakieta podczas ładowania projektu

Karty prowadzą bezpośrednio na stronę projektu w nowej karcie. Dla stron tego samego originu kliknięcie może przekazać do nowej karty jednorazowy znacznik `rj_rocket_overlay_v2` bez tokenu konta. Globalny worker wstrzykuje na zgodnych dokumentach arkusz i skrypt nakładki po meta CSP, przed skryptami projektu. Lot trwa około 4,2 s widocznej karty, po czym nakładka pozostaje aż do zdarzenia `load` dokumentu. Przy bardzo długim oczekiwaniu można pominąć nakładkę przyciskiem. Zdarzenie `load` nie obejmuje wszystkich późniejszych zadań asynchronicznych aplikacji. Jest przycisk pominięcia i ograniczenia ruchu. Dawne linki `/podroz/` i `/portal/` przekierowują do docelowego projektu.

To rozwiązanie nie wymaga zmiany projektu, ale **nie jest gwarantowane wszędzie**: projekt z osobnym service workerem o węższym zakresie, blokująca polityka CSP, brak service workera lub projekt na obcym originie mogą uniemożliwić wstrzyknięcie. W takich przypadkach projekt otwiera się bezpośrednio bez nakładki. Nie zastępuj projektowego service workera: może obsługiwać offline/PWA. Przed otrzymaniem pierwszej odpowiedzi sieciowej docelowego dokumentu przeglądarka nie może jeszcze wyświetlić nakładki na tym dokumencie.

Jeśli projekt na wspólnej domenie wymaga jawnego bootstrapa, może umieścić w `<head>` po ewentualnym meta CSP, przed skryptami blokującymi:

```html
<link rel="stylesheet" href="/css/portal.css?v=17" data-rj-portal-style>
<script src="/js/portal-arrival.js?v=16"></script>
```

Nazwy ścieżek pozostają dla zgodności. Bez poprawnego znacznika skrypt nic nie wyświetla; obcy origin nie ma dostępu do pamięci sesji strony głównej.
