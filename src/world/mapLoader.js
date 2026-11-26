import * as THREE from 'three';
import { getProceduralMaterial } from '../engine/proceduralTextures.js';

export const CENTER_LAT = 40.3116;
export const CENTER_LON = 36.5515;
export const MAP_RADIUS_METERS = 50;

// Set a Google Maps Static API key here or at runtime via the HUD modal
export let GOOGLE_MAPS_API_KEY = '';

export function setGoogleMapsApiKey(key) {
  GOOGLE_MAPS_API_KEY = (key || '').trim();
}

/**
 * Equirectangular local meter projection centered on Tokat Alaca Mescit Camii.
 * +X = East, -Z = North
 */
export function latLonToLocalMeters(lat, lon) {
  const latRad = (CENTER_LAT * Math.PI) / 180;
  const metersPerDegLat = 111045;
  const metersPerDegLon = 111320 * Math.cos(latRad);
  const x = (lon - CENTER_LON) * metersPerDegLon;
  const z = -(lat - CENTER_LAT) * metersPerDegLat;
  return { x, z };
}

/**
 * Pre-computed instant fallback layout for Tokat Alaca Mescit 50m neighborhood.
 */
export const FALLBACK_ROAD_SEGMENTS = [
  // Main East-West street in front of Alaca Mescit & Hero Houses
  { name: 'Alaca Mescit Sk.', x: 0, z: 11.5, w: 100, d: 6.4, sidewalkNorth: 1.6, sidewalkSouth: 1.6 },
  // North-South side lane east of mosque
  { name: 'Küçük Minare Sk.', x: 16.5, z: 0, w: 5.0, d: 100, sidewalkWest: 1.4, sidewalkEast: 1.4 },
  // North-South side lane west of hero houses
  { name: 'Batı Sokak', x: -31.5, z: 0, w: 5.0, d: 100, sidewalkWest: 1.4, sidewalkEast: 1.4 },
  // Northern back alley
  { name: 'Arka Sokak', x: 0, z: -18.5, w: 100, d: 4.8, sidewalkNorth: 1.2, sidewalkSouth: 1.2 },
];

export const PEDESTRIAN_WAYPOINTS = [
  // Sidewalk network nodes (index 0..11)
  { x: -34.6, z: 7.4, neighbors: [1, 8] },
  { x: -28.2, z: 7.4, neighbors: [0, 2, 9] },
  { x: -10.5, z: 7.4, neighbors: [1, 3] },
  { x: 4.0, z: 7.4, neighbors: [2, 4] },
  { x: 13.2, z: 7.4, neighbors: [3, 5, 10] },
  { x: 19.8, z: 7.4, neighbors: [4, 6, 11] },
  { x: 38.0, z: 7.4, neighbors: [5] },

  // South sidewalk of Main Street
  { x: -28.2, z: 15.6, neighbors: [1, 8, 12] },
  { x: -34.6, z: 15.6, neighbors: [0, 7] },
  { x: -28.2, z: -15.4, neighbors: [1, 10] },
  { x: 13.2, z: -15.4, neighbors: [4, 9, 11] },
  { x: 19.8, z: -15.4, neighbors: [5, 10] },
  { x: 13.2, z: 15.6, neighbors: [4, 7, 13] },
  { x: 19.8, z: 15.6, neighbors: [5, 12] },
];

