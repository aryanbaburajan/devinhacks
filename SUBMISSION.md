# Project submission

Complete this file during the hackathon and use it to prepare your submission through the method announced by the organizers. Do not submit your project to the template repository.

## Project

- **Project name:** 60 Second Studio
- **Short description:** A minimal browser music sketchpad for recording and arranging microphone takes within a fixed 60-second song.
- **Code repository URL:** TODO
- **Final submitted implementation commit SHA:** TODO
- **Working demo URL or local demo steps:** Run `npm install` then `npm run dev`, open the local Vite URL, and allow microphone permission.
- **Demo access requirements:** Node.js 20+ for local development and a modern browser with microphone access. No credentials are required.

## Participants

Participate solo or in a team of up to 4. Remove unused rows.

| Participant name | GitHub handle | Contribution |
| --- | --- | --- |
| TODO | TODO | TODO |

## Run and demonstrate

- **Prerequisites and versions:** Node.js 20+ and a modern browser with microphone permission.
- **Install command:** `npm install`
- **Required environment variable names:** None.
- **Start command:** `npm run dev`
- **Demo walkthrough:** Create a track, set its instrument label, select its recording target, set a seek position, and record. Watch the seek and numeric microphone meter change, then stop and play back. Duplicate or delete a track to demonstrate track management. Refresh to demonstrate local persistence.
- **Checks performed and results:** `npm run build` completed successfully with Node.js v24.19.0 from the local NVM installation. `git diff --check` passed.
- **Known limitations or incomplete features:** Instrument choices do not apply audio processing. Audio recording requires browser support for microphone access and ScriptProcessor; the mic meter is an uncalibrated RMS integer.
- **Libraries, APIs, and public datasets used:** [React](https://react.dev/) and [Vite](https://vite.dev/). No external APIs or datasets are used.
- **AI usage record:** [AI_USAGE.md](AI_USAGE.md)
- **Development change log:** [CHANGELOG.md](CHANGELOG.md)

## Submission checklist

- [ ] The project implementation started from scratch at the event.
- [ ] I participated solo or with no more than 4 team members in total.
- [ ] Codex was used during development and its usage is documented.
- [ ] The code repository URL, short description, and working demo are provided.
- [ ] README setup and demo instructions match the submitted code.
- [ ] Actual checks and known limitations are documented.
- [ ] Meaningful changes are documented and committed throughout development.
- [ ] The final implementation is committed and pushed, and its SHA is recorded above.
- [ ] No credentials or private data are included in the repository or demo instructions.
- [ ] The organizers' announced submission method and timing have been followed.

Event reference: [DevDay Exchange Community: Kochi on Luma](https://luma.com/z10nz8gp). The event wraps up by **10:00 AM IST on 11 October 2026**.
