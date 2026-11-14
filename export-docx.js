/**
 * @typedef {import('./model.js').Session} Session
 * @typedef {import('./model.js').Adventure} Adventure
 * @typedef {import('./model.js').CampaignThread} CampaignThread
 * @typedef {import('./model.js').CampaignRecord} CampaignRecord
 *
 * @typedef {Object} DocumentBlock
 * @property {'title' | 'metadata' | 'heading1' | 'heading2' | 'paragraph'} type
 * @property {string} text
 * @property {string} [label] Optional bold prefix.
 *
 * @typedef {Object} SessionDocument
 * @property {string} title
 * @property {DocumentBlock[]} blocks
 */

/**
 * A small, dependency-free Word exporter. The document model is deliberately
 * separate from OOXML and downloading so another adapter (such as Google Docs)
 * can use the same session content later.
 */

const STATUS_LABELS = {
  open: 'Open',
  advanced: 'Advanced',
  resolved: 'Resolved',
  abandoned: 'Abandoned',
};
const SCENE_FIELDS = [
  ['purpose', 'Scene purpose'],
  ['locations', 'Key locations'],
  ['npcs', 'Key NPCs'],
  ['tension', 'Core tension'],
  ['goals', 'Party goals'],
];
const OUTCOME_FIELDS = [
  ['happened', 'What actually happened'],
  ['consequences', 'Consequences'],
  ['discoveries', 'Discoveries'],
  ['hooks', 'Future hooks'],
];

function cleanText(value) {
  return Array.from(String(value ?? ''))
    .filter((character) => {
      const code = character.codePointAt(0);
      return (
        code === 9 ||
        code === 10 ||
        code === 13 ||
        (code >= 0x20 && code <= 0xd7ff) ||
        (code >= 0xe000 && code <= 0xfffd) ||
        (code >= 0x10000 && code <= 0x10ffff)
      );
    })
    .join('')
    .replace(/\r\n?/g, '\n');
}

function hasText(value) {
  return cleanText(value).trim().length > 0;
}

function displayTitle(value, fallback) {
  return cleanText(value).trim() || fallback;
}

/**
 * Build plain content blocks from normalized session/campaign data.
 * Does not mutate inputs, touch the DOM, save files, or access the network.
 * Each included record contributes its full comment history, including older context.
 * @param {Session} session
 * @param {CampaignThread[]} [threads=[]] Campaign collection; session IDs select its records.
 * @param {CampaignRecord[]} [locations=[]]
 * @param {CampaignRecord[]} [npcs=[]]
 * @param {Adventure | null} [adventure=null] Owning adventure for session metadata.
 * @returns {SessionDocument} New content blocks ready for a document adapter.
 */
