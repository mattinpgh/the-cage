/**
 * @typedef {import('./model.js').Workspace} Workspace
 *
 * @typedef {Object} ModelHelpers
 * @property {typeof import('./model.js').createId} createId
 * @property {typeof import('./model.js').createAdventure} createAdventure
 * @property {typeof import('./model.js').createSession} createSession
 * @property {typeof import('./model.js').createScene} createScene
 * @property {string[]} outcomeKeys Allowed session outcome fields.
 *
 * @typedef {Object} NormalizationResult
 * @property {Workspace} state A new normalized workspace.
 * @property {boolean} repaired Whether recovery must protect the original serialized data.
 */

// Storage normalization has no browser access and never writes saved data.
// Record factories and outcome field names come from model.js, avoiding a circular import.
const THREAD_STATUSES = new Set(['open', 'advanced', 'resolved', 'abandoned']);
const SCENE_FIELDS = [
  'title',
  'purpose',
  'locations',
  'npcs',
  'tension',
  'goals',
];
const COMMENT_FIELDS = [
  'text',
  'createdAt',
  'sessionId',
  'sceneId',
  'sessionLabel',
  'sceneLabel',
  'locationLabel',
];
const SCENE_RECORD_LINKS = [
  ['locations', 'locationIds'],
  ['npcs', 'npcIds'],
];

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Only supported envelopes reach the upgrade and validation steps.

function assertWorkspaceFormat(input) {
  if (
    !isRecord(input) ||
    ![1, 2, 3, 4].includes(input.version) ||
    !Array.isArray(input.sessions) ||
    !Array.isArray(input.threads)
  ) {
    throw new Error('The saved data has an unsupported format.');
  }
}

// Expected upgrades fill fields that did not exist in an older schema. They
// leave malformed existing values alone so validation can report them later.

/**
 * Copy old-schema data and fill fields introduced by later versions.
 * Existing malformed values are left for validation; no repair flag is changed here.
 * @param {Object} input Supported workspace envelope from assertWorkspaceFormat.
 * @param {ModelHelpers['createAdventure']} createAdventure Factory for imported adventures.
 * @returns {Object} Prepared copy. Minimum-child upgrades wait until records are validated.
 */
function upgradeWorkspace(input, createAdventure) {
  const upgraded = {
    ...input,
    version: 4,
  };
  let importedAdventure = null;
  if (input.version < 4) {
    upgraded.adventures = [];
    if (input.sessions.length) {
      importedAdventure = createAdventure({
        title: 'Imported adventure',
      });
      upgraded.adventures.push(importedAdventure);
    }
  }
  for (const type of ['threads', 'locations', 'npcs']) {
    const values = input[type];
    if (input.version === 1 && type !== 'threads' && values === undefined) {
      upgraded[type] = [];
    } else if (Array.isArray(values)) {
      upgraded[type] = values.map((record) =>
        upgradeCampaignRecord(record, input, importedAdventure),
      );
    }
  }
  upgraded.sessions = input.sessions.map((session) =>
    upgradeSession(session, input.version, importedAdventure),
  );
  return upgraded;
}

function upgradeCampaignRecord(record, source, importedAdventure) {
  if (!isRecord(record)) {
    return record;
  }
  const upgraded = {
    ...record,
  };
  if (source.version < 3 && record.comments === undefined) {
    upgraded.comments = [];
  } else if (source.version < 4 && Array.isArray(record.comments)) {
    upgraded.comments = record.comments.map((comment) => {
      if (!isRecord(comment)) {
        return comment;
      }
      const sessionId =
        typeof comment.sessionId === 'string' ? comment.sessionId : '';
      const session = source.sessions.find(
        (value) => isRecord(value) && value.id === sessionId,
      );
      return {
        ...comment,
        adventureId: session ? importedAdventure.id : null,
        adventureLabel: session
          ? `Adventure: ${importedAdventure.title.trim() || 'Untitled adventure'}`
          : 'Adventure: Unknown (recorded before adventures)',
      };
    });
  }
  return upgraded;
}

function upgradeSession(session, sourceVersion, importedAdventure) {
  if (!isRecord(session)) {
    return session;
  }
  const upgraded = upgradeLinkFields(session, sourceVersion);
  if (sourceVersion < 4) {
    upgraded.adventureId = importedAdventure.id;
  }
  if (Array.isArray(session.scenes)) {
    upgraded.scenes = session.scenes.map((scene) =>
      upgradeLinkFields(scene, sourceVersion),
    );
  }
  return upgraded;
}

function upgradeLinkFields(record, sourceVersion) {
  if (!isRecord(record)) {
    return record;
  }
  const upgraded = {
    ...record,
  };
  if (sourceVersion === 1) {
    for (const key of ['locationIds', 'npcIds']) {
      if (record[key] === undefined) {
        upgraded[key] = [];
      }
    }
  }
  return upgraded;
}

// The report is passed explicitly. A repair changes the recovered copy in
// memory and tells app.js to protect the original serialized data.

