import * as THREE from 'three';

/**
 * BlockCraft 2.8 „Płynny świat”.
 *
 * Tafla wody dostaje delikatnej fali (atrybut `aWave` ustawiany tylko na
 * górnych ścianach płynów), a światło bloków (pochodnie, lawa, jasnogłaz)
 * działa dokładnie tak jak wcześniej. Wersja shadera jest częścią klucza
 * programu, więc materiały z falą i bez niej nie dzielą skompilowanego
 * programu.
 */
export function patchChunkMaterial(
  mat: THREE.MeshBasicMaterial,
  uDay: { value: number },
  opts: { water?: boolean; time?: { value: number } } = {}
) {
  const water = !!opts.water;
  const uTime = opts.time ?? { value: 0 };
  mat.userData.uDay = uDay;
  mat.userData.uTime = uTime;
  mat.color.setRGB(1, 1, 1);
  mat.customProgramCacheKey = () => (water ? 'blockcraft-blocklight-2-water' : 'blockcraft-blocklight-2');
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDay = uDay;
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float aBlock;\n' +
          (water ? 'attribute float aWave;\nuniform float uTime;\n' : '') +
          'varying float vBlock;'
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n\tvBlock = aBlock;' +
          (water
            ? '\n\tif (aWave > 0.5) {\n\t\ttransformed.y += sin(uTime * 1.7 + transformed.x * 0.8 + transformed.z * 0.65) * 0.045;\n\t}'
            : '')
      );
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
