const { app, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
var File = require('./file_main');

const SCHEME = 'leanote';
const PUBLIC_ROOT = path.join(app.getAppPath(), 'public');
var schemesRegistered = false;

function serveFile(filePath) {
    return net.fetch(pathToFileURL(filePath).toString()).then(function(res) {
        if (!res.ok) {
            return res;
        }
        // MathJax 等字体是跨源加载, 需要 CORS
        const headers = new Headers(res.headers);
        headers.set('Access-Control-Allow-Origin', '*');
        return new Response(res.body, {
            status: res.status,
            statusText: res.statusText,
            headers: headers
        });
    }).catch(function() {
        return new Response(null, { status: 404 });
    });
}

var leanoteProtocol = {
    // 必须在 app ready 前调用, 否则 leanote:// 无法正确解析
    registerSchemes: function() {
        if (schemesRegistered) {
            return;
        }
        schemesRegistered = true;
        protocol.registerSchemesAsPrivileged([{
            scheme: SCHEME,
            privileges: {
                standard: true,
                secure: true,
                supportFetchAPI: true,
                stream: true
            }
        }]);
    },
    destroy: function(callback) {
        if (protocol.isProtocolHandled(SCHEME)) {
            protocol.unhandle(SCHEME);
        }
        callback && callback();
    },
    init: function() {
        if (protocol.isProtocolHandled(SCHEME)) {
            return;
        }
        try {
            protocol.handle(SCHEME, function(request) {
                var url;
                try {
                    url = new URL(request.url);
                } catch (e) {
                    return new Response(null, { status: 400 });
                }

                var fileId = url.searchParams.get('fileId');
                if (fileId && /^[a-zA-Z0-9]{24}$/.test(fileId)) {
                    return new Promise(function(resolve) {
                        File.getImage(fileId, function(fileLocalPath) {
                            if (!fileLocalPath) {
                                console.log('取不到图片: ' + fileId);
                                resolve(new Response(null, { status: 404 }));
                                return;
                            }
                            resolve(serveFile(fileLocalPath));
                        });
                    });
                }

                // leanote://public/libs/MathJax/MathJax.js?config=TeX-AMS_HTML
                if (url.host === 'public') {
                    var abs = path.resolve(PUBLIC_ROOT, '.' + decodeURIComponent(url.pathname));
                    var rel = path.relative(PUBLIC_ROOT, abs);
                    if (!rel || rel.indexOf('..') === 0 || path.isAbsolute(rel)) {
                        return new Response(null, { status: 403 });
                    }
                    return serveFile(abs);
                }

                return new Response(null, { status: 404 });
            });
        } catch (e) {
            console.error('Failed to register protocol', e);
        }
    }
}

module.exports = leanoteProtocol;
