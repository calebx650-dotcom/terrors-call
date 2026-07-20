# Terror's Call — Technical Architecture

This document started as the "first task" deliverable (design analysis +
architecture for the initial vertical slice) and is now kept current as the
game grows. §§1–9 cover the original house-arrival slice; §§10+ cover the
Phase 2 addition (patient extraction → house escape → ambulance → 12-minute
transport → crash), including the visual-quality benchmark work that phase
was built around.

## 1. Stack

- **React + Vite + TypeScript** — app shell, UI overlays (subtitles,
  interaction prompts, menus), state glue. React never touches the 3D scene
  graph directly; it only renders HUD/menu chrome around a canvas.
- **Three.js** — rendering, scene graph, lighting, raycasting.
- **zustand** — small global store for UI-facing state (current subtitle,
  interaction prompt, story phase, flags). The engine/scene layer is
  framework-agnostic; it reports state changes through plain callbacks that
  the React layer forwards into the store.
- **Web Audio API (native)** — all audio in the current build is
  synthesized at runtime (oscillators + filtered noise). This sidesteps
  asset licensing entirely for the vertical slice; see §7 for the plan once
  real audio assets are sourced.
- **No physics engine.** Collision is a hand-rolled AABB system
  (`CollisionWorld`) sufficient for boxy low-poly geometry. This keeps the
  dependency surface small; a physics library (e.g. Rapier/cannon-es) is a
  candidate only if later phases need capsule-vs-mesh collision, ragdolls,
  or something the AABB approach can't express.

## 2. System breakdown

```
src/
  engine/
    core/
      GameEngine.ts        — renderer/scene/camera ownership, main loop
      PlayerController.ts  — WASD + mouse-look, pointer lock, footsteps
      CollisionWorld.ts     — AABB colliders, axis-sliding movement resolution
      Flashlight.ts         — camera-rigged spotlight with battery flicker
      InteractionSystem.ts  — center-screen raycast against registered targets
    audio/
      AudioManager.ts       — procedural synthesis (footsteps, wind, drone,
                               creaks, whispers, stingers)
    dialogue/
      DialogueSystem.ts     — timed line queue -> subtitle callback
    horror/
      HorrorDirector.ts     — ambient event scheduler, tension-staged event pool
    postfx/
      RetroPostFX.ts        — low-res render target + grain/dither shader pass
    materials/
      proceduralTextures.ts — canvas-generated, nearest-filtered surface textures
                               (baseline flat single-texture materials)
      normalMap.ts           — Sobel-derived normal maps from procedural height noise
      materialKits.ts         — map+normal+roughness "kits" built from the same
                                pattern (the visual-benchmark material standard;
                                see §10)
    assets/
      AssetLoader.ts          — GLTFLoader wrapper + naming-convention scaffold
                                for future authored models (unused by content
                                today — see §11)
  entities/
    LowPolyHuman.ts         — primitive-built humanoid (Archer/patient placeholder)
  scenes/
    VerticalSliceScene.ts   — world construction + scripted sequencing for the slice
  data/
    dialogue.ts             — all scripted line content for the slice
  state/
    gameStore.ts             — zustand store (phase, subtitle, prompt, flags)
  ui/
    StartScreen.tsx, EndScreen.tsx, Hud.tsx
  App.tsx                    — engine lifecycle, mounts/unmounts on start/restart
```

**Why this split:** `GameEngine` owns everything reusable across every
future scene (ambulance interior, forest, etc.) — player movement,
collision, flashlight, interaction raycasting, post-processing, audio
manager, dialogue player. `VerticalSliceScene` owns only *content*: what
geometry exists, what the story flags are, when scripted beats fire. Later
phases add sibling scene modules (`AmbulanceScene.ts`, `ForestScene.ts`,
...) that reuse the same engine without modification. `HorrorDirector` is
intentionally decoupled from any one scene's geometry — it calls back into
the scene via a small `HorrorHooks` interface (`triggerVisualEvent`,
`getTensionStage`, `getPlayerZone`), so later scenes can register their own
event pools without changing the director itself.

