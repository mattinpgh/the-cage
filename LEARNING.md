# Reading The Cage while learning JavaScript

The Cage uses functions, plain objects, and JavaScript modules. There are no
classes, frameworks, runtime packages, or build steps to learn first. You can follow
one interaction from a button through a data change, saving, and rendering.

Run `python3 start.py` or `node start.mjs`, then open the address printed in the
terminal. The browser runs the application; Node can run its automated tests.

## Start with the data

The logical hierarchy is **Adventure → Session → Scene**. NPCs, locations, and
threads are shared across the whole workspace, including across adventures.

| Stored value                                     | Meaning                                                                                             |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `state.adventures`                               | Adventure objects with IDs, titles, notes, and timestamps.                                          |
| `state.sessions`                                 | Session objects; each `adventureId` identifies its owning adventure.                                |
| `session.scenes`                                 | Scene objects nested inside a session. Array order determines scene numbers.                        |
| `state.threads`, `state.locations`, `state.npcs` | Shared campaign records. Threads also have a status.                                                |
| `session.threadIds`, `locationIds`, `npcIds`     | IDs of records included in that session. Scenes have the same three link arrays.                    |
| `record.comments`                                | That record's full history, with original adventure, session, scene, and optional location context. |
| `state.currentSessionId`                         | The selected session. Its `adventureId` determines the selected adventure.                          |

IDs connect objects without copying them. Renaming a shared NPC changes its name
wherever it appears. Removing it from one session keeps the campaign record;
deleting it from the campaign removes its references everywhere.

Every adventure has at least one session, and every session has at least one
scene. The workspace itself can be empty. Factories construct individual values;
application actions and validation maintain the relationships between them.

Comments live on campaign records, with no fixed count. Context IDs provide links
to surviving sources. Saved labels preserve readable history after a source is
deleted. Moving a session changes its current adventure without rewriting a
comment's original adventure.

## A reading route

1. In [model.js](model.js), read `createThread`, `createScene`, and `createSession`.
   Look at the returned objects and their independent arrays. Leave storage for
   later.
2. Read `getSessionThreads` and `escapeHtml` in [ui-helpers.js](ui-helpers.js), then
   `outlineView` and `sceneCard` in [views.js](views.js). Follow data into HTML.
3. Read `handleActionClick` in [app.js](app.js), then `addScene` in
   [editor-actions.js](editor-actions.js). Use the walkthrough below to connect
   the calls.
4. Follow comments and session movement through the next two walkthroughs. These
   introduce dialog callbacks, shared records, and historical context.
5. Read `saveWorkspace` in `app.js`, `loadState` and `saveState` in `model.js`, then
   `normalizeState` in [workspace-validation.js](workspace-validation.js).
6. Read [workspace-backups.js](workspace-backups.js) for asynchronous file input.
   In [export-docx.js](export-docx.js), start with `sessionDocumentModel`. Leave ZIP
   and XML encoding until you want to study file formats.

Function declarations can appear below their callers. Search for a function's
name to find both its definition and its calls; reading files strictly from top
to bottom is not required.

## The complete module map

| File                                               | Responsibility                                                                                                             |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [app.js](app.js)                                   | Own workspace and UI state; register events; coordinate navigation, rendering, saving, recovery, and the active dialog.    |
| [model.js](model.js)                               | Define data shapes and factories, sample data, scene/thread operations, and the public `loadState` / `saveState` boundary. |
| [adventures.js](adventures.js)                     | Insert/delete adventures, find ownership, and move sessions while keeping history.                                         |
| [campaign-records.js](campaign-records.js)         | Share location/NPC type information, creation, removal, and deletion operations.                                           |
| [comments.js](comments.js)                         | Validate, add, edit, and delete contextual comments on shared records.                                                     |
| [editor-actions.js](editor-actions.js)             | Coordinate adventure, session, scene, and campaign-record actions using supplied application callbacks.                    |
| [comment-actions.js](comment-actions.js)           | Choose comment context and coordinate comment dialogs and changes.                                                         |
| [workspace-backups.js](workspace-backups.js)       | Read/validate JSON backup files and request downloads; ask the state owner to perform a confirmed restore.                 |
| [workspace-validation.js](workspace-validation.js) | Upgrade supported schemas, validate records and links, and report repairs without writing storage.                         |
| [views.js](views.js)                               | Build the page shell, session list, tabs, scene cards, reference lists, and After play HTML.                               |
| [adventure-views.js](adventure-views.js)           | Build adventure selectors and headings.                                                                                    |
| [comment-views.js](comment-views.js)               | Build comment controls, full histories, and context links or historical labels.                                            |
| [dialog-views.js](dialog-views.js)                 | Build dialog frames, form bodies, and dependent scene options.                                                             |
| [ui-helpers.js](ui-helpers.js)                     | Supply display names, escaping, icons, outcome labels, and read-only lookups.                                              |
| [export-docx.js](export-docx.js)                   | Turn a session into content blocks, encode a Word document, and request its download.                                      |

