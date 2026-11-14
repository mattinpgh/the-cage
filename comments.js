/**
 * @typedef {'threads' | 'locations' | 'npcs'} CommentType
 * @typedef {import('./model.js').Workspace} Workspace
 * @typedef {import('./model.js').RecordComment} RecordComment
 * @typedef {import('./model.js').CampaignThread | import('./model.js').CampaignRecord} CommentRecord
 */

import { getSessionAdventure, adventureTitle } from './adventures.js';
// Comments belong to campaign records. Context IDs provide navigation; saved
// labels keep history understandable even after a session or scene is deleted.
import { createId } from './model.js';
export const commentTypes = {
  threads: {
    idsKey: 'threadIds',
    singular: 'thread',
  },
  locations: {
    idsKey: 'locationIds',
    singular: 'location',
  },
  npcs: {
    idsKey: 'npcIds',
    singular: 'NPC',
  },
};

/**
 * Look up the shared subject record without changing it.
 * @param {Workspace} state
 * @param {string} type A commentTypes key; unsupported keys are tolerated.
 * @param {string} id
 * @returns {CommentRecord | null} Null for an unsupported type or unknown ID.
 */
export function findCommentRecord(state, type, id) {
  if (!Object.hasOwn(commentTypes, type)) {
    return null;
  }
  return state[type].find((record) => record.id === id) || null;
}

/**
 * Append a contextual comment to a record after validating its subject and context.
 * Also links the subject and optional location to the session and scene, and updates
 * session.updatedAt. No storage write or rendering occurs. Original adventure ID
 * and context labels are snapshots; later session moves do not rewrite them.
 * @param {Workspace} state A normalized workspace, mutated after validation succeeds.
 * @param {CommentType} type
 * @param {string} recordId
 * @param {Object} entry
 * @param {string} entry.text Must contain non-whitespace text; saved after trimming.
 * @param {string} entry.sessionId Must identify an existing session with an adventure.
 * @param {string} entry.sceneId Must belong to that session.
 * @param {string | null} [entry.locationId=null] Existing tracked location, if provided.
 * @returns {RecordComment} The inserted object, also held in the subject's comments array.
 * @throws {Error} If the subject or context is missing, or text is blank.
 * Invalid entries are rejected before associations or comments are changed.
 */
export function addComment(
  state,
  type,
  recordId,
  { text, sessionId, sceneId, locationId = null },
) {
  const record = findCommentRecord(state, type, recordId);
  const session = state.sessions.find((item) => item.id === sessionId);
  const scene = session?.scenes.find((item) => item.id === sceneId);
  const adventure = getSessionAdventure(state, session);
  const location = locationId
    ? state.locations.find((item) => item.id === locationId)
    : null;
  if (
    !record ||
    !session ||
    !adventure ||
    !scene ||
    !text.trim() ||
    (locationId && !location)
  ) {
    throw new Error('Choose a session and scene, and enter a comment.');
  }

  // A comment made in a scene also establishes the record's scene association.
  function attach(idsKey, id) {
    if (!session[idsKey].includes(id)) {
      session[idsKey].push(id);
    }
    if (!scene[idsKey].includes(id)) {
      scene[idsKey].push(id);
    }
  }
  attach(commentTypes[type].idsKey, recordId);
  if (location) {
    attach('locationIds', location.id);
  }
  const comment = {
    id: createId(),
    text: text.trim(),
    createdAt: new Date().toISOString(),
    adventureId: adventure.id,
    adventureLabel: `Adventure: ${adventureTitle(adventure)}`,
    sessionId,
    sceneId,
    locationId: location?.id ?? null,
    sessionLabel: `Session ${session.number.trim() || '—'}: ${session.title.trim() || 'Untitled session'}`,
    sceneLabel: `Scene ${session.scenes.indexOf(scene) + 1}: ${scene.title.trim() || 'Untitled scene'}`,
    locationLabel: location ? location.name.trim() || 'Untitled location' : '',
  };
  record.comments.push(comment);
  session.updatedAt = comment.createdAt;
  return comment;
}

/**
 * Replace only comment text, preserving creation time and all original context.
 * @param {CommentRecord} record Its matching comment is mutated in place.
 * @param {string} commentId
 * @param {string} text Saved after trimming.
 * @returns {boolean} False for an unknown comment or blank text; otherwise true.
 */
export function editComment(record, commentId, text) {
  const comment = record.comments.find((item) => item.id === commentId);
  if (!comment || !text.trim()) {
    return false;
  }
  comment.text = text.trim();
  return true;
}

/**
 * Remove one comment from its subject everywhere that subject is viewed.
 * @param {CommentRecord} record Its comments array is replaced.
 * @param {string} commentId Unknown IDs leave comment contents unchanged.
 * @returns {void} No saving or timestamp update is performed.
 */
export function deleteComment(record, commentId) {
  record.comments = record.comments.filter(
    (comment) => comment.id !== commentId,
  );
}
