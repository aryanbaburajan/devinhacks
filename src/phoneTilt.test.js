import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { listenForTilt, orientationOffset } from './phoneTilt.js'

test('tilt responds every animation frame, settles quickly, and stops rendering at rest', () => {
  const dom = new JSDOM('', { pretendToBeVisual: true })
  const original = Object.fromEntries(['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame'].map((key) => [key, globalThis[key]]))
  const scheduled = new Map()
  let nextId = 0
  Object.assign(globalThis, {
    window: dom.window, document: dom.window.document,
    requestAnimationFrame: (callback) => { scheduled.set(++nextId, callback); return nextId },
    cancelAnimationFrame: (id) => scheduled.delete(id),
  })
  const values = []
  const stop = listenForTilt((value, time) => values.push({ ...value, time }), () => {})
  const sensor = (beta, gamma) => {
    const event = new dom.window.Event('deviceorientation')
    Object.assign(event, { beta, gamma })
    dom.window.dispatchEvent(event)
  }
  const tick = (time) => {
    const callbacks = [...scheduled.values()]
    scheduled.clear()
    callbacks.forEach((callback) => callback(time))
  }
  try {
    sensor(40, 5)
    assert.equal(scheduled.size, 0)
    sensor(60, 25)
    tick(16)
    tick(32)
    assert.equal(values.length, 2)
    assert.deepEqual(values.map((value) => value.time), [16, 32])
    for (let time = 48; time <= 112; time += 16) tick(time)
    assert.ok(values.at(-1).x > 0.47 && values.at(-1).y > 0.47)
    for (let time = 128; time < 500; time += 16) tick(time)
    assert.equal(scheduled.size, 0)
    const count = values.length
    for (let time = 500; time < 1500; time += 16) { sensor(60, 25); tick(time) }
    assert.equal(values.length, count)
    sensor(70, 30)
    assert.equal(scheduled.size, 1)
    stop()
    assert.equal(scheduled.size, 0)
    sensor(80, 40)
    assert.equal(scheduled.size, 0)
  } finally {
    stop()
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
    dom.window.close()
  }
})

test('phone tilt is relative to the held angle and bounded', () => {
  const baseline = { beta: 40, gamma: 5 }
  assert.deepEqual(orientationOffset(40, 5, baseline), { x: 0, y: 0 })
  assert.deepEqual(orientationOffset(60, 25, baseline), { x: 0.5, y: 0.5 })
  assert.deepEqual(orientationOffset(140, 85, baseline), { x: 1, y: 1 })
  assert.equal(orientationOffset(null, 5, baseline), null)
  assert.equal(orientationOffset(10, NaN, baseline), null)
})

test('landscape remaps axes and beta wraps across the sensor boundary', () => {
  const landscape = orientationOffset(20, 0, { beta: 0, gamma: 0 }, 90)
  assert.equal(landscape.x, 0.5)
  assert.ok(Math.abs(landscape.y) < 1e-10)
  const wrapped = orientationOffset(-179, 0, { beta: 179, gamma: 0 })
  assert.equal(wrapped.y, 0.05)
})
