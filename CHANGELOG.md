# Change log

Record each meaningful project change during the event, newest first. Update this file in the same commit as the change. Use a real timestamp with timezone, for example `YYYY-MM-DDTHH:MM:SS+05:30`.

## Event build log

## 2026-10-24T21:58:26+05:30 — Simplify track audio and add recording feedback

- Changed: Removed visible non-control labels, track names, and take counts in `src/App.jsx`; changed each track to one composite audio buffer; made seek advance while recording; added a live numeric microphone-level indicator; and migrate prior multi-take local projects on load. Added `package-lock.json`.
- Why: Keep the app visually minimal, avoid accumulating takes on a track, and give recording feedback without introducing styling.
- Validation: Ran `npm run build` with Node.js v24.19.0 from the local NVM installation; Vite completed successfully. Ran `git diff --check` successfully.
- Limitations: Instrument selections are still labels only. The numeric meter is an uncalibrated RMS value and audio capture relies on browser microphone support.

## 2026-10-24T21:52:43+05:30 — Add 60 Second Studio MVP

- Changed: Built the Vite/React app in `src/`, added Vite configuration files, and updated `README.md` and `SUBMISSION.md` with setup and demo details.
- Why: Provide a minimal music sketchpad with a fixed 60-second song, track management, instrument labels, microphone recording, interval-only overwriting, playback, and local persistence.
- Validation: Reviewed the implementation and ran `git diff --check`. Build validation was completed in the following milestone with the local NVM Node installation.
- Limitations: Instrument selections are labels only; audio capture depends on browser microphone permission and ScriptProcessor support.

## Template setup — 10 October 2026

- Changed: Added the event README, rules, agent guide, change log, AI usage record, submission checklist, Git ignore rules, and pull request checklist.
- Why: Give participants a consistent starting point for event rules, basic coding patterns, documented changes, and regular commits.
- Validation: Checked local Markdown links, event detail consistency, required documents, and diff whitespace before publishing.
- Limitations: Documentation scaffolding only; no participant project, application, or working demo is included. GitHub publication and template status are verified separately after creation.
