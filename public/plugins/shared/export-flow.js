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
        }
    };
    return Flow;
});
