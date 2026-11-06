# Wspólne moby i skrzynie — 4.29.0 (2026-11-06)

Kontynuacja [audytu ośmiu zgłoszeń z 4.28.3](REPORTS-4.28.3.md). W tej wersji domknięto implementację dwóch pozostałych problemów multiplayer i ponowiono regresję wcześniejszych poprawek. Nie jest to deklaracja pełnej zgodności z Minecraft Java 1:1 ani gwarancja działania na każdym urządzeniu.

## Status zgłoszeń

| Zgłoszenie | Poprawka | Wydanie |
|---|---|---|
| `d4a70a24-a384-41f6-97ba-20106b2d6ad1` | Ochrona tekstu/emoji interfejsu przed zaznaczaniem długim dotykiem; pola tekstowe nadal edytowalne. | 4.28.3, regresja w 4.29.0 |
| `d76904c8-dd7f-4c94-a5bf-2efc68c62883` | Mniejsze i różnorodne domy, skrzynie w części domów/zawodów zamiast w każdym budynku. | 4.28.3, regresja w 4.29.0 |
| `3dd85ebf-ae02-4ff5-bb84-fb44975cef67` | Światło pochodni innych graczy w obu rękach; do czterech najbliższych źródeł. | 4.28.3, regresja w 4.29.0 |
| `b78edd30-715b-44f6-9a81-aa493a17c68f` | Piasek/żwir wypada na pochodni, także postawionej podczas spadania. | 4.28.3, regresja w 4.29.0 |
| `bba3c4b2-d042-42a4-a735-663db298cf42` | Jedna kanoniczna populacja mobów, wspólne pozycje, AI, HP, śmierć, interakcje i łupy. | **4.29.0** |
| `53b37728-38f2-4501-8c28-50c4f018b749` | Miód oddaje pustą butelkę; pełny plecak/druga ręka/creative uwzględnione. | 4.28.3, regresja w 4.29.0 |
| `ff2b8d77-b8e7-419f-ba5c-18fd29738aa2` | Trwała zwykła skrzynia i atomowe przenoszenie rzeczy między nią a profilem/kursorem. | **4.29.0** |
| `17e01851-7b74-47f4-b54b-31c5ccf65edf` | Dwie sekundy ochrony wyrzuconego przedmiotu przed własnym przyciąganiem/podniesieniem. | 4.28.3, regresja w 4.29.0 |

## Skrzynie: trwałość zamiast rozsyłania prywatnych kopii

- Klucz serwera: świat, wymiar i współrzędne. Zawartość oraz rewizja są wspólne dla wszystkich uprawnionych graczy.
- Transakcja obejmuje sloty skrzyni, ekwipunek, kursor, wersję profilu i ewentualne dropy. Konflikt rewizji nie przenosi stosu drugi raz. Pozostają zabezpieczenia checkpointu profilu i generacji sesji.
- Dotyczy także shift/drag, skrótów klawiatury, wyrzucania oraz kopania. Niszczenie opróżnia skrzynię i publikuje jej zawartość razem z usunięciem bloku; wybuch nie może ponownie rozsypać tego samego rekordu.
- Operacja jest zapisywana **przed wysłaniem** w `mconline-container-v1:<world>:<pid>`. Transport wysyła trwały snapshot, nie referencje do zmienianych slotów. Utracony ACK/wyjątek transportu uruchamia odtworzenie tego samego ID z rozstrzygnięciem commit/cancel, a nie zwykły upload starego plecaka.
- Wyjście podczas niepewnego wyniku zachowuje dziennik i nie nadpisuje profilu sprzed transferu. Uszkodzony lub nieobsługiwany dziennik blokuje operację bez usuwania dowodów. Awaria zapisu lokalnego zatrzymuje wysłanie.
- Podczas oczekiwania blokowane są konkurencyjne zmiany slotów, narzędzia/hotbara, pancerza, craftingu i innych ekranów ekwipunku. Nadal można przejść do pauzy/menu.
- Ender chest pozostaje prywatny. Piece, kowadła i statywy alchemiczne **nie zostały zamienione we wspólne kontenery**.

### Starsze zawartości

