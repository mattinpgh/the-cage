import { createEditorActions } from './editor-actions.js';
import { createCommentActions } from './comment-actions.js';
import { createWorkspaceBackups } from './workspace-backups.js';
import {
  dialogFrame,
  helpBody,
  recoveryBody,
  commentSceneOptions,
} from './dialog-views.js';
import { moveSessionToAdventure } from './adventures.js';

import { recordTypes } from './campaign-records.js';
import {
  statuses,
  outcomeFields,
  renderIcon,
  escapeHtml,
  sessionTitle,
  threadName,
  formatCount,
  getSessionThreads,
} from './ui-helpers.js';
import { workspaceShell, sessionListHtml, railView } from './views.js';
import { STORAGE_KEY, loadState, saveState } from './model.js';

const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const toast = document.querySelector('#toast');
// Accessing localStorage itself can throw in restricted browsers.
const storage = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};
const initial = loadState(storage);
// Persistent domain data lives in state; tab and expansion choices are temporary UI state.
let state = initial.state;
let storageError = initial.error;
let recoveryLocked = Boolean(initial.error);
let activeTab = 'outline';
let expandedSceneIds = new Set(
  [getCurrentSession()?.scenes[0]?.id].filter(Boolean),
);
let modalSubmit = null;
let toastTimer;

/**
 * Read the current selection without modifying it.
 * @returns {import('./model.js').Session | null} Shared session object, not a copy.
 */
function getCurrentSession() {
  return (
    state.sessions.find((session) => session.id === state.currentSessionId) ||
    null
  );
}

function notify(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('visible');
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3600);
}
// A repaired workspace must not overwrite the original until the user confirms recovery.

/**
 * Save the live workspace only when recovery permits it, then update save feedback.
 * A locked workspace stays in memory; a failed write updates storageError and UI.
 * @returns {boolean} True if written; false if recovery-locked or the write failed.
 */
function saveWorkspace() {
  if (recoveryLocked) {
    updateSaveStatus();
    refreshRecoveryCopy();
    return false;
  }
  const result = saveState(storage, state);
  const previousError = storageError;
  storageError = result.error;
  updateSaveStatus();
  if (previousError !== storageError) {
    renderStorageAlert();
  }
  refreshRecoveryCopy();
  return result.ok;
}

function refreshRecoveryCopy() {
  const copy = document.querySelector('#storage-banner textarea');
  if (copy) {
    copy.value = JSON.stringify(state);
  }
}

/**
 * Update the chosen session's timestamp and request workspace saving.
 * @param {import('./model.js').Session | null} [session=getCurrentSession()]
 * @returns {void} Save success is shown in the UI; it is not returned to the caller.
 */
function saveSessionChanges(session = getCurrentSession()) {
  if (session) {
    session.updatedAt = new Date().toISOString();
  }
  saveWorkspace();
}

function updateSaveStatus() {
  const element = document.querySelector('#save-status');
  if (!element) {
    return;
  }
  element.classList.toggle('failed', Boolean(storageError || recoveryLocked));
  element.innerHTML =
    '<span class="dot"></span>' +
    `${storageError || recoveryLocked ? 'Not saved · see notice' : 'Saved on this device'}`;
}

function renderStorageAlert() {
  const container = document.querySelector('#storage-banner');
  if (!container) {
    return;
  }
  if (!storageError) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML =
    '<div class="storage-alert" role="alert">' +
    '<strong>Your edits are currently in memory.</strong>' +
    '<br>' +
    `${escapeHtml(storageError)}` +
    '<br>\n    ' +
    `<button class="secondary" data-action="backup">${renderIcon('download')} Download backup</button>\n    ` +
    `${
      recoveryLocked
        ? '<button class="secondary" data-action="recover">Replace stored data with this workspace</button>'
        : '<button class="secondary" data-action="retry-save">Try saving again</button>'
    }\n    ` +
    '<details>' +
    '<summary>Copy workspace data if downloads are unavailable</summary>' +
    `<textarea readonly aria-label="Workspace backup data">${escapeHtml(JSON.stringify(state))}</textarea>` +
    '</details>' +
    '</div>';
}

