# 4.39 — bezpieczny powrót na serwer i dalsze modele

## Błąd zgłoszony przez właściciela

Komunikat „Serwer ma inny zapis ekwipunku niż niepotwierdzona kopia tej przeglądarki” kończył próbę dołączenia. Ponowne kliknięcie nie rozwiązywało rozbieżności. **Nie usuwamy danych przeglądarki ani rekordów serwera, nie wyłączamy kontroli wersji.** Nie mamy dostępu do lokalnego dziennika z telefonu właściciela; odtworzono ten sam warunek na syntetycznym profilu.

## Naprawa

1. Przy zgodnej wersji serwera lub rozpoznanym `save_id` zachowano dotychczasowe odzyskiwanie niepotwierdzonego postępu, również nowszego niż utracone potwierdzenie.
2. Przy rzeczywistej rozbieżności najpierw zapisujemy **dokładne oryginalne bajty dziennika oraz odczytany profil serwera** w osobnym archiwum przypisanym do tego świata i zweryfikowanego PID. Odczyt zwrotny potwierdza zapis archiwum. Dopiero wtedy kończymy używanie rozbieżnej kolejki i wczytujemy aktualny profil serwera. Następne zapisy CAS bazują na jego wersji.
3. Nie sumujemy stosów i nie odtwarzamy samoczynnie nieznanych transferów: mogłoby to powielić przedmioty już przeniesione do skrzyni, upuszczone lub wykorzystane na innym urządzeniu. Zachowane kopie są do przeglądu/odzyskiwania, nie są automatycznie importowane do gry.
4. Nieprawidłowy lokalny JSON też jest zachowywany w niezmienionej postaci przed wejściem z poprawnym zapisem serwera. Nieprawidłowy/niepełny **zapis serwera** nadal nie staje się pustym ekwipunkiem.
5. Po wejściu wyświetlamy informację o wybranym zapisie i zachowanej kopii. **`/kopie`**, również na liście komend telefonu, pobiera JSON obu wersji bez zmiany aktualnego ekwipunku. Eksport nie zawiera tokenów konta; nie wysyłamy go do żadnego dodatkowego serwisu.

Klucz archiwum: `blockcraft-profile-v1:<world>:<pid>:pending:recovery`. Kopie nie są po cichu przycinane/rotowane ani usuwane przy zwykłym zapisie gry. Nie dodano procedury kasującej archiwa. To lokalne zabezpieczenie urządzenia, nie niezależny backup chmurowy; wyczyszczenie danych strony przez użytkownika usuwa też te kopie.

### Zapobieganie fałszywym konfliktom i utracie kolejki

- ACK porównuje **pełny znormalizowany snapshot**, nie tylko `Date.now()`. Dwie różne zmiany w tej samej milisekundzie nie pozwalają już potwierdzeniu starszej wersji skasować nowszego ekwipunku. Cofnięcie zegara również nie rozstrzyga pierwszeństwa.
- Zwykły zapis/końcowy checkpoint zapisuje zamiar i `save_id` również wtedy, gdy poprzedni ACK usunął już kolejkę. Utracona odpowiedź po zamknięciu strony jest rozpoznawalna po ponownym wejściu.
- Porównanie identyczności wersji normalizuje równoważne ISO (`Z`, offset, końcowe zera), **z zachowaniem mikrosekund PostgreSQL**, bez oceniania pierwszeństwa według zegara przeglądarki. Różnica jednej mikrosekundy nadal jest konfliktem.
- Skrzynie/moby zachowują osobny, blokowany dziennik transakcji. Ich spekulatywny wynik **nie jest** nową zwykłą kopią pending: anulowana transakcja nie może odrodzić przedmiotów po restarcie.
- Zabezpieczenia kont, generacji sesji, Web Locks, CAS i kontrola dostępu nie zostały poluzowane. Brak migracji, resetów i zmian backendu.

### Granice ochrony

Jeśli przeglądarka nie może trwale zachować archiwum (np. całkowicie pełny/zepsuty Storage), nie nadpisujemy jedynej kopii. Wtedy pojawia się właściwy komunikat o archiwizacji, nie zapętlony komunikat o konflikcie. Nie deklarujemy odporności na usunięcie danych strony, awarię nośnika ani dowolną awarię sieci.

## Testy naprawy

