import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSampleState,
  createSession,
  createScene,
  loadState,
  saveState,
} from '../model.js';
import {
  createCampaignRecord,
  recordTypes,
  removeRecordFromSession,
  deleteCampaignRecord,
} from '../campaign-records.js';
import { recordsView, sceneRecordLinks } from '../views.js';
import { sessionDocumentModel } from '../export-docx.js';

for (const type of ['locations', 'npcs']) {
  const { idsKey } = recordTypes[type];
  function fixture() {
    const state = createSampleState();
    const record = {
      ...createCampaignRecord(),
      name: 'A <name>',
      description: 'Shared description',
    };
    state[type].push(record);
    const next = createSession({
      title: 'Next session',
      number: '4',
      adventureId: state.adventures[0].id,
    });
    next.scenes.push(createScene());
    state.sessions.push(next);
    for (const session of state.sessions) {
      session[idsKey] = [record.id];
      session.scenes[0][idsKey] = [record.id];
    }
    return { state, record };
  }

  test(`${type}: persist shared records, session membership, and scene links`, () => {
    const { state } = fixture();
    let raw;
    assert.equal(
      saveState(
        {
          setItem(key, value) {
            raw = value;
          },
        },
        state,
      ).ok,
      true,
    );
    const loaded = loadState({ getItem: () => raw });
    assert.equal(loaded.error, null);
    assert.deepEqual(loaded.state, state);
  });

  test(`${type}: removal preserves campaign record and other sessions; deletion removes references`, () => {
    const { state, record } = fixture();
    const first = state.sessions[0];
    const second = state.sessions[1];
    const notes = {
      locations: first.scenes[0].locations,
      npcs: first.scenes[0].npcs,
    };
    removeRecordFromSession(first, type, record.id);
    assert.deepEqual(first[idsKey], []);
    assert.deepEqual(first.scenes[0][idsKey], []);
    assert.deepEqual(second[idsKey], [record.id]);
    assert.equal(state[type][0], record);
    deleteCampaignRecord(state, type, record.id);
    assert.deepEqual(state[type], []);
    assert.deepEqual(second.scenes[0][idsKey], []);
    assert.equal(first.scenes[0].locations, notes.locations);
    assert.equal(first.scenes[0].npcs, notes.npcs);
  });

  test(`${type}: damaged references are repaired without changing stored data`, () => {
    const { state, record } = fixture();
    state.sessions[0][idsKey] = [];
    state.sessions[0].scenes[0][idsKey].push('missing', record.id);
    const raw = JSON.stringify(state);
    const loaded = loadState({ getItem: () => raw });
    assert.ok(loaded.error);
    assert.deepEqual(loaded.state.sessions[0][idsKey], [record.id]);
    assert.deepEqual(loaded.state.sessions[0].scenes[0][idsKey], [record.id]);
    assert.ok(raw.includes('missing'));
  });

  test(`${type}: views show escaped shared names, both sessions, and linked scenes`, () => {
    const { state, record } = fixture();
    const html = recordsView(state.sessions[0], state, type);
    assert.ok(html.includes('A &lt;name&gt;'));
    assert.ok(html.includes('Session 4: Next session'));
    assert.ok(html.includes('Scene 1: Untitled scene'));
    assert.ok(html.includes(`data-session="${state.sessions[1].id}"`));
    const links = sceneRecordLinks(
      state.sessions[0].scenes[0],
      state.sessions[0],
      state,
      type,
    );
    assert.ok(links.includes(`data-id="${record.id}" checked`));
    record.name = 'Updated shared name';
    assert.ok(
      recordsView(state.sessions[1], state, type).includes(
        'Updated shared name',
      ),
    );
  });

  test(`${type}: document export includes records and keeps legacy notes`, () => {
    const { state, record } = fixture();
    const session = state.sessions[0];
    const model = sessionDocumentModel(
      session,
      state.threads,
      state.locations,
      state.npcs,
    );
    assert.ok(model.blocks.some((block) => block.text === record.description));
    assert.ok(model.blocks.some((block) => block.text === record.name));
    assert.ok(
      model.blocks.some((block) => block.text === session.scenes[0][type]),
    );
    assert.ok(
      model.blocks.some(
        (block) =>
          block.label === recordTypes[type].label && block.text === record.name,
      ),
    );
  });
}
