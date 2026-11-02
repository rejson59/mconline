# 4.16.0 — Minecraft: efekty i zgodność

## Nazwa, nie podmiana klienta

Na prośbę użytkownika interfejs używa nazwy **Minecraft**, zamiast BlockCraft:
menu Java, dawne menu i launcher, HUD/debug, karta przeglądarki, Open Graph,
noscript, nazwy pobieranych kopii świata. Nazwa paczki npm to prywatne
`minecraft-browser`; plik workflow ma nową etykietę, bez zmiany mechanizmu Pages.
Cel Minecraft Java **1.20.4** jest oddzielony od wydania przeglądarkowego **4.16.0**.
Nie pozostawiono w metadanych starego numeru 4.9.

To nadal **nieoficjalny własny silnik przeglądarkowy**, nie produkt ani klient
Mojang/Microsoft. Informacja pozostaje w stopce i ekranie „Informacje”, razem
z prawami do materiałów. Nie dodano logowania Microsoft ani zgodności serwerów
Minecraft Java/Bedrock. Nazwa wyświetlana nie stanowi deklaracji pełnej
nierozróżnialności gry ani przyznania praw do znaku towarowego.

**Bez destrukcyjnego globalnego replace:** lokalne klucze `blockcraft-*`,
znacznik formatu eksportu `blockcraft: 1`, nazwy tabel, RPC, kanałów i ID świata
pozostają takie same. Inaczej starsze światy, ustawienia, profile i serwery
wyglądałyby na utracone. Nowa konsola `minecraft.game` ma stary alias
`blockcraft.game`; oba są czyszczone po zwolnieniu Game. Nazwa repo i URL Pages
pozostają bez zmian. Archiwalne notatki nadal opisują poprzednie nazwy projektu.

Usunięto reklamowe powitanie w czacie zwykłego świata, którego oryginalna Java
nie wyświetla. Sterowanie i `/help` pozostają dostępne. Nie usunięto właściwych
komunikatów sieciowych, zasad działek czy powrotu na serwer. Usunięto też
nienatywny baner obrotu z **menu** i listy serwerów: na telefonie kurczył tekst
do kilku znaków w wierszu i zasłaniał dużą część ekranu. W **grze** nadal można
włączyć pełny ekran/obrót albo świadomie wybrać grę w pionie.

## Nakładające się efekty

Poprzednie wydanie odrzucało słabszy efekt podczas działania silniejszego.
Teraz dla obsługiwanych poziomów I/II regeneracji i absorpcji:

- Krótszy silniejszy efekt zachowuje dłuższy słabszy w tle.
- Dłuższy słabszy nałożony w trakcie silniejszego może stać się efektem ukrytym.
  Słabszy, który nie przeżyje aktywnego, nie jest niepotrzebnie kolejkowany.
- Czas ukrytego efektu maleje **równolegle**, nie startuje dopiero przy powrocie.
- Odświeżenie tego samego poziomu bierze dłuższy czas, nie sumuje czasów.
- Przedłużenie mocniejszego nie zatrzymuje czasu słabszego. Jeśli słabszy
  wygasł wcześniej, nie wróci.
- Na ticku wygaśnięcia sprawdzany jest jeszcze silniejszy efekt; słabszy może
  działać najwcześniej w **następnym** ticku. Nie ma podwójnego leczenia na granicy.
- Duży krok symulacji dzielony jest na granicy zamiany poziomu, nie liczony
  przez cały czas z jednym wzmacniaczem. Zegar nadal ma 20 Hz.

Przykład: Regeneracja I 200 ticków, potem II 50 ticków. Po 50 tickach wraca
I ze **150**, nie 200 tickami. Do tego momentu były dwa impulsy II. Następny
tick może wykonać impuls I przy pozostałych 150 tickach. Po 100 tickach całości
pozostaje I 100 ticków i łącznie trzy impulsy, niezależnie od 20/30/60/144 FPS.

`SavedEffect.hidden` jest opcjonalnym węzłem istniejącego `status`. Lokalny zapis
Game i ogon profilu `inv[51]` zachowują tę warstwę. Starsze zapisy bez niej nadal
są obsługiwane. Nie ma nowej kolumny SQL ani migracji. Sanitacja przyjmuje tylko
znane ID, skończony dodatni czas i wspierane poziomy; ukryty efekt musi być tego
samego rodzaju i ściśle słabszy. Przy dwóch obsługiwanych poziomach głębokość jest
ograniczona do jednego ukrytego węzła. Dane cykliczne/deep payload nie powodują
nieograniczonej rekurencji. Snapshot jest odłączony od bieżących map gry.

## Absorpcja

Dopasowano także zachowanie, którego samo zachowanie ukrytego czasu nie naprawia:

