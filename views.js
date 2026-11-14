/**
 * These view helpers expect normalized workspace records and return HTML.
 * They do not mutate those records, write storage, or update the DOM. app.js's
 * render function inserts the returned strings into the page.
 *
 * @typedef {import('./model.js').Workspace} Workspace
 * @typedef {import('./model.js').Session} Session
 * @typedef {import('./model.js').Scene} Scene
 * @typedef {import('./model.js').CampaignThread} CampaignThread
 * @typedef {import('./comments.js').CommentRecord} CommentRecord
 * @typedef {import('./campaign-records.js').RecordType} RecordType
 * @typedef {'outline' | 'threads' | 'locations' | 'npcs' | 'outcomes'} WorkspaceTab
 */

import {
  adventureOptions,
  adventurePicker,
  adventureHeading,
} from './adventure-views.js';
import { adventureTitle, getSessionAdventure } from './adventures.js';
import { commentsView, commentButton } from './comment-views.js';
import { recordTypes, recordName } from './campaign-records.js';
// HTML generation only: inputs describe the workspace; returned strings describe the page.
import {
  statuses,
  outcomeFields,
  renderIcon,
  brandMark,
  escapeHtml,
  sceneTitle,
  sessionTitle,
  threadName,
  formatCount,
  renderStatusBadge,
  getSessionThreads,
  hasOutcomes,
} from './ui-helpers.js';
/**
 * Render the selected session tab and its surrounding session interface.
 * @param {Session} session
 * @param {Workspace} state
 * @param {WorkspaceTab} activeTab
 * @param {Set<string>} expandedSceneIds
 * @returns {string}
 */
export function sessionPage(session, state, activeTab, expandedSceneIds) {
  let panelHtml;
  if (activeTab === 'outline') {
    panelHtml = outlineView(session, state, expandedSceneIds);
  } else if (activeTab === 'threads') {
    panelHtml = threadsView(session, state);
  } else if (activeTab === 'locations' || activeTab === 'npcs') {
    panelHtml = recordsView(session, state, activeTab);
  } else {
    panelHtml = outcomesView(session, state);
  }
  const tabsHtml = [
    ['outline', 'Outline', 'notes', session.scenes.length],
    ['threads', 'Campaign threads', 'threads', session.threadIds.length],
    ['locations', 'Locations', 'book', session.locationIds.length],
    ['npcs', 'NPCs', 'book', session.npcIds.length],
    ['outcomes', 'After play', 'feather', null],
  ]
    .map(
      ([key, label, symbol, count]) =>
        '<button' +
        ` id="tab-${key}"` +
        ' role="tab"' +
        ` aria-selected="${activeTab === key}"` +
        ' aria-controls="session-panel"' +
        ` tabindex="${activeTab === key ? '0' : '-1'}"` +
        ` class="tab ${activeTab === key ? 'active' : ''}"` +
        ' data-action="tab"' +
        ` data-tab="${key}">` +
        `${renderIcon(symbol)}` +
        `${label}` +
        `${count !== null ? `<span class="count">${formatCount(count)}</span>` : ''}` +
        '</button>',
    )
    .join('');
  return (
    '<section class="session-heading" aria-label="Session details">' +
    '<div class="eyebrow">' +
    '<span class="small-line"></span>' +
    'AD&D 2E ' +
    '<span>·</span>' +
    ' PLANESCAPE ' +
    '<span>·</span>' +
    ' SIGIL' +
    '</div>\n    ' +
    '<div class="heading-row">' +
    '<input' +
    ' class="title-input"' +
    ' data-scope="session"' +
    ' data-field="title"' +
    ' aria-label="Session title"' +
    ' placeholder="Untitled session"' +
    ` value="${escapeHtml(session.title)}">` +
    '<button' +
    ' class="icon-button delete"' +
    ' data-action="delete-session"' +
    ' aria-label="Delete this session"' +
    ' title="Delete session">' +
    `${renderIcon('trash')}` +
    '</button>' +
    '</div>\n    ' +
    '<p class="subtitle">A few possibilities. A city full of consequences.</p>\n    ' +
    '<div class="metadata">' +
    '<div class="meta-field">' +
    '<label for="session-adventure">Adventure</label>' +
    '<select id="session-adventure" data-scope="session-adventure">' +
    `${adventureOptions(state, session.adventureId)}` +
    '</select>' +
    '</div>' +
    '<div class="meta-field">' +
    '<label for="session-number">Session</label>' +
    '<input' +
    ' id="session-number"' +
    ' name="number"' +
    ' aria-label="Session number"' +
    ' data-scope="session"' +
    ' data-field="number"' +
    ' placeholder="—"' +
    ` value="${escapeHtml(session.number)}">` +
    '</div>\n    ' +
    '<div class="meta-field">' +
    '<label for="session-date">Play date</label>' +
    '<input' +
    ' id="session-date"' +
    ' type="date"' +
    ' data-scope="session"' +
    ' data-field="date"' +
    ` value="${escapeHtml(session.date)}">` +
    '</div>' +
    '<span class="sample-tag">LOCAL WORKSPACE</span>' +
    '</div>\n    ' +
    '</section>\n    ' +
    '<div class="tabs" role="tablist" aria-label="Session workspace">' +
    `\n      ${tabsHtml}\n    ` +
    '</div>\n    ' +
    '<div class="content-grid">' +
    '<section' +
    ' class="content-column"' +
    ' id="session-panel"' +
    ' role="tabpanel"' +
    ` aria-labelledby="tab-${activeTab}"` +
    ' tabindex="0">' +
    `${panelHtml}` +
    '</section>' +
    '<aside class="right-rail" id="right-rail" aria-label="Session at a glance">' +
    `${railView(session, state)}` +
    '</aside>' +
    '</div>'
  );
}
/**
 * Render notes and the ordered scene cards.
 * @param {Session} session
 * @param {Workspace} state
 * @param {Set<string>} expandedSceneIds
 * @returns {string}
 */
