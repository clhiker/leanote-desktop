const path = require('path');
const assert = require('assert');

function stub(rel, exports) {
    const filename = require.resolve(path.join(__dirname, '..', 'src', rel));
    require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

let events = [];
const notebooks = {
    findOne(query, cb) {
        if (query.ServerNotebookId === 's1') {
            return cb(null, {NotebookId: 'local1'});
        }
        if (query.NotebookId === 'local1') {
            return cb(null, {ServerNotebookId: 's1'});
        }
        cb(null, null);
    },
    insert(doc, cb) { events.push('insert'); cb(null, doc); },
    update(query, set, opts, cb) { events.push('update:' + JSON.stringify(opts)); cb(null, 1); },
    remove(query, cb) { events.push('remove'); cb(null, 1); }
};

stub('db', {notebooks});
stub('user', {});
stub('common', {goNowToDate: (v) => v});
stub('web', {});

const Notebook = require('../src/notebook');
const run = (fn, ...args) => new Promise(resolve => Notebook[fn](...args, resolve));

(async () => {
    assert.strictEqual(await run('getNotebookIdByServerNotebookId', 's1'), 'local1');
    assert.strictEqual(await run('getServerNotebookIdByNotebookId', 'local1'), 's1');

    const added = await run('addNotebookForce', {NotebookId: 's2', ParentNotebookId: 's1'});
    assert.strictEqual(added.NotebookId, 's2');
    assert.strictEqual(added.ParentNotebookId, 'local1');
    assert.deepStrictEqual(events, ['insert']);

    events = [];
    const updated = await run('updateNotebookForce',
        {NotebookId: 's2', ParentNotebookId: 's1'},
        {NotebookId: 'local2'});
    assert.strictEqual(updated.NotebookId, 'local2');
    assert.deepStrictEqual(events, ['update:{}']);

    events = [];
    await run('updateNotebookForceForSendChange', 'local3', {NotebookId: 's3', ParentNotebookId: 's1'});
    assert.deepStrictEqual(events, ['update:{"multi":true}']);

    events = [];
    assert.strictEqual(await run('deleteNotebookForce', 's3'), true);
    assert.deepStrictEqual(events, ['remove']);
    console.log('notebook_force OK');
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
