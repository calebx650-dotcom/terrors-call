interface Props {
  onChoose: (which: "a" | "b") => void;
}

/** The final decision, presented as the radio handset moment. */
export function EndingChoice({ onChoose }: Props) {
  return (
    <div className="overlay choice-overlay">
      <p className="choice-context">
        The handset crackles in your fist. The house waits at the end of the
        headlights. The patient — the thing — is still on that floor,
        exactly where a patient should be.
      </p>
      <div className="choice-buttons">
        <button onClick={() => onChoose("a")}>
          Call it. He's been dead three days. Leave.
        </button>
        <button onClick={() => onChoose("b")}>
          Go back inside. One more assessment.
        </button>
      </div>
    </div>
  );
}
