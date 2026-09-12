# Colossus City — cinematic production kit

A 54-second, ten-shot in-engine demo with a 1920 × 1080 / 24 fps master, a 2.39:1 picture aperture, original stereo score, synchronized sound design, and branded titles.

The newer **action trailer** is a text-free 38.5-second edit with 22 shots, a 160 BPM original score and synchronized combat Foley. It includes active blocking and counterattacks, two airborne punches, a native ragdoll fall, a low sweep dodge, an eight-missile pursuit, a tower swat, a pincer attack and reactor destruction. Cuts average 1.75 seconds; the longer missile sequence changes camera angle twice while keeping its chase clock continuous.

The action choreography deliberately goes beyond game mechanics, as requested: pilot flight and missile pursuit use authored curves, missiles catch up and overshoot at individually timed near misses, the robot tracks targets and uses directed poses, and pilots are enlarged 25% for readability. The first punch drives the native 11-part physics ragdoll; the uppercut rotates that recorded motion into an upward launch. Missile strikes remove nearby native facade skins and add native rubble. None of these staging changes enter gameplay code.

To reproduce the action version:

```sh
node cinematics/replay.mjs
node cinematics/punch-replay.mjs
node cinematics/capture.mjs --action
python3 cinematics/action-score.py
python3 cinematics/film_review.py --action
node cinematics/finish.mjs --action
```

Output: `artifacts/cinematic-demo/action/COLOSSUS-CITY-Action-Trailer-1080p.mp4` (924 frames). `action-scenes.js` owns choreography, `action-timeline.json` owns the edit, and `action-score.py` owns the new soundtrack. Add `--shot=sky_punch` to capture one revised shot, or `--stills` to check compositions. The interactive preview accepts `?edit=action&play=1&width=1280`.

Everything authored for the film is in this folder. The production kit imports the existing game modules and assets; the game never imports this kit. It neither launches a game server nor connects to a live room. No gameplay source, dependencies, package scripts, or saved matches are changed by the tools.

The film is a **staged cinematic demonstration**, not an unedited multiplayer session. The city, mech, pilots, materials, missiles, weapons, fracture rendering and reactor breakup come from the game. Camera and character choreography, light balance, fixed city residency, the editorial clock and titles belong to the director. Breaching uses recorded authoritative flight inputs; the tower fall uses the real server destruction system and Rapier, with a staged angular impulse and secondary fracture trigger. The city resets between those takes. Four pilots appear in the squad attack; the end card states the game's supported maximum of eight.

## Run

From the repository root, with its existing Node / Playwright installation, Chromium cache, FFmpeg, Python, NumPy and SciPy available:

```sh
node cinematics/replay.mjs
node cinematics/capture.mjs --stills
node cinematics/capture.mjs
python3 cinematics/score.py
node cinematics/finish.mjs
```

Output: `artifacts/cinematic-demo/COLOSSUS-CITY-Cinematic-Demo-1080p.mp4`.

For the version without any on-screen text or title graphics, run `node cinematics/capture.mjs --no-text` followed by `node cinematics/finish.mjs --no-text`. This preserves the full camera edit and soundtrack, leaving the closing city shot visible. The export is `artifacts/cinematic-demo/no-text/COLOSSUS-CITY-No-Text-1080p.mp4`. Add `&text=0` to the interactive preview URL for the same treatment.

The loopback HTTP listener and Chromium may need the host's local-app permission. `capture.mjs` closes both after each run. Rendering is offline: every output frame advances an exact 1/24 second, regardless of machine speed. The scene is supersampled at 1.5× delivery resolution before composition. The same per-shot random seed controls native particles. Each shot is independently encoded, so individual revisions can be rendered with `--shot=breach` (or another ID) and assembled again with `finish.mjs`. `--width=1280` makes a smaller draft; final assembly validates 1080p.

For an interactive local preview, run `node cinematics/serve.mjs`, then open `http://127.0.0.1:8096/?play=1&width=1280`. Preview playback performance depends on the GPU; the exported film does not. In the preview console, `await director.frame(24)` seeks to a time, `director.shots` lists the edit, and `director.diagnostics()` checks assets and WebGL. Seeking rebuilds transient effects from the beginning of the destination shot.

## Edit

| Time | Shot | Camera and action |
| --- | --- | --- |
| 00–06 | City | Eased aerial approach to native Midtown landmarks |
| 06–12 | Giant | Low orbit and raised fist establish scale |
| 12–16 | Pilot | Close tracking view; hover transitions into soar |
| 16–22 | Flight | Shoulder chase down a city avenue with a wingmate |
| 22–28 | Breach | Five-times slow-motion replay through an actual broken wall |
| 28–32 | Missile | Moving pilot, three approaching missiles and near misses |
| 32–37 | Collapse | Giant swat and physics-driven tower fall |
| 37–40 | Attack | Four raiders converge on the core; final heavy impact |
| 40–47 | Death | Orbiting camera follows the game's staged reactor breakup |
| 47–54 | Title | City-backed title, platform pairing, fade to black |

`director.js` owns the camera helper, shot list, replay adapter, composition and title treatment. All captions use the same safe area and lime/ivory palette as the game's identity. Motion remains legible through hard cuts; slowdown is concentrated on the breach and breakup. The original soundtrack is synthesized by `score.py`, with separate `music.wav` and `sound-design.wav` stems. `finish.mjs` targets −16 LUFS integrated and −1.5 dBTP, encodes stereo AAC, enables fast start, decodes the entire result and verifies resolution, 1,296 frames, audio presence and duration.

The generated `capture-report.json` records missing-asset/browser/WebGL errors. `master-report.json` records export and loudness checks. Native screenshot previews are saved as `still-*.png`. The individual shots, lossless audio stems, physics replays and edit list remain beside the final master for future revisions.
