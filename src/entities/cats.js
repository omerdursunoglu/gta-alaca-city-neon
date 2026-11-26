import * as THREE from 'three';
import { resolveEntityCollisions } from '../world/mapLoader.js';

const CAT_COATS = [
  { body: 0xd98434, belly: 0xf4e3cc, ear: 0xe6a1a1, name: 'Sarman' }, // Orange tabby
  { body: 0x24262b, belly: 0xf2f0eb, ear: 0xdc9898, name: 'Badem (Tuxedo)' },
  { body: 0x7b7e84, belly: 0xc9ccd1, ear: 0xd69a9a, name: 'Tekir' },
  { body: 0xf3eee6, belly: 0xfbf9f4, ear: 0xebaaaa, name: 'Pamuk' },
  { body: 0xc57d44, belly: 0x2b2826, ear: 0xe29f9f, name: 'Alaca' },
];

export class CatManager {
  constructor(scene, audioSynth) {
    this.scene = scene;
    this.audio = audioSynth;
    this.cats = [];
    this.group = new THREE.Group();
    this.group.name = 'TurkishStreetCats';
    this.scene.add(this.group);

    this._spawnCats();
  }

  _spawnCats() {
    // Cozy Turkish street cat spots near Alaca Mescit wall, house steps, benches, and sidewalks
    const spots = [
      { x: -1.5, z: 7.2 },
      { x: 6.2, z: 7.2 },
      { x: -9.0, z: 7.1 },
      { x: -17.5, z: 7.4 },
      { x: 13.3, z: 3.5 },
      { x: -5.2, z: 15.6 },
      { x: 19.6, z: 10.2 },
    ];

    spots.forEach((sp, i) => {
      const coat = CAT_COATS[i % CAT_COATS.length];
      const meshData = this._createCatMesh(coat);
      meshData.root.position.set(sp.x, 0.14, sp.z);
      this.group.add(meshData.root);

      this.cats.push({
        id: i,
        name: coat.name,
        ...meshData,
        position: meshData.root.position,
        yaw: Math.random() * Math.PI * 2,
        pitchShift: 0.88 + Math.random() * 0.28,
        state: i % 2 === 0 ? 'IDLE' : 'WANDER', // IDLE | WANDER | CURIOUS | STARTLED
        stateTimer: 2 + Math.random() * 5,
        wanderDir: new THREE.Vector3(Math.cos(i), 0, Math.sin(i)).normalize(),
        walkCycle: Math.random() * 6,
        meowCooldown: 1 + Math.random() * 5,
      });
    });
  }

