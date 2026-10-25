import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { JSDOM } from 'jsdom'
import { IDBFactory } from 'fake-indexeddb'
import engine from 'web-audio-engine'
import { createServer } from 'vite'
import { act, createElement } from 'react'
import { saveProject, loadProject } from './audioStore.js'
import midiFile from 'midi-file'

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' })
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.IS_REACT_ACT_ENVIRONMENT = true
globalThis.requestAnimationFrame = () => 1
globalThis.cancelAnimationFrame = () => {}
window.alert = (message) => { throw new Error(message) }
const { createRoot } = await import('react-dom/client')
let sourceStarts = 0
class TestContext extends engine.OfflineAudioContext {
  constructor() { super(1, 480000, 8000) }
  async resume() {}
  async close() {}
  async decodeAudioData() { return this.createBuffer(2, 4000, 8000) }
  createBufferSource() {
    const source = super.createBufferSource()
    const start = source.start.bind(source)
    source.start = (...args) => { if (source.buffer?.duration >= 1) sourceStarts++; start(...args) }
    return source
  }
}
globalThis.AudioContext = TestContext
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true, hmr: false },
  plugins: [{ name: 'test-conversion-boundary', enforce: 'pre', transform(code, id) {
    if (id.endsWith('/src/melodyClient.js')) return `export class MelodyClient {
      analyze(buffer, signal, progress) { return globalThis.testAnalyze(buffer, signal, progress) }
      dispose() {}
    }`
    if (id.endsWith('/src/piano.js')) return 'export const renderPianoEvents = (...args) => globalThis.testRender(...args)'
    if (id.endsWith('/src/deviceScene.js')) return 'export const createDeviceScene = (...args) => globalThis.testCreateDeviceScene(...args)'
  } }],
})
const { default: App } = await server.ssrLoadModule('/src/App.jsx')
after(async () => { await server.close(); dom.window.close() })

const frames = Array.from({ length: 30 }, (_, index) => ({ time: index / 100, pitch: 440, clarity: 1, volume: 0.2 }))
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
async function settle(milliseconds = 20) { await act(async () => { await pause(milliseconds) }) }
async function waitFor(check) {
  for (let i = 0; i < 80; i++) { if (check()) return; await settle(20) }
  assert.fail(`Timed out. UI: ${document.body.textContent}`)
}
function button(text) { return [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === text) }
async function click(text) { await act(async () => button(text).click()) }
async function instrument(value) {
  for (let i = 0; i < 5; i++) {
    const picker = document.querySelector('.instrument-picker')
    if (picker.getAttribute('aria-label').startsWith(`Instrument: ${value}.`)) return
    await act(async () => picker.click())
  }
  assert.fail(`Instrument ${value} was not reachable`)
}
async function mount({ muted = false, initialInstrument = 'Piano', octaveDirection = 1 } = {}) {
  globalThis.indexedDB = new IDBFactory()
  sourceStarts = 0
  globalThis.testAnalyze = async () => frames
  globalThis.testRender = async (events, { onStage }) => {
    onStage('Loading samples…')
    onStage('Rendering…')
    return new TestContext().createBuffer(1, 480000, 8000)
  }
  await saveProject({ bpm: 120, seek: 0, selectedTrackId: 'saved', tracks: [{
    id: 'saved', instrument: initialInstrument, muted, pianoOctaveDirection: octaveDirection,
    audio: { sampleRate: 8000, channels: [new Float32Array(4000).fill(0.1)] },
  }] })
  const root = createRoot(document.getElementById('root'))
  await act(async () => root.render(createElement(App)))
  await waitFor(() => button('Upload tracks') && !button('Upload tracks').disabled)
  return async () => { await act(async () => root.unmount()) }
}