function readString(value, validation) {
  if (typeof value === 'string') {
    return value;
  }
  validation.report.repaired = true;
  return '';
}

function readUniqueId(value, usedIds, validation) {
  let id = typeof value === 'string' && value ? value : null;
  if (!id || usedIds.has(id)) {
    id = validation.createId();
    validation.report.repaired = true;
  }
  usedIds.add(id);
  return id;
}

function readRecords(values, validation) {
  if (!Array.isArray(values)) {
    validation.report.repaired = true;
    return [];
  }
  return values.filter((value) => {
    if (isRecord(value)) {
      return true;
    }
    validation.report.repaired = true;
    return false;
  });
}

function validateAdventures(values, validation) {
  const usedIds = new Set();
  return readRecords(values, validation).map((adventure) => ({
    id: readUniqueId(adventure.id, usedIds, validation),
    title: readString(adventure.title, validation),
    notes: readString(adventure.notes, validation),
    createdAt: readString(adventure.createdAt, validation),
    updatedAt: readString(adventure.updatedAt, validation),
  }));
}

function validateComments(values, validation) {
  const usedIds = new Set();
  return readRecords(values, validation).map((comment) => {
    const result = {
      id: readUniqueId(comment.id, usedIds, validation),
    };
    for (const key of COMMENT_FIELDS) {
      result[key] = readString(comment[key], validation);
    }
    result.adventureId =
      comment.adventureId === null
        ? null
        : readString(comment.adventureId, validation);
    result.adventureLabel = readString(comment.adventureLabel, validation);
    result.locationId =
      comment.locationId === null
        ? null
        : readString(comment.locationId, validation);
    // Historical IDs may refer to deleted adventures/scenes/locations. Keep them.
    return result;
  });
}

function validateThreads(values, validation) {
  const usedIds = new Set();
  return readRecords(values, validation).map((thread) => {
    const status = THREAD_STATUSES.has(thread.status) ? thread.status : 'open';
    if (status !== thread.status) {
      validation.report.repaired = true;
    }
    return {
      id: readUniqueId(thread.id, usedIds, validation),
      name: readString(thread.name, validation),
      description: readString(thread.description, validation),
      status,
      comments: validateComments(thread.comments, validation),
    };
  });
}

function validateCampaignRecords(values, validation) {
  const usedIds = new Set();
  return readRecords(values, validation).map((record) => ({
    id: readUniqueId(record.id, usedIds, validation),
    name: readString(record.name, validation),
    description: readString(record.description, validation),
    comments: validateComments(record.comments, validation),
  }));
}

// Associations are checked against normalized IDs, not the untrusted input.

function collectRecordIds(records) {
  const ids = {};
  for (const type of ['adventures', 'threads', 'locations', 'npcs']) {
    ids[type] = new Set(records[type].map((record) => record.id));
  }
  return ids;
}

/**
 * Filter IDs against normalized records and remove duplicate associations.
 * @param {unknown} values Untrusted association array; never mutated.
 * @param {Set<string>} allowedIds
 * @param {Object} validation Receives report.repaired = true if any repair is needed.
 * @returns {string[]} A new association array.
 */
function validateReferences(values, allowedIds, validation) {
  if (!Array.isArray(values)) {
    validation.report.repaired = true;
    return [];
  }
  const result = [
    ...new Set(
      values.filter((id) => typeof id === 'string' && allowedIds.has(id)),
    ),
  ];
  if (result.length !== values.length) {
    validation.report.repaired = true;
  }
  return result;
}

function resolveAdventureId(id, adventures, validIds, validation) {
  if (validIds.has(id)) {
    return id;
  }
  validation.report.repaired = true;
  if (!adventures.length) {
    const recovered = validation.createAdventure({
      title: 'Recovered adventure',
    });
    adventures.push(recovered);
    validIds.add(recovered.id);
  }
  return adventures[0].id;
}

function includeSceneReferences(session, idsKey, sceneIds, validation) {
  for (const id of sceneIds) {
    if (!session[idsKey].includes(id)) {
      session[idsKey].push(id);
      validation.report.repaired = true;
    }
  }
}

function validateScene(scene, session, usedIds, recordIds, validation) {
  const result = {
    id: readUniqueId(scene.id, usedIds, validation),
  };
  for (const key of SCENE_FIELDS) {
    result[key] = readString(scene[key], validation);
  }
  result.threadIds = validateReferences(
    scene.threadIds,
    recordIds.threads,
    validation,
  );
  for (const [type, idsKey] of SCENE_RECORD_LINKS) {
    result[idsKey] = validateReferences(
      scene[idsKey],
      recordIds[type],
      validation,
    );
    includeSceneReferences(session, idsKey, result[idsKey], validation);
  }
  includeSceneReferences(session, 'threadIds', result.threadIds, validation);
  return result;
}

