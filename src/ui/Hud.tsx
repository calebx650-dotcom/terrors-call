import { useGameStore } from "../state/gameStore";

export function Crosshair() {
  return <div className="crosshair" />;
}

export function InteractionPrompt() {
  const prompt = useGameStore((s) => s.interactionPrompt);
  if (!prompt) return null;
  return <div className="interaction-prompt">{prompt}</div>;
}

export function Subtitles() {
  const subtitle = useGameStore((s) => s.subtitle);
  if (!subtitle || !subtitle.text) return null;
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
