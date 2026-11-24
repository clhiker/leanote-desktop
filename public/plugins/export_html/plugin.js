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
            const me = this;
            if (!notebookId) {
                return;
            }

            // 创建一个内部函数来处理目录选择和检查
            function tryExport(targetPath) {
                if (!targetPath) {
                    return;
                }

                // 直接获取笔记本信息
                let notebook = Api.notebook.getNotebook(notebookId);
                // 创建以笔记本名称命名的子文件夹
                let notebookName = Flow.fixFilename(notebook.Title);
                let newPath = targetPath + '/' + notebookName;

                // 检查目标路径是否存在同名文件或文件夹
                try {
                    if (Api.NodeFs.existsSync(newPath)) {
                        // 弹出警告对话框
                        Api.gui.dialog.showMessageBoxSync(Api.gui.getCurrentWindow(), {
                            type: 'warning',
                            buttons: ['确定'],
                            title: '警告',
                            message: '目录 "' + notebookName + '" 已存在，请选择其他目录保存。'
                        });
                        // 重新调用getTargetPath让用户选择新目录
                        Flow.chooseDir(function (newTargetPath) {
                            tryExport(newTargetPath);
                        });
                            return;
                        }

                    // 创建新目录
                    Api.NodeFs.mkdirSync(newPath);
                    targetPath = newPath;
                } catch (e) {
                    console.error(e);
                    return;
                }

                Flow.startLoading(me, 'plugin.export_html.Exporting');

                // 递归处理笔记本及其子笔记本
                function processNotebook(notebookId, currentPath) {
                    return new Promise((resolve) => {
                        let allNotes = [];
                        let currentNotebook = Api.notebook.getNotebook(notebookId);

                        // 获取当前笔记本的所有笔记
                        Api.noteService.getNotes(notebookId, function (notes) {
                            if (notes) {
                                allNotes = allNotes.concat(notes);
                            }

                            // 获取子笔记本
                            let children = Api.notebook.getSubNotebooks(notebookId);
                            if (!children || children.length === 0) {
                                resolve({notes: allNotes, total: allNotes.length});
                                return;
                            }

                            // 处理每个子笔记本
                            let processed = 0;
                            children.forEach(function (child) {
                                // 为子笔记本创建文件夹
                                let childPath = currentPath + '/' + Flow.fixFilename(child.Title);
                            try {
                                    if (!Api.NodeFs.existsSync(childPath)) {
                                        Api.NodeFs.mkdirSync(childPath);
                                    }
                            } catch (e) {
                                console.error(e);
                        return;
                    }

                                // 递归处理子笔记本
                                processNotebook(child.NotebookId, childPath).then(function (result) {
                                    allNotes = allNotes.concat(result.notes);
                                    processed++;
                                    if (processed === children.length) {
                                        resolve({notes: allNotes, total: allNotes.length});
                                    }
                                });
                            });
                        });
                    });
                }

                // 开始处理整个笔记本树
                processNotebook(notebookId, targetPath).then(function (result) {
                    const total = result.notes.length;
                    let i = 0;
                    async.eachSeries(result.notes, function (note, cb) {
                        if (me.loadingIsClosed) {
                            cb();
                            Flow.hideLoading();
                            return;
                        }
                        i++;
                        Api.loading.setProgress(100 * i / total);

                        // 确定笔记保存的路径
                        let noteNotebook = Api.notebook.getNotebook(note.NotebookId);
                        let notePath = targetPath;
                        if (noteNotebook.NotebookId !== notebookId) {
                            // 构建完整的路径
                            let path = [];
                            let current = noteNotebook;
                            while (current && current.NotebookId !== notebookId) {
                                path.unshift(Flow.fixFilename(current.Title));
                                // 使用 ParentNotebookId 获取父笔记本
                                current = Api.notebook.getNotebook(current.ParentNotebookId);
                            }
                            notePath = targetPath + '/' + path.join('/');
                        }

                        me._exportHTML(note, notePath, function () {
                            cb();
                        }, i, total);
                    }, function () {
                        Flow.hideLoading();
                        Notify.show({title: 'Info', body: getMsg('plugin.export_html.exportSuccess')});
                    });
                });
            }

            // 初始调用
            Flow.chooseDir(function (targetPath) {
                tryExport(targetPath);
            });
        },

        exportHTML: function (noteIds) {
            const me = this;
            if (!noteIds || noteIds.length === 0) {
                return;
            }
            Flow.chooseDir(function (targetPath) {
                if (!targetPath) {
                    return;
                }

                Flow.startLoading(me, 'plugin.export_html.Exporting');

                let i = 0;
                const total = noteIds.length;

                async.eachSeries(noteIds, function (noteId, cb) {
                    if (me.loadingIsClosed) {
                        cb();
                        return;
                    }

                    i++;
                    Api.loading.setProgress(100 * i / total);
                    Api.noteService.getNote(noteId, function (note) {

                        me._exportHTML(note, targetPath, function () {
                            cb();
                        }, i, total);
                    });

                }, function () {
                    Flow.hideLoading();
                    Notify.show({title: 'Info', body: getMsg('plugin.export_html.exportSuccess')});
                });
            });
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