/** Single release label shared by the menu, HUD, and in-game help. */
export const GAME_VERSION = '2.17.0';
export const GAME_RELEASE_NAME = 'Grafika jak w Minecrafcie';

/**
 * 2.17: prawdziwa paczka tekstur w całej grze – bloki, przedmioty, skórki
 * graczy, a moby dostają kolory z prawdziwych tekstur encji.
 */
export const RELEASE_HIGHLIGHTS: { title: string; text: string }[] = [
  {
    title: 'Wszystkie bloki proszą się o paczkę tekstur',
    text: 'Cały świat – 155 kafelków od trawy i bruku po kwarc, beton, błoto i owoce morza – rysuje się teraz teksturami z paczki w stylu waniliowego Minecrafta. Trawa i liście są zabarwione kolorami biomu z colormapy paczki, więc wyglądają dokładnie jak w oryginale.',
  },
  {
    title: 'Ekwipunek jak w prawdziwej grze',
    text: '99 z 100 przedmiotów ma oryginalne ikony: kilofy, miecze, zbroje, jedzenie, sztabki, mikstury z kolorowymi płynami, wiadra i pochodnie. Ikony są powiększane bez wygładzania, więc zostają ostre piksele – także na telefonie.',
  },
  {
    title: 'Skórki Steve’a i Alexa wprost z paczki',
    text: 'Postacie Steve i Alex używają prawdziwych skórek 64×64 rozłożonych na ciało według waniliowego układu UV (twarz, koszulka, spodnie i buty na swoim miejscu). Pozostałe skórki zachowują pikselowe tekstury z 2.16.',
  },
  {
    title: 'Moby w kolorach z paczki',
    text: 'Każdy z 14 mobów dostaje paletę wyliczoną z własnej tekstury encji: krowa brązy i kremowe łaty, creeper soczyste zielenie, szkielet chłodne szarości, świnia róż, a zombie zieleń i turkus. Odcień każdej części ciała jest dopasowany do najbliższego koloru z tej palety.',
  },
  {
    title: 'Nadal: publiczny serwer, pełny ekran, poziom i tekstury graczy',
    text: 'Pełny ekran bez zoomu kamery i z widocznymi przyciskami – panele ekwipunku i czatu dają się przewijać (scroll) także po obrocie telefonu. Auto-bicie wrogich mobów i auto-skok na każdy schodek. Ekwipunek jak w Minecrafcie: siatka 2×2, stół 3×3, książka receptur i 155 przepisów – schody i płyty z każdego materiału, latarnie, dzwony, beton i wełna. Wszystkie moby mają wielobarwne tekstury (łaty krowy, runo owcy, plamy creepera, pancerz pająka), a postacie graczy pikselowe ubrania: tkanina, jeans i skóra. Do tego publiczny serwer z jednym wspólnym światem i zapisem w chmurze, skórki postaci, lista komend w czacie, pochodnia w dłoni i naprawione kody zaproszeń („wrong state”). Jeden pień daje cztery deski, a cztery deski – stół rzemieślniczy.',
  },
];
