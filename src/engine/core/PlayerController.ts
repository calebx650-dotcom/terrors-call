import * as THREE from "three";
import { CollisionWorld } from "./CollisionWorld";

const WALK_SPEED = 2.6;
const EYE_HEIGHT = 1.65;
const MOUSE_SENSITIVITY = 0.0022;

export class PlayerController {
  camera: THREE.PerspectiveCamera;
  domElement: HTMLElement;
  collisionWorld: CollisionWorld;

  position = new THREE.Vector3(0, EYE_HEIGHT, 0);
  yaw = 0;
  pitch = 0;

  private keys: Record<string, boolean> = {};
  private locked = false;
  private footstepTimer = 0;
  onFootstep: (() => void) | null = null;

  private shakeTime = 0;
  private shakeDuration = 0;
  private shakeIntensity = 0;
  /** When false, WASD input is ignored (scripted/vehicle sequences) while look is still free. */
  movementEnabled = true;

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    collisionWorld: CollisionWorld,
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.collisionWorld = collisionWorld;

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onLockChange);
  }

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("pointerlockchange", this.onLockChange);
  }

  requestLock() {
    this.domElement.requestPointerLock();
  }

  private onLockChange = () => {
    this.locked = document.pointerLockElement === this.domElement;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys[e.code] = true;
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.locked) return;
    this.yaw -= e.movementX * MOUSE_SENSITIVITY;
    this.pitch -= e.movementY * MOUSE_SENSITIVITY;
    const limit = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
  };

  setSpawn(x: number, z: number, yaw = 0) {
    this.position.set(x, EYE_HEIGHT, z);
    this.yaw = yaw;
  }

  /** Kicks off a decaying random camera jolt — used for the ambulance impact. */
  triggerShake(intensity: number, duration: number) {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeTime = duration;
  }

  update(dt: number) {
    if (!this.movementEnabled) {
      this.keys = {};
    }
    const forward = new THREE.Vector3(
      Math.sin(this.yaw),
      0,
      Math.cos(this.yaw),
    );
    const right = new THREE.Vector3(
      Math.sin(this.yaw + Math.PI / 2),
      0,
      Math.cos(this.yaw + Math.PI / 2),
    );

    let moveX = 0;
    let moveZ = 0;
    if (this.keys["KeyW"] || this.keys["ArrowUp"]) {
      moveX -= forward.x;
      moveZ -= forward.z;
    }
    if (this.keys["KeyS"] || this.keys["ArrowDown"]) {
      moveX += forward.x;
      moveZ += forward.z;
    }
    if (this.keys["KeyA"] || this.keys["ArrowLeft"]) {
      moveX -= right.x;
      moveZ -= right.z;
    }
    if (this.keys["KeyD"] || this.keys["ArrowRight"]) {
      moveX += right.x;
      moveZ += right.z;
    }

    const moving = moveX !== 0 || moveZ !== 0;
    if (moving) {
      const len = Math.hypot(moveX, moveZ);
      moveX = (moveX / len) * WALK_SPEED * dt;
      moveZ = (moveZ / len) * WALK_SPEED * dt;

      const delta = new THREE.Vector3(moveX, 0, moveZ);
      this.position = this.collisionWorld.resolveMove(
        this.position,
        delta,
        0.35,
      );

      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        this.onFootstep?.();
        this.footstepTimer = 0.45;
      }
    } else {
      this.footstepTimer = 0;
    }

    this.camera.position.copy(this.position);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const falloff = Math.max(0, this.shakeTime / this.shakeDuration);
      const mag = this.shakeIntensity * falloff;
      this.camera.position.x += (Math.random() - 0.5) * mag;
      this.camera.position.y += (Math.random() - 0.5) * mag;
      this.camera.rotateZ((Math.random() - 0.5) * mag * 0.6);
    }
  }

  get isLocked() {
    return this.locked;
  }
}
