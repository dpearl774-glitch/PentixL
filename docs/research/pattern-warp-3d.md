# Pattern fills, text warp and real 3D — research and implementation spec

Researched 2026-11-07 against SVG 2, three.js docs, Adobe/Illustrator docs and practitioner write-ups.
This document records what is wrong today, what the correct model is, and the order to build it in.

---

## 1. Pattern fills

### 1.1 Why the current pattern fill feels useless

SVG's pattern model is a **reference rectangle repeated at integer multiples** of its width and
height in both axes ([SVG 2 §14.3](https://www.w3.org/TR/SVG2/pservers.html)). Everything that reads
as "broken pattern" is one of the following six documented traps:

| Symptom | Cause | Fix |
|---|---|---|
| Motif cut off at tile edges; visible grid lines | The UA stylesheet forces `overflow:hidden` on `<pattern>`; anything crossing the tile edge is clipped. `overflow:visible` is undefined behaviour. | Duplicate edge art: every element crossing an edge is re-cloned on the opposite edge at the same offset ± width/height; corners need all four copies. |
| Pattern stretches/skews with the object | `patternUnits` defaults to `objectBoundingBox`, and `patternTransform` is post-multiplied onto the bbox→user transform, so a rotation becomes a shear. | Emit `patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse"` and put origin, rotation and scale into one `patternTransform="translate(ox,oy) rotate(θ) scale(s)"` (translate first, or rotations orbit the origin). |
| Tile art at the wrong size | `patternContentUnits` defaults to `userSpaceOnUse` while `patternUnits` is `objectBoundingBox`; `viewBox` also silently overrides content units and rescales/centres the motif. | Author tile content in tile units; do not mix unit systems; avoid `viewBox` inside the tile. |
| Motif unrelated to the shape, "off by half a tile" | With `userSpaceOnUse`, tiles phase-lock to the canvas origin, not to the object. Illustrator users report the same thing; Adobe's answer is the *Transform Pattern Tiles* preference. | Two explicit alignment modes: **canvas-anchored** (seamless across neighbouring objects) and **object-anchored** (`ox, oy` from the object's bbox). Default to object-anchored, which is what people expect from a fill. |
| Brick/hex looks like a plain grid with gaps | Stagger has to be encoded **inside** a rectangular repeat cell. A single motif cannot express a staggered lattice. | Brick: cell is `w × 2h` with copy B at `(offset·w, h)`. Hex: cell is `3R × √3R` with two hexes (row stride `√3R`, column stride `1.5R`). |
| "Spacing" makes the art shrink or overlap | Moving tiles apart changes their relative positions but not the cell, so the background bleeds through and neighbours clip the art. | Keep the motif fixed and **pad the cell**: `tileW = artW + gapX`, `tileH = artH + gapY`, `artOffset = (gap/2)`. Illustrator separates Width/Height (the box) from H/V Spacing for exactly this reason. |

Two more constraints worth designing around:

- **Overlap is impossible inside one `<pattern>`.** Illustrator can overlap tiles because it has an
  `Overlap` control and draws copies in order; SVG clips. To support overlap, either layer two
  patterns with different phases, or emit an explicit `<use>` grid inside a clip.
- **Zoom:** never mutate pattern geometry on zoom, only the viewport transform. Hairline seams at
  fractional zoom come from tiles being rasterised independently; snapping the *phase* at paint time
  (and a ≤1 unit overlap) removes them.

### 1.2 Target model

```
PatternFill {
  source: tile art (paths, kept live — Figma's source-node model)
  tileType: grid | brick-row | brick-column | hex-row | hex-column
  cell: { w, h }            // derived from art bounds + spacing, not typed by hand
  spacing: { x, y }         // padding, not tile displacement
  offset: { x, y }          // brick offset / manual phase
  transform: { rotation, scale }
  anchor: 'object' | 'canvas'
}
```

Render: one `<pattern>` with `userSpaceOnUse`, cell-sized, motif padded and edge-duplicated, plus
`patternTransform` carrying translate → rotate → scale. Keep a raster thumbnail for the panel swatch
only (Illustrator and Figma both use a hybrid: vector tile for the document, bitmap for the preview).

### 1.3 Build order for patterns

1. Pad the cell instead of moving tiles; duplicate edge and corner art (kills seams and clipped motifs).
2. Correct repeat cells for brick and hex (2-copy cell, not a shifted single tile).
3. Object-anchored origin by default, with a canvas-anchored toggle.
4. Spacing semantics matching Illustrator (box vs gap as separate controls).
5. Overlap as an explicit second layer, not a hidden property.
6. Swatch preview re-rendered from the same tile so what you see in the panel is the fill.

---

## 2. Text warp and the 80 px cap

### 2.1 The cap is arbitrary, not geometric

The 80 px limit is a UI clamp in the panel, not a limit of the maths. The real limits are geometric:

- **Rigid glyph placement** (what we do now — each letter rotated onto the bent baseline) starts to
  collide when `h/R ≳ 0.3`, where `h` is the glyph extent on the concave side and `R` the radius of
  curvature. That is why big bends "pile up" instead of looking like a warp.
- **True outline deformation** folds at `R ≤ h`, because the inner edge is an offset curve and offsets
  self-intersect past the local radius. Keep `R ≥ 1.5–2h` for safety.
- In bend-angle terms, with text width `W` bent through `θ`, `θ_max ≈ W/h`. A word four cap-heights
  wide can bend about half a circle before folding; that is why short display words take dramatic
  arcs and paragraphs do not.

So the cap can go far beyond 80 once the geometry is right; the honest UI is a fold indicator
(turn the preview red where `det J ≤ 0`) instead of a hard stop.

### 2.2 What browsers will and won't do

`textPath` `method="align"` is spec-defined as per-glyph matrices **with no stretching** — it cannot
bend glyphs. `method="stretch"` is the only spec'd warping mode and is effectively unimplemented
everywhere, so it cannot be relied on. Text past the end of the path is simply not rendered.

Consequence for Pentix: keep the string as the source of truth and treat outlines as a cache.
Per-glyph placement is fine for small bends and stays editable; real warping needs glyph outlines
(de Casteljau subdivision until the chord error is under ~0.25 px, then map every on-curve and control
point through the deformation, applying the Jacobian to tangents). That is the Illustrator envelope
model, and it is also how "Typewrap"-class Figma plugins behave: model updates on every keystroke,
render cache rebuilt, never baked.

### 2.3 Plan

1. Remove the 80 clamp; scale the slider range with the string's width and size.
2. Add a fold test per glyph: `det J > 0` at sample points; tint the preview where it would fold.
3. Keep per-glyph rotation for cheap live feedback while typing.
4. Add envelope warping of outlines for the committed look — arc-length + normal offset first
   (cheap, handles θ up to `W/h`), mesh/bilinear later if arbitrary envelopes are needed.
5. Keep `text`, font, size and tracking editable after warping; only the render cache changes.

---

## 3. Real 3D

### 3.1 What "actual 3D" requires

Real 3D needs geometry with side walls, a perspective camera, lighting that responds to surface
normals, and a depth buffer. The current bent extrusion has none of these — it offsets stacked copies,
so sides never catch light, bevels cannot highlight, and objects never occlude themselves.

### 3.2 Recommended architecture

Keep the 2D document as the source of truth and add a WebGL preview mode:

- **three.js + React Three Fiber**, lazily loaded only when 3D opens.
- Convert paths to `THREE.Shape` (with holes and correct winding) → `ExtrudeGeometry` with
  `depth`, `bevelEnabled`, `bevelSize`, `bevelThickness`, `bevelSegments`, `curveSegments`, `steps`.
- Material array so caps and sides can differ; `MeshStandardMaterial` plus one directional light and
  a hemisphere/ambient fill; `PerspectiveCamera` 35–50° FOV; `OrbitControls`.
- Cache geometry by `hash(paths) + hash(effect3d) + qualityTier`; low-quality geometry while dragging
  a slider, full quality on release.
- Mobile budget: `dpr` capped at `[1, 1.5]`, `frameloop="demand"`, shadows off by default,
  `bevelSegments` 1–2, `curveSegments` 6–8, pause rendering when the panel is hidden.

### 3.3 Export reality

SVG cannot carry a lit 3D scene. Illustrator itself exports 3D as GLTF/USDA/USDZ/OBJ and rasterises
ray-traced output. So:

- **SVG export** → the original 2D artwork (unchanged).
- **PNG export** → the exact 3D view.
- **GLB export** → the real 3D asset.
- Optional "bake to SVG" → project visible faces, flat/gradient shading, explicit warning that
  lighting and textures are approximated.

Keep the existing bent extrusion as a "stylised depth" preset. Do not silently replace it.

### 3.4 Build order for 3D

1. 3D preview mode: one selected layer, ExtrudeGeometry, one material, one light, orbit, no shadows.
2. Bevel and material controls, environment map, picking that writes back to the 2D selection.
3. PNG + GLB export, mobile quality tiers, offscreen pause.
4. Optional SVG baking.

---

## Sources

- SVG patterns: [SVG 2 §14.3](https://www.w3.org/TR/SVG2/pservers.html), [MDN pattern](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/pattern)
- Illustrator pattern options: [Adobe — Edit patterns](https://helpx.adobe.com/illustrator/desktop/paint-and-fill/create-and-edit-patterns/edit-patterns.html)
- Figma pattern fills: [Figma Learn](https://help.figma.com/hc/en-us/articles/31616030150167-Use-patterns-as-a-fill-or-stroke), [Paint API](https://developers.figma.com/docs/plugins/api/Paint/)
- Hex tiling maths: [SVG Backgrounds pattern guide](https://www.svgbackgrounds.com/svg-pattern-guide), [domphy hexagonPattern](https://domphy.com/docs/blocks/hexagonPattern)
- Text on a path: [SVG 2 text §11.8](https://www.w3.org/TR/SVG2/text.html), [caniuse method=stretch](https://caniuse.com/mdn-svg_elements_textpath_method_stretch)
- Offset-curve fold criterion: [MIT Hyperbook §11.2.2](https://web.mit.edu/hyperbook/Patrikalakis-Maekawa-Cho/node220.html)
- Bezier subdivision: [Drexel CS536 notes](https://www.cs.drexel.edu/~deb39/Classes/CS536/Lectures/L-03_BezierDrawing.6.pdf)
- Envelope workflow: [Adobe — curved text](https://www.adobe.com/learn/illustrator/web/curved-text), [Edit envelopes](https://helpx.adobe.com/illustrator/desktop/manage-objects/reshape-transform-objects/edit-the-contents-of-envelopes.html)
- three.js: [ExtrudeGeometry](https://threejs.org/docs/pages/ExtrudeGeometry.html), [SVGLoader](https://threejs.org/docs/pages/SVGLoader.html), [SVGRenderer](https://threejs.org/docs/pages/SVGRenderer.html), [CSS3DRenderer](https://threejs.org/docs/pages/CSS3DRenderer.html)
- R3F performance: [Scaling performance](https://r3f.docs.pmnd.rs/next/advanced/scaling-performance), [Canvas](https://r3f.docs.pmnd.rs/next/api/canvas)
- Illustrator 3D export: [Export 3D artwork](https://helpx.adobe.com/illustrator/desktop/special-effects-styles/create-3d-graphics/export-3d-vector-artwork.html), [3D and Materials panel](https://helpx.adobe.com/illustrator/desktop/special-effects-styles/create-3d-graphics/3d-materials-panel-options.html)
- Spline extrusion: [Extruding 2D objects](https://docs.spline.design/designing-in-3-d/extruding-2d-objects-in-3-d)
