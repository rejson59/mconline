# Migracja do Minecraft Java 26.3 — etap 1

Stan na **2026-11-07**. Cel migracji: **Java Edition 26.3**, najnowsze stabilne wydanie w sprawdzonym, przypiętym wykazie wersji. `26.4 Snapshot 7` jest nowszym wydaniem testowym, nie stabilnym celem.

**To nie jest ukończony port Minecrafta 26.3.** Działająca gra ma wydanie projektu 4.31.0 ([poprawki ruchu i płotów](MOVEMENT-4.31.md)), z dotychczasowymi porównaniami Java 1.20.4 i opisanymi wcześniej brakami. Nie zmieniono etykiety gry na „zgodna z 26.3” ani formatów zapisów.

## Co rzeczywiście wykonano

1. Sprawdzono wykaz wydań i metadane 26.3 w mirrorach `misode/mcmeta` i `InventivetalentDev/minecraft-assets`. Źródła przypięto do commitów w [java-reference.lock.json](java-reference.lock.json); nie do ruchomego `latest` ani snapshotu. To metadane mirrorów, nie uruchomiony oficjalny klient.
2. Pobrano do ignorowanego `.cache/minecraft-reference/26.3/` kompletny zagregowany korpus **2042 receptur** oraz **236 tagów przedmiotów**, metadane wersji i indeks plików mirrora zasobów. Sprawdzane są rozmiary i SHA-256. Dane nie trafiają do bundla przeglądarki ani do Gita.
3. Zindeksowano **28 111 ścieżek plików** mirrora, bez ucięcia odpowiedzi API. To **indeks nazw/rozmiarów**, nie pobranie ani semantyczny przegląd zawartości wszystkich plików. Wskazane pliki mają łącznie około 593 MB; samego pełnego zbioru zasobów nie pobrano.
4. Dodano porównanie starego i nowego zapisu receptur: `{item: ...}` / `{tag: ...}` versus ciągi identyfikatorów i `#tag`, nowe `result.id`, domyślne ilości, rozwijanie zagnieżdżonych tagów, odbicie i przesunięcie wzoru. Nieznany tag, cykl lub nieobsługiwany mechanizm zwraca **unverified**, a nie pozorny sukces. Liczba wyników, komponenty i dodatkowe reguły nie są ignorowane.
5. Porównano 25 plików z korpusu referencyjnego 4.30: **24 semantycznie równoważne**, **1 niezweryfikowany** (`oak_boat`: brak starego tagu desek w tym małym korpusie). Łódka nadal jest tylko referencją, nie zaimplementowaną funkcją. Wynik nie jest porównaniem całego runtime'u ani dowodem zgodności 2042 receptur.
6. Dodano 12 testów narzędzia do `npm test`, bez dostępu do sieci i bez konieczności pobierania oryginalnych danych w CI.

Raport: [benchmarks/java-26.3-audit.json](benchmarks/java-26.3-audit.json).

## Dlaczego nie instalacja całej gry w publicznym repozytorium

JAR to skompilowany program Java z bibliotekami, zależnościami natywnymi i zasobami, nie kolekcja gotowych plików TypeScript do przekopiowania. Same receptury opisują dane; nie opisują całej fizyki, AI, sieci, grafiki, generatora świata ani zachowania klienta.

Nie zainstalowano ani nie uruchomiono Minecrafta. To środowisko ma dostęp do GitHub, lecz nie do oficjalnych hostów pobierania Mojanga i bibliotek launchera. Nie obchodzono logowania, licencji, ani ograniczeń dostępu. Nie pobierano kont użytkownika i nie żądano tokenów Microsoft.

Pełna binarka i oryginalne zasoby nie powinny być dodawane do publicznego repozytorium pod licencją MIT. Pochodzenie z publicznego mirrora nie oznacza przejścia praw do projektu ani automatycznej zgody na redystrybucję. Oryginalne dane pozostają Mojang/Microsoft; w tym etapie Git zawiera własny kod audytu, metadane źródeł i wyniki porównania, nie pełny zbiór danych gry.

W dalszej pracy można porównywać zachowania z legalnie zainstalowanym klientem na przygotowanym stanowisku. Nie można jednak twierdzić, że samo posiadanie JAR zapewnia pełną zgodność ani że takie stanowisko już uruchomiono tutaj.

## Odtworzenie

Wymagane: Node 22 i skonfigurowane `gh` z dostępem do publicznych repozytoriów GitHub. Żadnych sekretów nie zapisuje się w projekcie.

```sh
npm run reference:sync   # pobiera brakujące dane ze wskazanych commitów i sprawdza SHA-256
npm run reference:audit  # ponawia porównanie offline; brak cache jest błędem
npm run test:reference  # syntetyczne regresje narzędzia; bez cache i sieci
```

Obie pierwsze komendy odtwarzają raport w `docs/benchmarks/java-26.3-audit.json`. Cache nie jest źródłem prawdy: zmiana rozmiaru/hashu zatrzymuje audyt zamiast akceptować inne dane. Lock ustala wynik na datę sprawdzenia; komenda nie podnosi automatycznie celu, gdy pojawi się kolejne wydanie. Najpierw należy sprawdzić nowe wydanie, przypiąć źródła i przejrzeć różnice.

## Następne etapy — jeszcze niewykonane

1. **Rejestry i warstwa importu:** jawna mapa identyfikatorów Java ↔ istniejące ID projektu, zachowanie wszystkich zapisów; brakujące bloki i składniki muszą być raportowane, nie zamieniane po cichu.
2. **Pełny crafting i przetwarzanie:** porównanie całego runtime'u z korpusem; osobna obsługa craftingu, pieców, kamieniarza, kowalstwa i receptur specjalnych. Do tego źródła pozyskania nowych składników w survivalu i pozostałości po craftingu.
3. **Przedmioty i rendering:** aktualne definicje przedmiotów/modeli, stany bloków i materiały; porównania obrazów w kontrolowanych scenach. Nie wymieniać globalnie atlasu bez audytu rozkładu i UV.
4. **Zachowania:** kopanie i narzędzia, fizyka, łódki/pasażerowie, moby, redstone i generacja świata — oddzielne implementacje i testy zachowań, nie tylko odczyt JSON.
5. **Zapis i multiplayer:** zgodność istniejących światów, profili i sesji; atomowość zmian, dwie rzeczywiste sesje i konflikty. Bez resetów oraz bez ponownego uruchamiania wdrożonych migracji.
6. **Macierz zgodności:** każda funkcja ma status „zgodne / różne / brak / niesprawdzone” i powtarzalny test. Dopiero po weryfikacji konkretnego zakresu zmieniać deklarację zgodności użytkowego wydania.

## Weryfikacja tego etapu

- Świeże pobranie wszystkich pięciu przypiętych artefaktów i ponowny audyt offline — PASS.
- 12 testów narzędzia: wybór stabilnej wersji, semantyka składników/tagów, brakujące/cykliczne tagi, ilości/komponenty, odbicia, nieobsługiwane typy, kompletność indeksu i spójność raportu — PASS.
- Nie zmieniono kodu silnika, danych backendu ani zapisów. Ten etap nie naprawia jeszcze otwartych funkcji z 4.30.0 i nie jest „Minecraftem 26.3 działającym 1:1”.
- Pełna regresja po dodaniu narzędzia: `npm run typecheck`, `npm test` (dotychczasowe 25 785 + 12 nowych testów) i `npm run build` — PASS. `npm audit --omit=dev` — 0 podatności.
