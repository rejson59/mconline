# 4.12 — Miasto budowniczych i działające opcje

## Wejście i zasady

1. Odśwież grę i otwórz **Tryb wieloosobowy**.
2. Zaznacz **Miasto budowniczych**, następnie **Dołącz do serwera**.
3. Masz Creative, katalog przedmiotów i lot (dwukrotna Spacja).
4. Przejdź z chronionej ulicy na wolny trawiasty kwadrat i wpisz `/dzialka zajmij`.
5. `/dzialka info` pokazuje właściciela i granice, `/dzialka lista` — współrzędne własnych działek.
6. `/dzialka zwolnij` na własnej działce oddaje teren do ponownego zajęcia. **Budowla zostaje, ale następny właściciel będzie mógł ją zmieniać.**

Działka ma **32×32**, budowanie Y=1…127. Y=0 to nienaruszalne podłoże.
Maksymalnie cztery działki na klucz przeglądarki. Siatka 48×48 zawiera
16-blokowe chronione aleje/chodniki oraz 32-blokowy kwadrat działki.
Indeksy komórek −16…15 w obu osiach dają 1024 działki, w obszarze
X/Z −768…767. Poza tym obszarem teren pozostaje chroniony.
Wolny teren nie oznacza zgody na edycję: najpierw trzeba zająć działkę.

Własność działa jak w istniejącym systemie survivalu: prywatny losowy
256-bitowy klucz zapisany lokalnie, w publicznych rekordach jedynie SHA-256.
Zmiana nicku nie odbiera praw. **Kasowanie danych strony, tryb prywatny i inna
przeglądarka/urządzenie nie przenoszą klucza.** Nie ma odzyskiwania ani
przenoszenia działek przez konto społeczności. To model capability, nie system
kont ani ochrona przed zakładaniem wielu anonimowych tożsamości.
Klucz nie trafia do Presence, czatu, adresów URL ani eksportów.

## Oddzielenie od survivalu

- Survival: `world=public`, dotychczasowy seed 20261020 i kanał bez zmian.
- Miasto: `world=city`, seed 20261101, kanał `blockcraft-city-v1`.
- Odczyt/zapis bloków, profili, dropów, kopii awaryjnych i działek jest rozdzielony po świecie.
- Generator miasta jest deterministyczny i nie generuje drzew, jaskiń, wiosek ani innych struktur.
- Creative jest stały; komenda zmiany na survival nie przełącza trybu.
- Naturalne moby i `/summon`, przejście do Netheru i obrażenia wybuchowe są wyłączone w mieście.
- Siatka ulic nie jest edytowalną przestrzenią wspólną (wybór użytkownika).
- Nie zmieniono ID bloków, formatu lokalnych zapisów ani zasobów Mojang/Microsoft.

## Ochrona po stronie bazy

Migracja `supabase/migrations/202611010001_builder_city.sql` dodaje wyłącznie
`blockcraft_city_plot` i `blockcraft_city_write_blocks`. Istniejące funkcje
survivalu nie są zastępowane; stare RPC nie obsługują miasta, nowe nie
obsługują survivalu. Wykonanie nowych RPC jest przyznane rolom `anon` i
`authenticated`, nie ogólnej roli `PUBLIC`. Funkcje mają stały `search_path`.

W bazie każda zapisywana zmiana sprawdza wymiar, zakres Y, granice miasta,
położenie poza aleją i zgodność hasha właściciela działki z prywatnym kluczem.
Brak właściciela **odrzuca** zapis. Podawanie publicznego hasha zamiast klucza
nie nadaje praw. Claim/release/write korzystają z tego samego transakcyjnego
advisory locka świata, aby sprawdzenie praw nie wyprzedzało równoległej zmiany
własności. Bezpośrednie INSERT/UPDATE/DELETE tabel bloków i działek są nadal
odebrane anonimowym i zalogowanym klientom.

