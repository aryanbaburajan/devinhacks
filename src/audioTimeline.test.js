import assert from 'node:assert/strict'
import { test } from 'node:test'
import { recordedEnd, playbackLength } from './audioTimeline.js'

test('old padded recordings recover their endpoint across all channels', () => {
  const left = new Float32Array(6000), right = new Float32Array(6000)
  left[199] = 0.2
  right[349] = 0.1
  const track = { audio: { channels: [left, right], sampleRate: 100 } }
  assert.equal(recordedEnd(track), 3.5)
  assert.equal(recordedEnd({ ...track, audioEnd: 5 }), 5, 'explicit endpoint retains recorded silence')
  assert.equal(recordedEnd({ ...track, audioEnd: 80 }), 60)
})

test('loop uses the longest recording and remains stable when a track is muted', () => {
  const tracks = [{ audio: {}, audioEnd: 2 }, { audio: {}, audioEnd: 4.5, muted: true }, { audio: null }]
  assert.equal(playbackLength(tracks), 4.5)
  assert.equal(playbackLength(tracks.slice(0, 1)), 2)
  assert.equal(playbackLength([]), 60)
  assert.equal(recordedEnd({ audio: null }), 0)
})
