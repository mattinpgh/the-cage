import { normalizeState } from './workspace-validation.js';

/**
 * The app stores plain objects, not class instances. IDs connect shared records.
 * A scene belongs to one session; a campaign thread may appear in many sessions.
 *
 * @typedef {'open' | 'advanced' | 'resolved' | 'abandoned'} ThreadStatus
 *
 * @typedef {Object} CampaignThread
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {RecordComment[]} comments
 * @property {ThreadStatus} status Current campaign status, shared across sessions.
 *
 * @typedef {Object} CampaignRecord
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {RecordComment[]} comments
 *
 * @typedef {'threadIds' | 'locationIds' | 'npcIds'} RecordIdsKey
 *
 * @typedef {Object} RecordComment
 * @property {string} id
 * @property {string} text
 * @property {string} createdAt ISO timestamp.
 * @property {string | null} adventureId
 * @property {string} adventureLabel Original adventure context.
 * @property {string} sessionId
 * @property {string} sceneId
 * @property {string | null} locationId
 * @property {string} sessionLabel Context snapshot retained after deletion.
 * @property {string} sceneLabel
 * @property {string} locationLabel
 *
 * @typedef {Object} Scene
 * @property {string} id
 * @property {string} title
 * @property {string} purpose
 * @property {string} locations
 * @property {string} npcs
 * @property {string} tension
 * @property {string} goals
 * @property {string[]} locationIds References to shared locations.
 * @property {string[]} npcIds References to shared NPCs.
 * @property {string[]} threadIds IDs of threads also included in the parent session.
 *
 * @typedef {Object} Outcomes
 * @property {string} happened
 * @property {string} consequences
 * @property {string} discoveries
 * @property {string} hooks
 *
 * @typedef {Object} Adventure
 * @property {string} id
 * @property {string} title
 * @property {string} notes
 * @property {string} createdAt
 * @property {string} updatedAt
 *
 * @typedef {Object} Session
 * @property {string} id
 * @property {string} title
 * @property {string | null} adventureId Null on an unattached factory result;
 * set to an existing adventure ID before inserting into a workspace.
 * @property {string} number Text so values such as "01" keep their leading zero.
 * @property {string} date Play date, or an empty string.
 * @property {string} notes
 * @property {Scene[]} scenes Array order is the scene order.
 * @property {string[]} locationIds References to shared locations.
 * @property {string[]} npcIds References to shared NPCs.
 * @property {string[]} threadIds References to campaign threads, not copies.
 * @property {Outcomes} outcomes
 * @property {string} createdAt ISO timestamp.
 * @property {string} updatedAt ISO timestamp.
 *
 * @typedef {Object} Workspace
 * @property {number} version Storage schema version; currently 4.
 * @property {Adventure[]} adventures
 * @property {Session[]} sessions
 * @property {CampaignRecord[]} locations
 * @property {CampaignRecord[]} npcs
 * @property {CampaignThread[]} threads
 * @property {string | null} currentSessionId
 *
 * @typedef {Object} StorageReader
 * @property {(key: string) => string | null} getItem Read serialized data;
 * return null for an unused key. May throw when storage is unavailable.
 *
 * @typedef {Object} StorageWriter
 * @property {(key: string, value: string) => void} setItem Write serialized data;
 * may throw when storage is unavailable or full.
 *
 * @typedef {Object} LoadResult
 * @property {Workspace} state A new workspace, possibly recovered in memory.
 * @property {string | null} error Null for valid data or an expected upgrade;
 * otherwise an explanation that tells app.js to protect the original data.
 *
 * @typedef {Object} SaveResult
 * @property {boolean} ok Whether the storage write succeeded.
 * @property {string | null} error A failure explanation, or null on success.
 */

// Domain and storage model. The UI and document exporter do not own persistence.
export const STORAGE_KEY = 'sigil-session-desk:v1';
const OUTCOME_KEYS = ['happened', 'consequences', 'discoveries', 'hooks'];

/**
 * Generate an identifier using crypto.randomUUID when available, or a fallback.
 * Does not modify a workspace.
 * @returns {string} Identifier for a newly constructed record.
 */
export function createId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

/**
 * Construct an unattached adventure object. This does not create its sessions.
 * Use addAdventure in adventures.js to insert an adventure and its first session.
 * @param {Object} [options={}] Plain text fields; no validation is performed here.
 * @param {string} [options.title='']
 * @param {string} [options.notes='']
 * @returns {Adventure} A new object with timestamps; no existing state is changed.
 */
