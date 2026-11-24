const path = require('path');
const assert = require('assert');

function stub(rel, exports) {
    const filename = require.resolve(path.join(__dirname, '..', 'src', rel));
    require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

let events = [];
let findOneResult = null;
let countResult = 0;
let updateResult = 1;

stub('evt', {setHost: (h) => events.push('host:' + h)});
stub('db_client', {});
const MD5 = 'a'.repeat(32);
stub('common', {md5: () => MD5});
stub('db', {
    users: {
        findOne: (query, cb) => { events.push('findOne:' + JSON.stringify(query)); cb(null, findOneResult); },
        count: (query, cb) => { events.push('count'); cb(null, countResult); },
        update: (query, set, opts, cb) => {
            events.push('update:' + (opts && typeof opts !== 'function' ? JSON.stringify(opts) : '{}'));
            if (typeof opts === 'function') { opts(null, updateResult); return; }
            cb(null, updateResult);
        },
        insert: (doc, cb) => { events.push('insert'); cb(null, doc); }
    },
    initDBForUser: (id) => events.push('initDB:' + id)
});
stub('api', {
    auth: (u, p, h, cb) => { events.push('auth'); cb({Ok: true}); },
    logout: (cb) => { events.push('logout'); cb(); }
});

const User = require('../src/user');
User.setUserDataPath = () => events.push('dataPath');
User.getG = (cb) => cb({g: 1});
const realSaveCurUser = User.saveCurUser;
User.saveCurUser = (user, cb) => { events.push('save'); cb(true); };

const run = (fn, ...args) => new Promise(resolve => User[fn](...args, resolve));

(async () => {
    // local md5 password
    findOneResult = {UserId: 'u1', Pwd: MD5};
    events = [];
    assert.strictEqual(await run('login', 'a', 'pwd', 'h'), true);
    assert.deepStrictEqual(events, ['findOne:{"Username":"a","IsLocal":true}', 'save']);

    // local wrong password
    findOneResult = {UserId: 'u1', Pwd: 'b'.repeat(32)};
    events = [];
    assert.strictEqual(await run('login', 'a', 'pwd', 'h'), false);
    assert.deepStrictEqual(events, ['findOne:{"Username":"a","IsLocal":true}']);

    // local plain password gets upgraded
    findOneResult = {UserId: 'u1', Pwd: 'pwd'};
    events = [];
    assert.strictEqual(await run('login', 'a', 'pwd', 'h'), true);
    assert.deepStrictEqual(events, ['findOne:{"Username":"a","IsLocal":true}', 'save']);

    // remote login
    findOneResult = null;
    events = [];
    assert.strictEqual(await run('login', 'a', 'pwd', 'h'), true);
    assert.deepStrictEqual(events, ['findOne:{"Username":"a","IsLocal":true}', 'auth', 'save']);

    // saveCurUser: insert new
    User.saveCurUser = realSaveCurUser;
    countResult = 0;
    events = [];
    assert.strictEqual(await run('saveCurUser', {UserId: 'u2', Token: 't'}), true);
    assert.deepStrictEqual(events, ['dataPath', 'update:{"multi":true}', 'count', 'insert']);

    // init active user
    findOneResult = {UserId: 'u3', Token: 't', Host: 'h', HasDB: true};
    events = [];
    const user = await run('init');
    assert.strictEqual(user.UserId, 'u3');
    assert.ok(events.includes('initDB:u3'));
    assert.ok(events.includes('host:h'));
    assert.ok(events.includes('dataPath'));

    // logout local
    User.isLocal = () => true;
    events = [];
    await run('logout');
    assert.deepStrictEqual(events, ['update:{}']);

    console.log('user_auth OK');
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
