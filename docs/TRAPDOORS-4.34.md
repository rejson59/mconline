# 4.34 — włazy z pamięcią kierunku i połowy

Kolejny krok w działającej grze po [cienkich płytach 4.33](PANELS-4.33.md). Ta porcja dodaje trwałe **4 kierunki × 2 połowy × otwarcie/zamknięcie**. Bez resetu światów i bez masowego przepisywania zapisów.

## Widoczna zmiana

- Kliknięcie podłogi stawia **zamknięty dolny** właz; kliknięcie spodu bloku — **zamknięty górny**, pod sufitem.
- Przy stawianiu na ścianie wysokość trafienia rozstrzyga połowę: do 0,5 włącznie dolna, powyżej 0,5 górna. Kierunek wynika z klikniętej ściany; na poziomej powierzchni z kierunku patrzenia.
- Otwieranie/zamykanie zachowuje oba parametry, także gdy gracz obejdzie blok lub kliknie inną krawędź. Zamknięcie nie zamienia już wszystkich włazów w ten sam nieukierunkowany blok.
- Dolna płyta ma y=0–3/16, górna y=13/16–1. Otwarty panel pozostaje gruby na 3/16 przy odpowiedniej krawędzi. Rendering, kolizja, promienie, zaznaczenie i pękanie używają tej samej bryły.
- Zniszczenie bloku obok lub pod włazem **nie niszczy włazu**. Drabiny, drzwi i pozostałe bloki wymagające podparcia zachowują własne reguły.
- Nadal jeden przedmiot w Creative i jeden kanoniczny drop/pick-block, również przy Jedwabnym dotyku. Stawianie nadal chroni ciała gracza/żywych mobów i działki; odmowa nie zużywa przedmiotu.

## Stare zapisy i nowe ID

Nie zmieniono znaczenia **68–72**: stara płyta zamknięta pozostaje górna, stare otwarte skrzydła pozostają w tych samych miejscach. Dopiero użycie danego starego włazu zapisuje nowy stan. Stare otwarte skrzydło przyjmuje górną połowę i zachowuje krawędź (odpowiada to wcześniejszej górnej płycie zamkniętej). Dla starego zamkniętego włazu kierunku nie da się odzyskać — pierwsze otwarcie ustala go z interakcji jak wcześniej, potem go pamięta.

Nowe ID **503–518** są dopisane bez przesuwania starych bloków/przedmiotów:

| Zakres | Stan | Kolejność |
|---|---|---|
| 503–506 | dolny zamknięty | N/E/S/W |
| 507–510 | górny zamknięty | N/E/S/W |
| 511–514 | dolny otwarty | N/E/S/W |
| 515–518 | górny otwarty | N/E/S/W |

**N/E/S/W w tym projekcie opisuje krawędź otwartego panelu**, przeciwną do właściwości Java `FACING`. Nie importujemy tych numerów jako surowych stanów Java. Tablice fizyki i renderingu są teraz wymiarowane według rejestru — stan 518 nie wypada poza dawną tablicę 512 elementów. Dane chunków pozostają 16-bitowe, format zapisu bez zmian.

## Multiplayer: bez resetu i bez poszerzania uprawnień

W obu RPC zapisu bloków był limit 511, więc sama zmiana klienta powodowałaby odrzucanie części nowych stanów. Addytywna migracja `202611070011_trapdoor_states.sql` zmienia **wyłącznie górną granicę ID na 518**, korzystając z istniejących definicji funkcji. Nie wgrywa starych wersji RPC; nie zmienia sprawdzania capabilities/działek, zamków, wersjonowania, członkostwa, RLS ani uprawnień. Nieznana postać walidacji przerywa całą transakcję; ponowne zastosowanie poprawnej migracji niczego nie zmienia.

