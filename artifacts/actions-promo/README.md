# MANDEVYR — A move on your terms

A 40-second, 16:9 motion promo for the new Actions workspace.

## Watch

Open `index.html` directly, keeping `assets/` beside it. Or use the existing local preview:

http://127.0.0.1:5183/artifacts/actions-promo/index.html

The film tries to start with sound automatically. If the browser blocks audio, click the film once. Space pauses/resumes; R restarts. The film loops. Add `?debug=1` for review controls, or `?clean=1&t=17.9` for a silent frozen frame. No visible player is shown in the normal film.

## What is shown

- Three curated Morpho vaults on Arc Mainnet.
- Selecting Gauntlet EURC Prime and composing 10 EURC.
- The captured contract identity result at Arc block 24,237,559.
- Switching to Withdraw and explaining wallet control.
- Original MANDEVYR assets and an actual screenshot of the Actions workspace.

The animated UI is reconstructed from the real app for legibility and camera movement. The underlying selection, input, evidence, and withdrawal-tab interactions were exercised in the real local browser. Wallet actions remain paused. No funded balance, wallet prompt, receipt, return, or completed trade is fabricated. The film displays “Product preview · No funds sent.”

## Audio

English female narration by Pepper, generated with ElevenLabs Multilingual v2. Three takes completed; the fourth was rejected by the provider's account restriction. The first successful take is used. There was no generation retry. Original procedural music and UI sound effects were composed locally, without further credits.

`assets/voiceover-pepper.mp3` is the unmodified narration. `assets/soundtrack.mp3` is the final 40-second stereo mix. Narration starts at 0.8 seconds. The mix has no clipped samples in the FFmpeg volume check (peak −4.7 dB).

## Sources and editing

- `film.html`: readable animation source, based on Bang Motion's MIT starter camera/timeline/typography architecture.
- `build.mjs`: embeds the installed GSAP bundle into the standalone `index.html`.
- `sound-design.mjs`: deterministic original sound bed generator.
- `vo-script.md`: full narration.
- `creative-brief.md`: approved concept, style, and production notes.
- `assets/mainnet-evidence.json`: original mainnet API observation.
- `review/`: visual checks at key times.

Run `node artifacts/actions-promo/build.mjs` from the repository to rebuild after editing `film.html`. Viewing the finished `index.html` never requires this step. The file exposes `window.OPENER` with `seek`, `seekFrame`, `DURATION`, `W`, `H`, and `ready` for deterministic MP4 export.

Structural fingerprint: UI journey · five connected beats · Actions control → vault choice → EURC composer/evidence → wallet control → product/brand pullback. No section-based slide sequence; one persistent product world, directional text motion, moving illumination, and an original soundtrack.

## Verification

Nine key compositions were checked in the local browser, including EURC selection, the amount field, evidence, withdrawal, wallet-control copy, and the closing reveal. Overlapping copy was corrected. Audio playback and looping were observed; the displayed timeline and audio clock were within 0.05 seconds in the sampled playback check. Browser verification used HTTP, because the in-app browser does not allow file-scheme navigation; direct double-click playback is designed into the package but was not exercised by that browser. MP4 export completed: ../mandevyr-actions-promo.mp4 (1920 x 1080, 60 fps, 40 seconds, H.264 video, AAC stereo audio, 171,661,229 bytes). FFprobe confirmed 2,400 frames and matching 40-second audio/video streams. A full FFmpeg decode completed without errors; encoded wallet-control and closing frames were visually checked. Export details and review stills are in export-review/.
