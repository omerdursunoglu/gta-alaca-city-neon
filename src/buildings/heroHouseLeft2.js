import * as THREE from 'three';
import { getProceduralMaterial } from '../engine/proceduralTextures.js';

/**
 * HERO ASSET #3: Second House to the LEFT (-X) of Alaca Mescit Camii.
 * Now FULLY 2-STORY AND ENTERABLE, featuring the custom Gaming PC Setup & Bed on the 2nd floor!
 * Footprint: X = [-27.2, -17.0], Z = [-4.4, +6.0]
 * Ground floor top Y = 0.47m | 2nd floor top Y = 3.72m | Ceiling Y = 6.68m
 */
export function buildHeroHouseLeft2() {
  const group = new THREE.Group();
  group.name = 'HeroHouseLeft2';

  const colliders = [];
  const cameraColliders = [];
  const walkableSurfaces = [];
  const lights = [];

  const registerMesh = (mesh, camCol = true) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (camCol) cameraColliders.push(mesh);
    return mesh;
  };

  const addBox = (w, h, d, x, y, z, mat, addCollider = false, tag = 'house2_wall', camCol = true) => {
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
  const matAlmasik = getProceduralMaterial('almasik', { repeatX: 2.2, repeatY: 1.4 });
  const matOchreBagdadi = getProceduralMaterial('bagdadiPlaster', { repeatX: 2.2, repeatY: 1.4, tint: 'ochre' });
  const matOchreStrip = getProceduralMaterial('bagdadiPlaster', { repeatX: 1.8, repeatY: 0.45, tint: 'ochre' });
  const matInteriorWall = getProceduralMaterial('interiorPlaster', { repeatX: 2.5, repeatY: 1 });
  const matWood = getProceduralMaterial('agedWood', { repeatX: 1, repeatY: 1 });
  const matLightWood = getProceduralMaterial('agedWood', { repeatX: 1, repeatY: 1, tint: 'light' });
  const matFloorWood = getProceduralMaterial('floorWood', { repeatX: 3.5, repeatY: 3.5 });
  const matRug = getProceduralMaterial('anatolianRug');
  const matKiremit = getProceduralMaterial('kiremit', { repeatX: 4, repeatY: 3 });
  const matGlass = getProceduralMaterial('windowGlass', { transparent: true, opacity: 0.42 });
  const matIron = getProceduralMaterial('wroughtIron');
  const matBrass = getProceduralMaterial('brass');

  const minX = -27.2;
  const maxX = -17.0;
  const minZ = -4.4;
  const maxZ = 6.0;
  const cx = -22.1; // width 10.2
  const cz = 0.8;   // depth 10.4

  // =========================================================================
  // 1. STONE SUBASMAN PLINTH & ENTRANCE STEPS (Front Door at X = -23.3, Z = 5.88)
  // =========================================================================
  addBox(10.4, 0.45, 10.6, cx, 0.225, cz, matStone, false, 'subasman', false);

  // Front Porch & Steps (X = -24.4 to -22.2, Z = 6.0 to 7.45)
  addBox(2.2, 0.45, 0.72, -23.3, 0.225, 6.36, matStone, false, 'porch', false);
  addBox(2.1, 0.3, 0.42, -23.3, 0.15, 6.84, matStone, false, 'step1', false);
  addBox(2.1, 0.16, 0.42, -23.3, 0.08, 7.24, matStone, false, 'step2', false);

  walkableSurfaces.push({
    minX: -24.4, maxX: -22.2, minZ: 5.95, maxZ: 7.48,
    priority: 4,
    getY: (_x, z) => {
      if (z <= 6.5) return 0.47;
      const t = Math.max(0, Math.min(1, (7.48 - z) / 0.98));
      return t * 0.47;
    },
  });

  // Ground Floor Slab Top Surface (Y = 0.47m)
  addBox(10.0, 0.04, 10.2, cx, 0.45, cz, matFloorWood, false, 'floor1_wood', false);
  walkableSurfaces.push({
    minX: -27.05, maxX: -17.15, minZ: -4.25, maxZ: 6.05,
    priority: 2,
    getY: () => 0.47,
  });

  // =========================================================================
  // 2. GROUND FLOOR EXTERIOR WALLS (Y = 0.45 to 3.45, height 3.0m)
  // =========================================================================
  const gWallY = 1.95;
  const gWallH = 3.0;

  // Front Wall (+Z at Z = 5.88): Doorway opening at X = -24.0 to -22.6 (1.4m wide, 2.38m tall)
  addBox(3.2, gWallH, 0.24, -25.6, gWallY, 5.88, matAlmasik, true);
  addBox(5.6, gWallH, 0.24, -19.8, gWallY, 5.88, matAlmasik, true);
  addBox(1.4, 0.63, 0.24, -23.3, 3.135, 5.88, matStone, true);

  // Wooden Door Frame & Hinged Front Door (Starts CLOSED by default!)
  addBox(0.1, 2.38, 0.3, -24.0, 1.64, 5.88, matWood, false, 'df1', false);
  addBox(0.1, 2.38, 0.3, -22.6, 1.64, 5.88, matWood, false, 'df2', false);
  addBox(1.5, 0.12, 0.32, -23.3, 2.86, 5.88, matWood, false, 'df3', false);

  const doorPivot = new THREE.Group();
  doorPivot.position.set(-23.96, 1.63, 5.88);
  const frontDoor = new THREE.Mesh(new THREE.BoxGeometry(1.32, 2.32, 0.08), matWood);
  frontDoor.position.set(0.66, 0, 0);
  registerMesh(frontDoor, true);
  doorPivot.add(frontDoor);

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.16), matBrass);
  handle.position.set(1.16, -0.05, 0);
  doorPivot.add(handle);
  const knocker = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 8, 14), matBrass);
  knocker.position.set(0.66, 0.12, 0.055);
  doorPivot.add(knocker);
  group.add(doorPivot);

  const doorCollider = {
    minX: -24.02,
    maxX: -22.58,
    minY: 0.45,
    maxY: 2.85,
    minZ: 5.74,
    maxZ: 6.02,
    tag: 'front_door_2',
    disabled: false,
  };
  colliders.push(doorCollider);

  const doorController = {
    label: 'Gamer House',
    position: new THREE.Vector3(-23.3, 0.47, 5.88),
    isOpen: false,
    angle: 0,
    toggle() {
      this.isOpen = !this.isOpen;
      doorCollider.disabled = this.isOpen;
      return this.isOpen;
    },
    update(dt) {
      const target = this.isOpen ? Math.PI * 0.48 : 0;
      this.angle = THREE.MathUtils.lerp(this.angle, target, Math.min(1, dt * 10));
      doorPivot.rotation.y = this.angle;
    },
  };

  // Back, Left, Right Exterior Walls
  addBox(10.2, gWallH, 0.24, cx, gWallY, -4.28, matAlmasik, true);
  addBox(0.24, gWallH, 10.4, -27.08, gWallY, cz, matAlmasik, true);
  addBox(0.24, gWallH, 10.4, -17.12, gWallY, cz, matAlmasik, true);

  // =========================================================================
  // 3. GROUND FLOOR INTERIOR PARTITIONS & DECOR (COZY TEA SALON)
  // =========================================================================
  // Interior partition at X = -21.5 with wide open archway (Z = 1.6 to 3.6)
  addBox(0.18, gWallH, 5.8, -21.5, gWallY, -1.3, matInteriorWall, true);
  addBox(0.18, gWallH, 2.2, -21.5, gWallY, 4.7, matInteriorWall, true);
  addBox(0.18, 0.72, 2.0, -21.5, 3.09, 2.6, matInteriorWall, true);
  addBox(0.24, 0.14, 2.1, -21.5, 2.7, 2.6, matWood, false, 'arch_trim', false);

  // Ground Floor Living Room Rug, Sedir Sofa & Brass Sini
  addBox(2.4, 0.02, 3.8, -19.2, 0.48, 0.2, matRug, false, 'gf_rug', false).castShadow = false;
  addBox(0.85, 0.48, 3.6, -17.75, 0.71, -1.5, matLightWood, true, 'gf_sedir', false);
  addBox(0.75, 0.18, 3.5, -17.75, 1.04, -1.5, matRug, false, 'gf_cushion', false);
  const sini = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.46, 0.06, 18), matBrass);
  sini.position.set(-19.1, 0.88, -1.2);
  group.add(registerMesh(sini, false));
  const siniLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 0.4, 12), matWood);
  siniLeg.position.set(-19.1, 0.66, -1.2);
  group.add(registerMesh(siniLeg, false));

  // =========================================================================
  // 4. INTERIOR WOODEN STAIRCASE (X = -26.85 to -25.25, Z = +4.8 -> -0.6)
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
    addBox(1.5, 0.14, 0.44, -26.05, sy - 0.07, sz, matLightWood, false, 'stair_step', false);
  }
  addBox(0.08, 0.88, 0.08, -25.28, 0.9, 4.75, matWood, false, 'bp1', false);
  addBox(0.08, 0.88, 0.08, -25.28, 4.15, -0.65, matWood, false, 'bp2', false);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 6.2), matWood);
  rail.position.set(-25.28, 2.52, 2.05);
  rail.rotation.x = Math.atan2(stairYEnd - stairYStart, stairZStart - stairZEnd);
  group.add(registerMesh(rail, false));

  // Under-stair wooden wall
  addBox(0.14, 1.9, 3.2, -25.25, 1.4, 0.9, matLightWood, true, 'under_stair_wall2', true);

  walkableSurfaces.push({
    minX: -26.95, maxX: -25.1, minZ: -0.9, maxZ: 5.0,
    priority: 5,
    getY: (_x, z) => {
      const t = Math.max(0, Math.min(1, (4.85 - z) / (4.85 - (-0.65))));
      return 0.47 + t * (3.72 - 0.47);
    },
  });

  // =========================================================================
  // 5. SECOND FLOOR SLAB (WITH STAIRWELL OPENING) & BALUSTRADE
  // =========================================================================
  addBox(8.05, 0.25, 10.4, -21.025, 3.575, cz, matFloorWood, false, 'f2_main', true);
  addBox(2.15, 0.25, 3.75, -26.125, 3.575, -2.525, matFloorWood, false, 'f2_north', true);
  addBox(2.15, 0.25, 1.1, -26.125, 3.575, 5.45, matFloorWood, false, 'f2_south', true);
  // Double Cantilevered Cumba Floor Slabs (+Z overhang)
  addBox(3.4, 0.25, 0.85, -24.7, 3.575, 6.32, matFloorWood, false, 'cumba_l', true);
  addBox(3.4, 0.25, 0.85, -19.5, 3.575, 6.32, matFloorWood, false, 'cumba_r', true);

  walkableSurfaces.push(
    { minX: -25.05, maxX: -17.15, minZ: -4.25, maxZ: 5.85, priority: 3, getY: () => 3.72 },
    { minX: -27.05, maxX: -25.0, minZ: -4.25, maxZ: -0.65, priority: 3, getY: () => 3.72 },
    { minX: -26.3, maxX: -23.1, minZ: 5.8, maxZ: 6.65, priority: 3, getY: () => 3.72 },
    { minX: -21.1, maxX: -17.9, minZ: 5.8, maxZ: 6.65, priority: 3, getY: () => 3.72 }
  );

  // Stairwell Balustrade
  addBox(0.12, 0.9, 5.55, -25.05, 4.15, 2.12, matWood, true, 'stair_rail2', false);

  // =========================================================================
  // 6. SECOND FLOOR EXTERIOR WALLS (BAĞDADI TIMBER-FRAME + DOUBLE CUMBA)
  // =========================================================================
  const uWallY = 5.15;
  const uWallH = 2.95;

  addBox(10.4, uWallH, 0.24, cx, uWallY, -4.28, matOchreBagdadi, true);
  addBox(0.24, uWallH, 10.6, -27.08, uWallY, cz, matOchreBagdadi, true);
  addBox(0.24, uWallH, 10.6, -17.12, uWallY, cz, matOchreBagdadi, true);

  // Interior cream plaster lining for the Gaming Setup Room (Back & Right corners matching photo)
  addBox(5.1, uWallH - 0.1, 0.06, -19.6, uWallY, -4.13, matInteriorWall, false, 'gaming_wall_back', false);
  addBox(0.06, uWallH - 0.1, 9.9, -17.27, uWallY, 0.85, matInteriorWall, false, 'gaming_wall_right', false);

  // Front Wall 2nd floor with Double Cumba Bays
  addBox(1.8, uWallH, 0.24, -22.1, uWallY, 5.88, matOchreBagdadi, true);
  addBox(0.75, uWallH, 0.24, -26.75, uWallY, 5.88, matOchreBagdadi, true);
  addBox(0.75, uWallH, 0.24, -17.45, uWallY, 5.88, matOchreBagdadi, true);

  [-24.7, -19.5].forEach((bx) => {
    addBox(0.22, uWallH, 0.9, bx - 1.65, uWallY, 6.32, matOchreBagdadi, true);
    addBox(0.22, uWallH, 0.9, bx + 1.65, uWallY, 6.32, matOchreBagdadi, true);
    addBox(3.4, 0.95, 0.22, bx, 4.17, 6.72, matOchreStrip, true);
    addBox(3.4, 0.55, 0.22, bx, 6.35, 6.72, matOchreStrip, true);
    addBox(3.2, 1.45, 0.06, bx, 5.38, 6.72, matGlass, true, 'cumba_glass2', false);
    addBox(0.08, 1.48, 0.14, bx, 5.38, 6.74, matWood, false, 'cm', false);
    addBox(3.25, 0.08, 0.14, bx, 5.55, 6.74, matWood, false, 'ct', false);

    [-1.15, 0, 1.15].forEach((ox) => {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 0.22), matWood);
      brace.position.set(bx + ox, 3.08, 6.28);
      brace.rotation.x = 0.62;
      group.add(registerMesh(brace, false));
    });
  });

  // Interior Partition between Stair Landing and Gaming Bedroom at X = -22.15 (open doorway Z = 1.4 to 3.4)
  addBox(0.18, uWallH, 5.6, -22.15, uWallY, -1.4, matInteriorWall, true);
  addBox(0.18, uWallH, 2.5, -22.15, uWallY, 4.65, matInteriorWall, true);
  addBox(0.18, 0.72, 2.0, -22.15, 6.26, 2.4, matInteriorWall, true);

  // =========================================================================
  // 7. 2ND FLOOR GAMING ROOM: PHOTO-ACCURATE PC SETUP + RUG + BED
  // =========================================================================
  // Anatolian woven rug in front of the desk (matches uploaded photo!)
  const gamingRug = addBox(2.3, 0.02, 3.1, -19.25, 3.73, -1.55, matRug, false, 'gaming_rug', false);
  gamingRug.castShadow = false;

  // Bed on front-right of the room (X = -18.25, Z = +2.85)
  const matBedFrame = new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 0.7 });
  const matSheet = new THREE.MeshStandardMaterial({ color: 0xede7dc, roughness: 0.88 });
  const matBlanket = new THREE.MeshStandardMaterial({ color: 0x2c3c4f, roughness: 0.85 });
  addBox(1.45, 0.36, 2.1, -18.25, 3.9, 2.85, matBedFrame, true, 'gamer_bed', false);
  addBox(1.36, 0.16, 1.98, -18.25, 4.14, 2.85, matSheet, false, 'gamer_sheet', false);
  addBox(1.38, 0.1, 1.35, -18.25, 4.2, 2.52, matBlanket, false, 'gamer_blanket', false);
  addBox(0.86, 0.14, 0.42, -18.25, 4.28, 3.55, matSheet, false, 'gamer_pillow', false);

  // --- THE UPLOADED GAMING PC SETUP (Back-Right Corner: X=-19.85..-17.35, Z=-4.05..-3.25) ---
  const setupGroup = new THREE.Group();
  setupGroup.position.set(-18.6, 3.72, -3.68); // Desk center on 2nd floor
  group.add(setupGroup);

  const matDeskWhite = new THREE.MeshStandardMaterial({ color: 0xf2f3f5, roughness: 0.25, metalness: 0.08 });
  const matDeskMetal = new THREE.MeshStandardMaterial({ color: 0xe2e5ea, roughness: 0.35, metalness: 0.55 });
  const matDeskMat = new THREE.MeshStandardMaterial({ color: 0xd3d7df, roughness: 0.88 });
  const matBlack = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.42, metalness: 0.25 });
  const matGlassCase = new THREE.MeshStandardMaterial({
    color: 0xe6f2ff,
    roughness: 0.08,
    metalness: 0.15,
    transparent: true,
    opacity: 0.26,
  });
  const matChairGrey = new THREE.MeshStandardMaterial({ color: 0xb7bcc6, roughness: 0.82 });
  const matChairBlack = new THREE.MeshStandardMaterial({ color: 0x1c1e24, roughness: 0.68 });

  const sPart = (geo, mat, px, py, pz, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    setupGroup.add(m);
    return m;
  };

  // Glossy White Tabletop (2.2m wide x 0.78m deep at Y = 0.74m)
  sPart(new THREE.BoxGeometry(2.2, 0.045, 0.78), matDeskWhite, 0, 0.74, 0);

  // Glowing RGB LED strip along front & right edges of tabletop
  const matRgbStrip = new THREE.MeshStandardMaterial({
    color: 0xff6b8b,
    emissive: 0xff477e,
    emissiveIntensity: 1.8,
  });
  sPart(new THREE.BoxGeometry(2.21, 0.018, 0.015), matRgbStrip, 0, 0.74, 0.392);
  sPart(new THREE.BoxGeometry(0.015, 0.018, 0.79), matRgbStrip, -1.102, 0.74, 0);

  // Left White Z/K-frame Metal Desk Legs
  sPart(new THREE.BoxGeometry(0.05, 0.04, 0.68), matDeskMetal, -1.02, 0.02, 0);
  sPart(new THREE.BoxGeometry(0.05, 0.72, 0.05), matDeskMetal, -1.02, 0.37, -0.28);
  sPart(new THREE.BoxGeometry(0.045, 0.78, 0.045), matDeskMetal, -1.02, 0.37, 0.02, 0.48, 0, 0);
  sPart(new THREE.BoxGeometry(0.045, 0.42, 0.045), matDeskMetal, -1.02, 0.2, 0.14, -0.7, 0, 0);

  // Right White Drawer Cabinet under desk
  sPart(new THREE.BoxGeometry(0.46, 0.71, 0.62), matDeskWhite, 0.82, 0.36, -0.03);
  [0.56, 0.34, 0.12].forEach((dy) => {
    sPart(new THREE.BoxGeometry(0.42, 0.18, 0.02), matDeskMetal, 0.82, dy, 0.285);
  });

  // Desk Collider
  colliders.push({
    minX: -19.72, maxX: -17.42, minY: 3.7, maxY: 5.3, minZ: -4.1, maxZ: -3.26, tag: 'gaming_desk',
  });

  // Under-desk Power Brick & Trailing Cables
  sPart(new THREE.BoxGeometry(0.18, 0.04, 0.08), matBlack, -0.35, 0.02, -0.15, 0, 0.2, 0);
  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.35, 0.68, -0.25),
    new THREE.Vector3(-0.32, 0.22, -0.2),
    new THREE.Vector3(-0.35, 0.03, -0.15),
  ]);
  setupGroup.add(new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 12, 0.008, 6, false), matBlack));

  // Large White/Grey Desk Mat
  sPart(new THREE.BoxGeometry(1.08, 0.008, 0.44), matDeskMat, -0.36, 0.767, 0.08);

  // White Mechanical Keyboard + Wrist Rest + Keycaps
  sPart(new THREE.BoxGeometry(0.38, 0.02, 0.14), matDeskWhite, -0.44, 0.782, 0.1);
  sPart(new THREE.BoxGeometry(0.38, 0.014, 0.07), matDeskMat, -0.44, 0.778, 0.21);
  for (let row = 0; row < 4; row++) {
    sPart(new THREE.BoxGeometry(0.35, 0.012, 0.022), matDeskWhite, -0.44, 0.794, 0.05 + row * 0.028);
  }

  // White Wireless Gaming Mouse
  sPart(new THREE.BoxGeometry(0.065, 0.032, 0.115), matDeskWhite, -0.05, 0.785, 0.1);

  // Frameless 27" Monitor on Desk-Clamp Pole Arm (Left side of desk)
  sPart(new THREE.CylinderGeometry(0.035, 0.04, 0.03, 12), matBlack, -0.58, 0.775, -0.28);
  sPart(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 10), matBlack, -0.58, 0.98, -0.28);
  sPart(new THREE.BoxGeometry(0.76, 0.44, 0.028), matBlack, -0.46, 1.12, -0.22);

  // Live Procedural Monitor Screen CanvasTexture
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 512;
  screenCanvas.height = 288;
  const sCtx = screenCanvas.getContext('2d');
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  const matMonitorScreen = new THREE.MeshStandardMaterial({
    map: screenTex,
    emissiveMap: screenTex,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.75,
    roughness: 0.15,
  });
  const monitorScreenMesh = sPart(new THREE.PlaneGeometry(0.73, 0.41), matMonitorScreen, -0.46, 1.12, -0.203);
  monitorScreenMesh.castShadow = false;

  // White Aquarium / Panoramic Glass PC Case (Right corner of desk)
  const pcX = 0.64;
  const pcY = 1.04;
  const pcZ = -0.1;
  // White structural frame (back, bottom, top, pillars)
  sPart(new THREE.BoxGeometry(0.42, 0.035, 0.44), matDeskWhite, pcX, pcY - 0.25, pcZ);
  sPart(new THREE.BoxGeometry(0.42, 0.035, 0.44), matDeskWhite, pcX, pcY + 0.25, pcZ);
  sPart(new THREE.BoxGeometry(0.42, 0.5, 0.03), matDeskWhite, pcX, pcY, pcZ - 0.21);
  sPart(new THREE.BoxGeometry(0.03, 0.5, 0.44), matDeskWhite, pcX + 0.195, pcY, pcZ);
  // White Motherboard & Interior Hardware
  sPart(new THREE.BoxGeometry(0.02, 0.36, 0.3), matDeskMetal, pcX + 0.16, pcY + 0.02, pcZ - 0.03);
  // Circular White AIO Liquid Cooler Pump Block + Glowing Ring
  const aioRingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x99d6ff, emissiveIntensity: 1.5 });
  sPart(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 16), matDeskWhite, pcX + 0.11, pcY + 0.06, pcZ - 0.03, 0, 0, Math.PI / 2);
  sPart(new THREE.TorusGeometry(0.034, 0.006, 8, 18), aioRingMat, pcX + 0.088, pcY + 0.06, pcZ - 0.03, 0, Math.PI / 2, 0);
  // Curved White AIO Liquid Cooling Tubes
  const tube1 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(pcX + 0.09, pcY + 0.08, pcZ - 0.01),
    new THREE.Vector3(pcX + 0.02, pcY + 0.14, pcZ + 0.08),
    new THREE.Vector3(pcX + 0.12, pcY + 0.19, pcZ + 0.14),
  ]);
  const tube2 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(pcX + 0.09, pcY + 0.04, pcZ - 0.01),
    new THREE.Vector3(pcX + 0.01, pcY + 0.09, pcZ + 0.09),
    new THREE.Vector3(pcX + 0.12, pcY + 0.15, pcZ + 0.15),
  ]);
  setupGroup.add(new THREE.Mesh(new THREE.TubeGeometry(tube1, 14, 0.011, 8, false), matDeskWhite));
  setupGroup.add(new THREE.Mesh(new THREE.TubeGeometry(tube2, 14, 0.011, 8, false), matDeskWhite));
  // 3 Side White Fans with warm/white glow
  const matFanGlow = new THREE.MeshStandardMaterial({ color: 0xffe4cc, emissive: 0xffaa77, emissiveIntensity: 0.9 });
  [-0.12, 0.0, 0.12].forEach((fy) => {
    sPart(new THREE.CylinderGeometry(0.052, 0.052, 0.02, 14), matFanGlow, pcX + 0.15, pcY + fy, pcZ + 0.13, 0, 0, Math.PI / 2);
  });
  // Thick Black GeForce RTX GPU horizontally mounted inside case
  sPart(new THREE.BoxGeometry(0.14, 0.058, 0.28), matBlack, pcX + 0.08, pcY - 0.06, pcZ - 0.01);
  sPart(new THREE.BoxGeometry(0.01, 0.014, 0.12), aioRingMat, pcX + 0.008, pcY - 0.055, pcZ - 0.01);
  // Glass Front & Left Panels of PC Case
  const gLeft = sPart(new THREE.PlaneGeometry(0.43, 0.48), matGlassCase, pcX - 0.205, pcY, pcZ, 0, -Math.PI / 2, 0);
  const gFront = sPart(new THREE.PlaneGeometry(0.41, 0.48), matGlassCase, pcX, pcY, pcZ + 0.215);
  gLeft.castShadow = false;
  gFront.castShadow = false;

  // --- RAMPAGE-STYLE LIGHT-GREY & BLACK ERGONOMIC GAMING CHAIR ---
  const chairGroup = new THREE.Group();
  chairGroup.position.set(-0.36, 0, 0.78); // Positioned neatly in front of keyboard & monitor
  setupGroup.add(chairGroup);

  const cPart = (geo, mat, px, py, pz, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    chairGroup.add(m);
    return m;
  };
  // 5-star caster base
  for (let i = 0; i < 5; i++) {
    const ang = (i * Math.PI * 2) / 5;
    const arm = cPart(new THREE.BoxGeometry(0.045, 0.035, 0.34), matChairBlack, Math.sin(ang) * 0.16, 0.06, Math.cos(ang) * 0.16, 0, ang, 0);
    const wheel = cPart(new THREE.CylinderGeometry(0.028, 0.028, 0.03, 10), matChairBlack, Math.sin(ang) * 0.31, 0.028, Math.cos(ang) * 0.31, 0, ang, Math.PI / 2);
    void arm; void wheel;
  }
  // Gas lift cylinder
  cPart(new THREE.CylinderGeometry(0.028, 0.032, 0.38, 12), matChairBlack, 0, 0.25, 0);
  // Seat cushion + black side bolsters
  cPart(new THREE.BoxGeometry(0.52, 0.1, 0.5), matChairGrey, 0, 0.46, 0);
  cPart(new THREE.BoxGeometry(0.07, 0.12, 0.5), matChairBlack, -0.25, 0.48, 0);
  cPart(new THREE.BoxGeometry(0.07, 0.12, 0.5), matChairBlack, 0.25, 0.48, 0);
  // Tall contoured racing backrest
  cPart(new THREE.BoxGeometry(0.48, 0.78, 0.1), matChairGrey, 0, 0.88, 0.22, 0.08, 0, 0);
  cPart(new THREE.BoxGeometry(0.07, 0.78, 0.12), matChairBlack, -0.23, 0.88, 0.21, 0.08, 0, 0);
  cPart(new THREE.BoxGeometry(0.07, 0.78, 0.12), matChairBlack, 0.23, 0.88, 0.21, 0.08, 0, 0);
  // Black Lumbar Cushion & Headrest Neck Pillow (with Rampage style contrast)
  cPart(new THREE.BoxGeometry(0.32, 0.18, 0.08), matChairBlack, 0, 0.66, 0.15, 0.08, 0, 0);
  cPart(new THREE.BoxGeometry(0.26, 0.14, 0.08), matChairBlack, 0, 1.18, 0.17, 0.08, 0, 0);
  // Adjustable Armrests + subtle RGB accent
  [-0.31, 0.31].forEach((ax) => {
    cPart(new THREE.BoxGeometry(0.045, 0.22, 0.05), matChairBlack, ax, 0.56, 0.04);
    cPart(new THREE.BoxGeometry(0.075, 0.035, 0.25), matChairBlack, ax, 0.67, 0.02);
  });

  // =========================================================================
  // 8. RECESSED EXTERIOR WINDOWS, SHUTTERS & OVERHANGING KİREMİT ROOF
  // =========================================================================
  const addExteriorWindow = (wx, wy, wz, rotY, hasShutters = true) => {
    const wg = new THREE.Group();
    wg.position.set(wx, wy, wz);
    wg.rotation.y = rotY;
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
    makePart(0.96, 1.32, 0.04, 0, 0, -0.02, matGlass);
    if (hasShutters) {
      makePart(0.4, 1.32, 0.06, -0.76, 0, 0.06, matLightWood);
      makePart(0.4, 1.32, 0.06, 0.76, 0, 0.06, matLightWood);
    }
    group.add(wg);
  };

  // Ground & Upper Side/Back/Front Windows
  addExteriorWindow(-25.4, 2.0, 6.01, 0, true);
  addExteriorWindow(-19.4, 2.0, 6.01, 0, true);
  addExteriorWindow(-17.0, 5.15, 0.5, Math.PI / 2, true);
  addExteriorWindow(-27.2, 5.15, -1.6, -Math.PI / 2, true);
  addExteriorWindow(-23.8, 5.15, -4.42, Math.PI, true);

  // 2nd Floor Ceiling & Overhanging Eaves Rafters & Hipped Kiremit Roof
  addBox(10.5, 0.18, 10.6, cx, 6.68, cz, matLightWood, false, 'ceiling2', true);
  for (let rx = -27.5; rx <= -16.7; rx += 0.88) {
    addBox(0.1, 0.14, 11.9, rx, 6.6, cz + 0.2, matWood, false, 'rafter', false);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(8.35, 2.45, 4), matKiremit);
  roof.position.set(cx, 7.9, cz + 0.2);
  roof.rotation.y = Math.PI / 4;
  group.add(registerMesh(roof, true));

  // Rainwater Gutter & Chimney
  addBox(10.8, 0.12, 0.14, cx, 6.62, 6.82, matIron, false, 'gutter', false);
  addBox(0.68, 2.0, 0.68, -24.5, 8.2, -1.8, matAlmasik, false, 'chimney', false);
  addBox(0.84, 0.14, 0.84, -24.5, 9.22, -1.8, matStone, false, 'chimney_cap', false);

  // Connecting low stone garden walls
  addBox(1.5, 1.35, 0.34, -16.25, 0.675, 5.75, matStone, true, 'garden_wall_w');
  addBox(1.5, 0.14, 0.44, -16.25, 1.4, 5.75, matKiremit, false, 'gw_cap1', false);
  addBox(1.7, 1.35, 0.34, -4.65, 0.675, 5.75, matStone, true, 'garden_wall_e');
  addBox(1.7, 0.14, 0.44, -4.65, 1.4, 5.75, matKiremit, false, 'gw_cap2', false);

  // =========================================================================
  // 9. WARM INTERIOR LIGHTS + PC RGB / SCREEN GLOW
  // =========================================================================
  const gfLight = new THREE.PointLight(0xffb55a, 6.2, 11, 1.6);
  gfLight.position.set(-19.5, 3.05, 0.6);
  group.add(gfLight);
  lights.push(gfLight);

  const hallLight = new THREE.PointLight(0xffb968, 5.5, 10, 1.6);
  hallLight.position.set(-23.5, 3.05, 2.2);
  group.add(hallLight);
  lights.push(hallLight);

  const upperRoomLight = new THREE.PointLight(0xffe0b2, 5.5, 12, 1.5);
  upperRoomLight.position.set(-19.6, 6.22, -0.2);
  group.add(upperRoomLight);
  lights.push(upperRoomLight);

  const upperHallLight = new THREE.PointLight(0xffb866, 5.0, 10, 1.6);
  upperHallLight.position.set(-23.6, 6.22, 2.2);
  group.add(upperHallLight);
  lights.push(upperHallLight);

  const pcRgbLight = new THREE.PointLight(0xff5e8a, 1.8, 3.2, 1.8);
  pcRgbLight.position.set(-18.1, 4.55, -3.2);
  group.add(pcRgbLight);
  lights.push(pcRgbLight);

  const monitorGlowLight = new THREE.PointLight(0x7ac7ff, 1.6, 3.0, 1.8);
  monitorGlowLight.position.set(-19.0, 4.85, -3.35);
  group.add(monitorGlowLight);
  lights.push(monitorGlowLight);

  [[-19.5, 3.25, 0.6], [-23.5, 3.25, 2.2], [-19.6, 6.42, -0.2], [-23.6, 6.42, 2.2]].forEach(([lx, ly, lz]) => {
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.22, 12), matBrass);
    shade.position.set(lx, ly, lz);
    group.add(shade);
  });

  // Helper to update live monitor display + PC RGB tint
  const updateSetupVisuals = (time, pcActive) => {
    const hue = (time * 0.18) % 1;
    const rgbColor = new THREE.Color().setHSL(hue, 0.88, 0.58);
    matRgbStrip.color.copy(rgbColor);
    matRgbStrip.emissive.copy(rgbColor);
    pcRgbLight.color.copy(rgbColor);

    if (pcActive) {
      monitorGlowLight.intensity = 1.9 + Math.sin(time * 7) * 0.2;
      sCtx.fillStyle = '#0d1522';
      sCtx.fillRect(0, 0, 512, 288);
      // Mini vibrant game/desktop HUD on monitor
      const grad = sCtx.createLinearGradient(0, 0, 512, 288);
      grad.addColorStop(0, '#142a4a');
      grad.addColorStop(1, '#2c1842');
      sCtx.fillStyle = grad;
      sCtx.fillRect(14, 14, 484, 240);
      // Animated waveforms / UI bars
      sCtx.fillStyle = '#4ad7ff';
      for (let i = 0; i < 8; i++) {
        const bh = 35 + Math.sin(time * 4 + i * 0.9) * 28;
        sCtx.fillRect(42 + i * 54, 210 - bh, 34, bh);
      }
      sCtx.fillStyle = '#ffd166';
      sCtx.font = 'bold 20px monospace';
      sCtx.fillText('ALACA CITY DEV · LIVE', 36, 56);
    } else {
      monitorGlowLight.intensity = 0.28;
      sCtx.fillStyle = '#07090d';
      sCtx.fillRect(0, 0, 512, 288);
      sCtx.fillStyle = '#1b2434';
      sCtx.fillRect(18, 18, 476, 252);
    }
    screenTex.needsUpdate = true;
  };
  updateSetupVisuals(0, false);

  return {
    group,
    colliders,
    cameraColliders,
    walkableSurfaces,
    lights,
    door: doorController,
    setupInfo: {
      chairSeatPos: new THREE.Vector3(-18.96, 4.18, -2.9),
      chairStandPos: new THREE.Vector3(-19.55, 3.72, -2.55),
      chairYaw: Math.PI, // Facing -Z toward monitor
      bedPos: new THREE.Vector3(-18.25, 4.24, 2.85),
      bedStandPos: new THREE.Vector3(-19.35, 3.72, 2.45),
      updateSetupVisuals,
    },
    bounds: { minX, maxX, minZ, maxZ, label: 'Tokat Gamer House #2 (Enterable)' },
  };
}
