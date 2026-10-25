import assert from 'node:assert/strict'
import { test } from 'node:test'
import midiFile from 'midi-file'
import { createMidi } from './midiExport.js'
import { pianoNotes } from './pianoNotes.js'

function timed(events) {
  let tick = 0
  return events.map((event) => ({ ...event, tick: tick += event.deltaTime }))
}

test('MIDI preserves generated notes, beat timing, tempo, instruments and the 60-second endpoint', () => {
  const events = pianoNotes([{ time: 0.1, pitch: 440, clarity: 1 }, { time: 0.8, pitch: 440, clarity: 1 }], 60, 1, '4:minor', 90)
  const bytes = createMidi({ bpm: 90, tracks: [
    { name: '2 Piano', instrument: 'Piano', events },
    { instrument: 'Guitar', events: [{ time: 59.5, duration: 3, note: 64 }] },
    { instrument: 'Electric Guitar', events: [] },
  ] })
  assert.equal(new TextDecoder().decode(bytes.subarray(0, 4)), 'MThd')
  const midi = midiFile.parseMidi(bytes)
  assert.deepEqual(midi.header, { format: 1, numTracks: 4, ticksPerBeat: 480 })
  assert.equal(midi.tracks[0].find((event) => event.type === 'setTempo').microsecondsPerBeat, 666667)
  assert.deepEqual(midi.tracks.slice(1).map((track) => track.find((event) => event.type === 'programChange').programNumber), [0, 25, 27])
  assert.equal(midi.tracks[1].find((event) => event.type === 'trackName').text, '2 Piano')
  const notes = timed(midi.tracks[1]).filter((event) => event.type === 'noteOn' || event.type === 'noteOff')
  assert.deepEqual(notes.map(({ tick, type, noteNumber }) => [tick, type, noteNumber]), [
    [0, 'noteOn', 81], [480, 'noteOff', 81], [480, 'noteOn', 81], [960, 'noteOff', 81],
  ])
  for (const track of midi.tracks) assert.equal(timed(track).at(-1).tick, 43200)
  assert.equal(timed(midi.tracks[2]).find((event) => event.type === 'noteOff').tick, 43200)
})

test('many MIDI tracks keep distinct port/channel pairs and avoid the percussion channel', () => {
  const tracks = Array.from({ length: 20 }, () => ({ instrument: 'Piano', events: [{ time: 0, duration: 0.5, note: 60 }] }))
  const midi = midiFile.parseMidi(createMidi({ bpm: 120, tracks }))
  const parts = midi.tracks.slice(1).map((track) => ({
    channel: track.find((event) => event.type === 'programChange').channel,
    port: track.find((event) => event.type === 'portPrefix').port,
  }))
  assert.ok(parts.every((part) => part.channel !== 9))
  assert.equal(new Set(parts.map(({ channel, port }) => `${port}:${channel}`)).size, 20)
})

test('silent or invalid notes cannot produce a misleading empty MIDI download', () => {
  assert.throws(() => createMidi({ bpm: 120, tracks: [{ instrument: 'Piano', events: [] }] }), /No notes detected/)
  assert.throws(() => createMidi({ bpm: 120, tracks: [{ instrument: 'Piano', events: [
    { time: NaN, duration: 1, note: 60 }, { time: 60, duration: 1, note: 60 }, { time: 0, duration: -1, note: 60 },
  ] }] }), /No notes detected/)
})
