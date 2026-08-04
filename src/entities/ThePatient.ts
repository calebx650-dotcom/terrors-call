import * as THREE from "three";
import { fabricTexture } from "../engine/materials/proceduralTextures";

export type PatientState =
  | "dormant"
  | "observed"
  | "unobserved"
  | "close_contact"
  | "reset_cooldown";

export interface StalkingHooks {
  getPlayerPosition: () => THREE.Vector3;
  /** Meshes that block line of sight (walls). */
  occluders: THREE.Object3D[];
  onReposition: (to: THREE.Vector3) => void;
  onCloseContact: () => void;
}

const UNOBSERVED_BEFORE_MOVE = 2.6; // seconds out of sight before it may move
const CLOSE_CONTACT_RADIUS = 2.1;
const CLOSE_CONTACT_RADIUS_CROUCHED = 1.3; // crouching = hiding, smaller trigger
const RESET_COOLDOWN = 9; // seconds after a close-contact event before it acts again
const MAX_OBSERVE_DISTANCE = 30;

/**
 * The Patient. One hard rule drives everything: IT DOES NOT MOVE WHILE
 * OBSERVED. Repositioning only happens after the player has kept it fully
 * out of view (frustum + occlusion + distance) for a few seconds, and only
 * to one of the scene's predefined anchor points. It never pursues — the
 * threat is that it is somewhere else every time you stop watching, and
 * that being close to it is dangerous.
 *
 * The FSM (dormant → observed ⇄ unobserved → reposition → close_contact →
 * reset) is deliberately small and self-contained so a future entity can
 * reuse the observed/unobserved machinery without inheriting Patient
 * specifics.
 */
export class ThePatient {
  group = new THREE.Group();
  state: PatientState = "dormant";

  private lyingGroup = new THREE.Group();
  private standingGroup = new THREE.Group();
  private eyes: THREE.Mesh[] = [];
  private breatheTime = 0;
  private chest!: THREE.Mesh;

  private stalking = false;
  private anchors: THREE.Vector3[] = [];
  private hooks: StalkingHooks | null = null;
  private unobservedTimer = 0;
  private cooldownTimer = 0;
  private playerCrouchedGetter: (() => boolean) | null = null;

  private frustum = new THREE.Frustum();
  private frustumMatrix = new THREE.Matrix4();
  private raycaster = new THREE.Raycaster();

  /** Set true by the scene during medical interactions to suppress stalking checks. */
  interactionLock = false;

