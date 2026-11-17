# Saeedau: Beyond the Dunes

A browser driving game set in Pakistan’s Thar Desert. Drive from Umerkot through Chhor, Jeelani Mor, Tebhri Bhanbhra, Dodhar and Pataho to Saeedau. This 9.6 km game route is condensed and fictionalized, not a navigation aid.

## Play locally

Requires Node.js 22 and a browser with WebGL 2. Install with `npm ci`, start with `npm run dev`, and open the address Vite displays. Use Garage to try the Long Chassis jeep, Kekro or Unique 70 motorcycle.

If an older Windows checkout reports that Application Control blocked Rollup, run `npm ci` again to install the current lockfile. Vite uses Rollup’s official WebAssembly package instead of the native Windows add-on; no Windows security settings need to change.

- WASD or arrow keys: accelerate, reverse and steer
- Space: handbrake; R: restart the route
- Drag and scroll: orbit and zoom; Escape: pause

Run `npm test` for driving tests and `npm run build` to produce a static site in `dist`.

The Long Chassis uses an original Blender GLB modeled from the supplied side-view photograph. To regenerate it with Blender 5.2, run `blender -b --factory-startup --python-exit-code 1 --python tools/build_jeep.py`. Kekro and the Unique 70 still use their earlier prototype meshes.

The Thar environment kits are generated with `blender -b --factory-startup --python-exit-code 1 --python scripts/blender/build_environment.py`. The game instances the resulting house, vegetation and roadside meshes inside its rolling terrain chunks. The layouts are fictionalized, not reconstructions of individual villages. The art is original; the supplied photos and the Commons [hamlet](https://commons.wikimedia.org/wiki/File:Desert_Hamlets_Tharparkar.jpg), [road](https://commons.wikimedia.org/wiki/File:Road_towards_THARPARKAR.jpg), and [plant references](https://commons.wikimedia.org/wiki/Category:Prosopis_cineraria) were used for visual study only.

With Microsoft Edge installed, run `node scripts/capture-thar.mjs` to generate the five browser screenshots in `artifacts` and smoke-test all three vehicles. The capture uses software WebGL for reproducibility, not GPU benchmarking.
