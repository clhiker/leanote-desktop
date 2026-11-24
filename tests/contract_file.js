const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

function stub(rel, exports) {
    const filename = require.resolve(path.join(__dirname, '..', 'src', rel));
    require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'leanote-file-'));
let remoteBody = Buffer.from('image-data');
let uuid = 0;

stub('db', { attachs: {}, images: {} });
stub('db_client', { images: {} });
stub('evt', { getImageLocalUrl: (id) => 'leanote://' + id });
stub('user', {
    getCurUserImagesPath: () => dir,
    getCurActiveUserId: () => 'user'
});
stub('common', {
    uuid: () => 'u' + (++uuid),
    objectId: () => 'id',
    splitFile: () => ({ nameNotExt: 'x', getFullPath: () => dir + '/x' }),
    copyFile: () => {}
});
stub('web', {});
stub('api', {
    getImage: (fileId, cb) => cb(dir + '/remote.png')
});
const needleFile = require.resolve('needle');
require.cache[needleFile] = {
    id: needleFile,
    filename: needleFile,
    loaded: true,
    exports: {
        defaults: () => {},
        get: (url, cb) => cb(null, {statusCode: 200, headers: {'content-type': 'image/png'}, body: remoteBody})
    }
};

const File = require('../src/file');

function call(fn, ...args) {
    return new Promise(resolve => File[fn](...args, resolve));
}

(async () => {
    // local file copy
    const localSrc = path.join(dir, 'src.png');
    fs.writeFileSync(localSrc, 'local');
    const localDst = await call('downloadImg', 'file://' + localSrc);
    assert.ok(localDst && fs.existsSync(localDst));
    fs.unlinkSync(localDst);

    // remote image download
    const remoteDst = await call('downloadImg', 'https://example.com/a.png');
    assert.ok(remoteDst && fs.readFileSync(remoteDst).equals(remoteBody));

    // getImage from api
    File.getImageLocalPath = (fileId, cb) => cb(false);
    File.addImageForce = (fileId, p, cb) => cb({FileId: fileId});
    const apiPath = await call('getImage', 'file-1');
    assert.strictEqual(apiPath, dir + '/remote.png');

    // copyOtherSiteImage
    File.downloadImg = (src, cb) => cb(localSrc);
    File._addImage = (id, p, cb) => cb({FileId: 'f1'});
    const localUrl = await call('copyOtherSiteImage', 'x');
    assert.strictEqual(localUrl, 'leanote://f1');

    fs.rmSync(dir, {recursive: true, force: true});
    console.log('file OK');
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
