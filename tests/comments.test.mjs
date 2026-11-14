import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSampleState,
  createSession,
  createScene,
  createThread,
  loadState,
  saveState,
  removeScene,
} from '../model.js';
import {
  createCampaignRecord,
  removeRecordFromSession,
  deleteCampaignRecord,
} from '../campaign-records.js';
import {
  addComment,
  editComment,
  deleteComment,
  commentTypes,
} from '../comments.js';
import { commentsView } from '../comment-views.js';
import { recordsView, threadsView } from '../views.js';
import { sessionDocumentModel } from '../export-docx.js';

function fixture(type) {
  const state = createSampleState();
  const record = type === 'threads' ? createThread() : createCampaignRecord();
  record.name = 'Commented record';
  state[type].push(record);
  const location = { ...createCampaignRecord(), name: 'The <bathhouse>' };
  state.locations.push(location);
  const session = state.sessions[0];
  const scene = session.scenes[0];
  const context = {
    text: 'First <comment>\nSecond line',
    sessionId: session.id,
    sceneId: scene.id,
    locationId: location.id,
  };
  return { state, record, location, session, scene, context };
}

for (const type of Object.keys(commentTypes)) {
  test(`${type}: zero or many independent comments retain session, scene, and optional location`, () => {
    const { state, record, location, session, scene, context } = fixture(type);
    assert.deepEqual(record.comments, []);
    assert.ok(commentsView(record, state, type).includes('No comments yet.'));
    const first = addComment(state, type, record.id, context);
    const second = addComment(state, type, record.id, {
      ...context,
      text: 'Another entry',
      locationId: null,
    });
    assert.notEqual(first.id, second.id);
    assert.equal(first.locationId, location.id);
    assert.equal(second.locationId, null);
    assert.equal(first.sessionId, session.id);
    assert.equal(first.sceneId, scene.id);
    assert.equal(first.locationLabel, location.name);
    assert.ok(session[commentTypes[type].idsKey].includes(record.id));
    assert.ok(scene[commentTypes[type].idsKey].includes(record.id));
    assert.ok(scene.locationIds.includes(location.id));
    for (let index = 0; index < 150; index++)
      addComment(state, type, record.id, {
        ...context,
        text: `Entry ${index}`,
      });
    assert.equal(record.comments.length, 152);
    const html = commentsView(record, state, type);
    assert.ok(html.includes('Comments (152)'));
    assert.ok(html.includes('First &lt;comment&gt;\nSecond line'));
    assert.ok(!html.includes('First <comment>'));
    assert.ok(
      html.includes(`data-session="${session.id}" data-id="${scene.id}"`),
    );
    assert.ok(
      html.includes(
        `data-action="view-comment-location" data-id="${location.id}"`,
      ),
    );
  });

  test(`${type}: comments are visible from other sessions and exports and round-trip through storage`, () => {
    const { state, record, context } = fixture(type);
    addComment(state, type, record.id, context);
    const next = createSession({
      title: 'Later session',
      adventureId: state.adventures[0].id,
    });
    next.scenes.push(createScene());
    // Even an unattached record's library entry exposes the full history.
    state.sessions.push(next);
    state.currentSessionId = next.id;
    const html =
      type === 'threads'
        ? threadsView(next, state)
        : recordsView(next, state, type);
    assert.ok(html.includes('First &lt;comment&gt;'));
    assert.ok(html.includes('Session 01: A debt in the Hive'));
    next[commentTypes[type].idsKey].push(record.id);
    const model = sessionDocumentModel(
      next,
      state.threads,
      state.locations,
      state.npcs,
    );
    assert.ok(
      model.blocks.some(
        (block) => block.label === 'Comment' && block.text === context.text,
      ),
    );
    assert.ok(
      model.blocks.some(
        (block) =>
          block.label === 'Comment context' &&
          block.text.includes('The <bathhouse>'),
      ),
    );
    let raw;
    saveState(
      {
        setItem(key, value) {
          raw = value;
        },
      },
      state,
    );
    const loaded = loadState({ getItem: () => raw });
    assert.equal(loaded.error, null);
    assert.deepEqual(loaded.state, state);
  });

  test(`${type}: source deletion preserves history and avoids broken navigation links`, () => {
    const { state, record, location, session, scene, context } = fixture(type);
    const comment = addComment(state, type, record.id, context);
    removeScene(session, scene.id);
    deleteCampaignRecord(state, 'locations', location.id);
    state.sessions = [];
    state.adventures = [];
    state.currentSessionId = null;
    const html = commentsView(record, state, type);
    assert.ok(html.includes(`${comment.sessionLabel} (deleted)`));
    assert.ok(html.includes(`${comment.sceneLabel} (deleted)`));
    assert.ok(html.includes('The &lt;bathhouse&gt; (deleted)'));
    assert.ok(!html.includes('data-action="jump-scene"'));
    assert.ok(!html.includes('data-action="view-comment-location"'));
    const loaded = loadState({ getItem: () => JSON.stringify(state) });
    assert.equal(loaded.error, null);
    assert.deepEqual(
      loaded.state[type].find((item) => item.id === record.id).comments,
      record.comments,
    );
  });
}

test('editing and deleting individual comments leaves the context and other comments intact', () => {
  const { state, record, context } = fixture('npcs');
  const first = addComment(state, 'npcs', record.id, context);
  const second = addComment(state, 'npcs', record.id, {
    ...context,
    text: 'Keep me',
  });
  const originalContext = { ...first };
  assert.equal(editComment(record, first.id, '  Updated text  '), true);
  assert.deepEqual(first, { ...originalContext, text: 'Updated text' });
  assert.equal(editComment(record, first.id, '   '), false);
  deleteComment(record, first.id);
  assert.deepEqual(record.comments, [second]);
});

test('invalid comments do not change comments or associations', () => {
  const { state, record, context } = fixture('threads');
  for (const patch of [
    { text: '  ' },
    { sceneId: 'missing' },
    { sessionId: 'missing' },
    { locationId: 'missing' },
  ]) {
    const before = JSON.stringify(state);
    assert.throws(() =>
      addComment(state, 'threads', record.id, { ...context, ...patch }),
    );
    assert.equal(JSON.stringify(state), before);
  }
});

test('version 2 backups upgrade quietly while damaged version 3 comments trigger recovery', () => {
  const { state, record } = fixture('npcs');
  state.version = 2;
  for (const type of Object.keys(commentTypes))
    for (const item of state[type]) delete item.comments;
  const old = loadState({ getItem: () => JSON.stringify(state) });
  assert.equal(old.error, null);
  assert.equal(old.state.version, 4);
  assert.deepEqual(
    old.state.npcs.find((item) => item.id === record.id).comments,
    [],
  );
  old.state.npcs[0].comments = [null, { id: 'bad', text: 42 }];
  const raw = JSON.stringify(old.state);
  const loaded = loadState({ getItem: () => raw });
  assert.ok(loaded.error);
  assert.equal(raw, JSON.stringify(old.state));
});
