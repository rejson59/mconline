# Transfer części i wznawianie — rdzeń protokołu

2026-11-07. Następna porcja [planu wykonania](MINECRAFT-IMPLEMENTATION-PLAN.md), po plannerze korpusu. Kod: `scripts/reference-transfer.mjs`, testy: `scripts/reference-transfer.test.mjs`.

**Wykonano:** koordynator transferu, sprawdzane binarne rekordy części, źródło ograniczonych zakresów HTTPS i lokalny adapter plików. **Aktualizacja kolejnej porcji:** [backend OIDC i adapter chmurowy](REFERENCE-ARCHIVE-BACKEND.md) są już w kodzie i wdrożeniu z zapisem zablokowanym. Nadal nie wykonano rzeczywistego transferu oryginałów do chmury, kopii niezależnej i porównań mechanik. Nie zmieniono runtime'u gry, istniejących funkcji probe, ról ani polityk Storage. Nie trzeba powtarzać testu 79 B.

## Zaufanie i autoryzacja

`createTransfer(plan, options)` przyjmuje zatwierdzony plan z `buildCorpus` i robi prywatną migawkę rozmiarów/hashów obiektów. `validatePlan`, udostępniony z modułu korpusu, sprawdza spójność dokumentu. **Hash planu nie jest podpisem i nie jest autoryzacją.** To lokalna biblioteka, nie gotowy endpoint HTTP.

Przyszły backend musi sam ustalać zatwierdzony plan z przypiętych oryginalnych metadanych i weryfikować ścisłą tożsamość OIDC. Nie wolno przyjmować planu, bucketu, dowolnej ścieżki lub URL od wywołującego i uznawać ich za uprawnienie. Ta porcja nie rozszerza istniejącej tożsamości probe o możliwość zapisu. Nie ma klucza service-role w kodzie klienta, Actions ani przykładach.

## Części i ich klucze

Domyślna część: **4 MiB**, plus maksymalnie 1032 B nagłówka. Cały rekord pozostaje poniżej istniejącego limitu obiektu Storage 10 MiB. Parametr `partBytes` jest częścią przestrzeni nazw, a liczba części jednego obiektu jest ograniczona do 4096. Plan zachowuje wcześniejsze limity rozmiarów i łącznego budżetu — nie oznaczają one dostępnej lub opłaconej pojemności chmury.

```text
archive-parts/v1/<plan-sha256>/<transfer-id>/<object-sha1>/<partBytes>/parts/000000.bin
archive-parts/v1/<plan-sha256>/<transfer-id>/<object-sha1>/<partBytes>/complete.json
```

`transfer-id` to niebędący sekretem losowy identyfikator próby, 32 małe znaki hex. Aby wznowić, trzeba zachować ten sam plan, identyfikator i rozmiar części. Nowa próba nie kasuje wcześniejszej. Nieznany obiekt jest odrzucany przed I/O. Klucze konstruuje protokół, nie nazwy plików pobrane z manifestu.

Rekord binarny:

1. 4 bajty magic `MCRP`;
2. 4 bajty długości nagłówka JSON, unsigned big-endian;
3. maksymalnie 1024 B kanonicznego JSON: wersja, hash planu, ID próby, hash/rozmiar obiektu, rozmiar części, indeks, faktyczna długość i SHA-256 części;
4. surowe bajty części, bez base64 i bez kompresji.

Odczyt ponownie oblicza checksum i porównuje cały kanoniczny rekord z oczekiwanym powiązaniem. Zmiana nagłówka, payloadu, indeksu, obiektu, próby, planu lub rozmiaru części nie może zostać uznana za wznowioną część. SHA-256 części potwierdza jej spójność, ale **nie zastępuje sprawdzenia całego oficjalnego SHA-1**.

## Przebieg i ukończenie

1. Sprawdź istniejące pokwitowanie, ale nie ufaj jego polom jako dowodowi odczytu.
2. Dla każdego indeksu odczytaj zapisany rekord w ograniczonym rozmiarze. Jeżeli istnieje, zweryfikuj bajty i powiązanie, zamiast pobierać część ponownie.
3. Dla brakującej części poproś źródło o dokładny zakres. Ucięty, za długi lub niebinarny strumień nie staje się częścią. Wyjście z iteratora zamyka źródło; źródła mają honorować sygnał anulowania.
4. Zapisz kompletny rekord przez atomowe `create` bez upsertu. Odczytaj go ponownie i porównaj bajt po bajcie: sam ACK, HTTP sukces lub informacja o konflikcie nie są dowodem poprawnego zapisu.
5. Strumieniowo oblicz SHA-1 i SHA-256 całego obiektu z kolejnych części. W RAM nie składaj całego dużego JAR-a.
6. Dopiero po zgodności z oficjalnym SHA-1 utwórz niemodyfikowalne `complete.json`, obejmujące długości, powiązanie, hash całego obiektu i uporządkowane hashe części.
7. `verify` wymaga pokwitowania i ponownie odczytuje/sprawdza wszystkie części. Nie pobiera źródła, nie publikuje brakującego pokwitowania i nie zakłada, że dawny sukces nadal oznacza poprawne pliki.

