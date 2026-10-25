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

test('a sustained note retriggers on every beat despite vibrato or brief dropouts', () => {
  const frames = framesAt(2, (time) => ({ pitch: time === 0.5 ? null : 440 * 2 ** (0.2 * Math.sin(time * 30) / 12) }))
  const notes = pianoNotes(frames, 2)
  assert.equal(notes.length, 4)
  assert.ok(notes.every((note) => note.note === 69 && note.duration === 0.5))
  assert.deepEqual(notes.map((note) => note.time), [0, 0.5, 1, 1.5])
  assert.equal(pianoNotes(frames, 2, 0, undefined, 60).length, 2)
})

test('silent beats stay silent and volume attacks do not add extra notes', () => {
  const frames = framesAt(2, (time) => ({ pitch: time >= 0.5 && time < 1 ? null : 440, volume: time >= 0.73 ? 0.3 : 0.1 }))
  assert.deepEqual(pianoNotes(frames, 2).map((event) => event.time), [0, 1, 1.5])
  assert.deepEqual(pianoNotes(framesAt(1, () => ({ pitch: null })), 1), [])
})

test('isolated pitch jumps are ignored and octave controls transpose notes', () => {
  const frames = framesAt(1, (time) => ({ pitch: time === 0.5 ? 880 : 440 }))
  assert.equal(pianoNotes(frames, 1).length, 2)
  assert.equal(pianoNotes(frames, 1, 1)[0].note, 81)
  assert.equal(pianoNotes(frames, 1, -1)[0].note, 57)
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
