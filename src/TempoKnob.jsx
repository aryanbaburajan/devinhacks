import { useRef } from 'react'

export default function TempoKnob({ value, disabled, onChange }) {
  const drag = useRef(null)
  function adjust(next) {
    next = Math.max(60, Math.min(200, Math.round(next)))
    if (next !== value) onChange(next)
  }
  return <div className="tempo-dial" role="slider" aria-label="Tempo knob" aria-valuemin={60} aria-valuemax={200}
    aria-valuenow={value} aria-valuetext={`${value} BPM`} aria-disabled={disabled} tabIndex={disabled ? -1 : 0}
    title="Drag up or down to adjust tempo. Arrow keys also work."
    style={{ '--dial-angle': `${-130 + (value - 60) / 140 * 260}deg` }}
    onPointerDown={(event) => {
      if (disabled || event.button !== 0) return
      event.currentTarget.focus()
      event.currentTarget.setPointerCapture(event.pointerId)
      drag.current = { y: event.clientY, value }
    }}
    onPointerMove={(event) => {
      if (!disabled && drag.current) adjust(drag.current.value + (drag.current.y - event.clientY) / 2)
    }}
    onPointerUp={(event) => {
      drag.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    }}
    onPointerCancel={() => { drag.current = null }}
    onLostPointerCapture={() => { drag.current = null }}
    onKeyDown={(event) => {
      if (disabled) return
      const steps = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 }
      if (event.key in steps || event.key === 'Home' || event.key === 'End') {
        event.preventDefault()
        adjust(event.key === 'Home' ? 60 : event.key === 'End' ? 200 : value + steps[event.key])
      }
    }}><i /></div>
}
