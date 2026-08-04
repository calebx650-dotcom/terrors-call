import * as THREE from "three";

/**
 * A cheap volumetric light shaft: an open-ended additive cone whose alpha
 * fades along its length and softens at the silhouette (view-angle
 * falloff). Two draw calls of this sell "light in humid air" for the
 * flashlight and the moonbeam without any raymarching — appropriate to
 * both the 240p target and GTX-1050-class hardware.
 *
 * The cone's apex sits at the local origin pointing down -Z, so it can be
 * parented directly to a camera or aligned with a SpotLight.
 */
export function createVolumetricCone(
  color: THREE.ColorRepresentation,
  length: number,
  radius: number,
  intensity = 0.16,
): THREE.Mesh {
  const geo = new THREE.ConeGeometry(radius, length, 24, 6, true);
  geo.rotateX(Math.PI / 2); // apex now at +Z/2 ... base at -Z/2
  geo.translate(0, 0, -length / 2); // apex at origin, base at -length

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      color: { value: new THREE.Color(color) },
      intensity: { value: intensity },
      time: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormalV = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform float intensity;
      uniform float time;
      varying vec2 vUv;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      void main() {
        // v = 1 at the apex, 0 at the base. The camera often sits at the
        // apex (flashlight), so the shaft must be invisible right at the
        // eye, build up over the first stretch, and dissolve before the
        // base circle can ever read as a hard disc.
        float nearFade = smoothstep(1.0, 0.78, vUv.y);
        float farFade = smoothstep(0.0, 0.45, vUv.y);
        float along = nearFade * farFade;
        // Soften the silhouette: faces seen edge-on fade out.
        float rim = abs(dot(normalize(vNormalV), normalize(vViewDir)));
        rim = smoothstep(0.0, 0.6, rim);
        // Slow internal shimmer so the shaft feels like air, not plastic.
        float shimmer = 0.9 + 0.1 * sin(time * 0.7 + vUv.y * 9.0);
        gl_FragColor = vec4(color, along * rim * shimmer * intensity);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 5; // after opaque geometry
  mesh.frustumCulled = true;
  return mesh;
}

/** Advance the shimmer clock on a cone created above. */
export function updateVolumetricCone(cone: THREE.Mesh, dt: number) {
  const mat = cone.material as THREE.ShaderMaterial;
  mat.uniforms.time.value += dt;
}
