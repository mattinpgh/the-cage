/**
 * Dialog builders expect normalized records and return HTML strings. They do
 * not mutate inputs, write storage, open dialogs, or invoke submit callbacks.
 *
 * @typedef {import('./model.js').Workspace} Workspace
 * @typedef {import('./model.js').Session} Session
 * @typedef {import('./model.js').Scene} Scene
 * @typedef {import('./model.js').Adventure} Adventure
 * @typedef {import('./model.js').CampaignThread} CampaignThread
 * @typedef {import('./model.js').CampaignRecord} CampaignRecord
 * @typedef {import('./model.js').RecordComment} RecordComment
 * @typedef {import('./comments.js').CommentRecord} CommentRecord
 * @typedef {import('./comments.js').CommentType} CommentType
 *
 * @typedef {Object} DialogOptions
 * @property {string} title Plain text, escaped by dialogFrame.
 * @property {string} body Already-rendered HTML from a dialog body builder.
 * @property {string} [submitText='Save']
 * @property {(data: FormData) => void} [onSubmit] Stored by app.js, then called only
 * when the form is submitted. Closing/canceling discards it without calling it.
 * @property {boolean} [danger=false]
 * @property {boolean} [cancel=true] Whether to show the footer Cancel button.
 *
 * @typedef {Object} DialogFrameOptions
 * @property {string} heading Plain text heading.
 * @property {string} body Already-rendered HTML.
 * @property {string} submitText Plain text button label.
 * @property {boolean} danger
 * @property {boolean} cancel
 *
 * @typedef {Object} CommentFormData
 * @property {Workspace} state
 * @property {Session[]} sessions Sessions with scenes, offered as context choices.
 * @property {Session} session Initially selected session.
 * @property {Scene} scene Initially selected scene, belonging to session.
 * @property {string | null} defaultLocation Initially selected location ID.
 */

import { adventureTitle, getSessionAdventure } from './adventures.js';
import { adventureOptions } from './adventure-views.js';
import { commentsView, commentContext } from './comment-views.js';
import {
  statuses,
  renderIcon,
  escapeHtml,
  sessionTitle,
  sceneTitle,
  threadName,
} from './ui-helpers.js';
// Dialog markup only. These functions receive data and return HTML without changing state.

/**
 * Build scene option elements in their current order.
 * @param {Workspace} state
 * @param {string} sessionId
 * @param {string} [selectedId] Optional scene to mark selected.
 * @returns {string} Option HTML, or empty text for an unknown session.
 */
export function commentSceneOptions(state, sessionId, selectedId) {
  const session = state.sessions.find((item) => item.id === sessionId);
  return (session?.scenes || [])
    .map(
      (scene, index) =>
        `<option value="${escapeHtml(scene.id)}" ${scene.id === selectedId ? 'selected' : ''}>` +
        `Scene ${index + 1}: ${escapeHtml(sceneTitle(scene))}` +
        '</option>',
    )
    .join('');
}

/**
 * Render the dialog's form shell; lifecycle and callbacks stay in app.js.
 * @param {DialogFrameOptions} options Labels are plain text; body is trusted HTML.
 * @returns {string}
 */
export function dialogFrame({ heading, body, submitText, danger, cancel }) {
  return (
    '<form id="dialog-form">' +
    '<div class="modal-top">' +
    `<h2 id="modal-title">${escapeHtml(heading)}</h2>` +
    '<button' +
    ' type="button"' +
    ' class="icon-button"' +
    ' data-action="close-dialog"' +
    ' aria-label="Close dialog">' +
    `${renderIcon('close')}` +
    '</button>' +
    '</div>' +
    '<div class="modal-body">' +
    `${body}` +
    '</div>' +
    '<div class="modal-footer">' +
    `${cancel ? '<button type="button" class="secondary" data-action="close-dialog">Cancel</button>' : ''}` +
    `<button type="submit" class="${danger ? 'danger' : 'primary'}">${escapeHtml(submitText)}</button>` +
    '</div>' +
    '</form>'
  );
}