test('restored muted tracks prepare eagerly and BPM changes rerender beat timing', async () => {
  const unmount = await mount({ muted: true })
  try {
    let analyses = 0
    globalThis.testAnalyze = async () => { analyses++; return frames }
    const renderedDurations = []
    globalThis.testRender = async (events) => {
      renderedDurations.push(events[0].duration)
      return new TestContext().createBuffer(1, 480000, 8000)
    }
    await waitFor(() => document.body.textContent.includes('Ready · 1 notes'))
    assert.equal(analyses, 1)
    await act(async () => {
      const slider = document.querySelector('[aria-label="Metronome BPM"]')
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(slider, '150')
      slider.dispatchEvent(new window.Event('input', { bubbles: true }))
      slider.dispatchEvent(new window.Event('change', { bubbles: true }))
    })
    await settle(300)
    assert.equal(analyses, 2)
    assert.deepEqual(renderedDurations, [0.5, 0.4])
    assert.ok(document.body.textContent.includes('150 BPM'))
    const stored = await loadProject()
    assert.equal(stored.bpm, 150)
    assert.equal(stored.tracks[0].audio.channels[0][0], Math.fround(0.1))
    assert.equal(stored.tracks[0].audio.channels[0].length, 480000)
  } finally { await unmount() }
})

test('failed audible conversion blocks playback and Retry starts a new preparation', async () => {
  const unmount = await mount()
  try {
    globalThis.testRender = async () => { throw new Error('Sample download failed') }
    await waitFor(() => button('Retry'))
    await click('Play')
    assert.equal(sourceStarts, 0)
    assert.ok(document.body.textContent.includes('could not be prepared'))
    globalThis.testRender = async () => new TestContext().createBuffer(1, 480000, 8000)
    await click('Retry')
    await waitFor(() => document.body.textContent.includes('Ready · 1 notes'))
    await click('Play')
    assert.ok(sourceStarts > 0)
    await click('Stop')
  } finally { await unmount() }
})

test('muted conversion errors do not block playback', async () => {
  const unmount = await mount({ muted: true })
  try {
    globalThis.testRender = async () => { throw new Error('Sample download failed') }
    await waitFor(() => button('Retry'))
    await click('Play')
    assert.ok(button('Stop'))
    assert.equal(document.querySelector('[role="alert"]'), null)
    await click('Stop')
  } finally { await unmount() }
})

test('canceling Play prevents delayed preparation from starting playback', async () => {
  const unmount = await mount()
  try {
    let resolve
    globalThis.testAnalyze = () => new Promise((done) => { resolve = done })
    await waitFor(() => resolve)
    await click('Play')
    assert.ok(document.body.textContent.includes('Preparing…'))
    await click('Cancel')
    await act(async () => resolve(frames))
    await waitFor(() => document.body.textContent.includes('Ready · 1 notes'))
    assert.equal(sourceStarts, 0)
    assert.ok(button('Play'))
  } finally { await unmount() }
})

test('instrument changes reject stale preparation results', async () => {
  const unmount = await mount({ initialInstrument: 'Guitar' })
  try {
    let resolveOld
    globalThis.testAnalyze = () => new Promise((resolve) => { resolveOld = resolve })
    await waitFor(() => resolveOld)
    globalThis.testAnalyze = async () => frames
    await instrument('Electric Guitar')
    await waitFor(() => document.body.textContent.includes('Ready · 1 notes'))
    await act(async () => resolveOld([]))
    assert.ok(document.body.textContent.includes('Ready · 1 notes'))
    assert.ok(!document.body.textContent.includes('No melody detected'))
  } finally { await unmount() }
})

test('imported files add locally saved tracks without replacing existing recordings', async () => {
  const unmount = await mount({ initialInstrument: 'Vocal' })
  try {
    const input = document.querySelector('input[type="file"]')
    Object.defineProperty(input, 'files', { configurable: true, value: [{ name: 'melody.wav', arrayBuffer: async () => new ArrayBuffer(4) }] })
    await act(async () => input.dispatchEvent(new window.Event('change', { bubbles: true })))
    await waitFor(() => document.querySelectorAll('.track').length === 2)
    await settle(300)
    const stored = await loadProject()
    assert.equal(stored.tracks.length, 2)
    assert.equal(stored.tracks[0].audio.channels[0][0], Math.fround(0.1))
    assert.equal(stored.tracks[1].audio.channels.length, 2)
    assert.equal(stored.tracks[1].audio.channels[0].length, 480000)
  } finally { await unmount() }
})

