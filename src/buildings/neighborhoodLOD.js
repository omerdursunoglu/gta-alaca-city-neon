import * as THREE from 'three';
import { getProceduralMaterial } from '../engine/proceduralTextures.js';

/**
 * Neighborhood LOD Buildings & Street Props within the 50m radius of Tokat Alaca Mescit Camii.
 * Every building adheres to the Anti-Ugly-AI-Modeling Protocol: textured stone plinths,
 * bağdadi/almasik facades, recessed windows with sills/lintels, overhanging kiremit roofs,
 * plus Turkish street trees, iron streetlights, and benches.
 */
export function buildNeighborhoodLOD(osmFootprints = []) {
  const group = new THREE.Group();
  group.name = 'NeighborhoodLOD';

  const colliders = [];
  const cameraColliders = [];
  const buildingsMeta = [];

  const registerMesh = (mesh, camCol = true) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (camCol) cameraColliders.push(mesh);
    return mesh;
  };

  const matStone = getProceduralMaterial('cutStone', { repeatX: 2, repeatY: 1 });
  const matAlmasik = getProceduralMaterial('almasik', { repeatX: 2, repeatY: 1.5 });
  const matBagdadiCream = getProceduralMaterial('bagdadiPlaster', { repeatX: 2, repeatY: 1.5 });
  const matBagdadiOchre = getProceduralMaterial('bagdadiPlaster', { repeatX: 2, repeatY: 1.5, tint: 'ochre' });
  const matBagdadiTerra = getProceduralMaterial('bagdadiPlaster', { repeatX: 2, repeatY: 1.5, tint: 'terracotta' });
  const matBagdadiSage = getProceduralMaterial('bagdadiPlaster', { repeatX: 2, repeatY: 1.5, tint: 'sage' });
  const matWood = getProceduralMaterial('agedWood');
  const matKiremit = getProceduralMaterial('kiremit', { repeatX: 3.5, repeatY: 3 });
  const matGlass = getProceduralMaterial('windowGlass');
  const matIron = getProceduralMaterial('wroughtIron');

  const upperMats = [matBagdadiCream, matBagdadiOchre, matBagdadiTerra, matBagdadiSage];

  // Helper to construct a detailed multi-part Anatolian neighborhood house/shop
  const buildDetailedHouse = (spec) => {
    const { x, z, w, d, floors = 2, rotY = 0, variant = 0, label = 'Neighborhood Building' } = spec;
    const hg = new THREE.Group();
    hg.position.set(x, 0, z);
    hg.rotation.y = rotY;

    const upperMat = upperMats[variant % upperMats.length];
    const groundH = 3.1;
    const upperH = floors >= 2 ? 2.9 * (floors - 1) : 0;
    const totalH = 0.45 + groundH + upperH;

    // 1. Stone subasman plinth
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.25, 0.45, d + 0.25), matStone);
    plinth.position.y = 0.225;
    hg.add(registerMesh(plinth));

    // 2. Ground story (almasik / cut stone)
    const groundMesh = new THREE.Mesh(new THREE.BoxGeometry(w, groundH, d), variant % 2 === 0 ? matAlmasik : matStone);
    groundMesh.position.y = 0.45 + groundH / 2;
    hg.add(registerMesh(groundMesh));

    // 3. Upper story with subtle street overhang
    if (floors >= 2) {
      const upperMesh = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, upperH, d + 0.3), upperMat);
      upperMesh.position.y = 0.45 + groundH + upperH / 2;
      hg.add(registerMesh(upperMesh));

      const belt = new THREE.Mesh(new THREE.BoxGeometry(w + 0.42, 0.14, d + 0.42), matWood);
      belt.position.y = 0.45 + groundH;
      hg.add(registerMesh(belt, false));
    }

    // 4. Recessed Windows & Door along front/back faces
    const winCount = Math.max(2, Math.floor(w / 3.1));
    for (let f = 0; f < floors; f++) {
      const wy = f === 0 ? 2.05 : 0.45 + groundH + (f - 0.5) * 2.9;
      const zFace = f === 0 ? d / 2 : (d + 0.3) / 2;
      for (let i = 0; i < winCount; i++) {
        const wx = -w / 2 + ((i + 0.5) / winCount) * w;
        if (f === 0 && i === 0) {
          // Street entrance door with stone lintel
          const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 0.1), matWood);
          door.position.set(wx, 1.55, zFace + 0.03);
          hg.add(registerMesh(door, false));
          const step = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.24, 0.45), matStone);
          step.position.set(wx, 0.12, zFace + 0.24);
          hg.add(registerMesh(step, false));
          continue;
        }
        // Recessed window with sill, frame, glass
        const frame = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.35, 0.1), matWood);
        frame.position.set(wx, wy, zFace + 0.03);
        hg.add(registerMesh(frame, false));
        const glass = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.15, 0.05), matGlass);
        glass.position.set(wx, wy, zFace + 0.06);
        hg.add(registerMesh(glass, false));
        const sill = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.09, 0.18), matStone);
        sill.position.set(wx, wy - 0.7, zFace + 0.08);
        hg.add(registerMesh(sill, false));
      }
    }

    // 5. Overhanging Roof Eaves + Kiremit Hipped Roof + Chimney
    const eaves = new THREE.Mesh(new THREE.BoxGeometry(w + 0.95, 0.14, d + 0.95), matWood);
    eaves.position.y = totalH + 0.05;
    hg.add(registerMesh(eaves, false));

    const roofRadius = Math.hypot(w + 0.9, d + 0.9) * 0.5;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(roofRadius, 1.9, 4), matKiremit);
    roof.position.y = totalH + 1.0;
    roof.rotation.y = Math.PI / 4;
    hg.add(registerMesh(roof));

    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.4, 0.55), matAlmasik);
    chimney.position.set(w * 0.22, totalH + 1.15, -d * 0.18);
    hg.add(registerMesh(chimney, false));

    group.add(hg);

    // Axis-aligned collider bounding the rotated footprint
    const cos = Math.abs(Math.cos(rotY));
    const sin = Math.abs(Math.sin(rotY));
    const hw = (w * cos + d * sin) * 0.5 + 0.15;
    const hd = (w * sin + d * cos) * 0.5 + 0.15;

    colliders.push({
      minX: x - hw,
      maxX: x + hw,
      minY: 0,
      maxY: totalH + 2.0,
      minZ: z - hd,
      maxZ: z + hd,
      tag: 'lod_building',
    });

    buildingsMeta.push({
      minX: x - hw,
      maxX: x + hw,
      minZ: z - hd,
      maxZ: z + hd,
      label,
    });
  };

  // Pre-computed Tokat Alaca Mescit 50m perimeter neighborhood buildings
  // Respects street corridors:
  //   Main Street: Z = +8.3..+14.7 | North Alley: Z = -20.9..-16.1
  //   East Lane: X = +14.0..+19.0 | West Lane: X = -34.0..-29.0
  const fallbackSpecs = [
    // South side of Main Street (across from Mosque & Hero Houses, facing North toward -Z)
    { x: -22.5, z: 22.8, w: 10.5, d: 9.2, floors: 2, rotY: Math.PI, variant: 1, label: 'Alaca Bakery & Residence' },
    { x: -10.5, z: 23.2, w: 9.8, d: 9.6, floors: 2, rotY: Math.PI, variant: 0, label: 'Tokat Konağı' },
    { x: 1.5, z: 22.6, w: 10.2, d: 9.0, floors: 2, rotY: Math.PI, variant: 2, label: 'Mahalle Kahvehanesi' },
    { x: 10.2, z: 23.5, w: 6.4, d: 10.0, floors: 1, rotY: Math.PI, variant: 3, label: 'Corner Bakkal' },

    // East of East Lane (X > +21)
    { x: 26.8, z: 0.5, w: 9.8, d: 12.2, floors: 2, rotY: -Math.PI / 2, variant: 0, label: 'East Historic Mansion' },
    { x: 26.5, z: -11.5, w: 9.2, d: 8.6, floors: 2, rotY: -Math.PI / 2, variant: 3, label: 'Anatolian Courtyard House' },
    { x: 26.8, z: 22.8, w: 10.0, d: 9.4, floors: 2, rotY: Math.PI, variant: 1, label: 'Southeast Residence' },
    { x: 39.2, z: 22.5, w: 10.5, d: 9.5, floors: 3, rotY: Math.PI, variant: 2, label: 'Tokat Apartment Block' },
    { x: 39.5, z: -2.0, w: 10.0, d: 14.0, floors: 2, rotY: -Math.PI / 2, variant: 1, label: 'Eastern Garden House' },

    // West of West Lane (X < -35)
    { x: -41.5, z: 0.5, w: 10.2, d: 11.4, floors: 2, rotY: Math.PI / 2, variant: 2, label: 'West Timber House' },
    { x: -41.2, z: 22.6, w: 10.0, d: 9.6, floors: 2, rotY: Math.PI, variant: 0, label: 'Southwest House' },
    { x: -41.2, z: -10.5, w: 9.6, d: 8.4, floors: 2, rotY: Math.PI / 2, variant: 3, label: 'Northwest Residence' },

    // North of North Alley (Z < -22)
    { x: -22.0, z: -29.2, w: 11.0, d: 9.8, floors: 2, rotY: 0, variant: 0, label: 'North Quarter House' },
    { x: -8.5, z: -29.5, w: 10.4, d: 9.6, floors: 2, rotY: 0, variant: 1, label: 'Taşlı Bahçe House' },
    { x: 5.0, z: -29.2, w: 11.2, d: 10.2, floors: 3, rotY: 0, variant: 2, label: 'Kuzey Apartmanı' },
    { x: 27.0, z: -29.2, w: 10.6, d: 9.8, floors: 2, rotY: 0, variant: 3, label: 'Northeast House' },
    { x: -10.5, z: -10.5, w: 9.4, d: 7.4, floors: 2, rotY: Math.PI, variant: 3, label: 'Rear Garden House' },
    { x: -22.0, z: -10.2, w: 9.6, d: 7.4, floors: 1, rotY: Math.PI, variant: 0, label: 'Stone Courtyard Workshop' },

    // Far South Block (Z > +34)
    { x: -18.0, z: 37.5, w: 13.0, d: 9.5, floors: 2, rotY: 0, variant: 2, label: 'South Block West' },
    { x: 0.0, z: 37.5, w: 14.0, d: 9.5, floors: 3, rotY: 0, variant: 0, label: 'South Block Center' },
    { x: 26.0, z: 37.5, w: 12.0, d: 9.5, floors: 2, rotY: 0, variant: 1, label: 'South Block East' },
  ];

  // Use OSM footprints if any valid non-hero ones were supplied, otherwise fallback
  const specsToBuild = osmFootprints.length > 0 ? [...fallbackSpecs, ...osmFootprints] : fallbackSpecs;
  specsToBuild.forEach(buildDetailedHouse);

  // =========================================================================
  // NEIGHBORHOOD TREES (Anatolian Plane Trees & Cypresses), STREETLAMPS, BENCHES
  // =========================================================================
  const trunkMat = getProceduralMaterial('agedWood');
  const leafMatA = new THREE.MeshStandardMaterial({ color: 0x4f6f36, roughness: 0.88 });
  const leafMatB = new THREE.MeshStandardMaterial({ color: 0x3b582c, roughness: 0.9 });

  const addTree = (tx, tz, type = 'plane') => {
    const tg = new THREE.Group();
    tg.position.set(tx, 0, tz);
    if (type === 'cypress') {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 2.2, 8), trunkMat);
      trunk.position.y = 1.1;
      tg.add(registerMesh(trunk, false));
      const crown = new THREE.Mesh(new THREE.ConeGeometry(1.05, 6.2, 10), leafMatB);
      crown.position.y = 4.9;
      tg.add(registerMesh(crown, false));
    } else {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 3.2, 10), trunkMat);
      trunk.position.y = 1.6;
      tg.add(registerMesh(trunk, false));
      [[0, 4.2, 0, 1.85], [-1.0, 3.8, 0.6, 1.25], [1.05, 3.9, -0.5, 1.3]].forEach(([cx, cy, cz, r]) => {
        const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), leafMatA);
        puff.position.set(cx, cy, cz);
        tg.add(registerMesh(puff, false));
      });
    }
    group.add(tg);
    colliders.push({
      minX: tx - 0.38, maxX: tx + 0.38, minY: 0, maxY: 4.5, minZ: tz - 0.38, maxZ: tz + 0.38, tag: 'tree',
    });
  };

  [
    [-2.6, 4.8, 'cypress'], [10.6, -11.2, 'cypress'], [-2.6, -11.2, 'cypress'],
    [-28.2, 7.2, 'plane'], [-35.5, 16.5, 'plane'], [13.2, 16.4, 'plane'],
    [13.2, -14.8, 'plane'], [-28.2, -14.8, 'plane'], [21.5, 7.2, 'plane'],
  ].forEach(([tx, tz, type]) => addTree(tx, tz, type));

  // Traditional Ottoman-style Streetlamps along Main Street
  const lampBulbMat = new THREE.MeshStandardMaterial({
    color: 0xffdf9e,
    emissive: 0xffb347,
    emissiveIntensity: 1.3,
  });
  [[-26, 7.3], [-14.5, 7.3], [0.5, 7.3], [12.8, 7.3], [-20, 15.5], [0.5, 15.6], [12, 15.5]].forEach(([lx, lz]) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 4.1, 8), matIron);
    pole.position.set(lx, 2.05, lz);
    group.add(registerMesh(pole, false));
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.15, 0.38, 6), lampBulbMat);
    head.position.set(lx, 4.22, lz);
    group.add(head);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.22, 6), matIron);
    cap.position.set(lx, 4.5, lz);
    group.add(cap);
    colliders.push({
      minX: lx - 0.15, maxX: lx + 0.15, minY: 0, maxY: 4.2, minZ: lz - 0.15, maxZ: lz + 0.15, tag: 'lamp',
    });
  });

  // Wooden Sidewalk Benches (tucked flush against garden wall / south curb)
  [[-6.8, 6.72, 0], [8.5, 15.85, Math.PI]].forEach(([bx, bz, rot]) => {
    const bg = new THREE.Group();
    bg.position.set(bx, 0.14, bz);
    bg.rotation.y = rot;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.52), matWood);
    seat.position.y = 0.44;
    bg.add(registerMesh(seat, false));
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.42, 0.08), matWood);
    back.position.set(0, 0.72, -0.22);
    back.rotation.x = -0.15;
    bg.add(registerMesh(back, false));
    [-0.72, 0.72].forEach((lx) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.48), matIron);
      leg.position.set(lx, 0.23, 0);
      bg.add(registerMesh(leg, false));
    });
    group.add(bg);
    colliders.push({
      minX: bx - 0.9, maxX: bx + 0.9, minY: 0, maxY: 1.0, minZ: bz - 0.35, maxZ: bz + 0.35, tag: 'bench',
    });
  });

  return {
    group,
    colliders,
    cameraColliders,
    buildingsMeta,
  };
}
