const roots = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']
const intervals = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] }
export const DEFAULT_PIANO_SCALE = '4:minor'
export const PIANO_SCALES = roots.flatMap((name, root) => Object.keys(intervals).map((mode) => ({
  value: `${root}:${mode}`, label: `${name} ${mode}`,
  notes: intervals[mode].map((interval) => (root + interval) % 12),
})))

export function snapPianoNote(midi, scale = DEFAULT_PIANO_SCALE, octave = 0) {
  const selected = PIANO_SCALES.find((item) => item.value === scale)
    ?? PIANO_SCALES.find((item) => item.value === DEFAULT_PIANO_SCALE)
  const target = midi + octave * 12
  let closest = null
  for (let note = 21; note <= 108; note += 1) {
    if (selected.notes.includes(note % 12) && (closest === null || Math.abs(note - target) < Math.abs(closest - target))) {
      closest = note
    }
  }
  return closest
}

function medianPitch(frames) {
  const pitches = frames.map((frame) => ({ midi: frame.midi, weight: frame.clarity ?? 1 })).sort((a, b) => a.midi - b.midi)
  const half = pitches.reduce((sum, pitch) => sum + pitch.weight, 0) / 2
  let weight = 0
  return pitches.find((pitch) => (weight += pitch.weight) >= half).midi
}

// Sample the detected melody once per beat; unvoiced beats remain silent.
export function pianoNotes(frames, duration, octave = 0, scale = DEFAULT_PIANO_SCALE, bpm = 120) {
  const events = []
  const beat = 60 / bpm
  let index = 0
  for (let tick = 0; tick * beat < duration; tick++) {
    const time = tick * beat
    const end = Math.min(duration, (tick + 1) * beat)
    const voiced = []
    while (index < frames.length && frames[index].time < end) {
      const frame = frames[index++]
      if (frame.time >= time && Number.isFinite(frame.pitch) && frame.pitch > 0) {
        voiced.push({ ...frame, midi: 69 + 12 * Math.log2(frame.pitch / 440) })
      }
    }
    if (voiced.length) events.push({ time, duration: end - time, note: snapPianoNote(medianPitch(voiced), scale, octave) })
  }
  return events
}
