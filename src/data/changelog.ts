export interface ChangelogEntry {
  /** Stable id. The newest id is what the "unseen" dot compares against. */
  id: string;
  date: string;
  title: string;
  items: string[];
}

/**
 * What's new, newest first.
 *
 * Written for the person using the app, not for the commit log: say what they
 * can now do, not which file changed. Adding an entry is all it takes to light
 * the dot in the menu — the seen marker stores the newest id.
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    id: '2026-11-15-themes',
    date: '15 Nov 2026',
    title: 'Dark, light, or your system',
    items: [
      'The menu has an Appearance switch: Dark, Light, or System to follow the device.',
      'The whole editor flips — panels, canvas workspace and selection colours — and the choice is remembered.',
      'A waiting update stays in the menu even after you dismiss the banner, so it is never lost.',
      'Sharper icon set across the menu and sheets.',
    ],
  },
  {
    id: '2026-11-15-updates',
    date: '15 Nov 2026',
    title: 'Updates tell you, offline keeps working',
    items: [
      'A new build no longer swaps in underneath you while you draw — the app offers a Reload when one is ready.',
      'This page exists: the menu shows a dot when there is something you have not read.',
      'The app still opens and edits with no connection, and reloads from the cache when you are offline.',
    ],
  },
  {
    id: '2026-11-15-shadows',
    date: '15 Nov 2026',
    title: 'Shadows, inner and outer',
    items: [
      'Objects take a drop shadow: X and Y offset, softness, opacity and colour.',
      'Inner shadows press the shape in rather than lifting it off the page.',
      'The colour row ends in a picker, so a shadow can be any colour, not just the four shortcuts.',
      'A shadow with no colour of its own falls back to ink instead of black.',
    ],
  },
  {
    id: '2026-11-15-dragging',
    date: '15 Nov 2026',
    title: 'Dragging follows your finger',
    items: [
      'Objects, nodes and handles start moving where your finger crossed the drag threshold, with no jump.',
      'Taps no longer turn into drags, so picking something up does not nudge it first.',
      'The precision pad presses after a deliberate hold and moves artwork 1:1 with your thumb.',
      'The transform box turns with the shape while you rotate it.',
    ],
  },
  {
    id: '2026-11-15-nodes',
    date: '15 Nov 2026',
    title: 'Deleting a node keeps the outline',
    items: [
      'Removing a node refits the curve through the gap instead of leaving a dent in the shape.',
      'A node you added and then removed restores the original curve exactly, even after a reload.',
    ],
  },
  {
    id: '2026-11-14-tutorial',
    date: '14 Nov 2026',
    title: 'The manual is in the app',
    items: [
      'A 31-page tutorial PDF, with screenshots, downloads from the menu and opens on first launch.',
      'Telegram links for build notes and the testers’ chat sit in the same menu.',
    ],
  },
];

export const LATEST_CHANGELOG_ID = CHANGELOG[0]?.id ?? '';

/** localStorage key for the newest entry the user has actually opened. */
export const CHANGELOG_SEEN_KEY = 'pentix.changelog.seen';