/**
 * Render the adventure creation form fields.
 * @returns {string}
 */
export function newAdventureBody() {
  return (
    '<p>An adventure starts with one session and one scene. You can add more as you prepare.</p>' +
    '<div class="modal-field">' +
    '<label for="adventure-title">Adventure name</label>' +
    '<input id="adventure-title" name="title" autofocus>' +
    '</div>' +
    '<div class="modal-field field">' +
    '<label for="adventure-notes">Adventure notes</label>' +
    '<textarea id="adventure-notes" name="notes"></textarea>' +
    '</div>'
  );
}

/**
 * Render editable adventure name and notes.
 * @param {Adventure} adventure
 * @returns {string}
 */
export function editAdventureBody(adventure) {
  return (
    '<div class="modal-field">' +
    '<label for="adventure-title">Adventure name</label>' +
    `<input id="adventure-title" name="title" value="${escapeHtml(adventure.title)}" autofocus>` +
    '</div>' +
    '<div class="modal-field field">' +
    '<label for="adventure-notes">Adventure notes</label>' +
    `<textarea id="adventure-notes" name="notes">${escapeHtml(adventure.notes)}</textarea>` +
    '</div>'
  );
}

/**
 * Render the adventure deletion explanation and affected session count.
 * @param {Adventure} adventure
 * @param {Session[]} sessions Sessions belonging to this adventure.
 * @returns {string}
 */
export function deleteAdventureBody(adventure, sessions) {
  return (
    '<p>' +
    `<strong>${escapeHtml(adventureTitle(adventure))}</strong>` +
    ' and its ' +
    `${sessions.length}` +
    ' sessions and all their scenes will be deleted. Campaign NPCs, locations, threads, and comments are kept. Comments keep their original context labels.' +
    '</p>'
  );
}

/**
 * Render session fields, adventure choices, and optional thread carry-over.
 * @param {Workspace} state
 * @param {CampaignThread[]} active Open/advanced threads offered for carry-over.
 * @param {Session | null} currentSession Supplies the initial adventure selection.
 * @returns {string}
 */
export function newSessionBody(state, active, currentSession) {
  return (
    '<p>Give yourself a starting point. Everything can be changed later.</p>' +
    '<div class="modal-field">' +
    '<label for="new-adventure">Adventure</label>' +
    '<select id="new-adventure" name="adventure">' +
    `${adventureOptions(state, currentSession?.adventureId)}` +
    '</select>' +
    '</div>' +
    '<div class="modal-field">' +
    '<label for="new-title">' +
    'Session title ' +
    '<span class="optional">optional</span>' +
    '</label>' +
    '<input id="new-title" name="title" placeholder="A new possibility in Sigil" autofocus>' +
    '</div>' +
    '<div class="modal-grid">' +
    '<div class="modal-field">' +
    '<label for="new-number">Session number</label>' +
    '<input id="new-number" name="number" placeholder="e.g. 02">' +
    '</div>' +
    '<div class="modal-field">' +
    '<label for="new-date">Play date</label>' +
    '<input id="new-date" name="date" type="date">' +
    '</div>' +
    '</div>' +
    `${active.length ? '<label class="checkbox-label">' + '<input type="checkbox" name="carry" checked>' + ' Bring ' + `${active.length}` + ' open or advanced campaign thread' + `${active.length === 1 ? '' : 's'}` + ' into this session.' + '</label>' : ''}`
  );
}

/**
 * Render blank thread fields and supported status choices.
 * @returns {string}
 */
