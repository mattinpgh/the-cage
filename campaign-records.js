/**
 * @typedef {'locations' | 'npcs'} RecordType
 * @typedef {import('./model.js').CampaignRecord} CampaignRecord
 * @typedef {import('./model.js').Session} Session
 * @typedef {import('./model.js').Workspace} Workspace
 */

// Locations and NPCs share names, descriptions, and ID-based associations.
// Threads keep their separate model because they also have a campaign status.
import { createId } from './model.js';

export const recordTypes = {
  locations: {
    label: 'Locations',
    singular: 'location',
    idsKey: 'locationIds',
  },
  npcs: { label: 'NPCs', singular: 'NPC', idsKey: 'npcIds' },
};

/**
 * Construct an unattached location or NPC, with independent empty comments.
 * @returns {CampaignRecord} A new object; the caller chooses its collection.
 */
export function createCampaignRecord() {
  return { id: createId(), name: '', description: '', comments: [] };
}

/**
 * Return a display name without escaping HTML or changing the record.
 * @param {CampaignRecord} record
 * @param {RecordType} type Must be a supported recordTypes key.
 * @returns {string} Trimmed name, or an appropriate untitled label.
 */
export function recordName(record, type) {
  return record.name.trim() || `Untitled ${recordTypes[type].singular}`;
}

/**
 * Remove a location/NPC from this session and its scenes; keep its campaign record.
 * @param {Session} session Association arrays are replaced, not the record's comments.
 * @param {RecordType} type Must be a supported recordTypes key.
 * @param {string} id Record ID to unlink.
 * @returns {void} No saving or timestamp update is performed.
 */
export function removeRecordFromSession(session, type, id) {
  const { idsKey } = recordTypes[type];
  session[idsKey] = session[idsKey].filter((value) => value !== id);
  for (const scene of session.scenes) {
    scene[idsKey] = scene[idsKey].filter((value) => value !== id);
  }
}

/**
 * Delete a location/NPC and its own comments, and unlink it from every session.
 * Other records' comments retain historical references to the deleted location.
 * @param {Workspace} state Collection and session/scene association arrays are changed.
 * @param {RecordType} type Must be a supported recordTypes key.
 * @param {string} id
 * @returns {void} Always attempts to unlink the ID, even if its record is absent.
 * No saving is performed.
 */
export function deleteCampaignRecord(state, type, id) {
  state[type] = state[type].filter((record) => record.id !== id);
  for (const session of state.sessions) {
    removeRecordFromSession(session, type, id);
  }
}
