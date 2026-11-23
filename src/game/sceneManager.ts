import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { audioEngine } from './audio';
import {
  applyCarCustomization,
  buildCarRig,
  buildGhostCarRig,
  type CarVisualRig,
} from './carMesh';
import { CAR_CATALOG, DRIVER_CATALOG } from './catalog';
import { buildDriverRig, type DriverRig, updateDriverRig } from './driverMesh';
import { gamepadManager } from './gamepad';
import {
  GhostLapRecorder,
  loadTrackGhost,
  sampleGhostFrameAtTime,
  saveTrackGhost,
} from './ghost';
import type { OfflineP2PManager } from './p2p';
import {
  buildHudTelemetry,
  createRaceWorld,
  getPlayer2Racer,
  getPlayerRacer,
  type RaceWorld,
  stepRaceWorld,
} from './physics';
import {
  createProceduralSkyCubemap,
  createShowroomFloorTexture,
  createSmokePuffTexture,
} from './textures';
import { buildTrackScene, type TrackVisualObjects } from './trackBuilder';
import { sampleTrackAtDistance } from './tracks';
import type {
  CameraMode,
  CarCustomization,
  CarId,
  DriverId,
  GraphicsQuality,
  HudTelemetry,
  InputState,
  PhotoColorGrade,
  PhotoModeSettings,
  PlayerProfile,
  RaceMode,
  StuntPopup,
  TournamentId,
  TrackGhostRecord,
  TrackId,
} from './types';

interface SparkParticle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface SmokeParticle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  baseScale: number;
  rotZ: number;
}

export type ShowroomCameraPreset = 'title' | 'garage' | 'drivers' | 'career' | 'podium';

export interface SceneManagerCallbacks {
  onTelemetry: (telemetry: HudTelemetry) => void;
  onStuntPopups: (popups: StuntPopup[]) => void;
  onRaceFinished: (world: RaceWorld) => void;
}

const EMPTY_INPUT: InputState = {
  throttle: false,
  brake: false,
  left: false,
  right: false,
  drift: false,
  nitro: false,
};

/**
 * Custom GLSL Post-Processing Shader for Cinematic Photo Mode:
 * - Directional / radial speed motion blur (9-tap centered radial velocity streaks)
 * - 4 cinematic color grading presets (Natural, Neon Cyberpunk, Golden Hour, High-Contrast Noir)
 */
const PhotoPostShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uMotionBlur: { value: 0.0 },
    uGradeMode: { value: 0 },
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
    uniform float uMotionBlur;
    uniform int uGradeMode;
    varying vec2 vUv;

    void main() {
      vec2 center = vec2(0.5, 0.48);
      vec2 toEdge = vUv - center;
      float radial = length(toEdge);
      vec3 col = vec3(0.0);

      if (uMotionBlur > 0.005) {
        // Radial + subtle horizontal speed blur keeping focal subject sharp while streaking background
        vec2 blurVec = (toEdge * 0.042 + vec2(0.014, 0.0)) * uMotionBlur * smoothstep(0.08, 0.65, radial);
        float totalW = 0.0;
        for (int i = -4; i <= 4; i++) {
          float fi = float(i);
          float w = 1.0 - abs(fi) * 0.16;
          vec2 sampleUv = clamp(vUv + blurVec * (fi * 0.28), vec2(0.001), vec2(0.999));
          col += texture2D(tDiffuse, sampleUv).rgb * w;
          totalW += w;
        }
        col /= totalW;
      } else {
        col = texture2D(tDiffuse, vUv).rgb;
      }

      // Color Grading Presets
      if (uGradeMode == 1) {
        // Neon Cyberpunk: cool cyan/magenta split tone + punchy saturation
        float luma = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(luma), col, 1.38);
        vec3 shadows = vec3(0.06, 0.16, 0.28);
        vec3 highlights = vec3(1.16, 0.88, 1.18);
        col = mix(col + shadows * (1.0 - luma) * 0.45, col * highlights, smoothstep(0.25, 0.85, luma));
        col = pow(max(col, vec3(0.0)), vec3(0.95));
      } else if (uGradeMode == 2) {
        // Golden Hour: warm sunset amber highlights + rich shadow warmth
        float luma = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(luma), col, 1.2);
        col.r = min(1.0, col.r * 1.16 + 0.045);
        col.g = min(1.0, col.g * 1.04 + 0.018);
        col.b = col.b * 0.82;
        col = pow(max(col, vec3(0.0)), vec3(0.96));
      } else if (uGradeMode == 3) {
        // High-Contrast Noir: dramatic monochrome S-curve + crisp vignette
        float luma = dot(col, vec3(0.26, 0.62, 0.12));
        float contrast = smoothstep(0.07, 0.93, luma);
        col = vec3(contrast) * vec3(0.97, 0.99, 1.04);
      }

      // Subtle cinematic vignette in Photo Mode
      float vig = smoothstep(0.96, 0.36, radial);
      col *= mix(0.76, 1.0, vig);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

function gradeToUniform(grade: PhotoColorGrade): number {
  switch (grade) {
    case 'cyberpunk':
      return 1;
    case 'golden':
      return 2;
    case 'noir':
      return 3;
    default:
      return 0;
  }
}

function detectSoftwareGl(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = dbg
      ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);
  } catch {
    return false;
  }
}

function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        mat.dispose();
      }
    }
  });
}

export class GameSceneManager {
  private container: HTMLElement;
  private callbacks: SceneManagerCallbacks;

  private renderer: THREE.WebGLRenderer;
  private isSoftwareGl: boolean;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private cameraP2: THREE.PerspectiveCamera;
  private pmremGenerator: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private envCubeTex: THREE.CubeTexture | null = null;
  private currentEnvTheme: TrackId | 'showroom' | null = null;

  // Post-processing composer (Bloom + Photo Mode Motion Blur / Color Grading)
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private photoPass: ShaderPass;
  private cssRotated = false;

  private hemiLight: THREE.HemisphereLight;
  private sunLight: THREE.DirectionalLight;
  private showroomSpot: THREE.SpotLight;

  private mode: 'showroom' | 'race' = 'showroom';
  private paused = false;
  private quality: GraphicsQuality = 'high';
  private cameraMode: CameraMode = 'chase';

  // Showroom state
  private showroomGroup = new THREE.Group();
  private showroomCarRig: CarVisualRig | null = null;
  private showroomCarId: CarId | null = null;
  private showroomDriverRig: DriverRig | null = null;
  private showroomOrbitAngle = 0.58;
  private showroomUserOrbitOffset = 0;
  private showroomPreset: ShowroomCameraPreset = 'title';
  private showroomFloorTex: THREE.CanvasTexture | null = null;
  private isDraggingOrbit = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private isPanningPhoto = false;

  // Photo Mode state
  private photoModeSource: 'race' | 'podium' | null = null;
  private photoSettings: PhotoModeSettings = {
    active: false,
    focalLengthMm: 35,
    rollDeg: 0,
    motionBlur: 0,
    colorGrade: 'natural',
    hideUi: false,
  };
  private photoOrbitAzimuth = 0.65;
  private photoOrbitElevation = 0.24;
  private photoOrbitDistance = 6.4;
  private photoPanOffset = new THREE.Vector3(0, 0.8, 0);
  private photoBaseTarget = new THREE.Vector3(0, 0.6, 0);

  // Race state
  private raceGroup = new THREE.Group();
  private trackVisuals: TrackVisualObjects | null = null;
  private raceWorld: RaceWorld | null = null;
  private racerRigs = new Map<string, CarVisualRig>();
  private lastCountdownBeep = 4;
  private raceFinishedDispatched = false;
  private shockwavePulsePhase = 0;

  // Ghost Replay & Recorder
  private ghostRecorder = new GhostLapRecorder();
  private activeGhostRecord: TrackGhostRecord | null = null;
  private ghostRig: THREE.Group | null = null;

  // P2P Multiplayer link
  private p2pManager: OfflineP2PManager | null = null;

