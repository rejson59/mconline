import type { Recipe, Stack } from "./inventory";

/** Native tags are alternatives per occupied cell, not one material per recipe. */
export function ingredientMatches(
  recipe: Recipe,
  expected: number,
  actual: number,
): boolean {
  return (
    actual === expected ||
    !!recipe.ingredientChoices?.[expected]?.includes(actual)
  );
}

/** Source-slot plan, without mutation. Bounded to the nine cells of Java crafting.
 * Allocate by item ID first, most constrained cells first, then retain the exact
 * source stack's metadata. This avoids greedy failures with overlapping tags. */
export function planIngredients(
  recipe: Recipe,
  available: readonly (Stack | null)[],
  cells?: readonly number[],
): number[] | null {
  const wants = cells
    ? [...cells]
    : recipe.inputs.flatMap((s) =>
        Number.isInteger(s.count) && s.count > 0 && s.count <= 9
          ? Array<number>(s.count).fill(s.id)
          : [-1],
      );
  if (wants.filter(Boolean).length > 9 || wants.some((id) => id < 0))
    return null;
  const counts = new Map<number, number>();
  for (const s of available)
    if (s && Number.isInteger(s.count) && s.count > 0)
      counts.set(s.id, (counts.get(s.id) ?? 0) + s.count);
  const tasks = wants.flatMap((id, i) =>
    id
      ? [
          {
            i,
            options: [
              ...new Set([id, ...(recipe.ingredientChoices?.[id] ?? [])]),
            ].filter((id) => (counts.get(id) ?? 0) > 0),
          },
        ]
      : [],
  );
  if (tasks.some((t) => !t.options.length)) return null;
  tasks.sort((a, b) => a.options.length - b.options.length);
  const assigned = Array<number>(wants.length).fill(0);
  const solve = (i: number): boolean => {
    if (i === tasks.length) return true;
    for (const id of tasks[i].options) {
      const count = counts.get(id) ?? 0;
      if (!count) continue;
      counts.set(id, count - 1);
      assigned[tasks[i].i] = id;
      if (solve(i + 1)) return true;
      counts.set(id, count);
    }
    return false;
  };
  if (!solve(0)) return null;
  const left = available.map((s) => s?.count ?? 0);
  return assigned.map((id) => {
    if (!id) return -1;
    const i = available.findIndex((s, i) => s?.id === id && left[i] > 0);
    left[i]--;
    return i;
  });
}

export function consumeIngredientPlan(
  available: readonly (Stack | null)[],
  plan: readonly number[],
): (Stack | null)[] {
  const slots = available.map((s) =>
    s ? { ...s, ...(s.ench ? { ench: { ...s.ench } } : {}) } : null,
  );
  for (const i of plan)
    if (i >= 0 && slots[i] && --slots[i]!.count <= 0) slots[i] = null;
  return slots;
}
