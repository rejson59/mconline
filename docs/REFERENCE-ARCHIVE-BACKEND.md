# Prywatne archiwum — backend OIDC i adapter klienta

2026-11-07. Dalsza część [planu wykonania](MINECRAFT-IMPLEMENTATION-PLAN.md). **Kod backendu i adapter klienta są połączone. Osobna funkcja jest wdrożona z blokadą zapisu. Nie oznacza to jeszcze rzeczywistego transferu oryginałów ani gotowego backupu.**

## Co wdrożono

- `supabase/functions/mconline-reference-archive/index.ts`, funkcja `mconline-reference-archive`, **ACTIVE v1**, ID `69a62439-6f50-489b-8cdf-3b39855d2abd`, projekt `bewwejewgqzctnjrbclu`.
- Samodzielny moduł, bez kodu ładowanego z ruchomego brancha GitHub. Kompilacja: `node scripts/compile-reference-archive.mjs`; [sumy źródeł i wyniku](benchmarks/reference-archive-build.json). Dokładna zależność `npm:jose@6.2.15`, wspierane importy `node:crypto` i `node:buffer`; brak filesystemu, CLI i lokalnego cache w module Edge.
- `scripts/reference-archive-client.mjs`: adapter kontraktu `read/create` z protokołu części do ściśle określonego endpointu.
- Wspólne moduły bez I/O: `reference-official-pin.mjs`, `reference-corpus-core.mjs`, `reference-transfer-core.mjs`. Dotychczasowe komendy i importy z modułów CLI pozostają kompatybilne. Nie powstał drugi, rozjeżdżający się planner.
- **27 nowych regresji offline** z rzeczywistymi podpisami RSA oraz syntetycznym JWKS, oficjalnymi metadanymi testowymi i Storage. Rzeczywiste tokeny, sesje i pliki gry nie są używane w regresjach.

Dotychczasowe funkcje reader v2, panelu v2 oraz bramka gry v4 nie zostały zmienione ani ponownie wdrożone. Nie zmieniono bucketu, ról, RLS, danych kont, światów ani migracji.

## Granica zaufania

Osobny audience: **`mconline-reference-archive-v1`**. Token odczytu probe nie jest tokenem zapisu archiwum. `verify_jwt=false` dotyczy warstwy platformy Supabase; sam backend wymaga kryptograficznie zweryfikowanego GitHub OIDC:

- stały issuer GitHub, RS256, klucze ze stałego JWKS, nie z tokenu;
- audience archiwum, wymagane claimy i ważność, maksymalny wiek 10 min / tolerancja 30 s;
- repozytorium `rejson59/mconline`, repo ID `1387893577`, actor ID `185239338`;
- dokładny immutable subject z ID, `main`, `workflow_dispatch`, workflow `.github/workflows/ci.yml@refs/heads/main`, `github-hosted`, poprawne run/attempt.

Backend odrzuca Origin przeglądarki, nie ma CORS, przyjmuje tylko POST bez query. Nie przyjmuje sesji konta strony, klucza anon Supabase ani loginu jako autoryzacji.

**Plan nie pochodzi od klienta.** Po autoryzacji serwer pobiera wyłącznie przypięty oficjalny manifest 26.3, sprawdza jego SHA-1 przed parsowaniem, weryfikuje wskazany indeks i buduje plan tą samą czystą funkcją co narzędzie offline. Niepowodzenie nie jest zapamiętywane jako poprawny plan. Nie da się przesłać JSON z własnym planem, URL, bucketem lub ścieżką i uzyskać prawa zapisu. Klient sprawdza spójność digestu, przypięte pochodzenie i wpis klienta, ale nie udaje, że sam otrzymał i niezależnie sprawdził surowe oficjalne metadane.

Każdy plan ma jeden serwerowo wyznaczony namespace i ID próby: pierwsze 32 znaki `planSHA256`, stałe `partBytes=4 MiB`. Klient nie może tworzyć nieskończonego zbioru prób ani zmieniać rozmiaru części, aby omijać budżet. Uszkodzenia nie są naprawiane nadpisaniem; nowa zatwierdzona próba wymaga świadomej zmiany po analizie, nie parametru HTTP.

## Operacje

Nagłówek `x-reference-op`: `plan`, `read-part`, `write-part`, `read-receipt`, `finalize`. Pozostałe nagłówki dla obiektu: digest planu, SHA-1 obiektu oraz indeks części, jeżeli potrzebny. Nie ma dowolnego klucza ani ścieżki wejściowej.

- `plan`: zwraca plan wyprowadzony przez serwer i jego parametry, bez I/O Storage.
- `read-part`: odczyt tylko zatwierdzonej części, z limitem, weryfikacją rekordu i checksumu.
- `write-part`: weryfikuje cały rekord i powiązanie; POST Storage z `x-upsert:false`, następnie faktyczny odczyt i porównanie bajtów. ACK nie wystarcza.
- `read-receipt`: odczyt zapisanego pokwitowania. To nie jest ponowne sprawdzenie całego obiektu; robi je `session.verify` klienta lub `finalize` serwera.
- `finalize`: klient nie może przesłać własnego pokwitowania. Serwer odczytuje wszystkie części, oblicza hash całego obiektu i dopiero wtedy tworzy własne `complete.json`. Wynik `created` odróżnia rzeczywiste utworzenie od identycznego powtórzenia. Niekompletne/uszkodzone części nie dają sukcesu.

