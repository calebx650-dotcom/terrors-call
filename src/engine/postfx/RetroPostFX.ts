import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

/**
 * Retro low-poly survival-horror look: the scene renders at a reduced internal
 * resolution (then upscaled with nearest-neighbor filtering) and gets a grain +
 * dither pass, evoking late-90s/early-2000s console horror without recreating
 * any specific game's shader pipeline.
 */
const GrainDitherShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    grainStrength: { value: 0.09 },
    ditherStrength: { value: 0.035 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float grainStrength;
    uniform float ditherStrength;
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      float grain = (rand(vUv * time * 60.0) - 0.5) * grainStrength;
      color.rgb += grain;

      float d = (rand(gl_FragCoord.xy) - 0.5) * ditherStrength;
      color.rgb += d;

      // Slight crushed-blacks / low-fi contrast curve.
      color.rgb = pow(color.rgb, vec3(1.05));

      gl_FragColor = color;
    }
  `,
};

export class RetroPostFX {
  composer: EffectComposer;
  private grainPass: ShaderPass;
  private renderTarget: THREE.WebGLRenderTarget;
  private internalScale: number;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    internalScale = 0.42,
  ) {
    this.internalScale = internalScale;
    const w = Math.max(160, Math.floor(window.innerWidth * internalScale));
    const h = Math.max(120, Math.floor(window.innerHeight * internalScale));

    this.renderTarget = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.UnsignedByteType,
    });

    this.composer = new EffectComposer(renderer, this.renderTarget);
    this.composer.setSize(w, h);
    this.composer.addPass(new RenderPass(scene, camera));

    this.grainPass = new ShaderPass(GrainDitherShader);
    this.grainPass.renderToScreen = true;
    this.composer.addPass(this.grainPass);
  }

  resize(width: number, height: number) {
    const w = Math.max(160, Math.floor(width * this.internalScale));
    const h = Math.max(120, Math.floor(height * this.internalScale));
    this.composer.setSize(w, h);
  }

  render(dt: number) {
    this.grainPass.uniforms.time.value += dt;
    this.composer.render();
  }
}
