# Mobile controls

Phones and tablets automatically use touch controls. Desktop and Quest keep their existing controls. `?touch=1` and `?touch=0` override detection for development; testing with a mouse alone does not generate touch input.

Drag the left side to move with an analog floating stick. Drag the right side to look. FIRE/SWEEP also steers while held, so two thumbs can move, aim and attack together.

| Role | Actions |
| --- | --- |
| Defender | Hold THRUST or DOWN to change height. Tap SOAR to toggle flight. Tap DODGE. Hold BREACH until RELEASE appears, then lift the finger to fire. |
| Colossus | Hold SWEEP to attack while aiming, SLAM to hit the ground, or MISSILE to launch rockets. |
| Spectator free camera | Hold UP/DOWN to change height. Pull the movement stick fully for faster flight. LIVE VIEWS returns to the video panel. |

MENU opens the pause panel and camera switch. Portrait and landscape are supported, including safe areas around notches and the home indicator. Rotating, switching apps, pausing, leaving, dying and round completion release active touches and latched soar. Breach uses the same charge duration and cooldown as desktop; cooldown and fuel availability appear on the ability buttons.

The MOBILE rendering tier targets 30 FPS, starts at 0.55 pixel ratio and caps the drawing buffer at 190,000 pixels even on large tablets. Sustained slow frames reduce resolution further, down to 0.3 pixel ratio (or the pixel cap on exceptionally large screens). UI and touch targets stay at native CSS resolution. Buildings fade between 35 and 70 m instead of 110–150 m, with at most 9 surrounding streamed blocks instead of 49. Mobile uses flat materials, 128 px facade textures, no decorative architectural kit, simple rooftop shapes matching collision bounds, no reflection environment, and roughly 40 cosmetic debris pieces. Shadows, bloom and antialiasing stay disabled even with saved cinematic settings. The 1K cloud sky, real world-space shockwaves, camera zoom/shake, building destruction and gameplay collision remain available. Spectators can still watch a mobile player's main framebuffer at a target 12 captures per second; no extra player-view render is needed. Camera FOV and world-space effects remain available, while the full-screen speed-line canvas is disabled on mobile.

`node scripts/mobile-quality-smoke.mjs` checks rendering budgets, slow-frame adaptation, rooftop attachment/fracture behavior and graphics errors in phone emulation; reports go to `artifacts/mobile-quality/`. `node --test tests/mobile-rendering.test.js` checks frame pacing at several display refresh rates and under stalls.

`npm run test:mobile` starts a separate server and runs Chromium multi-touch checks for all roles, charging/cooldowns, cancellation, menus, portrait/landscape/tablet layouts and live video. Reports and screenshots go to `artifacts/mobile/`. `npm run test:browser` covers desktop and emulated Quest regressions. These checks do not replace physical Safari/Android usability and frame-rate testing.

Imported from `ui/attack-on-titan` at `ece3517fc0707931a4e0d844852f20d5db5dbe97`, with pointer ownership, cancellation, charge parity and responsive layout refinements.
