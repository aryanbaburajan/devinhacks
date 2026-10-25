import { ANALYSIS_VERSION } from './melodyAnalysis.js'

const aborted = () => new DOMException('Preparation canceled.', 'AbortError')

// One worker job at a time; duplicated tracks share analysis and cancellation
// only stops a job when no remaining track needs its result.
export class MelodyClient {
  constructor(createWorker = () => new Worker(new URL('./melody.worker.js', import.meta.url), { type: 'module' })) {
    this.createWorker = createWorker
    this.cache = new WeakMap()
    this.queue = []
    this.active = null
    this.nextId = 0
  }

  analyze(buffer, signal, onProgress = () => {}) {
    if (signal?.aborted) return Promise.reject(aborted())
    const cached = this.cache.get(buffer)
    if (cached?.version === ANALYSIS_VERSION) return Promise.resolve(cached.frames)
    let job = [this.active, ...this.queue].find((item) => item?.buffer === buffer)
    if (!job) {
      job = { id: ++this.nextId, buffer, listeners: new Set() }
      this.queue.push(job)
    }
    return new Promise((resolve, reject) => {
      const listener = { resolve, reject, onProgress }
      const cancel = () => {
        job.listeners.delete(listener)
        reject(aborted())
        if (!job.listeners.size) {
          this.queue = this.queue.filter((item) => item !== job)
          if (this.active === job) {
            job.worker.terminate()
            this.active = null
            this.pump()
          }
        }
      }
      listener.cleanup = () => signal?.removeEventListener('abort', cancel)
      signal?.addEventListener('abort', cancel, { once: true })
      job.listeners.add(listener)
      this.pump()
    })
  }

  pump() {
    if (this.active || !this.queue.length) return
    const job = this.queue.shift()
    this.active = job
    const finish = (error, frames) => {
      if (this.active !== job) return
      job.worker?.terminate()
      this.active = null
      if (!error) this.cache.set(job.buffer, { version: ANALYSIS_VERSION, frames })
      for (const listener of job.listeners) {
        listener.cleanup()
        if (error) listener.reject(error)
        else listener.resolve(frames)
      }
      this.pump()
    }
    try {
      job.worker = this.createWorker()
      job.worker.onmessage = ({ data }) => {
        if (data.id !== job.id || this.active !== job) return
        if (data.error) finish(new Error(data.error))
        else if (data.frames) finish(null, data.frames)
        else for (const listener of job.listeners) listener.onProgress(data.progress)
      }
      job.worker.onerror = () => finish(new Error('Melody analysis worker failed. Retry preparation.'))
      const channels = Array.from({ length: job.buffer.numberOfChannels }, (_, index) =>
        job.buffer.getChannelData(index).slice(0, Math.ceil(60 * job.buffer.sampleRate)))
      job.worker.postMessage({ id: job.id, channels, sampleRate: job.buffer.sampleRate }, channels.map((channel) => channel.buffer))
    } catch (error) { finish(error) }
  }

  dispose() {
    const jobs = [this.active, ...this.queue].filter(Boolean)
    this.active = null
    this.queue = []
    for (const job of jobs) {
      job.worker?.terminate()
      for (const listener of job.listeners) { listener.cleanup(); listener.reject(aborted()) }
    }
  }
}