export function newThreadBody() {
  return (
    '<p>A name and a sentence or two are plenty. Link it to scenes as you build the outline.</p>' +
    '<div class="modal-field">' +
    '<label for="new-thread">' +
    'Thread name ' +
    '<span class="optional">optional</span>' +
    '</label>' +
    '<input' +
    ' id="new-thread"' +
    ' name="name"' +
    ' placeholder="A debt, a mystery, a personal goal…"' +
    ' autofocus>' +
    '</div>' +
    '<div class="modal-field field">' +
    '<label for="thread-description">Short description</label>' +
    '<textarea id="thread-description" name="description" placeholder="Why does this matter to the party?"></textarea>' +
    '</div>' +
    '<div class="modal-field">' +
    '<label for="thread-status">Status</label>' +
    '<select id="thread-status" name="status">' +
    statuses
      .map(
        (status) =>
          `<option value="${status}">${status[0].toUpperCase() + status.slice(1)}</option>`,
      )
      .join('') +
    ('</select>' + '</div>')
  );
}

/**
 * Render blank NPC/location name and description fields.
 * @param {'location' | 'NPC'} singular Trusted label from recordTypes.
 * @returns {string}
 */
export function newRecordBody(singular) {
  return (
    '<div class="modal-field">' +
    '<label for="record-name">Name</label>' +
    '<input id="record-name" name="name" autofocus>' +
    '</div>' +
    '<div class="modal-field field">' +
    '<label for="record-description">Description</label>' +
    '<textarea id="record-description" name="description"></textarea>' +
    '</div>'
  );
}

/**
 * Render the campaign-wide record deletion explanation.
 * @param {CampaignRecord} record
 * @returns {string}
 */
export function deleteRecordBody(record) {
  return (
    '<p>' +
    `<strong>${escapeHtml(record.name || 'Untitled record')}</strong>` +
    ' and its comments will be removed from the campaign and every session and scene. Existing free-text ' +
    'scene notes will be kept.' +
    '</p>'
  );
}

/**
 * Render contextual comment fields and their initial selection.
 * @param {CommentFormData} options Data already chosen by addCommentDialog.
 * @returns {string}
 */
export function newCommentBody({
  state,
  sessions,
  session,
  scene,
  defaultLocation,
}) {
  const sessionOptions = sessions
    .map(
      (item) =>
        `<option value="${escapeHtml(item.id)}" ${item.id === session.id ? 'selected' : ''}>` +
        'Adventure: ' +
        `${escapeHtml(adventureTitle(getSessionAdventure(state, item)))}` +
        ' — Session ' +
        `${escapeHtml(item.number.trim() || '—')}` +
        ': ' +
        `${escapeHtml(sessionTitle(item))}` +
        '</option>',
    )
    .join('');
  const locationOptions = state.locations
    .map(
      (location) =>
        '<option' +
        ` value="${escapeHtml(location.id)}"` +
        ` ${location.id === defaultLocation ? 'selected' : ''}>` +
        `${escapeHtml(location.name.trim() || 'Untitled location')}` +
        '</option>',
    )
    .join('');
  return (
    '<p>' +
    'Comments are shared everywhere this record is viewed. Adding a comment also links this record and ' +
    'the selected location to the chosen scene.' +
    '</p>\n      ' +
    '<div class="modal-field">' +
    '<label for="comment-session">Session</label>' +
    '<select id="comment-session" name="session" required>' +
    `${sessionOptions}` +
    '</select>' +
    '</div>\n      ' +
    '<div class="modal-field">' +
    '<label for="comment-scene">Scene</label>' +
    '<select id="comment-scene" name="scene" required>' +
    `${commentSceneOptions(state, session.id, scene.id)}` +
    '</select>' +
    '</div>\n      ' +
    '<div class="modal-field">' +
    '<label for="comment-location">Location (optional)</label>' +
    '<select id="comment-location" name="location">' +
    '<option value="">No location</option>' +
    `${locationOptions}` +
    '</select>' +
    '</div>\n      ' +
    '<div class="modal-field field">' +
    '<label for="comment-text">Comment</label>' +
    '<textarea id="comment-text" name="text" required autofocus></textarea>' +
    '</div>'
  );
}

/**
 * Render a record's complete comment history, expanded for a dialog.
 * @param {CommentRecord} record
 * @param {Workspace} state
 * @param {CommentType} type
 * @returns {string}
 */
export function viewCommentsBody(record, state, type) {
  return commentsView(record, state, type).replace(
    '<details class="record-comments">',
    '<details class="record-comments" open>',
  );
}

