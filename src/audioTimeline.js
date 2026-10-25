export const SONG_LENGTH = 60

export function recordedEnd(track) {
  if (!track.audio) return 0
  if (Number.isFinite(track.audioEnd)) return Math.max(0, Math.min(SONG_LENGTH, track.audioEnd))
  const { channels, sampleRate } = track.audio
  // Older projects padded recordings to a minute without saving their endpoint.
  let end = 0
  for (const channel of channels) {
    for (let i = Math.min(channel.length, Math.ceil(SONG_LENGTH * sampleRate)) - 1; i >= end; i--) {
      if (channel[i] !== 0) { end = i + 1; break }
    }
  }
  return Math.min(SONG_LENGTH, (end || channels[0].length) / sampleRate)
}

export function playbackLength(tracks) {
  const end = tracks.reduce((longest, track) => track.audio ? Math.max(longest, track.audioEnd ?? SONG_LENGTH) : longest, 0)
  return end > 0 ? Math.max(0.01, Math.min(SONG_LENGTH, end)) : SONG_LENGTH
}
