# Saeedau: Beyond the Dunes

A browser driving game set in Pakistan’s Thar Desert. Drive from Umerkot through Chhor, Jeelani Mor, Tebhri Bhanbhra, Dodhar, Pataho and Hingorao to Saeedau. The virtual route is condensed to 7 km for a short drive; it is not the approximately 110 km real-world journey described in the project brief or a navigation aid.

## Play locally

Requires Node.js 22 and a browser with WebGL 2. Install with `npm ci`, start with `npm run dev`, and open the address Vite displays. Use Garage to try the Long Chassis jeep, Kekro or Unique 70 motorcycle.

If an older Windows checkout reports that Application Control blocked Rollup, run `npm ci` again to install the current lockfile. Vite uses Rollup’s official WebAssembly package instead of the native Windows add-on; no Windows security settings need to change.

- WASD or arrow keys: accelerate, reverse and steer
- Space: handbrake; R: restart the route
- Drag and scroll: orbit and zoom; Escape: pause
- On touch devices, rotate to landscape or choose the portrait fallback. Hold **go** with a steering button to drive; reverse, handbrake, pause, and reset are available on screen.

Run `npm test` for driving tests and `npm run build` to produce a static site in `dist`.

For Cloudflare Workers Builds, set the build command to `npm run build`, the deploy command to `npx wrangler deploy`, and the root directory to `/`. Deploy a branch that contains `wrangler.jsonc`; it tells Wrangler to publish the built `dist` directory directly. The game does not need the Cloudflare Vite plugin or a Worker script.

**Thar Radio:** Expand the dashboard in the garage or while driving. My Music plays browser-compatible files from your device, without uploading them. Re-select your files after reloading. YouTube Radio uses the visible official player and stops when it is collapsed, hidden, or replaced by local music; individual tracks may not allow embedded playback. Use **M / P / N / B** to expand, play or pause, skip, and go back. Change these shortcuts and the four volume levels in Settings → Audio. Engine, wind, and tire sounds are synthesized, not field recordings. Run `node scripts/check-radio.mjs` with Microsoft Edge installed for the browser smoke test and screenshots.

The Long Chassis uses an original Blender GLB modeled from the supplied side-view photograph. To regenerate it with Blender 5.2, run `blender -b --factory-startup --python-exit-code 1 --python tools/build_jeep.py`. Kekro and the Unique 70 still use their earlier prototype meshes.

The Thar environment kits are generated with `blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_environment.py`. The game instances the resulting house, vegetation and roadside meshes inside its rolling terrain chunks. The layouts are fictionalized, not reconstructions of individual villages. The art is original; the supplied photos and the Commons [hamlet](https://commons.wikimedia.org/wiki/File:Desert_Hamlets_Tharparkar.jpg), [road](https://commons.wikimedia.org/wiki/File:Road_towards_THARPARKAR.jpg), and [plant references](https://commons.wikimedia.org/wiki/Category:Prosopis_cineraria) were used for visual study only.

With Microsoft Edge installed, run `node scripts/capture-thar.mjs` to generate the five browser screenshots in `artifacts` and smoke-test all three vehicles. The capture uses software WebGL for reproducibility, not GPU benchmarking.

`node scripts/check-world.mjs` captures the eight checkpoints and an open-desert stretch, and runs the driving model inside Edge. Its paved acceleration benchmark measures these in-game values:

| Vehicle | Top speed | 0–60 km/h | 60–100 km/h | 100–110 km/h |
| --- | ---: | ---: | ---: | ---: |
| Long Chassis | 126 km/h | 4.18 s | 4.20 s | 1.42 s |
| Kekro | 104.4 km/h | 6.72 s | 9.22 s | — |
| Unique 70 | 86.4 km/h | 5.16 s | — | — |

The scripted route simulation reached Saeedau in 7:17 at roughly 60 km/h, passing all checkpoints in order. This is simulation time, not a manually timed drive or a real-world travel estimate.
