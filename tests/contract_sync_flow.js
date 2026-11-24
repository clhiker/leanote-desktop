const path = require('path');
const assert = require('assert');

function stub(rel, exports) {
    const filename = require.resolve(path.join(__dirname, '..', 'src', rel));
    require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

let events = [];
stub('db', {tags: {}});
stub('common', {isOk: (v) => !!v && v.Ok !== false, isEmpty: (v) => !v || !v.length});
stub('user', {
    isLocal: () => false,
    getAllLastSyncState: (cb) => cb(1, 2, 3, 4),
    getLastSyncState: (cb) => cb(10, 'time')
});
stub('tag', {});
stub('api', {getLastSyncState: (cb) => cb({Ok: true, LastSyncUsn: 20})});
stub('notebook', {});
stub('note', {});
stub('web', {});

const Sync = require('../src/sync');
Sync._initSyncInfo = () => events.push('init');
Sync.syncNotebook = (usn, cb) => { events.push('syncNotebook:' + usn); cb(true); };
Sync.syncNote = (usn, cb) => { events.push('syncNote:' + usn); cb(true); };
Sync.syncTag = (usn, cb) => { events.push('syncTag:' + usn); cb(true); };
Sync.updateLastSyncState = (cb) => { events.push('updateLast'); cb(); };
Sync.setSyncFinished = (x) => events.push('finished:' + x);
Sync.fixSyncedNotebook = () => events.push('fixSyncedNotebook');
Sync.fixConflicts = () => events.push('fixConflicts');
Sync.addSyncProcessStatus = (n) => events.push('status:' + n);
Sync.sendChanges = (again) => events.push('sendChanges:' + again);

(async () => {
    events = [];
    const full = await new Promise(resolve => Sync.fullSync((err, info) => resolve({err, info})));
    assert.strictEqual(full.err, false);
    assert.deepStrictEqual(events, ['init', 'syncNotebook:-1', 'syncNote:-1', 'syncTag:-1', 'updateLast']);

    events = [];
    Sync.incrSyncStart = false;
    Sync.incrSync(false);
    await new Promise(r => setTimeout(r, 10));
    assert.deepStrictEqual(events, [
        'init', 'syncNotebook:10', 'fixSyncedNotebook', 'status:10',
        'syncNote:10', 'status:30', 'syncTag:10', 'status:10',
        'updateLast', 'sendChanges:false'
    ]);
    console.log('sync_flow OK');
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
