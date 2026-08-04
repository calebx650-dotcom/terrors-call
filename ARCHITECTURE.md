# Terror's Call — Technical Architecture

Terror's Call is a 15–30 minute first-person retro survival-horror demo:
Marcus Reyes, a solo rural EMT in 1998, responds to a 2:47 AM cardiac call
at an isolated farmhouse. The medical procedures are the horror mechanics.

> **History note:** this repository previously contained a different
> Terror's Call story (two EMTs, Johnny and Archer, a cult house and an
> ambulance crash). That build is preserved intact at commit `8e76ed9`
> (local tag `johnny-archer-build`). The current demo replaced it as the
> main game after a design pivot; the reusable engine layer carried over.
>
> **Engine note:** the design brief for this demo was written against
> Unity 6/URP. This environment cannot run Unity (headless Linux, no
> editor, no Windows toolchain), so the demo was built — with the owner's
> sign-off — on the repository's existing web stack, translating the
> brief's systems 1:1 where possible. Deviations are listed in §9.

## 1. Stack

- **React + Vite + TypeScript** — app shell and diegetic UI overlays (PCR
  clipboard, jump bag, subtitles, prompts, menus). React never touches the
  3D scene graph.
- **Three.js** — rendering, scene graph, lighting, raycasting.
- **zustand** — UI-facing state (PCR contents, inventory, phase, subtitle,
  fade). The engine layer is framework-agnostic and reports through
  callbacks.
- **Web Audio API** — every sound is synthesized at runtime (see §6). No
  audio files exist in the repo.
- **No physics engine** — a hand-rolled AABB `CollisionWorld` suits the
  boxy low-poly interiors. Floors/ceilings are never colliders (there is no
  vertical movement), which avoids a whole class of "collider overlaps the
  player everywhere" bugs hit twice in earlier phases.

## 2. System map

```
src/
  engine/
    core/GameEngine.ts        renderer/camera/loop ownership; key routing
    core/PlayerController.ts  WASD + mouse-look, sprint/crouch, stamina
                              (audio-only feedback — no bars), camera shake
    core/CollisionWorld.ts    AABB colliders, axis-sliding resolution
    core/Flashlight.ts        camera-rigged spot w/ flicker; doubles as the
                              pupil-exam light
    core/InteractionSystem.ts center-screen raycast; tap AND hold-to-
                              interact (the pulse check) with progress/
                              cancel callbacks
    audio/AudioManager.ts     procedural rain/thunder/heartbeat/breath/
                              fridge-hum/radio/stings; silence is a control
                              surface (setAmbienceLevel, setRainIntensity)
    dialogue/DialogueSystem.ts timed line queue; play() for story chains,
                              playAmbient() for barks (see §8, bug #3)
    horror/HorrorDirector.ts  weighted ambient event scheduler, tension-
                              staged pools, zone hooks
    postfx/RetroPostFX.ts     ~240p internal render target (nearest-
                              neighbor upscale), grain, dither, scanlines,
                              CRT vignette, VHS tracking bands, stress-
                              driven chromatic aberration
    materials/                procedural albedo+normal+roughness kits
    assets/AssetLoader.ts     GLTF pipeline scaffold (unused; see ASSETS.md)
  entities/ThePatient.ts      the Patient FSM + the basement body builder
  scenes/FarmhouseScene.ts    the entire demo: world, story sequencing,
                              endings
  game/checkpoint.ts          midpoint checkpoint (localStorage)
  data/dialogue.ts            all script content
  state/gameStore.ts          zustand store incl. the PCR model
  ui/                         PcrClipboard, JumpBag, StartScreen, EndScreen,
                              EndingChoice, Hud (prompt/subtitles/fade/hold)
```

## 3. The Patient (enemy design)

One rule drives the entity (`ThePatient`): **it does not move while
observed.** Implementation:

- *Observed* = inside the camera frustum, within 30m, and not occluded
  (raycast against the scene's wall list).
- After 2.6 continuous seconds unobserved, it teleports to one of the
  scene's anchor points — preferring anchors near the player but never one
  currently on screen, with a 30% second-choice jitter so the pattern
  can't be fully predicted.
- It never pursues. Close range (≈2.1m, shrinking to ≈1.3m if the player
  is crouching — crouching is the hiding mechanic) triggers a supernatural
  close-contact event, then it retreats to the farthest anchor and cools
  down for 9 seconds.
- FSM: `dormant → observed ⇄ unobserved → (reposition) → close_contact →
  reset_cooldown`. The machine is self-contained and reusable for future
  entities.
- During medical interactions the scene sets `interactionLock` so scripted
  beats can't be interrupted by a reposition.

Before the midpoint it stays in `dormant` (the lying "medical emergency"
presentation, with a deliberately wrong breathing cycle — inhale, a
too-long hold, exhale). After the midpoint it presents standing.

## 4. Medical system & PCR

Assessment is a linear interaction chain on the patient: responsiveness
(AVPU) → airway/breathing → **carotid pulse (hold E for six seconds;
movement locks, the soundscape drops to heartbeat and breath, and at the
55% mark its eyes open for ~90ms — the first scare)** → pupils (flashlight)
→ vitals. Each step writes real findings onto the PCR.

The PCR clipboard (P key) is the objective system — call info, findings,
notes, and a handwritten "next step" line. No HUD objectives exist. The
midpoint lands when the player reads three previous county PCRs on the
hallway table and recognizes their own vitals on all three sheets.

## 5. Level & flow

Single scene, three collision-independent areas connected by fade
transitions (the classic 1998 door-transition pattern): ground floor at the
origin, upstairs at x=60, basement at x=120.

Route: ambulance (dispatch intro) → porch → entry → living room (patient,
assessment) → kitchen (dead phone, stale digoxin, grocery list) / hallway
(photographs that change between passes, never on screen) / bathroom
(fogged mirror, bedroom key) → hallway table (midpoint: prior PCRs;
checkpoint saves; stalking begins) → upstairs bedroom (funeral pamphlet —
the caller has been dead two years) → basement (the real patient, dead
three days) → ambulance radio (dispatch references the basement Marcus
never mentioned) → ending choice.

**Ending A ("Called It")** — radio the truth and leave; dispatch's sign-off
implies it isn't over. **Ending B ("One More Assessment")** — return to the
patient; the final pulse check's hold can never complete; cut to black.

## 6. Audio

All synthesized (zero licensed assets): rain (high-passed noise, intensity
per zone), thunder, wind, house drone, footsteps (cadence tracks
walk/sprint/crouch), Marcus's breathing (level tracks stamina — the brief
bans a stamina bar, so breath *is* the meter), heartbeat with optional
offset **second heartbeat**, fridge hum tuned a few cents flat, rotary
phone bell, radio static, door/wood creaks, whispers, stings. Silence is
deliberate: the pulse check and the basement discovery pull every bed down.

## 7. Visual identity (art-direction pass)

The pipeline: scene renders ACES-filmic-tonemapped into a ~240p target →
subtle `UnrealBloomPass` (high threshold, so only true light sources
halate) → the combined VHS/CRT pass: film grain, dither, scanlines,
vignette, tracking bands, tape-noise dropout lines, stress-driven
chromatic aberration, and a **per-zone color grade** (lift/gain/
saturation, lerped on area changes: rain-blue exterior, neutral-cold
ground floor, dusty warm-gray upstairs, sickly green basement). Fog
density also eases per zone.

**Cinematic lighting & volumetrics** (all zone-aware, all cheap at 240p):

- The flashlight has a 1024 shadow map, handheld lag (the beam trails look
  velocity and settles), idle breathing drift, and a **volumetric cone**
  with dust motes caught in it (`engine/fx/VolumetricCone.ts` — additive
  open cone, near/far/rim fades; no raymarching).
- The living-room moonbeam is a second volumetric shaft: window → shaft →
  patient is the room's composition anchor.
- The ambulance runs **alternating red flashers** whose sweep reads on the
  wet facade and puddles — the exterior's anchor image.
- The basement has a **single swinging bare bulb** (shadow-casting spot,
  filament sputter, enabled only in-zone) lighting the body — in a house
  Marcus established has no power. Nobody comments on it.
- Lightning flashes relight the world first (window panes flare, the dead
  TV glass answers), thunder follows on a believable delay.
- A tiny procedural night-sky PMREM environment gives PBR speculars life:
  wet ambulance paint, puddles (roughness ~0.06 mirrors), rain-slick porch
  boards, the TV's glass.
- Camera: eased head bob + constant breathing sway; PS1 vertex wobble is
  approximated in post (true vertex-snap hook remains a TODO).

**Environmental storytelling decals**: three aging trails of muddy boot
prints walk IN from the front door to the patient — none walk out — and
drag marks run from the kitchen to the basement door. One hallway photo
frame hangs crooked. None of it is called out in dialogue.

**Library decision:** pmndrs/postprocessing was evaluated for this pass
and deliberately not adopted — at a 240p target its extras are either
counterproductive to the PS1 crunch (SMAA) or redundant, and the bespoke
VHS shader is the game's identity. Three's bundled UnrealBloomPass filled
the only real gap with zero new dependencies. drei-vanilla's
`MeshReflectorMaterial` was evaluated for wet-puddle reflections in the
follow-up pass and also declined — at 240p a full off-screen mirror pass
per puddle costs more than the reflected image can visibly buy back;
prefer a custom rain shader (see below) and PMREM speculars.

**Art-direction pass 2 additions** (all direction-first, no new deps):

- *Custom lit rain*: `PointsMaterial` was unlit — replaced with a
  `ShaderMaterial` that reads the flashlight and moonbeam pose from
  uniforms and brightens raindrops inside those cones. This is the
  game's iconic image (rain-in-the-beam) and it didn't exist before.
- *Rain-on-ground splashes*: a pooled ring-geometry effect that spawns
  concentric expanding rings near the player only while outdoors.
  Capped at 22 concurrent for a fixed CPU budget.