Każda operacja Storage najpierw potwierdza prywatność i limit istniejącego bucketu. Nie ma jego tworzenia, zmiany limitów, listowania ani DELETE. Sekret service-role trafia wyłącznie z serwera do skonfigurowanego Storage, nigdy do GitHub, źródeł Mojanga, klienta ani odpowiedzi HTTP. Błędy są stałe i nie publikują raw odpowiedzi upstreamu.

## Celowa blokada zapisu

Produkcyjne wywołanie `Deno.serve` ma **`budgetBytes:0` w kodzie wdrożenia**, nie opcję HTTP ani sekret, który przypadkiem odblokuje zapis. `write-part/finalize` po poprawnej autoryzacji zwracają 423 przed pobieraniem planu i I/O Storage. Zmiana wymaga przeglądu kodu i nowego wdrożenia po potwierdzeniu warunków, nie kliknięcia anonimowego klienta.

Backend liczy konserwatywny rozmiar archiwum z narzutem rekordów i pokwitowań. Testy mogą ustawić dodatni budżet przez konstruktor serwera — to zależność testowa, nie wejście produkcyjnego endpointu. Budżet całego planu musi się mieścić, nie tylko rozmiar wysyłanej części. To nadal nie dowodzi wolnego miejsca w planie Supabase, kosztów, limitów organizacji ani istnienia drugiej kopii.

Odczyt wyłącznie metadanych Storage w tej porcji potwierdził:

```text
bucket: mconline-reference-private
public: false
file_size_limit: 10485760
allowed_mime_types: text/plain, application/octet-stream, application/json
object_count: 1
indexed_bytes: 79
```

Te liczby opisują zajętość i konfigurację znanego bucketu, **nie całkowitą pojemność konta**. Nie odczytywano zawartości probe tą drogą i nie przesyłano oryginałów.

## Rzeczywisty inwentarz z telefonu — bez transferu plików

Dodano domyślnie wyłączoną opcję `reference_archive_plan` w istniejącym workflow CI. Osobny job ma `contents:read` oraz własne `id-token:write` i działa tylko dla ręcznego uruchomienia właściciela na `main`. Bez nowych sekretów, artefaktów i transferu oryginałów. Nie zmieniono triggerów w celu obejścia odmowy dispatch dla integracji Arena.

Po zielonym scaleniu:

1. [GitHub → Actions → CI](https://github.com/rejson59/mconline/actions/workflows/ci.yml) → **Run workflow** → **main**.
2. Zaznacz wyłącznie **Inwentarz pełnego zestawu 26.3 i rozmiary (bez transferu plików)**.
3. Uruchom i napisz „uruchomione”. To **nie** powtórka probe 79 B: wynik ma dać faktyczny spis/liczby/rozmiary zadeklarowanego zestawu i górną granicę zajętości, potrzebne do sprawdzenia pojemności.

Skrypt `inspect-reference-archive.mjs` otrzymuje krótkotrwałą tożsamość z nowym audience, wykonuje tylko `plan` i publikuje bezpieczną adnotację **Reference archive inventory**: digest, liczby, rozmiary, Java major i jawne braki. Nie wypisuje pełnej listy plików, tokenów, bajtów metadanych ani treści oryginałów. Wymaga zablokowanego zapisu; `storageWrites`, `originalsTransferred`, `fullCorpusReady`, `independentBackupVerified` pozostają false. Sam runner nie otrzymuje surowych manifestów: `officialMetadataBytesIndependentlyVerifiedByRunner:false`.

**Pozytywny wynik nowego joba jest na razie niepotwierdzony.** Testy syntetyczne i ACTIVE nie zastępują odpowiedzi nowej funkcji z rzeczywistym tokenem oraz jej dostępu do Mojanga. Nie nazywamy tego już ukończonym korpusem ani transportem.

## Weryfikacja i dalsza praca

- 27 regresji: podpis/kontekst/czas, niezależny subject z obserwacji API, pin metadanych, blokada i budżet, publiczny bucket, zły indeks/obiekt/plan, fałszywy ACK, konflikt i korupcja, finalize oraz klient → podpisany backend → syntetyczny Storage z przerwaniem/wznowieniem; job inwentarza i brak tokenów w raportach.
- Testy dotychczasowego plannera, protokołu, probe i readera są zachowane; wspólne rdzenie nie zawierają filesystemu/CLI. Pełne typecheck/test/build oraz audit są wykonywane przed scaleniem.
- CI ma rzeczywiste **negatywne** kontrole nowego wdrożenia: brak tożsamości, opaque token, anon JWT Supabase, Origin przeglądarki. Nie pobierają oryginałów i nie zapisują Storage. Zielone zwykłe CI z pominiętym jobem inwentarza nie jest pozytywnym wynikiem planowania.
- Następne bramki: rzeczywisty inwentarz i transport HTTPS z tego wdrożenia, wolne miejsce/koszty, niezależna kopia i test odtworzenia, pomiar granic pamięci/CPU/czasu Edge dla większych obiektów oraz kontrolowane odblokowanie po przeglądzie. Nie zgadujemy tych wyników.