Migracja **`trapdoor_states_434` wykonana** na bazie gry przed publikacją klienta. Odczyt metadanych po wykonaniu potwierdził w obu funkcjach: nowy limit obecny, stary usunięty, `SECURITY DEFINER` i `search_path` bez zmian, ACL nadal `{postgres=X/postgres,service_role=X/postgres}`, brak EXECUTE dla anon/authenticated. Nie wykonywano próbnych zapisów do prawdziwych światów graczy. Nie uruchamiano ponownie resetu 004 ani migracji 009/010. Backend archiwum i budżet pozostają bez zmian.

## Weryfikacja

- **114 nowych grup** `npm run test:traps`: wszystkie 16 stanów, niezależne oczekiwane bryły, dane tabel także >511, mesher synchroniczny/worker, szybki kontakt z obu stron, promienie, obrys/pękanie, wielokrotne prawdziwe `tryUse`, stawianie wszystkich kierunków/powierzchni i granicy 0,5, kanoniczny drop/paliwo/pick-block, chronione działki, usuwanie podparcia oraz stare/nowe zapisy na dodatnich i ujemnych granicach chunków.
- **83 kontrole PostgreSQL/PGlite**, z rzeczywistymi funkcjami działek i miasta: wszystkie nowe ID w obu writerach, odrzucenie cudzych zmian, chronione ulice/Nether, odrzucenie 519/ujemnych ID, stary stan, zachowanie ACL, idempotencja, wyłącznie zamierzona różnica w definicji i atomowe przerwanie przy nieznanym writerze. To lokalny test SQL, nie test prawdziwej zalogowanej sesji właściciela.
- Poprzednie **62 grupy paneli**, **79 płotów**, **45 ruchu** nadal PASS. Oczekiwania stawiania paneli z 4.33 zaktualizowano do nowych, jawnie zmienionych reguł; testy pięciu starych brył i zapisu nadal wymagają ich niezmienności.
- Pełne `npm test`, typecheck, build i diff check: PASS. Silnik **16 973 / 0 błędów**, UI **409 / 0**; audit **0 podatności**.
- Produkcyjny Chromium, świeży gość, desktop **960×600** i touch **390×844**: PASS, errors=[]; 16 nowych stanów, cztery stare skrzydła, 32 stany drzwi. Test uruchamia rzeczywisty ruch i **niepodmieniony promień oka + `tryUse`**: dolny właz 503 → otwarty 511 → zamknięty 503 oraz górny 507 umieszczony pod sufitem. To mobilny widok/emulacja dotyku, nie pomiar FPS fizycznego telefonu.

Komendy: `npm run test:traps`, `npm run test:traps:sql`, `npm run test:browser:traps`. Pierwsze dwie są także w standardowym `npm test`. Opcjonalne narzędzia przeglądarkowe jak w teście paneli, w ignorowanym `.cache/browser-tools`; zrzuty i raport w `.cache/verification434`. Minimalny wynik: [pokwitowanie](benchmarks/trapdoors-4.34.json).

## Podstawa porównania i pozostałe różnice

Pomocniczo sprawdzono `TrapDoorBlock.java` w przypiętym **historycznym** mirrorze `mahtomedi/minecraft`, commit `6ac5fe18be48a7395be84148be051908111d6772` (**1.20.3-pre1**): grubość 3/16, połowy, otwarte krawędzie przeciwne `FACING`, stawianie według normalnej/wysokości i zachowanie właściwości przy przełączeniu. Hash i pochodzenie w pokwitowaniu. Surowe źródło tylko w ignorowanym cache; nie w bundlu ani Git.

To nie dowód kompletnej zgodności z Java 26.3 ani porównanie z uruchomionym oryginalnym klientem. Nie dodano `powered`, waterlogging ani innych rodzin włazów; nie poprawiano obrotów/odbicia tekstur i UV zależnych od połowy/kierunku. Generatory nadal mogą tworzyć stare ID, aby nie zmieniać istniejących struktur. Konta, CAS/dzienniki ekwipunku, sesje, chmura i zasady publicznego survival/Creative pozostają poza zmianą tej porcji.
