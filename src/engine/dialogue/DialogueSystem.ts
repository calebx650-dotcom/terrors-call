export interface DialogueLine {
  speaker: string;
  text: string;
  /** seconds line stays on screen; defaults based on text length */
  duration?: number;
}

type OnLine = (speaker: string, text: string, id: number) => void;
type OnEnd = () => void;

/**
 * Plays a queue of dialogue lines back-to-back with simple timed pacing.
 * Used for scripted story beats (Archer's philosophical talk, the patient's
 * murmuring, Johnny's nervous asides) as well as ad hoc single lines from
 * interactions.
 */
export class DialogueSystem {
  private queue: DialogueLine[] = [];
  private playing = false;
  private timer: number | null = null;
  private idCounter = 0;
  private onLine: OnLine;
  private onEnd: OnEnd | null = null;

  constructor(onLine: OnLine) {
    this.onLine = onLine;
  }

  get isPlaying() {
    return this.playing;
  }

  say(speaker: string, text: string, duration?: number) {
    this.play([{ speaker, text, duration }]);
  }

  play(lines: DialogueLine[], onEnd?: OnEnd) {
    this.queue = [...lines];
    this.onEnd = onEnd ?? null;
    this.playing = true;
    this.advance();
  }

  private advance() {
    if (this.timer) window.clearTimeout(this.timer);
    const next = this.queue.shift();
    if (!next) {
      this.playing = false;
      this.onLine("", "", -1);
      this.onEnd?.();
      return;
    }
    const id = this.idCounter++;
    this.onLine(next.speaker, next.text, id);
    const duration = next.duration ?? Math.max(2.2, next.text.length * 0.055);
    this.timer = window.setTimeout(() => this.advance(), duration * 1000);
  }

  skip() {
    this.advance();
  }

  stop() {
    if (this.timer) window.clearTimeout(this.timer);
    this.queue = [];
    this.playing = false;
    this.onLine("", "", -1);
  }
}
