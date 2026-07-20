import * as THREE from "three";

export interface Interactable {
  object: THREE.Object3D;
  prompt: string;
  onInteract: () => void;
  /** If false, interaction is currently disallowed (e.g. dialogue in progress). */
  enabled?: boolean;
}

const MAX_DISTANCE = 2.4;

/**
 * Raycasts from the camera center each frame against registered interactables,
 * surfacing a contextual prompt and handling the "use" key.
 */
export class InteractionSystem {
  private raycaster = new THREE.Raycaster();
  private camera: THREE.Camera;
  private interactables: Interactable[] = [];
  current: Interactable | null = null;

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
  }

  update(): Interactable | null {
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

  tryInteract() {
    this.current?.onInteract();
  }
}
