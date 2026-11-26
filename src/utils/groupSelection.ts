import type { Layer } from '../types/vector';

export interface TapSelectionOptions {
  /** The Layers panel's mode: Group takes the whole layer, Object takes one row */
  groupSelectMode: 'group' | 'objects';
  /** Shift or Ctrl was held, so the tap adds to or removes from the selection */
  additive: boolean;
}

/**
 * The ids a canvas tap should select.
 *
 * A grouped layer is one object until the user asks for a member: tapping any
 * unselected member brings every visible, unlocked member along, so the next
 * drag moves the group as a whole. An already-selected member is left as the
 * single-object case — that is how a member chosen in the Layers panel, or
 * opened by a double-tap, moves on its own.
 */
export function pathIdsForTap(
  layers: Layer[],
  pathId: string,
  selectedPathIds: string[],
  { groupSelectMode, additive }: TapSelectionOptions
): string[] {
  const owner =
    groupSelectMode === 'group'
      ? layers.find(
          (layer) => layer.isGroup === true && layer.paths.some((path) => path.id === pathId)
        )
      : undefined;
  const members = owner
    ? owner.paths
        .filter((path) => path.visible !== false && path.locked !== true)
        .map((path) => path.id)
    : [];

  const groupMembers = members.length ? members : [pathId];
  const isAlready = selectedPathIds.includes(pathId);

  if (additive) {
    const wholeGroupTaken = groupMembers.every((id) => selectedPathIds.includes(id));
    return wholeGroupTaken
      ? selectedPathIds.filter((id) => !groupMembers.includes(id))
      : Array.from(new Set([...selectedPathIds, ...groupMembers]));
  }

  return isAlready ? selectedPathIds : groupMembers;
}
