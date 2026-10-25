import { useEffect, useMemo, useRef, useState } from 'react'
import { renderPianoEvents } from './piano.js'
import { pianoNotes, PIANO_SCALES, DEFAULT_PIANO_SCALE } from './pianoNotes.js'
import { metronomeBuffer } from './metronome.js'
import { loadProject, saveProject } from './audioStore.js'
import { MelodyClient } from './melodyClient.js'
import { playInterfaceSound } from './interfaceSounds.js'
import TempoKnob from './TempoKnob.jsx'
import Device3D from './Device3D.jsx'
import TrackIcon from './TrackIcon.jsx'
import InstrumentSelector from './InstrumentSelector.jsx'
import { createTrackId } from './trackId.js'
import { SONG_LENGTH, recordedEnd, playbackLength } from './audioTimeline.js'

const PIANO_RENDER_VERSION = 13
const isSampledInstrument = (instrument) => ['Piano', 'Guitar', 'Electric Guitar'].includes(instrument)
const hasRenderedAudio = (track, bpm) => track.pianoAudio && track.pianoBpm === bpm && track.renderedInstrument === track.instrument && track.pianoRenderVersion === PIANO_RENDER_VERSION && track.renderedPianoOctave === (track.pianoOctave ?? 0) && track.renderedPianoScale === (track.pianoScale ?? DEFAULT_PIANO_SCALE)
// Recreated on hot reload along with the renderer, so old silent renders cannot survive a fix.
const pianoRenderCache = new WeakMap()

function newTrack() {
  return {
    id: createTrackId(),
    instrument: 'Vocal',
    muted: false,
    audio: null,
    audioEnd: 0,
    pianoAudio: null,
    pianoRenderVersion: null,
    pianoOctave: 0,
    pianoOctaveDirection: 1,
    pianoScale: DEFAULT_PIANO_SCALE,
  }
}

function createInitialProject() {
  const track = newTrack()
  return { tracks: [track], selectedTrackId: track.id, seek: 0, bpm: 120 }
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
  const buffer = context.createBuffer(audio.channels.length, Math.max(audio.channels[0].length, SONG_LENGTH * audio.sampleRate), audio.sampleRate)
  audio.channels.forEach((channel, index) => buffer.copyToChannel(channel, index))
  return buffer
}

function restoreTrack(context, track) {
  // Retired instrument choices keep their original microphone recording.
  const { autotunedAudio, ...savedTrack } = track
  track = { ...savedTrack, instrument: ['Vocal (autotuned)', 'Voice (autotuned)', 'Drum', 'Saxophone'].includes(track.instrument) ? 'Vocal' : track.instrument }
  track = { ...track, pianoScale: PIANO_SCALES.some((scale) => scale.value === track.pianoScale)
    ? track.pianoScale : DEFAULT_PIANO_SCALE }
  track = { ...track, pianoOctave: Number.isFinite(track.pianoOctave)
    ? Math.max(-2, Math.min(2, Math.round(track.pianoOctave))) : 0 }
  track = { ...track, pianoOctaveDirection: track.pianoOctaveDirection === -1 ? -1 : 1 }
  if (track.audio) {
    return {
      ...track,
      muted: track.muted ?? false,
      audio: fromStoredAudio(context, track.audio),
      audioEnd: recordedEnd(track),
      pianoAudio: null,
      pianoRenderVersion: null,
    }
  }
  if (!track.clips?.length) return {
    ...track,
    muted: track.muted ?? false,
    audio: null,
    pianoAudio: null,
    pianoRenderVersion: null,
  }

  const sampleRate = track.clips[0].sampleRate
  // Preserve old takes beyond the current playback window when migrating them.
  const storedLength = track.clips.reduce((length, clip) => Math.max(
    length, Math.round(clip.start * sampleRate) + clip.channels[0].length,
  ), Math.ceil(SONG_LENGTH * sampleRate))
  const audio = context.createBuffer(1, storedLength, sampleRate)
  const output = audio.getChannelData(0)
  track.clips.forEach((clip) => output.set(clip.channels[0], Math.round(clip.start * sampleRate)))
  return {
    id: track.id,
    instrument: track.instrument,
    pianoOctave: track.pianoOctave,
    pianoOctaveDirection: track.pianoOctaveDirection,
    pianoScale: track.pianoScale,
    muted: track.muted ?? false,
    audio,
    audioEnd: Math.min(SONG_LENGTH, track.clips.reduce((end, clip) => Math.max(end, clip.start + clip.channels[0].length / clip.sampleRate), 0)),
    pianoAudio: null,
    pianoRenderVersion: null,
  }
}

function copyBuffer(context, source) {
  const buffer = context.createBuffer(source.numberOfChannels, Math.max(source.length, SONG_LENGTH * source.sampleRate), source.sampleRate)
  for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
    buffer.copyToChannel(source.getChannelData(channel), channel)
  }
  return buffer
}

