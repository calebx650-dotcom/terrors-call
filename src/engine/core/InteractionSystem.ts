import * as THREE from "three";

export interface Interactable {
  object: THREE.Object3D;
  prompt: string;
  onInteract: () => void;
  /** If false, interaction is currently disallowed (e.g. dialogue in progress). */
  enabled?: boolean;
  /**
   * If set, this is a hold interaction (e.g. the carotid pulse check): the
   * use key must be held for this many seconds. onProgress fires each frame
   * with 0..1; releasing early fires onCancel; completing fires onInteract.
   */
  holdSeconds?: number;
  onProgress?: (t: number) => void;
  onCancel?: () => void;
}

const MAX_DISTANCE = 2.4;

/**
 * Raycasts from the camera center each frame against registered interactables,
 * surfacing a contextual prompt and handling both tap and hold interactions.
 */
export class InteractionSystem {
  private raycaster = new THREE.Raycaster();
  private camera: THREE.Camera;
  private interactables: Interactable[] = [];
  current: Interactable | null = null;

  private holding: Interactable | null = null;
  private holdElapsed = 0;
  /** Progress 0..1 of the active hold, or null. Read by the HUD. */
  holdProgress: number | null = null;

  constructor(camera: THREE.Camera) {
    this.camera = camera;
  }

  register(interactable: Interactable) {
    this.interactables.push(interactable);
    return () => this.unregister(interactable);
  }

  unregister(interactable: Interactable) {
    this.interactables = this.interactables.filter(
      (i) => i !== interactable,
    );
    if (this.current === interactable) this.current = null;
    if (this.holding === interactable) this.cancelHold();
  }

  update(dt: number): Interactable | null {
    if (this.holding) {
      // While holding, keep the target locked rather than re-raycasting —
      // small camera drift during a pulse check shouldn't cancel it.
      this.holdElapsed += dt;
      const t = Math.min(1, this.holdElapsed / (this.holding.holdSeconds ?? 1));
      this.holdProgress = t;
      this.holding.onProgress?.(t);
      if (t >= 1) {
        const done = this.holding;
        this.holding = null;
        this.holdProgress = null;
        done.onInteract();
      }
      return this.current;
    }

    this.raycaster.set(
      this.camera.getWorldPosition(new THREE.Vector3()),
      this.camera.getWorldDirection(new THREE.Vector3()),
    );
    this.raycaster.far = MAX_DISTANCE;

    let hit: Interactable | null = null;
    let closestDist = Infinity;

    for (const interactable of this.interactables) {
      if (interactable.enabled === false) continue;
      const intersects = this.raycaster.intersectObject(
        interactable.object,
        true,
      );
      if (intersects.length > 0 && intersects[0].distance < closestDist) {
        closestDist = intersects[0].distance;
        hit = interactable;
      }
    }

    this.current = hit;
    return hit;
  }

  /** Use-key pressed. Taps fire immediately; holds begin tracking. */
  pressInteract() {
    const target = this.current;
    if (!target) return;
    if (target.holdSeconds && target.holdSeconds > 0) {
      this.holding = target;
      this.holdElapsed = 0;
      this.holdProgress = 0;
    } else {
      target.onInteract();
    }
  }

  /** Use-key released. Cancels an in-progress hold. */
  releaseInteract() {
    if (this.holding) this.cancelHold();
  }

  private cancelHold() {
    const held = this.holding;
    this.holding = null;
    this.holdProgress = null;
    held?.onCancel?.();
  }

  get isHolding() {
    return this.holding !== null;
  }
}