export function outlineView(session, state, expandedSceneIds) {
  const sceneListHtml = session.scenes.length
    ? session.scenes
        .map((scene, index) =>
          sceneCard(scene, index, session, state, expandedSceneIds),
        )
        .join('')
    : '<div class="empty-state">' +
      `${renderIcon('notes')}` +
      '<h2>Room for the unexpected.</h2>' +
      '<p>Add a scene when you have a possibility worth preparing. Every field is optional.</p>' +
      `<button class="primary" data-action="add-scene">${renderIcon('plus')} Add your first scene</button>` +
      '</div>';
  const addSceneHtml = session.scenes.length
    ? '<button class="dashed" data-action="add-scene">' +
      renderIcon('plus') +
      (' Add another scene' +
        '</button>' +
        '<p class="outline-footnote">An outline is a set of possibilities, not a promise.</p>')
    : '';
  return (
    '<div class="notes-card">' +
    '<label class="notes-heading" for="session-notes">' +
    `${renderIcon('notes')} Session notes ` +
    '<span class="optional">optional</span>' +
    '</label>' +
    '<textarea' +
    ' id="session-notes"' +
    ' data-scope="session"' +
    ' data-field="notes"' +
    ' aria-label="General session notes"' +
    ' placeholder="An opening image, a reminder, something to keep in mind…">' +
    `${escapeHtml(session.notes)}` +
    '</textarea>' +
    '</div>\n    ' +
    '<div class="section-heading">' +
    '<div>' +
    '<h2>Scene outline</h2>' +
    '<p>Follow the party. Keep the possibilities open.</p>' +
    '</div>' +
    `<button class="quiet" data-action="add-scene">${renderIcon('plus')} Add scene</button>` +
    '</div>\n    ' +
    '<div class="scene-list">' +
    `${sceneListHtml}` +
    '</div>' +
    `\n    ${addSceneHtml}`
  );
}
/**
 * Render one scene, its fields, and shared-record link/comment controls.
 * @param {Scene} scene
 * @param {number} index Zero-based scene position.
 * @param {Session} session
 * @param {Workspace} state
 * @param {Set<string>} expandedSceneIds
 * @returns {string}
 */
