/**
 * Pure HTML builders: inputs are normalized data; no state or DOM changes occur.
 * @typedef {import('./model.js').Workspace} Workspace
 * @typedef {import('./model.js').Session} Session
 */

import { adventureTitle, getSessionAdventure } from './adventures.js';
import { escapeHtml } from './ui-helpers.js';

/**
 * Build adventure option elements with an optional selected ID.
 * @param {Workspace} state
 * @param {string | null} [selectedId]
 * @returns {string}
 */
export function adventureOptions(state, selectedId) {
  return state.adventures
    .map(
      (adventure) =>
        '<option' +
        ` value="${escapeHtml(adventure.id)}"` +
        ` ${adventure.id === selectedId ? 'selected' : ''}>` +
        `${escapeHtml(adventureTitle(adventure))}` +
        '</option>',
    )
    .join('');
}

/**
 * Render adventure navigation using the supplied current session.
 * @param {Workspace} state
 * @param {Session | null} session
 * @returns {string}
 */
export function adventurePicker(state, session) {
  return (
    '<div class="adventure-picker">' +
    '<label for="adventure-picker">Adventure</label>' +
    '<select' +
    ' id="adventure-picker"' +
    ' data-scope="adventure-navigation"' +
    ` ${state.adventures.length ? '' : 'disabled'}>` +
    `${adventureOptions(state, session?.adventureId)}` +
    '</select>' +
    '<button class="quiet" data-action="new-adventure">New adventure</button>' +
    '</div>'
  );
}

/**
 * Render the current adventure's name, notes, and controls.
 * @param {Workspace} state
 * @param {Session | null} session
 * @returns {string} Empty text when no owning adventure exists.
 */
export function adventureHeading(state, session) {
  const adventure = getSessionAdventure(state, session);
  if (!adventure) {
    return '';
  }
  return (
    '<section class="adventure-heading" aria-label="Adventure details">' +
    '<div>' +
    '<p class="eyebrow">ADVENTURE</p>' +
    `<h2>${escapeHtml(adventureTitle(adventure))}</h2>` +
    `<p class="record-description">${escapeHtml(adventure.notes)}</p>` +
    '</div>' +
    '<div class="adventure-actions">' +
    '<button class="quiet" data-action="edit-adventure">Edit adventure</button>' +
    '<button class="quiet delete" data-action="delete-adventure">Delete adventure</button>' +
    '</div>' +
    '</section>'
  );
}
