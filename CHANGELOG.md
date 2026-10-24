# Change log

Record each meaningful project change during the event, newest first. Update this file in the same commit as the change. Use a real timestamp with timezone, for example `YYYY-MM-DDTHH:MM:SS+05:30`.

## Event build log

## 2026-10-24T21:52:43+05:30 — Add 60 Second Studio MVP

- Changed: Built the Vite/React app in `src/`, added Vite configuration files, and updated `README.md` and `SUBMISSION.md` with setup and demo details.
- Why: Provide a minimal music sketchpad with a fixed 60-second song, track management, instrument labels, microphone recording, interval-only overwriting, playback, and local persistence.
- Validation: Reviewed the implementation and ran `git diff --check`. `npm install` and `npm run build` could not run because this workspace image has no `npm` executable.
- Limitations: Instrument selections are labels only; audio capture depends on browser microphone permission and ScriptProcessor support.

## Template setup — 10 October 2026

- Changed: Added the event README, rules, agent guide, change log, AI usage record, submission checklist, Git ignore rules, and pull request checklist.
- Why: Give participants a consistent starting point for event rules, basic coding patterns, documented changes, and regular commits.
- Validation: Checked local Markdown links, event detail consistency, required documents, and diff whitespace before publishing.
- Limitations: Documentation scaffolding only; no participant project, application, or working demo is included. GitHub publication and template status are verified separately after creation.