  constructor() {
    const skinMat = new THREE.MeshStandardMaterial({
      map: fabricTexture([196, 186, 170]),
      roughness: 0.95,
    });
    const clothesMat = new THREE.MeshStandardMaterial({
      map: fabricTexture([88, 92, 104]),
      roughness: 0.9,
    });

    // ---- lying pose (the "medical emergency" presentation) ----
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.24, 0.78), clothesMat);
    torso.position.set(0, 0.14, 0);
    torso.castShadow = true;
    this.lyingGroup.add(torso);
    this.chest = torso;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), skinMat);
    head.position.set(0, 0.16, 0.52);
    head.castShadow = true;
    this.lyingGroup.add(head);

    // Eyes: closed by default (invisible), flashed open for ~1 frame scares.
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xe8e4da });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.02), eyeMat);
      eye.position.set(side * 0.05, 0.28, 0.54);
      eye.rotation.x = -Math.PI / 2.6;
      eye.visible = false;
      this.lyingGroup.add(eye);
      this.eyes.push(eye);
    }

    const legGeo = new THREE.BoxGeometry(0.18, 0.16, 0.72);
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, clothesMat);
      leg.position.set(side * 0.13, 0.1, -0.72);
      leg.castShadow = true;
      this.lyingGroup.add(leg);
    }
    const armGeo = new THREE.BoxGeometry(0.13, 0.13, 0.6);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(armGeo, skinMat);
      arm.position.set(side * 0.36, 0.12, 0.05);
      arm.castShadow = true;
      this.lyingGroup.add(arm);
    }

    // ---- standing pose (stalking phase silhouette) ----
    const sTorso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.72, 0.28), clothesMat);
    sTorso.position.y = 1.22;
    sTorso.castShadow = true;
    this.standingGroup.add(sTorso);
    const sHead = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), skinMat);
    sHead.position.y = 1.75;
    sHead.castShadow = true;
    this.standingGroup.add(sHead);
    for (const side of [-1, 1]) {
      const sLeg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.86, 0.2), clothesMat);
      sLeg.position.set(side * 0.13, 0.43, 0);
      sLeg.castShadow = true;
      this.standingGroup.add(sLeg);
      const sArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.66, 0.12), skinMat);
      // Arms hang a little too straight, a little too long.
      sArm.position.set(side * 0.34, 1.1, 0);
      sArm.castShadow = true;
      this.standingGroup.add(sArm);
    }

    this.standingGroup.visible = false;
    this.group.add(this.lyingGroup);
    this.group.add(this.standingGroup);
  }

  setMode(mode: "lying" | "standing") {
    this.lyingGroup.visible = mode === "lying";
    this.standingGroup.visible = mode === "standing";
  }

  /** Opens the eyes for `ms` milliseconds — the one-frame first scare. */
  eyesFlash(ms = 90) {
    for (const eye of this.eyes) eye.visible = true;
    window.setTimeout(() => {
      for (const eye of this.eyes) eye.visible = false;
    }, ms);
  }

  enableStalking(
    anchors: THREE.Vector3[],
    hooks: StalkingHooks,
    isPlayerCrouched: () => boolean,
  ) {
    this.stalking = true;
    this.anchors = anchors;
    this.hooks = hooks;
    this.playerCrouchedGetter = isPlayerCrouched;
    this.setMode("standing");
    this.state = "observed";
  }

  disableStalking() {
    this.stalking = false;
    this.state = "dormant";
  }

  /**
   * True if the Patient is currently observed: inside the camera frustum,
   * within range, and not fully occluded by a wall.
   */
  isObserved(camera: THREE.PerspectiveCamera): boolean {
    const head = new THREE.Vector3();
    this.group.getWorldPosition(head);
    head.y += this.standingGroup.visible ? 1.6 : 0.25;

    const camPos = camera.getWorldPosition(new THREE.Vector3());
    if (camPos.distanceTo(head) > MAX_OBSERVE_DISTANCE) return false;

    this.frustumMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    this.frustum.setFromProjectionMatrix(this.frustumMatrix);
    if (!this.frustum.containsPoint(head)) return false;

    if (this.hooks && this.hooks.occluders.length > 0) {
      const dir = head.clone().sub(camPos);
      const dist = dir.length();
      this.raycaster.set(camPos, dir.normalize());
      this.raycaster.far = dist - 0.2;
      const blocked = this.raycaster.intersectObjects(
        this.hooks.occluders,
        true,
      );
      if (blocked.length > 0) return false;
    }
    return true;
  }

  update(dt: number, camera: THREE.PerspectiveCamera) {
    this.breatheTime += dt;
    // The too-long-held breath: chest rises, pauses unnaturally, falls.
    const cycle = this.breatheTime % 7;
    const lift =
      cycle < 2 ? Math.sin((cycle / 2) * Math.PI * 0.5) : cycle < 5.4 ? 1 : Math.max(0, 1 - (cycle - 5.4) / 1.6);
    this.chest.scale.y = 1 + lift * 0.12;

    if (!this.stalking || !this.hooks || this.interactionLock) return;

    if (this.state === "reset_cooldown") {
      this.cooldownTimer -= dt;
      if (this.cooldownTimer <= 0) this.state = "observed";
      return;
    }

    const observed = this.isObserved(camera);
    const playerPos = this.hooks.getPlayerPosition();
    const myPos = this.group.getWorldPosition(new THREE.Vector3());
    const distToPlayer = new THREE.Vector2(
      playerPos.x - myPos.x,
      playerPos.z - myPos.z,
    ).length();

    // Close contact is dangerous whether or not the player is looking.
    const contactRadius = this.playerCrouchedGetter?.()
      ? CLOSE_CONTACT_RADIUS_CROUCHED
      : CLOSE_CONTACT_RADIUS;
    if (distToPlayer < contactRadius) {
      this.state = "close_contact";
      this.hooks.onCloseContact();
      // Retreat to the anchor farthest from the player, then cool down.
      const far = this.farthestAnchorFrom(playerPos);
      if (far) this.group.position.copy(far);
      this.state = "reset_cooldown";
      this.cooldownTimer = RESET_COOLDOWN;
      this.unobservedTimer = 0;
      return;
    }

    if (observed) {
      // THE RULE: while any part of it is watched, it is furniture.
      this.state = "observed";
      this.unobservedTimer = 0;
      return;
    }

    this.state = "unobserved";
    this.unobservedTimer += dt;
    if (this.unobservedTimer >= UNOBSERVED_BEFORE_MOVE) {
      this.unobservedTimer = 0;
      const next = this.pickAnchor(playerPos, camera);
      if (next) {
        this.group.position.copy(next);
        this.hooks.onReposition(next);
      }
    }
  }

  /** Prefer anchors nearer the player — but never one currently on screen. */
  private pickAnchor(
    playerPos: THREE.Vector3,
    camera: THREE.PerspectiveCamera,
  ): THREE.Vector3 | null {
    const current = this.group.position;
    const candidates = this.anchors
      .filter((a) => a.distanceTo(current) > 0.5)
      .filter((a) => a.distanceTo(playerPos) > CLOSE_CONTACT_RADIUS + 0.8)
      .filter((a) => !this.anchorVisible(a, camera))
      .sort(
        (a, b) => a.distanceTo(playerPos) - b.distanceTo(playerPos),
      );
    if (candidates.length === 0) return null;
    // Nearest visible-safe anchor most of the time; occasionally second-nearest
    // so the pattern never becomes fully predictable.
    const idx = Math.random() < 0.7 ? 0 : Math.min(1, candidates.length - 1);
    return candidates[idx];
  }

  private anchorVisible(
    anchor: THREE.Vector3,
    camera: THREE.PerspectiveCamera,
  ): boolean {
    const point = anchor.clone();
    point.y += 1.5;
    this.frustumMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    this.frustum.setFromProjectionMatrix(this.frustumMatrix);
    if (!this.frustum.containsPoint(point)) return false;
    // In frustum — check occlusion; a wall between counts as not visible.
    if (this.hooks && this.hooks.occluders.length > 0) {
      const camPos = camera.getWorldPosition(new THREE.Vector3());
      const dir = point.clone().sub(camPos);
      const dist = dir.length();
      this.raycaster.set(camPos, dir.normalize());
      this.raycaster.far = dist - 0.2;
      if (this.raycaster.intersectObjects(this.hooks.occluders, true).length > 0) {
        return false;
      }
    }
    return true;
  }

  private farthestAnchorFrom(pos: THREE.Vector3): THREE.Vector3 | null {
    let best: THREE.Vector3 | null = null;
    let bestDist = -1;
    for (const a of this.anchors) {
      const d = a.distanceTo(pos);
      if (d > bestDist) {
        bestDist = d;
        best = a;
      }
    }
    return best;
  }
}

