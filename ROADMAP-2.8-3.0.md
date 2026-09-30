# BlockCraft — droga od 2.8 do 3.0

**Plan, nie deklaracja ukończenia.** Źródłem pełnych kryteriów każdego punktu pozostaje [PLAN-100-BLOCKCRAFT-3.0.md](PLAN-100-BLOCKCRAFT-3.0.md). Poniższa tabela przypisuje **odbiór** wszystkich 100 wymagań do etapów, nie zmienia ich treści ani nie odhacza checkboxów. Kod niektórych późniejszych punktów jest już obecny na gałęzi 2.8; to nie oznacza, że cała funkcja jest zweryfikowana lub że można zaliczyć ją w 2.8.

| Etap | Punkty planu do pełnego odbioru | Grywalny cel etapu |
| --- | --- | --- |
| **2.8 — Szlaki i podziemia** | **1–4, 15, 33–34, 100** | Sześć biomów, wysokości, rzeki, połączone jaskinie; mapa, kompas i lorneta oraz realnie działające presety jakości. Bez zmiany terenu zapisanych światów. |
| **2.9 — Materiały i budowanie** | **16–30, 43–50** | Kompletne rodziny bloków, warianty budowlane, dekoracje, biwak, posiłki, pułapki, łowienie i amunicja; wszystkie z osiągalnym pozyskiwaniem w Survival i zapisami. |
| **2.10 — Wyposażenie i gospodarstwo** | **31–32, 35–42, 86–95** | Lina i bezpieczne zejście, wyposażenie, bronie, pełne uprawy/hodowla, profesje i warsztaty z czytelnymi UI, recepturami oraz ekonomiką. |
| **2.11 — Żywy świat** | **51–70** | Czytelne sylwetki, gatunki, AI, zachowanie w pogodzie i ogniu, życie wiosek, handel karawany i telegraph ataków. Granice kosztu AI na telefonie. |
| **2.12 — Wyprawy i fabuła** | **5–14, 71–74, 82–85** | Eksplorowalne struktury i Nether, historia, bossowie, tryb przygody, arena i nagrody otwierające nowe możliwości; żadnych nieosiągalnych lokacji. |
| **2.13 — Walka, balans i oprawa** | **75–81, 96–99** | Unik, parowanie, mikstury, wyzwania, trudność oraz audyt tekstur, ikon, powtórzeń i dźwięków na PC/dotyku. |
| **3.0 — odbiór całości** | **1–100** | Pełna regresja całego planu, interoperacyjność systemów, stare zapisy/import/eksport, testy PC i urządzeń dotykowych, wydajność, changelog i dopiero wtedy Release 3.0. |

## Bramka wydania 2.8

Gałąź zawiera obecnie kod wszystkich ośmiu punktów etapu 2.8, ale **2.8 jest kandydatem, nie gotowym wydaniem**: w planie nadal nie ma zaliczonych checkboxów. Przed publikacją trzeba samodzielnie sprawdzić pełną drogę w Survival i Creative (PC i dotyk), wejście i wyjście z jaskini, brzegi rzek, mapę/kompas/lornetę, jakość Auto/niski preset, a także prawdziwe historyczne zapisy 2.7/v3/v4/v5, eksport/import, małe ekrany i dłuższą wydajność. Obecna próba Chromium/SwiftShader i emulowany dotyk nie są testem na fizycznym telefonie.

**Zasada wydań:** numer aplikacji i PR mogą oznaczać kandydata 2.8, ale nie publikujemy stabilnego Release ani nie nazywamy planu 3.0 ukończonym tylko dlatego, że istnieje kod lub przeszły testy jednostkowe. Wcześniej zaimplementowane fragmenty punktów przypisanych do 2.9–2.13 pozostają oznaczone jako wymagające pełnego odbioru; nie wolno kasować ich z planu. Użytkownik nie musi wykonywać testów — należą do pracy nad wydaniem.
