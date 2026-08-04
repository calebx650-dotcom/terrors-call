import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

/**
 * The 1998-recorded-through-a-camcorder look, art-directed:
 *
 *   scene (ACES-tonemapped, ~240p) → subtle bloom → combined VHS/CRT pass
 *
 * The combined pass carries film grain, dither, CRT scanlines + vignette,
 * VHS tracking bands, tape-noise lines, stress-driven chromatic aberration,
 * and a per-zone color grade (lift/gain/saturation, lerped smoothly when
 * the player changes areas). Bloom runs at the internal resolution so its
 * cost is negligible; it exists to give the flashlight, window panes, and
 * emissive practicals a halation glow instead of clipped flat white.
 *
 * pmndrs/postprocessing was evaluated and deliberately NOT adopted: at a
 * 240p target its extra effects are either counterproductive to the PS1
 * crunch (SMAA) or redundant with this bespoke pass, and the bespoke pass
 * is the game's visual identity. Three's bundled UnrealBloomPass covers
 * the one real gap without a new dependency.
 */
const VhsCrtShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    grainStrength: { value: 0.075 },
    ditherStrength: { value: 0.03 },
    scanlineStrength: { value: 0.13 },
    scanlineCount: { value: 240.0 },
    vignetteStrength: { value: 0.46 },
    stress: { value: 0.0 },
    trackingPhase: { value: -1.0 }, // y center of an active tracking band, <0 = none
    gradeLift: { value: new THREE.Vector3(0.02, 0.025, 0.04) },
    gradeGain: { value: new THREE.Vector3(0.95, 0.97, 1.02) },
    gradeSat: { value: 0.8 },
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
    uniform vec3 gradeLift;
    uniform vec3 gradeGain;
    uniform float gradeSat;
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

      // Split-tone grade: gain shapes highlights, lift tints the floor of
      // the blacks (analog tape never reaches true black), then a
      // saturation pull toward the graded luma.
      color.rgb = color.rgb * gradeGain + gradeLift;
      float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(vec3(luma), color.rgb, gradeSat);

      // Film grain + dither.
      color.rgb += (rand(uv * time * 60.0) - 0.5) * grainStrength;
      color.rgb += (rand(gl_FragCoord.xy) - 0.5) * ditherStrength;

      // Rare single-line tape noise: a bright dropout line for one frame.
      float lineY = floor(uv.y * 240.0);
      float noiseGate = rand(vec2(lineY, floor(time * 24.0)));
      if (noiseGate > 0.9985 - stress * 0.002) {
        color.rgb += (rand(vec2(uv.x * 90.0, lineY)) - 0.2) * 0.35;
      }

      // CRT scanlines.
      float scan = sin(uv.y * scanlineCount * 3.14159 * 2.0) * 0.5 + 0.5;
      color.rgb *= 1.0 - scan * scanlineStrength;

      // CRT vignette.
      float d = length(vUv - 0.5);
      color.rgb *= 1.0 - smoothstep(0.32, 0.78, d) * vignetteStrength;

      // Slight crushed-blacks curve.
      color.rgb = pow(max(color.rgb, 0.0), vec3(1.06));

      gl_FragColor = color;
    }
  `,
};

export type GradePreset = "exterior" | "ground" | "upstairs" | "basement";

/** Zone grades: cold rain-blue outside, neutral-cold ground floor, dusty
 *  warm-gray upstairs, sickly green-leaning basement. */
const GRADES: Record<
  GradePreset,
  { lift: [number, number, number]; gain: [number, number, number]; sat: number }
> = {
  exterior: { lift: [0.018, 0.028, 0.052], gain: [0.88, 0.94, 1.06], sat: 0.72 },
  ground: { lift: [0.02, 0.025, 0.038], gain: [0.95, 0.97, 1.01], sat: 0.8 },
  upstairs: { lift: [0.032, 0.028, 0.024], gain: [1.02, 0.97, 0.9], sat: 0.68 },
  basement: { lift: [0.018, 0.034, 0.024], gain: [0.9, 1.01, 0.86], sat: 0.62 },
};

const INTERNAL_HEIGHT = 240;

export class RetroPostFX {
  composer: EffectComposer;
  private pass: ShaderPass;
  private bloom: UnrealBloomPass;
  private renderTarget: THREE.WebGLRenderTarget;

  private stress = 0;
  private trackingTimer = 0;
  private trackingY = -1;

  private targetGrade = GRADES.exterior;

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

    // Subtle halation: high threshold so only true light sources bloom.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.45, 0.6, 0.72);
    this.composer.addPass(this.bloom);

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
    this.bloom.resolution.set(w, h);
  }

  /** Spike the stress level (0..1); decays back to calm automatically. */
  setStress(level: number) {
    this.stress = Math.max(this.stress, Math.min(1, level));
  }

  /** Fire a one-shot VHS tracking glitch band that rolls up the screen. */
  triggerTracking(duration = 0.8) {
    this.trackingTimer = duration;
    this.trackingY = 0;
  }

  /** Set the zone color grade; the shader lerps toward it over ~1.5s. */
  setGradePreset(preset: GradePreset) {
    this.targetGrade = GRADES[preset];
  }

  render(dt: number) {
    this.pass.uniforms.time.value += dt;

    this.stress = Math.max(0, this.stress - dt * 0.35);
    this.pass.uniforms.stress.value = this.stress;

    // Grade lerp.
    const k = Math.min(1, dt * 0.9);
    const lift = this.pass.uniforms.gradeLift.value as THREE.Vector3;
    const gain = this.pass.uniforms.gradeGain.value as THREE.Vector3;
    lift.lerp(new THREE.Vector3(...this.targetGrade.lift), k);
    gain.lerp(new THREE.Vector3(...this.targetGrade.gain), k);
    this.pass.uniforms.gradeSat.value +=
      (this.targetGrade.sat - this.pass.uniforms.gradeSat.value) * k;

    if (this.trackingTimer > 0) {
      this.trackingTimer -= dt;
      this.trackingY += dt * 1.4;
      this.pass.uniforms.trackingPhase.value = this.trackingY % 1;
    } else {
      this.pass.uniforms.trackingPhase.value = -1;
    }

    this.composer.render();
  }
}
