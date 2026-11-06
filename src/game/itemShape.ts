import { isDoor, RENDER } from "./blocks";
/** [x0,z0,x1,z1,y0,y1], shared by hand/drop geometry and GUI projection. */
export function itemBox(id: number): number[] | null {
  const r = RENDER[id];
  return r === 16
    ? [0, 7 / 16, 1, 9 / 16, 0, 1]
    : r === 7
      ? [1 / 16, 1 / 16, 15 / 16, 15 / 16, 0, 1]
      : r === 8
        ? [0, 0, 1, 1, 0, 9 / 16]
        : r === 9
          ? [6 / 16, 6 / 16, 10 / 16, 10 / 16, 0, 1]
          : r === 10
            ? [7 / 16, 7 / 16, 9 / 16, 9 / 16, 0, 10 / 16]
            : r === 12
              ? [1 / 16, 1 / 16, 15 / 16, 15 / 16, 0, 15 / 16]
              : r === 13
                ? [5 / 16, 5 / 16, 11 / 16, 11 / 16, 0, 11 / 16]
                : r === 14
                  ? [2 / 16, 6 / 16, 14 / 16, 10 / 16, 4 / 16, 1]
                  : r === 15
                    ? [7 / 16, 7 / 16, 9 / 16, 9 / 16, 0, 14 / 16]
                    : isDoor(id)
                      ? [0, 0, 1, 1, 0, 3 / 16]
                      : null;
}
export function itemCrop(
  id: number,
): readonly [number, number, number, number] | null {
  return RENDER[id] === 10
    ? [7, 0, 9, 10]
    : RENDER[id] === 13
      ? [0, 2, 6, 9]
      : RENDER[id] === 15
        ? [7, 2, 9, 16]
        : null;
}
