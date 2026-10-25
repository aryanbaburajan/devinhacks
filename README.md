# S-251X

**sound. on the go.**

a small music sketchpad for the browser. record a melody, give it a new
instrument, and build a minute of sound. a tactile interface with a 3d enclosure,
an orange tempo dial, and room for another take.

`60 SEC` &nbsp; / &nbsp; `60–200 BPM` &nbsp; / &nbsp; `AUDIO → MIDI`

---

## 01 / power on

use Node.js 22.22.2+ within the 22.x release line, or 24.15.0+ within 24.x,
and npm. these versions satisfy the bundled development and test tools.

```sh
npm ci
npm run dev
```

open the local address printed in the terminal. allow microphone access when
recording. use localhost or HTTPS for microphone input.

## 02 / make something

1. **set the pace.** drag the orange dial or move the tempo slider.
2. **record.** select a track, press **Record**, and sing or play a phrase.
   press **Stop recording** when finished. headphones keep the metronome out of your take.
3. **change the voice.** click the instrument button to cycle through sounds.
   piano, guitar, electric guitar, and saxophone turn the detected melody into
   sampled notes. the octave button shifts their register.
4. **add a layer.** use **Create track** for another take, or **Upload tracks**
   for existing audio. select, mute, duplicate, and delete tracks from the bank.
5. **listen.** press **Play** to hear the arrangement loop from the beginning.
6. **take the notes with you.** **Export MIDI** downloads `S-251X.mid` from
   unmuted instrument tracks. vocal and drum audio are excluded.

recording starts at the beginning and overwrites the recorded portion of the
selected track. use a new track to keep an earlier take.

## 03 / specifications

| component | detail |
| :--- | :--- |
| transport | 60-second loop · waveform display · seek control |
| tempo | 60–200 bpm · metronome · default 120 bpm |
| input | microphone or browser-supported audio files |
| import | one track per file · audio trimmed to 60 seconds |
| voices | mic · guitar · electric guitar · piano · sax · drum |
| conversion | melody detection · beat-aligned notes · octave shift −2 to +2 |
| output | browser audio playback · MIDI file export |
| memory | automatic project save in this browser via IndexedDB |
| construction | React · Vite · Three.js · Web Audio · Pitchy · Smplr |

mic and drum play the original audio. instrument conversion follows a single
melody; a clear solo phrase gives it the best material to work with.

## 04 / local memory

recordings and melody processing stay in your browser. sampled instruments
download their sounds during preparation, so allow an internet connection for
sample loading. see [instrument samples and credits](AUDIO_SOURCES.md).

the current project returns when you reopen the same site in the same browser.
clearing site data removes it. MIDI exports contain notes, not recordings or a
complete project backup.

## 05 / workshop

| command | function |
| :--- | :--- |
| `npm run dev` | start the development server |
| `npm test` | run the Node.js test suite |
| `npm run build` | produce the static app in `dist/` |
| `npm run preview` | preview the production build locally |

the app runs in the browser without an application backend. serve `dist/` over
HTTPS when deploying.

---

design reference: [teenage engineering / OP–1 field](https://teenage.engineering/products/op-1).
independent project; not affiliated with teenage engineering.
