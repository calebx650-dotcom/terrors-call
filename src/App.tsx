import { useEffect, useRef, useState } from "react";
import { GameEngine } from "./engine/core/GameEngine";
import { VerticalSliceScene } from "./scenes/VerticalSliceScene";
import { GamePhase, useGameStore } from "./state/gameStore";
import { StartScreen } from "./ui/StartScreen";
import { EndScreen } from "./ui/EndScreen";
import { Crosshair, InteractionPrompt, Subtitles, Vignette } from "./ui/Hud";

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [started, setStarted] = useState(false);
  const [runId, setRunId] = useState(0);

  const phase = useGameStore((s) => s.phase);
  const setPhase = useGameStore((s) => s.setPhase);
  const setSubtitle = useGameStore((s) => s.setSubtitle);
  const setInteractionPrompt = useGameStore((s) => s.setInteractionPrompt);

  useEffect(() => {
    if (!started || !containerRef.current) return;

    const engine = new GameEngine(containerRef.current, {
      onSubtitle: (speaker, text, id) => {
        if (id === -1) {
          setSubtitle(null);
        } else {
          setSubtitle({ speaker, text, id });
        }
      },
      onPrompt: (prompt) => setInteractionPrompt(prompt),
    });
    engineRef.current = engine;

    const scene = new VerticalSliceScene(engine, {
      onPhaseChange: (p) => setPhase(p as GamePhase),
      onSliceComplete: () => {
        document.exitPointerLock?.();
      },
    });

    engine.audio.resume();
    engine.start();
    engine.player.requestLock();

    if (import.meta.env.DEV) {
      (window as any).__engine = engine;
      (window as any).__scene = scene;
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [started, runId]);

  const handleStart = () => {
    setPhase("exterior_arrival");
    setStarted(true);
  };

  const handleRestart = () => {
    setStarted(false);
    setPhase("menu");
    setSubtitle(null);
    setInteractionPrompt(null);
    window.setTimeout(() => {
      setRunId((n) => n + 1);
      setStarted(true);
    }, 50);
  };

  return (
    <>
      <div id="game-container" ref={containerRef} />
      {started && phase !== "slice_end" && (
        <>
          <Crosshair />
          <InteractionPrompt />
          <Subtitles />
          <Vignette />
        </>
      )}
      {!started && <StartScreen onStart={handleStart} />}
      {started && phase === "slice_end" && <EndScreen onRestart={handleRestart} />}
    </>
  );
}
