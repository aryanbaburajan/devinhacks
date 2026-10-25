import { Scheduler, SplendidGrandPiano, Soundfont } from 'smplr'

function waitForSamples(ready, signal, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', cancel)
      if (error) reject(error)
      else resolve()
    }
    const cancel = () => finish(signal.reason ?? new DOMException('Preparation canceled.', 'AbortError'))
    const timer = setTimeout(() => finish(new Error('Sample loading timed out. Check your connection and retry.')), timeoutMs)
    signal?.addEventListener('abort', cancel, { once: true })
    if (signal?.aborted) cancel()
    Promise.resolve(ready).then(() => finish(), finish)
  })
}

export async function renderPianoEvents(events, { duration, sampleRate, loader, instrument = 'Piano', storage, onStage = () => {}, signal }) {
  signal?.throwIfAborted()
  const context = new OfflineAudioContext(1, Math.ceil(duration * sampleRate), sampleRate)
  if (!events.length) return context.startRendering()

  // Offline rendering outruns wall-clock timers. Dispatch the entire score now;
  // the Web Audio source nodes still play at their scheduled audio-clock times.
  const scheduler = Scheduler(context, { lookaheadMs: duration * 1000 + 1 })
  const options = {
    scheduler,
    loader,
    storage,
    notesToLoad: { notes: [...new Set(events.map((event) => event.note))], velocityRange: [104, 104] },
    volume: 112,
  }
  const soundfont = {
    'Electric Guitar': 'electric_guitar_clean',
    Guitar: 'acoustic_guitar_steel',
    Saxophone: 'tenor_sax',
  }[instrument]
  onStage('Loading samples…')
  const piano = soundfont
    ? Soundfont(context, { ...options, instrument: soundfont, kit: 'FluidR3_GM', extraGain: 1 })
    : SplendidGrandPiano(context, { ...options, decayTime: 2.4 })
  try {
    await waitForSamples(piano.ready, signal, instrument === 'Saxophone' ? 60000 : 30000)
    signal?.throwIfAborted()
    onStage('Rendering…')
    events.forEach((event, index) => piano.start({
      ...event,
      duration: event.duration ?? Math.max(1.2, Math.min(3, (events[index + 1]?.time ?? duration) - event.time + 0.2)),
      velocity: 104,
      ampRelease: instrument === 'Saxophone' ? 0.18 : soundfont ? 1.2 : 2.4,
    }))
    const audio = await context.startRendering()
    signal?.throwIfAborted()
    const samples = audio.getChannelData(0)
    let peak = 0
    for (const sample of samples) {
      if (!Number.isFinite(sample)) throw new Error(`${instrument} rendering produced invalid audio. Try again.`)
      peak = Math.max(peak, Math.abs(sample))
    }
    if (peak < 0.00001) throw new Error(`${instrument} samples produced no sound. Check your connection and retry.`)
    // Normalize once, after rendering, so sample/velocity differences do not
    // leave a valid piano track barely audible. Preserve the natural decay.
    const gain = Math.min(8, 0.8 / peak)
    for (let index = 0; index < samples.length; index += 1) samples[index] *= gain
    return audio
  } finally {
    piano.dispose()
  }
}
