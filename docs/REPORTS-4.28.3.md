# Zgłoszenia — 4.28.3 (2026-11-06)

> Aktualizacja: dwa pozostałe zgłoszenia otrzymały implementację i testy w [4.29.0](SHARED-STATE-4.29.md). Poniżej historyczny zakres wydania 4.28.3.

## Status na dzień wydania 4.28.3: sześć poprawek, dwa zgłoszenia otwarte

| Raport | Diagnoza | Zmiana / status |
|---|---|---|
| d4a70a24-a384-41f6-97ba-20106b2d6ad1 | Brak konsekwentnego prefiksowanego zakazu zaznaczania HUD/emoji. | CSS `-webkit-user-select` i callout na powłoce i potomkach; wyjątki dla input/textarea/contenteditable. Warstwa gestów zachowuje `touch-action:none`. |
| d76904c8-dd7f-4c94-a5bf-2efc68c62883 | Każdy dom oraz każda farma/wieża dostawały skrzynię. Domy miały niemal identyczny rozmiar. | Domy 5/7 bloków szerokości i 5/9 głębokości; jeden z czterech wariantów domu ma skrzynię. Zachowane skrzynie zawodowe, bez automatycznych skrzyń na farmach i wieżach. To poprawa generatora, nie deklaracja pełnego odwzorowania wszystkich szablonów Java 1:1. |
| 3dd85ebf-ae02-4ff5-bb84-fb44975cef67 | Shader znał wyłącznie lokalną pochodnię. ID przedmiotu w głównej ręce było już nadawane. | Cztery najbliższe widoczne źródła zdalne w uniformach chunków; dodatkowe ID drugiej ręki w istniejącym pakiecie pozycji. Bez światła martwych, nieobecnych i niewidocznych w drugim wymiarze graczy. |
| b78edd30-715b-44f6-9a81-aa493a17c68f | Pochodnię miażdżono przy starcie spadania, a animacja używała niezmiennego celu. | Zachowanie pochodni i bezpośredni drop żwiru/piasku zamiast postawienia bloku. Całe kolumny, natychmiastowe osiadanie i ponowna kontrola przebytej trasy podczas animacji (w tym mały FPS i nowe podparcie). |
| bba3c4b2-d042-42a4-a735-663db298cf42 | `Game.updateMobs` uruchamia lokalny losowy spawn i AI; brak wspólnej tożsamości/arbiterstwa encji. | **NIE NAPRAWIONE.** Nie dodano pozornej synchronizacji pozycji. |
| 53b37728-38f2-4501-8c28-50c4f018b749 | `tryEat` usuwał miód bez zwrotu naczynia. | Zwrócenie jednej butelki: do zwolnionej ręki, plecaka albo na ziemię. Creative nie produkuje pustych butelek. |
| ff2b8d77-b8e7-419f-ba5c-18fd29738aa2 | Zawartość w lokalnej mapie `Game.chests`, niezależna od wspólnych edytów bloków. | **NIE NAPRAWIONE.** Nie rozsyłano całych slotów metodą „ostatni zapis wygrywa”, która mogłaby duplikować/usuwać przedmioty. |
| 17e01851-7b74-47f4-b54b-31c5ccf65edf | Przyciąganie od ok. 0,55 s, zbieranie z 2,5 bloku, również przez właściciela właśnie wyrzuconej rzeczy. | Jawnie wyrzucone rzeczy mają 2 s ochrony przed własnym przyciąganiem/zbieraniem. Zasięg podniesienia 1,5 bloku, lokalnego przyciągania 2 bloki. Zwykły drop kopania nie dostaje dodatkowych 2 s. |

## Pozostała praca multiplayer

### Moby — nadal otwarte

Potrzebne są stabilne ID, jedna symulacja danej grupy encji, bezpieczne przejęcie po rozłączeniu oraz wspólne zdrowie/śmierć. Nie wystarczy zsynchronizować ziarna losowania ani same pozycje. Interakcje karmienia, oswajania, strzyżenia, obrażeń, loot/XP i zmiana wymiaru muszą korzystać z tego samego stanu, a nie wykonywać się niezależnie u każdego gracza. Wymagane regresje: dwa klienty, wspólny spawn/ruch/HP, równoczesny śmiertelny cios bez podwójnego lootu, ponowne wejście i rozłączenie arbitra.

