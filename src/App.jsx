import { useEffect, useRef, useState } from 'react'
import { loadProject, saveProject } from './audioStore.js'

const SONG_LENGTH = 60
const instruments = ['Vocal', 'Vocal (autotuned)', 'Guitar', 'Piano', 'Drum']

function newTrack(number) {
  return { id: crypto.randomUUID(), name: `Track ${number}`, instrument: 'Vocal', clips: [] }
}

function createInitialProject() {
  const track = newTrack(1)
  return { tracks: [track], selectedTrackId: track.id, seek: 0 }
}

function toStoredClip(clip) {
  return {
    id: clip.id,
    start: clip.start,
    end: clip.end,
    sampleRate: clip.buffer.sampleRate,
    channels: Array.from({ length: clip.buffer.numberOfChannels }, (_, index) =>
      clip.buffer.getChannelData(index).slice(),
    ),
  }
}

function fromStoredClip(audioContext, clip) {
  const buffer = audioContext.createBuffer(clip.channels.length, clip.channels[0].length, clip.sampleRate)
  clip.channels.forEach((channel, index) => buffer.copyToChannel(channel, index))
  return { ...clip, buffer }
}

function sliceClip(audioContext, clip, start, end) {
  const clipStart = Math.max(start, clip.start)
  const clipEnd = Math.min(end, clip.end)
  if (clipEnd - clipStart < 0.01) return null

  const from = Math.round((clipStart - clip.start) * clip.buffer.sampleRate)
  const frameCount = Math.round((clipEnd - clipStart) * clip.buffer.sampleRate)
  const buffer = audioContext.createBuffer(clip.buffer.numberOfChannels, frameCount, clip.buffer.sampleRate)
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    buffer.copyToChannel(clip.buffer.getChannelData(channel).slice(from, from + frameCount), channel)
  }
  return { id: crypto.randomUUID(), start: clipStart, end: clipEnd, buffer }
}

