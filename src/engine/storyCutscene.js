import * as THREE from 'three';
import { getGroundHeightAt, resolveEntityCollisions } from '../world/mapLoader.js';

const WATCH_SPOT = new THREE.Vector3(-8.02, 3.72, -2.42);
const NPC_BED_EXIT_SPOT = new THREE.Vector3(-7.75, 3.72, -2.02);

// Collision-free escape path from 2nd floor bedroom -> down stairs -> front door -> Alaca Mescit Sokak
const PLAYER_ESCAPE_WAYPOINTS = [
  new THREE.Vector3(-8.45, 3.72, -0.6),
  new THREE.Vector3(-9.6, 3.72, 2.4),
  new THREE.Vector3(-12.2, 3.72, 0.15),
  new THREE.Vector3(-13.25, 3.72, -1.45),
  new THREE.Vector3(-14.35, 3.72, -1.35),
  new THREE.Vector3(-14.35, 3.72, -0.6),
  new THREE.Vector3(-14.35, 0.47, 5.15),
  new THREE.Vector3(-12.3, 0.47, 5.4),
  new THREE.Vector3(-10.5, 0.47, 5.4),
  new THREE.Vector3(-10.5, 0.47, 6.4),
  new THREE.Vector3(-10.5, 0.14, 7.6),
  new THREE.Vector3(-7.4, 0.03, 10.6),
];

const NPC_CHASE_WAYPOINTS = [
  new THREE.Vector3(-8.4, 3.72, -0.7),
  new THREE.Vector3(-9.6, 3.72, 2.4),
  new THREE.Vector3(-12.2, 3.72, 0.15),
  new THREE.Vector3(-13.25, 3.72, -1.45),
  new THREE.Vector3(-14.35, 3.72, -1.35),
  new THREE.Vector3(-14.35, 3.72, -0.6),
  new THREE.Vector3(-14.35, 0.47, 5.15),
  new THREE.Vector3(-12.3, 0.47, 5.4),
  new THREE.Vector3(-10.5, 0.47, 5.4),
  new THREE.Vector3(-10.5, 0.47, 6.4),
];

/**
 * Story Mode Cutscene Controller for the Tokat House 2nd Floor Bedroom encounter:
 * 1. Approach bed & watch movie on phone for 5.0 seconds
 * 2. Ask "Dondurma var mı abi?"
 * 3. Movie-watching NPC snaps, jumps off bed with a slipper & attacks
 * 4. Multi-camera cinematic escape out of the house, transitioning into live chase gameplay
 */
export class StoryCutsceneManager {
  constructor({
    camera,
    cameraController,
    player,
    npcManager,
    heroHouseDoor,
    audio,
    colliders,
    walkableSurfaces,
    onDamagePlayer,
    onToast,
  }) {
    this.camera = camera;
    this.cameraController = cameraController;
    this.player = player;
    this.npcManager = npcManager;
    this.heroHouseDoor = heroHouseDoor;
    this.audio = audio;
    this.colliders = colliders;
    this.walkableSurfaces = walkableSurfaces;
    this.onDamagePlayer = onDamagePlayer;
    this.onToast = onToast;

    this.isActive = false;
    this.timer = 0;
    this.cooldown = 0;
    this.playerWpIndex = 0;
    this.npcWpIndex = 0;

    this.firedAsk = false;
    this.firedSnap = false;
    this.firedLunge = false;
    this.firedHit = false;
    this.firedBolt = false;
    this.lastMoviePulse = 0;

    this.camPos = new THREE.Vector3();
    this.camTarget = new THREE.Vector3();
    this.currentCamShot = '';

    // DOM Elements
    this.overlayEl = document.getElementById('cutscene-overlay');
    this.subtitleWrapEl = document.getElementById('cutscene-subtitle-wrap');
    this.speakerEl = document.getElementById('cutscene-speaker');
    this.textEl = document.getElementById('cutscene-text');
  }

