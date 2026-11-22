# Feedback badges

Every point from the tester (Pearl Eli, AIMA Graphics concept) is broken into one
badge that can be picked up, solved and ticked off. One badge = one shippable
change with a testable “done”.

Status legend: `OPEN` · `DOING` · `DONE` · `PARKED` (agreed not now)
Size: **S** half a day · **M** a day · **L** several days · **XL** a project

## Text

| Badge | Item | Size | Status | Done when |
|---|---|---|---|---|
| **FB-01** | Converted outlines arrived as one object per letter, including the dot of an `i` | S | **DONE** `39353ba` | “To curves” lands the letters in one named group; one colour applies to the whole word, the group still opens for a single letter |
| **FB-02** | No way to re-colour part of a converted word without hunting rows | S | **DONE** with FB-01 | Selecting one letter inside the group tints only that letter |
| **FB-03** | Text editing is split between canvas editing and a strip that changes under you | M | DONE | Editing a label opens one panel that owns font, size, tracking, line height, align and fill, and stays put while you type |
| **FB-04** | No exact size/tracking entry for type | S | DONE | Type size and tracking accept typed numbers; the canvas follows live |
| **FB-05** | Converting to curves feels mandatory for effects | M | DONE | Warp, outline and gradient all work on live text, so conversion is a choice, not a step. Verified on a label per effect, through re-typing and resizing, then in the downloaded SVG. 3D is the one effect that truly needs outlines, and its panel now says so and offers the conversion. Combinations hold too: a gradient under a warp, a stroke on a warp, and a gradient through a conversion into an extrusion |

## Objects & layers

| Badge | Item | Size | Status | Done when |
|---|---|---|---|---|
| **FB-06** | Cannot select more than one row in the Objects panel | M | DONE | Tapping selects, a second tap with Shift (or a row checkbox) extends; delete, colour, hide and reorder act on all selected rows |
| **FB-07** | Grouping exists but is not discoverable | S | DONE | A Group action sits in the Objects panel and in More when two or more objects are selected |
| **FB-08** | No merge for selected objects | S | DONE | Two selected objects can be merged into one path without leaving the panel (uses the existing pathfinder Unite) |
| **FB-09** | Panel shows no origin of an object — hard to tell what the row is | S | DONE | Object rows show a thumbnail or shape type, so a row is identifiable before tapping it |

## Transform & precision

| Badge | Item | Size | Status | Done when |
|---|---|---|---|---|
| **FB-10** | No way to type an exact rotation angle | S | DONE | A number field sets rotation in degrees about the selection centre; Shift-snap on the handle stays |
| **FB-11** | No exact position/size entry | S | DONE | X, Y, W, H fields in the strip for any selection, with the same values the nudge pad uses |
| **FB-12** | Transform frame drifted from warped text | S | **DONE** `a613ab6` | Frame hugs the bent letters through rotate and scale |

## Colour

| Badge | Item | Size | Status | Done when |
|---|---|---|---|---|
| **FB-13** | Gradient editor is a thin line compared with PixelLab’s full panel | L | DONE | Gradient opens a panel with a wide ramp, draggable stops, angle, type (linear/radial), and the canvas previews every drag (the `warpPreview` pattern) |
| **FB-14** | Gradient stops cannot be added, moved or deleted with confidence | M | DONE | Stop handles hit at thumb size, with add on tap, delete on drag-away |

## Learning & predictability

| Badge | Item | Size | Status | Done when |
|---|---|---|---|---|
| **FB-15** | A beginner cannot predict where a tool’s options will appear | L | DONE | Each tool opens a named panel that persists until closed; the strip no longer re-arranges itself per tool |
| **FB-16** | First-run gives no guided first mark | M | DONE | A three-step “draw, combine, export” walkthrough that can be skipped and never returns |
| **FB-17** | Manual exists but is not where a beginner looks | S | **DONE** `a613ab6` | Manual opens on a cover with a four-step tour, and the in-app sheet links to it |

## Efficiency