export function sessionDocumentModel(
  session,
  threads = [],
  locations = [],
  npcs = [],
  adventure = null,
) {
  const scenes = Array.isArray(session.scenes) ? session.scenes : [];
  const threadIds = new Set(session.threadIds || []);
  const selectedThreads = threads.filter((thread) => threadIds.has(thread.id));
  const threadById = new Map(
    selectedThreads.map((thread) => [thread.id, thread]),
  );
  const blocks = [];
  const add = (type, text, label) =>
    blocks.push({
      type,
      text: cleanText(text),
      ...(label
        ? {
            label,
          }
        : {}),
    });
  // Include the full history for each exported campaign record, not only comments
  // made during this session. Context labels identify where each entry began.
  const addComments = (record) => {
    for (const comment of record.comments || []) {
      const context = [
        comment.adventureLabel,
        comment.sessionLabel,
        comment.sceneLabel,
      ].filter(Boolean);
      if (comment.locationId) {
        context.push(`Location: ${comment.locationLabel}`);
      }
      add('paragraph', context.join(' · '), 'Comment context');
      add('paragraph', comment.createdAt, 'Added');
      add('paragraph', comment.text, 'Comment');
    }
  };
  const title = displayTitle(session.title, 'Untitled session');
  const metadata = ['AD&D 2e · Planescape · Sigil'];
  if (adventure) {
    metadata.push(
      `Adventure: ${displayTitle(adventure.title, 'Untitled adventure')}`,
    );
  }
  if (hasText(session.number)) {
    metadata.push(`Session ${cleanText(session.number).trim()}`);
  }
  if (hasText(session.date)) {
    metadata.push(cleanText(session.date));
  }
  const recordGroups = [
    {
      label: 'Locations',
      idsKey: 'locationIds',
      records: locations,
    },
    {
      label: 'NPCs',
      idsKey: 'npcIds',
      records: npcs,
    },
  ];
  add('title', title);
  add('metadata', metadata.join('  |  '));
  add('heading1', 'Planned material');
  if (hasText(session.notes)) {
    add('heading2', 'General session notes');
    add('paragraph', session.notes);
  }
  if (!scenes.length) {
    add('paragraph', 'No scenes planned yet.');
  }
  scenes.forEach((scene, index) => {
    add(
      'heading2',
      `${index + 1}. ${displayTitle(scene.title, 'Untitled scene')}`,
    );
    SCENE_FIELDS.forEach(([key, label]) => {
      if (hasText(scene[key])) {
        add('paragraph', scene[key], label);
      }
    });
    for (const { label, idsKey, records } of recordGroups) {
      const linkedRecords = records.filter((record) =>
        (scene[idsKey] || []).includes(record.id),
      );
      if (linkedRecords.length) {
        add(
          'paragraph',
          linkedRecords
            .map((record) => displayTitle(record.name, 'Untitled record'))
            .join('; '),
          label,
        );
      }
    }
    const linked = (scene.threadIds || [])
      .map((id) => threadById.get(id))
      .filter(Boolean);
    if (linked.length) {
      add(
        'paragraph',
        linked
          .map((thread) => displayTitle(thread.name, 'Untitled thread'))
          .join('; '),
        'Campaign threads',
      );
    }
  });
  add('heading1', 'Campaign threads');
  if (!selectedThreads.length) {
    add('paragraph', 'No campaign threads added to this session.');
  }
  selectedThreads.forEach((thread) => {
    add('heading2', displayTitle(thread.name, 'Untitled thread'));
    add('paragraph', STATUS_LABELS[thread.status] || 'Open', 'Status');
    if (hasText(thread.description)) {
      add('paragraph', thread.description);
    }
    const linkedScenes = scenes
      .map((scene, index) => ({
        scene,
        index,
      }))
      .filter(({ scene }) => (scene.threadIds || []).includes(thread.id));
    if (linkedScenes.length) {
      add(
        'paragraph',
        linkedScenes
          .map(
            ({ scene, index }) =>
              `${index + 1}. ${displayTitle(scene.title, 'Untitled scene')}`,
          )
          .join('; '),
        'Linked scenes',
      );
    }
    addComments(thread);
  });
  for (const { label, idsKey, records } of recordGroups) {
    const selected = records.filter((record) =>
      (session[idsKey] || []).includes(record.id),
    );
    if (!selected.length) {
      continue;
    }
    add('heading1', label);
    for (const record of selected) {
      add('heading2', displayTitle(record.name, 'Untitled record'));
      if (hasText(record.description)) {
        add('paragraph', record.description);
      }
      addComments(record);
      const linkedScenes = scenes.flatMap((scene, index) =>
        (scene[idsKey] || []).includes(record.id)
          ? [
              `Scene ${index + 1}: ${displayTitle(scene.title, 'Untitled scene')}`,
            ]
          : [],
      );
      if (linkedScenes.length) {
        add('paragraph', linkedScenes.join('; '), 'Linked scenes');
      }
    }
  }
  if (OUTCOME_FIELDS.some(([key]) => hasText(session.outcomes?.[key]))) {
    add('heading1', 'After play');
    OUTCOME_FIELDS.forEach(([key, label]) => {
      if (hasText(session.outcomes?.[key])) {
        add('heading2', label);
        add('paragraph', session.outcomes[key]);
      }
    });
  }
  return {
    title,
    blocks,
  };
}

function xml(value) {
  return cleanText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function textRun(value, bold = false) {
  const pieces = cleanText(value).split(/(\n|\t)/);
  const content = pieces
    .map((piece) =>
      piece === '\n'
        ? '<w:br/>'
        : piece === '\t'
          ? '<w:tab/>'
          : `<w:t xml:space="preserve">${xml(piece)}</w:t>`,
    )
    .join('');
  return `<w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}${content}</w:r>`;
}

function paragraph(block) {
  const styles = {
    title: 'Title',
    metadata: 'Subtitle',
    heading1: 'Heading1',
    heading2: 'Heading2',
    paragraph: 'Normal',
  };
  const label = block.label ? textRun(`${block.label}: `, true) : '';
  return `<w:p><w:pPr><w:pStyle w:val="${styles[block.type] || 'Normal'}"/></w:pPr>${label}${textRun(block.text)}</w:p>`;
}
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const STYLES = `${XML_HEADER}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="252A27"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Subtitle"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="0" w:after="120"/></w:pPr><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:sz w:val="50"/><w:color w:val="203E32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="280"/></w:pPr><w:rPr><w:sz w:val="20"/><w:color w:val="657069"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="320" w:after="160"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="203E32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="220" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="25"/></w:rPr></w:style>
</w:styles>`;
const CRC_TABLE = Array.from(
  {
    length: 256,
  },
  (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
    }
    return value >>> 0;
  },
);

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Stored (uncompressed) ZIP is universally supported by Word and Google Docs. */

