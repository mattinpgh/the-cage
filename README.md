# The Cage — a Planescape session desk

A small, local web app for AD&D 2e sessions in Sigil. Prepare flexible scenes, follow campaign threads across sessions, and record what happened after play.

## Run locally

1. Extract the ZIP into a folder on your computer.
2. Open a terminal in the extracted `the-cage` folder.
3. With Python 3 installed, run:

   ```sh
   python3 start.py
   ```

   On Windows, use `py start.py` (or `python start.py`).

4. Open **http://127.0.0.1:5173** in a current Chrome, Edge, Firefox, or Safari browser.
5. Keep the terminal open while using the app. Press **Ctrl+C** to stop. Run the same command when you return.

If you already have Node.js 18 or newer, `node start.mjs` is an alternative. You only need one of these runtimes. There are no packages to install, no build step, no accounts, and no API keys. The app makes no external network requests and works without an internet connection after you have the files and a runtime.

If the port is in use, close another copy of the app’s server or run `python3 start.py --port 5174` / `node start.mjs 5174`. A different address or port has separate browser storage: return to the **same address and port** to see your sessions.

Serve the app with one of the commands above; opening `index.html` directly as a `file://` URL is not supported because the app uses JavaScript modules.

## Prepare a session

The first visit opens an editable sample adventure, **A debt in the Hive**, containing one session, three scenes, and three campaign threads. Change anything. **Delete adventure** removes its sessions and scenes while keeping campaign records and comments. Deleting the sample does not recreate it on the next visit; you can try a new sample from the empty workspace.

## Organize adventures

- Use the **Adventure** selector above the session list to switch adventures. The sidebar shows sessions belonging to the selected adventure.
- **New adventure** creates an adventure with its first session and scene. **Edit adventure** changes its name and notes.
- Each adventure has at least one session; each session has at least one scene. You can add as many as needed. To remove a final session or scene, delete its parent instead.
- **New session** lets you choose its adventure. The **Adventure** field on an existing session moves it to another adventure, provided the original adventure retains another session.
- NPCs, locations, and threads belong to the entire campaign and can be reused across adventures. Their reference lists group links by **Adventure → Session → Scene**.
- **Delete adventure** asks for confirmation before deleting its sessions and scenes. Campaign records and their comment histories are kept.

Existing workspaces and backups from versions 1–3 are placed into **Imported adventure**, which you can rename and reorganize. Older empty outlines gain a blank scene. No existing scene notes or campaign records are discarded.

- **New session** starts an outline with one blank scene. You can bring open and advanced campaign threads into the new session, or begin with none.
- **Outline** contains optional session notes and flexible scene cards. Expand a card to edit its purpose, key locations, key NPCs, core tension, and party goals. Titles and every other field can be blank.
- Scene numbers show the current order. The arrow controls move a scene up or down. Deleting a scene asks for confirmation and keeps its campaign threads.
- Under a scene, open **Campaign threads** to check the threads it connects to. A thread can connect to any number of scenes.
- **Campaign threads** lets you create threads or add existing ones to this session. Use **Remove from session** to keep a thread for later. The trash button deletes it from the whole campaign after confirmation.
- Each thread lists every attached session and its linked scenes. Click a session or scene in the bulleted list to open it.
- **After play** holds events, consequences, discoveries, and future hooks. It also lets you update the campaign thread statuses: open, advanced, resolved, or abandoned. Review this session’s NPCs and locations below the threads, including descriptions, scene references, and shared comments.

Thread names, descriptions, and statuses are shared across sessions. Old session screens show the campaign’s **current** thread status; describe a session’s changes in its After play notes to keep a record of that point in the story. Deleting a session keeps the campaign threads.

## Track locations and NPCs

Use the **Locations** and **NPCs** tabs to create shared campaign records with a name and description. Add existing records from **Other campaign Locations/NPCs** to reuse them in a session. Expand a scene and open **Locations** or **NPCs** to check the records appearing there.

Each record lists every attached session and its linked scenes as clickable bullets. Names and descriptions are shared across sessions. **Remove from session** keeps the campaign record and removes its links from that session's scenes. **Delete from campaign** asks for confirmation and removes the record and all its links. Deleting a session or scene keeps its location and NPC records.

Existing free-text scene fields remain as **Location notes** and **NPC notes**. They are preserved, including in exports; they are not automatically split into records. Create records for the people and places you want to track.

Older workspaces and JSON backups upgrade automatically to version 4. New backups include locations, NPCs, and their links; Word exports include their descriptions and scene associations.

## Record comments

Threads, locations, and NPCs each have a shared **Comments** history. There is no fixed limit on the number of comments, and records can have none. As with other workspace data, available browser storage determines total capacity.

