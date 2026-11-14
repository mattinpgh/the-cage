/**
 * Pure HTML builders: histories are shared data, not copies stored on each scene.
 * No records, storage, or DOM elements are changed here.
 * @typedef {import('./model.js').Workspace} Workspace
 * @typedef {import('./model.js').RecordComment} RecordComment
 * @typedef {import('./comments.js').CommentRecord} CommentRecord
 * @typedef {import('./comments.js').CommentType} CommentType
 */

import { adventureTitle } from './adventures.js';
import { escapeHtml, sessionTitle, sceneTitle } from './ui-helpers.js';

// Used on full record cards, campaign-library entries, and scene controls.

/**
 * Build an add-comment button with optional preselected context IDs.
 * @param {CommentRecord} record
 * @param {CommentType} type
 * @param {string | null} [sessionId]
 * @param {string | null} [sceneId]
 * @returns {string}
 */
export function commentButton(record, type, sessionId, sceneId) {
  return (
    '<button' +
    ' type="button"' +
    ' class="quiet"' +
    ' data-action="add-comment"' +
    ` data-type="${type}"` +
    ` data-id="${escapeHtml(record.id)}"` +
    ` data-session="${escapeHtml(sessionId || '')}"` +
    ` data-scene="${escapeHtml(sceneId || '')}">` +
    'Add comment' +
    '</button>'
  );
}

/**
 * Render live context links or saved labels for deleted/unknown sources.
 * The adventure comes from the comment's origin, even if its session has moved.
 * @param {RecordComment} comment
 * @param {Workspace} state
 * @returns {string} Escaped labels and HTML links.
 */
export function commentContext(comment, state) {
  const adventure = state.adventures.find(
    (item) => item.id === comment.adventureId,
  );
  const adventureText = adventure
    ? `Adventure: ${adventureTitle(adventure)}`
    : comment.adventureId
      ? `${comment.adventureLabel} (deleted)`
      : comment.adventureLabel;
  const adventureHtml = adventure
    ? `<a href="#main" data-action="open-adventure" data-id="${escapeHtml(adventure.id)}">` +
      `${escapeHtml(adventureText)}` +
      '</a>'
    : escapeHtml(adventureText);
  const session = state.sessions.find((item) => item.id === comment.sessionId);
  const scene = session?.scenes.find((item) => item.id === comment.sceneId);
  const location = state.locations.find(
    (item) => item.id === comment.locationId,
  );
  const sessionText = session
    ? `Session ${session.number.trim() || '—'}: ${sessionTitle(session)}`
    : `${comment.sessionLabel} (deleted)`;
  const sceneText = scene
    ? `Scene ${session.scenes.indexOf(scene) + 1}: ${sceneTitle(scene)}`
    : `${comment.sceneLabel} (deleted)`;
  const sessionHtml = session
    ? `<a href="#main" data-action="open-session" data-id="${escapeHtml(session.id)}">` +
      `${escapeHtml(sessionText)}` +
      '</a>'
    : escapeHtml(sessionText);
  const sceneHtml = scene
    ? '<a' +
      ` href="#scene-${escapeHtml(scene.id)}"` +
      ' data-action="jump-scene"' +
      ` data-session="${escapeHtml(session.id)}"` +
      ` data-id="${escapeHtml(scene.id)}">` +
      `${escapeHtml(sceneText)}` +
      '</a>'
    : escapeHtml(sceneText);
  let locationHtml = '';
  if (comment.locationId) {
    locationHtml = location
      ? `<a href="#main" data-action="view-comment-location" data-id="${escapeHtml(location.id)}">` +
        `Location: ${escapeHtml(location.name.trim() || 'Untitled location')}` +
        '</a>'
      : `Location: ${escapeHtml(comment.locationLabel)} (deleted)`;
  }
  return [adventureHtml, sessionHtml, sceneHtml, locationHtml]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Render the subject's full history across all adventures, plus comment controls.
 * @param {CommentRecord} record
 * @param {Workspace} state
 * @param {CommentType} type
 * @returns {string} An expandable history, including an empty-state message when needed.
 */
export function commentsView(record, state, type) {
  const comments = record.comments || [];
  const items = comments
    .map(
      (comment) =>
        '<li class="record-comment">\n    ' +
        `<p class="comment-context">${commentContext(comment, state)}</p>\n    ` +
        `<p class="comment-text">${escapeHtml(comment.text)}</p>\n    ` +
        `<time datetime="${escapeHtml(comment.createdAt)}">` +
        `${escapeHtml(comment.createdAt.replace('T', ' ').replace(/\.\d+Z$/, ' UTC'))}` +
        '</time>\n    ' +
        '<div class="comment-actions">' +
        '<button' +
        ' type="button"' +
        ' class="quiet"' +
        ' data-action="edit-comment"' +
        ` data-type="${type}"` +
        ` data-id="${escapeHtml(record.id)}"` +
        ` data-comment="${escapeHtml(comment.id)}">` +
        'Edit comment' +
        '</button>' +
        '<button' +
        ' type="button"' +
        ' class="quiet delete"' +
        ' data-action="delete-comment"' +
        ` data-type="${type}"` +
        ` data-id="${escapeHtml(record.id)}"` +
        ` data-comment="${escapeHtml(comment.id)}">` +
        'Delete comment' +
        '</button>' +
        '</div>\n  ' +
        '</li>',
    )
    .join('');
  return (
    '<details class="record-comments">' +
    `<summary>Comments (${comments.length})</summary>` +
    `${
      items
        ? '<ol class="comment-list">' + `${items}` + '</ol>'
        : '<p class="inline-hint">No comments yet.</p>'
    }` +
    `${commentButton(record, type, state.currentSessionId)}` +
    '</details>'
  );
}