function renderSidebar() {
  const list = document.querySelector('#session-list');
  if (!list) {
    return;
  }
  const adventureId = getCurrentSession()?.adventureId;
  const ordered = state.sessions
    .filter((session) => session.adventureId === adventureId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  list.innerHTML = sessionListHtml(state, ordered);
  const count = document.querySelector('#session-count');
  if (count) {
    count.textContent = formatCount(ordered.length);
  }
}

/**
 * Rebuild the main interface, sidebar, and save/recovery feedback from current state.
 * @returns {void} Writes DOM content; this is not an HTML-returning view helper.
 */
function render() {
  const session = getCurrentSession();
  document.title = `${session ? sessionTitle(session) : 'The Cage'} — Session desk`;
  app.innerHTML = workspaceShell(state, session, activeTab, expandedSceneIds);
  renderSidebar();
  updateSaveStatus();
  renderStorageAlert();
}

function refreshRail() {
  const session = getCurrentSession();
  const rail = document.querySelector('#right-rail');
  if (session && rail) {
    rail.innerHTML = railView(session, state);
  }
}

/**
 * Render and open the native dialog, retaining its callback until submission.
 * The callback receives FormData only after closeDialog clears the old callback.
 * @param {import('./dialog-views.js').DialogOptions} options
 * @returns {void} Opening does not run onSubmit; cancellation discards it.
 */
function openDialog({
  title: heading,
  body,
  submitText = 'Save',
  onSubmit,
  danger = false,
  cancel = true,
}) {
  modalSubmit = onSubmit;
  modal.innerHTML = dialogFrame({ heading, body, submitText, danger, cancel });
  if (!modal.open) {
    modal.showModal();
  }
}

/**
 * Close the native dialog and discard its pending submit callback.
 * @returns {void} Does not run the discarded callback.
 */
function closeDialog() {
  modal.close();
  modalSubmit = null;
}

/**
 * Open the first matching session in an adventure using openSession.
 * @param {string} id Unknown or empty adventures are ignored.
 * @returns {void}
 */
function openAdventure(id) {
  const session = state.sessions.find((item) => item.adventureId === id);
  if (session) {
    openSession(session.id);
  }
}

function viewCommentLocation(id) {
  if (!state.locations.some((record) => record.id === id)) {
    return;
  }
  activeTab = 'locations';
  render();
  document.getElementById(`record-${id}`)?.scrollIntoView({
    block: 'center',
  });
}

function helpDialog() {
  openDialog({
    title: 'A little order in the Cage',
    submitText: 'Back to the desk',
    cancel: false,
    onSubmit: () => {},
    body: helpBody(),
  });
}

function focusScene(sceneId) {
  const element = document.getElementById(`scene-${sceneId}`);
  element?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth',
    block: 'start',
  });
  element?.querySelector('.scene-title')?.focus({
    preventScroll: true,
  });
}

function selectTab(tab, focus = false) {
  if (!['outline', 'threads', 'locations', 'npcs', 'outcomes'].includes(tab)) {
    return;
  }
  activeTab = tab;
  render();
  if (focus) {
    document.querySelector(`#tab-${tab}`)?.focus();
  }
}

function retrySave() {
  saveWorkspace();
  if (!storageError) {
    notify('Workspace saved.');
  }
}

function confirmRecovery() {
  openDialog({
    title: 'Replace the stored data?',
    submitText: 'Replace stored data',
    danger: true,
    body: recoveryBody(),
    onSubmit: () => {
      recoveryLocked = false;
      saveWorkspace();
      render();
    },
  });
}

/**
 * Select an existing session, reset Outline, request saving, and render/focus.
 * @param {string} id Unknown session IDs are ignored.
 * @returns {void}
 */
function openSession(id) {
  if (!state.sessions.some((item) => item.id === id)) {
    return;
  }
  state.currentSessionId = id;
  activeTab = 'outline';
  expandedSceneIds = new Set(
    [getCurrentSession().scenes[0]?.id].filter(Boolean),
  );
  saveWorkspace();
  render();
  document.querySelector('#main')?.focus();
}

function openTab(button) {
  selectTab(button.dataset.tab, true);
}

function toggleScene(id) {
  if (expandedSceneIds.has(id)) {
    expandedSceneIds.delete(id);
  } else {
    expandedSceneIds.add(id);
  }
  render();
  document
    .querySelector(`[data-action="toggle-scene"][data-id="${CSS.escape(id)}"]`)
    ?.focus();
}

/**
 * Select a scene's session, request saving, expand the scene, and focus its title.
 * @param {string} id Scene ID.
 * @param {string} [sessionId=state.currentSessionId] Owning session ID.
 * @returns {void} Unknown sessions or scenes leave state unchanged.
 */
