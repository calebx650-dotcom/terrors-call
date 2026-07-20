import * as THREE from "three";
import { heightToNormalMap, noiseHeightCanvas } from "./normalMap";

/**
 * "Material kits" bundle a color map + normal map + roughness map generated
 * together from the same underlying procedural pattern, so surface relief in
 * the normal map actually lines up with what's painted in the albedo (wood
 * grain ridges catch light where the planks are drawn, plaster pitting sits
 * where the noise is darkest, etc). This is the material-quality baseline
 * for the visual benchmark room — every other room should eventually reuse
 * these kits rather than the flat single-texture materials in
 * proceduralTextures.ts.
 */

function canvas(size: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  draw(c.getContext("2d")!);
  return c;
}

function toTexture(c: HTMLCanvasElement, repeat: [number, number] = [1, 1]) {
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(...repeat);
  return tex;
}

function grayNoise(ctx: CanvasRenderingContext2D, size: number, base: number, variance: number) {
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.max(0, Math.min(255, base + (Math.random() - 0.5) * variance));
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

export interface MaterialKit {
  material: THREE.MeshStandardMaterial;
  setRepeat: (x: number, y: number) => void;
}

function buildKit(
  size: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
  heightOctaves: Array<{ scale: number; amplitude: number }>,
  roughnessBase: number,
  roughnessVariance: number,
  normalStrength = 1.6,
): MaterialKit {
  const albedoCanvas = canvas(size, paint);
  const albedo = toTexture(albedoCanvas);

  const heightCanvas = noiseHeightCanvas(size, heightOctaves);
  const normal = heightToNormalMap(heightCanvas, normalStrength);
  normal.wrapS = THREE.RepeatWrapping;
  normal.wrapT = THREE.RepeatWrapping;

  const roughnessCanvas = canvas(size, (ctx) =>
    grayNoise(ctx, size, roughnessBase, roughnessVariance),
  );
  const roughnessMap = toTexture(roughnessCanvas);

  const material = new THREE.MeshStandardMaterial({
    map: albedo,
    normalMap: normal,
    roughnessMap,
    roughness: 1,
    metalness: 0,
  });

  return {
    material,
    setRepeat: (x, y) => {
      albedo.repeat.set(x, y);
      normal.repeat.set(x, y);
      roughnessMap.repeat.set(x, y);
    },
  };
}

/** Aged wood planking — floors, tables, the altar. */
export function woodPlankKit(): MaterialKit {
  return buildKit(
    128,
    (ctx) => {
      grayNoise(ctx, 128, 108, 22);
      const overlay = ctx.getImageData(0, 0, 128, 128);
      for (let i = 0; i < overlay.data.length; i += 4) {
        overlay.data[i] *= 0.75;
        overlay.data[i + 1] *= 0.52;
        overlay.data[i + 2] *= 0.34;
      }
      ctx.putImageData(overlay, 0, 0);
      ctx.strokeStyle = "rgba(20,12,6,0.65)";
      ctx.lineWidth = 2;
      for (let y = 0; y < 128; y += 16) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(128, y);
        ctx.stroke();
      }
      // Scattered scratches/wear.
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      for (let i = 0; i < 24; i++) {
        ctx.beginPath();
        const x = Math.random() * 128;
        const y = Math.random() * 128;
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 6);
        ctx.stroke();
      }
    },
    [
      { scale: 6, amplitude: 1 },
      { scale: 22, amplitude: 0.5 },
    ],
    0.82,
    0.18,
    2.2,
  );
}

/** Cracked, water-stained plaster wall. */
export function damagedPlasterKit(): MaterialKit {
  return buildKit(
    128,
    (ctx) => {
      grayNoise(ctx, 128, 168, 20);
      // Water stains: soft dark radial blooms trickling down.
      for (let i = 0; i < 3; i++) {
        const x = 20 + Math.random() * 88;
        const y = Math.random() * 40;
        const grad = ctx.createRadialGradient(x, y, 2, x, y + 60, 46);
        grad.addColorStop(0, "rgba(60,55,40,0.55)");
        grad.addColorStop(1, "rgba(60,55,40,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);
      }
      // Hairline cracks.
      ctx.strokeStyle = "rgba(35,30,22,0.5)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        let x = Math.random() * 128;
        let y = 0;
        ctx.moveTo(x, y);
        while (y < 128) {
          x += (Math.random() - 0.5) * 14;
          y += 10 + Math.random() * 10;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // A patch of exposed lath/drywall damage.
      ctx.fillStyle = "rgba(50,40,30,0.7)";
      ctx.beginPath();
      ctx.ellipse(96, 86, 16, 11, 0.4, 0, Math.PI * 2);
      ctx.fill();
    },
    [
      { scale: 4, amplitude: 1 },
      { scale: 16, amplitude: 0.6 },
      { scale: 40, amplitude: 0.3 },
    ],
    0.92,
    0.14,
    1.3,
  );
}

/** Cold stone flooring with mortar joints and grime. */
export function stoneFloorKit(): MaterialKit {
  return buildKit(
    128,
    (ctx) => {
      grayNoise(ctx, 128, 78, 18);
      ctx.strokeStyle = "rgba(15,15,15,0.6)";
      ctx.lineWidth = 3;
      for (let x = 0; x <= 128; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 128);
        ctx.stroke();
      }
      for (let y = 0; y <= 128; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(128, y);
        ctx.stroke();
      }
      // Grime pooling near joints.
      ctx.fillStyle = "rgba(20,18,14,0.25)";
      for (let i = 0; i < 10; i++) {
        const x = Math.random() * 128;
        const y = Math.random() * 128;
        ctx.beginPath();
        ctx.ellipse(x, y, 8, 5, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    [
      { scale: 8, amplitude: 1 },
      { scale: 30, amplitude: 0.4 },
    ],
    0.75,
    0.15,
    1.4,
  );
}

/** Rusted, dented metal — the front door, ambulance panels. */
export function rustedMetalKit(): MaterialKit {
  return buildKit(
    64,
    (ctx) => {
      grayNoise(ctx, 64, 96, 24);
      for (let i = 0; i < 5; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        const grad = ctx.createRadialGradient(x, y, 1, x, y, 14);
        grad.addColorStop(0, "rgba(120,60,30,0.5)");
        grad.addColorStop(1, "rgba(120,60,30,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
      }
    },
    [
      { scale: 5, amplitude: 1 },
      { scale: 14, amplitude: 0.5 },
    ],
    0.55,
    0.2,
    1.8,
  );
}
