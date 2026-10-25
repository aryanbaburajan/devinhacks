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

function volumeAttackBeats(frames, beat) {
  const attacks = new Set()
  const volume = (frame) => Number.isFinite(frame.volume) ? Math.max(0, frame.volume) : 0
  const median = (values) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
  let peak = 0
  for (const frame of frames) peak = Math.max(peak, volume(frame))
  const minimumRise = Math.max(0.0015, peak * 0.025)
  let lastAttack = -Infinity
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    if (!(frame.pitch > 0) || frame.time - lastAttack < 0.15) continue
    const before = [], after = []
    for (let j = i - 1; j >= 0 && frame.time - frames[j].time <= 0.08; j--) {
      if (frames[j].pitch > 0) before.push(volume(frames[j]))
    }
    for (let j = i; j < frames.length && frames[j].time - frame.time <= 0.04; j++) {
      if (frames[j].pitch > 0) after.push(volume(frames[j]))
    }
    if (before.length < 3 || after.length < 3) continue
    const baseline = median(before)
    const threshold = Math.max(baseline * 1.8, baseline + minimumRise)
    // Require a sustained rise, not a single noisy frame or a fading note.
    if (volume(frame) >= threshold && median(after) >= threshold) {
      attacks.add(Math.round(frame.time / beat))
      lastAttack = frame.time
    }
  }
  return attacks
}

// Pitch changes and volume attacks create notes on the beat grid;
// a continuing pitch without a new attack rings through the boundary.
export function pianoNotes(frames, duration, octave = 0, scale = DEFAULT_PIANO_SCALE, bpm = 120) {
  const events = []
  const beat = 60 / bpm
  const attacks = volumeAttackBeats(frames, beat)
  let index = 0
  let lastVoicedTime = -Infinity
  let previousTick = -2
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
    if (voiced.length) {
      const note = snapPianoNote(medianPitch(voiced), scale, octave)
      const previous = events.at(-1)
      // Allow brief pitch-detector dropouts, but retain separate attacks after a rest.
      const continues = previousTick === tick - 1 && voiced[0].time - lastVoicedTime <= 0.08
      if (previous?.note === note && continues && !attacks.has(tick)) previous.duration = end - previous.time
      else events.push({ time, duration: end - time, note })
      lastVoicedTime = voiced.at(-1).time
      previousTick = tick
    }
  }
  return events
}
