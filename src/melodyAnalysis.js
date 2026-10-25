import { PitchDetector } from 'pitchy'

export const ANALYSIS_VERSION = 3

export function analyzeMelody(channels, sampleRate, onProgress = () => {}) {
  const length = Math.min(channels[0]?.length ?? 0, Math.ceil(60 * sampleRate))
  const size = Math.round(sampleRate * 0.09)
  const hop = Math.round(sampleRate * 0.01)
  const detector = PitchDetector.forFloat32Array(size)
  const window = new Float32Array(size)
  const frames = []
  let loudest = 0
  // Center windows on their timestamps so attacks do not move into earlier beats.
  for (let center = 0; center < length; center += hop) {
    const start = Math.max(0, center - Math.floor(size / 2))
    const end = Math.min(length, center + Math.ceil(size / 2))
    let bestChannel = channels[0]
    let bestEnergy = -1
    for (const channel of channels) {
      let energy = 0
      for (let i = start; i < end; i++) energy += channel[i] ** 2
      if (energy > bestEnergy) { bestEnergy = energy; bestChannel = channel }
    }
    let mean = 0
    for (let i = start; i < end; i++) mean += bestChannel[i]
    mean /= end - start
    window.fill(0)
    const offset = Math.max(0, Math.floor(size / 2) - center)
    for (let i = start; i < end; i++) {
      const value = bestChannel[i] - mean
      window[offset + i - start] = value
    }
    // Gate the actual 10 ms interval, not the wider pitch window: a ringing
    // window from the preceding beat must not create a note inside a rest.
    const intervalEnd = Math.min(length, center + hop)
    let intervalMean = 0
    for (let i = center; i < intervalEnd; i++) intervalMean += bestChannel[i]
    intervalMean /= intervalEnd - center
    let energy = 0
    for (let i = center; i < intervalEnd; i++) energy += (bestChannel[i] - intervalMean) ** 2
    const volume = Math.sqrt(energy / (intervalEnd - center))
    loudest = Math.max(loudest, volume)
    const [frequency, clarity] = volume >= 0.001 ? detector.findPitch(window, sampleRate) : [0, 0]
    frames.push({ time: center / sampleRate, pitch: frequency >= 50 && frequency <= 2000 && clarity >= 0.85 ? frequency : null, clarity, volume })
    if (frames.length % 50 === 0) onProgress(center / length)
  }
  const gate = Math.max(0.001, loudest * 0.01)
  const gated = frames.map((frame) => ({ ...frame, pitch: frame.volume >= gate ? frame.pitch : null }))
  const result = gated.map((frame, index) => {
    const neighbors = gated.slice(Math.max(0, index - 1), index + 2)
    if (neighbors.length !== 3 || neighbors.some((item) => !item.pitch)) return frame
    const pitches = neighbors.map((item) => item.pitch).sort((a, b) => a - b)
    return { ...frame, pitch: pitches[1] }
  })
  onProgress(1)
  return result
}
