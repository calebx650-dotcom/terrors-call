import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Scaffold for the authored-asset pipeline described in ARCHITECTURE.md /
 * ASSETS.md. Nothing in the current build loads a GLB yet — every mesh is
 * still procedural — but future content should route through this loader so
 * caching, collision-mesh extraction, and interactable metadata conventions
 * are consistent from the first real model onward.
 *
 * Conventions a .glb is expected to follow when it's added to the project:
 * - Nodes named `COL_*` are collision proxies: hidden at render time
 *   (visible = false in the source file) and registered into the
 *   CollisionWorld instead of the visual mesh.
 * - Nodes named `INTERACT_*` carry `userData.interactPrompt` (a glTF extra)
 *   used to auto-register an Interactable without bespoke per-model code.
 * - LOD variants, if present, follow the `LOD0_`, `LOD1_` naming Three's
 *   LOD helper expects; LOD is opt-in per asset, not assumed.
 */
export class AssetLoader {
  private loader = new GLTFLoader();
  private cache = new Map<string, Promise<THREE.Group>>();

  /** Loads a .glb and returns a fresh clone of its scene graph each call. */
  async load(url: string): Promise<THREE.Group> {
    if (!this.cache.has(url)) {
      const promise = this.loader
        .loadAsync(url)
        .then((gltf) => gltf.scene as THREE.Group);
      this.cache.set(url, promise);
    }
    const original = await this.cache.get(url)!;
    return original.clone(true);
  }

  /**
   * Splits a loaded model into renderable meshes and collision proxies per
   * the `COL_*` naming convention, and collects any `INTERACT_*` metadata.
   */
  static partition(root: THREE.Group) {
    const colliders: THREE.Object3D[] = [];
    const interactables: Array<{ object: THREE.Object3D; prompt: string }> = [];

    root.traverse((child) => {
      if (child.name.startsWith("COL_")) {
        child.visible = false;
        colliders.push(child);
      } else if (child.name.startsWith("INTERACT_")) {
        const prompt = (child.userData?.interactPrompt as string) ?? "[E] Interact";
        interactables.push({ object: child, prompt });
      }
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return { colliders, interactables };
  }
}
