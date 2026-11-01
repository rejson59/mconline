# GUI 4.8.0 — wzorzec Minecraft Java 1.20.4

To przebudowa aktywnego interfejsu, nie nowa nakładka na stary launcher.
Projekt nadal używa własnego silnika przeglądarkowego, zapisów i protokołu
multiplayer. Nie jest oficjalnym Minecraftem ani implementacją całej Javy 1:1.

## Aktywne ekrany i układy

- Tytuł: oryginalny znak/edycja, sześć ścian obracającej się panoramy, bitmapowa
  czcionka z polskimi znakami, przyciski Java. Statyczne tło przy braku WebGL;
  ograniczenie ruchu respektuje preferencję systemową. Stary `#launcher`/`#client`
  prowadzi do nowego menu i jest usuwany z adresu.
- Tryb jednoosobowy: wybór, uruchamianie dwuklikiem/Enter, tworzenie, edycja,
  kopiowanie, eksport, import i potwierdzenie usunięcia świata. Tworzenie ma
  zakładki Gra/Świat. Istniejące światy, ich identyfikatory i klucze pamięci
  pozostają bez migracji.
- Opcje: grafika, FOV, dźwięk, sterowanie i wygląd; rzeczywiste ustawienia silnika,
  bez atrap nieobsługiwanych kategorii. Opcjonalne narzędzia projektu są w
  „Rozszerzeniach”, konto Rejson w „Informacjach”.
- Pauza i śmierć: przyciski i układ Java. Zapis i wyjście, powrót do gry,
  odrodzenie. Początkowy przycisk wejścia jest potrzebny do przechwycenia myszy
  przez przeglądarkę; nie udaje funkcji oryginalnego klienta.
- Plecak: 176×166 logicznych pikseli, 2×2, zbroja, druga ręka, 27 miejsc i hotbar.
  Stół: 176×166, 3×3. Podgląd renderuje prawdziwy model 3D ze skórą, wyposażeniem
  i obrotem do wskaźnika; portret jest rezerwą bez WebGL.
- Creative: 195×136, sześć zakładek górnych i pięć dolnych dla obsługiwanej
  zawartości, wyszukiwanie, przewijanie, osobny panel przetrwania i kosz.
  Nie ma pozornych jaj przyzywających ani funkcji operatora, których silnik
  nie obsługuje. Nie jest to pełny katalog oryginalnej gry.
- Kontenery, handel i plecak mają wspólną skalę; podpowiedź i ikona kursora
  skalują się razem z GUI. Podpowiedzi są ograniczane do obszaru ekranu.
- HUD: hotbar 182×22, wybór 24×23, serca, głód, pancerz, powietrze, XP,
  poziom, celownik, toasty postępów i lista pod przytrzymanym Tab. Bez stałej
  listy graczy, liczbowego zdrowia i obowiązkowego FPS.
- Czat desktopowy jest przezroczysty i ma pole przy dolnej krawędzi; dodatkowe
  przyciski i zamykanie pozostają na dotyku. Lokalny/P2P multiplayer i inne
  narzędzia projektu pozostają dodatkami, nie funkcjami oficjalnego klienta.

## Zachowanie ekwipunku

- LPM: cały stos z istniejącego slotu; PPM: połowa/podłożenie jednej sztuki.
- Shift, klawisze 1–9, F, Q/Ctrl+Q i dwuklik zachowują wspólną nawigację.
- Przy trzymanym stosie przeciąganie LPM rozkłada równe części; PPM po jednej.
  Reszta zostaje na kursorze. Limity, filtry slotów, metadane i powtórne
  przejście przez ten sam slot nie powodują kopiowania/usuwania przedmiotów.
  Utrata fokusu/anulowanie wskaźnika przerywa oczekujące przeciąganie.
- Klik poza panelem nie zamyka plecaka. LPM wyrzuca trzymany stos, PPM jedną
  sztukę, z zachowaniem nazwy, zaklęć i trwałości. E/Esc zamyka okno.
- Książka **układa składniki**, nie daje gotowego przedmiotu do plecaka.
  Wynik trzeba odebrać z pola wyniku. Brak składników daje tylko podgląd-widmo.
  Układanie jest atomowe: zajęty kursor, brak surowców lub brak miejsca na
  zwrot poprzedniej siatki nie narusza ekwipunku.
- Creative: LPM bierze jedną sztukę, Shift/środkowy przycisk pełny stos,
  1–9 przypisuje stos do hotbara; kosz usuwa kursor, Shift+kosz wyposażenie.
- Naprawiono niespójne wzory stołu zaklęć, tarczy i kowadła. Terakota jest
  wypalana z bloku gliny zamiast nieosiągalnego przepisu kolidującego z cegłą.
  Przepis fiolki poprawnie wymaga stołu. Testy układają każdy przepis z dokładnie
  odliczonych materiałów i sprawdzają rzeczywisty wynik siatki.

## Skala i preferencje

`guiScale`: 0 = Auto, 1–4 = żądana skala. Całkowite powiększenie utrzymuje
minimum 320×240 pikseli logicznych. Tylko ekran mniejszy niż to minimum może
używać skali ułamkowej. Menus, sloty, HUD i podpowiedzi używają tego samego
algorytmu; zmiana ustawienia działa od razu i jest zapamiętywana.

Nowe domyślne ustawienia minimapy i auto-ataku są wyłączone. Jawne zapisane
preferencje gracza nie są kasowane. Stan otwarcia książki jest zapamiętywany
lokalnie. Dodatki nie zmieniają uprawnień działek, zapisu publicznego profilu
ani formatu świata. Ta wersja nie wymaga migracji bazy danych.

## Zasoby i odtwarzanie

81 obrazów GUI i 2413 znaków bitmapowych pochodzi ze wzorca Java 1.20.4.
Wszystko jest lokalnie osadzone: uruchomienie gry nie pobiera grafiki ani fontu
z zewnętrznego CDN. Prawa do grafiki/fontu nie przechodzą na licencję MIT kodu:
patrz `public/Minecraft-NOTICE.txt` oraz informacje w menu.

Generator wymaga `gh`, Pythona, Pillow, fonttools i Brotli:

```sh
python3 -m venv .venv
.venv/bin/pip install Pillow fonttools brotli
.venv/bin/python scripts/compile-java-gui.py
```

Generator pobiera przypiętą wersję 1.20.4 przez GitHub API, używa ignorowanego
cache `.cache/java-gui`, sprawdza kompletność wymaganych obrazów i tworzy
`src/game/art/javaGui.generated.ts` oraz `src/assets/java-bitmap.woff2`.
Zwykły `npm ci && npm run build` nie potrzebuje Pythona ani GitHub API.

## Weryfikacja

- `npm run typecheck`, `npm test`, `npm run build`.
- Testy silnika: wszystkie przepisy, atomowość, metadane, ukryte pola 2×2,
  skalowanie, rozmiary obrazów, równe udziały i PPM, limity i wyrzucanie kursora.
- React/jsdom: aktywne menu/opcje, przejścia multiplayer, zapisane funkcje,
  tworzenie świata, opcjonalne konto, rzeczywiste zdarzenia myszy/przeciągania,
  anulowanie przez blur, książka→siatka→wynik, creative i kosz.
- Chromium 153 z WebGL: ekrany 1280×800 i 844×390, polskie glify, podgląd 3D,
  brak błędów JavaScript; przeciąganie 10→3/3/3+1, wyrzucenie reszty PPM,
  ułożenie drewna bez craftingu, odbiór czterech desek, creative LPM=1 i MMB=64.
