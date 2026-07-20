# Terror's Call — Technical Architecture

This document is the "first task" deliverable: an analysis of the design
brief, the technical architecture chosen for it, and the scope of the
vertical slice actually implemented in this repository.

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

(Only "House — vertical slice" is implemented today.)

1. **House exterior + interior** (this slice) — arrival, exploration,
   patient discovery.
2. **Ambulance interior** — patient monitoring, heart monitor, radio,
   transport drive, deterioration/crash sequence.
3. **Forest** — post-crash survival loop, ambulance wreck, repair-part
   locations, monster encounters.
4. **Archer discovery site** — small dedicated space for the treatment/death
   scene; likely a forest sub-location rather than a separate scene class.

## 4. Asset requirements & OSS libraries

- **Geometry/textures:** none externally sourced yet. Everything in the
  slice is primitive geometry (boxes, spheres, cylinders, planes) with
  canvas-drawn, nearest-filtered textures generated in
  `proceduralTextures.ts`. This is deliberate per the brief's "use
  placeholder assets during early development" instruction — it also means
  there is currently *zero* third-party asset licensing to track.
- **Audio:** synthesized via Web Audio; no sample libraries used yet.
- **Fonts:** system monospace fallback (`Courier New`) — no font files
  bundled, no license to track.
- **Libraries in package.json:** `three` (MIT), `react`/`react-dom` (MIT),
  `zustand` (MIT), `vite`/`@vitejs/plugin-react`/`typescript` (dev-only,
  MIT/Apache-2.0). All permissive; no attribution obligations beyond
  standard `LICENSE` file inclusion if redistributing.
- **When real assets are introduced** (sculpted low-poly models, recorded
  or sourced SFX, music): each asset must be logged with its source and
  license before use, per the brief's requirement. A future
  `ASSETS.md` should track: asset name, source, license, usage location,
  attribution text if required. None exists yet because none is needed yet.

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

## 8. Vertical slice scope (implemented)

Arrival → Archer intro dialogue → approach house → open door → explore
hallway/living room/back room → optional clue reads (journal, photograph,
occult carving) with ambient horror events escalating by stage → find
patient (auto-triggered on entering the back room) → assess patient →
Archer's philosophical conversation → begin transport prep → end-of-slice
screen.

**Explicitly out of scope for this slice** (per the brief's phased
approach): ambulance interior, crash, forest, monster, Archer's death. Those
are Phases 5–9 and build on the same `GameEngine` without touching this
scene.

## 9. Known simplifications in the current slice

- Archer does not pathfind; he teleports to his "found patient" position a
  few seconds after the door opens, since companion AI-follow is out of
  scope for a slice that ends before the ambulance ride.
- Interactable hitboxes are invisible proxy meshes sized generously around
  small/seated targets (see the patient) rather than raycasting the visible
  low-poly meshes directly — more forgiving to aim at, standard practice for
  FPS interaction systems.
- Retro post-processing (low internal render resolution + grain/dither) is
  implemented; VHS/CRT/4:3 framing are listed in the brief as *optional* and
  are not yet built.
