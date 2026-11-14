import test from 'node:test';
import assert from 'node:assert/strict';
import { createSampleState } from '../model.js';
import { sessionDocumentModel, buildSessionDocument } from '../export-docx.js';
import { sessionPage } from '../views.js';

test('all workspace tabs render without mutating their explicit input', () => {
  const state = createSampleState();
  const before = JSON.stringify(state);
  const session = state.sessions[0];
  session.title = '<script>alert("test")</script>';
  const expected = JSON.stringify(state);
  for (const tab of ['outline', 'threads', 'locations', 'npcs', 'outcomes']) {
    const html = sessionPage(
      session,
      state,
      tab,
      new Set([session.scenes[0].id]),
    );
    assert.ok(html.includes(`aria-labelledby="tab-${tab}"`));
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(!html.includes('<script>alert'));
    assert.equal(JSON.stringify(state), expected);
  }
  assert.notEqual(before, expected);
});

test('document content includes scene order, shared statuses, and outcomes', () => {
  const {
    sessions: [session],
    threads,
  } = createSampleState();
  threads[0].status = 'resolved';
  session.outcomes.happened = 'The party chose the portal.';
  const model = sessionDocumentModel(session, threads);
  const headings = model.blocks
    .filter((block) => block.type === 'heading2')
    .map((block) => block.text);
  assert.ok(
    headings.indexOf(`1. ${session.scenes[0].title}`) <
      headings.indexOf(`2. ${session.scenes[1].title}`),
  );
  assert.ok(
    model.blocks.some(
      (block) => block.label === 'Status' && block.text === 'Resolved',
    ),
  );
  assert.ok(
    model.blocks.some((block) => block.text === session.outcomes.happened),
  );
});

test('Word archive contains required XML parts and escapes user content', () => {
  const {
    sessions: [session],
    threads,
  } = createSampleState();
  session.title = 'A <door> & a debt';
  const bytes = buildSessionDocument(session, threads);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const files = new Map();
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    assert.equal(
      view.getUint16(offset + 8, true),
      0,
      'ZIP entries are uncompressed',
    );
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const name = decoder.decode(
      bytes.subarray(offset + 30, offset + 30 + nameLength),
    );
    const start = offset + 30 + nameLength + extraLength;
    files.set(name, decoder.decode(bytes.subarray(start, start + size)));
    offset = start + size;
  }
  assert.equal(files.size, 7);
  for (const name of [
    '[Content_Types].xml',
    '_rels/.rels',
    'word/document.xml',
    'word/styles.xml',
  ]) {
    assert.ok(files.has(name), name);
  }
  assert.match(files.get('word/document.xml'), /A &lt;door&gt; &amp; a debt/);
  assert.equal(
    view.getUint32(bytes.length - 22, true),
    0x06054b50,
    'ZIP end record exists',
  );
});

test('thread references list every attached session and scene with navigation links', async () => {
  const { threadReferences } = await import('../views.js');
  const { createSession, createScene } = await import('../model.js');
  const state = createSampleState();
  const thread = state.threads[0];
  const next = createSession({
    title: 'Next <chapter>',
    number: '4',
    adventureId: state.adventures[0].id,
  });
  const unlinked = createScene();
  const linked = createScene();
  linked.title = 'A & B';
  linked.threadIds = [thread.id];
  next.threadIds = [thread.id];
  next.scenes = [unlinked, linked];
  const sessionOnly = createSession({
    title: 'Session only',
    adventureId: state.adventures[0].id,
  });
  sessionOnly.threadIds = [thread.id];
  const unrelated = createSession({
    title: 'Unrelated',
    adventureId: state.adventures[0].id,
  });
  state.sessions.push(next, sessionOnly, unrelated);
  const before = JSON.stringify(state);
  const html = threadReferences(thread, state);
  assert.ok(html.includes('Session 01: A debt in the Hive'));
  assert.ok(html.includes('Session 4: Next &lt;chapter&gt;'));
  assert.ok(html.includes('Scene 2: A &amp; B'));
  assert.ok(html.includes('Session —: Session only'));
  assert.ok(!html.includes('Unrelated'));
  assert.ok(!html.includes(unlinked.id));
  assert.ok(html.includes(`data-session="${next.id}" data-id="${linked.id}"`));
  assert.ok(
    html.includes(`data-action="open-session" data-id="${sessionOnly.id}"`),
  );
  assert.ok(html.includes('<ul><li><a'));
  assert.equal(JSON.stringify(state), before);
});

test('thread references update after unlinking and are visible in the other-threads library', async () => {
  const { threadReferences, threadsView } = await import('../views.js');
  const { createSession, removeThreadFromSession } =
    await import('../model.js');
  const state = createSampleState();
  const thread = state.threads[0];
  const empty = createSession({ adventureId: state.adventures[0].id });
  state.sessions.push(empty);
  const libraryHtml = threadsView(empty, state);
  assert.ok(libraryHtml.includes('Session 01: A debt in the Hive'));
  removeThreadFromSession(state.sessions[0], thread.id);
  assert.equal(
    threadReferences(thread, state),
    '<p class="inline-hint">Not attached to any sessions yet.</p>',
  );
});

test('After play reviews session NPCs and locations with history and links, excluding unattached records', async () => {
  const { createCampaignRecord } = await import('../campaign-records.js');
  const { addComment } = await import('../comments.js');
  const state = createSampleState();
  const session = state.sessions[0];
  for (const [type, idsKey] of [
    ['npcs', 'npcIds'],
    ['locations', 'locationIds'],
  ]) {
    const record = {
      ...createCampaignRecord(),
      name: `Review <${type}>`,
      description: `Description for ${type}`,
    };
    const other = { ...createCampaignRecord(), name: `Unattached ${type}` };
    state[type].push(record, other);
    session[idsKey].push(record.id);
    session.scenes[0][idsKey].push(record.id);
    addComment(state, type, record.id, {
      text: `History for ${type}`,
      sessionId: session.id,
      sceneId: session.scenes[0].id,
    });
  }
  const before = JSON.stringify(state);
  const html = sessionPage(session, state, 'outcomes', new Set());
  for (const type of ['npcs', 'locations']) {
    assert.ok(html.includes(`Review &lt;${type}&gt;`));
    assert.ok(html.includes(`Description for ${type}`));
    assert.ok(html.includes(`History for ${type}`));
    assert.ok(html.includes(`data-action="add-comment" data-type="${type}"`));
    assert.ok(html.includes(`data-action="tab" data-tab="${type}"`));
    assert.ok(!html.includes(`Unattached ${type}`));
  }
  assert.ok(
    html.includes(
      `data-session="${session.id}" data-id="${session.scenes[0].id}"`,
    ),
  );
  assert.ok(html.includes('Where the threads stand'));
  assert.equal(JSON.stringify(state), before);
});