export function sceneCard(scene, index, session, state, expandedSceneIds) {
  const open = expandedSceneIds.has(scene.id);
  const threads = getSessionThreads(state, session);
  const linked = threads.filter((thread) =>
    scene.threadIds.includes(thread.id),
  );
  const field = (key, label, placeholder) =>
    '<div class="field">' +
    `<label for="${escapeHtml(scene.id)}-${key}">${label}</label>` +
    '<textarea' +
    ` id="${escapeHtml(scene.id)}-${key}"` +
    ' data-scope="scene"' +
    ` data-id="${escapeHtml(scene.id)}"` +
    ` data-field="${key}"` +
    ` placeholder="${placeholder}">` +
    `${escapeHtml(scene[key])}` +
    '</textarea>' +
    '</div>';
  const scenePreviewHtml = !open
    ? `<p class="scene-preview">${escapeHtml(scene.purpose || 'Add a purpose, a tension, a possible choice…')}</p>`
    : '';
  const threadOptionsHtml =
    threads
      .map(
        (thread) =>
          '<div class="scene-record-row">' +
          '<label>' +
          '<input' +
          ' type="checkbox"' +
          ' data-scope="link"' +
          ` data-scene="${escapeHtml(scene.id)}"` +
          ` data-thread="${escapeHtml(thread.id)}"` +
          ` ${scene.threadIds.includes(thread.id) ? 'checked' : ''}>` +
          `${escapeHtml(threadName(thread))}` +
          '</label>' +
          `${commentButton(thread, 'threads', session.id, scene.id)}` +
          '<button' +
          ' class="quiet"' +
          ' data-action="view-comments"' +
          ' data-type="threads"' +
          ` data-id="${escapeHtml(thread.id)}">` +
          `View comments (${thread.comments.length})` +
          '</button>' +
          '</div>',
      )
      .join('') ||
    '<p class="inline-hint">' +
      'No threads in this session yet. ' +
      '<button class="inline-action" data-action="tab" data-tab="threads">Add a campaign thread</button>' +
      '</p>';
  return (
    '<article' +
    ' class="scene-card"' +
    ` id="scene-${escapeHtml(scene.id)}"` +
    ` aria-label="Scene ${index + 1}">` +
    '<div class="scene-header">' +
    `<span class="scene-number" aria-hidden="true">${formatCount(index + 1)}</span>` +
    '<div class="scene-title-group">' +
    '<input' +
    ' class="scene-title"' +
    ' data-scope="scene"' +
    ` data-id="${escapeHtml(scene.id)}"` +
    ' data-field="title"' +
    ` aria-label="Scene ${index + 1} title"` +
    ' placeholder="Untitled scene"' +
    ` value="${escapeHtml(scene.title)}">` +
    `${scenePreviewHtml}` +
    '</div>\n      ' +
    '<div class="scene-controls">' +
    '<button' +
    ' class="icon-button"' +
    ' data-action="move-scene"' +
    ` data-id="${escapeHtml(scene.id)}"` +
    ' data-direction="up"' +
    ` aria-label="Move scene ${index + 1} up"` +
    ' title="Move up"' +
    ` ${index === 0 ? 'disabled' : ''}>` +
    `${renderIcon('up')}` +
    '</button>' +
    '<button' +
    ' class="icon-button"' +
    ' data-action="move-scene"' +
    ` data-id="${escapeHtml(scene.id)}"` +
    ' data-direction="down"' +
    ` aria-label="Move scene ${index + 1} down"` +
    ' title="Move down"' +
    ` ${index === session.scenes.length - 1 ? 'disabled' : ''}>` +
    `${renderIcon('down')}` +
    '</button>' +
    '<span class="divider"></span>' +
    '<button' +
    ' class="icon-button delete"' +
    ' data-action="delete-scene"' +
    ` data-id="${escapeHtml(scene.id)}"` +
    ` aria-label="Delete scene ${index + 1}"` +
    ' title="Delete scene">' +
    `${renderIcon('trash')}` +
    '</button>' +
    '<button' +
    ' class="icon-button"' +
    ' data-action="toggle-scene"' +
    ` data-id="${escapeHtml(scene.id)}"` +
    ` aria-expanded="${open}"` +
    ` aria-controls="scene-body-${escapeHtml(scene.id)}"` +
    ` aria-label="${open ? 'Collapse' : 'Expand'} scene ${index + 1}"` +
    ` title="${open ? 'Collapse' : 'Expand'} scene">` +
    `${renderIcon(open ? 'up' : 'down')}` +
    '</button>' +
    '</div>' +
    '</div>\n    ' +
    '<div' +
    ' class="scene-content"' +
    ` id="scene-body-${escapeHtml(scene.id)}"` +
    ` ${open ? '' : 'hidden'}>` +
    `\n      ${field('purpose', 'Scene purpose', 'What could this scene bring into play?')}\n      ` +
    '<div class="field-grid">' +
    `${field('locations', 'Location notes', 'Where might this happen?')}` +
    `${field('npcs', 'NPC notes', 'Who matters here?')}` +
    `${field('tension', 'Core tension', 'What makes this situation difficult?')}` +
    `${field('goals', 'Party goals', 'What might the PCs want?')}` +
    '</div>\n      ' +
    '<details class="thread-linker">' +
    '<summary>' +
    `${renderIcon('link')} Campaign threads ` +
    `<span class="linked-count">${linked.length ? formatCount(linked.length) + ' linked' : 'Link a thread'}</span>` +
    `<span class="chevron">${renderIcon('down')}</span>` +
    '</summary>' +
    '<div class="thread-options">' +
    `${threadOptionsHtml}` +
    '</div>' +
    '</details>\n      ' +
    `${sceneRecordLinks(scene, session, state, 'locations')}\n      ` +
    `${sceneRecordLinks(scene, session, state, 'npcs')}\n      ` +
    `<div class="linked-chips" data-chips="${escapeHtml(scene.id)}">` +
    `${linked
      .map(
        (thread) =>
          `<span class="linked-chip">${escapeHtml(threadName(thread))}</span>`,
      )
      .join('')}` +
    '</div>\n    ' +
    '</div>' +
    '</article>'
  );
}
/**
 * Render session threads and reusable campaign-library entries.
 * @param {Session} session
 * @param {Workspace} state
 * @returns {string}
 */
