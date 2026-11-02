# 4.18.0 — Opcje i interfejs Java

Kolejny ograniczony etap zbliżania GUI do Minecraft Java 1.20.4, nie podmiana
silnika ani deklaracja pełnej zgodności wszystkich opcji oryginalnego klienta.

## Sześć nowych rzeczywistych preferencji

| Preferencja | Domyślnie / zakres | Rzeczywiste zastosowanie |
| --- | --- | --- |
| Wskaźnik ataku | celownik / pasek narzędzi / wyłączony | HUD pokazuje `Game.attackCooldown` względem cooldownu aktualnego narzędzia |
| Czułość przewijania | 1 / 0,01–10 | zdarzenia kółka wybierają odpowiednią liczbę slotów hotbara |
| Przewijanie zrównoważone | wyłączone | dyskretne zdarzenia mają siłę jednego kroku przed mnożnikiem czułości |
| Prędkość poświaty | 50% / 0–100% | szybkość animacji zaklętych przedmiotów w GUI; 0 zatrzymuje animację |
| Siła poświaty | 75% / 0–100% | krycie poświaty w GUI; 0 wyłącza ją wizualnie |
| Czas wyświetlania powiadomień | 1× / 0,5–10× | rzeczywisty czas toastów postępów: domyślnie 5 s, maksymalnie 50 s |

Nowe podstrony **Ustawienia myszy** i **Ułatwienia dostępu**. Istniejące
ustawienia FOV, zadrżenia kamery, kołysania i skoku są dostępne także w
odpowiedniej kategorii. Escape/Gotowe wraca z myszy do sterowania, następnie
do opcji — nie zamyka całego menu po jednym naciśnięciu.

## GUI

Osiem oryginalnych, niezmienionych PNG:

- `widget/{slider,slider_highlighted,slider_handle,slider_handle_highlighted}`:
  oryginalny nine-slice z obramowaniem **1 px** (jak `slider.png.mcmeta`),
  tło 200×20, uchwyt 8×20; fokus i hover, również obsługa klawiatury.
- `hud/{crosshair_attack_indicator_background,crosshair_attack_indicator_progress}`:
  16×4, przycinanie poziome `floor(progress*17)`.
- `hud/{hotbar_attack_indicator_background,hotbar_attack_indicator_progress}`:
  18×18, przycinanie pionowe od dołu `floor(progress*19)`.

Wskaźnik znika po pełnym odnowieniu; nie dodano jeszcze osobnego symbolu
„pełny atak na żywy cel”. Miernik nie jest rozciąganym kolorowym prostokątem.
Przełączenie opcji rzeczywiście zmienia położenie/usuwa element HUD.

Układ głównych opcji ma punkt początkowy `wysokość / 6 - 12`, dwie kolumny
150 px z odstępem 10 px, skok wiersza 24 px i Gotowe przy
`wysokość / 6 + 168`. Pozostałe podstrony mają przewijaną zawartość i stale
dostępne Gotowe. Tło jest kafelkowane stosownie do skali GUI i przyciemnione
neutralnie, zamiast dodawać brązowy filtr. Długie opisy suwaków pozostają
jednowierszowe; pełna nazwa i wartość są dostępne przez ARIA. W miarę zakresu
wykorzystano oryginalne polskie nazwy opcji, np. „Zadrżenie od obrażeń”,
„Prędkość poświaty” i „Przewij. zrównoważone”.

