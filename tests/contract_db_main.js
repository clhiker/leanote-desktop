const path = require('path');
const assert = require('assert');

function stub(rel, exports) {
    const filename = require.resolve(path.join(__dirname, '..', 'src', rel));
    require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
stub('evt_main', {});

const db = require('../src/db_main');

let events = [];
db._inited = true;
db.notes = {
    find(query) {
        events.push('find:' + JSON.stringify(query));
        return {
            sort(sorter) { events.push('sort:' + JSON.stringify(sorter)); return this; },
            exec(cb) { cb(null, [{NoteId: 'n1'}]); }
        };
    },
    update(query, sets, options, cb) {
        events.push('update:' + JSON.stringify(options));
        cb(null, 1);
    },
    insert(doc, cb) {
        events.push('insert');
        cb(null, doc);
    }
};

function exec(m) {
    return new Promise(resolve => db.exec(m, resolve));
}

(async () => {
    let r = await exec({token: 't', dbname: 'notes', method: 'find', params: {query: {a: 1}, sorter: {b: 1}}});
    assert.deepStrictEqual(r, {token: 't', err: null, ret: [{NoteId: 'n1'}]});
    assert.deepStrictEqual(events, ['find:{"a":1}', 'sort:{"b":1}']);

    events = [];
    r = await exec({token: 't', dbname: 'notes', method: 'update', params: {query: {}, sets: {}, options: {multi: true}}});
    assert.deepStrictEqual(r, {token: 't', err: null, ret: 1});
    assert.deepStrictEqual(events, ['update:{"multi":true}']);

    events = [];
    r = await exec({token: 't', dbname: 'notes', method: 'insert', params: {NoteId: 'x'}});
    assert.deepStrictEqual(r, {token: 't', err: null, ret: {NoteId: 'x'}});
    assert.deepStrictEqual(events, ['insert']);

    console.log('db_main OK');
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