export function createAdventure({ title = '', notes = '' } = {}) {
  const now = new Date().toISOString();
  return {
    id: createId(),
    title,
    notes,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Construct an unattached session with its first blank scene and empty links.
 * The caller must assign a valid adventureId before inserting it into a workspace.
 * @param {Object} [options={}] Plain text fields; no validation is performed here.
 * @param {string} [options.title='']
 * @param {string} [options.number=''] Text preserves values such as "01".
 * @param {string} [options.date=''] Play date, or empty text.
 * @param {string | null} [options.adventureId=null]
 * @returns {Session} A new session; arrays and outcomes are not shared with other sessions.
 */
export function createSession({
  title = '',
  number = '',
  date = '',
  adventureId = null,
} = {}) {
  const now = new Date().toISOString();
  return {
    id: createId(),
    title,
    adventureId,
    number,
    date,
    notes: '',
    scenes: [createScene()],
    threadIds: [],
    locationIds: [],
    npcIds: [],
    outcomes: Object.fromEntries(OUTCOME_KEYS.map((key) => [key, ''])),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Construct a blank scene with independent association arrays.
 * @returns {Scene} A new object; the caller chooses the owning session.
 */
export function createScene() {
  return {
    id: createId(),
    title: '',
    purpose: '',
    locations: '',
    npcs: '',
    tension: '',
    goals: '',
    threadIds: [],
    locationIds: [],
    npcIds: [],
  };
}

/**
 * Construct an unattached campaign thread with open status and no comments.
 * @returns {CampaignThread} A new object; no workspace or session is changed.
 */
export function createThread() {
  return {
    id: createId(),
    name: '',
    description: '',
    status: 'open',
    comments: [],
  };
}

/**
 * Construct an empty version 4 workspace without reading or writing storage.
 * @returns {Workspace} A new workspace with no selected session.
 */
export function createEmptyState() {
  return {
    version: 4,
    adventures: [],
    sessions: [],
    threads: [],
    locations: [],
    npcs: [],
    currentSessionId: null,
  };
}

/**
 * Construct a complete sample adventure, session, scenes, and shared threads.
 * @returns {Workspace} A new workspace; existing browser data is not read or changed.
 */
export function createSampleState() {
  const debt = {
    ...createThread(),
    name: 'A debt to the wrong cutter',
    description:
      'The party owes a minor Sigil broker a favour. Someone has quietly bought the debt, and the terms are changing.',
  };
  const brother = {
    ...createThread(),
    name: 'The missing brother',
    description:
      'One PC’s brother vanished after taking work as a porter. A witness places him near a sealed bathhouse in the Hive.',
  };
  const door = {
    ...createThread(),
    name: 'The door that remembers',
    description:
      'An unreliable portal appears to recognise people who have never used it. Its key may be a memory rather than an object.',
  };
  const adventure = createAdventure({
    title: 'A debt in the Hive',
  });
  const session = createSession({
    adventureId: adventure.id,
    title: 'A debt in the Hive',
    number: '01',
  });
  session.notes =
    'Sample session — change or delete any of this.\nKeep the choices open: the party can bargain, investigate, call in a favour, or walk away. Let neglected problems move forward.\nAim for about 3½ hours of play; follow the party’s lead.';
  session.threadIds = [debt.id, brother.id, door.id];
  session.scenes = [
    {
      ...createScene(),
      title: 'A summons at the tea stall',
      purpose:
        'Put the changed debt in front of the party and offer several ways to respond.',
      locations: 'A canvas tea stall off Ragpicker’s Square, Hive Ward',
      npcs: 'Neris Vale, a tired broker’s runner; a cranium rat that keeps stealing sugar',
      tension:
        'Neris needs an answer before dusk, but refuses to say who now holds the debt. She is frightened, not loyal.',
      goals:
        'Learn who bought the debt; protect their freedom to choose; decide whether Neris is worth helping.',
      threadIds: [debt.id],
    },
    {
      ...createScene(),
      title: 'A name in the porter’s ledger',
      purpose:
        'Give the party a useful lead without requiring a fight or a single correct approach.',
      locations: 'A porter’s lodging above a shuttered junk shop',
      npcs: 'Old Jessa, lodging keeper; Pell, a porter with a badly bandaged hand',
      tension:
        'Jessa has the ledger but needs protection for her tenants. Pell knows more, and fears being found.',
      goals:
        'Find evidence of the missing brother; choose what promises to make; follow or ignore the bathhouse lead.',
      threadIds: [brother.id, debt.id],
    },
    {
      ...createScene(),
      title: 'The door beneath the bathhouse',
      purpose:
        'Reveal a consequential choice and leave space for an unexpected solution.',
      locations: 'An abandoned bathhouse cellar, Hive Ward',
      npcs: 'A nameless doorkeeper, paid to count arrivals rather than stop them',
      tension:
        'The portal asks each traveller to surrender a small, treasured memory. The brother’s mark is scratched into its frame.',
      goals:
        'Learn where the portal leads; decide what a rescue is worth; find another key or another route.',
      threadIds: [brother.id, door.id],
    },
  ];
  return {
    version: 4,
    adventures: [adventure],
    sessions: [session],
    threads: [debt, brother, door],
    locations: [],
    npcs: [],
    currentSessionId: session.id,
  };
}
/**
 * Read and normalize browser data without writing it back or changing app state.
 * Absent data creates a sample. Expected upgrades have error: null; repairs set
 * error so app.js can lock saving. Read, parse, or normalization failures return
 * an empty workspace and an error message instead of propagating those failures.
 * @param {StorageReader} storage Storage adapter, or an in-memory test substitute.
 * @returns {LoadResult} The caller owns the returned workspace and handles the error.
 */
export function loadState(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) {
      return {
        state: createSampleState(),
        error: null,
      };
    }
    const { state, repaired } = normalizeState(JSON.parse(raw), {
      createId,
      createAdventure,
      createSession,
      createScene,
      outcomeKeys: OUTCOME_KEYS,
    });
    return {
      state,
      error: repaired
        ? 'Some saved data needed repair. The original browser data has not been changed. Export a backup before choosing to replace it.'
        : null,
    };
  } catch (error) {
    return {
      state: createEmptyState(),
      error: `Could not read saved sessions. The original browser data has not been changed. ${error?.message || 'Browser storage is unavailable.'}`,
    };
  }
}

/**
 * Serialize a workspace and attempt a storage write without mutating the input.
 * Serialization and write failures are returned in the result. This low-level
 * function does not check the recovery lock; app.js must decide when to call it.
 * @param {StorageWriter} storage
 * @param {Workspace} state Workspace to serialize.
 * @returns {SaveResult} Success or failure information; no UI is updated here.
 */
export function saveState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return {
      ok: true,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      error: `Could not save to this browser. Export your session to keep a copy. ${error?.message || 'Browser storage is unavailable.'}`,
    };
  }
}

