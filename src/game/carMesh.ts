import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CAR_CATALOG } from './catalog';
import { createLiveryTexture } from './livery';
import { createCarbonFiberTexture, createMetallicFlakeRoughnessMap } from './textures';
import type { CarCustomization, CarId, PaintFinish } from './types';

let sharedGltfLoader: GLTFLoader | null = null;
function getGltfLoader(): GLTFLoader {
  if (!sharedGltfLoader) {
    sharedGltfLoader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    sharedGltfLoader.setDRACOLoader(draco);
  }
  return sharedGltfLoader;
}

export interface CarVisualRig {
  root: THREE.Group;
  chassisGroup: THREE.Group;
  wheelMeshes: THREE.Object3D[];
  frontWheelPivots: THREE.Group[];
  bodyMaterial: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
  rimMaterial: THREE.MeshStandardMaterial;
  caliperMaterial: THREE.MeshStandardMaterial;
  rotorMaterial: THREE.MeshStandardMaterial;
  underglowMesh: THREE.Mesh;
  underglowMaterial: THREE.MeshBasicMaterial;
  activeAeroGroup: THREE.Group;
  flameMeshes: THREE.Mesh[];
  flameMaterial: THREE.MeshBasicMaterial;
  shockwaveRing: THREE.Mesh;
  shockwaveRingMat: THREE.MeshBasicMaterial;
  shieldShell: THREE.Mesh;
  brakeLightMaterial: THREE.MeshStandardMaterial;
}

type GrilleStyle = 'standard' | 'horseshoe' | 'hex_audi' | 'ferrari_f1' | 'vmotion' | 'stealth_hex';
type HeadlightStyle =
  | 'standard'
  | 'c_led'
  | 'round_twin'
  | 'y_led'
  | 'boomerang'
  | 'elliptical'
  | 'angular_drl';
type TaillightStyle = 'lightbar' | 'quad_round' | 'bugatti_x' | 'lambo_y' | 'split_blade';
type WingStyle =
  | 'stock'
  | 'f40_box'
  | 'swan_neck'
  | 'twin_fins'
  | 'active_airbrake'
  | 'wide_hyper'
  | 'wagon_lip';
type ExhaustStyle = 'dual' | 'quad_outer' | 'dual_oval' | 'center_high' | 'quad_center';
type EngineBayType = 'none' | 'v8' | 'v10' | 'v12' | 'w16';

interface SilhouetteProfile {
  bodyWidth: number;
  noseZ: number;
  tailZ: number;
  hoodY: number;
  roofY: number;
  roofStartZ: number;
  roofEndZ: number;
  spoilerHeight: number;
  wheelRadius: number;
  wheelWidth: number;
  frontAxleZ: number;
  rearAxleZ: number;
  grilleStyle?: GrilleStyle;
  headlightStyle?: HeadlightStyle;
  taillightStyle?: TaillightStyle;
  wingStyle?: WingStyle;
  exhaustStyle?: ExhaustStyle;
  engineBay?: EngineBayType;
  isWagon?: boolean;
  isFastback?: boolean;
  hasHoodScoop?: boolean;
  hasRallyPod?: boolean;
  hasWideFenders?: boolean;
  hasFin?: boolean;
  hasSideblades?: boolean;
  hasBugattiCLine?: boolean;
  hasTwoToneRear?: boolean;
  hasRoofSnorkel?: boolean;
  hasRoofRails?: boolean;
  hasNacaDucts?: boolean;
  hasFenderLouvers?: boolean;
  hasActiveAeroFlaps?: boolean;
  hasCarbonHood?: boolean;
  hasDivePlanes?: boolean;
  hasSculptedIntakes?: boolean;
}

