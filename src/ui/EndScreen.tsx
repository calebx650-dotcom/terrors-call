interface Props {
  ending: "a" | "b";
  onRestart: () => void;
}

export function EndScreen({ ending, onRestart }: Props) {
  return (
    <div className="overlay">
      {ending === "a" ? (
        <>
          <h1>CALLED IT</h1>
          <p>
            Marcus radioed the truth and drove. The farmhouse stayed in the
            mirror a long time. Nobody at county ever found paperwork for a
            fourth call to Keller Farm Road — but dispatch logs show a fifth
            call coming in at 2:47 the next morning. And an ambulance
            responding.
          </p>
        </>
      ) : (
        <>
          <h1>ONE MORE ASSESSMENT</h1>
          <p>
            Somebody has to keep trying. That's the job. The county lists
            Medic 4 as unaccounted for. The next crew found four incomplete
            PCR forms on the hallway table, all with the same vitals, all
            stopping at the same line.
          </p>
        </>
      )}
      <button onClick={onRestart}>Return to Title</button>
      <div className="controls-hint">There is another ending.</div>
    </div>
  );
}