export function threadsView(session, state) {
  const threads = getSessionThreads(state, session);
  const otherThreads = state.threads.filter(
    (thread) => !session.threadIds.includes(thread.id),
  );
  const threadCardsHtml = threads.length
    ? threads.map((thread) => threadCard(thread, state)).join('')
    : '<div class="empty-state">' +
      `${renderIcon('threads')}` +
      '<h2>Something worth following.</h2>' +
      '<p>A personal debt. A missing person. A door that should stay shut. Keep only the threads that matter.</p>' +
      `<button class="primary" data-action="add-thread">${renderIcon('plus')} Create a thread</button>` +
      '</div>';
  const threadLibraryHtml = otherThreads.length
    ? '<details class="thread-library" open>' +
      '<summary>' +
      'Other campaign threads ' +
      `<span class="optional">${formatCount(otherThreads.length)}</span>` +
      '</summary>' +
      '<p class="inline-hint">Bring an existing thread into this session.</p>' +
      `${otherThreads
        .map(
          (thread) =>
            '<div class="library-row">' +
            '<div>' +
            `<strong>${escapeHtml(threadName(thread))}</strong>` +
            ` ${renderStatusBadge(thread.status)}` +
            `<p>${escapeHtml(thread.description)}</p>` +
            `${threadReferences(thread, state)}${commentsView(thread, state, 'threads')}` +
            '</div>' +
            `<button class="secondary" data-action="include-thread" data-id="${escapeHtml(thread.id)}">` +
            `${renderIcon('plus')} Add` +
            '</button>' +
            '<button' +
            ' class="icon-button delete"' +
            ' data-action="delete-thread"' +
            ` data-id="${escapeHtml(thread.id)}"` +
            ` aria-label="Delete ${escapeHtml(threadName(thread))} from campaign"` +
            ' title="Delete from campaign">' +
            `${renderIcon('trash')}` +
            '</button>' +
            '</div>',
        )
        .join('')}` +
      '</details>'
    : '';
  return (
    '<div class="section-heading">' +
    '<div>' +
    '<h2>Campaign threads</h2>' +
    '<p>The loose ends that pull the party forward.</p>' +
    '</div>' +
    `<button class="quiet" data-action="add-thread">${renderIcon('plus')} New thread</button>` +
    '</div>\n    ' +
    '<p class="callout">' +
    'Threads belong to the campaign. Add the ones that matter to this session, then link them to scenes ' +
    'in your outline. Status and description edits carry across all sessions.' +
    '</p>' +
    `\n    ${threadCardsHtml}\n    ${threadLibraryHtml}`
  );
}
/**
 * Render a thread status select; supported statuses come from ui-helpers.js.
 * @param {CampaignThread} thread
 * @param {string} [scope='thread'] Trusted data-scope value; the editor uses thread.
 * @returns {string}
 */
export function statusSelect(thread, scope = 'thread') {
  return (
    '<select' +
    ' class="status-select"' +
    ` aria-label="Status of ${escapeHtml(threadName(thread))}"` +
    ` data-scope="${scope}"` +
    ' data-field="status"' +
    ` data-id="${escapeHtml(thread.id)}">` +
    `${statuses
      .map(
        (status) =>
          `<option value="${status}" ${thread.status === status ? 'selected' : ''}>` +
          `${status[0].toUpperCase() + status.slice(1)}` +
          '</option>',
      )
      .join('')}` +
    '</select>'
  );
}
// Read associations from the whole workspace so this list stays current after edits.
/**
 * Render current adventure/session/scene references for a shared thread.
 * @param {CampaignThread} thread
 * @param {Workspace} state
 * @returns {string}
 */
export function threadReferences(thread, state) {
  return recordReferences(thread, state, 'threadIds');
}

/**
 * Group current attachments by adventure, session, and scene.
 * @param {CommentRecord} record
 * @param {Workspace} state
 * @param {import('./model.js').RecordIdsKey} idsKey
 * @returns {string}
 */
export function recordReferences(record, state, idsKey) {
  const attachedSessions = state.sessions.filter((session) =>
    session[idsKey].includes(record.id),
  );

  if (attachedSessions.length === 0) {
    return '<p class="inline-hint">Not attached to any sessions yet.</p>';
  }

  const adventureIds = [
    ...new Set(attachedSessions.map((session) => session.adventureId)),
  ];
  const adventureItems = adventureIds.map((adventureId) => {
    const adventure = state.adventures.find((item) => item.id === adventureId);
    const label = `Adventure: ${adventureTitle(adventure)}`;
    const adventureLink = adventure
      ? `<a href="#main" data-action="open-adventure" data-id="${escapeHtml(adventure.id)}">${escapeHtml(label)}</a>`
      : escapeHtml(label);
    const sessionItems = attachedSessions
      .filter((session) => session.adventureId === adventureId)
      .map((session) => {
        const sceneItems = session.scenes.flatMap((scene, index) => {
          if (!scene[idsKey].includes(record.id)) {
            return [];
          }
          return [
            '<li>' +
              '<a' +
              ` href="#scene-${escapeHtml(scene.id)}"` +
              ' data-action="jump-scene"' +
              ` data-session="${escapeHtml(session.id)}"` +
              ` data-id="${escapeHtml(scene.id)}">` +
              `Scene ${index + 1}: ${escapeHtml(sceneTitle(scene))}` +
              '</a>' +
              '</li>',
          ];
        });
        const sceneList = sceneItems.length
          ? '<ul>' + `${sceneItems.join('')}` + '</ul>'
          : '';
        const sessionNumber = session.number.trim() || '—';
        return (
          '<li>' +
          `<a href="#main" data-action="open-session" data-id="${escapeHtml(session.id)}">` +
          `Session ${escapeHtml(sessionNumber)}: ${escapeHtml(sessionTitle(session))}` +
          '</a>' +
          `${sceneList}` +
          '</li>'
        );
      });
    return (
      '<li>' +
      `${adventureLink}` +
      '<ul>' +
      `${sessionItems.join('')}` +
      '</ul>' +
      '</li>'
    );
  });
  return (
    '<ul class="thread-reference-list">' +
    `${adventureItems.join('')}` +
    '</ul>'
  );
}

