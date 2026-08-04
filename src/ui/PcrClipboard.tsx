import { useGameStore } from "../state/gameStore";

/**
 * The Patient Care Report — the demo's diegetic objective system. Toggled
 * with P. Everything the player has established lands here, and the
 * handwritten "next" line replaces conventional HUD objectives.
 */
export function PcrClipboard() {
  const open = useGameStore((s) => s.clipboardOpen);
  const pcr = useGameStore((s) => s.pcr);
  if (!open) return null;

  const field = (label: string, value: string | null) => (
    <div className="pcr-field">
      <span className="pcr-label">{label}</span>
      <span className={value ? "pcr-value" : "pcr-value pcr-empty"}>
        {value ?? "—"}
      </span>
    </div>
  );

  return (
    <div className="pcr-overlay">
      <div className="pcr-sheet">
        <div className="pcr-header">
          <div>KELLER COUNTY EMS — PATIENT CARE REPORT</div>
          <div className="pcr-unit">MEDIC 4 · REYES, M. (EMT-B) · 0247</div>
        </div>
        {field("CALL", pcr.callInfo)}
        {field("PATIENT", pcr.patientInfo)}
        <div className="pcr-divider">PRIMARY ASSESSMENT</div>
        {field("RESPONSIVENESS", pcr.responsiveness)}
        {field("AIRWAY", pcr.airway)}
        {field("BREATHING", pcr.breathing)}
        {field("PULSE", pcr.pulse)}
        {field("PUPILS", pcr.pupils)}
        {field("VITALS", pcr.vitals)}
        {pcr.notes.length > 0 && (
          <>
            <div className="pcr-divider">NOTES</div>
            {pcr.notes.map((n, i) => (
              <div className="pcr-note" key={i}>
                • {n}
              </div>
            ))}
          </>
        )}
        <div className="pcr-objective">▸ {pcr.objective}</div>
        <div className="pcr-hint">[P] close</div>
      </div>
    </div>
  );
}
