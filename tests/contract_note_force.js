const path = require('path');
const assert = require('assert');

function stub(rel, exports) {
    const filename = require.resolve(path.join(__dirname, '..', 'src', rel));
    require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

let events = [];
stub('db', {
    notes: {
        update(query, set, opts, cb) { events.push('update'); cb(null, 1); }
    },
    tags: {}
});
stub('file', {});
stub('evt', {});
stub('user', {});
stub('notebook', {
    reCountNotebookNumberNotes: () => events.push('recount'),
    getNotebookIdByServerNotebookId: (id, cb) => cb('local-nb')
});
stub('common', { isOk: (v) => !!v });
stub('web', {});

const Note = require('../src/note');

function run(note) {
    return new Promise((resolve) => {
        Note.updateNoteForce(note, resolve);
    });
}

(async () => {
    events = [];
    Note.getNoteByServerNoteId = (id, cb) => cb({
        NoteId: 'local-note',
        Attachs: [{ServerFileId: 's-old', FileId: 'f-old', Path: '/old'}]
    });
    Note.deleteAttachs = () => events.push('deleteAttachs');
    Note.syncContentAndImagesAndAttachs = () => events.push('syncContent');

    const serverNote = {
        NoteId: 'server-note',
        NotebookId: 'server-nb',
        Title: 't',
        Files: [
            {IsAttach: true, FileId: 's-old'},
            {IsAttach: true, FileId: 's-new'}
        ]
    };
    const result = await run(serverNote);
    assert.strictEqual(result.NoteId, 'local-note');
    assert.strictEqual(result.NotebookId, 'local-nb');
    assert.deepStrictEqual(result.Attachs.map(a => a.FileId).sort(), ['f-old', 's-new']);
    assert.deepStrictEqual(events, ['deleteAttachs', 'update', 'recount', 'syncContent']);

    events = [];
    Note.getNoteByServerNoteId = (id, cb) => cb(null);
    const missing = await new Promise(resolve => {
        Note.updateNoteForce({NoteId: 'x'}, resolve);
        setTimeout(() => resolve('no-callback'), 10);
    });
    assert.strictEqual(missing, 'no-callback');
    assert.deepStrictEqual(events, []);

    console.log('note_force OK');
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
