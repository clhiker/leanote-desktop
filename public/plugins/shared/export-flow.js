define(function () {
    const Flow = {
        replaceAll: function (src, pattern, to) {
            if (!src) {
                return src;
            }
            while (true) {
                const oldSrc = src;
                src = src.replace(pattern, to);
                if (oldSrc === src) {
                    return src;
                }
            }
        },

        fixFilename: function (filename) {
            const reg = new RegExp("[/#$!^*\' \"%&()+,:;<>=?@|\\\\]", 'g');
            filename = filename.replace(reg, "-");
            while (filename.indexOf('--') !== -1) {
                filename = Flow.replaceAll(filename, '--', '-');
            }
            if (filename.length > 1) {
                filename = filename.replace(/-$/, '');
            }
            return filename;
        },

        uniqueFile: function (pathInfo, n, cb) {
            if (n > 1) {
                pathInfo.nameNotExt = pathInfo.nameNotExtRaw + '-' + n;
            }
            const absPath = pathInfo.getFullPath();
            Api.NodeFs.exists(absPath, function (exists) {
                exists ? Flow.uniqueFile(pathInfo, n + 1, cb) : cb(absPath);
            });
        },

        uniqueAssets: function (basePath, nameNotExt, n, cb) {
            let absPath = basePath + Api.commonService.getPathSep() + nameNotExt + '_files';
            if (n > 1) {
                absPath += '-' + n;
            }
            Api.NodeFs.exists(absPath, function (exists) {
                exists ? Flow.uniqueAssets(basePath, nameNotExt, n + 1, cb) : cb(absPath);
            });
        },

        chooseDir: function (cb) {
            Api.gui.dialog.showOpenDialog(Api.gui.getCurrentWindow(), {
                defaultPath: Api.getDefaultPath(),
                properties: ['openDirectory']
            }).then(function (re) {
                if (re.canceled !== false || re.filePaths.length < 1) {
                    return cb();
                }
                Api.saveLastPath(re.filePaths[0]);
                cb(re.filePaths[0]);
            });
        },

        startLoading: function (plugin, msgKey) {
            plugin.loadingIsClosed = false;
            Api.loading.show(Api.getMsg(msgKey), {
                hasProgress: true,
                isLarge: true,
                onClose: function () {
                    plugin.loadingIsClosed = true;
                    Flow.hideLoading();
                }
            });
            Api.loading.setProgress(1);
        },

        hideLoading: function () {
            setTimeout(function () {
                Api.loading.hide();
            }, 1000);
        },

        registerExportMenu: function (plugin, labelKey, noteClick, notebookClick) {
            Api.addExportMenu({
                label: Api.getMsg(labelKey),
                enabled: function () {
                    return true;
                },
                click: function (noteIds) {
                    plugin.init();
                    noteClick(noteIds);
                }
            });
            Api.addExportMenuForNotebook({
                label: Api.getMsg(labelKey),
                enabled: function () {
                    return true;
                },
                click: function (notebookId) {
                    plugin.init();
                    notebookClick(notebookId);
                }
            });
        },

        exportNotes: function (plugin, noteIds, msgKey, successKey, exportMethod) {
            if (!noteIds || noteIds.length === 0) {
                return;
            }
            Flow.chooseDir(async function (targetPath) {
                if (!targetPath) {
                    return;
                }
                Flow.startLoading(plugin, msgKey);
                let i = 0;
                const total = noteIds.length;
                for (const noteId of noteIds) {
                    if (plugin.loadingIsClosed) {
                        Flow.hideLoading();
                        continue;
                    }
                    i++;
                    Api.loading.setProgress(100 * i / total);
                    const note = await new Promise(resolve => Api.noteService.getNote(noteId, resolve));
                    await new Promise(resolve => plugin[exportMethod](note, targetPath, resolve, i, total));
                }
                Flow.hideLoading();
                Notify.show({title: 'Info', body: getMsg(successKey)});
            });
        },

        exportForNotebook: function (plugin, notebookId, msgKey, successKey, exportMethod) {
            if (!notebookId) {
                return;
            }

            async function processNotebook(id, currentPath) {
                const allNotes = [];
                const notes = await new Promise(resolve => Api.noteService.getNotes(id, resolve));
                if (notes) {
                    allNotes.push(...notes);
                }
                const children = Api.notebook.getSubNotebooks(id) || [];
                for (const child of children) {
                    const childPath = currentPath + '/' + Flow.fixFilename(child.Title);
                    try {
                        if (!Api.NodeFs.existsSync(childPath)) {
                            Api.NodeFs.mkdirSync(childPath);
                        }
                    } catch (e) {
                        console.error(e);
                        continue;
                    }
                    allNotes.push(...await processNotebook(child.NotebookId, childPath));
                }
                return allNotes;
            }

            function tryExport(targetPath) {
                if (!targetPath) {
                    return;
                }
                const notebook = Api.notebook.getNotebook(notebookId);
                const notebookName = Flow.fixFilename(notebook.Title);
                const newPath = targetPath + '/' + notebookName;
                try {
                    if (Api.NodeFs.existsSync(newPath)) {
                        Api.gui.dialog.showMessageBoxSync(Api.gui.getCurrentWindow(), {
                            type: 'warning',
                            buttons: ['确定'],
                            title: '警告',
                            message: '目录 "' + notebookName + '" 已存在，请选择其他目录保存。'
                        });
                        Flow.chooseDir(tryExport);
                        return;
                    }
                    Api.NodeFs.mkdirSync(newPath);
                } catch (e) {
                    console.error(e);
                    return;
                }

                Flow.startLoading(plugin, msgKey);
                processNotebook(notebookId, newPath).then(async (notes) => {
                    const total = notes.length;
                    let i = 0;
                    for (const note of notes) {
                        if (plugin.loadingIsClosed) {
                            Flow.hideLoading();
                            continue;
                        }
                        i++;
                        Api.loading.setProgress(100 * i / total);
                        const noteNotebook = Api.notebook.getNotebook(note.NotebookId);
                        let notePath = newPath;
                        if (noteNotebook.NotebookId !== notebookId) {
                            const path = [];
                            let current = noteNotebook;
                            while (current && current.NotebookId !== notebookId) {
                                path.unshift(Flow.fixFilename(current.Title));
                                current = Api.notebook.getNotebook(current.ParentNotebookId);
                            }
                            notePath = newPath + '/' + path.join('/');
                        }
                        await new Promise(resolve => plugin[exportMethod](note, notePath, resolve, i, total));
                    }
                    Flow.hideLoading();
                    Notify.show({title: 'Info', body: getMsg(successKey)});
                });
            }

            Flow.chooseDir(tryExport);
        }
    };
    return Flow;
});
