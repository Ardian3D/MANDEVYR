# MANDEVYR logo sculpture

`mandevyr-logo.blend` is the editable Blender 5.2 source. Three separate solid meshes trace the supplied `public/logo-remove-bg.png`: graphite wing, mint wing and central diamond. The source PNG is packed inside the Blend file. Each solid has 0.27-unit depth and a 0.018-unit bevel. No image texture or external HDR download is needed at runtime.

Rebuild from the repository root:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python assets/3d/create_logo.py
```

This saves the Blend source and exports `public/models/mandevyr-logo.glb` (about 33 KB). The web component `src/p0/LogoSculpture.tsx` loads the GLB and Three.js dynamically. It renders on demand when loaded, resized, dragged, reset or controlled with arrow keys. No perpetual render loop runs while idle. Pixel ratio is capped at 1.75.

Mouse drag rotates horizontally and tilts vertically; touch drag rotates horizontally while preserving vertical page scrolling. Arrow keys rotate; Home and the reset button restore the initial angled pose. Reduced-motion preference removes interpolation. A static logo is shown during loading, on load failure, or when WebGL is unavailable/lost.
