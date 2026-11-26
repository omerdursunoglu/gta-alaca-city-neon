import * as THREE from 'three';
import { getProceduralMaterial } from '../engine/proceduralTextures.js';

/**
 * HERO ASSET #2: Fully Enterable 2-Story Traditional Tokat House
 * Located IMMEDIATELY TO THE LEFT (-X) of Alaca Mescit Camii.
 * Footprint: X = [-15.5, -5.5], Z = [-4.0, +6.0]
 * Ground floor top Y = 0.45m | 2nd floor top Y = 3.70m | Ceiling Y = 6.65m
 */
export function buildHeroHouseEnterable() {
  const group = new THREE.Group();
  group.name = 'HeroHouseEnterable';

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

  const addBox = (w, h, d, x, y, z, mat, addCollider = false, tag = 'house_wall', camCol = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    group.add(mesh);
    registerMesh(mesh, camCol);
    if (addCollider) {
      colliders.push({
        minX: x - w / 2,
        maxX: x + w / 2,
        minY: y - h / 2,
        maxY: y + h / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
        tag,
      });
    }
    return mesh;
  };

  // Materials
  const matStone = getProceduralMaterial('cutStone', { repeatX: 2, repeatY: 1 });
  const matAlmasik = getProceduralMaterial('almasik', { repeatX: 2, repeatY: 1.5 });
  const matBagdadi = getProceduralMaterial('bagdadiPlaster', { repeatX: 2, repeatY: 1.4 });
  const matBagdadiStrip = getProceduralMaterial('bagdadiPlaster', { repeatX: 2, repeatY: 0.45 });
  const matInteriorWall = getProceduralMaterial('interiorPlaster', { repeatX: 2.5, repeatY: 1 });
  const matWood = getProceduralMaterial('agedWood', { repeatX: 1, repeatY: 1 });
  const matLightWood = getProceduralMaterial('agedWood', { repeatX: 1, repeatY: 1, tint: 'light' });
  const matFloorWood = getProceduralMaterial('floorWood', { repeatX: 3, repeatY: 3 });
  const matIznikTile = getProceduralMaterial('iznikTile', { repeatX: 3, repeatY: 3 });
  const matRug = getProceduralMaterial('anatolianRug');
  const matKiremit = getProceduralMaterial('kiremit', { repeatX: 4, repeatY: 3 });
  const matGlass = getProceduralMaterial('windowGlass', { transparent: true, opacity: 0.42 });
  const matBrass = getProceduralMaterial('brass');

  // Coordinates: X in [-15.5, -5.5] (center -10.5), Z in [-4.0, +6.0] (center +1.0)
  const minX = -15.5;
  const maxX = -5.5;
  const minZ = -4.0;
  const maxZ = 6.0;

  // =========================================================================
  // 1. STONE FOUNDATION PLINTH (SUBASMAN) & ENTRANCE STEPS
  // =========================================================================
  addBox(10.2, 0.45, 10.2, -10.5, 0.225, 1.0, matStone, false, 'subasman', false);

  // Front Porch & Stone Steps at X = -11.4..-9.6, Z = 6.0..7.45
  addBox(2.3, 0.45, 0.75, -10.5, 0.225, 6.37, matStone, false, 'porch', false);
  addBox(2.2, 0.30, 0.42, -10.5, 0.15, 6.86, matStone, false, 'step1', false);
  addBox(2.2, 0.16, 0.42, -10.5, 0.08, 7.26, matStone, false, 'step2', false);

  // Smooth ramped walkable surface for front steps
  walkableSurfaces.push({
    minX: -11.6, maxX: -9.4, minZ: 6.0, maxZ: 7.48,
    priority: 4,
    getY: (_x, z) => {
      if (z <= 6.5) return 0.45;
      const t = Math.max(0, Math.min(1, (7.48 - z) / 0.98));
      return t * 0.45;
    },
  });

  // Ground Floor Finished Surfaces (Y = 0.45m)
  // Entryway Hall (Iznik Tile): X = -12.4 to -8.6, Z = -4.0 to +6.0
  addBox(3.8, 0.04, 9.8, -10.5, 0.45, 1.0, matIznikTile, false, 'floor1_hall', false);
  // Living Room (Wood Floor): X = -8.6 to -5.6, Z = -4.0 to +6.0
  addBox(3.0, 0.04, 9.8, -7.1, 0.45, 1.0, matFloorWood, false, 'floor1_living', false);
  // Kitchen / Bath Wing (Iznik Tile): X = -15.4 to -12.4, Z = -4.0 to +6.0
  addBox(3.0, 0.04, 9.8, -13.9, 0.45, 1.0, matIznikTile, false, 'floor1_kitchen', false);

  walkableSurfaces.push({
    minX: -15.35, maxX: -5.65, minZ: -3.85, maxZ: 6.05,
    priority: 2,
    getY: () => 0.47,
  });

  // =========================================================================
  // 2. GROUND FLOOR EXTERIOR WALLS (Y = 0.45 to 3.45, height 3.0m)
  // =========================================================================
  const gWallY = 1.95;
  const gWallH = 3.0;

  // Front Wall (+Z at Z = 5.88): Doorway opening at X = -11.2 to -9.8 (1.4m wide, 2.35m tall)
  // Left of door: X = -15.5 to -11.2 (width 4.3)
  addBox(4.3, gWallH, 0.24, -13.35, gWallY, 5.88, matAlmasik, true);
  // Right of door: X = -9.8 to -5.5 (width 4.3)
  addBox(4.3, gWallH, 0.24, -7.65, gWallY, 5.88, matAlmasik, true);
  // Lintel above front door: Y = 2.82 to 3.45 (height 0.63) - carved stone header
  addBox(1.4, 0.63, 0.24, -10.5, 3.135, 5.88, matStone, true);
  // Wooden Door Frame & Swung-Open Door Leaf
  addBox(0.1, 2.38, 0.3, -11.2, 1.64, 5.88, matWood, false, 'doorframe', false);
  addBox(0.1, 2.38, 0.3, -9.8, 1.64, 5.88, matWood, false, 'doorframe', false);
  addBox(1.5, 0.12, 0.32, -10.5, 2.86, 5.88, matWood, false, 'doorframe', false);
  // Swung-open wooden front door leaf inside hallway
  const frontDoor = new THREE.Mesh(new THREE.BoxGeometry(1.26, 2.32, 0.08), matWood);
  frontDoor.position.set(-11.15, 1.63, 5.22);
  frontDoor.rotation.y = Math.PI * 0.47;
  group.add(registerMesh(frontDoor, false));

  // Back Wall (-Z at Z = -3.88)
  addBox(10.0, gWallH, 0.24, -10.5, gWallY, -3.88, matAlmasik, true);
  // Left Wall (-X at X = -15.38)
  addBox(0.24, gWallH, 10.0, -15.38, gWallY, 1.0, matAlmasik, true);
  // Right Wall (+X at X = -5.62)
  addBox(0.24, gWallH, 10.0, -5.62, gWallY, 1.0, matAlmasik, true);

  // =========================================================================
  // 3. GROUND FLOOR INTERIOR PARTITIONS & DECORATIVE ROOMS
  // =========================================================================
  // Living Room Partition Wall at X = -8.65 with open archway (Z = 1.6 to 3.6)
  addBox(0.18, gWallH, 5.4, -8.65, gWallY, -1.1, matInteriorWall, true);
  addBox(0.18, gWallH, 2.2, -8.65, gWallY, 4.7, matInteriorWall, true);
  addBox(0.18, 0.72, 2.0, -8.65, 3.09, 2.6, matInteriorWall, true);
  // Wooden arch trim
  addBox(0.24, 0.14, 2.1, -8.65, 2.7, 2.6, matWood, false, 'arch_trim', false);

  // Kitchen / Bath Partition at X = -12.35 (Z = -3.8 to -0.2), open toward hall at Z = -0.2..+1.5, plus short wall Z = 1.5..2.8
  addBox(0.18, gWallH, 3.7, -12.35, gWallY, -2.0, matInteriorWall, true);
  addBox(0.18, 0.72, 1.7, -12.35, 3.09, 0.7, matInteriorWall, true);

  // Anatolian Woven Rug in Living Room
  const rug1 = addBox(2.2, 0.02, 3.6, -7.1, 0.48, 0.2, matRug, false, 'rug1', false);
  rug1.castShadow = false;

  // Living Room Traditional Sedir (Corner cushioned sofa bench)
  addBox(0.85, 0.48, 3.8, -6.2, 0.71, -1.4, matLightWood, true, 'sedir', false);
  addBox(0.75, 0.18, 3.7, -6.2, 1.04, -1.4, matRug, false, 'sedir_cushion', false);
  addBox(2.1, 0.48, 0.85, -7.25, 0.71, -3.3, matLightWood, true, 'sedir2', false);
  addBox(2.0, 0.18, 0.75, -7.25, 1.04, -3.3, matRug, false, 'sedir2_cushion', false);
  // Low Brass Sini Tray Table
  const sini = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.48, 0.06, 18), matBrass);
  sini.position.set(-7.15, 0.88, -1.2);
  group.add(registerMesh(sini, false));
  const siniLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 0.4, 12), matWood);
  siniLeg.position.set(-7.15, 0.66, -1.2);
  group.add(registerMesh(siniLeg, false));

  // Kitchen Counter & Copper Sink (X = -15.1..-12.6, Z = -3.6..-2.8)
  addBox(2.5, 0.86, 0.75, -13.9, 0.9, -3.35, matLightWood, true, 'counter', false);
  addBox(0.65, 0.08, 0.5, -13.5, 1.35, -3.35, matBrass, false, 'sink', false);

  // =========================================================================
  // 4. INTERIOR WOODEN STAIRCASE (X = -15.15 to -13.55, Z = +4.8 -> -0.6)
  // =========================================================================
  const stairSteps = 14;
  const stairZStart = 4.8;
  const stairZEnd = -0.6;
  const stairYStart = 0.47;
  const stairYEnd = 3.72;
  for (let i = 0; i < stairSteps; i++) {
    const t = (i + 0.5) / stairSteps;
    const sz = stairZStart + (stairZEnd - stairZStart) * t;
    const sy = stairYStart + (stairYEnd - stairYStart) * t;
    addBox(1.5, 0.14, 0.44, -14.35, sy - 0.07, sz, matLightWood, false, 'stair_step', false);
  }
  // Staircase Handrail & Posts
  addBox(0.08, 0.88, 0.08, -13.58, 0.9, 4.75, matWood, false, 'banister_post', false);
  addBox(0.08, 0.88, 0.08, -13.58, 4.15, -0.65, matWood, false, 'banister_post2', false);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 6.2), matWood);
  rail.position.set(-13.58, 2.52, 2.05);
  rail.rotation.x = Math.atan2(stairYEnd - stairYStart, stairZStart - stairZEnd);
  group.add(registerMesh(rail, false));

  // Under-stair wooden partition so player enters cleanly at the foot of the stairs
  addBox(0.14, 1.9, 3.2, -13.55, 1.4, 0.9, matLightWood, true, 'under_stair_wall', true);

  // Staircase smooth walkable ramp (higher priority than 1st & 2nd floor!)
  walkableSurfaces.push({
    minX: -15.25, maxX: -13.4, minZ: -0.9, maxZ: 5.0,
    priority: 5,
    getY: (_x, z) => {
      const t = Math.max(0, Math.min(1, (4.85 - z) / (4.85 - (-0.65))));
      return 0.47 + t * (3.72 - 0.47);
    },
  });

  // =========================================================================
  // 5. SECOND FLOOR SLAB (WITH STAIRWELL OPENING) & BALUSTRADE
  // =========================================================================
  // Slab thickness 0.25m (Y = 3.45 to 3.70)
  // Right & Center main slab: X = -13.35 to -5.5, Z = -4.0 to +6.0
  addBox(7.85, 0.25, 10.0, -9.425, 3.575, 1.0, matFloorWood, false, 'floor2_main', true);
  // North landing behind stairwell: X = -15.5 to -13.35, Z = -4.0 to -0.65
  addBox(2.15, 0.25, 3.35, -14.425, 3.575, -2.325, matFloorWood, false, 'floor2_north', true);
  // South landing in front of stairwell: X = -15.5 to -13.35, Z = 4.9 to 6.0
  addBox(2.15, 0.25, 1.1, -14.425, 3.575, 5.45, matFloorWood, false, 'floor2_south', true);
  // Cantilevered Front Cumba Floor Slab: X = -12.6 to -8.4, Z = 6.0 to 6.85
  addBox(4.2, 0.25, 0.9, -10.5, 3.575, 6.42, matFloorWood, false, 'cumba_floor', true);

  // Walkable Surfaces on 2nd Floor (Y = 3.72m)
  walkableSurfaces.push(
    { minX: -13.35, maxX: -5.65, minZ: -3.85, maxZ: 5.85, priority: 3, getY: () => 3.72 },
    { minX: -15.35, maxX: -13.3, minZ: -3.85, maxZ: -0.65, priority: 3, getY: () => 3.72 },
    { minX: -12.45, maxX: -8.55, minZ: 5.8, maxZ: 6.72, priority: 3, getY: () => 3.72 }
  );

  // Stairwell Safety Balustrade on 2nd floor along X = -13.35, Z = -0.65 to +4.9
  addBox(0.12, 0.9, 5.55, -13.35, 4.15, 2.12, matWood, true, 'stairwell_rail', false);

  // =========================================================================
  // 6. SECOND STORY EXTERIOR WALLS (BAĞDADI TIMBER-FRAME + CUMBA)
  // =========================================================================
  const uWallY = 5.15;
  const uWallH = 2.95;

  // Back, Left, Right Exterior Walls
  addBox(10.0, uWallH, 0.24, -10.5, uWallY, -3.88, matBagdadi, true);
  addBox(0.24, uWallH, 10.0, -15.38, uWallY, 1.0, matBagdadi, true);
  addBox(0.24, uWallH, 10.0, -5.62, uWallY, 1.0, matBagdadi, true);

  // Front Wall 2nd floor: Left & Right wings at Z = 5.88, Center Cumba pushed out to Z = 6.82!
  addBox(2.9, uWallH, 0.24, -14.05, uWallY, 5.88, matBagdadi, true);
  addBox(2.9, uWallH, 0.24, -6.95, uWallY, 5.88, matBagdadi, true);
  // Cumba side cheeks
  addBox(0.22, uWallH, 0.96, -12.55, uWallY, 6.38, matBagdadi, true);
  addBox(0.22, uWallH, 0.96, -8.45, uWallY, 6.38, matBagdadi, true);
  // Cumba front wall (low knee wall + upper header + large panoramic windows with mullions)
  addBox(4.2, 0.95, 0.22, -10.5, 4.17, 6.82, matBagdadiStrip, true);
  addBox(4.2, 0.55, 0.22, -10.5, 6.35, 6.82, matBagdadiStrip, true);
  addBox(4.0, 1.45, 0.06, -10.5, 5.38, 6.82, matGlass, true, 'cumba_glass', false);
  [-11.8, -10.5, -9.2].forEach((mx) => {
    addBox(0.08, 1.48, 0.14, mx, 5.38, 6.84, matWood, false, 'cumba_mullion', false);
  });
  addBox(4.05, 0.08, 0.14, -10.5, 5.55, 6.84, matWood, false, 'cumba_transom', false);

  // Curved Wooden Eliböğründe Brackets flanking the doorway (never blocking doorway!)
  [-12.25, -11.45, -9.55, -8.75].forEach((bx) => {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 0.22), matWood);
    brace.position.set(bx, 3.08, 6.35);
    brace.rotation.x = 0.62;
    group.add(registerMesh(brace, false));
  });

  // 2nd Floor Interior Bedroom Partition at X = -9.6 with doorway (Z = 1.6 to 3.2)
  addBox(0.18, uWallH, 5.4, -9.6, uWallY, -1.1, matInteriorWall, true);
  addBox(0.18, uWallH, 2.6, -9.6, uWallY, 4.5, matInteriorWall, true);
  addBox(0.18, 0.72, 1.6, -9.6, 6.26, 2.4, matInteriorWall, true);

  // 2nd Floor Furnishings: Bedroom Rug, Grounded Bed (with headboard & pillow for movie-watching NPC), Wardrobe
  addBox(2.2, 0.02, 2.8, -7.5, 3.71, -0.8, matRug, false, 'rug2', false);
  addBox(1.5, 0.44, 2.1, -6.65, 3.92, -2.5, matWood, true, 'bed', false);
  addBox(1.54, 0.72, 0.1, -6.65, 4.08, -3.54, matWood, false, 'headboard', false);
  addBox(1.4, 0.16, 1.9, -6.65, 4.22, -2.5, matRug, false, 'quilt', false);
  const matPillow = new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.88 });
  addBox(0.95, 0.16, 0.46, -6.65, 4.36, -3.22, matPillow, false, 'pillow', false);
  addBox(0.65, 2.1, 1.6, -6.0, 4.77, 1.8, matWood, true, 'wardrobe', false);
  // Cumba Cushion Bench overlooking Alaca Mescit Camii
  addBox(3.7, 0.42, 0.7, -10.5, 3.92, 6.42, matLightWood, true, 'cumba_bench', false);
  addBox(3.6, 0.14, 0.62, -10.5, 4.18, 6.42, matRug, false, 'cumba_cushion', false);

  // =========================================================================
  // 7. RECESSED EXTERIOR WINDOWS, SHUTTERS & OVERHANGING KİREMİT ROOF
  // =========================================================================
  const addExteriorWindow = (wx, wy, wz, rotY, hasShutters = true) => {
    const wg = new THREE.Group();
    wg.position.set(wx, wy, wz);
    wg.rotation.y = rotY;
    // Frame, Sill, Lintel, Mullions, Glass
    const makePart = (w, h, d, px, py, pz, m) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(px, py, pz);
      wg.add(registerMesh(mesh, false));
    };
    makePart(1.16, 0.1, 0.22, 0, -0.72, 0.04, matWood);
    makePart(1.18, 0.12, 0.2, 0, 0.72, 0.04, matWood);
    makePart(0.1, 1.4, 0.18, -0.52, 0, 0.02, matWood);
    makePart(0.1, 1.4, 0.18, 0.52, 0, 0.02, matWood);
    makePart(0.05, 1.36, 0.08, 0, 0, 0.02, matWood);
    makePart(0.96, 0.05, 0.08, 0, 0.18, 0.02, matWood);
    makePart(0.96, 1.32, 0.04, 0, 0, -0.02, matGlass);

    if (hasShutters) {
      makePart(0.42, 1.32, 0.06, -0.78, 0, 0.06, matLightWood);
      makePart(0.42, 1.32, 0.06, 0.78, 0, 0.06, matLightWood);
    }
    group.add(wg);
  };

  // Front windows
  addExteriorWindow(-13.6, 2.0, 6.01, 0, true);
  addExteriorWindow(-7.4, 2.0, 6.01, 0, true);
  addExteriorWindow(-14.0, 5.15, 6.01, 0, true);
  addExteriorWindow(-7.0, 5.15, 6.01, 0, true);
  // Side & Rear windows
  addExteriorWindow(-5.49, 5.15, 1.2, Math.PI / 2, true);
  addExteriorWindow(-15.51, 5.15, -1.5, -Math.PI / 2, true);
  addExteriorWindow(-10.5, 5.15, -4.01, Math.PI, true);

  // 2nd Floor Ceiling + Hipped/Gabled Kiremit Roof with Exposed Rafters & Chimney
  addBox(10.2, 0.18, 10.2, -10.5, 6.68, 1.0, matLightWood, false, 'ceiling2', true);

  // Overhanging Eaves Rafters
  for (let rx = -15.6; rx <= -5.4; rx += 0.85) {
    addBox(0.1, 0.14, 11.2, rx, 6.62, 1.0, matWood, false, 'rafter', false);
  }
  // Four-sided Pitched Terracotta Kiremit Roof
  const roofCone = new THREE.Mesh(new THREE.ConeGeometry(7.9, 2.35, 4), matKiremit);
  roofCone.position.set(-10.5, 7.9, 1.0);
  roofCone.rotation.y = Math.PI / 4;
  group.add(registerMesh(roofCone, true));
  // Roof Ridge Cap
  addBox(1.8, 0.18, 0.35, -10.5, 9.05, 1.0, matKiremit, false, 'ridge', false);
  // Brick Chimney
  addBox(0.65, 2.1, 0.65, -7.2, 8.2, -1.6, matAlmasik, false, 'chimney', false);
  addBox(0.8, 0.14, 0.8, -7.2, 9.28, -1.6, matStone, false, 'chimney_cap', false);

  // =========================================================================
  // 8. WARM INTERIOR POINT LIGHTS (GROUND FLOOR + 2ND FLOOR)
  // =========================================================================
  const light1 = new THREE.PointLight(0xffb55a, 6.5, 11, 1.6);
  light1.position.set(-7.6, 3.05, 0.6);
  group.add(light1);
  lights.push(light1);

  const light2 = new THREE.PointLight(0xffb968, 5.5, 10, 1.6);
  light2.position.set(-11.2, 3.05, 2.2);
  group.add(light2);
  lights.push(light2);

  const light3 = new THREE.PointLight(0xffb055, 6.5, 11, 1.6);
  light3.position.set(-11.4, 6.2, 2.4);
  group.add(light3);
  lights.push(light3);

  // Brass ceiling lamp shades
  [[-7.6, 3.25, 0.6], [-11.2, 3.25, 2.2], [-11.4, 6.42, 2.4]].forEach(([lx, ly, lz]) => {
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.22, 12), matBrass);
    shade.position.set(lx, ly, lz);
    group.add(shade);
  });

  return {
    group,
    colliders,
    cameraColliders,
    walkableSurfaces,
    lights,
    bedroomInfo: {
      bedPos: new THREE.Vector3(-6.65, 4.32, -2.5),
      headZ: -3.22,
    },
    bounds: { minX, maxX, minZ, maxZ, label: 'Traditional 2-Story House (Enterable)' },
  };
}
