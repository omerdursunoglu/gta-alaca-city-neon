import * as THREE from 'three';
import { AudioSynth } from './engine/audioSynth.js';
import { CameraController } from './engine/cameraController.js';
import {
  buildGroundAndRoads,
  applyGoogleMapsGroundTexture,
  fetchOverpassNeighborhoodData,
  setGoogleMapsApiKey,
} from './world/mapLoader.js';
import { buildAlacaMescit } from './buildings/alacaMescit.js';
import { buildHeroHouseEnterable } from './buildings/heroHouseEnterable.js';
import { buildHeroHouseLeft2 } from './buildings/heroHouseLeft2.js';
import { buildNeighborhoodLOD } from './buildings/neighborhoodLOD.js';
import { Player, WEAPONS } from './entities/player.js';
import { NPCManager } from './entities/npcs.js';
import { CatManager } from './entities/cats.js';

// ============================================================================
// DOM & HUD REFERENCES
// ============================================================================
const canvas = document.getElementById('game-canvas');
const crosshair = document.getElementById('crosshair');
const fpsReadout = document.getElementById('fps-readout');
const fpsSelect = document.getElementById('fps-select');
const btnAudio = document.getElementById('btn-audio');
const btnHelp = document.getElementById('btn-help');
const wantedStarsEl = document.getElementById('wanted-stars');
const moneyDisplayEl = document.getElementById('money-display');
const weaponIconEl = document.getElementById('weapon-icon');
const weaponNameEl = document.getElementById('weapon-name');
const weaponAmmoEl = document.getElementById('weapon-ammo');
const weaponSlots = Array.from(document.querySelectorAll('.w-slot'));
const minimapCanvas = document.getElementById('minimap-canvas');
const minimapCtx = minimapCanvas.getContext('2d');
const healthBarEl = document.getElementById('health-bar');
const staminaBarEl = document.getElementById('stamina-bar');
const zoneTagEl = document.getElementById('zone-tag');
const promptBannerEl = document.getElementById('prompt-banner');
const toastFeedEl = document.getElementById('toast-feed');
const overlayModal = document.getElementById('overlay-modal');
const btnPlay = document.getElementById('btn-play');
const gmapsKeyInput = document.getElementById('gmaps-key-input');
const btnApplyGmaps = document.getElementById('btn-apply-gmaps');
const mapSourceStatus = document.getElementById('map-source-status');
const touchControlsEl = document.getElementById('touch-controls');

// ============================================================================
// THREE.JS SCENE, RENDERER & ANATOLIAN DAYLIGHT ATMOSPHERE
// ============================================================================
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdcc7a4);
scene.fog = new THREE.FogExp2(0xdfc8a3, 0.0085);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.15, 240);

// Procedural Sky Dome (Warm Anatolian Golden-Hour Sky Gradient)
function createSkyDome() {
  const skyGeo = new THREE.SphereGeometry(145, 24, 16);
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 16;
  skyCanvas.height = 256;
  const ctx = skyCanvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#4472a8');
  grad.addColorStop(0.36, '#7ba4ca');
  grad.addColorStop(0.52, '#e6c596');
  grad.addColorStop(0.64, '#d9b589');
  grad.addColorStop(1.0, '#9a8060');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 256);
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    skyGeo,
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false, fog: false })
  );
}
scene.add(createSkyDome());

// Lighting: Golden-Hour Sunlight + Sky-to-Ground Hemisphere Light
const hemiLight = new THREE.HemisphereLight(0xb2d4f5, 0x8d7254, 0.86);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xffdeb0, 2.35);
sunLight.position.set(34, 42, 26);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 4;
sunLight.shadow.camera.far = 135;
sunLight.shadow.camera.left = -48;
sunLight.shadow.camera.right = 48;
sunLight.shadow.camera.top = 48;
sunLight.shadow.camera.bottom = -48;
sunLight.shadow.bias = -0.0005;
sunLight.shadow.normalBias = 0.025;
scene.add(sunLight);

// ============================================================================
// BUILD WORLD, HERO BUILDINGS, NEIGHBORHOOD & ENTITIES
// ============================================================================
const audio = new AudioSynth();

