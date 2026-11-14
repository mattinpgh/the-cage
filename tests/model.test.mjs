import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  STORAGE_KEY,
  createSession,
  createScene,
  createThread,
  createSampleState,
  loadState,
  saveState,
  moveScene,
  removeThreadFromSession,
  deleteCampaignThread,
} from '../model.js';

function memoryStorage(raw = null) {
  return {
    raw,
    getItem() {
      return this.raw;
    },
    setItem(key, value) {
      assert.equal(key, STORAGE_KEY);
      this.raw = value;
    },
  };
}

test('existing workspace backup upgrades without losing notes or existing data', async () => {
  const raw = await readFile(
    new URL('../workspaces/the-cage-workspace.json', import.meta.url),
    'utf8',
  );
  const storage = memoryStorage(raw);
  const loaded = loadState(storage);
  assert.equal(loaded.error, null);
  assert.equal(saveState(storage, loaded.state).ok, true);
  const upgraded = JSON.parse(storage.raw);
  assert.equal(upgraded.version, 4);
  assert.deepEqual(upgraded.locations, []);
  assert.deepEqual(upgraded.npcs, []);
  // Remove only new fields to prove that every original field is preserved.
  delete upgraded.adventures;
  delete upgraded.locations;
  delete upgraded.npcs;
  upgraded.version = 1;
  for (const thread of upgraded.threads) delete thread.comments;
  for (const session of upgraded.sessions) {
    delete session.adventureId;
    delete session.locationIds;
    delete session.npcIds;
    for (const scene of session.scenes) {
      delete scene.locationIds;
      delete scene.npcIds;
    }
  }
  assert.deepEqual(upgraded, JSON.parse(raw));
  assert.equal(loadState(storage).error, null);
});

test('reordering scenes respects boundaries and preserves their thread links', () => {
  const {
    sessions: [session],
  } = createSampleState();
  const first = session.scenes[0];
  const links = [...first.threadIds];
  assert.equal(moveScene(session, first.id, 'up'), false);
  assert.equal(moveScene(session, first.id, 'down'), true);
  assert.equal(session.scenes[1], first);
  assert.deepEqual(first.threadIds, links);
  assert.equal(moveScene(session, 'missing', 'down'), false);
});

test('session removal keeps a shared thread; campaign deletion removes every reference', () => {
  const state = createSampleState();
  const original = state.sessions[0];
  const id = original.threadIds[0];
  const next = createSession();
  const scene = createScene();
  scene.threadIds = [id];
  next.threadIds = [id];
  next.scenes.push(scene);
  state.sessions.push(next);
  removeThreadFromSession(original, id);
  assert.ok(state.threads.some((thread) => thread.id === id));
  assert.deepEqual(next.threadIds, [id]);
  assert.ok(original.scenes.every((scene) => !scene.threadIds.includes(id)));
  assert.equal(deleteCampaignThread(state, id), true);
  assert.ok(state.sessions.every((session) => !session.threadIds.includes(id)));
  assert.deepEqual(scene.threadIds, []);
});

test('validation repairs associations in memory and preserves the original stored text', () => {
  const state = createSampleState();
  state.sessions[0].threadIds = [];
  const storage = memoryStorage(JSON.stringify(state));
  const original = storage.raw;
  const loaded = loadState(storage);
  assert.ok(loaded.error);
  assert.equal(storage.raw, original);
  for (const scene of loaded.state.sessions[0].scenes) {
    assert.ok(
      scene.threadIds.every((id) =>
        loaded.state.sessions[0].threadIds.includes(id),
      ),
    );
  }
});

test('corrupt and unsupported storage reports errors; failed writes are reported', () => {
  for (const raw of ['{invalid', '{"version":99,"sessions":[],"threads":[]}']) {
    const storage = memoryStorage(raw);
    assert.ok(loadState(storage).error);
    assert.equal(storage.raw, raw);
  }
  const result = saveState(
    {
      setItem() {
        throw new Error('Storage full');
      },
    },
    createSampleState(),
  );
  assert.equal(result.ok, false);
  assert.match(result.error, /Storage full/);
});

test('new records have independent arrays and outcome objects', () => {
  const first = createSession();
  const second = createSession();
  first.scenes.push(createScene());
  first.outcomes.happened = 'A choice was made.';
  assert.equal(second.scenes.length, 1);
  assert.equal(second.outcomes.happened, '');
  assert.equal(createThread().status, 'open');
});
