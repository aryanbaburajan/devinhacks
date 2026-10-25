export function isMobileInput() {
  return window.innerWidth <= 680 || !!window.matchMedia?.('(pointer: coarse)').matches
}

export function orientationOffset(beta, gamma, baseline, screenAngle = 0) {
  if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return null
  const wrap = (degrees) => ((degrees + 180) % 360 + 360) % 360 - 180
  const x = wrap(gamma - baseline.gamma)
  const y = wrap(beta - baseline.beta)
  const angle = screenAngle * Math.PI / 180
  const clamp = (value) => Math.max(-1, Math.min(1, value / 40))
  return { x: clamp(x * Math.cos(angle) + y * Math.sin(angle)), y: clamp(y * Math.cos(angle) - x * Math.sin(angle)) }
}

export function listenForTilt(onTilt, onStatus) {
  let baseline = null
  let pending = null
  let frame = 0
  let lastTime = 0
  let current = { x: 0, y: 0 }
  let received = false
  const timeout = setTimeout(() => { if (!received) onStatus('unavailable') }, 6000)
  function paint(time) {
    frame = 0
    if (!pending) return
    const blend = 1 - Math.exp(-Math.min(100, time - lastTime) / 35)
    lastTime = time
    current = { x: current.x + (pending.x - current.x) * blend, y: current.y + (pending.y - current.y) * blend }
    const settling = Math.abs(current.x - pending.x) + Math.abs(current.y - pending.y) > 0.002
    if (!settling) { current = pending; pending = null }
    onTilt(current, time)
    if (settling) frame = requestAnimationFrame(paint)
  }
  function orientation(event) {
    if (document.hidden || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return
    const angle = window.screen.orientation?.angle ?? window.orientation ?? 0
    if (!baseline || baseline.angle !== angle) baseline = { beta: event.beta, gamma: event.gamma, angle }
    pending = orientationOffset(event.beta, event.gamma, baseline, angle)
    if (!received) { received = true; clearTimeout(timeout); onStatus('on') }
    if (!frame && Math.abs(current.x - pending.x) + Math.abs(current.y - pending.y) > 0.002) frame = requestAnimationFrame(paint)
  }
  function visibility() {
    baseline = null
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; pending = null }
  }
  window.addEventListener('deviceorientation', orientation)
  document.addEventListener('visibilitychange', visibility)
  return () => {
    clearTimeout(timeout)
    cancelAnimationFrame(frame)
    window.removeEventListener('deviceorientation', orientation)
    document.removeEventListener('visibilitychange', visibility)
  }
}
