import assert from 'node:assert/strict'
import { test } from 'node:test'
import { analyzeMelody } from './melodyAnalysis.js'
import { pianoNotes } from './pianoNotes.js'

function melody(sampleRate, notes, amplitude = 0.2) {
  const samples = new Float32Array(sampleRate * notes.length * 0.5)
  for (let i = 0; i < samples.length; i++) {
    const note = notes[Math.floor(i / (sampleRate * 0.5))]
    if (note === null) continue
    const frequency = 440 * 2 ** ((note - 69) / 12)
    const phase = 2 * Math.PI * frequency * i / sampleRate
    samples[i] = amplitude * (Math.sin(phase) + 0.3 * Math.sin(phase * 2) + 0.15 * Math.sin(phase * 3))
  }
  return samples
}

for (const sampleRate of [44100, 48000]) {
  test(`audio-to-notes preserves melody and rests at ${sampleRate} Hz`, () => {
    const samples = melody(sampleRate, [64, 67, null, 69, 81, null])
    const frames = analyzeMelody([samples], sampleRate)
    const events = pianoNotes(frames, 3)
    assert.deepEqual(events.map((event) => event.note), [64, 67, 69, 81])
    for (const [index, time] of [0, 0.5, 1.5, 2].entries()) {
      assert.ok(Math.abs(events[index].time - time) < 0.06)
      assert.ok(Math.abs(events[index].duration - 0.5) < 0.08)
    }
  })
}

test('quiet input, right-only stereo and opposite-phase stereo retain pitch', () => {
  const samples = melody(44100, [69, 71], 0.003)
  for (const channels of [[samples], [new Float32Array(samples.length), samples], [samples, samples.map((x) => -x)]]) {
    assert.deepEqual(pianoNotes(analyzeMelody(channels, 44100), 1).map((event) => event.note), [69, 71])
  }
})

test('silence, DC offset and deterministic broadband noise produce no notes', () => {
  let seed = 123
  const noise = Float32Array.from({ length: 44100 }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return (seed / 2 ** 32 - 0.5) * 0.2
  })
  for (const samples of [new Float32Array(44100), new Float32Array(44100).fill(0.2), noise]) {
    assert.deepEqual(pianoNotes(analyzeMelody([samples], 44100), 1), [])
  }
})

test('short clips are analyzed and scale/octave changes reuse their frames', () => {
  const samples = melody(48000, [66]).slice(0, 4800)
  const frames = analyzeMelody([samples], 48000)
  assert.equal(pianoNotes(frames, 0.1)[0].note, 66)
  assert.equal(pianoNotes(frames, 0.1, 1)[0].note, 78)
  assert.ok([65, 67].includes(pianoNotes(frames, 0.1, 0, '0:major')[0].note))
})