function zipFiles(files) {
  const encoder = new TextEncoder();
  const entries = files.map(([name, content]) => ({
    name: encoder.encode(name),
    bytes: encoder.encode(content),
  }));
  const totalLength = entries.reduce(
    (size, entry) =>
      size + 30 + 46 + entry.name.length * 2 + entry.bytes.length,
    22,
  );
  const output = new Uint8Array(totalLength);
  const view = new DataView(output.buffer);
  let offset = 0;
  const u16 = (number) => {
    view.setUint16(offset, number, true);
    offset += 2;
  };
  const u32 = (number) => {
    view.setUint32(offset, number >>> 0, true);
    offset += 4;
  };
  const write = (bytes) => {
    output.set(bytes, offset);
    offset += bytes.length;
  };
  // A stable valid DOS date: 1 January 2020. It is ZIP metadata only.
  const dosDate = (40 << 9) | (1 << 5) | 1;
  for (const entry of entries) {
    entry.offset = offset;
    entry.crc = crc32(entry.bytes);
    u32(0x04034b50);
    u16(20);
    u16(0x0800);
    u16(0);
    u16(0);
    u16(dosDate);
    u32(entry.crc);
    u32(entry.bytes.length);
    u32(entry.bytes.length);
    u16(entry.name.length);
    u16(0);
    write(entry.name);
    write(entry.bytes);
  }
  const directoryOffset = offset;
  for (const entry of entries) {
    u32(0x02014b50);
    u16(20);
    u16(20);
    u16(0x0800);
    u16(0);
    u16(0);
    u16(dosDate);
    u32(entry.crc);
    u32(entry.bytes.length);
    u32(entry.bytes.length);
    u16(entry.name.length);
    u16(0);
    u16(0);
    u16(0);
    u16(0);
    u32(0);
    u32(entry.offset);
    write(entry.name);
  }
  const directoryLength = offset - directoryOffset;
  u32(0x06054b50);
  u16(0);
  u16(0);
  u16(entries.length);
  u16(entries.length);
  u32(directoryLength);
  u32(directoryOffset);
  u16(0);
  return output;
}

/**
 * Build Word OOXML and package it as an uncompressed ZIP archive in memory.
 * Does not mutate inputs, access the DOM, or start a download.
 * @param {Session} session
 * @param {CampaignThread[]} [threads=[]] Campaign collection; session IDs select its records.
 * @param {CampaignRecord[]} [locations=[]]
 * @param {CampaignRecord[]} [npcs=[]]
 * @param {Adventure | null} [adventure=null] Owning adventure for session metadata.
 * @returns {Uint8Array} New .docx bytes. Construction failures propagate to the caller.
 */
export function buildSessionDocument(
  session,
  threads = [],
  locations = [],
  npcs = [],
  adventure = null,
) {
  const model = sessionDocumentModel(
    session,
    threads,
    locations,
    npcs,
    adventure,
  );
  const document = `${XML_HEADER}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${model.blocks.map(paragraph).join('')}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const contentTypes = `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
  const relationships = `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
  const documentRelationships = `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const core = `${XML_HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xml(model.title)}</dc:title><dc:creator>The Cage — Session Desk</dc:creator><dc:description>Planescape session outline, campaign threads, and post-session notes.</dc:description></cp:coreProperties>`;
  const app = `${XML_HEADER}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>The Cage — Session Desk</Application></Properties>`;
  return zipFiles([
    ['[Content_Types].xml', contentTypes],
    ['_rels/.rels', relationships],
    ['docProps/core.xml', core],
    ['docProps/app.xml', app],
    ['word/document.xml', document],
    ['word/styles.xml', STYLES],
    ['word/_rels/document.xml.rels', documentRelationships],
  ]);
}

/**
 * Build the document and request a browser download; call from a user action.
 * Creates a temporary link/object URL and schedules URL cleanup; no workspace
 * records or browser storage are changed. Setup errors propagate to the caller.
 * @param {Session} session
 * @param {CampaignThread[]} [threads=[]] Campaign collection; session IDs select its records.
 * @param {CampaignRecord[]} [locations=[]]
 * @param {CampaignRecord[]} [npcs=[]]
 * @param {Adventure | null} [adventure=null] Owning adventure for session metadata.
 * @returns {string} Suggested filename, not confirmation that the user saved the file.
 * @throws {Error} Document construction or browser download-setup failures.
 */
export function exportSessionDocx(
  session,
  threads = [],
  locations = [],
  npcs = [],
  adventure = null,
) {
  const bytes = buildSessionDocument(
    session,
    threads,
    locations,
    npcs,
    adventure,
  );
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const url = URL.createObjectURL(blob);
  const name =
    cleanText(session.title)
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
      .trim()
      .replace(/[. ]+$/g, '')
      .slice(0, 100)
      .trim() || 'Untitled session';
  const filename = `${name}.docx`;
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return filename;
}
