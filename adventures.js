/**
 * @typedef {import('./model.js').Adventure} Adventure
 * @typedef {import('./model.js').Session} Session
 * @typedef {import('./model.js').Workspace} Workspace
 */

// Adventures own sessions through session.adventureId. Campaign records remain
// on the workspace, so sharing them never requires copying data.
import { createAdventure, createSession } from './model.js';

/**
 * Return the trimmed display name without escaping HTML or changing the record.
 * @param {Adventure | null | undefined} adventure
 * @returns {string} The title, or "Untitled adventure".
 */
export function adventureTitle(adventure) {
  return adventure?.title.trim() || 'Untitled adventure';
}

/**
 * Find a session's owner without changing data.
 * @param {Workspace} state
 * @param {Session | null | undefined} session
 * @returns {Adventure | null} The shared adventure object, or null if none matches.
 */
export function getSessionAdventure(state, session) {
  return (
    state.adventures.find(
      (adventure) => adventure.id === session?.adventureId,
    ) || null
  );
}

/**
 * Create and insert an adventure, its first session, and its first scene.
 * Mutates state.adventures, state.sessions, and state.currentSessionId.
 * Does not save or render; the application action handles those steps.
 * @param {Workspace} state
 * @param {Object} [options={}]
 * @param {string} [options.title='']
 * @param {string} [options.notes='']
 * @returns {Adventure} The inserted adventure, shared with state.adventures.
 */
export function addAdventure(state, { title = '', notes = '' } = {}) {
  const adventure = createAdventure({
    title,
    notes,
  });
  const session = createSession({
    adventureId: adventure.id,
    number: '01',
  });
  state.adventures.push(adventure);
  state.sessions.unshift(session);
  state.currentSessionId = session.id;
  return adventure;
}

/**
 * Change a session's owner and timestamp, keeping historical comments intact.
 * @param {Workspace} state Used to check the destination and remaining siblings.
 * @param {Session} session A session belonging to this workspace; mutated on a move.
 * @param {string} adventureId Destination adventure ID.
 * @returns {boolean} True if moved or already there. False for a missing destination
 * or when moving would leave the original adventure without a session.
 */
export function moveSessionToAdventure(state, session, adventureId) {
  if (!state.adventures.some((adventure) => adventure.id === adventureId)) {
    return false;
  }
  if (session.adventureId === adventureId) {
    return true;
  }
  const siblings = state.sessions.filter(
    (item) => item.adventureId === session.adventureId,
  );
  if (siblings.length <= 1) {
    return false;
  }
  session.adventureId = adventureId;
  session.updatedAt = new Date().toISOString();
  // Comment adventure IDs are historical context and intentionally stay unchanged.
  return true;
}

/**
 * Remove an adventure and its sessions, then choose a surviving session if needed.
 * Campaign records and comment history remain; removed-source labels remain usable.
 * @param {Workspace} state Its adventure/session arrays and selection may change.
 * @param {string} adventureId
 * @returns {void} No persistence or rendering is performed.
 */
export function deleteAdventure(state, adventureId) {
  state.adventures = state.adventures.filter(
    (adventure) => adventure.id !== adventureId,
  );
  state.sessions = state.sessions.filter(
    (session) => session.adventureId !== adventureId,
  );
  if (
    !state.sessions.some((session) => session.id === state.currentSessionId)
  ) {
    state.currentSessionId = state.sessions[0]?.id ?? null;
  }
}
