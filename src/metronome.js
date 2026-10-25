export function metronomeBuffer(context, bpm, duration = 60) {
  const buffer = context.createBuffer(1, Math.ceil(duration * context.sampleRate), context.sampleRate)
  const samples = buffer.getChannelData(0)
  const clickLength = Math.round(context.sampleRate * 0.035)
  for (let beat = 0; beat * 60 / bpm < duration; beat += 1) {
    const offset = Math.round(beat * 60 / bpm * context.sampleRate)
    const frequency = beat % 4 === 0 ? 1400 : 1000
    for (let i = 0; i < clickLength && offset + i < samples.length; i += 1) {
      const time = i / context.sampleRate
      const envelope = Math.min(1, time / 0.001) * Math.exp(-time * 160)
      samples[offset + i] = 0.25 * envelope * Math.sin(2 * Math.PI * frequency * time)
    }
  }
  return buffer
}
