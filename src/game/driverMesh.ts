import * as THREE from 'three';
import type { DriverSpec } from './types';

export interface DriverRig {
  root: THREE.Group;
  upperBody: THREE.Group;
  headGroup: THREE.Group;
  suitPrimaryMat: THREE.MeshStandardMaterial;
  suitSecondaryMat: THREE.MeshStandardMaterial;
  helmetMat: THREE.MeshPhysicalMaterial;
  visorMat: THREE.MeshPhysicalMaterial;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0,0,0,0.65)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

let cachedContactTex: THREE.CanvasTexture | null = null;

export function buildDriverRig(driver: DriverSpec): DriverRig {
  const root = new THREE.Group();

  const suitPrimaryMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(driver.suitPrimary),
    roughness: 0.62,
    metalness: 0.14,
  });

  const suitSecondaryMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(driver.suitSecondary),
    roughness: 0.45,
    metalness: 0.28,
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.72,
    metalness: 0.18,
  });

  const helmetMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(driver.helmetColor),
    roughness: 0.16,
    metalness: 0.35,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });

  const visorMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(driver.visorColor),
    roughness: 0.06,
    metalness: 0.75,
    clearcoat: 1.0,
    emissive: new THREE.Color(driver.visorColor),
    emissiveIntensity: 0.18,
  });

  // Ground contact shadow disc
  if (!cachedContactTex) {
    cachedContactTex = createContactShadowTexture();
  }
  const shadowDisc = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 1.15),
    new THREE.MeshBasicMaterial({
      map: cachedContactTex,
      transparent: true,
      depthWrite: false,
    })
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.015;
  root.add(shadowDisc);

  // Racing Boots (left & right, heroic athletic stance)
  const bootGeo = new THREE.BoxGeometry(0.15, 0.12, 0.3);
  for (const side of [-1, 1]) {
    const boot = new THREE.Mesh(bootGeo, darkTrimMat);
    boot.position.set(side * 0.16, 0.06, 0.04);
    boot.rotation.y = side * -0.14;
    boot.castShadow = true;
    root.add(boot);

    // Lower leg (shin + calf)
    const lowerLeg = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.068, 0.32, 6, 12),
      suitPrimaryMat
    );
    lowerLeg.position.set(side * 0.15, 0.32, 0);
    lowerLeg.rotation.z = side * -0.05;
    lowerLeg.castShadow = true;
    root.add(lowerLeg);

    // Knee pad accent
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.072, 10, 8), suitSecondaryMat);
    knee.position.set(side * 0.145, 0.51, 0.04);
    knee.scale.set(0.9, 1.05, 0.65);
    root.add(knee);

    // Upper leg (thigh)
    const thigh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.084, 0.34, 6, 12),
      suitPrimaryMat
    );
    thigh.position.set(side * 0.13, 0.72, 0);
    thigh.rotation.z = side * 0.04;
    thigh.castShadow = true;
    root.add(thigh);
  }

  // Pelvis & racing belt
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.22), suitPrimaryMat);
  pelvis.position.set(0, 0.93, 0);
  root.add(pelvis);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.065, 0.24), suitSecondaryMat);
  belt.position.set(0, 1.01, 0);
  root.add(belt);

  // Upper body group (for subtle breathing animation)
  const upperBody = new THREE.Group();
  upperBody.position.set(0, 1.02, 0);
  root.add(upperBody);

  // Sculpted Torso Suit
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.48, 0.24), suitPrimaryMat);
  torso.position.set(0, 0.25, 0);
  torso.castShadow = true;
  upperBody.add(torso);

  // Racing Chest Stripe & Shoulder Epaulets
  const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.11, 0.252), suitSecondaryMat);
  chestStripe.position.set(0, 0.32, 0);
  upperBody.add(chestStripe);

  const chestV = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.42, 0.255), suitSecondaryMat);
  chestV.position.set(0, 0.23, 0);
  upperBody.add(chestV);

  // Collar / HANS neck brace
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.08, 16), darkTrimMat);
  collar.position.set(0, 0.51, 0);
  upperBody.add(collar);

  // Arms: Left arm relaxed, Right arm heroic hand-on-hip stance
  // Left shoulder & arm
  const lShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), suitSecondaryMat);
  lShoulder.position.set(-0.27, 0.42, 0);
  upperBody.add(lShoulder);

  const lUpperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.24, 6, 10), suitPrimaryMat);
  lUpperArm.position.set(-0.31, 0.25, 0.01);
  lUpperArm.rotation.z = -0.14;
  lUpperArm.castShadow = true;
  upperBody.add(lUpperArm);

  const lForearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.22, 6, 10), suitPrimaryMat);
  lForearm.position.set(-0.34, 0.03, 0.05);
  lForearm.rotation.x = -0.22;
  lForearm.castShadow = true;
  upperBody.add(lForearm);

  const lGlove = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), darkTrimMat);
  lGlove.position.set(-0.35, -0.1, 0.09);
  upperBody.add(lGlove);

  // Right shoulder & hand-on-hip arm
  const rShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), suitSecondaryMat);
  rShoulder.position.set(0.27, 0.42, 0);
  upperBody.add(rShoulder);

  const rUpperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.24, 6, 10), suitPrimaryMat);
  rUpperArm.position.set(0.35, 0.27, 0.01);
  rUpperArm.rotation.z = 0.45;
  rUpperArm.castShadow = true;
  upperBody.add(rUpperArm);

  const rForearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.22, 6, 10), suitPrimaryMat);
  rForearm.position.set(0.32, 0.09, 0.05);
  rForearm.rotation.z = -0.58;
  rForearm.castShadow = true;
  upperBody.add(rForearm);

  const rGlove = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), darkTrimMat);
  rGlove.position.set(0.22, 0.01, 0.07);
  upperBody.add(rGlove);

  // Racing Helmet + Tinted Aero Visor
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.67, 0.01);
  upperBody.add(headGroup);

  const helmetShell = new THREE.Mesh(new THREE.SphereGeometry(0.168, 22, 18), helmetMat);
  helmetShell.scale.set(0.96, 1.04, 1.12);
  helmetShell.castShadow = true;
  headGroup.add(helmetShell);

  // Chin guard
  const chinGuard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.16), helmetMat);
  chinGuard.position.set(0, -0.085, 0.1);
  headGroup.add(chinGuard);

  // Center aero ridge stripe on helmet
  const helmetStripe = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.14, 0.28), suitSecondaryMat);
  helmetStripe.position.set(0, 0.11, -0.01);
  headGroup.add(helmetStripe);

  // Curved reflective visor
  const visor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.162, 0.162, 0.095, 20, 1, true, -Math.PI * 0.34, Math.PI * 0.68),
    visorMat
  );
  visor.position.set(0, 0.01, 0.04);
  headGroup.add(visor);

  return {
    root,
    upperBody,
    headGroup,
    suitPrimaryMat,
    suitSecondaryMat,
    helmetMat,
    visorMat,
  };
}

export function updateDriverRig(rig: DriverRig, driver: DriverSpec): void {
  rig.suitPrimaryMat.color.set(driver.suitPrimary);
  rig.suitSecondaryMat.color.set(driver.suitSecondary);
  rig.helmetMat.color.set(driver.helmetColor);
  rig.visorMat.color.set(driver.visorColor);
  rig.visorMat.emissive.set(driver.visorColor);
}
