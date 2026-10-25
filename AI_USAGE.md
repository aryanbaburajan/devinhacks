# AI usage record

Use Codex during the hackathon and briefly document its actual contribution here. Add a row after each meaningful task or milestone. Keep summaries concise and omit secrets, private data, and full chat transcripts.

## Event build log

Earlier entries below were restored from commit `557aa22`; their checks describe the project at those milestones, not the current build. Later implementation work is summarized from git history in [CHANGELOG.md](CHANGELOG.md); no additional AI usage is inferred from commit authorship.

| Date and time with timezone | Tool / model, if known | Task | Assistance and affected files | Human review / corrections | Validation and result |
| --- | --- | --- | --- | --- | --- |
| 2026-10-25T07:44:58+05:30 | Codex | Make the loading circle easier to find on mobile | Moved the circle next to Export MIDI with a reserved flex slot and matched its 3D depth to button labels; updated README/change log. | Requested placement implemented; mobile visual review pending. | All 3 targeted loading-state tests and production build passed; diff whitespace checked. No connected browser for visual verification. |
| 2026-10-25T07:42:44+05:30 | Codex | Investigate desktop rotation jerk near zero | Reviewed drag, projection, and canvas layout; reserved desktop scrollbar space in `src/Device3D.css` and updated README/change log. | User clarified desktop only; visual confirmation pending. Scrollbar resizing is a suspected cause, not a reproduced diagnosis. | All 7 geometry/scene tests and production build passed; diff whitespace checked. No browser was connected for visual verification. |
| 2026-10-24T21:52:43+05:30 | Codex | Build initial Vite music sketchpad | Created the React app, browser audio recording/playback logic, IndexedDB persistence, and setup documentation. | Pending human review | `git diff --check` passed. Build could not run because this workspace image has no `npm` executable. |
| 2026-10-24T21:58:26+05:30 | Codex | Simplify recording experience | Converted tracks to one composite buffer, added live seek and microphone level feedback, removed labels/take counts, and generated the package lock. | Pending human review | `npm run build` passed using Node.js v24.19.0 from the local NVM installation; `git diff --check` passed. |
| 2026-10-24T21:59:44+05:30 | Codex | Improve timeline interaction | Made the seek control interactive during playback and added plain HTML line breaks to the control layout. | Pending human review | `npm run build` passed using Node.js v24.19.0 from the local NVM installation; `git diff --check` passed. |
| 2026-10-24T22:00:34+05:30 | Codex | Improve unstyled spacing | Added additional HTML line breaks between the controls. | Pending human review | `npm run build` passed using Node.js v24.19.0 from the local NVM installation; `git diff --check` passed. |
| 2026-10-24T22:01:03+05:30 | Codex | Add structural layout | Replaced line breaks with a responsive flexbox layout while preserving default element appearance. | Pending human review | `npm run build` passed using Node.js v24.19.0 from the local NVM installation; `git diff --check` passed. |
| 2026-10-25T07:33:14+05:30 | Codex | Restore hackathon documentation | Imported `AGENTS.md` and `RULES.md` from the requested template, restored earlier AI/change records, completed project details in `SUBMISSION.md`, and adapted `README.md` while preserving its product-manual style. Corrected retired instrument references. | Pending human review | Passed local Markdown link/anchor checks, source and command consistency checks, and `git diff --check`. Verified original README headings and historical log entries are preserved; `AGENTS.md` and `RULES.md` match upstream. No application code changed; runtime tests were not rerun. |

## Template preparation

On 10 October 2026, Codex prepared this documentation template from the organizer's supplied rules and checked the linked Luma page for the event name and dates. This covered `README.md`, `RULES.md`, `AGENTS.md`, `CHANGELOG.md`, `AI_USAGE.md`, `SUBMISSION.md`, `.gitignore`, and the pull request checklist. Agent validation covered local links, event consistency, required documents, and diff whitespace; organizer review is pending.

This preparation is separate from participant project implementation and participant AI usage during the event.
