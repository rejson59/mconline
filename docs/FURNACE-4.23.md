# 4.23 — Od rudy do sztabki

Kolejny ograniczony krok w stronę **Minecraft Java 1.20.4**, obejmujący piec, żelazo/złoto, węgiel drzewny i ich wygląd. Nie jest deklaracją zgodności całej gry 1:1.

## Źródła i zakres porównania

`scripts/sync-java-furnace.py` przypina **17 plików, 6808 bajtów** z lustra danych/zasobów Java 1.20.4:

https://github.com/InventivetalentDev/minecraft-assets/tree/90d256dfee7b6fd8014e1bc3b107e64a530c5f9b

- 8 oryginalnych receptur przetapiania: węgiel drzewny, surowe żelazo/złoto, rudy żelaza/złota, szkło, kamień i wieprzowina.
- 3 oryginalne tabele łupu: ruda żelaza, ruda złota, ognisko.
- 6 oryginalnych PNG 16×16: węgiel, węgiel drzewny, surowe żelazo/złoto, sztabki żelaza/złota.

Surowe pliki oraz manifest długości i SHA-256 znajdują się w `.harness/fixtures/java-furnace-1.20.4/`. PNG są też osadzone w `javaFurnace.generated.ts`: brak pobierania podczas gry, brak zależności produkcyjnych. Dane/grafiki Mojang/Microsoft **nie są objęte licencją MIT projektu**; zobacz `public/Minecraft-NOTICE.txt`.

Receptury JSON są bezpośrednim źródłem wyniku i czasu **200 ticków / 10 sekund**. Tabele łupu potwierdzają surowe metale, `ore_drops`, Silk Touch i dwa węgle drzewne z ogniska. Test bonusu używa niezależnej tabeli mnożników Fortune 0–III i kontrolowanych losowań; nie uruchamia oryginalnego generatora Java. Czasy paliw, chłodzenie i światło są zaimplementowaną semantyką Java, nie wartościami wyczytanymi z tych JSON-ów — nie należy mylić tego z wykonaniem oryginalnego serwera.

## Konkretne zmiany

| Obszar | Wcześniej | Teraz |
|---|---|---|
| Zwykły piec | 4 s na przedmiot | 10 s, zgodnie z wybranymi oryginalnymi recepturami |
| Węgiel | 32 s paliwa | 80 s, dokładnie osiem przetopień |
| Rozliczanie czasu | Gubiona reszta klatki po przetopieniu; ostatnia porcja ciepła mogła przepaść | Podział kroku na granice paliwa i ukończenia receptury; identyczny bilans przy różnych krokach czasu |
| Pnie | Dąb/brzoza dawały węgiel kopalny; brak akacji | Wszystkie trzy zaimplementowane pnie dają węgiel drzewny |
| Rudy żelaza/złota | Zwykły kilof zwracał blok rudy | Surowy metal, prawidłowy bonus Fortune; Silk Touch nadal daje rudę |
| Stare bloki rud | Przetapianie w sztabki | Nadal możliwe, tak samo jak przetapianie nowych surowców |
| Ognisko rozpalone/zgaszone | Zwykły drop całego ogniska | Dwa węgle drzewne; całe ognisko tylko z Silk Touch |
| Węgiel drzewny | Brak przedmiotu | Osobny materiał, paliwo 80 s, warianty receptur pochodni i dębowego ogniska, Creative i alias `/give charcoal` |
| Wiadro lawy | Nieobsługiwane paliwo | 1000 s; zostaje puste wiadro |
| Błędne paliwa | Zakres ID wełny obejmował m.in. piec, obsydian, kamienne cegły, lód i kwiaty | Jawna lista sześciu starszych kolorów + osobny ciąg nowych kolorów; nie spalamy przypadkowych bloków |
| Inne paliwa | Przyspieszone czasy, brak niektórych wariantów | Poprawione drewno, drzwi, drabiny, klapy, schody, płyty, patyki, wełna, narzędzia i płomienna różdżka; obsługa łuku, wędki i tarczy |
| Wymyślone przetapianie | Brukowe schody → kamień; piasek dusz → gleba dusz | Te wejścia nie są recepturami pieca; istniejące stosy nie są kasowane |
| Wygląd | Brak ikon surowych metali/węgla drzewnego; wspólny zestaw ikon z innej wersji | Sześć dokładnych oryginalnych ikon 1.20.4, bez przerysowania/barwienia |
| Panel pieca | Niestandardowy komunikat w miejscu etykiety ekwipunku | Etykieta „Ekwipunek” na współrzędnych Java; pasek i płomień nadal pokazują postęp |
| Światło | Rozpalony piec emitował 12 | Poziom 13 |