export default function App() {
  const [project, setProject] = useState(createInitialProject)
  const [ready, setReady] = useState(false)
  const [recording, setRecording] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [message, setMessage] = useState('')
  const audioContextRef = useRef(null)
  const recorderRef = useRef(null)
  const playSourcesRef = useRef([])
  const playStartedAtRef = useRef(0)
  const saveTimerRef = useRef(null)

  function audioContext() {
    if (!audioContextRef.current) audioContextRef.current = new AudioContext()
    return audioContextRef.current
  }

  useEffect(() => {
    let active = true
    loadProject()
      .then((stored) => {
        if (!stored || !active) return
        const context = audioContext()
        setProject({
          ...stored,
          tracks: stored.tracks.map((track) => ({
            ...track,
            clips: track.clips.map((clip) => fromStoredClip(context, clip)),
          })),
        })
      })
      .catch(() => active && setMessage('Could not restore saved recordings.'))
      .finally(() => active && setReady(true))
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!ready) return undefined
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const stored = {
        ...project,
        tracks: project.tracks.map((track) => ({ ...track, clips: track.clips.map(toStoredClip) })),
      }
      saveProject(stored).catch(() => setMessage('Could not save recordings locally.'))
    }, 250)
    return () => clearTimeout(saveTimerRef.current)
  }, [project, ready])

  useEffect(() => () => {
    recorderRef.current?.stop()
    playSourcesRef.current.forEach((source) => source.stop())
    audioContextRef.current?.close()
  }, [])

  const selectedTrack = project.tracks.find((track) => track.id === project.selectedTrackId)

  function updateProject(change) {
    setProject((current) => ({ ...current, ...change }))
  }

  function addTrack() {
    setProject((current) => {
      const track = newTrack(current.tracks.length + 1)
      return { ...current, tracks: [...current.tracks, track], selectedTrackId: track.id }
    })
  }

  function duplicateTrack(id) {
    setProject((current) => {
      const source = current.tracks.find((track) => track.id === id)
      const duplicate = {
        ...source,
        id: crypto.randomUUID(),
        name: `${source.name} copy`,
        clips: source.clips.map((clip) => ({ ...clip, id: crypto.randomUUID() })),
      }
      return { ...current, tracks: [...current.tracks, duplicate], selectedTrackId: duplicate.id }
    })
  }

  function deleteTrack(id) {
    setProject((current) => {
      if (current.tracks.length === 1) {
        setMessage('Keep at least one track in the song.')
        return current
      }
      const tracks = current.tracks.filter((track) => track.id !== id)
      return { ...current, tracks, selectedTrackId: tracks[0].id }
    })
  }

  function updateTrack(id, change) {
    setProject((current) => ({
      ...current,
      tracks: current.tracks.map((track) => track.id === id ? { ...track, ...change } : track),
    }))
  }

  function stopPlayback() {
    playSourcesRef.current.forEach((source) => source.stop())
    playSourcesRef.current = []
    setPlaying(false)
  }

  async function play() {
    if (recording || playing) return
    const context = audioContext()
    await context.resume()
    const startAt = project.seek
    const remaining = SONG_LENGTH - startAt
    if (remaining <= 0) return
    const sources = []
    project.tracks.forEach((track) => track.clips.forEach((clip) => {
      if (clip.end <= startAt) return
      const source = context.createBufferSource()
      source.buffer = clip.buffer
      source.connect(context.destination)
      const offset = Math.max(0, startAt - clip.start)
      source.start(context.currentTime + Math.max(0, clip.start - startAt), offset)
      sources.push(source)
    }))
    playSourcesRef.current = sources
    playStartedAtRef.current = context.currentTime
    setPlaying(true)
    const tick = () => {
      const seek = Math.min(SONG_LENGTH, startAt + context.currentTime - playStartedAtRef.current)
      updateProject({ seek })
      if (seek >= SONG_LENGTH) stopPlayback()
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop()
      return
    }
    if (!selectedTrack) return
    stopPlayback()
    try {
      const context = audioContext()
      await context.resume()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const input = context.createMediaStreamSource(stream)
      const processor = context.createScriptProcessor(4096, 1, 1)
      const silentOutput = context.createGain()
      silentOutput.gain.value = 0
      const chunks = []
      const start = project.seek
      const startedAt = context.currentTime
      let stopped = false
      processor.onaudioprocess = (event) => chunks.push(event.inputBuffer.getChannelData(0).slice())
      input.connect(processor)
      processor.connect(silentOutput)
      silentOutput.connect(context.destination)
      const stop = () => {
          if (stopped) return
          stopped = true
          clearTimeout(recorderRef.current?.endTimer)
          processor.disconnect()
          silentOutput.disconnect()
          input.disconnect()
          stream.getTracks().forEach((track) => track.stop())
          const duration = Math.min(SONG_LENGTH - start, context.currentTime - startedAt)
          const frames = Math.round(duration * context.sampleRate)
          const buffer = context.createBuffer(1, frames, context.sampleRate)
          const output = buffer.getChannelData(0)
          let offset = 0
          for (const chunk of chunks) {
            output.set(chunk.subarray(0, Math.max(0, frames - offset)), offset)
            offset += chunk.length
            if (offset >= frames) break
          }
          const end = start + duration
          setProject((current) => ({
            ...current,
            seek: end,
            tracks: current.tracks.map((track) => {
              if (track.id !== current.selectedTrackId) return track
              const preserved = track.clips.flatMap((clip) => [
                sliceClip(context, clip, clip.start, start),
                sliceClip(context, clip, end, clip.end),
              ].filter(Boolean))
              return { ...track, clips: [...preserved, { id: crypto.randomUUID(), start, end, buffer }] }
            }),
          }))
          setRecording(false)
          recorderRef.current = null
      }
      recorderRef.current = {
        stop,
        endTimer: window.setTimeout(stop, (SONG_LENGTH - start) * 1000),
      }
      setRecording(true)
    } catch (error) {
      setMessage('Microphone access is required to record.')
    }
  }

  return (
    <main>
      <h1>60 Second Studio</h1>
      <p>Make a song that is no longer than 60 seconds.</p>
      {message && <p role="status">{message}</p>}

      <section aria-label="Song transport">
        <label htmlFor="seek">Seek: {project.seek.toFixed(1)} / 60 seconds</label>
        <input id="seek" type="range" min="0" max={SONG_LENGTH} step="0.1" value={project.seek}
          disabled={recording || playing} onChange={(event) => updateProject({ seek: Number(event.target.value) })} />
        <button type="button" onClick={playing ? stopPlayback : play} disabled={recording}>{playing ? 'Stop' : 'Play'}</button>
        <button type="button" onClick={toggleRecording} disabled={!selectedTrack || project.seek >= SONG_LENGTH}>
          {recording ? 'Stop recording' : 'Record'}
        </button>
        <p>{recording ? `Recording ${selectedTrack?.name} from ${project.seek.toFixed(1)} seconds…` : `Recording target: ${selectedTrack?.name ?? 'None'}`}</p>
      </section>

      <section aria-label="Tracks">
        <h2>Tracks</h2>
        <button type="button" onClick={addTrack}>Create track</button>
        {project.tracks.map((track) => (
          <fieldset key={track.id}>
            <legend>
              <label>
                <input type="radio" name="selected-track" checked={track.id === project.selectedTrackId}
                  onChange={() => updateProject({ selectedTrackId: track.id })} disabled={recording} />
                Recording target
              </label>
            </legend>
            <label>
              Name
              <input value={track.name} onChange={(event) => updateTrack(track.id, { name: event.target.value })} />
            </label>
            <label>
              Instrument
              <select value={track.instrument} onChange={(event) => updateTrack(track.id, { instrument: event.target.value })}>
                {instruments.map((instrument) => <option key={instrument}>{instrument}</option>)}
              </select>
            </label>
            <p>{track.clips.length} recording{track.clips.length === 1 ? '' : 's'} on this track.</p>
            <button type="button" onClick={() => duplicateTrack(track.id)} disabled={recording}>Duplicate track</button>
            <button type="button" onClick={() => deleteTrack(track.id)} disabled={recording}>Delete track</button>
          </fieldset>
        ))}
      </section>
    </main>
  )
}
