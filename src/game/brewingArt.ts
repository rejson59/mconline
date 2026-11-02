import { I } from './items';
import { POTIONS } from './brewing';
import { decodePng } from './art/miniPng';
import { JAVA_BREWING_ITEMS } from './art/javaBrewing.generated';
const names: Record<number, string> = {
  [I.BLAZE_POWDER]: 'blaze_powder',
  [I.GOLDEN_CARROT]: 'golden_carrot',
  [I.GLISTERING_MELON]: 'glistering_melon_slice',
  [I.BOTTLE]: 'glass_bottle',
};
export const JAVA_BREWING_IDS = new Set(
  [...Object.keys(names), ...Object.keys(POTIONS)].map(Number),
);
const cache = new Map<number, Uint8Array>();
/** Original model: tinted potion_overlay layer 0, untinted bottle layer 1. */
export function javaBrewingItemPixels(id: number): Uint8Array | null {
  if (!JAVA_BREWING_IDS.has(id)) return null;
  if (cache.has(id)) return cache.get(id)!.slice();
  let out: Uint8Array;
  if (names[id]) out = decodePng(JAVA_BREWING_ITEMS[names[id]]).data.slice();
  else {
    const glass = decodePng(JAVA_BREWING_ITEMS.potion),
      liquid = decodePng(JAVA_BREWING_ITEMS.potion_overlay);
    const color = parseInt(POTIONS[id].color.slice(1), 16),
      rgb = [(color >> 16) & 255, (color >> 8) & 255, color & 255];
    out = new Uint8Array(16 * 16 * 4);
    for (let p = 0; p < out.length; p += 4) {
      const ga = glass.data[p + 3] / 255,
        la = liquid.data[p + 3] / 255,
        alpha = ga + la * (1 - ga);
      for (let c = 0; c < 3; c++)
        out[p + c] = alpha
          ? Math.round(
              (glass.data[p + c] * ga +
                ((liquid.data[p + c] * rgb[c]) / 255) * la * (1 - ga)) /
                alpha,
            )
          : 0;
      out[p + 3] = Math.round(alpha * 255);
    }
  }
  cache.set(id, out);
  return out.slice();
}