/**
 * Render editable shared thread details, attachments, and full comment history.
 * @param {CampaignThread} thread
 * @param {Workspace} state
 * @returns {string}
 */
export function threadCard(thread, state) {
  return (
    '<article class="thread-card" aria-label="Campaign thread">' +
    '<div class="thread-header">' +
    '<input' +
    ' class="thread-name"' +
    ' data-scope="thread"' +
    ` data-id="${escapeHtml(thread.id)}"` +
    ' data-field="name"' +
    ` value="${escapeHtml(thread.name)}"` +
    ' placeholder="Untitled thread"' +
    ' aria-label="Thread name">' +
    `${statusSelect(thread)}` +
    '<button' +
    ' class="icon-button delete"' +
    ' data-action="delete-thread"' +
    ` data-id="${escapeHtml(thread.id)}"` +
    ' aria-label="Delete thread from campaign"' +
    ' title="Delete from campaign">' +
    `${renderIcon('trash')}` +
    '</button>' +
    '</div>\n    ' +
    '<div class="field">' +
    `<label for="thread-desc-${escapeHtml(thread.id)}">The short version</label>` +
    '<textarea' +
    ` id="thread-desc-${escapeHtml(thread.id)}"` +
    ' data-scope="thread"' +
    ` data-id="${escapeHtml(thread.id)}"` +
    ' data-field="description"' +
    ' placeholder="What is at stake, and why might the party care?">' +
    `${escapeHtml(thread.description)}` +
    '</textarea>' +
    '</div>\n    ' +
    '<div class="thread-footer">' +
    '<div class="thread-references">' +
    '<p>Attached sessions and scenes</p>' +
    `${threadReferences(thread, state)}` +
    '</div>' +
    `<button class="quiet" data-action="remove-thread" data-id="${escapeHtml(thread.id)}">Remove from session</button>` +
    '</div>' +
    `${commentsView(thread, state, 'threads')}` +
    '</article>'
  );
}
// Review only this session's records; their comments still show campaign history.
/**
 * Render only the current session's NPCs/locations, with campaign-wide histories.
 * @param {Session} session
 * @param {Workspace} state
 * @param {RecordType} type
 * @returns {string}
 */
export function afterPlayRecords(session, state, type) {
  const { label, singular, idsKey } = recordTypes[type];
  const records = state[type].filter((record) =>
    session[idsKey].includes(record.id),
  );
  const cards = records
    .map(
      (record) =>
        `<article class="thread-card" aria-label="Review ${singular}">\n    ` +
        `<h3 class="rail-title">${escapeHtml(recordName(record, type))}</h3>\n    ` +
        `<p class="record-description">${escapeHtml(record.description)}</p>\n    ` +
        '<div class="thread-references">' +
        '<p>Attached sessions and scenes</p>' +
        `${recordReferences(record, state, idsKey)}` +
        '</div>' +
        `\n    ${commentsView(record, state, type)}\n  ` +
        '</article>',
    )
    .join('');
  return (
    `<section aria-label="Review ${label}">` +
    '<div class="section-heading">' +
    '<div>' +
    `<h2>Review ${label}</h2>` +
    '<p>Record what changed after the party’s choices.</p>' +
    '</div>' +
    `<button class="quiet" data-action="tab" data-tab="${type}">Manage ${label}</button>` +
    '</div>' +
    `${
      cards ||
      `<p class="inline-hint">No ${label} in this session yet. Add them from the ${label} tab.</p>`
    }` +
    '</section>'
  );
}

/**
 * Render outcome fields, shared thread statuses, and NPC/location review.
 * @param {Session} session
 * @param {Workspace} state
 * @returns {string}
 */