export function buildGroundAndRoads() {
  const group = new THREE.Group();
  group.name = 'TokatGroundAndRoads';

  const matGrass = getProceduralMaterial('grassGround', { repeatX: 16, repeatY: 16 });
  const matCobble = getProceduralMaterial('cobblestone', { repeatX: 16, repeatY: 2 });
  const matCobbleNS = getProceduralMaterial('cobblestone', { repeatX: 2, repeatY: 16 });
  const matSidewalk = getProceduralMaterial('sidewalk', { repeatX: 20, repeatY: 1 });
  const matStone = getProceduralMaterial('cutStone', { repeatX: 12, repeatY: 1, tint: 'dark' });
  const matIron = getProceduralMaterial('wroughtIron');

  const walkableSurfaces = [
    { minX: -50, maxX: 50, minZ: -50, maxZ: 50, priority: 0, getY: () => 0 },
  ];

  // 100m x 100m base ground plane
  const baseGround = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), matGrass);
  baseGround.rotation.x = -Math.PI / 2;
  baseGround.receiveShadow = true;
  group.add(baseGround);

  // Streets
  const addRoad = (x, z, w, d, isNS = false) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      isNS ? matCobbleNS : matCobble
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, isNS ? 0.022 : 0.028, z);
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  addRoad(0, 11.5, 100, 6.4, false);
  addRoad(0, -18.5, 100, 4.8, false);
  addRoad(16.5, 0, 5.0, 100, true);
  addRoad(-31.5, 0, 5.0, 100, true);

  // Sidewalks with stone curbs (segmented neatly around street intersections)
  const addSidewalk = (x, z, w, d) => {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, d), matSidewalk);
    sw.position.set(x, 0.07, z);
    sw.receiveShadow = true;
    group.add(sw);
    walkableSurfaces.push({
      minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2,
      priority: 1,
      getY: () => 0.14,
    });
  };

  // North & South Sidewalks along Main Street (broken at X=-31.5 and X=+16.5 lanes)
  addSidewalk(-42.0, 7.5, 16.0, 1.6);
  addSidewalk(-7.5, 7.5, 43.0, 1.6);
  addSidewalk(34.5, 7.5, 31.0, 1.6);

  addSidewalk(-42.0, 15.5, 16.0, 1.6);
  addSidewalk(-7.5, 15.5, 43.0, 1.6);
  addSidewalk(34.5, 15.5, 31.0, 1.6);

  // Curbs along Main Street edges
  [8.3, 14.7].forEach((cz) => {
    [[-42, 16], [-7.5, 43], [34.5, 31]].forEach(([cx, cw]) => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.16, 0.18), matStone);
      curb.position.set(cx, 0.08, cz);
      curb.receiveShadow = true;
      group.add(curb);
    });
  });

  // Sidewalks along East & West North-South Lanes
  addSidewalk(13.3, -4.5, 1.4, 22.4);
  addSidewalk(19.7, -4.5, 1.4, 22.4);
  addSidewalk(13.3, 33.1, 1.4, 33.8);
  addSidewalk(19.7, 33.1, 1.4, 33.8);
  addSidewalk(-28.3, -4.5, 1.4, 22.4);
  addSidewalk(-34.7, -4.5, 1.4, 22.4);

  // Cast-iron manhole covers on streets
  [[-16.2, 11.4], [5.8, 11.8], [16.5, 11.5], [16.5, -6.0], [-31.5, 11.5]].forEach(([mx, mz]) => {
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.035, 16), matStone);
    rim.position.set(mx, 0.025, mz);
    group.add(rim);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.04, 16), matStone);
    lid.position.set(mx, 0.028, mz);
    group.add(lid);
  });

  // Perimeter invisible boundary colliders (50m radius -> ±48.5m playable square)
  const boundaryColliders = [
    { minX: -52, maxX: -48.5, minY: 0, maxY: 20, minZ: -52, maxZ: 52, tag: 'map_bound' },
    { minX: 48.5, maxX: 52, minY: 0, maxY: 20, minZ: -52, maxZ: 52, tag: 'map_bound' },
    { minX: -52, maxX: 52, minY: 0, maxY: 20, minZ: -52, maxZ: -48.5, tag: 'map_bound' },
    { minX: -52, maxX: 52, minY: 0, maxY: 20, minZ: 48.5, maxZ: 52, tag: 'map_bound' },
  ];

  return {
    group,
    baseGround,
    walkableSurfaces,
    boundaryColliders,
    roadSegments: FALLBACK_ROAD_SEGMENTS,
  };
}

/**
 * Optional Google Maps Static API Hook (applied cleanly to 100m x 100m ground plane).
 */
