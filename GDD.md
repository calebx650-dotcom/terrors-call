# Terror's Call — Game Design Document (demo)

## Identity

First-person retro survival horror / psychological horror. PS1 + VHS
aesthetic: a lost 1998 survival-horror game recorded through degraded
analog equipment. 15–20 minute target length, ~30 minute ceiling.

**The core principle:** this is not a monster game with EMS mechanics. It
is an EMS game where the procedures themselves gradually become
horrifying. The player's arc: *"I'm doing my job" → "something is wrong
with this patient" → "something is wrong with this house" → "this isn't a
patient" → "why does it want me to keep trying to save it?"*

The player is never powerful. There are no weapons and no combat.

## Player

**Marcus Reyes**, EMT-Basic, two years on a rural county service, working
alone tonight because his partner called in sick and the county is
short-staffed. Deliberate, slightly heavy movement (he's carrying the jump
bag). Stamina exists but is communicated only through breathing and
footsteps — no bars, no meters, no HUD.

## Setting

1998, 2:47 AM, heavy rain. A two-story farmhouse a mile from the nearest
neighbor: ambulance → porch → entry → living room → kitchen → photograph
hallway → bathroom → upstairs bedroom → basement → ambulance. The
ambulance is the safe zone; the ending is designed to make the player
doubt that it ever was.

## Story

Dispatch: male, mid-40s, difficulty breathing, possible cardiac. A female
caller hangs up mid-sentence. The truth, uncovered in layers: the patient
died three days ago; the house has been staging his death as a fresh
emergency; something keeps calling 911; Marcus is the fourth EMT in three
days; the previous three crews' PCRs all record the same vitals — the
ones Marcus just wrote down himself; the "wife" who called has been dead
two years; the real body is in the basement. The thing upstairs doesn't
want Marcus to save the patient. It wants him to *keep trying*.

## Pacing (the earned turn)

Realistic EMS call → something feels wrong (breath held too long, cold
skin) → something is medically impossible (fixed pupils + pain response)
→ environment contradicts itself (photos change, fogged mirror in a cold
house, dead phone) → the patient isn't behaving like a human (it's not
where it was; it only moves unwatched) → the house participates (the
swollen-shut basement door stands open) → hard supernatural confirmation
(the real body) → the radio knows things Marcus never said.

## Core loop

EXPLORE → OBSERVE → ASSESS → DOCUMENT → NOTICE SOMETHING WRONG →
INVESTIGATE → SURVIVE → RETURN TO THE MEDICAL OBJECTIVE → LEARN MORE.

Medical procedures ARE the horror set-pieces. The pulse check is the
signature: six held seconds, movement locked, the world reduced to two
heartbeats — and on the first check, its eyes open for a single frame.

## The Patient

Almost normal + subtly impossible. Restrained presentation: no screaming,
no monster design. Wrong breathing rhythm, cold skin, fixed-and-dilated
pupils that nonetheless react — to something behind Marcus. Its rule: **it
never moves while watched.** Unobserved for a few seconds, it repositions
along believable standing spots (doorways, room corners, the end of the
hallway). It is most dangerous at close range; crouching (hiding) shrinks
its awareness. It cannot be fought, only watched, avoided, and outrun.

## Endings

- **CALLED IT** — Marcus radios the truth and leaves. Ambiguous: dispatch's
  sign-off ("He knows the way.") implies distance is not safety.
- **ONE MORE ASSESSMENT** — Marcus goes back. The pulse check never
  completes. Cut to black. The next crew finds four incomplete PCRs.

## UI

No HP bar, stamina bar, objective markers, minimap, or crosshair.
Diegetic only: the PCR clipboard is the objective system; the jump bag is
the inventory; the contextual prompt is the aiming feedback; heartbeat,
breath, and vignette carry state. Subtitles are toggleable on the title
screen.

## Out of scope for this demo (future work — see TODO.md)

Gamepad support, voice acting (subtitles carry all dialogue), authored 3D
character models, additional enemies built on the observed/unobserved FSM.