### Dodatkowy błąd znaleziony w prawdziwej przeglądarce

Żądanie Pointer Lock jest asynchroniczne. Zamknięcie ekwipunku i szybkie otwarcie kontenera mogło zakończyć się przechwyceniem myszy **już po otwarciu GUI**. Test pokazał wtedy prawidłowo widoczny slot wyniku, ale zdarzenie myszy trafiało do canvasu świata.

`pointerlockchange` zwalnia teraz spóźnioną blokadę, jeśli stan gry nie jest `playing`. Nie żądamy blokady ani nie ponawiamy odrzuconej próby za otwartym GUI. Testy obejmują też normalne przechwycenie, Esc, czyszczenie wciśniętych akcji i dotyk.

## Zapisy i bezpieczeństwo

Nowe ID są **append-only: 494–496**, bez kolizji z blokami i starymi przedmiotami. Nie przenumerowano świata ani ekwipunku. Stare rudy nadal można przetapiać. Pozostawiono format stanu pieca: `cook` to ułamek postępu, `burn` to pozostałe sekundy. Stary piec zachowuje ten ułamek i pozostałe ciepło — nie jest zerowany ani doładowywany do 80 s.

Nie zmieniono SQL, protokołu, zasad chronionego miasta ani publicznych zapisów. Nowe stosy przechodzą rzeczywiste klientowe walidatory profilu i współdzielonych dropów. **Nie wykonywano prób na publicznej bazie ani sesji multiplayer**; serwerowa weryfikacja nie jest częścią tego testu.

## Weryfikacja

- **24 231 kontroli**: 678 pieca/materiałów/ikon, 5746 wcześniejszego audytu, 16 467 silnika (w tym regresja kursora), 436 ognia, 81 Workera, 403 audio, 413 UI, 5 konta, 2 bootstrapu.
- `typecheck`, pełne `npm test`, produkcyjny build i `git diff --check`.
- Testy bilansu: jeden węgiel → osiem sztabek przy 144/60/30 FPS jako krokach symulacji, 20 TPS, nieregularnych i dużych krokach. To **nie benchmark FPS**.
- Brak przedwczesnego produktu, przejście na następne paliwo, blokada pełnego/obcego wyniku, chłodzenie, puste wejście, wiadro lawy, błędne `dt`, stare pozostałe ciepło i zapis nowego materiału.
- Produkcyjny Chromium/SwiftShader: desktop, dotykowy viewport 390×844 i lokalny HTML. Prawdziwe `Game.breakBlock()` tworzy surowe żelazo/złoto oraz dwa węgle drzewne z ogniska. Prawdziwe okno pieca pokazuje właściwe ikony i połowę postępu po 5 s; po 10 s rzeczywiste kliknięcie/tapnięcie odbiera jedną sztabkę. Zapis/odświeżenie zachowuje zawartość i 70 s ciepła, nowe materiały oraz GUI 2/Auto 0. Czas w tym teście jest podawany kontrolowanymi krokami do produkcyjnego `Game.updateFurnaces()`, a nie oczekiwaniem 10 s zegara.
- Dodatkowe produkcyjne regresje ognia i Workera na desktopie, zero błędów konsoli. Mobilny viewport nie jest fizycznym telefonem.

Artefakt lokalny: `dist/index.html`, **10558427 bajtów**, SHA-256 `0c2d399a88d702caa7fa8d7256d02f2f9a7c2e19bd7660bab4d611cb7a6d119d`.

Raport: [benchmarks/furnace-4.23.json](benchmarks/furnace-4.23.json).

```sh
npm ci
npm run typecheck && npm test && npm run build
npm run test:furnace
# Opcjonalne narzędzia i osobna sesja przeglądarkowa:
npm install --prefix .cache/browser-tools puppeteer-core @sparticuz/chromium
npm run preview -- --host 0.0.0.0 --port 4173
# Drugi terminal:
npm run test:browser:furnace
```

## Nadal poza zakresem

- XP pieca nadal jest uproszczone (nie pełna akumulacja receptur i wypłata przy odbiorze).
- Brak surowych bloków metali, osobnej cegły glinianej, wielkiego pieca i wędzarni.
- Nie wszystkie receptury ani wszystkie warianty/tagi materiałów Java: ognisko nadal ma profil dębowy, nie mieszankę gatunków; nadal istnieją inne wcześniejsze skróty craftingowe.
- Piec nadal nie zapisuje kierunku frontu jak pełny `facing` Java; nie zmieniono jego modelu ani całego atlasu bloków.
- Brak pełnej symulacji 20 TPS oryginalnego serwera, hopperów, offline progress, wszystkich paliw, eksplozji i całej grafiki 1:1.
