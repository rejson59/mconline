import { I } from "./items";
import { decodePng } from "./art/miniPng";
import { JAVA_FURNACE_ITEMS } from "./art/javaFurnace.generated";

const names: Record<number, string> = {
  [I.CHARCOAL]: "charcoal",
  [I.RAW_IRON]: "raw_iron",
  [I.RAW_GOLD]: "raw_gold",
  [I.COAL]: "coal",
  [I.IRON]: "iron_ingot",
  [I.GOLD]: "gold_ingot",
};
export const JAVA_FURNACE_IDS = new Set(Object.keys(names).map(Number));
const cache = new Map<number, Uint8Array>();
/** Exact 16×16 Java 1.20.4 sprites in UI, hand and item entities; no recoloring. */
export function javaFurnaceItemPixels(id: number): Uint8Array | null {
  if (!JAVA_FURNACE_IDS.has(id)) return null;
  if (!cache.has(id))
    cache.set(id, decodePng(JAVA_FURNACE_ITEMS[names[id]]).data);
  return cache.get(id)!.slice();
}