/**
 * Construct a recovered session, validate its scenes, and restore scene memberships.
 * Mutates only the normalized record collections/ID sets and repair report passed in.
 * Source session data is never changed; old empty outlines gain their first scene
 * without a repair, while invalid arrays and version 4 empty outlines require one.
 * @param {Object} session Untrusted session record.
 * @param {Set<string>} usedIds Tracks IDs already assigned to normalized sessions.
 * @param {Object} records Normalized campaign collections and mutable adventures.
 * @param {Object} recordIds Sets of normalized IDs used for association checks.
 * @param {Object} validation Factories, source version, outcome keys, and repair report.
 * @returns {import('./model.js').Session} A newly constructed recovered session.
 */
function validateSession(session, usedIds, records, recordIds, validation) {
  const result = {
    id: readUniqueId(session.id, usedIds, validation),
    title: readString(session.title, validation),
    adventureId: resolveAdventureId(
      session.adventureId,
      records.adventures,
      recordIds.adventures,
      validation,
    ),
    number: readString(session.number, validation),
    date: readString(session.date, validation),
    notes: readString(session.notes, validation),
    threadIds: validateReferences(
      session.threadIds,
      recordIds.threads,
      validation,
    ),
    locationIds: validateReferences(
      session.locationIds,
      recordIds.locations,
      validation,
    ),
    npcIds: validateReferences(session.npcIds, recordIds.npcs, validation),
    scenes: [],
    outcomes: {},
    createdAt: readString(session.createdAt, validation),
    updatedAt: readString(session.updatedAt, validation),
  };
  const sceneIds = new Set();
  result.scenes = readRecords(session.scenes, validation).map((scene) =>
    validateScene(scene, result, sceneIds, recordIds, validation),
  );
  // An empty outline was allowed before version 4. Adding its first scene is an
  // upgrade; a version 4 session missing all scenes requires recovery instead.
  if (!result.scenes.length) {
    result.scenes.push(validation.createScene());
    if (validation.sourceVersion >= 4) {
      validation.report.repaired = true;
    }
  }
  if (!isRecord(session.outcomes)) {
    validation.report.repaired = true;
  }
  for (const key of validation.outcomeKeys) {
    result.outcomes[key] = readString(session.outcomes?.[key], validation);
  }
  return result;
}

function ensureAdventureSessions(adventures, sessions, validation) {
  for (const adventure of adventures) {
    if (!sessions.some((session) => session.adventureId === adventure.id)) {
      sessions.push(
        validation.createSession({
          adventureId: adventure.id,
        }),
      );
      if (validation.sourceVersion >= 4) {
        validation.report.repaired = true;
      }
    }
  }
}

function resolveCurrentSessionId(id, sessions, validation) {
  const validIds = new Set(sessions.map((session) => session.id));
  if (!validIds.has(id) && (id !== null || sessions.length)) {
    if (id !== null || validation.sourceVersion >= 4) {
      validation.report.repaired = true;
    }
    return sessions[0]?.id ?? null;
  }
  return id;
}

// Orchestrate the steps; only the final report determines whether recovery is needed.

/**
 * Normalize a parsed workspace without mutating the supplied input or writing storage.
 * Expected schema upgrades remain distinguishable from repairs. Invalid references,
 * fields, and missing required children set repaired; historical comment IDs remain.
 * Injected factories create replacement IDs/records only when normalization needs them.
 * @param {unknown} input Untrusted parsed JSON from a supported workspace schema.
 * @param {ModelHelpers} helpers Factories and outcome field names supplied by model.js.
 * @returns {NormalizationResult} The application owns the result and handles recovery.
 * @throws {Error} If the outer format/version is unsupported. Factory failures also
 * propagate; loadState catches normalization failures and returns its error result.
 */
export function normalizeState(
  input,
  { createId, createAdventure, createSession, createScene, outcomeKeys },
) {
  assertWorkspaceFormat(input);
  const upgraded = upgradeWorkspace(input, createAdventure);
  const report = {
    repaired: false,
  };
  const validation = {
    createId,
    createAdventure,
    createSession,
    createScene,
    outcomeKeys,
    sourceVersion: input.version,
    report,
  };
  const records = {
    adventures: validateAdventures(upgraded.adventures, validation),
    threads: validateThreads(upgraded.threads, validation),
    locations: validateCampaignRecords(upgraded.locations, validation),
    npcs: validateCampaignRecords(upgraded.npcs, validation),
  };
  const recordIds = collectRecordIds(records);
  const sessionIds = new Set();
  const sessions = readRecords(upgraded.sessions, validation).map((session) =>
    validateSession(session, sessionIds, records, recordIds, validation),
  );
  ensureAdventureSessions(records.adventures, sessions, validation);
  const currentSessionId = resolveCurrentSessionId(
    upgraded.currentSessionId,
    sessions,
    validation,
  );
  return {
    state: {
      version: 4,
      adventures: records.adventures,
      sessions,
      threads: records.threads,
      locations: records.locations,
      npcs: records.npcs,
      currentSessionId,
    },
    repaired: report.repaired,
  };
}
