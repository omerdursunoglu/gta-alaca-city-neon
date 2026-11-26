import * as THREE from 'three';
import { getGroundHeightAt, resolveEntityCollisions } from '../world/mapLoader.js';

export const WEAPONS = [
  { id: 'fists', name: 'FISTS', icon: '👊', melee: true, range: 1.9, damage: 25, cooldown: 0.34, auto: false, magSize: 0 },
  { id: 'knife', name: 'COMBAT KNIFE', icon: '🔪', melee: true, range: 2.35, damage: 45, cooldown: 0.38, auto: false, magSize: 0 },
  { id: 'pistol', name: '9MM PISTOL', icon: '🔫', melee: false, range: 65, damage: 38, cooldown: 0.24, auto: false, magSize: 15, reloadTime: 1.15, spread: 0.012 },
  { id: 'm416', name: 'M416 5.56', icon: '💥', melee: false, range: 75, damage: 28, cooldown: 0.086, auto: true, magSize: 30, reloadTime: 1.45, spread: 0.022 },
];

export class Player {
  constructor(audioSynth) {
    this.audio = audioSynth;
    this.group = new THREE.Group();
    this.group.name = 'Player';

    // Spawn on cobblestone street facing North (-Z) framing Alaca Mescit Camii & both Hero Houses on left
    this.position = new THREE.Vector3(-4.5, 0.03, 14.2);
    this.velocity = new THREE.Vector3();
    this.yaw = Math.PI; // Model forward (+Z local) rotated by PI faces -Z
    this.radius = 0.34;
    this.height = 1.72;

    this.onGround = true;
    this.health = 100;
    this.stamina = 100;
    this.walkCycle = 0;
    this.lastStepPhase = 0;

    // Weapons & Combat State
    this.weaponIndex = 0;
    this.ammo = [0, 0, 15, 30];
    this.attackCooldown = 0;
    this.attackAnimTimer = 0;
    this.attackCombo = 0;
    this.reloadingTimer = 0;
    this.isAiming = false;
    this.muzzleFlashTimer = 0;

    this._buildCharacterMesh();
    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
    this.switchWeapon(0);
  }

  _buildCharacterMesh() {
    const matSkin = new THREE.MeshStandardMaterial({ color: 0xd9a782, roughness: 0.65 });
    const matHair = new THREE.MeshStandardMaterial({ color: 0x1e1815, roughness: 0.8 });
    const matJacket = new THREE.MeshStandardMaterial({ color: 0x262930, roughness: 0.55, metalness: 0.1 });
    const matShirt = new THREE.MeshStandardMaterial({ color: 0xc97b36, roughness: 0.78 });
    const matJeans = new THREE.MeshStandardMaterial({ color: 0x283c54, roughness: 0.82 });
    const matShoe = new THREE.MeshStandardMaterial({ color: 0xebe6dd, roughness: 0.6 });
    const matSteel = new THREE.MeshStandardMaterial({ color: 0x9aa2ab, roughness: 0.25, metalness: 0.88 });
    const matGunDark = new THREE.MeshStandardMaterial({ color: 0x1d2024, roughness: 0.35, metalness: 0.78 });

    const makePart = (geo, mat, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };

    // Pelvis / Root Body Pivot
    this.hips = new THREE.Group();
    this.hips.position.y = 0.88;
    this.group.add(this.hips);

    this.pelvisMesh = makePart(new THREE.BoxGeometry(0.36, 0.16, 0.22), matJeans, 0, 0, 0);
    this.hips.add(this.pelvisMesh);

    // Torso
    this.torsoPivot = new THREE.Group();
    this.torsoPivot.position.y = 0.08;
    this.hips.add(this.torsoPivot);

    const chest = makePart(new THREE.BoxGeometry(0.42, 0.52, 0.24), matJacket, 0, 0.26, 0);
    const shirtStrip = makePart(new THREE.BoxGeometry(0.14, 0.46, 0.25), matShirt, 0, 0.25, 0.005);
    this.torsoPivot.add(chest, shirtStrip);

    // Neck & Head
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 0.54, 0);
    this.torsoPivot.add(this.headPivot);

