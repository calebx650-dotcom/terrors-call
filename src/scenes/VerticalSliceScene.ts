import * as THREE from "three";
import { GameEngine } from "../engine/core/GameEngine";
import { HorrorDirector, HorrorZone } from "../engine/horror/HorrorDirector";
import { Interactable } from "../engine/core/InteractionSystem";
import { LowPolyHuman } from "../entities/LowPolyHuman";
import {
  grassGroundTexture,
  plasterWallTexture,
  rustedMetalTexture,
  stoneFloorTexture,
  woodPlankTexture,
} from "../engine/materials/proceduralTextures";
import {
  MaterialKit,
  damagedPlasterKit,
  rustedMetalKit,
  stoneFloorKit,
  woodPlankKit,
} from "../engine/materials/materialKits";
import {
  clueJournalLines,
  cluePhotoLines,
  clueSymbolLines,
  introLines,
  patientAssessLines,
  patientFirstLines,
  philosophicalConversation,
  preparingTransportLines,
  extractionStep1Lines,
  extractionStep2Lines,
  extractionStep3Lines,
  escapeDoorSlamLines,
  escapeDistantSoundLines,
  escapeQuietLines,
  escapePatientReactsLines,
  exitHouseLines,
  loadAmbulanceLines,
  ambulanceInteriorIntroLines,
  transportCalmLines,
  transportRisingLines1,
  transportRisingLines2,
  transportWindLines,
  transportPeakLines,
  crashAftermathLines,
} from "../data/dialogue";

type SliceStage = 1 | 2 | 3;
type ExtractionStep = "idle" | "responsive" | "straps" | "lift" | "done";

export interface SliceCallbacks {
  onPhaseChange: (phase: string) => void;
  onSliceComplete: () => void;
}

export class VerticalSliceScene {
  private engine: GameEngine;
  private callbacks: SliceCallbacks;
  private horror: HorrorDirector;
  private stage: SliceStage = 1;
  private currentZone: HorrorZone = "exterior";

  private archer: LowPolyHuman;
  private archerGroup = new THREE.Group();
  private patient: LowPolyHuman;
  private patientGroup = new THREE.Group();

  private door!: THREE.Mesh;
  private doorOpen = false;
  private patientInteractable!: Interactable;
  private backRoomWallKit!: MaterialKit;
  private dustParticles?: THREE.Points;
  private movableProps: THREE.Object3D[] = [];
  private lights: THREE.Light[] = [];
  private flags = {
    metArcher: false,
    enteredHouse: false,
    foundPatient: false,
    assessedPatient: false,
    hadPhilosophicalTalk: false,
    preparingTransport: false,
  };

  // ---- Phase 2 state: extraction, escape, ambulance, transport, crash ----
  private extractionStep: ExtractionStep = "idle";
  private stretcherGroup = new THREE.Group();
  private stretcherInteractable!: Interactable;
  private escapePath: THREE.Vector3[] = [];
  private escapeEventsFired = new Set<string>();
  private escaping = false;
  private ambulanceRearDoors!: THREE.Mesh;
  private ambulanceRearDoorsOpen = false;
  private rearDoorsInteractable!: Interactable;
  private ambulanceInteriorBuilt = false;
  private inAmbulanceInterior = false;
  private monitorCanvas!: HTMLCanvasElement;
  private monitorCtx!: CanvasRenderingContext2D;
  private monitorTexture!: THREE.CanvasTexture;
  private heartRate = 78;
  private crashed = false;
  private ambulanceInteriorLights: THREE.Light[] = [];

  constructor(engine: GameEngine, callbacks: SliceCallbacks) {
    this.engine = engine;
    this.callbacks = callbacks;

    this.horror = new HorrorDirector({
      audio: engine.audio,
      triggerVisualEvent: (kind) => this.handleVisualEvent(kind),
      getPlayerZone: () => this.currentZone,
      getTensionStage: () => this.stage,
    });

    this.setupLighting();
    this.buildGround();
    this.buildAmbulance();
    this.buildHouseExterior();
    this.buildHouseInterior();

    this.archer = new LowPolyHuman({
      skin: [190, 150, 120],
      outfit: [70, 75, 60],
      accent: [30, 30, 30],
    });
    this.archerGroup.add(this.archer.group);
    this.archerGroup.position.set(1.4, 0, -1.5);
    this.engine.scene.add(this.archerGroup);

    this.patient = new LowPolyHuman(
      { skin: [200, 190, 175], outfit: [235, 235, 228], accent: [90, 90, 90] },
      { seated: true, hunched: true },
    );
    this.patientGroup.add(this.patient.group);
    this.patientGroup.position.set(0, 0, 24.3);
    this.patientGroup.rotation.y = Math.PI;
    this.engine.scene.add(this.patientGroup);

    this.buildStretcher();
    this.buildAmbulanceRearDoors();

    this.engine.player.setSpawn(0, -4, Math.PI);

    this.engine.addUpdateHook((dt) => this.update(dt));

    window.setTimeout(() => this.startIntro(), 1200);
  }

  // ---------- world construction ----------

  private setupLighting() {
    const moon = new THREE.DirectionalLight(0x9fb4d8, 2.6);
    moon.position.set(-10, 20, -10);
    this.engine.scene.add(moon);

    const hemi = new THREE.HemisphereLight(0x4a5478, 0x11131a, 1.4);
    this.engine.scene.add(hemi);

    const ambient = new THREE.AmbientLight(0x3a4050, 0.9);
    this.engine.scene.add(ambient);
  }

  private buildGround() {
    const tex = grassGroundTexture();
    tex.repeat.set(20, 20);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.engine.scene.add(ground);
  }

