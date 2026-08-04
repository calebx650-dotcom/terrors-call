/**
 * Checkpoint save, per the brief: one save point, written automatically at
 * the midpoint (reading the previous EMTs' PCRs). Continuing restores the
 * scene to the start of the stalking phase with the assessment complete —
 * the demo otherwise expects a single continuous run.
 */
const KEY = "terrors-call-checkpoint-v1";

export interface CheckpointData {
  version: 1;
  midpointReached: true;
  savedAt: string;
}

export function saveMidpointCheckpoint() {
  const data: CheckpointData = {
    version: 1,
    midpointReached: true,
    savedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable (private mode etc.) — checkpointing is best-effort.
  }
}

export function loadCheckpoint(): CheckpointData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckpointData;
    return parsed.version === 1 && parsed.midpointReached ? parsed : null;
  } catch {
    return null;
  }
}

export function clearCheckpoint() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // best-effort
  }
}
