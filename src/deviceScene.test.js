import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

for (const mode of ['mobile', 'desktop']) test(`${mode} scene follows content height while rotation and controls stay aligned`, async () => {
  const dom = new JSDOM('<div id="stage"><div id="viewport"><div id="pose"><main class="app"><button class="key">Play</button><div class="meter-bars"><i></i></div></main></div></div></div>')
  const names = ['window', 'document', 'ResizeObserver', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'testDeviceRenderer']
  const original = Object.fromEntries(names.map((key) => [key, globalThis[key]]))
  const frames = new Map()
  let nextId = 0, draws = 0, shadowPasses = 0, meshes, pixelRatio, cameraZoom, onResize
  let appHeight = 700
  const document = dom.window.document
  const stage = document.getElementById('stage'), viewport = document.getElementById('viewport'), pose = document.getElementById('pose')
  const app = document.querySelector('.app'), button = document.querySelector('button')
  const screenWidth = mode === 'mobile' ? 390 : 1440
  dom.window.innerWidth = screenWidth
  dom.window.devicePixelRatio = 2
  for (const [element, width, height] of [[stage, screenWidth, 700], [app, Math.min(screenWidth, 720), 700], [button, 80, 40]]) {
    Object.defineProperties(element, { offsetWidth: { value: width }, offsetHeight: { get: () => element === app ? appHeight : height }, clientWidth: { value: width } })
  }
  Object.defineProperty(button, 'offsetParent', { value: app })
  const renderer = {
    domElement: document.createElement('canvas'), capabilities: { maxTextureSize: 4096 }, shadowMap: {},
    getContext: () => ({ MAX_RENDERBUFFER_SIZE: 1, getParameter: () => 4096 }),
    setPixelRatio(value) { pixelRatio = value }, setSize() {}, dispose() {},
    render(scene, camera) {
      draws++
      cameraZoom = camera.zoom
      if (this.shadowMap.needsUpdate) { shadowPasses++; this.shadowMap.needsUpdate = false }
      const currentMeshes = []
      scene.traverse((object) => { if (object.isMesh) currentMeshes.push(object) })
      if (meshes) assert.deepEqual(currentMeshes, meshes)
      else meshes = currentMeshes
    },
  }
  Object.assign(globalThis, {
    window: dom.window, document, ResizeObserver: class { constructor(callback) { onResize = callback } observe() {} disconnect() {} },
    MutationObserver: dom.window.MutationObserver,
    requestAnimationFrame: (callback) => { frames.set(++nextId, callback); return nextId },
    cancelAnimationFrame: (id) => frames.delete(id), testDeviceRenderer: renderer,
  })
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, plugins: [{
    name: 'replace-gpu-boundary', enforce: 'pre', transform(code, id) {
      if (id.endsWith('/src/deviceScene.js')) return code.replace(/new THREE\.WebGLRenderer\([^\n]+\)/, 'globalThis.testDeviceRenderer')
    },
  }] })
  let controller
  const frame = (time) => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((callback) => callback(time)) }
  try {
    const { createDeviceScene } = await server.ssrLoadModule('/src/deviceScene.js')
    controller = createDeviceScene(stage, viewport, pose, app, () => assert.fail('Scene failed'))
    frame(0)
    assert.equal(shadowPasses, 1)
    const keyCap = meshes.find((mesh) => mesh.material?.color?.getHex() === 0x292d26)
    assert.ok(keyCap, 'button cap should be rendered in the 3D scene')
    const raisedPosition = keyCap.position.z
    const restingRatio = pixelRatio
    if (mode === 'desktop') controller.hold()
    for (let index = 1; index <= 60; index++) {
      if (mode === 'mobile') controller.setDeviceTilt(Math.sin(index / 10), 0.2, index * 16)
      else {
        // High-rate mouse input must coalesce into one draw per display frame.
        for (let event = 0; event < 8; event++) controller.rotate(index / 6, -index / 3)
        assert.equal(frames.size, 1)
        frame(index * 16)
      }
    }
    assert.equal(draws, 61)
    assert.equal(shadowPasses, 1)
    assert.equal(keyCap.position.z, raisedPosition)
    assert.equal(frames.size, 0)
    const x = mode === 'mobile' ? 8 : 10
    assert.equal(controller.rotation.x, x)
    assert.ok(pose.style.transform.includes(`rotateX(${x}deg)`))
    if (mode === 'desktop') {
      assert.ok(pixelRatio < restingRatio)
      assert.ok(screenWidth * 700 * pixelRatio ** 2 <= 1_500_000)
      await new Promise((resolve) => setTimeout(resolve, 220))
      frame(1220)
      assert.equal(pixelRatio, restingRatio)
      assert.equal(shadowPasses, 1, 'restoring resolution must reuse the cached shadow map')
      const previousDraws = draws
      controller.rotate(10, -20)
      assert.equal(frames.size, 0, 'unchanged angles must not render again')
      assert.equal(draws, previousDraws)
      app.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }))
      dom.window.dispatchEvent(new dom.window.Event('pointerup'))
      assert.equal(frames.size, 0, 'dragging the background must not update button shadows')
    }
    document.querySelector('.meter-bars i').className = 'lit'
    await Promise.resolve()
    assert.equal(frames.size, 0, 'HTML meter animation must not redraw the 3D scene')
    button.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }))
    frame(1000)
    assert.equal(shadowPasses, 2)
    assert.equal(keyCap.position.z, raisedPosition - 3)
    dom.window.dispatchEvent(new dom.window.Event('pointerup'))
    frame(1016)
    assert.equal(shadowPasses, 3)
    assert.equal(keyCap.position.z, raisedPosition)
    for (const [height, time] of [[930, 1032], [580, 1048]]) {
      appHeight = height
      onResize()
      meshes = undefined // A size change rebuilds the physical chassis.
      frame(time)
      assert.equal(stage.style.height, `${height + (mode === 'desktop' ? 160 : 0)}px`)
    }
    const wheel = new dom.window.WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -80 })
    app.dispatchEvent(wheel)
    assert.equal(wheel.defaultPrevented, mode === 'desktop')
    if (mode === 'desktop') {
      assert.equal(controller.zoom, 1.1)
      frame(1064)
      assert.equal(cameraZoom, 1.1)
      assert.ok(pose.style.transform.includes('scale3d(1.1, 1.1, 1)'))
      assert.equal(stage.style.height, `${Math.ceil(appHeight * 1.1) + 160}px`)
      assert.equal(controller.zoomBy(10), 1.6)
      assert.equal(controller.zoomBy(-10), 0.8)
    } else {
      assert.equal(controller.zoom, 1)
    }
  } finally {
    controller?.dispose()
    await server.close()
    dom.window.close()
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
  }
})
