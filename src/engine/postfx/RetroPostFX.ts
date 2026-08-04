import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

/**
 * The 1998-recorded-through-a-camcorder look: the scene renders to a ~240p
 * internal target (nearest-neighbor upscaled), then a single combined pass
 * applies film grain, ordered-feel dither, CRT scanlines + vignette, VHS
 * tracking displacement, and chromatic aberration. Aberration and tracking
 * are mostly dormant and surge with `setStress()` during scares, per the
 * brief's "chromatic aberration during specific stress moments" — the
 * baseline look stays comfortable to play.
 */
const VhsCrtShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    grainStrength: { value: 0.08 },
    ditherStrength: { value: 0.03 },
    scanlineStrength: { value: 0.13 },
    scanlineCount: { value: 240.0 },
    vignetteStrength: { value: 0.42 },
    stress: { value: 0.0 },
    trackingPhase: { value: -1.0 }, // y center of an active tracking band, <0 = none
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
    uniform float scanlineStrength;
    uniform float scanlineCount;
    uniform float vignetteStrength;
    uniform float stress;
    uniform float trackingPhase;
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;

      // VHS tracking: a horizontal band that shears the image sideways.
      if (trackingPhase >= 0.0) {
        float band = smoothstep(0.06, 0.0, abs(uv.y - trackingPhase));
        uv.x += band * (rand(vec2(uv.y * 40.0, time)) - 0.5) * 0.08;
      }
      // Constant faint line jitter, worse under stress.
      uv.x += (rand(vec2(floor(uv.y * 240.0), floor(time * 30.0))) - 0.5)
        * (0.0008 + stress * 0.004);

      // Chromatic aberration: tiny at rest, pronounced under stress.
      float ab = 0.0006 + stress * 0.006;
      vec2 dir = uv - 0.5;
      vec4 color;
      color.r = texture2D(tDiffuse, uv + dir * ab).r;
      color.g = texture2D(tDiffuse, uv).g;
      color.b = texture2D(tDiffuse, uv - dir * ab).b;
      color.a = 1.0;

      // Film grain + dither.
      color.rgb += (rand(uv * time * 60.0) - 0.5) * grainStrength;
      color.rgb += (rand(gl_FragCoord.xy) - 0.5) * ditherStrength;

      // CRT scanlines.
      float scan = sin(uv.y * scanlineCount * 3.14159 * 2.0) * 0.5 + 0.5;
      color.rgb *= 1.0 - scan * scanlineStrength;

      // CRT vignette.
      float d = length(vUv - 0.5);
      color.rgb *= 1.0 - smoothstep(0.35, 0.78, d) * vignetteStrength;

      // Slight crushed-blacks curve.
      color.rgb = pow(max(color.rgb, 0.0), vec3(1.06));

      gl_FragColor = color;
    }
  `,
};

const INTERNAL_HEIGHT = 240;

export class RetroPostFX {
  composer: EffectComposer;
  private pass: ShaderPass;
  private renderTarget: THREE.WebGLRenderTarget;

  /** Current stress level 0..1; decays automatically. */
  private stress = 0;
  private trackingTimer = 0;
  private trackingY = -1;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    const { w, h } = this.internalSize(window.innerWidth, window.innerHeight);

    this.renderTarget = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.UnsignedByteType,
    });

    this.composer = new EffectComposer(renderer, this.renderTarget);
    this.composer.setSize(w, h);
    this.composer.addPass(new RenderPass(scene, camera));

    this.pass = new ShaderPass(VhsCrtShader);
    this.pass.renderToScreen = true;
    this.composer.addPass(this.pass);
  }

  private internalSize(width: number, height: number) {
    const h = INTERNAL_HEIGHT;
    const w = Math.max(160, Math.round((width / height) * h));
    return { w, h };
  }

  resize(width: number, height: number) {
    const { w, h } = this.internalSize(width, height);
    this.composer.setSize(w, h);
  }

  /**
   * Spike the stress level (0..1). Drives chromatic aberration + jitter;
   * decays back to calm over a few seconds.
   */
  setStress(level: number) {
    this.stress = Math.max(this.stress, Math.min(1, level));
  }

  /** Fire a one-shot VHS tracking glitch band that rolls up the screen. */
  triggerTracking(duration = 0.8) {
    this.trackingTimer = duration;
    this.trackingY = 0;
  }

  render(dt: number) {
    this.pass.uniforms.time.value += dt;

    this.stress = Math.max(0, this.stress - dt * 0.35);
    this.pass.uniforms.stress.value = this.stress;

    if (this.trackingTimer > 0) {
      this.trackingTimer -= dt;
      this.trackingY += dt * 1.4; // band rolls upward
      this.pass.uniforms.trackingPhase.value = this.trackingY % 1;
    } else {
      this.pass.uniforms.trackingPhase.value = -1;
    }

    this.composer.render();
  }
}
