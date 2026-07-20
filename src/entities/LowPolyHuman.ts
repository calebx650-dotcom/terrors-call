import * as THREE from "three";
import { fabricTexture } from "../engine/materials/proceduralTextures";

export interface HumanColors {
  skin: [number, number, number];
  outfit: [number, number, number];
  accent: [number, number, number];
}

/**
 * A simple original low-poly humanoid built from primitives. Distinct
 * silhouettes/palettes differentiate Johnny, Archer, and the patient without
 * needing sculpted character models for the vertical slice.
 */
export class LowPolyHuman {
  group = new THREE.Group();
  private head: THREE.Mesh;
  private breatheTime = Math.random() * 10;

  constructor(colors: HumanColors, opts?: { seated?: boolean; hunched?: boolean }) {
    const skinMat = new THREE.MeshStandardMaterial({
      map: fabricTexture(colors.skin),
      roughness: 0.9,
    });
    const outfitMat = new THREE.MeshStandardMaterial({
      map: fabricTexture(colors.outfit),
      roughness: 0.85,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      map: fabricTexture(colors.accent),
      roughness: 0.8,
    });

    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, opts?.hunched ? 0.55 : 0.7, 0.3),
      outfitMat,
    );
    torso.position.y = opts?.seated ? 0.95 : 1.25;
    torso.castShadow = true;
    this.group.add(torso);

    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), skinMat);
    this.head.position.y = torso.position.y + (opts?.hunched ? 0.35 : 0.5);
    this.head.castShadow = true;
    this.group.add(this.head);

    const legGeo = new THREE.BoxGeometry(0.18, opts?.seated ? 0.5 : 0.9, 0.2);
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, accentMat);
      leg.position.set(side * 0.13, opts?.seated ? 0.45 : 0.45, opts?.seated ? 0.2 : 0);
      if (opts?.seated) leg.rotation.x = Math.PI / 2.1;
      leg.castShadow = true;
      this.group.add(leg);
    }

    const armGeo = new THREE.BoxGeometry(0.14, 0.6, 0.14);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(armGeo, outfitMat);
      arm.position.set(side * 0.32, torso.position.y - 0.05, 0);
      arm.rotation.z = side * 0.12;
      arm.castShadow = true;
      this.group.add(arm);
    }
  }

  update(dt: number) {
    this.breatheTime += dt;
    const s = 1 + Math.sin(this.breatheTime * 1.4) * 0.01;
    this.head.scale.set(s, s, s);
  }
}
