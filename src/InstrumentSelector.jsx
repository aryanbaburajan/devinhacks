import TrackIcon from './TrackIcon.jsx'

const instruments = [
  { value: 'Vocal', label: 'Mic', icon: 'mic' },
  { value: 'Guitar', label: 'Guitar', icon: 'guitar' },
  { value: 'Electric Guitar', label: 'Electric', icon: 'electric' },
  { value: 'Piano', label: 'Piano', icon: 'piano' },
  { value: 'Saxophone', label: 'Sax', icon: 'sax' },
  { value: 'Drum', label: 'Drum', icon: 'drum' },
]

export default function InstrumentSelector({ value, onChange, disabled }) {
  const index = Math.max(0, instruments.findIndex((instrument) => instrument.value === value))
  const selected = instruments[index]
  const next = instruments[(index + 1) % instruments.length]
  return <div className="instrument-control">
    <span className="panel-label">INSTRUMENT</span>
    <button className="key instrument-picker" type="button" aria-label={`Instrument: ${value}. Next: ${next.value}`}
      title={`${value} · Click for ${next.value}`} disabled={disabled}
      onClick={() => onChange(next.value)}><TrackIcon name={selected.icon} /><span>{selected.label}</span></button>
  </div>
}
