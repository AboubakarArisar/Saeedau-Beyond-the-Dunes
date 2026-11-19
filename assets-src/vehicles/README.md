# Saeedau vehicle sources

`kekro.blend` and `unique70.blend` contain the editable vehicle meshes, materials, UVs, and wheel and steering hierarchies. The GLBs in `public/vehicles` use the same models in the garage, journey setup, and gameplay. Each vehicle uses four materials. Painted details use vertex colors, and the wheel geometry is shared across that vehicle's wheel instances.

## References

- Kekro proportions use photographs of the GMC-derived Thar utility conversions. The supplied Emmanuel Guddu photograph guided the split windshield, arched headboard and ornament. See the [Sindh Courier's front and side photographs](https://sindhcourier.com/khekhro-the-king-of-thar-desert/) and [Vikram Nankani's Islamkot photograph](https://commons.wikimedia.org/wiki/File:Kekra_unloading_construction_material_in_Tharparkar.jpg).
- The Unique 70 uses the supplied side view and the [D.S. Motors three-quarter photograph in its UD 70 advertisement](https://cache1.pakwheels.com/pdfs/PakWheels.Magazine.December.2006.pdf). The red enamel and original stripe graphics are the game's treatment. No photograph, third-party mesh, texture, or logo is included in either asset.

## Export and render

Run from the repository root with Blender 5.2. Replace the render directory with an output directory of your choice.

```powershell
blender -b --python-exit-code 1 -P tools/vehicle_models/build.py -- kekro --renders ./vehicle-renders
blender -b --python-exit-code 1 -P tools/vehicle_models/build.py -- unique70 --renders ./vehicle-renders
```

The generator validates ground contact, wheel count, and UV presence before exporting. Blender uses metres, +Y forward and +Z up. GLB converts these to -Z forward and +Y up. `Wheel_` nodes spin around local X. `Steer_` nodes turn around local Y in the game and carry the front wheels.
