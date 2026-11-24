const path = require('path');
const assert = require('assert');

function stub(rel, exports) {
    const filename = require.resolve(path.join(__dirname, '..', 'src', rel));
    require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

let events = [];
let historyDoc = null;
const db = {
    notes: {
        update(query, set, opts, cb) {
            events.push('notes.update');
            cb(null, 1);
        },
        insert(doc, cb) {
            events.push('notes.insert');
            cb(null, Object.assign({}, doc));
        }
    },
    noteHistories: {
        loadDB(cb) { cb(true); },
        findOne(query, cb) { cb(null, historyDoc); },
        insert(doc, cb) { events.push('history.insert'); historyDoc = doc; cb(null, doc); },
        update(query, set, cb) { events.push('history.update'); cb(null, 1); }
    }
};

stub('db', db);
stub('file', {});
stub('evt', {});
stub('user', { getCurActiveUserId: () => 'test-user' });
stub('notebook', { reCountNotebookNumberNotes: () => events.push('recount') });
stub('common', {
    isEmpty: (v) => !v || !v.length,
    objectId: () => 'new-id',
    splitFile: () => ({ nameNotExt: 'attach', getFullPath: () => 'new-path' }),
    copyFile: (src, dst, cb) => cb(true)
});
stub('web', {});

const Note = require('../src/note');

function run(fn, ...args) {
    return new Promise((resolve) => {
        events = [];
        Note[fn](...args, resolve);
    });
}

(async () => {
    // setNote2Blog: changed + unchanged
    Note.getNote = (id, cb) => cb({_id: id, IsBlog: id === 'b'});
    assert.strictEqual(await run('setNote2Blog', ['a', 'b'], true), true);
    assert.deepStrictEqual(events, ['notes.update']);

    // moveNote: one moved, one already in target
    Note.getNote = (id, cb) => cb({_id: id, NotebookId: id === 'n1' ? 'old' : 'target', IsTrash: false});
    assert.strictEqual(await run('moveNote', ['n1', 'n2'], 'target'), true);
    assert.deepStrictEqual(events, ['notes.update', 'recount', 'recount']);

    // addNoteHistory: new / same / changed
    historyDoc = null;
    assert.strictEqual(await run('addNoteHistory', 'n1', 'c1'), true);
    assert.deepStrictEqual(events, ['history.insert']);
    historyDoc = {_id: 'n1', Histories: [{Content: 'c1'}]};
    await run('addNoteHistory', 'n1', 'c1');
    assert.deepStrictEqual(events, []);
    await run('addNoteHistory', 'n1', 'c2');
    assert.deepStrictEqual(events, ['history.update']);

    // copyNoteForConfict: one attach copied
    Note.getNote = (id, cb) => cb({_id: id, NotebookId: 'nb', Attachs: [{Path: 'old-path', FileId: 'f1'}]});
    const newNote = await run('copyNoteForConfict', 'n1');
    assert.ok(newNote && newNote.ConflictNoteId === 'n1');
    assert.deepStrictEqual(events, ['notes.insert', 'recount']);

    console.log('note_ops OK');
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
