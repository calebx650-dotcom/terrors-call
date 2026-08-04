import * as THREE from "three";
import { GameEngine } from "../engine/core/GameEngine";
import { HorrorDirector } from "../engine/horror/HorrorDirector";
import { Interactable } from "../engine/core/InteractionSystem";
import { ThePatient, buildDeadBody } from "../entities/ThePatient";
import {
  MaterialKit,
  damagedPlasterKit,
  rustedMetalKit,
  stoneFloorKit,
  woodPlankKit,
} from "../engine/materials/materialKits";
import { grassGroundTexture, fabricTexture } from "../engine/materials/proceduralTextures";
import {
  createVolumetricCone,
  updateVolumetricCone,
} from "../engine/fx/VolumetricCone";
import { GradePreset } from "../engine/postfx/RetroPostFX";
import { useGameStore } from "../state/gameStore";
import { saveMidpointCheckpoint } from "../game/checkpoint";
import {
  dispatchIntroLines,
  arrivalLines,
  sceneSafetyLines,
  patientFoundLines,
  responsivenessLines,
  airwayLines,
  pulseAfterLines,
  pupilsLines,
  pupilsWrongLines,
  vitalsLines,
  assessmentDoneLines,
  phoneLines,
  medsLines,
  kitchenNoteLines,
  photosFirstLines,
  photosSecondLines,
  photosThirdLines,
  bathroomKeyLines,
  bathroomMirrorLines,
  previousPcrLines,
  stalkingStartLines,
  stalkingBark1,
  stalkingBark2,
  bedroomLines,
  bedroomExitLines,
  basementDoorLines,
  basementBodyLines,
  radioTellLines,
  endingChoiceLines,
  endingALines,
  endingBLines,
  patientWhisper,
} from "../data/dialogue";

type Zone =
  | "exterior"
  | "porch"
  | "entry"
  | "livingroom"
  | "kitchen"
  | "hallway"
  | "bathroom"
  | "upstairs"
  | "basement";

const UPSTAIRS_X = 60;
const BASEMENT_X = 120;

export interface FarmhouseCallbacks {
  onPhaseChange: (phase: string) => void;
}

export interface FarmhouseOptions {
  /** Restore to the start of the stalking phase (post-midpoint checkpoint). */
  restoreMidpoint?: boolean;
}

/**
 * The whole demo lives in this scene: farmhouse ground floor around the
 * origin, upstairs zone at x=60, basement zone at x=120, connected by
 * fade-transition "stair" interactions — the same hard-cut approach classic
 * 1998 survival horror used for doors, which also keeps each floor's
 * collision fully independent (see ARCHITECTURE §13's collider lesson).
 */
export class FarmhouseScene {
  private engine: GameEngine;
  private callbacks: FarmhouseCallbacks;
  private horror: HorrorDirector;

  private patient: ThePatient;
  private zone: Zone = "exterior";
  private stage: 1 | 2 | 3 = 1;

  private occluders: THREE.Object3D[] = [];
  private movableProps: THREE.Object3D[] = [];
  private lights: THREE.Light[] = [];

  private frontDoor!: THREE.Mesh;
  private frontDoorOpen = false;
  private basementDoorInteractable!: Interactable;
  private bedroomDoorInteractable!: Interactable;
  private bedroomDoorOpen = false;
  private pcrTableInteractable!: Interactable;
  private radioInteractable!: Interactable;
  private bodyInteractable!: Interactable;

  private patientAssess!: Interactable;
  private assessStep:
    | "responsiveness"
    | "airway"
    | "pulse"
    | "pupils"
    | "vitals"
    | "done" = "responsiveness";

  private photoMeshes: THREE.Mesh[] = [];
  private photoStage = 0;
  private hallwayWasVisited = false;

  private moon!: THREE.DirectionalLight;
  private lightningTimer = 6;
  private rainPoints!: THREE.Points;

  // Art-direction state.
  private flasherL!: THREE.PointLight;
  private flasherR!: THREE.PointLight;
  private flasherMatL!: THREE.MeshStandardMaterial;
  private flasherMatR!: THREE.MeshStandardMaterial;
  private beamCone!: THREE.Mesh;
  private moonbeamCone!: THREE.Mesh;
  private beamDust!: THREE.Points;
  private bulbPivot!: THREE.Group;
  private bulbLight!: THREE.SpotLight;
  private lightningPanes: THREE.MeshBasicMaterial[] = [];
  private tvMat!: THREE.MeshStandardMaterial;
  private fogTarget = 0.055;
  private fridgeLight!: THREE.PointLight;
  private fridgeLightOn = false;
  private curtain!: THREE.Mesh;
  private penLightPt!: THREE.PointLight;
  private stormAge = 0;
  private lightningFigure: THREE.Mesh | null = null;

  private cluesFound = new Set<string>();
  private flags = {
    arrived: false,
    entered: false,
    patientSeen: false,
    assessmentDone: false,
    midpoint: false,
    bedroomEvidence: false,
    basementOpen: false,
    bodyFound: false,
    radioTellDone: false,
    endingChosen: false,
  };
  private stalkBarksFired = 0;
  private pupilsWrongFired = false;
  private transitioning = false;

  constructor(
    engine: GameEngine,
    callbacks: FarmhouseCallbacks,
    opts: FarmhouseOptions = {},
  ) {
    this.engine = engine;
    this.callbacks = callbacks;

    this.horror = new HorrorDirector({
      audio: engine.audio,
      triggerVisualEvent: (kind) => this.handleVisualEvent(kind),
      getPlayerZone: () => this.zone,
      getTensionStage: () => this.stage,
    });

    this.setupLighting();
    this.buildExterior();
    this.buildHouseShell();
    this.buildLivingRoom();
    this.buildKitchen();
    this.buildHallway();
    this.buildBathroom();
    this.buildUpstairs();
    this.buildBasement();

    this.patient = new ThePatient();
    this.patient.group.position.set(-4.5, 0, 6);
    this.engine.scene.add(this.patient.group);
    this.buildPatientInteraction();

    // Volumetric flashlight shaft + drifting dust caught in the beam —
    // both parented to the camera so they cost nothing to keep aligned.
    this.beamCone = createVolumetricCone(0xfff0d0, 7.5, 2.3, 0.038);
    this.beamCone.position.set(0.12, -0.08, 0);
    this.engine.camera.add(this.beamCone);
    this.buildBeamDust();

    this.engine.audio.startRain(0.25);
    this.engine.audio.startAmbience();

    this.engine.addUpdateHook((dt) => this.update(dt));

    if (opts.restoreMidpoint) {
      this.restoreToMidpoint();
    } else {
      this.engine.player.setSpawn(1.8, -12, Math.PI);
      window.setTimeout(() => {
        this.engine.dialogue.play(dispatchIntroLines, () => {
          this.setObjective("Scene safety first. Then find the patient.");
        });
      }, 1500);
    }
  }

  // ================= store helpers =================

  private setObjective(text: string) {
    useGameStore.getState().updatePcr({ objective: text });
  }
  private pcr(patch: Parameters<ReturnType<typeof useGameStore.getState>["updatePcr"]>[0]) {
    useGameStore.getState().updatePcr(patch);
  }
  private note(text: string) {
    useGameStore.getState().addPcrNote(text);
  }
  private addItem(id: string, name: string, description: string) {
    useGameStore.getState().addItem({ id, name, description });
  }

  // ================= world: lighting & exterior =================

  private setupLighting() {
    // Power is out. Cold, thin moonlight through rain; the flashlight is
    // the player's real light source. Lightning briefly relights the world.
    this.moon = new THREE.DirectionalLight(0x7286ad, 1.7);
    this.moon.position.set(-14, 22, -8);
    this.engine.scene.add(this.moon);

    const hemi = new THREE.HemisphereLight(0x33406a, 0x0c0d12, 0.85);
    this.engine.scene.add(hemi);

    const ambient = new THREE.AmbientLight(0x232a40, 0.7);
    this.engine.scene.add(ambient);
  }

  private buildExterior() {
    const tex = grassGroundTexture();
    tex.repeat.set(24, 24);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 90),
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.72, // soaked earth reads slightly specular
        envMapIntensity: 0.7,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -10;
    ground.receiveShadow = true;
    this.engine.scene.add(ground);