export function outcomesView(session, state) {
  const threads = getSessionThreads(state, session);
  const outcomeFieldsHtml = outcomeFields
    .map(
      ([key, label, placeholder]) =>
        '<div class="field">' +
        `<label for="outcome-${key}">${label}</label>` +
        '<textarea' +
        ` id="outcome-${key}"` +
        ' data-scope="outcome"' +
        ` data-field="${key}"` +
        ` placeholder="${placeholder}">` +
        `${escapeHtml(session.outcomes[key])}` +
        '</textarea>' +
        '</div>',
    )
    .join('');
  const threadStatusesHtml = threads.length
    ? threads
        .map(
          (thread) =>
            '<div class="outcome-status-row">' +
            `<span>${escapeHtml(threadName(thread))}</span>` +
            `${statusSelect(thread)}` +
            '<button' +
            ' class="quiet"' +
            ' data-action="view-comments"' +
            ' data-type="threads"' +
            ` data-id="${escapeHtml(thread.id)}">` +
            `View comments (${thread.comments.length})` +
            '</button>' +
            '</div>',
        )
        .join('')
    : '<p class="inline-hint">' +
      'No campaign threads in this session. ' +
      '<button class="inline-action" data-action="tab" data-tab="threads">Add one</button>' +
      ' when you need it.' +
      '</p>';
  return (
    '<div class="section-heading">' +
    '<div>' +
    '<h2>After play</h2>' +
    '<p>The story the party actually told.</p>' +
    '</div>' +
    '</div>\n    ' +
    '<div class="aftermath-intro">' +
    `${renderIcon('feather')}` +
    '<div>' +
    '<strong>Let the consequences settle.</strong>' +
    '<p>Capture a few useful notes for next time. Your planned outline stays above, just as you prepared it.</p>' +
    '</div>' +
    '</div>\n    ' +
    '<div class="outcome-fields">' +
    `${outcomeFieldsHtml}` +
    '</div>\n    ' +
    '<div class="section-heading">' +
    '<div>' +
    '<h2>Where the threads stand</h2>' +
    '<p>Update the campaign after the party’s choices.</p>' +
    '</div>' +
    '</div>' +
    `\n    ${threadStatusesHtml}\n    ` +
    '<p class="help-storage">' +
    'Thread statuses are shared across the campaign. Record the details of what changed in this session’s ' +
    'notes above.' +
    '</p>\n    ' +
    `${afterPlayRecords(session, state, 'npcs')}\n    ` +
    `${afterPlayRecords(session, state, 'locations')}`
  );
}
/**
 * Render the scene navigation and thread summary rail.
 * @param {Session} session
 * @param {Workspace} state
 * @returns {string}
 */
export function railView(session, state) {
  const threads = getSessionThreads(state, session);
  const sceneLinksHtml = session.scenes.length
    ? session.scenes
        .map(
          (scene, index) =>
            `<button class="rail-item" data-action="jump-scene" data-id="${escapeHtml(scene.id)}">` +
            `<span class="rail-num">${formatCount(index + 1)}</span>` +
            `<span>${escapeHtml(sceneTitle(scene))}</span>` +
            '</button>',
        )
        .join('')
    : '<p class="rail-note">No scenes yet. Leave yourself room to follow the party.</p>';
  const threadSummaryHtml = threads.length
    ? threads
        .map(
          (thread) =>
            '<div class="rail-thread">' +
            `<p class="rail-thread-name">${escapeHtml(threadName(thread))}</p>` +
            `${renderStatusBadge(thread.status)}` +
            '<button' +
            ' class="quiet"' +
            ' data-action="view-comments"' +
            ' data-type="threads"' +
            ` data-id="${escapeHtml(thread.id)}">` +
            `View comments (${thread.comments.length})` +
            '</button>' +
            '</div>',
        )
        .join('')
    : '<p class="rail-note">No threads in this session.</p>';
  return (
    '<div class="rail-eyebrow">' +
    'At a glance' +
    '</div>' +
    '<div class="rail-block">' +
    '<h3 class="rail-title">In the outline</h3>' +
    `${sceneLinksHtml}` +
    '</div>\n    ' +
    '<div class="rail-block">' +
    '<div class="rail-label-row">' +
    '<h3 class="rail-title">On the horizon</h3>' +
    '<button class="rail-link" data-action="tab" data-tab="threads">View all</button>' +
    '</div>' +
    `${threadSummaryHtml}` +
    '</div>\n    ' +
    '<div class="rail-block rail-note">' +
    `${renderIcon('circle')}Prepare situations.` +
    '<br>' +
    'Leave the answers to the players.' +
    '</div>'
  );
}
/**
 * Render the empty-workspace starting screen.
 *
 * @returns {string}
 */
export function welcomePage() {
  return (
    '<div class="welcome">' +
    `<span class="brand-mark">${brandMark}</span>` +
    '<div class="eyebrow" style="justify-content:center">' +
    'YOUR PLANESCAPE SESSION DESK' +
    '</div>' +
    '<h1>The city is waiting.</h1>' +
    '<p>' +
    'Start with a few scenes, follow the campaign’s loose ends, and leave room for your players to ' +
    'surprise you.' +
    '</p>' +
    '<div class="welcome-actions">' +
    `<button class="primary" data-action="new-session">${renderIcon('plus')} Prepare a session</button>` +
    '<button class="secondary" data-action="sample">Try the sample</button>' +
    '</div>' +
    '<p class="help-storage">' +
    'Your sessions save automatically in this browser.' +
    '<br>' +
    '<button class="inline-action" data-action="restore">Restore a workspace backup</button>' +
    '</p>' +
    '</div>'
  );
}

