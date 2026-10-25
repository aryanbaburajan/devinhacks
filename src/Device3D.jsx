import { useEffect, useRef, useState } from 'react'
import './Device3D.css'
import { isMobileInput, listenForTilt } from './phoneTilt.js'

export default function Device3D({ children }) {
  const stage = useRef(null)
  const viewport = useRef(null)
  const pose = useRef(null)
  const scene = useRef(null)
  const drag = useRef(null)
  const [enabled, setEnabled] = useState(false)
  const [failed, setFailed] = useState(false)
  const [mobile, setMobile] = useState(isMobileInput)
  const [tiltStatus, setTiltStatus] = useState('off')
  const [tiltEnabled, setTiltEnabled] = useState(false)
  const tilt = useRef({ x: 0, y: 0 })

  function applyTilt(value, frameTime) {
    tilt.current = value
    if (!stage.current?.classList.contains('is-3d')) {
      const display = pose.current?.querySelector('.display-panel')
      display?.style.setProperty('--glare-x', `${50 + value.x * 50}%`)
      display?.style.setProperty('--glare-y', `${50 + value.y * 50}%`)
    }
    scene.current?.setDeviceTilt(value.x, value.y, frameTime)
  }

  useEffect(() => {
    const update = () => setMobile(isMobileInput())
    const query = window.matchMedia?.('(pointer: coarse)')
    window.addEventListener('resize', update)
    query?.addEventListener('change', update)
    return () => { window.removeEventListener('resize', update); query?.removeEventListener('change', update) }
  }, [])

  useEffect(() => {
    if (!mobile) { setTiltEnabled(false); return }
    if (window.isSecureContext === false) { setTiltStatus('https'); return }
    if (!window.DeviceOrientationEvent) { setTiltStatus('unsupported'); return }
    if (typeof window.DeviceOrientationEvent.requestPermission !== 'function') {
      setTiltEnabled(true)
      return
    }
    let active = true
    const removeActivationListeners = () => {
      document.removeEventListener('click', requestMotion, true)
      document.removeEventListener('keydown', requestMotion, true)
    }
    async function requestMotion() {
      removeActivationListeners()
      try {
        // Safari requires user activation; any ordinary tap can supply it.
        const permission = await window.DeviceOrientationEvent.requestPermission()
        if (!active) return
        if (permission === 'granted') setTiltEnabled(true)
        else setTiltStatus('denied')
      } catch {
        if (active) setTiltStatus('denied')
      }
    }
    document.addEventListener('click', requestMotion, true)
    document.addEventListener('keydown', requestMotion, true)
    return () => { active = false; removeActivationListeners() }
  }, [mobile])

  useEffect(() => {
    if (!tiltEnabled || !mobile) { applyTilt({ x: 0, y: 0 }); return }
    setTiltStatus('waiting')
    return listenForTilt(applyTilt, setTiltStatus)
  }, [tiltEnabled, mobile])

  useEffect(() => {
    let active = true
    if (!window.WebGL2RenderingContext || !window.ResizeObserver) return
    import('./deviceScene.js').then(({ createDeviceScene }) => {
      if (!active) return
      try {
        scene.current = createDeviceScene(stage.current, viewport.current, pose.current, pose.current.querySelector('.app'), () => {
          if (active) { setEnabled(false); setFailed(true) }
        })
        scene.current.setDeviceTilt(tilt.current.x, tilt.current.y)
        setEnabled(true)
      } catch (error) {
        console.warn('3D view unavailable; keeping the standard controls.', error)
        stage.current.classList.remove('is-3d')
        stage.current.style.height = ''
        viewport.current.style.perspective = ''
        pose.current.style.transform = ''
        viewport.current.querySelector('canvas')?.remove()
        setFailed(true)
      }
    }).catch(() => { if (active) setFailed(true) })
    return () => {
      active = false
      scene.current?.dispose()
      scene.current = null
    }
  }, [])

  function begin(event) {
    if (mobile || event.pointerType === 'touch' || !enabled || !scene.current || event.button !== 0 || drag.current) return
    if (event.target.closest('button, input, select, label, a, [role="slider"], .view-tools')) return
    event.preventDefault()
    const focusTarget = event.target.closest('.rotation-grip') ?? event.currentTarget
    focusTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    scene.current.hold()
    drag.current = { pointerId: event.pointerId, pointerX: event.clientX, pointerY: event.clientY, rotation: { ...scene.current.rotation } }
    stage.current.classList.add('is-rotating')
  }
  function move(event) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return
    const start = drag.current
    scene.current.rotate(start.rotation.x - (event.clientY - start.pointerY) * 0.2,
      start.rotation.y + (event.clientX - start.pointerX) * 0.2)
  }
  function end(event) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return
    drag.current = null
    stage.current.classList.remove('is-rotating')
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  function keyboard(event) {
    if (mobile) return
    if (!event.target.closest('.rotation-grip')) return
    const current = scene.current?.rotation
    if (!current) return
    const steps = { ArrowUp: [3, 0], ArrowDown: [-3, 0], ArrowLeft: [0, -3], ArrowRight: [0, 3] }
    if (event.key in steps) {
      event.preventDefault()
      scene.current.rotate(current.x + steps[event.key][0], current.y + steps[event.key][1])
    } else if (event.key === 'Home') {
      event.preventDefault()
      scene.current.reset()
    }
  }

  return <div className={`device-view${mobile ? ' is-mobile' : ''}`} tabIndex={-1}
    onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
    onLostPointerCapture={end} onKeyDown={keyboard}>
    {mobile && <div className="view-tools tilt-tools">
      {tiltStatus === 'https' && <span role="status">Tilt needs HTTPS</span>}
      {tiltStatus === 'denied' && <span role="status">Motion access denied</span>}
      {tiltStatus === 'unavailable' && <span role="status">No tilt data received</span>}
    </div>}
    {failed && <p className="view-fallback" role="status">3D rendering is unavailable. Studio controls are still ready to use.</p>}
    <div ref={stage} className={`device-stage${enabled ? ' is-3d' : ''}`}>
      <div ref={viewport} className="device-viewport">
        {enabled && <div className="rotation-backdrop" aria-hidden="true" />}
        <div ref={pose} className="device-pose">
          {children}
          {enabled && !mobile && ['left', 'right'].map((side) => <div key={side} className={`rotation-grip rotation-grip-${side}`}
            role="button" tabIndex={0} aria-label={`Rotate device from ${side} edge. Drag or use arrow keys; Home resets.`}
            ><span aria-hidden="true">⋮</span></div>)}
        </div>
      </div>
    </div>
  </div>
}
