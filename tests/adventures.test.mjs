import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyState,
  createSampleState,
  createSession,
  loadState,
  removeScene,
} from '../model.js';
import {
  addAdventure,
  deleteAdventure,
  moveSessionToAdventure,
} from '../adventures.js';
import { addComment } from '../comments.js';
import { commentContext } from '../comment-views.js';
import { recordReferences } from '../views.js';
import { sessionDocumentModel } from '../export-docx.js';

test('new adventures contain a session and scene, and the final scene cannot be removed', () => {
  const state = createEmptyState();
  const adventure = addAdventure(state, {
    title: 'First adventure',
    notes: 'Opening notes',
  });
  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0].adventureId, adventure.id);
  assert.equal(state.sessions[0].scenes.length, 1);
  assert.equal(state.currentSessionId, state.sessions[0].id);
  assert.equal(
    removeScene(state.sessions[0], state.sessions[0].scenes[0].id),
    false,
  );
});

test('records are shared across adventures and comments retain their original adventure after a session moves', () => {
  const state = createSampleState();
  const original = state.adventures[0];
  const session = state.sessions[0];
  const record = state.threads[0];
  const comment = addComment(state, 'threads', record.id, {
    text: 'Original context',
    sessionId: session.id,
    sceneId: session.scenes[0].id,
  });
  const next = addAdventure(state, { title: 'A different adventure' });
  assert.equal(
    moveSessionToAdventure(state, session, next.id),
    false,
    'original adventure must retain a session',
  );
  state.sessions.push(createSession({ adventureId: original.id }));
  assert.equal(moveSessionToAdventure(state, session, next.id), true);
  assert.equal(comment.adventureId, original.id);
  assert.ok(
    commentContext(comment, state).includes(
      `data-action="open-adventure" data-id="${original.id}"`,
    ),
  );
  const nextSession = state.sessions.find(
    (item) => item.adventureId === next.id && item.id !== session.id,
  );
  nextSession.threadIds.push(record.id);
  const references = recordReferences(record, state, 'threadIds');
  assert.ok(references.includes('Adventure: A different adventure'));
  assert.ok(
    references.includes(`data-action="open-session" data-id="${session.id}"`),
  );
  assert.equal(state.threads.filter((item) => item.id === record.id).length, 1);
  const loaded = loadState({ getItem: () => JSON.stringify(state) });
  assert.equal(loaded.error, null);
  assert.deepEqual(loaded.state, state);
});

test('deleting an adventure keeps shared records, comments, and navigable references to surviving adventures', () => {
  const state = createSampleState();
  const session = state.sessions[0];
  const original = state.adventures[0];
  const record = state.threads[0];
  const comment = addComment(state, 'threads', record.id, {
    text: 'Keep this history',
    sessionId: session.id,
    sceneId: session.scenes[0].id,
  });
  const next = addAdventure(state, { title: 'Surviving adventure' });
  deleteAdventure(state, original.id);
  assert.equal(state.adventures.length, 1);
  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0].adventureId, next.id);
  assert.equal(record.comments[0], comment);
  const html = commentContext(comment, state);
  assert.ok(html.includes(`${comment.adventureLabel} (deleted)`));
  assert.ok(!html.includes('data-action="open-adventure"'));
  assert.equal(loadState({ getItem: () => JSON.stringify(state) }).error, null);
});

test('version 3 workspaces gain an adventure and backfill comment context without guessing deleted origins', () => {
  const state = createSampleState();
  const session = state.sessions[0];
  const record = state.threads[0];
  const first = addComment(state, 'threads', record.id, {
    text: 'Older comment',
    sessionId: session.id,
    sceneId: session.scenes[0].id,
  });
  const missing = {
    ...first,
    id: 'deleted-source-comment',
    sessionId: 'deleted-session',
  };
  record.comments.push(missing);
  state.version = 3;
  delete state.adventures;
  for (const item of state.sessions) delete item.adventureId;
  for (const comment of record.comments) {
    delete comment.adventureId;
    delete comment.adventureLabel;
  }
  const raw = JSON.stringify(state);
  const loaded = loadState({ getItem: () => raw });
  assert.equal(loaded.error, null);
  assert.equal(loaded.state.version, 4);
  assert.equal(loaded.state.adventures.length, 1);
  const comments = loaded.state.threads[0].comments;
  assert.equal(comments[0].adventureId, loaded.state.adventures[0].id);
  assert.equal(comments[0].text, 'Older comment');
  assert.equal(comments[1].adventureId, null);
  assert.match(comments[1].adventureLabel, /Unknown/);
  assert.equal(raw, JSON.stringify(state));
});

test('damaged adventure ownership and empty child lists trigger recovery while preserving original storage', () => {
  const state = createSampleState();
  state.sessions[0].adventureId = 'missing';
  state.sessions[0].scenes = [];
  const raw = JSON.stringify(state);
  const loaded = loadState({ getItem: () => raw });
  assert.ok(loaded.error);
  assert.ok(
    loaded.state.adventures.some(
      (adventure) => adventure.id === loaded.state.sessions[0].adventureId,
    ),
  );
  assert.equal(loaded.state.sessions[0].scenes.length, 1);
  assert.equal(raw, JSON.stringify(state));
});

test('session exports identify the adventure and include the original adventure in comment history', () => {
  const state = createSampleState();
  const session = state.sessions[0];
  const record = state.threads[0];
  const comment = addComment(state, 'threads', record.id, {
    text: 'An exported comment',
    sessionId: session.id,
    sceneId: session.scenes[0].id,
  });
  const model = sessionDocumentModel(
    session,
    state.threads,
    state.locations,
    state.npcs,
    state.adventures[0],
  );
  assert.ok(
    model.blocks.some(
      (block) =>
        block.type === 'metadata' &&
        block.text.includes(`Adventure: ${state.adventures[0].title}`),
    ),
  );
  assert.ok(
    model.blocks.some(
      (block) =>
        block.label === 'Comment context' &&
        block.text.startsWith(comment.adventureLabel),
    ),
  );
});
