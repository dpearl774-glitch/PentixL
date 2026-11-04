# Clipping masks, draw-inside, and 3D

## Current state

- Selected closed shapes now show their shared overlap as a live hatch.
- That overlap is computed from the same polygon geometry used by the shape
  builder, so the feedback matches the eventual Boolean result.
- Basic clipping masks are implemented: a top selected closed shape can clip
  the other selected shapes, and the mask can be released.
- Draw-inside is implemented: new artwork is clipped to one selected closed
  shape without consuming that shape.
- Depth extrusion is implemented as editable side walls. It is a 2.5D preview,
  not a separate 3D renderer.
- A full 3D camera, perspective, lighting and depth-sorted scene remain
  deferred.

## Clipping mask vs. draw-inside

These should share one clip model, not two separate implementations.

### Recommended model: non-destructive clip references

Add to `VectorPath` only when a clip is active:

```ts
clipPathId?: string;       // id of the path that acts as the mask
isClippingMask?: boolean;  // mask source: used for clipping, not painted
```

Rules:

1. The topmost selected closed path becomes the mask source.
2. Every other selected path gets `clipPathId` pointing at that source.
3. The source is marked `isClippingMask` and is not painted normally.
4. Selecting the clipped artwork highlights the visible clipped region, not the
   full untrimmed outline.
5. Releasing the mask clears both fields. The geometry is unchanged and the
   source becomes a normal object again.
6. A mask remains editable: double-tapping the clipped object enters a
   "mask edit" state that shows the source outline as an editing aid.

Rendering:

- One shared `<clipPath id="pentix-clip-…">` in `<defs>` per source.
- Clipped objects use `clipPath="url(#…)"`.
- Keep the clip path in world coordinates; moving a clipped object moves only
  the object, while moving the mask source changes the visible cut.
- Text and stroke rendering use the same clip wrapper.

Export:

- `generateSvgCode` emits the same `<clipPath>` definitions.
- The mask source is present in the exported `<defs>`, even though it is not
  painted.
- Selection exports pull referenced clip sources into the temporary export
  layer set, so selecting only the clipped child does not lose the cut.
- PNG export inherits clipping through the SVG rasteriser.
- Backups and `.pentix` imports preserve both fields. Dangling references are
  ignored on render; import repair is still pending.

Hit-testing:

- A clipped object is only selectable inside the clipped region.
- The mask source is selectable from the Layers panel, with **mask** and
  **clipped** badges identifying the relationship.
- Selection bounds, transform handles and selection-export crops use the visible
  clipped region, not the full hidden outline.

### Draw-inside mode

Draw-inside is the creation workflow on top of the same model:

1. Select a closed shape and choose **Draw inside**.
2. Pencil, brush, pen and text created while the mode is active receive the
   selected shape's `clipPathId`.
3. The mode persists across drawing tools so you can switch from pencil to pen
   or shapes. It ends with Escape, the strip’s exit chip, or removal of the
   source.
4. The source shape is not consumed. Multiple objects can share one mask.
5. The live pencil, brush, pen and shape preview is clipped before the object is
   committed.
6. Newly drawn open strokes remain open paths; clipping is a render operation,
   not a Boolean cut, so no geometry is destroyed.

This is preferable to intersecting every new stroke immediately. Immediate
intersection is destructive, loses the original stroke, and cannot be adjusted
later.

## Implementation phases

1. **Data and rendering** — complete. Clip sources, hidden/dangling fallbacks,
   clipped painting, live-preview clipping, SVG and thumbnail output are in
   place.
2. **Commands** — complete for Make mask and Release. Layers identifies mask
   sources and clipped children with badges.
3. **Draw-inside** — complete. New pencil, pen, brush, shape and text objects
   inherit the active clip.
4. **Hit-testing and editing** — clipped hit regions and visible bounds work.
   Dedicated mask-outline editing is still pending.
5. **Backups and compatibility** — clip fields survive backups. Missing sources
   use an empty clip so children stay hidden; cycles and self-references are
   normalized on open/import.
6. **Export bounds** — complete. Selection crops use visible clipped bounds and
   include extrusion side walls; selection exports retain referenced sources.
7. **Destructive tools** — Boolean and Shape Builder consume visible clipped
   geometry and produce unclipped results.
8. **Copy and paste** — copying a clipped object carries its source; duplicated
   layers remap clip IDs.
9. **Tests** — SVG/thumbnail clip definitions, hidden and dangling sources,
   selection-export clip sources, visible bounds, live-preview clipping,
   duplicate remapping and Boolean cleanup are covered. Interactive mask
   editing still needs a device pass.

## 3D: depth extrusion shipped, full scene deferred

`extrudeDepth` is now an object property. It produces side walls from the same
vector outline in the canvas, SVG export and thumbnails. This is intentionally a
2.5D preview: it gives an object depth without adding a second renderer.

Still deferred:

- A 3D camera, perspective and orbit controls.
- Real lighting, bevels and material surfaces.
- Depth sorting across multiple extruded objects sharing a scene.
- A WebGL/Three.js renderer and a dedicated 3D export format.

When a full scene is picked up, keep flat editing authoritative and treat 3D as
a derived view. Do not add Three.js or WebGL until extrusion, clipping
interactions and exports are stable and tested.
