# 4.15.0 — Totem i złote serca

Kolejny ograniczony etap przybliżania własnego silnika do **Minecraft Java
1.20.4**, nie deklaracja pełnej nierozróżnialności całej gry.

## Ratunek

Przedmiot nosi oryginalną polską nazwę „Totem nieśmiertelności” z `lang/pl_pl.json`
w tej samej paczce 1.20.4; stare aliasy komend pozostają obsługiwane.

Totem sprawdzany jest wyłącznie przy śmiertelnym zwykłym trafieniu, najpierw
w głównej ręce (wybrany slot), potem w drugiej. Niewybrany hotbar, plecak,
kursor i crafting nie są rękami. Znika dokładnie jeden trzymany przedmiot.
Nie ma wymyślonego cooldownu 5/6 sekund. Kolejny poprawnie trzymany totem
może uratować przed kolejnym śmiertelnym trafieniem. `/kill` i pustka zachowują
ścieżkę wymuszonej śmierci; Creative nie zużywa totemu przy zwykłym ataku.

Aktywacja:

| Stan | Wartość |
| --- | --- |
| Czerwone zdrowie | dokładnie 1 HP |
| Dotychczasowe efekty | usunięte |
| Regeneracja II | 900 ticków = 45 s |
| Absorpcja II | 100 ticków = 5 s; 8 HP = 4 złote serca |
| Odporność na ogień | 800 ticków = 40 s |
| Głód/nasycenie | bez sztucznego uzupełnienia |

Nie cofa się `lastHurt` o cztery sekundy. Zwykłe istniejące zasady kamery i
obrażeń nadal obowiązują; ten etap nie implementuje całej natywnej nietykalności
między trafieniami ani pełnej animacji unoszącego się modelu totemu.

## Obrażenia i zegar efektów

Absorpcja jest osobnym buforem, nie podniesieniem maksymalnego czerwonego zdrowia.
Po zbroi i zaklęciach obrażenia najpierw zużywają złote HP, dopiero reszta
czerwone. Całkowicie pochłonięty cios nadal zużywa zbroję od surowej siły, ale
nie nalicza wyczerpania za utratę zdrowia. Topienie i upadki także mogą zużyć
absorpcję. Koniec efektu usuwa pozostały bufor, nie zadaje obrażeń czerwonym sercom.

Efekty aktualizują się w 20 Hz niezależnie od renderera. Regeneracja I ma okres
50 ticków (2,5 s), II 25 ticków (1,25 s). Sprawdzany jest **pozostały czas przed
odjęciem ticka**, nie osobny akumulator od ostatniego leczenia: 900 ticków
Regeneracji II może zatem uleczyć pierwszy punkt już przy pierwszym ticku.
Pełne 900 ticków zawiera 36 potencjalnych impulsów, ale zdrowie ma limit 20.
Nie ma dźwięku jedzenia przy biernej regeneracji. Śmierć i respawn czyszczą efekty.

Poziom silniejszego efektu nie jest nadpisywany słabszą miksturą, a krótsze
odświeżenie tego samego poziomu nie skraca czasu. **Nie zaimplementowano jeszcze
natywnej kolejki ukrytych słabszych efektów**, która w Java może wrócić po
wygaśnięciu silniejszego. Nadal poza zakresem są pełne receptury/czasy alchemii,
wszystkie poziomy mikstur, wszystkie efekty negatywne i pełna walka Java.

## HUD i oryginalne materiały

- Oryginalne złote serca `absorbing_full` / `absorbing_half`, z konturem pod
  przezroczystą częścią. Czerwone serca też zachowują pełny kontur pod połową.
- Dodatkowy rząd serc nad zwykłymi, pancerz przesunięty wyżej bez nakładania.
- Sześć oryginalnych ikon: regeneracja, absorpcja, odporność na ogień, szybkość,
  nocne widzenie, siła, plus oryginalna ramka. Pozytywne ikony w prawym górnym
  rogu: 24×24 logiczne piksele, grafika 18×18 z wcięciem 3 px, odstęp 1 px.
  Kolejność malejącego czasu; dokładne sortowanie kolorów przy remisach i efekty
  ambient/negatywne nie są pełną implementacją `MobEffectInstance.compareTo`.
- Krótkie efekty używają zanikania/pulsowania ikony z natywnego wzoru ostatnich
  200 ticków. Ramka nie pulsuje. Skala GUI i mobilne dopasowanie pozostają wspólne.
- Minimapę, jeśli włączona, odsunięto pod rząd efektów. Dotychczasowy toast
  osiągnięcia może chwilowo zakrywać ikony.
- Usunięte wymyślone pełnoekranowe czerwone winiety po trafieniu/przy niskim
  zdrowiu. Nie zmienia to sterowanego opcją przechylenia kamery. Pozostałe
  nakładki środowiskowe i miganie serc nie są w tym wydaniu kompletnie przebudowane.
- Dźwięk aktywacji `item.totem.use`, nie połączenie stołu zaklęć i awansu.
  Oryginalny OGG, 35 952 bajty, dekoduje się w Chromium do mono 3,42265 s.
  Podlega głośności głównej i kategorii graczy; brak pobierania w trakcie gry.

