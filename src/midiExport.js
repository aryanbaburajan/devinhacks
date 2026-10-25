import midiFile from 'midi-file'

const TICKS_PER_BEAT = 480
const programs = { Piano: 0, Guitar: 25, 'Electric Guitar': 27, Saxophone: 66 }

export function createMidi({ tracks, bpm, duration = 60 }) {
  if (!Number.isFinite(bpm) || bpm <= 0 || !Number.isFinite(duration) || duration <= 0) throw new Error('Invalid song timing.')
  if (tracks.length > 1920) throw new Error('Too many tracks for MIDI export.')
  const ticksPerSecond = TICKS_PER_BEAT * bpm / 60
  const endTick = Math.round(duration * ticksPerSecond)
  const meta = (type, fields = {}, deltaTime = 0) => ({ deltaTime, meta: true, type, ...fields })
  const conductor = [
    meta('trackName', { text: 'S-251X' }),
    meta('setTempo', { microsecondsPerBeat: Math.round(60_000_000 / bpm) }),
    meta('timeSignature', { numerator: 4, denominator: 4, metronome: 24, thirtyseconds: 8 }),
    meta('endOfTrack', {}, endTick),
  ]
  let noteCount = 0
  const midiTracks = tracks.map((track, index) => {
    if (!(track.instrument in programs)) throw new Error(`Cannot export ${track.instrument} as MIDI.`)
    // Channel 10 is reserved for percussion; use another MIDI port after 15 parts.
    const channelIndex = index % 15
    const channel = channelIndex >= 9 ? channelIndex + 1 : channelIndex
    const events = []
    for (const note of track.events) {
      if (!Number.isFinite(note.time) || !Number.isFinite(note.duration) || note.duration <= 0 ||
        !Number.isInteger(note.note) || note.note < 0 || note.note > 127 || note.time >= duration) continue
      const start = Math.max(0, Math.round(note.time * ticksPerSecond))
      const end = Math.min(endTick, Math.round((note.time + note.duration) * ticksPerSecond))
      if (end <= start) continue
      events.push({ tick: start, type: 'noteOn', channel, noteNumber: note.note, velocity: 104 })
      events.push({ tick: end, type: 'noteOff', channel, noteNumber: note.note, velocity: 0 })
      noteCount++
    }
    events.sort((a, b) => a.tick - b.tick || (a.type === 'noteOff' ? 0 : 1) - (b.type === 'noteOff' ? 0 : 1))
    let previousTick = 0
    const notes = events.map(({ tick, ...event }) => {
      const deltaTime = tick - previousTick
      previousTick = tick
      return { ...event, deltaTime }
    })
    return [
      meta('trackName', { text: track.name ?? `${index + 1} ${track.instrument}` }),
      meta('instrumentName', { text: track.instrument }),
      meta('portPrefix', { port: Math.floor(index / 15) }),
      { deltaTime: 0, type: 'programChange', channel, programNumber: programs[track.instrument] },
      ...notes,
      meta('endOfTrack', {}, endTick - previousTick),
    ]
  })
  if (!noteCount) throw new Error('No notes detected in the unmuted instrument tracks.')
  return new Uint8Array(midiFile.writeMidi({
    header: { format: 1, numTracks: midiTracks.length + 1, ticksPerBeat: TICKS_PER_BEAT },
    tracks: [conductor, ...midiTracks],
  }))
}
