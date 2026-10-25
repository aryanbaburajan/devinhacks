# Project submission

Complete this file during the hackathon and use it to prepare your submission through the method announced by the organizers. Do not submit your project to the template repository.

## Project

- **Project name:** S-251X
- **Short description:** A browser music sketchpad for musicians and anyone with a melody in mind. Record or import a phrase, turn it into sampled instrument notes, layer a 60-second loop, and export MIDI for further work.
- **Code repository URL:** https://github.com/aryanbaburajan/devinhacks
- **Final submitted implementation commit SHA:** Pending final submission. Current implementation reference: `e8bf5c900aa09cae311b0e599b18445cd0632ad3`.
- **Working demo URL or local demo steps:** Run `npm ci` then `npm run dev`, open the local address printed by Vite, and follow the walkthrough below. No hosted demo URL is recorded.
- **Demo access requirements:** A modern browser with Web Audio, WebGL, IndexedDB, and microphone permission. Use localhost or HTTPS for recording and an internet connection for instrument sample loading. No account or API key is required.

## Participants

Repository contributor listed below; confirm the final participant roster before submission (maximum 4 participants).

| Participant name | GitHub handle | Contribution |
| --- | --- | --- |
| Aryan Baburajan | [@aryanbaburajan](https://github.com/aryanbaburajan) | Project implementation and design, as recorded in repository history. |

## Run and demonstrate

- **Prerequisites and versions:** Node.js 22.22.2+ within 22.x, or 24.15.0+ within 24.x, npm, and the browser capabilities above.
- **Install command:** `npm ci`
- **Required environment variable names:** None. No application backend or `.env` file is required.
- **Start command:** `npm run dev`. For a production preview, run `npm run build` then `npm run preview`.
- **Demo walkthrough:** Set the tempo, select a track, and record a short solo melody. Stop recording, switch the instrument to piano or guitar, and wait for preparation. Create a second track and record over the backing track using headphones. Play the loop, mute or duplicate a track, and export MIDI from an unmuted instrument track. Refresh to demonstrate local project persistence. See [make something](README.md#02--make-something).
- **Checks performed and results:** Local Markdown links and anchors, source and command consistency, and `git diff --check` passed. `npm test` and `npm run build` are the project checks; they were not rerun for this documentation-only change. Earlier milestone results are preserved in [CHANGELOG.md](CHANGELOG.md).
- **Known limitations or incomplete features:** Fixed 60-second arrangements; conversion follows a single melody rather than polyphonic chords. Microphone capture depends on browser support and permission; headphones reduce backing-track bleed. Instrument samples need an internet connection during preparation. Projects are saved only in this browser, and MIDI export excludes original vocal audio and is not a full project backup.
- **Libraries, APIs, and public datasets used:** See the [project sources](README.md#07--sources) for React, Vite, Three.js, Pitchy, Smplr, midi-file, browser APIs, and test tools. Sample sources and attribution are in [AUDIO_SOURCES.md](AUDIO_SOURCES.md). No application backend, AI API, or public training dataset is used by the app.
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