/**
 * The real patient, found in the basement — dead roughly three days.
 * Deliberately restrained: darkened, sunken, motionless. The horror is the
 * recognition, not the gore.
 */
export function buildDeadBody(): THREE.Group {
  const group = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({
    map: fabricTexture([96, 88, 74]),
    roughness: 1,
  });
  const clothesMat = new THREE.MeshStandardMaterial({
    map: fabricTexture([58, 60, 66]),
    roughness: 1,
  });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.76), clothesMat);
  torso.position.set(0, 0.1, 0);
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), skinMat);
  head.position.set(0, 0.12, 0.5);
  head.scale.y = 0.85; // sunken
  group.add(head);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.13, 0.7), clothesMat);
    leg.position.set(side * 0.12, 0.07, -0.7);
    group.add(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.55), skinMat);
    arm.position.set(side * 0.34, 0.08, 0.02);
    group.add(arm);
  }

  // A dark stain spreading from beneath — flat decal, no detail.
  const stain = new THREE.Mesh(
    new THREE.CircleGeometry(0.9, 12),
    new THREE.MeshBasicMaterial({ color: 0x140c08, transparent: true, opacity: 0.75 }),
  );
  stain.rotation.x = -Math.PI / 2;
  stain.position.y = 0.015;
  group.add(stain);

  group.traverse((c) => {
    if (c instanceof THREE.Mesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  return group;
}