[index.html](index.html) provides the page containers and loads `app.js` as a
module. [styles.css](styles.css) controls appearance and responsive layout.
[start.py](start.py) and [start.mjs](start.mjs) are alternative static servers using
standard libraries. [tests/](tests/) contains the Node tests.
[workspaces/the-cage-workspace.json](workspaces/the-cage-workspace.json) is an older
backup fixture; startup does not load that file.

## One state owner, explicit dependencies

`app.js` owns the mutable `state` variable. It also owns temporary UI values such
as `activeTab`, `expandedSceneIds`, the active dialog callback, `storageError`, and
`recoveryLocked`. Temporary UI values are not part of the saved workspace.

Action modules receive functions such as `openDialog`, `saveWorkspace`, `render`,
and `notify`. They do not import `app.js` or maintain another workspace. At startup,
`createEditorActions`, `createCommentActions`, and `createWorkspaceBackups` return
the related functions that event handlers will call later.

This property in their setup is significant:

```js
getState: () => state,
```

The arrow function returns the current value when called. It is a **closure**: it
can still read the `state` variable in the surrounding module. After a restore,
`restoreWorkspace` replaces `state`, so a later `getState()` reads the replacement.
Passing the original object directly would keep a reference to the old workspace.
`getExpandedSceneIds` provides the same connection to replaceable UI state.

Data functions such as `addAdventure` and `addComment` change supplied objects but
do not save or render. Actions coordinate those steps. HTML builders receive data
and return strings. `render` in `app.js` inserts those strings into the DOM.

## JavaScript concepts in the actual code

### Objects, references, and mutation

These lines from `addScene` create an object and change an existing array:

```js
const scene = createScene();
session.scenes.push(scene);
```

`const` prevents assigning another value to the variable `scene`; it does not
freeze the object. `push` mutates `session.scenes`. A session returned by
`getCurrentSession` is the actual object in `state.sessions`, so changing it also
changes the workspace in memory. Saving is a separate operation.

`getSessionThreads` uses `filter` to return a new array of matching shared objects.
Changing the returned array does not change `state.threads`; changing a thread
object inside it changes that shared thread. The JSDoc return descriptions call
out this distinction.

### Functions, array methods, and modules

`createScene()` is a function call. `createScene` without parentheses refers to the
function itself, which can be passed to another function. A callback is a function
provided for another piece of code to call, such as a dialog's `onSubmit`.

In `getSessionThreads`, `(thread) => session.threadIds.includes(thread.id)` is the
callback supplied to `filter`. `filter` keeps matching items; `find` returns one
matching item or `undefined`; `includes` tests membership. Views use `map` to turn
records into HTML fragments and `join('')` to combine them into one string.

`export` makes a function available to another module; `import` names the functions
a module uses. This is how `editor-actions.js` uses `createScene` from `model.js`.
The modules group responsibilities rather than giving every helper its own file.

### Destructuring and property access

From `addCommentDialog`:

```js
const { type, id } = button.dataset;
```

This **destructuring** reads two properties into local variables. The browser
exposes `data-type` and `data-id` HTML attributes as `button.dataset.type` and
`button.dataset.id`. These attribute values are strings.

`session[idsKey]` in `comments.js` uses a variable as a property name. When
`idsKey` is `'npcIds'`, it reads `session.npcIds`. The `commentTypes` table chooses
the right link array for threads, NPCs, or locations.

This object in `addThreadDialog` uses **spread** to copy the factory's properties,
then supplies form values:

```js
const thread = {
  ...createThread(),
  name: String(data.get('name') || ''),
  description: String(data.get('description') || ''),
  status: String(data.get('status') || 'open'),
};
```

Spread copies only one level; it does not recursively clone arrays or objects. A
fresh factory call gives each new thread its own comments array.

### Optional values and defaults

`location?.id ?? null` in `addComment` means: read the ID if a location exists;
otherwise use `null`. Optional chaining (`?.`) stops at `null` or `undefined`.
Nullish coalescing (`??`) supplies a default for those two values.

`session.title.trim() || 'Untitled session'` in `sessionTitle` also defaults for
empty text, because `||` uses its right side when the left side is falsy. It would
also default for `0` or `false`; `??` would retain them.

The default parameter `{ title = '', notes = '' } = {}` in `createAdventure`
allows callers to omit the options object or either property. It does not check
whether a supplied value has the right type.

### HTML strings and browser APIs

