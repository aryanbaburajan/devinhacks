# 60 Second Studio

A deliberately small, browser-based music sketchpad. A song is always 60 seconds long: create tracks, choose their intended instrument, and record microphone takes onto the selected track.

The recorder writes from the current seek position to the point where recording stops. It replaces only that interval, preserving audio before and after it on the same track.

## Run the project

Requires Node.js 20+ and a modern browser with microphone permission.

1. Install dependencies: `npm install`
2. Start the app: `npm run dev`
3. Open the local address printed by Vite and allow microphone access when recording.
4. Create a track, select its instrument, choose it as the recording target, move the seek control, and press **Record**. Press **Stop recording** to finish.

Run `npm run build` for a production build.

## Local recordings

Recorded audio and project data are saved in the browser's IndexedDB. This is local to the browser profile and survives refreshes. IndexedDB is used instead of `localStorage` because it can store binary audio without string conversion and has substantially more practical capacity. Clearing the site's browser data removes recordings.

## Current status

- Implemented: 60-second seek timeline; create, duplicate, and delete tracks; instrument selector; microphone recording; interval-only overwrite; playback; local persistence.
- Instrument processing is intentionally not implemented. Instrument choices label the intended track type only.
- Uses React and Vite. No external APIs or datasets are used.

See [AI_USAGE.md](AI_USAGE.md) and [CHANGELOG.md](CHANGELOG.md) for the development record.
