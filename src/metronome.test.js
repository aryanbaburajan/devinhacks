import assert from 'node:assert/strict'
import { test } from 'node:test'
import engine from 'web-audio-engine'
import { metronomeBuffer } from './metronome.js'

test('metronome clicks follow BPM and remain silent between beats', () => {
  const context = new engine.OfflineAudioContext(1, 16000, 16000)
  for (const bpm of [60, 120, 200]) {
    const buffer = metronomeBuffer(context, bpm, 30)
    const samples = buffer.getChannelData(0)
    assert.equal(buffer.duration, 30)
    const beat = 60 / bpm
    for (let time = 0; time < 29; time += beat) {
      const offset = Math.round(time * buffer.sampleRate)
      assert.ok(samples.slice(offset, offset + 400).some((value) => Math.abs(value) > 0.05))
      assert.equal(samples[offset + Math.round(beat / 2 * buffer.sampleRate)], 0)
    }
  }
})
