/**
 * 导出PDF插件
 * @author  life life@leanote.com
 * 选择目录, 将图片保存到文件夹中, 有个html文件(以笔记名命名)
 * 注意, fs.existsSync总返回false, readFileSync可用
 */
define(['../shared/export-flow'], function(Flow) {
    let async; // = require('async');

    return {
        langs: {
            'en-us': {
                'export': 'Export PDF',
                'Exporting': 'Exporting',
                'Exporting: ': 'Exporting: ',
                'exportSuccess': 'PDF saved successful!',
                'exportFailure': 'PDF saved failure!',
            },
            'de-de': {
                'export': 'Als PDF exportieren',
                'Exporting': 'Exportiere',
                'Exporting: ': 'Exportiere: ',
                'exportSuccess': 'PDF erfolgreich gespeichert!',
                'exportFailure': 'PDF speichern fehlgeschlagen!',
            },
            'zh-cn': {
                'export': '导出PDF',
                'Exporting': '正在导出',
                'Exporting: ': '正在导出: ',
                'exportSuccess': 'PDF导出成功!',
                'exportFailure': 'PDF导出失败!'
            },
            'zh-hk': {
                'export': '導出PDF',
                'Exporting': '正在導出',
                'Exporting: ': '正在導出: ',
                'exportSuccess': 'PDF導出成功!',
                'exportFailure': 'PDF導出失敗!'
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
            me._initExportPdf();
        },

        // 调用main导出pdf
        _exportPdfSeq: 1,
        _exportPdfCallback: {},
        _initExportPdf: function () {
            const me = this;
            // console.log('_initExportPdf');
            Api.ipc.on('export-pdf-ret', function (event, arg) {
                const seq = arg.seq;
                // console.log('export-pdf-ret');
                // console.log(arg);
                // console.log(me._exportPdfCallback[seq]);
                if (me._exportPdfCallback[seq]) {
                    me._exportPdfCallback[seq](arg);
                }
            });
        },
        exportPdf: function (htmlPath, targetPdfPath, isMarkdown, callback) {
            this._exportPdfSeq++;
            this._exportPdfCallback[this._exportPdfSeq] = callback;
            Api.ipc.send('export-pdf', {
                htmlPath: htmlPath,
                targetPdfPath: targetPdfPath,
                isMarkdown: isMarkdown,
                seq: this._exportPdfSeq
            });
        },

        getPluginPath: function () {
            return Api.evtService.getProjectBasePath() + '/public/plugins/export_pdf';
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
            tpl = tpl.replace("{content}", function () {
                return note.Content; // 为什么要这样? 因为 $$ 替换后变成了一个!!
            });
            return tpl;
        },

        loadingIsClosed: false,

                exportPDFForNotebook: function (notebookId) {
            Flow.exportForNotebook(this, notebookId, 'plugin.export_pdf.Exporting', 'plugin.export_pdf.exportSuccess', '_exportPDF');
        },

                exportPDF: function (noteIds) {
            Flow.exportNotes(this, noteIds, 'plugin.export_pdf.Exporting', 'plugin.export_pdf.exportSuccess', '_exportPDF');
        },

        _exportPDF: function (note, path, callback, i, total) {
            const me = this;
            if (!note) {
                return;
            }

            if (me.loadingIsClosed) {
                callback();
                return;
            }

            setTimeout(function () {
                Api.loading.setMsg(Api.getMsg('plugin.export_pdf.Exporting: ') + (note.Title || getMsg('Untitled')));
                Api.loading.setProgressRate(i + '/' + total);
            }, 100);

            let name = note.Title ? note.Title + '.pdf' : getMsg('Untitled') + '.pdf';
            name = Flow.fixFilename(name);

            const targetPath = path + Api.commonService.getPathSep() + name;

            // 将路径和名字区分开
            const pathInfo = Api.commonService.splitFile(targetPath);
            pathInfo.nameNotExt = Flow.fixFilename(pathInfo.nameNotExt); // 重新修正一次
            const nameNotExt = pathInfo.nameNotExt;
            pathInfo.nameNotExtRaw = pathInfo.nameNotExt;

            // 得到可用文件的绝对路径
            Flow.uniqueFile(pathInfo, 1, function (absPdfFilePath) {
                // 得到存放assets的目录
                const html = me.render(note);
                let tempPath = Api.gui.app.getPath('temp');
                const last = tempPath[tempPath.length - 1];
                if (last === '/' || last === '\\') {
                    tempPath = tempPath.substr(0, tempPath.length - 1);
                }
                const targetHtmlPath = tempPath + '/' + (new Date().getTime()) + '.html';

                // 把html文件写到tmp目录
                Api.commonService.writeFile(targetHtmlPath, html);
                me.exportPdf(targetHtmlPath, absPdfFilePath, note.IsMarkdown, function (args) {
                    // console.log('export pdf ret');
                    callback(args.ok);
                });
            });
        },

        // 打开前要执行的
        onOpen: function () {
            const me = this;
            Flow.registerExportMenu(me, 'plugin.export_pdf.export',
                noteIds => me.exportPDF(noteIds),
                notebookId => me.exportPDFForNotebook(notebookId));
        },
        // 打开后
        onOpenAfter: function () {
        },
        // 关闭时需要运行的
        onClose: function () {
        }
    };
});