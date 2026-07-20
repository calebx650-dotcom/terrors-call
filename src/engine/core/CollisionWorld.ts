import * as THREE from "three";

export interface BoxCollider {
  box: THREE.Box3;
}

/**
 * Minimal AABB collision world. The vertical slice's geometry is simple
 * (boxy low-poly rooms and props), so axis-aligned boxes are enough to keep
 * the player from walking through walls/furniture without a full physics
 * engine dependency.
 */
export class CollisionWorld {
  colliders: BoxCollider[] = [];

  addFromMesh(mesh: THREE.Object3D, padding = 0) {
    const box = new THREE.Box3().setFromObject(mesh);
    if (padding !== 0) {
      box.expandByScalar(padding);
    }
    this.colliders.push({ box });
  }

  addBox(box: THREE.Box3) {
    this.colliders.push({ box });
  }

  /** Resolves a desired horizontal move against all colliders, sliding along walls. */
  resolveMove(
    position: THREE.Vector3,
    delta: THREE.Vector3,
    radius: number,
  ): THREE.Vector3 {
    const result = position.clone();

    const tryAxis = (axis: "x" | "z", amount: number) => {
      if (amount === 0) return;
      const next = result.clone();
      next[axis] += amount;
      const playerBox = new THREE.Box3(
        new THREE.Vector3(next.x - radius, next.y, next.z - radius),
        new THREE.Vector3(next.x + radius, next.y + 1.7, next.z + radius),
      );
      for (const c of this.colliders) {
        if (c.box.intersectsBox(playerBox)) {
          return; // blocked on this axis
        }
      }
      result[axis] = next[axis];
    };

    tryAxis("x", delta.x);
    tryAxis("z", delta.z);

    return result;
  }
}
