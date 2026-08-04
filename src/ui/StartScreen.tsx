import { useGameStore } from "../state/gameStore";

interface Props {
  onStart: () => void;
  onContinue: (() => void) | null;
}

export function StartScreen({ onStart, onContinue }: Props) {
  const subtitlesEnabled = useGameStore((s) => s.subtitlesEnabled);
  const setSubtitlesEnabled = useGameStore((s) => s.setSubtitlesEnabled);

  return (
    <div className="overlay">
      <h1>TERROR'S CALL</h1>
      <p className="tagline">
        2:47 AM · Heavy rain · Keller Farm Road
      </p>
      <p>
        Male, mid-40s, difficulty breathing, possible cardiac. The caller
        hung up mid-sentence. Your partner called in sick, so tonight it's
        just you, the jump bag, and a farmhouse a mile from anything.
      </p>
      <button onClick={onStart}>Take the Call</button>
      {onContinue && (
        <button className="secondary" onClick={onContinue}>
          Continue from Checkpoint
        </button>
      )}
      <label className="subtitle-toggle">
        <input
          type="checkbox"
          checked={subtitlesEnabled}
          onChange={(e) => setSubtitlesEnabled(e.target.checked)}
        />
        Subtitles
      </label>
      <div className="controls-hint">
        WASD move &middot; Shift sprint &middot; X crouch &middot; Mouse look
        &middot; E interact (hold when told) &middot; F flashlight &middot; P
        patient care report &middot; Tab jump bag
      </div>
    </div>
  );
}
