import { Mesh, MeshStandardMaterial } from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

export const DEFAULT_ROTATION = { x: 9, y: -12 }

export function easeRotation(rotation, elapsedMs, target = DEFAULT_ROTATION) {
  const blend = 1 - Math.exp(-Math.max(0, elapsedMs) / 140)
  const next = {
    x: rotation.x + (target.x - rotation.x) * blend,
    y: rotation.y + (target.y - rotation.y) * blend,
  }
  return Math.abs(next.x - target.x) + Math.abs(next.y - target.y) < 0.02
    ? { ...target } : next
}

export function clampRotation(x, y) {
  return { x: Math.max(-28, Math.min(28, x)), y: Math.max(-38, Math.min(38, y)) }
}

export function controlPosition(rect, width, height, z) {
  return [rect.left + rect.width / 2 - width / 2, height / 2 - rect.top - rect.height / 2, z]
}

// Keep the light, its camera, and the chassis in the same rotating frame.
// Their relative positions do not change, so the existing depth map stays valid.
export function updateDeviceShadow(rig, light) {
  rig.updateWorldMatrix(true, false)
  light.updateWorldMatrix(false, false)
  light.target.updateWorldMatrix(false, false)
  light.shadow.camera.up.set(0, 1, 0).applyQuaternion(rig.quaternion)
  light.shadow.updateMatrices(light)
}

export function bevelBox(width, height, depth, radius, color, roughness = 0.55, metalness = 0.15) {
  const mesh = new Mesh(
    new RoundedBoxGeometry(width, height, depth, 3, Math.min(radius, width / 2, height / 2, depth / 2)),
    new MeshStandardMaterial({ color, roughness, metalness }),
  )
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

export function disposeModel(group) {
  group.traverse((object) => {
    object.geometry?.dispose()
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) material?.dispose()
  })
  group.clear()
}
