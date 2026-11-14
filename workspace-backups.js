/**
 * @typedef {import('./model.js').Workspace} Workspace
 * @typedef {Object} ObjectUrlApi
 * @property {(blob: Blob) => string} createObjectURL
 * @property {(url: string) => void} revokeObjectURL
 *
 * @typedef {Object} WorkspaceBackupActions
 * @property {() => void} restoreDialog Open a file chooser flow, then preview before restoring.
 * @property {() => void} downloadWorkspaceBackup Request a download; notify if setup fails.
 */

import { STORAGE_KEY, loadState } from './model.js';
import {
  restoreBody,
  restorePreviewBody,
  restoreErrorBody,
} from './dialog-views.js';

// Backup file handling delegates workspace replacement to app.js. Validation and recovery behavior are unchanged.

/**
 * Build backup actions without caching the active workspace or writing storage.
 * Recovery downloads include original serialized data when it can be read.
 * Restore rejects invalid/repaired/oversized files, previews valid data, and calls
 * restoreWorkspace only after confirmation. File errors open an error dialog.
 * @param {Object} dependencies
 * @param {() => Workspace} dependencies.getState Return the latest workspace after any restore.
 * @param {import('./model.js').StorageReader} dependencies.storage Read original recovery data.
 * @param {() => boolean} dependencies.isRecoveryLocked Read the current recovery flag.
 * @param {(options: import('./dialog-views.js').DialogOptions) => void} dependencies.openDialog
 * @param {(workspace: Workspace) => void} dependencies.restoreWorkspace The owner replaces state and handles saving/rendering.
 * @param {(message: string) => void} dependencies.notify
 * @param {Document} dependencies.document Browser DOM or a test stand-in.
 * @param {ObjectUrlApi} dependencies.URL Object URL creation/revocation API.
 * @param {typeof Blob} dependencies.Blob Browser binary/text container constructor.
 * @param {(callback: () => void, delay: number) => unknown} dependencies.setTimeout Schedule URL cleanup.
 * @returns {WorkspaceBackupActions} Neither method confirms that the user saved a downloaded file.
 */
export function createWorkspaceBackups({
  getState,
  storage,
  isRecoveryLocked,
  openDialog,
  restoreWorkspace,
  notify,
  document,
  URL,
  Blob,
  setTimeout,
}) {
  function downloadText(content, filename) {
    const url = URL.createObjectURL(
      new Blob([content], {
        type: 'application/json',
      }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function backupWorkspace() {
    let content = JSON.stringify(getState(), null, 2),
      suffix = '';
    if (isRecoveryLocked()) {
      // Preserve the original data together with the recoverable in-memory state.
      try {
        content = JSON.stringify(
          {
            original: storage.getItem(STORAGE_KEY),
            recoveredWorkspace: getState(),
          },
          null,
          2,
        );
        suffix = '-recovery';
      } catch {
        /* In-memory backup remains available. */
      }
    }
    downloadText(content, `the-cage-workspace${suffix}.json`);
    notify('Workspace backup downloaded.');
  }

  function restoreDialog() {
    openDialog({
      title: 'Restore a workspace',
      submitText: 'Choose backup file',
      body: restoreBody(),
      onSubmit: () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.addEventListener('change', () => {
          if (input.files?.[0]) {
            readBackup(input.files[0]);
          }
        });
        input.click();
      },
    });
  }

  /**
   * Read and validate a selected file without replacing the active workspace.
   * Validation errors open an error dialog; valid data opens a confirmation dialog.
   * Only that dialog's submit callback asks the owner to replace the workspace.
   * @param {File} file At most 20 MB; may be a file-like test substitute.
   * @returns {Promise<void>} Resolves after validation/dialog setup, not after confirmation.
   */
  async function readBackup(file) {
    try {
      if (file.size > 20 * 1024 * 1024) {
        throw new Error('This backup is too large (maximum 20 MB).');
      }
      const text = await file.text();
      const raw = JSON.parse(text);
      const workspace = raw.recoveredWorkspace || raw;
      const parsed = loadState({
        getItem: () => JSON.stringify(workspace),
      });
      if (parsed.error) {
        throw new Error(
          'The file is not a complete, valid workspace backup. Your current workspace has been kept.',
        );
      }
      openDialog({
        title: 'Replace this workspace?',
        submitText: 'Restore backup',
        danger: true,
        body: restorePreviewBody(parsed.state),
        onSubmit: () => {
          restoreWorkspace(parsed.state);
        },
      });
    } catch (error) {
      openDialog({
        title: 'Could not restore backup',
        body: restoreErrorBody(error),
        submitText: 'Back to the desk',
        cancel: false,
        onSubmit: () => {},
      });
    }
  }

  function downloadWorkspaceBackup() {
    try {
      backupWorkspace();
    } catch {
      notify(
        'Download unavailable. Copy the workspace data in the save notice.',
      );
    }
  }
  return {
    restoreDialog,
    downloadWorkspaceBackup,
  };
}
