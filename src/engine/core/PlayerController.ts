import * as THREE from "three";
import { CollisionWorld } from "./CollisionWorld";

const WALK_SPEED = 2.4;
const SPRINT_SPEED = 4.3;
const CROUCH_SPEED = 1.3;
const STAND_EYE_HEIGHT = 1.65;
const CROUCH_EYE_HEIGHT = 1.05;
const MOUSE_SENSITIVITY = 0.0022;
const TURN_INERTIA = 0.18; // 0 = snap, 1 = mush; tuned for "hand on a heavy head"
const SPRINT_DRAIN_PER_SEC = 1 / 6; // empty after ~6s of sprinting
const STAMINA_REGEN_PER_SEC = 1 / 11;

export class PlayerController {
  camera: THREE.PerspectiveCamera;
  domElement: HTMLElement;
  collisionWorld: CollisionWorld;

  position = new THREE.Vector3(0, STAND_EYE_HEIGHT, 0);
  yaw = 0;
  pitch = 0;
  // Raw look targets — the visible yaw/pitch chases these each frame.
  private yawTarget = 0;
  private pitchTarget = 0;

  /**
   * 0..1, never shown on screen — the brief bans a stamina bar. The player
   * reads their condition through breathing (onBreathState) and footstep
   * cadence instead.
   */
  stamina = 1;
  crouched = false;

  private keys: Record<string, boolean> = {};
  private locked = false;
  private footstepTimer = 0;
  private eyeHeight = STAND_EYE_HEIGHT;
  onFootstep: ((running: boolean) => void) | null = null;
  /** intensity 0 (rested) .. 1 (winded); drives procedural breathing audio. */
  onBreathState: ((intensity: number) => void) | null = null;

  private shakeTime = 0;
  private shakeDuration = 0;
  private shakeIntensity = 0;
  private bobPhase = 0;
  private bobAmount = 0; // eased in/out so stopping doesn't snap the camera
  private idleTime = Math.random() * 10;
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
    if (e.code === "KeyX" || e.code === "ControlLeft") {
      this.crouched = !this.crouched;
    }
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.locked) return;
    this.yawTarget -= e.movementX * MOUSE_SENSITIVITY;
    this.pitchTarget -= e.movementY * MOUSE_SENSITIVITY;
    const limit = Math.PI / 2 - 0.05;
    this.pitchTarget = Math.max(-limit, Math.min(limit, this.pitchTarget));
  };

  setSpawn(x: number, z: number, yaw = 0) {
    this.position.set(x, this.eyeHeight, z);
    this.snapLook(yaw, 0);
  }

  /**
   * Instantaneous look reset. Use this instead of writing `player.yaw`
   * directly: the visible yaw/pitch chases private targets each frame for
   * turn inertia, so writing only the visible field silently drifts back
   * to a stale target. The rule is: mouse-look sets targets; scripted
   * framing snaps both. (Kept as one method so no caller can forget half.)
   */
  snapLook(yaw: number, pitch = 0) {
    this.yaw = yaw;
    this.pitch = pitch;
    this.yawTarget = yaw;
    this.pitchTarget = pitch;
  }

  /** Kicks off a decaying random camera jolt — used for impacts and scares. */
  triggerShake(intensity: number, duration: number) {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeTime = duration;
  }

  update(dt: number) {
    if (!this.movementEnabled) {
      this.keys = {};
    }

    // Turn inertia: yaw/pitch chase their targets. Framerate-independent
    // exponential smoothing so behavior doesn't change with fps.
    const chase = 1 - Math.pow(TURN_INERTIA, dt * 60);
    this.yaw += (this.yawTarget - this.yaw) * chase;
    this.pitch += (this.pitchTarget - this.pitch) * chase;

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
    const wantsSprint =
      (this.keys["ShiftLeft"] || this.keys["ShiftRight"]) && !this.crouched;
    const sprinting = moving && wantsSprint && this.stamina > 0.02;

    if (sprinting) {
      this.stamina = Math.max(0, this.stamina - SPRINT_DRAIN_PER_SEC * dt);
    } else {
      this.stamina = Math.min(1, this.stamina + STAMINA_REGEN_PER_SEC * dt);
    }
    this.onBreathState?.(1 - this.stamina);

    const targetEye = this.crouched ? CROUCH_EYE_HEIGHT : STAND_EYE_HEIGHT;
    this.eyeHeight += (targetEye - this.eyeHeight) * Math.min(1, dt * 8);
    this.position.y = this.eyeHeight;

    if (moving) {
      const speed = sprinting
        ? SPRINT_SPEED
        : this.crouched
          ? CROUCH_SPEED
          : WALK_SPEED;
      const len = Math.hypot(moveX, moveZ);
      moveX = (moveX / len) * speed * dt;
      moveZ = (moveZ / len) * speed * dt;

      const delta = new THREE.Vector3(moveX, 0, moveZ);
      this.position = this.collisionWorld.resolveMove(
        this.position,
        delta,
        0.35,
      );
      this.position.y = this.eyeHeight;

      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        this.onFootstep?.(sprinting);
        this.footstepTimer = sprinting ? 0.32 : this.crouched ? 0.7 : 0.5;
      }
    } else {
      this.footstepTimer = 0;
    }

    this.camera.position.copy(this.position);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);

    // Head bob (eased so stopping never snaps) + a constant breathing sway.
    // Amplitudes are deliberately tiny: felt, not watched.
    const targetBob = moving ? (sprinting ? 1.4 : this.crouched ? 0.5 : 1) : 0;
    this.bobAmount += (targetBob - this.bobAmount) * Math.min(1, dt * 6);
    if (this.bobAmount > 0.01) {
      this.bobPhase += dt * (sprinting ? 11 : this.crouched ? 5 : 7.5);
      this.camera.translateY(Math.abs(Math.sin(this.bobPhase)) * 0.014 * this.bobAmount);
      this.camera.translateX(Math.cos(this.bobPhase * 0.5) * 0.008 * this.bobAmount);
    }
    this.idleTime += dt;
    this.camera.translateY(Math.sin(this.idleTime * 1.6) * 0.004);

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
