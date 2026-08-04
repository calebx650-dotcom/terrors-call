import { create } from "zustand";

export type GamePhase =
  | "menu"
  | "arrival"
  | "scene_safety"
  | "assessment"
  | "investigation"
  | "midpoint"
  | "stalking"
  | "upstairs"
  | "basement"
  | "ending_choice"
  | "ending_playing"
  | "ending_a"
  | "ending_b";

interface SubtitleLine {
  speaker: string;
  text: string;
  id: number;
}

/**
 * The PCR (Patient Care Report) doubles as the objective system — the brief
 * bans conventional HUD objectives, so Marcus's clipboard carries call info,
 * findings as they're gathered, and a handwritten "next step" line.
 */
export interface PcrState {
  callInfo: string;
  patientInfo: string;
  responsiveness: string | null;
  airway: string | null;
  breathing: string | null;
  pulse: string | null;
  pupils: string | null;
  vitals: string | null;
  notes: string[];
  objective: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
}

interface GameState {
  phase: GamePhase;
  setPhase: (phase: GamePhase) => void;

  subtitle: SubtitleLine | null;
  setSubtitle: (line: SubtitleLine | null) => void;
  subtitlesEnabled: boolean;
  setSubtitlesEnabled: (on: boolean) => void;

  interactionPrompt: string | null;
  setInteractionPrompt: (prompt: string | null) => void;

  /** 0..1 progress of an active hold interaction (pulse check), or null. */
  holdProgress: number | null;
  setHoldProgress: (t: number | null) => void;

  pcr: PcrState;
  updatePcr: (patch: Partial<PcrState>) => void;
  addPcrNote: (note: string) => void;

  inventory: InventoryItem[];
  addItem: (item: InventoryItem) => void;
  hasItem: (id: string) => boolean;

  clipboardOpen: boolean;
  setClipboardOpen: (open: boolean) => void;
  bagOpen: boolean;
  setBagOpen: (open: boolean) => void;

  /** 0 = clear, 1 = fully black. Scene transitions and endings drive this. */
  fade: number;
  setFade: (f: number) => void;

  flags: Record<string, boolean>;
  setFlag: (key: string, value: boolean) => void;
  hasFlag: (key: string) => boolean;
}

export const initialPcr: PcrState = {
  callInfo: "0247 — Male, mid-40s. Difficulty breathing, poss. cardiac.",
  patientInfo: "Unknown. Caller disconnected mid-sentence.",
  responsiveness: null,
  airway: null,
  breathing: null,
  pulse: null,
  pupils: null,
  vitals: null,
  notes: [],
  objective: "Respond to the call. Scene safety first.",
};

export const useGameStore = create<GameState>((set, get) => ({
  phase: "menu",
  setPhase: (phase) => set({ phase }),

  subtitle: null,
  setSubtitle: (line) => set({ subtitle: line }),
  subtitlesEnabled: true,
  setSubtitlesEnabled: (on) => set({ subtitlesEnabled: on }),

  interactionPrompt: null,
  setInteractionPrompt: (prompt) => set({ interactionPrompt: prompt }),

  holdProgress: null,
  setHoldProgress: (t) => set({ holdProgress: t }),

  pcr: { ...initialPcr },
  updatePcr: (patch) => set((s) => ({ pcr: { ...s.pcr, ...patch } })),
  addPcrNote: (note) =>
    set((s) => ({ pcr: { ...s.pcr, notes: [...s.pcr.notes, note] } })),

  inventory: [],
  addItem: (item) =>
    set((s) =>
      s.inventory.some((i) => i.id === item.id)
        ? s
        : { inventory: [...s.inventory, item] },
    ),
  hasItem: (id) => get().inventory.some((i) => i.id === id),

  clipboardOpen: false,
  setClipboardOpen: (open) => set({ clipboardOpen: open }),
  bagOpen: false,
  setBagOpen: (open) => set({ bagOpen: open }),

  fade: 0,
  setFade: (f) => set({ fade: f }),

  flags: {},
  setFlag: (key, value) =>
    set((s) => ({ flags: { ...s.flags, [key]: value } })),
  hasFlag: (key) => !!get().flags[key],
}));

/** Reset per-run state (new game / play again). */
export function resetRunState() {
  useGameStore.setState({
    phase: "menu",
    subtitle: null,
    interactionPrompt: null,
    holdProgress: null,
    pcr: { ...initialPcr, notes: [] },
    inventory: [],
    clipboardOpen: false,
    bagOpen: false,
    fade: 0,
    flags: {},
  });
}