    // Standing water catching the flashers and the sky.
    const puddleMat = new THREE.MeshStandardMaterial({
      color: 0x05070c,
      roughness: 0.06,
      metalness: 0.35,
      envMapIntensity: 1.6,
    });
    for (const [x, z, r] of [[-0.4, -7.5, 0.9], [2.2, -11, 0.65], [-3.6, -10.5, 0.75], [1.1, -3.6, 0.5]] as [number, number, number][]) {
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(r, 14), puddleMat);
      puddle.rotation.x = -Math.PI / 2;
      puddle.position.set(x, 0.012, z);
      this.engine.scene.add(puddle);
    }

    this.buildAmbulance();
    this.buildRain();
    this.buildSplashes();
    this.buildStorytellingDecals();

    // Porch: raised slab + posts + shallow roof. The boards are rain-slick.
    const woodKit = woodPlankKit();
    woodKit.setRepeat(4, 2);
    woodKit.material.roughness = 0.5;
    woodKit.material.envMapIntensity = 0.9;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(8, 0.18, 2.4), woodKit.material);
    slab.position.set(0, 0.09, -1.2);
    slab.receiveShadow = true;
    this.engine.scene.add(slab);
    const postGeo = new THREE.BoxGeometry(0.16, 2.6, 0.16);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x241d16, roughness: 1 });
    for (const x of [-3.6, 3.6]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(x, 1.3, -2.2);
      post.castShadow = true;
      this.engine.scene.add(post);
      this.engine.collisionWorld.addFromMesh(post);
    }
    const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.16, 2.8), postMat);
    porchRoof.position.set(0, 2.7, -1.3);
    porchRoof.castShadow = true;
    this.engine.scene.add(porchRoof);
  }

  private beaconLight!: THREE.PointLight;

  private buildAmbulance() {
    const group = new THREE.Group();
    // Rain-wet paint: low roughness + envMapIntensity make the body pick
    // up the night sky and the flashers.
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xd8d8d0,
      roughness: 0.3,
      metalness: 0.15,
      envMapIntensity: 1.2,
    });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xaa1f1f, roughness: 0.4, envMapIntensity: 1.1 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.1, 5.2), bodyMat);
    body.position.y = 1.1;
    body.castShadow = true;
    group.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.22, 0.3, 5.22), stripeMat);
    stripe.position.y = 0.9;
    group.add(stripe);
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 1.3, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xc9c9c2, roughness: 0.5 }),
    );
    cab.position.set(0, 1.55, -3.3);
    cab.castShadow = true;
    group.add(cab);
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 8);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    for (const [x, z] of [[-1.15, -2.6], [1.15, -2.6], [-1.15, 2], [1.15, 2]] as [number, number][]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.4, z);
      group.add(wheel);
    }
    // Mud spray along the lower panels — it has been a long shift.
    const mud = new THREE.Mesh(
      new THREE.BoxGeometry(2.24, 0.35, 5.24),
      new THREE.MeshStandardMaterial({ color: 0x2e2418, roughness: 1 }),
    );
    mud.position.y = 0.42;
    group.add(mud);

    this.beaconLight = new THREE.PointLight(0xff2222, 0.4, 9);
    this.beaconLight.position.set(0, 2.4, -1);
    group.add(this.beaconLight);

    // Lightbar with alternating red flashers — Marcus left the emergency
    // lights running. Their sweep across the wet yard and the house facade
    // is the exterior's anchor image, and a promise of safety the ending
    // is designed to break.
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.16, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x191a1e, roughness: 0.4 }),
    );
    bar.position.set(0, 2.24, -2.8);
    group.add(bar);
    this.flasherMatL = new THREE.MeshStandardMaterial({
      color: 0x550c08,
      emissive: 0xff1a10,
      emissiveIntensity: 0,
      roughness: 0.3,
    });
    this.flasherMatR = this.flasherMatL.clone();
    const lensL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.3), this.flasherMatL);
    lensL.position.set(-0.5, 2.25, -2.8);
    group.add(lensL);
    const lensR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.3), this.flasherMatR);
    lensR.position.set(0.5, 2.25, -2.8);
    group.add(lensR);
    this.flasherL = new THREE.PointLight(0xff2a1a, 0, 26, 1.1);
    this.flasherL.position.set(-0.6, 2.5, -2.8);
    group.add(this.flasherL);
    this.flasherR = new THREE.PointLight(0xff2a1a, 0, 26, 1.1);
    this.flasherR.position.set(0.6, 2.5, -2.8);
    group.add(this.flasherR);

    group.position.set(-1.5, 0, -14);
    group.rotation.y = 0.28;
    this.engine.scene.add(group);
    this.engine.collisionWorld.addFromMesh(group);

    // The dash radio: story anchor at both ends of the demo.
    const radio = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.4, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.5 }),
    );
    radio.position.set(-0.7, 1.5, -11.6);
    this.engine.scene.add(radio);
    this.radioInteractable = {
      object: radio,
      prompt: "[E] Radio dispatch",
      enabled: false,
      onInteract: () => this.useRadio(),
    };
    this.engine.interaction.register(this.radioInteractable);
  }

  private buildRain() {
    // Vertical streaks over the yard; recycled top-to-bottom each frame.
    const count = 420;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = -20 + Math.random() * 40;
      positions[i * 3 + 1] = Math.random() * 9;
      positions[i * 3 + 2] = -22 + Math.random() * 24;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x6d7d95,
      size: 0.024,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    this.rainPoints = new THREE.Points(geo, this.buildRainMaterial());
    this.rainPoints.frustumCulled = false;
    this.engine.scene.add(this.rainPoints);
  }

  /**
   * Rain that reacts to the flashlight and moonbeam instead of being flat
   * point sprites. In view space: streaks brighten as they approach the
   * camera's forward cone, and again along a moonbeam-aligned axis so the
   * cone above the patient sparkles. Both are cheap: only the sprite's own
   * position, one uniform each frame.
   */
  private rainUniforms = {
    beamDir: { value: new THREE.Vector3(0, 0, -1) },
    beamPos: { value: new THREE.Vector3() },
    beamActive: { value: 1.0 },
    moonPos: { value: new THREE.Vector3(-6.8, 2.85, 6) },
    moonDir: { value: new THREE.Vector3(0.4, -0.4, 0).normalize() },
  };
  private buildRainMaterial() {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        ...this.rainUniforms,
        baseColor: { value: new THREE.Color(0x6d7d95) },
        litColor: { value: new THREE.Color(0xffeecb) },
        moonColor: { value: new THREE.Color(0xaec0e2) },
      },
      vertexShader: /* glsl */ `
        uniform vec3 beamPos;
        uniform vec3 beamDir;
        uniform vec3 moonPos;
        uniform vec3 moonDir;
        varying float vBeam;
        varying float vMoon;
        varying float vDepth;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vDepth = -mv.z;
          // Beam response: brightest when the raindrop is close to the
          // camera AND inside the beam cone.
          vec3 toDrop = position - beamPos;
          float dist = length(toDrop);
          float cone = max(0.0, dot(normalize(toDrop), normalize(beamDir)));
          vBeam = smoothstep(0.55, 0.96, cone) * smoothstep(9.0, 1.5, dist);
          // Moon column: proximity to a vertical line under the window.
          vec3 toMoon = position - moonPos;
          float axial = dot(toMoon, normalize(moonDir));
          vec3 perp = toMoon - axial * normalize(moonDir);
          float perpDist = length(perp);
          vMoon = smoothstep(1.6, 0.2, perpDist) * step(-6.0, axial) * step(axial, 4.5);
          gl_Position = projectionMatrix * mv;
          // Nearby drops draw larger — real depth cue.
          gl_PointSize = mix(4.5, 1.2, clamp(vDepth / 18.0, 0.0, 1.0));
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 baseColor;
        uniform vec3 litColor;
        uniform vec3 moonColor;
        uniform float beamActive;
        varying float vBeam;
        varying float vMoon;
        varying float vDepth;
        void main() {
          // Streak shape: elongated in y within the point sprite.
          vec2 uv = gl_PointCoord - 0.5;
          float streak = smoothstep(0.5, 0.0, abs(uv.x) * 3.8)
                       * smoothstep(0.5, 0.05, abs(uv.y));
          if (streak < 0.02) discard;
          vec3 c = baseColor;
          c = mix(c, litColor, vBeam * beamActive * 0.9);
          c = mix(c, moonColor, vMoon * 0.65);
          float a = streak * (0.35 + vBeam * beamActive * 0.55 + vMoon * 0.3);
          // Distance fade
          a *= smoothstep(45.0, 6.0, vDepth) * 0.8 + 0.2;
          gl_FragColor = vec4(c, a);
        }
      `,
    });
  }

  /**
   * Rain hitting the ground and the porch: tiny expanding rings that
   * appear at random spots and fade. All CPU-updated, one instanced ring
   * pool, capped so it never spikes.
   */
  private splashes: Array<{ pos: THREE.Vector3; age: number }> = [];
  private splashPool: THREE.Mesh[] = [];
  private buildSplashes() {
    const ringGeo = new THREE.RingGeometry(0.02, 0.05, 12);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xbcc9dc,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    for (let i = 0; i < 22; i++) {
      const m = new THREE.Mesh(ringGeo, ringMat.clone());
      m.visible = false;
      m.renderOrder = 3;
      this.engine.scene.add(m);
      this.splashPool.push(m);
    }
  }

  private spawnSplash() {
    if (this.splashes.length >= this.splashPool.length) return;
    // Concentrate around the player so they always read on screen.
    const p = this.engine.player.position;
    const angle = Math.random() * Math.PI * 2;
    const radius = 1.5 + Math.random() * 5;
    this.splashes.push({
      pos: new THREE.Vector3(
        p.x + Math.cos(angle) * radius,
        0.021,
        p.z + Math.sin(angle) * radius,
      ),
      age: 0,
    });
  }

  /**
   * A close lightning strike sometimes lands a silhouette across the yard
   * that lasts a fraction of a second and then isn't there. Uses the
   * standing Patient's low-poly outline as a shape so the shape is
   * recognizable enough to unsettle without being explicit.
   */
  private spawnLightningFigure() {
    if (this.lightningFigure) return;
    const geo = new THREE.PlaneGeometry(0.9, 2.0);
    const c = document.createElement("canvas");
    c.width = 32;
    c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, 32, 64);
    ctx.fillStyle = "#000";
    // A tall thin humanoid: head, shoulders, body, straight arms.
    ctx.beginPath();
    ctx.arc(16, 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(11, 12, 10, 20); // torso
    ctx.fillRect(7, 14, 3, 22); // left arm
    ctx.fillRect(22, 14, 3, 22); // right arm
    ctx.fillRect(12, 32, 3, 26); // left leg
    ctx.fillRect(17, 32, 3, 26); // right leg
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.lightningFigure = new THREE.Mesh(geo, mat);
    // Placed at the tree line; billboarded once so it always faces the
    // player from a defensible viewing angle.
    const p = this.engine.player.position;
    const dx = -3 + Math.random() * 6;
    const dz = -18 + Math.random() * 3;
    this.lightningFigure.position.set(p.x + dx, 1, p.z + dz);
    this.lightningFigure.lookAt(p.x, 1, p.z);
    this.engine.scene.add(this.lightningFigure);
  }

  /**
   * The premise, told on the floor: three previous crews walked IN through
   * this door — muddy boot prints, fading as they dried, none pointing
   * out — and something heavy was dragged from the kitchen toward the
   * basement door. No dialogue references these; players who notice, notice.
   */
  private buildStorytellingDecals() {
    const printTex = (() => {
      const c = document.createElement("canvas");
      c.width = 32;
      c.height = 64;
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, 32, 64);
      ctx.fillStyle = "rgba(28,20,12,0.9)";
      // sole + heel of a work boot
      ctx.beginPath();
      ctx.ellipse(16, 20, 9, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(16, 50, 7, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      const t = new THREE.CanvasTexture(c);
      t.magFilter = THREE.NearestFilter;
      return t;
    })();

    // Three aging trails door -> living room, one fresh (Marcus will make
    // the fourth). Opacity encodes age.
    const trails: Array<{ opacity: number; offset: number }> = [
      { opacity: 0.3, offset: -0.5 },
      { opacity: 0.2, offset: 0.15 },
      { opacity: 0.12, offset: 0.6 },
    ];
    for (const trail of trails) {
      const waypoints: [number, number][] = [
        [0 + trail.offset * 0.4, 0.8],
        [-0.6 + trail.offset * 0.5, 2.4],
        [-1.6 + trail.offset, 4.2],
        [-2.8 + trail.offset, 5.2],
        [-3.8 + trail.offset * 0.6, 5.9],
      ];
      for (let i = 0; i < waypoints.length; i++) {
        const [x, z] = waypoints[i];
        const next = waypoints[Math.min(i + 1, waypoints.length - 1)];
        const angle = Math.atan2(next[0] - x, next[1] - z);
        const print = new THREE.Mesh(
          new THREE.PlaneGeometry(0.13, 0.3),
          new THREE.MeshBasicMaterial({
            map: printTex,
            transparent: true,
            opacity: trail.opacity,
            depthWrite: false,
          }),
        );
        print.rotation.x = -Math.PI / 2;
        print.rotation.z = -angle;
        // Alternate feet left/right of the walk line.
        const side = i % 2 === 0 ? -0.09 : 0.09;
        print.position.set(x + Math.cos(angle) * side, 0.022, z - Math.sin(angle) * side);
        print.renderOrder = 2;
        this.engine.scene.add(print);
      }
    }

    // Drag marks: two parallel scuffs, kitchen toward the basement door.
    const dragTex = (() => {
      const c = document.createElement("canvas");
      c.width = 32;
      c.height = 64;
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, 32, 64);
      ctx.strokeStyle = "rgba(24,16,10,0.75)";
      ctx.lineWidth = 4;
      for (const x of [10, 22]) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + 3, 20, x - 3, 44, x + 1, 64);
        ctx.stroke();
      }
      const t = new THREE.CanvasTexture(c);
      t.magFilter = THREE.NearestFilter;
      return t;
    })();
    const drag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 3.1),
      new THREE.MeshBasicMaterial({ map: dragTex, transparent: true, opacity: 0.34, depthWrite: false }),
    );
    drag.rotation.x = -Math.PI / 2;
    drag.rotation.z = -Math.atan2(5 - 4.2, 11.8 - 9);
    drag.position.set(4.6, 0.022, 10.4);
    drag.renderOrder = 2;
    this.engine.scene.add(drag);
  }

  /** A handful of dust motes drifting through the flashlight beam. */
  private buildBeamDust() {
    const count = 26;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 1.6;
      positions[i * 3 + 1] = -0.6 + Math.random() * 1.0;
      positions[i * 3 + 2] = -0.7 - Math.random() * 2.8;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xcfd6e4,
      size: 0.014,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.beamDust = new THREE.Points(geo, mat);
    this.engine.camera.add(this.beamDust);
  }

  // ================= world: house =================

  private wallKit!: MaterialKit;

  private addWall(cx: number, cz: number, w: number, d: number, h = 3.2, mat?: THREE.Material) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      mat ?? this.wallKit.material,
    );
    wall.position.set(cx, h / 2, cz);
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.engine.scene.add(wall);
    this.engine.collisionWorld.addFromMesh(wall);
    this.occluders.push(wall);
    return wall;
  }

  private buildHouseShell() {
    this.wallKit = damagedPlasterKit();
    this.wallKit.setRepeat(3, 2);

    // Footprint x[-7,7], z[0,20]. Front door gap at x[-0.8,0.8] on z=0.
    this.addWall(-3.9, 0, 6.2, 0.3); // south, west of door
    this.addWall(3.9, 0, 6.2, 0.3); // south, east of door
    this.addWall(0, 20, 14, 0.3); // north
    this.addWall(-7, 10, 0.3, 20); // west
    this.addWall(7, 10, 0.3, 20); // east

    // Spine corridor walls with room doorway gaps.
    // West spine (living room side): gaps at z[4,6].
    this.addWall(-1.8, 2, 0.25, 4); // z 0..4
    this.addWall(-1.8, 7.5, 0.25, 3); // z 6..9
    // Living room north wall: x[-7,-1.8] at z=9.
    this.addWall(-4.4, 9, 5.2, 0.25);
    // East spine (kitchen side): gaps at z[7,9].
    this.addWall(1.8, 3.5, 0.25, 7); // z 0..7
    this.addWall(1.8, 11.5, 0.25, 5); // z 9..14
    // Kitchen south wall x[1.8,7] at z=5.
    this.addWall(4.4, 5, 5.2, 0.25);
    // Kitchen north wall at z=12 (basement door gap x[4.2,5.8]).
    this.addWall(3, 12, 2.4, 0.25);
    this.addWall(6.4, 12, 1.2, 0.25);
    // Bathroom west wall (east spine continues): gap z[15,17].
    this.addWall(1.8, 14.5, 0.25, 1);
    this.addWall(1.8, 18.5, 0.25, 3);
    // Bathroom south wall x[1.8,7] at z=14.
    this.addWall(4.4, 14, 5.2, 0.25);

    // Floors.
    const floorKit = woodPlankKit();
    floorKit.setRepeat(10, 14);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 20), floorKit.material);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.01, 10);
    floor.receiveShadow = true;
    this.engine.scene.add(floor);

    // Ceiling — visible when looking up with the flashlight; keeps interiors sealed.
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 20),
      new THREE.MeshStandardMaterial({ color: 0x211d18, roughness: 1 }),
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, 3.18, 10);
    this.engine.scene.add(ceil);

    // Front door.
    const doorKit = rustedMetalKit();
    this.frontDoor = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3, 0.12), doorKit.material);
    this.frontDoor.position.set(0, 1.5, 0);
    this.frontDoor.castShadow = true;
    this.engine.scene.add(this.frontDoor);
    this.engine.collisionWorld.addFromMesh(this.frontDoor);
    this.engine.interaction.register({
      object: this.frontDoor,
      prompt: "[E] Open the door",
      onInteract: () => this.openFrontDoor(),
    });

    // Windows: faint cold panes on the south wall — the only "glow"
    // downstairs. Rain-streaked glass, cross mullions, lightning-pulsed.
    for (const x of [-4.5, 4.5]) {
      const paneMat = this.makeRainGlassMaterial(0x33415e, 0.7);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.2), paneMat);
      pane.position.set(x, 1.7, 0.17);
      pane.rotation.y = Math.PI;
      this.engine.scene.add(pane);
      this.lightningPanes.push(paneMat);
      this.addMullions(new THREE.Vector3(x, 1.7, 0.19), 1.1, 1.2, "z");
    }

    this.buildFraming();
  }

  /** Glass with vertical rain streaks baked into the texture. */
  private makeRainGlassMaterial(color: number, opacity: number) {
    const c = document.createElement("canvas");
    c.width = 32;
    c.height = 32;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 32, 32);
    ctx.strokeStyle = "rgba(210,225,255,0.85)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const x = Math.random() * 32;
      ctx.beginPath();
      ctx.moveTo(x, -2);
      ctx.lineTo(x + (Math.random() - 0.5) * 3, 34);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    return new THREE.MeshBasicMaterial({
      color,
      map: tex,
      transparent: true,
      opacity,
    });
  }

  /** Dark cross bars over a window pane — silhouettes during lightning. */
  private addMullions(center: THREE.Vector3, w: number, h: number, facing: "x" | "z") {
    const mat = new THREE.MeshStandardMaterial({ color: 0x141009, roughness: 1 });
    const vert = new THREE.Mesh(
      facing === "z"
        ? new THREE.BoxGeometry(0.055, h, 0.05)
        : new THREE.BoxGeometry(0.05, h, 0.055),
      mat,
    );
    vert.position.copy(center);
    this.engine.scene.add(vert);
    const horiz = new THREE.Mesh(
      facing === "z"
        ? new THREE.BoxGeometry(w, 0.055, 0.05)
        : new THREE.BoxGeometry(0.05, 0.055, w),
      mat,
    );
    horiz.position.copy(center);
    this.engine.scene.add(horiz);
  }

  /**
   * Composition carpentry: dark door frames around every room doorway and
   * low ceiling beams. Zero colliders (visual only). Frames turn each
   * sightline into a framed vignette and give the corridor foreground
   * occlusion; beams press the ceiling down on the player.
   */
  private buildFraming() {
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x18130e, roughness: 1 });
    const add = (x: number, y: number, z: number, w: number, h: number, d: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trimMat);
      m.position.set(x, y, z);
      m.castShadow = true;
      this.engine.scene.add(m);
    };

    // Front door frame.
    add(-0.85, 1.55, 0, 0.12, 3.1, 0.2);
    add(0.85, 1.55, 0, 0.12, 3.1, 0.2);
    add(0, 3.06, 0, 1.85, 0.14, 0.2);
    // Entry -> living room doorway (gap z 4..6 at x=-1.8).
    add(-1.8, 1.45, 4, 0.16, 2.9, 0.14);
    add(-1.8, 1.45, 6, 0.16, 2.9, 0.14);
    add(-1.8, 2.85, 5, 0.16, 0.16, 2.15);
    // Spine -> kitchen doorway (gap z 7..9 at x=1.8).
    add(1.8, 1.45, 7, 0.16, 2.9, 0.14);
    add(1.8, 1.45, 9, 0.16, 2.9, 0.14);
    add(1.8, 2.85, 8, 0.16, 0.16, 2.15);
    // Hallway -> bathroom doorway (gap z 15..17 at x=1.8).
    add(1.8, 1.45, 15, 0.16, 2.9, 0.14);
    add(1.8, 1.45, 17, 0.16, 2.9, 0.14);
    add(1.8, 2.85, 16, 0.16, 0.16, 2.15);

    // Ceiling beams: living room + hallway.
    add(-4.4, 3.02, 6.2, 5.2, 0.16, 0.2);
    add(-4.4, 3.02, 8, 5.2, 0.16, 0.2);
    add(0, 3.02, 13, 3.6, 0.16, 0.2);
    add(0, 3.02, 16.6, 3.6, 0.16, 0.2);
  }

  private buildLivingRoom() {
    const woodKit = woodPlankKit();

    // Couch the patient lies beside — he "collapsed" mid-evening.
    const couchMat = new THREE.MeshStandardMaterial({
      map: fabricTexture([64, 52, 44]),
      roughness: 1,
    });
    const couch = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.75, 0.9), couchMat);
    couch.position.set(-5.6, 0.38, 4);
    couch.castShadow = true;
    this.engine.scene.add(couch);
    this.engine.collisionWorld.addFromMesh(couch);

    const coffeeTable = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.4, 0.6), woodKit.material);
    coffeeTable.position.set(-4.2, 0.2, 4.4);
    coffeeTable.castShadow = true;
    this.engine.scene.add(coffeeTable);
    this.movableProps.push(coffeeTable);

    // A dead TV set: dark curved glass — catches the flashlight, and for
    // a fraction of a second during lightning it looks almost switched on.
    this.tvMat = new THREE.MeshStandardMaterial({
      color: 0x17171a,
      roughness: 0.18,
      metalness: 0.3,
      envMapIntensity: 1.4,
      emissive: 0x1c2836,
      emissiveIntensity: 0,
    });
    const tv = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.7), this.tvMat);
    tv.position.set(-6.3, 0.75, 7.6);
    tv.castShadow = true;
    this.engine.scene.add(tv);
    this.engine.collisionWorld.addFromMesh(tv);

    // Moonlight shaft through the west window across the patient.
    const beam = new THREE.SpotLight(0x9fb0d8, 2.4, 11, Math.PI / 8, 0.6, 1.5);
    beam.position.set(-6.8, 2.9, 6);
    const target = new THREE.Object3D();
    target.position.set(-3.5, 0, 6);
    this.engine.scene.add(target);
    beam.target = target;
    this.engine.scene.add(beam);
    this.lights.push(beam);
    const paneMat = new THREE.MeshBasicMaterial({
      color: 0x3a4a6b,
      transparent: true,
      opacity: 0.75,
    });
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.3), paneMat);
    pane.position.set(-6.83, 1.9, 6);
    pane.rotation.y = Math.PI / 2;
    this.engine.scene.add(pane);
    this.lightningPanes.push(paneMat);

    this.addMullions(new THREE.Vector3(-6.8, 1.9, 6), 1.2, 1.3, "x");

    // A ragged curtain beside the window, swaying very slowly. Every door
    // and window in this house is shut. It sways anyway.
    const curtainGeo = new THREE.PlaneGeometry(0.55, 1.3, 1, 4);
    curtainGeo.translate(0, -0.65, 0); // pivot at the rod
    this.curtain = new THREE.Mesh(
      curtainGeo,
      new THREE.MeshStandardMaterial({
        map: fabricTexture([56, 52, 48]),
        roughness: 1,
        side: THREE.DoubleSide,
      }),
    );
    this.curtain.position.set(-6.72, 2.6, 6.8);
    this.curtain.rotation.y = Math.PI / 2;
    this.engine.scene.add(this.curtain);

    // Crews two and three, told in equipment: a shed nitrile glove by the
    // patient, and a whole county jump bag abandoned at the couch's end.
    // Marcus never comments on either.
    const glove = new THREE.Mesh(
      new THREE.PlaneGeometry(0.13, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xcdd3d6, roughness: 0.95, side: THREE.DoubleSide }),
    );
    glove.rotation.x = -Math.PI / 2;
    glove.rotation.z = 0.7;
    glove.position.set(-3.8, 0.021, 5.25);
    this.engine.scene.add(glove);

    const lostBag = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.2, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x6e1414, roughness: 0.9 }),
    );
    lostBag.rotation.y = 0.5;
    lostBag.position.set(-6.45, 0.1, 4.6);
    lostBag.castShadow = true;
    this.engine.scene.add(lostBag);

    // The moonbeam made visible: a volumetric shaft from the window down
    // across the patient — the room's composition anchor.
    this.moonbeamCone = createVolumetricCone(0x8fa4d0, 7.2, 1.5, 0.06);
    this.moonbeamCone.position.set(-6.8, 2.85, 6);
    const dir = new THREE.Vector3(-3.5, 0, 6)
      .sub(this.moonbeamCone.position)
      .normalize();
    this.moonbeamCone.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, -1),
      dir,
    );
    this.engine.scene.add(this.moonbeamCone);
  }

  private buildKitchen() {
    const counterMat = new THREE.MeshStandardMaterial({ color: 0x5a5148, roughness: 0.8 });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.95, 4.5), counterMat);
    counter.position.set(6.5, 0.48, 8.5);
    counter.castShadow = true;
    this.engine.scene.add(counter);
    this.engine.collisionWorld.addFromMesh(counter);

    // The fridge — its hum is a few cents flat (AudioManager.startFridge),
    // and its door hangs open a crack, leaking cold greenish light into a
    // house with no power. The kitchen's identity is that spill: nobody
    // in the game ever mentions it.
    const fridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.9, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xb8b4a6, roughness: 0.6 }),
    );
    fridge.position.set(6.4, 0.95, 6);
    fridge.castShadow = true;
    this.engine.scene.add(fridge);
    this.engine.collisionWorld.addFromMesh(fridge);

    const fridgeSlit = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 1.5, 0.05),
      new THREE.MeshStandardMaterial({
        color: 0xd8ffe9,
        emissive: 0xbfffdd,
        emissiveIntensity: 1.3,
      }),
    );
    fridgeSlit.position.set(5.99, 0.95, 6.36);
    this.engine.scene.add(fridgeSlit);
    this.fridgeLight = new THREE.PointLight(0xcfeede, 0, 3.6, 1.8);
    this.fridgeLight.position.set(5.6, 0.9, 6.5);
    this.engine.scene.add(this.fridgeLight);

    const table = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.5, 1.3),
      new THREE.MeshStandardMaterial({ color: 0x4a3b2c, roughness: 0.9 }),
    );
    table.position.set(3.6, 0.25, 8.5);
    table.castShadow = true;
    this.engine.scene.add(table);
    this.movableProps.push(table);

    const chair = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.7, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x41332a, roughness: 0.9 }),
    );
    chair.position.set(3.6, 0.35, 9.6);
    chair.castShadow = true;
    this.engine.scene.add(chair);
    this.movableProps.push(chair);

    // Wall phone (1998: corded, in the kitchen).
    const phone = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.34, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x8a8474, roughness: 0.7 }),
    );
    phone.position.set(2.0, 1.55, 6.2);
    this.engine.scene.add(phone);
    this.engine.interaction.register({
      object: phone,
      prompt: "[E] Check the phone",
      onInteract: () => {
        if (this.cluesFound.has("phone")) return;
        this.cluesFound.add("phone");
        this.engine.audio.phoneRing();
        this.engine.dialogue.play(phoneLines);
        this.note("Landline dead — disconnected long-term. Who placed the call?");
        this.maybeEnablePcrTable();
      },
    });

    // Medication bottle on the counter.
    const meds = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.12, 8),
      new THREE.MeshStandardMaterial({ color: 0xb56a1e, roughness: 0.5 }),
    );
    meds.position.set(6.5, 1.02, 9.5);
    this.engine.scene.add(meds);
    // Small pickups get a generous invisible hitbox — aiming at a 5cm
    // bottle with no crosshair would be miserable.
    const medsHitbox = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.5, 0.45),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
    );
    medsHitbox.position.set(6.5, 1.15, 9.5);
    this.engine.scene.add(medsHitbox);
    this.engine.interaction.register({
      object: medsHitbox,
      prompt: "[E] Read the label",
      onInteract: () => {
        if (this.cluesFound.has("meds")) return;
        this.cluesFound.add("meds");
        this.engine.dialogue.play(medsLines);
        this.addItem("digoxin", "Digoxin bottle", "Rx: cardiac. Last refill seven months ago. Dust on the cap.");
        this.note("Digoxin Rx — last refilled 7 months ago.");
        this.maybeEnablePcrTable();
      },
    });

    // The grocery-list note pinned by the fridge.
    const noteMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xd8cfb0, roughness: 1 }),
    );
    noteMesh.position.set(6.0, 1.35, 6.02);
    noteMesh.rotation.y = -Math.PI / 2;
    this.engine.scene.add(noteMesh);
    this.engine.interaction.register({
      object: noteMesh,
      prompt: "[E] Read the note",
      onInteract: () => {
        if (this.cluesFound.has("note")) return;
        this.cluesFound.add("note");
        this.engine.dialogue.play(kitchenNoteLines);
        this.maybeEnablePcrTable();
      },
    });

    // Basement door in the kitchen's north wall — swollen shut until late.
    const doorKit = rustedMetalKit();
    const basementDoor = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3, 0.12), doorKit.material);
    basementDoor.position.set(5, 1.5, 12);
    basementDoor.castShadow = true;
    this.engine.scene.add(basementDoor);
    this.engine.collisionWorld.addFromMesh(basementDoor);
    this.occluders.push(basementDoor);
    this.basementDoorInteractable = {
      object: basementDoor,
      prompt: "[E] Basement door",
      onInteract: () => {
        if (!this.flags.basementOpen) {
          this.engine.dialogue.say("Marcus", "Swollen shut. Nobody's opened this in a long time.");
          return;
        }
        if (!this.cluesFound.has("basement_door_line")) {
          this.cluesFound.add("basement_door_line");
          this.engine.dialogue.play(basementDoorLines, () => this.gotoBasement());
        } else {
          this.gotoBasement();
        }
      },
    };
    this.engine.interaction.register(this.basementDoorInteractable);
  }

  private buildHallway() {
    // Three family photographs along the west spine wall.
    for (let i = 0; i < 3; i++) {
      const photo = new THREE.Mesh(
        new THREE.PlaneGeometry(0.42, 0.34),
        new THREE.MeshStandardMaterial({ map: this.drawPhotoTexture(0, i), roughness: 1 }),
      );
      photo.position.set(-1.66, 1.65, 13 + i * 2);
      photo.rotation.y = Math.PI / 2;
      if (i === 1) photo.rotation.z = 0.07; // one frame hangs crooked
      this.engine.scene.add(photo);
      this.photoMeshes.push(photo);
      this.engine.interaction.register({
        object: photo,
        prompt: "[E] Look at the photograph",
        onInteract: () => this.lookAtPhotos(),
      });
    }

    // Side table holding the previous crews' PCR forms — the midpoint.
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.85, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x3c2f22, roughness: 0.9 }),
    );
    table.position.set(-1.35, 0.43, 18.6);
    table.castShadow = true;
    this.engine.scene.add(table);
    this.engine.collisionWorld.addFromMesh(table);

    const papers = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.03, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xd8d2bc, roughness: 1 }),
    );
    papers.position.set(-1.35, 0.87, 18.6);
    this.engine.scene.add(papers);
    this.pcrTableInteractable = {
      object: papers,
      prompt: "[E] Paperwork — county format?",
      enabled: false,
      onInteract: () => this.readPreviousPcrs(),
    };
    this.engine.interaction.register(this.pcrTableInteractable);

    // Stairs up: a dark rising suggestion at the hallway's end + transition.
    const stairMat = new THREE.MeshStandardMaterial({ color: 0x2b241c, roughness: 1 });
    for (let i = 0; i < 5; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.3), stairMat);
      step.position.set(0, 0.2 + i * 0.22, 19.2 + i * 0.12);
      this.engine.scene.add(step);
    }
    const stairTrigger = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 2.4, 0.5),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
    );
    stairTrigger.position.set(0, 1.2, 19.4);
    this.engine.scene.add(stairTrigger);
    this.engine.interaction.register({
      object: stairTrigger,
      prompt: "[E] Go upstairs",
      onInteract: () => this.gotoUpstairs(),
    });

    // A small window above the stairs backlights the end of the corridor —
    // the exact spot the Patient likes to stand. Anything there reads as a
    // silhouette against cold glass, which is the whole point.
    const stairPaneMat = this.makeRainGlassMaterial(0x46587e, 0.8);
    const stairPane = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.95), stairPaneMat);
    stairPane.position.set(0, 2.35, 19.83);
    stairPane.rotation.y = Math.PI;
    this.engine.scene.add(stairPane);
    this.lightningPanes.push(stairPaneMat);
    this.addMullions(new THREE.Vector3(0, 2.35, 19.8), 0.75, 0.95, "z");
    const stairBack = new THREE.SpotLight(0x5b6f9e, 1.7, 10, 0.55, 0.6, 1.3);
    stairBack.position.set(0, 2.4, 19.7);
    const stairBackTarget = new THREE.Object3D();
    stairBackTarget.position.set(0, 0.8, 13);
    this.engine.scene.add(stairBackTarget);
    stairBack.target = stairBackTarget;
    this.engine.scene.add(stairBack);
    this.lights.push(stairBack);

    // Crew one's penlight: dropped, rolled against the baseboard, still on.
    const pen = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.13, 6),
      new THREE.MeshStandardMaterial({ color: 0xd8d4c8, metalness: 0.5, roughness: 0.35 }),
    );
    pen.rotation.z = Math.PI / 2;
    pen.rotation.y = 0.4;
    pen.position.set(-1.15, 0.035, 13.4);
    this.engine.scene.add(pen);
    this.penLightPt = new THREE.PointLight(0xfff2cc, 0.5, 1.7, 2);
    this.penLightPt.position.set(-1.38, 0.06, 13.32);
    this.engine.scene.add(this.penLightPt);
  }

  private buildBathroom() {
    const sink = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.85, 0.45),
      new THREE.MeshStandardMaterial({ color: 0xcfccc2, roughness: 0.4 }),
    );
    sink.position.set(6.4, 0.43, 15);
    sink.castShadow = true;
    this.engine.scene.add(sink);
    this.engine.collisionWorld.addFromMesh(sink);

    // The fogged mirror.
    const mirror = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x6b7484, roughness: 0.25, metalness: 0.4 }),
    );
    mirror.position.set(6.83, 1.6, 15);
    mirror.rotation.y = -Math.PI / 2;
    this.engine.scene.add(mirror);
    this.engine.interaction.register({
      object: mirror,
      prompt: "[E] Wipe the mirror",
      onInteract: () => {
        if (this.cluesFound.has("mirror")) return;
        this.cluesFound.add("mirror");
        this.engine.dialogue.play(bathroomMirrorLines);
        this.engine.postfx.setStress(0.35);
        this.maybeEnablePcrTable();
      },
    });

    // Medicine cabinet with the bedroom key.
    const cabinet = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.45, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x8f8b80, roughness: 0.6 }),
    );
    cabinet.position.set(6.85, 2.15, 15.8);
    this.engine.scene.add(cabinet);
    this.engine.interaction.register({
      object: cabinet,
      prompt: "[E] Open the cabinet",
      onInteract: () => {
        if (this.cluesFound.has("key")) return;
        this.cluesFound.add("key");
        this.engine.audio.woodCreak();
        this.engine.dialogue.play(bathroomKeyLines);
        this.addItem("bedroom_key", "Bedroom key", "Masking tape label: 'BEDROOM — D.'");
        this.maybeEnablePcrTable();
      },
    });

    const tub = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.55, 0.7),
      new THREE.MeshStandardMaterial({ color: 0xc9c6bc, roughness: 0.45 }),
    );
    tub.position.set(4, 0.28, 19.2);
    tub.castShadow = true;
    this.engine.scene.add(tub);
    this.engine.collisionWorld.addFromMesh(tub);

    // Bathroom identity: one small frosted pane, colder and greener than
    // any other light in the house; porcelain and the mirror catch it.
    const bathPaneMat = this.makeRainGlassMaterial(0x4a7480, 0.75);
    const bathPane = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.7), bathPaneMat);
    bathPane.position.set(6.83, 1.9, 18.4);
    bathPane.rotation.y = -Math.PI / 2;
    this.engine.scene.add(bathPane);
    this.lightningPanes.push(bathPaneMat);
    this.addMullions(new THREE.Vector3(6.8, 1.9, 18.4), 0.6, 0.7, "x");
    const bathGlow = new THREE.PointLight(0x7fa8b0, 0.4, 3.2, 2);
    bathGlow.position.set(6.2, 1.8, 18.2);
    this.engine.scene.add(bathGlow);
    this.lights.push(bathGlow);
  }

  private buildUpstairs() {
    // Landing + bedroom at x offset 60. Same wall standard as downstairs.
    const kit = this.wallKit;
    const floorKit = woodPlankKit();
    floorKit.setRepeat(6, 6);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), floorKit.material);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(UPSTAIRS_X + 0.5, 0.01, 4);
    floor.receiveShadow = true;
    this.engine.scene.add(floor);
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 9),
      new THREE.MeshStandardMaterial({ color: 0x1e1a15, roughness: 1 }),
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(UPSTAIRS_X + 0.5, 2.9, 4);
    this.engine.scene.add(ceil);

    // Bounding walls.
    this.addWall(UPSTAIRS_X + 0.5, -0.5, 9, 0.3, 2.9, kit.material);
    this.addWall(UPSTAIRS_X + 0.5, 8.5, 9, 0.3, 2.9, kit.material);
    this.addWall(UPSTAIRS_X - 4, 4, 0.3, 9, 2.9, kit.material);
    this.addWall(UPSTAIRS_X + 5, 4, 0.3, 9, 2.9, kit.material);
    // Bedroom divider: door gap x[UPSTAIRS_X+0.6, UPSTAIRS_X+2.0] at z=4.
    this.addWall(UPSTAIRS_X - 1.7, 4, 4.6, 0.25, 2.9, kit.material);
    this.addWall(UPSTAIRS_X + 3.5, 4, 3, 0.25, 2.9, kit.material);

    // Stairs-down trigger on the landing.
    const downTrigger = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 2.4, 0.5),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
    );
    downTrigger.position.set(UPSTAIRS_X - 3, 1.2, 0.2);
    this.engine.scene.add(downTrigger);
    this.engine.interaction.register({
      object: downTrigger,
      prompt: "[E] Go downstairs",
      onInteract: () => this.gotoGroundFloor(new THREE.Vector3(0, 0, 18), Math.PI),
    });

    // Bedroom door — locked until the key is found.
    const doorKit = rustedMetalKit();
    const bedroomDoor = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.7, 0.12), doorKit.material);
    bedroomDoor.position.set(UPSTAIRS_X + 1.3, 1.35, 4);
    bedroomDoor.castShadow = true;
    this.engine.scene.add(bedroomDoor);
    this.engine.collisionWorld.addFromMesh(bedroomDoor);
    this.occluders.push(bedroomDoor);
    this.bedroomDoorInteractable = {
      object: bedroomDoor,
      prompt: "[E] Bedroom door",
      onInteract: () => {
        if (this.bedroomDoorOpen) return;
        if (!useGameStore.getState().hasItem("bedroom_key")) {
          this.engine.dialogue.say("Marcus", "Locked. A house key won't be far. Bathrooms, kitchen drawers — people are predictable.");
          return;
        }
        this.bedroomDoorOpen = true;
        this.engine.audio.doorCreak();
        bedroomDoor.rotation.y = -Math.PI / 2.15;
        bedroomDoor.position.x -= 0.65;
        bedroomDoor.position.z -= 0.1;
        this.engine.collisionWorld.colliders = this.engine.collisionWorld.colliders.filter(
          (c) => !c.box.containsPoint(bedroomDoor.position),
        );
      },
    };
    this.engine.interaction.register(this.bedroomDoorInteractable);

    // Bedroom interior: untouched bed, dresser with the funeral pamphlet.
    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.5, 2.2),
      new THREE.MeshStandardMaterial({ map: fabricTexture([120, 116, 108]), roughness: 1 }),
    );
    bed.position.set(UPSTAIRS_X + 3.4, 0.25, 6.6);
    bed.castShadow = true;
    this.engine.scene.add(bed);
    this.engine.collisionWorld.addFromMesh(bed);

    const dresser = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x3a2d20, roughness: 0.9 }),
    );
    dresser.position.set(UPSTAIRS_X - 1, 0.5, 6.9);
    dresser.castShadow = true;
    this.engine.scene.add(dresser);
    this.engine.collisionWorld.addFromMesh(dresser);

    const pamphlet = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.28),
      new THREE.MeshStandardMaterial({ color: 0xcdc4ae, roughness: 1 }),
    );
    pamphlet.rotation.x = -Math.PI / 2;
    pamphlet.position.set(UPSTAIRS_X - 1, 1.02, 6.9);
    this.engine.scene.add(pamphlet);
    this.engine.interaction.register({
      object: pamphlet,
      prompt: "[E] Read the pamphlet",
      onInteract: () => {
        if (this.flags.bedroomEvidence) return;
        this.flags.bedroomEvidence = true;
        this.engine.dialogue.play(bedroomLines, () => {
          this.note("Wife (Eleanor) deceased 2 years. The caller was female.");
          window.setTimeout(() => {
            this.engine.audio.distantThud();
            this.engine.postfx.triggerTracking(0.9);
            this.engine.dialogue.play(bedroomExitLines, () => {
              this.flags.basementOpen = true;
              this.basementDoorInteractable.prompt = "[E] The basement door stands open";
              this.setObjective("Something moved below the kitchen. The basement.");
              this.callbacks.onPhaseChange("upstairs");
            });
          }, 1600);
        });
      },
    });

    // Dust motes: this room has been closed for a long time.
    const dustLight = new THREE.PointLight(0x4a5878, 0.6, 6, 2);
    dustLight.position.set(UPSTAIRS_X + 2, 2.4, 6);
    this.engine.scene.add(dustLight);
    this.lights.push(dustLight);

    // Sheeted furniture on the landing: someone closed this floor up
    // properly, long before anyone stopped answering the phone.
    const sheetMat = new THREE.MeshStandardMaterial({
      map: fabricTexture([148, 146, 138]),
      roughness: 1,
    });
    const sheetChair = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.9, 0.65), sheetMat);
    sheetChair.position.set(UPSTAIRS_X - 2.6, 0.45, 2.2);
    sheetChair.rotation.y = 0.35;
    sheetChair.castShadow = true;
    this.engine.scene.add(sheetChair);
    this.engine.collisionWorld.addFromMesh(sheetChair);
    const sheetTall = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.6, 0.35), sheetMat);
    sheetTall.position.set(UPSTAIRS_X + 3.6, 0.8, 1.2);
    sheetTall.rotation.y = -0.2;
    sheetTall.castShadow = true;
    this.engine.scene.add(sheetTall);
    this.engine.collisionWorld.addFromMesh(sheetTall);
  }

  private buildBasement() {
    const kit = stoneFloorKit();
    kit.setRepeat(5, 5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 9), kit.material);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(BASEMENT_X, 0.01, 4);
    floor.receiveShadow = true;
    this.engine.scene.add(floor);
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 9),
      new THREE.MeshStandardMaterial({ color: 0x15120e, roughness: 1 }),
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(BASEMENT_X, 2.3, 4);
    this.engine.scene.add(ceil);

    const stoneWall = new THREE.MeshStandardMaterial({ color: 0x3d3a34, roughness: 1 });
    this.addWall(BASEMENT_X, -0.5, 8, 0.3, 2.3, stoneWall);
    this.addWall(BASEMENT_X, 8.5, 8, 0.3, 2.3, stoneWall);
    this.addWall(BASEMENT_X - 4, 4, 0.3, 9, 2.3, stoneWall);
    this.addWall(BASEMENT_X + 4, 4, 0.3, 9, 2.3, stoneWall);

    // Stairs-up trigger.
    const upTrigger = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 2, 0.5),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
    );
    upTrigger.position.set(BASEMENT_X - 3, 1, 0.2);
    this.engine.scene.add(upTrigger);
    this.engine.interaction.register({
      object: upTrigger,
      prompt: "[E] Back up to the kitchen",
      onInteract: () => this.gotoGroundFloor(new THREE.Vector3(5, 0, 10.8), Math.PI),
    });

    // Shelving, a workbench — a used farm basement, not a dungeon.
    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 1.8, 3),
      new THREE.MeshStandardMaterial({ color: 0x2c261e, roughness: 1 }),
    );
    shelf.position.set(BASEMENT_X + 3.6, 0.9, 3);
    this.engine.scene.add(shelf);
    this.engine.collisionWorld.addFromMesh(shelf);

    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.9, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x33291d, roughness: 1 }),
    );
    bench.position.set(BASEMENT_X - 3.4, 0.45, 6);
    this.engine.scene.add(bench);
    this.engine.collisionWorld.addFromMesh(bench);

    // A single bare bulb on a cord, gently swinging, throwing moving
    // shadows. The house has no power — Marcus said so himself on the
    // porch — and this bulb burns anyway. Nobody comments on it. It is
    // also the only shadow-casting light besides the flashlight, and it
    // only exists while the player is down here (toggled by zone).
    this.bulbPivot = new THREE.Group();
    this.bulbPivot.position.set(BASEMENT_X, 2.28, 4.6);
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4),
      new THREE.MeshStandardMaterial({ color: 0x121110, roughness: 1 }),
    );
    cord.position.y = -0.25;
    this.bulbPivot.add(cord);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffe6b8,
        emissive: 0xffc06a,
        emissiveIntensity: 2.2,
        roughness: 0.4,
      }),
    );
    bulb.position.y = -0.52;
    this.bulbPivot.add(bulb);
    this.bulbLight = new THREE.SpotLight(0xffd9a2, 4.2, 8, 1.05, 0.55, 1.1);
    this.bulbLight.position.y = -0.52;
    this.bulbLight.castShadow = true;
    this.bulbLight.shadow.mapSize.set(512, 512);
    this.bulbLight.shadow.bias = -0.003;
    const bulbTarget = new THREE.Object3D();
    bulbTarget.position.set(0, -3, 0);
    this.bulbPivot.add(bulbTarget);
    this.bulbLight.target = bulbTarget;
    this.bulbPivot.add(this.bulbLight);
    this.bulbPivot.visible = false; // enabled on basement entry
    this.engine.scene.add(this.bulbPivot);

    // The real patient.
    const body = buildDeadBody();
    body.position.set(BASEMENT_X + 0.5, 0, 5.6);
    body.rotation.y = 0.5;
    this.engine.scene.add(body);

    const bodyHitbox = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.2, 2),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
    );
    bodyHitbox.position.set(BASEMENT_X + 0.5, 0.6, 5.6);
    this.engine.scene.add(bodyHitbox);
    this.bodyInteractable = {
      object: bodyHitbox,
      prompt: "[E] ...Check the body",
      onInteract: () => this.discoverBody(),
    };
    this.engine.interaction.register(this.bodyInteractable);
  }

  // ================= photographs =================

  private drawPhotoTexture(stage: number, index: number): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 48;
    const ctx = c.getContext("2d")!;
    // Sepia backing.
    ctx.fillStyle = "#8a7d64";
    ctx.fillRect(0, 0, 64, 48);
    ctx.fillStyle = "#6e6350";
    ctx.fillRect(3, 3, 58, 42);

    const drawFigure = (x: number, h: number, shade: string) => {
      ctx.fillStyle = shade;
      ctx.fillRect(x - 3, 42 - h, 6, h); // body
      ctx.beginPath();
      ctx.arc(x, 42 - h - 3, 3.4, 0, Math.PI * 2); // head
      ctx.fill();
    };

    // Base family: man, woman, child — spaced by frame index for variety.
    const ox = index * 2;
    drawFigure(18 + ox, 18, "#2e2a24");
    if (stage < 1) drawFigure(32 + ox, 17, "#332e26"); // the woman: gone from stage 1 on
    drawFigure(45 + ox, 11, "#2b2620");
    if (stage >= 2) {
      // A fourth figure, standing slightly apart. Uniform-dark. Facing out.
      drawFigure(55, 19, "#151a20");
    }

    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  /** Advance photo stage while the player is away — never while watched. */
  private advancePhotos() {
    if (this.photoStage >= 2) return;
    this.photoStage++;
    this.photoMeshes.forEach((mesh, i) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.map = this.drawPhotoTexture(this.photoStage, i);
      mat.needsUpdate = true;
    });
  }

  private lookAtPhotos() {
    if (this.photoStage === 0) {
      if (!this.cluesFound.has("photos")) {
        this.cluesFound.add("photos");
        this.engine.dialogue.play(photosFirstLines);
        this.maybeEnablePcrTable();
      }
    } else if (this.photoStage === 1) {
      this.engine.dialogue.play(photosSecondLines);
      this.engine.postfx.setStress(0.3);
    } else {
      this.engine.dialogue.play(photosThirdLines);
      this.engine.postfx.setStress(0.7);
      this.engine.audio.sting();
    }
  }

  // ================= sequence: arrival & assessment =================

  private openFrontDoor() {
    if (this.frontDoorOpen) return;
    this.frontDoorOpen = true;
    this.engine.audio.doorCreak();
    this.frontDoor.rotation.y = -Math.PI / 2.1;
    this.frontDoor.position.x -= 0.75;
    this.frontDoor.position.z += 0.06;
    this.engine.collisionWorld.colliders = this.engine.collisionWorld.colliders.filter(
      (c) => !c.box.containsPoint(this.frontDoor.position),
    );
    this.flags.entered = true;
    this.callbacks.onPhaseChange("scene_safety");
    this.engine.dialogue.play(sceneSafetyLines, () => {
      this.pcr({ objective: "Locate the patient." });
    });
    this.horror.start();
  }

  private buildPatientInteraction() {
    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.2, 2),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
    );
    hitbox.position.set(-4.5, 0.6, 6);
    this.engine.scene.add(hitbox);
    this.patientHitbox = hitbox;

    this.patientAssess = {
      object: hitbox,
      prompt: "[E] Check responsiveness (AVPU)",
      enabled: false,
      onInteract: () => this.runAssessStep(),
    };
    this.engine.interaction.register(this.patientAssess);
  }
  private patientHitbox!: THREE.Mesh;

  private runAssessStep() {
    const dlg = this.engine.dialogue;
    switch (this.assessStep) {
      case "responsiveness":
        this.patientAssess.enabled = false;
        dlg.play(responsivenessLines, () => {
          this.pcr({ responsiveness: "P — responds to painful stimulus only" });
          this.assessStep = "airway";
          this.patientAssess.prompt = "[E] Check airway & breathing";
          this.patientAssess.enabled = true;
        });
        break;
      case "airway":
        this.patientAssess.enabled = false;
        dlg.play(airwayLines, () => {
          this.pcr({
            airway: "Patent, no obstruction",
            breathing: "Present. Rhythm abnormal — prolonged apneic pauses",
          });
          this.assessStep = "pulse";
          this.beginPulseCheckSetup();
        });
        break;
      case "pupils":
        this.patientAssess.enabled = false;
        if (!this.engine.flashlight.on) this.engine.flashlight.toggle();
        this.patient.eyesFlash(2600); // eyes held open under the light for the exam
        dlg.play(pupilsLines, () => {
          this.pcr({ pupils: "Fixed and dilated bilaterally (inconsistent w/ response to pain)" });
          this.assessStep = "vitals";
          this.patientAssess.prompt = "[E] Take vitals";
          this.patientAssess.enabled = true;
        });
        break;
      case "vitals":
        this.patientAssess.enabled = false;
        dlg.play(vitalsLines, () => {
          this.pcr({
            vitals: "BP 110/palp · HR 52 · RR 8 · skin cold, dry",
            patientInfo: "Male, mid-40s. Found supine, living room floor.",
          });
          this.assessStep = "done";
          this.flags.assessmentDone = true;
          this.stage = 2;
          this.callbacks.onPhaseChange("investigation");
          dlg.play(assessmentDoneLines, () => {
            this.setObjective("Find the caller. Search the house — phone, medications, anything.");
          });
        });
        break;
      default:
        break;
    }
  }

  /**
   * The carotid pulse check — the demo's signature vulnerability mechanic.
   * Hold E for six seconds: movement locks, the house drops to near-silence,
   * and at the midpoint of the hold the Patient's eyes open for ~90ms.
   */
  private beginPulseCheckSetup() {
    let scared = false;
    this.patientAssess.prompt = "[Hold E] Carotid pulse — hold still";
    this.patientAssess.holdSeconds = 6;
    this.patientAssess.enabled = true;
    this.patientAssess.onProgress = (t) => {
      useGameStore.getState().setHoldProgress(t);
      if (t > 0.01 && this.engine.player.movementEnabled) {
        this.engine.player.movementEnabled = false;
        this.patient.interactionLock = true;
        this.engine.audio.setAmbienceLevel(0.1);
        this.engine.audio.setRainIntensity(0.08);
        this.engine.audio.setHeartbeat(52, 0.22);
      }
      if (t > 0.55 && !scared) {
        scared = true;
        this.patient.eyesFlash(90);
        this.engine.audio.sting();
        this.engine.postfx.setStress(0.85);
        this.engine.player.triggerShake(0.05, 0.4);
      }
    };
    this.patientAssess.onCancel = () => {
      useGameStore.getState().setHoldProgress(null);
      this.endPulseAudio();
      this.engine.dialogue.say("Marcus", "Lost the count. Again. Full six seconds this time.");
    };
    this.patientAssess.onInteract = () => {
      useGameStore.getState().setHoldProgress(null);
      this.endPulseAudio();
      this.patientAssess.holdSeconds = undefined;
      this.patientAssess.onProgress = undefined;
      this.patientAssess.onCancel = undefined;
      this.patientAssess.onInteract = () => this.runAssessStep();
      this.patientAssess.enabled = false;
      this.engine.dialogue.play(pulseAfterLines, () => {
        this.pcr({ pulse: "Carotid present. HR ~52, weak. Timing feels wrong." });
        this.assessStep = "pupils";
        this.patientAssess.prompt = "[E] Check pupils (penlight)";
        this.patientAssess.enabled = true;
      });
    };
  }

  private endPulseAudio() {
    this.engine.player.movementEnabled = true;
    this.patient.interactionLock = false;
    this.engine.audio.setAmbienceLevel(1);
    this.engine.audio.setHeartbeat(0);
    this.applyZoneRain();
  }

  // ================= sequence: midpoint & stalking =================

  private maybeEnablePcrTable() {
    // The paperwork becomes findable once the player has actually
    // investigated a bit — two clues deep, the hallway table pays off.
    if (this.flags.assessmentDone && this.cluesFound.size >= 2) {
      this.pcrTableInteractable.enabled = true;
    }
  }

  private readPreviousPcrs() {
    if (this.flags.midpoint) return;
    this.flags.midpoint = true;
    this.pcrTableInteractable.enabled = false;
    this.stage = 3;
    this.callbacks.onPhaseChange("midpoint");
    this.engine.audio.setAmbienceLevel(0.25);
    this.engine.dialogue.play(previousPcrLines, () => {
      this.note("3 prior county PCRs on scene — identical vitals to mine. All incomplete.");
      this.addItem("prev_pcrs", "Prior PCR forms ×3", "Units 2, 7, 3. Same vitals, all stop at the same line.");
      saveMidpointCheckpoint();
      this.beginStalkingPhase();
    });
  }

  private beginStalkingPhase() {
    this.callbacks.onPhaseChange("stalking");
    this.setObjective("The bedroom is locked. Find the key. Keep your eyes on him.");
    this.engine.audio.setAmbienceLevel(1);

    // The Patient is no longer on the living room floor. It stands in the
    // kitchen doorway — far enough from the hallway table that the player
    // discovers the absence first and the figure second, and outside the
    // close-contact radius so the reveal can't fire an instant event.
    this.patient.group.position.set(2.6, 0, 6);
    this.patient.enableStalking(
      [
        new THREE.Vector3(0, 0, 16.5), // hallway end
        new THREE.Vector3(-5.5, 0, 7.5), // living room corner
        new THREE.Vector3(2.6, 0, 6), // kitchen doorway
        new THREE.Vector3(0, 0, 1.2), // entry hall
        new THREE.Vector3(2.6, 0, 16), // bathroom doorway
        new THREE.Vector3(-4.5, 0, 6), // where the body "was"
      ],
      {
        getPlayerPosition: () => this.engine.player.position,
        occluders: this.occluders,
        onReposition: () => {
          this.engine.audio.woodCreak();
          if (Math.random() < 0.4) this.engine.audio.footstep();
          this.stalkBarksFired++;
          // Ambient-only: these must never stomp a scripted chain's onEnd.
          if (this.stalkBarksFired === 1) this.engine.dialogue.playAmbient(stalkingBark1);
          else if (this.stalkBarksFired === 3) this.engine.dialogue.playAmbient(stalkingBark2);
          if (!this.pupilsWrongFired && this.stalkBarksFired >= 2) {
            this.pupilsWrongFired = this.engine.dialogue.playAmbient(pupilsWrongLines);
          }
        },
        onCloseContact: () => {
          this.engine.audio.sting();
          this.engine.audio.whisper();
          this.engine.postfx.setStress(1);
          this.engine.postfx.triggerTracking(1.2);
          this.engine.player.triggerShake(0.18, 0.9);
          this.engine.audio.setSecondHeartbeat(140);
          this.engine.dialogue.playAmbient(patientWhisper);
          window.setTimeout(() => this.engine.audio.setSecondHeartbeat(0), 6000);
        },
      },
      () => this.engine.player.crouched,
    );
    this.engine.dialogue.play(stalkingStartLines);
  }

  // ================= sequence: basement & endings =================

  private discoverBody() {
    if (this.flags.bodyFound) return;
    this.flags.bodyFound = true;
    this.bodyInteractable.enabled = false;
    this.callbacks.onPhaseChange("basement");

    // Let the realization breathe: kill the beds, no sting, no attack.
    this.engine.audio.setAmbienceLevel(0.05);
    this.engine.audio.setRainIntensity(0.03);
    this.engine.dialogue.play(basementBodyLines, () => {
      window.setTimeout(() => {
        this.pcr({
          patientInfo: "DECEASED male, mid-40s — basement. Dead approx. 3 days. Matches dispatch description.",
        });
        this.note("The man upstairs matches the body downstairs.");
        this.setObjective("Get to the ambulance. Radio it in.");
        this.radioInteractable.enabled = true;
        this.engine.audio.setAmbienceLevel(0.7);
        this.applyZoneRain();
      }, 4000);
    });
  }

  private useRadio() {
    if (this.flags.endingChosen) return;
    if (!this.flags.bodyFound) {
      this.engine.audio.radioStatic();
      this.engine.dialogue.say("Dispatch", "[static] ...Medic 4, status?");
      return;
    }
    if (!this.flags.radioTellDone) {
      this.flags.radioTellDone = true;
      this.radioInteractable.enabled = false;
      this.engine.audio.radioStatic();
      this.engine.dialogue.play(radioTellLines, () => {
        this.engine.postfx.setStress(0.6);
        this.engine.dialogue.play(endingChoiceLines, () => {
          this.callbacks.onPhaseChange("ending_choice");
          this.engine.player.movementEnabled = false;
          document.exitPointerLock?.();
        });
      });
    }
  }

  /** Called by the ending-choice UI. */
  chooseEnding(which: "a" | "b") {
    if (this.flags.endingChosen) return;
    this.flags.endingChosen = true;
    this.callbacks.onPhaseChange("ending_playing");
    if (which === "a") {
      this.engine.dialogue.play(endingALines, () => {
        this.engine.audio.engineStart();
        this.engine.audio.setRainIntensity(0.15);
        this.fadeOut(3000, () => this.callbacks.onPhaseChange("ending_a"));
      });
    } else {
      this.engine.dialogue.play(endingBLines, () => {
        this.fadeTransition(() => {
          // Back in the living room. It is lying exactly where it started.
          this.patient.disableStalking();
          this.patient.setMode("lying");
          this.patient.group.position.set(-4.5, 0, 6);
          // Authored framing: Marcus is already looking down at it.
          this.engine.player.position.set(-3.4, 1.65, 6);
          this.engine.player.snapLook(Math.PI / 2, -0.55);
          this.engine.player.movementEnabled = false;
          this.engine.player.requestLock();
          this.beginFinalPulseCheck();
        });
      });
    }
  }

  /** Ending 2: the pulse check that never completes. */
  private beginFinalPulseCheck() {
    this.engine.audio.setAmbienceLevel(0.05);
    this.engine.audio.setRainIntensity(0.05);
    const final: Interactable = {
      object: this.patientHitbox,
      prompt: "[Hold E] One more assessment",
      holdSeconds: 999, // completion is unreachable by design
      onProgress: (t) => {
        const elapsed = t * 999;
        useGameStore.getState().setHoldProgress(Math.min(0.95, elapsed / 9));
        if (elapsed > 0.1) {
          this.engine.audio.setHeartbeat(46 + elapsed * 4, 0.24);
          this.engine.postfx.setStress(Math.min(1, elapsed / 7));
        }
        if (elapsed > 4) this.engine.audio.setSecondHeartbeat(200);
        if (elapsed > 8.5) {
          useGameStore.getState().setHoldProgress(null);
          this.engine.audio.setHeartbeat(0);
          this.engine.audio.setSecondHeartbeat(0);
          useGameStore.getState().setFade(1);
          this.callbacks.onPhaseChange("ending_b");
        }
      },
      onCancel: () => {
        // There is no backing out of the choice — the prompt just returns.
        useGameStore.getState().setHoldProgress(null);
        this.engine.audio.setHeartbeat(0);
        this.engine.dialogue.say("Marcus", "Six seconds. Start over.");
      },
      onInteract: () => {
        /* unreachable: holdSeconds is never met */
      },
    };
    this.engine.interaction.register(final);
  }

  // ================= transitions =================

  private fadeTransition(between: () => void) {
    if (this.transitioning) return;
    this.transitioning = true;
    useGameStore.getState().setFade(1);
    window.setTimeout(() => {
      between();
      window.setTimeout(() => {
        useGameStore.getState().setFade(0);
        this.transitioning = false;
      }, 350);
    }, 480);
  }

  private fadeOut(ms: number, done: () => void) {
    useGameStore.getState().setFade(1);
    window.setTimeout(done, ms);
  }

  /** All zone transitions funnel through here so onZoneChange always fires. */
  private setZone(next: Zone) {
    if (next === this.zone) return;
    const prev = this.zone;
    this.zone = next;
    this.onZoneChange(prev, next);
  }

  private gotoUpstairs() {
    this.fadeTransition(() => {
      this.engine.audio.woodCreak();
      this.engine.player.setSpawn(UPSTAIRS_X - 3, 1.6, Math.PI);
      this.setZone("upstairs");
    });
  }

  private gotoGroundFloor(pos: THREE.Vector3, yaw: number) {
    this.fadeTransition(() => {
      this.engine.audio.woodCreak();
      this.engine.player.setSpawn(pos.x, pos.z, yaw);
      this.setZone("hallway");
    });
  }

  private gotoBasement() {
    this.fadeTransition(() => {
      this.engine.audio.woodCreak();
      this.engine.player.setSpawn(BASEMENT_X - 3, 1.4, Math.PI);
      this.setZone("basement");
    });
  }

  // ================= ambient events =================

  private handleVisualEvent(kind: string) {
    switch (kind) {
      case "flicker_light": {
        const light = this.lights[Math.floor(Math.random() * this.lights.length)];
        if (!light) return;
        const original = (light as THREE.PointLight).intensity;
        (light as THREE.PointLight).intensity = 0;
        window.setTimeout(() => {
          (light as THREE.PointLight).intensity = original;
        }, 120 + Math.random() * 200);
        break;
      }
      case "object_shift": {
        const prop = this.movableProps[Math.floor(Math.random() * this.movableProps.length)];
        if (!prop) return;
        prop.rotation.y += (Math.random() - 0.5) * 0.4;
        prop.position.x += (Math.random() - 0.5) * 0.15;
        break;
      }
      case "door_move": {
        if (this.frontDoorOpen && this.zone !== "exterior" && this.zone !== "porch") {
          this.frontDoor.rotation.y += (Math.random() - 0.5) * 0.25;
          this.engine.audio.doorCreak();
        }
        break;
      }
      case "shadow_pass": {
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(0.8, 2),
          new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 }),
        );
        plane.position.set(-1.7, 1.2, 12 + Math.random() * 5);
        plane.rotation.y = Math.PI / 2;
        this.engine.scene.add(plane);
        window.setTimeout(() => this.engine.scene.remove(plane), 350);
        break;
      }
    }
  }

  // ================= checkpoint restore =================

  private restoreToMidpoint() {
    // Assessment complete, core clues logged, PCRs read — resume at the
    // start of the stalking phase, standing by the hallway table.
    this.flags.arrived = true;
    this.flags.entered = true;
    this.flags.patientSeen = true;
    this.flags.assessmentDone = true;
    this.flags.midpoint = true;
    this.assessStep = "done";
    this.patientAssess.enabled = false;
    this.frontDoorOpen = true;
    this.frontDoor.rotation.y = -Math.PI / 2.1;
    this.frontDoor.position.x -= 0.75;
    this.engine.collisionWorld.colliders = this.engine.collisionWorld.colliders.filter(
      (c) => !c.box.containsPoint(this.frontDoor.position),
    );
    this.cluesFound.add("phone").add("meds");
    this.stage = 3;
    this.zone = "hallway";

    const store = useGameStore.getState();
    store.updatePcr({
      responsiveness: "P — responds to painful stimulus only",
      airway: "Patent, no obstruction",
      breathing: "Present. Rhythm abnormal — prolonged apneic pauses",
      pulse: "Carotid present. HR ~52, weak. Timing feels wrong.",
      pupils: "Fixed and dilated bilaterally (inconsistent w/ response to pain)",
      vitals: "BP 110/palp · HR 52 · RR 8 · skin cold, dry",
      patientInfo: "Male, mid-40s. Found supine, living room floor.",
    });
    store.addPcrNote("Landline dead — disconnected long-term. Who placed the call?");
    store.addPcrNote("3 prior county PCRs on scene — identical vitals to mine. All incomplete.");
    store.addItem({ id: "digoxin", name: "Digoxin bottle", description: "Rx: cardiac. Last refill seven months ago." });
    store.addItem({ id: "prev_pcrs", name: "Prior PCR forms ×3", description: "Units 2, 7, 3. Same vitals, all stop at the same line." });

    this.engine.player.setSpawn(-0.5, 18, Math.PI);
    this.horror.start();
    this.beginStalkingPhase();
  }

  // ================= per-frame =================

  private update(dt: number) {
    this.patient.update(dt, this.engine.camera);

    // Rain streak recycling.
    const positions = (this.rainPoints.geometry as THREE.BufferGeometry)
      .attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < positions.count; i++) {
      let y = positions.getY(i) - dt * 11;
      if (y < 0) y = 9;
      positions.setY(i, y);
    }
    positions.needsUpdate = true;

    // Beacon idle pulse.
    this.beaconLight.intensity = 0.25 + Math.abs(Math.sin(performance.now() * 0.0016)) * 0.3;

    // Storm distance model: the storm walks closer over the demo's run,
    // so flash brightness rises, thunder arrives faster, and the low
    // rumble reads louder. Anchored to real-time seconds since scene load.
    this.stormAge += dt;
    const stormPhase = Math.min(1, this.stormAge / 300); // ~5min to peak
    this.lightningTimer -= dt;
    if (this.lightningTimer <= 0) {
      this.lightningTimer = 12 - stormPhase * 4 + Math.random() * (16 - stormPhase * 8);
      if (this.zone === "exterior" || this.zone === "porch" || Math.random() < 0.4) {
        const closeStrike = Math.random() < 0.15 + stormPhase * 0.3;
        const distanceKm = closeStrike ? 0.4 + Math.random() * 0.8 : 2 + Math.random() * 3.5;
        const peakIntensity = closeStrike ? 6.2 : 3.6 + Math.random() * 1.2;
        const thunderDelayMs = distanceKm * 2900 + Math.random() * 400;
        const thunderVolume = Math.max(0.14, 0.6 - distanceKm * 0.12);
        const original = this.moon.intensity;
        const flash = (intensity: number, ms: number) => {
          this.moon.intensity = intensity;
          for (const pane of this.lightningPanes) pane.opacity = 1;
          if (this.tvMat) this.tvMat.emissiveIntensity = 0.7;
          window.setTimeout(() => {
            this.moon.intensity = original;
            for (const pane of this.lightningPanes) pane.opacity = 0.72;
            if (this.tvMat) this.tvMat.emissiveIntensity = 0;
          }, ms);
        };
        // Stage 1: subtle sky pre-flash. Stage 2: the strike. Stage 3: decay.
        flash(original + 0.6, 60);
        window.setTimeout(() => flash(peakIntensity, 130), 90);
        window.setTimeout(() => flash(peakIntensity * 0.55, 100), 300);
        // Close strikes occasionally reveal a figure at the tree line.
        if (closeStrike && this.zone === "exterior" && Math.random() < 0.4) {
          this.spawnLightningFigure();
        }
        window.setTimeout(
          () => this.engine.audio.thunder(thunderVolume),
          thunderDelayMs,
        );
      }
    }

    // Ambulance flashers: alternating half-second red sweep.
    {
      const phase = Math.sin(performance.now() * 0.006) > 0;
      const on = 5.5, off = 0;
      this.flasherL.intensity = phase ? on : off;
      this.flasherR.intensity = phase ? off : on;
      this.flasherMatL.emissiveIntensity = phase ? 2.6 : 0.05;
      this.flasherMatR.emissiveIntensity = phase ? 0.05 : 2.6;
    }

    // Basement bulb swing (only while visible).
    if (this.bulbPivot.visible) {
      const t = performance.now() * 0.001;
      this.bulbPivot.rotation.x = Math.sin(t * 0.9) * 0.1;
      this.bulbPivot.rotation.z = Math.sin(t * 0.7 + 1.3) * 0.12;
      // Occasional filament sputter.
      if (Math.random() < 0.01) {
        this.bulbLight.intensity = 1.6 + Math.random() * 2;
      } else if (this.bulbLight.intensity < 4.1) {
        this.bulbLight.intensity = Math.min(4.2, this.bulbLight.intensity + dt * 6);
      }
    }

    // Volumetric shafts + flashlight-coupled visibility.
    updateVolumetricCone(this.beamCone, dt);
    updateVolumetricCone(this.moonbeamCone, dt);
    this.beamCone.visible = this.engine.flashlight.on;
    this.beamDust.visible = this.engine.flashlight.on;

    // Feed the rain shader the flashlight's world-space pose so drops
    // brighten inside the beam without any lighting model.
    {
      const cam = this.engine.camera;
      cam.getWorldPosition(this.rainUniforms.beamPos.value);
      cam.getWorldDirection(this.rainUniforms.beamDir.value);
      this.rainUniforms.beamActive.value = this.engine.flashlight.on ? 1 : 0;
    }

    // Splash spawning: only where the sky reaches (yard + porch). One or
    // two per frame at most, drawn from a small pool.
    if (this.zone === "exterior" || this.zone === "porch") {
      if (Math.random() < 0.55) this.spawnSplash();
    }
    for (const s of this.splashes) {
      s.age += dt;
    }
    this.splashes = this.splashes.filter((s) => s.age < 0.55);
    for (let i = 0; i < this.splashPool.length; i++) {
      const mesh = this.splashPool[i];
      const s = this.splashes[i];
      if (!s) { mesh.visible = false; continue; }
      const t = s.age / 0.55;
      const scale = 0.6 + t * 3.4;
      mesh.visible = true;
      mesh.position.copy(s.pos);
      mesh.scale.set(scale, 1, scale);
      (mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.55;
    }

    // Lightning figure fade-out (independent of the flash so it can
    // outlast the strike briefly, like a retinal afterimage).
    if (this.lightningFigure) {
      const mat = this.lightningFigure.material as THREE.MeshBasicMaterial;
      mat.opacity -= dt * 1.3;
      if (mat.opacity <= 0) {
        this.engine.scene.remove(this.lightningFigure);
        this.lightningFigure = null;
      }
    }

    // Beam dust drift (local space, recycled).
    {
      const positions = (this.beamDust.geometry as THREE.BufferGeometry)
        .attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < positions.count; i++) {
        let y = positions.getY(i) - dt * 0.05;
        if (y < -0.7) y = 0.5;
        positions.setY(i, y);
      }
      positions.needsUpdate = true;
    }

    // Per-zone fog density eases toward its target.
    const fog = this.engine.scene.fog as THREE.FogExp2;
    fog.density += (this.fogTarget - fog.density) * Math.min(1, dt * 1.2);

    // Fridge spill flickers to life shortly after entering the kitchen,
    // and dies with a stutter on the way out — a fluorescent that's been
    // failing for months.
    {
      const target = this.fridgeLightOn ? 1.5 + Math.sin(performance.now() * 0.017) * 0.15 : 0;
      const k = Math.min(1, dt * 3.5);
      this.fridgeLight.intensity += (target - this.fridgeLight.intensity) * k;
      // Rare hard blink while on.
      if (this.fridgeLightOn && Math.random() < 0.003) {
        this.fridgeLight.intensity = 0.15;
      }
    }

    // Curtain sway: tiny amplitude, low frequency. It should be
    // perceptible only when the player pauses to look at it.
    if (this.curtain) {
      const t = performance.now() * 0.001;
      this.curtain.rotation.z = Math.sin(t * 0.9) * 0.05
        + Math.sin(t * 2.3) * 0.015;
    }

    // Penlight from crew one: pulsing slightly, dying batteries.
    if (this.penLightPt) {
      this.penLightPt.intensity = 0.4 + Math.sin(performance.now() * 0.004) * 0.08;
    }

    this.horror.update(dt);
    this.updateZone();
    this.updateStoryTriggers();

    // Surface hold progress when the interaction system is mid-hold but the
    // scene isn't driving it (belt and braces; scene callbacks set it too).
    if (!this.engine.interaction.isHolding && useGameStore.getState().holdProgress !== null) {
      // Progress cleanup happens in the specific onCancel/onInteract paths.
    }
  }

  private updateZone() {
    const p = this.engine.player.position;
    let next: Zone;
    if (p.x > UPSTAIRS_X - 10 && p.x < UPSTAIRS_X + 10) next = "upstairs";
    else if (p.x > BASEMENT_X - 10) next = "basement";
    else if (p.z < -2.4) next = "exterior";
    else if (p.z < 0) next = "porch";
    else if (p.z < 5 && Math.abs(p.x) < 1.8) next = "entry";
    else if (p.x < -1.8 && p.z < 9) next = "livingroom";
    else if (p.x > 1.8 && p.z < 14) next = "kitchen";
    else if (p.x > 1.8) next = "bathroom";
    else next = "hallway";

    this.setZone(next);
  }

  private onZoneChange(prev: Zone, next: Zone) {
    this.applyZoneRain();
    this.applyZoneAtmosphere(next);

    if (next === "kitchen") {
      this.engine.audio.startFridge();
      this.fridgeLightOn = true;
    } else if (prev === "kitchen") {
      this.engine.audio.stopFridge();
      this.fridgeLightOn = false;
    }

    // The basement's impossible bulb (and its shadow map) exists only
    // while the player is down there.
    this.bulbPivot.visible = next === "basement";

    // Photos advance only between hallway visits, never while watched.
    if (next === "hallway") {
      if (this.hallwayWasVisited && this.flags.assessmentDone) {
        // advanced silently while the player was elsewhere — see below
      }
      this.hallwayWasVisited = true;
    } else if (prev === "hallway" && this.hallwayWasVisited && this.flags.assessmentDone) {
      window.setTimeout(() => {
        if (this.zone !== "hallway") this.advancePhotos();
      }, 900);
    }
  }

  /** Fog density + color grade per zone: the four areas read differently. */
  private applyZoneAtmosphere(zone: Zone) {
    const fogByZone: Record<Zone, number> = {
      exterior: 0.055,
      porch: 0.05,
      entry: 0.035,
      livingroom: 0.035,
      kitchen: 0.035,
      hallway: 0.035,
      bathroom: 0.035,
      upstairs: 0.028,
      basement: 0.062,
    };
    this.fogTarget = fogByZone[zone];

    const grade: GradePreset =
      zone === "exterior" || zone === "porch"
        ? "exterior"
        : zone === "upstairs"
          ? "upstairs"
          : zone === "basement"
            ? "basement"
            : "ground";
    this.engine.postfx.setGradePreset(grade);
  }

  private applyZoneRain() {
    const level =
      this.zone === "exterior" ? 1 :
      this.zone === "porch" ? 0.8 :
      this.zone === "upstairs" ? 0.35 :
      this.zone === "basement" ? 0.06 :
      0.3;
    this.engine.audio.setRainIntensity(level);
  }

  private updateStoryTriggers() {
    const p = this.engine.player.position;

    if (!this.flags.arrived && p.z > -4 && p.z < 0) {
      this.flags.arrived = true;
      this.callbacks.onPhaseChange("arrival");
      this.engine.dialogue.play(arrivalLines);
    }

    if (
      !this.flags.patientSeen &&
      this.flags.entered &&
      this.zone === "livingroom"
    ) {
      this.flags.patientSeen = true;
      this.callbacks.onPhaseChange("assessment");
      this.engine.dialogue.play(patientFoundLines, () => {
        this.patientAssess.enabled = true;
        this.setObjective("Primary assessment. Start with responsiveness.");
        this.pcr({ patientInfo: "Male, mid-40s, supine on living room floor." });
      });
    }
  }

  // Exposed for verification tooling (Playwright drives the real build).
  get debugState() {
    return {
      zone: this.zone,
      assessStep: this.assessStep,
      flags: { ...this.flags },
      patientState: this.patient.state,
      patientPos: this.patient.group.position.clone(),
      photoStage: this.photoStage,
      cluesFound: [...this.cluesFound],
    };
  }
  get patientEntity() {
    return this.patient;
  }
}