export default function App() {
  const [project, setProject] = useState(createInitialProject)
  const [ready, setReady] = useState(false)
  const [recording, setRecording] = useState(false)
  const [arming, setArming] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const captureBusy = recording || arming || finalizing
  const [playing, setPlaying] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [playbackError, setPlaybackError] = useState('')
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const exportRef = useRef(null)
  const fileInputRef = useRef(null)
  const [volume, setVolume] = useState(0)
  const [pianoMessages, setPianoMessages] = useState({})
  const renderingTrackIds = Object.keys(pianoMessages).filter((id) => pianoMessages[id]?.loading)
  const waitingForRender = project.tracks.some((track) => track.audio && isSampledInstrument(track.instrument)
    && !hasRenderedAudio(track, project.bpm)
    && !(pianoMessages[track.id]?.buffer === track.audio && pianoMessages[track.id]?.error))
  const audioContextRef = useRef(null)
  const recorderRef = useRef(null)
  const finalizeTimerRef = useRef(null)
  const pendingRecordingStreamRef = useRef(null)
  const recordingFrameRef = useRef(null)
  const playSourcesRef = useRef([])
  const playFrameRef = useRef(null)
  const saveTimerRef = useRef(null)
  const pianoJobsRef = useRef(new Map())
  const melodyClientRef = useRef(null)
  const playbackRequestRef = useRef(0)
  const metronomeRef = useRef(null)
  const metronomeBufferRef = useRef(null)

  function audioContext() {
    if (!audioContextRef.current) audioContextRef.current = new AudioContext()
    return audioContextRef.current
  }

  function interfaceSound(type = 'button') {
    // Speaker clicks must not bleed into an active microphone recording.
    if (recording) return
    try { void playInterfaceSound(audioContext(), type) } catch { /* Controls still work without audio. */ }
  }

  function changeTempo(bpm) {
    if (Math.floor(bpm / 2) !== Math.floor(project.bpm / 2)) interfaceSound('tick')
    stopPlayback()
    updateProject({ bpm })
  }

  useEffect(() => {
    let active = true
    loadProject()
      .then((stored) => {
        if (!stored || !active) return
        const context = audioContext()
        const tracks = stored.tracks.map((track) => restoreTrack(context, track))
        setProject({
          ...stored,
          tracks,
          seek: Math.max(0, Math.min(SONG_LENGTH, stored.seek ?? 0)),
          bpm: Number.isFinite(stored.bpm) ? Math.max(60, Math.min(200, Math.round(stored.bpm))) : 120,
        })
      })
      .catch(() => window.alert('Could not restore saved recordings.'))
      .finally(() => active && setReady(true))
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!ready) return
    const timer = setTimeout(() => project.tracks.forEach((track) => {
      if (!track.audio) return
      if (isSampledInstrument(track.instrument) && !hasRenderedAudio(track, project.bpm)) {
        renderPianoTrack(track.id, track.audio)
      }
    }), 200)
    return () => clearTimeout(timer)
  }, [project.tracks, project.bpm, ready])

  useEffect(() => {
    if (!ready) return undefined
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveProject({
        ...project,
        tracks: project.tracks.map(({ pianoAudio, pianoRenderVersion, pianoBpm, renderedPianoOctave, renderedPianoScale, renderedInstrument, ...track }) => ({
          ...track,
          audio: toStoredAudio(track.audio),
        })),
      }).catch(() => window.alert('Could not save recordings locally.'))
    }, 250)
    return () => clearTimeout(saveTimerRef.current)
  }, [project.tracks, project.bpm, project.selectedTrackId, ready])

  useEffect(() => () => {
    exportRef.current?.abort()
    exportRef.current = null
    for (const job of pianoJobsRef.current.values()) job.controller.abort()
    pianoJobsRef.current.clear()
    melodyClientRef.current?.dispose()
    melodyClientRef.current = null
    playbackRequestRef.current += 1
    stopMetronome()
    recorderRef.current?.stop(false)
    window.clearTimeout(finalizeTimerRef.current)
    pendingRecordingStreamRef.current?.getTracks().forEach((track) => track.stop())
    playSourcesRef.current.forEach(({ source }) => source.stop())
    cancelAnimationFrame(recordingFrameRef.current)
    cancelAnimationFrame(playFrameRef.current)
    audioContextRef.current?.close()
  }, [])

  const selectedTrack = project.tracks.find((track) => track.id === project.selectedTrackId)
  const waveform = useMemo(() => {
    if (!selectedTrack?.audio) return []
    const audio = selectedTrack.audio
    const channels = Array.from({ length: audio.numberOfChannels }, (_, channel) => audio.getChannelData(channel))
    const length = Math.min(audio.length, audio.sampleRate * SONG_LENGTH)
    return Array.from({ length: 160 }, (_, bar) => {
      const start = Math.floor(bar / 160 * length)
      const end = Math.floor((bar + 1) / 160 * length)
      let peak = 0
      for (const samples of channels) {
        for (let i = start; i < end; i += Math.max(1, Math.floor((end - start) / 80))) peak = Math.max(peak, Math.abs(samples[i]))
      }
      return peak
    })
  }, [selectedTrack?.audio])
  const selectedNumber = String(project.tracks.findIndex((track) => track.id === project.selectedTrackId) + 1).padStart(2, '0')

  function updateProject(change) {
    if ('bpm' in change) for (const id of pianoJobsRef.current.keys()) invalidatePianoJob(id)
    setProject((current) => ({ ...current, ...change }))
  }

  function invalidatePianoJob(id) {
    pianoJobsRef.current.get(id)?.controller.abort()
    pianoJobsRef.current.delete(id)
    setPianoMessages((current) => ({ ...current, [id]: null }))
  }

  function addTrack() {
    setProject((current) => {
      const track = newTrack()
      return { ...current, tracks: [...current.tracks, track], selectedTrackId: track.id }
    })
  }

  async function exportMidi() {
    if (captureBusy || exportRef.current) return
    const controller = new AbortController()
    exportRef.current = controller
    setExporting(true)
    setPlaybackError('')
    try {
      // Snapshot the arrangement so edits during analysis cannot mix settings.
      const bpm = project.bpm
      const tracks = project.tracks.map((track, index) => ({ ...track, name: `${index + 1} ${track.instrument}` }))
        .filter((track) => track.audio && !track.muted && isSampledInstrument(track.instrument))
      if (!tracks.length) throw new Error('Add audio to an unmuted instrument track to export MIDI.')
      melodyClientRef.current ??= new MelodyClient()
      const { createMidi } = await import('./midiExport.js')
      const parts = await Promise.all(tracks.map(async (track) => {
        const frames = await melodyClientRef.current.analyze(track.audio, controller.signal)
        return { ...track, events: pianoNotes(frames, SONG_LENGTH, track.pianoOctave ?? 0, track.pianoScale ?? DEFAULT_PIANO_SCALE, bpm) }
      }))
      controller.signal.throwIfAborted()
      const bytes = createMidi({ tracks: parts, bpm, duration: SONG_LENGTH })
      const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/midi' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'S-251X.mid'
      document.body.appendChild(link)
      try { link.click() }
      finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
    } catch (error) {
      if (!controller.signal.aborted) setPlaybackError(`MIDI export: ${error.message}`)
    } finally {
      controller.abort()
      if (exportRef.current === controller) { exportRef.current = null; setExporting(false) }
    }
  }

  async function importTracks(event) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return
    stopPlayback()
    setImporting(true)
    const failures = []
    try {
      const context = audioContext()
      for (const file of files) {
        try {
          const decoded = await context.decodeAudioData(await file.arrayBuffer())
          const length = Math.ceil(SONG_LENGTH * decoded.sampleRate)
          const audio = context.createBuffer(decoded.numberOfChannels, length, decoded.sampleRate)
          for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
            audio.copyToChannel(decoded.getChannelData(channel).subarray(0, length), channel)
          }
          const track = { ...newTrack(), audio, audioEnd: Math.min(SONG_LENGTH, decoded.duration) }
          setProject((current) => ({
            ...current,
            tracks: [...current.tracks, track],
            selectedTrackId: track.id,
          }))
        } catch {
          failures.push(file.name)
        }
      }
      if (failures.length) window.alert(`Could not import these audio files. Try a browser-supported format such as WAV or MP3:\n${failures.join('\n')}`)
    } finally {
      setImporting(false)
    }
  }

  function duplicateTrack(id) {
    setProject((current) => {
      const source = current.tracks.find((track) => track.id === id)
      const duplicate = { ...source, id: createTrackId() }
      return { ...current, tracks: [...current.tracks, duplicate], selectedTrackId: duplicate.id }
    })
  }

  function deleteTrack(id) {
    if (project.tracks.length === 1) return
    stopPlayback()
    invalidatePianoJob(id)
    setProject((current) => {
      if (current.tracks.length === 1) return current
      const tracks = current.tracks.filter((track) => track.id !== id)
      return { ...current, tracks, selectedTrackId: tracks[0].id }
    })
  }

  function updateTrack(id, change) {
    if (['audio', 'instrument', 'pianoScale', 'pianoOctave'].some((key) => key in change)) invalidatePianoJob(id)
    setProject((current) => ({
      ...current,
      tracks: current.tracks.map((track) => track.id === id ? { ...track, ...change } : track),
    }))
  }

  async function renderPianoAudio(buffer, octave, scale, instrument, bpm, signal, onStage) {
    const cached = pianoRenderCache.get(buffer)
    const key = JSON.stringify([PIANO_RENDER_VERSION, octave, scale, instrument, bpm])
    if (cached?.has(key)) return cached.get(key)
    melodyClientRef.current ??= new MelodyClient()
    onStage('Analyzing…')
    const frames = await melodyClientRef.current.analyze(buffer, signal,
      (progress) => onStage(`Analyzing… ${Math.round(progress * 100)}%`))
    signal.throwIfAborted()
    const events = pianoNotes(frames, SONG_LENGTH, octave, scale, bpm)
    const audio = await renderPianoEvents(events, {
      duration: SONG_LENGTH, sampleRate: buffer.sampleRate, instrument, signal, onStage,
    })
    signal.throwIfAborted()
    const result = { audio, noteCount: events.length }
    const renders = pianoRenderCache.get(buffer) ?? new Map()
    // Bound retained PCM buffers while allowing quick instrument switches.
    if (renders.size >= 4) renders.delete(renders.keys().next().value)
    renders.set(key, result)
    pianoRenderCache.set(buffer, renders)
    return result
  }

  function renderPianoTrack(id, buffer, instrument = project.tracks.find((track) => track.id === id)?.instrument) {
    const bpm = project.bpm
    const octave = project.tracks.find((track) => track.id === id)?.pianoOctave ?? 0
    const scale = project.tracks.find((track) => track.id === id)?.pianoScale ?? DEFAULT_PIANO_SCALE
    const existing = pianoJobsRef.current.get(id)
    if (existing?.buffer === buffer && existing.bpm === bpm && existing.octave === octave && existing.scale === scale && existing.instrument === instrument) return existing.promise
    existing?.controller.abort()
    const job = { buffer, octave, scale, instrument, bpm, controller: new AbortController() }
    pianoJobsRef.current.set(id, job)
    job.promise = finishPianoTrack(id, buffer, job)
    return job.promise
  }

  async function finishPianoTrack(id, buffer, job) {
    let pianoAudio
    const onStage = (text, error = false, loading = !error) => {
      if (pianoJobsRef.current.get(id) !== job || job.controller.signal.aborted) return
      setPianoMessages((current) => ({ ...current, [id]: { buffer, text, error, loading } }))
    }
    try {
      const result = await renderPianoAudio(buffer, job.octave, job.scale, job.instrument, job.bpm, job.controller.signal, onStage)
      pianoAudio = result.audio
      if (pianoJobsRef.current.get(id) !== job) return pianoAudio
      onStage(result.noteCount ? `Ready · ${result.noteCount} notes` : 'No melody detected', false, false)
    } catch (error) {
      if (pianoJobsRef.current.get(id) !== job || error.name === 'AbortError') return null
      job.failed = true
      onStage(error.message || 'Instrument preparation failed.', true)
      // Keep a failure marker to avoid retrying on every seek update, but no rejected promise.
      job.promise = null
      return null
    }
    if (pianoAudio) {
      setProject((current) => ({
        ...current,
        tracks: current.tracks.map((track) => (
          track.id === id && track.audio === buffer && current.bpm === job.bpm && track.instrument === job.instrument && (track.pianoOctave ?? 0) === job.octave && (track.pianoScale ?? DEFAULT_PIANO_SCALE) === job.scale
            ? { ...track, pianoAudio, pianoBpm: job.bpm, renderedInstrument: job.instrument, renderedPianoOctave: job.octave, renderedPianoScale: job.scale, pianoRenderVersion: PIANO_RENDER_VERSION }
            : track
        )),
      }))
    }
    return pianoAudio
  }

  function setInstrument(id, instrument) {
    stopPlayback()
    const track = project.tracks.find((item) => item.id === id)
    updateTrack(id, { instrument, pianoAudio: null, pianoRenderVersion: null })
    if (isSampledInstrument(instrument) && track?.audio) renderPianoTrack(id, track.audio, instrument)
  }

  function toggleMute(id) {
    if (preparing) stopPlayback()
    if (playing && !playSourcesRef.current.some((item) => item.trackId === id)) stopPlayback()
    setProject((current) => {
      const track = current.tracks.find((item) => item.id === id)
      const muted = !track.muted
      const activeSource = playSourcesRef.current.find((item) => item.trackId === id)
      if (activeSource) activeSource.gain.gain.setValueAtTime(muted ? 0 : 1, audioContextRef.current.currentTime)
      return {
        ...current,
        tracks: current.tracks.map((item) => item.id === id ? { ...item, muted } : item),
      }
    })
  }

  function cyclePianoOctave(track) {
    stopPlayback()
    const octave = track.pianoOctave ?? 0
    const direction = octave === 0 ? (track.pianoOctaveDirection === -1 ? -1 : 1) : Math.sign(octave)
    const next = Math.abs(octave) === 2 ? 0 : octave + direction
    updateTrack(track.id, { pianoOctave: next, pianoOctaveDirection: next === 0 ? -direction : direction })
  }

  function seekTo(value) {
    stopPlayback()
    updateProject({ seek: value })
  }

  function stopMetronome() {
    metronomeRef.current?.stop()
    metronomeRef.current?.disconnect()
    metronomeRef.current = null
  }

  function startMetronome(context, seek, startTime, loop, loopEnd = SONG_LENGTH) {
    stopMetronome()
    if (metronomeBufferRef.current?.bpm !== project.bpm || metronomeBufferRef.current?.buffer.duration !== SONG_LENGTH) {
      metronomeBufferRef.current = { bpm: project.bpm, buffer: metronomeBuffer(context, project.bpm, SONG_LENGTH) }
    }
    const source = context.createBufferSource()
    source.buffer = metronomeBufferRef.current.buffer
    source.loop = loop
    source.loopEnd = loopEnd
    source.connect(context.destination)
    source.onended = () => source.disconnect()
    metronomeRef.current = source
    source.start(startTime, seek)
  }

  function stopPlayback() {
    pendingRecordingStreamRef.current?.getTracks().forEach((track) => track.stop())
    pendingRecordingStreamRef.current = null
    stopMetronome()
    playbackRequestRef.current += 1
    cancelAnimationFrame(playFrameRef.current)
    playSourcesRef.current.forEach(({ source }) => source.stop())
    playSourcesRef.current = []
    setPlaying(false)
    setPreparing(false)
    setArming(false)
  }

  async function preparePlaybackTracks(tracks) {
    return Promise.all(tracks.filter((track) => track.audio).map(async (track) => ({
      track,
      audio: isSampledInstrument(track.instrument)
        ? hasRenderedAudio(track, project.bpm)
          ? track.pianoAudio : await renderPianoTrack(track.id, track.audio)
        : track.audio,
    })))
  }

  function startTrackPlayback(context, tracks, startTime, loop, loopEnd = SONG_LENGTH) {
    const sources = []
    playSourcesRef.current = sources
    for (const { track, audio } of tracks) {
      if (!audio) continue
      const source = context.createBufferSource()
      const gain = context.createGain()
      source.buffer = audio.duration < SONG_LENGTH ? copyBuffer(context, audio) : audio
      source.loop = loop
      source.loopStart = 0
      source.loopEnd = loopEnd
      gain.gain.value = track.muted ? 0 : 1
      source.connect(gain)
      gain.connect(context.destination)
      source.onended = () => { source.disconnect(); gain.disconnect() }
      if (loop) source.start(startTime, 0)
      else source.start(startTime, 0, SONG_LENGTH)
      sources.push({ source, gain, trackId: track.id })
    }
  }

  async function play() {
    if (captureBusy || playing || preparing) return
    const request = ++playbackRequestRef.current
    setPreparing(true)
    setPlaybackError('')
    try {
    updateProject({ seek: 0 })
    const context = audioContext()
    await context.resume()
    const startAt = 0
    const playableTracks = await preparePlaybackTracks(project.tracks)

    if (request !== playbackRequestRef.current) return
    if (playableTracks.some(({ track, audio }) => !track.muted && !audio)) {
      throw new Error('A track could not be prepared. Retry its conversion before playing.')
    }
    const startTime = context.currentTime + 0.05
    const loopEnd = playbackLength(project.tracks)
    startTrackPlayback(context, playableTracks, startTime, true, loopEnd)
    startMetronome(context, startAt, startTime, true, loopEnd)
    const startedAt = startTime
    setPlaying(true)
    const tick = () => {
      if (request !== playbackRequestRef.current) return
      const seek = (startAt + Math.max(0, context.currentTime - startedAt)) % loopEnd
      updateProject({ seek })
      playFrameRef.current = requestAnimationFrame(tick)
    }
    playFrameRef.current = requestAnimationFrame(tick)
    } catch (error) {
      if (request === playbackRequestRef.current) {
        stopPlayback()
        setPlaybackError(error.message || 'Could not start playback.')
      }
    } finally {
      if (request === playbackRequestRef.current) setPreparing(false)
    }
  }

  async function toggleRecording() {
    if (finalizing) return
    if (recording) {
      recorderRef.current?.stop()
      return
    }
    if (arming) { stopPlayback(); return }
    if (!selectedTrack || !ready) return
    stopPlayback()
    const request = ++playbackRequestRef.current
    const targetTrack = selectedTrack
    setArming(true)
    setPreparing(true)
    setPlaybackError('')
    updateProject({ seek: 0 })
    let stream, input, processor, silentOutput, session
    try {
      if (window.isSecureContext === false) throw new Error('Microphone recording needs HTTPS. Open the HTTPS link on your phone.')
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access is unavailable. Open this page over HTTPS in Safari or Chrome.')
      const context = audioContext()
      // Request permission directly from the Record tap, before any async preparation.
      const microphoneRequest = navigator.mediaDevices.getUserMedia({ audio: true }).then((acquired) => {
        stream = acquired
        if (request !== playbackRequestRef.current) acquired.getTracks().forEach((track) => track.stop())
        else pendingRecordingStreamRef.current = acquired
      })
      await Promise.all([microphoneRequest, context.resume()])
      if (request !== playbackRequestRef.current) return
      const backingTracks = await preparePlaybackTracks(project.tracks.filter((track) => track.id !== targetTrack.id && !track.muted))
      if (request !== playbackRequestRef.current) return
      if (backingTracks.some(({ audio }) => !audio)) throw new Error('A backing track could not be prepared. Retry its conversion before recording.')
      pendingRecordingStreamRef.current = null
      input = context.createMediaStreamSource(stream)
      processor = context.createScriptProcessor(4096, 1, 1)
      silentOutput = context.createGain()
      silentOutput.gain.value = 0
      const chunks = []
      const start = 0
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
      const stop = (save = true) => {
        if (stopped) return
        stopped = true
        const duration = Math.max(0, Math.min(SONG_LENGTH - start, context.currentTime - startedAt))
        const end = Math.min(SONG_LENGTH, start + duration)
        stopMetronome()
        playSourcesRef.current.forEach(({ source }) => source.stop())
        playSourcesRef.current = []
        window.clearTimeout(session?.endTimer)
        cancelAnimationFrame(recordingFrameRef.current)
        processor.disconnect()
        processor.onaudioprocess = null
        input.disconnect()
        silentOutput.disconnect()
        stream.getTracks().forEach((track) => track.stop())
        if (recorderRef.current === session) recorderRef.current = null
        if (!save) return
        setVolume(0)
        setRecording(false)
        updateProject({ seek: end })
        const frameCount = Math.round(duration * context.sampleRate)
        if (!frameCount || !chunks.length) return
        setFinalizing(true)
        // Let the stopped seek and spinner paint before allocating/copying PCM.
        finalizeTimerRef.current = window.setTimeout(() => {
          try {
            const recordingBuffer = context.createBuffer(1, frameCount, context.sampleRate)
            const recorded = recordingBuffer.getChannelData(0)
            let offset = 0
            for (const chunk of chunks) {
              recorded.set(chunk.subarray(0, Math.max(0, frameCount - offset)), offset)
              offset += chunk.length
              if (offset >= frameCount) break
            }
            const fullLength = Math.ceil(SONG_LENGTH * context.sampleRate)
            const audio = targetTrack?.audio
              ? copyBuffer(context, targetTrack.audio)
              : context.createBuffer(1, fullLength, context.sampleRate)
            audio.getChannelData(0).set(recorded, Math.round(start * context.sampleRate))
            setProject((current) => ({
              ...current,
              seek: end,
              tracks: current.tracks.map((track) => {
                if (track.id !== targetTrack.id) return track
                return { ...track, audio, audioEnd: Math.max(track.audioEnd ?? 0, end), pianoAudio: null, pianoRenderVersion: null }
              }),
            }))
            if (isSampledInstrument(targetTrack?.instrument)) renderPianoTrack(targetTrack.id, audio)
          } catch (error) {
            setPlaybackError(error.message || 'Could not process the recording.')
          } finally {
            finalizeTimerRef.current = null
            setFinalizing(false)
          }
        }, 20)
      }
      session = { stop, endTimer: window.setTimeout(stop, (SONG_LENGTH - start) * 1000) }
      recorderRef.current = session
      startTrackPlayback(context, backingTracks, startedAt, false)
      startMetronome(context, start, startedAt, false)
      setArming(false)
      setPreparing(false)
      setRecording(true)
      const moveSeek = () => {
        if (stopped) return
        updateProject({ seek: Math.min(SONG_LENGTH, start + context.currentTime - startedAt) })
        if (!stopped) recordingFrameRef.current = requestAnimationFrame(moveSeek)
      }
      recordingFrameRef.current = requestAnimationFrame(moveSeek)
    } catch (error) {
      session?.stop(false)
      input?.disconnect()
      processor?.disconnect()
      silentOutput?.disconnect()
      stream?.getTracks().forEach((track) => track.stop())
      if (request === playbackRequestRef.current) {
        stopPlayback()
        setPlaybackError(error.name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow Microphone in this site’s browser settings and your phone’s permissions, then tap Record again. If opened inside another app, try Safari or Chrome.'
          : error.name === 'NotFoundError' ? 'No microphone was found. Connect or enable a microphone and try again.'
          : error.name === 'NotReadableError' ? 'The microphone could not start. Close other apps using it and try again.'
          : error.message || 'Could not start recording.')
      }
    } finally {
      if (request === playbackRequestRef.current) { setArming(false); setPreparing(false) }
    }
  }

  return (
    <Device3D>
    <main className="app"
      onClickCapture={(event) => {
        const button = event.target.closest('button')
        if (button && !button.disabled) interfaceSound()
      }}
      onChangeCapture={(event) => {
        if (event.target.matches('select') && !event.target.disabled) interfaceSound('tick')
      }}>
      <div className="device-rail" aria-hidden="true">
        <span className="rail-tab output-port">OUTPUT</span>
        <span className="rail-tab input-port">INPUT</span>
        <span className="rail-tab digital-ports"><span>SYNC</span><span>MIDI</span></span>
        <span className="rail-tab usb-port">USB</span>
        <span className="rail-end"><i /></span>
      </div>
      <header className="device-header">
        <div className="identity">
          <div className="model-line"><h1>S-251X</h1></div>
          <span className="brand-accent">SOUND. ON THE GO.</span>
        </div>
        <div className="speaker" aria-hidden="true" />
      </header>
      <section className={`display-panel ${recording ? 'is-recording' : ''}`} aria-label="Transport display">
        <div className="display-topline">
          <span className="display-state"><i className={playing || recording ? 'led led-on' : 'led'} />{recording ? 'REC ACTIVE' : preparing ? 'PREPARING' : playing ? 'PLAYING' : 'STANDBY'}</span>
          <span>TRACK {selectedNumber} <span className="display-divider">/</span> {selectedTrack?.instrument.toUpperCase() ?? 'NO TRACK'}</span>
        </div>
        <div className="display-main">
          <div className="time-display"><span className="display-caption">POSITION</span>
            <output aria-label="Playback position">{String(Math.floor(project.seek / 60)).padStart(2, '0')}:{String(Math.floor(project.seek % 60)).padStart(2, '0')}<small>.{Math.floor(project.seek % 1 * 10)}</small></output>
          </div>
          <div className="waveform-display">
            <svg viewBox="0 0 480 60" preserveAspectRatio="none" role="img" aria-label={selectedTrack?.audio ? 'Selected track waveform' : 'Empty track'}>
              <line x1="0" x2="480" y1="30" y2="30" className="waveform-baseline" />
              {waveform.map((peak, index) => <line key={index} x1={index * 3 + 1} x2={index * 3 + 1} y1={30 - Math.max(0.6, peak * 28)} y2={30 + Math.max(0.6, peak * 28)} className="waveform-bar" />)}
              <line x1={project.seek / SONG_LENGTH * 480} x2={project.seek / SONG_LENGTH * 480} y1="0" y2="60" className="waveform-cursor" />
            </svg>
            <span className="display-caption">{selectedTrack?.audio ? 'AUDIO BUFFER' : 'EMPTY BUFFER — RECORD OR UPLOAD'}</span>
          </div>
          <div className="input-meter"><span className="display-caption">MIC IN</span>
            <div className="meter-bars" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} className={recording && volume > i * 3 ? 'lit' : ''} />)}</div>
            <output aria-label="Microphone volume">{recording ? volume : 0}</output>
          </div>
        </div>
        <div className="seek-ruler" aria-hidden="true"><span>00</span><span>15</span><span>30</span><span>45</span><span>60</span></div>
        <input className="seek" aria-label="Seek" type="range" min="0" max={SONG_LENGTH} step="0.1" value={project.seek}
          disabled={captureBusy} onChange={(event) => seekTo(Number(event.target.value))} />
        {preparing && <output className="screen-message" role="status">Preparing…</output>}
        {playbackError && <output className="screen-message screen-error" role="alert">{playbackError}</output>}
      </section>
      <section className="transport" aria-label="Transport controls">
        <div className="tempo-control">
          <TempoKnob value={project.bpm} disabled={captureBusy || !ready} onChange={changeTempo} />
          <div className="tempo-settings"><label htmlFor="tempo">TEMPO / METRONOME</label>
            <output>{project.bpm} BPM</output>
            <input id="tempo" aria-label="Metronome BPM" type="range" min="60" max="200" step="1" value={project.bpm}
              disabled={captureBusy || !ready} onChange={(event) => changeTempo(Number(event.target.value))} />
          </div>
        </div>
        <div className="transport-actions">
          <div className="transport-key"><span className="panel-label"><i className={recording ? 'led led-on' : 'led'} /> INPUT</span>
            <button className={`key key-orange record-key ${recording ? 'key-active' : ''}`} type="button" onClick={toggleRecording} disabled={!ready || !selectedTrack || importing || finalizing}>
              {recording ? 'Stop recording' : arming ? 'Cancel recording' : 'Record'}
            </button>
          </div>
          <div className="transport-key"><span className="panel-label"><i className={playing ? 'led led-on' : 'led'} /> TRANSPORT</span>
          <button className={`key play-key ${playing ? 'key-active' : ''}`} type="button" onClick={playing || preparing ? stopPlayback : play} disabled={recording || finalizing || importing || !ready}>
            {preparing ? 'Cancel' : playing ? 'Stop' : 'Play'}
          </button>
          </div>
        </div>
      </section>
      <section className="tracks">
        <div className="track-section-heading"><h2>TRACK BANK <span>{String(project.tracks.length).padStart(2, '0')}</span></h2>
          <div className="bank-actions">
        <button className="key key-small key-light" type="button" onClick={addTrack} disabled={captureBusy}>Create track</button>
        <input ref={fileInputRef} type="file" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac,.webm" multiple hidden
          onChange={importTracks} />
        <button className="key key-small" type="button" disabled={!ready || captureBusy || importing} onClick={() => fileInputRef.current.click()}>
          {importing ? 'Importing…' : 'Upload tracks'}
        </button>
          </div>
        </div>
        <div className="track-list">
          {project.tracks.map((track, index) => (
            <div className={`track ${track.id === project.selectedTrackId ? 'track-selected' : ''} ${track.muted ? 'track-muted' : ''}`} key={track.id}>
              <button className="key track-pad" data-number={String(index + 1).padStart(2, '0')} type="button" onClick={() => updateProject({ selectedTrackId: track.id })} disabled={captureBusy}
                aria-label={`Select track ${index + 1}`} aria-pressed={track.id === project.selectedTrackId}><span className="track-button-label">Select</span></button>
              <div className="track-body">
              <div className="track-settings">
              <InstrumentSelector value={track.instrument} disabled={captureBusy} onChange={(instrument) => setInstrument(track.id, instrument)} />
              {isSampledInstrument(track.instrument) && <div className="octave-control">
                <span className="panel-label">OCTAVE</span>
                <button className="key key-small key-light octave-cycle" type="button" disabled={captureBusy}
                  aria-label={`${track.instrument} octave: ${track.pianoOctave ?? 0}. Click for next octave`}
                  title="Click to cycle octave" onClick={() => cyclePianoOctave(track)}>
                  {(track.pianoOctave ?? 0) > 0 ? `+${track.pianoOctave}` : track.pianoOctave ?? 0}
                </button>
              </div>}
              </div>
              <div className="track-lower">
              <div className={`track-status${renderingTrackIds.includes(track.id) ? ' track-busy' : ''}`} title={renderingTrackIds.includes(track.id) ? 'Loading…' : pianoMessages[track.id]?.text ?? (track.audio ? 'Audio loaded' : 'Empty slot')}><i className={track.audio && !track.muted ? 'led led-on' : 'led'} />
              {!isSampledInstrument(track.instrument) && !renderingTrackIds.includes(track.id) && <span>{track.audio ? 'AUDIO LOADED' : 'EMPTY SLOT'}</span>}
              {isSampledInstrument(track.instrument) && !track.audio && <span>EMPTY SLOT</span>}
              {renderingTrackIds.includes(track.id) && <output aria-label="Track is rendering">Loading…</output>}
              {isSampledInstrument(track.instrument) && pianoMessages[track.id]?.buffer === track.audio && (
                <>
                  <output role="status">{pianoMessages[track.id].text}</output>
                  {pianoMessages[track.id].error && <button className="key key-small" type="button" aria-label="Retry" title="Retry" disabled={captureBusy} onClick={() => {
                    stopPlayback()
                    invalidatePianoJob(track.id)
                    renderPianoTrack(track.id, track.audio)
                  }}><TrackIcon name="retry" /><span className="track-button-label">Retry</span></button>}
                </>
              )}
              </div>
              <div className="track-actions">
              <button className="key key-small mute-key" type="button" onClick={() => toggleMute(track.id)} disabled={captureBusy}
                aria-label={track.muted ? 'Unmute' : 'Mute'} title={track.muted ? 'Unmute' : 'Mute'} aria-pressed={track.muted}><TrackIcon name={track.muted ? 'muted' : 'volume'} /><span className="track-button-label">{track.muted ? 'Unmute' : 'Mute'}</span></button>
              <button className="key key-small key-light" type="button" aria-label="Duplicate track" title="Duplicate track" onClick={() => duplicateTrack(track.id)} disabled={captureBusy}><TrackIcon name="duplicate" /><span className="track-button-label">Duplicate track</span></button>
              <button className="key key-small key-light" type="button" aria-label="Delete track" title="Delete track" onClick={() => deleteTrack(track.id)} disabled={captureBusy || project.tracks.length === 1}><TrackIcon name="delete" /><span className="track-button-label">Delete track</span></button>
              </div>
              </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <footer className="export-controls">
        <div className="render-indicator" role="status" aria-live="polite">
          {(finalizing || waitingForRender || renderingTrackIds.length > 0) && <span className="render-spinner" role="img" aria-label="Rendering audio" />}
        </div>
        <button className="key key-small key-light" type="button" onClick={exportMidi}
          disabled={!ready || captureBusy || exporting || !project.tracks.some((track) => track.audio && !track.muted && isSampledInstrument(track.instrument))}
          title="Export notes from unmuted piano, guitar, and electric guitar tracks">
          {exporting ? 'Exporting…' : 'Export MIDI'}
        </button>
      </footer>
    </main>
    </Device3D>
  )
}