  private buildAmbulance() {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.6 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xaa1f1f, roughness: 0.6 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.1, 5.2), bodyMat);
    body.position.y = 1.1;
    body.castShadow = true;
    body.receiveShadow = true;
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
    for (const [x, z] of [
      [-1.15, -2.6], [1.15, -2.6], [-1.15, 2], [1.15, 2],
    ] as [number, number][]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.4, z);
      group.add(wheel);
    }

    const beacon = new THREE.PointLight(0xff2222, 0, 6);
    beacon.position.set(0, 2.3, -2.5);
    group.add(beacon);
    this.beaconLight = beacon;

    group.position.set(-2.5, 0, -7);
    this.engine.scene.add(group);
    this.engine.collisionWorld.addFromMesh(group);
  }

  private beaconLight!: THREE.PointLight;

  private wallMat = new THREE.MeshStandardMaterial({
    map: (() => {
      const t = plasterWallTexture();
      t.repeat.set(3, 2);
      return t;
    })(),
    roughness: 0.95,
  });

  private addWall(
    cx: number,
    cz: number,
    width: number,
    depth: number,
    height = 3,
    y = 0,
  ) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      this.wallMat,
    );
    wall.position.set(cx, y + height / 2, cz);
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.engine.scene.add(wall);
    this.engine.collisionWorld.addFromMesh(wall);
    return wall;
  }

  /** Wall segment spanning an x-range at a fixed z, for corridor-side stubs. */
  private addWallSegX(xStart: number, xEnd: number, z: number, height = 3) {
    const width = xEnd - xStart;
    const cx = (xStart + xEnd) / 2;
    return this.addWall(cx, z, width, 0.25, height);
  }

  private buildHouseExterior() {
    // House footprint: x [-5,5], z [10,26]. Door gap centered on south wall (z=10).
    // The back room (z >= 19.5) is the visual benchmark section (see
    // buildRitualRoomBenchmark), so its bounding walls use the upgraded
    // damaged-plaster material kit while the hallway/living room keep the
    // baseline flat texture — the split is deliberate, not an oversight.
    const wallHeight = 3.4;
    this.addWall(-3.75, 10, 2.5, 0.3, wallHeight); // south wall, left of door
    this.addWall(3.75, 10, 2.5, 0.3, wallHeight); // south wall, right of door
    const north = this.addWall(0, 26, 10, 0.3, wallHeight); // north wall (back room)
    const westFront = this.addWall(-5, 14.75, 0.3, 9.5, wallHeight); // west, hallway/living
    const westBack = this.addWall(-5, 22.75, 0.3, 6.5, wallHeight); // west, back room
    const eastFront = this.addWall(5, 14.75, 0.3, 9.5, wallHeight); // east, hallway/living
    const eastBack = this.addWall(5, 22.75, 0.3, 6.5, wallHeight); // east, back room

    const benchmarkKit = damagedPlasterKit();
    benchmarkKit.setRepeat(2.5, 2);
    for (const wall of [north, westBack, eastBack]) {
      wall.material = benchmarkKit.material;
    }
    this.backRoomWallKit = benchmarkKit;

    // Pitched roof suggestion (two slanted planes, no interior collider).
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2b2622, roughness: 1 });
    const roofGeo = new THREE.BoxGeometry(10.6, 0.25, 9.5);
    const roofL = new THREE.Mesh(roofGeo, roofMat);
    roofL.position.set(0, wallHeight + 1.1, 18);
    roofL.rotation.z = 0.5;
    roofL.position.x = -1.6;
    this.engine.scene.add(roofL);
    const roofR = roofL.clone();
    roofR.rotation.z = -0.5;
    roofR.position.x = 1.6;
    this.engine.scene.add(roofR);

    // Door — pivoting mesh, starts closed across the gap.
    const doorMat = new THREE.MeshStandardMaterial({ map: rustedMetalTexture(), roughness: 0.8 });
    this.door = new THREE.Mesh(new THREE.BoxGeometry(1.5, wallHeight - 0.2, 0.12), doorMat);
    this.door.position.set(0, (wallHeight - 0.2) / 2, 10);
    this.door.castShadow = true;
    this.engine.scene.add(this.door);
    this.engine.collisionWorld.addFromMesh(this.door);

    this.engine.interaction.register({
      object: this.door,
      prompt: this.doorOpen ? "" : "[E] Open door",
      onInteract: () => this.openFrontDoor(),
    });
  }

  private buildHouseInterior() {
    // Hallway/living-room floor keeps the baseline flat texture.
    const floorTex = stoneFloorTexture();
    floorTex.repeat.set(8, 7);
    const frontFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 9.5),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 1 }),
    );
    frontFloor.rotation.x = -Math.PI / 2;
    frontFloor.position.set(0, 0.01, 14.75);
    frontFloor.receiveShadow = true;
    this.engine.scene.add(frontFloor);

    // Back room floor uses the upgraded material kit (see buildRitualRoomBenchmark).
    const backFloorKit = stoneFloorKit();
    backFloorKit.setRepeat(6, 4);
    const backFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 6.5),
      backFloorKit.material,
    );
    backFloor.rotation.x = -Math.PI / 2;
    backFloor.position.set(0, 0.01, 22.75);
    backFloor.receiveShadow = true;
    this.engine.scene.add(backFloor);

    // Interior partition walls carving hallway -> living room -> back room.
    // Each divider is built as two stubs jutting in from the side walls,
    // always leaving a walkable center corridor (x in [-1.6, 1.6]) so the
    // player can never get physically stuck on the critical path, while side
    // rooms still read as distinct spaces to explore off that spine.
    this.addWallSegX(-5, -1.6, 14, 3); // hallway/living room divider, west stub
    this.addWallSegX(1.6, 5, 14, 3); // hallway/living room divider, east stub
    const backDividerW = this.addWallSegX(-5, -1.6, 19.5, 3); // living/back divider, west stub
    const backDividerE = this.addWallSegX(1.6, 5, 19.5, 3); // living/back divider, east stub
    backDividerW.material = this.backRoomWallKit.material;
    backDividerE.material = this.backRoomWallKit.material;

    // Dim interior point lights (small pools of light; flashlight does the real work).
    const lampPositions: [number, number, number][] = [
      [0, 2.6, 12],
      [-2, 2.6, 16],
      [1.5, 2.6, 21],
    ];
    for (const [x, y, z] of lampPositions) {
      const lamp = new THREE.PointLight(0xffcf8a, 0.5, 5, 2);
      lamp.position.set(x, y, z);
      this.engine.scene.add(lamp);
      this.lights.push(lamp);
    }

    this.buildProps();
    this.buildRitualRoomBenchmark();
  }

  private buildProps() {
    const woodTex = woodPlankTexture();
    const tableMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.85 });

    // Living room table with journal + photo clues.
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.7), tableMat);
    table.position.set(1.5, 0.25, 16.5);
    table.castShadow = true;
    table.receiveShadow = true;
    this.engine.scene.add(table);
    this.engine.collisionWorld.addFromMesh(table);
    this.movableProps.push(table);

    const journal = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.05, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x3a2c1e, roughness: 0.9 }),
    );
    journal.position.set(1.5, 0.53, 16.5);
    journal.castShadow = true;
    this.engine.scene.add(journal);
    this.engine.interaction.register({
      object: journal,
      prompt: "[E] Read journal",
      onInteract: () => {
        if (this.flags.enteredHouse) {
          this.engine.dialogue.play(clueJournalLines);
          this.advanceStageIfNeeded(2);
        }
      },
    });

    const photo = new THREE.Mesh(
      new THREE.PlaneGeometry(0.4, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x9c9382, roughness: 1 }),
    );
    photo.position.set(-4.85, 1.6, 15);
    photo.rotation.y = Math.PI / 2;
    this.engine.scene.add(photo);
    this.engine.interaction.register({
      object: photo,
      prompt: "[E] Look at photograph",
      onInteract: () => {
        this.engine.dialogue.play(cluePhotoLines);
        this.advanceStageIfNeeded(2);
      },
    });

    // Occult symbol carving near the back room threshold.
    const symbolTex = (() => {
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#3a3530";
      ctx.fillRect(0, 0, 64, 64);
      ctx.strokeStyle = "#8a1414";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(32, 6);
      ctx.lineTo(58, 50);
      ctx.lineTo(6, 50);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(32, 34, 16, 0, Math.PI * 2);
      ctx.stroke();
      const tex = new THREE.CanvasTexture(c);
      tex.magFilter = THREE.NearestFilter;
      return tex;
    })();
    const symbol = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.9),
      new THREE.MeshStandardMaterial({ map: symbolTex, roughness: 1 }),
    );
    symbol.position.set(4.85, 1.6, 20.5);
    symbol.rotation.y = -Math.PI / 2;
    this.engine.scene.add(symbol);
    this.engine.interaction.register({
      object: symbol,
      prompt: "[E] Examine carving",
      onInteract: () => {
        this.engine.dialogue.play(clueSymbolLines);
        this.advanceStageIfNeeded(3);
      },
    });

    // A chair in the living room used for the "object shifted" ambient event.
    const chair = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.7, 0.45),
      new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.9 }),
    );
    chair.position.set(-1.2, 0.35, 17.5);
    chair.castShadow = true;
    this.engine.scene.add(chair);
    this.movableProps.push(chair);

    // Ritual altar-ish table in the back room where the patient sits.
    const altar = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.6, 1),
      new THREE.MeshStandardMaterial({ color: 0x241f1c, roughness: 1 }),
    );
    altar.position.set(-1, 0.3, 23.5);
    altar.castShadow = true;
    this.engine.scene.add(altar);
    this.engine.collisionWorld.addFromMesh(altar);

    // Interactable: the patient himself. A generously sized invisible hitbox
    // (rather than raycasting the low-poly body meshes directly) keeps a
    // seated character reliably targetable without demanding pixel-precise
    // aim from the player.
    const patientHitbox = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1.8, 1),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
    );
    patientHitbox.position.set(0, 0.9, 24.3);
    this.engine.scene.add(patientHitbox);
    this.engine.collisionWorld.addBox(
      new THREE.Box3(
        new THREE.Vector3(-0.35, 0, 23.95),
        new THREE.Vector3(0.35, 1.6, 24.65),
      ),
    );

    this.patientInteractable = {
      object: patientHitbox,
      prompt: "[E] Assess patient",
      enabled: false,
      onInteract: () => this.assessPatient(),
    };
    this.engine.interaction.register(this.patientInteractable);
  }

  /**
   * The back room is the vertical slice's visual quality benchmark: the one
   * space built to a standard the rest of the house (and, eventually, the
   * rest of the game) should be measured against. Every addition here is
   * either story-supporting (ritual evidence, personal effects), gameplay-
   * supporting (readable sightlines to the patient/altar), or atmosphere-
   * supporting (moonlight shaft, candlelight, dust) — nothing is here just
   * to raise a prop count.
   */
  private buildRitualRoomBenchmark() {
    const woodKit = woodPlankKit();
    woodKit.setRepeat(1, 1);

    // Baseboard trim along the back room walls — a cheap detail pass that
    // reads immediately as "authored architecture" rather than a bare box.
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x1c1712, roughness: 0.9 });
    const northTrim = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.16, 0.1), trimMat);
    northTrim.position.set(0, 0.08, 25.86);
    this.engine.scene.add(northTrim);
    const westTrim = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 6.4), trimMat);
    westTrim.position.set(-4.86, 0.08, 22.75);
    this.engine.scene.add(westTrim);
    const eastTrim = westTrim.clone();
    eastTrim.position.x = 4.86;
    this.engine.scene.add(eastTrim);

    // A single small window high on the north wall — the room's one light
    // source that isn't a practical fixture. A cool emissive pane plus a
    // narrow spotlight standing in for a moonbeam gives the room a fixed
    // "north is outside, this is where the cold light comes from" anchor
    // that makes the space easier to remember and stage sightlines against.
    const windowFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.3, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.8 }),
    );
    windowFrame.position.set(2.6, 2.3, 25.85);
    this.engine.scene.add(windowFrame);
    const windowPane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.85, 1.05),
      new THREE.MeshBasicMaterial({ color: 0x8fa8c9, transparent: true, opacity: 0.55 }),
    );
    windowPane.position.set(2.6, 2.3, 25.8);
    this.engine.scene.add(windowPane);
    const moonbeam = new THREE.SpotLight(0xaebfe0, 3.2, 9, Math.PI / 9, 0.6, 1.6);
    moonbeam.position.set(2.6, 3.2, 25.6);
    const moonbeamTarget = new THREE.Object3D();
    moonbeamTarget.position.set(1.6, 0, 22.5);
    this.engine.scene.add(moonbeamTarget);
    moonbeam.target = moonbeamTarget;
    this.engine.scene.add(moonbeam);

    // Floating dust motes drifting through the moonbeam — cheap, high
    // atmosphere-per-triangle payoff that a static screenshot can't fake.
    this.buildDustParticles(1.8, 0.3, 22.5, 2.4);

    // Ritual candles around the altar: warm emissive nubs + flickering
    // point lights, registered with the horror director's light pool so
    // the existing ambient-flicker event touches them too.
    const candlePositions: [number, number, number][] = [
      [-1.35, 0.62, 23.15],
      [-0.6, 0.62, 23.85],
      [-1.35, 0.62, 23.85],
    ];
    for (const [x, y, z] of candlePositions) {
      const wax = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.035, 0.14, 6),
        new THREE.MeshStandardMaterial({ color: 0xcbb98a, roughness: 0.6 }),
      );
      wax.position.set(x, y, z);
      this.engine.scene.add(wax);
      const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffb347 }),
      );
      flame.position.set(x, y + 0.09, z);
      this.engine.scene.add(flame);
      const flicker = new THREE.PointLight(0xff9a3c, 0.6, 2.2, 2.5);
      flicker.position.set(x, y + 0.12, z);
      this.engine.scene.add(flicker);
      this.lights.push(flicker);
    }

    // Chalk ritual circle scored into the floor beneath the altar.
    const chalkTex = (() => {
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, 256, 256);
      ctx.strokeStyle = "rgba(210,205,190,0.55)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(128, 128, 100, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(128, 128, 70, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(128 + Math.cos(a) * 70, 128 + Math.sin(a) * 70);
        ctx.lineTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100);
        ctx.stroke();
      }
      const tex = new THREE.CanvasTexture(c);
      tex.magFilter = THREE.NearestFilter;
      return tex;
    })();
    const chalkDecal = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 2.6),
      new THREE.MeshBasicMaterial({ map: chalkTex, transparent: true }),
    );
    chalkDecal.rotation.x = -Math.PI / 2;
    chalkDecal.position.set(-1, 0.02, 23.5);
    this.engine.scene.add(chalkDecal);

    // Small storytelling objects: scattered papers and a photograph propped
    // against the wall, communicating "someone lived and worshipped here"
    // without a line of dialogue.
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xd8cfb0, roughness: 1 });
    for (let i = 0; i < 4; i++) {
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.28), paperMat);
      paper.rotation.x = -Math.PI / 2;
      paper.rotation.z = Math.random() * Math.PI;
      paper.position.set(-1.6 + Math.random() * 1.4, 0.03, 21.2 + Math.random() * 1.2);
      this.engine.scene.add(paper);
    }

    const propPhoto = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xa89a80, roughness: 1 }),
    );
    propPhoto.position.set(-1, 0.635, 23.1);
    propPhoto.rotation.x = -Math.PI / 2.3;
    this.engine.scene.add(propPhoto);

    // A second, damaged chair on its side — implied struggle without
    // spelling it out.
    const brokenChair = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.7, 0.45),
      woodKit.material,
    );
    brokenChair.position.set(2, 0.22, 21.3);
    brokenChair.rotation.z = Math.PI / 2.2;
    brokenChair.rotation.y = 0.4;
    brokenChair.castShadow = true;
    this.engine.scene.add(brokenChair);
  }

  /** Slow-drifting dust motes within a box volume, lit by whatever light passes through them. */
  private buildDustParticles(cx: number, cy: number, cz: number, radius: number) {
    const spriteTex = (() => {
      const c = document.createElement("canvas");
      c.width = 16;
      c.height = 16;
      const ctx = c.getContext("2d")!;
      const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      grad.addColorStop(0, "rgba(255,255,255,0.9)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 16, 16);
      return new THREE.CanvasTexture(c);
    })();

    const count = 40;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = cx + (Math.random() - 0.5) * radius;
      positions[i * 3 + 1] = cy + Math.random() * 2.2;
      positions[i * 3 + 2] = cz + (Math.random() - 0.5) * radius;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.03,
      map: spriteTex,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      color: 0xdfe6f2,
    });
    const points = new THREE.Points(geo, mat);
    points.userData.center = new THREE.Vector3(cx, cy, cz);
    points.userData.radius = radius;
    this.engine.scene.add(points);
    this.dustParticles = points;
  }

  private buildStretcher() {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.5, metalness: 0.4 });
    const padMat = new THREE.MeshStandardMaterial({ color: 0xb7301f, roughness: 0.8 });

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.08, 1.9), frameMat);
    frame.position.y = 0.5;
    this.stretcherGroup.add(frame);

    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.06, 1.8), padMat);
    pad.position.y = 0.56;
    this.stretcherGroup.add(pad);

    const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.46, 6);
    for (const [x, z] of [[-0.28, -0.8], [0.28, -0.8], [-0.28, 0.8], [0.28, 0.8]] as [number, number][]) {
      const leg = new THREE.Mesh(legGeo, frameMat);
      leg.position.set(x, 0.23, z);
      this.stretcherGroup.add(leg);
    }
    const wheelGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.04, 8);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.7 });
    for (const [x, z] of [[-0.28, -0.8], [0.28, -0.8], [-0.28, 0.8], [0.28, 0.8]] as [number, number][]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.03, z);
      this.stretcherGroup.add(wheel);
    }

    this.stretcherGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Hidden until the extraction sequence brings it into the back room.
    this.stretcherGroup.visible = false;
    this.stretcherGroup.position.set(0.9, 0, 24.3);
    this.engine.scene.add(this.stretcherGroup);
  }

  /** Rear ambulance doors, built the same pivoting-mesh way as the front door. */
  private buildAmbulanceRearDoors() {
    const kit = rustedMetalKit();
    kit.setRepeat(1, 1);
    this.ambulanceRearDoors = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.85, 0.08), kit.material);
    // Ambulance body group sits at (-2.5, 0, -7); rear face is +z of the body.
    this.ambulanceRearDoors.position.set(-2.5, 1.12, -4.45);
    this.ambulanceRearDoors.castShadow = true;
    this.engine.scene.add(this.ambulanceRearDoors);
    this.engine.collisionWorld.addFromMesh(this.ambulanceRearDoors);

    this.rearDoorsInteractable = {
      object: this.ambulanceRearDoors,
      prompt: "[E] Open rear doors",
      enabled: false,
      onInteract: () => this.openAmbulanceRearDoors(),
    };
    this.engine.interaction.register(this.rearDoorsInteractable);
  }

  /**
   * The ambulance patient compartment. Built once, off to the side of the
   * house/exterior playspace so it never has to share a coordinate system
   * with the house's collision geometry — this is a hard cut on entry
   * (doors close, scene changes), not a seamless walk, matching how Archer
   * already "teleports" between beats elsewhere in this scene. The
   * compartment reuses the same material-kit standard established in the
   * back room benchmark (see buildRitualRoomBenchmark) rather than falling
   * back to flat single-texture materials, since the brief calls the
   * ambulance out as a second visual benchmark space.
   */
  private buildAmbulanceInterior() {
    if (this.ambulanceInteriorBuilt) return;
    this.ambulanceInteriorBuilt = true;

    const originX = 60;
    const metalKit = rustedMetalKit();
    metalKit.setRepeat(2, 1);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xd6d6ce, roughness: 0.55, metalness: 0.2 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x3a3d3f, roughness: 0.8 });

    // No collider on floor/ceiling: the player capsule has no vertical
    // extent to speak of in this engine (no jumping), so a ceiling collider
    // would overlap the player's bounding box everywhere in the room and
    // block all horizontal movement — the same class of bug as the earlier
    // ambulance-spawn issue. Only wall-height colliders that share the
    // player's eye-level Y range should ever be registered.
    const w = 2.0, h = 1.95, d = 3.2;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), floorMat);
    floor.position.set(originX, 0.75, 0);
    floor.receiveShadow = true;
    this.engine.scene.add(floor);

    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), wallMat);
    ceiling.position.set(originX, 0.75 + h, 0);
    this.engine.scene.add(ceiling);

    // Side walls with a bank of cabinets built into the driver-side wall.
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, d), wallMat);
    leftWall.position.set(originX - w / 2, 0.75 + h / 2, 0);
    this.engine.scene.add(leftWall);
    this.engine.collisionWorld.addFromMesh(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, d), wallMat);
    rightWall.position.set(originX + w / 2, 0.75 + h / 2, 0);
    this.engine.scene.add(rightWall);
    this.engine.collisionWorld.addFromMesh(rightWall);

    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), wallMat);
    frontWall.position.set(originX, 0.75 + h / 2, -d / 2);
    this.engine.scene.add(frontWall);
    this.engine.collisionWorld.addFromMesh(frontWall);

    // Cabinet bank along the right wall.
    const cabinetMat = new THREE.MeshStandardMaterial({ color: 0xc7cbcd, roughness: 0.45, metalness: 0.3 });
    const cabinets = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, 2.0), cabinetMat);
    cabinets.position.set(originX + w / 2 - 0.2, 0.75 + 0.6, 0.3);
    cabinets.castShadow = true;
    this.engine.scene.add(cabinets);
    this.engine.collisionWorld.addFromMesh(cabinets);
    for (let i = -1; i <= 1; i++) {
      const handle = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.12, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.4 }),
      );
      handle.position.set(originX + w / 2 - 0.04, 0.9, 0.3 + i * 0.55);
      this.engine.scene.add(handle);
    }

    // Stretcher mount along the centerline, with the (already-loaded) stretcher on it.
    this.stretcherGroup.visible = true;
    this.stretcherGroup.position.set(originX - 0.3, 0.8, 0.1);
    this.stretcherGroup.rotation.set(0, 0, 0);

    // Cardiac monitor: a small housing with a dynamically updated canvas screen.
    this.monitorCanvas = document.createElement("canvas");
    this.monitorCanvas.width = 128;
    this.monitorCanvas.height = 96;
    this.monitorCtx = this.monitorCanvas.getContext("2d")!;
    this.monitorTexture = new THREE.CanvasTexture(this.monitorCanvas);
    this.monitorTexture.magFilter = THREE.NearestFilter;
    this.redrawMonitor();

    const monitorHousing = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.26, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6 }),
    );
    monitorHousing.position.set(originX + w / 2 - 0.42, 1.55, -0.9);
    monitorHousing.castShadow = true;
    this.engine.scene.add(monitorHousing);

    const monitorScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.28, 0.2),
      new THREE.MeshBasicMaterial({ map: this.monitorTexture }),
    );
    monitorScreen.position.set(originX + w / 2 - 0.42 - 0.091, 1.55, -0.9);
    monitorScreen.rotation.y = Math.PI / 2;
    this.engine.scene.add(monitorScreen);

    this.engine.interaction.register({
      object: monitorScreen,
      prompt: "[E] Check monitor",
      onInteract: () => {
        this.engine.dialogue.say(
          "Johnny",
          `Heart rate's at ${Math.round(this.heartRate)}. ${this.heartRate > 120 ? "That is not slowing down." : "Holding, for now."}`,
        );
      },
    });

    // Oxygen tank + medical bag, flavor interactables.
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.55, 10),
      new THREE.MeshStandardMaterial({ color: 0x2e7d5b, roughness: 0.4, metalness: 0.3 }),
    );
    tank.position.set(originX - w / 2 + 0.16, 1.1, -1.2);
    tank.castShadow = true;
    this.engine.scene.add(tank);
    this.engine.interaction.register({
      object: tank,
      prompt: "[E] Check oxygen",
      onInteract: () => this.engine.dialogue.say("Johnny", "Oxygen's full. Good — one less thing."),
    });

    const bag = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.2, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xb01818, roughness: 0.9 }),
    );
    bag.position.set(originX - w / 2 + 0.2, 0.9, 1.2);
    bag.castShadow = true;
    this.engine.scene.add(bag);
    this.engine.interaction.register({
      object: bag,
      prompt: "[E] Check medical bag",
      onInteract: () => this.engine.dialogue.say("Johnny", "Everything's where it should be. Small mercies."),
    });

    // Radio, mounted near the front wall.
    const radio = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.16, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.4 }),
    );
    radio.position.set(originX - w / 2 + 0.18, 1.5, -d / 2 + 0.1);
    this.engine.scene.add(radio);
    this.engine.interaction.register({
      object: radio,
      prompt: "[E] Adjust radio",
      onInteract: () => {
        this.engine.audio.radioStatic();
        this.engine.dialogue.say("Johnny", "Just static. Nobody's picking up out here.");
      },
    });

    // Ceiling light — the interior's primary practical, wired into the same
    // ambient-flicker pool the horror director already knows how to touch.
    const ceilingLight = new THREE.PointLight(0xeaf1ff, 1.6, 4, 2);
    ceilingLight.position.set(originX, 0.75 + h - 0.15, 0);
    this.engine.scene.add(ceilingLight);
    this.ambulanceInteriorLights.push(ceilingLight);
    this.lights.push(ceilingLight);

    // Rear doors (visual only — the player entered through here narratively).
    const rearWallKit = metalKit;
    const rearWall = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), rearWallKit.material);
    rearWall.position.set(originX, 0.75 + h / 2, d / 2);
    this.engine.scene.add(rearWall);
    this.engine.collisionWorld.addFromMesh(rearWall);

    // Interior wear/scuffs on the floor for the "used vehicle" read.
    const scuffMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15 });
    for (let i = 0; i < 5; i++) {
      const scuff = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), scuffMat);
      scuff.rotation.x = -Math.PI / 2;
      scuff.rotation.z = Math.random() * Math.PI;
      scuff.position.set(originX - 0.6 + Math.random() * 1.2, 0.81, -1 + Math.random() * 2);
      this.engine.scene.add(scuff);
    }

    this.ambulanceInteriorOrigin = new THREE.Vector3(originX, 0, 0);
  }

  private ambulanceInteriorOrigin = new THREE.Vector3();

  private redrawMonitor() {
    const ctx = this.monitorCtx;
    if (!ctx) return;
    const w = this.monitorCanvas.width;
    const h = this.monitorCanvas.height;
    ctx.fillStyle = "#03130a";
    ctx.fillRect(0, 0, w, h);

    const urgent = this.heartRate > 120;
    ctx.strokeStyle = urgent ? "#ff5544" : "#39ff8f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const mid = h * 0.55;
    ctx.moveTo(0, mid);
    const spikeX = w * 0.55;
    for (let x = 0; x < w; x++) {
      let y = mid;
      if (Math.abs(x - spikeX) < 4) {
        y = mid - (4 - Math.abs(x - spikeX)) * (urgent ? 9 : 6);
      } else if (Math.abs(x - spikeX - 6) < 3) {
        y = mid + (3 - Math.abs(x - spikeX - 6)) * 4;
      }
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = urgent ? "#ff5544" : "#39ff8f";
    ctx.font = "20px monospace";
    ctx.fillText(`${Math.round(this.heartRate)}`, 6, 22);
    ctx.font = "10px monospace";
    ctx.fillText("BPM", 6, 34);

    this.monitorTexture.needsUpdate = true;
  }

  // ---------- sequence logic ----------

  private startIntro() {
    this.engine.dialogue.play(introLines, () => {
      this.flags.metArcher = true;
      this.callbacks.onPhaseChange("exterior_arrival");
    });
  }

  private openFrontDoor() {
    if (this.doorOpen) return;
    this.doorOpen = true;
    this.engine.audio.doorCreak();
    this.door.rotation.y = -Math.PI / 2.1;
    this.door.position.x -= 0.75;
    this.door.position.z -= 0.05;
    this.engine.collisionWorld.colliders = this.engine.collisionWorld.colliders.filter(
      (c) => !c.box.containsPoint(this.door.position),
    );
    this.flags.enteredHouse = true;
    this.currentZone = "hallway";
    this.callbacks.onPhaseChange("house_exploration");
    this.engine.audio.startAmbience();
    this.horror.start();
    this.stage = 1;

    window.setTimeout(() => {
      // Archer follows the player in; teleport him just inside so he's
      // present for the later beats without needing full pathfinding AI.
      this.archerGroup.position.set(0.6, 0, 12.5);
    }, 3000);
  }

  private advanceStageIfNeeded(stage: SliceStage) {
    if (stage > this.stage) this.stage = stage;
  }

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
        if (this.doorOpen) {
          this.door.rotation.y += (Math.random() - 0.5) * 0.3;
        }
        break;
      }
      case "shadow_pass": {
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(0.8, 2),
          new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.5,
          }),
        );
        plane.position.set(-1.8, 1.2, 16 + Math.random() * 3);
        plane.rotation.y = Math.PI / 2;
        this.engine.scene.add(plane);
        window.setTimeout(() => this.engine.scene.remove(plane), 350);
        break;
      }
    }
  }

  private assessPatient() {
    if (this.flags.assessedPatient || !this.flags.foundPatient) return;
    this.flags.assessedPatient = true;
    this.engine.dialogue.play(patientAssessLines, () => {
      window.setTimeout(() => this.startPhilosophicalMoment(), 800);
    });
  }

  private startPhilosophicalMoment() {
    if (this.flags.hadPhilosophicalTalk) return;
    this.flags.hadPhilosophicalTalk = true;
    this.engine.dialogue.play(philosophicalConversation, () => {
      window.setTimeout(() => this.beginTransportPrep(), 800);
    });
  }

  private beginTransportPrep() {
    this.flags.preparingTransport = true;
    this.engine.dialogue.play(preparingTransportLines, () => {
      window.setTimeout(() => this.startExtraction(), 600);
    });
  }

  // ---------- Phase 2: extraction ----------

  private startExtraction() {
    this.callbacks.onPhaseChange("patient_extraction");
    this.stretcherGroup.visible = true;
    this.extractionStep = "responsive";
    this.patientInteractable.prompt = "[E] Confirm responsiveness";
    this.patientInteractable.onInteract = () => this.runExtractionStep();
  }

  private runExtractionStep() {
    if (this.extractionStep === "responsive") {
      this.extractionStep = "straps";
      this.patientInteractable.enabled = false;
      this.engine.dialogue.play(extractionStep1Lines, () => {
        this.patientInteractable.prompt = "[E] Secure straps";
        this.patientInteractable.enabled = true;
      });
    } else if (this.extractionStep === "straps") {
      this.extractionStep = "lift";
      this.patientInteractable.enabled = false;
      this.engine.dialogue.play(extractionStep2Lines, () => {
        this.patientInteractable.prompt = "[E] Lift onto stretcher";
        this.patientInteractable.enabled = true;
      });
    } else if (this.extractionStep === "lift") {
      this.extractionStep = "done";
      this.patientInteractable.enabled = false;
      this.liftPatientOntoStretcher();
      this.engine.dialogue.play(extractionStep3Lines, () => {
        window.setTimeout(() => this.startEscape(), 1000);
      });
    }
  }

  private liftPatientOntoStretcher() {
    // Reparent the patient onto the stretcher and lay him flat — the
    // low-poly rig doesn't need a real lift animation to sell "he's on the
    // gurney now," just a consistent new pose relative to it.
    this.engine.scene.remove(this.patientGroup);
    this.stretcherGroup.add(this.patientGroup);
    this.patientGroup.position.set(0, 0.58, 0);
    this.patientGroup.rotation.set(-Math.PI / 2, 0, 0);
  }

  // ---------- Phase 2: escape through the house ----------

  private startEscape() {
    this.escaping = true;
    this.callbacks.onPhaseChange("house_escape");
    this.escapePath = [
      new THREE.Vector3(0.9, 0, 24.3),
      new THREE.Vector3(0, 0, 21),
      new THREE.Vector3(0, 0, 16.5),
      new THREE.Vector3(0, 0, 12),
      new THREE.Vector3(0, 0, 9.2),
      new THREE.Vector3(0, 0, 4),
      new THREE.Vector3(-2.9, 0, -3.6),
    ];
    this.stretcherGroup.position.copy(this.escapePath[0]);
  }

  /** Advances the stretcher escort along escapePath and fires contextual horror beats. */
  private updateEscape(dt: number) {
    if (!this.escaping || this.escapePath.length < 2) return;

    const speed = 1.35;
    const current = this.stretcherGroup.position;
    let remaining = speed * dt;

    while (remaining > 0 && this.escapePath.length > 1) {
      const target = this.escapePath[1];
      const toTarget = target.clone().sub(current);
      const dist = toTarget.length();
      if (dist <= remaining) {
        current.copy(target);
        remaining -= dist;
        this.escapePath.shift();
      } else {
        current.add(toTarget.normalize().multiplyScalar(remaining));
        remaining = 0;
      }
    }

    // Face the direction of travel.
    if (this.escapePath.length > 1) {
      const dir = this.escapePath[1].clone().sub(current);
      if (dir.lengthSq() > 0.0001) {
        this.stretcherGroup.rotation.y = Math.atan2(dir.x, dir.z);
      }
    }

    const z = current.z;
    const fire = (key: string, lines: Parameters<typeof this.engine.dialogue.play>[0]) => {
      if (this.escapeEventsFired.has(key)) return;
      this.escapeEventsFired.add(key);
      this.engine.dialogue.play(lines);
    };

    if (z < 22 && !this.escapeEventsFired.has("quiet")) {
      this.escapeEventsFired.add("quiet");
      this.horror.stop();
      this.engine.audio.setWindIntensity(0);
      window.setTimeout(() => fire("quiet-line", escapeQuietLines), 600);
    }
    if (z < 19) {
      fire("doorslam", escapeDoorSlamLines);
      this.handleVisualEvent("door_move");
      this.engine.audio.distantThud();
    }
    if (z < 16 && !this.escapeEventsFired.has("distantsound")) {
      this.escapeEventsFired.add("distantsound");
      this.engine.audio.woodCreak();
      window.setTimeout(() => fire("distantsound-line", escapeDistantSoundLines), 500);
    }
    if (z < 13 && !this.escapeEventsFired.has("shadow")) {
      this.escapeEventsFired.add("shadow");
      this.handleVisualEvent("shadow_pass");
    }
    if (z < 10.5) {
      fire("patientreacts", escapePatientReactsLines);
    }
    if (!this.doorOpen) this.openFrontDoor();

    if (this.escapePath.length === 1) {
      this.escaping = false;
      this.exitHouse();
    }
  }

  private exitHouse() {
    this.currentZone = "exterior";
    this.horror.stop();
    this.engine.dialogue.play(exitHouseLines, () => {
      window.setTimeout(() => {
        this.rearDoorsInteractable.enabled = true;
        this.rearDoorsInteractable.prompt = "[E] Open rear doors";
      }, 500);
    });
  }

  // ---------- Phase 2: ambulance loading + interior ----------

  private openAmbulanceRearDoors() {
    if (this.ambulanceRearDoorsOpen) return;
    this.ambulanceRearDoorsOpen = true;
    this.engine.audio.doorCreak();
    this.ambulanceRearDoors.rotation.y = Math.PI / 2.1;
    this.ambulanceRearDoors.position.x -= 0.9;
    this.engine.collisionWorld.colliders = this.engine.collisionWorld.colliders.filter(
      (c) => !c.box.containsPoint(this.ambulanceRearDoors.position),
    );
    this.rearDoorsInteractable.enabled = false;

    this.engine.dialogue.play(loadAmbulanceLines, () => {
      window.setTimeout(() => this.enterAmbulanceInterior(), 800);
    });
  }

  private enterAmbulanceInterior() {
    this.buildAmbulanceInterior();
    this.inAmbulanceInterior = true;
    this.callbacks.onPhaseChange("ambulance_interior");

    const origin = this.ambulanceInteriorOrigin;
    this.engine.player.setSpawn(origin.x, origin.z + 0.6, 0);
    this.engine.audio.stopWind();

    window.setTimeout(() => {
      this.engine.dialogue.play(ambulanceInteriorIntroLines, () => {
        window.setTimeout(() => this.startTransportTimeline(), 1500);
      });
    }, 800);
  }

  // ---------- Phase 2: the 12-minute transport, compressed to real time ----------

  private startTransportTimeline() {
    this.callbacks.onPhaseChange("transport");
    this.engine.audio.startAmbience();
    this.heartRate = 78;
    this.redrawMonitor();

    const beepLoop = () => {
      if (this.crashed) return;
      this.engine.audio.monitorBeep(this.heartRate > 120);
      const interval = Math.max(280, 60000 / this.heartRate);
      window.setTimeout(beepLoop, interval);
    };
    beepLoop();

    // Calm baseline.
    this.engine.dialogue.play(transportCalmLines);

    window.setTimeout(() => this.rampHeartRate(78, 112, 12000), 2000);
    window.setTimeout(() => this.engine.dialogue.play(transportRisingLines1), 14000);
    window.setTimeout(() => this.engine.dialogue.play(transportRisingLines2), 24000);
    window.setTimeout(() => this.engine.audio.radioStatic(), 25000);
    window.setTimeout(() => this.engine.audio.radioStatic(), 27500);

    window.setTimeout(() => {
      this.engine.audio.startWind(0.05);
      this.engine.audio.setWindIntensity(0.25);
      this.engine.dialogue.play(transportWindLines);
    }, 34000);

    window.setTimeout(() => this.rampHeartRate(112, 152, 10000), 38000);

    window.setTimeout(() => {
      this.engine.audio.setWindIntensity(0.7);
      for (const light of this.ambulanceInteriorLights) {
        this.handleAmbulanceFlicker(light);
      }
    }, 44000);

    window.setTimeout(() => this.engine.dialogue.play(transportPeakLines), 48000);
    window.setTimeout(() => this.engine.audio.setWindIntensity(1), 54000);

    window.setTimeout(() => this.triggerCrash(), 58000);
  }

  private rampHeartRate(from: number, to: number, durationMs: number) {
    const start = performance.now();
    const step = () => {
      if (this.crashed) return;
      const t = Math.min(1, (performance.now() - start) / durationMs);
      this.heartRate = from + (to - from) * t;
      this.redrawMonitor();
      if (t < 1) window.setTimeout(step, 400);
    };
    step();
  }

  private handleAmbulanceFlicker(light: THREE.Light) {
    if (this.crashed) return;
    const original = (light as THREE.PointLight).intensity;
    (light as THREE.PointLight).intensity = 0.1;
    window.setTimeout(() => {
      if (!this.crashed) (light as THREE.PointLight).intensity = original;
      window.setTimeout(() => this.handleAmbulanceFlicker(light), 3000 + Math.random() * 4000);
    }, 100 + Math.random() * 150);
  }

  // ---------- Phase 2: the crash ----------

  private triggerCrash() {
    if (this.crashed) return;
    this.crashed = true;
    this.engine.audio.stinger();
    this.engine.player.triggerShake(0.35, 1.4);
    for (const light of this.ambulanceInteriorLights) {
      (light as THREE.PointLight).intensity = 0;
    }
    this.engine.audio.setWindIntensity(0);
    this.engine.audio.stopWind();

    window.setTimeout(() => {
      this.engine.dialogue.play(crashAftermathLines, () => {
        window.setTimeout(() => {
          this.callbacks.onPhaseChange("slice_end");
          this.callbacks.onSliceComplete();
        }, 1500);
      });
    }, 1200);
  }

  // ---------- per-frame ----------

  private update(dt: number) {
    this.archer.update(dt);
    this.patient.update(dt);

    if (this.beaconLight) {
      this.beaconLight.intensity = 0.15 + Math.abs(Math.sin(performance.now() * 0.002)) * 0.1;
    }

    if (this.dustParticles) {
      const center = this.dustParticles.userData.center as THREE.Vector3;
      const radius = this.dustParticles.userData.radius as number;
      const positions = (this.dustParticles.geometry as THREE.BufferGeometry).attributes
        .position as THREE.BufferAttribute;
      for (let i = 0; i < positions.count; i++) {
        let y = positions.getY(i) + dt * 0.05;
        if (y > center.y + 2.2) y = center.y;
        positions.setY(i, y);
      }
      positions.needsUpdate = true;
    }

    if (this.inAmbulanceInterior) {
      // The interior is a self-contained space; the house's zone-driven
      // horror director and patient-discovery trigger don't apply here.
      return;
    }

    this.horror.update(dt);

    if (this.escaping) {
      this.updateEscape(dt);
      return;
    }

    // Zone tracking for horror director + patient discovery trigger.
    const p = this.engine.player.position;
    if (p.z < 10) this.currentZone = "exterior";
    else if (p.z < 14) this.currentZone = "hallway";
    else if (p.z < 19.5) this.currentZone = "livingroom";
    else this.currentZone = "backroom";

    if (this.currentZone === "backroom" && !this.flags.foundPatient && this.flags.enteredHouse) {
      this.flags.foundPatient = true;
      this.stage = 3;
      this.engine.dialogue.play(patientFirstLines, () => {
        this.patientInteractable.enabled = true;
      });
    }
  }
}
