# Quest 2: launch and verify

This is a browser WebXR game. Open it in **Meta Quest Browser**; there is no Android APK to sideload. Dependencies, test tools, Chromium and Android Platform Tools are installed locally on this Mac.

## Play locally over USB

1. Enable **Developer Mode** for the Quest in the Meta Horizon app. Connect the headset to this Mac with a USB data cable. Put on the headset and accept **USB debugging** for this computer.
2. In the project folder, run `npm start` and keep it running.
3. In a second terminal in the same folder, run `npm run quest:usb`. It checks for a Quest and forwards the headset's port 8080 to this Mac. `npm run quest:check` only checks the connection.
4. In **Meta Quest Browser**, open **http://localhost:8080**. Choose **Colossus → Enter Practice → Continue → Enter VR**, then accept the VR permission.
5. Hold both Touch controllers. Left stick moves; right stick turns smoothly; **A** calibrates your standing height. Move your hands to strike; aim a controller and pull its trigger to launch missiles. Default reach is 0.5 physical metres → 7 city metres.
6. For multiplayer, create a room as Colossus instead of practice. On this Mac open **http://localhost:8080**, select Raider and join that room code. Other laptops can use the Mac's LAN address on the same Wi-Fi. Everyone must reach this same running server.

Keep the cable attached during this local test. For untethered play use a trusted HTTPS deployment as described in the README. Plain `http://192.168…` on the headset does not provide a secure WebXR origin; forwarded `localhost` does. This setup follows [Meta's official USB/browser workflow](https://developers.meta.com/horizon/documentation/web/browser-remote-debugging/).

If no device appears, check Developer Mode, the cable and the headset's USB debugging prompt. `unauthorized` means approval is still needed inside the headset. The helper prints the command for removing its USB port forwarding afterward. The installed tool is `.tools/platform-tools/adb`; fresh machines can obtain it from [Google](https://developer.android.com/tools/releases/platform-tools).

## What passed locally

- 87 automated Node tests, including real server physics and multiplayer.
- Real Chromium rendering, mouse capture and keyboard movement with the downloaded visual upgrade.
- Focused Quest rendering regression: arms and fists stay aligned in headset space through a complete joystick turn, including tilted head/wrists and an offset standing position. The giant’s own decorative reactor halo is hidden in its view and its spectator mirror.
- All 59 bundled asset files pass hash verification. Downloaded roof equipment follows real Rapier collapse, removal and reset; smoke/impact sprites render without errors.
- Dense-city emulated stereo smoke: about 1.89 million submitted triangles across both eyes. This is a renderer count, not a physical headset frame-time measurement. The city includes distance-based component detail and a shared building-name atlas.
- Meta IWER's Quest 2 profile: stereo VR, Touch mapping, movement, proportional smooth turns, giant reach, missile triggers, calibration, controller loss/recovery, suspension, recentering and repeated entry/exit.
- Eight-player server collapse benchmark: 8.01 ms p95, with a 28.96 ms maximum spike on this Mac. The worst collapse tick exceeds the 16.67 ms budget; this does not measure headset rendering.
- The same armored pilot renders as a skinned ragdoll in emulated Quest stereo; real Rapier poses, late joining and removal pass the dedicated browser check.
- Real hold-Shift soaring, release/focus-loss return to hover, and directional dodge controls and a live spectator panel with two raiders and the headset view. Opening and closing the panel starts and stops player capture.
- Dependency audit from the dependency installation: zero reported vulnerabilities.

The startup physics import, VR cleanup, menu layering, tracking-loss handling and recenter contact behavior were repaired. VR always disables shadow rendering, uses the tier framebuffer scale (0.8 on Quest) and foveation settings, and requests 72 Hz when supported. The VR HUD now shows observed frame callbacks per second alongside the requested refresh rate and network ping.

## Physical headset acceptance — still required

No headset was detected during this validation. Emulated 72 Hz is a requested setting, not a measurement of physical Quest 2 performance.

- Enter and exit VR three times. Confirm both eyes render, height/scale feel correct, hands match their controllers and menus remain accessible after exit.
- Test each stick, A calibration and head rotation. Compare a measured 0.5 m hand movement with the reach shown on the headset HUD. Hold the right stick at partial and full deflection and check continuous turning at both speeds. Recenter and recover controller tracking without an unintended strike or movement.
- Fire each controller’s missiles at buildings and raiders; check gentle forward homing, cover blocking guidance, cooldown, explosions and damage.
- Open Live Views on a laptop. Compare the colossus preview against what you see, turn your head, and test controller motion while watched. Compare headset FPS with the panel open and closed.
- Walk into a building: it should stop the torso and chip only slightly. Hold a hand still against it: damage must stop. Punch the facade, then its exposed columns; confirm the wreckage persists and a late spectator sees it. Swing at a building and a raider. Confirm a laptop in the same room sees the same hand movement, destruction and ragdoll. Confirm haptics work if supported.
- Remove/re-wear the headset, open/close the system menu, and disconnect/rejoin the room. Confirm controls stop during tracking loss and resume correctly.
- Run one, four, then eight raiders through repeated collapses for at least 15 minutes. Record the VR HUD FPS/ping and inspect frame timing with [Chrome remote debugging](https://developers.meta.com/horizon/documentation/web/browser-remote-debugging/). Verify sustained performance and comfort; the Mac's CPU benchmark does not measure the headset GPU.

Raw reports and screenshots are in `artifacts/`; detailed boundaries are in [VALIDATION.md](VALIDATION.md).

## Repeat the software checks

```sh
npm ci
npm run test:all
npm run check
npm run assets -- --verify
npm run test:visual
npm run test:xr-view
npm run bench
HEADED=1 npm run test:browser
```

The browser test starts/stops its own test server and uses a separate browser profile. On a fresh Mac, download its browser first with `PLAYWRIGHT_BROWSERS_PATH=./.cache/ms-playwright npx playwright install chromium`. The visible mode allows real pointer capture; no mouse, network or physics mocks are used in the browser test. The smaller Node XR tests intentionally use fake XR frames for error-path regressions.