/**
 * Render existing context and editable comment text.
 * @param {RecordComment} comment
 * @param {Workspace} state Used to resolve surviving context links.
 * @returns {string}
 */
export function editCommentBody(comment, state) {
  return (
    `<p class="comment-context">${commentContext(comment, state)}</p>` +
    '<div class="modal-field field">' +
    '<label for="edit-comment-text">Comment</label>' +
    `<textarea id="edit-comment-text" name="text" required autofocus>${escapeHtml(comment.text)}</textarea>` +
    '</div>'
  );
}

/**
 * Render the individual comment deletion explanation.
 * @returns {string}
 */
export function deleteCommentBody() {
  return '<p>This comment will be removed from the record everywhere.</p>';
}

/**
 * Render the help and export instructions.
 * @returns {string}
 */
export function helpBody() {
  return (
    '<p>' +
    '<strong>Adventures</strong>' +
    ' group sessions. Use the adventure selector to switch, New adventure to start another, and Edit ' +
    'adventure to change its name and notes. Each adventure keeps at least one session, and each session ' +
    'keeps at least one scene. NPCs, locations, threads, and comments are shared across adventures.' +
    '</p>' +
    '<p>' +
    '<strong>Outline</strong>' +
    ' holds your planned scenes and general notes. Use the arrows to reorder scenes; expand a card to ' +
    'edit its details or link campaign threads. Every field can be left blank.' +
    '</p>' +
    '<p>' +
    '<strong>Campaign threads</strong>' +
    ' follow the campaign across sessions. Add existing threads to a session or make a new one. Name, ' +
    'description, and status are shared; removing a thread from one session keeps it in the campaign.' +
    '</p>' +
    '<p>' +
    '<strong>Locations and NPCs</strong>' +
    ' are shared campaign records too. Create or add them in their tabs, then check them under a scene to ' +
    'link them. Each record lists its sessions and scenes. Removing keeps it in the campaign; deleting ' +
    'removes it everywhere. Existing location and NPC notes stay as free text.' +
    '</p>' +
    '<p>' +
    '<strong>Comments</strong>' +
    ' keep a shared history for each thread, location, or NPC. Add one from a scene or record, choose its ' +
    'session and scene, and optionally choose a location. Each comment keeps the adventure where it was ' +
    'created, even if the session moves later. Open Comments on a record or View comments in a scene to ' +
    'read the whole history. Entries can be edited or deleted individually.' +
    '</p>' +
    '<p>' +
    '<strong>After play</strong>' +
    ' records what happened, the consequences, discoveries, and future hooks. Update the thread statuses ' +
    'here as well.' +
    '</p>' +
    '<h3>Export to Google Docs</h3>' +
    '<ol>' +
    '<li>' +
    'Click ' +
    '<strong>Export .docx</strong>' +
    ' to download the current session.' +
    '</li>' +
    '<li>' +
    'In Google Drive, choose ' +
    '<strong>New → File upload</strong>' +
    ' and select the file.' +
    '</li>' +
    '<li>' +
    'Right-click the uploaded file and choose ' +
    '<strong>Open with → Google Docs</strong>' +
    '.' +
    '</li>' +
    '<li>' +
    'To make a native Google document, choose ' +
    '<strong>File → Save as Google Docs</strong>' +
    ' if it opens in Office editing mode.' +
    '</li>' +
    '</ol>' +
    '<p>' +
    'The export includes the outline, linked threads, current thread statuses, and any notes after play. ' +
    'Its headings and text are editable.' +
    '</p>' +
    '<h3>Saved on this device</h3>' +
    '<p>' +
    'Edits save automatically to this browser at this app’s address. Use the same browser profile and ' +
    'localhost address each time. Clearing site data or using a private window can remove your sessions.' +
    '</p>' +
    '<p>' +
    'A workspace backup keeps all sessions and threads in a JSON file you can restore here. Word exports ' +
    'are for reading and editing; they cannot be imported back as sessions.' +
    '</p>' +
    '<div class="welcome-actions" style="display:flex;gap:8px;margin-top:15px">' +
    `<button type="button" class="secondary" data-action="backup">${renderIcon('backup')} Back up workspace</button>` +
    '<button type="button" class="secondary" data-action="restore">Restore backup</button>' +
    '</div>'
  );
}

