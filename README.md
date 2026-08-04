# Terror's Call

A 15–30 minute first-person retro survival-horror demo, playable in the
browser. 1998, 2:47 AM, heavy rain: Marcus Reyes, a solo rural EMT,
responds to a possible cardiac at an isolated farmhouse. The medical
procedures are the horror mechanics — and the patient died three days ago.

Built with React, Vite, TypeScript, and Three.js. Every texture and sound
is generated procedurally at runtime; the repo contains no external assets
(see [`ASSETS.md`](./ASSETS.md)).

- [`GDD.md`](./GDD.md) — design document (story, pacing, the Patient's rules)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — systems, engine notes, verified-bug log
- [`TESTING.md`](./TESTING.md) — what "verified" means here
- [`TODO.md`](./TODO.md) — known future work

## Running

```bash
npm install
npm run dev
```

Open the printed URL, click **Take the Call**, then click the game window
to lock the mouse. A checkpoint is written automatically at the story's
midpoint; **Continue from Checkpoint** appears on the title screen when
one exists.

**Controls:** WASD move · Shift sprint · X crouch · mouse look · E
interact (hold when prompted) · F flashlight · P patient care report ·
Tab jump bag. Subtitles toggle on the title screen.

The demo has two endings.

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — typecheck + production build
- `npm run typecheck` — typecheck only

## History

An earlier, different Terror's Call story (two EMTs, a cult house, an
ambulance crash) is preserved at commit `8e76ed9`.