Źródła:
[przypięte materiały Java 1.20.4](https://github.com/InventivetalentDev/minecraft-assets/tree/90d256dfee7b6fd8014e1bc3b107e64a530c5f9b/assets/minecraft),
`textures/gui/sprites/widget`, `textures/gui/sprites/hud`, `lang/pl_pl.json`.
`scripts/compile-java-options.py` pobiera oryginalne bajty przez `gh`, bez
Pythona z dodatkowymi paczkami; cache zawiera SHA źródła i jest ignorowany.
Wszystkie osiem SHA-256 są sprawdzane przez testy. Materiały nie są MIT:
[Minecraft-NOTICE](../public/Minecraft-NOTICE.txt).

## Naprawy funkcjonalne

1. **Ręczne ustawienie a Auto:** wcześniej ekran zapisywał np. nowe chmury,
   ale `effectiveSettings` zastępowało je ponownie wartościami profilu.
   `manualVideoSettings` bierze bieżące efektywne ustawienia i zmienia
   wyłącznie żądane wartości, wychodząc z Auto. Nie nadpisuje jawnego limitu
   klatek ani skali GUI 0. Ekran pokazuje rzeczywistą efektywną grafikę.
2. **Ziemniak:** normalizator odrzucał istniejący profil `potato`. Teraz
   wszystkie cztery profile i Auto są poprawne. Wybór profilu jest jawnie
   rozszerzeniem przeglądarkowym, nie pozorną natywną opcją Fast/Fancy.
3. **Ruchy kółka:** pixel/line/page otrzymują przelicznik przeglądarkowy
   (100 px / 3 linie / 1 strona = jeden krok), z zachowaniem ułamków.
   Zmiana kierunku czyści dawną zaległość; błędy float nie gubią ostatniego
   kroku. Ogromne/nieprawidłowe delty nie mogą zatruć wybranego slotu.
   Zerowa delta nie oznacza ruchu do tyłu. Menu czyści resztę i nie zmienia
   slotu; aktywny fallback myszy działa również bez Pointer Lock.
4. **Procent cząsteczek:** krok 1%, nie 10%, więc profilowe wartości 15/35%
   nie są pozornie zaokrąglane przez natywny element HTML range.
5. **Profile sprzętu:** pomocniczy kontekst WebGL jest zwalniany natychmiast,
   także po błędzie odczytu. Awaria zwalniania nie zamyka Opcji. Brak WebGL
   nie wymusza tworzenia kolejnych nieistniejących kontekstów w testach.

## Zapis i granice

Nowe pola należą do `blockcraft-settings`, nie do świata. Brak nowego klucza,
resetowania konta, zmiany ID bloków/przedmiotów, migracji SQL czy praw miasta.
Stare ustawienia dostają bezpieczne domyślne wartości; wybrane GUI 2/Auto 0,
sterowanie, FPS i dźwięk są zachowane. Poświata jest stosowana przed pierwszym
ekranem, nie dopiero po ponownym otwarciu Opcji.

Nadal ograniczone: poświata to istniejący efekt CSS interfejsu, nie pełny
shader modeli 3D; wskaźnik pokazuje istniejące odnowienie walki, nie oznacza
pełnych zasad zadawania częściowych ciosów Java. Etykiety zbyt długie mają
wielokropek, nie natywne przewijanie napisu. Nie dodano martwych przycisków
narratora, VSync, języków czy paczek zasobów, których silnik nie obsługuje.
Nie deklarujemy natywnego protokołu multiplayer ani identyczności całego GUI.

## Weryfikacja

- Typecheck, testy, produkcyjny build i `git diff --check`: PASS.
- **17 182 sprawdzenia** = 16 379 silnika + 395 audio + 401 UI + 5 konta
  + 2 bootstrapu portalu.
- Testy migracji, skrajnych wartości, ośmiu hashy i wymiarów PNG, kadrowania
  wskaźnika, opcji zapisywanych przez prawdziwe przyciski React, zarejestrowanych
  listenerów wheel, podziału zdarzeń 10/20/30/60/120/144/1000, Auto → ręczne,
  poprawnego zwalniania GPU i awarii sterownika.
- Produkcyjny Chromium/WebGL **960×600 i 390×844**: prawdziwe menu → zapis
  preferencji → przeładowanie strony → uruchomienie zapisanego świata. Wartości
  dochodzą do `Game`, aktywnego wheel i rzeczywistego HUD. Zmiana CSS poświaty,
  siedmiosekundowy toast przy czasie ×2, wszystkie trzy pozycje wskaźnika,
  dopasowanie głównych opcji do viewportu i poprawny Escape. Zero błędów
  strony i konsoli. Mobilny viewport nie zastępuje testu fizycznego telefonu.
