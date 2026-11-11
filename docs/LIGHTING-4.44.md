# 4.44 — held terrain light respects opaque walls

## Delivered scope

The existing held-torch/lantern terrain glow used only distance. A full opaque wall could not stop the local player or the four selected remote players from illuminating the room behind it. This release replaces that visibility assumption with a bounded six-neighbour voxel light field. Either hand still enables the source; the existing nearest-four, alive/visible/recent remote-source selection is preserved.

- Full opaque blocks stop propagation. Glass transmits; leaves/water attenuate an extra level. Light can travel through openings and around corners, losing a level per step.
- The fragment shader samples the air side of each terrain face, so the illuminated front of a wall is not incorrectly blacked out by its own opaque cell.
- Changes to nearby chunk identity or revision invalidate the field immediately, including edits, unload and replacement. No terrain generation or remeshing is requested by the field.
- Source movement across voxel boundaries updates the field. Movement within one cell and flicker reuse it; per-fragment radial falloff still changes smoothly.
- One nearest-filtered, non-colour 145×841 byte texture holds five independent 29³ volumes: **121,945 bytes**. CPU propagation scratch is reused. Retiring the game disposes the texture.
- The main-thread and worker terrain materials share the same atlas; the geometry/worker protocol is unchanged. No save, inventory, account, network-packet, SQL or protection-rule changes; no resets or new IDs.

**Already present, not newly claimed:** static placed-block light already propagated around opaque blocks; skylight already propagated vertically and laterally. Neither is replaced here.

## Verification

`npm run test:heldlighting`: **21 groups PASS**, included in the default `npm test` and TypeScript check. Covers negative coordinates/chunk boundaries, opaque walls, opening/resealing, corners, glass, water, all five source slots/reordering/removal, invalid coordinates, world-height boundaries, unload/replacement with the same revision, stationary/flicker caching, distant edits, production shader wiring, and actual engine main/offhand/remote source selection.

A local Node sample built all five fields in approximately **10.2 ms**; 1,000 stationary updates took approximately **9.8 ms** in that run. These are sandbox measurements, **not physical-phone performance guarantees**.

`npm run test:browser:heldlighting`: production single-file build, WebGL2 Chromium, desktop 1280×720 and touch-emulated 753×360. Uses the running game's actual material, uniforms, held-source selection and voxel field. An isolated white terrain-face probe and GPU readback avoid texture/fog/sky differences. Opaque, cutout/fire and water variants all compile without browser errors.

| Probe, red channel | Desktop | Touch emulation |
| --- | ---: | ---: |
| Open air, held torch | 100 | 98 |
| Opaque wall | 10 | 10 |
| Aperture opened | 103 | 110 |
| Aperture resealed | 10 | 10 |
| Glass wall | 103 | 110 |
| Offhand torch, opaque wall | 10 | 10 |
| Remote torch, opaque wall | 10 | 10 |
| Remote torch, open air | 111 | 111 |
| Remote source removed | 10 | 10 |
| Negative control: atlas forced white, same opaque wall | 101 | 109 |
| Actual field restored, opaque wall | 10 | 10 |

The negative control restores the old radial-only visibility while keeping the production shader and source, and demonstrably brings the leak back. It is test-only and never shipped as runtime behaviour.

Regression runs:

- Full `npm test`, `npm run typecheck`, production build and progress consistency checks PASS.
- Production meshing browser desktop/touch: exact worker/synchronous geometry and pixels (zero differences), stale replies, save/reload and cleanup PASS. Blocked Worker fallback PASS.
- Production survival browser desktop/touch: actual mining/durability/drops, recipe book, furnace 200 ticks, creeper shielding, models, existing avatar lighting and editable text PASS. No browser errors.
- Evidence: [machine-readable report](benchmarks/held-lighting-4.44.json). Raw generated browser files remain in ignored `.cache/verification444`, `.cache/verification420` and `.cache/verification443`.

## Explicit remaining work

This is **terrain held-light occlusion**, not completed world/player/cave lighting parity. The five existing avatar PointLights and global Lambert ambient/directional entity lighting are unchanged: players/mobs can still be illuminated through walls or too brightly in caves. Entity sampling/material replacement paths, animated chest lids, drops and distant LOD need their own follow-up. Thin/partial block optical shapes use the existing whole-cell opacity classification, not shape-aware light transport. Voxel steps remain visible; no temporal interpolation is claimed.

Held dynamic lighting is an existing **project extension**, not behaviour proven from an unmodified Java 26.3 client. This release does not claim original-client execution, complete native light-map parity, authenticated live multiplayer testing, physical-phone performance or a measured global completion percentage. Emulated touch and synthetic peers are labelled as such.
