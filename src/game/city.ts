/** Shared city layout. Keep the SQL migration's bounds/grid in sync. */
export const CITY_WORLD_ID = 'city';
export const CITY_NAME = 'Miasto budowniczych';
export const CITY_CHANNEL = 'blockcraft-city-v1';
export const CITY_SEED = 20261101;
export const CITY_GRID = 48;
export const CITY_ROAD = 16;
export const CITY_PLOT_SIZE = CITY_GRID - CITY_ROAD;
export const CITY_MIN = -16;
export const CITY_MAX = 15;
export function cityCell(x: number): number { return Math.floor(x / CITY_GRID); }
export function cityLocal(x: number): number { return ((Math.floor(x) % CITY_GRID) + CITY_GRID) % CITY_GRID; }
export function cityBuildable(x: number, z: number): boolean {
  return Number.isFinite(x) && Number.isFinite(z) && cityCell(x) >= CITY_MIN && cityCell(x) <= CITY_MAX &&
    cityCell(z) >= CITY_MIN && cityCell(z) <= CITY_MAX && cityLocal(x) >= CITY_ROAD && cityLocal(z) >= CITY_ROAD;
}
export function cityPlotStart(cell: number): number { return cell * CITY_GRID + CITY_ROAD; }
