import * as THREE from 'three';

/**
 * Custom GLSL Ocean ShaderMaterial for Marina Coastal Causeway:
 * Multi-octave animated wave normals, deep teal-to-navy depth gradient,
 * Fresnel sky reflection, sunlit specular glints, and animated seawall foam.
 */
export function createOceanShaderMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.45, 0.72, 0.52).normalize() },
      uSkyColor: { value: new THREE.Color(0x38bdf8) },
      uDeepColor: { value: new THREE.Color(0x041e3a) },
      uShallowColor: { value: new THREE.Color(0x0891b2) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vWorldPos;
      varying vec2 vUv;

      void main() {
        vUv = uv;
        vec3 pos = position;
        float wave1 = sin(pos.x * 0.08 + uTime * 1.6) * cos(pos.z * 0.07 + uTime * 1.2) * 0.35;
        float wave2 = sin(pos.x * 0.21 - uTime * 2.3 + pos.z * 0.17) * 0.16;
        pos.y += wave1 + wave2;
        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSkyColor;
      uniform vec3 uDeepColor;
      uniform vec3 uShallowColor;
      varying vec3 vWorldPos;
      varying vec2 vUv;

      void main() {
        float wx = vWorldPos.x;
        float wz = vWorldPos.z;

        // Multi-octave procedural wave normal perturbation
        float nx = cos(wx * 0.28 + uTime * 2.1) * 0.14 + cos(wx * 0.65 - wz * 0.45 + uTime * 3.1) * 0.07;
        float nz = sin(wz * 0.24 + uTime * 1.8) * 0.14 + sin(wz * 0.58 + wx * 0.35 - uTime * 2.7) * 0.07;
        vec3 normal = normalize(vec3(nx, 1.0, nz));

        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.2);

        float depthMix = clamp(sin(wx * 0.015) * 0.5 + 0.5, 0.0, 1.0);
        vec3 waterCol = mix(uDeepColor, uShallowColor, depthMix * 0.55);
        waterCol = mix(waterCol, uSkyColor, clamp(fresnel * 0.85, 0.0, 0.82));

        // Sunlit specular glint
        vec3 halfVec = normalize(uSunDir + viewDir);
        float spec = pow(max(dot(normal, halfVec), 0.0), 96.0);
        waterCol += vec3(1.0, 0.96, 0.86) * spec * 1.4;

        // Animated shoreline / seawall foam crests
        float foamWave = sin(wx * 0.45 + wz * 0.32 + uTime * 2.6) * cos(wz * 0.5 - uTime * 1.9);
        float foam = smoothstep(0.76, 0.96, foamWave);
        waterCol = mix(waterCol, vec3(0.88, 0.97, 1.0), foam * 0.42);

        gl_FragColor = vec4(waterCol, 0.94);
      }
    `,
    transparent: true,
  });
}

/**
 * Atmospheric Rayleigh/Mie gradient sky dome shader with glowing solar disc.
 */
export function createSkyDomeMaterial(
  zenithHex: number,
  horizonHex: number,
  sunHex: number
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uZenithColor: { value: new THREE.Color(zenithHex) },
      uHorizonColor: { value: new THREE.Color(horizonHex) },
      uSunColor: { value: new THREE.Color(sunHex) },
      uSunDir: { value: new THREE.Vector3(0.45, 0.52, 0.65).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenithColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      varying vec3 vDir;

      void main() {
        vec3 dir = normalize(vDir);
        float h = clamp(dir.y, 0.0, 1.0);
        vec3 col = mix(uHorizonColor, uZenithColor, pow(h, 0.55));

        float sunAmt = max(dot(dir, normalize(uSunDir)), 0.0);
        // Mie scattering halo + crisp solar disc
        col += uSunColor * pow(sunAmt, 12.0) * 0.45;
        col += uSunColor * smoothstep(0.996, 0.9995, sunAmt) * 1.6;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

/**
 * Screen-space Radial Motion Blur & RGB Chromatic Aberration ShaderPass
 * driven by speed ratio and Nitro / Shockwave activation.
 */
export const SpeedPostShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uIntensity: { value: 0.0 },
    uChromatic: { value: 0.0 },
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
    uniform float uIntensity;
    uniform float uChromatic;
    varying vec2 vUv;

    void main() {
      if (uIntensity < 0.01 && uChromatic < 0.001) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }

      vec2 center = vec2(0.5, 0.48);
      vec2 dir = vUv - center;
      float dist = length(dir);
      float edgeMask = smoothstep(0.18, 0.72, dist);

      vec2 blurStep = dir * (uIntensity * 0.022 * edgeMask);
      vec3 acc = vec3(0.0);
      acc += texture2D(tDiffuse, clamp(vUv - blurStep * 1.5, 0.001, 0.999)).rgb * 0.18;
      acc += texture2D(tDiffuse, clamp(vUv - blurStep * 0.7, 0.001, 0.999)).rgb * 0.24;
      acc += texture2D(tDiffuse, vUv).rgb * 0.26;
      acc += texture2D(tDiffuse, clamp(vUv + blurStep * 0.7, 0.001, 0.999)).rgb * 0.20;
      acc += texture2D(tDiffuse, clamp(vUv + blurStep * 1.5, 0.001, 0.999)).rgb * 0.12;

      if (uChromatic > 0.001) {
        vec2 chromaOffset = dir * (uChromatic * 0.009 * edgeMask);
        float r = texture2D(tDiffuse, clamp(vUv + chromaOffset, 0.001, 0.999)).r;
        float b = texture2D(tDiffuse, clamp(vUv - chromaOffset, 0.001, 0.999)).b;
        acc.r = mix(acc.r, r, 0.65);
        acc.b = mix(acc.b, b, 0.65);
      }

      gl_FragColor = vec4(acc, 1.0);
    }
  `,
};
