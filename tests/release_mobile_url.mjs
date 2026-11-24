import assert from 'node:assert/strict';
import {
    normalizeServerUrl,
    saveServer,
    loadServers,
    getLastServer,
    clearServers,
    MAX_SERVERS,
} from '../mobile/www/server-url.mjs';

function mockStorage() {
    const map = new Map();
    return {
        getItem: k => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => map.set(k, String(v)),
        removeItem: k => map.delete(k),
    };
}

let r = normalizeServerUrl('leanote.com');
assert.equal(r.ok, true);
assert.equal(r.url, 'https://leanote.com');
assert.ok(r.warnings.length > 0);

r = normalizeServerUrl('https://example.com/leanote/');
assert.equal(r.ok, true);
assert.equal(r.url, 'https://example.com/leanote');

r = normalizeServerUrl('http://example.com:8080/notes');
assert.equal(r.ok, true);
assert.equal(r.url, 'http://example.com:8080/notes');

r = normalizeServerUrl('javascript:alert(1)');
assert.equal(r.ok, false);

r = normalizeServerUrl('data:text/html,hello');
assert.equal(r.ok, false);

r = normalizeServerUrl('https://user:pass@example.com');
assert.equal(r.ok, false);

r = normalizeServerUrl('http://example.com', { allowHttp: false });
assert.equal(r.ok, false);

r = normalizeServerUrl('http://127.0.0.1:9000');
assert.equal(r.ok, true);
assert.ok(r.warnings.some(w => w.includes('localhost')));

r = normalizeServerUrl('https://example.com');
assert.equal(r.url, 'https://example.com');
assert.equal(normalizeServerUrl(r.url).url, 'https://example.com');

const storage = mockStorage();
clearServers(storage);
for (let i = 0; i < MAX_SERVERS + 2; i++) saveServer(`https://s${i}.example.com`, storage);
saveServer('https://s0.example.com', storage);
const list = loadServers(storage);
assert.equal(list.length, MAX_SERVERS);
assert.equal(list[0], 'https://s0.example.com');
assert.equal(new Set(list).size, list.length);
assert.equal(getLastServer(storage), 'https://s0.example.com');
clearServers(storage);
assert.deepEqual(loadServers(storage), []);
assert.equal(getLastServer(storage), '');

console.log('OK mobile server URL');
