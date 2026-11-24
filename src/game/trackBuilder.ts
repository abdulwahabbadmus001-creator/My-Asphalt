import * as THREE from 'three';
import {
  createAsphaltTexture,
  createBoostPadTexture,
  createBuildingFacadeTexture,
  createCheckeredTexture,
  createCurbTexture,
  createGroundTexture,
  createHazardBarrierTexture,
  createPuddleReflectionTexture,
  createRampTexture,
  createWetRoadRoughnessTexture,
} from './textures';
import { createOceanShaderMaterial, createSkyDomeMaterial } from './shaders';
import { sampleTrackAtDistance, type TrackData } from './tracks';
import type { GraphicsQuality, TrackId, WeatherTimeOfDay } from './types';

export interface TrackVisualObjects {
  group: THREE.Group;
  pickupMeshes: THREE.Object3D[];
  smashableMeshes: THREE.Object3D[];
  puddleMaterials: THREE.MeshPhysicalMaterial[];
  oceanMaterial: THREE.ShaderMaterial | null;
  rainSystem: {
    mesh: THREE.InstancedMesh;
    offsets: Float32Array;
    speeds: Float32Array;
    count: number;
  } | null;
  skyColor: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
  sunColor: number;
  sunIntensity: number;
  sunPosition: THREE.Vector3;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  dispose: () => void;
}