/**
 * Swap a scene with its neighbor by mutating session.scenes in place.
 * Does not save, render, or update timestamps.
 * @param {Session} session
 * @param {string} sceneId
 * @param {'up' | 'down' | -1 | 1} direction
 * @returns {boolean} True if moved; false for an unknown ID/direction or an edge.
 */
export function moveScene(session, sceneId, direction) {
  const index = session.scenes.findIndex((scene) => scene.id === sceneId);
  const offset =
    direction === 'up' || direction === -1
      ? -1
      : direction === 'down' || direction === 1
        ? 1
        : 0;
  const target = index + offset;
  if (index < 0 || !offset || target < 0 || target >= session.scenes.length) {
    return false;
  }
  [session.scenes[index], session.scenes[target]] = [
    session.scenes[target],
    session.scenes[index],
  ];
  return true;
}

/**
 * Remove a scene in place, retaining campaign records and their comments.
 * @param {Session} session Mutated only when a removable scene is found.
 * @param {string} sceneId
 * @returns {boolean} False for an unknown scene or the final scene; otherwise true.
 */
export function removeScene(session, sceneId) {
  const index = session.scenes.findIndex((scene) => scene.id === sceneId);
  if (index < 0 || session.scenes.length <= 1) {
    return false;
  }
  session.scenes.splice(index, 1);
  return true;
}

/**
 * Remove session membership and scene links, keeping the campaign thread.
 * Does not save or update timestamps.
 * @param {Session} session Its threadIds and each scene's threadIds are replaced.
 * @param {string} threadId An unknown ID leaves association contents unchanged.
 * @returns {void}
 */
export function removeThreadFromSession(session, threadId) {
  session.threadIds = session.threadIds.filter((id) => id !== threadId);
  for (const scene of session.scenes) {
    scene.threadIds = scene.threadIds.filter((id) => id !== threadId);
  }
}

/**
 * Delete the thread, its own comments, and every session/scene reference.
 * Mutates the workspace. Does not save or update session timestamps.
 * @param {Workspace} state
 * @param {string} threadId
 * @returns {boolean} False for an unknown thread; true when it was deleted.
 */
export function deleteCampaignThread(state, threadId) {
  const index = state.threads.findIndex((thread) => thread.id === threadId);
  if (index < 0) {
    return false;
  }
  state.threads.splice(index, 1);
  for (const session of state.sessions) {
    removeThreadFromSession(session, threadId);
  }
  return true;
}