Klient stosuje ten sam podział współrzędnych (w tym floor i dodatnie modulo
dla liczb ujemnych), blokuje zmiany w centralnej metodzie świata i przepływy
na granicy praw. Nie ufa edycjom przesłanym przez innego gracza w broadcast:
odczytuje zatwierdzone wersje z bazy. Odrzucona optymistyczna zmiana wraca do
wartości SQL lub do **generatora miasta**, nigdy generatora survivalu.
Nie jest to pełny autorytatywny serwer symulacji fizyki ani system moderacji.

## Ustawienia

**Opcje → Ustawienia czatu**: widoczność powiadomień HUD, krycie tekstu i tła,
skala, szerokość oraz 1–10 wierszy. Podgląd reaguje na zmiany. Wyłączenie
powiadomień nie blokuje otwarcia panelu T / komend `/`.

**Opcje → Ustawienia grafiki**: zasięg istot 50–150% bazowych 96 bloków
(moby i inni gracze, bez zmiany symulacji); FPS 30/60/90/120/144/165/240 lub
bez limitu. Ręczny limit ma pierwszeństwo również w trybie Auto jakości.
To limit, nie obietnica osiągania wybranej wydajności. Starsze ustawienia
uzupełniają domyślne wartości; uszkodzone wartości są ograniczane lub odrzucane.

## Weryfikacja i ograniczenia

- TypeScript i produkcyjny build: PASS. Harness: 11 817 sprawdzeń silnika,
  386 audio, 339 UI, 5 konta i 2 bootstrapu portalu — łącznie 12 549.
- Granice siatki i uprawnień dodatnie/ujemne, tereny wolne/cudze/ulice,
  woda, podłoże, izolacja RPC i kanałów, fallback po odrzuceniu, wymuszenie
  Creative, brak Netheru/wybuchów/summon, stronicowanie i jawny błąd nadmiarowej migawki.
- `.harness/city.sql`: rzeczywista baza jako **anon**, 29 asercji: granty,
  własny/cudzy/podrobiony klucz, drogi, teren poza miastem, wysokość/wymiar,
  limit działek, cudze zwolnienie/zajęcie, oddzielenie starego RPC i ponowne
  zajęcie oddanej działki. Całość w transakcji zakończonej ROLLBACK.
  Hashe definicji obu funkcji survivalu sprawdzono przed i po migracji.
- Chromium 153/SwiftShader: realny silnik WebGL miasta z własną budowlą,
  chronioną ulicą i cudzą działką; menu wyboru serwera na desktopie i telefonie,
  opcje czatu/FPS i zachowanie ustawień po odświeżeniu. Brak błędów JS/shaderów
  w końcowym teście silnika. Test graficzny korzysta z lokalnego transportu
  testowego, **nie** z dwóch żywych klientów Supabase.
- Brak rzeczywistego testu dwóch urządzeń/pełnego Realtime w tej sesji:
  bezpośrednie połączenia przeglądarki sandboxa do Supabase są ograniczone.
  Test uprawnień SQL wykonano przez połączony konektor na aktywnym projekcie.
- Miasto wczytuje stronicowaną migawkę do **300 000** zmian bloków. Przekroczenie
  limitu jawnie przerywa wejście zamiast ukrywać część budowli. Nie jest to
  nieograniczony serwer: dalszy rozwój dużego miasta wymaga streamingu regionów.
  Limit dotychczasowego survivalu pozostaje bez zmian.
- Wspólny jest zapis bloków. Zawartość pojemników i cała symulacja maszyn nie
  stanowią pełnego współdzielonego odpowiednika Minecraft Java; nie należy
  traktować miejskich skrzyń jako wspólnego magazynu wartościowych przedmiotów.
- Istniejące zależności developerskie mają ostrzeżenia `npm audit`
  (`vite`, `source-map-js`); aktualizacja zależności nie była częścią tej zmiany.

To przeglądarkowy silnik projektu, a nie natywny serwer Minecraft Java/Bedrock.
Oryginalne materiały zachowują dotychczasowe noty prawne; brak nowo kopiowanych zasobów.