| Badge | Item | Size | Status | Done when |
|---|---|---|---|---|
| **FB-18** | “A quarter of the time in PixelLab” — no measurement | M | DONE | Time-to-logo timed on three fixed tasks (one shape, one word, one export) and shown in Help under “Speed on this device”, so the claim can be checked by the tester, not a developer. First pass: shape ~1.5 s, word ~1.1 s, export ~80 ms |

## From the PixelLab study (`docs/UX-PIXELLAB.md`)

| Badge | Item | Size | Status | Done when |
|---|---|---|---|---|
| **FB-21** | A selection bar that never moves: Align · Group · Merge · More · Delete | S | DONE | Those five actions are always in the same place for any selection; panels open around them |
| **FB-22** | Named panels per job that stay put (Text, Fill, Gradient, Effects) | L | DONE | Opening one does not re-arrange the others, and it remembers where it was left |
| **FB-23** | Style part of a word without converting it (PixelLab's range colours) | L | DONE | Selecting letters in the text editor can tint or refont just those letters while the label stays type. Highlight letters, then tint them and/or set them in their own typeface; the label stays live type, and both ride through re-editing, warping and the outlined export. Checked on a two-line label: “PEN” pink, “TIX” in the label font, “LOGO” in Impact |
| **FB-24** | Saved text/gradient styles (“My Styles”) | M | DONE | A styled label can be saved and applied to another label in one tap, staying editable |
| **FB-25** | Locked and hidden objects let taps pass through | S | DONE | A tap over a locked object reaches the object beneath it, as PixelLab does on iOS |
| **FB-26** | Merge must stay vector, never raster | S | DONE | Merge/Unite produces one editable path (never an image), unlike PixelLab's permanent raster merge |

## Parked

| Badge | Item | Why parked |
|---|---|---|
| **FB-19** | Copy PixelLab’s visual shell wholesale | Copying a competitor’s chrome buys familiarity but not their polish; take the panel *structure*, keep Pentix’s own look |
| **FB-20** | Image-texture fills | SHIPPED, unofficially: a reference picture can already be clipped into selected shapes, stored on the object and exported. What is missing is a way to reach it from the paint panel, and image fills on type. Re-scope against that before treating it as new work |

## Counts

- DONE: FB-01, FB-02, FB-12, FB-17 (commits `39353ba`, `a613ab6`), FB-06, FB-07, FB-08, FB-26 (panel select mode), FB-10, FB-11 (Transform panel), FB-21, FB-25 (fixed bar, locks), FB-13, FB-14 (wide gradient ramp), FB-03, FB-04 (text panel with typed numbers), FB-09 (row shape previews), FB-15, FB-22 (named tool panels), FB-16 (three-step first run), FB-24 (saved label styles), FB-05 (effects prove live type), FB-18 (measured time-to-logo), FB-23 (part-of-a-word tint and typeface)
- OPEN, small: none
- OPEN, medium: none
- OPEN, large: none
- PARKED: FB-19 (a rejected direction, not work), FB-20 (mostly already built — see above)

## Order I would work them

1. ~~**FB-06** panel multi-select, then **FB-07**/**FB-08**~~ — done: a Select mode ticks rows, and Group / Merge / Delete act on the ticks.
2. ~~**FB-10**/**FB-11** exact numbers~~ — done: a Transform panel gives X, Y, W, H and a typed turn, from the same frame the handles drag.
3. ~~**FB-03**/**FB-04** one text panel — stops the strip moving under the thumb while typing~~ — done: one sheet owns typeface, size, tracking, leading, align and fill, with typed numbers for the three.
4. ~~**FB-13**/**FB-14** gradient behind a wide ramp with live preview~~ — done: a 52 px ramp with draggable stops, tap to add, drag down to remove.
5. ~~**FB-15**/**FB-22** named panels that stay put~~ — done: every tool opens a titled panel above a strip whose five slots never change.
6. ~~**FB-16** a first-run walkthrough pointing at fixed places~~ — done: Draw / Combine / Export marks over the panel, the strip and the export button, skippable and shown once.
