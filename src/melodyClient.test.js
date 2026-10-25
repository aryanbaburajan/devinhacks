import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MelodyClient } from './melodyClient.js'
import { Worker } from 'node:worker_threads'

function harness() {
  const workers = []
  const client = new MelodyClient(() => {
    const worker = {
      postMessage(message) { this.message = message },
      terminate() { this.terminated = true },
      finish(frames = []) { this.onmessage({ data: { id: this.message.id, frames } }) },
    }
    workers.push(worker)
    return worker
  })
  const samples = new Float32Array([0.1, 0.2])
  const buffer = () => ({ numberOfChannels: 1, sampleRate: 44100, getChannelData: () => samples })
  return { workers, client, buffer, samples }
}

test('analysis is shared, cached and transfers copies of source audio', async () => {
  const { workers, client, buffer, samples } = harness()
  const source = buffer()
  const first = client.analyze(source)
  const second = client.analyze(source)
  assert.equal(workers.length, 1)
  assert.notEqual(workers[0].message.channels[0].buffer, samples.buffer)
  workers[0].finish([{ pitch: 440 }])
  assert.deepEqual(await first, await second)
  assert.deepEqual(await client.analyze(source), [{ pitch: 440 }])
  assert.equal(workers.length, 1)
})

test('canceling obsolete queued work does not start it or affect another track', async () => {
  const { workers, client, buffer } = harness()
  const first = client.analyze(buffer())
  const controller = new AbortController()
  const second = client.analyze(buffer(), controller.signal)
  controller.abort()
  await assert.rejects(second, { name: 'AbortError' })
  workers[0].finish()
  await first
  assert.equal(workers.length, 1)
})

test('canceling one consumer preserves shared work; canceling all terminates it', async () => {
  const { workers, client, buffer } = harness()
  const source = buffer()
  const a = new AbortController()
  const b = new AbortController()
  const first = client.analyze(source, a.signal)
  const second = client.analyze(source, b.signal)
  a.abort()
  await assert.rejects(first, { name: 'AbortError' })
  assert.equal(workers[0].terminated, undefined)
  b.abort()
  await assert.rejects(second, { name: 'AbortError' })
  assert.equal(workers[0].terminated, true)
  workers[0].finish([{ pitch: 880 }])
  const retry = client.analyze(source)
  assert.equal(workers.length, 2)
  workers[1].finish([{ pitch: 440 }])
  assert.deepEqual(await retry, [{ pitch: 440 }])
})

test('worker failures can retry and disposal rejects outstanding work', async () => {
  const { workers, client, buffer } = harness()
  const source = buffer()
  const first = client.analyze(source)
  workers[0].onerror()
  await assert.rejects(first, /worker failed/)
  const second = client.analyze(source)
  const queued = client.analyze(buffer())
  client.dispose()
  await assert.rejects(second, { name: 'AbortError' })
  await assert.rejects(queued, { name: 'AbortError' })
  assert.equal(workers[1].terminated, true)
})

test('actual worker protocol analyzes transferred audio without altering its source', async () => {
  const workerModule = new URL('./melody.worker.js', import.meta.url).href
  const client = new MelodyClient(() => {
    const code = `import { parentPort } from 'node:worker_threads';
      globalThis.self = { postMessage: (data) => parentPort.postMessage(data) };
      await import(${JSON.stringify(workerModule)});
      parentPort.on('message', (data) => self.onmessage({ data }));`
    const worker = new Worker(new URL(`data:text/javascript,${encodeURIComponent(code)}`))
    const adapter = { postMessage: (...args) => worker.postMessage(...args), terminate: () => worker.terminate() }
    worker.on('message', (data) => adapter.onmessage?.({ data }))
    worker.on('error', () => adapter.onerror?.())
    return adapter
  })
  const samples = Float32Array.from({ length: 44100 }, (_, i) => 0.2 * Math.sin(2 * Math.PI * 440 * i / 44100))
  try {
    const frames = await client.analyze({ numberOfChannels: 1, sampleRate: 44100, getChannelData: () => samples })
    const voiced = frames.filter((frame) => frame.pitch)
    assert.ok(voiced.length > 90)
    assert.ok(voiced.every((frame) => Math.abs(frame.pitch - 440) < 2))
    assert.equal(samples.length, 44100)
    assert.ok(samples.some((sample) => sample !== 0))
  } finally { client.dispose() }
})
