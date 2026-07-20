import * as THREE from "three";

/**
 * All surface materials in the vertical slice come from small procedurally
 * drawn canvas textures rather than image files, so there is no external
 * asset licensing to track. Nearest-neighbor filtering keeps them chunky
 * and low-res in keeping with the retro visual target.
 */
function makeCanvas(size: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function noiseFill(
  ctx: CanvasRenderingContext2D,
  size: number,
  base: [number, number, number],
  variance: number,
) {
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * variance;
    img.data[i] = Math.max(0, Math.min(255, base[0] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, base[1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, base[2] + n));
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

export function woodPlankTexture(): THREE.Texture {
  return makeCanvas(64, (ctx) => {
    noiseFill(ctx, 64, [92, 62, 40], 18);
    ctx.strokeStyle = "rgba(30,18,10,0.6)";
    ctx.lineWidth = 1;
    for (let y = 0; y < 64; y += 8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(64, y);
      ctx.stroke();
    }
  });
}

export function plasterWallTexture(): THREE.Texture {
  return makeCanvas(64, (ctx) => {
    noiseFill(ctx, 64, [150, 138, 118], 22);
    ctx.strokeStyle = "rgba(40,32,22,0.25)";
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      const x = Math.random() * 64;
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (Math.random() * 12 - 6), 64);
      ctx.stroke();
    }
  });
}

export function stoneFloorTexture(): THREE.Texture {
  return makeCanvas(64, (ctx) => {
    noiseFill(ctx, 64, [70, 68, 66], 16);
    ctx.strokeStyle = "rgba(20,20,20,0.5)";
    for (let x = 0; x <= 64; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 64);
      ctx.stroke();
    }
    for (let y = 0; y <= 64; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(64, y);
      ctx.stroke();
    }
  });
}

export function grassGroundTexture(): THREE.Texture {
  return makeCanvas(64, (ctx) => {
    noiseFill(ctx, 64, [40, 46, 32], 20);
  });
}

export function rustedMetalTexture(): THREE.Texture {
  return makeCanvas(64, (ctx) => {
    noiseFill(ctx, 64, [110, 60, 40], 26);
  });
}

export function fabricTexture(baseColor: [number, number, number]): THREE.Texture {
  return makeCanvas(32, (ctx) => {
    noiseFill(ctx, 32, baseColor, 14);
  });
}
