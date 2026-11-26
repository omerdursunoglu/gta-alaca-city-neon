import * as THREE from 'three';
import { PEDESTRIAN_WAYPOINTS, getGroundHeightAt, resolveEntityCollisions } from '../world/mapLoader.js';

const OUTFIT_PALETTES = [
  { coat: 0x3b4d63, pants: 0x22262d, skin: 0xdab08c, hair: 0x241c18, hat: false },
  { coat: 0x7c382c, pants: 0x2f2a26, skin: 0xd09f7a, hair: 0x1a1513, hat: true },
  { coat: 0x4b5e42, pants: 0x29323c, skin: 0xe0b692, hair: 0x3c2c22, hat: false },
  { coat: 0x876843, pants: 0x232429, skin: 0xc99672, hair: 0x565656, hat: true },
  { coat: 0x30333a, pants: 0x1b1e24, skin: 0xd7a885, hair: 0x201916, hat: false },
  { coat: 0x5c3d59, pants: 0x2b2d36, skin: 0xdeb493, hair: 0x2a1f19, hat: false },
];

export class NPCManager {
  constructor(scene, indoorRefs = {}) {
    this.scene = scene;
    this.indoorRefs = indoorRefs;
    this.npcs = [];
    this.group = new THREE.Group();
    this.group.name = 'Pedestrians';
    this.scene.add(this.group);

    this._spawnPedestrians(10);
    this._initIndoorNPCs();
  }

  _spawnPedestrians(count) {
    for (let i = 0; i < count; i++) {
      const wpIndex = i % PEDESTRIAN_WAYPOINTS.length;
      const wp = PEDESTRIAN_WAYPOINTS[wpIndex];
      const neighbors = wp.neighbors;
      const targetIndex = neighbors[Math.floor(Math.random() * neighbors.length)];

      const palette = OUTFIT_PALETTES[i % OUTFIT_PALETTES.length];
      const meshData = this._createNPCMesh(palette);
      meshData.root.position.set(wp.x + (Math.random() - 0.5) * 0.8, 0.14, wp.z + (Math.random() - 0.5) * 0.8);
      this.group.add(meshData.root);

      this.npcs.push({
        id: i,
        ...meshData,
        position: meshData.root.position,
        yaw: 0,
        hp: 100,
        state: 'WALK', // WALK | PANIC | DOWN
        panicTimer: 0,
        downTimer: 0,
        fleeDir: new THREE.Vector3(1, 0, 0),
        currentWp: wpIndex,
        targetWp: targetIndex,
        walkSpeed: 1.45 + Math.random() * 0.45,
        sprintSpeed: 4.9 + Math.random() * 0.8,
        walkCycle: Math.random() * Math.PI * 2,
      });
    }
  }

  _createNPCMesh(pal) {
    const root = new THREE.Group();
    const matCoat = new THREE.MeshStandardMaterial({ color: pal.coat, roughness: 0.78 });
    const matPants = new THREE.MeshStandardMaterial({ color: pal.pants, roughness: 0.85 });
    const matSkin = new THREE.MeshStandardMaterial({ color: pal.skin, roughness: 0.65 });
    const matHair = new THREE.MeshStandardMaterial({ color: pal.hair, roughness: 0.8 });

    const part = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };

    const bodyPivot = new THREE.Group();
    bodyPivot.position.y = 0.85;
    root.add(bodyPivot);

    const torso = part(new THREE.BoxGeometry(0.4, 0.54, 0.22), matCoat, 0, 0.3, 0);
    const head = part(new THREE.BoxGeometry(0.21, 0.23, 0.21), matSkin, 0, 0.72, 0);
    const hair = part(new THREE.BoxGeometry(0.23, 0.1, 0.23), matHair, 0, 0.82, -0.01);
    bodyPivot.add(torso, head, hair);