## 3. Scenes/environments required for the full game

1. **House exterior + interior** (implemented) — arrival, exploration,
   patient discovery, extraction, escape.
2. **Ambulance exterior + interior** (implemented) — loading, patient
   monitoring, heart monitor, radio, transport drive, deterioration/crash.
3. **Forest** — post-crash survival loop, ambulance wreck, repair-part
   locations, monster encounters. *Not built yet* — per the brief's explicit
   instruction not to start the forest/monster before the crash is playable.
4. **Archer discovery site** — small dedicated space for the treatment/death
   scene; likely a forest sub-location rather than a separate scene class.

All of the above currently live inside one `VerticalSliceScene` instance
rather than as separate scene classes/files. See §12 for why, and the
condition under which that should change.

## 4. Asset requirements & OSS libraries

- **Geometry/textures:** none externally sourced yet. Everything is
  primitive geometry (boxes, spheres, cylinders, planes) with canvas-drawn
  textures — either the flat single-texture kind in `proceduralTextures.ts`
  or, for the visual-benchmark areas (back room, ambulance interior), the
  layered map+normal+roughness kind in `materialKits.ts` (§10). This is
  deliberate per the brief's "use placeholder assets during early
  development" instruction — it also means there is currently *zero*
  third-party asset licensing to track.
- **Audio:** synthesized via Web Audio; no sample libraries used yet.
- **Fonts:** system monospace fallback (`Courier New`) — no font files
  bundled, no license to track.
- **Libraries in package.json:** `three` (MIT), `react`/`react-dom` (MIT),
  `zustand` (MIT), `vite`/`@vitejs/plugin-react`/`typescript` (dev-only,
  MIT/Apache-2.0). All permissive; no attribution obligations beyond
  standard `LICENSE` file inclusion if redistributing.
- **When real assets are introduced** (sculpted low-poly models, recorded
  or sourced SFX, music): each asset must be logged with its source and
  license before use, per the brief's requirement. See
  [`ASSETS.md`](./ASSETS.md), which already exists and tracks this — it's
  currently an empty inventory (nothing external is used) plus the policy
  and pipeline conventions for when that changes. `src/engine/assets/AssetLoader.ts`
  is the loader those future assets route through (§11).

## 5. Save architecture (designed, not yet implemented)

The vertical slice has no save/load (a single scripted sequence doesn't
need it). For the full game:

- **Format:** a single JSON blob in `localStorage` under a versioned key
  (`terrors-call-save-v1`), containing:
  - `chapter`: which major scene/phase the player is in (house, ambulance,
    forest, etc.)
  - `flags`: the same flat `Record<string, boolean>` shape already used by
    `gameStore` — story beats fire off flags, so persisting flags plus
    chapter is enough to resume mid-story without re-simulating everything.
  - `playerTransform`: position/yaw for scenes where mid-scene resume is
    supported (forest); story scenes with heavy scripting (house, ambulance)
    checkpoint at scene boundaries instead, to avoid saving into an
    inconsistent mid-cutscene state.
  - `inventory`: collected repair parts (forest phase).
- **Why flags-first:** the existing `flags` record in `gameStore` /
  `VerticalSliceScene.flags` already models story progression as booleans.
  Extending that same shape to a persisted save avoids inventing a second
  progression model later.
- **Autosave points:** scene-transition boundaries (door opened, patient
  loaded into ambulance, crash, each major forest landmark) rather than
  continuous autosave, to keep "resume" always land somewhere narratively
  coherent.

## 6. Horror event system (implemented for the slice, extensible)

`HorrorDirector` runs a weighted random event scheduler:

- Events are tagged with a `minStage` (1–3, "strange" → "unsettling" →
  "supernatural") and a weight. Only events at or below the current stage
  are eligible each roll.
- The roll interval shortens as stage increases (14s → 10s → 7s baseline,
  jittered), so scares compound as tension rises rather than firing at a
  constant rate.