const SILHOUETTES: Record<CarId, SilhouetteProfile> = {
  civic_gt: {
    bodyWidth: 1.9,
    noseZ: 2.26,
    tailZ: -2.18,
    hoodY: 0.72,
    roofY: 1.24,
    roofStartZ: 0.56,
    roofEndZ: -1.16,
    spoilerHeight: 0.28,
    wheelRadius: 0.36,
    wheelWidth: 0.27,
    frontAxleZ: 1.38,
    rearAxleZ: -1.35,
  },
  rally_hatch: {
    bodyWidth: 1.94,
    noseZ: 2.08,
    tailZ: -2.02,
    hoodY: 0.78,
    roofY: 1.36,
    roofStartZ: 0.58,
    roofEndZ: -1.62,
    spoilerHeight: 0.24,
    wheelRadius: 0.37,
    wheelWidth: 0.29,
    frontAxleZ: 1.28,
    rearAxleZ: -1.26,
    hasRallyPod: true,
    hasWideFenders: true,
  },
  muscle_v8: {
    bodyWidth: 2.06,
    noseZ: 2.42,
    tailZ: -2.32,
    hoodY: 0.84,
    roofY: 1.27,
    roofStartZ: 0.34,
    roofEndZ: -1.34,
    spoilerHeight: 0.16,
    wheelRadius: 0.39,
    wheelWidth: 0.32,
    frontAxleZ: 1.48,
    rearAxleZ: -1.44,
    hasHoodScoop: true,
    hasWideFenders: true,
    exhaustStyle: 'quad_outer',
  },
  coupe_drift: {
    bodyWidth: 2.08,
    noseZ: 2.34,
    tailZ: -2.24,
    hoodY: 0.7,
    roofY: 1.2,
    roofStartZ: 0.45,
    roofEndZ: -1.22,
    spoilerHeight: 0.38,
    wheelRadius: 0.37,
    wheelWidth: 0.31,
    frontAxleZ: 1.42,
    rearAxleZ: -1.38,
    hasWideFenders: true,
  },
  ingolstadt_rs6: {
    bodyWidth: 2.1,
    noseZ: 2.44,
    tailZ: -2.38,
    hoodY: 0.8,
    roofY: 1.34,
    roofStartZ: 0.58,
    roofEndZ: -1.86,
    spoilerHeight: 0.08,
    wheelRadius: 0.39,
    wheelWidth: 0.32,
    frontAxleZ: 1.48,
    rearAxleZ: -1.46,
    isWagon: true,
    grilleStyle: 'hex_audi',
    headlightStyle: 'angular_drl',
    taillightStyle: 'lightbar',
    wingStyle: 'wagon_lip',
    exhaustStyle: 'dual_oval',
    hasRoofRails: true,
    hasWideFenders: true,
  },
  rally_raid: {
    bodyWidth: 2.04,
    noseZ: 2.22,
    tailZ: -2.14,
    hoodY: 0.8,
    roofY: 1.32,
    roofStartZ: 0.52,
    roofEndZ: -1.32,
    spoilerHeight: 0.38,
    wheelRadius: 0.4,
    wheelWidth: 0.31,
    frontAxleZ: 1.38,
    rearAxleZ: -1.34,
    hasRallyPod: true,
    hasWideFenders: true,
  },
  yokohama_gtr: {
    bodyWidth: 2.08,
    noseZ: 2.38,
    tailZ: -2.28,
    hoodY: 0.78,
    roofY: 1.26,
    roofStartZ: 0.48,
    roofEndZ: -1.24,
    spoilerHeight: 0.36,
    wheelRadius: 0.38,
    wheelWidth: 0.32,
    frontAxleZ: 1.44,
    rearAxleZ: -1.4,
    grilleStyle: 'vmotion',
    headlightStyle: 'angular_drl',
    taillightStyle: 'quad_round',
    wingStyle: 'stock',
    exhaustStyle: 'quad_outer',
    hasCarbonHood: true,
    hasWideFenders: true,
  },
  marinelli_f40: {
    bodyWidth: 2.12,
    noseZ: 2.42,
    tailZ: -2.3,
    hoodY: 0.62,
    roofY: 1.09,
    roofStartZ: 0.58,
    roofEndZ: -0.96,
    spoilerHeight: 0.42,
    wheelRadius: 0.37,
    wheelWidth: 0.33,
    frontAxleZ: 1.44,
    rearAxleZ: -1.42,
    grilleStyle: 'ferrari_f1',
    headlightStyle: 'standard',
    taillightStyle: 'quad_round',
    wingStyle: 'f40_box',
    exhaustStyle: 'quad_outer',
    engineBay: 'v8',
    hasNacaDucts: true,
    hasWideFenders: true,
  },
  stuttgart_gt3rs: {
    bodyWidth: 2.1,
    noseZ: 2.36,
    tailZ: -2.26,
    hoodY: 0.66,
    roofY: 1.18,
    roofStartZ: 0.54,
    roofEndZ: -1.16,
    spoilerHeight: 0.52,
    wheelRadius: 0.38,
    wheelWidth: 0.33,
    frontAxleZ: 1.42,
    rearAxleZ: -1.38,
    isFastback: true,
    grilleStyle: 'standard',
    headlightStyle: 'round_twin',
    taillightStyle: 'lightbar',
    wingStyle: 'swan_neck',
    exhaustStyle: 'center_high',
    hasFenderLouvers: true,
    hasWideFenders: true,
  },
  vorsprung_r8: {
    bodyWidth: 2.12,
    noseZ: 2.36,
    tailZ: -2.28,
    hoodY: 0.64,
    roofY: 1.14,
    roofStartZ: 0.64,
    roofEndZ: -0.96,
    spoilerHeight: 0.24,
    wheelRadius: 0.38,
    wheelWidth: 0.33,
    frontAxleZ: 1.44,
    rearAxleZ: -1.4,
    grilleStyle: 'hex_audi',
    headlightStyle: 'angular_drl',
    taillightStyle: 'split_blade',
    wingStyle: 'stock',
    exhaustStyle: 'dual_oval',
    engineBay: 'v10',
    hasSideblades: true,
    hasWideFenders: true,
  },
  scuderia_sf90: {
    bodyWidth: 2.14,
    noseZ: 2.46,
    tailZ: -2.34,
    hoodY: 0.6,
    roofY: 1.1,
    roofStartZ: 0.72,
    roofEndZ: -0.9,
    spoilerHeight: 0.16,
    wheelRadius: 0.38,
    wheelWidth: 0.34,
    frontAxleZ: 1.48,
    rearAxleZ: -1.44,
    grilleStyle: 'ferrari_f1',
    headlightStyle: 'c_led',
    taillightStyle: 'quad_round',
    wingStyle: 'active_airbrake',
    exhaustStyle: 'center_high',
    engineBay: 'v8',
    hasSculptedIntakes: true,
  },
  santagata_svj: {
    bodyWidth: 2.2,
    noseZ: 2.52,
    tailZ: -2.38,
    hoodY: 0.56,
    roofY: 1.06,
    roofStartZ: 0.76,
    roofEndZ: -0.94,
    spoilerHeight: 0.38,
    wheelRadius: 0.38,
    wheelWidth: 0.36,
    frontAxleZ: 1.5,
    rearAxleZ: -1.48,
    grilleStyle: 'stealth_hex',
    headlightStyle: 'y_led',
    taillightStyle: 'lambo_y',
    wingStyle: 'wide_hyper',
    exhaustStyle: 'center_high',
    engineBay: 'v12',
    hasSculptedIntakes: true,
    hasWideFenders: true,
  },
  woking_p1: {
    bodyWidth: 2.16,
    noseZ: 2.44,
    tailZ: -2.36,
    hoodY: 0.58,
    roofY: 1.09,
    roofStartZ: 0.68,
    roofEndZ: -0.92,
    spoilerHeight: 0.44,
    wheelRadius: 0.38,
    wheelWidth: 0.35,
    frontAxleZ: 1.46,
    rearAxleZ: -1.44,
    grilleStyle: 'standard',
    headlightStyle: 'boomerang',
    taillightStyle: 'split_blade',
    wingStyle: 'wide_hyper',
    exhaustStyle: 'center_high',
    engineBay: 'v8',
    hasSculptedIntakes: true,
    hasDivePlanes: true,
  },
  veloce_larossa: {
    bodyWidth: 2.18,
    noseZ: 2.54,
    tailZ: -2.4,
    hoodY: 0.55,
    roofY: 1.05,
    roofStartZ: 0.72,
    roofEndZ: -0.88,
    spoilerHeight: 0.24,
    wheelRadius: 0.38,
    wheelWidth: 0.35,
    frontAxleZ: 1.5,
    rearAxleZ: -1.46,
    grilleStyle: 'ferrari_f1',
    headlightStyle: 'c_led',
    taillightStyle: 'quad_round',
    wingStyle: 'active_airbrake',
    exhaustStyle: 'quad_outer',
    engineBay: 'v12',
    hasSculptedIntakes: true,
  },
  modena_huayra: {
    bodyWidth: 2.16,
    noseZ: 2.48,
    tailZ: -2.38,
    hoodY: 0.58,
    roofY: 1.08,
    roofStartZ: 0.68,
    roofEndZ: -0.92,
    spoilerHeight: 0.26,
    wheelRadius: 0.38,
    wheelWidth: 0.35,
    frontAxleZ: 1.48,
    rearAxleZ: -1.46,
    grilleStyle: 'standard',
    headlightStyle: 'elliptical',
    taillightStyle: 'quad_round',
    wingStyle: 'active_airbrake',
    exhaustStyle: 'quad_center',
    engineBay: 'v12',
    hasActiveAeroFlaps: true,
    hasSculptedIntakes: true,
  },
  molsheim_chiron: {
    bodyWidth: 2.22,
    noseZ: 2.52,
    tailZ: -2.42,
    hoodY: 0.64,
    roofY: 1.14,
    roofStartZ: 0.66,
    roofEndZ: -0.94,
    spoilerHeight: 0.26,
    wheelRadius: 0.39,
    wheelWidth: 0.36,
    frontAxleZ: 1.52,
    rearAxleZ: -1.48,
    grilleStyle: 'horseshoe',
    headlightStyle: 'angular_drl',
    taillightStyle: 'lightbar',
    wingStyle: 'wide_hyper',
    exhaustStyle: 'quad_outer',
    engineBay: 'w16',
    hasBugattiCLine: true,
    hasTwoToneRear: true,
    hasWideFenders: true,
  },
  angelholm_jesko: {
    bodyWidth: 2.18,
    noseZ: 2.56,
    tailZ: -2.54,
    hoodY: 0.55,
    roofY: 1.07,
    roofStartZ: 0.72,
    roofEndZ: -0.96,
    spoilerHeight: 0.32,
    wheelRadius: 0.39,
    wheelWidth: 0.36,
    frontAxleZ: 1.5,
    rearAxleZ: -1.48,
    grilleStyle: 'stealth_hex',
    headlightStyle: 'angular_drl',
    taillightStyle: 'split_blade',
    wingStyle: 'twin_fins',
    exhaustStyle: 'center_high',
    engineBay: 'v8',
    hasSculptedIntakes: true,
  },
  molsheim_bolide: {
    bodyWidth: 2.24,
    noseZ: 2.6,
    tailZ: -2.46,
    hoodY: 0.5,
    roofY: 0.99,
    roofStartZ: 0.74,
    roofEndZ: -1.04,
    spoilerHeight: 0.48,
    wheelRadius: 0.39,
    wheelWidth: 0.37,
    frontAxleZ: 1.54,
    rearAxleZ: -1.52,
    grilleStyle: 'horseshoe',
    headlightStyle: 'y_led',
    taillightStyle: 'bugatti_x',
    wingStyle: 'wide_hyper',
    exhaustStyle: 'quad_center',
    engineBay: 'w16',
    hasRoofSnorkel: true,
    hasDivePlanes: true,
    hasFin: true,
    hasWideFenders: true,
  },
};

function createSoftGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 128, 12, 64, 128, 118);
  grad.addColorStop(0, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.32)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 256);
  return new THREE.CanvasTexture(c);
}

let cachedGlowTex: THREE.CanvasTexture | null = null;
let cachedContactShadowTex: THREE.CanvasTexture | null = null;

function createContactShadowTexture(): THREE.CanvasTexture {
  if (cachedContactShadowTex) return cachedContactShadowTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 128, 18, 64, 128, 122);
  grad.addColorStop(0, 'rgba(2, 6, 23, 0.78)');
  grad.addColorStop(0.55, 'rgba(2, 6, 23, 0.44)');
  grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 256);
  cachedContactShadowTex = new THREE.CanvasTexture(c);
  return cachedContactShadowTex;
}