/**
 * Render scene checkboxes and comment controls for session NPCs/locations.
 * @param {Scene} scene
 * @param {Session} session
 * @param {Workspace} state
 * @param {RecordType} type
 * @returns {string}
 */
export function sceneRecordLinks(scene, session, state, type) {
  const { label, idsKey } = recordTypes[type];
  const available = state[type].filter((record) =>
    session[idsKey].includes(record.id),
  );
  const options = available
    .map(
      (record) =>
        '<div class="scene-record-row">' +
        '<label>' +
        '<input' +
        ' type="checkbox"' +
        ' data-scope="record-link"' +
        ` data-type="${type}"` +
        ` data-scene="${escapeHtml(scene.id)}"` +
        ` data-id="${escapeHtml(record.id)}"` +
        ` ${scene[idsKey].includes(record.id) ? 'checked' : ''}>` +
        `${escapeHtml(recordName(record, type))}` +
        '</label>' +
        `${commentButton(record, type, session.id, scene.id)}` +
        '<button' +
        ' class="quiet"' +
        ' data-action="view-comments"' +
        ` data-type="${type}"` +
        ` data-id="${escapeHtml(record.id)}">` +
        `View comments (${record.comments.length})` +
        '</button>' +
        '</div>',
    )
    .join('');
  return (
    '<details class="thread-linker">' +
    `<summary>${label}</summary>` +
    '<div class="thread-options">' +
    `${options || '<p>No records in this session yet.</p>'}` +
    `<button class="quiet" data-action="tab" data-tab="${type}">Manage ${label}</button>` +
    '</div>' +
    '</details>'
  );
}

/**
 * Render editable session records and other reusable campaign records.
 * @param {Session} session
 * @param {Workspace} state
 * @param {RecordType} type
 * @returns {string}
 */
export function recordsView(session, state, type) {
  const { label, singular, idsKey } = recordTypes[type];
  const attached = state[type].filter((record) =>
    session[idsKey].includes(record.id),
  );
  const other = state[type].filter(
    (record) => !session[idsKey].includes(record.id),
  );
  const cards = attached
    .map(
      (record) =>
        '<article' +
        ' class="thread-card"' +
        ` id="record-${escapeHtml(record.id)}"` +
        ` aria-label="${singular}">\n    ` +
        '<div class="thread-header">' +
        '<input' +
        ' class="thread-name"' +
        ` aria-label="${singular} name"` +
        ` placeholder="Untitled ${singular}"` +
        ' data-scope="record"' +
        ` data-type="${type}"` +
        ' data-field="name"' +
        ` data-id="${escapeHtml(record.id)}"` +
        ` value="${escapeHtml(record.name)}">` +
        '</div>\n    ' +
        '<div class="field">' +
        `<label for="record-description-${escapeHtml(record.id)}">Description</label>` +
        '<textarea' +
        ` id="record-description-${escapeHtml(record.id)}"` +
        ' data-scope="record"' +
        ` data-type="${type}"` +
        ' data-field="description"' +
        ` data-id="${escapeHtml(record.id)}">` +
        `${escapeHtml(record.description)}` +
        '</textarea>' +
        '</div>\n    ' +
        '<div class="thread-references">' +
        '<p>Attached sessions and scenes</p>' +
        `${recordReferences(record, state, idsKey)}` +
        '</div>' +
        `${commentsView(record, state, type)}\n    ` +
        '<div class="thread-footer">' +
        '<button' +
        ' class="quiet"' +
        ' data-action="remove-record"' +
        ` data-type="${type}"` +
        ` data-id="${escapeHtml(record.id)}">` +
        'Remove from session' +
        '</button>' +
        '<button' +
        ' class="quiet delete"' +
        ' data-action="delete-record"' +
        ` data-type="${type}"` +
        ` data-id="${escapeHtml(record.id)}">` +
        'Delete from campaign' +
        '</button>' +
        '</div>\n  ' +
        '</article>',
    )
    .join('');
  const library = other
    .map(
      (record) =>
        `<article class="thread-card" id="record-${escapeHtml(record.id)}">` +
        `<h3>${escapeHtml(recordName(record, type))}</h3>` +
        `<p class="record-description">${escapeHtml(record.description)}</p>` +
        `${recordReferences(record, state, idsKey)}${commentsView(record, state, type)}` +
        '<div class="thread-footer">' +
        '<button' +
        ' class="secondary"' +
        ' data-action="include-record"' +
        ` data-type="${type}"` +
        ` data-id="${escapeHtml(record.id)}">` +
        'Add to session' +
        '</button>' +
        '<button' +
        ' class="quiet delete"' +
        ' data-action="delete-record"' +
        ` data-type="${type}"` +
        ` data-id="${escapeHtml(record.id)}">` +
        'Delete from campaign' +
        '</button>' +
        '</div>' +
        '</article>',
    )
    .join('');
  return (
    '<div class="section-heading">' +
    `<h2>${label}</h2>` +
    `<button class="quiet" data-action="add-record" data-type="${type}">New ${singular}</button>` +
    '</div>' +
    '<p class="callout">' +
    'Names and descriptions are shared across sessions. Add records here, then link them to scenes in ' +
    'your outline. Existing scene notes remain separate.' +
    '</p>' +
    `${cards || '<p class="inline-hint">None in this session yet.</p>'}` +
    `${
      other.length
        ? '<details class="thread-library" open>' +
          `<summary>Other campaign ${label}</summary>` +
          `${library}` +
          '</details>'
        : ''
    }`
  );
}

