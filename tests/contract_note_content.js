const path = require('path');
const assert = require('assert');

function stub(rel, exports) {
    const filename = require.resolve(path.join(__dirname, '..', 'src', rel));
    require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

let apiResult = {content: {Content: 'c1'}, ret: null};

stub('db', {notes: {}, tags: {}});
stub('file', {});
stub('evt', {});
stub('user', { getCurActiveUserId: () => 'test-user' });
stub('notebook', {});
stub('common', { isOk: (v) => !!v });
stub('web', {});
stub('api', {
    getNoteContent: (noteId, cb) => cb(apiResult.content, apiResult.ret)
});

const Note = require('../src/note');

function reset() {
    Note.inSyncContent = {};
    Note.inSyncTimes = {};
}

function run(noteId) {
    return new Promise((resolve) => {
        Note.getNoteContent(noteId, resolve);
    });
}

(async () => {
    reset();
    Note.getNote = (id, cb) => cb({NoteId: id, InitSync: false});
    assert.deepStrictEqual(await run('n1'), {NoteId: 'n1', InitSync: false});
    assert.strictEqual(Note.inSyncContent.n1, false);

    reset();
    Note.getNote = (id, cb) => cb({NoteId: id, InitSync: true, ServerNoteId: 's1'});
    Note.updateNoteContentForce = (id, content, cb) => cb('c2');
    apiResult = {content: {Content: 'c1'}, ret: null};
    assert.deepStrictEqual(await run('n2'), {Content: 'c2', NoteId: 'n2'});
    assert.strictEqual(Note.inSyncContent.n2, false);

    reset();
    Note.getNote = (id, cb) => cb({NoteId: id, InitSync: true, ServerNoteId: 's1'});
    apiResult = {content: false, ret: {Ok: false}};
    assert.strictEqual(await run('n3'), false);

    reset();
    Note.inSyncTimes.n4 = 4;
    Note.getNote = () => { throw new Error('should not read'); };
    assert.strictEqual(await run('n4'), false);

    console.log('note_content OK');
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
