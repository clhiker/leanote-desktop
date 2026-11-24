/**
 * 导出Evernote插件
 * @author  life life@leanote.com
 *
 * 注意/遗留问题:
 *
 * 1. 导出的文件有可能不能导入到evernote, 即使可以导入, 也有可能不能同步
 *    原因: enml.dtd
 * 2. 导出markdown问题, 加一个<pre>markdown content</pre>. 导出的markdown没有图片
 *
 * https://dev.evernote.com/doc/articles/enml.php

Before submitting HTML content over the EDAM API the client application is expected to follow the following steps:
1. Convert the document into valid XML
2. Discard all tags that are not accepted by the ENML DTD
3. Convert tags to the proper ENML equivalent (e.g. BODY becomes EN-NOTE)
4. Validate against the ENML DTD
5. Validate href and src values to be valid URLs and protocols

 */
define(['../shared/export-flow'], function(Flow) {
    let async; //  = require('async');
    let enml; //  = nodeRequire('./public/plugins/export_evernote/enml');

    //==============
    // tpls

    const evernoteTpl = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-export SYSTEM "http://xml.evernote.com/pub/evernote-export3.dtd">
<en-export export-date="{exportedTime}" application="leanote.desktop.app.{platform}" version="{appVersion}">
<note><title>{title}</title><content><![CDATA[<?xml version="1.0" encoding="UTF-8" standalone="no"?><!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd">
<en-note>{content}</en-note>
]]></content>
    <created>{createdTime}</created>
    <updated>{updatedTime}</updated>
    {tags}
    <note-attributes>
        <latitude></latitude>
        <longitude></longitude>
        <altitude></altitude>
        <leaIsMarkdown>{isMarkdown}</leaIsMarkdown>
        <author>{authorEmail}</author>
        <source>leanote.desktop</source>
        <reminder-order>0</reminder-order>
    </note-attributes>
    {resources}
</note>
</en-export>
    `;

    const resourceTpl = `<resource>
    <data encoding="base64">{base64}</data>
    <mime>{type}</mime>
    <width>{width}</width>
    <height>{height}</height>
    <duration>0</duration>
    <resource-attributes>
        <timestamp>{createdTime}</timestamp>
        <file-name>{name}</file-name>
    </resource-attributes>
</resource>`;

    //===========
    // start

    return {
        langs: {
            'en-us': {
                'export': 'Export Evernote',
                'Exporting': 'Exporting',
                'Exporting: ': 'Exporting: ',
                'exportSuccess': 'Evernote saved successful!',
                'exportFailure': 'Evernote saved failure!',
                'notExists': 'Please sync your note to ther server firslty.'
            },
            'de-de': {
                'export': 'Als Evernote exportieren',
                'Exporting': 'Exportiere',
                'Exporting: ': 'Exportiere: ',
                'exportSuccess': 'Evernote erfolgreich gespeichert!',
                'exportFailure': 'Evernote speichern fehlgeschlagen!',
                'notExists': 'Bitte Notizen zuerst mit dem Server synchronisieren.'
            },
            'zh-cn': {
                'export': '导出Evernote',
                'Exporting': '正在导出',
                'Exporting: ': '正在导出: ',
                'exportSuccess': 'Evernote导出成功!',
                'exportFailure': 'Evernote导出失败!'
            },
            'zh-hk': {
                'export': '導出Evernote',
                'Exporting': '正在導出',
                'Exporting: ': '正在導出: ',
                'exportSuccess': 'Evernote導出成功!',
                'exportFailure': 'Evernote導出失敗!'
            }
        },

        _inited: false,
        init: function () {
            const me = this;
            if (me._inited) {
                return;
            }
            async = require('async');
            enml = nodeRequire('./public/plugins/export_evernote/enml');

            me._inited = true;
        },

        getEvernoteTime: function (t) {
            // 20151026T033928Z
            // 2015 10 26 T 03 39 28 Z
            if (!t) {
                t = new Date();
            }
            if (typeof t != 'object' || !('getTime' in t)) {
                try {
                    t = new Date(t);
                } catch (e) {
                    t = new Date();
                }
            }
            return t.format("yyyyMMddThhmmssZ");
        },

        renderTpl: function (tpl, info, keys) {
            for (let i = 0; i < keys.length; ++i) {
                tpl = tpl.replace('{' + keys[i] + '}', info[keys[i]]);
            }
            return tpl;
        },

        render: function (note, callback) {
            const me = this;
            const keys = ['title', 'content', 'createdTime', 'updatedTime', 'tags',
                'isMarkdown', 'exportedTime', 'appVersion', 'authorEmail', 'platform', 'resources'
            ];
            const tpl = evernoteTpl;
            const appVersion = Api.getCurVersion() || {version: 'unknown'};
            const info = {
                title: note.Title,
                content: note.Content,
                createdTime: me.getEvernoteTime(note.createdTime),
                updatedTime: me.getEvernoteTime(note.updatedTime),
                exportedTime: me.getEvernoteTime(),
                authorEmail: Api.userService.email || Api.userService.username,
                platform: process.platform,
                appVersion: appVersion.version,
                isMarkdown: note.IsMarkdown ? 'true' : 'false',
                tags: me.renderTags(note.Tags)
            };

            me.fixResources(note.Content, function (content, resources) {
                content = $('<div>' + content + '</div>').html();
                content = content.replace(/<br.*?>/g, '<br />');
                content = content.replace(/<hr.*?>/g, '<hr />');
                info.resources = resources;

                enml.ENMLOfHTML(content, function (err, ENML) {
                    if (err) {
                        info.content = content;
                    } else {
                        info.content = ENML;
                    }

                    if (note.IsMarkdown) {
                        info.content = '<pre>' + info.content + '</pre>';
                    }

                    callback(me.renderTpl(tpl, info, keys));
                });
            });
        },

        renderTags: function (tags) {
            if (!tags || tags.length === 0) {
                return ''
            }
            let str = '';
            for (let i = 0; i < tags.length; ++i) {
                if (tags[i]) {
                    str += '<tag>' + tags[i] + '</tag>';
                }
            }
            return str;
        },

        // 得到resource
        renderResource: function (fileInfo) {
            const me = this;
            const keys = ['name', 'width', 'height', 'type', 'createdTime', 'base64'];
            const tpl = resourceTpl;
            fileInfo.width = '';
            fileInfo.height = '';
            fileInfo.createdTime = me.getEvernoteTime(fileInfo.createdTime);
            return me.renderTpl(tpl, fileInfo, keys);
        },

        findAllImages: function (content) {
            const reg = new RegExp('<img[^>]*?src=["\']?' + Api.evtService.getImageLocalUrlPrefix() + '\\?fileId=([0-9a-zA-Z]{24})["\']?.*?>', 'g');
            let matches = reg.exec(content);

            // width="330" height="330", style="width:200px"
            const widthReg = /width(=|:)[ "']*?([0-9]+)/;
            const heightReg = /height(=|:)[ "']*?([0-9]+)/;

            // 先找到所有的
            const allMatchs = [];
            while (matches) {
                const all = matches[0];

                const fileId = matches[1];

                // 得到width, height
                const widthRet = all.match(widthReg);
                const heightRet = all.match(heightReg);
                let width = '';
                let height = '';
                if (widthRet) {
                    width = widthRet[2];
                }
                if (heightRet) {
                    height = heightRet[2];
                }

                allMatchs.push({
                    width: width,
                    height: height,
                    fileId: fileId,
                    all: all
                });
                // 下一个
                matches = reg.exec(content);
            }

            return allMatchs;
        },

        findAllAttachs: function (content) {
            const reg = new RegExp('<a[^>]*?href=["\']?' + Api.evtService.getAttachLocalUrlPrefix() + '\\?fileId=([0-9a-zA-Z]{24})["\']?.*?>([^<]*)</a>', 'g');
            let matches = reg.exec(content);

            // 先找到所有的
            const allMatchs = [];
            while (matches) {
                const all = matches[0];

                const fileId = matches[1];
                const title = matches[2];

                allMatchs.push({
                    fileId: fileId,
                    title: title,
                    isAttach: true,
                    all: all
                });
                // 下一个
                matches = reg.exec(content);
            }
            return allMatchs;
        },


        fixResources: function (content, callback) {
            const me = this;

            const allImages = me.findAllImages(content) || [];
            const allAttachs = me.findAllAttachs(content) || [];

            const allMatchs = allImages.concat(allAttachs);

            // console.log(allMatchs);

            if (allMatchs.length === 0) {
                callback(content, '');
                return;
            }

            let resources = '';
            const fileIdFixed = {};

            const fileInfos = {}; // fileId =>
            const fileRendered = {};

            function replaceContent() {
                for (let i = 0; i < allMatchs.length; ++i) {
                    const eachMatch = allMatchs[i];
                    const fileInfo = fileInfos[eachMatch.fileId];
                    if (!fileInfo) {
                        continue;
                    }

                    let media = '<en-media';
                    if (!eachMatch.isAttach) {
                        if (eachMatch.width) {
                            media += ' width="' + eachMatch.width + '"';
                        }
                        if (eachMatch.height) {
                            media += ' height="' + eachMatch.height + '"';
                        } else {
                            media += ' style="height:auto"';
                        }
                    } else {
                        media += ' height="43"'; // style="cursor:pointer;"';
                    }

                    media += ' type="' + fileInfo.type + '"';

                    media += ' hash="' + fileInfo.md5 + '"';
                    media += ' />';
                    content = content.replace(eachMatch.all, media);

                    if (!fileRendered[eachMatch.fileId]) {
                        resources += me.renderResource(fileInfo);
                        fileRendered[eachMatch.fileId] = true;
                    }
                }
            }

            // 再一个个来
            async.eachSeries(allMatchs, function (eachMatch, cb) {
                const fileId = eachMatch.fileId;

                if (fileIdFixed[fileId]) {
                    cb();
                    return;
                }

                const server = eachMatch.isAttach ? Api.fileService.getAttachInfo : Api.fileService.getImageInfo;
                server.call(Api.fileService, fileId, function (err, doc) {
                    fileIdFixed[fileId] = true;
                    if (doc) {
                        const base64AndMd5 = Api.fileService.getFileBase64AndMd5(doc.Path);
                        if (base64AndMd5) {
                            base64AndMd5.createdTime = doc.CreatedTime;
                            base64AndMd5.name = eachMatch.title || doc.Name;
                            base64AndMd5.type = Api.fileService.getFileType(doc.Type);
                            fileInfos[fileId] = base64AndMd5;
                        }
                        cb();
                    } else {
                        cb();
                    }
                });

            }, function () {
                replaceContent();

                callback(content, resources);
            });
        },

        loadingIsClosed: false,

                exportEvernoteForNotebook: function (notebookId) {
            Flow.exportForNotebook(this, notebookId, 'plugin.export_evernote.Exporting', 'plugin.export_evernote.exportSuccess', '_exportEvernote');
        },

                exportEvernote: function (noteIds) {
            Flow.exportNotes(this, noteIds, 'plugin.export_evernote.Exporting', 'plugin.export_evernote.exportSuccess', '_exportEvernote');
        },

        _exportEvernote: function (note, path, callback, i, total) {
            const me = this;
            if (!note) {
                return;
            }

            if (me.loadingIsClosed) {
                callback();
                return;
            }

            setTimeout(function () {
                Api.loading.setMsg(Api.getMsg('plugin.export_evernote.Exporting: ') + (note.Title || getMsg('Untitled')));
                Api.loading.setProgressRate(i + '/' + total);
            }, 100);

            let name = note.Title ? note.Title + '.enex' : getMsg('Untitled') + '.enex';
            name = Flow.fixFilename(name);

            const targetPath = path + Api.commonService.getPathSep() + name;

            // 将路径和名字区分开
            const pathInfo = Api.commonService.splitFile(targetPath);
            pathInfo.nameNotExt = Flow.fixFilename(pathInfo.nameNotExt); // 重新修正一次
            const nameNotExt = pathInfo.nameNotExt;
            pathInfo.nameNotExtRaw = pathInfo.nameNotExt;

            // 得到可用文件的绝对路径
            Flow.uniqueFile(pathInfo, 1, function (absEvernoteFilePath) {
                me.render(note, function (content) {
                    Api.commonService.writeFile(absEvernoteFilePath, content);
                    callback();
                });
            });
        },

        // 打开前要执行的
        onOpen: function () {
            const me = this;
            Flow.registerExportMenu(me, 'plugin.export_evernote.export',
                noteIds => me.exportEvernote(noteIds),
                notebookId => me.exportEvernoteForNotebook(notebookId));
        },
        // 打开后
        onOpenAfter: function () {
        },
        // 关闭时需要运行的
        onClose: function () {
        }
    };
});