test('deleting a track cancels its pending preparation and ignores late completion', async () => {
  const unmount = await mount()
  try {
    let resolveOld
    let signal
    globalThis.testAnalyze = (_, jobSignal) => {
      signal = jobSignal
      return new Promise((resolve) => { resolveOld = resolve })
    }
    await waitFor(() => resolveOld)
    await click('Create track')
    await click('Delete track')
    assert.equal(signal.aborted, true)
    await act(async () => resolveOld(frames))
    assert.equal(document.querySelectorAll('.track').length, 1)
    assert.ok(!document.body.textContent.includes('Ready ·'))
  } finally { await unmount() }
})

test('background dragging retains its angle on release; reset is explicit and controls are not hijacked', async () => {
  window.WebGL2RenderingContext = class {}
  window.ResizeObserver = class {}
  let orientation = { x: 9, y: -12 }
  let rotations = 0, returns = 0, disposed = false
  globalThis.testCreateDeviceScene = () => ({
    get rotation() { return orientation },
    hold() {},
    setDeviceTilt() {},
    rotate(x, y) { rotations++; orientation = { x, y } },
    reset() { returns++; orientation = { x: 9, y: -12 } },
    dispose() { disposed = true },
  })
  const unmount = await mount({ initialInstrument: 'Vocal' })
  try {
    await waitFor(() => document.querySelector('.rotation-grip-left'))
    const grip = document.querySelector('.rotation-grip-left')
    const background = document.querySelector('.rotation-backdrop')
    const view = document.querySelector('.device-view')
    view.setPointerCapture = () => {}
    view.hasPointerCapture = () => false
    await act(async () => {
      background.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 20 }))
      background.dispatchEvent(new window.MouseEvent('pointermove', { bubbles: true, clientX: 40, clientY: 70 }))
    })
    assert.deepEqual(orientation, { x: -1, y: -6 })
    await act(async () => background.dispatchEvent(new window.MouseEvent('pointerup', { bubbles: true })))
    assert.deepEqual(orientation, { x: -1, y: -6 })
    assert.equal(returns, 0)
    await act(async () => grip.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    assert.deepEqual(orientation, { x: -1, y: -3 })
    await act(async () => grip.dispatchEvent(new window.KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true })))
    assert.deepEqual(orientation, { x: -1, y: -3 })
    await act(async () => button('Create track').dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true, button: 0 })))
    await click('Create track')
    assert.equal(rotations, 2)
    assert.equal(document.querySelectorAll('.track').length, 2)
    await click('Reset view')
    assert.deepEqual(orientation, { x: 9, y: -12 })
  } finally {
    await unmount()
    delete window.WebGL2RenderingContext
    delete window.ResizeObserver
  }
  assert.ok(disposed)
})

test('studio starts without AudioWorkletNode or randomUUID and can create and duplicate tracks', async () => {
  assert.equal(typeof globalThis.AudioWorkletNode, 'undefined')
  const original = Object.getOwnPropertyDescriptor(globalThis.crypto, 'randomUUID')
  Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: undefined })
  let unmount
  try {
    unmount = await mount({ initialInstrument: 'Vocal' })
    assert.ok(button('Play'))
    await click('Create track')
    await click('Duplicate track')
    assert.equal(document.querySelectorAll('.track').length, 3)
    await settle(300)
    const stored = await loadProject()
    assert.equal(new Set(stored.tracks.map((track) => track.id)).size, 3)
    assert.match(stored.tracks[1].id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  } finally {
    if (unmount) await unmount()
    if (original) Object.defineProperty(globalThis.crypto, 'randomUUID', original)
    else delete globalThis.crypto.randomUUID
  }
})

