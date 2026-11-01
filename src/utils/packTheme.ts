/**
 * BlockCraft 2.18 – motyw interfejsu wprost z paczki tekstur.
 *
 * Elementy ekwipunku i menu są zwykłym HTML-em, więc żeby dać im grafiki
 * z paczki (`gui/sprites/container/slot.png`, `widget/button*.png`), wystarczy
 * wstawić adresy `data:` do zmiennych CSS. Dzięki temu cały interfejs zmienia
 * się w jednym miejscu, a gdyby paczka nie miała grafiki, CSS zostaje przy
 * starym wyglądzie (każda zmienna ma fallback).
 */

import { guiSprite } from '../game/art/uiSprites';

const VARS: Record<string, string> = {
  '--mc-slot-img': 'slot',
  '--mc-creative-scroller': 'creative_scroller',
  '--mc-btn-img': 'button',
  '--mc-btn-hover-img': 'button_highlighted',
  '--mc-btn-disabled-img': 'button_disabled',
};

/** Ustawia zmienne CSS z grafik paczki. Bezpieczne do wywołania w testach. */
export function installPackTheme(root?: HTMLElement | null) {
  const target = root ?? (typeof document !== 'undefined' ? document.documentElement : null);
  if (!target || !target.style) return;
  for (const [name, sprite] of Object.entries(VARS)) {
    const url = guiSprite(sprite);
    if (url) target.style.setProperty(name, `url(${url})`);
  }
}
