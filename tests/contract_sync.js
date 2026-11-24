const path = require('path');

function stub(rel, exports) {
    const filename = require.resolve(path.join(__dirname, '..', 'src', rel));
    require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

stub('db', { tags: {} });
stub('common', {});
stub('user', { getCurActiveUserId: () => 'test-user' });
stub('tag', {});
stub('api', {});
stub('notebook', {});
stub('note', {});
stub('web', {});

const Sync = require('../src/sync');
let events = [];

Sync.fixConflicts = (cb) => { events.push('fixConflicts'); cb(); };
Sync._initSyncInfo = () => events.push('_initSyncInfo');
Sync.addSyncProcessStatus = (n) => events.push('status:' + n);
Sync.sendNoteChanges = (cb) => { events.push('sendNoteChanges'); cb(); };
Sync.sendTagChanges = (cb) => { events.push('sendTagChanges'); cb(); };
Sync.fixConflictsForSendChanges = (cb) => { events.push('fixConflictsForSendChanges'); cb(); };
Sync._needIncrSyncAgain = false;
Sync._reSyncAgainTimes = 0;

(async () => {
    Sync.sendNotebookChanges = (cb) => { events.push('sendNotebookChanges'); cb(); };
    await Sync.sendChanges(false);
    console.log('success ' + JSON.stringify(events));

    events = [];
    Sync.sendNotebookChanges = (cb) => { events.push('sendNotebookChanges'); cb(true); };
    await Sync.sendChanges(false);
    console.log('error ' + JSON.stringify(events));
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
