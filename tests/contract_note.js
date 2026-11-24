const path = require('path');

function stub(rel, exports) {
    const filename = require.resolve(path.join(__dirname, '..', 'src', rel));
    require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

let events = [];
const db = {
    notes: {
        insert(doc, cb) {
            events.push('insert');
            cb(null, Object.assign({}, doc));
        },
        update(query, set, opts, cb) {
            events.push('update');
            cb(null, 1);
        }
    },
    tags: {}
};

stub('db', db);
stub('file', {});
stub('evt', {});
stub('user', { getCurActiveUserId: () => 'test-user' });
stub('notebook', { reCountNotebookNumberNotes: () => events.push('recount') });
stub('common', { isValidDate: () => false, isOk: () => true });
stub('web', {});

const Note = require('../src/note');
Note.addNoteHistory = () => events.push('history');

function run(label, dbNote, doc) {
    return new Promise((resolve) => {
        events = [];
        Note.getNote = (noteId, cb) => cb(dbNote);
        Note.updateNoteOrContent(Object.assign({ NoteId: 'n1', NotebookId: 'b1' }, doc), (ret) => {
            events.push('callback:' + (ret ? 'ok' : 'false'));
            setTimeout(() => {
                console.log(label + ' ' + JSON.stringify(events));
                resolve();
            }, 0);
        }, true);
    });
}

(async () => {
    await run('insert', null, { IsNew: true, Content: 'c1' });
    await run('update', { NoteId: 'n1', Content: 'old', Title: 't' }, { Content: 'new' });
    await run('nochange', { NoteId: 'n1', Content: 'same' }, { Content: 'same' });
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