  _createCatMesh(coat) {
    const root = new THREE.Group();
    const matBody = new THREE.MeshStandardMaterial({ color: coat.body, roughness: 0.82 });
    const matBelly = new THREE.MeshStandardMaterial({ color: coat.belly, roughness: 0.85 });
    const matEar = new THREE.MeshStandardMaterial({ color: coat.ear, roughness: 0.7 });
    const matEye = new THREE.MeshStandardMaterial({ color: 0xa4e258, emissive: 0x3b5912, emissiveIntensity: 0.4 });
    const matDark = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.4 });

    const part = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };

    const bodyPivot = new THREE.Group();
    bodyPivot.position.y = 0.21;
    root.add(bodyPivot);

    // Torso & Chest
    bodyPivot.add(part(new THREE.BoxGeometry(0.16, 0.15, 0.36), matBody, 0, 0, 0));
    bodyPivot.add(part(new THREE.BoxGeometry(0.14, 0.08, 0.28), matBelly, 0, -0.045, 0.02));

    // Head, Ears, Snout, Eyes
    const head = new THREE.Group();
    head.position.set(0, 0.09, 0.2);
    head.add(part(new THREE.BoxGeometry(0.14, 0.13, 0.13), matBody, 0, 0, 0));
    head.add(part(new THREE.BoxGeometry(0.08, 0.06, 0.05), matBelly, 0, -0.025, 0.07));
    head.add(part(new THREE.BoxGeometry(0.025, 0.02, 0.02), matEar, 0, -0.015, 0.095));
    // Eyes
    head.add(part(new THREE.BoxGeometry(0.025, 0.025, 0.02), matEye, -0.038, 0.015, 0.062));
    head.add(part(new THREE.BoxGeometry(0.025, 0.025, 0.02), matEye, 0.038, 0.015, 0.062));
    head.add(part(new THREE.BoxGeometry(0.012, 0.018, 0.022), matDark, -0.038, 0.015, 0.065));
    head.add(part(new THREE.BoxGeometry(0.012, 0.018, 0.022), matDark, 0.038, 0.015, 0.065));

    // Pointed Ears
    [-0.046, 0.046].forEach((ex) => {
      const ear = part(new THREE.ConeGeometry(0.032, 0.065, 4), matBody, ex, 0.088, 0);
      ear.rotation.y = Math.PI / 4;
      head.add(ear);
    });
    bodyPivot.add(head);

    // 4 Articulated Legs
    const makeLeg = (lx, lz) => {
      const p = new THREE.Group();
      p.position.set(lx, -0.04, lz);
      p.add(part(new THREE.BoxGeometry(0.048, 0.17, 0.048), matBody, 0, -0.085, 0));
      p.add(part(new THREE.BoxGeometry(0.052, 0.035, 0.055), matBelly, 0, -0.155, 0.01));
      bodyPivot.add(p);
      return p;
    };
    const fl = makeLeg(-0.055, 0.12);
    const fr = makeLeg(0.055, 0.12);
    const bl = makeLeg(-0.055, -0.12);
    const br = makeLeg(0.055, -0.12);

    // Multi-segment Articulated Tail
    const tailBase = new THREE.Group();
    tailBase.position.set(0, 0.04, -0.17);
    tailBase.add(part(new THREE.CylinderGeometry(0.02, 0.024, 0.16, 6), matBody, 0, 0.07, -0.02));
    const tailTip = new THREE.Group();
    tailTip.position.set(0, 0.14, -0.03);
    tailTip.add(part(new THREE.CylinderGeometry(0.015, 0.02, 0.14, 6), matBelly, 0, 0.07, 0));
    tailBase.add(tailTip);
    bodyPivot.add(tailBase);

    return { root, bodyPivot, head, legs: [fl, fr, bl, br], tailBase, tailTip };
  }

  alertStartle(origin, radius = 16) {
    let startledCount = 0;
    for (const cat of this.cats) {
      const dist = cat.position.distanceTo(origin);
      if (dist <= radius) {
        cat.state = 'STARTLED';
        cat.stateTimer = 4.2;
        cat.wanderDir.subVectors(cat.position, origin).setY(0);
        if (cat.wanderDir.lengthSq() < 0.01) cat.wanderDir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
        cat.wanderDir.normalize();
        startledCount++;
      }
    }
    if (startledCount > 0) this.audio.playCatHiss();
  }

  findNearestCat(pos, maxDist = 3.0) {
    let best = null;
    let bestD = maxDist;
    for (const cat of this.cats) {
      const d = cat.position.distanceTo(pos);
      if (d < bestD) {
        bestD = d;
        best = cat;
      }
    }
    return best;
  }

  petCat(cat) {
    if (!cat) return;
    cat.state = 'CURIOUS';
    cat.stateTimer = 4.5;
    this.audio.playCatMeow(cat.pitchShift);
    return cat.name;
  }

  update(dt, playerPos, colliders, walkableSurfaces) {
    const t = performance.now() * 0.001;

    for (const cat of this.cats) {
      cat.stateTimer -= dt;
      cat.meowCooldown -= dt;

      const distToPlayer = cat.position.distanceTo(playerPos);

      // Gentle ambient meow if player walks close calmly
      if (distToPlayer < 4.5 && cat.meowCooldown <= 0 && cat.state !== 'STARTLED') {
        this.audio.playCatMeow(cat.pitchShift);
        cat.meowCooldown = 7 + Math.random() * 8;
        if (cat.state === 'IDLE') {
          cat.state = 'CURIOUS';
          cat.stateTimer = 3.0;
        }
      }

      let speed = 0;
      let dirX = 0;
      let dirZ = 0;

      if (cat.state === 'STARTLED') {
        speed = 5.4;
        dirX = cat.wanderDir.x;
        dirZ = cat.wanderDir.z;
        if (cat.stateTimer <= 0) {
          cat.state = 'IDLE';
          cat.stateTimer = 3.5;
        }
      } else if (cat.state === 'CURIOUS') {
        const dx = playerPos.x - cat.position.x;
        const dz = playerPos.z - cat.position.z;
        const d = Math.hypot(dx, dz);
        if (d > 1.25 && d < 7.0) {
          speed = 1.65;
          dirX = dx / d;
          dirZ = dz / d;
        } else {
          // Sit and look up at player
          cat.yaw = Math.atan2(dx, dz);
        }
        if (cat.stateTimer <= 0) {
          cat.state = 'IDLE';
          cat.stateTimer = 4 + Math.random() * 4;
        }
      } else if (cat.state === 'WANDER') {
        speed = 1.15;
        dirX = cat.wanderDir.x;
        dirZ = cat.wanderDir.z;
        if (cat.stateTimer <= 0) {
          cat.state = 'IDLE';
          cat.stateTimer = 3 + Math.random() * 5;
        }
      } else {
        // IDLE
        if (cat.stateTimer <= 0) {
          cat.state = 'WANDER';
          cat.stateTimer = 3 + Math.random() * 4;
          const ang = Math.random() * Math.PI * 2;
          cat.wanderDir.set(Math.cos(ang), 0, Math.sin(ang));
        }
      }

      if (speed > 0) {
        cat.position.x += dirX * speed * dt;
        cat.position.z += dirZ * speed * dt;
        resolveEntityCollisions(cat.position, 0.22, 0.4, colliders, walkableSurfaces);
        cat.yaw = Math.atan2(dirX, dirZ);

        // Keep out of road center slightly unless startled
        cat.position.y = Math.abs(cat.position.z - 11.5) < 3.1 ? 0.03 : 0.14;
        cat.walkCycle += dt * (cat.state === 'STARTLED' ? 18 : 9);
        const legSwing = Math.sin(cat.walkCycle) * 0.65;
        cat.legs[0].rotation.x = legSwing;
        cat.legs[3].rotation.x = legSwing;
        cat.legs[1].rotation.x = -legSwing;
        cat.legs[2].rotation.x = -legSwing;
        cat.bodyPivot.position.y = 0.21 + Math.abs(Math.sin(cat.walkCycle)) * 0.03;
      } else {
        cat.legs.forEach((l) => (l.rotation.x = THREE.MathUtils.lerp(l.rotation.x, 0, dt * 8)));
        cat.bodyPivot.position.y = 0.18;
      }

      // Tail animation
      if (cat.state === 'STARTLED') {
        cat.tailBase.rotation.x = -0.25;
        cat.tailBase.rotation.z = Math.sin(t * 14) * 0.15;
      } else {
        cat.tailBase.rotation.x = -0.55 + Math.sin(t * 2.5 + cat.id) * 0.12;
        cat.tailBase.rotation.z = Math.sin(t * 3.1 + cat.id) * 0.32;
        cat.tailTip.rotation.z = Math.cos(t * 3.1 + cat.id) * 0.36;
      }

      cat.head.rotation.y = cat.state === 'IDLE' ? Math.sin(t * 1.4 + cat.id) * 0.25 : 0;
      cat.root.rotation.y = cat.yaw;
    }
  }
}
