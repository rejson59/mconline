import { decodePng } from "./art/miniPng";
import { JAVA_FACING_TEXTURES } from "./art/javaFacing.generated";

/** Apply after procedural polishing: preserve every original Java texel. */
export function applyJavaFurnaceTextures(
  image: ImageData,
  tiles: Record<string, number>,
): void {
  for (const [name, tile] of Object.entries(tiles)) {
    const source = decodePng(JAVA_FACING_TEXTURES[name]);
    const x = (tile % 16) * 16,
      y = Math.floor(tile / 16) * 16;
    for (let row = 0; row < 16; row++) {
      image.data.set(
        source.data.subarray(row * 64, (row + 1) * 64),
        ((y + row) * image.width + x) * 4,
      );
    }
  }
}
