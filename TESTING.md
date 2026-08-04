# Testing

## What must pass before a milestone is "done"

1. `npm run typecheck` — clean.
2. `npm run build` — clean production build.
3. A scripted end-to-end run of the real browser build (Playwright driving
   real keyboard/mouse events against the dev server) covering:
   - dispatch intro → arrival → front door → patient discovery
   - the full assessment chain, including the 6-second held-E pulse check
     (assert the hold indicator renders and the chain advances only on a
     completed hold)
   - investigation clues (phone, medication) → previous-PCRs midpoint →
     checkpoint written to localStorage
   - **the Patient movement rule, asserted both directions**: with the
     entity reporting `observed`, position must not change over 4s; after
     looking away, it must reposition within 8s
   - bathroom key → upstairs → bedroom evidence → basement door → the
     body → radio tell → ending choice
   - **Ending A** to its end card
   - reload → **Continue from Checkpoint** (exercises the restore path) →
     full back half again → **Ending B**, including the never-completing
     final pulse check and the cut to black
   - zero page errors for the entire double run.

The current verification script lives outside the repo (session
scratchpad); porting it into `tests/` under Playwright's runner, plus
Vitest unit coverage for `ThePatient`'s FSM and `DialogueSystem`'s
ambient/story separation, is tracked in TODO.md.

## Lessons already encoded as rules

- Never register floor/ceiling colliders: with no vertical movement they
  can only ever block the player erroneously.
- Any interactable smaller than ~0.3m gets an invisible hitbox.
- Ambient/incidental dialogue goes through `playAmbient()`, never
  `play()` — `play()` replaces the pending `onEnd` and can soft-lock
  story progression (this happened; see ARCHITECTURE.md §8).
- After any teleport/spawn, verify the player's aim actually intersects
  the next required interactable, or author the framing (set pitch/yaw).