  canTrigger() {
    if (this.isActive || this.cooldown > 0) return false;
    const m = this.npcManager.movieNpc;
    if (!m || m.state !== 'WATCHING') return false;

    const p = this.player.position;
    if (p.y < 3.2) return false; // Must be on 2nd floor
    if (p.x < -9.35 || p.x > -5.6 || p.z < -3.9 || p.z > 1.0) return false;

    const dist = Math.hypot(p.x - m.bedPos.x, p.z - m.bedPos.z);
    return dist < 2.65;
  }

  start() {
    const m = this.npcManager.movieNpc;
    if (!m || this.isActive) return;

    this.isActive = true;
    this.timer = 0;
    this.playerWpIndex = 0;
    this.npcWpIndex = 0;

    this.firedAsk = false;
    this.firedSnap = false;
    this.firedLunge = false;
    this.firedHit = false;
    this.firedBolt = false;
    this.lastMoviePulse = 0.6;
    this.currentCamShot = '';

    m.state = 'CUTSCENE_CONTROLLED';
    this.player.hideWeaponsForCutscene(true);
    this.player.isAiming = false;
    this.cameraController.isAiming = false;

    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }

    document.body.classList.add('cutscene-active');
    this.overlayEl.classList.remove('hidden');
    requestAnimationFrame(() => {
      this.overlayEl.classList.add('bars-in');
    });
    this._hideSubtitle();
    this._snapCameraShot('watch_ots', true);
  }

  skip() {
    if (!this.isActive) return;
    const m = this.npcManager.movieNpc;

    // Ensure front door is open & place player outside on the street
    if (this.heroHouseDoor && !this.heroHouseDoor.isOpen) {
      this.heroHouseDoor.toggle();
    }
    this.player.position.set(-7.4, 0.03, 10.6);
    this.player.yaw = Math.atan2(3.1, 3.0);
    this.player.group.position.copy(this.player.position);
    this.player.group.rotation.y = this.player.yaw;

    if (m) {
      m.position.set(-10.5, 0.47, 6.2);
      m.root.rotation.y = Math.atan2(this.player.position.x - m.position.x, this.player.position.z - m.position.z);
    }
    this.finish(true);
  }

  finish(wasSkipped = false) {
    if (!this.isActive) return;
    this.isActive = false;
    this.cooldown = 16;

    this._hideSubtitle();
    this.overlayEl.classList.remove('bars-in');
    document.body.classList.remove('cutscene-active');
    setTimeout(() => {
      if (!this.isActive) this.overlayEl.classList.add('hidden');
    }, 450);

    this.player.hideWeaponsForCutscene(false);
    this.player.headPivot.rotation.set(0, 0, 0);
    this.player.torsoPivot.rotation.set(0, 0, 0);

    // Align third-person camera behind player facing down the street
    this.cameraController.yaw = this.player.yaw - Math.PI;
    this.cameraController.pitch = 0.22;
    this.cameraController.pivotPos.set(0, 0, 0);

    const m = this.npcManager.movieNpc;
    if (m) {
      m.state = 'CHASE_PLAYER';
      m.chaseTimer = 11.5;
      m.attackCooldown = 0.8;
      m.phoneGroup.visible = false;
      m.phoneLight.intensity = 0;
      m.slipperMesh.visible = true;
    }

    this.onToast?.(wasSkipped ? '🏃 Hikaye geçildi — Abi peşinde! Kaç!' : '🏃 Abi terlikle peşinde! Kaç!');
  }

  _showSubtitle(speaker, text, style = 'player') {
    this.speakerEl.textContent = speaker;
    this.speakerEl.className = style === 'angry' ? 'angry' : style === 'narrator' ? 'narrator' : '';
    this.textEl.textContent = text;
    this.subtitleWrapEl.classList.remove('hidden');
  }

  _hideSubtitle() {
    this.subtitleWrapEl.classList.add('hidden');
  }

  _snapCameraShot(shotId, immediate = true) {
    if (this.currentCamShot === shotId && !immediate) return;
    if (this.currentCamShot === shotId) return;
    this.currentCamShot = shotId;
    if (immediate) {
      const { pos, look } = this._getCameraForShot(shotId, this.timer);
      this.camPos.copy(pos);
      this.camTarget.copy(look);
      this.camera.position.copy(pos);
      this.camera.lookAt(look);
    }
  }

  _getCameraForShot(shotId, dtSec) {
    const m = this.npcManager.movieNpc;
    const pPos = this.player.position;
    const mPos = m ? m.position : WATCH_SPOT;

    switch (shotId) {
      case 'watch_ots': {
        // Over-the-shoulder bedside shot framing our character + glowing phone + NPC
        const drift = Math.sin(dtSec * 0.45) * 0.14;
        return {
          pos: new THREE.Vector3(-8.85, 5.28, -1.35 + drift),
          look: new THREE.Vector3(-6.85, 4.72, -2.75),
        };
      }
      case 'watch_twoshot': {
        // Foot-of-bed reverse angle showing both faces lit by movie screen
        const drift = (dtSec - 2.6) * 0.08;
        return {
          pos: new THREE.Vector3(-8.45 + drift, 4.92, -0.75),
          look: new THREE.Vector3(-7.05, 4.78, -2.85),
        };
      }
      case 'ask_closeup': {
        // Close-up from bed toward our character asking for ice cream
        return {
          pos: new THREE.Vector3(-6.55, 5.05, -2.55),
          look: new THREE.Vector3(pPos.x, pPos.y + 1.45, pPos.z),
        };
      }
      case 'npc_angry': {
        // Dramatic close-up on the NPC snapping in bed
        return {
          pos: new THREE.Vector3(-7.68, 4.98, -1.88),
          look: new THREE.Vector3(-6.68, 4.68, -2.95),
        };
      }
      case 'npc_attack': {
        // Low wide bedroom angle as NPC jumps off bed and swings slipper
        return {
          pos: new THREE.Vector3(-8.95, 4.82, -0.65),
          look: new THREE.Vector3(
            (pPos.x + mPos.x) * 0.5,
            4.65,
            (pPos.z + mPos.z) * 0.5
          ),
        };
      }
      case 'escape_hall': {
        // 2nd floor hall camera watching player bolt through doorway with NPC chasing
        return {
          pos: new THREE.Vector3(-12.4, 5.45, 3.85),
          look: new THREE.Vector3(pPos.x, pPos.y + 1.15, pPos.z),
        };
      }
      case 'escape_stairs': {
        // Bottom of staircase looking up as both sprint down the wooden steps
        return {
          pos: new THREE.Vector3(-12.65, 1.85, 4.75),
          look: new THREE.Vector3(pPos.x, pPos.y + 1.0, pPos.z),
        };
      }
      case 'escape_street': {
        // Street exterior shot framing Tokat House porch as player bursts out
        return {
          pos: new THREE.Vector3(-6.2, 2.05, 12.6),
          look: new THREE.Vector3(pPos.x - 0.5, pPos.y + 1.05, pPos.z - 0.6),
        };
      }
      default:
        return {
          pos: this.camera.position.clone(),
          look: pPos.clone(),
        };
    }
  }

  _advanceWaypoints(pos, waypoints, wpIndex, speed, dt, isNpc = false) {
    if (wpIndex >= waypoints.length) return { idx: wpIndex, speed: 0 };
    const target = waypoints[wpIndex];
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 0.36) {
      return { idx: wpIndex + 1, speed };
    }

    if (isNpc) {
      const step = Math.min(dist, speed * dt);
      pos.x += (dx / dist) * step;
      pos.z += (dz / dist) * step;
      resolveEntityCollisions(pos, 0.3, 1.65, this.colliders, this.walkableSurfaces);
      pos.y = getGroundHeightAt(pos.x, pos.z, pos.y, this.walkableSurfaces);
    } else {
      this.player.moveCutsceneToward(target, speed, dt, this.colliders, this.walkableSurfaces);
    }
    return { idx: wpIndex, speed };
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);

    if (!this.isActive) {
      if (this.canTrigger()) {
        this.start();
      }
      return;
    }

    this.timer += dt;
    const t = this.timer;
    const m = this.npcManager.movieNpc;
    if (!m) {
      this.finish(true);
      return;
    }

    const lookAtNpcYaw = Math.atan2(m.bedPos.x - WATCH_SPOT.x, m.bedPos.z - WATCH_SPOT.z);
    const nowSec = performance.now() * 0.001;

    // -------------------------------------------------------------------------
    // BEAT 1 (0.0s -> 5.3s): Walk up to bed & watch the movie for 5 full seconds
    // -------------------------------------------------------------------------
    if (t < 5.3) {
      const d = this.player.moveCutsceneToward(WATCH_SPOT, 2.8, dt, this.colliders, this.walkableSurfaces);
      if (d > 0.14) {
        this.player.setCutscenePose('walk', dt, 2.8);
      } else {
        this.player.setCutscenePose('watch', dt, 0, lookAtNpcYaw);
      }

      if (t > 0.5 && t < 5.0 && t - this.lastMoviePulse > 1.15) {
        this.lastMoviePulse = t;
        this.audio.playMoviePulse();
      }

      if (t < 2.6) {
        this._snapCameraShot('watch_ots');
      } else {
        this._snapCameraShot('watch_twoshot');
      }
      if (t > 0.45 && t < 4.9) {
        this._showSubtitle('HİKAYE', 'Telefonun ekranındaki filme dalıp izliyorsun...', 'narrator');
      } else if (t >= 4.9) {
        this._hideSubtitle();
      }
    }
    // -------------------------------------------------------------------------
    // BEAT 2 (5.3s -> 7.5s): "Dondurma var mı abi?"
    // -------------------------------------------------------------------------
    else if (t < 7.5) {
      this.player.setCutscenePose('ask', dt, 0, lookAtNpcYaw);
      this._snapCameraShot('ask_closeup');

      if (!this.firedAsk) {
        this.firedAsk = true;
        this._showSubtitle('SEN', '“Dondurma var mı abi?”', 'player');
        this.audio.speakTurkish('Dondurma var mı abi?', { pitch: 1.08, rate: 1.02 });
      }
    }
    // -------------------------------------------------------------------------
    // BEAT 3 (7.5s -> 10.3s): NPC snaps, gets off bed & attacks with slipper!
    // -------------------------------------------------------------------------
    else if (t < 10.3) {
      if (!this.firedSnap) {
        this.firedSnap = true;
        this.audio.playAngrySting();
        this._showSubtitle('ABİ', '“Ne dondurması lan?! Film izliyoruz şurada! Çık dışarı!”', 'angry');
        this.audio.speakTurkish('Ne dondurması lan! Çık dışarı!', { pitch: 0.82, rate: 1.1 });
      }

      if (t < 8.55) {
        // Angry glare on bed before springing up
        this._snapCameraShot('npc_angry');
        m.phoneGroup.visible = false;
        m.phoneLight.intensity = 0;
        m.torsoPivot.rotation.set(-0.45, -0.35, 0);
        m.headPivot.rotation.set(0.22, -0.35, 0);
        m.leftBrow.rotation.z = -0.42;
        m.rightBrow.rotation.z = 0.42;
        m.mouth.scale.set(1.3, 2.2, 1);
        m.rightArm.shoulder.rotation.set(-0.9, -0.2, 0.2);
        this.player.setCutscenePose('watch', dt, 0, lookAtNpcYaw);
      } else {
        // Jump off bed & lunge at player!
        this._snapCameraShot('npc_attack');
        if (!this.firedLunge) {
          this.firedLunge = true;
          m.position.copy(NPC_BED_EXIT_SPOT);
          m.slipperMesh.visible = true;
        }
        const dx = this.player.position.x - m.position.x;
        const dz = this.player.position.z - m.position.z;
        const dist = Math.hypot(dx, dz);
        m.yaw = Math.atan2(dx, dz);
        m.root.rotation.y = m.yaw;

        if (dist > 0.95) {
          m.position.x += (dx / dist) * 2.9 * dt;
          m.position.z += (dz / dist) * 2.9 * dt;
          m.position.y = 3.72;
        }
        this.npcManager.poseMovieWatcherStanding(m, dt, dist > 0.95 ? 2.9 : 0, {
          angry: true,
          swinging: t > 9.05,
          t: nowSec,
        });

        // Player flinches & steps back
        this.player.setCutscenePose('flinch', dt, 0, lookAtNpcYaw);
        if (t > 9.15 && !this.firedHit) {
          this.firedHit = true;
          this.audio.playPunch(true);
          this.onDamagePlayer?.(10);
          this._showSubtitle('SEN', '“Tamam abi vurma! Kaçtım!”', 'player');
        }
      }
    }
    // -------------------------------------------------------------------------
    // BEAT 4 (10.3s -> ~17.5s): Cinematic Escape Run down stairs & out onto street
    // -------------------------------------------------------------------------
    else {
      if (!this.firedBolt) {
        this.firedBolt = true;
        this._showSubtitle('HİKAYE', 'Karakterin canını kurtarmak için aşağı kaçıyor!', 'narrator');
      }

      // Open front door automatically right before bursting onto the porch
      if (this.playerWpIndex >= 7 && this.heroHouseDoor && !this.heroHouseDoor.isOpen) {
        this.heroHouseDoor.toggle();
        this.audio.playDoorToggle(true);
      }

      // Player sprints along escape waypoints
      const pRes = this._advanceWaypoints(
        this.player.position,
        PLAYER_ESCAPE_WAYPOINTS,
        this.playerWpIndex,
        5.85,
        dt,
        false
      );
      this.playerWpIndex = pRes.idx;
      this.player.setCutscenePose('flee', dt, pRes.speed);

      // Angry NPC chases right behind along the same house route
      if (t > 10.55) {
        const nRes = this._advanceWaypoints(
          m.position,
          NPC_CHASE_WAYPOINTS,
          this.npcWpIndex,
          4.95,
          dt,
          true
        );
        this.npcWpIndex = nRes.idx;
        if (this.npcWpIndex < NPC_CHASE_WAYPOINTS.length) {
          const target = NPC_CHASE_WAYPOINTS[this.npcWpIndex];
          m.yaw = Math.atan2(target.x - m.position.x, target.z - m.position.z);
          m.root.rotation.y = m.yaw;
        }
        this.npcManager.poseMovieWatcherStanding(m, dt, nRes.speed, {
          angry: true,
          swinging: Math.sin(t * 7) > 0.3,
          t: nowSec,
        });
      }

      // Switch cinematic camera shots based on player progress through the house
      if (this.player.position.y > 2.6 && this.player.position.x > -13.3) {
        this._snapCameraShot('escape_hall');
      } else if (this.player.position.z < 5.7 || this.player.position.y > 0.7) {
        this._snapCameraShot('escape_stairs');
      } else {
        this._snapCameraShot('escape_street');
        this._showSubtitle('ABİ', '“Gel buraya! Bir daha seni bu mahallede görmeyeyim!”', 'angry');
      }

      // End cutscene once player reaches the street outside (or safety timeout)
      if (this.playerWpIndex >= PLAYER_ESCAPE_WAYPOINTS.length || t > 18.8) {
        this.finish(false);
        return;
      }
    }

    // Smooth cinematic camera glide
    const shot = this._getCameraForShot(this.currentCamShot, t);
    const camLerp = 1 - Math.exp(-7.5 * dt);
    this.camPos.lerp(shot.pos, camLerp);
    this.camTarget.lerp(shot.look, camLerp);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
  }
}
