import * as THREE from "three";

/**
 * The handheld flashlight — the game's primary light source and a big part
 * of its feel. Three behaviors sell "a tired human hand is holding this":
 *
 * 1. Lag: the beam trails the camera's look velocity slightly and settles
 *    (a damped offset on the light target), instead of being welded to
 *    center-screen.
 * 2. Idle sway: a slow breathing drift, always present, amplitude small
 *    enough to feel rather than see.
 * 3. Instability: rare, brief intensity dips (aging batteries).
 */
export class Flashlight {
  light: THREE.SpotLight;
  private target: THREE.Object3D;
  private flickerTimer = 0;
  on = true;

  private swayX = 0;
  private swayY = 0;
  private swayTime = Math.random() * 10;
  private impulseX = 0;
  private impulseY = 0;

  constructor(camera: THREE.PerspectiveCamera) {
    this.light = new THREE.SpotLight(0xfff2d6, 3.2, 14, Math.PI / 7, 0.55, 1.3);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(1024, 1024);
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

  /** A small random jolt — fired on footsteps so the beam lands with the step. */
  kick(strength: number) {
    this.impulseX += (Math.random() - 0.5) * strength;
    this.impulseY -= Math.random() * strength * 0.7;
  }

  update(dt: number, yawVel = 0, pitchVel = 0) {
    if (!this.on) return;

    // Handheld lag: beam drags opposite the look velocity, then settles.
    const lagX = THREE.MathUtils.clamp(-yawVel * 0.045, -0.09, 0.09);
    const lagY = THREE.MathUtils.clamp(-pitchVel * 0.045, -0.07, 0.07);
    const k = Math.min(1, dt * 5.5);
    this.swayX += (lagX - this.swayX) * k;
    this.swayY += (lagY - this.swayY) * k;

    // Idle breathing drift.
    this.swayTime += dt;
    const idleX = Math.sin(this.swayTime * 0.9) * 0.012;
    const idleY = Math.sin(this.swayTime * 1.4 + 1.7) * 0.009;

    // Footstep impulses decay quickly — the beam settles like a held object.
    const decay = Math.max(0, 1 - dt * 7);
    this.impulseX *= decay;
    this.impulseY *= decay;

    this.target.position.set(
      this.swayX + idleX + this.impulseX,
      this.swayY + idleY + this.impulseY,
      -1,
    );

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
