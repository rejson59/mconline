# 4.45 — world-space entity light in caves

## Fixed

World players and mobs previously used unoccluded global Hemisphere/Directional lighting and five radial PointLights. Terrain could be dark behind a roof/wall while the character was brightly illuminated. This release removes the five avatar PointLights and replaces world-entity illumination with:

1. **Static sky and placed-block light sampled from the terrain mesher's actual voxel fields**, at the presented body's centre.
2. **Per-fragment held-source light from the existing occlusion atlas**, including the local player's two hands and the nearest four selected remote sources.
3. The existing day/brightness controls, low ambient floor, warm torch tint and preserved material emissive channel for hurt/fuse flash.

Global scene lights remain for other scene uses but cannot relight patched world players/mobs through a roof or wall. Skin maps, equipment transforms, animation joints, alpha/cutouts/translucency, base colours and shared texture ownership remain unchanged. Nameplate sprites and separate first-person/inventory preview renderers are intentionally not patched.

## Data and publication

- Each meshed chunk retains **32,768 bytes**: sky and block levels packed as two four-bit values per voxel. The existing terrain light propagation is reused, not independently approximated by an entity ray or a vertical-only sky check.
- Nine neighbour identity tokens/revisions validate each sample. Tokens do not retain neighbouring Chunk objects, preventing an unloaded-chunk reference graph. A missing/unmeshed/stale sample is dark, not full daylight.
- A stale sample with its halo loaded requests a repair through the existing dirty-mesh queue. This also covers a distant halo revision that invalidates the conservative stamp without otherwise requiring that centre's terrain rebuild. Sampling never directly generates missing chunks.
- The worker returns the packed array as a transferable buffer. Only a valid, current nine-chunk snapshot can publish it; malformed/missing arrays disable the worker and leave the synchronous fallback available. Live collision/save data is never transferred or detached.
- Material discovery runs during entity presentation. New armor, held meshes, changed skins, a wolf collar or sheared/regrown sheep cannot bypass lighting. Materials are patched once per owner; cross-entity shared materials are cloned without cloning their cached texture.
- No account/backend/SQL/protection-rule, save-format, inventory, ID or multiplayer-packet changes. No resets. The internal meshing worker reply is extended within the same application build.

## Tests

### Headless: 30 groups PASS

`npm run test:entitylighting` is in the default `npm test` and TypeScript check.

Covers open sky, sealed rooms, placed light inside/outside, lateral aperture light, immediate invalidation, distant-halo repair, negative coordinates, unload/replacement, token-only stamps, exact packed field parity for flat/natural/Nether/city worlds, actual transfer detachment, stale and malformed worker replies, Lambert/Basic shader output, emissive preservation, independent per-entity uniforms, no repeated recompilation, borrowed texture ownership, late held/equipment materials, untouched sprites and all **14 mob types**, including wolf/sheep replacement paths.

### Production WebGL2 Chromium: desktop and emulated touch PASS

`npm run test:browser:entitylighting` joins an isolated local world from the production single-file build. It uses the running engine's actual Steve/Alex avatars, material patching, equipment, world samples and held-source selection. An isolated scene and GPU readback remove terrain/fog/nameplate overlap from the measured body pixel. It is not a native Java client or live-account multiplayer test.

| Actual skin pixel RGB | Desktop | Touch emulation |
| --- | --- | --- |
| Daylight outside | `[0,74,74]` | `[0,74,74]` |
| Enclosed room | `[0,3,3]` | `[0,3,3]` |
| Enclosed + extremely bright global lights | `[0,3,3]` | `[0,3,3]` |
| Held torch outside opaque wall | `[0,3,3]` | `[0,3,3]` |
| Held torch through aperture | `[0,70,70]` | `[0,70,70]` |
| Aperture resealed | `[0,3,3]` | `[0,3,3]` |
| Placed torch inside | `[0,50,43]` | `[0,50,43]` |
| Placed torch outside opaque wall | `[0,3,3]` | `[0,3,3]` |
| Synthetic remote torch outside wall | `[0,3,3]` | `[0,3,3]` |
| Remote torch through aperture | `[0,73,73]` | `[0,73,73]` |
| Negative control: force full sky in the same enclosed model's sample | `[0,74,74]` | `[0,74,74]` |
| Restore actual enclosed sample | `[0,3,3]` | `[0,3,3]` |
| Negative control: force held atlas white through the same wall | `[0,32,29]` | `[0,34,31]` |

Both controls demonstrably restore the leak using the same production shader and model; neither bypass exists in production code. Flicker can vary torch pixel values between runs.

The same run renders all 14 actual engine mob models, tint/flash, wolf collar, sheep states, changed armor/held materials and an Alex skin replacement. **27 avatar meshes patched; nameplate sprite untouched; browser errors empty.** Real-worker sample publication is compared byte-for-byte against a fresh synchronous build: **32,768 bytes, zero differences on both devices**.

### Regressions

- Full `npm test`, typecheck, production build, progress receipt check and `git diff --check` PASS.
- Existing held-terrain-light browser suite desktop/touch PASS, including its radial-leak negative control.
- Meshing browser desktop/touch: exact worker/sync geometry and pixels, stale reply rejection, save/reload and cleanup PASS. Blocked Worker fallback PASS.
- Survival browser desktop/touch: mining/durability/drops, recipes, 200-tick furnace, creeper cover and models, text editing and skin daylight/torch response PASS. Its old global-directional-light assertion now correctly exercises sampled daylight instead.
- Machine evidence: [entity-lighting-4.45.json](benchmarks/entity-lighting-4.45.json). Raw outputs remain ignored under `.cache/verification445`, `.cache/verification444`, `.cache/verification420` and `.cache/verification443`.

## Explicit boundaries

This fixes the demonstrated cave/global-light and held-wall leaks for **world players and mobs**, including worn/held meshes. It is not complete native rendering parity. Static light uses one body-centre sample, not per-limb voxel interpolation; brief conservative darkening is possible while an invalidated sample awaits meshing. Partial optical shapes still follow existing whole-cell block classifications. Nether samples inherit the existing terrain model. Distant LOD, drops, animated chest lids and first-person/preview lighting are not migrated here.

Held dynamic lighting remains the project's pre-existing extension, not a claim about unmodified Java 26.3 behaviour. No original-client execution, physical-phone performance, live authenticated cross-client multiplayer test or measured whole-game completion percentage is claimed. The extra 32 KiB per meshed chunk is a known memory cost; this release does not claim to have measured its physical-phone impact.