function jumpToScene(id, sessionId = state.currentSessionId) {
  const targetSession = state.sessions.find(
    (session) => session.id === sessionId,
  );
  if (
    !targetSession ||
    !targetSession.scenes.some((scene) => scene.id === id)
  ) {
    return;
  }
  state.currentSessionId = sessionId;
  saveWorkspace();
  activeTab = 'outline';
  expandedSceneIds.add(id);
  render();
  focusScene(id);
}

// Event delegation: one listener handles buttons created by later renders too.

/**
 * Route delegated button/link clicks to named application actions.
 * @param {MouseEvent} event Requires a DOM element target inside an action control.
 * @returns {void} Actions may update state, open dialogs, save, and render.
 */
function handleActionClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) {
    return;
  }
  // Reference links use the same navigation actions as buttons.
  if (button.tagName === 'A') {
    event.preventDefault();
  }
  const action = button.dataset.action;
  const id = button.dataset.id;
  const session = getCurrentSession();
  const workspaceActions = [
    'close-dialog',
    'new-session',
    'new-adventure',
    'open-adventure',
    'help',
    'backup',
    'restore',
    'retry-save',
    'recover',
    'sample',
    'open-session',
  ];
  if (!session && !workspaceActions.includes(action)) {
    return;
  }
  if (
    modal.open &&
    [
      'open-session',
      'open-adventure',
      'jump-scene',
      'view-comment-location',
    ].includes(action)
  ) {
    closeDialog();
  }
  switch (action) {
    case 'close-dialog':
      closeDialog();
      break;
    case 'new-adventure':
      newAdventureDialog();
      break;
    case 'open-adventure':
      openAdventure(id);
      break;
    case 'edit-adventure':
      editAdventureDialog();
      break;
    case 'delete-adventure':
      confirmDeleteAdventure();
      break;
    case 'new-session':
      newSessionDialog();
      break;
    case 'help':
      helpDialog();
      break;
    case 'backup':
      downloadWorkspaceBackup();
      break;
    case 'restore':
      restoreDialog();
      break;
    case 'retry-save':
      retrySave();
      break;
    case 'recover':
      confirmRecovery();
      break;
    case 'sample':
      addSampleSession();
      break;
    case 'open-session':
      openSession(id);
      break;
    case 'tab':
      openTab(button);
      break;
    case 'export':
      downloadSessionDocument(session);
      break;
    case 'delete-session':
      confirmDeleteSession(session);
      break;
    case 'add-scene':
      addScene(session);
      break;
    case 'toggle-scene':
      toggleScene(id);
      break;
    case 'move-scene':
      reorderScene(session, id, button);
      break;
    case 'delete-scene':
      confirmDeleteScene(session, id);
      break;
    case 'jump-scene':
      jumpToScene(id, button.dataset.session);
      break;
    case 'add-comment':
      addCommentDialog(button);
      break;
    case 'view-comments':
      viewComments(button);
      break;
    case 'edit-comment':
      editCommentDialog(button);
      break;
    case 'delete-comment':
      confirmDeleteComment(button);
      break;
    case 'view-comment-location':
      viewCommentLocation(id);
      break;
    case 'add-record':
      addRecordDialog(session, button.dataset.type);
      break;
    case 'include-record':
      includeRecord(session, button.dataset.type, id);
      break;
    case 'remove-record':
      removeRecord(session, button.dataset.type, id);
      break;
    case 'delete-record':
      confirmDeleteRecord(button.dataset.type, id);
      break;
    case 'add-thread':
      addThreadDialog();
      break;
    case 'include-thread':
      includeThread(session, id);
      break;
    case 'remove-thread':
      removeThread(session, id);
      break;
    case 'delete-thread':
      confirmDeleteThread(id);
      break;
  }
}
// Save as the user types, but update only secondary UI so the focused input stays intact.

/**
 * Save editable text while preserving the active input and its cursor.
 * @param {Event} event Input/textarea with data-scope, data-field, and record ID as needed.
 * @returns {void} Updates the selected data field and only the necessary secondary UI.
 */