const groundData = buildGroundAndRoads();
scene.add(groundData.group);

const mosque = buildAlacaMescit();
scene.add(mosque.group);

const heroHouse = buildHeroHouseEnterable();
scene.add(heroHouse.group);

const heroHouseLeft2 = buildHeroHouseLeft2();
scene.add(heroHouseLeft2.group);

const neighborhood = buildNeighborhoodLOD();
scene.add(neighborhood.group);

// Aggregate colliders, walkable surfaces, and camera raycast meshes
const worldColliders = [
  ...groundData.boundaryColliders,
  ...mosque.colliders,
  ...heroHouse.colliders,
  ...heroHouseLeft2.colliders,
  ...neighborhood.colliders,
];

const walkableSurfaces = [
  ...groundData.walkableSurfaces,
  ...mosque.walkableSurfaces,
  ...heroHouse.walkableSurfaces,
  ...heroHouseLeft2.walkableSurfaces,
];

const cameraColliders = [
  ...mosque.cameraColliders,
  ...heroHouse.cameraColliders,
  ...heroHouseLeft2.cameraColliders,
  ...neighborhood.cameraColliders,
];

const player = new Player(audio);
scene.add(player.group);

const cameraController = new CameraController(camera, cameraColliders);
const npcManager = new NPCManager(scene, {
  gamerSetup: heroHouseLeft2.setupInfo,
  movieBedroom: heroHouse.bedroomInfo,
});
const catManager = new CatManager(scene, audio);

// Non-blocking background Overpass query (optional enrichment/status; instant fallback already active)
fetchOverpassNeighborhoodData().then((osm) => {
  if (osm.source === 'overpass' && (osm.buildings.length > 0 || osm.roads.length > 0)) {
    mapSourceStatus.textContent = `Map Mode: Hybrid Tokat Layout (OSM Live: ${osm.buildings.length} buildings, ${osm.roads.length} ways)`;
  }
});

// ============================================================================
// TOASTS, VFX TRACERS, SPARKS & GAME STATE
// ============================================================================
let cash = 450;
let wantedLevel = 0;
let wantedDecayTimer = 0;
const activeTracers = [];
const activeSparks = [];
const impactRaycaster = new THREE.Raycaster();

function showToast(text) {
  const el = document.createElement('div');
  el.className = 'toast-item';
  el.textContent = text;
  toastFeedEl.appendChild(el);
  if (toastFeedEl.children.length > 4) {
    toastFeedEl.removeChild(toastFeedEl.firstChild);
  }
  setTimeout(() => {
    el.remove();
  }, 3200);
}

function addWanted(amount = 1) {
  wantedLevel = Math.min(5, wantedLevel + amount);
  wantedDecayTimer = 18;
  updateWantedHUD();
}

function updateWantedHUD() {
  const stars = wantedStarsEl.querySelectorAll('.star');
  stars.forEach((el, idx) => {
    el.classList.toggle('active', idx < wantedLevel);
  });
  wantedStarsEl.classList.toggle('flashing', wantedLevel > 0);
}

function spawnBulletTracer(start, end) {
  const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
  const mat = new THREE.LineBasicMaterial({ color: 0xffe484, transparent: true, opacity: 0.9 });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  activeTracers.push({ line, life: 0.085 });
}

function spawnImpactSparks(pos, color = 0xffc857) {
  const spark = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 6, 6),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
  );
  spark.position.copy(pos);
  scene.add(spark);
  activeSparks.push({ mesh: spark, life: 0.16 });
}

