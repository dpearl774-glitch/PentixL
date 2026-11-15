/**
 * How far a pointer has to travel, in screen pixels, before a press counts as a
 * drag rather than a tap.
 *
 * A finger always rolls a few degrees on contact, so it needs a wider margin
 * than a mouse: at a zoomed-out view the old 3 px threshold turned ordinary
 * taps into drags that threw objects around.
 */
export const TOUCH_DRAG_SLOP = 10;

/** The same threshold for a mouse or a pen, which land where they are aimed. */
export const POINTER_DRAG_SLOP = 3;
