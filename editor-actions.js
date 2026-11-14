/**
 * @typedef {import('./model.js').Workspace} Workspace
 * @typedef {import('./model.js').Session} Session
 * @typedef {import('./campaign-records.js').RecordType} RecordType
 *
 * @typedef {Object} EditorActions
 * @property {() => void} newAdventureDialog Open a form; insert on submission.
 * @property {() => void} editAdventureDialog Open the current adventure's edit form.
 * @property {() => void} confirmDeleteAdventure Delete only after confirmation.
 * @property {() => void} newSessionDialog Open a session form or start an adventure.
 * @property {() => void} addThreadDialog Open a thread creation form.
 * @property {(session: Session, type: RecordType) => void} addRecordDialog
 * @property {(session: Session, type: RecordType, id: string) => void} includeRecord
 * @property {(session: Session, type: RecordType, id: string) => void} removeRecord
 * @property {(type: RecordType, id: string) => void} confirmDeleteRecord
 * @property {() => void} addSampleSession Append and select the sample adventure.
 * @property {(session: Session) => void} downloadSessionDocument Export; notify on failure.
 * @property {(session: Session) => void} confirmDeleteSession Keep the final session.
 * @property {(session: Session) => void} addScene Append, save, render, and focus a scene.
 * @property {(session: Session, id: string, button: HTMLElement) => void} reorderScene
 * @property {(session: Session, id: string) => void} confirmDeleteScene Keep the final scene.
 * @property {(session: Session, id: string) => void} includeThread
 * @property {(session: Session, id: string) => void} removeThread
 * @property {(id: string) => void} confirmDeleteThread
 */

import {
  addAdventure,
  getSessionAdventure,
  deleteAdventure,
} from './adventures.js';
import {
  recordTypes,
  createCampaignRecord,
  removeRecordFromSession,
  deleteCampaignRecord,
} from './campaign-records.js';
import {
  createSession,
  createScene,
  createThread,
  createSampleState,
  moveScene,
  removeScene,
  removeThreadFromSession,
  deleteCampaignThread,
} from './model.js';
import { exportSessionDocx } from './export-docx.js';
import {
  newAdventureBody,
  editAdventureBody,
  deleteAdventureBody,
  newSessionBody,
  newThreadBody,
  newRecordBody,
  deleteRecordBody,
  deleteSessionBody,
  deleteSceneBody,
  deleteThreadBody,
} from './dialog-views.js';

// Editor actions change workspace data, then ask app.js to save and render. State is always read through the supplied getter.

/**
 * Build related action functions without copying or taking ownership of state.
 * Returned actions mutate the caller's live workspace and request save/render
 * callbacks. Dialog actions defer edits/deletion until their submit callback runs.
 * All getters must refer to the same current workspace, including after restore.
 * @param {Object} dependencies
 * @param {() => Workspace} dependencies.getState Return the live workspace, not a snapshot.
 * @param {() => Session | null} dependencies.getCurrentSession
 * @param {() => Set<string>} dependencies.getExpandedSceneIds Return the live UI set.
 * @param {(sceneIds: string[]) => void} dependencies.resetOutline Select Outline and replace expansion state.
 * @param {(options: import('./dialog-views.js').DialogOptions) => void} dependencies.openDialog
 * @param {() => boolean} dependencies.saveWorkspace Respect recovery locking; return write success.
 * @param {(session?: Session | null) => void} dependencies.saveSessionChanges Timestamp and request saving.
 * @param {() => void} dependencies.render Refresh the page from current application state.
 * @param {(message: string) => void} dependencies.notify
 * @param {(sceneId: string) => void} dependencies.focusScene Scroll and focus after rendering.
 * @param {Document} dependencies.document Browser DOM or a test stand-in.
 * @param {{escape: (value: string) => string}} dependencies.CSS Selector escaping API.
 * @returns {EditorActions} Actions wired to the supplied callbacks.
 */