function handleCombatEvent(ev) {
  if (ev.type === 'firearm') {
    cameraController.addRecoil(ev.weapon.id === 'pistol' ? 0.028 : 0.015);
    crosshair.classList.add('recoil');
    setTimeout(() => crosshair.classList.remove('recoil'), 75);

    npcManager.alertPanic(player.position, 26);
    catManager.alertStartle(player.position, 16);

    impactRaycaster.set(ev.rayOrigin, ev.rayDir);
    impactRaycaster.near = 0.4;
    impactRaycaster.far = ev.weapon.range;

    const npcHits = impactRaycaster.intersectObjects(npcManager.getHitboxes(), false);
    const wallHits = impactRaycaster.intersectObjects(cameraColliders, false);

    const firstNpc = npcHits[0];
    const firstWall = wallHits[0];

    let endPoint = ev.rayOrigin.clone().addScaledVector(ev.rayDir, ev.weapon.range);

    if (firstNpc && (!firstWall || firstNpc.distance <= firstWall.distance)) {
      endPoint = firstNpc.point;
      spawnImpactSparks(firstNpc.point, 0xff5a4a);
      const npc = firstNpc.object.userData.npc;
      const res = npcManager.damageNPC(npc, ev.weapon.damage, player.position);
      addWanted(1);
      if (res.knockedDown) {
        cash += 35;
        audio.playCashPickup();
        showToast('+$35 · Neighborhood disturbance!');
      }
    } else if (firstWall) {
      endPoint = firstWall.point;
      spawnImpactSparks(firstWall.point, 0xffe299);
      audio.playRicochet();
    }

    spawnBulletTracer(ev.muzzleOrigin, endPoint);
    return true;
  }

  if (ev.type === 'melee') {
    let hitAny = false;
    catManager.alertStartle(player.position, 7);
    for (const npc of npcManager.npcs) {
      if (npc.state === 'DOWN') continue;
      const d = npc.position.distanceTo(ev.hitCenter);
      if (d < 1.35) {
        hitAny = true;
        spawnImpactSparks(npc.position.clone().add(new THREE.Vector3(0, 1.1, 0)), 0xff624a);
        const res = npcManager.damageNPC(npc, ev.weapon.damage, player.position);
        addWanted(1);
        if (res.knockedDown) {
          cash += 25;
          audio.playCashPickup();
          showToast('+$25 · Knockdown!');
        }
      }
    }
    return hitAny;
  }
  return false;
}

// ============================================================================
// INPUT HANDLING (KEYBOARD, POINTER LOCK MOUSE, TOUCH)
// ============================================================================
const keys = new Set();
let mouseFireHeld = false;
let mouseDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let isPaused = true;

const touchInput = {
  moveX: 0,
  moveZ: 0,
  jump: false,
  fire: false,
};

const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (isTouchDevice) {
  touchControlsEl.classList.remove('hidden');
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyH' || e.code === 'Escape') {
    if (e.code === 'KeyH') {
      toggleModal();
      return;
    }
  }
  if (isPaused) return;
  keys.add(e.code);

  if (e.code === 'Digit1') selectWeapon(0);
  if (e.code === 'Digit2') selectWeapon(1);
  if (e.code === 'Digit3') selectWeapon(2);
  if (e.code === 'Digit4') selectWeapon(3);
  if (e.code === 'KeyR') player.reload();
  if (e.code === 'KeyM') toggleAudioMute();
  if (e.code === 'KeyE') handleInteract();
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});

window.addEventListener('wheel', (e) => {
  if (isPaused) return;
  const dir = e.deltaY > 0 ? 1 : -1;
  selectWeapon(player.weaponIndex + dir);
}, { passive: true });

function safeRequestPointerLock() {
  try {
    const res = canvas.requestPointerLock?.();
    if (res && typeof res.catch === 'function') {
      res.catch(() => {});
    }
  } catch {
    // Pointer lock unavailable in embedded/sandboxed contexts; drag-look remains active
  }
}

canvas.addEventListener('mousedown', (e) => {
  if (isPaused) return;
  audio.init();
  if (document.pointerLockElement !== canvas && !isTouchDevice) {
    safeRequestPointerLock();
  }
  if (e.button === 0) {
    mouseFireHeld = true;
    player.tryAttack(camera, handleCombatEvent);
  } else if (e.button === 2) {
    player.isAiming = true;
    cameraController.isAiming = true;
  }
  mouseDragging = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseFireHeld = false;
  if (e.button === 2) {
    player.isAiming = false;
    cameraController.isAiming = false;
  }
  mouseDragging = false;
});

