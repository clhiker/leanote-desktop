/**
 * 导出HTML插件
 * @author  life life@leanote.com
 * 选择目录, 将图片保存到文件夹中, 有个html文件(以笔记名命名)
 * 注意, fs.existsSync总返回false, readFileSync可用
 */
define(['../shared/export-flow'], function(Flow) {
    let async; // = require('async');

    return {
        langs: {
            'en-us': {
                'export': 'Export HTML',
                'Exporting': 'Exporting',
                'Exporting: ': 'Exporting: ',
                'exportSuccess': 'HTML saved successful!',
                'exportFailure': 'HTML saved failure!',
                'notExists': 'Please sync your note to ther server firslty.'
            },
            'de-de': {
                'export': 'Als HTML exportieren',
                'Exporting': 'Exportiere',
                'Exporting: ': 'Exportiere: ',
                'exportSuccess': 'HTML erfolgreich gespeichert!',
                'exportFailure': 'HTML speichern fehlgeschlagen!',
                'notExists': 'Bitte Notizen zuerst mit dem Server synchronisieren.'
            },
            'zh-cn': {
                'export': '导出HTML',
                'Exporting': '正在导出',
                'Exporting: ': '正在导出: ',
                'exportSuccess': 'HTML导出成功!',
                'exportFailure': 'HTML导出失败!'
            },
            'zh-hk': {
                'export': '導出HTML',
                'Exporting': '正在導出',
                'Exporting: ': '正在導出: ',
                'exportSuccess': 'HTML導出成功!',
                'exportFailure': 'HTML導出失敗!'
            }
        },

        _inited: false,
        init: function () {
            const me = this;
            if (me._inited) {
                return;
            }
            async = require('async');
            me._inited = true;
        },

        getPluginPath: function () {
            return Api.evtService.getProjectBasePath() + '/public/plugins/export_html';
        },

        htmlTpl: '',
        markdownTpl: '',
        getTpl: function (isMarkdown) {
            let tpl = isMarkdown ? this.markdownTpl : this.htmlTpl;
            if (tpl) {
                return tpl;
            }
            const basePluginPath = this.getPluginPath();

            const tplName = isMarkdown ? 'markdown' : 'html';
            const tplPath = basePluginPath + '/tpl/' + tplName + '.tpl';
            tpl = Api.NodeFs.readFileSync(tplPath, 'utf-8');
            isMarkdown ? (this.markdownTpl = tpl) : (this.htmlTpl = tpl);
            return tpl;
        },
        // 生成html或markdown
        render: function (note) {
            let tpl = this.getTpl(note.IsMarkdown);
            const title = note.Title || getMsg('Untitled');
            tpl = tpl.replace(/\{title\}/g, title);
            tpl = tpl.replace(/\{content\}/g, note.Content);
            return tpl;
        },

        // 写图片,并替换图片路径
        writeFiles: function (filesPath, content, callback) {
            const me = this;
            // http://127.0.0.1:8912/api/file/getImage?fileId=5581029f6289dc3301000000
            // 找到图片
            const reg = new RegExp('leanote://file/getImage\\?fileId=([0-9a-zA-Z]{24})', 'g');
            // console.log(Api.evtService.localUrl + '/api/file/getImage\\?fileId=([0-9a-zA-Z]{24})');
            const matches = content.match(reg);
            // content = content.replace(reg, Evt.leanoteUrl + '/api/file/getImage');

            if (matches && matches.length) {
                Api.NodeFs.mkdirSync(filesPath);
                // 取最后一个名字
                const pathInfo = Api.commonService.splitFile(filesPath);
                const dirName = pathInfo.name;

                async.eachSeries(matches, function (url, cb) {
                    const fileId = url.substr(url.length - 24);
                    Api.fileService.getImageLocalPath(fileId, function (err, imagePath) {
                        // 将图片copy到filesPath下
                        if (imagePath) {
                            const distFileName = fileId + '.png';
                            Api.commonService.copyFile(imagePath, filesPath + '/' + distFileName, function (ok) {
                                content = Flow.replaceAll(content, url, dirName + '/' + distFileName);
                                cb();
                            });
                        } else {
                            cb();
                        }
                    });
                }, function () {
                    callback(content);
                });

                return;
            }
            callback(content);
        },

        loadingIsClosed: false,

                exportHTMLForNotebook: function (notebookId) {
            Flow.exportForNotebook(this, notebookId, 'plugin.export_html.Exporting', 'plugin.export_html.exportSuccess', '_exportHTML');
        },

                exportHTML: function (noteIds) {
            Flow.exportNotes(this, noteIds, 'plugin.export_html.Exporting', 'plugin.export_html.exportSuccess', '_exportHTML');
        },

        _exportHTML: function (note, path, callback, i, total) {
            const me = this;
            if (!note) {
                return;
            }

            if (me.loadingIsClosed) {
                callback();
                return;
            }

            setTimeout(function () {
                Api.loading.setMsg(Api.getMsg('plugin.export_html.Exporting: ') + (note.Title || getMsg('Untitled')));
                Api.loading.setProgressRate(i + '/' + total);
            }, 100);

            let name = note.Title ? note.Title + '.html' : getMsg('Untitled') + '.html';
            name = Flow.fixFilename(name);

            const targetPath = path + Api.commonService.getPathSep() + name;

            // 将路径和名字区分开
            const pathInfo = Api.commonService.splitFile(targetPath);
            pathInfo.nameNotExt = Flow.fixFilename(pathInfo.nameNotExt); // 重新修正一次
            const nameNotExt = pathInfo.nameNotExt;
            pathInfo.nameNotExtRaw = pathInfo.nameNotExt;

            // 得到可用文件的绝对路径
            Flow.uniqueFile(pathInfo, 1, function (absHtmlFilePath) {
                // 得到存放assets的目录
                Flow.uniqueAssets(pathInfo.path, pathInfo.nameNotExt, 1, function (absFilesPath) {
                    // alert(absHtmlFilePath + ' --- ' + absFilesPath);
                    const html = me.render(note);
                    // 写图片
                    me.writeFiles(absFilesPath, html, function (html) {
                        // 把html文件写到
                        Api.commonService.writeFile(absHtmlFilePath, html);
                        callback();
                    });
                });
            });
        },

        // 打开前要执行的
        onOpen: function () {
            const me = this;
            Flow.registerExportMenu(me, 'plugin.export_html.export',
                noteIds => me.exportHTML(noteIds),
                notebookId => me.exportHTMLForNotebook(notebookId));
        },
        // 打开后
        onOpenAfter: function () {
        },
        // 关闭时需要运行的
        onClose: function () {
        }
    };

});