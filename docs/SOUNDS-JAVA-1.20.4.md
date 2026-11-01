# BlockCraft 4.9.0 — efekty Java 1.20.4 i działające opcje

## Pochodzenie i odtworzenie

Oryginalne nagrania OGG, nie podobne oscylatory, pochodzą z lustra
[InventivetalentDev/minecraft-assets](https://github.com/InventivetalentDev/minecraft-assets/tree/90d256dfee7b6fd8014e1bc3b107e64a530c5f9b/assets/minecraft/sounds).
Źródło przypięte do commita `90d256dfee7b6fd8014e1bc3b107e64a530c5f9b`.
Mapowanie zdarzeń pochodzi z `assets/minecraft/sounds.json` tej samej rewizji.
**Nagrania nie są udostępnione na licencji MIT projektu.** Informacja o prawach
i braku powiązania z Mojang/Microsoft: `public/Minecraft-NOTICE.txt`.
Samo lustro ani ten dokument nie przyznają licencji na redystrybucję.

Powtarzalna kompilacja (Python 3 + uwierzytelnione `gh`):

```sh
python3 scripts/compile-java-sounds.py
```

Wynik: `src/game/art/javaSounds.generated.ts`, **117 zdarzeń, 232 próbki,
2 423 141 bajtów OGG** (około 208,4 s nagrań). Kompilator zachowuje do czterech
wariantów na zdarzenie, parametry wysokości, głośności i wagi. Pomija streamy
muzyczne. Cache `.cache/java-sounds/` nie wchodzi do Git. Zwykły build nie
wymaga `gh`, Pythona ani dostępu do zewnętrznych zasobów audio.

Próbki są osadzone w samowystarczalnym HTML. Dekodowanie jest leniwe,
współdzielone i buforowane; najczęstsze efekty rozgrzewają się po geście
użytkownika. Brak Web Audio, nieobsługiwany kodek lub blokada autoplay nie
przerywają gry — dany efekt pozostaje cichy, nie udaje się go syntezą.

## Mikser i instrumenty

Każda obsługiwana kategoria ma osobny GainNode przed masterem i limiterem:

| Kanał | Źródła |
|---|---|
| Muzyka | własna cicha synteza, **nie soundtrack Minecrafta** |
| Szafy grające / bloki dźwiękowe | oryginalne instrumenty bloków dźwiękowych; szaf grających jeszcze nie ma |
| Pogoda | oryginalny deszcz i grzmoty |
| Bloki | kopanie, niszczenie, stawianie, skrzynie, drzwi, dzwon, portal, TNT |
| Wrogie stworzenia | głosy i kroki wrogich mobów |
| Przyjazne stworzenia | głosy i kroki zwierząt, mieszkańców i golema |
| Gracze | kroki, obrażenia, jedzenie, łuk, zbieranie przedmiotów i awans |
| Otoczenie | odgłosy jaskiń |

Klik interfejsu używa mastera, jak w Java. Deszcz może zacząć się przy zerowej
głośności i reaguje na jej podniesienie bez zmiany pogody. Wyjście ze świata
anuluje oczekujące efekty i zatrzymuje deszcz, muzykę i aktywne źródła.
Ograniczenie 64 jednoczesnych krótkich efektów zapobiega nieograniczonemu
rozrostowi grafu. Nagrania nie mają już dodatkowego sztucznego pogłosu.
Pozycjonowane efekty używają liniowego spadku głośności i panoramy stereo.
To nadal uproszczona przestrzeń: nie ma ray-tracingu przesłaniania dźwięku.

Creeper jest cichy w bezczynności, ale stąpa po podłożu. Nie dodajemy głosu,
gdy oryginalne zdarzenie nie istnieje (np. bezczynność golema/szlamu).
Usunięto również wymyślone odgłosy łóżka, ptaków i okresowego wiatru.

Bloki dźwiękowe wybierają instrument na podstawie materiału poniżej:
fortepian, bas, bęben, werbel, hi-hat, flet, dzwonek, gitara, żelazny ksylofon,
krowi dzwonek, didgeridoo, bit, banjo, pling. Wysokość 0–24, również ostatnie
wysokie Fis, a nie zawijanie 24 do zera. To nie pełny katalog instrumentów
Java — brakujące w silniku podłoża/instrumenty nie są udawane.

## Nowe ustawienia połączone z silnikiem

- **Odwróć mysz:** działa z Pointer Lock i awaryjnym obrotem bez blokady;
  nie odwraca gestów dotykowych.
- **Jasność:** krzywa gamma mapy światła terenu, bez przebudowy chunków;
  rozjaśnia cienie, nie zmienia fizycznych poziomów światła ani spawnu.
  Nie jest filtrem CSS na HUD. Oświetlenie mobów pozostaje dotychczasowe.
- **Efekty pola widzenia:** skaluje zmiany przy sprincie/locie;
  nie wyłącza celowego przybliżenia lornetki.
- **Przechylenie przy obrażeniach:** skaluje deterministyczny przechył kamery,
  bez dawnych losowych przesunięć oczu.

Stare ustawienia dostają brakujące wartości domyślne; NaN, nieprawidłowe typy
i wartości poza zakresem nie trafiają do rendererów ani grafu audio. Presety
jakości nie nadpisują tych preferencji. Zmiany działają przy uruchomieniu
oraz na żywo w opcjach pauzy. Nie zmieniamy formatu światów ani bazy.

## Naprawy kamery, animacji i generowania

Tłumienie wykładnicze `1-exp(-rate*dt)` zastępuje zależne od FPS przybliżenie
`min(1,rate*dt)` dla FOV, wysokości oczu, amplitudy kołysania oraz obrotów ciała
i głowy mobów. Faza chodu nie jest cofana co klatkę po zatrzymaniu.
Słuchacz otrzymuje pozycję **po** ustawieniu kamery, bez błędnego zastępowania
prawidłowego zera współrzędną ciała.

Potwierdzona regresja starego generatora: superpłaski świat, seed **1**,
korzeń **(112,-148)** w chunku **(7,-10)** blokowany przez zabudowę wsi.
Mimo odwołania drzewa w tym chunku jego liść ID 6 powstawał w
**(110,68,-147)** w sąsiednim chunku **(6,-10)**. Poprawiony generator pozostawia
w tym miejscu powietrze (ID 0), niezależnie od kolejności generowania.

Dokładna maska rezerwacji działa też dla korzeni spoza aktualnego chunku;
wykorzystuje te same procedury budynków i struktur, nie przybliżony krąg.
Ma ograniczony cache, nie wczytuje rekurencyjnie sąsiadów i nie traktuje
podziemnych galerii jako zakazu lasu na powierzchni. Pnie, podobnie jak liście,
nie nadpisują litego zbocza ani wody. W dżungli limit wstępnego losowania nie
ucina już zadanej szansy 4,5% do 4%.

## Weryfikacja

`npm run typecheck`, `npm test`, `npm run build`. Nowy zestaw `.harness/audio.ts`
sprawdza zawartość oryginalnych próbek, routing grafu, kategorie, współdzielenie
dekodowania, anulowanie/deszcz, zakończenie świata i instrumenty. Zastępujemy
nieaktualne testy wymagające syntetycznych formantów i pogłosu testami nagrań;
zachowujemy regresje fizyki, GUI, zapisów i multiplayera.

Chromium 153 z programowym WebGL: wszystkie **232** OGG zdekodowane rzeczywistym
kodekiem; produkcyjny pojedynczy HTML uruchamia creative/flat, zapisuje mikser
i przekazuje nowe preferencje do silnika. Próba faktycznej kamery potwierdza
wyłączone efekty FOV/przechyłu i X/Z równe zero. Bez nieobsłużonych błędów JS.
To nie test słuchowy na urządzeniu użytkownika ani deklaracja kompletnej
zgodności silnika z Minecraftem.

Wynik końcowy: **4073** kontrole silnika, **386** audio, **327** GUI,
**5** konta (razem **4791**), plus dwa testy bootstrapu portalu. Typecheck
i produkcyjny build przechodzą. Pojedynczy HTML ma około **10,15 MB**;
oryginalne próbki zwiększają rozmiar względem 4.8.0 o około 3,23 MB Base64.
Próba przeglądarkowa potwierdza także zmianę opcji w pauzie bez restartu
oraz oba rzeczywiste handlery odwróconej myszy. Brak błędów konsoli/shaderów.