function handleTextInput(event) {
  const element = event.target;
  if (
    !element.matches('input[data-scope],textarea[data-scope]') ||
    element.type === 'checkbox'
  ) {
    return;
  }
  const { scope, field, id } = element.dataset;
  const session = getCurrentSession();
  if (!session) {
    return;
  }
  if (scope === 'record' && ['name', 'description'].includes(field)) {
    const type = element.dataset.type;
    if (!Object.hasOwn(recordTypes, type)) {
      return;
    }
    const record = state[type].find((item) => item.id === id);
    if (!record) {
      return;
    }
    record[field] = element.value;
  } else if (
    scope === 'session' &&
    ['title', 'number', 'date', 'notes'].includes(field)
  ) {
    session[field] = element.value;
    if (field === 'title') {
      document.title = `${sessionTitle(session)} — Session desk`;
    }
  } else if (
    scope === 'scene' &&
    ['title', 'purpose', 'locations', 'npcs', 'tension', 'goals'].includes(
      field,
    )
  ) {
    const scene = session.scenes.find((item) => item.id === id);
    if (!scene) {
      return;
    }
    scene[field] = element.value;
  } else if (scope === 'thread' && ['name', 'description'].includes(field)) {
    const thread = state.threads.find((item) => item.id === id);
    if (!thread) {
      return;
    }
    thread[field] = element.value;
  } else if (
    scope === 'outcome' &&
    outcomeFields.some(([key]) => key === field)
  ) {
    session.outcomes[field] = element.value;
  } else {
    return;
  }
  saveSessionChanges(session);
  if (['title', 'number'].includes(field) || scope === 'outcome') {
    renderSidebar();
  }
  if (field === 'title' || field === 'name') {
    refreshRail();
  }
}

function handleFieldChange(event) {
  const element = event.target;
  if (element.dataset.scope === 'adventure-navigation') {
    openAdventure(element.value);
    return;
  }
  const session = getCurrentSession();
  if (!session) {
    return;
  }
  if (element.dataset.scope === 'session-adventure') {
    if (!moveSessionToAdventure(state, session, element.value)) {
      notify(
        'Keep at least one session in the original adventure before moving this session.',
      );
    }
    saveWorkspace();
    render();
    return;
  }
  if (element.matches('input[data-scope="record-link"]')) {
    const type = element.dataset.type;
    if (!Object.hasOwn(recordTypes, type)) {
      return;
    }
    const { idsKey } = recordTypes[type];
    const scene = session.scenes.find(
      (item) => item.id === element.dataset.scene,
    );
    const id = element.dataset.id;
    if (!scene || !session[idsKey].includes(id)) {
      return;
    }
    if (element.checked && !scene[idsKey].includes(id)) {
      scene[idsKey].push(id);
    } else if (!element.checked) {
      scene[idsKey] = scene[idsKey].filter((value) => value !== id);
    }
    saveSessionChanges(session);
  } else if (element.matches('select[data-scope="thread"]')) {
    const thread = state.threads.find((item) => item.id === element.dataset.id);
    if (!thread || !statuses.includes(element.value)) {
      return;
    }
    thread.status = element.value;
    saveSessionChanges(session);
    refreshRail();
  } else if (element.matches('input[data-scope="link"]')) {
    const scene = session.scenes.find(
      (item) => item.id === element.dataset.scene,
    );
    const threadId = element.dataset.thread;
    if (!scene || !session.threadIds.includes(threadId)) {
      return;
    }
    scene.threadIds = element.checked
      ? [...new Set([...scene.threadIds, threadId])]
      : scene.threadIds.filter((id) => id !== threadId);
    saveSessionChanges(session);
    const linked = getSessionThreads(state, session).filter((thread) =>
      scene.threadIds.includes(thread.id),
    );
    const card = document.getElementById(`scene-${scene.id}`);
    card.querySelector('.linked-count').textContent = linked.length
      ? formatCount(linked.length) + ' linked'
      : 'Link a thread';
    card.querySelector('.linked-chips').innerHTML = linked
      .map(
        (thread) =>
          `<span class="linked-chip">${escapeHtml(threadName(thread))}</span>`,
      )
      .join('');
  }
}

function handleTabKeydown(event) {
  if (!event.target.matches('[role="tab"]')) {
    return;
  }
  const keys = ['outline', 'threads', 'locations', 'npcs', 'outcomes'];
  const index = keys.indexOf(activeTab);
  let next;
  if (event.key === 'ArrowRight') {
    next = (index + 1) % keys.length;
  }
  if (event.key === 'ArrowLeft') {
    next = (index + keys.length - 1) % keys.length;
  }
  if (event.key === 'Home') {
    next = 0;
  }
  if (event.key === 'End') {
    next = keys.length - 1;
  }
  if (next !== undefined) {
    event.preventDefault();
    selectTab(keys[next], true);
  }
}

function handleDialogSubmit(event) {
  event.preventDefault();
  const callback = modalSubmit;
  const data = new FormData(event.target);
  closeDialog();
  callback?.(data);
}

