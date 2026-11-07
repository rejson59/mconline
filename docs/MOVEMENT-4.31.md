# 4.31 — rzeczywiste kolizje i widoczne płoty

To zmiana **działającej gry**, nie kolejny etap samego magazynu referencji. Cel pozostaje ten sam: własna implementacja o wyglądzie i zachowaniu Minecrafta. Ta porcja naprawia konkretny wycinek, nie ogłasza ukończenia portu Java 26.3.

## Naprawione zachowania

1. **Drzwi, skrzynie, kaktusy i szyby:** ruch kończy się na faktycznej powierzchni bryły, zamiast przeskakiwać na granicę całej kratki. Wcześniej przy cienkim modelu można było zostać cofniętym mimo wolnego miejsca albo mieć niewidzialną przeszkodę przed widoczną ścianą. Otwarte drzwi nadal przepuszczają tylko przez pustą część modelu, nie przez samo skrzydło.
2. **Cienkie przeszkody:** sprawdzany jest cały odcinek ruchu, nie tylko końcowa pozycja. Szyba/drzwi nie znikają z fizyki, gdy ciało przechodzi pomiędzy punktami podkroków. Zakres przeszukiwania nie jest zwężany o epsilon: pominięcie penetracji mniejszej niż 0,001 bloku powodowało wejście w ścianę i zablokowanie wspinania pająka.
3. **Górna część płotu:** sprawdzana jest także warstwa bloków pod stopami, bo płot wystaje ponad własną kratkę do wysokości 1,5. Dotyczy to ruchu, lądowania, sprawdzania miejsca na ciało oraz sondy powierzchni. Nawigacja i fizyka nie używają już różnych zakresów warstw.
4. **Podłoga i sufit:** lądowanie i uderzenie głową kończą się na rzeczywistym kontakcie. Zachowano dokładne wysokości płyt, ścieżki, grządki, skrzyni i łóżka. Wejście na stopień wymaga wolnego miejsca zarówno w pionie, jak i na podniesionym odcinku poziomym; nie omija niskiego sufitu.
5. **Widoczność płotu:** model słupka i szczebli używa istniejącego nieprzezroczystego materiału desek. Poprzednia wycinana ikonka płotu miała przezroczyste piksele w środku kafelka — dokładnie tam, skąd model pobierał UV słupka. Zmiana dotyczy również przedmiotu, przez wspólne `tileFor`.

Nie zmieniono ID bloków, kształtu danych świata, kont, zapisu, ochrony działek, backendu ani budżetu archiwum. Nie wykonano resetów lub migracji. Wersja użytkowa: **4.31.0**.

## Dowody

- **45 nowych grup regresji**, uruchamianych domyślnie przez `npm test`; osobno `npm run test:movement`. Te same poprawione fixture'y uruchomione przeciw kodowi bazowemu wykazały **24 PASS / 21 FAIL**; po poprawce **45 PASS / 0 FAIL**. To test zachowania projektu, nie wykonanie kodu Mojanga.
- Kontakty z częściowymi bryłami z obu stron i w obu osiach, cienka szyba przy dużej prędkości, ułamkowe kontakty szerokiego ciała, górna część płotu także przy ujemnych współrzędnych i granicy chunka, lądowanie, usunięcie podparcia, sufit, step-up i skradanie.
- Geometria odizolowanego słupka: rzeczywiste pozycje wierzchołków i UV, pełna alfa materiału, identyczna geometria między mesherem synchronicznym a workerem. Nie wystarcza sama deklaracja `solid` czy nazwa kafelka.
- Dotychczasowe testy silnika, m.in. wspinanie pająka, oba zawiasy i cztery kierunki drzwi, otwarte przejście z niższej ścieżki oraz niski strop, nadal przechodzą. Stary test zamkniętych drzwi oczekiwał zatrzymania przed środkiem kratki; poprawiono go na **konkretną powierzchnię panelu i aktywną kolizję**, a nie usunięto kontroli blokowania.
- Pełne `npm run typecheck`, `npm test`, `npm run build`: PASS. `npm audit --audit-level=low`: 0 podatności.
- Rzeczywisty Chromium, build produkcyjny, osobne świeże profile desktop **960×600** i dotykowy mobile **390×844**: PASS istniejącego testu craftingu, dropów i zapisu/ponownego wczytania; brak błędów konsoli. Ten test przeglądarkowy nie jest porównaniem obrazu z oryginalnym klientem.
- Odczytano trzy małe modele z przypiętego mirrora 26.3: `oak_fence_post`, `fence_post`, `fence_side`. Potwierdzono wiązanie materiału do `oak_planks` i granice słupka `[6,0,6]–[10,16,10]`. Surowe dane pozostały w ignorowanym cache, hashe i zakres dowodu są w [pokwitowaniu](benchmarks/movement-4.31.json).

## Uczciwy stan zgodności

| Zakres | Stan |
| --- | --- |
| Zatrzymanie przy faktycznej bryle i regresje podparcia w projekcie | **Poprawione**, testy PASS |
| Materiał desek i wymiary słupka względem trzech sprawdzonych modeli mirrora | **Sprawdzone w ograniczonym zakresie** |
| Końcowe piksele desek i całego płotu względem Java 26.3 | **Niesprawdzone**; używany jest dotychczasowy pakiet tekstur |
| Pełny kształt kolizji i reguły połączeń płotu | **Różne**; pozostała pełna podstawa kratki i dotychczasowe reguły łączenia |
| Pełna zgodność ruchu, skradania i step-up z uruchomioną Java 26.3 | **Niesprawdzone**; nie uruchomiono oryginalnego klienta |
| Wszystkie możliwe przyczyny zgłoszenia „znikającej podłogi” | **Nie są uznane za domknięte**; ta porcja obejmuje fizykę, nie każdy błąd siatki/streamingu |

Dalsza praca ma iść pionowymi odcinkami: **widoczny model + kolizja + interakcja + regresja**, a potem porównanie z referencją. Magazyn i pełny korpus rozwijamy równolegle; ich otwarte bramki nie zatrzymują tych poprawek gry. Nie wymagamy od właściciela z telefonem wyboru technologii, zrzutów paneli ani ręcznego pośrednictwa w pobieraniu plików.
