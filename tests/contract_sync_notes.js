const path = require('path');
const assert = require('assert');

function stub(rel, exports) {
    const filename = require.resolve(path.join(__dirname, '..', 'src', rel));
    require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

let events = [];
let scenario = {};
const noteStub = {
    getDirtyNotes: (cb) => cb(scenario.notes),
    updateNoteForceForSendChange: (note, isAdd) => events.push('updateForce:' + isAdd),
    deleteLocalNote: (id) => events.push('deleteLocal:' + id),
    setError: (id) => events.push('setError:' + id),
    getNoteContentFromServer: (id, cb) => cb(scenario.content),
    updateNoteUsn: (id, usn) => events.push('updateUsn:' + id + ':' + usn)
};
const apiStub = {
    addNote: (note, cb) => { events.push('addNote'); (scenario.addNote || ((n, c) => c(null, {Ok: true, NoteId: 's', Usn: 5})))(note, cb); },
    updateNote: (note, cb) => { events.push('updateNote'); (scenario.updateNote || ((n, c) => c(null, {Ok: true, NoteId: 's', Usn: 7})))(note, cb); },
    deleteTrash: (note, cb) => { events.push('deleteTrash'); (scenario.deleteTrash || ((n, c) => c({Ok: true, Usn: 9})))(note, cb); },
    getNote: (id, cb) => { events.push('getNote'); (scenario.getNote || ((i, c) => c({Ok: true, Usn: 9})))(id, cb); }
};

stub('db', { tags: {} });
stub('common', {
    isEmpty: (v) => !v || !v.length,
    isOk: (v) => !!v && v.Ok !== false
});
stub('user', {});
stub('tag', {});
stub('notebook', {});
stub('web', {});
stub('note', noteStub);
stub('api', apiStub);

const Sync = require('../src/sync');
Sync.fixSynced = (type, bucket) => events.push('fix:' + bucket);
Sync.checkNeedIncSyncAgain = (usn) => events.push('need:' + usn);

function reset() {
    events = [];
    Sync._syncInfo = {note: {errors: [], changeConflicts: []}};
}

function run(notes, extra) {
    reset();
    scenario = Object.assign({notes}, extra);
    return new Promise(resolve => Sync.sendNoteChanges(resolve));
}

(async () => {
    await run([{InitSync: true}]);
    assert.deepStrictEqual(events, []);

    await run([{LocalIsNew: true, NoteId: 'n1', Title: 't'}]);
    assert.deepStrictEqual(events, ['addNote', 'fix:changeAdds', 'updateForce:true', 'need:5']);

    await run([{LocalIsNew: true, LocalIsDelete: true, NoteId: 'n2'}]);
    assert.deepStrictEqual(events, ['deleteLocal:n2']);

    await run([{LocalIsDelete: true, NoteId: 'n3'}]);
    assert.deepStrictEqual(events, ['deleteTrash', 'need:9']);

    await run([{LocalIsDelete: true, NoteId: 'n3b'}], {
        deleteTrash: (note, cb) => cb({Ok: false, Msg: 'notExists'})
    });
    assert.deepStrictEqual(events, ['deleteTrash', 'deleteLocal:n3b']);

    await run([{NoteId: 'n4', Title: 't', ServerNoteId: 's4'}]);
    assert.deepStrictEqual(events, ['updateNote', 'updateForce:false', 'fix:changeUpdates', 'need:7']);

    await run([{NoteId: 'n5', Title: 't', ServerNoteId: 's5', LocalContent: 'a'}], {
        updateNote: (note, cb) => cb(null, {Ok: false, Msg: 'conflict'}),
        content: 'b'
    });
    assert.deepStrictEqual(events, ['updateNote']);
    assert.strictEqual(Sync._syncInfo.note.changeConflicts.length, 1);

    await run([{NoteId: 'n6', Title: 't', ServerNoteId: 's6', LocalContent: 'a'}], {
        updateNote: (note, cb) => cb(null, {Ok: false, Msg: 'conflict'}),
        content: 'a'
    });
    assert.deepStrictEqual(events, ['updateNote', 'getNote', 'updateUsn:n6:9']);

    await run([{NoteId: 'n7', Title: 't', ServerNoteId: 's7'}], {
        updateNote: (note, cb) => cb(null, {Ok: false, Msg: 'notExists'})
    });
    assert.deepStrictEqual(events, ['updateNote', 'setError:n7', 'fix:errors']);

    console.log('sync_notes OK');
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
