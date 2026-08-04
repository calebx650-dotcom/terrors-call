import { useGameStore } from "../state/gameStore";

export function InteractionPrompt() {
  const prompt = useGameStore((s) => s.interactionPrompt);
  if (!prompt) return null;
  return <div className="interaction-prompt">{prompt}</div>;
}

/** Thin diegetic progress arc for hold interactions (the pulse check). */
export function HoldIndicator() {
  const t = useGameStore((s) => s.holdProgress);
  if (t === null) return null;
  return (
    <div className="hold-indicator">
      <div className="hold-bar" style={{ width: `${Math.round(t * 100)}%` }} />
    </div>
  );
}

export function Subtitles() {
  const subtitle = useGameStore((s) => s.subtitle);
  const enabled = useGameStore((s) => s.subtitlesEnabled);
  if (!enabled || !subtitle || !subtitle.text) return null;
  return (
    <div className="subtitle-box" key={subtitle.id}>
      <div className="subtitle-speaker">{subtitle.speaker}</div>
      <div className="subtitle-text">{subtitle.text}</div>
    </div>
  );
}

export function Vignette() {
  return <div className="vignette" />;
}

/** Full-screen fade driven by the scene (transitions, endings). */
export function FadeOverlay() {
  const fade = useGameStore((s) => s.fade);
  return (
    <div
      className="fade-overlay"
      style={{ opacity: fade, pointerEvents: fade >= 1 ? "auto" : "none" }}
    />
  );
}