  // FX: Skid marks, Sparks & Volumetric Tire Smoke
  private skidMesh: THREE.InstancedMesh | null = null;
  private skidIndex = 0;
  private skidMax = 450;
  private skidCooldown = 0;

  private sparkMesh: THREE.InstancedMesh | null = null;
  private sparks: SparkParticle[] = [];
  private sparkMax = 110;

  private smokeMesh: THREE.InstancedMesh | null = null;
  private smokeTex: THREE.CanvasTexture | null = null;
  private smokes: SmokeParticle[] = [];
  private smokeMax = 140;
  private smokeCooldown = 0;

  // 3D Speed-Streak Particle Field
  private speedLinesPoints: THREE.Points | null = null;
  private speedLinesPositions: Float32Array | null = null;
  private speedLinesCount = 150;

  // Camera smoothing & shake (P1 & P2 Split-Screen)
  private camPosSmooth = new THREE.Vector3(0, 6, 12);
  private camLookSmooth = new THREE.Vector3(0, 1, 0);
  private camP2PosSmooth = new THREE.Vector3(0, 6, 12);
  private camP2LookSmooth = new THREE.Vector3(0, 1, 0);
  private shakeIntensity = 0;

  // Loop & timing
  private disposed = false;
  private rafId = 0;
  private lastFrameTime = 0;
  private lastHudPush = 0;
  private inputState: InputState = { ...EMPTY_INPUT };
  private player2Input: InputState = { ...EMPTY_INPUT };

