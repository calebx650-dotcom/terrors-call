import * as THREE from "three";

/** A handheld flashlight rigged to the camera, with a subtle battery flicker. */
export class Flashlight {
  light: THREE.SpotLight;
  private target: THREE.Object3D;
  private flickerTimer = 0;
  on = true;

  constructor(camera: THREE.PerspectiveCamera) {
    this.light = new THREE.SpotLight(0xfff2d6, 3.2, 14, Math.PI / 7, 0.55, 1.3);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(512, 512);
    this.light.shadow.bias = -0.002;

    this.target = new THREE.Object3D();
    camera.add(this.light);
    camera.add(this.target);
    this.light.position.set(0.15, -0.1, 0.1);
    this.target.position.set(0, 0, -1);
    this.light.target = this.target;
  }

  toggle() {
    this.on = !this.on;
    this.light.visible = this.on;
  }

  update(dt: number) {
    if (!this.on) return;
    this.flickerTimer -= dt;
    if (this.flickerTimer <= 0) {
      // Rare, brief instability rather than constant flicker.
      if (Math.random() < 0.04) {
        this.light.intensity = 3.2 * (0.4 + Math.random() * 0.3);
        this.flickerTimer = 0.06;
      } else {
        this.light.intensity = 3.2;
        this.flickerTimer = 0.1;
      }
    }
  }
}
