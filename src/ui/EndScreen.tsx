interface Props {
  onRestart: () => void;
}

export function EndScreen({ onRestart }: Props) {
  return (
    <div className="overlay">
      <h1>END OF VERTICAL SLICE</h1>
      <p>
        Johnny and Archer are about to move the patient. The house is not
        finished with them yet — but the rest of the call, the ambulance, the
        forest, and everything after is still ahead. Thanks for playing this
        slice of Terror's Call.
      </p>
      <button onClick={onRestart}>Play Again</button>
    </div>
  );
}
