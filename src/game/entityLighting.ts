import * as THREE from "three";
import { heldFieldGLSL, type HeldLightField } from "./heldLightField";
import {
  AMBIENT,
  MOON_SKY,
  SKY_BASE,
  SUN_GAIN,
  HELD_RANGE,
  type HeldLightState,
  type SunState,
} from "./lighting";
import type { World } from "./world";

interface EntityState {
  light: { value: THREE.Vector2 };
}
interface Options {
  day: { value: number };
  brightness: { value: number };
  held: HeldLightState;
  field: HeldLightField;
  remotes: THREE.Vector4[];
  sun: SunState;
}

/** World light-map samples replace global scene illumination on world entities.
 * Kept separate from inventory/first-person previews and nameplate sprites.
 * Materials are discovered every presentation frame so equipment, shearing,
 * taming, held items and skin replacement cannot bypass the lighting patch.
 * All maps/colours/alpha/emissive channels remain owned by their existing code. */
export class EntityLighting {
  private states = new WeakMap<THREE.Object3D, EntityState>();
  private owners = new WeakMap<THREE.Material, EntityState>();
  private heldStrength = { value: 0 };
  private sunPower = { value: 0 };
  constructor(private opts: Options) {}

  update(
    world: Pick<World, "sampleLightAt">,
    root: THREE.Object3D,
    x: number,
    y: number,
    z: number,
  ) {
    let state = this.states.get(root);
    if (!state) {
      state = { light: { value: new THREE.Vector2() } };
      this.states.set(root, state);
    }
    const light = world.sampleLightAt(x, y, z);
    state.light.value.set(light.sky, light.block);
    this.heldStrength.value = this.opts.held.strength;
    this.sunPower.value = this.opts.sun.power;
    const owner = state;
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return; // Leave nameplate sprites untouched.
      const patch = (material: THREE.Material) => {
        if (
          !(
            material instanceof THREE.MeshLambertMaterial ||
            material instanceof THREE.MeshBasicMaterial
          )
        )
          return material;
        const previousOwner = this.owners.get(material);
        if (previousOwner === owner) return material;
        // A rare shared cache material must not carry another entity's sample.
        // Clone only the material, never its borrowed texture or geometry.
        if (previousOwner) material = material.clone();
        this.owners.set(material, owner);
        this.patch(
          material as THREE.MeshBasicMaterial | THREE.MeshLambertMaterial,
          owner,
        );
        return material;
      };
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(patch)
        : patch(mesh.material);
    });
  }

  private patch(
    mat: THREE.MeshBasicMaterial | THREE.MeshLambertMaterial,
    state: EntityState,
  ) {
    const opts = this.opts,
      lambert = mat instanceof THREE.MeshLambertMaterial;
    const previous = mat.onBeforeCompile,
      key = mat.customProgramCacheKey();
    mat.customProgramCacheKey = () => `voxel-entity-1-${lambert}-${key}`;
    mat.userData.voxelEntityLighting = true;
    mat.onBeforeCompile = (shader, renderer) => {
      previous.call(mat, shader, renderer);
      Object.assign(shader.uniforms, {
        uEntityLight: state.light,
        uEntityDay: opts.day,
        uEntityBrightness: opts.brightness,
        uHeldField: { value: opts.field.texture },
        uEntityHeldPos: { value: opts.held.pos },
        uEntityHeldStrength: this.heldStrength,
        uEntityRemotes: { value: opts.remotes },
        uEntitySunDir: { value: opts.sun.dir },
        uEntitySunPower: this.sunPower,
      });
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 vEntityPosition;\nvarying vec3 vEntityNormal;",
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vEntityPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vEntityNormal = normalize(mat3(modelMatrix) * normal);`,
        );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>
        ${heldFieldGLSL}
        uniform vec2 uEntityLight;
        uniform float uEntityDay;
        uniform float uEntityBrightness;
        uniform vec3 uEntityHeldPos;
        uniform float uEntityHeldStrength;
        uniform vec4 uEntityRemotes[4];
        uniform vec3 uEntitySunDir;
        uniform float uEntitySunPower;
        varying vec3 vEntityPosition;
        varying vec3 vEntityNormal;
        float entityHeld(vec3 source, float power, float slot) {
          float t = clamp(1.0 - distance(vEntityPosition, source) / ${HELD_RANGE.toFixed(1)}, 0.0, 1.0);
          return power * min(pow(t, 1.6), heldVisibility(vEntityPosition, source, slot));
        }
        vec3 entityLightColor() {
          float sky = uEntityLight.x * max(uEntityDay, 0.0);
          float block = uEntityLight.y;
          float held = 0.0;
          if (uEntityHeldStrength > 0.001) held = entityHeld(uEntityHeldPos, uEntityHeldStrength, 0.0);
          for (int i = 0; i < 4; i++) if (uEntityRemotes[i].w > 0.001)
            held = max(held, entityHeld(uEntityRemotes[i].xyz, uEntityRemotes[i].w, float(i + 1)));
          vec3 n = normalize(vEntityNormal);
          float sun = max(dot(n, uEntitySunDir), 0.0) * uEntitySunPower * clamp(sky * 4.0, 0.0, 1.0);
          float moon = uEntityLight.x * ${MOON_SKY.toFixed(3)} * max(0.0, 1.0 - uEntityDay);
          float light = min(max(sky * (${SKY_BASE.toFixed(3)} + ${SUN_GAIN.toFixed(3)} * sun), block) + held + ${AMBIENT.toFixed(3)} + moon, 2.4);
          float low = clamp(light, 0.0, 1.0);
          light += ((1.0 - pow(1.0 - low, 4.0)) - low) * clamp(uEntityBrightness, 0.0, 1.0);
          float warm = clamp(block + held - sky, 0.0, 1.0);
          vec3 tint = mix(vec3(1.0), vec3(1.06, 0.86, 0.62), warm * 0.85);
          // Stable face contrast; global Hemisphere/Directional/Point lights
          // deliberately cannot illuminate an enclosed cave through its roof.
          return tint * light * (0.75 + 0.25 * max(n.y, 0.0));
        }
      `,
      );
      if (lambert) {
        for (const chunk of [
          "lights_lambert_fragment",
          "lights_fragment_begin",
          "lights_fragment_maps",
          "lights_fragment_end",
        ])
          shader.fragmentShader = shader.fragmentShader.replace(
            `#include <${chunk}>`,
            "",
          );
        shader.fragmentShader = shader.fragmentShader.replace(
          "vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;",
          "vec3 outgoingLight = diffuseColor.rgb * entityLightColor() + totalEmissiveRadiance;",
        );
      } else
        shader.fragmentShader = shader.fragmentShader.replace(
          "vec3 outgoingLight = reflectedLight.indirectDiffuse;",
          "vec3 outgoingLight = diffuseColor.rgb * entityLightColor();",
        );
    };
    mat.needsUpdate = true;
  }
}