export function createEditorActions({
  getState,
  getCurrentSession,
  getExpandedSceneIds,
  resetOutline,
  openDialog,
  saveWorkspace,
  saveSessionChanges,
  render,
  notify,
  focusScene,
  document,
  CSS,
}) {
  function newAdventureDialog() {
    openDialog({
      title: 'New adventure',
      submitText: 'Create adventure',
      body: newAdventureBody(),
      onSubmit: (data) => {
        addAdventure(getState(), {
          title: String(data.get('title') || ''),
          notes: String(data.get('notes') || ''),
        });
        resetOutline([getCurrentSession().scenes[0].id]);
        saveWorkspace();
        render();
        notify('Adventure created with its first session and scene.');
      },
    });
  }

  function editAdventureDialog() {
    const adventure = getSessionAdventure(getState(), getCurrentSession());
    if (!adventure) {
      return;
    }
    openDialog({
      title: 'Edit adventure',
      submitText: 'Save adventure',
      body: editAdventureBody(adventure),
      onSubmit: (data) => {
        adventure.title = String(data.get('title') || '');
        adventure.notes = String(data.get('notes') || '');
        adventure.updatedAt = new Date().toISOString();
        saveWorkspace();
        render();
      },
    });
  }

  function confirmDeleteAdventure() {
    const adventure = getSessionAdventure(getState(), getCurrentSession());
    if (!adventure) {
      return;
    }
    const sessions = getState().sessions.filter(
      (session) => session.adventureId === adventure.id,
    );
    openDialog({
      title: 'Delete this adventure?',
      submitText: 'Delete adventure',
      danger: true,
      body: deleteAdventureBody(adventure, sessions),
      onSubmit: () => {
        deleteAdventure(getState(), adventure.id);
        resetOutline([getCurrentSession()?.scenes[0]?.id].filter(Boolean));
        saveWorkspace();
        render();
        notify('Adventure deleted. Campaign records and comments kept.');
      },
    });
  }

  /**
   * Open session creation, or adventure creation if the workspace is empty.
   * Submission inserts a session, selects it, requests saving, and renders.
   * @returns {void} Opening the dialog alone does not insert records.
   */
  function newSessionDialog() {
    if (!getState().adventures.length) {
      newAdventureDialog();
      return;
    }
    const active = getState().threads.filter((thread) =>
      ['open', 'advanced'].includes(thread.status),
    );
    openDialog({
      title: 'A new session',
      submitText: 'Create session',
      body: newSessionBody(getState(), active, getCurrentSession()),
      onSubmit: (data) => {
        const adventureId = String(
          data.get('adventure') ||
            getCurrentSession()?.adventureId ||
            getState().adventures[0].id,
        );
        if (
          !getState().adventures.some(
            (adventure) => adventure.id === adventureId,
          )
        ) {
          return;
        }
        const session = createSession({
          adventureId,
          title: String(data.get('title') || ''),
          number: String(data.get('number') || ''),
          date: String(data.get('date') || ''),
        });
        if (data.has('carry')) {
          session.threadIds = active.map((thread) => thread.id);
        }
        getState().sessions.unshift(session);
        getState().currentSessionId = session.id;
        resetOutline([session.scenes[0].id]);
        saveSessionChanges(session);
        render();
        notify('New session created.');
      },
    });
  }

  function addThreadDialog() {
    const session = getCurrentSession();
    if (!session) {
      return;
    }
    openDialog({
      title: 'A thread to follow',
      submitText: 'Add to session',
      body: newThreadBody(),
      onSubmit: (data) => {
        const thread = {
          ...createThread(),
          name: String(data.get('name') || ''),
          description: String(data.get('description') || ''),
          status: String(data.get('status') || 'open'),
        };
        getState().threads.push(thread);
        session.threadIds.push(thread.id);
        saveSessionChanges(session);
        render();
        notify('Thread added to this session.');
      },
    });
  }

  /**
   * Open NPC/location creation; insert and link the record only on submission.
   * @param {Session} session Current session receiving the new record's ID.
   * @param {RecordType} type Unsupported types are ignored.
   * @returns {void}
   */
  function addRecordDialog(session, type) {
    if (!Object.hasOwn(recordTypes, type)) {
      return;
    }
    const { singular } = recordTypes[type];
    openDialog({
      title: `New ${singular}`,
      submitText: 'Add to session',
      body: newRecordBody(singular),
      onSubmit: (data) => {
        const record = createCampaignRecord();
        record.name = String(data.get('name') || '');
        record.description = String(data.get('description') || '');
        getState()[type].push(record);
        session[recordTypes[type].idsKey].push(record.id);
        saveSessionChanges(session);
        render();
        notify(`${singular} added to this session.`);
      },
    });
  }

  function includeRecord(session, type, id) {
    if (!Object.hasOwn(recordTypes, type)) {
      return;
    }
    const { idsKey } = recordTypes[type];
    if (
      !getState()[type].some((record) => record.id === id) ||
      session[idsKey].includes(id)
    ) {
      return;
    }
    session[idsKey].push(id);
    saveSessionChanges(session);
    render();
  }

  function removeRecord(session, type, id) {
    if (!Object.hasOwn(recordTypes, type)) {
      return;
    }
    removeRecordFromSession(session, type, id);
    saveSessionChanges(session);
    render();
    notify('Removed from this session. Still in the campaign.');
  }

  function confirmDeleteRecord(type, id) {
    if (!Object.hasOwn(recordTypes, type)) {
      return;
    }
    const record = getState()[type].find((item) => item.id === id);
    if (!record) {
      return;
    }
    openDialog({
      title: `Delete this ${recordTypes[type].singular}?`,
      submitText: 'Delete from campaign',
      danger: true,
      body: deleteRecordBody(record),
      onSubmit: () => {
        deleteCampaignRecord(getState(), type, id);
        saveSessionChanges();
        render();
        notify('Deleted from the campaign.');
      },
    });
  }

  function addSampleSession() {
    const sample = createSampleState();
    getState().adventures.push(...sample.adventures);
    getState().sessions.push(...sample.sessions);
    getState().threads.push(...sample.threads);
    getState().locations.push(...sample.locations);
    getState().npcs.push(...sample.npcs);
    getState().currentSessionId = sample.currentSessionId;
    resetOutline([getCurrentSession().scenes[0].id]);
    saveSessionChanges();
    render();
    notify('Sample session added. Edit or delete anything.');
  }

  function downloadSessionDocument(session) {
    try {
      exportSessionDocx(
        session,
        getState().threads,
        getState().locations,
        getState().npcs,
        getSessionAdventure(getState(), session),
      );
      notify('Word document downloaded. Open it with Google Docs.');
    } catch (error) {
      notify(`Could not export: ${error.message}`);
    }
  }

  function confirmDeleteSession(session) {
    if (
      getState().sessions.filter(
        (item) => item.adventureId === session.adventureId,
      ).length <= 1
    ) {
      notify(
        'Keep at least one session per adventure. Delete the adventure to remove it entirely.',
      );
      return;
    }
    const unusedThreads = session.threadIds.filter(
      (threadId) =>
        !getState().sessions.some(
          (other) =>
            other.id !== session.id && other.threadIds.includes(threadId),
        ),
    );
    openDialog({
      title: 'Delete this session?',
      submitText: 'Delete session',
      danger: true,
      body: deleteSessionBody(session, unusedThreads),
      onSubmit: (data) => {
        getState().sessions = getState().sessions.filter(
          (item) => item.id !== session.id,
        );
        if (data.has('delete-unused-threads')) {
          unusedThreads.forEach((threadId) =>
            deleteCampaignThread(getState(), threadId),
          );
        }
        getState().currentSessionId =
          getState().sessions.find(
            (item) => item.adventureId === session.adventureId,
          )?.id ??
          getState().sessions[0]?.id ??
          null;
        resetOutline([getCurrentSession()?.scenes[0]?.id].filter(Boolean));
        saveWorkspace();
        render();
        notify(
          data.has('delete-unused-threads')
            ? 'Session and its unused threads deleted.'
            : 'Session deleted. Campaign threads kept.',
        );
      },
    });
  }

  /**
   * Append a scene, expand it, request saving/rendering, then focus its title.
   * @param {Session} session The current session from the caller's workspace; mutated.
   * @returns {void} Save feedback is handled by app.js, not returned from this action.
   */
  function addScene(session) {
    const scene = createScene();
    session.scenes.push(scene);
    getExpandedSceneIds().add(scene.id);
    saveSessionChanges();
    render();
    focusScene(scene.id);
  }

  /**
   * Move a scene and restore focus after a successful reorder.
   * @param {Session} session The current session; its scene order may change.
   * @param {string} id
   * @param {HTMLElement} button Supplies data-direction="up" or "down".
   * @returns {void} Invalid moves leave data and UI unchanged.
   */
  function reorderScene(session, id, button) {
    if (moveScene(session, id, button.dataset.direction)) {
      saveSessionChanges();
      render();
      const control = document.querySelector(
        `[data-action="move-scene"][data-id="${CSS.escape(id)}"][data-direction="${button.dataset.direction}"]`,
      );
      if (control && !control.disabled) {
        control.focus();
      } else {
        document
          .getElementById(`scene-${id}`)
          ?.querySelector('.scene-title')
          ?.focus();
      }
    }
  }

  function confirmDeleteScene(session, id) {
    if (session.scenes.length <= 1) {
      notify(
        'Keep at least one scene per session. Delete the session or adventure to remove it entirely.',
      );
      return;
    }
    const scene = session.scenes.find((item) => item.id === id);
    if (!scene) {
      return;
    }
    openDialog({
      title: 'Delete this scene?',
      submitText: 'Delete scene',
      danger: true,
      body: deleteSceneBody(scene),
      onSubmit: () => {
        removeScene(session, id);
        getExpandedSceneIds().delete(id);
        saveSessionChanges();
        render();
        notify('Scene deleted.');
      },
    });
  }

  function includeThread(session, id) {
    if (
      !session.threadIds.includes(id) &&
      getState().threads.some((thread) => thread.id === id)
    ) {
      session.threadIds.push(id);
      saveSessionChanges();
      render();
      notify('Thread added to this session.');
    }
  }

  function removeThread(session, id) {
    removeThreadFromSession(session, id);
    saveSessionChanges();
    render();
    notify('Removed from this session. Still in the campaign.');
  }

  function confirmDeleteThread(id) {
    const thread = getState().threads.find((item) => item.id === id);
    if (!thread) {
      return;
    }
    openDialog({
      title: 'Delete this campaign thread?',
      submitText: 'Delete from campaign',
      danger: true,
      body: deleteThreadBody(thread),
      onSubmit: () => {
        deleteCampaignThread(getState(), id);
        saveSessionChanges();
        render();
        notify('Thread deleted from the campaign.');
      },
    });
  }
  return {
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
  };
}
