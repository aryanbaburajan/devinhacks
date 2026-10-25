# Change log

Record each meaningful project change during the event, newest first. Update this file in the same commit as the change. Use a real timestamp with timezone, for example `YYYY-MM-DDTHH:MM:SS+05:30`.

## Event build log

## 2026-10-25T07:42:44+05:30 — Stabilize desktop rotation layout

- Changed: Reserved the root scrollbar gutter on desktop fine-pointer layouts in `src/Device3D.css`; documented desktop rotation in `README.md`.
- Why: Rotated overflow can toggle a classic scrollbar, resize the canvas, and recenter the device near the front-facing angle. Reserving the gutter addresses this suspected cause without clipping the device or changing phone tilt.
- Validation: All 7 existing geometry/scene tests passed, including desktop and mobile rotation checks; `npm run build` and `git diff --check` passed. The build retains its existing large-chunk warning.
- Limitations: No connected browser was available to reproduce the reported visual jerk. These tests exercise scene math and renderer calls, not browser scrollbar layout; human visual confirmation is pending. Older browsers without `scrollbar-gutter` support retain their previous behavior.

## 2026-10-25T07:33:14+05:30 — Restore hackathon documentation for S-251X

- Changed: Added the requested template's `AGENTS.md` and `RULES.md`, restored prior `AI_USAGE.md` and changelog entries, filled `SUBMISSION.md` with current project details, and added missing overview, environment, source, and submission information to `README.md`. Updated retired instrument references while retaining the README's existing style and instructions.
- Why: Make the existing project reviewable using the hackathon template without replacing its product manual.
- Validation: Passed local Markdown link/anchor checks, source and command consistency checks, and `git diff --check`. Verified original README headings and historical log entries are preserved; `AGENTS.md` and `RULES.md` match upstream. No application code changed; runtime tests were not rerun.
- Limitations: Human review, the final participant roster, and the final submitted implementation SHA remain to be confirmed. Event dates are retained verbatim from the upstream template; recorded project timestamps are unchanged.

## 2026-10-25T06:59:00+05:30 — S-251X development since the earlier log

This is a retrospective summary from git history, ending at `e8bf5c9`; the timestamp is that commit's author timestamp. Earlier milestone entries below were restored from `557aa22`.

- Changed: `2608d08` removed the template files. `41f799d` introduced the S-251X workstation with 3D controls and MIDI export; `fc2887c` added the product-manual README. `4f593c5` and `fd4c1a4` retired drum and saxophone choices while preserving recordings. `39d72bb` added backing-track playback during recording and microphone-access improvements. `e8bf5c9` improved audio recording, playback, and note detection.
- Why: Record the intervening implementation milestones without inventing missing development or AI logs.
- Validation: Reviewed commit history and current source during documentation restoration. Original test results for these commits were not recorded in the restored log; no new runtime verification is claimed here.
- Limitations: Melody conversion follows a single voice; projects remain local to the browser, and instrument samples require a network connection on preparation.

## 2026-10-24T22:01:03+05:30 — Add responsive flexbox layout

- Changed: Replaced control line breaks with flexbox layout classes in `src/App.jsx` and added structural layout rules in `src/App.css`.
- Why: Arrange transport and track controls cleanly without visual styling individual elements.
- Validation: Ran `npm run build` with Node.js v24.19.0 from the local NVM installation; Vite completed successfully. Ran `git diff --check` successfully.
- Limitations: Deliberately uses browser-default colors, typography, borders, and control appearance.

## 2026-10-24T22:00:34+05:30 — Increase plain control spacing

- Changed: Added HTML line breaks between each primary and track control in `src/App.jsx`.
- Why: Make the unstyled interface easier to scan without adding CSS.
- Validation: Ran `npm run build` with Node.js v24.19.0 from the local NVM installation; Vite completed successfully. Ran `git diff --check` successfully.
- Limitations: Layout intentionally uses browser-default styling only.

## 2026-10-24T21:59:44+05:30 — Make the timeline seekable during playback

- Changed: Updated the seek control in `src/App.jsx` so it remains interactive during playback and stops at the user-selected point. Added basic HTML line breaks between controls and tracks.
- Why: Allow direct timeline seeking and make the intentionally unstyled interface easier to scan.
- Validation: Ran `npm run build` with Node.js v24.19.0 from the local NVM installation; Vite completed successfully. Ran `git diff --check` successfully.
- Limitations: Seeking stops playback rather than resuming from the new location.

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
