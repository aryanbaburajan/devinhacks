const contexts = new WeakMap()

export function interfaceSoundBuffer(context, type) {
  const tick = type === 'tick'
  const duration = tick ? 0.018 : 0.045
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate)
  const samples = buffer.getChannelData(0)
  let seed = 17
  let filtered = 0
  for (let i = 0; i < samples.length; i++) {
    const time = i / context.sampleRate
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const noise = seed / 2 ** 31 - 1
    filtered += (noise - filtered) * (tick ? 0.7 : 0.3)
    const attack = Math.min(1, time / 0.0005)
    const envelope = Math.exp(-time / (tick ? 0.0025 : 0.007))
    const knock = Math.sin(2 * Math.PI * (tick ? 1700 : 650) * time)
    samples[i] = (filtered * 0.7 + knock * 0.3) * envelope * attack * (tick ? 0.13 : 0.19)
  }
  return buffer
}

export async function playInterfaceSound(context, type = 'button') {
  let state = contexts.get(context)
  if (!state) {
    state = { buffers: new Map(), lastTick: -Infinity }
    contexts.set(context, state)
  }
  const now = performance.now()
  if (type === 'tick' && now - state.lastTick < 40) return
  if (type === 'tick') state.lastTick = now
  try {
    if (context.state === 'suspended') await context.resume()
    // Don't replay a backlog if the browser took time to unlock audio.
    if (context.state === 'closed' || performance.now() - now > 200) return
    if (!state.buffers.has(type)) state.buffers.set(type, interfaceSoundBuffer(context, type))
    const source = context.createBufferSource()
    source.buffer = state.buffers.get(type)
    source.connect(context.destination)
    source.onended = () => source.disconnect()
    source.start()
  } catch {
    // Audio feedback must never prevent the control's action.
  }
}
