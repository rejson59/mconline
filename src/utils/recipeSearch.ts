import type { Recipe } from '../game/inventory';
import { displayName, itemDef } from '../game/items';

/** Search should work naturally with or without Polish diacritics. */
export function normalizeRecipeQuery(value: string): string {
  return value
    .replace(/[łŁ]/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pl')
    .trim();
}

/** Match the result name and every ingredient name (e.g. “kilof”, “drewno”). */
export function filterRecipes(recipes: readonly Recipe[], query: string): Recipe[] {
  const needle = normalizeRecipeQuery(query);
  if (!needle) return [...recipes];
  const searchableName = (id: number) => [displayName(id), ...(itemDef(id)?.keys ?? [])].join(' ');
  return recipes.filter((recipe) => {
    const text = [searchableName(recipe.out.id), ...recipe.inputs.map((input) => searchableName(input.id))]
      .map(normalizeRecipeQuery)
      .join(' ');
    return text.includes(needle);
  });
}