- In an expanded scene, open **Campaign threads**, **Locations**, or **NPCs** and use **Add comment** beside a record. Its session and scene are preselected; the adventure is derived from that session.
- You can also add comments from **Comments** on a record card or its campaign-library entry. Choose the session and scene where the comment belongs; both are required. Add a scene first if your workspace has none.
- Choose a tracked **Location (optional)**, or leave **No location** selected. Adding a comment links its record and optional location to the chosen session and scene.
- Open **Comments** on a record or **View comments** in a scene to read its complete history from all sessions. Context links take you back to its adventure, session, scene, or location. The original adventure is retained even if the session moves to another adventure.
- Each comment can be edited or deleted individually. Removing a record from a session keeps its comments. Deleting the campaign record deletes its own comment history too.

If a source adventure, session, scene, or contextual location is deleted, comments on surviving records keep their original context labels and show that the source was deleted. JSON backups preserve complete comment histories, including adventure context. Older comments inherit the imported adventure of their surviving source session; if that session was already deleted, the adventure is marked unknown. Word exports include the full history of each exported record, with context labels and creation times.

## Save and back up

Edits save automatically to this browser’s `localStorage` on this device. The toolbar confirms **Saved on this device**; a visible notice explains any save failure. Reopen the app using the same browser profile, address, and port. Sessions are not stored in the source folder and do not sync to another browser or device. Clearing site data or ending a private-browsing session can remove them.

Use **Back up workspace** in the sidebar (or **Help & exporting** on a small screen) to download a JSON copy of all sessions and campaign threads. **Restore a backup** previews the number of sessions and threads and asks for confirmation before replacing the workspace. Invalid backups leave your current workspace unchanged.

If stored data is damaged, the app preserves the original and pauses saving. Download a recovery backup before choosing to replace the stored data. The recovery file contains both the original serialized data and the recovered workspace. If storage is full or blocked, you can still export the current session and copy the workspace data shown in the notice.

## Export into Google Docs

1. Open the session and click **Export .docx**. Your browser downloads a real Word document.
2. In Google Drive, choose **New → File upload** and select the downloaded file.
3. Right-click the uploaded file and choose **Open with → Google Docs**.
4. If it opens in Office editing mode, choose **File → Save as Google Docs** to create a native Google document.

The export includes the planned outline in scene order, general notes, campaign thread descriptions and current statuses, scene associations, and any After play notes. Blank optional fields are omitted. It uses editable headings and paragraphs so you can continue working in Google Docs. No Google connection or sign-in is required by this app; you use your own Google account only when uploading the exported file to Drive.

Word exports are separate documents. Edits in Google Docs do not sync back into the app, and `.docx` files cannot be restored as sessions. Use JSON workspace backups to move or restore app data.

## Files and future extension

- `index.html` and `styles.css`: the responsive interface; system fonts and inline icons.
- `app.js`: the single owner of workspace and UI state; event registration, navigation, save/recovery feedback, and dialog lifecycle.
- `editor-actions.js`: adventure, session, scene, and campaign-record actions using explicit state getters and application callbacks.
- `comment-actions.js`: comment dialogs and actions using the same application callbacks.
- `workspace-backups.js`: JSON downloads, file selection, and backup validation; workspace replacement is delegated to `app.js`.
- `dialog-views.js`: dialog bodies and form options rendered from explicitly supplied data.
- `views.js`: page shell, session list, and session HTML generation with explicit workspace and UI inputs.
- `adventures.js` / `adventure-views.js`: adventure ownership, navigation, and session movement.
- `comments.js` / `comment-views.js`: comment creation, shared histories, and contextual links.
- `campaign-records.js`: shared location/NPC factories, type definitions, and removal operations.
- `ui-helpers.js`: shared display names, HTML escaping, icons, and thread lookups.
- `model.js`: domain factories, sample content, and the public `loadState` / `saveState` persistence boundary.
- `workspace-validation.js`: expected schema upgrades, record validation, association checks, and repair reporting. Loading remains read-only; `app.js` decides when saving is allowed.
- `export-docx.js`: the separate export adapter. `sessionDocumentModel(session, threads, locations, npcs, adventure)` creates plain content blocks; `buildSessionDocument()` turns those into OOXML; `exportSessionDocx()` downloads the result. A future Google Docs adapter can use the same content model without changing the local editor.
- `start.py` / `start.mjs`: optional local-only static servers using standard libraries.

This is a preparation tool: it intentionally keeps the focus on scenes, threads, and outcomes, without a separate faction database. Locations and NPCs are shared campaign records linked to sessions and scenes.

## Learning the code

Start with [LEARNING.md](LEARNING.md) for the complete module map, a reading order, JavaScript examples, and walkthroughs for adding scenes, creating comments, and moving sessions. The stages and verification limits of the behavior-preserving refactor are recorded in [REFACTOR_PLAN.md](REFACTOR_PLAN.md).

Run the regression checks with Node.js 18 or newer:

```sh
node --test tests/*.test.mjs
```

The tests use Node's built-in test runner; the app still needs no packages or build step.
