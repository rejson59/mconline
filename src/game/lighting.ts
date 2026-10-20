import * as THREE from 'three';

/**
 * BlockCraft 2.8.1 „Światło i chmury” – model oświetlenia.
 *
 * Do 2.8 shader dzielił kolor wierzchołka przez „niebo”, więc **każde**
 * zacienienie (AO, ściany, korony drzew) było skracane do 1. Efekt: płaski,
 * „wyklejony” świat, a wieczorem drzewa i inne ciemne powierzchnie zlewały
 * się w czarne plamy, bo `uDay` spadało wykładniczo szybciej niż jasność nieba.
 *
 * Teraz:
 *  - kolor wierzchołka to *zacienienie* (AO × kierunek ściany × ekspozycja
 *    na niebo), a nie „jasność do podzielenia”,
 *  - światło bloku (pochodnie, lawa) dodaje ciepły, pomarańczowy blask,
 *  - trzymana pochodnia/latarnia oświetla okolicę (uniformy `uHeld*`),
 *  - noc ma podłogę jasności, więc da się grać bez pochodni, ale jaskinie
 *    i lasy nadal są wyraźnie ciemniejsze niż otwarte pole.
 *
 * Wartości liczbowe są zdublowane w GLSL-u poniżej; `lightFactor()` to ten sam
 * wzór w JavaScripcie, używany przez testy (żeby „czarne drzewa” nie wróciły).
 */

/** Zasięg światła trzymanego przedmiotu w blokach (uniform `uHeldRange`). */
export const HELD_RANGE = 9;
/** Maksymalny blask trzymanego źródła światła. */
export const HELD_POWER = 1.45;
/** Podłoga światła otoczenia – dzięki niej noc nie jest czarna. */
export const AMBIENT = 0.055;

/**
 * Wzór z fragment shadera w wersji JS (testy + dokumentacja).
 *
 * @param skyAttr   atrybut `color.r` (zacienienie do kwadratu, 0–1)
 * @param blockAttr atrybut `aBlock` (światło bloku do kwadratu, 0–1)
 * @param uDay      jasność nieba (1 = południe, ~0.16 = noc)
 * @param held      światło trzymanego przedmiotu (0–HELD_POWER), po spadku
 */
export function lightFactor(skyAttr: number, blockAttr: number, uDay: number, held = 0): number {
  const sky = Math.sqrt(Math.max(skyAttr, 0)) * Math.max(uDay, 0);
  const block = Math.sqrt(Math.max(blockAttr, 0));
  const lit = Math.max(sky, block) + Math.max(held, 0);
  return Math.min(2.4, lit + AMBIENT);
}

/**
 * Spadek światła trzymanego przedmiotu z odległością (identyczny w GLSL-u).
 * Zwraca 0 poza zasięgiem, ~1 tuż przy graczu.
 */
export function heldFalloff(distance: number, strength: number, range = HELD_RANGE): number {
  if (strength <= 0 || range <= 0) return 0;
  const t = Math.max(0, Math.min(1, 1 - distance / range));
  return strength * Math.pow(t, 1.6);
}

export interface HeldLightState {
  /** Pozycja światła (zwykle oczy gracza) – współdzielona z uniformem. */
  pos: THREE.Vector3;
  /** 0 = brak źródła, 1 = pochodnia/latarnia; lekko migocze. */
  strength: number;
}

/**
 * Podpina model światła do materiału chunków.
 *
 * `opts.held` jest opcjonalne (testy i narzędzia mogą tworzyć materiał bez
 * gracza). Woda dostaje dodatkowo falę (`aWave` + `uTime`).
 */
export function patchChunkMaterial(
  mat: THREE.MeshBasicMaterial,
  uDay: { value: number },
  opts: { water?: boolean; time?: { value: number }; held?: HeldLightState } = {}
) {
  const water = !!opts.water;
  const uTime = opts.time ?? { value: 0 };
  const heldPos = opts.held?.pos ?? new THREE.Vector3(0, -1000, 0);
  const uHeldStrength = { value: 0 };
  opts.held?.strength !== undefined && (uHeldStrength.value = opts.held.strength);

  mat.userData.uDay = uDay;
  mat.userData.uTime = uTime;
  mat.userData.uHeldStrength = uHeldStrength;
  mat.color.setRGB(1, 1, 1);
  mat.customProgramCacheKey = () => (water ? 'blockcraft-light-3-water' : 'blockcraft-light-3');
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDay = uDay;
    shader.uniforms.uHeldPos = { value: heldPos };
    shader.uniforms.uHeldStrength = uHeldStrength;
    shader.uniforms.uHeldRange = { value: HELD_RANGE };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float aBlock;\n' +
          (water ? 'attribute float aWave;\nuniform float uTime;\n' : '') +
          'varying float vBlock;\nvarying vec3 vWorldPos;'
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n\tvBlock = aBlock;' +
          (water
            ? '\n\tif (aWave > 0.5) {\n\t\ttransformed.y += sin(uTime * 1.7 + transformed.x * 0.8 + transformed.z * 0.65) * 0.045;\n\t}'
            : '') +
          '\n\tvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uDay;
uniform vec3 uHeldPos;
uniform float uHeldStrength;
uniform float uHeldRange;
varying float vBlock;
varying vec3 vWorldPos;`
      )
      .replace(
        // 2.8.1: świadomie *nie* wstawiamy `#include <color_fragment>`.
        // Ten fragment robi `diffuseColor *= vColor`, a vColor to już
        // zacienienie do kwadratu – po dodaniu naszego światła cień byłby
        // liczony podwójnie (shade³) i las wracałby do czerni.
        '#include <color_fragment>',
        `{
		// vColor to zacienienie do kwadratu: pierwiastek wraca do liniowej skali.
		float shade = sqrt(max(vColor.r, 0.0));
		float sky = shade * max(uDay, 0.0);
		float block = sqrt(max(vBlock, 0.0));

		// Trzymana pochodnia/latarnia – łagodny spadek z odległością.
		float held = 0.0;
		if (uHeldStrength > 0.001) {
			float d = distance(vWorldPos, uHeldPos);
			float t = clamp(1.0 - d / uHeldRange, 0.0, 1.0);
			held = uHeldStrength * pow(t, 1.6);
		}

		float lit = max(sky, block) + held;
		// Ciepły odcień światła bloków i trzymanego przedmiotu.
		float warm = clamp(block + held - sky, 0.0, 1.0);
		vec3 tint = mix(vec3(1.0), vec3(1.06, 0.88, 0.66), warm * 0.85);
		vec3 lightColor = tint * min(lit + ${AMBIENT.toFixed(3)}, 2.4);
		diffuseColor.rgb *= lightColor;
	}`
      );
  };
}