  private readonly dummyObj = new THREE.Object3D();
  private readonly zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor(container: HTMLElement, callbacks: SceneManagerCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.isSoftwareGl = detectSoftwareGl(this.renderer.getContext());
    const isMobile = this.isMobileViewport();
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && !isMobile;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const initAspect = Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(54, initAspect, 0.2, 900);
    this.cameraP2 = new THREE.PerspectiveCamera(54, initAspect * 2, 0.2, 900);

    // Procedural Cubemap PMREM Environment Reflection Map
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremGenerator.compileCubemapShader();
    this.applyEnvironmentTheme('showroom');

    // EffectComposer with subtle UnrealBloomPass + Photo Mode pass
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloomRes = new THREE.Vector2(
      Math.max(1, container.clientWidth) * (isMobile ? 0.5 : 1),
      Math.max(1, container.clientHeight) * (isMobile ? 0.5 : 1)
    );
    this.bloomPass = new UnrealBloomPass(bloomRes, 0.42, 0.35, 0.85);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
    this.photoPass = new ShaderPass(PhotoPostShader);
    this.photoPass.enabled = false;
    this.composer.addPass(this.photoPass);

    this.hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x0f172a, 1.05);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 2.35);
    this.sunLight.position.set(16, 28, 18);
    this.sunLight.castShadow = !this.isSoftwareGl && !isMobile;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.025;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 110;
    const d = 26;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.showroomSpot = new THREE.SpotLight(0x38bdf8, 48, 42, Math.PI / 4, 0.55, 1.4);
    this.showroomSpot.position.set(-7, 11, 8);
    this.scene.add(this.showroomSpot);

    this.buildShowroomEnvironment();
    this.scene.add(this.showroomGroup);
    this.scene.add(this.raceGroup);
    this.raceGroup.visible = false;

    this.resize();
    window.addEventListener('resize', this.handleResize);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.addEventListener('wheel', this.handleWheel, { passive: false });
    this.renderer.domElement.addEventListener('contextmenu', this.handleContextMenu);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);

    this.lastFrameTime = performance.now();
    this.scheduleNextFrame();
  }

  private isMobileViewport(): boolean {
    return (
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      window.innerWidth < 900
    );
  }

  private applyEnvironmentTheme(theme: TrackId | 'showroom'): void {
    if (this.currentEnvTheme === theme && this.envRT) return;
    this.envRT?.dispose();
    this.envCubeTex?.dispose();
    this.envCubeTex = null;

    if (theme === 'showroom') {
      const roomEnv = new RoomEnvironment();
      const rt = this.pmremGenerator.fromScene(roomEnv, 0.04);
      roomEnv.dispose();
      this.envRT = rt;
      this.scene.environment = rt.texture;
      this.currentEnvTheme = theme;
      return;
    }

    const cubeTex = createProceduralSkyCubemap(theme);
    const rt = this.pmremGenerator.fromCubemap(cubeTex);
    this.envCubeTex = cubeTex;
    this.envRT = rt;
    this.scene.environment = rt.texture;
    this.currentEnvTheme = theme;
  }

  private handleResize = (): void => {
    this.resize();
  };

  private handleContextMenu = (e: MouseEvent): void => {
    if (this.photoSettings.active) {
      e.preventDefault();
    }
  };

  private handlePointerDown = (e: PointerEvent): void => {
    if (this.photoSettings.active) {
      this.isDraggingOrbit = true;
      this.isPanningPhoto = e.button === 2 || e.shiftKey;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      return;
    }
    if (this.mode !== 'showroom') return;
    this.isDraggingOrbit = true;
    this.isPanningPhoto = false;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.isDraggingOrbit) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    if (this.photoSettings.active) {
      if (this.isPanningPhoto) {
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        this.camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());
        const panSpeed = this.photoOrbitDistance * 0.0018;
        this.photoPanOffset.addScaledVector(right, -dx * panSpeed);
        this.photoPanOffset.addScaledVector(up, dy * panSpeed);
        this.photoPanOffset.clampLength(0, 8.5);
      } else {
        this.photoOrbitAzimuth -= dx * 0.008;
        this.photoOrbitElevation = Math.max(
          0.03,
          Math.min(1.32, this.photoOrbitElevation + dy * 0.0065)
        );
      }
      return;
    }

    if (this.mode === 'showroom') {
      const delta = this.cssRotated ? dy : dx;
      this.showroomUserOrbitOffset -= delta * 0.008;
    }
  };

  private handlePointerUp = (): void => {
    this.isDraggingOrbit = false;
    this.isPanningPhoto = false;
  };

  private handleWheel = (e: WheelEvent): void => {
    if (!this.photoSettings.active) return;
    e.preventDefault();
    this.photoOrbitDistance = Math.max(
      3.0,
      Math.min(18.0, this.photoOrbitDistance + e.deltaY * 0.006)
    );
  };

  public setCssRotated(rotated: boolean): void {
    this.cssRotated = rotated;
  }

  public resize(): void {
    const w = Math.max(1, this.container.clientWidth || window.innerWidth);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    const isMobile = this.isMobileViewport();
    const maxDpr = isMobile ? 1.25 : 2;
    const targetDpr = this.isSoftwareGl
      ? 1
      : this.quality === 'high'
        ? Math.min(window.devicePixelRatio || 1, maxDpr)
        : 1;
    this.renderer.setPixelRatio(targetDpr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(targetDpr);
    this.composer.setSize(w, h);
    this.bloomPass.setSize(
      Math.max(1, Math.floor(w * (isMobile ? 0.5 : 1))),
      Math.max(1, Math.floor(h * (isMobile ? 0.5 : 1)))
    );
    this.bloomPass.enabled = !this.isSoftwareGl && this.quality === 'high';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.cameraP2.aspect = w / Math.max(1, h / 2);
    this.cameraP2.updateProjectionMatrix();
  }

  public setQuality(quality: GraphicsQuality): void {
    this.quality = quality;
    const allowShadows = !this.isSoftwareGl && !this.isMobileViewport() && quality === 'high';
    this.renderer.shadowMap.enabled = allowShadows;
    this.sunLight.castShadow = allowShadows;
    this.resize();
  }

  public setInputState(input: InputState): void {
    this.inputState = input;
  }

  public setPlayer2InputState(input: InputState): void {
    this.player2Input = input;
  }

  public setP2PManager(manager: OfflineP2PManager | null): void {
    this.p2pManager = manager;
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      audioEngine.stopEngineLoop();
    } else if (this.mode === 'race' && this.raceWorld && this.raceWorld.phase !== 'finished') {
      audioEngine.startEngineLoop();
    }
  }

  public cycleCameraMode(): CameraMode {
    const order: CameraMode[] = ['chase', 'hood', 'far'];
    const idx = order.indexOf(this.cameraMode);
    this.cameraMode = order[(idx + 1) % order.length];
    return this.cameraMode;
  }

  public getCameraMode(): CameraMode {
    return this.cameraMode;
  }

  public getRaceWorld(): RaceWorld | null {
    return this.raceWorld;
  }

  // ==================== PHOTO MODE API ====================

  public enterPhotoMode(source: 'race' | 'podium', initialSettings: PhotoModeSettings): void {
    this.photoModeSource = source;
    this.photoSettings = { ...initialSettings, active: true };

    if (source === 'race' && this.raceWorld) {
      this.paused = true;
      audioEngine.stopEngineLoop();
      const player = getPlayerRacer(this.raceWorld);
      this.photoBaseTarget.set(player.worldPos.x, player.worldPos.y + 0.35, player.worldPos.z);
      this.photoOrbitAzimuth = player.worldYaw + 0.65;
      this.photoOrbitElevation = 0.25;
      this.photoOrbitDistance = 7.4;
      this.photoPanOffset.set(0, -0.32, 0);
    } else {
      // Podium / Showroom car hero shot
      this.photoBaseTarget.set(0.15, 0.55, 0);
      this.photoOrbitAzimuth = 0.62;
      this.photoOrbitElevation = 0.24;
      this.photoOrbitDistance = 7.4;
      this.photoPanOffset.set(0, -0.32, 0);
    }

    this.photoPass.enabled = true;
    this.photoPass.uniforms.uMotionBlur.value = this.photoSettings.motionBlur;
    this.photoPass.uniforms.uGradeMode.value = gradeToUniform(this.photoSettings.colorGrade);
  }

  public updatePhotoSettings(settings: PhotoModeSettings): void {
    this.photoSettings = { ...settings };
    this.photoPass.uniforms.uMotionBlur.value = settings.motionBlur;
    this.photoPass.uniforms.uGradeMode.value = gradeToUniform(settings.colorGrade);
  }

  public resetPhotoCamera(): void {
    if (this.photoModeSource === 'race' && this.raceWorld) {
      const player = getPlayerRacer(this.raceWorld);
      this.photoBaseTarget.set(player.worldPos.x, player.worldPos.y + 0.35, player.worldPos.z);
      this.photoOrbitAzimuth = player.worldYaw + 0.65;
    } else {
      this.photoBaseTarget.set(0.15, 0.55, 0);
      this.photoOrbitAzimuth = 0.62;
    }
    this.photoOrbitElevation = 0.25;
    this.photoOrbitDistance = 7.4;
    this.photoPanOffset.set(0, -0.32, 0);
  }

  public exitPhotoMode(): void {
    this.photoSettings = { ...this.photoSettings, active: false };
    this.photoPass.enabled = false;
    this.photoModeSource = null;
    this.camera.rotation.z = 0;
  }

  public capturePhotoSnapshot(): string {
    // Force an immediate render directly before reading pixels so PNG is never blank
    if (this.photoSettings.active) {
      this.updatePhotoModeCamera();
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    return this.renderer.domElement.toDataURL('image/png');
  }

  private updatePhotoModeCamera(): void {
    const target = this.photoBaseTarget.clone().add(this.photoPanOffset);
    const cosEl = Math.cos(this.photoOrbitElevation);
    const sinEl = Math.sin(this.photoOrbitElevation);
    this.camera.position.set(
      target.x + Math.sin(this.photoOrbitAzimuth) * cosEl * this.photoOrbitDistance,
      Math.max(0.28, target.y + sinEl * this.photoOrbitDistance),
      target.z + Math.cos(this.photoOrbitAzimuth) * cosEl * this.photoOrbitDistance
    );

    const w = Math.max(1, this.container.clientWidth || window.innerWidth);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    // Standard 35mm full-frame sensor vertical height = 24mm -> FOV = 2 * atan(24 / (2 * focalMm))
    const focalMm = Math.max(20, Math.min(85, this.photoSettings.focalLengthMm));
    const fovDeg = 2 * Math.atan(24 / (2 * focalMm)) * (180 / Math.PI);
    this.camera.fov = fovDeg;
    this.camera.updateProjectionMatrix();

    this.camera.lookAt(target);
    if (Math.abs(this.photoSettings.rollDeg) > 0.01) {
      this.camera.rotateZ((this.photoSettings.rollDeg * Math.PI) / 180);
    }
  }

  // ==================== SHOWROOM ====================

  private buildShowroomEnvironment(): void {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.showroomFloorTex = createShowroomFloorTexture(maxAniso);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(36, 48),
      new THREE.MeshStandardMaterial({
        map: this.showroomFloorTex,
        roughness: 0.26,
        metalness: 0.42,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.showroomGroup.add(floor);

    // Raised brushed-titanium turntable podium
    const podium = new THREE.Mesh(
      new THREE.CylinderGeometry(4.6, 4.95, 0.22, 48),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.78, roughness: 0.2 })
    );
    podium.position.y = 0.11;
    podium.receiveShadow = true;
    this.showroomGroup.add(podium);

    // Dual glowing cyan + magenta turntable accent rings
    const ringOuter = new THREE.Mesh(
      new THREE.TorusGeometry(4.65, 0.055, 10, 64),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    ringOuter.rotation.x = Math.PI / 2;
    ringOuter.position.y = 0.23;
    this.showroomGroup.add(ringOuter);

    const ringInner = new THREE.Mesh(
      new THREE.TorusGeometry(3.4, 0.03, 8, 56),
      new THREE.MeshBasicMaterial({ color: 0xd946ef })
    );
    ringInner.rotation.x = Math.PI / 2;
    ringInner.position.y = 0.225;
    this.showroomGroup.add(ringInner);

    // Overhead racing studio light arches
    const archMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
    for (let i = -1; i <= 1; i++) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.14, 0.55), archMat);
      strip.position.set(0, 7.2, i * 4.4);
      this.showroomGroup.add(strip);
    }

    // Subtle dark architectural backdrop pillars
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0b1120, roughness: 0.72, metalness: 0.3 });
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const col = new THREE.Mesh(new THREE.BoxGeometry(1.4, 12, 1.4), wallMat);
      col.position.set(Math.cos(angle) * 18, 6, Math.sin(angle) * 18);
      col.lookAt(0, 6, 0);
      this.showroomGroup.add(col);
    }
  }

  public showShowroom(
    carId: CarId,
    custom: CarCustomization,
    hasActiveAero: boolean,
    driverId: DriverId,
    preset: ShowroomCameraPreset = 'title'
  ): void {
    this.mode = 'showroom';
    this.showroomPreset = preset;
    this.paused = false;
    if (this.photoSettings.active && this.photoModeSource === 'race') {
      this.exitPhotoMode();
    }
    audioEngine.stopEngineLoop();
    audioEngine.stopMusic();

    this.applyEnvironmentTheme('showroom');
    this.raceGroup.visible = false;
    this.showroomGroup.visible = true;
    this.showroomSpot.visible = true;

    this.scene.background = new THREE.Color(0x070b14);
    this.scene.fog = new THREE.Fog(0x070b14, 16, 48);

    this.hemiLight.color.setHex(0xcbd5e1);
    this.hemiLight.groundColor.setHex(0x0f172a);
    this.hemiLight.intensity = 1.05;

    this.sunLight.color.setHex(0xfff7ed);
    this.sunLight.intensity = 2.55;
    this.sunLight.position.set(9, 14, 11);
    this.sunLight.target.position.set(0, 0.8, 0);
    this.sunLight.target.updateMatrixWorld();

    this.updateShowroomCar(carId, custom, hasActiveAero);
    this.updateShowroomDriver(driverId);
  }

  public updateShowroomCar(carId: CarId, custom: CarCustomization, hasActiveAero: boolean): void {
    if (this.showroomCarId !== carId || !this.showroomCarRig) {
      if (this.showroomCarRig) {
        this.showroomGroup.remove(this.showroomCarRig.root);
        disposeObject3D(this.showroomCarRig.root);
      }
      this.showroomCarRig = buildCarRig(carId, custom, hasActiveAero, {
        useClearcoat: true,
        includeContactShadow: true,
      });
      this.showroomCarRig.root.position.set(0.35, 0.22, 0);
      this.showroomGroup.add(this.showroomCarRig.root);
      this.showroomCarId = carId;
    } else {
      applyCarCustomization(this.showroomCarRig, custom, hasActiveAero);
    }
  }

  public updateShowroomDriver(driverId: DriverId): void {
    const spec = DRIVER_CATALOG[driverId] ?? DRIVER_CATALOG.rookie;
    if (!this.showroomDriverRig) {
      this.showroomDriverRig = buildDriverRig(spec);
      this.showroomDriverRig.root.position.set(-2.05, 0.22, 0.85);
      this.showroomDriverRig.root.rotation.y = 0.38;
      this.showroomGroup.add(this.showroomDriverRig.root);
    } else {
      updateDriverRig(this.showroomDriverRig, spec);
    }
  }

  // ==================== RACE LIFECYCLE & EFFECTS ====================

  private clearRaceGroup(): void {
    if (this.trackVisuals) {
      this.raceGroup.remove(this.trackVisuals.group);
      this.trackVisuals.dispose();
      this.trackVisuals = null;
    }
    for (const rig of this.racerRigs.values()) {
      this.raceGroup.remove(rig.root);
      disposeObject3D(rig.root);
    }
    this.racerRigs.clear();

    if (this.ghostRig) {
      this.raceGroup.remove(this.ghostRig);
      disposeObject3D(this.ghostRig);
      this.ghostRig = null;
    }
    this.activeGhostRecord = null;
    this.ghostRecorder.reset();

    if (this.skidMesh) {
      this.raceGroup.remove(this.skidMesh);
      this.skidMesh.geometry.dispose();
      (this.skidMesh.material as THREE.Material).dispose();
      this.skidMesh = null;
    }
    if (this.sparkMesh) {
      this.raceGroup.remove(this.sparkMesh);
      this.sparkMesh.geometry.dispose();
      (this.sparkMesh.material as THREE.Material).dispose();
      this.sparkMesh = null;
    }
    if (this.smokeMesh) {
      this.raceGroup.remove(this.smokeMesh);
      this.smokeMesh.geometry.dispose();
      (this.smokeMesh.material as THREE.Material).dispose();
      this.smokeMesh = null;
    }
    if (this.smokeTex) {
      this.smokeTex.dispose();
      this.smokeTex = null;
    }
    if (this.speedLinesPoints) {
      this.raceGroup.remove(this.speedLinesPoints);
      this.speedLinesPoints.geometry.dispose();
      (this.speedLinesPoints.material as THREE.Material).dispose();
      this.speedLinesPoints = null;
      this.speedLinesPositions = null;
    }
    this.sparks = [];
    this.smokes = [];
  }

  private initRaceEffects(): void {
    const skidGeo = new THREE.PlaneGeometry(0.42, 0.95);
    skidGeo.rotateX(-Math.PI / 2);
    const skidMat = new THREE.MeshBasicMaterial({
      color: 0x090b10,
      transparent: true,
      opacity: 0.44,
      depthWrite: false,
    });
    this.skidMesh = new THREE.InstancedMesh(skidGeo, skidMat, this.skidMax);
    this.skidMesh.frustumCulled = false;
    for (let i = 0; i < this.skidMax; i++) {
      this.skidMesh.setMatrixAt(i, this.zeroMatrix);
    }
    this.skidMesh.instanceMatrix.needsUpdate = true;
    this.skidIndex = 0;
    this.raceGroup.add(this.skidMesh);

    const sparkGeo = new THREE.BoxGeometry(0.14, 0.14, 0.52);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.sparkMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, this.sparkMax);
    this.sparkMesh.frustumCulled = false;
    for (let i = 0; i < this.sparkMax; i++) {
      this.sparkMesh.setMatrixAt(i, this.zeroMatrix);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    this.raceGroup.add(this.sparkMesh);

    // Volumetric drift tire smoke particles
    this.smokeTex = createSmokePuffTexture();
    const smokeGeo = new THREE.PlaneGeometry(1.15, 1.15);
    const smokeMat = new THREE.MeshBasicMaterial({
      map: this.smokeTex,
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.smokeMesh = new THREE.InstancedMesh(smokeGeo, smokeMat, this.smokeMax);
    this.smokeMesh.frustumCulled = false;
    for (let i = 0; i < this.smokeMax; i++) {
      this.smokeMesh.setMatrixAt(i, this.zeroMatrix);
    }
    this.smokeMesh.instanceMatrix.needsUpdate = true;
    this.raceGroup.add(this.smokeMesh);

    // High-speed 3D speed-streak particle field around the chase camera
    const positions = new Float32Array(this.speedLinesCount * 3);
    for (let i = 0; i < this.speedLinesCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 24;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 14;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 32;
    }
    const speedGeo = new THREE.BufferGeometry();
    speedGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const speedMat = new THREE.PointsMaterial({
      color: 0xe0f2fe,
      size: 0.14,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.speedLinesPositions = positions;
    this.speedLinesPoints = new THREE.Points(speedGeo, speedMat);
    this.speedLinesPoints.frustumCulled = false;
    this.raceGroup.add(this.speedLinesPoints);
  }

  public startRace(opts: {
    mode: RaceMode;
    trackId: TrackId;
    profile: PlayerProfile;
    tournamentId?: TournamentId;
    raceIndex?: number;
    remotePeer?: {
      name: string;
      carId: CarId;
      bodyColor: string;
    };
  }): RaceWorld {
    this.clearRaceGroup();
    if (this.photoSettings.active) {
      this.exitPhotoMode();
    }

    this.mode = 'race';
    this.paused = false;
    this.raceFinishedDispatched = false;
    this.lastCountdownBeep = 4;
    this.shakeIntensity = 0;
    this.shockwavePulsePhase = 0;
    this.p2pManager?.resetRemoteState();

    this.showroomGroup.visible = false;
    this.showroomSpot.visible = false;
    this.raceGroup.visible = true;

    this.applyEnvironmentTheme(opts.trackId);

    const world = createRaceWorld(opts);
    this.raceWorld = world;

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.trackVisuals = buildTrackScene(world.track, this.quality, maxAniso);
    this.raceGroup.add(this.trackVisuals.group);

    this.scene.background = new THREE.Color(this.trackVisuals.skyColor);
    const fogDensity = opts.trackId === 'night' ? 0.0038 : opts.trackId === 'desert' ? 0.0022 : 0.0025;
    this.scene.fog = new THREE.FogExp2(this.trackVisuals.fogColor, fogDensity);
    this.hemiLight.color.setHex(this.trackVisuals.hemiSky);
    this.hemiLight.groundColor.setHex(this.trackVisuals.hemiGround);
    this.hemiLight.intensity = this.trackVisuals.hemiIntensity;

    this.sunLight.color.setHex(this.trackVisuals.sunColor);
    this.sunLight.intensity = this.trackVisuals.sunIntensity;
    this.sunLight.position.copy(this.trackVisuals.sunPosition);

    // Spawn all 3D car rigs (clearcoat in high-spec desktop, standard PBR on mobile for 60 FPS)
    const useClearcoatInRace = !this.isMobileViewport() && this.quality === 'high';
    for (const racer of world.racers) {
      const rig = buildCarRig(
        racer.carId,
        {
          bodyColor: racer.bodyColor,
          finish: racer.finish,
          rimColor: racer.rimColor,
          caliperColor: racer.caliperColor,
          underglowColor: racer.underglowColor,
        },
        racer.hasActiveAero,
        { useClearcoat: useClearcoatInRace, includeContactShadow: true }
      );
      rig.root.position.set(racer.worldPos.x, racer.worldPos.y, racer.worldPos.z);
      rig.root.rotation.y = racer.worldYaw;
      this.raceGroup.add(rig.root);
      this.racerRigs.set(racer.id, rig);
    }

    // Personal Best Ghost Car in Quick Races
    if (opts.mode === 'quick') {
      const ghost = loadTrackGhost(opts.trackId);
      if (ghost) {
        this.activeGhostRecord = ghost;
        this.ghostRig = buildGhostCarRig(ghost.carId);
        this.ghostRig.visible = false;
        this.raceGroup.add(this.ghostRig);
      }
    }

    this.initRaceEffects();

    // Snap cameras behind P1 (and P2 if split-screen)
    const player = getPlayerRacer(world);
    const backX = -Math.sin(player.worldYaw);
    const backZ = -Math.cos(player.worldYaw);
    this.camPosSmooth.set(
      player.worldPos.x + backX * 9.5,
      player.worldPos.y + 4.0,
      player.worldPos.z + backZ * 9.5
    );
    this.camLookSmooth.set(
      player.worldPos.x - backX * 14,
      player.worldPos.y + 1.2,
      player.worldPos.z - backZ * 14
    );

    const p2 = getPlayer2Racer(world);
    if (p2) {
      const b2x = -Math.sin(p2.worldYaw);
      const b2z = -Math.cos(p2.worldYaw);
      this.camP2PosSmooth.set(
        p2.worldPos.x + b2x * 9.5,
        p2.worldPos.y + 4.0,
        p2.worldPos.z + b2z * 9.5
      );
      this.camP2LookSmooth.set(
        p2.worldPos.x - b2x * 14,
        p2.worldPos.y + 1.2,
        p2.worldPos.z - b2z * 14
      );
    }

    const playerCarSpec = CAR_CATALOG[player.carId] ?? CAR_CATALOG.civic_gt;
    audioEngine.setEngineProfile(playerCarSpec.engineType);
    audioEngine.startEngineLoop();
    if (opts.profile.musicEnabled) {
      audioEngine.startMusic();
    }
    this.callbacks.onTelemetry(
      buildHudTelemetry(world, this.cameraMode, this.activeGhostRecord?.lapTime ?? null)
    );
    return world;
  }

  private spawnSparks(pos: { x: number; y: number; z: number }, count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.sparks.length >= this.sparkMax) break;
      this.sparks.push({
        pos: new THREE.Vector3(pos.x, pos.y + 0.45, pos.z),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 19,
          3.5 + Math.random() * 9.0,
          (Math.random() - 0.5) * 19
        ),
        life: 0,
        maxLife: 0.24 + Math.random() * 0.34,
      });
    }
  }

  private spawnTireSmoke(pos: { x: number; y: number; z: number }, yaw: number): void {
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    const backX = -Math.sin(yaw);
    const backZ = -Math.cos(yaw);

    for (const side of [-0.88, 0.88]) {
      if (this.smokes.length >= this.smokeMax) {
        this.smokes.shift();
      }
      this.smokes.push({
        pos: new THREE.Vector3(
          pos.x + rightX * side + backX * 1.48 + (Math.random() - 0.5) * 0.25,
          pos.y + 0.28,
          pos.z + rightZ * side + backZ * 1.48 + (Math.random() - 0.5) * 0.25
        ),
        vel: new THREE.Vector3(
          backX * 2.2 + (Math.random() - 0.5) * 1.8,
          1.4 + Math.random() * 1.3,
          backZ * 2.2 + (Math.random() - 0.5) * 1.8
        ),
        life: 0,
        maxLife: 0.48 + Math.random() * 0.34,
        baseScale: 0.6 + Math.random() * 0.45,
        rotZ: Math.random() * Math.PI * 2,
      });
    }
  }

  private stampSkidMark(pos: { x: number; y: number; z: number }, yaw: number): void {
    if (!this.skidMesh) return;
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    const backX = -Math.sin(yaw);
    const backZ = -Math.cos(yaw);

    for (const side of [-0.88, 0.88]) {
      this.dummyObj.position.set(
        pos.x + rightX * side + backX * 1.32,
        pos.y + 0.065,
        pos.z + rightZ * side + backZ * 1.32
      );
      this.dummyObj.rotation.set(0, yaw, 0);
      this.dummyObj.scale.set(1, 1, 1);
      this.dummyObj.updateMatrix();
      this.skidMesh.setMatrixAt(this.skidIndex, this.dummyObj.matrix);
      this.skidIndex = (this.skidIndex + 1) % this.skidMax;
    }
    this.skidMesh.instanceMatrix.needsUpdate = true;
  }

  private updateSparks(dt: number): void {
    if (!this.sparkMesh) return;
    let alive = 0;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.life += dt;
      if (sp.life >= sp.maxLife) {
        this.sparks.splice(i, 1);
        continue;
      }
      sp.vel.y -= 24 * dt;
      sp.pos.addScaledVector(sp.vel, dt);
      const scale = Math.max(0.1, 1 - sp.life / sp.maxLife);
      this.dummyObj.position.copy(sp.pos);
      this.dummyObj.rotation.set(sp.vel.x * 0.2, sp.vel.y * 0.2, sp.vel.z * 0.2);
      this.dummyObj.scale.set(scale, scale, scale);
      this.dummyObj.updateMatrix();
      this.sparkMesh.setMatrixAt(alive++, this.dummyObj.matrix);
    }
    for (let i = alive; i < this.sparkMax; i++) {
      this.sparkMesh.setMatrixAt(i, this.zeroMatrix);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
  }

  private updateTireSmoke(dt: number): void {
    if (!this.smokeMesh) return;
    let alive = 0;
    const camQuat = this.camera.quaternion;

    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const sm = this.smokes[i];
      sm.life += dt;
      if (sm.life >= sm.maxLife) {
        this.smokes.splice(i, 1);
        continue;
      }
      sm.pos.addScaledVector(sm.vel, dt);
      sm.vel.multiplyScalar(1 - dt * 1.6);
      const t = sm.life / sm.maxLife;
      const grow = sm.baseScale * (0.7 + t * 2.15) * (1 - t * 0.45);
      this.dummyObj.position.copy(sm.pos);
      this.dummyObj.quaternion.copy(camQuat);
      this.dummyObj.rotateZ(sm.rotZ + t * 1.4);
      this.dummyObj.scale.set(grow, grow, grow);
      this.dummyObj.updateMatrix();
      this.smokeMesh.setMatrixAt(alive++, this.dummyObj.matrix);
    }
    for (let i = alive; i < this.smokeMax; i++) {
      this.smokeMesh.setMatrixAt(i, this.zeroMatrix);
    }
    this.smokeMesh.instanceMatrix.needsUpdate = true;
  }

  private updateRain(dt: number, now: number): void {
    const rain = this.trackVisuals?.rainSystem;
    if (rain) {
      const cx = this.camera.position.x;
      const cy = this.camera.position.y;
      const cz = this.camera.position.z;

      for (let i = 0; i < rain.count; i++) {
        const idx = i * 3;
        rain.offsets[idx + 1] -= rain.speeds[i] * dt;
        if (rain.offsets[idx + 1] < -4) {
          rain.offsets[idx + 1] = 24 + Math.random() * 6;
          rain.offsets[idx] = (Math.random() - 0.5) * 70;
          rain.offsets[idx + 2] = (Math.random() - 0.5) * 70;
        }
        this.dummyObj.position.set(
          cx + rain.offsets[idx],
          Math.max(0.5, cy - 6 + rain.offsets[idx + 1]),
          cz + rain.offsets[idx + 2]
        );
        this.dummyObj.rotation.set(0.14, 0, 0.08);
        this.dummyObj.scale.set(1, 1, 1);
        this.dummyObj.updateMatrix();
        rain.mesh.setMatrixAt(i, this.dummyObj.matrix);
      }
      rain.mesh.instanceMatrix.needsUpdate = true;
    }

    // Subtle rain-ripple specular shimmer on Rainy Night City puddles
    const puddles = this.trackVisuals?.puddleMaterials;
    if (puddles && puddles.length > 0) {
      const shimmer = 0.28 + Math.sin(now * 0.0045) * 0.08;
      for (let i = 0; i < puddles.length; i++) {
        puddles[i].emissiveIntensity = shimmer;
      }
    }
  }

  private updateShowroomFrame(dt: number, now: number): void {
    const orbitSpeed = this.showroomPreset === 'drivers' ? 0.08 : 0.22;
    this.showroomOrbitAngle += dt * orbitSpeed;
    const angle = this.showroomOrbitAngle + this.showroomUserOrbitOffset;

    let radius = 7.4;
    let camY = 2.35;
    let lookX = -0.25;
    let lookY = 0.85;
    let lookZ = 0;

    if (this.showroomPreset === 'garage') {
      radius = 7.1;
      camY = 2.15;
      lookX = -1.25;
      lookY = 0.78;
    } else if (this.showroomPreset === 'drivers') {
      radius = 6.2;
      camY = 1.7;
      lookX = -0.35;
      lookY = 1.02;
      lookZ = 0.55;
    } else if (this.showroomPreset === 'podium') {
      radius = 7.0;
      camY = 2.55;
      lookX = -0.35;
      lookY = 0.9;
    }

    const fixedDriversAngle =
      this.showroomPreset === 'drivers'
        ? -0.25 + Math.sin(now * 0.0005) * 0.22 + this.showroomUserOrbitOffset
        : angle;

    this.camera.position.set(
      lookX + Math.sin(fixedDriversAngle) * radius,
      camY,
      lookZ + Math.cos(fixedDriversAngle) * radius
    );
    this.camera.lookAt(lookX, lookY, lookZ);
    this.camera.fov += (46 - this.camera.fov) * Math.min(1, dt * 6);
    this.camera.updateProjectionMatrix();

    if (this.showroomDriverRig) {
      this.showroomDriverRig.upperBody.position.y = 1.02 + Math.sin(now * 0.0028) * 0.014;
      this.showroomDriverRig.headGroup.rotation.y = Math.sin(now * 0.0014) * 0.14;
    }
  }

  private updateGhostVisual(world: RaceWorld): void {
    if (!this.ghostRig || !this.activeGhostRecord) return;
    if (world.phase === 'countdown') {
      this.ghostRig.visible = false;
      return;
    }
    const player = getPlayerRacer(world);
    const frame = sampleGhostFrameAtTime(
      this.activeGhostRecord,
      player.currentLapTime,
      world.track.totalLength
    );
    if (!frame) {
      this.ghostRig.visible = false;
      return;
    }
    const sample = sampleTrackAtDistance(world.track, frame.s);
    this.ghostRig.visible = true;
    this.ghostRig.position.set(
      sample.pos.x + sample.right.x * frame.d,
      sample.pos.y + frame.y,
      sample.pos.z + sample.right.z * frame.d
    );
    this.ghostRig.rotation.set(frame.pitch, frame.yaw, frame.roll, 'YXZ');
  }

  private updateRaceFrame(dt: number, now: number): void {
    const world = this.raceWorld;
    if (!world) return;

    if (!this.paused) {
      const totalStep = Math.min(dt, 0.25);
      const subSteps = Math.max(1, Math.ceil(totalStep / 0.05));
      const subDt = totalStep / subSteps;

      const allPopups: StuntPopup[] = [];
      let takedownSentThisFrame = false;

      for (let sIdx = 0; sIdx < subSteps; sIdx++) {
        const remoteState =
          world.mode === 'p2p' ? this.p2pManager?.getLatestRemoteState() ?? null : null;
        const events = stepRaceWorld(
          world,
          this.inputState,
          subDt,
          world.mode === 'splitscreen' ? this.player2Input : undefined,
          remoteState
        );

        const playerNow = getPlayerRacer(world);
        if (world.mode === 'quick' && world.phase === 'racing') {
          this.ghostRecorder.recordStep(playerNow);
        }

        if (events.playerCompletedLapTime !== null && world.mode === 'quick') {
          const rec = this.ghostRecorder.finishLap(
            world.track.id,
            playerNow.carId,
            playerNow.bodyColor,
            events.playerCompletedLapTime
          );
          if (rec && saveTrackGhost(rec)) {
            this.activeGhostRecord = rec;
            if (!this.ghostRig) {
              this.ghostRig = buildGhostCarRig(rec.carId);
              this.raceGroup.add(this.ghostRig);
            }
            allPopups.push({
              id: world.nextPopupId++,
              label: 'NEW GHOST PB SAVED!',
              cash: 0,
              color: 'cyan',
            });
          }
        }

        if (events.stuntPopups.length > 0) {
          allPopups.push(...events.stuntPopups);
        }

        // Countdown audio ticks
        if (world.phase === 'countdown') {
          const ceilVal = Math.min(3, Math.max(1, Math.ceil(world.countdownTimer)));
          if (ceilVal < this.lastCountdownBeep && ceilVal >= 1) {
            this.lastCountdownBeep = ceilVal;
            audioEngine.playCountdownBeep(false);
          }
        } else if (this.lastCountdownBeep > 0) {
          this.lastCountdownBeep = 0;
          audioEngine.playCountdownBeep(true);
        }

        // Audio, particle & Bluetooth Gamepad Dual-Rumble Haptic cues
        if (events.playerShockwaveStarted) {
          audioEngine.playShockwaveBlast();
          this.shakeIntensity = Math.max(this.shakeIntensity, 0.55);
          gamepadManager.triggerRumble(0.95, 0.75, 280);
        } else if (events.playerNitroStarted) {
          audioEngine.playBoostPad();
          gamepadManager.triggerRumble(0.45, 0.65, 140);
        }
        if (events.playerNitroEnded) audioEngine.playTurboBlowOff();
        if (events.playerBoostTriggered) {
          audioEngine.playBoostPad();
          gamepadManager.triggerRumble(0.35, 0.55, 110);
        }
        if (events.playerRampLaunched) {
          audioEngine.playRampLaunch();
          gamepadManager.triggerRumble(0.4, 0.3, 120);
        }
        if (events.playerLanded) {
          gamepadManager.triggerRumble(0.65, 0.25, 140);
        }
        if (events.playerLapCompleted) audioEngine.playLapChime();
        if (events.playerTakedown) {
          audioEngine.playTakedownCrunch();
          this.shakeIntensity = Math.max(this.shakeIntensity, 0.62);
          gamepadManager.triggerRumble(1.0, 0.85, 320);
          takedownSentThisFrame = true;
        }
        if (events.playerPickupKind === 'coin') {
          audioEngine.playCoinChime();
        } else if (
          events.playerPickupKind === 'nitro_blue' ||
          events.playerPickupKind === 'nitro_gold'
        ) {
          audioEngine.playNitroPickup();
        } else if (events.playerPickupKind === 'shield') {
          audioEngine.playShieldPickup();
        }

        for (const col of events.collisions) {
          this.spawnSparks(
            col.pos,
            col.type === 'takedown' ? 30 : col.type === 'smash' ? 18 : 12
          );
          if (col.involvesPlayer) {
            if (col.type === 'smash') {
              audioEngine.playBarrierSmash();
              this.shakeIntensity = Math.max(this.shakeIntensity, 0.25);
              gamepadManager.triggerRumble(0.5, 0.6, 130);
            } else if (col.type !== 'takedown') {
              audioEngine.playCollision(col.intensity);
              this.shakeIntensity = Math.max(this.shakeIntensity, 0.36 * col.intensity);
              gamepadManager.triggerRumble(
                Math.min(1, 0.4 + col.intensity * 0.5),
                Math.min(1, 0.3 + col.intensity * 0.4),
                160
              );
            }
          }
        }

        if (events.playerFinished && world.phase === 'finished' && !this.raceFinishedDispatched) {
          this.raceFinishedDispatched = true;
          audioEngine.stopEngineLoop();
          audioEngine.stopMusic();
          const player = getPlayerRacer(world);
          audioEngine.playVictoryFanfare(player.place <= 3);
          this.callbacks.onRaceFinished(world);
        }
      }

      if (allPopups.length > 0) {
        this.callbacks.onStuntPopups(allPopups);
      }

      // Emit 60Hz local player state over Serverless WebRTC DataChannel in P2P mode
      if (world.mode === 'p2p' && this.p2pManager) {
        const player = getPlayerRacer(world);
        this.p2pManager.sendState60Hz(
          {
            type: 'state',
            s: player.s,
            d: player.d,
            y: player.yOffset,
            yaw: player.worldYaw,
            speed: player.speed,
            steer: player.steerAngle,
            roll: player.bodyRoll,
            pitch: player.bodyPitch,
            drift: player.isDrifting,
            nitro: player.isNitroActive,
            shockwave: player.isShockwave,
            shield: player.shieldTimer > 0,
            spinout: player.spinoutTimer,
            lap: player.lap,
            totalDistance: player.totalDistance,
            finished: player.finished,
            takedownHit: takedownSentThisFrame,
            ts: now,
          },
          now
        );
      }

      this.skidCooldown -= dt;
      this.smokeCooldown -= dt;
      this.shockwavePulsePhase += dt * 11;

      // Sync all 3D car rigs (articulated suspension, wheel steer/spin, glowing brake rotors, smoke)
      for (const racer of world.racers) {
        const rig = this.racerRigs.get(racer.id);
        if (!rig) continue;

        rig.root.position.set(racer.worldPos.x, racer.worldPos.y, racer.worldPos.z);
        rig.root.rotation.y = racer.worldYaw;
        rig.chassisGroup.position.y = racer.suspensionHeave;
        rig.chassisGroup.rotation.z = racer.bodyRoll;
        rig.chassisGroup.rotation.x = racer.bodyPitch;

        for (const pivot of rig.frontWheelPivots) {
          pivot.rotation.y = -racer.steerAngle;
        }
        for (const wheel of rig.wheelMeshes) {
          wheel.rotation.x = racer.wheelSpin;
        }

        // Glowing orange-red brake rotors under heavy braking
        rig.rotorMaterial.emissiveIntensity = racer.brakeHeat * 4.5;

        const flameActive = racer.isShockwave || racer.isNitroActive || racer.boostTimer > 0;
        if (racer.isShockwave) {
          rig.flameMaterial.color.setHex(0xe879f9);
        } else if (racer.boostTimer > 0) {
          rig.flameMaterial.color.setHex(0xf59e0b);
        } else {
          rig.flameMaterial.color.setHex(0x38bdf8);
        }

        const flameFlicker = 0.8 + Math.sin(now * 0.055 + racer.s) * 0.35;
        const flameStretch = racer.isShockwave ? 2.15 : 1.15;
        for (const flame of rig.flameMeshes) {
          flame.visible = flameActive;
          if (flameActive) {
            flame.scale.set(
              racer.isShockwave ? 1.4 : 1,
              racer.isShockwave ? 1.4 : 1,
              flameStretch * flameFlicker
            );
          }
        }

        // Purple Shockwave pulsing halo ring
        rig.shockwaveRing.visible = racer.isShockwave;
        if (racer.isShockwave) {
          const pulse = this.shockwavePulsePhase % 1;
          const s = 0.8 + pulse * 1.5;
          rig.shockwaveRing.scale.set(s, s, 1);
          rig.shockwaveRingMat.opacity = (1 - pulse) * 0.85;
        }

        // Cyan Energy Shield dome
        rig.shieldShell.visible = racer.shieldTimer > 0;
        if (racer.shieldTimer > 0) {
          rig.shieldShell.rotation.y += dt * 2.2;
        }

        const brakingVisual =
          (racer.isPlayer && this.inputState.brake) ||
          (racer.isPlayer2 && this.player2Input.brake) ||
          racer.brakeHeat > 0.2;
        rig.brakeLightMaterial.emissiveIntensity = brakingVisual ? 4.4 : 1.7;

        if (!racer.isAirborne && racer.isDrifting && racer.speed > 18) {
          if (this.skidCooldown <= 0) {
            this.stampSkidMark(racer.worldPos, racer.worldYaw);
          }
          if (this.smokeCooldown <= 0) {
            this.spawnTireSmoke(racer.worldPos, racer.worldYaw);
          }
        }
      }

      if (this.skidCooldown <= 0) this.skidCooldown = 0.032;
      if (this.smokeCooldown <= 0) this.smokeCooldown = 0.04;

      this.updateGhostVisual(world);

      // Sync 3D Pickups & Smashable Barriers
      if (this.trackVisuals) {
        const pickupMeshes = this.trackVisuals.pickupMeshes;
        for (let i = 0; i < world.pickups.length; i++) {
          const mesh = pickupMeshes[i];
          if (!mesh) continue;
          const p = world.pickups[i];
          mesh.visible = !p.collected;
          if (!p.collected) {
            mesh.rotation.y = now * 0.0032 + i * 0.7;
            mesh.children[0].position.y = Math.sin(now * 0.0045 + i) * 0.22;
          }
        }

        const smashMeshes = this.trackVisuals.smashableMeshes;
        for (let i = 0; i < world.smashables.length; i++) {
          const mesh = smashMeshes[i];
          if (!mesh) continue;
          mesh.visible = !world.smashables[i].smashed;
        }
      }

      this.updateSparks(dt);
      this.updateTireSmoke(dt);
      this.updateRain(dt, now);
    }

    // Update Chase Camera (unless frozen in Photo Mode)
    const player = getPlayerRacer(world);
    if (!this.photoSettings.active) {
      this.updateChaseCameraForRacer(
        player,
        this.camera,
        this.camPosSmooth,
        this.camLookSmooth,
        world,
        dt,
        true
      );

      if (world.mode === 'splitscreen') {
        const p2 = getPlayer2Racer(world);
        if (p2) {
          this.updateChaseCameraForRacer(
            p2,
            this.cameraP2,
            this.camP2PosSmooth,
            this.camP2LookSmooth,
            world,
            dt,
            false
          );
        }
      }
    }

    // Tight directional shadow frustum tracking the player's car
    if (this.trackVisuals) {
      this.sunLight.position.set(
        player.worldPos.x + this.trackVisuals.sunPosition.x * 0.24,
        player.worldPos.y + 38,
        player.worldPos.z + this.trackVisuals.sunPosition.z * 0.24
      );
      this.sunLight.target.position.set(player.worldPos.x, player.worldPos.y, player.worldPos.z);
      this.sunLight.target.updateMatrixWorld();
    }

    // Update engine audio + throttled HUD telemetry (~20 Hz)
    const telemetry = buildHudTelemetry(
      world,
      this.cameraMode,
      this.activeGhostRecord?.lapTime ?? null
    );
    if (!this.paused && world.phase !== 'finished') {
      audioEngine.updateEngine(
        telemetry.rpmRatio,
        telemetry.speedKmh,
        telemetry.isDrifting,
        telemetry.isNitro,
        telemetry.isShockwave
      );
    }
    if (now - this.lastHudPush >= 48 || world.phase !== 'racing') {
      this.lastHudPush = now;
      this.callbacks.onTelemetry(telemetry);
    }
  }

  private updateChaseCameraForRacer(
    racer: ReturnType<typeof getPlayerRacer>,
    cam: THREE.PerspectiveCamera,
    posSmooth: THREE.Vector3,
    lookSmooth: THREE.Vector3,
    world: RaceWorld,
    dt: number,
    isPrimary: boolean
  ): void {
    const fwdX = Math.sin(racer.worldYaw);
    const fwdZ = Math.cos(racer.worldYaw);

    const speedRatio = Math.min(1, Math.max(0, racer.speed / Math.max(1, racer.perf.maxSpeedMps)));
    let shakeX = 0;
    let shakeY = 0;
    if (isPrimary) {
      this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 1.45);
      const highSpeedVibe = speedRatio > 0.78 ? (speedRatio - 0.78) * 0.16 : 0;
      const shockShake = racer.isShockwave ? 0.14 : racer.isNitroActive ? 0.05 : 0;
      const totalShake = this.shakeIntensity + shockShake + highSpeedVibe;
      shakeX = (Math.random() - 0.5) * totalShake;
      shakeY = (Math.random() - 0.5) * totalShake * 0.65;
    }

    let targetFov = 58;

    if (isPrimary && world.phase === 'slowmo_finish') {
      const sweep = (1.55 - world.slowmoTimer) * 1.15;
      const sideX = Math.cos(racer.worldYaw + sweep * 0.6) * 7.6;
      const sideZ = -Math.sin(racer.worldYaw + sweep * 0.6) * 7.6;
      const desiredPos = new THREE.Vector3(
        racer.worldPos.x + sideX,
        racer.worldPos.y + 2.25,
        racer.worldPos.z + sideZ
      );
      const desiredLook = new THREE.Vector3(
        racer.worldPos.x + fwdX * 1.5,
        racer.worldPos.y + 1.0,
        racer.worldPos.z + fwdZ * 1.5
      );
      posSmooth.lerp(desiredPos, Math.min(1, dt * 6));
      lookSmooth.lerp(desiredLook, Math.min(1, dt * 9));
      cam.position.copy(posSmooth);
      cam.lookAt(lookSmooth);
      targetFov = 50;
    } else if (isPrimary && this.cameraMode === 'hood') {
      cam.position.set(
        racer.worldPos.x + fwdX * 0.55 + shakeX * 0.25,
        racer.worldPos.y + 1.38 + shakeY * 0.25,
        racer.worldPos.z + fwdZ * 0.55
      );
      cam.lookAt(
        racer.worldPos.x + fwdX * 36,
        racer.worldPos.y + 1.1,
        racer.worldPos.z + fwdZ * 36
      );
      targetFov = racer.isShockwave
        ? 88
        : 64 + speedRatio * 16 + (racer.isNitroActive ? 5 : 0);
    } else {
      const dist = isPrimary && this.cameraMode === 'far' ? 12.2 : 8.5;
      const height = isPrimary && this.cameraMode === 'far' ? 4.9 : 3.45;
      const shockPull = racer.isShockwave ? 1.5 : racer.isNitroActive ? 0.7 : 0;

      const desiredPos = new THREE.Vector3(
        racer.worldPos.x - fwdX * (dist + shockPull),
        racer.worldPos.y + height + (racer.isAirborne ? 0.8 : 0),
        racer.worldPos.z - fwdZ * (dist + shockPull)
      );
      const desiredLook = new THREE.Vector3(
        racer.worldPos.x + fwdX * 16,
        racer.worldPos.y + 1.25,
        racer.worldPos.z + fwdZ * 16
      );

      posSmooth.lerp(desiredPos, Math.min(1, dt * 11));
      lookSmooth.lerp(desiredLook, Math.min(1, dt * 14));

      cam.position.set(posSmooth.x + shakeX, posSmooth.y + shakeY, posSmooth.z);
      cam.lookAt(lookSmooth);

      const baseFov = isPrimary && this.cameraMode === 'far' ? 60 : 58;
      targetFov = racer.isShockwave
        ? 88
        : baseFov + speedRatio * 22 + (racer.isNitroActive ? 4 : 0);
    }

    cam.fov += (targetFov - cam.fov) * Math.min(1, dt * 6);
    cam.updateProjectionMatrix();

    if (isPrimary && world.phase === 'racing') {
      cam.rotateZ(-racer.steerAngle * 0.065);
    }

    // Update 3D speed-streak particle field rushing past camera at high speed
    if (isPrimary && this.speedLinesPoints && this.speedLinesPositions) {
      const mat = this.speedLinesPoints.material as THREE.PointsMaterial;
      const intensity = Math.max(0, (speedRatio - 0.58) / 0.42) + (racer.isShockwave ? 0.45 : racer.isNitroActive ? 0.25 : 0);
      mat.opacity = Math.min(0.68, intensity * 0.5);
      mat.color.setHex(racer.isShockwave ? 0xf0abfc : 0xe0f2fe);
      this.speedLinesPoints.visible = mat.opacity > 0.03;

      if (this.speedLinesPoints.visible) {
        const posArr = this.speedLinesPositions;
        const rush = Math.max(18, racer.speed * 1.1) * dt;
        for (let i = 0; i < this.speedLinesCount; i++) {
          const idx = i * 3;
          posArr[idx] -= fwdX * rush;
          posArr[idx + 2] -= fwdZ * rush;
          const dx = posArr[idx] - cam.position.x;
          const dy = posArr[idx + 1] - cam.position.y;
          const dz = posArr[idx + 2] - cam.position.z;
          if (dx * dx + dy * dy + dz * dz > 580) {
            posArr[idx] = cam.position.x + fwdX * (16 + Math.random() * 14) + (Math.random() - 0.5) * 18;
            posArr[idx + 1] = cam.position.y + (Math.random() - 0.5) * 9;
            posArr[idx + 2] = cam.position.z + fwdZ * (16 + Math.random() * 14) + (Math.random() - 0.5) * 18;
          }
        }
        this.speedLinesPoints.geometry.attributes.position.needsUpdate = true;
      }
    }
  }

  private renderScene(): void {
    const w = Math.max(1, this.container.clientWidth || window.innerWidth);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);

    if (this.photoSettings.active) {
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, w, h);
      this.updatePhotoModeCamera();
      this.composer.render();
      return;
    }

    if (this.mode === 'race' && this.raceWorld?.mode === 'splitscreen') {
      const halfH = Math.floor(h / 2);
      this.renderer.setScissorTest(true);

      // Top Half: Player 1
      this.camera.aspect = w / Math.max(1, h - halfH);
      this.camera.updateProjectionMatrix();
      this.renderer.setViewport(0, halfH, w, h - halfH);
      this.renderer.setScissor(0, halfH, w, h - halfH);
      this.renderer.render(this.scene, this.camera);

      // Bottom Half: Player 2
      this.cameraP2.aspect = w / Math.max(1, halfH);
      this.cameraP2.updateProjectionMatrix();
      this.renderer.setViewport(0, 0, w, halfH);
      this.renderer.setScissor(0, 0, w, halfH);
      this.renderer.render(this.scene, this.cameraP2);

      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, w, h);
      return;
    }

    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, w, h);
    const fullAspect = w / h;
    if (Math.abs(this.camera.aspect - fullAspect) > 0.002) {
      this.camera.aspect = fullAspect;
      this.camera.updateProjectionMatrix();
    }
    if (this.bloomPass.enabled) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      setTimeout(cb, 16);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) {
      setTimeout(cb, 16);
      return;
    }
    gl.flush();
    const start = performance.now();
    const check = () => {
      if (this.disposed) {
        gl.deleteSync(sync);
        return;
      }
      const status = gl.clientWaitSync(sync, 0, 0);
      if (
        status === gl.ALREADY_SIGNALED ||
        status === gl.CONDITION_SATISFIED ||
        performance.now() - start > 80
      ) {
        gl.deleteSync(sync);
        cb();
      } else {
        setTimeout(check, 4);
      }
    };
    setTimeout(check, 0);
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => {
        if (!this.disposed) {
          this.rafId = requestAnimationFrame(this.tick);
        }
      });
    } else {
      this.rafId = requestAnimationFrame(this.tick);
    }
  }

  private tick = (now: number): void => {
    if (this.disposed) return;
    const rawDt = Math.max(0.001, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    if (!this.photoSettings.active) {
      if (this.mode === 'showroom') {
        this.updateShowroomFrame(Math.min(rawDt, 0.05), now);
      } else {
        this.updateRaceFrame(rawDt, now);
      }
    }

    this.renderScene();
    this.scheduleNextFrame();
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.handleResize);
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.removeEventListener('wheel', this.handleWheel);
    this.renderer.domElement.removeEventListener('contextmenu', this.handleContextMenu);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    audioEngine.stopEngineLoop();
    audioEngine.stopMusic();

    this.clearRaceGroup();
    disposeObject3D(this.showroomGroup);
    this.showroomFloorTex?.dispose();
    this.envRT?.dispose();
    this.envCubeTex?.dispose();
    this.pmremGenerator.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