Nie wykonano resetu ani masowego kasowania lokalnych lub kontowych danych. Przed zastąpieniem starej lokalnej skrzyni powstaje kopia `mconline-chest-legacy:…`. Serwer archiwizuje oryginał przy pierwszym imporcie danej współrzędnej przez konto. Import jest jednorazowy i całościowy: gdy brakuje wolnych slotów, archiwum pozostaje do ponowienia po zwolnieniu miejsca.

Historyczne prywatne kopie różnych graczy mogą zawierać te same rzeczy — import zachowuje te kopie, nie próbuje odgadywać ich wspólnej historii. Różne historyczne kopie **tego samego konta** na dwóch urządzeniach nie są automatycznie scalane: pierwszy zapis jest archiwum serwera, pozostałe lokalne kopie pozostają zabezpieczone. To nie mechanizm arbitralnego łączenia wszystkich starych plecaków/skrzyni ani obietnica odzyskania danych utraconych przed tym wydaniem.

## Moby: jedna symulacja z przejęciem

- Regiony 128 × 128, osobno dla świata i wymiaru. Stabilne ID encji, rewizja snapshotu, właściciel symulacji oraz epoka dzierżawy.
- Jeden aktywny klient koordynuje AI regionu; dzierżawa trwa 5 s, aktywność widzów 3 s. Inni odbierają stan, zamiast losować własne populacje. Odpytywanie zwykle co 350 ms, nie synchronizacja klatka w klatkę.
- Przejęcie po wyjściu koordynatora zachowuje ID, HP, położenie, prędkość, stan AI, oswojenie, wełnę i handel. Stary właściciel/epoka lub nieaktualna rewizja nie zatwierdzają spóźnionych zmian.
- Obrażenia, śmierć, loot/XP, strzyżenie, oswajanie, karmienie/rozmnażanie i handel korzystają z tego samego stanu. Dropy/XP mają jednorazowe identyfikatory i istniejący protokół odbioru.
- Uzbrojone TNT jest wspólną encją, nie oddzielnym prywatnym timerem na każdym ekranie. Edyty terenu, zawartość niszczonej skrzyni i łupy są zatwierdzane z symulacją. Większe paczki korzystają z porcji do 300 edytów istniejącego writer'a.
- Prywatne cache pieców/kowadeł/statywów zmienione przez spekulacyjny wybuch są czasowo niedostępne. Odrzucona epoka przywraca je; potwierdzony teren usuwa zniszczone cache. Nie publikuje się łupu z odrzuconej symulacji.
- Zachowano ochronę cudzych działek i ulic; wybuchy nie niszczą miasta.

**Granica architektury:** to koordynowane przez klientów AI z arbitrażem SQL/CAS, nie pełny dedykowany serwer symulacji Minecraft ani kompletny system anty-cheat. Bez aktywnego klienta region nie prowadzi ciągłej symulacji. Opóźnienia i przejęcie dzierżawy mogą chwilowo zatrzymać lub skorygować animację.

## Bezpieczeństwo i backend

Migracje `202611060009_shared_chests.sql` oraz `202611060010_shared_mobs.sql` zostały zastosowane w produkcyjnym projekcie gry jako `mconline_shared_chests` i `mconline_shared_mobs`. Bramka `mconline-gateway` ma wdrożoną wersję 4 z whitelistą nowych operacji. **Nie stosować ponownie resetu 004.**

Nowe tabele/RPC pozostają prywatne: `anon` i `authenticated` nie mogą samodzielnie czytać ani zatwierdzać stanu. Bramka weryfikuje konto ogólne i wiąże UUID, nazwę, świat i sesję po stronie serwera. Token konta nie jest traktowany jak JWT. Nie zmieniono zaufanego originu logowania ani danych kont/pozostałych projektów.

## Weryfikacja