Backtick strings are **template literals**; `${...}` inserts an expression's
result. The view code combines them with ordinary strings using `+`, keeping
tags and attributes visible without adding whitespace to the generated HTML.
Use `escapeHtml` for user text inserted into HTML. Assigning `textContent`, as
`notify` does, treats its input as text automatically.

JavaScript supplies objects, arrays, `Set`, and `JSON`. The browser supplies
`document`, DOM elements, event listeners, `FormData`, and `localStorage`.
`expandedSceneIds` is a `Set`: `add` records an ID once, and `has` checks whether
that scene is expanded.

`readBackup` uses `await file.text()` because reading a file is asynchronous. Its
`async` function waits for the text before calling `JSON.parse`. The surrounding
`try`/`catch` handles reading, parsing, and validation failures. JSON text is a
saved representation of data; parsing alone does not prove the data is valid.

## Trace “Add scene”

1. `outlineView` in `views.js` returns a button with `data-action="add-scene"`.
2. `render` in `app.js` assigns `workspaceShell(...)` to `app.innerHTML`; the
   browser turns the string into DOM elements.
3. The document's click listener calls `handleActionClick`. Its
   `closest('[data-action]')` finds the button even if the click hit its icon.
4. The switch calls `addScene(session)`, returned by `createEditorActions`.
5. `createScene()` constructs a new object, and `session.scenes.push(scene)`
   appends it to the current session.
6. `getExpandedSceneIds().add(scene.id)` expands the new card in temporary UI
   state.
7. `saveSessionChanges()` updates the session timestamp and calls
   `saveWorkspace()`. If recovery permits saving, `saveState()` serializes the
   workspace into browser storage.
8. `render()` rebuilds the interface, then `focusScene(scene.id)` requests focus
   on the new scene's title.

Typing uses a different route: `handleTextInput` reads the scope, field, and ID
from `event.target.dataset`, changes the record, and saves. It refreshes the
sidebar or rail where needed without rebuilding the focused input on every
keystroke. Actual focus and cursor behavior still need browser testing.

## Trace a contextual comment

1. `commentButton` in `comment-views.js` builds the **Add comment** control used
   by record cards and scene controls. Scene controls supply session and scene IDs
   to preselect the context.
2. `handleActionClick` calls `addCommentDialog` in `comment-actions.js`. It finds
   the shared subject and chooses a valid session, scene, and default location.
3. `newCommentBody` in `dialog-views.js` builds the form. `openDialog` in `app.js`
   displays it and retains the submit callback. Opening it does not add a comment.
4. Changing the session calls `handleCommentSessionChange`. It replaces the
   scene options and clears the location choice, preserving the draft textarea.
5. Submitting calls `handleDialogSubmit`: it reads `FormData`, closes the dialog,
   and invokes the saved callback.
6. The callback calls `addComment` in `comments.js`. Validation happens before
   mutation. It attaches the subject and optional location to the chosen session
   and scene, appends the comment, and updates the session timestamp.
7. The action requests saving and rendering. `commentsView` reads the same
   record's full history from any screen; no comment copy is stored on the scene.

`commentContext` builds links for surviving sources and uses saved labels for
deleted sources. Editing changes only text; the original context and creation
time remain. Reference lists show current attachments, while comment origins
describe where the comment was created.

## Trace moving a session to another adventure

1. `sessionPage` in `views.js` builds the Adventure select with
   `data-scope="session-adventure"`; `adventureOptions` supplies its choices.
2. Its change event reaches `handleFieldChange` in `app.js`.
3. The handler calls `moveSessionToAdventure(state, session, element.value)` in
   `adventures.js`.
4. The domain operation returns `false` for a missing destination or a move that
   would leave the original adventure empty. Otherwise it changes `adventureId`
   and the timestamp. Selecting the existing owner succeeds without a change.
5. The handler reports a disallowed move, then requests saving and rendering.
   Rebuilding the select shows the actual owner even when a move was refused.
6. The sidebar and `recordReferences` use current ownership. Comments retain
   their original adventure IDs, so their context can differ from the moved
   session's current adventure.

## Read function contracts

JSDoc comments describe parameters (`@param`), results (`@returns`), mutations,
and relevant failures (`@throws`). The shared data shapes start in `model.js`.
Editors can use them for hints. They do not enforce types at runtime; there is no
TypeScript compiler or type-check command in this project. A JSDoc reference such
as `import('./model.js').Workspace` does not execute an import.

| Naming pattern          | What to expect                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `create…`               | Construct a value. Domain factories return unattached records; action factories return functions wired to callbacks. |
| `add…`                  | Insert data or associations. Application actions may also request saving and rendering.                              |
| `get…` / `find…`        | Read data; check whether the result is a shared object, new array, or null.                                          |
| `remove…FromSession`    | Remove membership and scene links while retaining the campaign record.                                               |
| `delete…`               | Remove a record or comment; read which links, children, and histories are retained.                                  |
| `…Dialog` / `confirm…`  | Open a form or confirmation; edits occur when its submit callback runs.                                              |
| View/body/HTML builders | Return HTML without changing state, writing storage, or touching the DOM.                                            |
| `render` in `app.js`    | Update the DOM from current state.                                                                                   |

