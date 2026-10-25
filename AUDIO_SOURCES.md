# Instrument samples

Guitar uses the FluidR3 GM `acoustic_guitar_steel` soundfont, Electric Guitar uses
`electric_guitar_clean`, distributed by
[Benjamin Gleitzman's MIDI.js Soundfonts project](https://github.com/gleitz/midi-js-soundfonts).
That project identifies the Fluid samples as [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
The app decodes the recorded notes and transposes, envelopes, and normalizes them when rendering.

Piano uses the Splendid Grand Piano instrument in [Smplr](https://github.com/danigb/smplr).
These instruments download their samples during preparation and render locally; recordings are not uploaded.