function applyFinishToMaterial(
  mat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial,
  finish: PaintFinish,
  flakeMap: THREE.CanvasTexture
): void {
  if (finish === 'matte') {
    mat.metalness = 0.24;
    mat.roughness = 0.62;
    mat.roughnessMap = null;
    if (mat instanceof THREE.MeshPhysicalMaterial) {
      mat.clearcoat = 0.14;
      mat.clearcoatRoughness = 0.48;
      mat.iridescence = 0;
    }
  } else if (finish === 'gloss') {
    mat.metalness = 0.18;
    mat.roughness = 0.08;
    mat.roughnessMap = null;
    if (mat instanceof THREE.MeshPhysicalMaterial) {
      mat.clearcoat = 1.0;
      mat.clearcoatRoughness = 0.04;
      mat.iridescence = 0;
    }
  } else if (finish === 'chameleon') {
    mat.metalness = 0.78;
    mat.roughness = 0.16;
    mat.roughnessMap = flakeMap;
    if (mat instanceof THREE.MeshPhysicalMaterial) {
      mat.clearcoat = 1.0;
      mat.clearcoatRoughness = 0.05;
      mat.iridescence = 1.0;
      mat.iridescenceIOR = 1.45;
    }
  } else {
    mat.metalness = 0.68;
    mat.roughness = 0.24;
    mat.roughnessMap = flakeMap;
    if (mat instanceof THREE.MeshPhysicalMaterial) {
      mat.clearcoat = 1.0;
      mat.clearcoatRoughness = 0.08;
      mat.iridescence = 0;
    }
  }
  mat.needsUpdate = true;
}

function createExtrudedLowerBody(profile: SilhouetteProfile): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(profile.tailZ, 0.24);
  s.lineTo(profile.noseZ - 0.14, 0.24);
  s.lineTo(profile.noseZ, 0.44);
  s.lineTo(profile.noseZ - 0.26, profile.hoodY);
  s.lineTo(profile.roofStartZ + 0.36, profile.hoodY + 0.06);
  s.lineTo(profile.roofEndZ - 0.34, profile.hoodY + (profile.isWagon ? 0.16 : 0.12));
  s.lineTo(profile.tailZ + 0.06, profile.hoodY + (profile.isWagon ? 0.16 : 0.1));
  s.lineTo(profile.tailZ, 0.44);
  s.closePath();

  const extrudeDepth = profile.bodyWidth - 0.2;
  const geom = new THREE.ExtrudeGeometry(s, {
    depth: extrudeDepth,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.06,
    bevelSegments: 2,
  });
  geom.translate(0, 0, -extrudeDepth * 0.5);
  geom.rotateY(-Math.PI / 2);
  geom.computeVertexNormals();
  return geom;
}

function createExtrudedCabinGlass(profile: SilhouetteProfile): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const base = profile.hoodY + 0.02;
  if (profile.isWagon) {
    // Extended RS6 Avant sport wagon greenhouse
    s.moveTo(profile.tailZ + 0.18, base + 0.08);
    s.lineTo(profile.roofStartZ + 0.42, base);
    s.lineTo(profile.roofStartZ, profile.roofY);
    s.lineTo(profile.roofEndZ, profile.roofY - 0.03);
    s.closePath();
  } else if (profile.isFastback) {
    // Iconic 911 GT3 RS sloping rear fastback roofline
    s.moveTo(profile.tailZ + 0.28, base + 0.06);
    s.lineTo(profile.roofStartZ + 0.42, base);
    s.lineTo(profile.roofStartZ, profile.roofY);
    s.lineTo(profile.roofStartZ - 0.55, profile.roofY);
    s.lineTo(profile.roofEndZ - 0.28, profile.roofY - 0.22);
    s.closePath();
  } else {
    s.moveTo(profile.roofEndZ - 0.38, base);
    s.lineTo(profile.roofStartZ + 0.4, base);
    s.lineTo(profile.roofStartZ, profile.roofY);
    s.lineTo(profile.roofEndZ, profile.roofY);
    s.closePath();
  }

  const cabinDepth = profile.bodyWidth * (profile.isWagon ? 0.74 : 0.68);
  const geom = new THREE.ExtrudeGeometry(s, {
    depth: cabinDepth,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  geom.translate(0, 0, -cabinDepth * 0.5);
  geom.rotateY(-Math.PI / 2);
  geom.computeVertexNormals();
  return geom;
}

function buildWheelMesh(
  radius: number,
  width: number,
  rimMaterial: THREE.MeshStandardMaterial,
  caliperMaterial: THREE.MeshStandardMaterial,
  rotorMaterial: THREE.MeshStandardMaterial
): THREE.Group {
  const wheelGroup = new THREE.Group();

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x15171c,
    roughness: 0.88,
    metalness: 0.06,
  });

  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 24);
  tireGeo.rotateZ(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = true;
  wheelGroup.add(tire);

  const rimGeo = new THREE.CylinderGeometry(radius * 0.68, radius * 0.68, width + 0.015, 18);
  rimGeo.rotateZ(Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, rimMaterial);
  wheelGroup.add(rim);

  // Drilled carbon-ceramic Brake Rotor disc that glows bright orange-red under heavy braking!
  const rotorGeo = new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, width + 0.026, 18);
  rotorGeo.rotateZ(Math.PI / 2);
  const rotor = new THREE.Mesh(rotorGeo, rotorMaterial);
  wheelGroup.add(rotor);

  // Painted brake caliper clamping the rotor
  const caliper = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.036, radius * 0.44, radius * 0.26),
    caliperMaterial
  );
  caliper.position.set(0, 0.04, radius * 0.28);
  wheelGroup.add(caliper);

  // 5 Forged motorsport alloy spokes
  const spokeGeo = new THREE.BoxGeometry(width + 0.044, radius * 1.18, 0.05);
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(spokeGeo, rimMaterial);
    spoke.rotation.x = (i / 5) * Math.PI;
    wheelGroup.add(spoke);
  }

  return wheelGroup;
}

/**
 * Adds a visible sculpted V8 / V10 / V12 / W16 engine block under a clear glass rear deck.
 */
function addVisibleEngineBay(
  chassisGroup: THREE.Group,
  profile: SilhouetteProfile,
  engineType: EngineBayType,
  carbonMat: THREE.Material,
  chromeMat: THREE.Material
): void {
  if (engineType === 'none') return;
  const bayZ = (profile.roofEndZ + profile.tailZ) * 0.5 - 0.05;
  const bayY = profile.hoodY + 0.13;
  const bayLen = Math.min(1.05, Math.abs(profile.roofEndZ - profile.tailZ) * 0.72);
  const bayWidth = profile.bodyWidth * 0.44;

  // Recessed engine well
  const well = new THREE.Mesh(new THREE.BoxGeometry(bayWidth, 0.08, bayLen), carbonMat);
  well.position.set(0, bayY - 0.01, bayZ);
  chassisGroup.add(well);

  // Signature cylinder banks / intake plenums
  const bankColor =
    engineType === 'v12'
      ? 0xdc2626 // iconic Rosso Corsa Ferrari/Lambo V12 crinkle-red plenums
      : engineType === 'w16'
        ? 0x38bdf8 // Bugatti W16 anodized blue/silver quad-turbo charge pipes
        : engineType === 'v10'
          ? 0xf59e0b // Audi R8 V10 gold-titanium intake ribs
          : 0x94a3b8;
  const bankMat = new THREE.MeshStandardMaterial({
    color: bankColor,
    metalness: 0.72,
    roughness: 0.24,
  });

  const bankCount = engineType === 'w16' ? 4 : 2;
  const bankOffsets = bankCount === 4 ? [-0.26, -0.09, 0.09, 0.26] : [-0.18, 0.18];
  for (const bx of bankOffsets) {
    const bank = new THREE.Mesh(
      new THREE.BoxGeometry(bankCount === 4 ? 0.1 : 0.18, 0.11, bayLen * 0.82),
      bankMat
    );
    bank.position.set(bx, bayY + 0.04, bayZ);
    chassisGroup.add(bank);
  }

  // Structural X-brace across engine bay
  for (const ang of [0.45, -0.45]) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, bayLen * 0.95), chromeMat);
    brace.position.set(0, bayY + 0.095, bayZ);
    brace.rotation.y = ang;
    chassisGroup.add(brace);
  }

  // Transparent smoked glass engine canopy
  const bayGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    transparent: true,
    opacity: 0.38,
    roughness: 0.05,
    metalness: 0.15,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  });
  const glassDeck = new THREE.Mesh(
    new THREE.BoxGeometry(bayWidth + 0.06, 0.03, bayLen + 0.08),
    bayGlassMat
  );
  glassDeck.position.set(0, bayY + 0.125, bayZ);
  chassisGroup.add(glassDeck);
}

