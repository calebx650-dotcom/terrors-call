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
    // Filmic rolloff instead of linear clipping — the single cheapest
    // "not a default Three.js demo" switch there is.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.4;
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

    // A tiny procedural night-sky equirect fed through PMREM gives every
    // MeshStandardMaterial a believable (near-black, blue-topped) specular
    // environment: wet paint, mirrors, and metal stop rendering dead.
    {
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 32;
      const ctx = c.getContext("2d")!;
      const grad = ctx.createLinearGradient(0, 0, 0, 32);
      grad.addColorStop(0, "#141c30");
      grad.addColorStop(0.55, "#05070d");
      grad.addColorStop(1, "#000000");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 32);
      const equirect = new THREE.CanvasTexture(c);
      equirect.mapping = THREE.EquirectangularReflectionMapping;
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromEquirectangular(equirect).texture;
      this.scene.environmentIntensity = 0.3;
      pmrem.dispose();
      equirect.dispose();
    }

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

    this.player.onFootstep = (running) => {
      this.audio.footstep(running);
      this.flashlight.kick(running ? 0.03 : 0.016);
    };
    this.player.onBreathState = (intensity) =>
      this.audio.setBreathIntensity(intensity);

    window.addEventListener("resize", this.onResize);
    this.renderer.domElement.addEventListener("click", () => {
      if (!this.player.isLocked) this.player.requestLock();
    });
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  addUpdateHook(fn: (dt: number) => void) {
    this.updateHooks.push(fn);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === "KeyE" && !e.repeat) {
      this.interaction.pressInteract();
    }
    if (e.code === "KeyF") {
      this.flashlight.toggle();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "KeyE") {
      this.interaction.releaseInteract();
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
    window.removeEventListener("keyup", this.onKeyUp);
    this.player.dispose();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }

  private prevYaw = 0;
  private prevPitch = 0;

  private loop = () => {
    if (!this.running) return;
    this.frameHandle = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);

    this.player.update(dt);
    // Look velocity feeds the flashlight's handheld lag.
    const yawVel = dt > 0 ? (this.player.yaw - this.prevYaw) / dt : 0;
    const pitchVel = dt > 0 ? (this.player.pitch - this.prevPitch) / dt : 0;
    this.prevYaw = this.player.yaw;
    this.prevPitch = this.player.pitch;
    this.flashlight.update(dt, yawVel, pitchVel);

    const hit = this.interaction.update(dt);
    this.callbacks.onPrompt(hit ? hit.prompt : null);

    for (const hook of this.updateHooks) hook(dt);

    this.postfx.render(dt);
  };
}
