import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSampleState,
  createEmptyState,
  createScene,
  createAdventure,
  createSession,
  createId,
  loadState,
} from '../model.js';
import { normalizeState } from '../workspace-validation.js';

function olderWorkspace(version) {
  const state = createSampleState();
  state.version = version;
  if (version < 4) {
    delete state.adventures;
    for (const session of state.sessions) {
      delete session.adventureId;
    }
  }
  if (version < 3) {
    for (const thread of state.threads) {
      delete thread.comments;
    }
  }
  if (version === 1) {
    delete state.locations;
    delete state.npcs;
    for (const session of state.sessions) {
      delete session.locationIds;
      delete session.npcIds;
      for (const scene of session.scenes) {
        delete scene.locationIds;
        delete scene.npcIds;
      }
    }
  }
  return state;
}

function readWithoutWriting(state) {
  const raw = JSON.stringify(state);
  const storage = {
    raw,
    writes: 0,
    getItem() {
      return this.raw;
    },
    setItem(key, value) {
      this.writes++;
      this.raw = value;
    },
  };
  const loaded = loadState(storage);
  assert.equal(
    storage.raw,
    raw,
    'Loading preserves the original serialized data.',
  );
  assert.equal(
    storage.writes,
    0,
    'Only app.js may decide to save after loading.',
  );
  return loaded;
}
for (const version of [1, 2, 3]) {
  test(`version ${version}: expected new fields and an empty outline upgrade without recovery`, () => {
    const state = olderWorkspace(version);
    state.sessions[0].scenes = [];
    state.currentSessionId = null;
    const loaded = readWithoutWriting(state);
    assert.equal(loaded.error, null);
    assert.equal(loaded.state.version, 4);
    assert.equal(loaded.state.adventures[0].title, 'Imported adventure');
    assert.equal(
      loaded.state.sessions[0].adventureId,
      loaded.state.adventures[0].id,
    );
    assert.equal(loaded.state.sessions[0].scenes.length, 1);
    assert.equal(loaded.state.currentSessionId, state.sessions[0].id);
  });
  test(`version ${version}: an invalid existing field still requires recovery during an upgrade`, () => {
    const state = olderWorkspace(version);
    state.threads[0].comments = null;
    state.sessions[0].scenes = null;
    const loaded = readWithoutWriting(state);
    assert.match(loaded.error, /needed repair/);
    assert.deepEqual(loaded.state.threads[0].comments, []);
    assert.equal(loaded.state.sessions[0].scenes.length, 1);
  });
}
test('version 4: missing child records and selection are repairs, not upgrades', () => {
  for (const damage of ['scenes', 'sessions', 'selection']) {
    const state = createSampleState();
    if (damage === 'scenes') {
      state.sessions[0].scenes = [];
    }
    if (damage === 'sessions') {
      state.sessions = [];
    }
    state.currentSessionId = null;
    const loaded = readWithoutWriting(state);
    assert.match(loaded.error, /needed repair/);
    assert.equal(loaded.state.sessions.length, 1);
    assert.ok(loaded.state.sessions[0].scenes.length >= 1);
    assert.equal(loaded.state.currentSessionId, loaded.state.sessions[0].id);
  }
});
test('version 1: absent record arrays upgrade, but explicitly invalid arrays require recovery', () => {
  const missing = olderWorkspace(1);
  assert.equal(readWithoutWriting(missing).error, null);
  for (const type of ['locations', 'npcs']) {
    const state = olderWorkspace(1);
    state[type] = null;
    assert.match(readWithoutWriting(state).error, /needed repair/);
  }
});
test('association validation repairs duplicate, dangling, and missing session memberships', () => {
  const state = createSampleState();
  const session = state.sessions[0];
  const id = session.scenes[0].threadIds[0];
  session.threadIds = [];
  session.scenes[0].threadIds.push(id, 'missing-thread', 42);
  const loaded = readWithoutWriting(state);
  assert.match(loaded.error, /needed repair/);
  const recovered = loaded.state.sessions[0];
  assert.deepEqual(recovered.scenes[0].threadIds, [id]);
  assert.ok(recovered.threadIds.includes(id));
  assert.ok(
    recovered.scenes.every((scene) =>
      scene.threadIds.every((threadId) =>
        recovered.threadIds.includes(threadId),
      ),
    ),
  );
});
test('duplicate record IDs are repaired while unique existing IDs remain intact', () => {
  const state = createSampleState();
  const originalId = state.threads[0].id;
  state.threads.push({
    ...state.threads[0],
  });
  const loaded = readWithoutWriting(state);
  assert.match(loaded.error, /needed repair/);
  assert.equal(loaded.state.threads[0].id, originalId);
  assert.notEqual(loaded.state.threads.at(-1).id, originalId);
  assert.equal(
    new Set(loaded.state.threads.map((thread) => thread.id)).size,
    loaded.state.threads.length,
  );
});
test('expected upgrades do not mutate their supplied input object', () => {
  const input = olderWorkspace(1);
  input.sessions[0].scenes = [];
  const before = JSON.stringify(input);
  function freeze(value) {
    if (value && typeof value === 'object') {
      for (const child of Object.values(value)) {
        freeze(child);
      }
      Object.freeze(value);
    }
  }
  freeze(input);
  const normalized = normalizeState(input, {
    createId,
    createAdventure,
    createSession,
    createScene,
    outcomeKeys: ['happened', 'consequences', 'discoveries', 'hooks'],
  });
  assert.equal(normalized.repaired, false);
  assert.equal(JSON.stringify(input), before);
  assert.notEqual(normalized.state, input);
  assert.notEqual(normalized.state.sessions[0], input.sessions[0]);
});
test('an empty workspace remains empty in every supported schema version', () => {
  for (const version of [1, 2, 3, 4]) {
    const input = createEmptyState();
    input.version = version;
    const loaded = readWithoutWriting(input);
    assert.equal(loaded.error, null);
    assert.deepEqual(loaded.state, createEmptyState());
  }
});
