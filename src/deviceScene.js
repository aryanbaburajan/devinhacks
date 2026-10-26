import * as THREE from 'three'
import { bevelBox, clampRotation, controlPosition, disposeModel, DEFAULT_ROTATION, easeRotation, updateDeviceShadow } from './deviceGeometry.js'
import { createGrilleNormalMap } from './grilleNormals.js'
import { createDisplayEnvironment } from './displayEnvironment.js'
import { isMobileInput } from './phoneTilt.js'

const DISPLAY_Z = 9

function layoutRect(element, root) {
  let left = 0, top = 0, current = element
  while (current && current !== root) {
    left += current.offsetLeft
    top += current.offsetTop
    current = current.offsetParent
  }
  return { left, top, width: element.offsetWidth, height: element.offsetHeight }
}

export function createDeviceScene(stage, viewport, pose, app, onFailure = () => {}) {
  const mobile = isMobileInput
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: mobile() ? 'low-power' : 'high-performance' })
  const resolutionLimit = Math.min(renderer.capabilities.maxTextureSize,
    renderer.getContext().getParameter(renderer.getContext().MAX_RENDERBUFFER_SIZE))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.autoUpdate = false
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.25
  renderer.domElement.setAttribute('aria-hidden', 'true')
  viewport.appendChild(renderer.domElement)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 15000)
  const model = new THREE.Group()
  const rig = new THREE.Group()
  const holeNormals = createGrilleNormalMap()
  const rimNormals = createGrilleNormalMap(64, true)
  rig.add(model)
  scene.add(rig)
  scene.add(new THREE.HemisphereLight(0xfff5e2, 0x40484e, 2.3))
  const key = new THREE.DirectionalLight(0xfff3df, 3)
  key.position.set(-450, 650, 1100)
  key.castShadow = true
  key.shadow.mapSize.set(mobile() ? 1024 : 2048, mobile() ? 1024 : 2048)
  key.shadow.bias = -0.00015
  key.shadow.normalBias = 1
  rig.add(key, key.target)
  const rim = new THREE.DirectionalLight(0xc1d8ff, 1.5)
  rim.position.set(700, 100, 600)
  scene.add(rim)

  const restRotation = mobile() ? { x: 0, y: 0 } : DEFAULT_ROTATION
  let rotation = { ...restRotation }
  let returning = false
  let lastFrameTime = 0
  let scheduled = 0
  let dirty = true
  let controlsDirty = true
  let disposed = false
  let width = 0, height = 0
  let sceneWidth = 0, sceneHeight = 0
  let moving = false, resolutionTimer = 0, pixelRatio = 0
  const controls = new Map()
  let pressed = null
  let focused = null
  let displayGlass = null
  let displayEnvironment = null
  let displayTilt = { x: 0, y: 0 }
  stage.classList.add('is-3d')
  app.style.setProperty('--display-z', `${DISPLAY_Z}px`)

  function invalidate(rebuild = false, updateControls = true) {
    dirty ||= rebuild
    controlsDirty ||= rebuild || updateControls
    if (rebuild || updateControls) renderer.shadowMap.needsUpdate = true
    if (!scheduled && !disposed) scheduled = requestAnimationFrame(draw)
  }

  function updateResolution() {
    if (!sceneWidth || !sceneHeight) return
    // Keep large/Retina desktop canvases within a bounded fill-rate budget.
    // HTML labels retain their native resolution while the GPU surface moves.
    const budget = moving ? 1_500_000 : 4_000_000
    const ratio = Math.min(window.devicePixelRatio || 1, mobile() || moving ? 1 : 2,
      Math.sqrt(budget / (sceneWidth * sceneHeight)), resolutionLimit / Math.max(sceneWidth, sceneHeight))
    if (Math.abs(ratio - pixelRatio) > 0.001) {
      pixelRatio = ratio
      renderer.setPixelRatio(ratio)
    }
  }

  function markMotion() {
    if (mobile() || disposed) return
    moving = true
    updateResolution()
    clearTimeout(resolutionTimer)
    resolutionTimer = setTimeout(() => {
      if (disposed) return
      moving = false
      updateResolution()
      invalidate(false, false)
    }, 180)
  }

  function addBox(rect, depth, top, radius, color, roughness, metalness) {
    const mesh = bevelBox(rect.width, rect.height, depth, radius, color, roughness, metalness)
    mesh.position.set(...controlPosition(rect, width, height, top - depth / 2))
    model.add(mesh)
    return mesh
  }

  function addCylinder(rect, radius, depth, top, color) {
    const bevel = Math.min(1.4, depth / 3)
    const profile = [
      [0, -depth / 2], [radius - bevel, -depth / 2], [radius, -depth / 2 + bevel],
      [radius, depth / 2 - bevel], [radius - bevel, depth / 2], [0, depth / 2],
    ].map(([x, y]) => new THREE.Vector2(x, y))
    const mesh = new THREE.Mesh(new THREE.LatheGeometry(profile, 48),
      new THREE.MeshStandardMaterial({ color, roughness: 0.43, metalness: 0.28 }))
    mesh.rotation.x = Math.PI / 2
    mesh.position.set(...controlPosition(rect, width, height, top - depth / 2))
    mesh.castShadow = mesh.receiveShadow = true
    model.add(mesh)
    return mesh
  }

  function updateProjection() {
    sceneWidth = stage.clientWidth
    // The canvas spans the full page width, independently of the face width.
    // Rotation projects the top and footer beyond the flat face. Keep room
    // inside the canvas so the physical shell is not clipped at its edges.
    sceneHeight = Math.max(Math.ceil(height) + (mobile() ? 0 : 160), mobile() ? 1 : window.innerHeight, 1)
    stage.style.height = `${sceneHeight}px`
    updateResolution()
    renderer.setSize(sceneWidth, sceneHeight)
    // The DOM and WebGL share a focal distance: one layout pixel equals one
    // world unit on the front face, including when tilted or resized.
    const focal = Math.max(1200, sceneHeight * 1.6)
    viewport.style.perspective = `${focal}px`
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(sceneHeight / (2 * focal)))
    camera.aspect = sceneWidth / sceneHeight
    camera.zoom = 1
    camera.position.set(0, 0, focal)
    camera.far = focal + height * 2 + 1000
    camera.updateProjectionMatrix()
    const extent = Math.max(width, height) * 0.8
    Object.assign(key.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: 4000 })
    key.shadow.camera.updateProjectionMatrix()
  }

  function rebuild() {
    disposeModel(model)
    displayGlass = null
    controls.clear()
    width = app.offsetWidth
    height = app.offsetHeight
    updateProjection()

    // The chassis meets the face directly, without an oversized perimeter rim.
    const shell = { left: 0, top: 0, width, height }
    addBox(shell, 48, -2, 0.6, 0x8e8d85, 0.48, 0.45)
    addBox(shell, 4, 0, 0.4, 0xc9c6bb, 0.7, 0.15)
    // Visible layered bottom seam and rubber feet when the side is tilted up.
    addBox(shell, 8, -44, 0.6, 0x252822, 0.8, 0.05)
    for (const x of [32, width - 55]) for (const y of [32, height - 55]) {
      addCylinder({ left: x, top: y, width: 24, height: 24 }, 12, 7, -50, 0x20231f)
    }
    for (const [selector, color, top] of [
      ['.device-rail', 0xc5c3be, 1], ['.device-header', 0xe5e1dc, 0.5],
      ['.track', 0xb6b4a9, 1],
    ]) {
      for (const element of app.querySelectorAll(selector)) {
        const rect = layoutRect(element, app)
        if (rect.width && rect.height) addBox(rect, 4, top, 1.5, color, 0.7)
      }
    }
    for (const [selector, color] of [
      ['.output-port', 0xeae7e1], ['.input-port', 0xff561e],
      ['.digital-ports', 0x30312e], ['.usb-port', 0x858781],
    ]) {
      const element = app.querySelector(selector)
      if (element) addBox(layoutRect(element, app), 3, 2.4, 0.4, color, 0.48, 0.18)
    }
    const railMarker = app.querySelector('.rail-end i')
    if (railMarker) addBox(layoutRect(railMarker, app), 4, 4, 0.3, 0xff521d, 0.4, 0.1)
    const identity = app.querySelector('.identity')
    if (identity) {
      const rect = layoutRect(identity, app)
      const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(4.5, 0.45, 4, 20),
        new THREE.MeshStandardMaterial({ color: 0xf2eee5, roughness: 0.75 }), 4)
      const helper = new THREE.Object3D()
      let index = 0
      for (const x of [rect.left + 10.5, rect.left + rect.width - 10.5]) {
        for (const y of [rect.top + 11.5, rect.top + rect.height - 11.5]) {
          helper.position.set(...controlPosition({ left: x, top: y, width: 0, height: 0 }, width, height, 0.65))
          helper.updateMatrix()
          rings.setMatrixAt(index++, helper.matrix)
        }
      }
      model.add(rings)
    }
    const display = app.querySelector('.display-panel')
    if (display) {
      const rect = layoutRect(display, app)
      addBox(rect, 12, DISPLAY_Z - 0.8, 2.5, 0x252a23, 0.38, 0.25)
      displayGlass = addBox({ left: rect.left + 4, top: rect.top + 4, width: rect.width - 8, height: rect.height - 8 },
        2, DISPLAY_Z - 0.2, 0.8, 0x0b100d, 0.16, 0.15)
      displayEnvironment ??= createDisplayEnvironment(renderer)
      displayGlass.material.dispose()
      displayGlass.material = new THREE.MeshPhysicalMaterial({
        color: 0x080c0a, metalness: 0.08, roughness: 0.17,
        clearcoat: 1, clearcoatRoughness: 0.08, ior: 1.5,
        envMap: displayEnvironment.texture, envMapIntensity: 1.3,
      })
    }
    const speaker = app.querySelector('.speaker')
    if (speaker?.offsetWidth > 0 && speaker.offsetHeight > 0) {
      const rect = layoutRect(speaker, app)
      addBox(rect, 4, 0.6, 0.4, 0x969792, 0.58, 0.28)
      const columns = 12, pitch = rect.width / columns
      const rows = Math.max(1, Math.floor(rect.height / pitch))
      const top = rect.top + (rect.height - rows * pitch) / 2
      const holes = new THREE.InstancedMesh(new THREE.CylinderGeometry(pitch * 0.20, pitch * 0.18, 1, 12),
        new THREE.MeshStandardMaterial({ color: 0x181b18, roughness: 0.8, normalMap: holeNormals, normalScale: new THREE.Vector2(0.85, 0.85) }), columns * rows)
      const rims = new THREE.InstancedMesh(new THREE.TorusGeometry(pitch * 0.25, pitch * 0.035, 5, 12),
        new THREE.MeshStandardMaterial({ color: 0xb9bbb4, metalness: 0.4, roughness: 0.55, normalMap: rimNormals, normalScale: new THREE.Vector2(0.5, 0.5) }), columns * rows)
      const helper = new THREE.Object3D()
      let index = 0
      for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
        const point = { left: rect.left + (column + 0.5) * pitch, top: top + (row + 0.5) * pitch, width: 0, height: 0 }
        helper.position.set(...controlPosition(point, width, height, 0.65))
        helper.rotation.set(Math.PI / 2, 0, 0)
        helper.updateMatrix()
        holes.setMatrixAt(index, helper.matrix)
        helper.position.z = 0.9
        helper.rotation.set(0, 0, 0)
        helper.updateMatrix()
        rims.setMatrixAt(index++, helper.matrix)
      }
      model.add(holes, rims)
    }
    for (const element of app.querySelectorAll('button.key, select, input[type="range"], .tempo-dial')) {
      const rect = layoutRect(element, app)
      if (!rect.width || !rect.height) continue
      if (element.matches('.tempo-dial')) {
        addCylinder(rect, rect.width / 2 + 3, 3, 2, 0x65675e)
        const knob = addCylinder(rect, rect.width / 2, 24, 26, 0xf45816)
        addCylinder(rect, rect.width / 2 - 9, 3, 28, 0xff6d1d)
        const mark = bevelBox(2, 9, 1, 0.4, 0xffe6b0)
        model.add(mark)
        controls.set(element, { kind: 'knob', mesh: knob, mark, rect })
      } else if (element.matches('input')) {
        const elevation = element.closest('.display-panel') ? DISPLAY_Z : 0
        const rail = { ...rect, top: rect.top + rect.height / 2 - 2, height: 4 }
        addBox(rail, 3, elevation + 1, 1, 0x252b22, 0.8)
        const thumbRect = { ...rect, width: 12, height: 19 }
        const thumb = addBox(thumbRect, 8, elevation + 9, 1.5, element.id === 'tempo' ? 0xd0cdbf : 0xf56627)
        controls.set(element, { kind: 'range', mesh: thumb, rect, elevation })
      } else {
        const select = element.matches('select')
        const light = element.classList.contains('key-light') || (element.classList.contains('track-pad') && element.getAttribute('aria-pressed') === 'true')
        const orange = element.classList.contains('key-orange')
        addBox({ left: rect.left - 2, top: rect.top - 2, width: rect.width + 4, height: rect.height + 4 }, 3, 2, 1, 0x44483e)
        const mesh = addBox(rect, select ? 4 : 11, select ? 4 : 13, select ? 1 : 2.4,
          select ? 0x253320 : orange ? 0xf35412 : light ? 0xd6d3c7 : 0x292d26, 0.5, 0.12)
        controls.set(element, { kind: select ? 'select' : 'button', mesh, rect, top: select ? 4 : 13, depth: select ? 4 : 11 })
      }
    }
    // Bottom fasteners; the pale upper panel uses subtle molded rings instead.
    for (const x of [8, width - 18]) for (const y of [height - 18]) {
      const screw = { left: x, top: y, width: 9, height: 9 }
      addCylinder(screw, 4.5, 2, 2, 0x999b8d)
      addBox({ ...screw, left: x + 1, top: y + 4, width: 7, height: 1 }, 0.8, 2.5, 0.3, 0x4c5145)
    }
  }

  function draw(time) {
    scheduled = 0
    if (disposed) return
    try {
    if (returning) {
      markMotion()
      rotation = easeRotation(rotation, time - lastFrameTime, restRotation)
      lastFrameTime = time
      returning = rotation.x !== restRotation.x || rotation.y !== restRotation.y
    }
    if (mobile()) {
      // Counter the phone's tilt degree-for-degree around the initial hold.
      // Sensor offsets are smoothed and normalized over a 40-degree range.
      rotation = { x: displayTilt.y * 40, y: -displayTilt.x * 40 }
      returning = false
    }
    if (dirty) { dirty = false; rebuild() }
    if (displayGlass) displayGlass.material.envMapRotation.set(displayTilt.y * 0.65, displayTilt.x * 0.85, 0)
    rig.rotation.set(THREE.MathUtils.degToRad(-rotation.x), THREE.MathUtils.degToRad(rotation.y), 0)
    updateDeviceShadow(rig, key)
    pose.style.transform = `translate(-50%, -50%) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`
    if (controlsDirty) {
    controlsDirty = false
    for (const [element, control] of controls) {
      const disabled = element.disabled || element.getAttribute('aria-disabled') === 'true'
      control.mesh.material.opacity = disabled ? 0.6 : 1
      control.mesh.material.transparent = !!disabled
      if (control.kind === 'button' || control.kind === 'select') {
        const down = element === pressed || element.classList.contains('key-active') || element.classList.contains('mute-key') && element.getAttribute('aria-pressed') === 'true'
        const depression = down ? 3 : 0
        control.mesh.position.z = control.top - control.depth / 2 - depression
        control.mesh.material.emissive.set(element === focused ? 0x272b20 : 0x000000)
      } else if (control.kind === 'range') {
        const minimum = Number(element.min), maximum = Number(element.max)
        const fraction = (Number(element.value) - minimum) / (maximum - minimum)
        const rect = { left: control.rect.left + fraction * (control.rect.width - 12), top: control.rect.top + control.rect.height / 2 - 9.5, width: 12, height: 19 }
        control.mesh.position.set(...controlPosition(rect, width, height, control.elevation + 5))
      } else if (control.kind === 'knob') {
        const angle = THREE.MathUtils.degToRad(-130 + (Number(element.getAttribute('aria-valuenow')) - 60) / 140 * 260)
        const center = controlPosition(control.rect, width, height, 30)
        const radius = control.rect.width / 2 - 7
        control.mark.position.set(center[0] + Math.sin(angle) * radius, center[1] + Math.cos(angle) * radius, 30)
        control.mark.rotation.z = -angle
      }
    }
    }
    renderer.render(scene, camera)
    if (returning) invalidate(false, false)
    } catch (error) {
      console.warn('Could not render the 3D controls.', error)
      controller.dispose()
      onFailure()
    }
  }

  const resize = new ResizeObserver(() => {
    if (app.offsetWidth !== width || app.offsetHeight !== height || stage.clientWidth !== sceneWidth) invalidate(true)
  })
  resize.observe(app)
  resize.observe(stage)
  const mutations = new MutationObserver((records) => {
    // LEDs/meters animate in HTML; their class changes do not affect 3D geometry.
    const relevant = records.filter((record) => !(record.type === 'attributes' && record.attributeName === 'class' &&
      record.target.closest('.meter-bars, .display-panel, .track-status')))
    if (!relevant.length) return
    const rebuildNeeded = relevant.some((record) => record.type === 'childList' ||
      record.type === 'attributes' && record.attributeName === 'class' && !record.target.closest('.meter-bars, .display-panel'))
    invalidate(rebuildNeeded)
  })
  mutations.observe(app, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'disabled', 'aria-pressed', 'aria-valuenow'] })
  const update = () => invalidate()
  const press = (event) => {
    const button = event.target.closest('button.key:not(:disabled)')
    if (button !== pressed) { pressed = button; invalidate() }
  }
  const release = () => { if (pressed) { pressed = null; invalidate() } }
  const focus = (event) => { focused = event.target; invalidate() }
  const blur = () => { focused = null; pressed = null; invalidate() }
  const keydown = (event) => { if (event.key === ' ' || event.key === 'Enter') press(event) }
  app.addEventListener('pointerdown', press)
  window.addEventListener('pointerup', release)
  window.addEventListener('pointercancel', release)
  app.addEventListener('keydown', keydown)
  app.addEventListener('keyup', release)
  app.addEventListener('focusin', focus)
  app.addEventListener('focusout', blur)
  app.addEventListener('input', update)
  const onResize = () => invalidate(true)
  window.addEventListener('resize', onResize)
  // Seek values are assigned as DOM properties by React, without mutations.
  // A small poll refreshes the GPU only when a range value actually changes.
  let rangeValues = ''
  const poll = setInterval(() => {
    const values = [...app.querySelectorAll('input[type="range"]')].map((input) => input.value).join(':')
    if (values !== rangeValues) { rangeValues = values; invalidate() }
  }, 50)
  document.fonts?.ready.then(() => { if (!disposed) invalidate(true) })
  invalidate(true)

  const contextLost = (event) => {
    event.preventDefault()
    controller.dispose()
    onFailure()
  }
  renderer.domElement.addEventListener('webglcontextlost', contextLost)
  const controller = {
    get rotation() { return rotation },
    hold() { returning = false; markMotion(); invalidate(false, false) },
    setDeviceTilt(x, y, frameTime) {
      if (!Number.isFinite(x) || !Number.isFinite(y) || disposed) return
      displayTilt = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) }
      if (Number.isFinite(frameTime)) {
        // The sensor smoother is already running in an animation frame. Render
        // here instead of waiting for a second RAF and adding a frame of latency.
        cancelAnimationFrame(scheduled)
        draw(frameTime)
      } else invalidate(false, false)
    },
    rotate(x, y) {
      returning = false
      const next = clampRotation(x, y)
      if (next.x === rotation.x && next.y === rotation.y) return
      rotation = next
      markMotion()
      invalidate(false, false)
    },
    reset() {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        returning = false
        rotation = { ...restRotation }
      } else {
        returning = true
        lastFrameTime = performance.now()
      }
      invalidate(false, false)
    },
    dispose() {
      if (disposed) return
      disposed = true
      cancelAnimationFrame(scheduled)
      clearTimeout(resolutionTimer)
      clearInterval(poll)
      resize.disconnect()
      mutations.disconnect()
      app.removeEventListener('pointerdown', press)
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
      app.removeEventListener('keydown', keydown)
      app.removeEventListener('keyup', release)
      app.removeEventListener('focusin', focus)
      app.removeEventListener('focusout', blur)
      app.removeEventListener('input', update)
      window.removeEventListener('resize', onResize)
      disposeModel(model)
      holeNormals.dispose()
      rimNormals.dispose()
      displayEnvironment?.dispose()
      key.shadow.dispose()
      renderer.domElement.removeEventListener('webglcontextlost', contextLost)
      renderer.dispose()
      renderer.domElement.remove()
      stage.classList.remove('is-3d')
      stage.style.height = ''
      viewport.style.perspective = ''
      pose.style.transform = ''
      app.style.removeProperty('--display-z')
    },
  }
  return controller
}