    if (pal.hat) {
      const cap = part(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 10), matPants, 0, 0.87, 0);
      bodyPivot.add(cap);
    }

    const leftArm = new THREE.Group();
    leftArm.position.set(-0.26, 0.52, 0);
    leftArm.add(part(new THREE.BoxGeometry(0.11, 0.48, 0.11), matCoat, 0, -0.22, 0));
    bodyPivot.add(leftArm);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.26, 0.52, 0);
    rightArm.add(part(new THREE.BoxGeometry(0.11, 0.48, 0.11), matCoat, 0, -0.22, 0));
    bodyPivot.add(rightArm);

    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.1, 0.04, 0);
    leftLeg.add(part(new THREE.BoxGeometry(0.14, 0.76, 0.14), matPants, 0, -0.38, 0));
    bodyPivot.add(leftLeg);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.1, 0.04, 0);
    rightLeg.add(part(new THREE.BoxGeometry(0.14, 0.76, 0.14), matPants, 0, -0.38, 0));
    bodyPivot.add(rightLeg);

    // Hitbox collider mesh for raycasting shots
    const hitbox = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 1.68, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.position.y = 0.84;
    hitbox.userData.npcRef = null;
    root.add(hitbox);

    return { root, bodyPivot, leftArm, rightArm, leftLeg, rightLeg, hitbox };
  }

  getHitboxes() {
    const list = this.npcs.filter((n) => n.state !== 'DOWN').map((n) => {
      n.hitbox.userData.npc = n;
      return n.hitbox;
    });
    if (this.movieNpc && this.movieNpc.hitbox && this.movieNpc.state !== 'DOWN' && this.movieNpc.state !== 'CUTSCENE_CONTROLLED') {
      this.movieNpc.hitbox.userData.npc = this.movieNpc;
      list.push(this.movieNpc.hitbox);
    }
    return list;
  }

  alertPanic(origin, radius = 26) {
    for (const npc of this.npcs) {
      if (npc.state === 'DOWN') continue;
      const dist = npc.position.distanceTo(origin);
      if (dist <= radius) {
        npc.state = 'PANIC';
        npc.panicTimer = 9 + Math.random() * 5;
        npc.fleeDir.subVectors(npc.position, origin);
        npc.fleeDir.y = 0;
        if (npc.fleeDir.lengthSq() < 0.01) npc.fleeDir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
        npc.fleeDir.normalize();
      }
    }
  }

  damageNPC(npc, damage, sourcePos) {
    if (!npc || npc.state === 'DOWN') return { knockedDown: false };
    npc.hp -= damage;

    if (npc === this.movieNpc) {
      if (npc.hp <= 0) {
        npc.hp = 0;
        npc.state = 'DOWN';
        npc.downTimer = 12;
        npc.root.rotation.x = -Math.PI / 2;
        npc.position.y = Math.max(npc.position.y, 0.25);
        if (npc.phoneLight) npc.phoneLight.intensity = 0;
        return { knockedDown: true };
      }
      if (npc.state === 'WATCHING') {
        npc.state = 'CHASE_PLAYER';
        npc.chaseTimer = 14;
        npc.phoneGroup.visible = false;
        npc.phoneLight.intensity = 0;
        npc.slipperMesh.visible = true;
        npc.root.position.copy(npc.bedStandPos);
      }
      return { knockedDown: false };
    }

    this.alertPanic(sourcePos, 28);

    if (npc.hp <= 0) {
      npc.hp = 0;
      npc.state = 'DOWN';
      npc.downTimer = 11;
      npc.root.rotation.x = -Math.PI / 2;
      npc.position.y = 0.25;
      return { knockedDown: true };
    } else {
      npc.state = 'PANIC';
      npc.panicTimer = 12;
      npc.fleeDir.subVectors(npc.position, sourcePos).setY(0).normalize();
      return { knockedDown: false };
    }
  }

  _initIndoorNPCs() {
    this.gamerNpc = null;
    this.movieNpc = null;

    if (this.indoorRefs.gamerSetup) {
      this.gamerNpc = this._createHandsomeGamerNPC(this.indoorRefs.gamerSetup);
      this.group.add(this.gamerNpc.root);
    }

    if (this.indoorRefs.movieBedroom) {
      this.movieNpc = this._createMovieWatcherNPC(this.indoorRefs.movieBedroom);
      this.group.add(this.movieNpc.root);
    }
  }

  _createHandsomeGamerNPC(setup) {
    const root = new THREE.Group();
    root.name = 'HandsomeGamerNPC';

    const matSkin = new THREE.MeshStandardMaterial({ color: 0xe0b38d, roughness: 0.52 });
    const matHair = new THREE.MeshStandardMaterial({ color: 0x181311, roughness: 0.72 });
    const matHoodie = new THREE.MeshStandardMaterial({ color: 0x263447, roughness: 0.72 });
    const matTee = new THREE.MeshStandardMaterial({ color: 0xf1ede6, roughness: 0.78 });
    const matJoggers = new THREE.MeshStandardMaterial({ color: 0x1f2229, roughness: 0.85 });
    const matSneaker = new THREE.MeshStandardMaterial({ color: 0xf4f2ed, roughness: 0.5 });

    const part = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };

    const bodyPivot = new THREE.Group();
    bodyPivot.position.y = 0.86;
    root.add(bodyPivot);

    // Athletic torso & white tee V-trim
    const torso = part(new THREE.BoxGeometry(0.41, 0.54, 0.22), matHoodie, 0, 0.3, 0);
    const tee = part(new THREE.BoxGeometry(0.14, 0.24, 0.23), matTee, 0, 0.44, 0.005);
    bodyPivot.add(torso, tee);

    // Handsome sculpted head: styled quiff hair, defined brows, eyes, nose, light beard shadow
    const head = new THREE.Group();
    head.position.set(0, 0.62, 0);
    head.add(part(new THREE.CylinderGeometry(0.058, 0.068, 0.1, 10), matSkin, 0, -0.02, 0));
    head.add(part(new THREE.BoxGeometry(0.2, 0.23, 0.21), matSkin, 0, 0.12, 0));
    // Styled fade & voluminous front quiff
    head.add(part(new THREE.BoxGeometry(0.215, 0.09, 0.225), matHair, 0, 0.24, 0.01));
    head.add(part(new THREE.BoxGeometry(0.19, 0.06, 0.1), matHair, 0, 0.28, 0.07));
    head.add(part(new THREE.BoxGeometry(0.21, 0.14, 0.06), matHair, 0, 0.14, -0.09));
    // Eyes, brows & nose
    head.add(part(new THREE.BoxGeometry(0.045, 0.016, 0.02), matHair, -0.045, 0.16, 0.105));
    head.add(part(new THREE.BoxGeometry(0.045, 0.016, 0.02), matHair, 0.045, 0.16, 0.105));
    head.add(part(new THREE.BoxGeometry(0.025, 0.02, 0.02), matHair, -0.045, 0.135, 0.104));
    head.add(part(new THREE.BoxGeometry(0.025, 0.02, 0.02), matHair, 0.045, 0.135, 0.104));
    head.add(part(new THREE.BoxGeometry(0.028, 0.045, 0.03), matSkin, 0, 0.115, 0.115));
    bodyPivot.add(head);

    // Articulated Arms
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.26, 0.52, 0);
    leftArm.add(part(new THREE.BoxGeometry(0.11, 0.46, 0.11), matHoodie, 0, -0.21, 0));
    leftArm.add(part(new THREE.BoxGeometry(0.085, 0.09, 0.085), matSkin, 0, -0.46, 0));
    bodyPivot.add(leftArm);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.26, 0.52, 0);
    rightArm.add(part(new THREE.BoxGeometry(0.11, 0.46, 0.11), matHoodie, 0, -0.21, 0));
    rightArm.add(part(new THREE.BoxGeometry(0.085, 0.09, 0.085), matSkin, 0, -0.46, 0));
    bodyPivot.add(rightArm);

    // Articulated Legs (Hip + Knee joint so he can bend knees naturally when sitting on the gaming chair!)
    const makeLeg = (lx) => {
      const hip = new THREE.Group();
      hip.position.set(lx, 0.04, 0);
      hip.add(part(new THREE.BoxGeometry(0.145, 0.4, 0.145), matJoggers, 0, -0.2, 0));
      const knee = new THREE.Group();
      knee.position.set(0, -0.4, 0);
      knee.add(part(new THREE.BoxGeometry(0.13, 0.36, 0.13), matJoggers, 0, -0.18, 0));
      knee.add(part(new THREE.BoxGeometry(0.14, 0.09, 0.23), matSneaker, 0, -0.38, 0.04));
      hip.add(knee);
      bodyPivot.add(hip);
      return { hip, knee };
    };
    const leftLeg = makeLeg(-0.1);
    const rightLeg = makeLeg(0.1);

    root.position.copy(setup.bedPos);

    return {
      root,
      bodyPivot,
      head,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      setup,
      state: 'LYING_IN_BED', // LYING_IN_BED -> WALK_TO_PC -> SITTING_AT_PC -> WALK_TO_BED
      timer: 6.5,
      walkPhase: 0,
      yaw: Math.PI,
    };
  }

  _createMovieWatcherNPC(bedroomInfo) {
    const root = new THREE.Group();
    root.name = 'MovieWatcherNPC';

    const bedPos = bedroomInfo.bedPos.clone(); // (-6.65, 4.32, -2.5)
    const bedRestPos = new THREE.Vector3(bedPos.x, 4.30, -2.52);
    const bedStandPos = new THREE.Vector3(-7.78, 3.72, -2.05);
    root.position.copy(bedRestPos);

    const matSkin = new THREE.MeshStandardMaterial({ color: 0xe2b48d, roughness: 0.52 });
    const matHair = new THREE.MeshStandardMaterial({ color: 0x221712, roughness: 0.76 });
    const matEyeWhite = new THREE.MeshStandardMaterial({ color: 0xf6f3ee, roughness: 0.3 });
    const matEyeDark = new THREE.MeshStandardMaterial({ color: 0x161210, roughness: 0.2 });
    const matCardigan = new THREE.MeshStandardMaterial({ color: 0x763242, roughness: 0.78 });
    const matUndershirt = new THREE.MeshStandardMaterial({ color: 0xf1ece1, roughness: 0.82 });
    const matPants = new THREE.MeshStandardMaterial({ color: 0x262b35, roughness: 0.84 });
    const matSlipper = new THREE.MeshStandardMaterial({ color: 0x2f638f, roughness: 0.7 });
    const matSlipperSole = new THREE.MeshStandardMaterial({ color: 0xe6dfd3, roughness: 0.8 });
    const matPhoneBody = new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.28, metalness: 0.7 });

    const part = (geo, mat, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };

    const bodyPivot = new THREE.Group();
    bodyPivot.position.y = 0.09;
    root.add(bodyPivot);

    // Pelvis
    bodyPivot.add(part(new THREE.BoxGeometry(0.37, 0.14, 0.22), matPants, 0, 0, 0));

    // Torso
    const torsoPivot = new THREE.Group();
    torsoPivot.position.y = 0.06;
    bodyPivot.add(torsoPivot);

    torsoPivot.add(part(new THREE.BoxGeometry(0.41, 0.52, 0.23), matCardigan, 0, 0.27, 0));
    torsoPivot.add(part(new THREE.BoxGeometry(0.15, 0.34, 0.24), matUndershirt, 0, 0.35, 0.005));
    // Collar detail
    torsoPivot.add(part(new THREE.BoxGeometry(0.24, 0.06, 0.245), matCardigan, 0, 0.51, -0.005));

    // Sculpted Expressive Head
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.54, 0);
    torsoPivot.add(headPivot);

    headPivot.add(part(new THREE.CylinderGeometry(0.058, 0.068, 0.1, 10), matSkin, 0, 0.03, 0));
    headPivot.add(part(new THREE.BoxGeometry(0.21, 0.23, 0.21), matSkin, 0, 0.17, 0));
    // Layered Hair
    headPivot.add(part(new THREE.BoxGeometry(0.225, 0.085, 0.225), matHair, 0, 0.295, -0.005));
    headPivot.add(part(new THREE.BoxGeometry(0.20, 0.05, 0.09), matHair, 0, 0.32, 0.065));
    headPivot.add(part(new THREE.BoxGeometry(0.22, 0.15, 0.06), matHair, 0, 0.19, -0.092));
    // Eyes (Whites + Pupils)
    headPivot.add(part(new THREE.BoxGeometry(0.042, 0.028, 0.016), matEyeWhite, -0.048, 0.185, 0.104));
    headPivot.add(part(new THREE.BoxGeometry(0.042, 0.028, 0.016), matEyeWhite, 0.048, 0.185, 0.104));
    headPivot.add(part(new THREE.BoxGeometry(0.022, 0.024, 0.02), matEyeDark, -0.048, 0.184, 0.106));
    headPivot.add(part(new THREE.BoxGeometry(0.022, 0.024, 0.02), matEyeDark, 0.048, 0.184, 0.106));
    // Expressive Brows (can angle furiously!)
    const leftBrow = part(new THREE.BoxGeometry(0.052, 0.016, 0.022), matHair, -0.048, 0.215, 0.107);
    const rightBrow = part(new THREE.BoxGeometry(0.052, 0.016, 0.022), matHair, 0.048, 0.215, 0.107);
    headPivot.add(leftBrow, rightBrow);
    // Nose, Mustache & Mouth
    headPivot.add(part(new THREE.BoxGeometry(0.028, 0.044, 0.03), matSkin, 0, 0.155, 0.115));
    headPivot.add(part(new THREE.BoxGeometry(0.068, 0.015, 0.02), matHair, 0, 0.125, 0.108));
    const mouth = part(new THREE.BoxGeometry(0.055, 0.016, 0.018), matEyeDark, 0, 0.102, 0.105);
    headPivot.add(mouth);

    // Articulated Left & Right Arms (Upper + Forearm + Hand)
    const makeArm = (ax) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(ax, 0.46, 0);
      shoulder.add(part(new THREE.BoxGeometry(0.11, 0.26, 0.11), matCardigan, 0, -0.12, 0));
      const forearm = new THREE.Group();
      forearm.position.set(0, -0.25, 0);
      forearm.add(part(new THREE.BoxGeometry(0.095, 0.23, 0.095), matCardigan, 0, -0.1, 0));
      const hand = new THREE.Group();
      hand.position.set(0, -0.23, 0);
      hand.add(part(new THREE.BoxGeometry(0.085, 0.085, 0.085), matSkin, 0, -0.02, 0));
      forearm.add(hand);
      shoulder.add(forearm);
      torsoPivot.add(shoulder);
      return { shoulder, forearm, hand };
    };
    const leftArm = makeArm(-0.26);
    const rightArm = makeArm(0.26);

    // Classic Terlik (Slipper) weapon in right hand (shown when attacking!)
    const slipperMesh = new THREE.Group();
    slipperMesh.position.set(0, -0.04, 0.09);
    slipperMesh.rotation.x = Math.PI * 0.45;
    slipperMesh.add(part(new THREE.BoxGeometry(0.105, 0.028, 0.25), matSlipperSole, 0, 0, 0));
    slipperMesh.add(part(new THREE.BoxGeometry(0.11, 0.036, 0.11), matSlipper, 0, 0.025, 0.03));
    slipperMesh.visible = false;
    rightArm.hand.add(slipperMesh);

    // Smartphone & Animated Movie CanvasTexture (held comfortably in front of face when watching)
    const phoneGroup = new THREE.Group();
    phoneGroup.position.set(0, 0.39, 0.44);
    phoneGroup.rotation.x = 0.52; // Screen faces back toward his eyes
    torsoPivot.add(phoneGroup);

    const phoneBody = part(new THREE.BoxGeometry(0.21, 0.125, 0.015), matPhoneBody, 0, 0, 0);
    phoneBody.castShadow = false;
    phoneGroup.add(phoneBody);

    const movieCanvas = document.createElement('canvas');
    movieCanvas.width = 256;
    movieCanvas.height = 144;
    const mCtx = movieCanvas.getContext('2d');
    const movieTex = new THREE.CanvasTexture(movieCanvas);
    movieTex.colorSpace = THREE.SRGBColorSpace;
    const screenMat = new THREE.MeshBasicMaterial({ map: movieTex, toneMapped: false });
    const screenPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.192, 0.108), screenMat);
    screenPlane.position.set(0, 0, -0.009);
    screenPlane.rotation.y = Math.PI;
    phoneGroup.add(screenPlane);

    // Balanced soft glow onto face (never blows out or clips)
    const phoneLight = new THREE.PointLight(0x7cc7ff, 1.8, 1.85, 1.6);
    phoneLight.position.set(0, 0, -0.14);
    phoneGroup.add(phoneLight);

    // Articulated Legs (Hip + Knee + Lounge Slippers)
    const makeLeg = (lx) => {
      const hip = new THREE.Group();
      hip.position.set(lx, -0.02, 0);
      hip.add(part(new THREE.BoxGeometry(0.145, 0.39, 0.145), matPants, 0, -0.19, 0));
      const knee = new THREE.Group();
      knee.position.set(0, -0.38, 0);
      knee.add(part(new THREE.BoxGeometry(0.13, 0.36, 0.13), matPants, 0, -0.18, 0));
      knee.add(part(new THREE.BoxGeometry(0.14, 0.075, 0.23), matSlipper, 0, -0.37, 0.04));
      hip.add(knee);
      bodyPivot.add(hip);
      return { hip, knee };
    };
    const leftLeg = makeLeg(-0.1);
    const rightLeg = makeLeg(0.1);

    const hitbox = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 1.68, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.position.y = 0.84;
    root.add(hitbox);

    const npcObj = {
      root,
      position: root.position,
      bodyPivot,
      torsoPivot,
      headPivot,
      leftBrow,
      rightBrow,
      mouth,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      phoneGroup,
      phoneLight,
      slipperMesh,
      movieCanvas,
      mCtx,
      movieTex,
      hitbox,
      bedPos,
      bedRestPos,
      bedStandPos,
      state: 'WATCHING', // WATCHING | CUTSCENE_CONTROLLED | CHASE_PLAYER | RETURN_TO_BED | DOWN
      hp: 100,
      yaw: 0,
      walkPhase: 0,
      chaseTimer: 0,
      attackCooldown: 0,
      swingTimer: 0,
      downTimer: 0,
    };

    this._poseMovieWatcherOnBed(npcObj, 0);
    return npcObj;
  }

  _poseMovieWatcherOnBed(m, t) {
    m.root.position.copy(m.bedRestPos);
    m.root.rotation.set(0, 0, 0);
    m.yaw = 0;

    m.bodyPivot.position.set(0, 0.09, 0);
    m.bodyPivot.rotation.set(0, 0, 0);

    // Torso reclined cleanly against pillow without sinking
    m.torsoPivot.rotation.set(-1.36, 0, 0);
    // Head tilted slightly forward looking straight at phone screen
    m.headPivot.rotation.set(0.86, Math.sin(t * 0.65) * 0.05, 0);

    // Relaxed brows & closed mouth
    m.leftBrow.rotation.z = 0;
    m.rightBrow.rotation.z = 0;
    m.mouth.scale.set(1, 1, 1);

    // Arms raised comfortably holding phone in front of face
    m.leftArm.shoulder.rotation.set(-0.92, 0.24, -0.14);
    m.leftArm.forearm.rotation.set(-0.95, 0, 0.34);
    m.rightArm.shoulder.rotation.set(-0.92, -0.24, 0.14);
    m.rightArm.forearm.rotation.set(-0.95, 0, -0.34);

    // Legs stretched on quilt with one relaxed bent knee
    m.leftLeg.hip.rotation.set(-Math.PI * 0.49, 0, 0.03);
    m.leftLeg.knee.rotation.set(0.06, 0, 0);
    m.rightLeg.hip.rotation.set(-Math.PI * 0.68, 0, -0.04);
    m.rightLeg.knee.rotation.set(0.55, 0, 0);

    m.phoneGroup.visible = true;
    m.slipperMesh.visible = false;
  }

  poseMovieWatcherStanding(m, dt, moveSpeed = 0, { angry = false, swinging = false, t = 0 } = {}) {
    m.bodyPivot.position.set(0, 0.86, 0);
    m.bodyPivot.rotation.set(0, 0, 0);
    m.torsoPivot.rotation.set(moveSpeed > 2 ? 0.14 : 0.03, 0, 0);
    m.headPivot.rotation.set(0, 0, 0);

    if (angry) {
      m.leftBrow.rotation.z = -0.38;
      m.rightBrow.rotation.z = 0.38;
      m.mouth.scale.set(1.25, 1.9, 1);
    } else {
      m.leftBrow.rotation.z = 0;
      m.rightBrow.rotation.z = 0;
      m.mouth.scale.set(1, 1, 1);
    }

    if (moveSpeed > 0.2) {
      m.walkPhase += dt * (moveSpeed > 3.5 ? 13.5 : 7.5);
      const sw = Math.sin(m.walkPhase) * (moveSpeed > 3.5 ? 0.76 : 0.48);
      m.leftLeg.hip.rotation.set(sw, 0, 0);
      m.rightLeg.hip.rotation.set(-sw, 0, 0);
      m.leftLeg.knee.rotation.set(Math.max(0, Math.cos(m.walkPhase)) * 0.55, 0, 0);
      m.rightLeg.knee.rotation.set(Math.max(0, -Math.cos(m.walkPhase)) * 0.55, 0, 0);
      m.leftArm.shoulder.rotation.set(-sw * 0.7, 0, 0.1);
      m.leftArm.forearm.rotation.set(-0.35, 0, 0);
    } else {
      m.leftLeg.hip.rotation.set(0, 0, 0);
      m.rightLeg.hip.rotation.set(0, 0, 0);
      m.leftLeg.knee.rotation.set(0, 0, 0);
      m.rightLeg.knee.rotation.set(0, 0, 0);
      m.leftArm.shoulder.rotation.set(-0.25, 0, 0.15);
      m.leftArm.forearm.rotation.set(-0.4, 0, 0);
    }

    if (swinging) {
      const p = Math.sin(t * 16);
      m.rightArm.shoulder.rotation.set(-2.05 + p * 0.95, 0, -0.18);
      m.rightArm.forearm.rotation.set(-0.35 + p * 0.4, 0, 0);
    } else if (angry) {
      m.rightArm.shoulder.rotation.set(-1.35 + Math.sin(m.walkPhase) * 0.35, 0, -0.15);
      m.rightArm.forearm.rotation.set(-0.65, 0, 0);
    } else {
      const sw = moveSpeed > 0.2 ? Math.sin(m.walkPhase) * 0.45 : 0;
      m.rightArm.shoulder.rotation.set(sw * 0.7, 0, -0.1);
      m.rightArm.forearm.rotation.set(-0.25, 0, 0);
    }
  }

  _updateIndoorNPCs(dt) {
    const t = performance.now() * 0.001;

    // 1. Update Handsome Gamer NPC (Hero House #3 2nd Floor)
    if (this.gamerNpc) {
      const g = this.gamerNpc;
      const s = g.setup;
      g.timer -= dt;

      if (g.state === 'LYING_IN_BED') {
        s.updateSetupVisuals(t, false);
        g.root.position.set(s.bedPos.x, s.bedPos.y + 0.06, s.bedPos.z + 0.45);
        g.root.rotation.set(0, Math.PI, 0);
        g.bodyPivot.position.y = 0.14;
        g.bodyPivot.rotation.set(-Math.PI / 2, 0, 0); // Lying flat on bed
        g.leftLeg.hip.rotation.x = 0;
        g.rightLeg.hip.rotation.x = 0;
        g.leftLeg.knee.rotation.x = 0;
        g.rightLeg.knee.rotation.x = 0;
        g.leftArm.rotation.set(-0.2 + Math.sin(t * 2) * 0.04, 0, 0.15);
        g.rightArm.rotation.set(-0.2 - Math.sin(t * 2) * 0.04, 0, -0.15);
        g.head.rotation.set(0.25, Math.sin(t * 0.7) * 0.12, 0);

        if (g.timer <= 0) {
          g.state = 'WALK_TO_PC';
          g.root.position.copy(s.bedStandPos);
          g.bodyPivot.position.y = 0.86;
          g.bodyPivot.rotation.set(0, 0, 0);
        }
      } else if (g.state === 'WALK_TO_PC' || g.state === 'WALK_TO_BED') {
        s.updateSetupVisuals(t, g.state === 'WALK_TO_PC');
        const target = g.state === 'WALK_TO_PC' ? s.chairStandPos : s.bedStandPos;
        const dx = target.x - g.root.position.x;
        const dz = target.z - g.root.position.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 0.12) {
          if (g.state === 'WALK_TO_PC') {
            g.state = 'SITTING_AT_PC';
            g.timer = 11.0;
          } else {
            g.state = 'LYING_IN_BED';
            g.timer = 8.0;
          }
        } else {
          const speed = 1.55;
          g.root.position.x += (dx / dist) * speed * dt;
          g.root.position.z += (dz / dist) * speed * dt;
          g.root.position.y = 3.72;
          const targetYaw = Math.atan2(dx, dz);
          g.root.rotation.y = targetYaw;

          g.walkPhase += dt * 7.5;
          const sw = Math.sin(g.walkPhase) * 0.55;
          g.leftLeg.hip.rotation.x = sw;
          g.rightLeg.hip.rotation.x = -sw;
          g.leftLeg.knee.rotation.x = Math.max(0, Math.cos(g.walkPhase)) * 0.5;
          g.rightLeg.knee.rotation.x = Math.max(0, -Math.cos(g.walkPhase)) * 0.5;
          g.leftArm.rotation.set(-sw * 0.65, 0, 0.08);
          g.rightArm.rotation.set(sw * 0.65, 0, -0.08);
          g.head.rotation.set(0, 0, 0);
        }
      } else if (g.state === 'SITTING_AT_PC') {
        s.updateSetupVisuals(t, true);
        g.root.position.copy(s.chairSeatPos);
        g.root.rotation.set(0, s.chairYaw, 0);
        g.bodyPivot.position.y = 0.06;
        g.bodyPivot.rotation.set(0.06, 0, 0);
        // Bent knees sitting cleanly on the Rampage chair
        g.leftLeg.hip.rotation.x = -Math.PI * 0.48;
        g.rightLeg.hip.rotation.x = -Math.PI * 0.48;
        g.leftLeg.knee.rotation.x = Math.PI * 0.48;
        g.rightLeg.knee.rotation.x = Math.PI * 0.48;
        // Typing on mechanical keyboard & gliding mouse
        g.leftArm.rotation.set(-1.05 + Math.sin(t * 14) * 0.08, 0.14, 0.06);
        g.rightArm.rotation.set(-1.02 + Math.cos(t * 5) * 0.05, -0.18 + Math.sin(t * 3.5) * 0.1, -0.06);
        g.head.rotation.set(0.05, Math.sin(t * 1.1) * 0.08, 0);

        if (g.timer <= 0) {
          g.state = 'WALK_TO_BED';
          g.root.position.copy(s.chairStandPos);
          g.bodyPivot.position.y = 0.86;
          g.bodyPivot.rotation.set(0, 0, 0);
        }
      }
    }

    // 2. Update Movie-Watching NPC (Hero House #2 2nd Floor Bedroom)
    if (this.movieNpc) {
      const m = this.movieNpc;
      const ctx = m.mCtx;

      // Keep movie texture playing whenever phone is visible
      if (m.phoneGroup.visible) {
        const phase = (t * 0.45) % 3;
        let tintR = 110;
        let tintG = 190;
        let tintB = 255;

        if (phase < 1) {
          // Scene 1: Night rooftop chase thriller
          const grad = ctx.createLinearGradient(0, 0, 0, 144);
          grad.addColorStop(0, '#07142b');
          grad.addColorStop(1, '#1a4978');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 256, 144);
          // Skyline silhouettes
          ctx.fillStyle = '#09111f';
          [12, 54, 92, 138, 184, 220].forEach((bx, idx) => {
            const bh = 42 + ((idx * 17) % 38);
            ctx.fillRect(bx, 126 - bh, 32, bh);
          });
          // Moving car headlights
          const mx = ((t * 75) % 270) - 25;
          ctx.fillStyle = '#7de2ff';
          ctx.fillRect(mx, 92, 34, 14);
          ctx.fillStyle = '#fff5b8';
          ctx.fillRect(mx + 30, 95, 12, 8);
          tintR = 110; tintG = 200; tintB = 255;
        } else if (phase < 2) {
          // Scene 2: Warm Anatolian sunset showdown
          const grad = ctx.createLinearGradient(0, 0, 0, 144);
          grad.addColorStop(0, '#6c1f18');
          grad.addColorStop(1, '#f59c38');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 256, 144);
          ctx.fillStyle = '#ffe5a3';
          ctx.beginPath();
          ctx.arc(128 + Math.sin(t * 1.4) * 26, 66, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#23100d';
          ctx.fillRect(0, 100, 256, 28);
          ctx.fillRect(92, 62, 18, 42);
          ctx.fillRect(148, 66, 18, 38);
          tintR = 255; tintG = 175; tintB = 95;
        } else {
          // Scene 3: Neon sci-fi explosion climax
          ctx.fillStyle = '#220b34';
          ctx.fillRect(0, 0, 256, 144);
          ctx.fillStyle = '#ff4fa3';
          ctx.fillRect(34, 34, 84, 72);
          ctx.fillStyle = '#4be8ff';
          ctx.fillRect(140, 38, 82, 66);
          ctx.fillStyle = '#fff3b0';
          ctx.beginPath();
          ctx.arc(128, 72, 14 + Math.sin(t * 12) * 4, 0, Math.PI * 2);
          ctx.fill();
          tintR = 235; tintG = 135; tintB = 255;
        }

        // Cinema letterbox bars + animated subtitle bar
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 256, 18);
        ctx.fillRect(0, 126, 256, 18);
        ctx.fillStyle = '#ffe49e';
        ctx.fillRect(62, 115, 132, 4);
        m.movieTex.needsUpdate = true;

        const flicker = 0.88 + Math.sin(t * 10) * 0.08 + Math.cos(t * 17) * 0.06;
        m.phoneLight.color.setRGB(tintR / 255, tintG / 255, tintB / 255);
        m.phoneLight.intensity = 1.8 * flicker;
      }

      if (m.state === 'WATCHING') {
        this._poseMovieWatcherOnBed(m, t);
      } else if (m.state === 'DOWN') {
        m.downTimer -= dt;
        if (m.downTimer <= 0) {
          m.hp = 100;
          m.root.rotation.x = 0;
          m.state = 'WATCHING';
          this._poseMovieWatcherOnBed(m, t);
        }
      }
    }
  }

  updateMovieNpcGameplay(dt, playerPos, colliders, walkableSurfaces, { onHitPlayer, onGiveUp } = {}) {
    const m = this.movieNpc;
    if (!m) return;
    const t = performance.now() * 0.001;

    if (m.attackCooldown > 0) m.attackCooldown = Math.max(0, m.attackCooldown - dt);
    if (m.swingTimer > 0) m.swingTimer = Math.max(0, m.swingTimer - dt);

    if (m.state === 'CHASE_PLAYER') {
      m.chaseTimer -= dt;
      m.phoneGroup.visible = false;
      m.phoneLight.intensity = 0;
      m.slipperMesh.visible = true;

      const dx = playerPos.x - m.position.x;
      const dz = playerPos.z - m.position.z;
      const horizDist = Math.hypot(dx, dz);
      const totalDist = m.position.distanceTo(playerPos);

      if (m.chaseTimer <= 0 || totalDist > 22) {
        m.state = 'RETURN_TO_BED';
        onGiveUp?.();
        return;
      }

      let moveSpeed = 0;
      if (horizDist > 1.05) {
        moveSpeed = 4.65;
        m.position.x += (dx / horizDist) * moveSpeed * dt;
        m.position.z += (dz / horizDist) * moveSpeed * dt;
        resolveEntityCollisions(m.position, 0.32, 1.68, colliders, walkableSurfaces);
        m.position.y = getGroundHeightAt(m.position.x, m.position.z, m.position.y, walkableSurfaces);
        const targetYaw = Math.atan2(dx, dz);
        let diff = ((targetYaw - m.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (diff < -Math.PI) diff += Math.PI * 2;
        m.yaw += diff * Math.min(1, dt * 12);
        m.root.rotation.y = m.yaw;
      } else {
        m.yaw = Math.atan2(dx, dz);
        m.root.rotation.y = m.yaw;
        if (m.attackCooldown <= 0 && Math.abs(playerPos.y - m.position.y) < 1.5) {
          m.attackCooldown = 1.15;
          m.swingTimer = 0.42;
          onHitPlayer?.(m.position);
        }
      }

      this.poseMovieWatcherStanding(m, dt, moveSpeed, {
        angry: true,
        swinging: m.swingTimer > 0,
        t,
      });
    } else if (m.state === 'RETURN_TO_BED') {
      // Gently reset back to bed once player is far enough away
      if (m.position.distanceTo(playerPos) > 10 || playerPos.y < 2.2) {
        m.state = 'WATCHING';
        m.hp = 100;
        this._poseMovieWatcherOnBed(m, t);
      } else {
        m.chaseTimer -= dt;
        this.poseMovieWatcherStanding(m, dt, 0, { angry: true, swinging: false, t });
        if (m.chaseTimer < -8) {
          m.state = 'WATCHING';
          m.hp = 100;
          this._poseMovieWatcherOnBed(m, t);
        }
      }
    }
  }

  update(dt, colliders, walkableSurfaces) {
    this._updateIndoorNPCs(dt);
    for (const npc of this.npcs) {
      if (npc.state === 'DOWN') {
        npc.downTimer -= dt;
        if (npc.downTimer <= 0) {
          // Respawn cleanly at a waypoint
          const wp = PEDESTRIAN_WAYPOINTS[npc.currentWp];
          npc.position.set(wp.x, 0.14, wp.z);
          npc.root.rotation.x = 0;
          npc.hp = 100;
          npc.state = 'WALK';
        }
        continue;
      }

      let moveX = 0;
      let moveZ = 0;
      let speed = npc.walkSpeed;

      if (npc.state === 'PANIC') {
        npc.panicTimer -= dt;
        if (npc.panicTimer <= 0) {
          npc.state = 'WALK';
        } else {
          speed = npc.sprintSpeed;
          moveX = npc.fleeDir.x;
          moveZ = npc.fleeDir.z;
          // Bounce gently off map borders so fleeing NPCs stay inside 50m radius
          if (Math.abs(npc.position.x) > 45) npc.fleeDir.x *= -1;
          if (Math.abs(npc.position.z) > 45) npc.fleeDir.z *= -1;
        }
      }

      if (npc.state === 'WALK') {
        const target = PEDESTRIAN_WAYPOINTS[npc.targetWp];
        const dx = target.x - npc.position.x;
        const dz = target.z - npc.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.7) {
          const prev = npc.currentWp;
          npc.currentWp = npc.targetWp;
          const opts = PEDESTRIAN_WAYPOINTS[npc.currentWp].neighbors.filter((n) => n !== prev);
          const pool = opts.length > 0 ? opts : PEDESTRIAN_WAYPOINTS[npc.currentWp].neighbors;
          npc.targetWp = pool[Math.floor(Math.random() * pool.length)];
        } else {
          moveX = dx / dist;
          moveZ = dz / dist;
        }
      }

      const prevX = npc.position.x;
      const prevZ = npc.position.z;
      npc.position.x += moveX * speed * dt;
      npc.position.z += moveZ * speed * dt;
      resolveEntityCollisions(npc.position, 0.34, 1.7, colliders, walkableSurfaces);

      // If blocked while fleeing, steer perpendicular along street
      if (npc.state === 'PANIC') {
        const moved = Math.hypot(npc.position.x - prevX, npc.position.z - prevZ);
        if (moved < speed * dt * 0.25) {
          const rx = npc.fleeDir.x;
          npc.fleeDir.x = -npc.fleeDir.z;
          npc.fleeDir.z = rx;
        }
      }

      // Snap cleanly to street/sidewalk surface
      npc.position.y = Math.abs(npc.position.z - 11.5) < 3.1 ? 0.03 : 0.14;

      if (Math.hypot(moveX, moveZ) > 0.05) {
        const targetYaw = Math.atan2(moveX, moveZ);
        let diff = ((targetYaw - npc.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (diff < -Math.PI) diff += Math.PI * 2;
        npc.yaw += diff * Math.min(1, dt * 10);
      }
      npc.root.rotation.y = npc.yaw;

      // Animate limbs
      npc.walkCycle += dt * (npc.state === 'PANIC' ? 13 : 6.2);
      const s = Math.sin(npc.walkCycle) * (npc.state === 'PANIC' ? 0.85 : 0.48);
      npc.leftLeg.rotation.x = s;
      npc.rightLeg.rotation.x = -s;

      if (npc.state === 'PANIC') {
        // Waving arms in panic!
        npc.leftArm.rotation.x = -2.4 + Math.sin(npc.walkCycle * 1.4) * 0.45;
        npc.rightArm.rotation.x = -2.4 - Math.sin(npc.walkCycle * 1.4) * 0.45;
      } else {
        npc.leftArm.rotation.x = -s * 0.7;
        npc.rightArm.rotation.x = s * 0.7;
      }
    }
  }
}