test('mobile blocks drag rotation and automatically sends phone tilt to the scene', async () => {
  const oldWidth = window.innerWidth
  const oldRaf = globalThis.requestAnimationFrame
  window.innerWidth = 390
  window.WebGL2RenderingContext = class {}
  window.ResizeObserver = class {}
  let permissionCalls = 0, rotations = 0, paint
  window.DeviceOrientationEvent = { requestPermission: async () => { permissionCalls++; return 'granted' } }
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  globalThis.requestAnimationFrame = (callback) => { paint = callback; return 1 }
  const lights = []
  globalThis.testCreateDeviceScene = () => ({
    rotation: { x: 0, y: 0 }, hold() {}, rotate() { rotations++ }, reset() {}, dispose() {},
    setDeviceTilt(x, y) { lights.push({ x, y }) },
  })
  const unmount = await mount({ initialInstrument: 'Vocal' })
  try {
    await waitFor(() => document.querySelector('.is-3d'))
    assert.equal(document.querySelector('.rotation-grip'), null)
    assert.equal(button('Reset view'), undefined)
    const background = document.querySelector('.rotation-backdrop')
    const down = new window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientX: 0, clientY: 0 })
    await act(async () => {
      background.dispatchEvent(down)
      background.dispatchEvent(new window.MouseEvent('pointermove', { bubbles: true, clientX: 100, clientY: 100 }))
      background.dispatchEvent(new window.MouseEvent('pointerup', { bubbles: true }))
    })
    assert.equal(rotations, 0)
    assert.equal(down.defaultPrevented, false)
    assert.equal(permissionCalls, 0)
    assert.equal(button('Enable tilt'), undefined)
    await act(async () => background.dispatchEvent(new window.MouseEvent('click', { bubbles: true })))
    assert.equal(permissionCalls, 1)
    function sensor(beta, gamma) {
      const event = new window.Event('deviceorientation')
      Object.assign(event, { beta, gamma })
      window.dispatchEvent(event)
    }
    await act(async () => sensor(40, 5))
    await act(async () => { sensor(60, 25); paint(140) })
    assert.ok(lights.at(-1).x > 0 && lights.at(-1).y > 0)
    assert.equal(rotations, 0)
    assert.equal(button('Tilt on'), undefined)
    await click('Create track')
    assert.equal(permissionCalls, 1)
    await act(async () => { sensor(80, 40); paint(180) })
    assert.ok(lights.at(-1).x > 0 && lights.at(-1).y > 0)
  } finally {
    await unmount()
    window.innerWidth = oldWidth
    globalThis.requestAnimationFrame = oldRaf
    delete window.WebGL2RenderingContext
    delete window.ResizeObserver
    delete window.DeviceOrientationEvent
    delete document.hidden
  }
})

test('instrument button cycles through every instrument and wraps back to mic', async () => {
  const unmount = await mount({ initialInstrument: 'Vocal' })
  try {
    const picker = document.querySelector('.instrument-picker')
    picker.focus()
    for (const value of ['Guitar', 'Electric Guitar', 'Piano', 'Saxophone', 'Vocal']) {
      await act(async () => picker.click())
      assert.ok(picker.getAttribute('aria-label').startsWith(`Instrument: ${value}.`))
      assert.equal(document.activeElement, picker)
    }
    assert.equal(document.querySelector('dialog'), null)
    assert.equal(document.querySelector('[role="radiogroup"]'), null)
  } finally {
    await unmount()
  }
})

test('saved retired instruments become playable vocals without losing their recordings', async () => {
  for (const initialInstrument of ['Vocal (autotuned)', 'Voice (autotuned)', 'Drum']) {
    const unmount = await mount({ initialInstrument })
    try {
      assert.equal(document.querySelector('.instrument-picker').getAttribute('aria-label'), 'Instrument: Vocal. Next: Guitar')
      await click('Play')
      await waitFor(() => button('Stop'))
      assert.ok(sourceStarts > 0)
      await click('Stop')
      await settle(300)
      const saved = await loadProject()
      assert.equal(saved.tracks.length, 1)
      assert.equal(saved.tracks[0].instrument, 'Vocal')
      assert.equal(saved.tracks[0].audio.sampleRate, 8000)
      assert.ok(saved.tracks[0].audio.channels[0].subarray(0, 4000).every((sample) => sample === Math.fround(0.1)))
      assert.ok(!('autotunedAudio' in saved.tracks[0]))
    } finally { await unmount() }
  }
})

