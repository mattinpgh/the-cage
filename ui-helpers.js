// Shared display helpers. These return text or HTML without changing the workspace.
export const statuses = ['open', 'advanced', 'resolved', 'abandoned'];
export const outcomeFields = [
  [
    'happened',
    'What actually happened',
    'The choices they made, the scenes they skipped, the moments worth remembering…',
  ],
  [
    'consequences',
    'Consequences',
    'Who was helped, who was crossed, and what changes because of it?',
  ],
  [
    'discoveries',
    'Discoveries',
    'What did the party learn? What did they misunderstand?',
  ],
  [
    'hooks',
    'Future hooks',
    'Loose ends, new opportunities, and a few possibilities for next time…',
  ],
];
export const iconPaths = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  up: '<path d="m6 14 6-6 6 6"/>',
  down: '<path d="m6 10 6 6 6-6"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5"/>',
  notes: '<path d="M8 3h12v18H4V7zM8 3v4H4M8 11h8M8 15h8"/>',
  threads:
    '<path d="M7 6a3 3 0 1 0 0 .1M17 18a3 3 0 1 0 0 .1M7 9v5a4 4 0 0 0 4 4h3M10 6h7"/>',
  link: '<path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 0) scale(.9)"/>',
  feather:
    '<path d="M20 3C11 1 4 8 5 16l-2 5M5 16c8 1 15-6 15-13ZM5 16 16 7M10 12l1 5"/>',
  shield: '<path d="M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6zM8 12l3 3 5-6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1.5 1-1.5 1.5-1.5 3M12 17h.01"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  book: '<path d="M12 5C8 2 3 3 3 3v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2ZM12 5v16"/>',
  circle:
    '<circle cx="12" cy="12" r="8"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5"/>',
  backup: '<path d="M4 8a8 8 0 1 1-1 7M4 3v5h5M12 8v5l3 2"/>',
};
/**
 * Render a registered inline SVG icon, falling back to the notes icon.
 * @param {string} name Trusted icon key, not raw user-supplied SVG.
 * @returns {string} HTML; does not modify state or the DOM.
 */
export const renderIcon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.notes}</svg>`;
export const brandMark =
  '<svg viewBox="0 0 42 46" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="21" cy="23" r="13.5" stroke-width="1"/><circle cx="21" cy="23" r="9.3" stroke-width=".7"/><path d="M21 1v44M2 23h38M8 10l26 26M8 36l26-26" stroke-width=".7"/><path d="m21 6 3 14 12 3-12 3-3 14-3-14-12-3 12-3z" stroke-width="1.1"/></svg>';
/**
 * Convert a value to text and escape HTML-sensitive characters; null/undefined become empty text.
 * Use for user text inserted into HTML. Does not modify the input.
 * @param {unknown} value
 * @returns {string} Escaped text, not an HTML element.
 */
export const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c],
  );
/**
 * Get an unescaped display title without changing the session.
 * @param {import('./model.js').Session} session
 * @returns {string} Trimmed title, or "Untitled session".
 */
export const sessionTitle = (session) =>
  session.title.trim() || 'Untitled session';
/**
 * Get an unescaped display title without changing the scene.
 * @param {import('./model.js').Scene} scene
 * @returns {string} Trimmed title, or "Untitled scene".
 */
export const sceneTitle = (scene) => scene.title.trim() || 'Untitled scene';
/**
 * Get an unescaped display name without changing the thread.
 * @param {import('./model.js').CampaignThread} thread
 * @returns {string} Trimmed name, or "Untitled thread".
 */
export const threadName = (thread) => thread.name.trim() || 'Untitled thread';
/**
 * Pad a display value to at least two characters, without truncating longer values.
 * @param {number | string} value
 * @returns {string}
 */
export const formatCount = (value) => String(value).padStart(2, '0');
/**
 * Render a badge for an already-validated thread status.
 * @param {import('./model.js').ThreadStatus} status Trusted status key.
 * @returns {string} HTML; no state or DOM changes.
 */
export const renderStatusBadge = (status) =>
  `<span class="status ${status}">${status}</span>`;

/**
 * Select the shared campaign threads included in a session.
 * @param {import('./model.js').Workspace} state
 * @param {import('./model.js').Session} session
 * @returns {import('./model.js').CampaignThread[]} New array containing the original
 * shared objects, not cloned threads. The function itself does not mutate them.
 */
export function getSessionThreads(state, session) {
  return state.threads.filter((thread) =>
    session.threadIds.includes(thread.id),
  );
}

/**
 * Check whether any outcome field contains non-whitespace text.
 * @param {import('./model.js').Session} session
 * @returns {boolean} No session fields are changed.
 */
export function hasOutcomes(session) {
  return Object.values(session.outcomes).some((value) => value.trim());
}