Materiały Java **dokładnie 1.20.4** z przypiętego mirrora:
[InventivetalentDev/minecraft-assets](https://github.com/InventivetalentDev/minecraft-assets/tree/90d256dfee7b6fd8014e1bc3b107e64a530c5f9b/assets/minecraft).
Kompilator `scripts/compile-java-rescue.py` wymaga tylko Python 3 i `gh`, korzysta
z ignorowanego cache; wynik `src/game/art/javaRescue.generated.ts`. Obejmuje
9 PNG i 1 OGG. Powtórne uruchomienie daje identyczny plik. Nie regeneruje fontów
ani wcześniejszej dużej paczki dźwięków.

| Surowy plik | SHA-256 |
| --- | --- |
| absorbing_full.png | `b052942e6992f2d5554d092245004c29c7ed81473174cc48394c0f02c3b8632b` |
| absorbing_half.png | `590f3fe3d3f69bffe1feed59c37ee41d40705c735f4fab70c69177bfc0fdc800` |
| use_totem.ogg | `9d3a53dd9c6098021e87707a7942502ff35bb529efaed87b602030c201372674` |

Te grafiki i nagranie **nie są objęte MIT kodu projektu**. Prawa pozostają przy
Mojang/Microsoft i odpowiednich autorach; [informacja o prawach](../public/Minecraft-NOTICE.txt).

Pomocniczy odczyt mechaniki: [mahtomedi/minecraft](https://github.com/mahtomedi/minecraft/tree/6ac5fe18be48a7395be84148be051908111d6772),
`LivingEntity.checkTotemDeathProtection`, `MobEffectInstance.tick`, `Gui.renderEffects`.
**Ten mirror identyfikuje się jako 1.20.3-pre1, nie 1.20.4**. Nie przedstawiamy
go jako dowodu pełnej zgodności docelowego klienta ani kopiowania całych klas.

## Zapis i zgodność

Lokalny `SaveData` i `PlayerProfile` mają opcjonalne `status`:
`{effects:[{id,ticks,amplifier}],absorption}`. W wierszu bazy jest to kolejny
metadany element istniejącego JSON `inv`, **indeks 51**, po dotychczasowych
osiągnięciach 50. Pierwsze 36 slotów, kursor, crafting, zaklęcia, druga ręka,
pokwitowania dropów, jedzenie i osiągnięcia zachowują swoje indeksy. Writer
uzupełnia krótkie wejściowe tablice do 36 slotów, aby nie przesunąć metadanych.
Istniejący trigger osiągnięć modyfikuje 50, nie ucina ogona po 50.

- Brak nowych kolumn SQL i migracji, ID świata/bloków/przedmiotów oraz zmian RLS.
- Czas pozostaje w tickach; nie biegnie, kiedy gracz jest offline.
- Odtworzenie **nie przyznaje absorpcji ponownie**: np. pozostałe 2,5 HP nie
  zmienia się z powrotem w 8. Wygaśnięty/brakujący efekt nie daje wolnych HP.
- Normalizator akceptuje tylko obsługiwane nazwy, dodatnie skończone ticki,
  wspierane poziomy i bufor do pojemności efektu (maksymalnie 8 HP w tym etapie).
  Limit zapisu czasu wynosi 72 000 ticków, czyli godzinę.
- Stare zapisy bez `status` nadal działają. Starsze karty należy odświeżyć,
  bo dawny klient nie zapisuje tego nowego ogona.
- Poprawiono dodatkowo **samą metodę `Game.applyProfile`**, która mimo poprawnej
  sanitacji nadal podnosiła zdrowie poniżej 1 HP. Teraz odczyt zachowuje np. 0,25.
- To nie zmienia profili w autorytatywny system anty-cheat; użytkownik nadal
  kontroluje klienta przeglądarkowego. Miasto i survival pozostają rozdzielone.

## Weryfikacja

`npm run typecheck`, `npm test`, `npm run build`, `git diff --check`: PASS.
**12 848 sprawdzeń**: 12 096 silnika, 390 audio, 355 UI, 5 konta i 2 portalu.

Nowe testy obejmują główną/drugą rękę, pierwszeństwo, niewybrany hotbar/plecak,
brak sztucznego cooldownu, force/Creative, brak uzupełniania jedzenia, absorpcję
po zbroi, środowisko, wygaśnięcie bufora, śmierć/respawn, 20/30/60/144 FPS,
regenerację opartą o pozostałe ticki, zapis lokalny i cloud-tail, rzeczywiste
`Game.applyProfile`, niepoprawne dane, oryginalne rozmiary PNG/hash i Web Audio.

Chromium/WebGL, pełny obiekt Game + React HUD: desktop 960×600 i mobilny viewport
390×844. Po ratunku 1 HP / 8 HP / 45 s / 40 s, cztery złote serca, trzy ikony,
pancerz nad sercami, brak czerwonej winiety i błędów strony/konsoli. Bufor po
trafieniu i odtworzeniu pozostaje 5 HP, po 5 s znika, a czerwone HP wynosi 5.
OGG rzeczywiście dekodowany przez Web Audio. Trzeci test tworzy Game z lokalnym
SaveData i potwierdza 0,25 czerwonego HP, 2,5 złotego HP i pozostały czas.
Nie jest to test fizycznego telefonu ani sesji dwóch aktywnych klientów Realtime.