### Zwykłe skrzynie — nadal otwarte

Potrzebny jest trwały rekord świata/wymiaru/pozycji i **atomowa** operacja skrzynia ↔ ekwipunek konta. Obecny checkpoint profilu z kontrolą wersji nie może zostać ominięty. Sama blokada skrzyni nie chroni przed spóźnionym checkpointem profilu lub utraconym ACK transakcji. Trzeba zabezpieczyć kursor, shift/drag, drop, niszczenie skrzyń, prawa działek, powtórki, zmianę sesji i dwa urządzenia. Ender chest pozostaje prywatny.

Istniejące lokalne zawartości tych samych współrzędnych mogą być różne. Nie ma jednej wiarygodnej kopii, którą wolno automatycznie wybrać. Należy uzgodnić zachowanie starszych kopii/import przed migracją; ta wersja ich nie scala i nie usuwa. Docelowe testy: dwa konta, wyjście/reload, dwie równoczesne wypłaty ostatniego stosu, utracony ACK, brak sieci, wygaśnięcie sesji, obca działka i drugi wymiar.

## Bezpieczeństwo wdrożenia

- Migracja `202611060008_drop_pickup_delay.sql` rozszerza istniejący arbiter CAS dropów o `pickupAfter`. Idempotentny grant pozostaje odtwarzalny; cooldown nie blokuje innych zbierających.
- Zachowane service-only ACL: brak bezpośredniego dostępu `anon`/`authenticated`; bramka nadal weryfikuje konto i sesję.
- Nie zmieniono bramki, zapisu profilu, ochrony generacji sesji ani dziennika ekwipunku z 4.28.2.
- Nie wykonano resetu 004 ani kasowania lokalnych światów, profili czy zawartości skrzyń. Zwykła dotychczasowa procedura wygaszania starych dropów pozostaje bez zmian.
- Zmiana deterministycznych szablonów dotyczy generowanej bazy wiosek. Zapisane edyty bloków i otwarte skrzynie nie są kasowane; nie jest to system wersjonowania historycznego wyglądu generatora.

## Weryfikacja

- `npm run typecheck`, `npm test` (**25446 sprawdzeń offline**), `npm run build`: PASS.
- Smoke obejmuje butelkę w obu rękach, stos, pełny plecak i creative; wszystkie trzy rodzaje pochodni, oba rodzaje sypkich bloków, całą kolumnę i obie ścieżki osiadania; późną pochodnię i duży krok animacji; pochodnie zdalne, drugą rękę, znikanie światła; cooldown właściciela, drugiego zbierającego i odtwarzanie grantu; rozkład skrzyń/rozmiarów domów.
- `supabase/tests/drop_pickup_delay.sql`: **15 PASS** na rzeczywistym PostgreSQL projektu gry; syntetyczne dane, transakcja z `ROLLBACK`. To nie test dwóch żywych kont.
- `node scripts/verify-report-fixes-browser.mjs`: **desktop i emulowany mobile PASS**, rzeczywisty build produkcyjny/Chromium/SwiftShader. Odczyt piksela kamiennej ściany: `[45,45,45]` bez zdalnej pochodni → `[107,102,96]` z pochodnią w dowolnej ręce; znowu `[45,45,45]` dla drugiego wymiaru i martwego gracza. Rzeczywisty receiver i interpolacja używają **syntetycznych pakietów**, nie dwóch zalogowanych kont.
- `node scripts/verify-native-browser.mjs`: desktop / emulowany mobile / file PASS; wyszukiwanie receptur, crafting, zwracanie kursora, drop i save/reload.
- Emulowany 1-sekundowy touch: brak zaznaczenia i niezablokowanego menu kontekstowego; pola tekstowe nadal mają `user-select:text`. **Nie sprawdzono fizycznego Androida/iPhone'a ani Safari.**
- Surowy raport przeglądarki: `.cache/verification4283/report.json` (lokalny, nie w Git); skrócone dowody w `docs/benchmarks/reports-4.28.3.json`.