Zerwanie przed końcem pozostawia tylko już ukończone części; nowy koordynator odczyta je i pobierze brakujące zakresy. Utrata ACK po skutecznym zapisie również jest wznawialna. Dwa identyczne transfery mogą spotkać się na tym samym niemodyfikowalnym rekordzie. Różne bajty oznaczają konflikt, a nie nadpisanie.

**Uszkodzenie nie jest automatycznie naprawiane przez zastąpienie.** Zły pełny hash nie publikuje pokwitowania nawet przy poprawnych checksumach każdej części. Uszkodzone dane zostają do zbadania; ewentualna nowa próba ma inny jawny ID. Brak części za już opublikowanym pokwitowaniem także jest błędem integralności, nie cichym pobraniem zamiennika. Protokół nie ma operacji usuwania ani listowania cudzych danych.

## Źródło oficjalnych zakresów HTTPS

`officialSource(plan, { request, timeoutMs })` korzysta wyłącznie z adresów zatwierdzonego planu. Ponownie stosuje allowlistę klas źródeł planner-a, nie przyjmuje URL z argumentu zakresu ani alternatywnego hosta po błędzie.

- GET z `Range`, `Accept-Encoding: identity`, `redirect:error`, bez tokenów konta/Storage i bez cookies;
- domyślny timeout 60 s na zakres oraz sygnał anulowania z koordynatora;
- 206 wymaga dokładnego `Content-Range` z oczekiwanym offsetem, końcem i całkowitym rozmiarem;
- 200 jest dozwolone tylko, jeżeli zakres obejmuje **cały mały obiekt**. Zignorowane Range dla dużego obiektu albo niezerowego offsetu powoduje anulowanie odpowiedzi przed czytaniem całego pliku;
- deklarowany Content-Length, kodowanie, faktyczna długość i granice są sprawdzane; 3xx/4xx/5xx nie są sukcesem;
- raw błędy transportu nie są przepisywane do publicznej diagnostyki protokołu.

To zaimplementowany adapter, ale w tej porcji testowany wyłącznie na syntetycznych odpowiedziach HTTP. Nie oznacza sprawdzenia rzeczywistych nagłówków każdego oficjalnego hosta. Brak automatycznego fallbacku do pobrania całego dużego pliku jest celowy.

## Lokalny adapter — nie magazyn chmurowy ani backup

`directoryStore(root)` jest działającym adapterem do prywatnego cache **wewnątrz ignorowanego `.cache/`**. Nie pozwala wybrać `public`, `dist`, innego katalogu repo ani ścieżek z manifestów. Korzysta z trybów katalogów 0700 i nowych plików 0600, kontroli symlinków/typów/limitów i nie blokuje się na FIFO.

`create` zapisuje własny plik roboczy, wykonuje `fsync`, atomowo tworzy końcowy hard link bez nadpisania i synchronizuje katalog. Usuwa wyłącznie własny link roboczy tej operacji; zaakceptowane rekordy i ich bajty pozostają. Awaria procesu może zostawić plik `.work`; nie jest on zaakceptowaną częścią ani celem automatycznej retencji. Adapter nie usuwa takich pozostałości po innych operacjach. Nie testowano awarii sprzętu ani odtworzenia po utracie całego dysku.

Zawartość cache przeżywa odtworzenie koordynatora i proces Node w sprawdzonym środowisku. **Cache runnera i lokalny dysk nie są trwałym backendem ani niezależną kopią zapasową.** Na razie nie uruchamiamy pobierania oryginałów do efemerycznego runnera.

API jest deweloperskie, nie instrukcją wymagającą komputera od właściciela telefonu:

```js
const session = createTransfer(approvedPlan, { id: savedTransferID });
const store = await directoryStore(privateCacheDirectory);
const source = officialSource(approvedPlan);
await session.transfer(objectSHA1, { store, source, signal });
await session.verify(objectSHA1, { store });
```

Przyszły adapter chmurowy musi zapewnić tę samą semantykę `read(key, limit)` i atomowego `create(key, bytes)` bez nadpisania, lecz dopiero za osobną autoryzacją i limitami konta. Ten kontrakt nie zezwala klientowi na bezpośredni dostęp administracyjny do Storage.

## Regresje i pozostałe bramki

**31 testów offline** w `npm run test:reference:transfer` i standardowym `npm test`: przerwanie wewnątrz i między zakresami, wznowienie, utrata ACK, fałszywy ACK, konkurencja, konflikt, złe hashe/nagłówki/powiązania, uszkodzone pokwitowanie, pusty obiekt, plik binarny ponad 9 MiB, anulowanie, limity, źródło Range/HTTP, symlinki/FIFO oraz zapis/odczyt w osobnym procesie Node.

Żaden test nie pobiera oryginałów ani nie używa prawdziwej sesji właściciela. Wyniki pozostawiają `originalObjectExecuted:false`, `independentBackupVerified:false`, `fullCorpusReady:false`.

**W kolejnej porcji wykonano integrację zatwierdzania planu i nowego backendu OIDC/Storage oraz regresje podpisanej tożsamości. Następne:** rzeczywisty inwentarz, kontrola limitów/pojemności, testy rzeczywistej ścieżki oraz niezależna kopia z odtworzeniem. Nie ogłaszamy tych bramek jako zaliczonych na podstawie testów lokalnych.
