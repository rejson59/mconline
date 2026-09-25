import * as THREE from 'three';

/**
 * Daylight is a uniform, block light is a per-vertex attribute. Torches and lava
 * stay bright at night instead of being multiplied away with the whole mesh.
 */
export function patchChunkMaterial(mat: THREE.MeshBasicMaterial, uDay: { value: number }) {
  mat.userData.uDay = uDay;
  mat.color.setRGB(1, 1, 1);
  mat.customProgramCacheKey = () => 'blockcraft-blocklight-1';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDay = uDay;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aBlock;\nvarying float vBlock;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvBlock = aBlock;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uDay;\nvarying float vBlock;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
	{
		float skyL = max(vColor.r, 0.0002);
		float lit = max(skyL * uDay, vBlock);
		diffuseColor.rgb *= lit / skyL;
	}`
      );
  };
}