    const neck = makePart(new THREE.CylinderGeometry(0.065, 0.075, 0.1, 10), matSkin, 0, 0.04, 0);
    const head = makePart(new THREE.BoxGeometry(0.22, 0.25, 0.23), matSkin, 0, 0.2, 0);
    const hair = makePart(new THREE.BoxGeometry(0.24, 0.11, 0.25), matHair, 0, 0.31, -0.01);
    const hairBack = makePart(new THREE.BoxGeometry(0.23, 0.16, 0.08), matHair, 0, 0.21, -0.1);
    const sunglasses = makePart(new THREE.BoxGeometry(0.21, 0.055, 0.05), matGunDark, 0, 0.22, 0.11);
    this.headPivot.add(neck, head, hair, hairBack, sunglasses);

    // Left Arm
    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.27, 0.46, 0);
    this.torsoPivot.add(this.leftArmPivot);
    const lUpper = makePart(new THREE.BoxGeometry(0.12, 0.28, 0.12), matJacket, 0, -0.12, 0);
    this.leftForearmPivot = new THREE.Group();
    this.leftForearmPivot.position.set(0, -0.25, 0);
    this.leftArmPivot.add(lUpper, this.leftForearmPivot);
    const lLower = makePart(new THREE.BoxGeometry(0.105, 0.24, 0.105), matJacket, 0, -0.11, 0);
    const lHand = makePart(new THREE.BoxGeometry(0.09, 0.1, 0.09), matSkin, 0, -0.25, 0);
    this.leftForearmPivot.add(lLower, lHand);

    // Right Arm + Weapon Mount
    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.27, 0.46, 0);
    this.torsoPivot.add(this.rightArmPivot);
    const rUpper = makePart(new THREE.BoxGeometry(0.12, 0.28, 0.12), matJacket, 0, -0.12, 0);
    this.rightForearmPivot = new THREE.Group();
    this.rightForearmPivot.position.set(0, -0.25, 0);
    this.rightArmPivot.add(rUpper, this.rightForearmPivot);
    const rLower = makePart(new THREE.BoxGeometry(0.105, 0.24, 0.105), matJacket, 0, -0.11, 0);
    const rHand = makePart(new THREE.BoxGeometry(0.09, 0.1, 0.09), matSkin, 0, -0.25, 0);
    this.rightForearmPivot.add(rLower, rHand);

    this.weaponMount = new THREE.Group();
    this.weaponMount.position.set(0, -0.27, 0.06);
    this.rightForearmPivot.add(this.weaponMount);

    // Build 3D Weapon Models
    this.weaponMeshes = {};

    // Knife
    const knifeGroup = new THREE.Group();
    knifeGroup.add(makePart(new THREE.BoxGeometry(0.03, 0.03, 0.12), matGunDark, 0, 0, 0.02));
    knifeGroup.add(makePart(new THREE.BoxGeometry(0.055, 0.02, 0.02), matSteel, 0, 0, 0.08));
    knifeGroup.add(makePart(new THREE.BoxGeometry(0.015, 0.035, 0.2), matSteel, 0, 0.005, 0.19));
    this.weaponMeshes.knife = knifeGroup;
    this.weaponMount.add(knifeGroup);

    // 9mm Pistol
    const pistolGroup = new THREE.Group();
    pistolGroup.add(makePart(new THREE.BoxGeometry(0.036, 0.11, 0.055), matGunDark, 0, -0.04, 0.02));
    pistolGroup.add(makePart(new THREE.BoxGeometry(0.04, 0.055, 0.21), matGunDark, 0, 0.02, 0.08));
    pistolGroup.add(makePart(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8), matSteel, 0, 0.022, 0.19));
    pistolGroup.children[2].rotation.x = Math.PI / 2;
    this.weaponMeshes.pistol = pistolGroup;
    this.weaponMount.add(pistolGroup);

    // M416 5.56mm Assault Rifle
    const m416Group = new THREE.Group();
    const matTan = new THREE.MeshStandardMaterial({ color: 0x9c896c, roughness: 0.55, metalness: 0.2 });
    // Upper/lower receiver & quad-rail handguard
    m416Group.add(makePart(new THREE.BoxGeometry(0.052, 0.088, 0.34), matGunDark, 0, 0.02, 0.1));
    m416Group.add(makePart(new THREE.BoxGeometry(0.056, 0.068, 0.22), matTan, 0, 0.024, 0.32));
    // Pistol grip & telescoping stock
    m416Group.add(makePart(new THREE.BoxGeometry(0.036, 0.11, 0.048), matGunDark, 0, -0.055, 0.0));
    m416Group.add(makePart(new THREE.CylinderGeometry(0.016, 0.016, 0.16, 8), matGunDark, 0, 0.024, -0.14));
    m416Group.children[3].rotation.x = Math.PI / 2;
    m416Group.add(makePart(new THREE.BoxGeometry(0.044, 0.12, 0.08), matTan, 0, -0.005, -0.2));
    // Curved 30-round STANAG magazine
    const mag = makePart(new THREE.BoxGeometry(0.034, 0.17, 0.056), matSteel, 0, -0.085, 0.15);
    mag.rotation.x = 0.16;
    m416Group.add(mag);
    // Holographic red-dot optic
    m416Group.add(makePart(new THREE.BoxGeometry(0.04, 0.042, 0.065), matGunDark, 0, 0.084, 0.08));
    // Barrel & flash hider
    const barrel = makePart(new THREE.CylinderGeometry(0.013, 0.014, 0.2, 8), matGunDark, 0, 0.024, 0.5);
    barrel.rotation.x = Math.PI / 2;
    m416Group.add(barrel);
    this.weaponMeshes.m416 = m416Group;
    this.weaponMount.add(m416Group);

    // Muzzle Flash Mesh
    this.muzzleFlash = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, 0.22, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd166 })
    );
    this.muzzleFlash.rotation.x = Math.PI / 2;
    this.muzzleFlash.position.set(0, 0.025, 0.44);
    this.muzzleFlash.visible = false;
    this.weaponMount.add(this.muzzleFlash);

    // Legs
    this.leftLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(-0.1, -0.04, 0);
    this.hips.add(this.leftLegPivot);
    const lThigh = makePart(new THREE.BoxGeometry(0.15, 0.42, 0.15), matJeans, 0, -0.21, 0);
    this.leftKneePivot = new THREE.Group();
    this.leftKneePivot.position.set(0, -0.42, 0);
    this.leftLegPivot.add(lThigh, this.leftKneePivot);
    const lShin = makePart(new THREE.BoxGeometry(0.135, 0.36, 0.135), matJeans, 0, -0.18, 0);
    const lFoot = makePart(new THREE.BoxGeometry(0.14, 0.09, 0.24), matShoe, 0, -0.39, 0.04);
    this.leftKneePivot.add(lShin, lFoot);

    this.rightLegPivot = new THREE.Group();
    this.rightLegPivot.position.set(0.1, -0.04, 0);
    this.hips.add(this.rightLegPivot);
    const rThigh = makePart(new THREE.BoxGeometry(0.15, 0.42, 0.15), matJeans, 0, -0.21, 0);
    this.rightKneePivot = new THREE.Group();
    this.rightKneePivot.position.set(0, -0.42, 0);
    this.rightLegPivot.add(rThigh, this.rightKneePivot);
    const rShin = makePart(new THREE.BoxGeometry(0.135, 0.36, 0.135), matJeans, 0, -0.18, 0);
    const rFoot = makePart(new THREE.BoxGeometry(0.14, 0.09, 0.24), matShoe, 0, -0.39, 0.04);
    this.rightKneePivot.add(rShin, rFoot);
  }

  get currentWeapon() {
    return WEAPONS[this.weaponIndex];
  }

  switchWeapon(index) {
    const changed = this.weaponIndex !== ((index % WEAPONS.length) + WEAPONS.length) % WEAPONS.length;
    this.weaponIndex = ((index % WEAPONS.length) + WEAPONS.length) % WEAPONS.length;
    this.reloadingTimer = 0;
    const wId = this.currentWeapon.id;
    Object.entries(this.weaponMeshes).forEach(([k, mesh]) => {
      mesh.visible = k === wId;
    });
    this.muzzleFlash.position.z = wId === 'm416' ? 0.62 : 0.28;
    if (changed) this.audio.playWeaponSwitch();
    return this.currentWeapon;
  }

  reload() {
    const w = this.currentWeapon;
    if (w.melee || this.reloadingTimer > 0 || this.ammo[this.weaponIndex] >= w.magSize) return false;
    this.reloadingTimer = w.reloadTime;
    this.audio.playReload();
    return true;
  }

  tryAttack(camera, onCombatEvent) {
    if (this.attackCooldown > 0 || this.reloadingTimer > 0) return false;
    const w = this.currentWeapon;

    if (!w.melee) {
      if (this.ammo[this.weaponIndex] <= 0) {
        this.reload();
        return false;
      }
      this.ammo[this.weaponIndex]--;
    }

    this.attackCooldown = w.cooldown;
    this.attackAnimTimer = Math.max(0.2, w.cooldown);
    this.attackCombo = (this.attackCombo + 1) % 2;

    if (!w.melee) {
      this.muzzleFlashTimer = 0.055;
      this.muzzleFlash.visible = true;
      this.muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
      if (w.id === 'pistol') this.audio.playPistol();
      else this.audio.playM416();

      // Raycast from camera center with slight weapon spread
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      dir.x += (Math.random() - 0.5) * w.spread;
      dir.y += (Math.random() - 0.5) * w.spread;
      dir.z += (Math.random() - 0.5) * w.spread;
      dir.normalize();

      const muzzleOrigin = new THREE.Vector3();
      this.weaponMount.getWorldPosition(muzzleOrigin);

      onCombatEvent?.({
        type: 'firearm',
        weapon: w,
        rayOrigin: camera.position.clone(),
        rayDir: dir,
        muzzleOrigin,
      });

      if (this.ammo[this.weaponIndex] <= 0) {
        setTimeout(() => this.reload(), 180);
      }
    } else {
      const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
      const hitCenter = this.position.clone().addScaledVector(forward, w.range * 0.55);
      hitCenter.y += 1.05;
      const hitSomething = onCombatEvent?.({
        type: 'melee',
        weapon: w,
        origin: this.position.clone(),
        hitCenter,
        forward,
      });
      if (w.id === 'fists') this.audio.playPunch(Boolean(hitSomething));
      else this.audio.playKnifeSlash(Boolean(hitSomething));
    }

    return true;
  }

  getSurfaceType() {
    // Inside hero house (ground or 2nd floor)
    if (this.position.x >= -15.5 && this.position.x <= -5.5 && this.position.z >= -4.0 && this.position.z <= 6.85) {
      return 'wood';
    }
    return 'stone';
  }

  update(dt, input, cameraYaw, colliders, walkableSurfaces) {
    if (this.attackCooldown > 0) this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.attackAnimTimer > 0) this.attackAnimTimer = Math.max(0, this.attackAnimTimer - dt);
    if (this.reloadingTimer > 0) {
      this.reloadingTimer -= dt;
      if (this.reloadingTimer <= 0) {
        this.reloadingTimer = 0;
        this.ammo[this.weaponIndex] = this.currentWeapon.magSize;
      }
    }
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashTimer <= 0) this.muzzleFlash.visible = false;
    }

    // Movement vector relative to camera yaw (yaw = 0 looks toward -Z)
    let moveX = input.moveX;
    let moveZ = input.moveZ;
    const moveLen = Math.hypot(moveX, moveZ);
    if (moveLen > 1) {
      moveX /= moveLen;
      moveZ /= moveLen;
    }

    const sinY = Math.sin(cameraYaw);
    const cosY = Math.cos(cameraYaw);
    // Forward is (-sinY, -cosY), Right is (cosY, -sinY)
    const worldDirX = moveX * cosY + moveZ * sinY;
    const worldDirZ = -moveX * sinY + moveZ * cosY;

    const wantsSprint = input.sprint && moveLen > 0.1 && !this.isAiming && this.stamina > 2;
    if (wantsSprint) {
      this.stamina = Math.max(0, this.stamina - 22 * dt);
    } else {
      this.stamina = Math.min(100, this.stamina + 16 * dt);
    }

    const speed = wantsSprint ? 7.2 : this.isAiming ? 2.8 : 4.4;
    const targetVx = worldDirX * speed;
    const targetVz = worldDirZ * speed;

    const accel = this.onGround ? 18 : 6;
    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVx, Math.min(1, accel * dt));
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetVz, Math.min(1, accel * dt));

    if (input.jump && this.onGround) {
      this.velocity.y = 6.35;
      this.onGround = false;
      this.audio.playJump();
    }

    // Gravity
    this.velocity.y -= 19.5 * dt;

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y += this.velocity.y * dt;

    // Resolve horizontal walls & obstacles
    resolveEntityCollisions(this.position, this.radius, this.height, colliders, walkableSurfaces);

    // Resolve vertical ground / floor / stairs
    const floorY = getGroundHeightAt(this.position.x, this.position.z, this.position.y, walkableSurfaces);
    if (this.position.y <= floorY + 0.04 && this.velocity.y <= 0.1) {
      this.position.y = floorY;
      this.velocity.y = 0;
      this.onGround = true;
    } else if (this.position.y > floorY + 0.12) {
      this.onGround = false;
    }

    // Character Facing Yaw
    if (this.isAiming || (!this.currentWeapon.melee && this.attackAnimTimer > 0)) {
      // Face camera forward (-sin(cameraYaw), -cos(cameraYaw)) -> model +Z rotated by (cameraYaw + PI)
      const targetYaw = cameraYaw + Math.PI;
      this.yaw = this._lerpAngle(this.yaw, targetYaw, Math.min(1, dt * 18));
    } else if (moveLen > 0.12) {
      const targetYaw = Math.atan2(worldDirX, worldDirZ);
      this.yaw = this._lerpAngle(this.yaw, targetYaw, Math.min(1, dt * 13));
    }

    // Procedural Limb Animations
    this._animateCharacter(dt, Math.hypot(this.velocity.x, this.velocity.z), wantsSprint);

    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
  }

  hideWeaponsForCutscene(hide) {
    if (hide) {
      Object.values(this.weaponMeshes).forEach((m) => {
        m.visible = false;
      });
      this.muzzleFlash.visible = false;
    } else {
      const wId = this.currentWeapon.id;
      Object.entries(this.weaponMeshes).forEach(([k, mesh]) => {
        mesh.visible = k === wId;
      });
    }
  }

  moveCutsceneToward(targetPos, speed, dt, colliders, walkableSurfaces) {
    const dx = targetPos.x - this.position.x;
    const dz = targetPos.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.04) {
      const step = Math.min(dist, speed * dt);
      this.position.x += (dx / dist) * step;
      this.position.z += (dz / dist) * step;
      resolveEntityCollisions(this.position, this.radius, this.height, colliders, walkableSurfaces);
      this.position.y = getGroundHeightAt(this.position.x, this.position.z, this.position.y, walkableSurfaces);
      const targetYaw = Math.atan2(dx, dz);
      this.yaw = this._lerpAngle(this.yaw, targetYaw, Math.min(1, dt * 14));
    }
    this.velocity.set(0, 0, 0);
    this.onGround = true;
    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
    return dist;
  }

  setCutscenePose(mode, dt, speed = 0, lookYaw = null) {
    const t = performance.now() * 0.001;
    if (lookYaw !== null) {
      this.yaw = this._lerpAngle(this.yaw, lookYaw, Math.min(1, dt * 10));
      this.group.rotation.y = this.yaw;
    }

    if (mode === 'walk' || mode === 'flee') {
      const sprinting = mode === 'flee';
      this._animateCharacter(dt, speed, sprinting);
      if (sprinting) {
        // Panicked slightly raised arms while sprinting away
        const swing = Math.sin(this.walkCycle) * 0.8;
        this.leftArmPivot.rotation.set(-0.9 - swing * 0.55, 0, 0.22);
        this.rightArmPivot.rotation.set(-0.9 + swing * 0.55, 0, -0.22);
        this.leftForearmPivot.rotation.set(-0.95, 0, 0);
        this.rightForearmPivot.rotation.set(-0.95, 0, 0);
      }
      return;
    }

    // Standing cutscene poses (watch / ask / flinch)
    this.walkCycle = 0;
    this.leftLegPivot.rotation.set(0, 0, 0);
    this.rightLegPivot.rotation.set(0, 0, 0);
    this.leftKneePivot.rotation.set(0, 0, 0);
    this.rightKneePivot.rotation.set(0, 0, 0);
    this.hips.position.y = 0.88 + Math.sin(t * 2.2) * 0.01;
    this.headPivot.rotation.set(0, 0, 0);

    if (mode === 'watch') {
      // Leaning forward slightly, fascinated by the movie
      this.torsoPivot.rotation.set(0.16, 0, 0);
      this.headPivot.rotation.set(0.08 + Math.sin(t * 1.4) * 0.04, Math.sin(t * 0.8) * 0.06, 0);
      this.leftArmPivot.rotation.set(-0.18, 0, 0.08);
      this.leftForearmPivot.rotation.set(-0.45, 0, 0);
      this.rightArmPivot.rotation.set(-0.22, 0, -0.08);
      this.rightForearmPivot.rotation.set(-0.5, 0, 0);
    } else if (mode === 'ask') {
      // Polite "Dondurma var mı abi?" hand gesture
      this.torsoPivot.rotation.set(0.04, 0, 0);
      this.headPivot.rotation.set(-0.04, Math.sin(t * 3.5) * 0.05, 0.06);
      this.leftArmPivot.rotation.set(-0.12, 0, 0.1);
      this.leftForearmPivot.rotation.set(-0.25, 0, 0);
      this.rightArmPivot.rotation.set(-1.12 + Math.sin(t * 6) * 0.08, 0.2, -0.14);
      this.rightForearmPivot.rotation.set(-0.58, 0, 0);
    } else if (mode === 'flinch') {
      // Startled hands-up dodge
      this.torsoPivot.rotation.set(-0.24, 0, 0);
      this.headPivot.rotation.set(-0.15, 0, 0);
      this.leftArmPivot.rotation.set(-1.65, 0.25, 0.35);
      this.leftForearmPivot.rotation.set(-0.85, 0, 0);
      this.rightArmPivot.rotation.set(-1.65, -0.25, -0.35);
      this.rightForearmPivot.rotation.set(-0.85, 0, 0);
    }
  }

  _lerpAngle(a, b, t) {
    let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }

  _animateCharacter(dt, horizSpeed, sprinting) {
    const t = performance.now() * 0.001;
    const isMoving = horizSpeed > 0.35 && this.onGround;

    if (isMoving) {
      const rate = sprinting ? 13.5 : 8.8;
      this.walkCycle += dt * rate;

      // Footstep SFX on stride peaks
      const stepIdx = Math.floor(this.walkCycle / Math.PI);
      if (stepIdx !== this.lastStepPhase) {
        this.lastStepPhase = stepIdx;
        this.audio.playFootstep(this.getSurfaceType());
      }
    } else {
      this.walkCycle = 0;
    }

    const swing = isMoving ? Math.sin(this.walkCycle) * (sprinting ? 0.78 : 0.52) : 0;
    const kneeBend = isMoving ? Math.max(0, Math.cos(this.walkCycle)) * 0.55 : 0;
    const kneeBendOpp = isMoving ? Math.max(0, -Math.cos(this.walkCycle)) * 0.55 : 0;

    if (!this.onGround) {
      this.leftLegPivot.rotation.x = -0.38;
      this.rightLegPivot.rotation.x = 0.28;
      this.leftKneePivot.rotation.x = 0.55;
      this.rightKneePivot.rotation.x = 0.35;
    } else {
      this.leftLegPivot.rotation.x = swing;
      this.rightLegPivot.rotation.x = -swing;
      this.leftKneePivot.rotation.x = kneeBend;
      this.rightKneePivot.rotation.x = kneeBendOpp;
    }

    // Hip bounce & idle breath
    this.hips.position.y = 0.88 + (isMoving ? Math.abs(Math.sin(this.walkCycle)) * 0.045 : Math.sin(t * 2.2) * 0.012);
    this.torsoPivot.rotation.x = isMoving && sprinting ? 0.16 : 0.03;
    this.torsoPivot.rotation.y = 0;

    // Arms + Weapon Attack / Aim Poses
    const w = this.currentWeapon;
    if (!w.melee && (this.isAiming || this.attackAnimTimer > 0)) {
      const recoil = this.attackAnimTimer > 0 ? Math.sin((this.attackAnimTimer / w.cooldown) * Math.PI) * 0.25 : 0;
      this.rightArmPivot.rotation.set(-Math.PI * 0.48 - recoil, 0, -0.06);
      this.rightForearmPivot.rotation.set(-0.08, 0, 0);
      this.leftArmPivot.rotation.set(-Math.PI * 0.42, 0.32, 0.15);
      this.leftForearmPivot.rotation.set(-0.25, 0, 0);
    } else if (w.melee && this.attackAnimTimer > 0) {
      const p = 1 - this.attackAnimTimer / Math.max(0.2, w.cooldown);
      const slash = Math.sin(p * Math.PI);
      if (w.id === 'knife') {
        this.rightArmPivot.rotation.set(-1.3 * slash, -0.9 * slash + 0.4, -0.35);
        this.rightForearmPivot.rotation.set(-0.4, 0, 0);
        this.torsoPivot.rotation.y = (0.5 - p) * 0.6;
        this.leftArmPivot.rotation.set(-swing * 0.6, 0, 0.08);
      } else {
        // Alternating left/right punch
        if (this.attackCombo === 0) {
          this.rightArmPivot.rotation.set(-1.55 * slash, 0.15 * slash, -0.1);
          this.rightForearmPivot.rotation.set(-0.2, 0, 0);
          this.leftArmPivot.rotation.set(-0.7, 0, 0.12);
          this.torsoPivot.rotation.y = 0.35 * slash;
        } else {
          this.leftArmPivot.rotation.set(-1.55 * slash, -0.15 * slash, 0.1);
          this.leftForearmPivot.rotation.set(-0.2, 0, 0);
          this.rightArmPivot.rotation.set(-0.7, 0, -0.12);
          this.torsoPivot.rotation.y = -0.35 * slash;
        }
      }
    } else {
      // Relaxed walk/idle arms
      this.leftArmPivot.rotation.set(-swing * 0.72, 0, 0.07);
      this.rightArmPivot.rotation.set(swing * 0.72, 0, -0.07);
      this.leftForearmPivot.rotation.set(isMoving ? -0.25 : -0.1, 0, 0);
      this.rightForearmPivot.rotation.set(w.id === 'm416' ? -0.45 : isMoving ? -0.25 : -0.1, 0, 0);
    }
  }
}
