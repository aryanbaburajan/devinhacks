# Change log

Record each meaningful project change during the event, newest first. Update this file in the same commit as the change. Use a real timestamp with timezone, for example `YYYY-MM-DDTHH:MM:SS+05:30`.

## Event build log

## 2026-10-25T11:42:53+05:30 — Zoom the 3D device with the scroll wheel

- Changed: Added wheel zoom on the desktop device in `src/deviceScene.js`, scaling its HTML pose and Three.js camera together from 0.8× to 1.6×. The canvas height follows the zoom without rebuilding the chassis on every wheel event. Updated scene tests and `README.md`.
- Why: Let users zoom directly over the device without adding another visible control.
- Validation: In headless Chrome, a wheel event grew the pose from 1× to 1.25× and the canvas from 950px to 1148px; the enlarged controls remained visually aligned. All 65 tests, the production build, and `git diff --check` passed. The existing large generated 3D chunk warning remains.
- Limitations: At high zoom, the device may extend beyond the viewport; scroll outside it to reach lower content. Mobile keeps native page and pinch behavior.

## 2026-10-25T11:39:22+05:30 — Enlarge and fit the content-driven device

- Changed: Widened the centered device from 420px to 720px in `src/Device3D.css`, kept compact controls at that width in `src/App.css`, and removed viewport-height minimums so the chassis grows with its tracks. Added vertical canvas room for the rotated shell in `src/deviceScene.js`, removed the desktop Reset view button from `src/Device3D.jsx`, updated layout and resize tests, and revised `README.md`.
- Why: Fill more of a desktop frame, keep the footer visible, and avoid empty device height when there is only one track.
- Validation: Inspected a 1440×1000 Chrome render with the full footer visible and no Reset view button. All 65 tests, the production build, and `git diff --check` passed. The scene test checks growth and shrinkage after resize; the existing large generated 3D chunk warning remains.
- Limitations: The screenshot covers one track at the default desktop angle; other browsers and extreme rotation angles were not visually inspected.

## 2026-10-25T11:36:24+05:30 — Use phone-width layout in desktop browsers

- Changed: Capped the device pose at 420px in `src/Device3D.css` and made the existing compact rules in `src/App.css` and `src/Device3D.css` respond to device width. Moved Reset view beside the narrower device, updated the scene fixture width, and documented the layout in `README.md`.
- Why: Keep the mobile proportions and compact controls when the browser window is wide.
- Validation: Inspected headless Chrome renders at 1440px and 390px viewport widths; all 65 tests, the production build, and `git diff --check` passed. The existing large generated 3D chunk warning remains.
- Limitations: Chrome renders were visual checks; other browsers and device sizes were not inspected.

## 2026-10-25T11:34:53+05:30 — Stabilize control hit targets in 3D view

- Changed: Kept native buttons, sliders, selectors, and the tempo dial near their panel face in `src/Device3D.css`; removed obsolete CSS depth writes from `src/deviceScene.js` and updated its visual press test and the 3D interaction note in `README.md`.
- Why: The HTML controls were translated to different depths inside the rotated CSS 3D tree, which can cause browser hit-testing to miss a visible control. Three.js continues to render the raised physical controls.
- Validation: `npm test` passed all 65 tests; `npm run build` and `git diff --check` passed. The existing large generated 3D chunk warning remains.
- Limitations: The cause is inferred from the CSS 3D layout; physical click behavior needs confirmation in the affected browser. A browser surface was unavailable in this environment.

## 2026-10-25T07:44:58+05:30 — Place loading circle beside MIDI export

- Changed: Removed the loading indicator's auto margin, reserved a nonshrinking 16px slot immediately left of Export MIDI in `src/App.css`, and raised its HTML surface to button-label depth in `src/Device3D.css`. Updated `README.md`.
- Why: Keep the circle beside a visible control on mobile instead of at the opposite edge of the device, without moving the export button when loading starts.
- Validation: All 3 targeted loading-state tests passed; production build and `git diff --check` passed. The existing large-chunk build warning remains.
- Limitations: Mobile visual confirmation is pending; no connected browser was available. Existing tests verify loading-state behavior, not rendered CSS placement.

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
