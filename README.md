# Terror's Call

A browser-based first-person supernatural horror game about an EMT whose
routine call goes very wrong. Built with React, Vite, TypeScript, and
Three.js.

This repository currently contains a **vertical slice**: Johnny and Archer
arrive at a ruined house, explore it, and find their patient. See
[`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full technical design,
system breakdown, and roadmap for the rest of the game.

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
