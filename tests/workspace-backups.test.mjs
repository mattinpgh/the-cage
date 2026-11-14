import test from 'node:test';
import assert from 'node:assert/strict';
import { createSampleState } from '../model.js';
import { createWorkspaceBackups } from '../workspace-backups.js';

// Keep workspace ownership in the caller, just as app.js does.
function backupHarness({ recoveryLocked = false, original = '' } = {}) {
  let workspace = createSampleState();
  let dialog;
  let picker;
  let restores = 0;
  let fileReads = 0;
  const downloads = [];
  const actions = createWorkspaceBackups({
    getState: () => workspace,
    storage: { getItem: () => original },
    isRecoveryLocked: () => recoveryLocked,
    openDialog: (options) => {
      dialog = options;
    },
    restoreWorkspace: (next) => {
      workspace = next;
      restores++;
    },
    notify() {},
    document: {
      createElement(tag) {
        if (tag === 'input') {
          picker = {
            click() {},
            addEventListener(type, callback) {
              this.change = callback;
            },
          };
          return picker;
        }
        return {
          click() {
            downloads.at(-1).filename = this.download;
          },
          remove() {},
        };
      },
      body: { append() {} },
    },
    URL: {
      createObjectURL(blob) {
        downloads.push({ blob });
        return 'blob:test';
      },
      revokeObjectURL() {},
    },
    Blob,
    setTimeout: () => 0,
  });
  return {
    actions,
    downloads,
    get workspace() {
      return workspace;
    },
    get dialog() {
      return dialog;
    },
    get restores() {
      return restores;
    },
    get fileReads() {
      return fileReads;
    },
    async choose(raw, size = raw.length) {
      actions.restoreDialog();
      dialog.onSubmit();
      picker.files = [
        {
          size,
          text: async () => {
            fileReads++;
            return raw;
          },
        },
      ];
      picker.change();
      // Let the file's promise and validation complete without a timed delay.
      await new Promise((resolve) => setImmediate(resolve));
    },
  };
}

test('restore previews before replacing the caller-owned workspace; backup then reads the replacement', async () => {
  const harness = backupHarness();
  const original = harness.workspace;
  const replacement = createSampleState();
  replacement.sessions[0].title = 'Restored session';
  await harness.choose(JSON.stringify(replacement));
  assert.equal(harness.dialog.title, 'Replace this workspace?');
  assert.equal(harness.workspace, original);
  assert.equal(harness.restores, 0);
  harness.dialog.onSubmit();
  assert.equal(harness.restores, 1);
  assert.deepEqual(harness.workspace, replacement);
  harness.actions.downloadWorkspaceBackup();
  assert.deepEqual(
    JSON.parse(await harness.downloads[0].blob.text()),
    replacement,
  );
});

test('invalid JSON and data requiring repairs leave the current workspace untouched', async () => {
  const harness = backupHarness();
  const original = harness.workspace;
  const damaged = createSampleState();
  damaged.sessions[0].adventureId = 'missing-adventure';
  for (const raw of ['{invalid', JSON.stringify(damaged)]) {
    await harness.choose(raw);
    assert.equal(harness.dialog.title, 'Could not restore backup');
    assert.equal(harness.workspace, original);
    assert.equal(harness.restores, 0);
  }
});

test('recovery backups retain original serialized data and can restore the recovered workspace', async () => {
  const harness = backupHarness({ recoveryLocked: true, original: '{broken' });
  harness.actions.downloadWorkspaceBackup();
  assert.equal(
    harness.downloads[0].filename,
    'the-cage-workspace-recovery.json',
  );
  const envelope = JSON.parse(await harness.downloads[0].blob.text());
  assert.equal(envelope.original, '{broken');
  assert.deepEqual(envelope.recoveredWorkspace, harness.workspace);
  await harness.choose(JSON.stringify(envelope));
  assert.equal(harness.restores, 0);
  harness.dialog.onSubmit();
  assert.equal(harness.restores, 1);
  assert.deepEqual(harness.workspace, envelope.recoveredWorkspace);
});

test('oversized backups are rejected before their contents are read', async () => {
  const harness = backupHarness();
  const original = harness.workspace;
  await harness.choose('{}', 21 * 1024 * 1024);
  assert.equal(harness.dialog.title, 'Could not restore backup');
  assert.equal(harness.fileReads, 0);
  assert.equal(harness.workspace, original);
  assert.equal(harness.restores, 0);
});