- *Room-defining practicals*: the fridge door hangs open a crack in a
  house with no power, leaking cold cyan-green light across the kitchen
  floor and painting the plaster wall; a small back-window over the
  stairs backlights the hallway so anything standing there reads as a
  silhouette (the exact spot the Patient likes to stand); a frosted
  cyan pane defines the bathroom.
- *Storm distance model*: each strike picks a real distance in km, and
  both thunder delay (2.9s/km + jitter) and thunder loudness+timbre
  come out of that distance. The storm walks closer over the demo's
  runtime so the tempo tightens naturally as tension rises.
- *Close-strike figure reveal*: a rare close strike spawns a humanoid
  silhouette across the yard that lasts ~1 second and then isn't there.
- *Composition carpentry*: dark doorframes around every room doorway,
  ceiling beams in the living room and hallway, cross mullions on every
  window pane — turns each sightline into a framed vignette and gives
  the corridor foreground occlusion.
- *Environmental storytelling for the three-crew premise*: crew one's
  penlight rolled against the baseboard and still on (pulsing, dying
  batteries), crew two's shed nitrile glove by the patient, crew
  three's abandoned county jump bag at the foot of the couch. None are
  referenced in dialogue.
- *Physical camera*: turn inertia (`snapLook`), head bob eased in/out,
  breathing sway, footstep flashlight kicks.
- *Restraint pass*: reduced bloom strength/vignette/scanlines from the
  first visual pass — the post is quieter now, letting the geometry
  and lighting carry the frame instead of the filter.

## 8. Verification (what was actually tested)

`tsc` and `vite build` pass clean. The real browser build was driven
end-to-end with Playwright twice — full route to **Ending A**, then
**checkpoint-continue to Ending B** — using real key events against the
real interaction raycasts, including the 6-second held-key pulse check.
The Patient's movement rule is asserted both ways: watched at a verified
`observed` state for 4s (must not move), then looked away (must reposition
within 8s). Bugs found and fixed by this pass:

1. Tiny pickups (the medication bottle) were nearly impossible to hit with
   a raycast — added generous invisible hitboxes (also better for players).
2. The ending-B final prompt was unreachable because the spawn looked
   straight ahead over the lying patient — fixed with authored framing
   (spawn gaze angled down at it).
3. **DialogueSystem stomping:** `play()` replaces the queue *and* the
   pending `onEnd`. A random stalking bark firing mid-sequence destroyed
   the bedroom chain's completion callback and soft-locked progression.
   Fix: `playAmbient()` — incidental lines now only play into silence and
   can never cancel a story chain. This is the demo's most important
   engineering lesson: **anything that can speak at a random moment must
   be structurally unable to interrupt scripted progression.**
4. The endings' cut-to-black overlay sat above the end cards permanently —
   now the black holds for a beat, then lifts.
5. (Art-direction pass) Stair transitions set the current zone directly,
   bypassing `onZoneChange` — so zone-gated systems (the basement bulb,
   fog/grade changes, the fridge hum) silently never fired after a fade
   transition. All zone changes now funnel through one `setZone()`. The
   full double-ending regression was re-run after the visual pass and
   still passes clean.
6. (Art-direction pass 2) Adding turn inertia broke every place in the
   codebase (and the regression) that wrote `player.yaw = X` directly:
   the visible yaw chases a private `yawTarget` each frame, so half-writes
   drift. Fixed by introducing `snapLook(yaw, pitch)` as the one
   documented way to teleport the camera. `setSpawn` now uses it, the
   scene's ending-B framing uses it, and the doc string on the method
   explains the rule: mouse-look updates targets, scripted framing snaps
   both. If anyone reintroduces `player.yaw = ...` in this codebase it
   should show up in code review immediately.

## 9. Deviations from the Unity brief

- **Engine**: web stack instead of Unity 6/URP (environment constraint,
  owner-approved). Targets browser instead of a Windows .exe; on this
  stack the GTX-1050-class target is comfortably met by a ~240p render
  target and primitive geometry.
- **Controller support / Unity Input System**: not applicable; keyboard +
  mouse only for now. Input handling is centralized in
  `PlayerController`/`GameEngine`, so a gamepad layer has one place to go.
- **Vertex wobble**: approximated by per-scanline jitter in the post pass
  rather than true vertex snapping; the 240p target + dither carries the
  PS1 read. A real vertex-snap material hook is a TODO.
- **Automated test suite**: no unit-test framework yet; verification is
  the scripted end-to-end browser run above (TESTING.md). EditMode/PlayMode
  tests were Unity concepts; the closest equivalent (Vitest for
  entity/dialogue logic + the Playwright run in CI) is on the TODO list.
- **Flashlight batteries**: skipped deliberately for a 15–30 minute demo;
  flicker only. The brief allowed "battery behavior if appropriate."
- **Git LFS / branch tree**: no binary assets exist (everything is
  procedural), so LFS has nothing to track; work ships on the session's
  designated branch per hosting constraints.
