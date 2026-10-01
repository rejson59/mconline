import type { Stack } from '../game/inventory';
import { displayName, I } from '../game/items';
import { B } from '../game/blocks';
import { enchList } from '../game/enchant';
import { POTIONS } from '../game/brewing';

const SPECIAL_BOOTS: Record<number, string> = {
  [I.EMBER_BOOTS]: '24% mniej obrażeń od żaru (lawa, magma, ognisko).',
  [I.TIDE_BOOTS]: '35% szybszy ruch wyłącznie w wodzie.',
  [I.SOFT_BOOTS]: '40% mniej obrażeń od upadku.',
};

/** Tooltip text for a stack: name, then §5-prefixed enchantment lines. */
export function stackTooltip(s: Stack | null | undefined, fallback = ''): string {
  if (!s) return fallback;
  const list = enchList(s);
  // 2.3: przedmiot przemieniony w kowadle ma własną nazwę (jak w klasyku).
  const name = s.name ? `§e${s.name}§r\n${displayName(s.id)}` : displayName(s.id);
  // 2.4: napoje opowiadają o swoim wzmocnieniu
  const potion = POTIONS[s.id];
  const desc = potion ? `\n§7${potion.desc}` : SPECIAL_BOOTS[s.id] ? `\n${SPECIAL_BOOTS[s.id]}` :
    s.id === I.IRON_SPEAR ? '\nZasięg 5 bloków, 7 obrażeń, 0,92 s między ciosami.' :
    s.id === I.IRON_HAMMER ? '\n8 obrażeń, 1,1 s między ciosami. Rozmach przy trafieniu do 2 dodatkowych celów; szybsze kruszenie kamienia, bruku, cegieł, czernitu i bazaltu, bez niszczenia sąsiednich bloków.' :
    s.id === I.LEATHER_SHIELD ? '\nLekka tarcza: 35% ochrony przed ciosem, 60% przed strzałą; szybsze zużycie, bez spowolnienia.' :
    s.id === I.IRON_SHIELD ? '\nCiężka tarcza: 70% ochrony przed ciosem, 85% przed strzałą; ruch o 15% wolniejszy w dłoni.' :
    (s.id >= B.PAINTING_LAND_N && s.id <= B.PAINTING_SUN_W) ? '\nPPM/tap na solidnej ścianie, nie na podłodze. Kierunek utrzymuje się po zapisie. Po odkopaniu ściany obraz spada.' :
    (s.id === B.BANNER_RED || s.id === B.BANNER_BLUE || s.id === B.VASE) ? '\nPostaw na stabilnej podłodze PPM/tap. Zebrana dekoracja zwraca jeden przedmiot.' :
    (s.id >= B.CHAIR_N && s.id <= B.CHAIR_W) || s.id === B.TABLE ? '\nDrewniany mebel do wnętrz. Stawiaj na stabilnej podłodze; krzesło obraca się do spojrzenia.' :
    s.id === I.WANDER_CHARM ? '\nWłóż do jednego miejsca na talizman w ekwipunku. Ruch pieszo +5% (bez lotu). Nie działa z plecaka ani drugiego slotu.' :
    s.id === I.TIDE_CHARM ? '\nWłóż do jednego miejsca na talizman w ekwipunku. Powietrze pod wodą zużywa się o 20% wolniej. Nie działa z plecaka.' :
    s.id === I.CARROT ? '\nPosadź na roli PPM/tap (można znaleźć w wysokiej trawie). Ugotuj w piecu/kotle na pieczoną marchew.' :
    s.id === I.PUMPKIN_SOUP ? '\n+6 głodu, +1 zdrowia. Szybkość 8 s, nie kumuluje czasu; zwraca drewnianą miskę.' :
    s.id === I.RABBIT_STEW ? '\n+8 głodu, +2 zdrowia. Regeneracja 6 s, nie kumuluje czasu; zwraca drewnianą miskę.' :
    s.id === I.HARVEST_PLATE ? '\n+7 głodu, +1 zdrowia. Zryw 7 s, nie kumuluje czasu.' :
    s.id === B.TRAVEL_POT ? '\nPrzenośne gotowanie mięsa, ryb, marchwi i dyni oraz fiolka wody + łza ghasta/cukier. Jedna porcja na 5–9 s; węgiel lub patyk płaci za każdą porcję. Zawartość zostaje zapisana lub wypada po rozbiciu.' :
    s.id === I.CAMP_KIT ? '\nPPM/tap na suchej, równej ziemi rozstawia namiot, posłanie i ognisko (3 wolne pola). Każdy blok można osobno zebrać i złożyć zestaw ponownie.' :
    s.id === B.CAMP_TENT ? '\nTkaninowy namiot. Możesz z niego wraz z posłaniem i ogniskiem zrobić przenośny zestaw biwakowy.' :
    s.id === B.CAMP_COT ? '\nPPM/tap ustawia tymczasowe odrodzenie i nocą pozwala spać. Rozbicie przywraca poprzedni punkt; w Netherze nie można spać.' :
    s.id === B.SNARE ? '\nUłóż 2 struny nad 2 patykami. Postaw na ziemi, PPM/tap uzbrój za kolejną strunę. Dziki królik lub kurczak zostawi jedno mięso; zbierz PPM/tap. Bez automatycznych łupów przy rozbiciu.' :
    s.id === I.GLOW_ARROW ? '\nŚwieci 12 s na trafionej istocie lub ścianie. Wybierz X lub przyciskiem ➟.' :
    s.id === I.SLOW_ARROW ? '\nTrafioną istotę spowalnia o 45% na 6 s. Wybierz X lub przyciskiem ➟.' :
    s.id === I.MARK_ARROW ? '\nPokazuje trafioną istotę i kierunek na HUD przez 18 s. Wybierz X lub przyciskiem ➟.' :
    s.id === I.LIGHT_BOW ? '\nPełen naciąg w 0,65 s, 80% siły standardowego łuku. Ta sama amunicja i zaklęcia.' :
    s.id === I.STRONG_BOW ? '\nPełen naciąg w 1,4 s, 130% siły standardowego łuku. Ta sama amunicja i zaklęcia.' :
    s.id === I.IRON_DAGGER || s.id === I.DIAMOND_DAGGER ?
      `\nZasięg 2,2 bloku, ${s.id === I.IRON_DAGGER ? 4 : 5} obrażeń, 0,28 s między ciosami. Po uniku: +3 obrażenia z kontry.` : '';
  return list.length ? `${name}\n§5${list.join('\n')}${desc}` : `${name}${desc}`;
}

/** Renders the §5 marker as a purple span; everything else stays default. */
export function TooltipBody({ text }: { text: string }) {
  const parts = text.split('§5');
  return (
    <>
      {parts.map((part, i) =>
        i === 0 ? (
          <span key={i}>{renderNames(part)}</span>
        ) : (
          <span key={i} className="ench-name">
            {i > 1 ? '\n' : ''}
            {part}
          </span>
        )
      )}
    </>
  );
}

/** Splits a chunk on the §e / §r markers used for anvil item names. */
function renderNames(text: string) {
  return text.split(/§[er]/).map((part, i) =>
    i === 1 ? <span key={i} className="item-name">{part}</span> : <span key={i}>{part}</span>
  );
}
