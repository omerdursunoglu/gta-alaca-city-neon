import * as THREE from 'three';
import { getProceduralMaterial } from '../engine/proceduralTextures.js';

/**
 * HERO ASSET #1: Tokat Alaca Mescit Camii (1300 AD Seljuk Minaret + 1505 AD Ottoman Prayer Hall)
 * NON-ENTERABLE exterior monument centered on the focal plot.
 */
export function buildAlacaMescit() {
  const group = new THREE.Group();
  group.name = 'AlacaMescitCamii';

  const colliders = [];
  const cameraColliders = [];
  const walkableSurfaces = [];
  const lights = [];

  const registerMesh = (mesh, isCamCollider = true) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (isCamCollider) cameraColliders.push(mesh);
    return mesh;
  };

  const addBox = (w, h, d, x, y, z, mat, parent = group, camCol = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return registerMesh(mesh, camCol);
  };

  // Materials
  const matAlmasik = getProceduralMaterial('almasik', { repeatX: 2.5, repeatY: 1.8 });
  const matAlmasikDrum = getProceduralMaterial('almasik', { repeatX: 1, repeatY: 0.7 });
  const matStone = getProceduralMaterial('cutStone', { repeatX: 2, repeatY: 1.5 });
  const matDarkStone = getProceduralMaterial('cutStone', { repeatX: 2, repeatY: 1, tint: 'dark' });
  const matSeljukBrick = getProceduralMaterial('seljukBrick', { repeatX: 2.5, repeatY: 3.5 });
  const matLead = getProceduralMaterial('leadRoof', { repeatX: 3, repeatY: 2 });
  const matWood = getProceduralMaterial('agedWood', { repeatX: 1, repeatY: 1 });
  const matBrass = getProceduralMaterial('brass');
  const matIron = getProceduralMaterial('wroughtIron');
  const matGlass = getProceduralMaterial('windowGlass');
  const matPaver = getProceduralMaterial('sidewalk', { repeatX: 5, repeatY: 4 });

  // Plot center: X = 4.0, Z = -3.0 (Courtyard front at Z = +6.5, Rear at Z = -13.0)
  const cx = 4.0;
  const harimZ = -5.5;

  // 1. Courtyard stone terrace pavement (Z = -13.0 to +6.5, X = -3.8 to +11.8)
  const courtyardFloor = addBox(15.6, 0.14, 19.5, cx, 0.07, -3.25, matPaver, group, false);
  walkableSurfaces.push({
    minX: -3.8, maxX: 11.8, minZ: -13.0, maxZ: 6.5,
    priority: 1,
    getY: () => 0.14,
  });

  // 2. Main Harim Prayer Hall (10.4m wide x 9.6m deep x 7.0m tall)
  // Stone Subasman Plinth
  addBox(10.8, 0.65, 10.0, cx, 0.46, harimZ, matDarkStone);
  // Almasik Masonry Main Body
  addBox(10.4, 6.4, 9.6, cx, 3.98, harimZ, matAlmasik);

  // Corner Cut-Stone Quoins
  const qOffsets = [
    [-5.12, -4.72], [5.12, -4.72], [-5.12, 4.72], [5.12, 4.72],
  ];
  qOffsets.forEach(([ox, oz]) => {
    for (let i = 0; i < 8; i++) {
      const w = i % 2 === 0 ? 0.48 : 0.34;
      const d = i % 2 === 0 ? 0.34 : 0.48;
      addBox(w, 0.72, d, cx + ox, 1.15 + i * 0.78, harimZ + oz, matStone, group, false);
    }
  });

  // Stepped Cornice Eaves around Harim
  addBox(10.8, 0.24, 10.0, cx, 7.25, harimZ, matStone);
  addBox(11.1, 0.2, 10.3, cx, 7.45, harimZ, matDarkStone);

  // Recessed Ottoman Arched Windows on East, West, South walls
  const addMosqueWindow = (wx, wy, wz, rotY, large = true) => {
    const wg = new THREE.Group();
    wg.position.set(wx, wy, wz);
    wg.rotation.y = rotY;
    const ww = large ? 1.15 : 0.72;
    const wh = large ? 1.75 : 1.05;

    // Cut-stone surround frame
    addBox(ww + 0.32, 0.2, 0.24, 0, wh / 2 + 0.1, 0.04, matStone, wg, false);
    addBox(ww + 0.36, 0.16, 0.28, 0, -wh / 2 - 0.08, 0.06, matDarkStone, wg, false);
    addBox(0.16, wh, 0.22, -ww / 2 - 0.08, 0, 0.04, matStone, wg, false);
    addBox(0.16, wh, 0.22, ww / 2 + 0.08, 0, 0.04, matStone, wg, false);

    // Pointed arch tympanum
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(ww * 0.52, ww * 0.52, 0.18, 12, 1, false, 0, Math.PI), matStone);
    arch.rotation.z = Math.PI / 2;
    arch.rotation.y = Math.PI / 2;
    arch.position.set(0, wh / 2 + 0.18, 0.02);
    wg.add(registerMesh(arch, false));

    // Recessed glass pane
    addBox(ww, wh, 0.06, 0, 0, -0.04, matGlass, wg, false);

    // Wrought-iron lokma parmaklık grille
    for (let i = -2; i <= 2; i++) {
      addBox(0.03, wh - 0.1, 0.03, i * (ww * 0.18), 0, 0.03, matIron, wg, false);
    }
    for (let j = -1; j <= 1; j++) {
      addBox(ww - 0.08, 0.03, 0.03, 0, j * (wh * 0.26), 0.03, matIron, wg, false);
    }
    group.add(wg);
  };

  // East & West Harim Windows (2 lower, 2 upper clerestory per side)
  [-2.2, 2.2].forEach((dz) => {
    addMosqueWindow(cx + 5.2, 2.55, harimZ + dz, Math.PI / 2, true);
    addMosqueWindow(cx + 5.2, 5.45, harimZ + dz, Math.PI / 2, false);
    addMosqueWindow(cx - 5.2, 2.55, harimZ + dz, -Math.PI / 2, true);
    addMosqueWindow(cx - 5.2, 5.45, harimZ + dz, -Math.PI / 2, false);
  });
  // South (Qibla/rear) Windows
  [-2.4, 2.4].forEach((dx) => {
    addMosqueWindow(cx + dx, 2.6, harimZ - 4.8, Math.PI, true);
    addMosqueWindow(cx + dx, 5.5, harimZ - 4.8, Math.PI, false);
  });

  // 3. Octagonal Drum (Sekizgen Kasnak) + Lead Dome + Brass Alem
  const drumY = 8.45;
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(4.35, 4.55, 1.9, 8), matAlmasikDrum);
  drum.position.set(cx, drumY, harimZ);
  drum.rotation.y = Math.PI / 8;
  group.add(registerMesh(drum));

  const drumCornice = new THREE.Mesh(new THREE.CylinderGeometry(4.55, 4.4, 0.24, 8), matStone);
  drumCornice.position.set(cx, drumY + 1.02, harimZ);
  drumCornice.rotation.y = Math.PI / 8;
  group.add(registerMesh(drumCornice, false));

  // 8 clerestory arched windows on the octagonal drum
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4;
    const wx = cx + Math.sin(ang) * 4.18;
    const wz = harimZ + Math.cos(ang) * 4.18;
    addMosqueWindow(wx, drumY + 0.05, wz, ang, false);
  }

  // Lead-covered main dome
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(4.25, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.52),
    matLead
  );
  dome.position.set(cx, drumY + 1.05, harimZ);
  dome.scale.y = 0.88;
  group.add(registerMesh(dome));

  // Brass Alem Finial on main dome
  const addAlem = (ax, ay, az, scale = 1) => {
    const ag = new THREE.Group();
    ag.position.set(ax, ay, az);
    ag.scale.setScalar(scale);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.35, 10), matBrass);
    pole.position.y = 0.65;
    ag.add(registerMesh(pole, false));

    [0.35, 0.72].forEach((sy, idx) => {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(idx === 0 ? 0.16 : 0.11, 12, 10), matBrass);
      orb.position.y = sy;
      ag.add(registerMesh(orb, false));
    });

    const crescent = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.04, 8, 20, Math.PI * 1.45), matBrass);
    crescent.position.y = 1.42;
    crescent.rotation.z = -Math.PI * 0.22;
    ag.add(registerMesh(crescent, false));

    group.add(ag);
  };
  addAlem(cx, drumY + 4.72, harimZ, 1.0);

  // 4. Son Cemaat Yeri (Street-facing Portico on +Z front of Harim: Z = -0.7 to +2.6)
  const porticoZ = 0.95;
  // Stone portico platform + steps
  addBox(10.6, 0.5, 3.4, cx, 0.39, porticoZ, matStone);
  addBox(4.2, 0.25, 0.6, cx, 0.26, 2.85, matDarkStone, group, false);
  addBox(4.5, 0.14, 0.55, cx, 0.18, 3.35, matDarkStone, group, false);

  // 4 Portico Columns with bases and baklava capitals
  const colXs = [cx - 4.5, cx - 1.5, cx + 1.5, cx + 4.5];
  colXs.forEach((x) => {
    addBox(0.54, 0.32, 0.54, x, 0.8, 2.35, matDarkStone, group, false);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 3.45, 16), matStone);
    shaft.position.set(x, 2.68, 2.35);
    group.add(registerMesh(shaft, false));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.2, 0.42, 8), matStone);
    cap.position.set(x, 4.55, 2.35);
    group.add(registerMesh(cap, false));
  });

  // 3 Pointed Arcade Spandrels + Side Portico Walls
  addBox(10.4, 0.95, 0.44, cx, 5.18, 2.35, matAlmasik);
  // Portico pitched lead roof + wooden rafters
  const porticoRoof = new THREE.Mesh(new THREE.BoxGeometry(10.9, 0.22, 3.85), matLead);
  porticoRoof.position.set(cx, 5.85, porticoZ + 0.1);
  porticoRoof.rotation.x = 0.16;
  group.add(registerMesh(porticoRoof));

  // Decorative 3 small lead domes on portico
  [cx - 3.0, cx, cx + 3.0].forEach((dx) => {
    const pDome = new THREE.Mesh(new THREE.SphereGeometry(1.1, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), matLead);
    pDome.position.set(dx, 5.95, porticoZ);
    pDome.scale.y = 0.72;
    group.add(registerMesh(pDome, false));
  });

  // Main Carved Portal Door + Marble Kitabe Plaque on Harim Front Wall (Z = -0.68)
  addBox(2.2, 3.3, 0.28, cx, 2.3, -0.66, matStone, group, false);
  addBox(1.55, 2.65, 0.16, cx, 2.0, -0.62, matWood, group, false);
  // Brass knockers
  [-0.22, 0.22].forEach((kx) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 8, 16), matBrass);
    ring.position.set(cx + kx, 1.85, -0.52);
    group.add(registerMesh(ring, false));
  });
  // Marble Kitabe (Ottoman inscription plaque)
  addBox(1.3, 0.48, 0.12, cx, 3.55, -0.56, matStone, group, false);

  // Warm portico lantern light (static decorative glow)
  const porticoLantern = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshStandardMaterial({
    color: 0xffd584,
    emissive: 0xffaa33,
    emissiveIntensity: 1.6,
  }));
  porticoLantern.position.set(cx, 4.65, 0.85);
  group.add(porticoLantern);

  // 5. ICONIC 1300 AD SELJUK MINARET (Front-left / Northwest-facing corner X = -2.2, Z = -0.5)
  const mx = -2.25;
  const mz = -0.6;
  // Stone polygonal kaide (base)
  const kaide = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.28, 3.9, 8), matStone);
  kaide.position.set(mx, 2.05, mz);
  kaide.rotation.y = Math.PI / 8;
  group.add(registerMesh(kaide));

  // Chamfered transition pabuç
  const pabuc = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 1.16, 1.1, 8), matDarkStone);
  pabuc.position.set(mx, 4.55, mz);
  pabuc.rotation.y = Math.PI / 8;
  group.add(registerMesh(pabuc));

  // Cylindrical Seljuk Diamond-Brick Shaft (gövde)
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.84, 8.2, 20), matSeljukBrick);
  shaft.position.set(mx, 9.2, mz);
  group.add(registerMesh(shaft));

  // Extruded Geometric Seljuk Brick Bands along shaft
  [6.3, 9.4, 12.2].forEach((by) => {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.86, 0.32, 20), matDarkStone);
    band.position.set(mx, by, mz);
    group.add(registerMesh(band, false));
  });

  // Muqarnas-inspired Corbel Rings & Şerefe Balcony
  [13.35, 13.58, 13.82].forEach((cy, idx) => {
    const r = 0.82 + idx * 0.22;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.12, r - 0.08, 0.24, 16), matStone);
    ring.position.set(mx, cy, mz);
    group.add(registerMesh(ring, false));
  });
  // Şerefe parapet balustrade
  const serefeWall = new THREE.Mesh(new THREE.CylinderGeometry(1.34, 1.32, 0.92, 16, 1, true), matStone);
  serefeWall.material = matStone.clone();
  serefeWall.material.side = THREE.DoubleSide;
  serefeWall.position.set(mx, 14.38, mz);
  group.add(registerMesh(serefeWall, false));

  // Upper Petek cylinder
  const petek = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.68, 2.6, 18), matSeljukBrick);
  petek.position.set(mx, 15.22, mz);
  group.add(registerMesh(petek));

  // Lead-covered Conical Külah Spire + Brass Alem
  const kulah = new THREE.Mesh(new THREE.ConeGeometry(0.74, 3.6, 18), matLead);
  kulah.position.set(mx, 18.3, mz);
  group.add(registerMesh(kulah));
  addAlem(mx, 20.08, mz, 0.85);

  // 6. Courtyard Perimeter Wall with Wrought-Iron Grilles & Locked Street Gate
  const wallH = 1.05;
  // Front wall (Z = +6.35) left and right of gate (gate at X = 2.6 to 5.4)
  addBox(6.4, wallH, 0.36, -0.6, wallH / 2 + 0.14, 6.32, matStone);
  addBox(6.4, wallH, 0.36, 8.6, wallH / 2 + 0.14, 6.32, matStone);
  // Stone gate piers + arch header + closed wrought-iron gate
  addBox(0.65, 2.8, 0.65, 2.55, 1.54, 6.32, matStone);
  addBox(0.65, 2.8, 0.65, 5.45, 1.54, 6.32, matStone);
  addBox(3.5, 0.42, 0.55, 4.0, 2.95, 6.32, matDarkStone);
  // Iron grille bars across front courtyard wall & gate
  for (let gx = -3.4; gx <= 11.4; gx += 0.35) {
    if (gx > 2.25 && gx < 5.75) {
      addBox(0.035, 2.1, 0.035, gx, 1.25, 6.32, matIron, group, false);
    } else {
      addBox(0.03, 0.82, 0.03, gx, 1.6, 6.32, matIron, group, false);
    }
  }
  // West & East & North courtyard walls
  addBox(0.36, wallH, 19.3, -3.65, wallH / 2 + 0.14, -3.25, matStone);
  addBox(0.36, wallH, 19.3, 11.65, wallH / 2 + 0.14, -3.25, matStone);
  addBox(15.4, wallH, 0.36, 4.0, wallH / 2 + 0.14, -12.82, matStone);

  // 7. Octagonal Şadırvan (Ablution Fountain) in front-right courtyard
  const sx = 9.0;
  const sz = 3.7;
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.4, 0.85, 8), matStone);
  basin.position.set(sx, 0.56, sz);
  group.add(registerMesh(basin));
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 0.1, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a6f82, roughness: 0.12, metalness: 0.3 })
  );
  water.position.set(sx, 0.96, sz);
  group.add(water);
  for (let i = 0; i < 6; i++) {
    const ang = (i * Math.PI) / 3;
    const px = sx + Math.cos(ang) * 1.18;
    const pz = sz + Math.sin(ang) * 1.18;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.0, 8), matWood);
    post.position.set(px, 1.9, pz);
    group.add(registerMesh(post, false));
  }
  const sRoof = new THREE.Mesh(new THREE.ConeGeometry(1.65, 1.05, 8), matLead);
  sRoof.position.set(sx, 3.35, sz);
  group.add(registerMesh(sRoof));

  // Solid Non-Enterable Colliders
  // Entire fenced courtyard + mosque plot is fenced and non-enterable
  colliders.push(
    { minX: -3.9, maxX: 11.9, minY: 0, maxY: 22, minZ: -13.1, maxZ: 6.55, tag: 'mosque_complex' }
  );

  return {
    group,
    colliders,
    cameraColliders,
    walkableSurfaces,
    lights,
    bounds: { minX: -3.9, maxX: 11.9, minZ: -13.1, maxZ: 6.55, label: 'Alaca Mescit Camii' },
  };
}