| Warstwa | Wynik i zakres |
|---|---|
| TypeScript / pełny `npm test` / build | **PASS; 25 503 sprawdzenia** pełnego zestawu, w tym 15 model/dziennik/transport, 17 SQL skrzyń, 22 SQL mobów i 4 testy bootstrapów. |
| Rzeczywisty produkcyjny PostgreSQL | **40 PASS, fixture'y wycofane przez ROLLBACK**: `supabase/tests/shared_state.sql` (30) oraz `shared_world_effects.sql` (10). |
| Dwa izolowane renderery Chromium | **27 PASS**, rzeczywisty silnik `Game` i `PublicServer`, desktop oraz emulowany mobile, SQL na PGlite. **Syntetyczne tożsamości i stuby członkostwa**, nie sesje prawdziwych użytkowników. |
| Regresja sześciu wcześniejszych poprawek | Desktop i emulowany mobile **PASS**, brak błędów strony; odczyt pikseli potwierdza światło pochodni obu rąk. |
| Regresja lokalnej gry | Desktop/mobile/file **PASS**: crafting, powrót kursora, drop, save/reload. |
| Zależności produkcyjne | `npm audit --omit=dev`: **0 podatności**; nie jest to deklaracja czystego audytu wszystkich narzędzi deweloperskich. |

Rzeczywiste SQL obejmuje członkostwo, prywatne uprawnienia, CAS profilu i kontenera, ponowienia, konkurencyjny dostęp do ostatniego stosu, archiwum/import, HP/śmierć/łup, przejęcie dzierżawy, zastąpienie sesji, writer 301 edytów, mining zawartość + blok, jednorazowe rozsypanie przy wybuchu oraz własną/obcą działkę i ulicę. Użyto generowanych UUID fixture'ów, nie loginów ludzi. Transakcje nie pozostawiły danych testowych ani zmian świata.

Test przeglądarkowy dodatkowo obejmuje utracony ACK po commit, ponowne wejście, kanoniczne ID/ruch/HP dwóch rendererów, strzyżenie, wspólne TNT, kopanie i wybuch zwykłej skrzyni oraz cache prywatnego pieca przy odrzuconej i zaakceptowanej epoce AI. Podczas opóźnionego transferu sprawdza również brak zmiany wybranego slotu przez klawiaturę. Wyjątek lokalnego callbacku przed wysłaniem zwalnia preflight, ale nie usuwa niepewnego dziennika; wyjście podczas preflight nie wykonuje starego callbacku ani nie tworzy spóźnionej transakcji.

Publiczne HTTP: `scripts/verify-cloud-live.mjs` zawiera **18** niemutujących kontroli uprawnień wdrożonego backendu, w tym trzy nowe prywatne RPC; uruchamia je CI. Próba lokalna zatrzymała się na ograniczeniu sieci sandboxa (`ECONNRESET` przed TLS), więc **nie zaliczamy jej jako lokalnego PASS**. Wynik tego etapu trzeba sprawdzić w kontrolach PR/main.

Nie przeprowadzono testu dwóch fizycznych urządzeń zalogowanych prawdziwymi kontami, fizycznego Androida/iPhone'a ani Safari. Emulacja dotyku nie zastępuje takich testów. Wioski zostały poprawione, ale nie są wierną implementacją wszystkich struktur Java.

### Powtarzanie testów

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run test:cloud:live # wymaga dostępu HTTPS do produkcyjnego backendu
# Narzędzia przeglądarkowe, poza artefaktami Git:
npm install --prefix .cache/browser-tools puppeteer-core @sparticuz/chromium
npm run test:browser:shared
npm run test:browser:reports
# W drugim terminalu: npm run preview -- --host 0.0.0.0 --port 4173
node scripts/verify-native-browser.mjs
```

Oba skrypty SQL wykonywać jako pojedyncze transakcje z końcowym `ROLLBACK`, nie wycinać instrukcji przygotowujących fixture'y ani wycofania. Nie uruchamiać resetu 004 ani ponownie już zastosowanych migracji.

Skrócone wyniki: [benchmarks/shared-state-4.29.json](benchmarks/shared-state-4.29.json). Screenshoty, bundle testowy i szczegółowe logi pozostają lokalnymi artefaktami `.cache/`, nie danymi użytkowników w Git.

## Po wdrożeniu

Odświeżyć grę na **obu** urządzeniach/kartach. Stara otwarta karta nadal wykonuje poprzedni kod, nawet jeśli backend i GitHub Pages są już zaktualizowane. Nie czyścić localStorage ani zapisów konta jako sposobu aktualizacji.
