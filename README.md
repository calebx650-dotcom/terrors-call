# Terror's Call

A browser-based first-person supernatural horror game about an EMT whose
routine call goes very wrong. Built with React, Vite, TypeScript, and
Three.js.

This repository currently contains a playable path from the house arrival
through the ambulance crash: Johnny and Archer arrive at a ruined house,
explore it, find and extract their patient, escape the house, load and drive
the ambulance through an escalating 12-minute transport, and crash. See
[`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full technical design, system
breakdown, and roadmap for the rest of the game (forest, monster, Archer's
death — not yet built), and [`ASSETS.md`](./ASSETS.md) for the asset
licensing policy and current (currently empty) external-asset inventory.

## Running locally

```bash
npm install
npm run dev
```

Open the printed local URL, click "Respond to the Call", then click the
game window to lock the mouse.

**Controls:** WASD to move, mouse to look, `E` to interact, `F` to toggle
the flashlight.

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — typecheck and produce a production build
- `npm run typecheck` — typecheck only
