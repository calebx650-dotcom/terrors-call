import { useEffect, useRef, useState } from "react";
import { GameEngine } from "./engine/core/GameEngine";
import { FarmhouseScene } from "./scenes/FarmhouseScene";
import { GamePhase, resetRunState, useGameStore } from "./state/gameStore";
import { loadCheckpoint } from "./game/checkpoint";
import { StartScreen } from "./ui/StartScreen";
import { EndScreen } from "./ui/EndScreen";
import { EndingChoice } from "./ui/EndingChoice";
import { PcrClipboard } from "./ui/PcrClipboard";
import { JumpBag } from "./ui/JumpBag";
import {
  FadeOverlay,
  HoldIndicator,
  InteractionPrompt,
  Subtitles,
  Vignette,
} from "./ui/Hud";

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const sceneRef = useRef<FarmhouseScene | null>(null);
  const [started, setStarted] = useState(false);
  const [restoreMidpoint, setRestoreMidpoint] = useState(false);
  const [runId, setRunId] = useState(0);

  const phase = useGameStore((s) => s.phase);
  const setPhase = useGameStore((s) => s.setPhase);
  const setSubtitle = useGameStore((s) => s.setSubtitle);
  const setInteractionPrompt = useGameStore((s) => s.setInteractionPrompt);

  // Diegetic UI keys: P = PCR clipboard, Tab = jump bag.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started) return;
      const store = useGameStore.getState();
      if (e.code === "KeyP") {
        store.setClipboardOpen(!store.clipboardOpen);
        if (!store.clipboardOpen) store.setBagOpen(false);
      }
      if (e.code === "Tab") {
        e.preventDefault();
        store.setBagOpen(!store.bagOpen);
        if (!store.bagOpen) store.setClipboardOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started]);

  // Endings cut to black first; hold the black for a beat, then lift the
  // fade so the end card (which has its own dark backdrop) can be read.
  useEffect(() => {
    if (phase === "ending_a" || phase === "ending_b") {
      const t = window.setTimeout(
        () => useGameStore.getState().setFade(0),
        phase === "ending_b" ? 2400 : 1200,
      );
      return () => window.clearTimeout(t);
    }
  }, [phase]);

  useEffect(() => {
    if (!started || !containerRef.current) return;

    try {
      const engine = new GameEngine(containerRef.current, {
        onSubtitle: (speaker, text, id) => {
          if (id === -1) setSubtitle(null);
          else setSubtitle({ speaker, text, id });
        },
        onPrompt: (prompt) => setInteractionPrompt(prompt),
      });
      engineRef.current = engine;
      console.log("[Terror's Call] Engine initialized, canvas added to DOM");

      console.log("[Terror's Call] Creating FarmhouseScene...");
      const scene = new FarmhouseScene(
        engine,
        { onPhaseChange: (p) => setPhase(p as GamePhase) },
        { restoreMidpoint },
      );
      sceneRef.current = scene;
      console.log("[Terror's Call] FarmhouseScene created, scene.children:", engine.scene.children.length);

      engine.audio.resume();
      engine.start();
      console.log("[Terror's Call] Engine started");
      engine.player.requestLock();

    if (import.meta.env.DEV) {
      (window as any).__engine = engine;
      (window as any).__scene = scene;
    }

      return () => {
        engine.dispose();
        engineRef.current = null;
        sceneRef.current = null;
      };
    } catch (err) {
      console.error("[Terror's Call] Engine init failed:", err);
      throw err;
    }
  }, [started, runId]);

  const handleStart = (fromCheckpoint: boolean) => {
    resetRunState();
    setRestoreMidpoint(fromCheckpoint);
    setPhase(fromCheckpoint ? "stalking" : "arrival");
    setRunId((n) => n + 1);
    setStarted(true);
  };

  const handleRestart = () => {
    setStarted(false);
    resetRunState();
  };

  const ended = phase === "ending_a" || phase === "ending_b";
  const checkpoint = loadCheckpoint();

  return (
    <>
      <div id="game-container" ref={containerRef} />
      {started && !ended && phase !== "ending_choice" && (
        <>
          <InteractionPrompt />
          <HoldIndicator />
          <Subtitles />
          <Vignette />
          <PcrClipboard />
          <JumpBag />
        </>
      )}
      {started && phase === "ending_choice" && (
        <>
          <Subtitles />
          <EndingChoice
            onChoose={(which) => sceneRef.current?.chooseEnding(which)}
          />
        </>
      )}
      {started && ended && (
        <EndScreen ending={phase === "ending_a" ? "a" : "b"} onRestart={handleRestart} />
      )}
      <FadeOverlay />
      {!started && (
        <StartScreen
          onStart={() => handleStart(false)}
          onContinue={checkpoint ? () => handleStart(true) : null}
        />
      )}
    </>
  );
}
