# Saeedau: Beyond the Dunes

A browser driving game set in Pakistan’s Thar Desert. Drive from Umerkot through Chhor, Jeelani Mor, Tebhri Bhanbhra, Dodhar and Pataho to Saeedau. This 9.6 km game route is condensed and fictionalized, not a navigation aid.

## Play locally

Requires Node.js 22 and a browser with WebGL 2. Install with `npm ci`, start with `npm run dev`, and open the address Vite displays. Use Garage to try the Long Chassis jeep, Kekro or Unique 70 motorcycle.

- WASD or arrow keys: accelerate, reverse and steer
- Space: handbrake; R: restart the route
- Drag and scroll: orbit and zoom; Escape: pause

Run `npm test` for driving tests and `npm run build` to produce a static site in `dist`.

The current road, scenery and vehicles are original procedural Three.js meshes. Blender-authored vehicle replacements and real-world route verification are future work.
