import * as THREE from 'three';

/**
 * Third-Person GTA Camera Controller
 * Smoothly orbits around the player's shoulder/head pivot and performs
 * raycast wall-collision prevention so indoor navigation never clips behind walls.
 */
export class CameraController {
  constructor(camera, collidableMeshes = []) {
    this.camera = camera;
    this.collidableMeshes = collidableMeshes;

    // Facing North (-Z) on spawn so Alaca Mescit & Hero Houses are framed immediately
    this.yaw = 0;
    this.pitch = 0.24;
    this.defaultDistance = 4.4;
    this.aimDistance = 2.25;
    this.currentDistance = this.defaultDistance;
    this.minDistance = 0.58;

    this.pivotPos = new THREE.Vector3();
    this.desiredCamPos = new THREE.Vector3();
    this.rayOrigin = new THREE.Vector3();
    this.rayDir = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();

    this.isAiming = false;
    this.recoilPitch = 0;
  }

  setCollidableMeshes(meshes) {
    this.collidableMeshes = meshes;
  }

  rotate(deltaX, deltaY, sensitivity = 0.0024) {
    this.yaw -= deltaX * sensitivity;
    this.pitch = Math.max(-0.48, Math.min(1.15, this.pitch + deltaY * sensitivity));
  }

  addRecoil(amount = 0.025) {
    this.recoilPitch = Math.min(0.14, this.recoilPitch + amount);
  }

  update(dt, playerPosition, playerHeight = 1.65) {
    // Smoothly decay camera recoil
    this.recoilPitch = THREE.MathUtils.lerp(this.recoilPitch, 0, Math.min(1, dt * 12));

    const effectivePitch = Math.max(-0.5, Math.min(1.18, this.pitch - this.recoilPitch));

    // Shoulder offset (slightly right when aiming, centered-right normally)
    const shoulderOffset = this.isAiming ? 0.48 : 0.24;
    const rightX = Math.cos(this.yaw) * shoulderOffset;
    const rightZ = -Math.sin(this.yaw) * shoulderOffset;

    const targetPivot = new THREE.Vector3(
      playerPosition.x + rightX,
      playerPosition.y + playerHeight * 0.88,
      playerPosition.z + rightZ
    );

    // Smooth pivot tracking
    const pivotAlpha = 1 - Math.exp(-18 * dt);
    if (this.pivotPos.lengthSq() === 0) {
      this.pivotPos.copy(targetPivot);
    } else {
      this.pivotPos.lerp(targetPivot, pivotAlpha);
    }

    const targetDist = this.isAiming ? this.aimDistance : this.defaultDistance;

    // Spherical offset behind player (+Z when yaw = 0)
    const cosP = Math.cos(effectivePitch);
    const offsetX = Math.sin(this.yaw) * cosP;
    const offsetY = Math.sin(effectivePitch);
    const offsetZ = Math.cos(this.yaw) * cosP;

    this.rayDir.set(offsetX, offsetY, offsetZ).normalize();
    this.rayOrigin.copy(this.pivotPos);

    // Raycast against environment walls/roofs to prevent clipping indoors
    let allowedDist = targetDist;
    if (this.collidableMeshes.length > 0) {
      this.raycaster.set(this.rayOrigin, this.rayDir);
      this.raycaster.near = 0.05;
      this.raycaster.far = targetDist + 0.35;
      const hits = this.raycaster.intersectObjects(this.collidableMeshes, false);
      if (hits.length > 0) {
        allowedDist = Math.max(this.minDistance, hits[0].distance - 0.24);
      }
    }

    // Fast snap-in when approaching a wall, smooth pull-out when leaving tight spaces
    const distRate = allowedDist < this.currentDistance ? 24 : 8;
    this.currentDistance = THREE.MathUtils.lerp(
      this.currentDistance,
      allowedDist,
      Math.min(1, dt * distRate)
    );

    this.desiredCamPos.copy(this.pivotPos).addScaledVector(this.rayDir, this.currentDistance);
    // Keep camera slightly above the ground floor below pivot
    this.desiredCamPos.y = Math.max(playerPosition.y + 0.32, this.desiredCamPos.y);

    this.camera.position.copy(this.desiredCamPos);
    this.camera.lookAt(
      this.pivotPos.x - Math.sin(this.yaw) * 1.4,
      this.pivotPos.y + (this.isAiming ? 0.05 : -0.08),
      this.pivotPos.z - Math.cos(this.yaw) * 1.4
    );
  }
}
