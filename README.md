# Saeedau: Beyond the Dunes

A browser driving game set in Pakistan’s Thar Desert. Drive from Umerkot through Chhor, Jeelani Mor, Tebhri Bhanbhra, Dodhar and Pataho to Saeedau. This 9.6 km game route is condensed and fictionalized, not a navigation aid.

## Play locally

Requires Node.js 22 and a browser with WebGL 2. Install with `npm ci`, start with `npm run dev`, and open the address Vite displays. Use Garage to try the Long Chassis jeep, Kekro or Unique 70 motorcycle.

If an older Windows checkout reports that Application Control blocked Rollup, run `npm ci` again to install the current lockfile. Vite uses Rollup’s official WebAssembly package instead of the native Windows add-on; no Windows security settings need to change.

- WASD or arrow keys: accelerate, reverse and steer
- Space: handbrake; R: restart the route
- Drag and scroll: orbit and zoom; Escape: pause

Run `npm test` for driving tests and `npm run build` to produce a static site in `dist`.

The Long Chassis uses an original Blender GLB modeled from the supplied side-view photograph. To regenerate it with Blender 5.2, run `blender -b --factory-startup --python-exit-code 1 --python tools/build_jeep.py`. The road and scenery are procedural; Kekro and the Unique 70 still use their earlier prototype meshes. Real-world route and architecture verification remain future work.