export function buildCarRig(
  carId: CarId,
  custom: CarCustomization,
  hasActiveAero = false,
  options: { useClearcoat?: boolean; includeContactShadow?: boolean; isPolice?: boolean } = {}
): CarVisualRig {
  const { useClearcoat = true, includeContactShadow = true, isPolice = false } = options;
  const profile = SILHOUETTES[carId] ?? SILHOUETTES.civic_gt;
  const spec = CAR_CATALOG[carId] ?? CAR_CATALOG.civic_gt;
  const root = new THREE.Group();
  const chassisGroup = new THREE.Group();
  const rideDrop =
    custom.rideHeight === 'slammed' ? -0.075 : custom.rideHeight === 'lowered' ? -0.04 : 0;
  chassisGroup.position.y = rideDrop;
  root.add(chassisGroup);

  const flakeMap = createMetallicFlakeRoughnessMap(4);
  const liveryMap = custom.livery ? createLiveryTexture(custom.bodyColor, custom.livery) : null;
  const bodyColorHex = isPolice ? '#0f172a' : custom.bodyColor;
  const bodyMaterial = useClearcoat
    ? new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(liveryMap ? '#ffffff' : bodyColorHex),
        map: liveryMap,
        metalness: 0.68,
        roughness: 0.24,
        roughnessMap: flakeMap,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
        reflectivity: 1.0,
      })
    : new THREE.MeshStandardMaterial({
        color: new THREE.Color(liveryMap ? '#ffffff' : bodyColorHex),
        map: liveryMap,
        metalness: 0.68,
        roughness: 0.24,
        roughnessMap: flakeMap,
        envMapIntensity: 1.15,
      });
  applyFinishToMaterial(bodyMaterial, custom.finish, flakeMap);

  if (isPolice) {
    // Police Interceptor Cruiser: alternating red/blue roof lightbar + bull-bar bumper
    const barRed = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.1, 0.22),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    barRed.position.set(-0.24, profile.roofY + 0.1, 0.05);
    chassisGroup.add(barRed);

    const barBlue = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.1, 0.22),
      new THREE.MeshBasicMaterial({ color: 0x3b82f6 })
    );
    barBlue.position.set(0.24, profile.roofY + 0.1, 0.05);
    chassisGroup.add(barBlue);

    const bullBar = new THREE.Mesh(
      new THREE.BoxGeometry(profile.bodyWidth * 0.85, 0.24, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 })
    );
    bullBar.position.set(0, 0.36, profile.noseZ + 0.08);
    chassisGroup.add(bullBar);
  }

  // Non-blocking GLB model check (upgrades procedural mesh if /models/<carId>.glb exists offline)
  if (typeof fetch === 'function' && !isPolice) {
    const glbUrl = `/models/${carId}.glb`;
    fetch(glbUrl, { method: 'HEAD' })
      .then((res) => {
        if (!res.ok) return;
        getGltfLoader().load(
          glbUrl,
          (gltf) => {
            gltf.scene.traverse((child) => {
              const m = child as THREE.Mesh;
              if (m.isMesh && m.material) {
                m.castShadow = true;
              }
            });
            chassisGroup.clear();
            chassisGroup.add(gltf.scene);
          },
          undefined,
          () => {}
        );
      })
      .catch(() => {});
  }

  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: createCarbonFiberTexture(4),
    metalness: 0.42,
    roughness: 0.38,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.96,
    roughness: 0.12,
  });

  const secondaryMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(spec.secondaryColor ?? '#0f172a'),
    metalness: 0.62,
    roughness: 0.26,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
  });

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(custom.rimColor),
    metalness: 0.92,
    roughness: 0.16,
  });

  const caliperMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(custom.caliperColor),
    metalness: 0.45,
    roughness: 0.3,
    emissive: new THREE.Color(custom.caliperColor),
    emissiveIntensity: 0.22,
  });

  // Brake rotor disc material — heats to glowing orange-red when braking!
  const rotorMaterial = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.85,
    roughness: 0.28,
    emissive: new THREE.Color(0xff3b00),
    emissiveIntensity: 0,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x091224,
    metalness: 0.22,
    roughness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    reflectivity: 1.0,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: 0xe0f2fe,
    emissiveIntensity: 3.4,
    roughness: 0.08,
  });

  const ledStripMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 2.6,
    roughness: 0.1,
  });

  const brakeLightMaterial = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 2.0,
    roughness: 0.12,
  });

  // 1. Lower sculpted chassis + upper smoked glass greenhouse + painted roof cap
  const bodyMesh = new THREE.Mesh(createExtrudedLowerBody(profile), bodyMaterial);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  chassisGroup.add(bodyMesh);

  const cabinMesh = new THREE.Mesh(createExtrudedCabinGlass(profile), glassMat);
  cabinMesh.castShadow = true;
  chassisGroup.add(cabinMesh);

  // Sculpted aerodynamic side mirrors
  const mirrorArmGeo = new THREE.BoxGeometry(0.14, 0.045, 0.07);
  const mirrorCapGeo = new THREE.BoxGeometry(0.18, 0.085, 0.14);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(mirrorArmGeo, carbonMat);
    arm.position.set(side * (profile.bodyWidth * 0.46), profile.hoodY + 0.14, profile.roofStartZ + 0.12);
    chassisGroup.add(arm);

    const cap = new THREE.Mesh(mirrorCapGeo, bodyMaterial);
    cap.position.set(side * (profile.bodyWidth * 0.54), profile.hoodY + 0.17, profile.roofStartZ + 0.09);
    cap.rotation.y = side * 0.14;
    chassisGroup.add(cap);
  }

  const roofCapLen = Math.max(
    0.55,
    profile.isFastback ? 0.65 : profile.roofStartZ - profile.roofEndZ
  );
  const roofCapCenterZ = profile.isFastback
    ? profile.roofStartZ - 0.3
    : (profile.roofStartZ + profile.roofEndZ) * 0.5;
  const roofCap = new THREE.Mesh(
    new THREE.BoxGeometry(profile.bodyWidth * (profile.isWagon ? 0.72 : 0.65), 0.06, roofCapLen),
    profile.hasTwoToneRear ? secondaryMat : bodyMaterial
  );
  roofCap.position.set(0, profile.roofY + 0.025, roofCapCenterZ);
  chassisGroup.add(roofCap);

  // Two-tone rear body split (Bugatti Chiron) — sculpted rear wrap flush behind the C-line
  if (profile.hasTwoToneRear) {
    const splitZ = -0.18;
    const rearShape = new THREE.Shape();
    rearShape.moveTo(profile.tailZ + 0.01, 0.25);
    rearShape.lineTo(splitZ, 0.25);
    rearShape.lineTo(splitZ, profile.hoodY + 0.085);
    rearShape.lineTo(profile.roofEndZ - 0.34, profile.hoodY + 0.125);
    rearShape.lineTo(profile.tailZ + 0.07, profile.hoodY + 0.105);
    rearShape.lineTo(profile.tailZ + 0.01, 0.44);
    rearShape.closePath();

    const rearDepth = profile.bodyWidth - 0.184;
    const rearGeo = new THREE.ExtrudeGeometry(rearShape, {
      depth: rearDepth,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.056,
      bevelSegments: 2,
    });
    rearGeo.translate(0, 0, -rearDepth * 0.5);
    rearGeo.rotateY(-Math.PI / 2);
    rearGeo.computeVertexNormals();
    const rearWrap = new THREE.Mesh(rearGeo, secondaryMat);
    rearWrap.castShadow = true;
    rearWrap.receiveShadow = true;
    chassisGroup.add(rearWrap);
  }

  // Exposed carbon-fiber hood (Yokohama GT-R Nismo)
  if (profile.hasCarbonHood) {
    const hoodLen = profile.noseZ - profile.roofStartZ - 0.35;
    const carbonHood = new THREE.Mesh(
      new THREE.BoxGeometry(profile.bodyWidth * 0.66, 0.04, hoodLen),
      carbonMat
    );
    carbonHood.position.set(0, profile.hoodY + 0.07, profile.roofStartZ + hoodLen * 0.5 + 0.22);
    carbonHood.rotation.x = 0.08;
    chassisGroup.add(carbonHood);
  }

  // Widebody fender flares
  if (profile.hasWideFenders) {
    const flareGeo = new THREE.BoxGeometry(0.16, 0.36, 0.88);
    const flareX = profile.bodyWidth * 0.5 + 0.03;
    for (const sx of [-1, 1]) {
      for (const sz of [profile.frontAxleZ, profile.rearAxleZ]) {
        const flare = new THREE.Mesh(
          flareGeo,
          profile.hasTwoToneRear && sz === profile.rearAxleZ ? secondaryMat : bodyMaterial
        );
        flare.position.set(sx * flareX, 0.44, sz);
        chassisGroup.add(flare);
      }
    }
  }

  // Audi RS6 Avant Chrome Roof Rails
  if (profile.hasRoofRails) {
    const railLen = Math.abs(profile.roofStartZ - profile.roofEndZ) * 0.88;
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, railLen), chromeMat);
      rail.position.set(
        side * (profile.bodyWidth * 0.31),
        profile.roofY + 0.075,
        (profile.roofStartZ + profile.roofEndZ) * 0.5
      );
      chassisGroup.add(rail);
    }
  }

  // Audi R8 Contrasting Carbon-Fiber Sideblades behind the doors
  if (profile.hasSideblades) {
    for (const side of [-1, 1]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.54, 0.66), carbonMat);
      blade.position.set(side * (profile.bodyWidth * 0.5 + 0.01), 0.64, -0.45);
      blade.rotation.x = -0.14;
      chassisGroup.add(blade);
    }
  }

  // Bugatti Chiron Iconic Sweeping Chrome Side "C-Line" Arc (hugs door/intake flank below beltline)
  if (profile.hasBugattiCLine) {
    const arcGeo = new THREE.TorusGeometry(0.27, 0.025, 10, 24, Math.PI * 1.02);
    arcGeo.rotateY(Math.PI / 2);
    for (const side of [-1, 1]) {
      const cArc = new THREE.Mesh(arcGeo, chromeMat);
      cArc.position.set(side * (profile.bodyWidth * 0.5 - 0.002), 0.52, -0.02);
      cArc.rotation.x = -Math.PI * 0.5;
      chassisGroup.add(cArc);

      // Subtle dark carbon intake recess nestled inside the chrome C-line
      const intakeInset = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.36, 0.32), carbonMat);
      intakeInset.position.set(side * (profile.bodyWidth * 0.5 - 0.012), 0.51, -0.14);
      chassisGroup.add(intakeInset);
    }
  }

  // Ferrari F40 Side NACA Intake Ducts
  if (profile.hasNacaDucts) {
    for (const side of [-1, 1]) {
      const ductTop = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.62), carbonMat);
      ductTop.position.set(side * (profile.bodyWidth * 0.49), 0.62, -0.4);
      chassisGroup.add(ductTop);
      const ductLow = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.48), carbonMat);
      ductLow.position.set(side * (profile.bodyWidth * 0.5), 0.39, -0.62);
      chassisGroup.add(ductLow);
    }
  }

  // Sculpted Mid-Engine Supercar Side Intakes (SF90, LaRossa, SVJ, P1, Jesko, Huayra)
  if (profile.hasSculptedIntakes) {
    for (const side of [-1, 1]) {
      const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.92), carbonMat);
      scoop.position.set(side * (profile.bodyWidth * 0.48), 0.5, -0.46);
      chassisGroup.add(scoop);
    }
  }

  // Porsche 911 GT3 RS Front Fender Louvers
  if (profile.hasFenderLouvers) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const louver = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.06), carbonMat);
        louver.position.set(
          side * (profile.bodyWidth * 0.36),
          profile.hoodY + 0.045,
          profile.frontAxleZ + 0.18 - i * 0.12
        );
        chassisGroup.add(louver);
      }
    }
  }

  // Pagani Huayra R 4 Active Carbon Aero Flaps (2 front + 2 rear)
  if (profile.hasActiveAeroFlaps) {
    for (const side of [-1, 1]) {
      const frontFlap = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.035, 0.24), carbonMat);
      frontFlap.position.set(side * 0.52, profile.hoodY + 0.04, profile.noseZ - 0.55);
      frontFlap.rotation.x = 0.24;
      chassisGroup.add(frontFlap);

      const rearFlap = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.035, 0.3), carbonMat);
      rearFlap.position.set(side * 0.56, profile.hoodY + 0.18, profile.tailZ + 0.38);
      rearFlap.rotation.x = -0.32;
      chassisGroup.add(rearFlap);
    }
  }

  // Bugatti Bolide Roof Air Snorkel & Front Dive Planes
  if (profile.hasRoofSnorkel) {
    const snorkel = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.78), carbonMat);
    snorkel.position.set(0, profile.roofY + 0.11, (profile.roofStartZ + profile.roofEndZ) * 0.5 - 0.1);
    chassisGroup.add(snorkel);
  }
  if (profile.hasDivePlanes) {
    for (const side of [-1, 1]) {
      const plane = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.42), carbonMat);
      plane.position.set(side * (profile.bodyWidth * 0.52), 0.34, profile.noseZ - 0.34);
      plane.rotation.z = side * 0.3;
      chassisGroup.add(plane);
    }
  }

  // Front splitter & side skirts
  const splitter = new THREE.Mesh(
    new THREE.BoxGeometry(profile.bodyWidth + 0.14, 0.08, 0.46),
    carbonMat
  );
  splitter.position.set(0, 0.22, profile.noseZ - 0.1);
  chassisGroup.add(splitter);

  for (const side of [-1, 1]) {
    const skirt = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.11, profile.noseZ - profile.tailZ - 0.9),
      carbonMat
    );
    skirt.position.set(side * (profile.bodyWidth * 0.5 + 0.02), 0.24, 0);
    chassisGroup.add(skirt);
  }

  // Brand-Specific Front Grille Architecture
  const grilleStyle = profile.grilleStyle ?? 'standard';
  if (grilleStyle === 'horseshoe') {
    // Bugatti Iconic Horseshoe Arch Grille
    const archTrim = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.032, 10, 20, Math.PI),
      chromeMat
    );
    archTrim.position.set(0, 0.34, profile.noseZ + 0.06);
    chassisGroup.add(archTrim);
    const horseInner = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 16), carbonMat);
    horseInner.rotation.x = Math.PI / 2;
    horseInner.position.set(0, 0.36, profile.noseZ + 0.03);
    chassisGroup.add(horseInner);
    for (const side of [-1, 1]) {
      const sideVent = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.16, 0.08), carbonMat);
      sideVent.position.set(side * 0.62, 0.34, profile.noseZ + 0.02);
      chassisGroup.add(sideVent);
    }
  } else if (grilleStyle === 'hex_audi') {
    // Audi Large Singleframe Hexagonal Grille with Metallic Surround
    const hexFrame = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.32, 0.09), chromeMat);
    hexFrame.position.set(0, 0.42, profile.noseZ + 0.04);
    chassisGroup.add(hexFrame);
    const hexCore = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.25, 0.11), carbonMat);
    hexCore.position.set(0, 0.42, profile.noseZ + 0.05);
    chassisGroup.add(hexCore);
  } else if (grilleStyle === 'ferrari_f1') {
    // Ferrari F1-Inspired Twin Front Intakes + Center Splitter Cone
    for (const side of [-1, 1]) {
      const intake = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.17, 0.1), carbonMat);
      intake.position.set(side * 0.56, 0.35, profile.noseZ + 0.04);
      chassisGroup.add(intake);
    }
    const noseCone = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.24), bodyMaterial);
    noseCone.position.set(0, 0.34, profile.noseZ + 0.05);
    chassisGroup.add(noseCone);
  } else if (grilleStyle === 'vmotion') {
    // Nissan GT-R V-Motion Front Grille
    const vGrille = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.32, 0.1), carbonMat);
    vGrille.position.set(0, 0.42, profile.noseZ + 0.04);
    chassisGroup.add(vGrille);
    for (const side of [-1, 1]) {
      const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.32, 0.12), chromeMat);
      vBar.position.set(side * 0.38, 0.43, profile.noseZ + 0.05);
      vBar.rotation.z = side * 0.26;
      chassisGroup.add(vBar);
    }
  } else if (grilleStyle === 'stealth_hex') {
    // Lamborghini / Koenigsegg Angular Stealth Front Intakes
    for (const side of [-1, 1]) {
      const hexVent = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.19, 0.1), carbonMat);
      hexVent.position.set(side * 0.58, 0.33, profile.noseZ + 0.03);
      hexVent.rotation.y = side * -0.14;
      chassisGroup.add(hexVent);
    }
  } else {
    const grille = new THREE.Mesh(
      new THREE.BoxGeometry(profile.bodyWidth * 0.68, 0.18, 0.1),
      carbonMat
    );
    grille.position.set(0, 0.4, profile.noseZ + 0.05);
    chassisGroup.add(grille);
  }

  // Side mirrors
  for (const side of [-1, 1]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.14), bodyMaterial);
    mirror.position.set(
      side * (profile.bodyWidth * 0.46),
      profile.hoodY + 0.2,
      profile.roofStartZ + 0.14
    );
    chassisGroup.add(mirror);
  }

  // Silhouette signature extras
  if (profile.hasHoodScoop) {
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.17, 0.88), carbonMat);
    scoop.position.set(0, profile.hoodY + 0.12, 1.06);
    chassisGroup.add(scoop);
  }
  if (profile.hasRallyPod) {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.15, 0.2), carbonMat);
    pod.position.set(0, profile.hoodY + 0.08, profile.noseZ - 0.15);
    chassisGroup.add(pod);
    for (let i = -1.5; i <= 1.5; i += 1) {
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 12), headlightMat);
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set(i * 0.24, profile.hoodY + 0.08, profile.noseZ - 0.02);
      chassisGroup.add(lamp);
    }
  }
  if (profile.hasFin) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 1.3), carbonMat);
    fin.position.set(0, profile.roofY + 0.04, profile.roofEndZ - 0.32);
    chassisGroup.add(fin);
  }

  // Visible Rear Engine Bay (V8 / V10 / V12 / W16) under clear glass
  addVisibleEngineBay(chassisGroup, profile, profile.engineBay ?? 'none', carbonMat, chromeMat);

  // Brand-Specific Emissive Headlight Signatures
  const headStyle = profile.headlightStyle ?? 'standard';
  for (const side of [-1, 1]) {
    const hx = side * (profile.bodyWidth * 0.32);
    const hy = profile.hoodY - 0.08;
    const hz = profile.noseZ + 0.04;

    if (headStyle === 'round_twin') {
      // Porsche 911 Iconic Round Oval Headlamps
      const roundLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 16), headlightMat);
      roundLamp.rotation.x = Math.PI / 2 - 0.35;
      roundLamp.position.set(hx, hy + 0.04, hz - 0.06);
      chassisGroup.add(roundLamp);
    } else if (headStyle === 'elliptical') {
      // Pagani Huayra Twin Elliptical Headlights
      for (const offset of [-0.08, 0.08]) {
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), headlightMat);
        orb.scale.set(1.2, 0.75, 0.7);
        orb.position.set(hx + offset * side, hy + 0.02, hz - 0.04);
        chassisGroup.add(orb);
      }
    } else if (headStyle === 'c_led') {
      // Ferrari SF90 / LaRossa C-Shaped LED Signature
      const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.045, 0.1), headlightMat);
      topBar.position.set(hx, hy + 0.04, hz);
      chassisGroup.add(topBar);
      const sideBar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.1), ledStripMat);
      sideBar.position.set(hx + side * 0.21, hy - 0.02, hz);
      chassisGroup.add(sideBar);
      const lowBar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.1), ledStripMat);
      lowBar.position.set(hx + side * 0.07, hy - 0.07, hz);
      chassisGroup.add(lowBar);
    } else if (headStyle === 'y_led') {
      // Lamborghini SVJ / Bolide Glowing Y-Shaped LEDs
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.045, 0.1), headlightMat);
      stem.position.set(hx - side * 0.08, hy - 0.02, hz);
      chassisGroup.add(stem);
      const forkUp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.1), ledStripMat);
      forkUp.position.set(hx + side * 0.12, hy + 0.03, hz);
      forkUp.rotation.z = side * 0.45;
      chassisGroup.add(forkUp);
      const forkDn = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.1), ledStripMat);
      forkDn.position.set(hx + side * 0.12, hy - 0.06, hz);
      forkDn.rotation.z = -side * 0.45;
      chassisGroup.add(forkDn);
    } else if (headStyle === 'boomerang') {
      // McLaren P1 Glowing Boomerang LEDs
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.1), headlightMat);
      b1.position.set(hx, hy, hz);
      b1.rotation.z = -side * 0.35;
      chassisGroup.add(b1);
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.045, 0.1), ledStripMat);
      b2.position.set(hx + side * 0.14, hy - 0.09, hz);
      b2.rotation.z = side * 0.62;
      chassisGroup.add(b2);
    } else if (headStyle === 'angular_drl') {
      // Audi / Bugatti / GT-R Razor Angular LED Strip
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.085, 0.12), headlightMat);
      lamp.position.set(hx, hy - 0.01, hz);
      lamp.rotation.z = -side * 0.08;
      chassisGroup.add(lamp);
      const drl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.032, 0.13), ledStripMat);
      drl.position.set(hx, hy - 0.075, hz + 0.01);
      chassisGroup.add(drl);
    } else {
      const headWidth = spec.carClass === 'S' || spec.carClass === 'HYPER' ? 0.56 : 0.42;
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(headWidth, 0.11, 0.12), headlightMat);
      lamp.position.set(hx, hy - 0.03, hz + 0.01);
      chassisGroup.add(lamp);
      const drl = new THREE.Mesh(new THREE.BoxGeometry(headWidth * 0.85, 0.035, 0.13), ledStripMat);
      drl.position.set(hx, hy - 0.1, hz + 0.015);
      chassisGroup.add(drl);
    }
  }

  // Brand-Specific Rear Emissive Taillight Signatures
  const tailStyle = profile.taillightStyle ?? 'lightbar';
  const tailY = profile.hoodY - 0.01;
  const tailZPos = profile.tailZ - 0.06;

  if (tailStyle === 'quad_round') {
    // Iconic Quad Round Afterburner Ring Taillights (GT-R Nismo, Ferrari F40, SF90, LaRossa, Huayra)
    for (const side of [-1, 1]) {
      for (const offset of [0.22, 0.36]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.028, 10, 18), brakeLightMaterial);
        ring.position.set(side * (profile.bodyWidth * offset), tailY, tailZPos);
        chassisGroup.add(ring);
      }
    }
  } else if (tailStyle === 'bugatti_x') {
    // Bugatti Bolide Unmistakable Giant Red X-Shaped Rear LEDs
    for (const ang of [0.58, -0.58]) {
      const xBar = new THREE.Mesh(new THREE.BoxGeometry(profile.bodyWidth * 0.72, 0.065, 0.1), brakeLightMaterial);
      xBar.position.set(0, tailY + 0.04, tailZPos);
      xBar.rotation.z = ang;
      chassisGroup.add(xBar);
    }
  } else if (tailStyle === 'lambo_y') {
    // Lamborghini Aventador SVJ Y-Shaped Rear LEDs
    for (const side of [-1, 1]) {
      const lx = side * (profile.bodyWidth * 0.3);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.055, 0.1), brakeLightMaterial);
      bar.position.set(lx, tailY, tailZPos);
      chassisGroup.add(bar);
      for (const tilt of [0.48, -0.48]) {
        const prong = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.045, 0.1), brakeLightMaterial);
        prong.position.set(lx - side * 0.18, tailY + tilt * 0.08, tailZPos);
        prong.rotation.z = side * tilt;
        chassisGroup.add(prong);
      }
    }
  } else if (tailStyle === 'split_blade') {
    // McLaren P1 / R8 / Jesko Split Blade LEDs
    for (const side of [-1, 1]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(profile.bodyWidth * 0.34, 0.07, 0.1), brakeLightMaterial);
      blade.position.set(side * (profile.bodyWidth * 0.28), tailY, tailZPos);
      chassisGroup.add(blade);
    }
  } else {
    const tailBar = new THREE.Mesh(
      new THREE.BoxGeometry(profile.bodyWidth * 0.88, 0.11, 0.11),
      brakeLightMaterial
    );
    tailBar.position.set(0, tailY, tailZPos);
    chassisGroup.add(tailBar);
  }

  // Brand-Specific Stock Rear Wing / Aerodynamic Tail
  const wingStyle = profile.wingStyle ?? 'stock';
  if (wingStyle === 'f40_box') {
    // Iconic Ferrari F40 Tall Body-Colored Integrated Box Wing
    const f40Y = profile.hoodY + profile.spoilerHeight;
    const f40Deck = new THREE.Mesh(
      new THREE.BoxGeometry(profile.bodyWidth * 0.98, 0.075, 0.34),
      bodyMaterial
    );
    f40Deck.position.set(0, f40Y, profile.tailZ + 0.14);
    chassisGroup.add(f40Deck);
    for (const side of [-1, 1]) {
      const sideWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, profile.spoilerHeight + 0.14, 0.42),
        bodyMaterial
      );
      sideWall.position.set(
        side * (profile.bodyWidth * 0.46),
        profile.hoodY + profile.spoilerHeight * 0.5,
        profile.tailZ + 0.16
      );
      chassisGroup.add(sideWall);
    }
  } else if (wingStyle === 'swan_neck') {
    // Porsche 911 GT3 RS Massive Tall Swan-Neck GT Wing
    const swanY = profile.hoodY + profile.spoilerHeight;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(profile.bodyWidth * 1.08, 0.06, 0.38), carbonMat);
    blade.position.set(0, swanY, profile.tailZ + 0.04);
    blade.rotation.x = 0.08;
    chassisGroup.add(blade);
    for (const side of [-1, 1]) {
      // Top-mounted swan-neck uprights hooking over the wing
      const strut = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, profile.spoilerHeight + 0.12, 0.2),
        carbonMat
      );
      strut.position.set(side * 0.44, profile.hoodY + profile.spoilerHeight * 0.54, profile.tailZ + 0.24);
      strut.rotation.x = -0.22;
      chassisGroup.add(strut);
      const hook = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.26), carbonMat);
      hook.position.set(side * 0.44, swanY + 0.05, profile.tailZ + 0.12);
      chassisGroup.add(hook);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.26, 0.44), bodyMaterial);
      plate.position.set(side * (profile.bodyWidth * 0.54), swanY, profile.tailZ + 0.04);
      chassisGroup.add(plate);
    }
  } else if (wingStyle === 'twin_fins') {
    // Koenigsegg Jesko Absolut Twin Vertical Rear Stabilizer Fins (no giant horizontal wing)
    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.96), carbonMat);
      fin.position.set(side * (profile.bodyWidth * 0.34), profile.hoodY + 0.26, profile.tailZ + 0.46);
      fin.rotation.x = 0.14;
      chassisGroup.add(fin);
    }
  } else if (wingStyle === 'active_airbrake') {
    // Ferrari LaRossa / SF90 / Huayra Sleek Deployed Hydraulic Airbrake Spoiler
    const airBlade = new THREE.Mesh(
      new THREE.BoxGeometry(profile.bodyWidth * 0.74, 0.05, 0.32),
      bodyMaterial
    );
    airBlade.position.set(0, profile.hoodY + profile.spoilerHeight + 0.04, profile.tailZ + 0.16);
    airBlade.rotation.x = -0.22;
    chassisGroup.add(airBlade);
    for (const side of [-1, 1]) {
      const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8), chromeMat);
      piston.position.set(side * 0.42, profile.hoodY + 0.14, profile.tailZ + 0.2);
      chassisGroup.add(piston);
    }
  } else if (wingStyle === 'wide_hyper') {
    // Hypercar Wide Sculpted Rear Wing (Chiron, Bolide, SVJ, P1 GTR)
    const wy = profile.hoodY + profile.spoilerHeight;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(profile.bodyWidth * 1.04, 0.06, 0.36), carbonMat);
    blade.position.set(0, wy, profile.tailZ + 0.08);
    blade.rotation.x = 0.08;
    chassisGroup.add(blade);
    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, profile.spoilerHeight + 0.08, 0.22),
        carbonMat
      );
      strut.position.set(side * (profile.bodyWidth * 0.3), profile.hoodY + profile.spoilerHeight * 0.5, profile.tailZ + 0.14);
      chassisGroup.add(strut);
      const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.42), bodyMaterial);
      endplate.position.set(side * (profile.bodyWidth * 0.52), wy + 0.01, profile.tailZ + 0.08);
      chassisGroup.add(endplate);
    }
  } else if (wingStyle === 'wagon_lip') {
    // Audi RS6 Avant Roofline Tailgate Spoiler Lip
    const lip = new THREE.Mesh(new THREE.BoxGeometry(profile.bodyWidth * 0.72, 0.05, 0.24), carbonMat);
    lip.position.set(0, profile.roofY - 0.02, profile.roofEndZ - 0.08);
    chassisGroup.add(lip);
  } else {
    const stockBlade = new THREE.Mesh(
      new THREE.BoxGeometry(profile.bodyWidth * 0.96, 0.055, 0.28),
      carbonMat
    );
    stockBlade.position.set(0, profile.hoodY + profile.spoilerHeight, profile.tailZ + 0.15);
    chassisGroup.add(stockBlade);

    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, profile.spoilerHeight + 0.06, 0.2),
        carbonMat
      );
      strut.position.set(
        side * (profile.bodyWidth * 0.34),
        profile.hoodY + profile.spoilerHeight * 0.5,
        profile.tailZ + 0.18
      );
      chassisGroup.add(strut);
    }
  }

  // ACTIVE AERO WING & DIFFUSER KIT (when player equips Active Aero Car Tool)
  const activeAeroGroup = new THREE.Group();
  const gtWingY = profile.hoodY + Math.max(profile.spoilerHeight + 0.24, 0.54);

  for (const side of [-1, 1]) {
    const riser = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.58, 0.26), carbonMat);
    riser.position.set(side * 0.52, profile.hoodY + 0.28, profile.tailZ + 0.04);
    riser.rotation.x = -0.18;
    activeAeroGroup.add(riser);
  }
  const mainWing = new THREE.Mesh(
    new THREE.BoxGeometry(profile.bodyWidth + 0.32, 0.06, 0.42),
    carbonMat
  );
  mainWing.position.set(0, gtWingY, profile.tailZ - 0.02);
  mainWing.rotation.x = 0.09;
  activeAeroGroup.add(mainWing);

  for (const side of [-1, 1]) {
    const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.52), bodyMaterial);
    endplate.position.set(side * (profile.bodyWidth * 0.5 + 0.16), gtWingY + 0.02, profile.tailZ - 0.02);
    activeAeroGroup.add(endplate);
  }
  const diffuser = new THREE.Mesh(
    new THREE.BoxGeometry(profile.bodyWidth * 0.92, 0.2, 0.34),
    carbonMat
  );
  diffuser.position.set(0, 0.25, profile.tailZ - 0.12);
  activeAeroGroup.add(diffuser);
  for (let i = -2; i <= 2; i++) {
    const vane = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.38), caliperMaterial);
    vane.position.set(i * 0.3, 0.24, profile.tailZ - 0.14);
    activeAeroGroup.add(vane);
  }
  for (const side of [-1, 1]) {
    const canard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.34), carbonMat);
    canard.position.set(side * (profile.bodyWidth * 0.52), 0.36, profile.noseZ - 0.32);
    canard.rotation.z = side * 0.25;
    activeAeroGroup.add(canard);
  }
  activeAeroGroup.visible = hasActiveAero;
  chassisGroup.add(activeAeroGroup);

  // Brand-Specific Exhaust Pipes & Nitro / Shockwave Flames
  const flameMaterial = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flameMeshes: THREE.Mesh[] = [];
  const exhaustStyle = profile.exhaustStyle ?? 'dual';

  const exhaustCoords: { x: number; y: number; radius: number; oval?: boolean }[] =
    exhaustStyle === 'quad_center'
      ? [
          { x: -0.1, y: 0.48, radius: 0.065 },
          { x: 0.1, y: 0.48, radius: 0.065 },
          { x: -0.1, y: 0.35, radius: 0.065 },
          { x: 0.1, y: 0.35, radius: 0.065 },
        ]
      : exhaustStyle === 'center_high'
        ? [
            { x: -0.15, y: 0.45, radius: 0.085 },
            { x: 0.15, y: 0.45, radius: 0.085 },
          ]
        : exhaustStyle === 'quad_outer'
          ? [
              { x: -0.62, y: 0.29, radius: 0.068 },
              { x: -0.44, y: 0.29, radius: 0.068 },
              { x: 0.44, y: 0.29, radius: 0.068 },
              { x: 0.62, y: 0.29, radius: 0.068 },
            ]
          : exhaustStyle === 'dual_oval'
            ? [
                { x: -0.56, y: 0.3, radius: 0.095, oval: true },
                { x: 0.56, y: 0.3, radius: 0.095, oval: true },
              ]
            : [
                { x: -0.46, y: 0.29, radius: 0.08 },
                { x: 0.46, y: 0.29, radius: 0.08 },
              ];

  for (const ex of exhaustCoords) {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(ex.radius, ex.radius, 0.22, 12),
      rimMaterial
    );
    pipe.rotation.x = Math.PI / 2;
    if (ex.oval) pipe.scale.set(1.45, 1, 0.8);
    pipe.position.set(ex.x, ex.y, profile.tailZ - 0.08);
    chassisGroup.add(pipe);
  }

  // Attach 2 bright flame cones aligned to exhaust layout
  const flameAnchorCoords =
    exhaustStyle === 'quad_center' || exhaustStyle === 'center_high'
      ? [
          { x: -0.12, y: 0.43 },
          { x: 0.12, y: 0.43 },
        ]
      : [
          { x: -0.52, y: 0.29 },
          { x: 0.52, y: 0.29 },
        ];
  for (const fa of flameAnchorCoords) {
    const flameGeo = new THREE.ConeGeometry(0.15, 1.35, 10);
    flameGeo.rotateX(-Math.PI / 2);
    flameGeo.translate(0, 0, -0.65);
    const flame = new THREE.Mesh(flameGeo, flameMaterial);
    flame.position.set(fa.x, fa.y, profile.tailZ - 0.14);
    flame.visible = false;
    chassisGroup.add(flame);
    flameMeshes.push(flame);
  }

  // Purple Shockwave Halo Ring
  const shockwaveRingMat = new THREE.MeshBasicMaterial({
    color: 0xe879f9,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const shockwaveRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.45, 0.08, 12, 32),
    shockwaveRingMat
  );
  shockwaveRing.position.set(0, 0.75, profile.tailZ - 0.4);
  shockwaveRing.visible = false;
  chassisGroup.add(shockwaveRing);

  // Translucent Cyan Energy Shield Shell
  const shieldShell = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 22, 16),
    new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  shieldShell.scale.set(0.62, 0.46, 1.15);
  shieldShell.position.set(0, 0.72, 0);
  shieldShell.visible = false;
  chassisGroup.add(shieldShell);

  // Soft radial Neon Underglow plane
  if (!cachedGlowTex) {
    cachedGlowTex = createSoftGlowTexture();
  }
  const underglowMaterial = new THREE.MeshBasicMaterial({
    map: cachedGlowTex,
    color: new THREE.Color(custom.underglowColor === 'none' ? '#06b6d4' : custom.underglowColor),
    transparent: true,
    opacity: custom.underglowColor === 'none' ? 0 : 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const underglowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(profile.bodyWidth * 1.45, (profile.noseZ - profile.tailZ) * 1.16),
    underglowMaterial
  );
  underglowMesh.rotation.x = -Math.PI / 2;
  underglowMesh.position.y = 0.04;
  underglowMesh.visible = custom.underglowColor !== 'none';
  root.add(underglowMesh);

  if (includeContactShadow) {
    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: createContactShadowTexture(),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const contactShadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(profile.bodyWidth * 1.38, (profile.noseZ - profile.tailZ) * 1.14),
      contactShadowMat
    );
    contactShadowMesh.rotation.x = -Math.PI / 2;
    contactShadowMesh.position.y = 0.025;
    root.add(contactShadowMesh);
  }

  // 4 Articulated Wheels (Front Steerable Pivots + Rear, each with glowing brake rotor)
  const wheelMeshes: THREE.Object3D[] = [];
  const frontWheelPivots: THREE.Group[] = [];
  const trackHalf = profile.bodyWidth * 0.5 + 0.02;

  const wheelPositions: { x: number; z: number; isFront: boolean }[] = [
    { x: -trackHalf, z: profile.frontAxleZ, isFront: true },
    { x: trackHalf, z: profile.frontAxleZ, isFront: true },
    { x: -trackHalf, z: profile.rearAxleZ, isFront: false },
    { x: trackHalf, z: profile.rearAxleZ, isFront: false },
  ];

  for (const wp of wheelPositions) {
    const wMesh = buildWheelMesh(
      profile.wheelRadius,
      profile.wheelWidth,
      rimMaterial,
      caliperMaterial,
      rotorMaterial
    );
    if (wp.isFront) {
      const pivot = new THREE.Group();
      pivot.position.set(wp.x, profile.wheelRadius, wp.z);
      pivot.add(wMesh);
      root.add(pivot);
      frontWheelPivots.push(pivot);
      wheelMeshes.push(wMesh);
    } else {
      wMesh.position.set(wp.x, profile.wheelRadius, wp.z);
      root.add(wMesh);
      wheelMeshes.push(wMesh);
    }
  }

  return {
    root,
    chassisGroup,
    wheelMeshes,
    frontWheelPivots,
    bodyMaterial,
    rimMaterial,
    caliperMaterial,
    rotorMaterial,
    underglowMesh,
    underglowMaterial,
    activeAeroGroup,
    flameMeshes,
    flameMaterial,
    shockwaveRing,
    shockwaveRingMat,
    shieldShell,
    brakeLightMaterial,
  };
}

