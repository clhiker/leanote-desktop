const path = require('path');
const assert = require('assert');

function stub(rel, exports) {
    const filename = require.resolve(path.join(__dirname, '..', 'src', rel));
    require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

let events = [];
function coll(name) {
    return {
        find(query, cb) { cb(null, [{NoteId: 'n1'}]); },
        remove(query, opts, cb) { events.push(name + ':' + JSON.stringify(query)); cb(); }
    };
}

stub('evt', {});
stub('db_client', {});
stub('common', {});
stub('db', {
    notebooks: coll('notebooks'),
    notes: coll('notes'),
    tags: coll('tags'),
    attachs: coll('attachs'),
    initIt: () => events.push('initIt')
});

const User = require('../src/user');

(async () => {
    await new Promise(resolve => User._deleteDB('user-1', resolve));
    assert.deepStrictEqual(events.map(e => e.split(':')[0]), [
        'notebooks', 'notes', 'tags', 'attachs'
    ]);

    events = [];
    const sourceDb = {
        noteHistories: {
            loadDB(cb) { cb(true); },
            remove(query, opts, cb) { events.push('history:' + query._id); cb(); }
        }
    };
    await new Promise(resolve => User._deleteNoteHistories(sourceDb, [{NoteId: 'n1'}, {NoteId: 'n2'}], resolve));
    assert.deepStrictEqual(events, ['history:n1', 'history:n2']);
    console.log('user_delete OK');
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
