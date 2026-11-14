# Novice readability refactor

The objective was to make the existing vanilla JavaScript application easier to
learn while preserving every feature, existing workspace data, storage recovery,
backup compatibility, and Word exports. Work proceeded one stage at a time with
review between stages.

## Constraints and final structure

No framework, class hierarchy, runtime dependency, package installation, or build
step was introduced. `app.js` remains the single owner of workspace and UI state.
Related actions receive explicit getters and callbacks; HTML builders receive
their data as arguments. Helpers stay grouped by responsibility rather than
being split into a module for every function.

The storage key remains `sigil-session-desk:v1` and the schema remains version 4.
Versions 1–3 still upgrade, while repairs retain the protection against
overwriting damaged stored data. Workspace JSON fixtures were not rewritten.

The final reading order, complete module map, JavaScript examples, and workflow
walkthroughs are in [LEARNING.md](LEARNING.md). [README.md](README.md) describes
running and using the application.

## Stages completed

| Stage                                 | Scope and verification at that stage                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial review                        | Inspected structure, workflows, storage behavior, and existing checks without edits. Established a baseline of 41 passing tests.                                                                                                                                                                                                                          |
| HTML readability                      | Expanded templates into readable string fragments while retaining exact generated HTML. Kept formatting separate from structural changes. Compared 32 renderer outputs and executable syntax trees; 41 tests passed.                                                                                                                                      |
| Application responsibilities          | Grouped editor actions, comment actions, backup handling, and dialog markup into `editor-actions.js`, `comment-actions.js`, `workspace-backups.js`, and `dialog-views.js`. Kept event registration, state replacement, and recovery decisions in `app.js`; added backup regression coverage. Compared 84 simulated workflow checkpoints; 45 tests passed. |
| Storage pipeline                      | Moved normalization into `workspace-validation.js`, with named upgrade, record, reference, and hierarchy steps and explicit model helpers. Added upgrade/repair regression coverage. Compared 6,409 stored inputs and 89 simulated workflow checkpoints before/after; 57 tests passed.                                                                    |
| Function contracts                    | Documented types, parameters, returns, mutations, callbacks, and failure behavior without changing executable code. Compared all 15 JavaScript module syntax trees and checked parameter names/options for 102 documented function declarations; 57 tests passed.                                                                                         |
| Learning guide and final verification | Consolidated the guide around the final structure, added JavaScript explanations and three workflow traces, refreshed README references, and replaced the obsolete refactor record. This stage changes documentation only. Final results are recorded below.                                                                                              |

## Verification tools

The permanent automated suite uses Node's built-in test runner:

```sh
node --test tests/*.test.mjs
```

| Test file                                                        | Main coverage                                                                                                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| [model.test.mjs](tests/model.test.mjs)                           | Existing backup compatibility, scenes, threads, independent factory values, validation, and storage errors.                          |
| [adventures.test.mjs](tests/adventures.test.mjs)                 | Adventure/session ownership, minimum children, sharing, moves, deletion, upgrades, history, and exports.                             |
| [campaign-records.test.mjs](tests/campaign-records.test.mjs)     | Shared NPCs/locations, persistence, links, removal/deletion, views, and exports.                                                     |
| [comments.test.mjs](tests/comments.test.mjs)                     | Multiple/empty histories, contextual links, cross-session visibility, deletion history, edits, validation, and storage round trips.  |
| [export-and-views.test.mjs](tests/export-and-views.test.mjs)     | Nonmutating views, escaped content, reference navigation markup, After play records, and Word archive contents.                      |
| [app-workflows.test.mjs](tests/app-workflows.test.mjs)           | NPC/location UI actions using a simulated DOM and storage.                                                                           |
| [workspace-backups.test.mjs](tests/workspace-backups.test.mjs)   | Restore previews/confirmation, live state after replacement, rejected files, and recovery envelopes using file/download substitutes. |
| [storage-validation.test.mjs](tests/storage-validation.test.mjs) | Expected upgrades versus repairs, duplicate IDs, associations, empty workspaces, and unchanged supplied input.                       |

`node --check` provides syntax checks. The existing cached Prettier executable was
used for formatting without adding project dependencies. Python's standard
library supplies ZIP integrity and XML parsing checks for generated Word files.
There is no project lint or TypeScript type-check command.

Before/after comparison scripts and source snapshots were temporary verification
artifacts outside the project, not additional project tooling. Syntax-tree
comparisons used an already available Babel parser outside this project's
dependencies. Their results describe checks performed during the refactor; the
Node suite above is the permanent check available from a fresh project copy.

## Final verification

| Check                            | Result                                                                                                                                                                        |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Permanent regression suite       | All 57 tests passed, with no skips or failures.                                                                                                                               |
| Syntax                           | All 15 application JavaScript modules, the Node server, and eight test files passed `node --check`.                                                                           |
| Existing Prettier                | All application JavaScript modules, `index.html`, `styles.css`, `LEARNING.md`, and this record passed. No formatter or configuration changes.                                 |
| Before/after storage comparison  | All 6,409 cases matched, including generated IDs, field order, error messages, and read-only loading.                                                                         |
| Before/after simulated workflows | All 89 checkpoints matched, including restore, recovery locks, failed writes, and storage-event replacement.                                                                  |
| Function contracts               | Executable syntax trees matched across 15 modules; parameter names/options checked for 102 documented declarations. This is not a full type check.                            |
| Workspace compatibility          | Existing version 1 fixture upgraded without writes; upgraded data and a sample with contextual comments round-tripped through in-memory storage.                              |
| Word archives                    | Legacy and sample exports passed ZIP integrity and XML parsing for all seven archive parts; special characters and contextual comment text survived encoding.                 |
| Documentation and stage scope    | All local links resolved; the guide maps all 15 modules. Only the three Markdown files changed; sources, tests, configuration, and workspace fixture remained byte-identical. |
| Real browser                     | Unverified: the browser tool failed to initialize with a missing `sandboxPolicy` transport field.                                                                             |

The simulated workflow comparisons check rendered HTML, serialized storage,
dialogs, focus/scroll requests, backup/export output, recovery, restore, and
storage-event handling. A simulated request to focus or download is not proof of
actual browser focus or a completed native download.

Real-browser layout, cursor retention, keyboard/focus behavior, file selection,
downloads, and interaction between live tabs remain manual checks. The learning
guide includes a browser checklist. No browser automation dependency was added.
