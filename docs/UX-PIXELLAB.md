# What PixelLab gets right — and what it means for Pentix

Sources: Quest DigiTech's PixelLab course (interface, text tool, layer panel —
November 2026), the official Google Play feature list, and the App Store release
notes for the iOS port (v1.0.123–1.0.128). Links at the end. Anything below that
is not from those sources is marked as *my read*.

The point of this study is not to redraw Pentix in PixelLab's clothes. It is to
copy the parts that make PixelLab predictable for a mobile editor, then keep the
things Pentix already does better than it — which, on the object model, is most
of them.

## 1. How PixelLab is put together

**Two places, split by job.** The *Text Editor* changes what the words say; the
*Text tab* changes how they look. Tapping a text layer turns the bottom bar into
text tools, which you scroll sideways. With nothing selected, the bar shows only
`+ Add text` and `Quotes` — the tools appear when they are relevant and disappear
when they are not.

**One text layer is one object, always.** Everything — stroke, shadow, 3D,
curve, gradient — is a property of that layer. You never convert text to get an
effect, and you can retype the words with every effect intact. Ranges inside the
editor can be restyled per word (colour, font), which is how one layer holds a
two-colour headline.

**Numeric next to gesture.** Every transform has a hand control and a typed
value: Position in pixels, Size in px, Rotate in degrees, Padding, letter/word/
line spacing. The handle is for feel; the field is for finish.

**The layer panel is a flat, sorted list with a Select mode.** Rows restack by
drag, have an eye, a padlock and a context edit menu. A checkbox mode (`☑`) turns
every row selectable, and the ticked set can be moved together, locked, deleted
or **merged**. There are no folders and no groups — grouping *is* multi-select,
and staying grouped *is* merging.

**Merge is permanent and raster.** That is honest about its trade (one shadow for
the whole badge, a lighter file, untouchable geometry afterwards) and the guides
say so plainly: save a copy, undo is the only unmerge.

**Locked and hidden layers let taps pass through** (iOS 1.0.123+), which is what
makes locking useful on a phone where a stray thumb is the main hazard.

## 2. The five patterns worth taking

### 2.1 A Select mode in the object list (FB-06)
PixelLab's answer to "pick several things" is a mode you switch on, not a
long-press grammar. Checkboxes appear, everything is addressable, and move /
lock / delete / merge act on the ticked set.

Pentix today: single-row selection in the Objects panel; the canvas has a
marquee, the panel does not. *My read:* the checkbox mode is the single highest
value-per-line change in this whole list, because it also unlocks FB-07 (group)
and FB-08 (merge) with no new mental model.

### 2.2 Non-destructive group, with merge as the final step (FB-07, FB-08)
PixelLab users learn a real distinction: multi-select to *move together*,
merge to *make one thing*. Pentix already has the better half — `isGroup` layers
that stay editable and vector. So the lesson is to expose the pair honestly:
**Group** for "keep these together and still editable", **Merge/Unite** for "this
is final". Never merge into a raster image the way PixelLab does; Pentix can
merge into one path and keep the geometry.

### 2.3 A persistent, named panel per job (FB-15)
PixelLab's tools are grouped into categories that open a focused panel and stay
put. Pentix's options strip re-arranges itself around whatever is selected, which
is efficient once learned and unnavigable when new — the tester said exactly
that. *My read:* keep the strip for the two or three actions used constantly
(align, More, delete), and move the long tail (warp, 3D, colour, gradients, text
properties) into named panels that open on demand and remember where they were.

### 2.4 Exact values for size, position and rotation (FB-10, FB-11)
PixelLab ships a degrees field for rotation and pixel fields for position and
size, right next to the drag handles. Pentix has the nudge pad (0.5/1/5/10 px)
but no typed X/Y/W/H and no typed angle. This is small, testable, and it directly
answers "predictability".

### 2.5 Colour as a full-size editing surface (FB-13, FB-14)
PixelLab treats fill as a first-class panel: solid, **linear gradient**, radial
gradient, image texture, each with its own editor, and recent versions added
multi-colour gradients and stopped the palette from changing colour while you
scroll it. Pentix's gradient is a thin line inside a compact panel; the tester
compared the two directly, and they are right.

*My read:* the fix is not "a bigger panel", it is the one thing PixelLab also
learned the hard way — the canvas must show every drag, and the controls must be
thumb-sized. Pentix already has the live-preview pattern (`warpPreview`); a
gradient panel should reuse it so stops, angle and type update the artwork as you
drag, not on close.

## 3. What not to copy

| PixelLab | Why not, for Pentix |
|---|---|
| Merge makes a raster image | Pentix's whole proposition is editable vector; merge into one **path** instead |
| No groups or folders, flat list only | Fine for a poster with eight elements, painful for a logo with 40; Pentix's group layers are already better |
| Effects only on whole text layers (ranges only recolour/re-font) | Pentix can do more per-glyph once outlined; keep that, but do not *require* outlining |
| No auto-wrap, manual line breaks only | Pentix has area text; keep it |
| No per-pair kerning, no text on a custom path | Pentix already has type on a path; keep it |
| Tools hidden until a selection exists | Good for focus, bad for discovery in a first session; Pentix needs a visible "what can I do here" state |

## 4. A concrete shape for Pentix

1. **Selection bar** (always): Align · Group · Merge · More · Delete.
2. **Panels** (open on demand, persist, remember): Text · Fill · Gradient ·
   Effects (shadow/blur/warp/3D) · Objects.
3. **Objects panel**: checkbox Select mode, drag rows, eye, lock, opacity,
   Group and Merge in the footer, group rows expandable.
4. **Every numeric** that exists as a drag also exists as a field: X, Y, W, H,
   rotation, type size, tracking, line height.

That is four changes, three of which are small. It also keeps the beginner path
PixelLab is praised for, without giving up the vector editing the tester came for.

## 5. How we will know it worked

Re-run the same task the tester described — one word, one colour change, one
rotation, one export — and count taps and seconds before and after (FB-18). The
claim to beat is theirs: "a quarter of the time" in PixelLab. A number we can
disagree with is worth more than an adjective.

## Sources

- PixelLab interface, Android vs iPhone vs Web — https://www.questdigitech.com.ng/2026/11/pixellab-interface-android-vs-iphone-vs.html
- Text Tool & Font in PixelLab — https://www.questdigitech.com.ng/2026/11/text-tool-font-in-pixellab-text.html
- Layer Panel in PixelLab — https://www.questdigitech.com.ng/2026/11/layer-panel-in-pixellab-layer.html
- PixelLab on Google Play (feature list) — https://play.google.com/store/apps/details?id=com.imaginstudio.imagetools.pixellab
- PixelLab on the App Store (release notes, v1.0.123–1.0.128) — https://apps.apple.com/us/app/pixellab-text-photo-editor/id6757263162