window.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('mousemove', (e) => {
  if (isPaused) return;
  if (document.pointerLockElement === canvas) {
    cameraController.rotate(e.movementX, e.movementY, 0.0023);
  } else if (mouseDragging) {
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    cameraController.rotate(dx, dy, 0.0035);
  }
});

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  crosshair.classList.toggle('visible', locked || player.isAiming);
});

// Touch Controls Wiring
if (isTouchDevice) {
  const joyZone = document.getElementById('touch-joystick-zone');
  const joyKnob = document.getElementById('joystick-knob');
  const lookZone = document.getElementById('touch-look-zone');
  let joyId = null;
  let lookId = null;
  let lookLastX = 0;
  let lookLastY = 0;

  joyZone.addEventListener('touchstart', (e) => {
    audio.init();
    const t = e.changedTouches[0];
    joyId = t.identifier;
  }, { passive: true });

  joyZone.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== joyId) continue;
      const rect = joyZone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const maxR = rect.width * 0.38;
      let dx = t.clientX - cx;
      let dy = t.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > maxR) {
        dx = (dx / dist) * maxR;
        dy = (dy / dist) * maxR;
      }
      joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      touchInput.moveX = dx / maxR;
      touchInput.moveZ = dy / maxR;
    }
  }, { passive: true });

  const resetJoy = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        joyId = null;
        touchInput.moveX = 0;
        touchInput.moveZ = 0;
        joyKnob.style.transform = 'translate(-50%, -50%)';
      }
    }
  };
  joyZone.addEventListener('touchend', resetJoy, { passive: true });
  joyZone.addEventListener('touchcancel', resetJoy, { passive: true });

  lookZone.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    lookId = t.identifier;
    lookLastX = t.clientX;
    lookLastY = t.clientY;
  }, { passive: true });

  lookZone.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== lookId) continue;
      cameraController.rotate(t.clientX - lookLastX, t.clientY - lookLastY, 0.0045);
      lookLastX = t.clientX;
      lookLastY = t.clientY;
    }
  }, { passive: true });

  document.getElementById('t-fire').addEventListener('touchstart', (e) => {
    e.preventDefault();
    audio.init();
    touchInput.fire = true;
    player.tryAttack(camera, handleCombatEvent);
  });
  document.getElementById('t-fire').addEventListener('touchend', () => {
    touchInput.fire = false;
  });
  document.getElementById('t-jump').addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchInput.jump = true;
  });
  document.getElementById('t-jump').addEventListener('touchend', () => {
    touchInput.jump = false;
  });
  document.getElementById('t-interact').addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleInteract();
  });
  document.getElementById('t-weapon').addEventListener('touchstart', (e) => {
    e.preventDefault();
    selectWeapon(player.weaponIndex + 1);
  });
}

// ============================================================================
// HUD & INTERACTION HELPERS
// ============================================================================
function selectWeapon(index) {
  const w = player.switchWeapon(index);
  weaponIconEl.textContent = w.icon;
  weaponNameEl.textContent = w.name;
  weaponSlots.forEach((btn, idx) => btn.classList.toggle('active', idx === player.weaponIndex));
  updateWeaponAmmoHUD();
}

weaponSlots.forEach((btn) => {
  btn.addEventListener('click', () => {
    selectWeapon(Number(btn.dataset.slot));
  });
});

function updateWeaponAmmoHUD() {
  const w = player.currentWeapon;
  if (w.melee) {
    weaponAmmoEl.textContent = 'MELEE';
  } else if (player.reloadingTimer > 0) {
    weaponAmmoEl.textContent = 'RELOADING...';
  } else {
    weaponAmmoEl.textContent = `${player.ammo[player.weaponIndex]} / ∞`;
  }
}

function toggleAudioMute() {
  audio.init();
  const muted = audio.toggleMute();
  btnAudio.textContent = muted ? '🔇 MUTE' : '🔊 SFX';
}
btnAudio.addEventListener('click', toggleAudioMute);

function toggleModal(forceOpen) {
  const open = forceOpen !== undefined ? forceOpen : overlayModal.classList.contains('hidden');
  isPaused = open;
  overlayModal.classList.toggle('hidden', !open);
  if (open && document.pointerLockElement === canvas) {
    document.exitPointerLock?.();
  }
}

