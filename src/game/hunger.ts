/** Java-style food: actions build exhaustion; saturation is spent before food. */
export interface FoodState { hunger: number; saturation: number; exhaustion: number }
export function foodState(hunger = 20, saturation: unknown = 5, exhaustion: unknown = 0): FoodState {
  const clamp = (v: unknown, fallback: number, max: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : fallback;
  const food = clamp(hunger, 20, 20);
  return { hunger: food, saturation: clamp(saturation, Math.min(5, food), food), exhaustion: clamp(exhaustion, 0, 40) };
}
export function exhaust(state: FoodState, amount: number): FoodState {
  const s = foodState(state.hunger, state.saturation, state.exhaustion);
  if (!Number.isFinite(amount) || amount <= 0) return s;
  s.exhaustion = Math.min(40, s.exhaustion + amount);
  while (s.exhaustion >= 4) {
    s.exhaustion -= 4;
    if (s.saturation > 0) s.saturation = Math.max(0, s.saturation - 1);
    else s.hunger = Math.max(0, s.hunger - 1);
  }
  s.saturation = Math.min(s.hunger, s.saturation);
  return s;
}
export function eat(state: FoodState, nutrition: number, modifier: number): FoodState {
  const s = foodState(state.hunger, state.saturation, state.exhaustion);
  s.hunger = Math.min(20, s.hunger + nutrition);
  s.saturation = Math.min(s.hunger, s.saturation + nutrition * modifier * 2);
  return s;
}
