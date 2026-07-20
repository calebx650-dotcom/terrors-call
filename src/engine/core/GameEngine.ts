import * as THREE from "three";
import { PlayerController } from "./PlayerController";
import { CollisionWorld } from "./CollisionWorld";
import { Flashlight } from "./Flashlight";
import { InteractionSystem } from "./InteractionSystem";
import { RetroPostFX } from "../postfx/RetroPostFX";
import { AudioManager } from "../audio/AudioManager";
import { DialogueSystem } from "../dialogue/DialogueSystem";

export interface EngineCallbacks {
  onSubtitle: (speaker: string, text: string, id: number) => void;
  onPrompt: (prompt: string | null) => void;
}

/**
 * Owns the Three.js renderer/scene/camera and the per-frame update loop,
 * wiring together the player controller, collision world, flashlight,
 * interaction raycasting, audio, dialogue, and the retro post-processing
 * pass. Scene content itself (rooms, props, NPCs, scripted sequencing)
 * lives in scene modules that receive this engine.
 */
export class GameEngine {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  clock = new THREE.Clock();

  collisionWorld = new CollisionWorld();
  player: PlayerController;
  flashlight: Flashlight;
  interaction: InteractionSystem;
  postfx: RetroPostFX;
  audio: AudioManager;
  dialogue: DialogueSystem;

  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private running = false;
  private frameHandle = 0;
  private updateHooks: Array<(dt: number) => void> = [];

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      68,
      window.innerWidth / window.innerHeight,
      0.05,
      120,
    );

    this.scene.fog = new THREE.FogExp2(0x05060a, 0.045);

    this.player = new PlayerController(
      this.camera,
      this.renderer.domElement,
      this.collisionWorld,
    );
    this.flashlight = new Flashlight(this.camera);
    this.scene.add(this.camera);

    this.interaction = new InteractionSystem(this.camera);
    this.postfx = new RetroPostFX(this.renderer, this.scene, this.camera);
    this.audio = new AudioManager();
    this.dialogue = new DialogueSystem((speaker, text, id) =>
      this.callbacks.onSubtitle(speaker, text, id),
    );

    this.player.onFootstep = () => this.audio.footstep();

    window.addEventListener("resize", this.onResize);
    this.renderer.domElement.addEventListener("click", () => {
      if (!this.player.isLocked) this.player.requestLock();
    });
    window.addEventListener("keydown", this.onKeyDown);
  }

  addUpdateHook(fn: (dt: number) => void) {
    this.updateHooks.push(fn);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === "KeyE") {
      this.interaction.tryInteract();
    }
    if (e.code === "KeyF") {
      this.flashlight.toggle();
    }
  };

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.postfx.resize(window.innerWidth, window.innerHeight);
  };

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.loop();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frameHandle);
  }

  dispose() {
    this.stop();
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this.onKeyDown);
    this.player.dispose();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }

  private loop = () => {
    if (!this.running) return;
    this.frameHandle = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);

    this.player.update(dt);
    this.flashlight.update(dt);

    const hit = this.interaction.update();
    this.callbacks.onPrompt(hit ? hit.prompt : null);

    for (const hook of this.updateHooks) hook(dt);

    this.postfx.render(dt);
  };
}
