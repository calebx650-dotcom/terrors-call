# TODO

## Verification & tooling
- [ ] Port the end-to-end Playwright run into `tests/e2e/` under the
      Playwright runner (currently a session script; see TESTING.md).
- [ ] Vitest unit tests: `ThePatient` FSM transitions, anchor filtering,
      `DialogueSystem` ambient-vs-story rules, checkpoint round-trip.
- [ ] CI: typecheck + build + e2e on push.

## Game
- [ ] Gamepad support (input is already centralized in PlayerController).
- [ ] True PS1 vertex-snap material hook (current wobble is post-process
      scanline jitter only).
- [ ] More horror-director events wired to the stalking phase (fridge
      pitch bend, phone ring one-shot, upstairs footsteps while in the
      basement).
- [ ] A second photo-hallway pass variant (the fourth figure closer).
- [ ] Pause menu with subtitle toggle + volume sliders (currently title
      screen only).
- [ ] Optional 4:3 letterbox mode.

## Art (see ASSETS.md before adding anything external)
- [ ] Authored low-poly GLB for the Patient (lying + standing) through
      AssetLoader's COL_/INTERACT_ conventions.
- [ ] Authored farmhouse props to replace the primitive furniture.
- [ ] Marcus first-person hands (visible during the pulse check).

## Audio
- [ ] Recorded/licensed ambience layers to thicken the procedural beds
      (log licenses in ASSETS.md).
- [ ] A low synth drone cue set for transitions (music stays sparse; no
      music during assessments).