function buildRibbonGeometry(
  track: TrackData,
  offsetLeft: number,
  offsetRight: number,
  yOffset: number,
  uvRepeatLength: number
): THREE.BufferGeometry {
  const count = track.samples.length;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= count; i++) {
    const sample = track.samples[i % count];
    const vCoord = ((i / count) * track.totalLength) / uvRepeatLength;

    const lx = sample.pos.x + sample.right.x * offsetLeft;
    const ly = sample.pos.y + yOffset;
    const lz = sample.pos.z + sample.right.z * offsetLeft;

    const rx = sample.pos.x + sample.right.x * offsetRight;
    const ry = sample.pos.y + yOffset;
    const rz = sample.pos.z + sample.right.z * offsetRight;

    positions.push(lx, ly, lz, rx, ry, rz);
    normals.push(0, 1, 0, 0, 1, 0);
    uvs.push(0, vCoord, 1, vCoord);

    if (i < count) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function buildBarrierWallGeometry(
  track: TrackData,
  lateralOffset: number,
  height: number
): THREE.BufferGeometry {
  const count = track.samples.length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= count; i++) {
    const sample = track.samples[i % count];
    const x = sample.pos.x + sample.right.x * lateralOffset;
    const y = sample.pos.y;
    const z = sample.pos.z + sample.right.z * lateralOffset;
    const u = ((i / count) * track.totalLength) / 10;

    positions.push(x, y, z, x, y + height, z);
    uvs.push(u, 0, u, 1);

    if (i < count) {
      const base = i * 2;
      if (lateralOffset > 0) {
        indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      } else {
        indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildRampWedgeGeometry(width: number, length: number, height: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-length * 0.5, 0);
  shape.lineTo(length * 0.5, 0);
  shape.lineTo(length * 0.5, height);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: false,
  });
  geo.translate(0, 0, -width * 0.5);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

export function buildTrackScene(
  track: TrackData,
  quality: GraphicsQuality,
  maxAniso: number,
  weatherTime: WeatherTimeOfDay = 'noon'
): TrackVisualObjects {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const puddleMaterials: THREE.MeshPhysicalMaterial[] = [];
  let oceanMaterial: THREE.ShaderMaterial | null = null;
  const trackId: TrackId = track.id;

  const halfRoad = track.roadWidth * 0.5;
  const curbWidth = 1.6;
  const barrierOffset = halfRoad + curbWidth + 0.35;

  // 1. Ground Terrain Plane
  const groundTex = createGroundTexture(trackId, maxAniso);
  disposables.push(groundTex);
  const groundGeo = new THREE.PlaneGeometry(1850, 1850);
  const groundMat = new THREE.MeshStandardMaterial({
    map: groundTex,
    roughness: trackId === 'night' ? 0.65 : trackId === 'alpine' ? 0.85 : 0.94,
    metalness: trackId === 'night' ? 0.25 : 0.04,
  });
  disposables.push(groundGeo, groundMat);
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.35;
  ground.receiveShadow = true;
  group.add(ground);

  if (trackId === 'coastal') {
    const seaGeo = new THREE.PlaneGeometry(1800, 1800, 48, 48);
    oceanMaterial = createOceanShaderMaterial();
    disposables.push(seaGeo, oceanMaterial);
    const sea = new THREE.Mesh(seaGeo, oceanMaterial);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(520, -0.3, 0);
    group.add(sea);
  }

  // Atmospheric Rayleigh/Mie Sky Dome
  const skyDomeGeo = new THREE.SphereGeometry(540, 24, 16);
  const zenithHex =
    weatherTime === 'storm' ? 0x050816 : weatherTime === 'sunset' ? 0x4c1d95 : trackId === 'night' ? 0x050816 : 0x0284c7;
  const horizonHex =
    weatherTime === 'storm' ? 0x1e1b4b : weatherTime === 'sunset' ? 0xf97316 : trackId === 'desert' ? 0xfdba74 : 0xbae6fd;
  const sunHex = weatherTime === 'storm' ? 0x38bdf8 : 0xfffbeb;
  const skyDomeMat = createSkyDomeMaterial(zenithHex, horizonHex, sunHex);
  disposables.push(skyDomeGeo, skyDomeMat);
  const skyDome = new THREE.Mesh(skyDomeGeo, skyDomeMat);
  group.add(skyDome);

  // 2. Main Road Asphalt Ribbon
  const asphaltTex = createAsphaltTexture(trackId, maxAniso);
  disposables.push(asphaltTex);
  const roadGeo = buildRibbonGeometry(track, -halfRoad, halfRoad, 0.04, 18);
  let roadMat: THREE.Material;
  if (trackId === 'night' || weatherTime === 'storm') {
    const wetRoughTex = createWetRoadRoughnessTexture(maxAniso);
    disposables.push(wetRoughTex);
    roadMat = new THREE.MeshPhysicalMaterial({
      map: asphaltTex,
      roughnessMap: wetRoughTex,
      roughness: 0.24,
      metalness: 0.28,
      clearcoat: 0.85,
      clearcoatRoughness: 0.1,
      envMapIntensity: 0.72,
    });
  } else {
    roadMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      roughness: trackId === 'alpine' ? 0.68 : 0.78,
      metalness: 0.08,
    });
  }
  disposables.push(roadGeo, roadMat);
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // 2b. Procedural Mirror Puddles with Screen-Space-Style Reflection Textures (Rainy Neon Night City)
  if (trackId === 'night') {
    const { map: puddleReflMap, alphaMap: puddleAlpha } = createPuddleReflectionTexture(maxAniso);
    disposables.push(puddleReflMap, puddleAlpha);

    const puddleMat = new THREE.MeshPhysicalMaterial({
      map: puddleReflMap,
      alphaMap: puddleAlpha,
      transparent: true,
      opacity: 0.88,
      roughness: 0.04,
      metalness: 0.88,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      envMapIntensity: 1.45,
      emissiveMap: puddleReflMap,
      emissive: new THREE.Color(0x93c5fd),
      emissiveIntensity: 0.36,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      depthWrite: false,
    });
    disposables.push(puddleMat);
    puddleMaterials.push(puddleMat);

    const puddleCount = quality === 'high' ? 24 : 14;
    for (let i = 0; i < puddleCount; i++) {
      const s = ((i + 0.35) / puddleCount) * track.totalLength;
      const smp = sampleTrackAtDistance(track, s);
      const laneOffset = ((i * 37) % 11 - 5) * 1.15;
      const w = 4.6 + (i % 3) * 1.4;
      const len = 11.5 + (i % 4) * 3.5;

      const pGeo = new THREE.PlaneGeometry(w, len);
      disposables.push(pGeo);
      const puddle = new THREE.Mesh(pGeo, puddleMat);
      puddle.position.set(
        smp.pos.x + smp.right.x * laneOffset,
        smp.pos.y + 0.068,
        smp.pos.z + smp.right.z * laneOffset
      );
      puddle.rotation.order = 'YXZ';
      puddle.rotation.y = Math.atan2(smp.tangent.x, smp.tangent.z);
      puddle.rotation.x = -Math.PI / 2;
      group.add(puddle);
    }
  }

  // 3. Racing Curbs
  const curbTex = createCurbTexture(trackId, maxAniso);
  disposables.push(curbTex);
  const curbMat = new THREE.MeshStandardMaterial({
    map: curbTex,
    roughness: 0.55,
    metalness: 0.1,
    emissive: trackId === 'night' ? new THREE.Color(0x2b1055) : new THREE.Color(0x000000),
    emissiveIntensity: trackId === 'night' ? 0.55 : 0,
  });
  disposables.push(curbMat);

  const leftCurbGeo = buildRibbonGeometry(track, -halfRoad - curbWidth, -halfRoad, 0.07, 6);
  const rightCurbGeo = buildRibbonGeometry(track, halfRoad, halfRoad + curbWidth, 0.07, 6);
  disposables.push(leftCurbGeo, rightCurbGeo);
  group.add(new THREE.Mesh(leftCurbGeo, curbMat));
  group.add(new THREE.Mesh(rightCurbGeo, curbMat));

  // 4. Outer Barriers
  const barrierMat = new THREE.MeshStandardMaterial({
    color:
      trackId === 'night'
        ? 0x1e1b4b
        : trackId === 'desert'
          ? 0x7c2d12
          : trackId === 'alpine'
            ? 0x334155
            : 0xcbd5e1,
    roughness: 0.5,
    metalness: 0.35,
    emissive: trackId === 'night' ? new THREE.Color(0x06b6d4) : new THREE.Color(0x000000),
    emissiveIntensity: trackId === 'night' ? 0.38 : 0,
    side: THREE.DoubleSide,
  });
  disposables.push(barrierMat);

  const leftWallGeo = buildBarrierWallGeometry(track, -barrierOffset, 1.35);
  const rightWallGeo = buildBarrierWallGeometry(track, barrierOffset, 1.35);
  disposables.push(leftWallGeo, rightWallGeo);
  group.add(new THREE.Mesh(leftWallGeo, barrierMat));
  group.add(new THREE.Mesh(rightWallGeo, barrierMat));

  // 5. Start / Finish Gantry & Checkered Line
  const startSample = sampleTrackAtDistance(track, 0);
  const startYaw = Math.atan2(startSample.tangent.x, startSample.tangent.z);
  const gantryGroup = new THREE.Group();
  gantryGroup.position.set(startSample.pos.x, startSample.pos.y, startSample.pos.z);
  gantryGroup.rotation.y = startYaw;

  const checkTex = createCheckeredTexture(maxAniso);
  disposables.push(checkTex);
  const finishLineGeo = new THREE.PlaneGeometry(track.roadWidth, 4.2);
  const finishLineMat = new THREE.MeshBasicMaterial({ map: checkTex });
  disposables.push(finishLineGeo, finishLineMat);
  const finishLine = new THREE.Mesh(finishLineGeo, finishLineMat);
  finishLine.rotation.x = -Math.PI / 2;
  finishLine.position.y = 0.08;
  gantryGroup.add(finishLine);

  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.72, roughness: 0.28 });
  const pillarGeo = new THREE.BoxGeometry(1.1, 8.6, 1.1);
  const bannerGeo = new THREE.BoxGeometry(track.roadWidth + 3.2, 2.2, 1.3);
  const bannerAccentColor =
    trackId === 'night'
      ? 0xd946ef
      : trackId === 'desert'
        ? 0xf59e0b
        : trackId === 'alpine'
          ? 0x38bdf8
          : 0x0ea5e9;
  const bannerMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: bannerAccentColor,
    emissiveIntensity: 0.72,
    roughness: 0.25,
  });
  disposables.push(pillarMat, pillarGeo, bannerGeo, bannerMat);

  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(side * (halfRoad + 1.5), 4.3, 0);
    gantryGroup.add(pillar);
  }
  const banner = new THREE.Mesh(bannerGeo, bannerMat);
  banner.position.set(0, 8.2, 0);
  gantryGroup.add(banner);
  group.add(gantryGroup);

  // 6. Glowing Speed Boost Pads
  const boostTex = createBoostPadTexture(maxAniso);
  const boostMat = new THREE.MeshBasicMaterial({
    map: boostTex,
    transparent: true,
    opacity: 0.94,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  disposables.push(boostTex, boostMat);

  for (const pad of track.boostPads) {
    const smp = sampleTrackAtDistance(track, pad.s);
    const padGeo = new THREE.PlaneGeometry(pad.width, pad.length);
    disposables.push(padGeo);
    const mesh = new THREE.Mesh(padGeo, boostMat);
    mesh.position.set(
      smp.pos.x + smp.right.x * pad.d,
      smp.pos.y + 0.095,
      smp.pos.z + smp.right.z * pad.d
    );
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = Math.atan2(smp.tangent.x, smp.tangent.z);
    mesh.rotation.x = -Math.PI / 2;
    group.add(mesh);
  }

  // 7. 3D Jump Ramps
  const rampTex = createRampTexture(maxAniso);
  const rampDeckMat = new THREE.MeshStandardMaterial({
    map: rampTex,
    roughness: 0.42,
    metalness: 0.3,
    emissive: new THREE.Color(0xf59e0b),
    emissiveIntensity: 0.25,
  });
  const rampBodyMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.55,
    metalness: 0.45,
  });
  disposables.push(rampTex, rampDeckMat, rampBodyMat);

  for (const ramp of track.ramps) {
    const smp = sampleTrackAtDistance(track, ramp.s);
    const rampGroup = new THREE.Group();
    rampGroup.position.set(
      smp.pos.x + smp.right.x * ramp.d,
      smp.pos.y + 0.05,
      smp.pos.z + smp.right.z * ramp.d
    );
    rampGroup.rotation.y = Math.atan2(smp.tangent.x, smp.tangent.z);

    const wedgeGeo = buildRampWedgeGeometry(ramp.width, ramp.length, ramp.height);
    disposables.push(wedgeGeo);
    const wedge = new THREE.Mesh(wedgeGeo, rampBodyMat);
    rampGroup.add(wedge);

    const slopeLen = Math.hypot(ramp.length, ramp.height);
    const slopeAngle = Math.atan2(ramp.height, ramp.length);
    const deckGeo = new THREE.PlaneGeometry(ramp.width - 0.1, slopeLen);
    disposables.push(deckGeo);
    const deck = new THREE.Mesh(deckGeo, rampDeckMat);
    deck.position.set(0, ramp.height * 0.5 + 0.04, 0);
    deck.rotation.x = -Math.PI / 2 - slopeAngle;
    rampGroup.add(deck);

    group.add(rampGroup);
  }

  // 8. 3D Spinning Pickups
  const pickupMeshes: THREE.Object3D[] = [];
  const coinGeo = new THREE.CylinderGeometry(0.95, 0.95, 0.22, 16);
  coinGeo.rotateX(Math.PI / 2);
  const coinMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.72,
    metalness: 0.88,
    roughness: 0.18,
  });

  const nitroBottleGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.45, 12);
  const nitroBlueMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x22d3ee,
    emissiveIntensity: 0.85,
    metalness: 0.55,
    roughness: 0.2,
  });
  const nitroGoldMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xe879f9,
    emissiveIntensity: 0.88,
    metalness: 0.78,
    roughness: 0.18,
  });

  const shieldGeo = new THREE.OctahedronGeometry(0.92, 0);
  const shieldMat = new THREE.MeshStandardMaterial({
    color: 0x34d399,
    emissive: 0x10b981,
    emissiveIntensity: 0.82,
    metalness: 0.4,
    roughness: 0.16,
  });

  disposables.push(
    coinGeo,
    coinMat,
    nitroBottleGeo,
    nitroBlueMat,
    nitroGoldMat,
    shieldGeo,
    shieldMat
  );

  for (const tpl of track.pickupTemplates) {
    const smp = sampleTrackAtDistance(track, tpl.s);
    const holder = new THREE.Group();
    holder.position.set(
      smp.pos.x + smp.right.x * tpl.d,
      smp.pos.y + tpl.yOffset,
      smp.pos.z + smp.right.z * tpl.d
    );

    let mesh: THREE.Mesh;
    if (tpl.kind === 'coin') {
      mesh = new THREE.Mesh(coinGeo, coinMat);
    } else if (tpl.kind === 'nitro_blue') {
      mesh = new THREE.Mesh(nitroBottleGeo, nitroBlueMat);
      mesh.rotation.z = 0.22;
    } else if (tpl.kind === 'nitro_gold') {
      mesh = new THREE.Mesh(nitroBottleGeo, nitroGoldMat);
      mesh.scale.setScalar(1.18);
      mesh.rotation.z = 0.22;
    } else {
      mesh = new THREE.Mesh(shieldGeo, shieldMat);
    }
    holder.add(mesh);
    group.add(holder);
    pickupMeshes.push(holder);
  }

  // 9. 3D Smashable Hazard Barriers
  const smashableMeshes: THREE.Object3D[] = [];
  const hazardTex = createHazardBarrierTexture(maxAniso);
  const hazardMat = new THREE.MeshStandardMaterial({
    map: hazardTex,
    roughness: 0.5,
    metalness: 0.18,
  });
  const hazardGeo = new THREE.BoxGeometry(2.2, 1.05, 0.75);
  disposables.push(hazardTex, hazardMat, hazardGeo);

  for (const tpl of track.smashableTemplates) {
    const mesh = new THREE.Mesh(hazardGeo, hazardMat);
    mesh.position.set(tpl.pos.x, tpl.pos.y + 0.56, tpl.pos.z);
    mesh.rotation.y = tpl.yaw;
    group.add(mesh);
    smashableMeshes.push(mesh);
  }

  // 10. Instanced Environment Scenery
  const propStep = quality === 'high' ? 5 : 8;
  const dummy = new THREE.Object3D();

  if (trackId === 'coastal') {
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 7.5, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x785032, roughness: 0.9 });
    const leafGeo = new THREE.ConeGeometry(2.9, 3.2, 7);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.75 });
    disposables.push(trunkGeo, trunkMat, leafGeo, leafMat);

    const count = Math.ceil(track.samples.length / propStep) * 2;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, count);
    let idx = 0;

    for (let i = 0; i < track.samples.length; i += propStep) {
      const smp = track.samples[i];
      for (const side of [-1, 1]) {
        const dist = barrierOffset + 7 + ((i * 7) % 14);
        const px = smp.pos.x + smp.right.x * side * dist;
        const pz = smp.pos.z + smp.right.z * side * dist;
        const hScale = 0.85 + ((i * 13) % 5) * 0.12;

        dummy.position.set(px, smp.pos.y + 3.6 * hScale, pz);
        dummy.rotation.set(0, i * 0.7, side * 0.08);
        dummy.scale.set(1, hScale, 1);
        dummy.updateMatrix();
        trunks.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(px, smp.pos.y + 7.4 * hScale, pz);
        dummy.scale.set(hScale, hScale, hScale);
        dummy.updateMatrix();
        leaves.setMatrixAt(idx, dummy.matrix);
        idx++;
      }
    }
    trunks.count = idx;
    leaves.count = idx;
    group.add(trunks, leaves);
  } else if (trackId === 'desert') {
    const rockGeo = new THREE.DodecahedronGeometry(6.5, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.92, flatShading: true });
    const mesaGeo = new THREE.CylinderGeometry(8, 12, 22, 7);
    const mesaMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.95, flatShading: true });
    disposables.push(rockGeo, rockMat, mesaGeo, mesaMat);

    const count = Math.ceil(track.samples.length / propStep) * 2;
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, count);
    const mesas = new THREE.InstancedMesh(mesaGeo, mesaMat, Math.ceil(count / 2));
    let rIdx = 0;
    let mIdx = 0;

    for (let i = 0; i < track.samples.length; i += propStep) {
      const smp = track.samples[i];
      for (const side of [-1, 1]) {
        const dist = barrierOffset + 12 + ((i * 11) % 24);
        const px = smp.pos.x + smp.right.x * side * dist;
        const pz = smp.pos.z + smp.right.z * side * dist;

        if (i % (propStep * 2) === 0 && mIdx < mesas.count) {
          const h = 0.8 + ((i * 5) % 4) * 0.4;
          dummy.position.set(px, smp.pos.y + 9 * h, pz);
          dummy.rotation.set(0, i * 0.5, 0);
          dummy.scale.set(1.2, h, 1.2);
          dummy.updateMatrix();
          mesas.setMatrixAt(mIdx++, dummy.matrix);
        } else {
          const s = 0.7 + ((i * 3) % 5) * 0.28;
          dummy.position.set(px, smp.pos.y + 2.5 * s, pz);
          dummy.rotation.set(i * 0.2, i * 0.6, 0);
          dummy.scale.set(s * 1.4, s, s);
          dummy.updateMatrix();
          rocks.setMatrixAt(rIdx++, dummy.matrix);
        }
      }
    }
    rocks.count = rIdx;
    mesas.count = mIdx;
    group.add(rocks, mesas);
  } else if (trackId === 'alpine') {
    const peakGeo = new THREE.ConeGeometry(18, 42, 6);
    const peakMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.9,
      flatShading: true,
    });
    const snowCapGeo = new THREE.ConeGeometry(8.5, 18, 6);
    const snowCapMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.72,
      flatShading: true,
    });
    const pineGeo = new THREE.ConeGeometry(2.4, 8.8, 7);
    const pineMat = new THREE.MeshStandardMaterial({
      color: 0x064e3b,
      roughness: 0.85,
      flatShading: true,
    });
    disposables.push(peakGeo, peakMat, snowCapGeo, snowCapMat, pineGeo, pineMat);

    const count = Math.ceil(track.samples.length / propStep) * 2;
    const pines = new THREE.InstancedMesh(pineGeo, pineMat, count);
    const peaks = new THREE.InstancedMesh(peakGeo, peakMat, Math.ceil(count / 2));
    const snowCaps = new THREE.InstancedMesh(snowCapGeo, snowCapMat, Math.ceil(count / 2));

    let pIdx = 0;
    let mIdx = 0;
    for (let i = 0; i < track.samples.length; i += propStep) {
      const smp = track.samples[i];
      for (const side of [-1, 1]) {
        const pineDist = barrierOffset + 6.5 + ((i * 7) % 12);
        const px = smp.pos.x + smp.right.x * side * pineDist;
        const pz = smp.pos.z + smp.right.z * side * pineDist;
        const pScale = 0.75 + ((i * 11) % 5) * 0.14;
        dummy.position.set(px, smp.pos.y + 4.2 * pScale, pz);
        dummy.rotation.set(0, i * 0.4, 0);
        dummy.scale.set(pScale, pScale, pScale);
        dummy.updateMatrix();
        pines.setMatrixAt(pIdx++, dummy.matrix);

        if (i % (propStep * 2) === 0 && mIdx < peaks.count) {
          const mDist = barrierOffset + 34 + ((i * 13) % 26);
          const mx = smp.pos.x + smp.right.x * side * mDist;
          const mz = smp.pos.z + smp.right.z * side * mDist;
          const mh = 0.9 + ((i * 5) % 4) * 0.35;

          dummy.position.set(mx, smp.pos.y + 18 * mh, mz);
          dummy.rotation.set(0, i * 0.9, 0);
          dummy.scale.set(1.15, mh, 1.15);
          dummy.updateMatrix();
          peaks.setMatrixAt(mIdx, dummy.matrix);

          dummy.position.set(mx, smp.pos.y + 29.8 * mh, mz);
          dummy.scale.set(1.12, mh, 1.12);
          dummy.updateMatrix();
          snowCaps.setMatrixAt(mIdx, dummy.matrix);
          mIdx++;
        }
      }
    }
    pines.count = pIdx;
    peaks.count = mIdx;
    snowCaps.count = mIdx;
    group.add(pines, peaks, snowCaps);
  } else {
    // Rainy Neon Night City skyscrapers + glowing streetlamps
    const bTex = createBuildingFacadeTexture(maxAniso);
    const bGeo = new THREE.BoxGeometry(14, 1, 14);
    const bMat = new THREE.MeshStandardMaterial({
      map: bTex,
      emissiveMap: bTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.82,
      roughness: 0.4,
      metalness: 0.45,
    });
    const lampPoleGeo = new THREE.CylinderGeometry(0.14, 0.18, 7.5, 6);
    const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
    const lampGlowGeo = new THREE.BoxGeometry(1.4, 0.24, 0.5);
    const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    disposables.push(bTex, bGeo, bMat, lampPoleGeo, lampPoleMat, lampGlowGeo, lampGlowMat);

    const bStep = quality === 'high' ? 7 : 11;
    const bCount = Math.ceil(track.samples.length / bStep) * 2;
    const buildings = new THREE.InstancedMesh(bGeo, bMat, bCount);
    let bIdx = 0;

    for (let i = 0; i < track.samples.length; i += bStep) {
      const smp = track.samples[i];
      for (const side of [-1, 1]) {
        const dist = barrierOffset + 15 + ((i * 13) % 18);
        const px = smp.pos.x + smp.right.x * side * dist;
        const pz = smp.pos.z + smp.right.z * side * dist;
        const h = 24 + ((i * 17 + (side > 0 ? 7 : 0)) % 48);

        dummy.position.set(px, smp.pos.y + h * 0.5 - 0.3, pz);
        dummy.rotation.set(0, Math.atan2(smp.tangent.x, smp.tangent.z), 0);
        dummy.scale.set(1 + (i % 3) * 0.25, h, 1 + ((i + 1) % 3) * 0.25);
        dummy.updateMatrix();
        buildings.setMatrixAt(bIdx++, dummy.matrix);
      }
    }
    buildings.count = bIdx;
    group.add(buildings);

    const lampStep = quality === 'high' ? 10 : 16;
    const lCount = Math.ceil(track.samples.length / lampStep) * 2;
    const poles = new THREE.InstancedMesh(lampPoleGeo, lampPoleMat, lCount);
    const bulbs = new THREE.InstancedMesh(lampGlowGeo, lampGlowMat, lCount);
    let lIdx = 0;

    for (let i = 0; i < track.samples.length; i += lampStep) {
      const smp = track.samples[i];
      const yaw = Math.atan2(smp.tangent.x, smp.tangent.z);
      for (const side of [-1, 1]) {
        const dist = barrierOffset + 1.2;
        const px = smp.pos.x + smp.right.x * side * dist;
        const pz = smp.pos.z + smp.right.z * side * dist;

        dummy.position.set(px, smp.pos.y + 3.7, pz);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        poles.setMatrixAt(lIdx, dummy.matrix);

        dummy.position.set(px - smp.right.x * side * 0.9, smp.pos.y + 7.4, pz - smp.right.z * side * 0.9);
        dummy.updateMatrix();
        bulbs.setMatrixAt(lIdx, dummy.matrix);
        lIdx++;
      }
    }
    poles.count = lIdx;
    bulbs.count = lIdx;
    group.add(poles, bulbs);
  }

  // 11. Dynamic Particle-Based Rain Streaks for Rainy Neon Night City
  let rainSystem: TrackVisualObjects['rainSystem'] = null;
  if (trackId === 'night') {
    const rainCount = quality === 'high' ? 580 : 240;
    const dropGeo = new THREE.BoxGeometry(0.032, 1.85, 0.032);
    const dropMat = new THREE.MeshBasicMaterial({
      color: 0xcffafe,
      transparent: true,
      opacity: 0.46,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    disposables.push(dropGeo, dropMat);
    const rainMesh = new THREE.InstancedMesh(dropGeo, dropMat, rainCount);
    rainMesh.frustumCulled = false;

    const offsets = new Float32Array(rainCount * 3);
    const speeds = new Float32Array(rainCount);
    for (let i = 0; i < rainCount; i++) {
      offsets[i * 3] = (Math.random() - 0.5) * 74;
      offsets[i * 3 + 1] = Math.random() * 28;
      offsets[i * 3 + 2] = (Math.random() - 0.5) * 74;
      speeds[i] = 32 + Math.random() * 18;
    }
    group.add(rainMesh);
    rainSystem = { mesh: rainMesh, offsets, speeds, count: rainCount };
  }

  const theme =
    trackId === 'coastal'
      ? {
          skyColor: 0x38bdf8,
          fogColor: 0x7dd3fc,
          fogNear: 120,
          fogFar: 520,
          sunColor: 0xfff7ed,
          sunIntensity: 2.35,
          sunPosition: new THREE.Vector3(140, 200, 90),
          hemiSky: 0xbae6fd,
          hemiGround: 0x365314,
          hemiIntensity: 1.05,
        }
      : trackId === 'desert'
        ? {
            skyColor: 0xf97316,
            fogColor: 0xfdba74,
            fogNear: 110,
            fogFar: 490,
            sunColor: 0xffedd5,
            sunIntensity: 2.5,
            sunPosition: new THREE.Vector3(-180, 95, -120),
            hemiSky: 0xfed7aa,
            hemiGround: 0x7c2d12,
            hemiIntensity: 1.0,
          }
        : trackId === 'alpine'
          ? {
              skyColor: 0x60a5fa,
              fogColor: 0xbfdbfe,
              fogNear: 120,
              fogFar: 540,
              sunColor: 0xf0f9ff,
              sunIntensity: 2.4,
              sunPosition: new THREE.Vector3(110, 185, -130),
              hemiSky: 0xe0f2fe,
              hemiGround: 0x475569,
              hemiIntensity: 1.15,
            }
          : {
              skyColor: 0x050816,
              fogColor: 0x0c112b,
              fogNear: 85,
              fogFar: 420,
              sunColor: 0xc084fc,
              sunIntensity: 1.45,
              sunPosition: new THREE.Vector3(90, 140, 80),
              hemiSky: 0x38bdf8,
              hemiGround: 0x1e1b4b,
              hemiIntensity: 1.05,
            };

  return {
    group,
    pickupMeshes,
    smashableMeshes,
    puddleMaterials,
    oceanMaterial,
    rainSystem,
    ...theme,
    dispose: () => {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
