import { useEffect, useRef, useState } from 'react'
import { loadProject, saveProject } from './audioStore.js'

const SONG_LENGTH = 60
const instruments = ['Vocal', 'Vocal (autotuned)', 'Guitar', 'Piano', 'Drum']

function newTrack() {
  return { id: crypto.randomUUID(), instrument: 'Vocal', audio: null }
}

function createInitialProject() {
  const track = newTrack()
  return { tracks: [track], selectedTrackId: track.id, seek: 0 }
}

function toStoredAudio(buffer) {
  if (!buffer) return null
  return {
    sampleRate: buffer.sampleRate,
    channels: Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index).slice()),
  }
}

function fromStoredAudio(context, audio) {
  if (!audio) return null
  const buffer = context.createBuffer(audio.channels.length, audio.channels[0].length, audio.sampleRate)
  audio.channels.forEach((channel, index) => buffer.copyToChannel(channel, index))
  return buffer
}

function restoreTrack(context, track) {
  if (track.audio) return { ...track, audio: fromStoredAudio(context, track.audio) }
  if (!track.clips?.length) return { ...track, audio: null }

  const sampleRate = track.clips[0].sampleRate
  const audio = context.createBuffer(1, Math.ceil(SONG_LENGTH * sampleRate), sampleRate)
  const output = audio.getChannelData(0)
  track.clips.forEach((clip) => output.set(clip.channels[0], Math.round(clip.start * sampleRate)))
  return { id: track.id, instrument: track.instrument, audio }
}

function copyBuffer(context, source) {
  const buffer = context.createBuffer(source.numberOfChannels, source.length, source.sampleRate)
  for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
    buffer.copyToChannel(source.getChannelData(channel), channel)
  }
  return buffer
}

