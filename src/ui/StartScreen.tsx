interface Props {
  onStart: () => void;
}

export function StartScreen({ onStart }: Props) {
  return (
    <div className="overlay">
      <h1>TERROR'S CALL</h1>
      <p>
        A call came in from a house nobody had checked on in years. Screaming,
        the dispatcher said. You're the new EMT. Your partner's already
        irritated. Go do your job.
      </p>
      <button onClick={onStart}>Respond to the Call</button>
      <div className="controls-hint">
        WASD to move &middot; Mouse to look &middot; E to interact &middot; F
        toggles flashlight &middot; Click to lock cursor
      </div>
    </div>
  );
}
