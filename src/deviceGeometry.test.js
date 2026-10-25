import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DirectionalLight, Euler, Group, Matrix4, PerspectiveCamera, Vector3 } from 'three'
import { bevelBox, clampRotation, controlPosition, DEFAULT_ROTATION, easeRotation, updateDeviceShadow } from './deviceGeometry.js'

test('cached shadow coordinates stay attached to the device throughout rotation', () => {
  const rig = new Group()
  const light = new DirectionalLight()
  light.position.set(-450, 650, 1100)
  rig.add(light, light.target)
  const points = [new Vector3(-200, 300, 0), new Vector3(160, -250, 13), new Vector3(0, 0, -50)]
  const coordinates = () => points.map((point) => point.clone().applyMatrix4(rig.matrixWorld).applyMatrix4(light.shadow.matrix))
  updateDeviceShadow(rig, light)
  const baseline = coordinates()
  for (const [x, y] of [[0.2, -0.4], [-0.7, 0.7], [0.7, -0.7], [0, 0]]) {
    rig.rotation.set(x, y, 0)
    updateDeviceShadow(rig, light)
    coordinates().forEach((point, index) => assert.ok(point.distanceTo(baseline[index]) < 1e-10))
  }
  light.shadow.dispose()
})

test('button caps have real depth and beveled vertices, not flat planes', () => {
  const mesh = bevelBox(90, 60, 11, 2.4, 0x333333)
  mesh.geometry.computeBoundingBox()
  const size = mesh.geometry.boundingBox.getSize(new Vector3())
  assert.ok(Math.abs(size.x - 90) < 0.001)
  assert.ok(Math.abs(size.y - 60) < 0.001)
  assert.ok(Math.abs(size.z - 11) < 0.001)
  assert.ok(mesh.geometry.getAttribute('position').count > 24)
  assert.ok(mesh.castShadow && mesh.receiveShadow)
  mesh.geometry.dispose()
  mesh.material.dispose()
})

test('control centers map DOM layout coordinates onto the device face', () => {
  assert.deepEqual(controlPosition({ left: 20, top: 30, width: 80, height: 50 }, 900, 700, 13), [-390, 295, 13])
  assert.deepEqual(clampRotation(100, -100), { x: 28, y: -38 })
})

test('explicit view reset eases back to default without overshooting or drifting forever', () => {
  let rotation = { x: -28, y: 38 }
  for (let frame = 0; frame < 120; frame++) {
    const next = easeRotation(rotation, 16)
    assert.ok(next.x >= rotation.x && next.x <= DEFAULT_ROTATION.x)
    assert.ok(next.y <= rotation.y && next.y >= DEFAULT_ROTATION.y)
    rotation = next
  }
  assert.deepEqual(rotation, DEFAULT_ROTATION)
})

test('WebGL projection and CSS perspective keep raised controls aligned at tilt', () => {
  const width = 1200, height = 1000, focal = 1600
  const camera = new PerspectiveCamera(2 * Math.atan(height / (2 * focal)) * 180 / Math.PI, width / height, 1, 15000)
  camera.position.z = focal
  camera.updateMatrixWorld()
  for (const [xDegrees, yDegrees] of [[0, 0], [9, -12], [28, 38], [-28, -38]]) {
    const x = xDegrees * Math.PI / 180, y = yDegrees * Math.PI / 180
    const point = new Vector3(150, 80, 13)
    const matrix = new Matrix4().makeRotationFromEuler(new Euler(-x, y, 0))
    const projected = point.clone().applyMatrix4(matrix).project(camera)
    // CSS coordinates use downward-positive Y; CSS applies rotateY then rotateX.
    const cssX = Math.cos(y) * point.x + Math.sin(y) * point.z
    const intermediateZ = -Math.sin(y) * point.x + Math.cos(y) * point.z
    const cssY = Math.cos(x) * -point.y - Math.sin(x) * intermediateZ
    const cssZ = Math.sin(x) * -point.y + Math.cos(x) * intermediateZ
    const perspective = focal / (focal - cssZ)
    assert.ok(Math.abs(projected.x * width / 2 - cssX * perspective) < 0.0001)
    assert.ok(Math.abs(-projected.y * height / 2 - cssY * perspective) < 0.0001)
  }
})