export default function App() {
  const [project, setProject] = useState(createInitialProject)
  const [ready, setReady] = useState(false)
  const [recording, setRecording] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(0)
  const audioContextRef = useRef(null)
  const recorderRef = useRef(null)
  const recordingFrameRef = useRef(null)
  const playSourcesRef = useRef([])
  const playFrameRef = useRef(null)
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
          tracks: stored.tracks.map((track) => restoreTrack(context, track)),
        })
      })
      .catch(() => window.alert('Could not restore saved recordings.'))
      .finally(() => active && setReady(true))
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!ready) return undefined
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveProject({
        ...project,
        tracks: project.tracks.map((track) => ({ ...track, audio: toStoredAudio(track.audio) })),
      }).catch(() => window.alert('Could not save recordings locally.'))
    }, 250)
    return () => clearTimeout(saveTimerRef.current)
  }, [project, ready])

  useEffect(() => () => {
    recorderRef.current?.stop()
    playSourcesRef.current.forEach((source) => source.stop())
    cancelAnimationFrame(recordingFrameRef.current)
    cancelAnimationFrame(playFrameRef.current)
    audioContextRef.current?.close()
  }, [])

  const selectedTrack = project.tracks.find((track) => track.id === project.selectedTrackId)

  function updateProject(change) {
    setProject((current) => ({ ...current, ...change }))
  }

  function addTrack() {
    setProject((current) => {
      const track = newTrack()
      return { ...current, tracks: [...current.tracks, track], selectedTrackId: track.id }
    })
  }

  function duplicateTrack(id) {
    setProject((current) => {
      const source = current.tracks.find((track) => track.id === id)
      const duplicate = { ...source, id: crypto.randomUUID() }
      return { ...current, tracks: [...current.tracks, duplicate], selectedTrackId: duplicate.id }
    })
  }

  function deleteTrack(id) {
    setProject((current) => {
      if (current.tracks.length === 1) return current
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

  function seekTo(value) {
    if (playing) stopPlayback()
    updateProject({ seek: value })
  }

  function stopPlayback() {
    cancelAnimationFrame(playFrameRef.current)
    playSourcesRef.current.forEach((source) => source.stop())
    playSourcesRef.current = []
    setPlaying(false)
  }

  async function play() {
    if (recording || playing) return
    const context = audioContext()
    await context.resume()
    const startAt = project.seek
    if (startAt >= SONG_LENGTH) return
    const sources = []
    project.tracks.forEach((track) => {
      if (!track.audio) return
      const source = context.createBufferSource()
      source.buffer = track.audio
      source.connect(context.destination)
      source.start(context.currentTime, startAt)
      sources.push(source)
    })
    playSourcesRef.current = sources
    const startedAt = context.currentTime
    setPlaying(true)
    const tick = () => {
      const seek = Math.min(SONG_LENGTH, startAt + context.currentTime - startedAt)
      updateProject({ seek })
      if (seek >= SONG_LENGTH) stopPlayback()
      else playFrameRef.current = requestAnimationFrame(tick)
    }
    playFrameRef.current = requestAnimationFrame(tick)
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
      processor.onaudioprocess = (event) => {
        const chunk = event.inputBuffer.getChannelData(0).slice()
        chunks.push(chunk)
        const rms = Math.sqrt(chunk.reduce((sum, sample) => sum + sample ** 2, 0) / chunk.length)
        setVolume(Math.round(rms * 100))
      }
      input.connect(processor)
      processor.connect(silentOutput)
      silentOutput.connect(context.destination)
      const stop = () => {
        if (stopped) return
        stopped = true
        clearTimeout(recorderRef.current?.endTimer)
        cancelAnimationFrame(recordingFrameRef.current)
        processor.disconnect()
        silentOutput.disconnect()
        input.disconnect()
        stream.getTracks().forEach((track) => track.stop())
        const duration = Math.min(SONG_LENGTH - start, context.currentTime - startedAt)
        const frameCount = Math.round(duration * context.sampleRate)
        const recordingBuffer = context.createBuffer(1, frameCount, context.sampleRate)
        const recorded = recordingBuffer.getChannelData(0)
        let offset = 0
        for (const chunk of chunks) {
          recorded.set(chunk.subarray(0, Math.max(0, frameCount - offset)), offset)
          offset += chunk.length
          if (offset >= frameCount) break
        }
        const end = Math.min(SONG_LENGTH, start + duration)
        setProject((current) => ({
          ...current,
          seek: end,
          tracks: current.tracks.map((track) => {
            if (track.id !== current.selectedTrackId) return track
            const fullLength = Math.ceil(SONG_LENGTH * context.sampleRate)
            const audio = track.audio ? copyBuffer(context, track.audio) : context.createBuffer(1, fullLength, context.sampleRate)
            audio.getChannelData(0).set(recorded, Math.round(start * context.sampleRate))
            return { ...track, audio }
          }),
        }))
        setVolume(0)
        setRecording(false)
        recorderRef.current = null
      }
      recorderRef.current = { stop, endTimer: window.setTimeout(stop, (SONG_LENGTH - start) * 1000) }
      setRecording(true)
      const moveSeek = () => {
        updateProject({ seek: Math.min(SONG_LENGTH, start + context.currentTime - startedAt) })
        if (!stopped) recordingFrameRef.current = requestAnimationFrame(moveSeek)
      }
      recordingFrameRef.current = requestAnimationFrame(moveSeek)
    } catch (error) {
      window.alert('Microphone access is required to record.')
    }
  }

  return (
    <main>
      <input aria-label="Seek" type="range" min="0" max={SONG_LENGTH} step="0.1" value={project.seek}
        disabled={recording} onChange={(event) => seekTo(Number(event.target.value))} />
      <br />
      <br />
      <button type="button" onClick={playing ? stopPlayback : play} disabled={recording}>{playing ? 'Stop' : 'Play'}</button>
      <br />
      <button type="button" onClick={toggleRecording} disabled={!selectedTrack || project.seek >= SONG_LENGTH}>
        {recording ? 'Stop recording' : 'Record'}
      </button>
      <br />
      <output aria-label="Microphone volume">{recording ? volume : 0}</output>
      <br />
      <br />
      <button type="button" onClick={addTrack} disabled={recording}>Create track</button>
      <br />
      <br />
      {project.tracks.map((track) => (
        <div key={track.id}>
          <button type="button" onClick={() => updateProject({ selectedTrackId: track.id })} disabled={recording}
            aria-pressed={track.id === project.selectedTrackId}>Select</button>
          <br />
          <select aria-label="Instrument" value={track.instrument} disabled={recording}
            onChange={(event) => updateTrack(track.id, { instrument: event.target.value })}>
            {instruments.map((instrument) => <option key={instrument}>{instrument}</option>)}
          </select>
          <br />
          <button type="button" onClick={() => duplicateTrack(track.id)} disabled={recording}>Duplicate track</button>
          <br />
          <button type="button" onClick={() => deleteTrack(track.id)} disabled={recording}>Delete track</button>
          <br />
          <br />
        </div>
      ))}
    </main>
  )
}
