# Asset Inventory & Licensing Policy

## Policy

Before any external model, texture, audio sample, or font is added to this
project:

1. Identify the exact source (URL, marketplace, author).
2. Record the license (e.g. CC0, CC-BY, a specific store EULA).
3. Confirm the license permits this project's use (a commercial/distributable
   game, modification allowed, no NC restriction that would block it, etc).
4. Preserve any required attribution text here, verbatim, next to the asset.
5. If the license is unclear or unverifiable, do not use the asset — find a
   substitute or build it procedurally instead.

Every entry below must be added at the same time the asset is committed, not
after. An asset with no entry here should be treated as unauthorized.

## Current inventory

**Nothing external is used yet.** Every visual and audio asset in the
repository as of this writing is generated at runtime:

| Category | Technique | Where |
|---|---|---|
| Geometry | Three.js primitives (Box/Sphere/Cylinder/Plane) composed into props/architecture | `src/scenes/VerticalSliceScene.ts`, `src/entities/LowPolyHuman.ts` |
| Color/albedo textures | Canvas 2D noise + procedural pattern drawing | `src/engine/materials/proceduralTextures.ts`, `src/engine/materials/materialKits.ts` |
| Normal maps | Sobel-derived from procedurally generated height noise | `src/engine/materials/normalMap.ts` |
| Roughness maps | Canvas grayscale noise | `src/engine/materials/materialKits.ts` |
| Audio (SFX, ambience) | Web Audio oscillators + filtered noise buffers | `src/engine/audio/AudioManager.ts` |
| Fonts | System monospace fallback (`Courier New`), no font file bundled | `src/styles.css` |

Because nothing here is sourced externally, there are no attribution
obligations or license files to ship yet.

## Pipeline for future authored assets

`src/engine/assets/AssetLoader.ts` is a ready-but-unused GLTFLoader wrapper.
When a real `.glb` is sourced and cleared under the policy above:

1. Add it under `public/models/` (or a CDN-backed path, if the project moves
   to one) and add a row to the inventory table above with source + license.
2. Follow the loader's naming conventions so it integrates without bespoke
   glue code:
   - `COL_*` nodes are hidden collision proxies, pulled into
     `CollisionWorld` instead of rendered.
   - `INTERACT_*` nodes carry a glTF `extras.interactPrompt` string and are
     auto-registered as an `Interactable`.
   - LOD variants (if the asset needs them) use `LOD0_`/`LOD1_` prefixes.
2. Prefer original modeling for the game's signature assets — the ambulance,
   Archer, Johnny's first-person hands, the patient, and the monster — over
   found assets, so the game has a consistent, ownable identity rather than
   a patchwork of mismatched kit pieces. Generic set-dressing (a chair, a
   crate, a rock) is a more reasonable place to use a cleared third-party
   asset if one fits the art direction.

## Art direction notes for anyone sourcing assets later

- Low-poly, flat-shaded or lightly baked look; avoid high-frequency detail
  that fights the retro low-res render target.
- Textures should read at roughly 64–128px before the engine's nearest-
  filtering and internal low-res render target touch them — higher-res
  source textures just get thrown away by the pixelation, so there's no
  benefit to sourcing 2K/4K maps.
- Keep the palette desaturated and cold (see `materialKits.ts` for the
  established tones) except for warm practical light sources (lamps,
  candles, the ambulance's interior lighting) and the red accent used for
  blood/warning/emergency elements.