test('inline octave cycles through its range and new tracks default to E minor without a scale control', async () => {
  const unmount = await mount()
  try {
    const row = document.querySelector('.track-settings')
    assert.equal(document.querySelector('[aria-label="Track settings"]'), null)
    const octave = row.querySelector('.octave-cycle')
    assert.equal(row.querySelector('select'), null)
    assert.equal(octave.textContent, '0')
    for (const expected of ['+1', '+2', '0', '-1', '-2', '0', '+1', '+2', '0', '-1', '-2', '0']) {
      await act(async () => octave.click())
      assert.equal(octave.textContent, expected)
    }
    assert.equal(document.querySelector('dialog'), null)
    assert.ok(document.querySelector('.mute-key svg[aria-hidden="true"]'))
    await click('Mute')
    assert.equal(document.querySelector('.mute-key').getAttribute('aria-label'), 'Unmute')
    await click('Create track')
    await settle(300)
    const saved = await loadProject()
    assert.equal(saved.tracks.length, 2)
    assert.ok(saved.tracks.every((track) => track.pianoScale === '4:minor' && track.pianoOctave === 0))
  } finally {
    await unmount()
  }
})

test('restored zero octave remembers that the next cycle is negative', async () => {
  const unmount = await mount({ octaveDirection: -1 })
  try {
    const octave = document.querySelector('.octave-cycle')
    assert.equal(octave.textContent, '0')
    for (const expected of ['-1', '-2', '0', '+1', '+2', '0']) {
      await act(async () => octave.click())
      assert.equal(octave.textContent, expected)
    }
    await settle(300)
    const saved = await loadProject()
    assert.equal(saved.tracks[0].pianoOctave, 0)
    assert.equal(saved.tracks[0].pianoOctaveDirection, -1)
  } finally { await unmount() }
})

test('MIDI export downloads generated notes even when sample rendering fails and excludes muted tracks', async () => {
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL
  const originalClick = window.HTMLAnchorElement.prototype.click
  let download, blob
  URL.createObjectURL = (value) => { blob = value; return 'blob:test-midi' }
  URL.revokeObjectURL = () => {}
  window.HTMLAnchorElement.prototype.click = function () { download = this.download }
  const unmount = await mount()
  try {
    globalThis.testRender = async () => { throw new Error('Samples unavailable') }
    await waitFor(() => document.body.textContent.includes('Samples unavailable'))
    await act(async () => document.querySelector('.octave-cycle').click())
    await click('Duplicate track')
    await click('Mute')
    assert.ok(document.querySelector('.export-controls').contains(button('Export MIDI')))
    await click('Export MIDI')
    await waitFor(() => download)
    assert.equal(download, 'S-251X.mid')
    assert.equal(blob.type, 'audio/midi')
    const midi = midiFile.parseMidi(new Uint8Array(await blob.arrayBuffer()))
    assert.equal(midi.tracks.length, 2)
    assert.equal(midi.tracks[1].find((event) => event.type === 'trackName').text, '2 Piano')
    assert.equal(midi.tracks[1].find((event) => event.type === 'noteOn').noteNumber, 81)
    assert.equal(document.querySelector('[role="alert"]'), null)
    assert.equal(button('Export MIDI').disabled, false)
  } finally {
    await unmount()
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
    window.HTMLAnchorElement.prototype.click = originalClick
  }
})

test('denied phone motion access leaves the studio usable', async () => {
  const oldWidth = window.innerWidth
  window.innerWidth = 390
  let permissionCalls = 0
  window.DeviceOrientationEvent = { requestPermission: async () => { permissionCalls++; return 'denied' } }
  const unmount = await mount({ initialInstrument: 'Vocal' })
  try {
    await act(async () => document.body.dispatchEvent(new window.MouseEvent('click', { bubbles: true })))
    assert.ok(document.body.textContent.includes('Motion access denied'))
    await click('Create track')
    assert.equal(document.querySelectorAll('.track').length, 2)
    assert.equal(permissionCalls, 1)
  } finally {
    await unmount()
    window.innerWidth = oldWidth
    delete window.DeviceOrientationEvent
  }
})