/**
 * Translucent holographic Personal Best Ghost Car shell for Quick Races.
 */
export function buildGhostCarRig(carId: CarId): THREE.Group {
  const profile = SILHOUETTES[carId] ?? SILHOUETTES.civic_gt;
  const group = new THREE.Group();

  const holoMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.34,
    roughness: 0.15,
    metalness: 0.2,
    depthWrite: false,
  });

  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x67e8f9,
    wireframe: true,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  });

  const lowerGeo = createExtrudedLowerBody(profile);
  const cabinGeo = createExtrudedCabinGlass(profile);

  group.add(new THREE.Mesh(lowerGeo, holoMat));
  group.add(new THREE.Mesh(lowerGeo, wireMat));
  group.add(new THREE.Mesh(cabinGeo, holoMat));

  const wheelGeo = new THREE.CylinderGeometry(
    profile.wheelRadius,
    profile.wheelRadius,
    profile.wheelWidth,
    14
  );
  wheelGeo.rotateZ(Math.PI / 2);
  const half = profile.bodyWidth * 0.5 + 0.02;
  for (const [x, z] of [
    [-half, profile.frontAxleZ],
    [half, profile.frontAxleZ],
    [-half, profile.rearAxleZ],
    [half, profile.rearAxleZ],
  ]) {
    const w = new THREE.Mesh(wheelGeo, holoMat);
    w.position.set(x, profile.wheelRadius, z);
    group.add(w);
  }

  return group;
}

export function applyCarCustomization(
  rig: CarVisualRig,
  custom: CarCustomization,
  hasActiveAero?: boolean
): void {
  const flakeMap = createMetallicFlakeRoughnessMap(4);
  rig.bodyMaterial.color.set(custom.bodyColor);
  applyFinishToMaterial(rig.bodyMaterial, custom.finish, flakeMap);
  rig.rimMaterial.color.set(custom.rimColor);
  rig.caliperMaterial.color.set(custom.caliperColor);
  rig.caliperMaterial.emissive.set(custom.caliperColor);

  if (custom.underglowColor === 'none') {
    rig.underglowMesh.visible = false;
    rig.underglowMaterial.opacity = 0;
  } else {
    rig.underglowMesh.visible = true;
    rig.underglowMaterial.color.set(custom.underglowColor);
    rig.underglowMaterial.opacity = 0.78;
  }

  if (typeof hasActiveAero === 'boolean') {
    rig.activeAeroGroup.visible = hasActiveAero;
  }
  const rideDrop =
    custom.rideHeight === 'slammed' ? -0.075 : custom.rideHeight === 'lowered' ? -0.04 : 0;
  rig.chassisGroup.position.y = rideDrop;
}
