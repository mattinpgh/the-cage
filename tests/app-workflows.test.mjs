import test from 'node:test';
import assert from 'node:assert/strict';
import { createSampleState } from '../model.js';

// A small browser stand-in exercises the real registered event handlers.
// Layout and native browser dialogs still need a browser check.
test('locations and NPCs can be created, edited, linked, reused, and deleted through UI actions', async () => {
  const elements = new Map();
  function element(name) {
    if (!elements.has(name)) {
      elements.set(name, {
        innerHTML: '',
        textContent: '',
        value: '',
        open: false,
        listeners: {},
        classList: { add() {}, remove() {}, toggle() {} },
        addEventListener(type, callback) {
          this.listeners[type] = callback;
        },
        showModal() {
          this.open = true;
        },
        close() {
          this.open = false;
        },
        focus() {},
        scrollIntoView() {},
        querySelector(selector) {
          return element(`${name} ${selector}`);
        },
      });
    }
    return elements.get(name);
  }
  const initial = createSampleState();
  const initialId = initial.currentSessionId;
  const sceneId = initial.sessions[0].scenes[0].id;
  const storage = {
    raw: JSON.stringify(initial),
    getItem() {
      return this.raw;
    },
    setItem(key, value) {
      this.raw = value;
    },
  };
  const document = {
    querySelector: element,
    getElementById: element,
    listeners: {},
    addEventListener(type, callback) {
      this.listeners[type] = callback;
    },
  };
  const window = {
    localStorage: storage,
    addEventListener() {},
    matchMedia: () => ({ matches: false }),
  };
  const globals = {
    document,
    window,
    CSS: { escape: (value) => value },
    FormData: class {
      constructor(values) {
        this.values = values;
      }
      get(key) {
        return this.values[key] ?? null;
      }
      has(key) {
        return key in this.values;
      }
    },
    setTimeout: () => 0,
    clearTimeout() {},
  };
  const originals = Object.fromEntries(
    Object.keys(globals).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true,
    });
  function click(action, extra = {}) {
    document.listeners.click({
      target: { closest: () => ({ dataset: { action, ...extra } }) },
    });
  }
  function submit(values = {}) {
    element('#modal').listeners.submit({ target: values, preventDefault() {} });
  }
  const saved = () => JSON.parse(storage.raw);
  try {
    await import('../app.js');
    const thread = saved().threads[0];
    click('add-comment', {
      type: 'threads',
      id: thread.id,
      session: initialId,
      scene: sceneId,
    });
    submit({
      text: 'Thread comment',
      session: initialId,
      scene: sceneId,
      location: '',
    });
    assert.equal(saved().threads[0].comments[0].text, 'Thread comment');
    click('tab', { tab: 'threads' });
    assert.ok(element('#app').innerHTML.includes('Thread comment'));
    for (const type of ['locations', 'npcs']) {
      const idsKey = type === 'locations' ? 'locationIds' : 'npcIds';
      click('tab', { tab: type });
      click('add-record', { type });
      submit({ name: `${type} name`, description: 'Shared description' });
      const record = saved()[type][0];
      click('add-comment', {
        type,
        id: record.id,
        session: initialId,
        scene: sceneId,
      });
      assert.ok(element('#modal').innerHTML.includes('Location (optional)'));
      submit({
        text: 'First scene comment',
        session: initialId,
        scene: sceneId,
        location: type === 'locations' ? record.id : '',
      });
      const comment = saved()[type][0].comments[0];
      assert.equal(comment.sceneId, sceneId);
      assert.equal(comment.locationId, type === 'locations' ? record.id : null);
      click('view-comments', { type, id: record.id });
      assert.ok(element('#modal').innerHTML.includes('First scene comment'));
      click('jump-scene', { session: initialId, id: sceneId });
      assert.equal(element('#modal').open, false);
      click('edit-comment', { type, id: record.id, comment: comment.id });
      submit({ text: 'Edited comment' });
      assert.equal(saved()[type][0].comments[0].text, 'Edited comment');
      assert.ok(
        saved()
          .sessions.find((item) => item.id === initialId)
          [idsKey].includes(record.id),
      );
      element('#app').listeners.change({
        target: {
          dataset: { type, scene: sceneId, id: record.id },
          checked: true,
          matches: (selector) => selector === 'input[data-scope="record-link"]',
        },
      });
      assert.ok(
        saved()
          .sessions.find((item) => item.id === initialId)
          .scenes[0][idsKey].includes(record.id),
      );
      click('new-session');
      submit({ title: `Next ${type}` });
      const nextId = saved().currentSessionId;
      click('tab', { tab: type });
      click('include-record', { type, id: record.id });
      element('#app').listeners.input({
        target: {
          dataset: { scope: 'record', type, field: 'name', id: record.id },
          value: `Renamed ${type}`,
          matches: () => true,
        },
      });
      click('jump-scene', { session: initialId, id: sceneId });
      click('tab', { tab: type });
      assert.ok(element('#app').innerHTML.includes(`Renamed ${type}`));
      assert.ok(element('#app').innerHTML.includes(`data-id="${nextId}"`));
      assert.ok(element('#app').innerHTML.includes('Edited comment'));
      click('delete-comment', { type, id: record.id, comment: comment.id });
      submit();
      assert.deepEqual(saved()[type][0].comments, []);
      click('remove-record', { type, id: record.id });
      assert.equal(saved()[type].length, 1);
      assert.deepEqual(
        saved().sessions.find((item) => item.id === initialId).scenes[0][
          idsKey
        ],
        [],
      );
      click('delete-record', { type, id: record.id });
      submit();
      assert.equal(saved()[type].length, 0);
      assert.ok(
        saved().sessions.every(
          (session) => !session[idsKey].includes(record.id),
        ),
      );
    }
    click('tab', { tab: 'npcs' });
    element('#app').listeners.keydown({
      target: { matches: () => true },
      key: 'ArrowRight',
      preventDefault() {},
    });
    assert.ok(
      element('#app').innerHTML.includes('aria-labelledby="tab-outcomes"'),
    );
    const originalAdventureId = saved().adventures[0].id;
    click('new-adventure');
    submit({ title: 'New test adventure', notes: 'Adventure notes' });
    const newAdventure = saved().adventures.find(
      (item) => item.title === 'New test adventure',
    );
    const firstSession = saved().sessions.find(
      (item) => item.adventureId === newAdventure.id,
    );
    assert.equal(firstSession.scenes.length, 1);
    assert.ok(element('#app').innerHTML.includes('New test adventure'));
    assert.ok(!element('#session-list').innerHTML.includes(initialId));
    click('delete-session');
    assert.equal(
      saved().sessions.filter((item) => item.adventureId === newAdventure.id)
        .length,
      1,
    );
    click('delete-scene', { id: firstSession.scenes[0].id });
    assert.equal(
      saved().sessions.find((item) => item.id === firstSession.id).scenes
        .length,
      1,
    );
    click('edit-adventure');
    submit({ title: 'Renamed adventure', notes: 'Updated notes' });
    assert.ok(element('#app').innerHTML.includes('Renamed adventure'));
    click('new-session');
    submit({ title: 'Moved session', adventure: newAdventure.id });
    const moving = saved().sessions.find(
      (item) => item.title === 'Moved session',
    );
    click('add-comment', {
      type: 'threads',
      id: thread.id,
      session: moving.id,
      scene: moving.scenes[0].id,
    });
    submit({
      text: 'Adventure origin',
      session: moving.id,
      scene: moving.scenes[0].id,
      location: '',
    });
    element('#app').listeners.change({
      target: {
        dataset: { scope: 'session-adventure' },
        value: originalAdventureId,
      },
    });
    assert.equal(
      saved().sessions.find((item) => item.id === moving.id).adventureId,
      originalAdventureId,
    );
    assert.equal(
      saved().threads[0].comments.at(-1).adventureId,
      newAdventure.id,
    );
    click('open-adventure', { id: newAdventure.id });
    assert.equal(saved().currentSessionId, firstSession.id);
    click('delete-adventure');
    submit();
    assert.ok(!saved().adventures.some((item) => item.id === newAdventure.id));
    assert.ok(
      saved().threads[0].comments.some(
        (comment) => comment.text === 'Adventure origin',
      ),
    );
    assert.ok(
      element('#app').innerHTML.includes('data-scope="session-adventure"'),
    );
  } finally {
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
