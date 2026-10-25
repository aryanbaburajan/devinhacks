import { analyzeMelody } from './melodyAnalysis.js'

self.onmessage = ({ data: { id, channels, sampleRate } }) => {
  try {
    const frames = analyzeMelody(channels, sampleRate, (progress) => self.postMessage({ id, progress }))
    self.postMessage({ id, frames })
  } catch (error) {
    self.postMessage({ id, error: error.message || 'Melody analysis failed.' })
  }
}