- Events call back into the active scene via `triggerVisualEvent(kind)` —
  the director has no idea what a "flickering light" *is* in Three.js terms;
  the scene owns that. This means the forest/ambulance phases can register
  entirely different visual vocabularies (e.g. "monster silhouette",
  "radio static burst") through the same scheduler.
- Scripted beats (Archer's talk, patient dialogue, door creak on open) are
  deliberately **not** routed through the director — they're direct calls
  from `VerticalSliceScene`'s sequence logic, so critical story beats are
  never at the mercy of a random roll.

## 7. Monster AI (designed for Phase 8, not built — out of vertical-slice scope)

Not implemented yet (the slice ends before the forest). Planned shape,
consistent with the "hunt via absence, not spectacle" brief:

- A finite-state monster controller: `Dormant → Stalking → Hunting → Retreating`.
- `Dormant`: monster does not exist in the scene graph; only ambient audio
  cues (implemented today via `AudioManager.whisper`/`distantThud`) hint at
  it.
- `Stalking`: monster spawns off-screen along the player's projected path,
  visible only as brief silhouette/movement glimpses (short-lived opacity
  fade-in meshes, similar in spirit to the slice's `shadow_pass` ambient
  event but for a purpose-built monster mesh instead of a flat plane).
- `Hunting`: triggered by proximity + line-of-sight checks (reuse
  `InteractionSystem`'s raycasting approach, inverted — cast from the
  monster toward the player). Movement is a simple seek-with-obstacle-avoid
  steering behavior against the same `CollisionWorld` AABBs already built
  for the player, not a full navmesh, to keep forest-scale pathing cheap.
- `Retreating`: after a stun (crowbar hit) or the player breaking
  line-of-sight for N seconds, monster returns to `Dormant` at a distance.
- No kill state — the FSM never has a "dead" node, matching the brief's "not
  permanently killable" requirement.

## 8. Original vertical slice scope (house arrival portion)

Arrival → Archer intro dialogue → approach house → open door → explore
hallway/living room/back room → optional clue reads (journal, photograph,
occult carving) with ambient horror events escalating by stage → find
patient (auto-triggered on entering the back room) → assess patient →
Archer's philosophical conversation → begin transport prep.

This used to be the whole slice. It now continues directly into Phase 2
(§10–§13) rather than ending — see §12 for the full current playable path.

## 9. Known simplifications (house portion)

- Archer does not pathfind; he teleports to his "found patient" position a
  few seconds after the door opens, and again to the ambulance loading
  point, since companion AI-follow is out of scope for this build.
- Interactable hitboxes are invisible proxy meshes sized generously around
  small/seated targets (see the patient) rather than raycasting the visible
  low-poly meshes directly — more forgiving to aim at, standard practice for
  FPS interaction systems. **This was also a real bug fix, not just a
  preference**: an early version raycast an invisible `FrontSide`-only box
  and silently never hit anything once the player could stand inside it
  (see §13 for how that was caught).
- Retro post-processing (low internal render resolution + grain/dither) is
  implemented; VHS/CRT/4:3 framing are listed in the brief as *optional* and
  are not yet built.

## 10. Visual quality benchmark

The brief drew a hard line between "add more post-processing" and "make the
underlying geometry/materials/lighting/composition actually good," and asked
for exactly one small area to be pushed to a final-quality standard before
that standard gets reused elsewhere. That area is **the back room** (the
room the patient is found in) — chosen because it was already the most
narratively important room, so the detail pass could double as
environmental storytelling rather than being arbitrary set-dressing.

**What changed there, concretely** (`VerticalSliceScene.buildRitualRoomBenchmark`):

- **Materials**: the room's walls and floor use `materialKits.ts` instead of
  `proceduralTextures.ts` — each kit generates a color map, a normal map
  (derived from procedural height noise via a Sobel filter in
  `normalMap.ts`), and a roughness map from the *same* underlying pattern,
  so the normal map's ridges/pitting actually line up with what's painted in
  the albedo. `damagedPlasterKit()` bakes in water-stain blooms, hairline
  cracks, and an exposed-lath damage patch directly into the texture rather
  than as separate decal geometry.
- **Architecture**: baseboard trim strips, a proper window (frame + emissive
  pane) instead of a blank wall.
- **Lighting**: the window drives a `SpotLight` standing in for a moonbeam
  aimed across the room — a single fixed light source the player can orient
  by, per the brief's "the player should remember individual rooms"
  instruction — plus three candle point-lights registered into the same
  ambient-flicker pool the horror director already uses, so they're not a
  parallel lighting system.
- **Atmosphere**: a `THREE.Points` dust-mote system drifts through the
  moonbeam (`buildDustParticles`), animated in the main update loop.
- **Story-supporting props, not clutter**: a chalk ritual circle decal under
  the altar, scattered papers, a propped photograph, a second chair knocked
  over — each one is there to imply the room's history, not to raise a prop
  count. The brief explicitly warned against filling every room with random
  objects; this list is deliberately short.

**What this benchmark does *not* claim**: it is still built entirely from
box/plane/cylinder primitives and procedural canvas textures — there is no
sculpted geometry, no authored UV work, no baked lighting. The improvement
is real (compare a `damagedPlasterKit` wall under the flashlight to the flat
`plasterWallTexture` wall in the hallway — the crack/stain relief is
genuinely there, not a filter), but it is a *material and lighting*
benchmark, not a modeling benchmark. Closing that gap needs actual authored
low-poly assets (§11), which nothing in this codebase produces yet.

**What should reuse this standard going forward**: any new room/scene
should default to `materialKits.ts` over `proceduralTextures.ts`, register
its practical lights into the horror director's flicker pool the same way,
and follow the "trim + one strong light source + a short list of
story-supporting props" pattern rather than an even blanket of detail. The
ambulance interior (§12) already does this — its wall material reuses
`rustedMetalKit()`, and its prop list (stretcher, cabinets, monitor, tank,
bag, radio, ceiling light, floor scuffs) was kept intentionally short for
the same reason.

## 11. Asset pipeline

`src/engine/assets/AssetLoader.ts` is a working `GLTFLoader` wrapper that
nothing currently uses — there are no `.glb` files in the project. It exists
so that when real authored assets are sourced and cleared under
[`ASSETS.md`](./ASSETS.md)'s licensing policy, they integrate through a
consistent convention instead of one-off glue code per model:

- `COL_*`-named nodes are hidden collision proxies pulled into
  `CollisionWorld` instead of rendered.
- `INTERACT_*`-named nodes carry a glTF `extras.interactPrompt` string and
  auto-register as an `Interactable`.
- LOD variants (opt-in) use `LOD0_`/`LOD1_` prefixes.

Per the brief, the game's signature assets — the ambulance, Archer, Johnny's
first-person hands, the patient, and the monster — should be original
modeling work rather than found assets, to keep the game's identity
consistent and ownable; generic set-dressing is the more reasonable place to
use a cleared third-party asset if one fits. None of that sourcing has
happened yet; this section describes the pipeline waiting for it, not
assets that exist.

## 12. Phase 2: extraction → escape → ambulance → transport → crash

The playable path now continues past "begin transport prep" (§8) into:

1. **Extraction** (`startExtraction` / `runExtractionStep`) — a 3-step
   interaction sequence reusing the existing patient `Interactable` (its
   prompt/callback are swapped between steps rather than creating new
   registrations): confirm responsiveness → secure straps → lift onto
   stretcher. The last step reparents `patientGroup` onto a new
   `stretcherGroup` and rotates it to a lying pose.
2. **Escape** (`startEscape` / `updateEscape`) — the stretcher (with the
   patient as its child) is tweened along a fixed waypoint path back to the
   exterior door at a walking pace, while the player is free to move/look
   independently (an escort sequence, not a carry mechanic — there is no
   "pick up and haul an object" system, deliberately, per the brief's "don't
   overbuild" instruction). Contextual horror beats fire once each as the
   stretcher's z-position crosses thresholds: the house "going quiet" (horror
   director paused), a door-slam, a creak from an already-cleared room, a
   shadow at the hallway's end, the patient reacting to something unseen.
   These reuse the existing `handleVisualEvent` kinds and `AudioManager`
   cues rather than inventing a parallel event system.
3. **Ambulance loading** — rear doors (`buildAmbulanceRearDoors`) open with
   the same pivoting-mesh technique as the front door. Opening them plays
   loading dialogue, then cuts the player into the ambulance interior.
4. **Ambulance interior** (`buildAmbulanceInterior`, built once on first
   entry) — a self-contained room at a distant world-space origin (`x=60`)
   so it never needs to share collision space with the house. See §10 for
   why its materials/prop list look the way they do. The cardiac monitor's
   screen is a `THREE.CanvasTexture` redrawn on heart-rate changes
   (`redrawMonitor`), showing a simple waveform + BPM readout.
5. **Transport timeline** (`startTransportTimeline`) — the "12 minutes to
   the hospital" is compressed to ~58 real seconds of scripted escalation
   via chained `setTimeout`s: calm baseline → heart rate ramping via
   `rampHeartRate` (a simple lerp-over-time, redrawing the monitor and
   driving `AudioManager.monitorBeep`'s tempo) → radio static
   (`AudioManager.radioStatic`, new) → wind rising
   (`AudioManager.setWindIntensity`, reused) → light flicker on the
   interior's practical → peak dialogue → crash. This all runs on the
   *existing* `DialogueSystem` and `AudioManager` — no parallel timeline or
   dialogue engine was introduced, per the brief's "reuse existing systems"
   instruction.
6. **Crash** (`triggerCrash`) — an audio stinger, `PlayerController.triggerShake`
   (new: a decaying random camera-position/roll jolt, separate from normal
   movement so it can't be fought with WASD), lights cut to zero, wind cut,
   then a short aftermath line and the phase-end screen. There is no
   physics-driven vehicle impact (the ambulance doesn't visually move/deform)
   — the brief allowed "physics or controlled animation where appropriate,"
   and camera shake + audio + lighting was judged sufficient to sell the
   impact without a rigid-body collision system this scope doesn't need
   elsewhere.

**Full current playable path**: arrival → house exploration → patient found
→ assessed → philosophical talk → extraction (3 steps) → escape (scripted
escort) → exit house → load ambulance → ambulance interior → transport
timeline → crash → blackout end screen ("Johnny loses consciousness").

**Explicitly out of scope still**: the forest, the monster, Archer's death —
per the brief's explicit instruction not to start those until the crash was
fully playable and verified.

## 13. Verification performed for Phase 2

Beyond `tsc --noEmit` and `vite build` (both clean), the actual browser
build was driven end-to-end with Playwright through the *entire* path above
— door open, teleport-based zone entry for the parts of movement already
proven in the original slice, then real `KeyE` presses (exercising the real
`InteractionSystem` raycasts, not mocks) through every extraction step,
waiting on real dialogue/timeline completion via state polling rather than
fixed sleeps, through the crash and the final overlay text.

This caught two real bugs before they shipped:

- The ambulance-interior ceiling collider spanned the entire room at a
  height range that always overlapped the player's bounding box, so it
  silently blocked **all** horizontal movement inside the compartment the
  moment it was added — same failure class as an earlier bug in the house
  scene (player spawning inside the original ambulance exterior's collider).
  Fixed by not giving floor/ceiling colliders at all: this engine has no
  vertical movement, so they serve no purpose and only introduce this
  failure mode.
- The player's spawn point inside the ambulance interior was close enough to
  the rear-wall collider that its bounding box already overlapped it at
  spawn. Moved the spawn point further from both walls.

Both are instances of the same lesson already noted in §9 for the house
scene: **a collider that's supposed to be a boundary must not overlap the
player's own bounding box at any position it can legitimately stand in** —
this is now the first thing to check whenever a new interior space is added.
