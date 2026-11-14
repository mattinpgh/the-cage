/**
 * @typedef {import('./model.js').Workspace} Workspace
 * @typedef {Object} CommentActions
 * @property {(button: HTMLElement) => void} addCommentDialog Choose context, then insert on submit.
 * @property {(button: HTMLElement) => void} viewComments Show the full shared history.
 * @property {(button: HTMLElement) => void} editCommentDialog Edit text while keeping origin context.
 * @property {(button: HTMLElement) => void} confirmDeleteComment Delete only after confirmation.
 */

import {
  commentTypes,
  findCommentRecord,
  addComment,
  editComment,
  deleteComment,
} from './comments.js';
import {
  newCommentBody,
  viewCommentsBody,
  editCommentBody,
  deleteCommentBody,
} from './dialog-views.js';

// Comment dialogs coordinate domain operations with callbacks supplied by app.js; they do not own workspace state.

/**
 * Build comment actions using a live state getter and application callbacks.
 * Button data-type/data-id identify the subject; data-comment selects an existing
 * comment, and optional data-session/data-scene preselect creation context.
 * Unknown subjects are ignored. Blank text and addComment validation failures
 * are reported through notify. State ownership stays with app.js.
 * @param {Object} dependencies
 * @param {() => Workspace} dependencies.getState Return the latest shared workspace.
 * @param {(options: import('./dialog-views.js').DialogOptions) => void} dependencies.openDialog
 * @param {() => boolean} dependencies.saveWorkspace Respect recovery locking; return write success.
 * @param {() => void} dependencies.render
 * @param {(message: string) => void} dependencies.notify
 * @returns {CommentActions} Methods mutate records only after dialog submission.
 */
export function createCommentActions({
  getState,
  openDialog,
  saveWorkspace,
  render,
  notify,
}) {
  /**
   * Choose existing context and open the add-comment form; no data changes yet.
   * The submit callback validates text, adds the comment/associations, and requests
   * saving and rendering. No suitable scene produces a notice instead of a form.
   * @param {HTMLElement} button Subject IDs and optional context come from dataset.
   * @returns {void}
   */
  function addCommentDialog(button) {
    const { type, id } = button.dataset;
    const record = findCommentRecord(getState(), type, id);
    if (!record) {
      return;
    }
    const sessions = getState().sessions.filter(
      (session) => session.scenes.length,
    );
    if (!sessions.length) {
      notify('Add a scene before adding a contextual comment.');
      return;
    }
    const session =
      sessions.find(
        (item) =>
          item.id === (button.dataset.session || getState().currentSessionId),
      ) || sessions[0];
    const idsKey = commentTypes[type].idsKey;
    const scene =
      session.scenes.find((item) => item.id === button.dataset.scene) ||
      session.scenes.find((item) => item[idsKey].includes(id)) ||
      session.scenes[0];
    const defaultLocation =
      type === 'locations'
        ? id
        : scene.locationIds.length === 1
          ? scene.locationIds[0]
          : null;
    openDialog({
      title: `Comment on ${record.name.trim() || 'Untitled ' + commentTypes[type].singular}`,
      submitText: 'Add comment',
      body: newCommentBody({
        state: getState(),
        sessions,
        session,
        scene,
        defaultLocation,
      }),
      onSubmit: (data) => {
        const text = String(data.get('text') || '');
        if (!text.trim()) {
          notify('Enter a comment before saving.');
          return;
        }
        try {
          addComment(getState(), type, id, {
            text,
            sessionId: String(data.get('session') || ''),
            sceneId: String(data.get('scene') || ''),
            locationId: String(data.get('location') || '') || null,
          });
          saveWorkspace();
          render();
          notify('Comment added.');
        } catch (error) {
          notify(error.message);
        }
      },
    });
  }

  function viewComments(button) {
    const { type, id } = button.dataset;
    const record = findCommentRecord(getState(), type, id);
    if (!record) {
      return;
    }
    openDialog({
      title: `Comments: ${record.name.trim() || 'Untitled record'}`,
      body: viewCommentsBody(record, getState(), type),
      submitText: 'Back to the desk',
      cancel: false,
      onSubmit: () => {},
    });
  }

  function editCommentDialog(button) {
    const { type, id, comment: commentId } = button.dataset;
    const record = findCommentRecord(getState(), type, id);
    const comment = record?.comments.find((item) => item.id === commentId);
    if (!comment) {
      return;
    }
    openDialog({
      title: 'Edit comment',
      submitText: 'Save comment',
      body: editCommentBody(comment, getState()),
      onSubmit: (data) => {
        if (!editComment(record, commentId, String(data.get('text') || ''))) {
          notify('Enter a comment before saving.');
          return;
        }
        saveWorkspace();
        render();
        notify('Comment saved.');
      },
    });
  }

  function confirmDeleteComment(button) {
    const { type, id, comment: commentId } = button.dataset;
    const record = findCommentRecord(getState(), type, id);
    if (!record?.comments.some((comment) => comment.id === commentId)) {
      return;
    }
    openDialog({
      title: 'Delete this comment?',
      submitText: 'Delete comment',
      danger: true,
      body: deleteCommentBody(),
      onSubmit: () => {
        deleteComment(record, commentId);
        saveWorkspace();
        render();
        notify('Comment deleted.');
      },
    });
  }
  return {
    addCommentDialog,
    viewComments,
    editCommentDialog,
    confirmDeleteComment,
  };
}