- `node .harness/run.mjs checkpoint`: **28 grup PASS** (poprzednio 12). Zgodne/utracone ACK, nowsza kolejka w tej samej milisekundzie, cofnięcie zegara, końcowy zapis bez pending, osobny WAL, warianty ISO i mikrosekundy, rozbieżność/niepełny dziennik, brak profilu, zachowanie oryginalnych bajtów/przyszłych pól, izolacja światów/PID, quota, ignorowane zapisy, nieprawidłowe archiwum i nieudane usuwanie klucza.
- Sześć izolowanych sond z bazowym `profileCheckpoint.ts` z main **1adbed7c35aef54354a3bade267b195e1380448e**: **1 PASS / 5 FAIL**. Po bezpiecznym przywróceniu poprawki: **6 PASS / 0 FAIL**. Dotyczą ACK w tej samej ms, utrwalenia zamiaru wyjścia, wejścia przy rozbieżności, równoważnych ISO, uszkodzonego lokalnego JSON i oddzielenia WAL. To pomiar starego/nowego kodu projektu.
- `npm run test:browser:recovery`: **PASS, errors=[]**. Produkcyjny HTML, prawdziwy provider, Web Locks i silnik, syntetyczna bramka: odświeżenie po utraconym leave/ACK, odzyskanie nowszego lokalnego ekwipunku, druga karta/urządzenie i fencing. Nowe scenariusze odtwarzają błąd zgłoszony na zrzucie: lokalnie 99 przedmiotów vs serwerowe 19 — wejście działa, w grze pozostaje 19, kopia 99 i profil serwera są zachowane. Następnie uszkodzony lokalny JSON w poziomym widoku **844×390**: wejście działa. Rzeczywista komenda `/kopie` pobiera obie kopie; sprawdzono plik i usunięto wyłącznie syntetyczny testowy eksport z cache.
- `npm run test:browser:shared`: **27 kontroli PASS**, dwa renderery, skrzynie/moby/TNT, anulowania, przywracanie spekulacji, brak powielonych dropów. Również 12 dotychczasowych testów cyklu połączenia i 15 modelu/dziennika wspólnego stanu: PASS.

Testy przeglądarkowe nie logują właściciela, nie odczytują jego prywatnych danych i nie wykonują zapisów w prawdziwej sesji. Raporty i zrzuty lokalne: `.cache/verification-recovery439/`; trwałe małe pokwitowanie: [server-recovery-4.39.json](benchmarks/server-recovery-4.39.json).

## Kontynuacja: pięć kolejnych rodzin przedmiotów

**Kamień, bruk, ziemia, dębowe deski i piasek** używają ustawień modelu z przypiętych danych Java 26.3 w obu rękach, dropie i głównej ręce innych graczy. Tam złota kostka została zastąpiona właściwym teksturowanym sześcianem. Skala firstperson .4, ground .25, thirdperson .375, rotacje i przesunięcia są odziedziczone z oryginalnego `block/block`; w odróżnieniu od włazu firstperson Y=0, thirdperson Z=0.

Dodano **12 małych oryginalnych JSON** z commit **9073095a88699785bb1f63f8f86d33322711e4fd** w `.harness/fixtures/java-cube-display-26.3/`: pięć definicji przedmiotu, pięć modeli bloków oraz rodziców `cube_all` i `cube`. Łańcuch każdego przedmiotu prowadzi do już przypiętego `block/block`. Manifest długości/SHA-256 i NOT-MIT notice. Brak oryginalnych JAR-ów, pełnego korpusu i importu fixture do bundla gry.

`npm run test:cubepose`: **37 grup PASS, 480 porównań wierzchołków**. Hashy, definicje przedmiotów, pełne łańcuchy rodziców, odziedziczone display, rzeczywiste `updateHand`/offhand, `spawnDrop`/animacja i zdalny model. Wyrocznia: fixture + niezależna skalarna trygonometria. Bryły pozostają sześcianami; nie zmieniono UV, tekstur, fizyki, zapisów i zasad podnoszenia.

`npm run test:browser:cubepose`: produkcyjny Chromium desktop **960×600** i dotyk w poziomie **844×390**, oba **PASS / errors=[]**. Każdy porównuje 480 nowych wierzchołków + 96 włazu, atlas/materialy, animację ground i rzeczywistego syntetycznego awatara. Zachowano kontrole UV świata/GUI/paneli z poprzedniego odcinka. [Raport](benchmarks/cube-display-4.39.json).

Domyślne display nie są narzucane wszystkim blokom: rodziny niesprawdzone i modele specjalne zachowują dotychczasową ścieżkę. Pełne animacje ramion/kamery, światło i renderer Java, zdalny offhand, inne modele oraz porównanie z uruchomionym oryginalnym klientem pozostają otwarte. Runtime nadal bazuje na 1.20.4, celem jest 26.3.


## Weryfikacja wydania

Pełne `npm run typecheck`, `npm test`, `npm run build`, `npm audit --audit-level=low` i `git diff --check`: **PASS, 0 podatności**. W pełnym zestawie 16 973 kontrole silnika, 409 UI, 81 dotychczasowych grup póz włazu, 34 geometrii/GUI, 73 UV, 114 stanów włazu i kontrole SQL/autoryzacji. Po ostatniej zmianie walidacji powtórzono build i oba główne testy przeglądarkowe (`recovery`, `cubepose`): PASS. Raport audytu odświeżony, bez wymyślonego procentu całości.