For example, `createAdventure({ title: 'A new mystery' })` only constructs an
adventure. `addAdventure(state, { title: 'A new mystery' })` inserts it with its
first session and scene and selects that session; its application caller handles
saving and rendering.

Failure contracts vary. `moveSessionToAdventure` returns a boolean. `addComment`
throws for invalid context or blank text. `loadState` returns `{ state, error }`,
and `saveState` returns `{ ok, error }`. Read and handle the specific result rather
than assuming that every operation succeeds.

## Storage: expected upgrades and repairs

Browser data uses the key `sigil-session-desk:v1`; the workspace's current schema
version is **4**. The key and schema version serve different purposes. Keeping
the key lets the app find existing data. Startup does not read a workspace JSON
file from the project folder. Browser profiles, addresses, and ports have
separate storage.

`loadState` reads and parses storage, then supplies factories and outcome field
names to `normalizeState`. Neither loading nor normalization writes storage or
changes the supplied input. In `workspace-validation.js`, follow these steps:

1. `assertWorkspaceFormat` checks the supported versions (1–4) and required
   envelope arrays.
2. `upgradeWorkspace` copies older data and adds fields introduced later: version
   1 gains location/NPC arrays, versions before 3 gain comment arrays, and
   versions before 4 gain an Imported adventure where sessions exist.
3. Record validators check fields and IDs. `validateComments` retains historical
   IDs whose sources have been deleted.
4. `collectRecordIds` builds sets. `validateReferences` removes invalid or
   duplicate associations; `includeSceneReferences` ensures valid scene links
   are also included in the session.
5. Hierarchy and selection checks ensure required children and a valid current
   session. Only repairs set `validation.report.repaired`.

| Input situation                                                                  | Result                                          |
| -------------------------------------------------------------------------------- | ----------------------------------------------- |
| A valid older workspace lacks fields not yet introduced.                         | Expected upgrade; no recovery lock.             |
| An older session has an empty scene array, which was previously allowed.         | Add its first scene as an expected upgrade.     |
| An older session has `scenes: null`.                                             | Repair; the existing field is malformed.        |
| A version 4 session has no scenes, or a current link points to a missing record. | Repair.                                         |
| A comment's historical source was deleted.                                       | Preserve its context; this alone is not damage. |

A repair returns recovered data **in memory** plus an error notice. `app.js` sets
`recoveryLocked`, and `saveWorkspace` refuses to overwrite the original serialized
data until explicit recovery confirmation. `saveState` is the low-level write
function; the lock belongs to its application caller. Successful upgrades can be
saved normally. Read, parse, and unsupported-format failures also preserve the
original and produce an error.

`workspace-backups.js` downloads normal JSON workspaces or recovery envelopes
containing `original` and `recoveredWorkspace`. Restore reads the recovered
workspace from an envelope, rejects files needing repairs, and previews valid
data before requesting replacement. Files over 20 MB are rejected before reading.
`restoreWorkspace` in `app.js` owns replacement and the subsequent save attempt.

Word export is separate: `sessionDocumentModel` builds plain content blocks,
`buildSessionDocument` encodes them, and `exportSessionDocx` requests a download.
A Word document cannot restore workspace data.

## Check your understanding and changes

Start with a sample workspace. Try one exercise at a time:

- Change a scene placeholder in `sceneCard`. Explain why existing saved text
  stays the same.
- Change the default status in `createThread`. Explain why existing threads keep
  their statuses.
- Follow a location checkbox through `sceneRecordLinks` and `handleFieldChange`.
  Identify which ID array changes and why no new location object is created.
- Trace an optional scene field through its factory, validation, input handling,
  HTML, and export before implementing it.

Run the existing tests with Node.js 18 or newer:

```sh
node --test tests/*.test.mjs
```

The tests use Node's built-in runner and in-memory substitutes for browser APIs.
They cover shared records and references, adventures, comment history, upgrades
and repairs, recovery, backup flows, generated HTML, and document contents. No
packages are required. [REFACTOR_PLAN.md](REFACTOR_PLAN.md) records the refactor's
verification results and their limits.

For an affected browser workflow, check the real interface as well: typing and
cursor position, keyboard/focus behavior, scene reordering, reference navigation,
dialog cancellation, reload persistence, native backup/restore and Word
downloads, narrow layouts, and changes arriving from another tab. Automated
DOM substitutes do not verify these browser behaviors.
