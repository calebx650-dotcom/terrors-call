import * as THREE from "three";

/**
 * Derives a tangent-space normal map from a grayscale height canvas using a
 * Sobel-style gradient estimate. This lets the procedural material kit give
 * flat low-poly surfaces real-looking surface relief (plank seams, plaster
 * pitting, stone joints) without any authored texture assets.
 */
export function heightToNormalMap(
  heightCanvas: HTMLCanvasElement,
  strength = 1.6,
): THREE.CanvasTexture {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const src = heightCanvas.getContext("2d")!.getImageData(0, 0, w, h).data;

  const heightAt = (x: number, y: number) => {
    const xi = (x + w) % w;
    const yi = (y + h) % h;
    const i = (yi * w + xi) * 4;
    return src[i] / 255;
  };

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d")!;
  const img = octx.createImageData(w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = heightAt(x - 1, y);
      const r = heightAt(x + 1, y);
      const u = heightAt(x, y - 1);
      const d = heightAt(x, y + 1);

      const dx = (l - r) * strength;
      const dy = (u - d) * strength;
      const dz = 1.0;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const i = (y * w + x) * 4;
      img.data[i] = ((dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((dz / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }

  octx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(out);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** A grayscale height canvas built from layered noise, for feeding heightToNormalMap. */
export function noiseHeightCanvas(
  size: number,
  octaves: Array<{ scale: number; amplitude: number }>,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);

  // Cheap value-noise: random lattice per octave, bilinearly sampled.
  const lattices = octaves.map(({ scale }) => {
    const res = Math.max(2, Math.ceil(size / scale));
    const lattice = new Float32Array(res * res);
    for (let i = 0; i < lattice.length; i++) lattice[i] = Math.random();
    return { res, lattice };
  });

  const sample = (lattice: Float32Array, res: number, u: number, v: number) => {
    const x = u * (res - 1);
    const y = v * (res - 1);
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(x0 + 1, res - 1);
    const y1 = Math.min(y0 + 1, res - 1);
    const fx = x - x0;
    const fy = y - y0;
    const a = lattice[y0 * res + x0];
    const b = lattice[y0 * res + x1];
    const c = lattice[y1 * res + x0];
    const d = lattice[y1 * res + x1];
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let value = 0;
      let totalAmp = 0;
      for (let o = 0; o < octaves.length; o++) {
        const { amplitude } = octaves[o];
        const { res, lattice } = lattices[o];
        value += sample(lattice, res, x / size, y / size) * amplitude;
        totalAmp += amplitude;
      }
      value /= totalAmp;
      const v = Math.max(0, Math.min(255, Math.floor(value * 255)));
      const i = (y * size + x) * 4;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}