export async function applyGoogleMapsGroundTexture(apiKey, baseGroundMesh) {
  const key = (apiKey || GOOGLE_MAPS_API_KEY || '').trim();
  if (!key || !baseGroundMesh) return { ok: false, reason: 'No API key' };

  const url =
    `https://maps.googleapis.com/maps/api/staticmap?center=${CENTER_LAT},${CENTER_LON}` +
    `&zoom=19&size=640x640&scale=2&maptype=satellite&key=${encodeURIComponent(key)}`;

  return new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        baseGroundMesh.material = new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.92,
          metalness: 0.02,
        });
        resolve({ ok: true, reason: 'Google Maps satellite tile loaded' });
      },
      undefined,
      () => resolve({ ok: false, reason: 'Google Maps fetch failed (fallback retained)' })
    );
  });
}

/**
 * Non-blocking OpenStreetMap Overpass API Query (50m radius around 40.3116, 36.5515).
 * Returns parsed roads/buildings in local meter coordinates or falls back cleanly.
 */
export async function fetchOverpassNeighborhoodData() {
  const query = `[out:json][timeout:4];(way(around:${MAP_RADIUS_METERS},${CENTER_LAT},${CENTER_LON})["building"];way(around:${MAP_RADIUS_METERS},${CENTER_LAT},${CENTER_LON})["highway"];);out body;>;out skel qt;`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { source: 'fallback', buildings: [], roads: [] };
    const data = await res.json();
    const nodes = new Map();
    for (const el of data.elements || []) {
      if (el.type === 'node') nodes.set(el.id, latLonToLocalMeters(el.lat, el.lon));
    }
    const buildings = [];
    const roads = [];
    for (const el of data.elements || []) {
      if (el.type !== 'way' || !el.nodes) continue;
      const pts = el.nodes.map((id) => nodes.get(id)).filter(Boolean);
      if (pts.length < 2) continue;
      if (el.tags?.building) buildings.push({ id: el.id, tags: el.tags, pts });
      if (el.tags?.highway) roads.push({ id: el.id, tags: el.tags, pts });
    }
    return { source: 'overpass', buildings, roads };
  } catch {
    clearTimeout(timer);
    return { source: 'fallback', buildings: [], roads: [] };
  }
}

/**
 * Shared Entity vs World AABB & Walkable Surface Collision Solver
 */
export function resolveEntityCollisions(pos, radius, height, colliders, walkableSurfaces) {
  // 1. Horizontal circle vs AABB push-out for colliders overlapping entity's vertical span
  const entMinY = pos.y + 0.12;
  const entMaxY = pos.y + height;

  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (c.disabled) continue;
      if (entMaxY <= c.minY || entMinY >= c.maxY) continue;

      const closestX = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const closestZ = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - closestX;
      const dz = pos.z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        if (distSq > 1e-8) {
          const dist = Math.sqrt(distSq);
          const push = radius - dist;
          pos.x += (dx / dist) * push;
          pos.z += (dz / dist) * push;
        } else {
          // Inside box center fallback: push out along shallowest axis
          const penLeft = pos.x - c.minX;
          const penRight = c.maxX - pos.x;
          const penFront = c.maxZ - pos.z;
          const penBack = pos.z - c.minZ;
          const minPen = Math.min(penLeft, penRight, penFront, penBack);
          if (minPen === penLeft) pos.x = c.minX - radius;
          else if (minPen === penRight) pos.x = c.maxX + radius;
          else if (minPen === penBack) pos.z = c.minZ - radius;
          else pos.z = c.maxZ + radius;
        }
      }
    }
  }
}

export function getGroundHeightAt(x, z, currentY, walkableSurfaces) {
  let bestY = 0;
  let bestPriority = -1;
  for (let i = 0; i < walkableSurfaces.length; i++) {
    const s = walkableSurfaces[i];
    if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ) {
      const sy = s.getY(x, z);
      // Only snap up onto a higher floor if entity is near or above it (prevents teleporting from 1st floor to 2nd floor!)
      if (sy <= currentY + 0.55 && s.priority >= bestPriority) {
        bestPriority = s.priority;
        bestY = sy;
      }
    }
  }
  return bestY;
}