- **Nowe źródło** absorpcji uruchamia przyznanie złotych HP nawet wtedy, gdy
  jego krótszy czas nie przedłuży aktywnego efektu. Nie mylić tego z odtworzeniem
  zapisu — odczyt nadal nigdy nie uzupełnia zużytej osłony.
- Przychodząca absorpcja I może dać do 4 HP, nie 8 przy poziomie II. Nie obniża
  istniejącego mocniejszego bufora: 5 HP pozostaje 5, nie spada do 4.
- Powrót poziomu I po II ogranicza pojemność do 4, ale **nie dodaje HP**:
  7 → 4, natomiast 2,5 → 2,5.
- Wyczerpany do zera efekt i jego ukryta warstwa są usuwane przy następnym
  ticku efektów, zamiast pozostawania na pasku do końca całego czasu.
- Śmierć, respawn i aktywacja totemu czyszczą także ukryte warstwy.

Kolejność pancerz → zaklęcia → absorpcja → zdrowie z 4.15 pozostaje bez zmian.

## Porządek ikon

Pozytywne, nieambientowe, skończone efekty są nadal wyświetlane jak w Java,
w odwróconym porządku naturalnym. Przy takim samym czasie decyduje natywny
kolor efektu, nie kolejność wypicia/przypadkowe wstawienie do mapy. Dla dwóch
efektów dłuższych niż **32 147 ticków** również obowiązuje porządek kolorów,
a nie czasu. Dotychczasowe ikony, ramki, zanikanie i materiały 1.20.4 nie zmieniły
bajtów; nie dodano nowych materiałów ani zależności runtime.

## Źródło porównania i granice

Pomocniczy odczyt logiki:
[mahtomedi/minecraft, przypięty commit](https://github.com/mahtomedi/minecraft/tree/6ac5fe18be48a7395be84148be051908111d6772):
`MobEffectInstance.update/tick/compareTo`, `AbsorptionMobEffect`,
`LivingEntity.addEffect/onEffectUpdated/onAttributeUpdated` i kolory `MobEffects`.
**Mirror opisuje 1.20.3-pre1, nie 1.20.4**. Jest pomocniczym historycznym źródłem,
nie dowodem pełnej identyczności docelowej wersji. Prawa do istniejących
materiałów opisuje [Minecraft-NOTICE](../public/Minecraft-NOTICE.txt).

Nadal poza zakresem: pełna alchemia i wyższe/nieograniczone poziomy wszystkich
mikstur, efekty negatywne/ambient/nieskończone, natywna unosząca się animacja
modelu totemu, pełne miganie serc i cząsteczki efektów, wszystkie mechaniki walki,
świat/generacja i protokół oryginalnych serwerów. Miasto ma własne chronione
ulice/działki, a multiplayer pozostaje osobnym systemem projektu. Nie jest to
jeszcze cała gra 1:1.

## Testy

PASS: `npm run typecheck`, `npm test`, `npm run build`, `git diff --check`.
**16 498 sprawdzeń** = 15 739 silnika + 390 audio + 362 UI + 5 konta + 2 portalu.
Nowe 3 600 porównań sekwencji losowych ofert i kroków czasu z niezależnym
jednotickowym modelem odniesienia; ponadto granice zamian, zegar różnych FPS,
sanitacja cyklicznych danych, błędnych poziomów/ID, cloud-tail i rzeczywisty
lokalny `Game.save`, efekty absorpcji oraz renderowanie kolejności ikon.

Przeglądarka Chromium/WebGL, **produkcyjny single-file build**, pełny App/Game/HUD:
960×600 i mobilny viewport 390×844. Potwierdzono:

1. Minecraft w tytule, metadanych i stopce, osobny numer wydania, czytelna
   informacja o nieoficjalności i brak starej nazwy/błędu przepełnienia menu.
2. Brak menu-banera obrotu; obsługa istniejącego świata ze starych kluczy.
3. Faktyczna promocja efektów: po 2,5 s zdrowie 3, absorpcja 4, Regeneracja I
   z 7,5 s, dwa złote serca mieszczące się w HUD.
4. Zachowany identyfikator profilu i zapisana skala GUI 2.
5. Ponowne otwarcie zapisanego świata przez interfejs, nie makietę konstruktora:
   0,25 czerwonego HP / 2,5 złotego HP / II 2,5 s / ukryty I 200 ticków.
   Po 2,5 s: zdrowie 2,25, nadal 2,5 złotego HP i I 7,5 s.
6. Zero błędów strony/konsoli. Test mobilny jest viewportem Chromium, nie
   fizycznym telefonem. Nie testowano dwóch aktywnych klientów Realtime ani
   całego gameplayu/sterowania w sesji wieloosobowej.
