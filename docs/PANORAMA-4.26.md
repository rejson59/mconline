# 4.26 — Nie tylko wiśniowy gaj

## Zgłoszenie i przyczyna potwierdzona w kodzie

Po 4.25 nadal można było zobaczyć to samo tło: **domyślny wybór był na stałe ustawiony na `trails`**, a pozostałe scenerie znajdowały się w rozwijanym panelu. Sam obrót panoramy nie zmieniał scenerii. Dodatkowo poprzednie losowanie nie wykluczało poprzednio oglądanego tła.

Nie potwierdzono stanu pamięci podręcznej ani ustawień przeglądarki zgłaszającego; nie przypisujemy problemu cache bez dowodu.

## Poprawka

- Domyślny tryb to **Automatycznie · co 45 sekund**, nie stały wiśniowy gaj.
- Pierwsza automatyczna sceneria różni się od ostatnio oglądanej. Bez historii wybierane są góry lub Nether, żeby nowy wygląd był widoczny od razu po poprzednim domyślnym wiśniowym gaju.
- Ostatnia sceneria jest zapamiętywana osobno od wybranego trybu. Automatyczny i losowy wybór nie powtarza bezpośrednio poprzedniej scenerii po odświeżeniu.
- **Widoczny przycisk „Następne tło →”**, bez konieczności rozwijania ustawień; obok wyświetlana jest nazwa bieżącej scenerii i oznaczenie Auto.
- Co 45 sekund aktywnego menu wybierana jest kolejna z trzech scenerii. Ręczne przejście do następnej rozpoczyna pełny nowy interwał.
- Ukrycie dokumentu, wyłączenie ruchu i systemowe ograniczenie animacji zatrzymują automat. Po powrocie zaczyna się pełny interwał, bez nadrabiania pominiętych teł. Wyjście do wyboru światów/opcji/gry sprząta timer i nasłuchy.
- Ręcznie wybrana stała sceneria z 4.25 jest zachowana, nie nadpisywana automatem. Jeśli użytkownik miał takie ustawienie, może użyć nowego przycisku lub wybrać „Automatycznie” w „Tło menu”.
- Gdy zapis localStorage jest zablokowany, ostatnia sceneria jest pamiętana w tej sesji aplikacji; nie obiecujemy zachowania jej po pełnym przeładowaniu bez działającej pamięci.

To poprawka działania i dostępności wcześniejszego dodatku. **Automatyczne zmiany scenerii oraz wybór wielu teł nie są funkcjami vanilla Java 1.20.4.** Nie przedstawiamy ich jako dowodu zgodności całej gry 1:1. Nadal używane są te same trzy zestawy sześciu ścian i renderer panoramy z 4.25; nie dodano nowych grafik ani zależności. Źródła/atrybucja i opis zmniejszonych WebP: [PANORAMA-4.25.md](PANORAMA-4.25.md).

## Weryfikacja

- `typecheck`, pełne `npm test`, produkcyjny build i `git diff --check`.
- **25 350 kontroli na Node 22.22.3**: 240 panoramy/preferencji/cyklu, w tym 79 nowych, oraz 25 110 wcześniejszych. Macierz obejmuje brak natychmiastowych powtórek dla obu trybów i trzech scen, nieprawidłowe losowania, zgodność starych preferencji, odrębny klucz historii, jeden timer, pauzę, ponowne uruchomienie i spóźnione callbacki po ukryciu/odmontowaniu.
- Produkcyjny Chromium/SwiftShader: **desktop, dotykowy viewport 390×844, lokalny HTML oraz wymuszony brak WebGL**. We wszystkich czterech: świeży domyślny automat zamiast wiśniowego gaju, inna sceneria po odświeżeniu, widoczny przycisk i jego kliknięcie, cykl, brak timera dla stałej sceny, zachowanie ręcznie przypiętego tła i brak powtórki dla losowania.
- Na desktopie czekano na **rzeczywisty produkcyjny timer 45 sekund**, bez przyspieszania zegara. W pozostałych trzech środowiskach jawnie wywoływany jest przechwycony callback produkcyjnego timera — nie przedstawiamy tego jako kolejnych trzech pomiarów czasu zegarowego.
- Sprawdzono zatrzymanie automatu przy żywej zmianie `prefers-reduced-motion`, syntetycznym ukryciu dokumentu i opuszczeniu menu. Przechwycony spóźniony callback nie zmienia sceny w ukrytej karcie.
- Zachowano wcześniejsze porównania rzeczywistych ruchomych/zatrzymanych pikseli, zapis preferencji, klawiaturę/Escape, zmianę rozmiaru, utratę/odzyskanie WebGL i sprzątanie renderera. **Zero błędów konsoli i zewnętrznych pobrań** we wszystkich czterech przypadkach. Zrzuty mobilnego menu obejrzano.
- Dodatkowa produkcyjna regresja desktopowa: piec/GUI, atlas 4096 kanałów, Worker 32 736 wartości geometrii oraz zapis/odświeżenie wszystkich ośmiu stanów pieca.
- Mobilny viewport nie jest fizycznym telefonem, SwiftShader nie jest benchmarkiem sprzętowego FPS. Nie wykonywano żywej sesji multiplayer ani zmian publicznej bazy.

Raport: [benchmarks/panorama-4.26.json](benchmarks/panorama-4.26.json). Bieżące raporty i zrzuty są generowane do ignorowanego `.cache/verification426/`.

```sh
npm ci
npm run typecheck && npm test && npm run build
npm run test:panorama
npm install --prefix .cache/browser-tools puppeteer-core @sparticuz/chromium
npm run preview -- --host 0.0.0.0 --port 4173
# Drugi terminal; test desktopu rzeczywiście czeka 45 s:
npm run test:browser:panorama
BROWSER_CASES=desktop npm run test:browser:facing
```

Artefakt lokalny: `dist/index.html`, **11244871 bajtów**, SHA-256 `54f13e06f82a40a7439f304f7a3e5f6ade464c8130557ae0f895a454b1e062e3`.

Bez zmian ID, zapisów światów, SQL, protokołu multiplayer, praw działek i chronionych ulic. Pozostałe ograniczenia mechanik/craftingu/struktur wymienione we wcześniejszych wydaniach nadal obowiązują.
