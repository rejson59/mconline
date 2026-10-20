/** Single release label shared by the menu, HUD, and in-game help. */
export const GAME_VERSION = '2.16.0';
export const GAME_RELEASE_NAME = 'Pikselowe tekstury';

/**
 * 2.16: każda część moba i awatara gracza ma własną, wielobarwną teksturę
 * pikselową (sierść, łaty, runo, pancerz, tkanina, jeans), a nie jeden płaski
 * kolor. Do tego kilkadziesiąt nowych przepisów i naprawiony blackstone.
 */
export const RELEASE_HIGHLIGHTS: { title: string; text: string }[] = [
  {
    title: 'Moby wreszcie mają pikselowe tekstury',
    text: 'Krowa ma kremowe łaty na brązowej sierści, owca kędzierzawe runo, creeper ciemnozielone plamy i mech, pająk włochaty pancerz, szkielet szare pęknięcia na kościach, a golem szczotkowane żelazo z nitami. Każda część ciała ma 16×16 pikseli i kilka odcieni – koniec z jednokolorowymi klockami.',
  },
  {
    title: 'Gracze też dostali pikselowe skórki',
    text: 'Koszulka ma splot tkaniny, spodnie jeansowy ukośny splot, buty skórzaną podeszwę, włosy pasma, a skóra delikatne cieniowanie. Tekstury są wspólne dla wszystkich skórek, więc zmiana wyglądu nadal działa jednym kliknięciem, a inni gracze widzą ją na publicznym serwerze.',
  },
  {
    title: 'Nowe przepisy: schody, płyty i dekoracje',
    text: 'Doszły schody ceglane, kamienne, piaskowcowe, netherowe i kwarcowe, płyty brukowe, ceglane, piaskowcowe i netherowe, snop siana, latarnia, dzwon, blok szmaragdu, blok miodu, terakota, beton w czterech nowych kolorach i błoto. Wełnę da się teraz uwić z czterech nici, a snop siana rozmienić na dziewięć pszenicy – razem 155 przepisów.',
  },
  {
    title: 'Pełny ekran i kamera bez zoomu, panele bez scrollowania',
    text: 'Poprawka z 2.15 zostaje: pełny ekran nie przycina obrazu ani nie przybliża kamery, drążek i przyciski dotykowe są zawsze w kadrze, a okna ekwipunku, kowadła i czatu dają się przewijać (scroll) także po obrocie telefonu.',
  },
  {
    title: 'Nadal: publiczny serwer, ekwipunek i poziom',
    text: 'Auto-bicie wrogich mobów i auto-skok na każdy schodek, ekwipunek jak w Minecrafcie (siatka 2×2, stół 3×3, książka receptur), wymuszony poziom i pełny ekran na telefonie, publiczny serwer z jednym wspólnym światem i zapisem w chmurze, skórki postaci, lista komend w czacie, pochodnia w dłoni i naprawione kody zaproszeń („wrong state”) – wszystko zostaje. Jeden pień daje cztery deski, a cztery deski – stół rzemieślniczy.',
  },
];