btnHelp.addEventListener('click', () => toggleModal(true));
btnPlay.addEventListener('click', () => {
  audio.init();
  toggleModal(false);
  if (!isTouchDevice) {
    safeRequestPointerLock();
  }
});

btnApplyGmaps.addEventListener('click', async () => {
  const key = gmapsKeyInput.value.trim();
  setGoogleMapsApiKey(key);
  if (!key) {
    mapSourceStatus.textContent = 'Map Mode: Instant Procedural Tokat Layout';
    return;
  }
  mapSourceStatus.textContent = 'Loading Google Maps Static tile...';
  const res = await applyGoogleMapsGroundTexture(key, groundData.baseGround);
  mapSourceStatus.textContent = res.ok
    ? 'Map Mode: Google Maps Satellite Ground Active'
    : `Map Mode: ${res.reason}`;
});

const houseDoors = [heroHouse.door, heroHouseLeft2.door].filter(Boolean);

function findNearestDoor(pos, maxDist = 2.6) {
  if (pos.y > 1.8) return null;
  let best = null;
  let bestD = maxDist;
  for (const door of houseDoors) {
    const d = Math.hypot(pos.x - door.position.x, pos.z - door.position.z);
    if (d < bestD) {
      bestD = d;
      best = door;
    }
  }
  return best;
}

function handleInteract() {
  const nearDoor = findNearestDoor(player.position, 2.6);
  if (nearDoor) {
    const opened = nearDoor.toggle();
    audio.playDoorToggle(opened);
    showToast(`🚪 ${opened ? 'Opened' : 'Closed'} ${nearDoor.label} door`);
    return;
  }
  const nearCat = catManager.findNearestCat(player.position, 3.0);
  if (nearCat) {
    const catName = catManager.petCat(nearCat);
    showToast(`🐱 Petted ${catName} ("Mrrrow~")`);
    return;
  }
  // Check Alaca Mescit closed courtyard gate
  if (Math.hypot(player.position.x - 4.0, player.position.z - 6.9) < 2.6) {
    showToast('🕌 Alaca Mescit Camii (1300 AD) — Exterior Monument');
  }
}

function updateZoneAndPrompts() {
  const p = player.position;
  let zone = 'Alaca Mescit Quarter';

  if (p.x >= -15.5 && p.x <= -5.5 && p.z >= -4.0 && p.z <= 6.85) {
    if (p.y > 3.2) {
      zone = p.z > 5.85 ? 'Tokat House · 2nd Floor Cumba' : 'Tokat House · 2nd Floor';
    } else {
      zone = 'Tokat House · Ground Floor';
    }
  } else if (p.x >= -27.2 && p.x <= -17.0 && p.z >= -4.4 && p.z <= 6.8) {
    if (p.y > 3.2) {
      zone = p.x > -22.15 ? 'Gamer House · 2nd Floor PC Room' : 'Gamer House · 2nd Floor';
    } else {
      zone = 'Gamer House · Ground Floor';
    }
  } else if (Math.abs(p.z - 11.5) < 3.4) {
    zone = 'Alaca Mescit Sokak';
  } else if (Math.abs(p.x - 16.5) < 2.8) {
    zone = 'Küçük Minare Sokak';
  } else if (p.x >= -4.8 && p.x <= 12.5 && p.z >= -13.5 && p.z <= 8.4) {
    zone = 'Outside Alaca Mescit Camii';
  }
  zoneTagEl.textContent = zone;

  // Context prompt
  const nearDoor = findNearestDoor(p, 2.6);
  const nearCat = catManager.findNearestCat(p, 2.7);
  if (nearDoor) {
    promptBannerEl.textContent = nearDoor.isOpen
      ? `[E] Close Door — ${nearDoor.label}`
      : `[E] Open Door — ${nearDoor.label}`;
    promptBannerEl.classList.remove('hidden');
  } else if (nearCat) {
    promptBannerEl.textContent = `[E] Pet ${nearCat.name} the street cat`;
    promptBannerEl.classList.remove('hidden');
  } else if (Math.hypot(p.x - 4.0, p.z - 7.0) < 2.5) {
    promptBannerEl.textContent = '[E] Inspect Tokat Alaca Mescit Camii (1300 AD)';
    promptBannerEl.classList.remove('hidden');
  } else {
    promptBannerEl.classList.add('hidden');
  }
}

