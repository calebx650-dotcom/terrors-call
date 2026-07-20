import { create } from "zustand";

export type GamePhase =
  | "menu"
  | "exterior_arrival"
  | "house_exploration"
  | "patient_found"
  | "slice_end";

interface SubtitleLine {
  speaker: string;
  text: string;
  id: number;
}

interface GameState {
  phase: GamePhase;
  setPhase: (phase: GamePhase) => void;

  subtitle: SubtitleLine | null;
  setSubtitle: (line: SubtitleLine | null) => void;

  interactionPrompt: string | null;
  setInteractionPrompt: (prompt: string | null) => void;

  flags: Record<string, boolean>;
  setFlag: (key: string, value: boolean) => void;
  hasFlag: (key: string) => boolean;

  pointerLocked: boolean;
  setPointerLocked: (locked: boolean) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: "menu",
  setPhase: (phase) => set({ phase }),

  subtitle: null,
  setSubtitle: (line) => set({ subtitle: line }),

  interactionPrompt: null,
  setInteractionPrompt: (prompt) => set({ interactionPrompt: prompt }),

  flags: {},
  setFlag: (key, value) =>
    set((s) => ({ flags: { ...s.flags, [key]: value } })),
  hasFlag: (key) => !!get().flags[key],

  pointerLocked: false,
  setPointerLocked: (locked) => set({ pointerLocked: locked }),
}));
