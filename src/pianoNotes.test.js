import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pianoNotes, snapPianoNote, PIANO_SCALES } from './pianoNotes.js'

function framesAt(length, sample) {
  return Array.from({ length: Math.round(length * 100) }, (_, i) => ({ time: i / 100, clarity: 0.95, volume: 0.1, ...sample(i / 100) }))
}

test('irregular pitch changes are sampled once per beat', () => {
  const frames = framesAt(1, (time) => ({ pitch: time < 0.13 ? null : time < 0.47 ? 440 : time < 0.82 ? 494 : null }))
  const notes = pianoNotes(frames, 1)
  assert.deepEqual(notes, [{ note: 69, time: 0, duration: 0.5 }, { note: 71, time: 0.5, duration: 0.5 }])
})

test('a sustained note rings across beats despite vibrato or brief dropouts', () => {
  const frames = framesAt(2, (time) => ({ pitch: time === 0.5 ? null : 440 * 2 ** (0.2 * Math.sin(time * 30) / 12) }))
  const notes = pianoNotes(frames, 2)
  assert.deepEqual(notes, [{ note: 69, time: 0, duration: 2 }])
  assert.deepEqual(pianoNotes(frames, 2, 0, undefined, 60), notes)
})

test('silent beats stay silent even when volume rises without a detected pitch', () => {
  const frames = framesAt(2, (time) => ({ pitch: time >= 0.5 && time < 1 ? null : 440, volume: time >= 0.73 ? 0.3 : 0.1 }))
  assert.deepEqual(pianoNotes(frames, 2).map((event) => event.time), [0, 1])
  assert.deepEqual(pianoNotes(framesAt(1, () => ({ pitch: null })), 1), [])
})

test('clear volume attacks retrigger the same pitch on the nearest beat, only once', () => {
  for (const attack of [0.47, 0.53]) {
    const frames = framesAt(2, (time) => ({ pitch: 440, volume: time < attack ? 0.05 : 0.2 }))
    assert.deepEqual(pianoNotes(frames, 2), [
      { note: 69, time: 0, duration: 0.5 }, { note: 69, time: 0.5, duration: 1.5 },
    ])
  }
})

test('volume attacks follow BPM and combine with pitch changes without duplicate notes', () => {
  const frames = framesAt(2, (time) => ({ pitch: time < 1.5 ? 440 : 494, volume: time < 0.9 ? 0.05 : 0.2 }))
  assert.deepEqual(pianoNotes(frames, 2), [
    { note: 69, time: 0, duration: 1 }, { note: 69, time: 1, duration: 0.5 }, { note: 71, time: 1.5, duration: 0.5 },
  ])
  const simultaneous = framesAt(2, (time) => ({ pitch: time < 1 ? 440 : 494, volume: time < 0.9 ? 0.05 : 0.2 }))
  assert.deepEqual(pianoNotes(simultaneous, 2, 0, undefined, 60), [
    { note: 69, time: 0, duration: 1 }, { note: 71, time: 1, duration: 1 },
  ])
})

test('volume flutter, a one-frame spike, slow swells and decay do not retrigger held notes', () => {
  for (const envelope of [
    (time) => 0.1 + 0.015 * Math.sin(time * 25),
    (time) => time === 0.5 ? 0.8 : 0.1,
    (time) => 0.05 + time * 0.1,
    (time) => 0.2 * Math.exp(-time),
    () => undefined,
  ]) {
    const frames = framesAt(2, (time) => ({ pitch: 440, volume: envelope(time) }))
    assert.deepEqual(pianoNotes(frames, 2), [{ note: 69, time: 0, duration: 2 }])
  }
})

test('isolated pitch jumps are ignored and octave controls transpose notes', () => {
  const frames = framesAt(1, (time) => ({ pitch: time === 0.5 ? 880 : 440 }))
  assert.equal(pianoNotes(frames, 1).length, 1)
  assert.equal(pianoNotes(frames, 1, 1)[0].note, 81)
  assert.equal(pianoNotes(frames, 1, -1)[0].note, 57)
})

test('a short note crossing a beat triggers once, while a genuine rest separates notes', () => {
  const crossing = framesAt(1, (time) => ({ pitch: time >= 0.4 && time < 0.6 ? 440 : null }))
  assert.deepEqual(pianoNotes(crossing, 1), [{ note: 69, time: 0, duration: 1 }])
  const repeated = framesAt(1, (time) => ({ pitch: time < 0.4 || time >= 0.6 ? 440 : null }))
  assert.deepEqual(pianoNotes(repeated, 1), [
    { note: 69, time: 0, duration: 0.5 }, { note: 69, time: 0.5, duration: 0.5 },
  ])
})

test('note duration is clipped at the song boundary', () => {
  const frames = framesAt(0.2, () => ({ pitch: 440 })).map((frame) => ({ ...frame, time: frame.time + 59.9 }))
  const [note] = pianoNotes(frames, 60)
  assert.equal(note.time, 59.5)
  assert.equal(note.duration, 0.5)
  const [partial] = pianoNotes(frames, 59.95)
  assert.ok(Math.abs(partial.time + partial.duration - 59.95) < 0.001)
})

test('default E natural minor preserves scale notes and rounds others to the nearest note', () => {
  for (const note of [64, 66, 67, 69, 71, 72, 74]) assert.equal(snapPianoNote(note), note)
  assert.equal(snapPianoNote(68), 67)
  assert.equal(snapPianoNote(68.3), 69)
  assert.equal(snapPianoNote(66, '0:major'), 65)
  assert.equal(snapPianoNote(68, undefined, 1), 79)
})

test('every selectable scale constrains notes even at piano range boundaries', () => {
  for (const scale of PIANO_SCALES) {
    for (const midi of [0, 21, 60.2, 68, 108, 127]) {
      const note = snapPianoNote(midi, scale.value)
      assert.ok(note >= 21 && note <= 108)
      assert.ok(scale.notes.includes(note % 12), `${scale.label}: ${note}`)
    }
  }
})
