import { AudioManager } from "../audio/AudioManager";

/** Zone names are scene-defined; the director only compares them. */
export type HorrorZone = string;

export interface HorrorHooks {
  audio: AudioManager;
  /** Called to nudge a prop out of place, flicker a light, etc. Implemented per-scene. */
  triggerVisualEvent: (kind: string) => void;
  getPlayerZone: () => HorrorZone;
  getTensionStage: () => 1 | 2 | 3;
}

interface AmbientEvent {
  weight: number;
  minStage: 1 | 2 | 3;
  run: (hooks: HorrorHooks) => void;
}

/**
 * Drives ambient horror beats independent of the scripted story sequence.
 * Rolls a random ambient event on an interval that shortens and whose event
 * pool broadens as "tension stage" escalates (mirrors the design doc's
 * Stage 1 "strange" -> Stage 2 "unsettling" -> Stage 3 "supernatural" curve
 * within the house-exploration portion of the vertical slice).
 *
 * This is intentionally separate from scripted dialogue/cutscene triggers so
 * later phases can register more events without touching this scheduler.
 */
export class HorrorDirector {
  private hooks: HorrorHooks;
  private timeUntilNext = 8;
  private enabled = false;

  private events: AmbientEvent[] = [
    {
      weight: 3,
      minStage: 1,
      run: (h) => {
        h.audio.woodCreak();
      },
    },
    {
      weight: 2,
      minStage: 1,
      run: (h) => {
        h.audio.distantThud();
      },
    },
    {
      weight: 2,
      minStage: 2,
      run: (h) => {
        h.triggerVisualEvent("flicker_light");
      },
    },
    {
      weight: 2,
      minStage: 2,
      run: (h) => {
        h.triggerVisualEvent("object_shift");
      },
    },
    {
      weight: 1,
      minStage: 2,
      run: (h) => {
        h.audio.doorCreak();
        h.triggerVisualEvent("door_move");
      },
    },
    {
      weight: 1,
      minStage: 3,
      run: (h) => {
        h.audio.whisper();
      },
    },
    {
      weight: 1,
      minStage: 3,
      run: (h) => {
        h.triggerVisualEvent("shadow_pass");
      },
    },
  ];

  constructor(hooks: HorrorHooks) {
    this.hooks = hooks;
  }

  start() {
    this.enabled = true;
    this.timeUntilNext = 6 + Math.random() * 4;
  }

  stop() {
    this.enabled = false;
  }

  update(dt: number) {
    if (!this.enabled) return;
    this.timeUntilNext -= dt;
    if (this.timeUntilNext <= 0) {
      this.rollEvent();
      const stage = this.hooks.getTensionStage();
      const baseInterval = stage === 1 ? 14 : stage === 2 ? 10 : 7;
      this.timeUntilNext = baseInterval + Math.random() * baseInterval * 0.6;
    }
  }

  private rollEvent() {
    const stage = this.hooks.getTensionStage();
    const pool = this.events.filter((e) => e.minStage <= stage);
    const totalWeight = pool.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const e of pool) {
      roll -= e.weight;
      if (roll <= 0) {
        e.run(this.hooks);
        return;
      }
    }
  }
}