function handleDialogCancel() {
  modalSubmit = null;
}

/**
 * Reload another tab's changes; lock saving if the saved workspace was removed.
 * @param {StorageEvent} event Unrelated storage keys are ignored.
 * @returns {void} May replace the workspace, dismiss a dialog, and refresh the UI.
 */
function handleStorageChange(event) {
  if (event.key !== STORAGE_KEY && event.key !== null) {
    return;
  }
  // Another tab saved or cleared this app. Read the latest state before the next edit.
  if (event.newValue === null) {
    storageError =
      'The saved workspace was removed in another tab. The open workspace is still in memory; back it up or save it again.';
    recoveryLocked = true;
    renderStorageAlert();
    updateSaveStatus();
    return;
  }
  const latest = loadState(storage);
  state = latest.state;
  storageError = latest.error;
  recoveryLocked = Boolean(latest.error);
  expandedSceneIds = new Set(
    [getCurrentSession()?.scenes[0]?.id].filter(Boolean),
  );
  if (modal.open) {
    closeDialog();
  }
  render();
  notify('Workspace updated from another tab.');
}

// Only the scene choices depend on the session; preserve the draft comment text.

function handleCommentSessionChange(event) {
  if (event.target.id !== 'comment-session') {
    return;
  }
  document.querySelector('#comment-scene').innerHTML = commentSceneOptions(
    state,
    event.target.value,
  );
  document.querySelector('#comment-location').value = '';
}

// Getters keep the extracted actions connected to the current workspace after restore.
const {
  newAdventureDialog,
  editAdventureDialog,
  confirmDeleteAdventure,
  newSessionDialog,
  addThreadDialog,
  addRecordDialog,
  includeRecord,
  removeRecord,
  confirmDeleteRecord,
  addSampleSession,
  downloadSessionDocument,
  confirmDeleteSession,
  addScene,
  reorderScene,
  confirmDeleteScene,
  includeThread,
  removeThread,
  confirmDeleteThread,
} = createEditorActions({
  getState: () => state,
  getCurrentSession,
  getExpandedSceneIds: () => expandedSceneIds,
  resetOutline,
  openDialog,
  saveWorkspace,
  saveSessionChanges,
  render,
  notify,
  focusScene,
  document,
  CSS,
});
const {
  addCommentDialog,
  viewComments,
  editCommentDialog,
  confirmDeleteComment,
} = createCommentActions({
  getState: () => state,
  openDialog,
  saveWorkspace,
  render,
  notify,
});
const { downloadWorkspaceBackup, restoreDialog } = createWorkspaceBackups({
  getState: () => state,
  storage,
  isRecoveryLocked: () => recoveryLocked,
  openDialog,
  restoreWorkspace,
  notify,
  document,
  URL,
  Blob,
  setTimeout,
});

/**
 * Select Outline and replace the expanded-scene set owned by this module.
 * @param {string[]} sceneIds IDs to expand.
 * @returns {void} Does not save or render by itself.
 */
function resetOutline(sceneIds) {
  activeTab = 'outline';
  expandedSceneIds = new Set(sceneIds);
}

/**
 * Replace the active workspace after validation and explicit restore confirmation.
 * Resets recovery/save feedback and Outline selection, then attempts saving and
 * renders. A failed write leaves the restored workspace available in memory.
 * @param {import('./model.js').Workspace} workspace Already validated by readBackup.
 * @returns {void} This is the state-replacement callback supplied to backup actions.
 */
function restoreWorkspace(workspace) {
  state = workspace;
  recoveryLocked = false;
  storageError = null;
  activeTab = 'outline';
  expandedSceneIds = new Set(
    [getCurrentSession()?.scenes[0]?.id].filter(Boolean),
  );
  saveWorkspace();
  render();
  notify(
    storageError
      ? 'Backup opened in memory. Check the save notice.'
      : 'Workspace restored.',
  );
}

// Connect browser events after defining the handlers.
document.addEventListener('click', handleActionClick);
app.addEventListener('input', handleTextInput);
app.addEventListener('change', handleFieldChange);
app.addEventListener('keydown', handleTabKeydown);
modal.addEventListener('submit', handleDialogSubmit);
modal.addEventListener('cancel', handleDialogCancel);
modal.addEventListener('change', handleCommentSessionChange);
window.addEventListener('storage', handleStorageChange);
if (!recoveryLocked) {
  saveWorkspace();
}
render();