// ============================================================================
// MINIMAP RADAR RENDERER
// ============================================================================
function renderMinimap() {
  const w = minimapCanvas.width;
  const h = minimapCanvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const scale = 2.4; // pixels per meter

  minimapCtx.clearRect(0, 0, w, h);
  minimapCtx.fillStyle = '#252c28';
  minimapCtx.fillRect(0, 0, w, h);

  minimapCtx.save();
  minimapCtx.translate(cx, cy);
  // Rotate world around player by camera yaw so "up" is camera forward
  minimapCtx.rotate(cameraController.yaw);
  minimapCtx.translate(-player.position.x * scale, -player.position.z * scale);

  // Roads
  minimapCtx.fillStyle = '#3c4045';
  minimapCtx.fillRect(-50 * scale, (11.5 - 3.2) * scale, 100 * scale, 6.4 * scale);
  minimapCtx.fillRect(-50 * scale, (-18.5 - 2.4) * scale, 100 * scale, 4.8 * scale);
  minimapCtx.fillRect((16.5 - 2.5) * scale, -50 * scale, 5.0 * scale, 100 * scale);
  minimapCtx.fillRect((-31.5 - 2.5) * scale, -50 * scale, 5.0 * scale, 100 * scale);

  // Neighborhood LOD buildings
  minimapCtx.fillStyle = '#6d665c';
  for (const b of neighborhood.buildingsMeta) {
    minimapCtx.fillRect(
      b.minX * scale,
      b.minZ * scale,
      (b.maxX - b.minX) * scale,
      (b.maxZ - b.minZ) * scale
    );
  }

  // Hero House #3 (Enterable 2-Story Gamer House)
  minimapCtx.fillStyle = '#47b884';
  minimapCtx.fillRect(-27.2 * scale, -4.4 * scale, 10.2 * scale, 10.4 * scale);

  // Hero House #2 (Enterable 2-Story)
  minimapCtx.fillStyle = '#47b884';
  minimapCtx.fillRect(-15.5 * scale, -4.0 * scale, 10.0 * scale, 10.0 * scale);

  // Hero #1: Alaca Mescit Camii (Gold highlight + dome dot)
  minimapCtx.fillStyle = '#8b6834';
  minimapCtx.fillRect(-3.8 * scale, -13.0 * scale, 15.6 * scale, 19.5 * scale);
  minimapCtx.fillStyle = '#ffbe47';
  minimapCtx.beginPath();
  minimapCtx.arc(4.0 * scale, -5.5 * scale, 4.5 * scale, 0, Math.PI * 2);
  minimapCtx.fill();

  // NPCs
  for (const npc of npcManager.npcs) {
    if (npc.state === 'DOWN') continue;
    minimapCtx.fillStyle = npc.state === 'PANIC' ? '#ff5252' : '#7ac2ff';
    minimapCtx.beginPath();
    minimapCtx.arc(npc.position.x * scale, npc.position.z * scale, 2.6, 0, Math.PI * 2);
    minimapCtx.fill();
  }

  // Cats
  minimapCtx.fillStyle = '#ffd166';
  for (const cat of catManager.cats) {
    minimapCtx.beginPath();
    minimapCtx.arc(cat.position.x * scale, cat.position.z * scale, 2.0, 0, Math.PI * 2);
    minimapCtx.fill();
  }

  minimapCtx.restore();

  // Player Arrow at center pointing up (direction player faces relative to camera)
  minimapCtx.save();
  minimapCtx.translate(cx, cy);
  minimapCtx.rotate(cameraController.yaw - player.yaw + Math.PI);
  minimapCtx.fillStyle = '#ffffff';
  minimapCtx.strokeStyle = '#141414';
  minimapCtx.lineWidth = 1.6;
  minimapCtx.beginPath();
  minimapCtx.moveTo(0, -7);
  minimapCtx.lineTo(5, 6);
  minimapCtx.lineTo(0, 3);
  minimapCtx.lineTo(-5, 6);
  minimapCtx.closePath();
  minimapCtx.fill();
  minimapCtx.stroke();
  minimapCtx.restore();
}

