interface Props {
  onRestart: () => void;
}

export function EndScreen({ onRestart }: Props) {
  return (
    <div className="overlay">
      <h1>JOHNNY LOSES CONSCIOUSNESS</h1>
      <p>
        Something hit the ambulance from the side. Johnny's vision goes dark
        before he can make sense of it. What happens in the next two hours —
        the forest, the wreck, and what's hunting through it — is still
        ahead. Thanks for playing this build of Terror's Call.
      </p>
      <button onClick={onRestart}>Play Again</button>
    </div>
  );
}