/**
 * Render the page shell and the current session, or the welcome screen.
 * @param {Workspace} state
 * @param {Session | null} session
 * @param {WorkspaceTab} activeTab
 * @param {Set<string>} expandedSceneIds
 * @returns {string}
 */
export function workspaceShell(state, session, activeTab, expandedSceneIds) {
  return (
    '<div class="shell">\n    ' +
    '<aside class="sidebar" aria-label="Saved sessions">\n      ' +
    '<div class="brand">' +
    `<span class="brand-mark">${brandMark}</span>` +
    '<div>' +
    '<div class="brand-name">' +
    'THE CAGE' +
    '</div>' +
    '<div class="brand-sub">' +
    'A PLANESCAPE SESSION DESK' +
    '</div>' +
    '</div>' +
    '</div>' +
    `\n      ${adventurePicker(state, session)}\n      ` +
    `<button class="primary new-session" data-action="new-session">${renderIcon('plus')} New session</button>\n      ` +
    '<div class="sidebar-label">' +
    'YOUR SESSIONS ' +
    '<span id="session-count"></span>' +
    '</div>\n      ' +
    '<nav class="session-list" id="session-list" aria-label="Session library"></nav>\n      ' +
    '<div class="sidebar-bottom">' +
    '<div class="local-note">' +
    `${renderIcon('shield')}` +
    '<span>' +
    'Kept on this device.' +
    '<br>' +
    'A little order in the City of Doors.' +
    '</span>' +
    '</div>\n        ' +
    '<div class="sidebar-tools">' +
    `<button class="quiet" data-action="backup">${renderIcon('backup')} Back up workspace</button>` +
    `<button class="quiet" data-action="restore">${renderIcon('download')} Restore a backup</button>` +
    `<button class="quiet" data-action="help">${renderIcon('help')} Help & exporting</button>` +
    '</div>\n      ' +
    '</div>\n    ' +
    '</aside>\n    ' +
    '<div class="main-shell">' +
    '<header class="topbar">' +
    '<div class="breadcrumbs">' +
    '<span>Sigil</span>' +
    '<span class="slash">/</span>' +
    '<strong>Session desk</strong>' +
    '</div>\n      ' +
    '<div class="topbar-actions">' +
    '<span class="save-status" id="save-status" role="status"></span>' +
    '<button' +
    ' class="icon-button"' +
    ' data-action="help"' +
    ' aria-label="Help and exporting"' +
    ' title="Help and exporting">' +
    `${renderIcon('help')}` +
    '</button>' +
    `<button class="secondary export-button" data-action="export" ${session ? '' : 'disabled'}>` +
    `${renderIcon('download')} Export .docx` +
    '</button>' +
    '</div>\n    ' +
    '</header>\n    ' +
    '<main class="main-content" id="main" tabindex="-1">' +
    '<div id="storage-banner"></div>' +
    `${
      session
        ? adventureHeading(state, session) +
          sessionPage(session, state, activeTab, expandedSceneIds)
        : welcomePage()
    }` +
    '</main>' +
    '</div>\n    ' +
    '</div>'
  );
}

/**
 * Render session-library buttons in the order supplied by app.js.
 * @param {Workspace} state
 * @param {Session[]} ordered
 * @returns {string}
 */
export function sessionListHtml(state, ordered) {
  return ordered.length
    ? ordered
        .map(
          (session) =>
            '<button' +
            ` class="session-link ${session.id === state.currentSessionId ? 'active' : ''}"` +
            ' data-action="open-session"' +
            ` data-id="${escapeHtml(session.id)}"` +
            ` ${session.id === state.currentSessionId ? 'aria-current="page"' : ''}>\n    ` +
            '<span class="session-link-top">' +
            `${session.id === state.currentSessionId ? '<span class="active-dot"></span>' : ''}` +
            'SESSION ' +
            `${escapeHtml(session.number.trim() || '—')}` +
            `${hasOutcomes(session) ? ' · PLAYED' : ''}` +
            '</span>\n    ' +
            `<span class="session-link-title">${escapeHtml(sessionTitle(session))}</span>\n    ` +
            '<span class="session-link-bottom">' +
            `${session.scenes.length}` +
            ' scene' +
            `${session.scenes.length === 1 ? '' : 's'}` +
            ' · ' +
            `${session.threadIds.length}` +
            ' thread' +
            `${session.threadIds.length === 1 ? '' : 's'}` +
            '</span>' +
            '</button>',
        )
        .join('')
    : '<p class="sidebar-empty">Your next session starts here.</p>';
}