// ============================================================================
// RESIZE & STRICT FPS-CAPPED GAME LOOP
// ============================================================================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let fpsCap = Number(fpsSelect.value);
fpsSelect.addEventListener('change', () => {
  fpsCap = Number(fpsSelect.value);
});

let lastFrameTime = performance.now();
let fpsSampleFrames = 0;
let fpsSampleStart = performance.now();

function gatherInput() {
  let moveX = touchInput.moveX;
  let moveZ = touchInput.moveZ;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) moveX += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) moveZ -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) moveZ += 1;

  return {
    moveX,
    moveZ,
    sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    jump: keys.has('Space') || touchInput.jump,
  };
}

function stepGame(dt) {
  if (!isPaused) {
    const input = gatherInput();
    player.update(dt, input, cameraController.yaw, worldColliders, walkableSurfaces);

    // Automatic fire for SMG when held
    if ((mouseFireHeld || touchInput.fire) && player.currentWeapon.auto) {
      player.tryAttack(camera, handleCombatEvent);
    }

    npcManager.update(dt, worldColliders, walkableSurfaces);
    catManager.update(dt, player.position, worldColliders, walkableSurfaces);
  }

  for (const door of houseDoors) {
    door.update(dt);
  }

  cameraController.update(dt, player.position, player.height);

  // Update bullet tracers & sparks
  for (let i = activeTracers.length - 1; i >= 0; i--) {
    activeTracers[i].life -= dt;
    if (activeTracers[i].life <= 0) {
      scene.remove(activeTracers[i].line);
      activeTracers[i].line.geometry.dispose();
      activeTracers[i].line.material.dispose();
      activeTracers.splice(i, 1);
    }
  }
  for (let i = activeSparks.length - 1; i >= 0; i--) {
    activeSparks[i].life -= dt;
    activeSparks[i].mesh.scale.addScalar(dt * 4);
    if (activeSparks[i].life <= 0) {
      scene.remove(activeSparks[i].mesh);
      activeSparks[i].mesh.geometry.dispose();
      activeSparks[i].mesh.material.dispose();
      activeSparks.splice(i, 1);
    }
  }

  // Wanted decay
  if (wantedLevel > 0) {
    wantedDecayTimer -= dt;
    if (wantedDecayTimer <= 0) {
      wantedLevel = Math.max(0, wantedLevel - 1);
      wantedDecayTimer = 14;
      updateWantedHUD();
    }
  }

  // HUD updates
  moneyDisplayEl.textContent = `$${String(cash).padStart(6, '0').replace(/(\d{3})(\d{3})/, '$1,$2')}`;
  healthBarEl.style.width = `${player.health}%`;
  staminaBarEl.style.width = `${player.stamina}%`;
  updateWeaponAmmoHUD();
  updateZoneAndPrompts();
  renderMinimap();
}

function animate(now) {
  requestAnimationFrame(animate);

  let elapsedMs = now - lastFrameTime;
  if (elapsedMs > 250) {
    lastFrameTime = now;
    elapsedMs = 16.67;
  }

  if (fpsCap > 0) {
    const targetMs = 1000 / fpsCap;
    if (elapsedMs < targetMs - 0.1) return;
    lastFrameTime = now - Math.min(elapsedMs - targetMs, targetMs * 0.25);
  } else {
    lastFrameTime = now;
  }

  const dt = Math.min(elapsedMs / 1000, 0.05);
  stepGame(dt);
  renderer.render(scene, camera);

  // Actual FPS Readout
  fpsSampleFrames++;
  if (now - fpsSampleStart >= 500) {
    const actualFps = Math.round((fpsSampleFrames * 1000) / (now - fpsSampleStart));
    fpsReadout.textContent = `${actualFps} FPS`;
    fpsSampleFrames = 0;
    fpsSampleStart = now;
  }
}

// Initial render frame so the backdrop behind the Start Modal is visible immediately
stepGame(0.016);
renderer.render(scene, camera);
requestAnimationFrame(animate);