/**
 * Render backup file selection instructions.
 * @returns {string}
 */
export function restoreBody() {
  return (
    '<p>' +
    'Choose a JSON backup downloaded from this app. You will see a summary before replacing the current ' +
    'workspace.' +
    '</p>' +
    '<p>' +
    'Restoring replaces all current adventures, sessions, and campaign records. Download a backup first ' +
    'if you want to keep them.' +
    '</p>'
  );
}

/**
 * Render counts from a validated backup before replacement is confirmed.
 * @param {Workspace} workspace Already normalized; this function does not validate it.
 * @returns {string}
 */
export function restorePreviewBody(workspace) {
  return (
    '<p>' +
    'This backup contains ' +
    `<strong>${workspace.adventures.length} adventures</strong>` +
    ', ' +
    `<strong>${workspace.sessions.length} session${workspace.sessions.length === 1 ? '' : 's'}</strong>` +
    ' and ' +
    `<strong>${workspace.threads.length} campaign thread${workspace.threads.length === 1 ? '' : 's'}</strong>` +
    '. It also contains ' +
    `<strong>${workspace.locations.length} locations</strong>` +
    ' and ' +
    `<strong>${workspace.npcs.length} NPCs</strong>` +
    '. It will replace this browser’s current workspace.' +
    '</p>'
  );
}

/**
 * Render a plain text error message inside an HTML paragraph.
 * @param {Error} error
 * @returns {string}
 */
export function restoreErrorBody(error) {
  return `<p>${escapeHtml(error.message)}</p>`;
}

/**
 * Render the explicit stored-data replacement explanation.
 * @returns {string}
 */
export function recoveryBody() {
  return (
    '<p>' +
    'The browser’s original stored data will be replaced with the workspace currently open here. Download ' +
    'a recovery backup first if you may need the original data.' +
    '</p>'
  );
}

/**
 * Render session deletion details and optional unused-thread removal.
 * @param {Session} session
 * @param {string[]} unusedThreads IDs unused by other sessions.
 * @returns {string}
 */
export function deleteSessionBody(session, unusedThreads) {
  return (
    '<p>' +
    `<strong>${escapeHtml(sessionTitle(session))}</strong>` +
    ' and its scenes and notes will be deleted from this browser. Campaign records and their comment ' +
    'histories are kept unless you choose to delete unused threads below. Comments retain their original ' +
    'context labels.' +
    '</p>' +
    `${unusedThreads.length ? '<label class="checkbox-label">' + '<input type="checkbox" name="delete-unused-threads">' + ' Also delete its ' + `${unusedThreads.length}` + ' campaign thread' + `${unusedThreads.length === 1 ? '' : 's'}` + ' that ' + `${unusedThreads.length === 1 ? 'is' : 'are'}` + ' unused by other sessions.' + '</label>' : ''}`
  );
}

/**
 * Render the scene deletion explanation.
 * @param {Scene} scene
 * @returns {string}
 */
export function deleteSceneBody(scene) {
  return (
    '<p>' +
    `<strong>${escapeHtml(sceneTitle(scene))}</strong>` +
    ' will be removed from this session. Campaign records and their comments will be kept with their ' +
    'original context labels.' +
    '</p>'
  );
}

/**
 * Render the campaign-wide thread deletion explanation.
 * @param {CampaignThread} thread
 * @returns {string}
 */
export function deleteThreadBody(thread) {
  return (
    '<p>' +
    `<strong>${escapeHtml(threadName(thread))}</strong>` +
    ' and its comments will be deleted from the campaign and removed from every session and scene. To ' +
    'keep it for later, cancel and use “Remove from session” instead.' +
    '</p>'
  );
}
