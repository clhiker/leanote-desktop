const path = require('path');
const assert = require('assert');

function stub(rel, exports) {
    const filename = require.resolve(path.join(__dirname, '..', 'src', rel));
    require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
function stubModule(name, exports) {
    const filename = require.resolve(name);
    require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

let events = [];
let response = {Ok: true};
let request = null;

stubModule('needle', {
    defaults: () => {},
    get: () => { throw new Error('unexpected get'); },
    post: (url, data, opts, cb) => {
        request = {url, data, opts};
        events.push('post');
        cb(null, {body: response});
    }
});
stubModule('node-getmac', () => 'mac');

stub('db', {tags: {}});
stub('evt', {
    leanoteUrl: 'https://leanote.test',
    getProjectBasePath: () => path.join(__dirname, '..'),
    setHost: (h) => { events.push('host:' + h); }
});
stub('user', {
    getToken: () => 'token',
    getCurUserId: () => 'u1',
    getCurActiveUserId: () => 'u1'
});
stub('note', { removeNote: () => events.push('removeNote'), setNotDirty: () => events.push('notDirty'), setNotDirtyNotDelete: () => events.push('notDirtyNotDelete') });
stub('tag', {});
stub('notebook', {
    getServerNotebookIdByNotebookId: (id, cb) => cb('srv-parent'),
    setNotDirty: () => events.push('nbNotDirty'),
    setNotDirtyNotDelete: () => events.push('nbNotDirtyNotDelete')
});
stub('common', {
    isOk: (v) => !!v && (typeof v !== 'object' || !('Ok' in v) || v.Ok),
    md5: () => 'md5',
    uuid: () => 'uuid'
});
stub('web', {
    connected: () => {},
    unConnected: () => {},
    notLogin: () => {},
    needUpgradeAccount: () => {}
});

const Api = require('../src/api');
const run = (fn, ...args) => new Promise(resolve => Api[fn](...args, resolve));

(async () => {
    events = [];
    response = {Ok: true, UserId: 'u1'};
    const login = await run('auth', 'a@b.com', 'pwd', 'https://host');
    assert.strictEqual(login.Pwd, 'md5');
    assert.strictEqual(login.Host, 'https://leanote.test');
    assert.ok(request.url.indexOf('auth/login') >= 0);
    assert.ok(request.url.indexOf('token=token') >= 0);
    assert.deepStrictEqual(request.data, {email: 'a@b.com', pwd: 'pwd'});
    assert.ok(events.includes('host:https://host'));

    response = {Ok: false};
    assert.strictEqual(await run('auth', 'a@b.com', 'pwd', 'https://host'), false);

    events = [];
    response = {Ok: true, TagId: 't1'};
    assert.deepStrictEqual(await run('addTag', 'tag1'), response);
    assert.deepStrictEqual(request.data, {tag: 'tag1'});

    response = {Ok: false, Msg: 'whatever'};
    assert.deepStrictEqual(await run('deleteTag', {Tag: 'tag1', Usn: 5}), response);

    events = [];
    response = {Ok: true, NotebookId: 'srv1'};
    assert.deepStrictEqual(await run('addNotebook', {Title: 'nb', Seq: 1, ParentNotebookId: 'srv-parent'}), response);
    assert.strictEqual(request.data.parentNotebookId, 'srv-parent');

    events = [];
    response = {Ok: false, Msg: 'conflict'};
    assert.strictEqual(await run('deleteNotebook', {ServerNotebookId: 'srv1', Usn: 2, NotebookId: 'local1'}), false);
    assert.deepStrictEqual(events, ['post', 'nbNotDirtyNotDelete']);

    events = [];
    response = {Ok: false, Msg: 'notExists'};
    assert.strictEqual(await run('deleteTrash', {ServerNoteId: 'srv2', Usn: 3, NoteId: 'local2'}), false);
    assert.deepStrictEqual(events, ['post', 'removeNote']);

    console.log('api_post OK');
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
