import assert from 'node:assert/strict'
import { test } from 'node:test'
import engine from 'web-audio-engine'
import { renderPianoEvents } from './piano.js'

globalThis.OfflineAudioContext = engine.OfflineAudioContext

function sampleLoader(silent = false) {
  return {
    async load(preset) {
      const context = new engine.OfflineAudioContext(1, 32000, 16000)
      const sample = context.createBuffer(1, 32000, 16000)
      if (!silent) {
        const data = sample.getChannelData(0)
        for (let i = 0; i < data.length; i++) {
          data[i] = 0.1 * Math.sin(2 * Math.PI * 440 * i / 16000) * Math.exp(-i / 32000)
        }
      }
      return new Map(preset.groups.flatMap((group) => group.regions.map((region) => [region.sample, sample])))
    },
  }
}

function peak(audio, start, end) {
  return audio.getChannelData(0).slice(start * audio.sampleRate, end * audio.sampleRate)
    .reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0)
}

test('offline piano schedules later notes and preserves ringing tails', async () => {
  const events = [{ note: 60, time: 1 }, { note: 64, time: 4 }, { note: 67, time: 8 }]
  const audio = await renderPianoEvents(events, { duration: 11, sampleRate: 16000, loader: sampleLoader() })
  assert.equal(audio.duration, 11)
  assert.equal(peak(audio, 0, 0.9), 0)
  for (const { time } of events) {
    assert.ok(peak(audio, time, time + 0.3) > 0.1, `audible note at ${time}s`)
    assert.ok(peak(audio, time + 0.7, time + 1) > 0.05, `ringing tail at ${time}s`)
  }
  assert.ok(peak(audio, 0, 11) <= 0.801)
})

test('silent sample failures are reported instead of cached as successful piano', async () => {
  await assert.rejects(renderPianoEvents([{ note: 60, time: 1 }], {
    duration: 3, sampleRate: 16000, loader: sampleLoader(true),
  }), /produced no sound/)
})

test('no detected notes produces silence', async () => {
  const audio = await renderPianoEvents([], { duration: 2, sampleRate: 16000 })
  assert.equal(peak(audio, 0, 2), 0)
})

test('sample loading failure is surfaced and a new attempt can render', async () => {
  const events = [{ note: 60, time: 1 }]
  await assert.rejects(renderPianoEvents(events, {
    duration: 3, sampleRate: 16000, loader: { load: async () => { throw new Error('Download failed') } },
  }), /Download failed/)
  const stages = []
  const audio = await renderPianoEvents(events, {
    duration: 3, sampleRate: 16000, loader: sampleLoader(), onStage: (stage) => stages.push(stage),
  })
  assert.deepEqual(stages, ['Loading samples…', 'Rendering…'])
  assert.ok(peak(audio, 1, 1.3) > 0.1)
})

test('canceling sample preparation does not wait for a stalled download', async () => {
  const controller = new AbortController()
  const rendering = renderPianoEvents([{ note: 60, time: 1 }], {
    duration: 3, sampleRate: 16000, loader: { load: () => new Promise(() => {}) }, signal: controller.signal,
  })
  controller.abort()
  await assert.rejects(rendering, { name: 'AbortError' })
})
