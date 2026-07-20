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
  clueJournalLines,
  cluePhotoLines,
  clueSymbolLines,
  introLines,
  patientAssessLines,
  patientFirstLines,
  philosophicalConversation,
  preparingTransportLines,
} from "../data/dialogue";

type SliceStage = 1 | 2 | 3;

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
    const wallHeight = 3.4;
    this.addWall(-3.75, 10, 2.5, 0.3, wallHeight); // south wall, left of door
    this.addWall(3.75, 10, 2.5, 0.3, wallHeight); // south wall, right of door
    this.addWall(0, 26, 10, 0.3, wallHeight); // north wall
    this.addWall(-5, 18, 0.3, 16, wallHeight); // west wall
    this.addWall(5, 18, 0.3, 16, wallHeight); // east wall

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
    const floorTex = stoneFloorTexture();
    floorTex.repeat.set(8, 12);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 16),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.01, 18);
    floor.receiveShadow = true;
    this.engine.scene.add(floor);

    // Interior partition walls carving hallway -> living room -> back room.
    // Each divider is built as two stubs jutting in from the side walls,
    // always leaving a walkable center corridor (x in [-1.6, 1.6]) so the
    // player can never get physically stuck on the critical path, while side
    // rooms still read as distinct spaces to explore off that spine.
    this.addWallSegX(-5, -1.6, 14, 3); // hallway/living room divider, west stub
    this.addWallSegX(1.6, 5, 14, 3); // hallway/living room divider, east stub
    this.addWallSegX(-5, -1.6, 19.5, 3); // living room/back room divider, west stub
    this.addWallSegX(1.6, 5, 19.5, 3); // living room/back room divider, east stub

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
      this.callbacks.onPhaseChange("slice_end");
      this.callbacks.onSliceComplete();
    });
  }

  // ---------- per-frame ----------

  private update(dt: number) {
    this.archer.update(dt);
    this.patient.update(dt);
    this.horror.update(dt);

    if (this.beaconLight) {
      this.beaconLight.intensity = 0.15 + Math.abs(Math.sin(performance.now() * 0.002)) * 0.1;
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
