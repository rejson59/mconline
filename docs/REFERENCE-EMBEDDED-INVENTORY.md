# Inwentarz wnętrza klienta i bundla serwera

2026-11-07, etap 3 [planu implementacji](MINECRAFT-IMPLEMENTATION-PLAN.md). Kod: `scripts/reference-embedded.mjs`; **29 regresji syntetycznych offline**, włączonych do `npm test`.

**Przygotowano analizator, nie wykonano jeszcze analizy prawdziwych JAR-ów 26.3.** Oryginały nie zostały pobrane, przesłane, opublikowane ani uruchomione przez tę porcję. Nie zmienia ona potwierdzonego inwentarza 5266 zadeklarowanych obiektów ani jego pokwitowania.

## Co wykonuje kod

- `inventoryOfficialArchives({manifestRaw, assetRaw, clientRaw, serverRaw})` ponownie buduje plan z **surowych, przypiętych oficjalnych metadanych**. Nie ufa dostarczonemu przez wywołującego `planSHA256`. Rozmiar i SHA-1 obu JAR-ów muszą odpowiadać descriptorom z manifestu. Domyślny pin jest ten sam co w plannerze; parametr zastępczy służy testom syntetycznym, nie wejściu z HTTP/CLI.
- Weryfikuje całe archiwum i każdy jego wpis: zgodność katalogu centralnego z lokalnymi nagłówkami, rozmiar rzeczywistego wyniku dekompresji, CRC-32 oraz dodatkowy SHA-256 rzeczywistych bajtów wpisu. Sam wpis w katalogu ZIP nie jest wynikiem pozytywnej weryfikacji zawartości.
- Zachowuje **każdą nazwę** i klasyfikuje wpisy: `assets`, `data`, `class`, `metadata`, `directory`, `other`. Nie pomija nieznanych plików jako nieistotnych. Nazwy nie stają się ścieżkami na dysku.
- W bundlu serwera wymaga `META-INF/libraries.list` i `META-INF/versions.list`; sprawdza format, unikalność nazw/identyfikatorów, SHA-256 wskazanych zagnieżdżonych JAR-ów i zgodność deklaracji z rzeczywistymi plikami. Brakujący, dodatkowy lub zmieniony JAR kończy analizę błędem. Następnie inwentaryzuje **wszystkie wpisy** tych zagnieżdżonych JAR-ów, nie tylko launcher bundla.
- Sortuje wyniki niezależnie od locale i oblicza deterministyczny `inventorySHA256`. Wynik zawiera hashe, rozmiary i nazwy, **nie bajty zasobów ani kod klas**.

Niskopoziomowe `inspectJar(raw, {size, sha1})` oraz `inspectServerBundle(raw, {size, sha1})` służą do analizy dowolnych lokalnych, integralnych fixture'ów. Hash podany przez wywołującego **nie udowadnia oficjalnego pochodzenia**; tę granicę zapewnia dopiero wejście oparte na przypiętych surowych metadanych.

## Ograniczenia i bezpieczeństwo

To moduł Node działający na buforach w pamięci, bez filesystemu, sieci, zapisu Storage, wypakowywania na dysk i wykonywania kodu. Nie jest wdrożony w Edge i nie zmienia żadnego workflow ani autoryzacji. Integracja z przyszłym prywatnym workerem pozostaje osobnym krokiem. Właściciel z telefonem **nie musi dostarczać plików, zrzutów panelu ani wykonywać komend**, żeby kontynuować rozwój i testy analizatora.

Jawne limity:

| Limit | Wartość |
| --- | --- |
| Jeden JAR wejściowy | 256 MiB |
| Jeden rozpakowany wpis | 128 MiB |
| Suma rozpakowanych wpisów | 1 GiB |
| Suma liczby wpisów | 100 000 |
| Jeden plik listy bundla | 1 MiB |

Budżety liczby wpisów i rozpakowanych bajtów są **wspólne dla zewnętrznego bundla i jego zagnieżdżonych JAR-ów**, a nie zerowane dla każdej biblioteki. Dla klienta i serwera obowiązują oddzielne budżety. Do sumy bajtów wchodzą zarówno bajty zagnieżdżonego archiwum, jak i jego rozpakowane wpisy. To konserwatywne limity narzędzia, **nie przydzielona pojemność konta ani magazynu**.

Obsługiwany jest klasyczny, jednodyskowy ZIP: metody stored/DEFLATE, UTF-8 lub jednoznaczne ASCII, opcjonalny komentarz i podpisane/niepodpisane deskryptory danych. ZIP64, szyfrowanie, inne metody, symlinki/specjalne pliki, alternatywne nazwy w Unicode extra field, duplikaty, traversal, rozbieżne nagłówki, nakładające się lub nieindeksowane dane i przekroczenia limitów kończą się błędem. **Nieobsługiwany format nie oznacza pustego ani kompletnego archiwum.** Zgodność tego ograniczonego parsera z rzeczywistymi archiwami 26.3 pozostaje niepotwierdzona do pierwszego odczytu ich pełnych bajtów; ewentualne różnice trzeba jawnie rozwiązać, nie wyłączać weryfikacji.

Pełny raport z nazwami pozostaje materiałem prywatnego workera, poza Git/Pages/publicznymi artefaktami. Ta porcja nie zapisuje raportów automatycznie. Nie weryfikuje podpisów JAR/JVM, nie dekompiluje klas, nie interpretuje modeli lub receptur i nie dowodzi poprawności zachowania gry.

Każdy wynik pozostawia `fullCorpusReady:false`, `independentBackupVerified:false` i `gameParityVerified:false`. Oficjalne wejście dodatkowo pozostawia `javaRuntimeInventoryVerified:false`. Pliki dystrybucji Javy, rzeczywista analiza oryginałów, transport, niezależna kopia i odtworzenie są nadal otwartymi etapami.

## Weryfikacja deweloperska

```sh
npm run test:reference:embedded
```

29 testów obejmuje m.in. stored/DEFLATE, puste pliki i ZIP, UTF-8, deterministyczność, rozmiar/hash źródła, CRC zawartości, deskryptory danych, nieobsługiwane/szkodliwe struktury, limity sumaryczne, prawidłowy i uszkodzony bundle, jego listy oraz zagnieżdżone archiwa. W teście wspólnego limitu analizowane są dwa syntetyczne JAR-y po 50 000 wpisów: zewnętrzny bundle nie może ominąć limitu przez podział między biblioteki. Test oficjalnego wejścia używa jawnego syntetycznego pina; **domyślny produkcyjny pin odrzuca te same fikcyjne metadane**.

Nie trzeba ponawiać potwierdzonego joba inwentarza ani probe 79 B. Nieznana pojemność i brak niezależnego backupu nadal blokują uruchomienie dużego trwałego zapisu, ale nie blokują tej pracy offline. Nie włączono płatnych zasobów ani nie zmieniono budżetu zapisu backendu (nadal 0).
